const VERSION='confetti-blocks-v1';
const ROOT=new URL('./',self.location.href);
const CORE=['./','index.html','style.css','app.js','engine.js','effects.js','favicon.svg','manifest.webmanifest','icon-192.png','icon-512.png','icon-maskable.png'].map(path=>new URL(path,ROOT).href);
self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(VERSION);
    try{await cache.addAll(CORE.map(url=>new Request(url,{cache:'reload'})));}catch(error){await caches.delete(VERSION);throw error;}
  })());
});
self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    for(const key of await caches.keys())if(key.startsWith('confetti-blocks-')&&key!==VERSION)await caches.delete(key);
    await self.clients.claim();
  })());
});
self.addEventListener('message',event=>{if(event.data?.type==='ACTIVATE_UPDATE')self.skipWaiting();});
self.addEventListener('fetch',event=>{
  const request=event.request,url=new URL(request.url);
  if(request.method!=='GET'||url.origin!==ROOT.origin||!url.pathname.startsWith(ROOT.pathname))return;
  event.respondWith((async()=>{
    const cache=await caches.open(VERSION);
    if(request.mode==='navigate'){
      // Serve this worker's HTML and modules together so an update cannot mix versions.
      const cached=await cache.match(new URL('index.html',ROOT).href);
      return cached || fetch(request);
    }
    const cached=await cache.match(request,{ignoreSearch:true});
    return cached || fetch(request);
  })());
});
