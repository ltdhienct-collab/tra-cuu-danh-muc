const CACHE='tra-cuu-danh-muc-v1';
const ASSETS=['./','./index.html','./popup.js','./tab-handler.js','./styles.css','./chrome-compat.js','./manifest.webmanifest','./icon128.png','./lib/xlsx.full.min.js'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS))));
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
self.addEventListener('fetch',e=>{ if(e.request.method!=='GET') return; e.respondWith(caches.match(e.request).then(c=>c||fetch(e.request).then(r=>{const copy=r.clone(); caches.open(CACHE).then(x=>x.put(e.request,copy)); return r;}))); });
