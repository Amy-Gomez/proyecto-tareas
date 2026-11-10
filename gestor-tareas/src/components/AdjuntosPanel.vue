<script setup>
/** Lista y subida de adjuntos. Emite "subido" para que la vista recargue la tarea. */
import { ref } from 'vue'
import { api } from '../services/api'
import { useMutacion } from '../composables/usePeticion'
import { avisar } from '../composables/estadoGlobal'
import { ADJUNTOS, validarArchivo, formatoTamano } from '../utils/tareas'

const props = defineProps({
  tareaId: { type: String, required: true },
  adjuntos: { type: Array, required: true },
  deshabilitado: { type: Boolean, default: false }
})
const emit = defineEmits(['subido'])

const archivo = ref(null)
const error = ref('')
const subida = useMutacion(api.subirAdjunto)

function elegir(evento) {
  archivo.value = evento.target.files[0] ?? null
  error.value = archivo.value ? validarArchivo(archivo.value) ?? '' : ''
}

async function subir(evento) {
  const r = await subida.ejecutar(props.tareaId, archivo.value)
  if (r.ignorada) return
  if (!r.ok) return (error.value = r.error.message)
  avisar(`Archivo "${r.resultado.datos.nombre}" subido`)
  evento.target.reset()
  archivo.value = null
  emit('subido')
}
</script>

<template>
  <section class="tarjeta">
    <h2 class="seccion__titulo">Adjuntos</h2>

    <ul v-if="adjuntos.length" class="adjuntos">
      <li v-for="a in adjuntos" :key="a.id" class="adjunto">
        <a :href="a.url" :download="a.nombre">{{ a.nombre }}</a>
        <span class="texto-suave">{{ a.tipo }} · {{ formatoTamano(a.tamano) }}</span>
      </li>
    </ul>
    <p v-else class="texto-suave">Esta tarea no tiene archivos adjuntos.</p>

    <form class="subida" @submit.prevent="subir">
      <input type="file" aria-label="Archivo a adjuntar" :accept="ADJUNTOS.aceptar" :disabled="deshabilitado || subida.enviando.value" @change="elegir" />
      <button type="submit" class="boton boton--primario boton--pequeno" :disabled="!archivo || !!error || deshabilitado || subida.enviando.value">
        {{ subida.enviando.value ? 'Subiendo…' : 'Subir' }}
      </button>
      <p class="campo__ayuda">PDF, PNG, JPEG o texto. Máximo 2 MB.</p>
      <p v-if="error" class="campo__error" role="alert">{{ error }}</p>
    </form>
  </section>
</template>
