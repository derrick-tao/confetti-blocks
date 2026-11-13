export class HappyAudio {
  constructor(){this.enabled=true;this.volume=.45;this.context=null;}
  unlock(){
    if(!this.enabled)return;
    try{this.context??=new (window.AudioContext||window.webkitAudioContext)();if(this.context.state==='suspended')this.context.resume().catch(()=>{});}catch{}
  }
  play(kind,streak=1){
    if(!this.enabled || this.volume===0)return;
    this.unlock();const ctx=this.context;if(!ctx)return;
    const tunes={start:[392,494,587,784],pickup:[660],place:[440,554],invalid:[196],clear:[523,659,784,1047],combo:[659,784,988,1175,1319],perfect:[523,659,784,1047,1319,1568],over:[523,440,392,330]};
    const notes=tunes[kind]||tunes.place,step=kind==='pickup'?.025:kind==='place'?.045:.075;
    try{notes.forEach((frequency,i)=>{
      const when=ctx.currentTime+i*step,osc=ctx.createOscillator(),gain=ctx.createGain();
      osc.type=kind==='invalid'?'sine':'triangle';osc.frequency.value=frequency*(kind==='combo'?Math.min(1.2,1+(streak-2)*.025):1);
      gain.gain.setValueAtTime(0,when);gain.gain.linearRampToValueAtTime(.12*this.volume,when+.008);
      gain.gain.exponentialRampToValueAtTime(.0001,when+.19);
      osc.connect(gain);gain.connect(ctx.destination);osc.start(when);osc.stop(when+.21);
    });}catch{}
  }
  suspend(){try{this.context?.suspend().catch(()=>{});}catch{}}
}
export class Confetti {
  constructor(canvas,calm){this.canvas=canvas;this.calm=calm;this.bits=[];this.frame=0;}
  burst(strength=1){
    if(this.calm())return;
    this.clear();
    const r=this.canvas.getBoundingClientRect(),ratio=Math.min(devicePixelRatio||1,2);
    this.canvas.width=Math.round(r.width*ratio);this.canvas.height=Math.round(r.height*ratio);
    this.ctx=this.canvas.getContext('2d');this.ctx.setTransform(ratio,0,0,ratio,0,0);
    this.width=r.width;this.height=r.height;
    const colors=['#ffca6c','#ff927d','#8fddc0','#a5d6ee','#c4a4f4','#ffb6d2'];
    this.bits=Array.from({length:Math.min(110,38+strength*14)},()=>({x:r.width/2,y:r.height*.45,vx:(Math.random()-.5)*8,vy:-2-Math.random()*6,spin:(Math.random()-.5)*.3,angle:Math.random()*6,life:65+Math.random()*25,color:colors[Math.floor(Math.random()*colors.length)],size:3+Math.random()*4}));
    this.last=performance.now();this.frame=requestAnimationFrame(t=>this.draw(t));
  }
  draw(now){
    const step=Math.min((now-this.last)/16.67,2);this.last=now;
    this.ctx.clearRect(0,0,this.width,this.height);
    this.bits=this.bits.filter(bit=>bit.life>0);
    for(const bit of this.bits){
      bit.x+=bit.vx*step;bit.y+=bit.vy*step;bit.vy+=.13*step;bit.angle+=bit.spin*step;bit.life-=step;
      this.ctx.save();this.ctx.translate(bit.x,bit.y);this.ctx.rotate(bit.angle);this.ctx.globalAlpha=Math.min(1,bit.life/18);this.ctx.fillStyle=bit.color;this.ctx.fillRect(-bit.size/2,-bit.size/2,bit.size,bit.size*.65);this.ctx.restore();
    }
    if(this.bits.length)this.frame=requestAnimationFrame(t=>this.draw(t));else this.clear();
  }
  clear(){cancelAnimationFrame(this.frame);this.bits=[];if(this.ctx)this.ctx.clearRect(0,0,this.width,this.height);}
}
