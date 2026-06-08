/* The Cheer DJ — service worker
   Network-first so new deploys show up right away.
   Falls back to cache when offline. Audio always streams from network. */
const CACHE = 'cheerdj-v2';
const SHELL = [
  './','./index.html','./manifest.json',
  './cheerdj-logo.png','./dc-logo.png',
  './icon-192.png','./icon-512.png','./apple-touch-icon.png','./favicon-64.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  // let audio/media stream straight from the network
  if (req.destination === 'audio' || req.url.match(/\.(mp3|m4a|wav|ogg|aac)$/i)) return;
  // network-first: always try the live version, cache it, fall back to cache offline
  e.respondWith(
    fetch(req).then(res => {
      if (res.ok && new URL(req.url).origin === location.origin) {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
      }
      return res;
    }).catch(() => caches.match(req).then(hit => hit || caches.match('./index.html')))
  );
});
