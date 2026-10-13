const CACHE = 'transitx-checkin-v1.0.0';
const FILES = ['./','./index.html','./styles.css','./icon.svg','./manifest.webmanifest','./icons/icon-192.png','./icons/icon-512.png','./js/app.mjs','./js/form.mjs','./js/core.mjs','./js/storage.mjs','./js/board.mjs','./js/questions.mjs','./js/card.mjs','./js/locales/en.mjs','./js/locales/second.mjs'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('transitx-checkin-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET') return;
  event.respondWith((async()=>{
    if(new URL(event.request.url).origin!==self.location.origin) return new Response('External requests are disabled.',{status:403});
    const cache=await caches.open(CACHE);
    const request=event.request.mode==='navigate'?new URL('./index.html',self.location.href).href:event.request;
    return await cache.match(request)||new Response('Asset is not in the offline cache.',{status:404});
  })());
});
