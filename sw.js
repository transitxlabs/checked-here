const CACHE = 'transitx-checkin-v3';
const FILES = ['./','./index.html','./styles.css','./icon.svg','./js/app.mjs','./js/core.mjs','./js/storage.mjs','./js/locales/en.mjs','./js/locales/second.mjs'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('transitx-checkin-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin) return;
  event.respondWith(caches.open(CACHE).then(async cache=>{
    const request=event.request.mode==='navigate'?new URL('./index.html',self.location.href).href:event.request;
    const cached=await cache.match(request);return cached||fetch(event.request);
  }));
});
