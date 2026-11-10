<template>
  <div class="estado">
    <h1>Página no encontrada</h1>
    <p>La dirección no existe o la tarea no es válida.</p>
    <RouterLink :to="{ name: 'tareas' }" class="boton boton--primario">Ir a mis tareas</RouterLink>
  </div>
</template>
