<script setup>
/** Lista presentacional: recibe las tareas por props y avisa de las acciones con eventos. */
import { ESTADOS, ETIQUETAS, formatoFecha, estaVencida } from '../utils/tareas'

defineProps({
  tareas: { type: Array, required: true },
  deshabilitado: { type: Boolean, default: false },
  procesandoId: { type: String, default: null }
})
const emit = defineEmits(['cambiar-estado', 'eliminar'])

// El selector vuelve al valor actual; si la API confirma el cambio, la nueva tarea lo actualiza.
function elegirEstado(evento, tarea) {
  const nuevo = evento.target.value
  evento.target.value = tarea.estado
  emit('cambiar-estado', tarea, nuevo)
}
</script>

<template>
  <TransitionGroup tag="ul" name="lista" class="lista-tareas">
    <!-- Clave estable: el id de la tarea, nunca el índice. -->
    <li
      v-for="tarea in tareas"
      :key="tarea.id"
      class="tarjeta tarea"
      :class="[`tarea--${tarea.prioridad}`, { 'tarea--completada': tarea.estado === 'completada', 'tarea--procesando': procesandoId === tarea.id }]"
    >
      <div class="tarea__cuerpo">
        <h3 class="tarea__titulo">
          <RouterLink :to="{ name: 'tarea-detalle', params: { id: tarea.id } }">{{ tarea.titulo }}</RouterLink>
        </h3>
        <p v-if="tarea.descripcion" class="tarea__descripcion">{{ tarea.descripcion }}</p>
        <div class="etiquetas">
          <span class="etiqueta" :class="`etiqueta--${tarea.prioridad}`">Prioridad {{ ETIQUETAS[tarea.prioridad].toLowerCase() }}</span>
          <span v-if="estaVencida(tarea)" class="etiqueta etiqueta--vencida">Vencida</span>
          <span v-if="tarea.fechaLimite" class="texto-suave">Límite: {{ formatoFecha(tarea.fechaLimite) }}</span>
          <span v-if="tarea.adjuntos.length" class="texto-suave">· {{ tarea.adjuntos.length }} adjunto(s)</span>
        </div>
      </div>

      <div class="tarea__acciones">
        <select
          class="selector-estado"
          :class="`selector-estado--${tarea.estado}`"
          :value="tarea.estado"
          :disabled="deshabilitado || procesandoId === tarea.id"
          :aria-label="`Estado de ${tarea.titulo}`"
          @change="elegirEstado($event, tarea)"
        >
          <option v-for="e in ESTADOS" :key="e" :value="e">{{ ETIQUETAS[e] }}</option>
        </select>
        <button
          type="button"
          class="boton boton--peligro boton--pequeno"
          :disabled="deshabilitado || procesandoId === tarea.id"
          :aria-label="`Eliminar ${tarea.titulo}`"
          @click="emit('eliminar', tarea)"
        >
          Eliminar
        </button>
      </div>
    </li>
  </TransitionGroup>
</template>
