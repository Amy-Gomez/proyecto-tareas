/**
 * Capa de dominio: SOLO funciones puras.
 * No acceden a BD, disco, red ni reloj; no mutan sus entradas.
 */
const path = require('node:path');

const PRIORIDADES = Object.freeze(['baja', 'media', 'alta']);
const ESTADOS = Object.freeze(['pendiente', 'en_progreso', 'completada']);
const CAMPOS = Object.freeze(['titulo', 'descripcion', 'prioridad', 'estado', 'fechaLimite']);
const POR_DEFECTO = Object.freeze({ descripcion: '', prioridad: 'media', estado: 'pendiente', fechaLimite: null });

// ---------- transformaciones de datos ----------
const recortar = (v) => (typeof v === 'string' ? v.trim() : v);

/** Clave del índice único: "Informe" y "  INFORME " se consideran iguales. */
const normalizarTitulo = (titulo) => titulo.trim().replace(/\s+/g, ' ').toLowerCase();

const soloCamposEditables = (datos) =>
  Object.fromEntries(CAMPOS.filter((c) => datos[c] !== undefined).map((c) => [c, recortar(datos[c])]));

const conClaveTitulo = (datos) =>
  datos.titulo === undefined ? datos : { ...datos, tituloNormalizado: normalizarTitulo(datos.titulo) };

/** POST y PUT: documento completo (lo omitido toma su valor por defecto). */
const datosCompletos = (datos) => conClaveTitulo({ ...POR_DEFECTO, ...soloCamposEditables(datos) });

/** PATCH: solo lo enviado. */
const datosParciales = (datos) => conClaveTitulo(soloCamposEditables(datos));

// ---------- consultas seguras ----------
const escaparRegex = (texto) => texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Filtro con valores primitivos ya validados. */
const construirFiltro = ({ estado, prioridad, buscar }) => ({
  ...(estado && { estado }),
  ...(prioridad && { prioridad }),
  ...(buscar && { titulo: new RegExp(escaparRegex(buscar.trim()), 'i') })
});

// ---------- salida pública ----------
const fecha = (f) => (f ? new Date(f).toISOString() : null);

const aDTO = (doc) => ({
  id: String(doc._id),
  titulo: doc.titulo,
  descripcion: doc.descripcion,
  prioridad: doc.prioridad,
  estado: doc.estado,
  fechaLimite: doc.fechaLimite ? fecha(doc.fechaLimite).slice(0, 10) : null,
  adjuntos: (doc.adjuntos ?? []).map((a) => ({
    id: String(a._id),
    nombre: a.nombreOriginal,
    tipo: a.tipo,
    tamano: a.tamano,
    url: `/api/tareas/${doc._id}/adjuntos/${a._id}`
  })),
  version: doc.version,
  creadaEn: fecha(doc.creadaEn),
  actualizadaEn: fecha(doc.actualizadaEn)
});

const crearEvento = (accion, datos, ahora) => ({ accion, datos, ocurridoEn: ahora });

// ---------- validación: datos -> lista de errores (vacía = válido) ----------
const esTexto = (v) => typeof v === 'string';
const esObjeto = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const esFecha = (v) =>
  esTexto(v) && /^\d{4}-\d{2}-\d{2}$/.test(v) &&
  !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().startsWith(v);

const regla = (ok, mensaje) => (v) => (ok(v) ? null : mensaje);
const unoDe = (lista) => regla((v) => lista.includes(v), `debe ser uno de: ${lista.join(', ')}`);

const REGLAS_TAREA = Object.freeze({
  titulo: regla((v) => esTexto(v) && v.trim().length >= 3 && v.trim().length <= 100, 'debe ser texto de 3 a 100 caracteres'),
  descripcion: regla((v) => esTexto(v) && v.length <= 500, 'debe ser texto de máximo 500 caracteres'),
  prioridad: unoDe(PRIORIDADES),
  estado: unoDe(ESTADOS),
  fechaLimite: regla((v) => v === null || esFecha(v), 'debe ser una fecha YYYY-MM-DD válida o null')
});

