/* GitHub Orbit Next — service worker (PWA v2.0)
   · Shell offline con red primero: tras cada despliegue la app se refresca sola.
   · /_next/static/* (assets con hash) → caché primero, inmutables.
   · La API de GitHub y todo lo cross-origin NUNCA se intercepta. */
const CACHE = 'orbit-next-v2.0';

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.add('/')).then(() => self.skipWaiting()).catch(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  if (url.pathname.startsWith('/_next/static/')) {
    e.respondWith(
      caches.match(req).then(h => h || fetch(req).then(r => {
        const cp = r.clone(); caches.open(CACHE).then(c => c.put(req, cp)); return r;
      }))
    );
    return;
  }

  if (req.mode === 'navigate' || url.pathname === '/' || url.pathname.endsWith('index.html')) {
    e.respondWith(
      fetch(req)
        .then(r => { const cp = r.clone(); caches.open(CACHE).then(c => c.put(url.pathname, cp)); return r; })
        .catch(() => caches.match(url.pathname).then(h => h || caches.match('/').then(i => i || Response.error())))
    );
    return;
  }

  e.respondWith(
    caches.match(req).then(h => h || fetch(req).then(r => {
      if (r.ok) { const cp = r.clone(); caches.open(CACHE).then(c => c.put(req, cp)); }
      return r;
    }).catch(() => Response.error()))
  );
});
