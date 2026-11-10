<script setup>
/** Muestra los estados de una lectura: carga, error, vacío y éxito (slot por defecto). */
defineProps({
  estado: { type: String, required: true },
  error: { type: Object, default: null },
  hayDatos: { type: Boolean, default: false } // con datos previos, se siguen mostrando mientras recarga
})
defineEmits(['reintentar'])
</script>

<template>
  <div v-if="estado === 'cargando' && !hayDatos" class="estado" role="status">
    <span class="giro" aria-hidden="true"></span>
    <slot name="carga">Cargando…</slot>
  </div>

  <div v-else-if="estado === 'error'" class="estado estado--error" role="alert">
    <strong>No se pudo completar la operación</strong>
    <p>{{ error?.message }}</p>
    <slot name="error-acciones">
      <button type="button" class="boton" @click="$emit('reintentar')">Reintentar</button>
    </slot>
  </div>

  <div v-else-if="estado === 'vacio'" class="estado">
    <slot name="vacio"><p>No hay elementos para mostrar.</p></slot>
  </div>

  <div v-else-if="hayDatos" :class="{ recargando: estado === 'cargando' }">
    <slot />
  </div>
</template>
