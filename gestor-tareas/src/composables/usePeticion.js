import { ref, shallowRef, getCurrentScope, onScopeDispose } from 'vue'
import { esCancelacion } from '../services/api'

/**
 * Lecturas con estados (inactivo, cargando, exito, vacio, error) y sin condiciones de carrera:
 * cada ejecución cancela la anterior, las respuestas tardías se descartan
 * y al desmontar el componente se cancela lo pendiente.
 */
export function usePeticion(funcion, { esVacio = (d) => Array.isArray(d) && d.length === 0 } = {}) {
  const estado = ref('inactivo')
  const datos = shallowRef(null)
  const error = shallowRef(null)
  const desdeCache = ref(false)
  let controlador = null
  let secuencia = 0

  async function ejecutar(...args) {
    controlador?.abort()
    controlador = new AbortController()
    const id = ++secuencia
    estado.value = 'cargando'
    try {
      const respuesta = await funcion(...args, { signal: controlador.signal })
      if (id !== secuencia) return // llegó tarde: ya hay una petición más nueva
      establecer(respuesta.datos)
      desdeCache.value = respuesta.desdeCache
    } catch (err) {
      if (id !== secuencia || esCancelacion(err)) return
      error.value = err
      estado.value = 'error'
    }
  }

  /** También sirve para actualizar los datos tras una mutación sin volver a pedirlos. */
  function establecer(nuevos) {
    datos.value = nuevos
    error.value = null
    estado.value = esVacio(nuevos) ? 'vacio' : 'exito'
  }

  if (getCurrentScope()) {
    onScopeDispose(() => {
      secuencia++
      controlador?.abort()
    })
  }

  return { estado, datos, error, desdeCache, ejecutar, establecer }
}

/** Escrituras: evita envíos duplicados mientras hay uno en curso. Devuelve { ok, resultado | error }. */
export function useMutacion(funcion) {
  const enviando = ref(false)

  async function ejecutar(...args) {
    if (enviando.value) return { ok: false, ignorada: true }
    enviando.value = true
    try {
      return { ok: true, resultado: await funcion(...args) }
    } catch (error) {
      return { ok: false, error }
    } finally {
      enviando.value = false
    }
  }

  return { enviando, ejecutar }
}
