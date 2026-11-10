/** Pruebas de endpoints contra MongoDB real (MONGODB_URI_TEST) y Socket.IO */
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const mongoose = require('mongoose');
const { io } = require('socket.io-client');
const { crearServidor } = require('../src/server');

const URI = process.env.MONGODB_URI_TEST || 'mongodb://127.0.0.1:27017/api_tareas_test';
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(16, 1)]);
const INEXISTENTE = '6ae372ca6b5c733d7a88d547';

let servidor, raiz, base, dir, socket, eventos;

before(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'adjuntos-'));
  servidor = await crearServidor({ mongoUri: URI, dirAdjuntos: dir });
  raiz = `http://localhost:${await servidor.iniciar(0)}`;
  base = `${raiz}/api/tareas`;
  socket = io(raiz, { transports: ['websocket'] });
  await new Promise((ok) => socket.on('connect', ok));
  socket.on('tarea:cambio', (e) => eventos.push(e));
});

after(async () => {
  socket.close();
  await mongoose.connection.dropDatabase();
  await servidor.detener();
  await fs.rm(dir, { recursive: true, force: true });
});

beforeEach(async () => {
  await mongoose.connection.collection('tareas').deleteMany({});
  eventos = [];
});

const pedir = async (metodo, ruta = '', { json, cuerpo, cabeceras = {} } = {}) => {
  const res = await fetch(base + ruta, {
    method: metodo,
    headers: json !== undefined ? { 'Content-Type': 'application/json', ...cabeceras } : cabeceras,
    body: json !== undefined ? JSON.stringify(json) : cuerpo
  });
  const esJson = (res.headers.get('content-type') ?? '').includes('json');
  return { estado: res.status, cuerpo: esJson ? await res.json() : null, h: res.headers };
};

const crear = async (datos = {}) => (await pedir('POST', '', { json: { titulo: 'Tarea base', ...datos } })).cuerpo.datos;

const subir = (id, buffer, nombre = 'imagen.png') => {
  const fd = new FormData();
  fd.append('archivo', new Blob([buffer]), nombre);
  return pedir('POST', `/${id}/adjuntos`, { cuerpo: fd });
};

const esperarEventos = async (n) => {
  for (let i = 0; i < 100 && eventos.length < n; i += 1) await new Promise((ok) => setTimeout(ok, 10));
  return eventos.map((e) => e.accion);
};

test('CRUD completo con códigos HTTP correctos', async () => {
  const creada = await pedir('POST', '', { json: { titulo: 'Informe', prioridad: 'alta', fechaLimite: '2026-12-01' } });
  assert.equal(creada.estado, 201);
  const { id } = creada.cuerpo.datos;
  assert.equal(creada.h.get('location'), `/api/tareas/${id}`);
  assert.equal(creada.h.get('etag'), '"0"');

  const lista = await pedir('GET', '?prioridad=alta&buscar=info');
  assert.equal(lista.estado, 200);
  assert.equal(lista.cuerpo.total, 1);

  assert.equal((await pedir('GET', `/${id}`)).cuerpo.datos.titulo, 'Informe');

  const parcial = await pedir('PATCH', `/${id}`, { json: { estado: 'en_progreso' } });
  assert.equal(parcial.estado, 200);
  assert.equal(parcial.cuerpo.datos.prioridad, 'alta');

  const completa = await pedir('PUT', `/${id}`, { json: { titulo: 'Informe final', prioridad: 'baja', estado: 'completada' } });
  assert.equal(completa.estado, 200);
  assert.equal(completa.cuerpo.datos.fechaLimite, null); // PUT reemplaza todo
  assert.equal(completa.cuerpo.datos.version, 2);

  assert.equal((await pedir('DELETE', `/${id}`)).estado, 204);
  assert.equal((await pedir('GET', `/${id}`)).estado, 404);
});

