// Старт — service worker (офлайн-режим)
// Змінюйте VERSION при кожному оновленні файлів, щоб старий кеш очищався.
const VERSION = 'fitstart-v1';

const CORE_FILES = [
  './',
  'index.html',
  'manifest.json',
  'icon-192.png',
  'icon-512.png',
  'icon-maskable-512.png',
  'apple-touch-icon.png'
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    await cache.addAll(CORE_FILES);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== VERSION && k.startsWith('fitstart-')).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Сторінка: спочатку мережа, але не довше 3 с (слабкий зв'язок), далі кеш
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      const cached = async () => (await caches.match('index.html')) || (await caches.match('./'));
      try {
        const res = await Promise.race([
          fetch(req),
          new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 3000))
        ]);
        if (res && res.ok) {
          const cache = await caches.open(VERSION);
          cache.put('index.html', res.clone());
        }
        return res;
      } catch (e) {
        return (await cached()) || Response.error();
      }
    })());
    return;
  }

  // Інші свої файли: з кешу, а в фоні оновлюємо
  event.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const hit = await cache.match(req);
    const network = fetch(req).then(res => {
      if (res && res.ok) cache.put(req, res.clone());
      return res;
    }).catch(() => null);
    return hit || (await network) || Response.error();
  })());
});
