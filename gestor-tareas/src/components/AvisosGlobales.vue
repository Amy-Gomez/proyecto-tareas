<script setup>
/** Avisos de toda la app: sin conexión, versión nueva de la PWA y notificaciones. */
import { useRegisterSW } from 'virtual:pwa-register/vue'
import { avisos, cerrarAviso, enLinea } from '../composables/estadoGlobal'

const { needRefresh: hayVersionNueva, updateServiceWorker } = useRegisterSW({ immediate: true })
</script>

<template>
  <div v-if="!enLinea" class="banner-offline" role="status">
    Sin conexión: puedes consultar las tareas vistas recientemente. Crear, editar, eliminar y subir archivos estará disponible al reconectar.
  </div>

  <div v-if="hayVersionNueva" class="aviso-pwa" role="status">
    <span>Hay una nueva versión de la aplicación.</span>
    <button type="button" class="boton boton--primario boton--pequeno" @click="updateServiceWorker(true)">Actualizar</button>
    <button type="button" class="boton boton--pequeno" @click="hayVersionNueva = false">Más tarde</button>
  </div>

  <div class="notificaciones" aria-live="polite">
    <TransitionGroup name="deslizar">
      <div v-for="a in avisos" :key="a.id" class="notificacion" :class="`notificacion--${a.tipo}`">
        <span>{{ a.mensaje }}</span>
        <button type="button" class="notificacion__cerrar" aria-label="Cerrar aviso" @click="cerrarAviso(a.id)">×</button>
      </div>
    </TransitionGroup>
  </div>
</template>
