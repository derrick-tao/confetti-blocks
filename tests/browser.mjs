import {launchBrowser,serve} from './helpers.mjs';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const local=process.env.TEST_URL?null:await serve();
const base=process.env.TEST_URL||local.url;
const browser=await launchBrowser();
const errors=[];
await mkdir('test-results',{recursive:true});
function watch(page){page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error'&&message.text().includes('Content Security Policy'))errors.push(message.text());});}
const cell=(page,x,y)=>page.locator(`.cell[data-x="${x}"][data-y="${y}"]`);
async function nextSlot(page){return page.locator('.piece-slot:not(.used)').first();}
async function put(page,x,y){await (await nextSlot(page)).click();await cell(page,x,y).click();}
async function settled(page){await page.waitForFunction(()=>!document.querySelector('.cell.clearing'));await page.waitForTimeout(280);}
async function freshContext(options={}){
  const context=await browser.newContext(options);
  await context.addInitScript(()=>{
    Math.random=()=>0;
    window.__notes=0;
    if(window.AudioContext){const original=AudioContext.prototype.createOscillator;AudioContext.prototype.createOscillator=function(...args){window.__notes++;return original.apply(this,args);};}
  });
  return context;
}
try{
  const context=await freshContext({viewport:{width:1440,height:1000}}),page=await context.newPage();watch(page);
  await page.goto(base);await page.locator('#play').waitFor();
  assert.equal(await page.locator('.cell').count(),64);assert.equal(await page.locator('.piece-slot').count(),3);
  await page.screenshot({path:'test-results/desktop-ready.png',fullPage:true});
  await page.locator('#play').click();await put(page,0,0);await settled(page);
  assert.equal(await page.locator('#moves').innerText(),'1');assert.equal(await page.locator('#score').innerText(),'10');
  await page.locator('.piece-slot[data-slot="1"]').click();await cell(page,0,0).click();
  assert.equal(await page.locator('#moves').innerText(),'1');assert.equal(await page.locator('.piece-slot.used').count(),1);
  await page.keyboard.press('Digit2');await page.keyboard.press('ArrowRight');await page.keyboard.press('Enter');
  assert.equal(await page.locator('#moves').innerText(),'2');
  const source=await page.locator('.piece-slot[data-slot="2"]').boundingBox(),target=await cell(page,2,0).boundingBox();
  await page.mouse.move(source.x+source.width/2,source.y+source.height/2);await page.mouse.down();
  await page.mouse.move(target.x+target.width/2,target.y+target.height/2+14,{steps:8});
  await page.waitForFunction(()=>document.querySelectorAll('.cell.preview').length===1);await page.mouse.up();
  assert.equal(await page.locator('#moves').innerText(),'3');
  for(let x=3;x<8;x++)await put(page,x,0);
  await page.locator('.cell.clearing').first().waitFor();assert.equal(await page.locator('.cell.clearing').count(),8);
  assert.equal(await page.locator('#celebration-title').innerText(),'Clean sweep!');
  await page.waitForTimeout(130);
  assert.ok(await page.evaluate(()=>{
    const c=document.querySelector('#particles'),data=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
    return data.some((v,i)=>i%4===3&&v>0);
  }));
  await page.screenshot({path:'test-results/celebration.png',fullPage:true});
  await settled(page);assert.equal(await page.locator('#score').innerText(),'680');assert.equal(await page.locator('#lines').innerText(),'1');
  assert.equal(await page.locator('.cell.tile').count(),0);
  for(let y=1;y<=2;y++)for(let x=0;x<7;x++)await put(page,x,y);
  await put(page,7,1);await settled(page);await put(page,7,2);
  assert.equal(await page.locator('#combo-text').innerText(),'COMBO ×2');await settled(page);
  assert.equal(await page.locator('#lines').innerText(),'3');assert.equal(await page.locator('.cell.tile').count(),0);
  await put(page,2,2);await put(page,3,2);await put(page,4,2);await put(page,4,3);await settled(page);
  await page.screenshot({path:'test-results/desktop-playing.png',fullPage:true});
  await page.locator('#settings').click();assert.equal(await page.locator('#settings-dialog').isVisible(),true);
  await page.locator('#volume').fill('25');await page.locator('#calm-setting').check();assert.equal(await page.locator('body').getAttribute('class'),'calm');
  await page.locator('#sound-setting').uncheck();assert.equal(await page.locator('#sound').getAttribute('aria-pressed'),'false');
  await page.keyboard.press('Escape');await page.locator('#sound').click();assert.ok(await page.evaluate(()=>window.__notes)>0);
  await page.locator('#help').click();assert.equal(await page.locator('#help-dialog').isVisible(),true);await page.keyboard.press('Escape');
  page.once('dialog',dialog=>dialog.dismiss());await page.locator('#restart').click();assert.notEqual(await page.locator('#moves').innerText(),'0');
  page.once('dialog',dialog=>dialog.accept());await page.locator('#restart').click();assert.equal(await page.locator('#moves').innerText(),'0');
  const best=await page.locator('#best').innerText();await page.reload();assert.equal(await page.locator('#best').innerText(),best);
  assert.equal(await page.locator('body').getAttribute('class'),'calm');
  // First download completes before the offline label appears.
  await page.waitForFunction(()=>document.querySelector('#connection-text').textContent.includes('ready to play offline'));
  await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
  const cache=await page.evaluate(async()=>{
    const names=(await caches.keys()).filter(k=>k.startsWith('confetti-blocks-'));
    const entries=await (await caches.open(names[0])).keys();return entries.map(r=>new URL(r.url).pathname);
  });
  assert.ok(cache.some(path=>/effects\.[a-f0-9]+\.js$/.test(path))&&cache.some(path=>path.endsWith('/icon-512.png')));
  const manifest=await page.evaluate(async()=>await (await fetch('./manifest.webmanifest')).json());assert.equal(manifest.display,'standalone');
  await context.setOffline(true);await page.reload();await page.locator('#play').click();await put(page,0,0);await settled(page);
  assert.equal(await page.locator('#moves').innerText(),'1');assert.ok((await page.locator('#connection-text').innerText()).includes('offline'));
  assert.ok(await page.evaluate(()=>window.__notes)>0);
  await page.close();const reopened=await context.newPage();watch(reopened);await reopened.goto(base);await reopened.locator('#play').click();await put(reopened,1,1);
  assert.equal(await reopened.locator('#moves').innerText(),'1');
  await reopened.screenshot({path:'test-results/offline-reopened.png',fullPage:true});await reopened.locator('.privacy-link').click();assert.ok((await reopened.locator('h1').innerText()).includes('Privacy'));assert.ok((await reopened.locator('body').innerText()).includes('IP addresses'));await context.close();
  const mobile=await freshContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2}),phone=await mobile.newPage();watch(phone);
  await phone.goto(base);await phone.locator('#play').tap();await phone.locator('.piece-slot[data-slot="0"]').tap();await cell(phone,0,0).tap();assert.equal(await phone.locator('#moves').innerText(),'1');
  const phoneSource=await phone.locator('.piece-slot[data-slot="1"]').boundingBox(),phoneTarget=await cell(phone,1,1).boundingBox();
  const cdp=await mobile.newCDPSession(phone);
  const touch=async(type,x,y)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'||type==='touchCancel'?[]:[{x,y,id:1}]});
  await touch('touchStart',phoneSource.x+phoneSource.width/2,phoneSource.y+phoneSource.height/2);
  await touch('touchMove',phoneTarget.x+phoneTarget.width/2,phoneTarget.y+phoneTarget.height/2+65);
  await phone.locator('#drag-ghost').waitFor({state:'visible'});await touch('touchEnd');assert.equal(await phone.locator('#moves').innerText(),'2');
  const cancelSource=await phone.locator('.piece-slot[data-slot="2"]').boundingBox();
  await touch('touchStart',cancelSource.x+cancelSource.width/2,cancelSource.y+cancelSource.height/2);
  await touch('touchMove',phoneTarget.x+phoneTarget.width/2,phoneTarget.y+phoneTarget.height/2+65);await touch('touchCancel');
  assert.equal(await phone.locator('#moves').innerText(),'2');assert.equal(await phone.locator('#drag-ghost').isVisible(),false);
  await touch('touchStart',cancelSource.x+cancelSource.width/2,cancelSource.y+cancelSource.height/2);await touch('touchMove',3,100);await touch('touchEnd');assert.equal(await phone.locator('#moves').innerText(),'2');
  await settled(phone);assert.ok(await phone.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await phone.screenshot({path:'test-results/mobile-playing.png',fullPage:true});
  await phone.setViewportSize({width:320,height:640});assert.ok(await phone.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await phone.screenshot({path:'test-results/mobile-small.png',fullPage:true});
  await phone.setViewportSize({width:844,height:390});assert.ok(await phone.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await phone.screenshot({path:'test-results/landscape.png',fullPage:true});await mobile.close();
  const reduced=await freshContext({reducedMotion:'reduce'});await reduced.addInitScript(()=>{
    Object.defineProperty(window,'localStorage',{get(){throw new Error('Storage unavailable');}});
    Object.defineProperty(window,'AudioContext',{value:class{constructor(){throw new Error('Audio unavailable');}}});
  });
  const calmPage=await reduced.newPage();watch(calmPage);await calmPage.goto(base);assert.equal(await calmPage.locator('body').getAttribute('class'),'calm');
  await calmPage.locator('#play').click();await put(calmPage,0,0);assert.equal(await calmPage.locator('#score').innerText(),'10');await reduced.close();
  // A reproducible mixed-shape game, played only through the public UI.
  const mixed=await browser.newContext({viewport:{width:1440,height:1000}});
  await mixed.addInitScript(()=>{let seed=731;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};});
  const mixedPage=await mixed.newPage();watch(mixedPage);await mixedPage.goto(base);await mixedPage.locator('#play').click();
  let ended=false;
  for(let move=0;move<160;move++){
    await mixedPage.waitForFunction(()=>!document.querySelector('.cell.clearing'));
    if(await mixedPage.locator('#overlay').isVisible()){ended=true;break;}
    const fit=await mixedPage.evaluate(()=>{
      const occupied=[...document.querySelectorAll('.cell')].map(c=>c.classList.contains('tile'));
      const buttons=[...document.querySelectorAll('.piece-slot')];
      for(let slot=0;slot<3;slot++){
        const shape=[...buttons[slot].querySelectorAll('.tile')].map(c=>[parseInt(c.style.gridColumn)-1,parseInt(c.style.gridRow)-1]);
        if(!shape.length)continue;
        for(let y=0;y<8;y++)for(let x=0;x<8;x++)if(shape.every(([dx,dy])=>x+dx<8&&y+dy<8&&!occupied[(y+dy)*8+x+dx]))return {slot,x,y};
      }
      return null;
    });
    assert.ok(fit,'A playing game must offer a legal move');
    await mixedPage.locator(`.piece-slot[data-slot="${fit.slot}"]`).click();await cell(mixedPage,fit.x,fit.y).click();
    if(move===7){await settled(mixedPage);await mixedPage.screenshot({path:'test-results/mixed-shapes.png',fullPage:true});}
  }
  assert.ok(ended,'Mixed game reaches a no-move ending');assert.ok((await mixedPage.locator('#overlay-title').innerText()).includes('Good game'));
  await mixedPage.locator('#play').click();assert.equal(await mixedPage.locator('#moves').innerText(),'0');await mixed.close();
  assert.deepEqual(errors,[]);
  console.log('Passed: mouse/keyboard/touch, invalid/cancelled/outside drag, clear/confetti/combo, scores, restart, settings, audio/storage failure, responsive layouts, and offline reload + closed-tab reopen.');
}finally{await browser.close();await local?.close();}
