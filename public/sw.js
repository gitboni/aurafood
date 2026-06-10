// AuraFood Service Worker
//
// CAMBIO IMPORTANTE: ya no cacheamos HTML. Cachear HTML del shell
// (/ y /pos) provocaba que tras un deploy de Vercel el browser
// sirviera un HTML viejo que apuntaba a chunks CSS con hashes que
// ya no existían → página sin estilos hasta limpiar el SW a mano.
//
// Nueva estrategia:
//   • Navegaciones (HTML)       → solo network, sin fallback de cache
//   • Estáticos versionados     → cache-first (los hashes los hacen
//                                  inmutables, así que es seguro)
//   • Manifest e íconos         → cache-first (raramente cambian)
//   • API / Supabase            → ignorar
//
// Si necesitas modo offline en el futuro, mejor agregar una página
// /offline.html dedicada (estática) en vez de cachear /.
const CACHE_NAME = "aurafood-v3";
const STATIC_SHELL = ["/manifest.json", "/icon-192.svg", "/icon-512.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_SHELL).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  // Solo manejamos requests de nuestro propio origen
  if (url.origin !== self.location.origin) return;
  // No nos metemos con las rutas de API
  if (url.pathname.startsWith("/api/")) return;

  // ── Navegaciones (HTML) ──
  // SIEMPRE red. Si no hay red, dejamos que falle naturalmente
  // (mejor que mostrar HTML obsoleto que rompe los estilos).
  if (req.mode === "navigate") {
    event.respondWith(fetch(req));
    return;
  }

  // ── Assets estáticos (immutable, hashed) ──
  // Los chunks de Next.js viven en /_next/static/... con hash en el
  // nombre. Son inmutables, perfectos para cache-first.
  const isStaticAsset =
    url.pathname.startsWith("/_next/static/") ||
    /\.(?:js|css|woff2?|png|jpg|jpeg|svg|ico|webp|avif)$/.test(url.pathname);

  if (isStaticAsset) {
    event.respondWith(
      caches.match(req).then(
        (cached) =>
          cached ||
          fetch(req).then((res) => {
            // Solo cacheamos respuestas OK (no 404/500)
            if (res.ok) {
              const copy = res.clone();
              caches.open(CACHE_NAME).then((c) => c.put(req, copy));
            }
            return res;
          })
      )
    );
  }
});
