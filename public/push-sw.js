// Ajouté au service worker généré par vite-plugin-pwa (option workbox.importScripts) :
// affichage des notifications envoyées par le Worker, et ouverture de l'application au toucher.

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data && event.data.text() };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'Mon Hémicycle', {
      body: data.body || 'Nouveau scrutin à l’Assemblée nationale',
      icon: 'icon-192.png',
      badge: 'icon-192.png',
      tag: data.tag || 'scrutins',
      renotify: true,
      data: { url: data.url || self.registration.scope },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data && event.notification.data.url;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((fenetres) => {
      for (const f of fenetres) {
        if ('focus' in f) {
          f.navigate(url);
          return f.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
