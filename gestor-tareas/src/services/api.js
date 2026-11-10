/**
 * Único acceso HTTP de la aplicación: valida response.ok, traduce los errores
 * de la API ({ error: { codigo, mensaje, detalles } }) y admite cancelación.
 */

export class ApiError extends Error {
  constructor({ estado = 0, codigo = 'ERROR', mensaje = 'Error inesperado', detalles = [] }) {
    super(mensaje)
    this.estado = estado
    this.codigo = codigo
    this.detalles = detalles
  }

  /** { titulo: 'debe ser único', ... } para mostrar junto a cada campo. */
  get erroresPorCampo() {
    return Object.fromEntries(this.detalles.map((d) => [d.campo, d.mensaje]))
  }
}

/** Una petición cancelada por la propia app no es un error que mostrar. */
export const esCancelacion = (err) => err?.name === 'AbortError'

async function solicitar(ruta, { metodo = 'GET', cuerpo, version, signal, tiempoMaximo = 10_000 } = {}) {
  const esArchivo = cuerpo instanceof FormData
  const cabeceras = { Accept: 'application/json' }
  if (cuerpo !== undefined && !esArchivo) cabeceras['Content-Type'] = 'application/json'
  if (Number.isInteger(version)) cabeceras['If-Match'] = `"${version}"` // concurrencia optimista

  let respuesta
  try {
    respuesta = await fetch(`/api/tareas${ruta}`, {
      method: metodo,
      headers: cabeceras,
      body: esArchivo ? cuerpo : cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
      signal: AbortSignal.any([AbortSignal.timeout(tiempoMaximo), signal].filter(Boolean))
    })
  } catch (err) {
    if (err.name === 'TimeoutError') throw new ApiError({ codigo: 'TIEMPO_AGOTADO', mensaje: 'El servidor tardó demasiado en responder' })
    if (esCancelacion(err)) throw err
    throw new ApiError({ codigo: 'SIN_CONEXION', mensaje: 'No se pudo contactar con el servidor' })
  }

  const esJson = respuesta.headers.get('Content-Type')?.includes('application/json')
  const json = esJson ? await respuesta.json().catch(() => null) : null

  if (!respuesta.ok) {
    throw new ApiError({
      estado: respuesta.status,
      codigo: json?.error?.codigo ?? `HTTP_${respuesta.status}`,
      mensaje: json?.error?.mensaje ?? `El servidor respondió ${respuesta.status}`,
      detalles: json?.error?.detalles ?? []
    })
  }
  // X-Desde-Cache lo agrega el service worker cuando no hubo red.
  return { datos: json?.datos ?? null, desdeCache: respuesta.headers.get('X-Desde-Cache') === '1' }
}

/** Solo envía filtros con valor: la API rechaza estado='' o buscar=''. */
const consulta = (filtros) => {
  const params = new URLSearchParams(Object.entries(filtros).filter(([, v]) => v))
  return params.size ? `?${params}` : ''
}

export const api = {
  listar: (filtros, opciones) => solicitar(consulta(filtros), opciones),
  obtener: (id, opciones) => solicitar(`/${id}`, opciones),
  crear: (tarea) => solicitar('', { metodo: 'POST', cuerpo: tarea }),
  actualizar: (id, cambios, version) => solicitar(`/${id}`, { metodo: 'PATCH', cuerpo: cambios, version }),
  eliminar: (id, version) => solicitar(`/${id}`, { metodo: 'DELETE', version }),
  subirAdjunto: (id, archivo) => {
    const formulario = new FormData()
    formulario.append('archivo', archivo)
    return solicitar(`/${id}/adjuntos`, { metodo: 'POST', cuerpo: formulario, tiempoMaximo: 30_000 })
  }
}
