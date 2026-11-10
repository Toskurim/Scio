/* AI.st.ain — service worker: apre l'app anche senza rete. Mai le chiamate AI. */
const V = 'scio-0.42';
const FILE = ['./', 'index.html', 'style.css', 'app.js', 'i18n.js', 'manifest.webmanifest', 'icons/favicon.svg', 'icons/icon-192.png', 'icons/icon-512.png',
  'fonts/lexend-latin-400-normal.woff2', 'fonts/lexend-latin-500-normal.woff2', 'fonts/lexend-latin-600-normal.woff2', 'fonts/lexend-latin-700-normal.woff2',
  'fonts/lexend-latin-ext-400-normal.woff2', 'fonts/lexend-latin-ext-500-normal.woff2', 'fonts/lexend-latin-ext-600-normal.woff2', 'fonts/lexend-latin-ext-700-normal.woff2',
  'fonts/andika-latin-400-normal.woff2', 'fonts/andika-latin-700-normal.woff2', 'fonts/andika-latin-ext-400-normal.woff2', 'fonts/andika-latin-ext-700-normal.woff2',
  'fonts/atkinson-hyperlegible-latin-400-normal.woff2', 'fonts/atkinson-hyperlegible-latin-700-normal.woff2', 'fonts/atkinson-hyperlegible-latin-ext-400-normal.woff2', 'fonts/atkinson-hyperlegible-latin-ext-700-normal.woff2'];
self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => c.addAll(FILE.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== V && x !== 'scio-voce').map(x => caches.delete(x)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin) return;
  if (u.pathname.endsWith('/prezzi.json')) { e.respondWith(fetch(r, { cache: 'no-store' }).catch(() => caches.match(r, { ignoreSearch: true }))); return; } /* prezzi: sempre dalla rete se possibile */
  if (u.pathname.indexOf('/voce/') >= 0) { e.respondWith(caches.open('scio-voce').then(c => c.match(u.origin + u.pathname)).then(hit => hit || fetch(r))); return; } /* voce naturale: scaricata a parte, mai nella cache dell'app */
  e.respondWith(caches.match(r, { ignoreSearch: true }).then(hit => hit || fetch(r).then(res => { if (res.ok) { const c = res.clone(); caches.open(V).then(x => x.put(r, c)); } return res; }).catch(() => caches.match('index.html'))));
});
