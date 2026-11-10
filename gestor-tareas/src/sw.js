/**
 * Service worker (Workbox, estrategia injectManifest).
 *
 * Política offline limitada y segura:
 *  1. App shell (HTML, JS, CSS, iconos) precacheado y versionado: la app abre sin red.
 *  2. Solo se cachean lecturas GET de tareas (listado y detalle), con red primero:
 *     siempre se prefiere el dato fresco y la copia solo se usa si falla la red.
 *  3. Solo respuestas 200 del mismo origen; máximo 30 entradas y 24 horas.
 *  4. Nunca se cachean escrituras (POST/PUT/PATCH/DELETE) ni adjuntos descargados
 *     (pueden ser documentos sensibles). Tampoco se encolan escrituras offline:
 *     la UI las deshabilita sin conexión para evitar conflictos silenciosos.
 *  5. Las respuestas servidas desde caché se marcan con X-Desde-Cache: 1 para avisar al usuario.
 */
import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching'
import { registerRoute, NavigationRoute } from 'workbox-routing'
import { NetworkFirst } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'
import { CacheableResponsePlugin } from 'workbox-cacheable-response'
import { clientsClaim } from 'workbox-core'

const CACHE_API = 'api-tareas-lecturas-v1'

cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)
clientsClaim()

// Navegaciones del SPA (p. ej. /tareas/abc/editar) -> index.html precacheado. Nunca /api.
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html'), { denylist: [/^\/api\//] }))

const LECTURA_TAREAS = /^\/api\/tareas(?:\/[a-f0-9]{24})?$/i

const marcarDesdeCache = {
  cachedResponseWillBeUsed: async ({ cachedResponse }) => {
    if (!cachedResponse) return cachedResponse
    const cabeceras = new Headers(cachedResponse.headers)
    cabeceras.set('X-Desde-Cache', '1')
    return new Response(await cachedResponse.blob(), {
      status: cachedResponse.status,
      statusText: cachedResponse.statusText,
      headers: cabeceras
    })
  }
}

registerRoute(
  ({ url, request, sameOrigin }) => sameOrigin && request.method === 'GET' && LECTURA_TAREAS.test(url.pathname),
  new NetworkFirst({
    cacheName: CACHE_API,
    networkTimeoutSeconds: 5,
    plugins: [
      new CacheableResponsePlugin({ statuses: [200] }),
      new ExpirationPlugin({ maxEntries: 30, maxAgeSeconds: 24 * 60 * 60, purgeOnQuotaError: true }),
      marcarDesdeCache
    ]
  })
)

// La activación de una versión nueva la decide el usuario (AvisosGlobales.vue).
self.addEventListener('message', (evento) => {
  if (evento.data?.type === 'SKIP_WAITING') self.skipWaiting()
})
