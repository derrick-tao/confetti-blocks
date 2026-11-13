import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,SHAPES,dimensions} from '../engine.js';
const fresh=()=>{const g=new Game(()=>0);g.reset();return g;};
const piece=name=>({...SHAPES.find(p=>p.name===name),color:'mint'});
test('shape pool is unique, connected, normalized, and at most five cells wide/high',()=>{
  assert.equal(SHAPES.length,27);
  const signatures=new Set();
  for(const shape of SHAPES){
    const {w,h}=dimensions(shape);assert.ok(w<=5&&h<=5);
    assert.equal(Math.min(...shape.cells.map(c=>c[0])),0);assert.equal(Math.min(...shape.cells.map(c=>c[1])),0);
    const keys=shape.cells.map(c=>c.join(','));assert.equal(new Set(keys).size,keys.length);
    const signature=[...keys].sort().join(';');assert.ok(!signatures.has(signature));signatures.add(signature);
    const seen=new Set([keys[0]]);let changed=true;
    while(changed){changed=false;for(const [x,y]of shape.cells)if(!seen.has(`${x},${y}`)&&[[x-1,y],[x+1,y],[x,y-1],[x,y+1]].some(c=>seen.has(c.join(',')))){seen.add(`${x},${y}`);changed=true;}}
    assert.equal(seen.size,shape.cells.length);
  }
});
test('rejects collisions, off-board coordinates, fractions and empty slots without mutation',()=>{
  const g=fresh();g.tray[0]=piece('Little square');g.board[0][0]='pink';
  const before=JSON.stringify(g);
  for(const [x,y]of [[0,0],[-1,1],[7,7],[.5,2],[2,NaN]])assert.equal(g.place(0,x,y),null);
  assert.equal(g.place(9,1,1),null);assert.equal(JSON.stringify(g),before);
});
test('places arbitrary shape with ten points per cell, consuming only chosen slot',()=>{
  const g=fresh();g.tray[1]=piece('T down');const result=g.place(1,2,3);
  assert.equal(result.points,40);assert.equal(g.moves,1);assert.equal(g.tray[1],null);
  assert.ok(g.tray[0]&&g.tray[2]);assert.equal(g.board.flat().filter(Boolean).length,4);
});
test('row and column clear together, intersection clears once, board does not collapse',()=>{
  const g=fresh();for(let i=0;i<8;i++){g.board[4][i]='mint';g.board[i][3]='gold';}g.board[4][3]=null;g.board[0][0]='pink';
  const result=g.place(0,3,4);
  assert.equal(result.count,2);assert.equal(result.cleared.length,15);assert.equal(result.points,410);
  assert.equal(g.lines,2);assert.equal(g.board[0][0],'pink');assert.equal(g.board.flat().filter(Boolean).length,1);
});
test('two parallel rows score quadratically and perfect clear awards 500',()=>{
  const g=fresh();g.tray[0]=piece('Two down');for(let y=6;y<8;y++)g.board[y].fill('sky');g.board[6][4]=g.board[7][4]=null;
  const r=g.place(0,4,6);assert.equal(r.count,2);assert.equal(r.perfect,true);assert.equal(r.points,920);
});
test('successive clearing placements grow combo; a plain placement resets it',()=>{
  const g=fresh();g.board[7].fill('mint');g.board[7][0]=null;g.board[0][0]='gold';
  assert.equal(g.place(0,0,7).points,110);assert.equal(g.streak,1);
  g.board[7].fill('mint');g.board[7][0]=null;assert.equal(g.place(1,0,7).points,210);assert.equal(g.streak,2);
  g.place(2,1,1);assert.equal(g.streak,0);
});
test('preview detects line clears without mutating engine',()=>{
  const g=fresh();g.board[7].fill('mint');g.board[7][0]=null;const before=JSON.stringify(g);
  assert.equal(g.preview(0,0,7).rows.length,1);assert.equal(g.preview(0,1,7),null);assert.equal(JSON.stringify(g),before);
});
test('refill happens only after all three used; each dealt piece has a fit',()=>{
  const g=fresh(),ids=g.tray.map(p=>p.id);g.place(0,0,0);g.place(1,1,0);assert.equal(g.tray[2].id,ids[2]);
  g.place(2,2,0);assert.ok(g.tray.every(p=>p&&p.id>3&&g.hasFit(p)));
});
test('blocked pieces remain available while another piece can move',()=>{
  const g=fresh();g.board=g.board.map((row,y)=>row.map((_,x)=>(x+y)%2?'gold':null));
  g.tray=[piece('Little square'),piece('Little dot'),null];g.checkOver();assert.equal(g.state,'playing');assert.equal(g.hasFit(g.tray[0]),false);
  g.place(1,0,0);assert.equal(g.state,'over');assert.ok(g.tray[0]);
});
test('game ends when no remaining piece fits; further placements do nothing',()=>{
  const g=fresh();g.board.forEach(row=>row.fill('coral'));g.checkOver();assert.equal(g.state,'over');
  const before=JSON.stringify(g);assert.equal(g.place(0,0,0),null);assert.equal(JSON.stringify(g),before);
});
test('random selection handles boundary values and refill when no shape fits',()=>{
  for(const random of [()=>1,()=>-.3,()=>NaN]){const g=new Game(random);assert.ok(g.tray.every(p=>p?.cells));}
  const g=fresh();g.board.forEach(row=>row.fill('mint'));g.deal();assert.equal(g.state,'over');assert.deepEqual(g.tray,[null,null,null]);
});
test('restart resets every gameplay counter and replaces board/tray',()=>{
  const g=fresh();g.place(0,0,0);g.score=999;g.lines=8;g.streak=3;g.state='over';g.reset();
  assert.equal(g.state,'playing');assert.equal(g.score,0);assert.equal(g.lines,0);assert.equal(g.moves,0);assert.equal(g.streak,0);
  assert.ok(g.board.flat().every(v=>v===null));assert.equal(g.tray.length,3);
});
