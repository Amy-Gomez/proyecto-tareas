<script setup>
/**
 * Formulario de crear y editar. Valida en el cliente y muestra los errores por campo de la API.
 * No llama a la API: emite "enviar" con los datos listos.
 */
import { reactive, ref, computed } from 'vue'
import { PRIORIDADES, ESTADOS, ETIQUETAS, validarTarea, inicioMesActual } from '../utils/tareas'

const props = defineProps({
  inicial: { type: Object, default: () => ({}) },
  enviando: { type: Boolean, default: false },
  deshabilitado: { type: Boolean, default: false },
  erroresServidor: { type: Object, default: () => ({}) },
  textoEnviar: { type: String, default: 'Guardar' }
})
const emit = defineEmits(['enviar', 'cancelar'])

const form = reactive({
  titulo: props.inicial.titulo ?? '',
  descripcion: props.inicial.descripcion ?? '',
  prioridad: props.inicial.prioridad ?? 'media',
  estado: props.inicial.estado ?? 'pendiente',
  fechaLimite: props.inicial.fechaLimite ?? ''
})
const fechaMinima = inicioMesActual() // el calendario no permite meses pasados
const intentoEnvio = ref(false)

const datos = computed(() => ({
  titulo: form.titulo.trim().replace(/\s+/g, ' '),
  descripcion: form.descripcion.trim(),
  prioridad: form.prioridad,
  estado: form.estado,
  fechaLimite: form.fechaLimite || null
}))
const erroresCliente = computed(() => validarTarea(datos.value, props.inicial.fechaLimite ?? null))
const errorDe = (campo) => (intentoEnvio.value && erroresCliente.value[campo]) || props.erroresServidor[campo] || ''

function enviar() {
  intentoEnvio.value = true
  const [primerError] = Object.keys(erroresCliente.value)
  if (primerError) return document.getElementById(`t-${primerError}`)?.focus()
  emit('enviar', datos.value)
}
</script>

<template>
  <form class="tarjeta formulario" novalidate @submit.prevent="enviar">
    <fieldset :disabled="enviando || deshabilitado">
      <div class="campo">
        <label for="t-titulo">Título *</label>
        <input id="t-titulo" v-model="form.titulo" type="text" maxlength="100" autocomplete="off" :aria-invalid="!!errorDe('titulo')" />
        <p class="campo__error">{{ errorDe('titulo') }}</p>
      </div>

      <div class="campo">
        <label for="t-descripcion">Descripción</label>
        <textarea id="t-descripcion" v-model="form.descripcion" rows="4" maxlength="500" :aria-invalid="!!errorDe('descripcion')"></textarea>
        <p class="campo__ayuda">{{ form.descripcion.length }}/500</p>
        <p class="campo__error">{{ errorDe('descripcion') }}</p>
      </div>

      <div class="fila-campos">
        <div class="campo">
          <label for="t-prioridad">Prioridad</label>
          <select id="t-prioridad" v-model="form.prioridad">
            <option v-for="p in PRIORIDADES" :key="p" :value="p">{{ ETIQUETAS[p] }}</option>
          </select>
          <p class="campo__error">{{ errorDe('prioridad') }}</p>
        </div>
        <div class="campo">
          <label for="t-estado">Estado</label>
          <select id="t-estado" v-model="form.estado">
            <option v-for="e in ESTADOS" :key="e" :value="e">{{ ETIQUETAS[e] }}</option>
          </select>
          <p class="campo__error">{{ errorDe('estado') }}</p>
        </div>
        <div class="campo">
          <label for="t-fechaLimite">Fecha límite</label>
          <input id="t-fechaLimite" v-model="form.fechaLimite" type="date" :min="fechaMinima" :aria-invalid="!!errorDe('fechaLimite')" />
          <p class="campo__error">{{ errorDe('fechaLimite') }}</p>
        </div>
      </div>
    </fieldset>

    <div class="formulario__acciones">
      <button type="button" class="boton" :disabled="enviando" @click="emit('cancelar')">Cancelar</button>
      <button type="submit" class="boton boton--primario" :disabled="enviando || deshabilitado">
        {{ enviando ? 'Guardando…' : textoEnviar }}
      </button>
    </div>
  </form>
</template>
