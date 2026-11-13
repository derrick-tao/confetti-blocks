import {Game,SIZE,dimensions} from './engine.js';
import {HappyAudio,Confetti} from './effects.js';
const $=id=>document.getElementById(id),game=new Game(),audio=new HappyAudio();
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const read=(key,fallback)=>{try{const value=localStorage.getItem(`confetti-${key}`);return value===null?fallback:JSON.parse(value);}catch{return fallback;}};
const save=(key,value)=>{try{localStorage.setItem(`confetti-${key}`,JSON.stringify(value));}catch{}};
let best=Number(read('best',0));if(!Number.isFinite(best)||best<0)best=0;
let calm=!!read('calm',reduced.matches),sound=!!read('sound',true),volume=Number(read('volume',45));
if(!Number.isFinite(volume))volume=45;volume=Math.max(0,Math.min(100,volume));
let selected=null,anchor={x:0,y:0},drag=null,busy=false,clearTimer=0,toastTimer=0,celebrateTimer=0,scoreFrame=0,initialBest=best,bestCelebrated=false;
let offlineReady=false,deferredInstall=null,registration=null,updating=false;
const confetti=new Confetti($('particles'),()=>calm),board=$('board'),slots=[],cells=[];
const dialogs=[...document.querySelectorAll('dialog')];
function modalOpen(){return dialogs.some(dialog=>dialog.open);}
function announce(text){$('announcer').textContent=text;}
function toast(text){clearTimeout(toastTimer);$('toast').textContent=text;$('toast').classList.add('show');toastTimer=setTimeout(()=>$('toast').classList.remove('show'),2600);}
function canInteract(){return game.state==='playing'&&!busy&&!modalOpen();}
function applySettings(){
  document.body.classList.toggle('calm',calm);audio.enabled=sound;audio.volume=volume/100;
  $('sound').setAttribute('aria-pressed',String(sound));$('sound').setAttribute('aria-label',sound?'Mute sound':'Enable sound');
  $('sound').querySelector('use').setAttribute('href',sound?'#i-sound':'#i-mute');$('sound').querySelector('span').textContent=sound?'Sound on':'Sound off';
  $('calm').setAttribute('aria-pressed',String(calm));$('calm').querySelector('span').textContent=calm?'Calm mode':'Effects on';
  $('sound-setting').checked=sound;$('calm-setting').checked=calm;$('volume').value=volume;
  if(calm)confetti.clear();
}
function setSound(value){sound=value;save('sound',sound);applySettings();if(sound)audio.play('pickup');else audio.suspend();}
function setCalm(value){calm=value;save('calm',calm);applySettings();}
$('sound').onclick=()=>setSound(!sound);$('sound-setting').onchange=event=>setSound(event.target.checked);
$('calm').onclick=()=>setCalm(!calm);$('calm-setting').onchange=event=>setCalm(event.target.checked);
$('volume').oninput=event=>{volume=Number(event.target.value);save('volume',volume);applySettings();};
$('volume').onchange=()=>audio.play('place');
reduced.addEventListener('change',()=>{if(read('calm',null)===null){calm=reduced.matches;applySettings();}});
function showDialog(id){cancelDrag();clearPreview();$(id).showModal();}
$('help').onclick=()=>showDialog('help-dialog');$('settings').onclick=()=>showDialog('settings-dialog');
document.querySelectorAll('[data-close]').forEach(button=>button.onclick=()=>button.closest('dialog').close());
dialogs.forEach(dialog=>dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}}));
for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++){
  const cell=document.createElement('button');cell.type='button';cell.className='cell';cell.tabIndex=x===0&&y===0?0:-1;cell.dataset.x=x;cell.dataset.y=y;
  cell.setAttribute('aria-label',`Row ${y+1}, column ${x+1}, empty`);
  cell.addEventListener('pointerenter',()=>{if(selected!==null&&!drag&&canInteract()){anchor={x,y};preview();}});
  cell.onclick=()=>{if(!canInteract())return;if(selected===null){toast('Pick one of your three pieces first.');return;}anchor={x,y};commit();};
  cell.addEventListener('focus',()=>{if(!drag){anchor={x,y};preview();}});
  board.append(cell);cells.push(cell);
}
board.addEventListener('pointerleave',()=>{if(!drag)clearPreview();});
for(let slot=0;slot<3;slot++){
  const button=document.createElement('button');button.type='button';button.className='piece-slot';button.dataset.slot=slot;
  button.addEventListener('pointerdown',event=>beginDrag(event,slot));
  button.addEventListener('pointermove',moveDrag);
  button.addEventListener('pointerup',endDrag);
  button.addEventListener('pointercancel',cancelDrag);
  button.addEventListener('lostpointercapture',()=>{if(drag?.slot===slot)cancelDrag();});
  button.addEventListener('click',event=>{if(event.detail===0){select(slot);focusAnchor();}});
  $('tray').append(button);slots.push(button);
}
function shapeHTML(piece,unit){
  const {w,h}=dimensions(piece);
  return `<div class="piece-shape" style="--w:${w};--h:${h};${unit?`--unit:${unit}px`:''}">${piece.cells.map(([x,y])=>`<i class="tile ${piece.color}" style="grid-column:${x+1};grid-row:${y+1}"></i>`).join('')}</div>`;
}
function renderTray(){
  slots.forEach((button,slot)=>{
    const piece=game.tray[slot],blocked=piece&&!game.hasFit(piece);
    button.className=`piece-slot${!piece?' used':''}${selected===slot?' selected':''}${blocked?' blocked':''}`;
    button.disabled=!piece||game.state!=='playing'||busy;
    button.setAttribute('aria-pressed',String(selected===slot));
    button.setAttribute('aria-label',piece?`Piece ${slot+1}: ${piece.name}, ${piece.cells.length} blocks${blocked?', currently no space':''}`:`Piece ${slot+1} used`);
    button.innerHTML=piece?`${shapeHTML(piece)}<span class="piece-number" aria-hidden="true">${slot+1}</span>`:'';
  });
}
function renderBoard(result){
  const clearing=new Map((result?.clearedTiles||[]).map(cell=>[cell.y*SIZE+cell.x,cell.color]));
  const placed=new Set((result?.placed||[]).map(([x,y])=>y*SIZE+x));
  cells.forEach((cell,index)=>{
    const x=index%SIZE,y=Math.floor(index/SIZE),color=clearing.get(index)||game.board[y][x];
    cell.className=`cell${color?` tile ${color}`:''}${clearing.has(index)?' clearing':placed.has(index)?' placed':''}`;
    cell.setAttribute('aria-label',`Row ${y+1}, column ${x+1}, ${color?`${color} block`:'empty'}`);
    cell.setAttribute('aria-disabled',String(!canInteract()));
  });
}
function scoreTo(value){
  cancelAnimationFrame(scoreFrame);
  const from=Number($('score').textContent.replaceAll(',',''))||0,started=performance.now();
  if(calm){$('score').textContent=value.toLocaleString();return;}
  function step(now){const progress=Math.min(1,(now-started)/250);$('score').textContent=Math.round(from+(value-from)*(1-(1-progress)**3)).toLocaleString();if(progress<1)scoreFrame=requestAnimationFrame(step);}
  scoreFrame=requestAnimationFrame(step);
}
function renderStats(){
  scoreTo(game.score);$('lines').textContent=game.lines;$('moves').textContent=game.moves;
  if(game.score>best){best=game.score;save('best',best);}
  $('best').textContent=best.toLocaleString();
  $('combo-text').textContent=game.streak>1?`COMBO ×${game.streak}`:game.streak===1?'NICE CLEAR!':"LET'S GO!";
  $('combo').classList.toggle('hot',game.streak>0);
  $('combo').classList.remove('bump');if(game.streak>0){void $('combo').offsetWidth;$('combo').classList.add('bump');}
}
function renderOverlay(){
  $('overlay').hidden=game.state==='playing'||busy;
  if(game.state==='over'){
    $('overlay-kicker').textContent='LOOK AT ALL THOSE LITTLE WINS';
    $('overlay-title').innerHTML='Good game,<br><em>happy brain!</em>';
    $('overlay-copy').textContent=`${game.score.toLocaleString()} points · ${game.lines} lines · ${game.moves} clever moves`;
    $('play').innerHTML='Play again <span aria-hidden="true">→</span>';
    $('overlay-foot').textContent='A fresh board. A fresh possibility.';
  }
}
function render(){renderBoard();renderTray();renderStats();renderOverlay();}
function clearPreview(){cells.forEach(cell=>{cell.classList.remove('preview','invalid','line-preview');cell.style.removeProperty('--tile');});}
function preview(){
  clearPreview();if(!canInteract()||selected===null)return;
  const piece=game.tray[selected];if(!piece)return;
  const valid=game.canPlace(piece,anchor.x,anchor.y);
  for(const [dx,dy]of piece.cells){const x=anchor.x+dx,y=anchor.y+dy;if(x<0||x>=SIZE||y<0||y>=SIZE)continue;const cell=cells[y*SIZE+x];cell.style.setProperty('--tile',`var(--${piece.color})`);cell.classList.add(valid?'preview':'invalid');}
  if(valid){const result=game.preview(selected,anchor.x,anchor.y);for(const [x,y]of result.cleared)cells[y*SIZE+x].classList.add('line-preview');}
}
function select(slot){
  if(!canInteract()||!game.tray[slot])return;
  selected=slot;renderTray();preview();audio.play('pickup');
  const piece=game.tray[slot];$('play-hint').textContent=game.hasFit(piece)?`${piece.name} selected. Tap its top-left spot, or use arrows + Enter.`:'This piece needs more room. Try another piece to clear some space.';
  if(!game.hasFit(piece))toast('A little tight! Try another piece first.');
  announce(`${piece.name} selected. ${piece.cells.length} blocks. Arrow keys move, Enter places.`);
}
function focusAnchor(){
  const x=Math.max(0,Math.min(SIZE-1,anchor.x)),y=Math.max(0,Math.min(SIZE-1,anchor.y));
  cells.forEach(cell=>cell.tabIndex=-1);const cell=cells[y*SIZE+x];cell.tabIndex=0;cell.focus({preventScroll:true});
}
function floatScore(points){
  if(calm)return;
  document.querySelectorAll('.score-float').forEach(node=>node.remove());
  const node=document.createElement('span');node.className='score-float';node.textContent=`+${points.toLocaleString()}`;$('board-shell').append(node);node.addEventListener('animationend',()=>node.remove(),{once:true});
}
function celebrate(result){
  const title=result.perfect?'Clean sweep!':result.streak>1?`Combo ×${result.streak}!`:result.count>1?'Super clear!':'Sweet clear!';
  $('celebration-title').textContent=title;$('celebration-sub').textContent=`${result.count} ${result.count===1?'line':'lines'} · +${result.points.toLocaleString()} points`;
  clearTimeout(celebrateTimer);$('celebration').classList.remove('show');void $('celebration').offsetWidth;$('celebration').classList.add('show');
  celebrateTimer=setTimeout(()=>$('celebration').classList.remove('show'),1450);
  confetti.burst(result.count+result.streak+(result.perfect?2:0));
}
function commit(){
  if(!canInteract()||selected===null)return;
  const result=game.place(selected,anchor.x,anchor.y);
  if(!result){audio.play('invalid');toast('Not quite! Find an empty spot for the whole piece.');return;}
  clearTimeout(toastTimer);$('toast').classList.remove('show');
  selected=null;busy=result.count>0;clearPreview();renderBoard(result);renderTray();renderStats();renderOverlay();
  $('play-hint').textContent='Drag a block, or tap one then tap the board.';
  floatScore(result.points);
  audio.play(result.perfect?'perfect':result.streak>1?'combo':result.count?'clear':'place',result.streak);
  announce(`Placed. ${result.points} points.${result.count?` ${result.count} lines cleared.${result.streak>1?` Combo ${result.streak}.`:''}${result.perfect?' Perfect clear!':''}`:''} Score ${game.score}.`);
  if(!bestCelebrated&&initialBest>0&&game.score>initialBest){bestCelebrated=true;toast('New personal best! Look at you go!');}
  if(result.count){
    celebrate(result);$('board-shell').classList.remove('clear-glow');void $('board-shell').offsetWidth;$('board-shell').classList.add('clear-glow');
    clearTimer=setTimeout(finishPlacement,280);
  }else finishPlacement();
}
function finishPlacement(){
  clearTimeout(clearTimer);busy=false;renderBoard();renderTray();renderOverlay();
  if(game.state==='over'){audio.play('over');announce(`Game over. ${game.score} points, ${game.lines} lines. Play again for a fresh board.`);}
}
function start(){
  cancelDrag();clearTimeout(clearTimer);clearTimeout(celebrateTimer);clearTimeout(toastTimer);cancelAnimationFrame(scoreFrame);
  busy=false;selected=null;anchor={x:0,y:0};confetti.clear();$('celebration').classList.remove('show');$('board-shell').classList.remove('clear-glow');$('toast').classList.remove('show');
  document.querySelectorAll('.score-float').forEach(node=>node.remove());
  game.reset();initialBest=best;bestCelebrated=false;render();$('play-hint').textContent='Drag a block, or tap one then tap the board.';
  audio.play('start');focusAnchor();announce('Fresh board! Select one of three pieces to begin.');
}
$('play').onclick=start;
$('restart').onclick=()=>{cancelDrag();if(game.state==='playing'&&game.moves>0&&!confirm('Start a fresh board? Your current game will be cleared.'))return;start();};
function geometry(){const first=cells[0].getBoundingClientRect(),second=cells[1].getBoundingClientRect();return {left:first.left,top:first.top,step:second.left-first.left,size:first.width};}
function beginDrag(event,slot){
  if(event.button!==0||drag||!canInteract()||!game.tray[slot])return;
  event.preventDefault();audio.unlock();
  drag={slot,id:event.pointerId,startX:event.clientX,startY:event.clientY,moved:false,touch:event.pointerType==='touch',button:event.currentTarget};
  event.currentTarget.setPointerCapture(event.pointerId);
}
function moveDrag(event){
  if(!drag||event.pointerId!==drag.id)return;
  if(!drag.moved&&Math.hypot(event.clientX-drag.startX,event.clientY-drag.startY)<6)return;
  if(!drag.moved){drag.moved=true;selected=drag.slot;slots.forEach((button,index)=>button.classList.toggle('selected',index===selected));audio.play('pickup');}
  const piece=game.tray[drag.slot],{w,h}=dimensions(piece),g=geometry(),lift=drag.touch?65:14;
  const originX=event.clientX-(w*g.step-4)/2,originY=event.clientY-lift-(h*g.step-4)/2;
  anchor={x:Math.round((originX-g.left)/g.step),y:Math.round((originY-g.top)/g.step)};
  const ghost=$('drag-ghost');ghost.innerHTML=shapeHTML(piece,g.size);ghost.style.display='block';ghost.style.left=`${originX}px`;ghost.style.top=`${originY}px`;
  preview();
}
function endDrag(event){
  if(!drag||event.pointerId!==drag.id)return;
  const {slot,moved}=drag;drag=null;$('drag-ghost').style.display='none';
  if(moved){
    // A snapped origin may be valid even while the pointer is just outside the board.
    const r=board.getBoundingClientRect();
    if(event.clientX>=r.left&&event.clientX<=r.right&&event.clientY>=r.top&&event.clientY<=r.bottom+70)commit();else{clearPreview();renderTray();}
  }else select(slot);
}
function cancelDrag(){
  if(drag){const previous=drag;drag=null;try{if(previous.button.hasPointerCapture(previous.id))previous.button.releasePointerCapture(previous.id);}catch{}}
  $('drag-ghost').style.display='none';clearPreview();
}
document.addEventListener('keydown',event=>{
  if(modalOpen()||!canInteract())return;
  if(['Digit1','Digit2','Digit3'].includes(event.code)){event.preventDefault();select(Number(event.code.at(-1))-1);focusAnchor();return;}
  if(event.code==='Escape'){selected=null;cancelDrag();renderTray();$('play-hint').textContent='Drag a block, or tap one then tap the board.';return;}
  const onBoard=board.contains(document.activeElement);
  if(!onBoard)return;
  if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.code)){
    event.preventDefault();anchor.x=Math.max(0,Math.min(SIZE-1,anchor.x+(event.code==='ArrowRight'?1:event.code==='ArrowLeft'?-1:0)));
    anchor.y=Math.max(0,Math.min(SIZE-1,anchor.y+(event.code==='ArrowDown'?1:event.code==='ArrowUp'?-1:0)));focusAnchor();preview();
  }else if(['Enter','Space'].includes(event.code)){event.preventDefault();if(!event.repeat)commit();}
});
window.addEventListener('resize',cancelDrag);
window.addEventListener('blur',cancelDrag);
document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelDrag();audio.suspend();}});
function offlineMessage(){
  const text=offlineReady?'Ready to play offline':navigator.onLine?'Downloading offline play…':'Connect once to download offline play';
  $('offline-status').textContent=text;$('connection-text').textContent=offlineReady?(navigator.onLine?'Downloaded · ready to play offline':'You’re offline · let’s play!'):text;
  $('connection-dot').classList.toggle('ready',offlineReady);
  $('offline-detail').textContent=offlineReady?'All game files are downloaded in this browser. You can turn off Wi-Fi, reopen this page, and keep playing. Sounds and celebrations work offline, too.':'Keep this page open with an internet connection until you see “Ready to play offline.” If the download fails, reconnect and reload to try again.';
}
function offlineHelp(){showDialog('offline-dialog');}
$('install').onclick=offlineHelp;$('offline-info').onclick=offlineHelp;
window.addEventListener('online',offlineMessage);window.addEventListener('offline',offlineMessage);
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();deferredInstall=event;$('install-prompt').hidden=false;});
$('install-prompt').onclick=async()=>{if(!deferredInstall)return;await deferredInstall.prompt();await deferredInstall.userChoice;deferredInstall=null;$('install-prompt').hidden=true;};
window.addEventListener('appinstalled',()=>{deferredInstall=null;$('install-prompt').hidden=true;toast('Happy is now on your home screen!');});
async function setupOffline(){
  if(!('serviceWorker'in navigator)){ $('connection-text').textContent='Offline mode is unavailable in this browser';$('offline-status').textContent='Play online in this browser';return; }
  try{
    registration=await navigator.serviceWorker.register('./sw.js',{scope:'./',updateViaCache:'none'});
    const checkUpdate=()=>{if(registration.waiting)$('update').hidden=false;};
    registration.addEventListener('updatefound',()=>{const worker=registration.installing;worker?.addEventListener('statechange',()=>{if(worker.state==='installed'&&navigator.serviceWorker.controller)checkUpdate();});});
    checkUpdate();
    const ready=await navigator.serviceWorker.ready;
    // The worker activates only after its atomic core-file cache completes.
    if(ready.active){offlineReady=true;offlineMessage();}
  }catch{offlineReady=false;$('offline-status').textContent='Offline download not finished';$('connection-text').textContent='Offline download incomplete · reconnect and reload';}
}
$('update').onclick=()=>{
  if(game.state==='playing'&&game.moves>0&&!confirm('Update the game now? Your current board will restart.'))return;
  updating=true;registration?.waiting?.postMessage({type:'ACTIVATE_UPDATE'});
};
navigator.serviceWorker?.addEventListener('controllerchange',()=>{if(updating)location.reload();});
// Request durable storage only from an explicit install/help interaction.
$('offline-dialog').addEventListener('close',()=>{if(offlineReady)navigator.storage?.persist?.().catch(()=>{});});
applySettings();render();offlineMessage();setupOffline();
