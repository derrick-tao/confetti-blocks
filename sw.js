// Build substitutes the release digest and verified manifest. Serve dist/, not this template.
const RELEASE='__RELEASE_ID__';
const ENTRIES=/*__PRECACHE__*/[];
const ROOT=new URL('./',self.location.href);
const PREFIX=`confetti-blocks-${encodeURIComponent(ROOT.pathname)}-`;
const VERSION=PREFIX+RELEASE;
const META=new URL('__cache_manifest__',ROOT).href;
const signature=JSON.stringify(ENTRIES);
const digest=async bytes=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');
async function complete(cache){const marker=await cache.match(META);if(!marker||await marker.text()!==signature)return false;for(const entry of ENTRIES)if(!await cache.match(new URL(entry.url,ROOT).href))return false;return true;}
self.addEventListener('install',event=>event.waitUntil((async()=>{
 if(!ENTRIES.length)throw new Error('Build the production app before serving it.');
 const existed=(await caches.keys()).includes(VERSION),cache=await caches.open(VERSION);
 // Existing snapshots are immutable, including a malformed deployment reusing a release ID.
 if(existed){if(await complete(cache))return;if(await cache.match(META))throw new Error('Existing committed release differs; preserving it.');/* Interrupted uncommitted install: safely refill this candidate. */}
 try{for(const entry of ENTRIES){const url=new URL(entry.url,ROOT).href,response=await fetch(new Request(url,{cache:'reload'}));if(!response.ok||await digest(await response.clone().arrayBuffer())!==entry.sha256)throw new Error(`Incomplete release: ${entry.url}`);await cache.put(url,response);}await cache.put(META,new Response(signature));}
 catch(error){await caches.delete(VERSION);throw error;}
})()));
async function cleanup(){
 // Other open tabs may still refer to old content-addressed assets. Keep their snapshots.
 const appClients=(await self.clients.matchAll({type:'window',includeUncontrolled:true})).filter(client=>new URL(client.url).pathname.startsWith(ROOT.pathname));
 if(appClients.length>1)return;
 for(const key of await caches.keys())if((key.startsWith(PREFIX)||key==='confetti-blocks-v1')&&key!==VERSION)await caches.delete(key);
}
self.addEventListener('activate',event=>event.waitUntil((async()=>{if(!await complete(await caches.open(VERSION)))throw new Error('Cannot activate an incomplete release.');await cleanup();await self.clients.claim();})()));
self.addEventListener('message',event=>{
 if(event.data?.type==='ACTIVATE_UPDATE')event.waitUntil(self.skipWaiting());
 if(event.data?.type==='CACHE_STATUS')event.waitUntil((async()=>event.ports[0]?.postMessage({ready:await complete(await caches.open(VERSION)),release:RELEASE}))());
 if(event.data?.type==='CLEANUP')event.waitUntil(cleanup());
});
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);if(request.method!=='GET'||url.origin!==ROOT.origin||!url.pathname.startsWith(ROOT.pathname))return;
 event.respondWith((async()=>{
  const cache=await caches.open(VERSION);
  if(request.mode==='navigate'){const file=url.pathname===new URL('privacy.html',ROOT).pathname?'privacy.html':'index.html';return await cache.match(new URL(file,ROOT).href)||fetch(request);}
  const current=await cache.match(request,{ignoreSearch:true});if(current)return current;
  // Retained snapshots serve old tabs' immutable code/style only.
  if(/\.[a-f0-9]{16}\.(?:js|css)$/.test(url.pathname))for(const name of await caches.keys())if(name.startsWith(PREFIX)){const old=await(await caches.open(name)).match(request,{ignoreSearch:true});if(old)return old;}
  if(['app.js','engine.js','effects.js','style.css'].some(file=>url.pathname===new URL(file,ROOT).pathname)&&(await caches.keys()).includes('confetti-blocks-v1')){const legacy=await(await caches.open('confetti-blocks-v1')).match(request,{ignoreSearch:true});if(legacy)return legacy;}
  return fetch(request);
 })());
});
