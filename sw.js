self.addEventListener('push', event => {
  let data = {};
  try { data = event.data.json(); } catch(e) { data = { title: 'Alert', body: 'Price alert' }; }
  const title = data.title || 'Alert';
  const options = { body: data.body || '', icon: '/icon.png' };
  event.waitUntil(self.registration.showNotification(title, options));
});
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(clients.openWindow('/'));
});
