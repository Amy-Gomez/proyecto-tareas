/**
 * El único estado compartido de la app (no hace falta Pinia):
 * - avisos: cualquier vista notifica y AvisosGlobales.vue los muestra;
 * - enLinea: la conexión afecta a toda la interfaz.
 */
import { reactive, readonly, ref } from 'vue'

const lista = reactive([])
let siguienteId = 1

export const avisos = readonly(lista)

export function cerrarAviso(id) {
  const i = lista.findIndex((a) => a.id === id)
  if (i !== -1) lista.splice(i, 1)
}

export function avisar(mensaje, tipo = 'exito') {
  const id = siguienteId++
  lista.push({ id, mensaje, tipo })
  setTimeout(() => cerrarAviso(id), tipo === 'error' ? 6000 : 4000)
}

const conexion = ref(navigator.onLine)
window.addEventListener('online', () => (conexion.value = true))
window.addEventListener('offline', () => (conexion.value = false))
export const enLinea = readonly(conexion)
