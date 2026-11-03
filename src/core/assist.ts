import {clone,validBoard,sealedTube,goalAt,isFrozen,transition,won,type Board,type Goals,type Move} from './rules';
export type Shuffle={at:number;board:Board;ids:number[][];path:Move[]};
export const extraCount=(a:{extra:boolean;extras?:number})=>a.extras??Number(a.extra);
export const validExtras=(a:{extra:boolean;extras?:number})=>a.extras===undefined||a.extra&&Number.isInteger(a.extras)&&a.extras>=2&&a.extras<=3;
export const extraFields=(count:number)=>({extra:count>0,...(count>1?{extras:count}:{})});
export const scoreMoves=(a:{history:Move[];shuffles?:Shuffle[]})=>a.history.length+(a.shuffles?.length??0);
export function shuffledState(board:Board,ids:number[][],rules:Goals|undefined,event:Shuffle){
 if(!Array.isArray(event.board)||!Array.isArray(event.ids)||event.board.length!==event.ids.length||event.board.length>board.length||!Array.isArray(event.path)||event.path.length>512)throw Error('Invalid shuffle');
 const next=clone(event.board),units=event.ids.map(t=>[...t]);while(next.length<board.length){next.push([]);units.push([]);}
 if(!validBoard(next,rules)||JSON.stringify(next)===JSON.stringify(board))throw Error('Invalid shuffle board');
 const original=new Map(ids.flatMap((t,i)=>t.map((id,d)=>[id,board[i][d]] as const))),seen=new Set<number>();
 for(let i=0;i<board.length;i++){
  if(next[i].length!==board[i].length||units[i].length!==next[i].length)throw Error('Changed vessel fill');
  const fixed=!!goalAt(rules,i)||isFrozen(rules,i)||sealedTube(board,i,rules);
  if(fixed&&(JSON.stringify(next[i])!==JSON.stringify(board[i])||JSON.stringify(units[i])!==JSON.stringify(ids[i])))throw Error('Changed protected vessel');
  if(!fixed&&sealedTube(next,i,rules))throw Error('Shuffle cannot complete a colour');
  for(let d=0;d<units[i].length;d++){const id=units[i][d];if(!Number.isInteger(id)||seen.has(id)||!original.has(id)||original.get(id)!==next[i][d])throw Error('Changed unit identity');seen.add(id);}
 }
 if(seen.size!==original.size)throw Error('Lost units');
 let b=next,g=rules;for(const m of event.path){const n=transition(b,m,g);b=n.board;g=n.rules;}if(!won(b,g))throw Error('Unproved shuffle');
 return {board:next,ids:units};
}
