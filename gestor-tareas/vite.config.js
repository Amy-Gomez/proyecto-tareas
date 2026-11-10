import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

// La API no habilita CORS: en desarrollo y en preview se usa un proxy para que
// el SPA y la API compartan origen (/api -> http://localhost:3000).
const API = process.env.VITE_API_PROXY || 'http://localhost:3000'
const proxy = { '/api': { target: API, changeOrigin: true } }

export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      strategies: 'injectManifest', // service worker propio: control total de qué se cachea
      srcDir: 'src',
      filename: 'sw.js',
      registerType: 'prompt', // el usuario decide cuándo activar una versión nueva
      injectRegister: false, // se registra desde AvisosGlobales.vue
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico}']
      },
      includeManifestIcons: false,
      devOptions: { enabled: false },
      manifest: {
        name: 'Gestor de tareas',
        short_name: 'Tareas',
        description: 'Gestiona tus tareas, prioridades y adjuntos',
        lang: 'es',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'any',
        background_color: '#f7f4fc',
        theme_color: '#9575cd',
        icons: [{ src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' }]
      }
    })
  ],
  server: { port: 5173, proxy },
  preview: { port: 4173, proxy },
  test: { environment: 'jsdom' }
})
