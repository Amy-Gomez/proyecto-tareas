<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import TareaFiltros from '../components/TareaFiltros.vue'
import TareaLista from '../components/TareaLista.vue'
import EstadoPeticion from '../components/EstadoPeticion.vue'
import { api } from '../services/api'
import { usePeticion, useMutacion } from '../composables/usePeticion'
import { avisar, enLinea } from '../composables/estadoGlobal'
import { ESTADOS, PRIORIDADES, ETIQUETAS } from '../utils/tareas'

const route = useRoute()
const router = useRouter()

const filtros = computed(() => ({
  estado: ESTADOS.includes(route.query.estado) ? route.query.estado : '',
  prioridad: PRIORIDADES.includes(route.query.prioridad) ? route.query.prioridad : '',
  buscar: typeof route.query.buscar === 'string' ? route.query.buscar.slice(0, 100) : ''
}))
const hayFiltros = computed(() => Object.values(filtros.value).some(Boolean))
const aplicarFiltros = (nuevos) => router.replace({ query: Object.fromEntries(Object.entries(nuevos).filter(([, v]) => v)) })

const lista = usePeticion(api.listar)
const recargar = () => lista.ejecutar(filtros.value)
watch(filtros, recargar, { immediate: true }) // usePeticion cancela la búsqueda anterior

const procesandoId = ref(null)
const accion = useMutacion(async (tarea, operacion) => {
  procesandoId.value = tarea.id
  try {
    return await operacion()
  } finally {
    procesandoId.value = null
  }
})

function manejarFallo(error) {
  if (error.codigo === 'CONFLICTO_VERSION' || error.codigo === 'NO_ENCONTRADO') {
    avisar('La tarea cambió en otro lugar; se actualizó la lista.', 'error')
    recargar()
  } else {
    avisar(error.message, 'error')
  }
}

async function cambiarEstado(tarea, estado) {
  const r = await accion.ejecutar(tarea, () => api.actualizar(tarea.id, { estado }, tarea.version))
  if (r.ignorada) return
  if (!r.ok) return manejarFallo(r.error)
  const nueva = r.resultado.datos
  const sigueEnFiltro = !filtros.value.estado || nueva.estado === filtros.value.estado
  lista.establecer(sigueEnFiltro
    ? lista.datos.value.map((t) => (t.id === nueva.id ? nueva : t))
    : lista.datos.value.filter((t) => t.id !== nueva.id))
  avisar(`"${nueva.titulo}" ahora está: ${ETIQUETAS[estado]}`)
}

async function eliminar(tarea) {
  if (!confirm(`¿Eliminar la tarea "${tarea.titulo}"? Se borrarán también sus adjuntos.`)) return
  const r = await accion.ejecutar(tarea, () => api.eliminar(tarea.id, tarea.version))
  if (r.ignorada) return
  if (!r.ok) return manejarFallo(r.error)
  lista.establecer(lista.datos.value.filter((t) => t.id !== tarea.id))
  avisar('Tarea eliminada')
}
</script>

<template>
  <div class="encabezado-vista">
    <h1>Tareas</h1>
    <p v-if="lista.estado.value === 'exito'" class="texto-suave">
      {{ lista.datos.value.length }} tarea(s){{ hayFiltros ? ' con los filtros aplicados' : '' }}
    </p>
  </div>

  <TareaFiltros :model-value="filtros" @update:model-value="aplicarFiltros" />

  <p v-if="lista.desdeCache.value" class="aviso-cache" role="status">Mostrando la última copia guardada; puede no estar actualizada.</p>

  <EstadoPeticion :estado="lista.estado.value" :error="lista.error.value" :hay-datos="!!lista.datos.value?.length" @reintentar="recargar">
    <template #carga>Cargando tareas…</template>
    <template #vacio>
      <template v-if="hayFiltros">
        <p>Ninguna tarea coincide con los filtros.</p>
        <button type="button" class="boton" @click="aplicarFiltros({})">Quitar filtros</button>
      </template>
      <template v-else>
        <p>Aún no tienes tareas.</p>
        <RouterLink :to="{ name: 'tarea-nueva' }" class="boton boton--acento">Crear la primera</RouterLink>
      </template>
    </template>

    <TareaLista
      :tareas="lista.datos.value ?? []"
      :deshabilitado="!enLinea || accion.enviando.value"
      :procesando-id="procesandoId"
      @cambiar-estado="cambiarEstado"
      @eliminar="eliminar"
    />
  </EstadoPeticion>
</template>
