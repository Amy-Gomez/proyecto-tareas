import { createRouter, createWebHistory } from 'vue-router'

const formulario = () => import('./views/FormularioTareaView.vue')

const router = createRouter({
  history: createWebHistory(),
  scrollBehavior: (to, from, guardada) => guardada ?? { top: 0 },
  routes: [
    { path: '/', name: 'tareas', component: () => import('./views/ListaTareasView.vue'), meta: { titulo: 'Tareas' } },
    { path: '/tareas/nueva', name: 'tarea-nueva', component: formulario, meta: { titulo: 'Nueva tarea' } },
    { path: '/tareas/:id([a-f0-9]{24})', name: 'tarea-detalle', component: () => import('./views/DetalleTareaView.vue'), props: true, meta: { titulo: 'Detalle' } },
    { path: '/tareas/:id([a-f0-9]{24})/editar', name: 'tarea-editar', component: formulario, props: true, meta: { titulo: 'Editar tarea' } },
    // Cualquier otra ruta, incluido un id con formato inválido, termina aquí sin llamar a la API.
    { path: '/:ruta(.*)*', name: 'no-encontrada', component: () => import('./views/NoEncontradaView.vue'), meta: { titulo: 'No encontrada' } }
  ]
})

router.afterEach((to) => {
  document.title = `${to.meta.titulo} · Gestor de tareas`
})

export default router
