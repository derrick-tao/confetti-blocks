export const SIZE = 8;
const shape = (name, rows) => ({name, cells:rows.flatMap((row,y)=>[...row].flatMap((cell,x)=>cell === '#' ? [[x,y]] : []))});
export const SHAPES = [
  shape('Little dot',['#']),
  shape('Two across',['##']), shape('Two down',['#','#']),
  shape('Three across',['###']), shape('Three down',['#','#','#']),
  shape('Four across',['####']), shape('Four down',['#','#','#','#']),
  shape('Five across',['#####']), shape('Five down',['#','#','#','#','#']),
  shape('Little square',['##','##']), shape('Big square',['###','###','###']),
  shape('Wide rectangle',['###','###']), shape('Tall rectangle',['##','##','##']),
  shape('Little corner right',['#.','##']), shape('Little corner left',['.#','##']),
  shape('Little corner up',['##','#.']), shape('Little corner down',['##','.#']),
  shape('Big corner right',['#..','#..','###']), shape('Big corner left',['..#','..#','###']),
  shape('Big corner up',['###','#..','#..']), shape('Big corner down',['###','..#','..#']),
  shape('T up',['###','.#.']), shape('T down',['.#.','###']),
  shape('T right',['#.','##','#.']), shape('T left',['.#','##','.#']),
  shape('Zigzag right',['.##','##.']), shape('Zigzag left',['##.','.##'])
];
export const COLORS = ['coral','gold','mint','sky','violet','pink'];
export function dimensions(piece) {
  return {w:Math.max(...piece.cells.map(([x])=>x))+1,h:Math.max(...piece.cells.map(([,y])=>y))+1};
}
export class Game {
  constructor(random = Math.random) { this.random=random; this.reset(); this.state='ready'; }
  reset() {
    this.board=Array.from({length:SIZE},()=>Array(SIZE).fill(null));
    this.score=0;this.lines=0;this.moves=0;this.streak=0;this.state='playing';this.serial=0;
    this.deal();
  }
  randomIndex(length) { return Math.max(0,Math.min(length-1,Math.floor((Number(this.random()) || 0)*length))); }
  canPlace(piece,x,y) {
    return !!piece && Number.isInteger(x) && Number.isInteger(y) && piece.cells.every(([dx,dy])=>{
      const col=x+dx,row=y+dy;
      return col>=0 && col<SIZE && row>=0 && row<SIZE && !this.board[row][col];
    });
  }
  hasFit(piece) {
    if(!piece)return false;
    for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++)if(this.canPlace(piece,x,y))return true;
    return false;
  }
  deal() {
    const pool=SHAPES.filter(piece=>this.hasFit(piece));
    this.tray=pool.length ? Array.from({length:3},()=>({...pool[this.randomIndex(pool.length)],color:COLORS[this.randomIndex(COLORS.length)],id:++this.serial})) : [null,null,null];
    this.checkOver();
  }
  checkOver() { if(!this.tray.some(piece=>this.hasFit(piece)))this.state='over'; }
  fullLines(board=this.board) {
    const rows=[],cols=[];
    for(let i=0;i<SIZE;i++){
      if(board[i].every(Boolean))rows.push(i);
      if(board.every(row=>row[i]))cols.push(i);
    }
    const keys=new Set();
    rows.forEach(y=>{for(let x=0;x<SIZE;x++)keys.add(y*SIZE+x);});
    cols.forEach(x=>{for(let y=0;y<SIZE;y++)keys.add(y*SIZE+x);});
    return {rows,cols,cleared:[...keys].map(key=>[key%SIZE,Math.floor(key/SIZE)])};
  }
  preview(slot,x,y) {
    const piece=this.tray[slot];
    if(!this.canPlace(piece,x,y))return null;
    const board=this.board.map(row=>[...row]);
    piece.cells.forEach(([dx,dy])=>board[y+dy][x+dx]=piece.color);
    return this.fullLines(board);
  }
  place(slot,x,y) {
    const piece=this.tray[slot];
    if(this.state!=='playing' || !this.canPlace(piece,x,y))return null;
    const placed=piece.cells.map(([dx,dy])=>[x+dx,y+dy]);
    placed.forEach(([col,row])=>this.board[row][col]=piece.color);
    const result=this.fullLines(),count=result.rows.length+result.cols.length;
    const clearedTiles=result.cleared.map(([col,row])=>({x:col,y:row,color:this.board[row][col]}));
    result.cleared.forEach(([col,row])=>this.board[row][col]=null);
    this.streak=count ? this.streak+1 : 0;
    const perfect=count>0 && this.board.every(row=>row.every(cell=>!cell));
    const points=piece.cells.length*10+100*count*count*this.streak+(perfect?500:0);
    this.score+=points;this.lines+=count;this.moves++;
    this.tray[slot]=null;
    if(this.tray.every(piece=>!piece))this.deal();else this.checkOver();
    return {...result,clearedTiles,placed,count,points,perfect,streak:this.streak};
  }
}
