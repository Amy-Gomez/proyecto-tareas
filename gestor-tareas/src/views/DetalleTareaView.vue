<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import EstadoPeticion from '../components/EstadoPeticion.vue'
import AdjuntosPanel from '../components/AdjuntosPanel.vue'
import { api } from '../services/api'
import { usePeticion, useMutacion } from '../composables/usePeticion'
import { avisar, enLinea } from '../composables/estadoGlobal'
import { ETIQUETAS, formatoFecha, formatoFechaHora, estaVencida } from '../utils/tareas'

const props = defineProps({ id: { type: String, required: true } })
const router = useRouter()

const detalle = usePeticion(api.obtener, { esVacio: () => false })
const cargar = () => detalle.ejecutar(props.id)
cargar()
const tarea = computed(() => detalle.datos.value)

const borrado = useMutacion((t) => api.eliminar(t.id, t.version))
async function eliminar() {
  if (!confirm(`¿Eliminar la tarea "${tarea.value.titulo}"? Se borrarán también sus adjuntos.`)) return
  const r = await borrado.ejecutar(tarea.value)
  if (r.ignorada) return
  if (!r.ok) {
    avisar(r.error.message, 'error')
    if (r.error.codigo === 'CONFLICTO_VERSION') cargar()
    return
  }
  avisar('Tarea eliminada')
  router.push({ name: 'tareas' })
}
</script>

<template>
  <RouterLink :to="{ name: 'tareas' }" class="volver">← Volver a tareas</RouterLink>

  <EstadoPeticion :estado="detalle.estado.value" :error="detalle.error.value" :hay-datos="!!tarea" @reintentar="cargar">
    <template #carga>Cargando tarea…</template>
    <template v-if="detalle.error.value?.codigo === 'NO_ENCONTRADO'" #error-acciones>
      <RouterLink :to="{ name: 'tareas' }" class="boton">Ir al listado</RouterLink>
    </template>

    <template v-if="tarea">
      <article class="tarjeta detalle" :class="`tarea--${tarea.prioridad}`">
        <h1>{{ tarea.titulo }}</h1>
        <div class="etiquetas">
          <span class="etiqueta" :class="`etiqueta--${tarea.estado}`">{{ ETIQUETAS[tarea.estado] }}</span>
          <span class="etiqueta" :class="`etiqueta--${tarea.prioridad}`">Prioridad {{ ETIQUETAS[tarea.prioridad].toLowerCase() }}</span>
          <span v-if="estaVencida(tarea)" class="etiqueta etiqueta--vencida">Vencida</span>
        </div>

        <p class="detalle__descripcion" :class="{ 'texto-suave': !tarea.descripcion }">{{ tarea.descripcion || 'Sin descripción.' }}</p>

        <dl class="datos">
          <div><dt>Fecha límite</dt><dd>{{ formatoFecha(tarea.fechaLimite) }}</dd></div>
          <div><dt>Creada</dt><dd>{{ formatoFechaHora(tarea.creadaEn) }}</dd></div>
          <div><dt>Actualizada</dt><dd>{{ formatoFechaHora(tarea.actualizadaEn) }}</dd></div>
          <div><dt>Versión</dt><dd>{{ tarea.version }}</dd></div>
        </dl>

        <p v-if="detalle.desdeCache.value" class="aviso-cache" role="status">Copia guardada sin conexión; puede no estar actualizada.</p>

        <div class="formulario__acciones">
          <RouterLink v-if="enLinea" :to="{ name: 'tarea-editar', params: { id: tarea.id } }" class="boton boton--primario">Editar</RouterLink>
          <button type="button" class="boton boton--peligro" :disabled="!enLinea || borrado.enviando.value" @click="eliminar">
            {{ borrado.enviando.value ? 'Eliminando…' : 'Eliminar' }}
          </button>
        </div>
      </article>

      <!-- Subir un adjunto incrementa la versión en el servidor: se recarga para mantener vigente el If-Match. -->
      <AdjuntosPanel :tarea-id="tarea.id" :adjuntos="tarea.adjuntos" :deshabilitado="!enLinea" @subido="cargar" />
    </template>
  </EstadoPeticion>
</template>