test('validación y formato uniforme de errores', async () => {
  const r = await pedir('POST', '', { json: { titulo: 'ab', prioridad: 'urgente' } });
  assert.equal(r.estado, 400);
  assert.deepEqual(Object.keys(r.cuerpo.error), ['codigo', 'mensaje', 'detalles']);
  assert.equal(r.cuerpo.error.codigo, 'VALIDACION');
  assert.equal(r.cuerpo.error.detalles.length, 2);

  assert.equal((await pedir('GET', '/123')).estado, 400);
  assert.equal((await pedir('PATCH', `/${INEXISTENTE}`, { json: {} })).estado, 400);
  assert.equal((await pedir('PATCH', `/${INEXISTENTE}`, { json: { estado: 'completada' } })).cuerpo.error.codigo, 'NO_ENCONTRADO');
  assert.equal(
    (await pedir('POST', '', { cuerpo: '{malo', cabeceras: { 'Content-Type': 'application/json' } })).cuerpo.error.codigo,
    'JSON_INVALIDO'
  );
  assert.equal((await fetch(`${raiz}/api/nada`)).status, 404);
});

test('consultas seguras: bloquea inyección NoSQL', async () => {
  await crear({ titulo: 'Secreta' });
  assert.equal((await pedir('POST', '', { json: { titulo: { $ne: null } } })).estado, 400);
  assert.equal((await pedir('GET', '?estado[$ne]=x')).estado, 400);
  assert.equal((await pedir('GET', `/${encodeURIComponent('{"$gt":""}')}`)).estado, 400);
  assert.equal((await pedir('PATCH', `/${INEXISTENTE}`, { json: { $set: { estado: 'completada' } } })).estado, 400);
  const regex = await pedir('GET', `?buscar=${encodeURIComponent('.*')}`);
  assert.equal(regex.cuerpo.total, 0); // ".*" se busca literal
});

test('conflictos: título duplicado y versión desactualizada', async () => {
  await crear({ titulo: 'Revisar pipeline' });
  const dup = await pedir('POST', '', { json: { titulo: '  REVISAR   pipeline ' } });
  assert.equal(dup.estado, 409);
  assert.equal(dup.cuerpo.error.codigo, 'DUPLICADO');

  const { id } = await crear({ titulo: 'Concurrente' });
  const [a, b] = await Promise.all([
    pedir('PATCH', `/${id}`, { json: { estado: 'en_progreso' }, cabeceras: { 'If-Match': '"0"' } }),
    pedir('PATCH', `/${id}`, { json: { estado: 'completada' }, cabeceras: { 'If-Match': '"0"' } })
  ]);
  assert.deepEqual([a.estado, b.estado].sort(), [200, 409]);
  assert.equal([a, b].find((x) => x.estado === 409).cuerpo.error.codigo, 'CONFLICTO_VERSION');
  assert.equal((await pedir('DELETE', `/${id}`, { cabeceras: { 'If-Match': '"0"' } })).estado, 409);
});

test('archivos: subir, descargar y validar tipo real', async () => {
  const { id } = await crear();
  const subido = await subir(id, PNG, '../../evil.png');
  assert.equal(subido.estado, 201);
  assert.equal(subido.cuerpo.datos.nombre, 'evil.png');

  const descarga = await fetch(raiz + subido.cuerpo.datos.url);
  assert.equal(descarga.status, 200);
  assert.match(descarga.headers.get('content-disposition'), /^attachment/);
  assert.deepEqual(Buffer.from(await descarga.arrayBuffer()), PNG);

  const falso = await subir(id, Buffer.from([0x4d, 0x5a, 0x90, 0x00]), 'foto.png'); // ejecutable disfrazado
  assert.equal(falso.estado, 400);
  assert.equal(falso.cuerpo.error.codigo, 'ARCHIVO_INVALIDO');
  assert.equal((await subir(id, Buffer.alloc(2 * 1024 * 1024 + 1, 0x41), 'g.txt')).estado, 413);
  assert.equal((await subir(INEXISTENTE, PNG)).estado, 404);
  assert.equal((await fs.readdir(dir)).length, 1); // los rechazados no dejan archivos

  await pedir('DELETE', `/${id}`);
  assert.equal((await fs.readdir(dir)).length, 0); // borrar la tarea borra sus archivos
});

test('tiempo real: notifica cada cambio relevante', async () => {
  const { id } = await crear({ titulo: 'Con eventos' });
  await pedir('PATCH', `/${id}`, { json: { estado: 'completada' } });
  await subir(id, PNG);
  await pedir('DELETE', `/${id}`);
  assert.deepEqual(await esperarEventos(4), ['creada', 'actualizada', 'adjunto-agregado', 'eliminada']);
  assert.ok(eventos[0].ocurridoEn);
  assert.equal(eventos[3].datos.id, id);
});
