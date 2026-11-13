import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {launchBrowser,serve} from './helpers.mjs';
const local=await serve(),browser=await launchBrowser({args:['--js-flags=--expose-gc']});
const report={};
try{
 const ctx=await browser.newContext({viewport:{width:1280,height:900}});await ctx.addInitScript(()=>{Math.random=()=>0;window.confirm=()=>true;localStorage.setItem('confetti-calm','true');localStorage.setItem('confetti-sound','false');window.__violations=[];document.addEventListener('securitypolicyviolation',event=>window.__violations.push(event.violatedDirective));});
 const page=await ctx.newPage();await page.goto(local.url);await page.locator('#play').click();const cdp=await ctx.newCDPSession(page);
 const cycles=count=>page.evaluate(async count=>{for(let n=0;n<count;n++){document.querySelector('#restart').click();for(let x=0;x<4;x++){document.querySelector('.piece-slot:not(.used)').click();document.querySelector(`.cell[data-x="${x}"][data-y="0"]`).click();}if(n%10===0)await new Promise(r=>setTimeout(r,0));}},count);
 const sample=async()=>{await page.waitForTimeout(100);await cdp.send('HeapProfiler.collectGarbage');return {...await cdp.send('Memory.getDOMCounters'),heap:(await cdp.send('Runtime.getHeapUsage')).usedSize};};
 await cycles(30);report.memory=[await sample()];for(let batch=0;batch<3;batch++){await cycles(100);report.memory.push(await sample());}
 const first=report.memory[0],last=report.memory.at(-1);assert.ok(last.heap-first.heap<2*1024*1024,JSON.stringify(report.memory));assert.ok(last.heap<16*1024*1024);assert.ok(Math.abs(last.nodes-first.nodes)<=12);assert.ok(Math.abs(last.jsEventListeners-first.jsEventListeners)<=2);
 await page.locator('#restart').click();
 let source=await page.locator('.piece-slot').first().boundingBox();await page.mouse.move(source.x+source.width/2,source.y+source.height/2);await page.mouse.down();
 report.drag=await page.evaluate(async()=>{
  const slot=document.querySelector('.piece-slot'),ghost=document.querySelector('#drag-ghost'),original=ghost.firstElementChild;
  let reads=0,mutations=0,styleWrites=0;const originals=[];for(const cell of document.querySelectorAll('.cell')){const original=cell.getBoundingClientRect;originals.push([cell,original]);cell.getBoundingClientRect=function(...args){reads++;return original.apply(this,args);};}
  const observer=new MutationObserver(records=>{mutations+=records.filter(r=>r.type==='childList').length;styleWrites+=records.filter(r=>r.type==='attributes'&&r.target===ghost).length;});observer.observe(ghost,{childList:true,subtree:true,attributes:true,attributeFilter:['style']});
  const rect=document.querySelector('#board').getBoundingClientRect();let start=performance.now();
  for(let frame=0;frame<60;frame++){await new Promise(r=>requestAnimationFrame(r));for(let i=0;i<6;i++)slot.dispatchEvent(new PointerEvent('pointermove',{pointerId:1,clientX:rect.left+30+(frame%6)*20+i,clientY:rect.top+90,bubbles:true}));}
  await new Promise(r=>requestAnimationFrame(r));observer.disconnect();for(const [cell,original]of originals)cell.getBoundingClientRect=original;
  return {moves:360,reads,mutations,styleWrites,ghostReused:original===ghost.firstElementChild,durationMs:performance.now()-start};
 });
 assert.equal(report.drag.reads,0);assert.equal(report.drag.mutations,0);assert.ok(report.drag.styleWrites>0&&report.drag.styleWrites<=130,JSON.stringify(report.drag));assert.ok(report.drag.ghostReused);await page.mouse.up();
 await page.locator('#restart').click();source=await page.locator('.piece-slot').first().boundingBox();await page.mouse.move(source.x+source.width/2,source.y+source.height/2);await page.mouse.down();
 // Both events occur within one task: pointer-up must flush the latest unrendered position.
 await page.evaluate(()=>{
  const slot=document.querySelector('.piece-slot'),cell=document.querySelector('.cell[data-x="4"][data-y="2"]').getBoundingClientRect(),x=cell.left+cell.width/2,y=cell.top+cell.height/2+14;
  slot.dispatchEvent(new PointerEvent('pointermove',{pointerId:1,clientX:x-20,clientY:y,bubbles:true}));slot.dispatchEvent(new PointerEvent('pointerup',{pointerId:1,clientX:x,clientY:y,bubbles:true}));
 });await page.mouse.up();assert.equal(await page.locator('#moves').innerText(),'1');assert.ok((await page.locator('.cell[data-x="4"][data-y="2"]').getAttribute('class')).includes('tile'));
 source=await page.locator('.piece-slot:not(.used)').first().boundingBox();await page.mouse.move(source.x+source.width/2,source.y+source.height/2);await page.mouse.down();
 await page.evaluate(()=>{const slot=document.querySelector('.piece-slot:not(.used)');slot.dispatchEvent(new PointerEvent('pointermove',{pointerId:1,clientX:300,clientY:300,bubbles:true}));slot.dispatchEvent(new PointerEvent('pointercancel',{pointerId:1,bubbles:true}));});await page.mouse.up();await page.waitForTimeout(70);assert.equal(await page.locator('#moves').innerText(),'1');assert.equal(await page.locator('#drag-ghost').isVisible(),false);
 assert.deepEqual(await page.evaluate(()=>window.__violations),[]);report.placements=1320;report.queuedUpAndCancel='passed';await mkdir('test-results',{recursive:true});await writeFile('test-results/performance.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await browser.close();await local.close();}
