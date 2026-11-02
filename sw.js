// Lettore offline support: keeps a copy of the app on the device so it opens without a connection,
// and quietly fetches new versions when online.
const CACHE = 'lettore-v3';
const ASSETS = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];

self.addEventListener('install', e => {
  // cache: 'reload' makes sure the saved copy is the newest one, not an older browser-cached file
  e.waitUntil(caches.open(CACHE)
    .then(c => c.addAll(ASSETS.map(u => new Request(u, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  if (url.pathname.endsWith('/version.txt')) return; // always ask GitHub directly
  if (e.request.mode === 'navigate') {
    const net = fetch(url.href, { cache: 'no-cache', credentials: 'same-origin' }).then(r => {
      if (!r.ok) return r;
      const copy = r.clone();
      return caches.open(CACHE).then(c => c.put('./index.html', copy)).then(() => r);
    });
    e.waitUntil(net.then(() => {}, () => {}));       // finish saving the new version even if we answer from the saved copy
    e.respondWith(caches.match('./index.html').then(saved => {
      if (!saved) return net;
      return Promise.race([net.catch(() => saved), new Promise(res => setTimeout(() => res(saved), 8000))]);
    }));
    return;
  }
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});
