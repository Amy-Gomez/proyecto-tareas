/**
 * Capa HTTP: rutas, validación de entrada y traducción a códigos de estado.
 * Sin lógica de negocio. Express 5 propaga los errores async al manejador global.
 */
const { Router } = require('express');
const multer = require('multer');
const d = require('./dominio');
const { validacion, archivoInvalido } = require('./errores');

const validar = (fuente, validador) => (req, res, next) => {
  const errores = validador(req[fuente] ?? {});
  next(errores.length ? validacion(errores) : undefined);
};

const validarParametro = (req, res, next, id) => {
  const errores = d.validarId(id);
  next(errores.length ? validacion(errores) : undefined);
};

const version = (req) => {
  const { version: v, errores } = d.leerVersion(req.get('If-Match'));
  if (errores.length) throw validacion(errores);
  return v;
};

const responder = (res, estado, tarea) => res.status(estado).set('ETag', `"${tarea.version}"`).json({ datos: tarea });

const subirArchivo = multer({ storage: multer.memoryStorage(), limits: { fileSize: d.TAMANO_MAXIMO, files: 1 } }).single('archivo');

const crearRutas = (servicio) => {
  const r = Router();

  r.param('id', validarParametro);
  r.param('adjuntoId', validarParametro);

  // ---- CRUD ----
  r.get('/', validar('query', d.validarFiltro), async (req, res) => {
    const tareas = await servicio.listar(req.query);
    res.status(200).json({ datos: tareas, total: tareas.length });
  });

  r.get('/:id', async (req, res) => responder(res, 200, await servicio.obtener(req.params.id)));

  r.post('/', validar('body', d.validarCreacion), async (req, res) => {
    const tarea = await servicio.crear(req.body);
    responder(res.location(`/api/tareas/${tarea.id}`), 201, tarea);
  });

  r.put('/:id', validar('body', d.validarReemplazo), async (req, res) =>
    responder(res, 200, await servicio.reemplazar(req.params.id, req.body, version(req))));

  r.patch('/:id', validar('body', d.validarActualizacion), async (req, res) =>
    responder(res, 200, await servicio.actualizar(req.params.id, req.body, version(req))));

  r.delete('/:id', async (req, res) => {
    await servicio.eliminar(req.params.id, version(req));
    res.status(204).end();
  });

  // ---- archivos ----
  r.post('/:id/adjuntos', subirArchivo, async (req, res) => {
    if (!req.file) throw archivoInvalido("Envía un archivo en el campo 'archivo' (multipart/form-data)");
    const adjunto = await servicio.agregarAdjunto(req.params.id, req.file);
    res.status(201).location(adjunto.url).json({ datos: adjunto });
  });

  r.get('/:id/adjuntos/:adjuntoId', async (req, res) => {
    const { ruta, nombre, tipo } = await servicio.obtenerAdjunto(req.params.id, req.params.adjuntoId);
    res.set('X-Content-Type-Options', 'nosniff').type(tipo).download(ruta, nombre);
  });

  return r;
};

module.exports = { crearRutas };
