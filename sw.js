const CACHE='huanbao-fitness-v1.1.0';
const FILES=['./','./index.html','./style.css','./app.js','./core.js','./sync.js','./data.js','./manifest.webmanifest','./assets/icon.svg','./assets/icon-192.png','./assets/icon-512.png','./assets/hero.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('huanbao-fitness-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==self.location.origin||!u.href.startsWith(self.registration.scope))return;e.respondWith(caches.open(CACHE).then(async cache=>{const saved=await cache.match(e.request);if(saved)return saved;try{return await fetch(e.request);}catch(err){if(e.request.mode==='navigate')return cache.match('./index.html');throw err;}}));});
