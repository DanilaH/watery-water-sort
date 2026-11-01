import {transition,won,type Board,type Goals,type Move} from './rules';
const fingerprint=(board:Board,rules?:Goals)=>JSON.stringify([board,rules]);
const same=(a:Move,b:Move)=>a.from===b.from&&a.to===b.to&&a.color===b.color&&a.amount===b.amount;
/** Keep the verified remainder while the player follows it. Fresh DFS on every step can reverse its own advice. */
export class HintRoute{
 private key='';private path:Move[]=[];private index=0;
 clear(){this.key='';this.path=[];this.index=0;}
 get(board:Board,rules?:Goals){const m=this.key===fingerprint(board,rules)?this.path[this.index]:undefined;return m?{...m}:undefined;}
 set(board:Board,rules:Goals|undefined,path:Move[]){
  // A route is advisory, never authoritative state. Reject malformed/non-winning paths.
  let current={board,rules};try{for(const m of path)current=transition(current.board,m,current.rules);if(!won(current.board,current.rules))return false;}catch{return false;}
  this.key=fingerprint(board,rules);this.path=path.map(m=>({...m}));this.index=0;return true;
 }
 accepted(before:Board,m:Move,rules?:Goals){
  const next=this.get(before,rules);if(!next||!same(next,m)){this.clear();return;}
  const result=transition(before,m,rules);this.index++;this.key=fingerprint(result.board,result.rules);
  if(this.index>=this.path.length)this.clear();
 }
}