const REGLAS_FILTRO = Object.freeze({
  estado: REGLAS_TAREA.estado,
  prioridad: REGLAS_TAREA.prioridad,
  buscar: regla((v) => esTexto(v) && v.trim().length >= 1 && v.length <= 100, 'debe ser texto de 1 a 100 caracteres')
});

const error = (campo, mensaje) => ({ campo, mensaje });

/** Rechaza campos desconocidos y tipos no primitivos: bloquea {"$ne": ...} y similares. */
const crearValidador = ({ reglas, requeridos = [], alMenosUno = false }) => (datos = {}) => {
  if (!esObjeto(datos)) return [error('cuerpo', 'debe ser un objeto JSON')];
  if (alMenosUno && Object.keys(datos).length === 0) return [error('cuerpo', 'debe incluir al menos un campo')];
  return [
    ...Object.keys(datos).filter((c) => !Object.hasOwn(reglas, c)).map((c) => error(c, 'campo no permitido')),
    ...requeridos.filter((c) => datos[c] === undefined).map((c) => error(c, 'es obligatorio')),
    ...Object.entries(datos)
      .filter(([c]) => Object.hasOwn(reglas, c))
      .map(([c, v]) => error(c, reglas[c](v)))
      .filter((e) => e.mensaje !== null)
  ];
};

const validarCreacion = crearValidador({ reglas: REGLAS_TAREA, requeridos: ['titulo'] });
const validarReemplazo = crearValidador({ reglas: REGLAS_TAREA, requeridos: ['titulo', 'prioridad', 'estado'] });
const validarActualizacion = crearValidador({ reglas: REGLAS_TAREA, alMenosUno: true });
const validarFiltro = crearValidador({ reglas: REGLAS_FILTRO });
const validarId = (id) => (/^[a-f0-9]{24}$/i.test(id) ? [] : [error('id', 'debe ser un ObjectId válido')]);

/** If-Match opci onal para concurrencia optimista: '"3"' -> 3. */
const leerVersion = (cabecera) => {
  if (cabecera === undefined) return { version: undefined, errores: [] };
  const m = /^(?:W\/)?"?(\d{1,9})"?$/.exec(cabecera.trim());
  return m
    ? { version: Number(m[1]), errores: [] }
    : { version: undefined, errores: [error('If-Match', 'debe ser la versión de la tarea, p. ej. "3"')] };
};

// ---------- archivos: tipo real por firma (no por extensión) ----------
const TAMANO_MAXIMO = 2 * 1024 * 1024;
const TIPOS = Object.freeze({
  'application/pdf': { ext: '.pdf', firma: [0x25, 0x50, 0x44, 0x46] },
  'image/png': { ext: '.png', firma: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  'image/jpeg': { ext: '.jpg', firma: [0xff, 0xd8, 0xff] },
  'text/plain': { ext: '.txt', firma: null }
});

const esTextoUtf8 = (buf) => {
  if (buf.includes(0x00)) return false;
  try { new TextDecoder('utf-8', { fatal: true }).decode(buf); return true; } catch { return false; }
};

const detectarTipo = (buf) => {
  if (!buf?.length) return null;
  const binario = Object.keys(TIPOS).find((t) => TIPOS[t].firma?.every((b, i) => buf[i] === b));
  return binario ?? (esTextoUtf8(buf) ? 'text/plain' : null);
};

const extensionDe = (tipo) => TIPOS[tipo].ext;

const sanearNombre = (nombre = 'archivo') =>
  (path.basename(String(nombre).replace(/\\/g, '/')).replace(/[\u0000-\u001f\u007f"<>|:*?]/g, '').trim() || 'archivo').slice(0, 150);

module.exports = {
  PRIORIDADES, ESTADOS, TAMANO_MAXIMO, TIPOS_PERMITIDOS: Object.keys(TIPOS),
  normalizarTitulo, datosCompletos, datosParciales, construirFiltro, aDTO, crearEvento,
  validarCreacion, validarReemplazo, validarActualizacion, validarFiltro, validarId, leerVersion,
  detectarTipo, extensionDe, sanearNombre
};
