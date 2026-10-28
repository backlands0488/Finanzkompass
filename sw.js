/* Finanzkompass – Service Worker: App-Dateien offline verfügbar halten.
 * Daten werden hier nicht berührt; sie liegen im Browser-Speicher bzw. in der verbundenen Datei. */
var CACHE = 'finanzkompass-1.3.0';
var DATEIEN = ['./', 'index.html', 'styles.css', 'app.js', 'steuer.js', 'xlsx.js', 'manifest.webmanifest', 'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(DATEIEN); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
// Netz zuerst (damit Updates ankommen), bei fehlender Verbindung aus dem Cache
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    // Immer beim Server nachfragen (HTTP-Cache umgehen), damit Updates sofort ankommen
    fetch(e.request.url, { cache: 'no-cache', credentials: 'same-origin' }).then(function (res) {
      var kopie = res.clone();
      caches.open(CACHE).then(function (c) { c.put(e.request, kopie); });
      return res;
    }).catch(function () {
      return caches.match(e.request, { ignoreSearch: true }).then(function (r) { return r || caches.match('index.html'); });
    })
  );
});
