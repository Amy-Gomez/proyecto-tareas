<script setup>
/** Crear (sin id) o editar (con id) una tarea. */
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import TareaFormulario from '../components/TareaFormulario.vue'
import EstadoPeticion from '../components/EstadoPeticion.vue'
import { api } from '../services/api'
import { usePeticion, useMutacion } from '../composables/usePeticion'
import { avisar, enLinea } from '../composables/estadoGlobal'
import { diferencias } from '../utils/tareas'

const props = defineProps({ id: { type: String, default: null } })
const router = useRouter()
const esEdicion = !!props.id

const carga = usePeticion(api.obtener, { esVacio: () => false })
if (esEdicion) carga.ejecutar(props.id)

const erroresServidor = ref({})
const errorGeneral = ref('')
const conflicto = ref(false)

const guardado = useMutacion((datos) => {
  if (!esEdicion) {
    const { fechaLimite, ...resto } = datos // sin fecha, la API aplica su valor por defecto
    return api.crear(fechaLimite ? datos : resto)
  }
  const tarea = carga.datos.value
  return api.actualizar(tarea.id, diferencias(tarea, datos), tarea.version) // PATCH solo con lo cambiado
})

const irADetalle = (id) => router.push({ name: 'tarea-detalle', params: { id } })

async function guardar(datos) {
  if (esEdicion && !Object.keys(diferencias(carga.datos.value, datos)).length) {
    avisar('No hay cambios que guardar', 'info')
    return irADetalle(props.id)
  }
  erroresServidor.value = {}
  errorGeneral.value = ''
  const r = await guardado.ejecutar(datos)
  if (r.ignorada) return
  if (r.ok) {
    avisar(esEdicion ? 'Cambios guardados' : 'Tarea creada')
    return irADetalle(r.resultado.datos.id)
  }
  if (r.error.codigo === 'CONFLICTO_VERSION') conflicto.value = true
  else if (r.error.detalles.length) erroresServidor.value = r.error.erroresPorCampo
  else errorGeneral.value = r.error.message
}

async function cargarVersionVigente() {
  await carga.ejecutar(props.id)
  conflicto.value = false
}
</script>

<template>
  <div class="vista-angosta">
    <RouterLink v-if="esEdicion" :to="{ name: 'tarea-detalle', params: { id } }" class="volver">← Volver al detalle</RouterLink>
    <h1>{{ esEdicion ? 'Editar tarea' : 'Nueva tarea' }}</h1>

    <div v-if="conflicto" class="alerta alerta--advertencia" role="alert">
      <p><strong>Otra persona modificó esta tarea</strong> mientras la editabas. Carga la versión vigente y vuelve a aplicar tus cambios.</p>
      <button type="button" class="boton boton--pequeno" @click="cargarVersionVigente">Cargar versión vigente</button>
    </div>
    <p v-if="errorGeneral" class="alerta alerta--error" role="alert">{{ errorGeneral }}</p>

    <TareaFormulario
      v-if="!esEdicion"
      texto-enviar="Crear tarea"
      :enviando="guardado.enviando.value"
      :deshabilitado="!enLinea"
      :errores-servidor="erroresServidor"
      @enviar="guardar"
      @cancelar="router.back()"
    />
    <EstadoPeticion v-else :estado="carga.estado.value" :error="carga.error.value" :hay-datos="!!carga.datos.value" @reintentar="carga.ejecutar(id)">
      <template #carga>Cargando tarea…</template>
      <!-- La clave reinicia el formulario cuando llega una versión nueva tras un conflicto. -->
      <TareaFormulario
        :key="carga.datos.value?.version"
        :inicial="carga.datos.value"
        texto-enviar="Guardar cambios"
        :enviando="guardado.enviando.value"
        :deshabilitado="!enLinea || conflicto"
        :errores-servidor="erroresServidor"
        @enviar="guardar"
        @cancelar="irADetalle(id)"
      />
    </EstadoPeticion>
  </div>
</template>
