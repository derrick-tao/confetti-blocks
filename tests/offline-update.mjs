import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
let release=1;
const mime={html:'text/html',js:'text/javascript',css:'text/css',png:'image/png',svg:'image/svg+xml',webmanifest:'application/manifest+json'};
const server=createServer(async(req,res)=>{
  try{
    let path=new URL(req.url,'http://localhost').pathname.replace(/^\/confetti-blocks\//,'');
    if(!path||path.endsWith('/'))path='index.html';
    if(path.includes('..')||path.startsWith('/')){res.writeHead(404).end();return;}
    if(release===3&&path==='icon-512.png'){res.writeHead(503).end();return;}
    let data=await readFile(new URL(`../${path}`,import.meta.url));
    if(path==='sw.js')data=Buffer.from(data.toString().replace('confetti-blocks-v1',`confetti-blocks-v${release}`));
    res.writeHead(200,{'Content-Type':mime[path.split('.').at(-1)]||'text/plain','Cache-Control':'no-store'});res.end(data);
  }catch{res.writeHead(404).end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}/confetti-blocks/`;
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
try{
  const context=await browser.newContext(),page=await context.newPage();await page.addInitScript(()=>Math.random=()=>0);
  await page.goto(base);await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
  await page.locator('#play').click();await page.locator('.piece-slot').first().click();await page.locator('.cell').first().click();
  release=2;
  await page.evaluate(async()=>await (await navigator.serviceWorker.getRegistration()).update());
  await page.locator('#update').waitFor();assert.equal(await page.locator('#moves').innerText(),'1');
  assert.ok(await page.evaluate(async()=>(await caches.keys()).includes('confetti-blocks-v1')));
  page.once('dialog',dialog=>dialog.dismiss());await page.locator('#update').click();assert.equal(await page.locator('#moves').innerText(),'1');
  page.once('dialog',dialog=>dialog.accept());
  await Promise.all([page.waitForEvent('load'),page.locator('#update').click()]);
  await page.waitForFunction(async()=>(await caches.keys()).includes('confetti-blocks-v2'));
  assert.equal(await page.locator('#moves').innerText(),'0');
  assert.ok(!(await page.evaluate(()=>caches.keys())).includes('confetti-blocks-v1'));
  // A partially downloaded release must leave the current cache intact.
  release=3;await page.evaluate(async()=>await (await navigator.serviceWorker.getRegistration()).update());
  await page.waitForFunction(async()=>{
    const r=await navigator.serviceWorker.getRegistration();return !r.installing&&!r.waiting;
  });
  await page.waitForFunction(async()=>!(await caches.keys()).includes('confetti-blocks-v3'));
  await context.setOffline(true);await page.reload();await page.locator('#play').click();
  await page.locator('.piece-slot').first().click();await page.locator('.cell').first().click();assert.equal(await page.locator('#moves').innerText(),'1');
  console.log('Passed: update waits for consent, cancellation preserves the board, accepted update activates coherently, failed download preserves working offline version.');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
