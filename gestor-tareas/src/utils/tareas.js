/** Reglas y formato de las tareas. Las reglas replican las de la API; el servidor sigue siendo la autoridad. */

export const PRIORIDADES = ['baja', 'media', 'alta']
export const ESTADOS = ['pendiente', 'en_progreso', 'completada']
export const ETIQUETAS = {
  baja: 'Baja', media: 'Media', alta: 'Alta',
  pendiente: 'Pendiente', en_progreso: 'En progreso', completada: 'Completada'
}
export const ADJUNTOS = {
  tamanoMaximo: 2 * 1024 * 1024,
  tipos: ['application/pdf', 'image/png', 'image/jpeg', 'text/plain'],
  aceptar: '.pdf,.png,.jpg,.jpeg,.txt'
}

/** 'AAAA-MM-01' del mes en curso */
export function inicioMesActual(hoy = new Date()) {
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-01`
}

const esFechaValida = (v) =>
  /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().startsWith(v)


export function validarTarea(t, fechaOriginal = null) {
  const errores = {}
  const titulo = t.titulo.trim()
  if (titulo.length < 3 || titulo.length > 100) errores.titulo = 'Debe tener entre 3 y 100 caracteres'
  if (t.descripcion.length > 500) errores.descripcion = 'Máximo 500 caracteres'
  if (!PRIORIDADES.includes(t.prioridad)) errores.prioridad = 'Selecciona una prioridad válida'
  if (!ESTADOS.includes(t.estado)) errores.estado = 'Selecciona un estado válido'
  if (t.fechaLimite !== null) {
    if (!esFechaValida(t.fechaLimite)) errores.fechaLimite = 'Fecha inválida'
    else if (t.fechaLimite !== fechaOriginal && t.fechaLimite < inicioMesActual()) {
      errores.fechaLimite = 'Elige una fecha desde el mes actual en adelante'
    }
  }
  return errores
}

export function validarArchivo(archivo) {
  if (archivo.size === 0) return 'El archivo está vacío'
  if (archivo.size > ADJUNTOS.tamanoMaximo) return 'El archivo supera 2 MB'
  if (archivo.type && !ADJUNTOS.tipos.includes(archivo.type)) return 'Solo se permiten PDF, PNG, JPEG o texto'
  return null
}

/** Solo los campos modificados, para enviar un PATCH mínimo. */
export function diferencias(original, editado) {
  return Object.fromEntries(Object.entries(editado).filter(([campo, valor]) => (original[campo] ?? null) !== valor))
}



/** 'AAAA-MM-DD' como fecha local (new Date('2026-11-15') sería UTC y mostraría el día anterior). */
const fechaLocal = (iso) => {
  const [a, m, d] = iso.split('-').map(Number)
  return new Date(a, m - 1, d)
}

export const formatoFecha = (iso) =>
  iso ? fechaLocal(iso).toLocaleDateString('es-EC', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

export const formatoFechaHora = (iso) =>
  iso ? new Date(iso).toLocaleString('es-EC', { dateStyle: 'medium', timeStyle: 'short' }) : '—'

export function estaVencida(tarea) {
  if (!tarea.fechaLimite || tarea.estado === 'completada') return false
  const limite = fechaLocal(tarea.fechaLimite)
  limite.setHours(23, 59, 59)
  return limite < new Date()
}

export function formatoTamano(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}
