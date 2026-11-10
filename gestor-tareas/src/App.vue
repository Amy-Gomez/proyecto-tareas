<script setup>
import AvisosGlobales from './components/AvisosGlobales.vue'
</script>

<template>
  <header class="cabecera">
    <div class="contenedor cabecera__fila">
      <RouterLink to="/" class="marca">
        <img src="/icons/icon-512.png" alt="" width="30" height="30" />
        <span>Gestor de tareas</span>
      </RouterLink>
      <nav aria-label="Principal" class="navegacion">
        <RouterLink :to="{ name: 'tareas' }" class="navegacion__enlace">Tareas</RouterLink>
        <RouterLink :to="{ name: 'tarea-nueva' }" class="boton boton--acento boton--pequeno">+ Nueva tarea</RouterLink>
      </nav>
    </div>
  </header>

  <AvisosGlobales />

  <main class="contenedor principal">
    <!-- La clave recrea la vista al cambiar de tarea o de modo (nueva/editar comparten componente). -->
    <RouterView :key="`${$route.name}-${$route.params.id ?? ''}`" />
  </main>
</template>
