importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyDQQPYaTGUPzGfnquMB3ACEoqbuj9YYiVI",
  authDomain: "myspace-da215.firebaseapp.com",
  projectId: "myspace-da215",
  storageBucket: "myspace-da215.firebasestorage.app",
  messagingSenderId: "731292009937",
  appId: "1:731292009937:web:28f946243bab7778daccf0"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  
  const notificationTitle = payload.notification?.title || 'SmartShare';
  const notificationOptions = {
    body: payload.notification?.body || 'הודעה חדשה מחכה לך!',
    icon: '/icon512_maskable.png',
    data: payload.data
  };

  // Prevent duplicate if Firebase already shows it (when payload.notification exists)
  if (!payload.notification) {
    self.registration.showNotification(notificationTitle, notificationOptions);
  }
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const urlToOpen = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url.includes(urlToOpen) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
