<script setup>
/** Controles de filtrado. No consulta la API: solo emite los filtros elegidos. */
import { ref, watch, onBeforeUnmount } from 'vue'
import { PRIORIDADES, ESTADOS, ETIQUETAS } from '../utils/tareas'

const props = defineProps({ modelValue: { type: Object, required: true } }) // { estado, prioridad, buscar }
const emit = defineEmits(['update:modelValue'])

const cambiar = (campo, valor) => emit('update:modelValue', { ...props.modelValue, [campo]: valor })

// La búsqueda se emite 350 ms después de dejar de teclear, no en cada tecla.
const texto = ref(props.modelValue.buscar)
let temporizador
watch(texto, (v) => {
  clearTimeout(temporizador)
  temporizador = setTimeout(() => cambiar('buscar', v.trim()), 350)
})
onBeforeUnmount(() => clearTimeout(temporizador))

// Si los filtros cambian desde fuera (atrás/adelante del navegador), se sincroniza el campo.
watch(() => props.modelValue.buscar, (v) => {
  if (v !== texto.value.trim()) texto.value = v
})

function limpiar() {
  clearTimeout(temporizador)
  texto.value = ''
  emit('update:modelValue', { estado: '', prioridad: '', buscar: '' })
}
</script>

<template>
  <form class="filtros" role="search" @submit.prevent>
    <label class="campo campo--crecer">
      <span>Buscar por título</span>
      <input v-model="texto" type="search" maxlength="100" placeholder="Ej.: informe" autocomplete="off" />
    </label>
    <label class="campo">
      <span>Estado</span>
      <select :value="modelValue.estado" @change="cambiar('estado', $event.target.value)">
        <option value="">Todos</option>
        <option v-for="e in ESTADOS" :key="e" :value="e">{{ ETIQUETAS[e] }}</option>
      </select>
    </label>
    <label class="campo">
      <span>Prioridad</span>
      <select :value="modelValue.prioridad" @change="cambiar('prioridad', $event.target.value)">
        <option value="">Todas</option>
        <option v-for="p in PRIORIDADES" :key="p" :value="p">{{ ETIQUETAS[p] }}</option>
      </select>
    </label>
    <button type="button" class="boton" @click="limpiar">Limpiar</button>
  </form>
</template>
