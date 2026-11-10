/**
 * Capa de E/S: MongoDB (Mongoose) y disco. Es la únic que toca el exterior.
 */
const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const mongoose = require('mongoose');
const { PRIORIDADES, ESTADOS } = require('./dominio');
const { duplicado } = require('./errores');

// Segunda barrera contra inyección: envuelve en $eq cualquier objeto con claves "$..." en filtros.
mongoose.set('sanitizeFilter', true);
mongoose.set('strictQuery', true);

const Tarea = mongoose.model('Tarea', new mongoose.Schema(
  {
    titulo: { type: String, required: true, minlength: 3, maxlength: 100 },
    tituloNormalizado: { type: String, required: true, unique: true },
    descripcion: { type: String, default: '', maxlength: 500 },
    prioridad: { type: String, enum: PRIORIDADES, default: 'media' },
    estado: { type: String, enum: ESTADOS, default: 'pendiente' },
    fechaLimite: { type: Date, default: null },
    adjuntos: [{ nombreOriginal: String, nombreAlmacenado: String, tipo: String, tamano: Number }],
    version: { type: Number, default: 0 }
  },
  { versionKey: false, strict: 'throw', timestamps: { createdAt: 'creadaEn', updatedAt: 'actualizadaEn' } }
));

const conectar = async (uri) => {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  await Tarea.init(); // garantiza el índice único antes de aceptar peticiones
};
const desconectar = () => mongoose.disconnect();

/** Traduce la violación del índice único a un conflicto 409. */
const traducir = (operacion) => async (...args) => {
  try { return await operacion(...args); } catch (err) { throw err?.code === 11000 ? duplicado() : err; }
};

const ESCRITURA = Object.freeze({ returnDocument: 'after', runValidators: true, lean: true });

/** Si llega una versión, la escritura solo aplica si la tarea sigue en esa versión. */
const filtroId = (id, version) => ({ _id: id, ...(version !== undefined && { version }) });

const repositorio = Object.freeze({
  listar: (filtro) => Tarea.find(filtro).sort({ creadaEn: -1 }).lean(),
  obtener: (id) => Tarea.findById(id).lean(),
  existe: async (id) => (await Tarea.exists({ _id: id })) !== null,
  crear: traducir(async (datos) => (await Tarea.create(datos)).toObject()),
  actualizar: traducir((id, cambios, version) =>
    Tarea.findOneAndUpdate(filtroId(id, version), { $set: cambios, $inc: { version: 1 } }, ESCRITURA)),
  eliminar: (id, version) => Tarea.findOneAndDelete(filtroId(id, version)).lean(),
  agregarAdjunto: (id, adjunto) =>
    Tarea.findByIdAndUpdate(id, { $push: { adjuntos: adjunto }, $inc: { version: 1 } }, ESCRITURA)
});

/** Archivos en disco con nombre UUID generado por el servidor (evita path traversal). */
const NOMBRE_SEGURO = /^[0-9a-f-]{36}\.(pdf|png|jpg|txt)$/;

const crearAlmacen = (directorio) => {
  const ruta = (nombre) => {
    if (!NOMBRE_SEGURO.test(nombre)) throw new Error(`Nombre de archivo no seguro: ${nombre}`);
    return path.join(directorio, nombre);
  };
  return Object.freeze({
    ruta,
    guardar: async (buffer, extension) => {
      await fs.mkdir(directorio, { recursive: true });
      const nombre = `${randomUUID()}${extension}`;
      await fs.writeFile(ruta(nombre), buffer, { flag: 'wx', mode: 0o600 });
      return nombre;
    },
    eliminar: (nombres) => Promise.allSettled(nombres.map((n) => fs.rm(ruta(n), { force: true })))
  });
};

module.exports = { conectar, desconectar, repositorio, crearAlmacen };
