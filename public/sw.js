// Service worker — app-shell cache for offline / fast loads.
//
// SHELL_CACHE: bump this constant on every JS/CSS/HTML change so clients drop
// the stale bundle. See CLAUDE.md → Harte Regeln: "SHELL_CACHE bumpen".
const SHELL_CACHE = 'shell-v1';

const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/css/tokens.css',
  '/css/layout/base.css',
  '/css/components/card.css',
  '/css/entities/note.css',
  '/js/app.js',
  '/js/utils.js',
  '/js/i18n.js',
  '/js/app/app-state.js',
  '/js/app/features.js',
  '/js/cards/note-card.js',
  '/partials/notes-view.html',
  '/manifest.webmanifest',
  '/icon.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((c) => c.addAll(SHELL_ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== SHELL_CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  // Never cache API calls — always go to network.
  if (new URL(request.url).pathname.startsWith('/api/')) return;
  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request))
  );
});
