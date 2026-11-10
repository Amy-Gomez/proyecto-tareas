const { test } = require('node:test');
const assert = require('node:assert/strict');
const d = require('../src/dominio');

const campos = (errores) => errores.map((e) => e.campo).sort();

test('datosCompletos aplica valores por defecto y normaliza el título', () => {
  const datos = d.datosCompletos({ titulo: '  Informe   Mensual ' });
  assert.equal(datos.titulo, 'Informe   Mensual');
  assert.equal(datos.tituloNormalizado, 'informe mensual');
  assert.equal(datos.estado, 'pendiente');
});

test('datosParciales no muta la entrada y solo incluye lo enviado', () => {
  const entrada = Object.freeze({ estado: 'completada', otro: 1 });
  assert.deepEqual(d.datosParciales(entrada), { estado: 'completada' });
});

test('construirFiltro escapa la búsqueda (literal, no patrón)', () => {
  const { titulo } = d.construirFiltro({ buscar: '.*' });
  assert.ok(titulo.test('a.*b'));
  assert.ok(!titulo.test('cualquier cosa'));
});

test('validación reporta todos los errores y bloquea operadores', () => {
  assert.deepEqual(campos(d.validarCreacion({ prioridad: 'x', _id: 1 })), ['_id', 'prioridad', 'titulo']);
  assert.deepEqual(campos(d.validarCreacion({ titulo: { $ne: null } })), ['titulo']);
  assert.deepEqual(campos(d.validarFiltro({ 'estado[$ne]': 'x' })), ['estado[$ne]']);
  assert.equal(d.validarId('{"$gt":""}').length, 1);
});

test('leerVersion interpreta If-Match', () => {
  assert.equal(d.leerVersion('"3"').version, 3);
  assert.equal(d.leerVersion(undefined).version, undefined);
  assert.equal(d.leerVersion('abc').errores.length, 1);
});

test('detectarTipo usa la firma real y sanearNombre quita rutas', () => {
  assert.equal(d.detectarTipo(Buffer.from('%PDF-1.7')), 'application/pdf');
  assert.equal(d.detectarTipo(Buffer.from('hola')), 'text/plain');
  assert.equal(d.detectarTipo(Buffer.from([0x4d, 0x5a, 0x00])), null);
  assert.equal(d.sanearNombre('../../etc/passwd'), 'passwd');
});
