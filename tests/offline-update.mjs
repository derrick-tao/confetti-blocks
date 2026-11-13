import {createServer} from 'node:http';
import {readFile,writeFile,rm,mkdtemp,readdir,copyFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {build} from '../build.js';
import {launchBrowser,mime} from './helpers.mjs';
import assert from 'node:assert/strict';
const root=await mkdtemp(join(tmpdir(),'confetti-offline-')),source=new URL('../',import.meta.url),releases=[];
for(const entry of await readdir(source,{withFileTypes:true}))if(entry.isFile())await copyFile(new URL(entry.name,source),join(root,entry.name));
for(let version=0;version<3;version++){if(version)await writeFile(join(root,'privacy.html'),(await readFile(join(root,'privacy.html'),'utf8'))+`\n<!-- release ${version} -->`);releases.push(await build({root,out:join(root,`release-${version}`)}));}
let release=0,mode='normal',block=false;
const server=createServer(async(req,res)=>{
 try{
  const pathname=new URL(req.url,'http://localhost').pathname;if(!pathname.startsWith('/confetti-blocks/')){res.writeHead(404).end();return;}
  let file=decodeURIComponent(pathname.slice('/confetti-blocks/'.length))||'index.html';
  if(file==='seed.html'){res.writeHead(200,{'Content-Type':'text/html'}).end('<title>Seed fixture</title>');return;}
  const path=resolve(releases[release].out,file);if(!path.startsWith(releases[release].out+sep)){res.writeHead(404).end();return;}
  if(block&&file==='icon-512.png'){res.writeHead(503).end();return;}
  let bytes=await readFile(path);
  if(file==='sw.js'&&mode==='same-id')bytes=Buffer.from(bytes+'\n// changed worker, deliberately reused release ID');
  if(file==='sw.js'&&mode==='mismatch')bytes=Buffer.from(bytes.toString().replace(/"sha256":"[a-f0-9]+"/,`"sha256":"${'0'.repeat(64)}"`));
  res.writeHead(200,{'Content-Type':mime[file.split('.').at(-1)]||'application/octet-stream','Cache-Control':'no-store'});res.end(bytes);
 }catch{res.writeHead(404).end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}/confetti-blocks/`;
const browser=await launchBrowser();
const cacheName=version=>`confetti-blocks-${encodeURIComponent('/confetti-blocks/')}-${releases[version].release}`;
const update=page=>page.evaluate(async()=>await(await navigator.serviceWorker.getRegistration()).update());
const idle=page=>page.waitForFunction(async()=>!(await navigator.serviceWorker.getRegistration()).installing);
const ready=page=>page.waitForFunction(()=>document.querySelector('#connection-text').textContent.includes('ready to play offline'));
try{
 const ctx=await browser.newContext(),page=await ctx.newPage();await ctx.addInitScript(()=>Math.random=()=>0);
 await page.goto(base);await ready(page);await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
 await page.locator('#play').click();await page.locator('.piece-slot').first().click();await page.locator('.cell').first().click();
 await page.evaluate(async()=>{const cache=await caches.open('unrelated-keep');await cache.put('/keep',new Response('keep'));});
 const before=await page.evaluate(async name=>(await(await caches.open(name)).match(new URL('index.html',location.href))).text(),cacheName(0));
 mode='mismatch';block=true;await update(page);await idle(page);
 assert.equal(await page.evaluate(async name=>(await(await caches.open(name)).match(new URL('index.html',location.href))).text(),cacheName(0)),before);
 mode='same-id';await update(page);await page.locator('#update').waitFor();
 assert.equal(await page.evaluate(async name=>(await(await caches.open(name)).match(new URL('index.html',location.href))).text(),cacheName(0)),before);
 await ctx.setOffline(true);await page.reload();await page.locator('#play').waitFor();await ctx.setOffline(false);
 mode='normal';block=false;release=1;await update(page);await page.locator('#update').waitFor();
 await page.locator('#play').click();await page.locator('.piece-slot').first().click();await page.locator('.cell').first().click();
 const other=await ctx.newPage();await other.goto(base);await other.locator('#play').waitFor();await page.evaluate(async()=>{const legacy=await caches.open('confetti-blocks-v1');await legacy.put(new URL('app.js',location.href),new Response('// legacy core',{headers:{'Content-Type':'text/javascript'}}));});
 page.once('dialog',dialog=>dialog.dismiss());await page.locator('#update').click();assert.equal(await page.locator('#moves').innerText(),'1');
 page.once('dialog',dialog=>dialog.accept());await Promise.all([page.waitForEvent('load'),page.locator('#update').click()]);await ready(page);
 assert.equal(await page.locator('#moves').innerText(),'0');assert.equal(await page.locator('#best').innerText(),'10');
 assert.ok((await page.evaluate(()=>caches.keys())).includes(cacheName(0)),'old tab snapshot retained');
 const oldAsset=releases[0].names['app.js'];assert.equal(await other.evaluate(async file=>(await fetch(file)).status,oldAsset),200);assert.equal(await other.evaluate(async()=>(await fetch('./app.js')).text()),'// legacy core');
 await other.close();await page.evaluate(()=>navigator.serviceWorker.controller.postMessage({type:'CLEANUP'}));await page.waitForFunction(async old=>!(await caches.keys()).includes(old),cacheName(0));assert.ok((await page.evaluate(()=>caches.keys())).includes('unrelated-keep'));
 release=2;block=true;await update(page);await idle(page);await page.waitForFunction(async name=>!(await caches.keys()).includes(name),cacheName(2));
 await ctx.setOffline(true);await page.reload();await page.locator('#play').click();await page.locator('.piece-slot').first().click();await page.locator('.cell').first().click();assert.equal(await page.locator('#moves').innerText(),'1');await ctx.close();
 // A first-install failure is visible and can be retried without clearing site data.
 const fresh=await browser.newContext(),first=await fresh.newPage();await first.goto(base);await first.waitForFunction(()=>document.querySelector('#connection-text').textContent.includes('incomplete'));await first.locator('#offline-info').click();await first.locator('#offline-retry').waitFor({state:'visible'});assert.ok(!(await first.locator('#connection-text').innerText()).includes('ready to play offline'));
 block=false;await first.locator('#offline-retry').click();await ready(first);await fresh.setOffline(true);await first.reload();await first.locator('#play').waitFor();await fresh.close();
 // An interrupted install's uncommitted candidate is recoverable.
 const interrupted=await browser.newContext(),seed=await interrupted.newPage();await seed.goto(base+'seed.html');await seed.evaluate(async name=>{const c=await caches.open(name);await c.put('partial',new Response('partial'));},cacheName(2));await seed.goto(base);await ready(seed);await interrupted.close();
 console.log('Passed offline regressions: immutable same-ID cache, integrity mismatch, failed candidate, first-download retry, interrupted download recovery, update consent, old-tab retention, unrelated cache preservation, offline play.');
}finally{await browser.close();await new Promise(r=>server.close(r));await rm(root,{recursive:true,force:true});}
