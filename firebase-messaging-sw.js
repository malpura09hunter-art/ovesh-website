/* OVESH CLOUD™ Firebase Cloud Messaging service worker */
importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyDB8ZVagSc8C3o3tdrwUcuflZhT8X5lMZ0',
  authDomain: 'ovesh-malpura-cyber-lab.firebaseapp.com',
  projectId: 'ovesh-malpura-cyber-lab',
  storageBucket: 'ovesh-malpura-cyber-lab.firebasestorage.app',
  messagingSenderId: '744299528984',
  appId: '1:744299528984:web:08bce9e624a382856cd46d'
});

const messaging=firebase.messaging();
messaging.onBackgroundMessage(payload=>{
  const n=payload.notification||{};
  self.registration.showNotification(n.title||'OVESH CLOUD™ Security Alert',{body:n.body||'New login detected.',icon:'/ovesh-malpura-profile.jpg.PNG',badge:'/ovesh-malpura-profile.jpg.PNG',data:payload.data||{}});
});
self.addEventListener('notificationclick',event=>{event.notification.close();event.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>{for(const client of list){if('focus'in client)return client.focus();}return clients.openWindow('https://malpuraovesh.vercel.app/ovesh');}));});
