import {extraCount,shuffledState,type Shuffle} from './assist';
import {clone,transition,sealedTube,type Board,type Goals,type Move} from './rules';
import type {Level,Attempt} from './session';
export type KnowledgeView={level:string;ids:number[][];known:number[];masked:number[]};
export const maskedIds=(l:Level)=>new Set((l.hidden??[]).flatMap(m=>m.layers.map(d=>m.index*8+d)));
export function validMask(l:Level){
 const masks=l.hidden;if(masks===undefined)return true;
 if(!Array.isArray(masks)||!masks.length)return false;const seen=new Set<number>();
 return masks.every(m=>Number.isInteger(m.index)&&m.index>=0&&m.index<l.initial.length&&Array.isArray(m.layers)&&m.layers.length>0&&m.layers.every(d=>{const id=m.index*8+d;if(!Number.isInteger(d)||d<0||d>=l.initial[m.index].length-1||seen.has(id))return false;seen.add(id);return true;}));
}
/** Units retain their original identities through pours and Undo; memory follows units, not slots. */
export function walk(l:Level,history:Move[],extra:boolean|number,rules?:Goals,shuffles:Shuffle[]=[]){
 let board:Board=clone(l.initial);let ids=l.initial.map((t,i)=>t.map((_,d)=>i*8+d)),masked=maskedIds(l),learned=new Set<number>();
 for(let i=0;i<Number(extra);i++){board.push([]);ids.push([]);}
 const learn=(id:number|undefined)=>{if(id!==undefined&&masked.has(id))learned.add(id);};
 if(shuffles.length>64||shuffles.some((e,i)=>!Number.isInteger(e.at)||e.at<0||e.at>history.length||i>0&&e.at<shuffles[i-1].at))throw Error('Invalid shuffle chronology');
 let eventIndex=0;
 const shuffleAt=(at:number)=>{while(shuffles[eventIndex]?.at===at){const e=shuffles[eventIndex++];if(e.board.length<l.initial.length)throw Error('Missing vessels');const n=shuffledState(board,ids,rules,e);board=n.board;ids=n.ids;ids.forEach(t=>learn(t.at(-1)));}};
 for(let i=0;i<history.length;i++){shuffleAt(i);const m=history[i];
  const next=transition(board,m,rules),units=ids[m.from].splice(-m.amount);ids[m.to].push(...units);if(masked.size){units.forEach(learn);learn(ids[m.from].at(-1));
  next.board.forEach((_,i)=>{if(sealedTube(next.board,i,next.rules))ids[i].forEach(learn);});}board=next.board;rules=next.rules;
 }
 shuffleAt(history.length);
 return {board,rules,ids,learned:[...learned].sort((a,b)=>a-b)};
}
export function validKnowledge(l:Level,known:unknown,minimum:number[]){
 if(!l.hidden)return known===undefined;
 const values=known===undefined?[]:known,mask=maskedIds(l);
 return Array.isArray(values)&&new Set(values).size===values.length&&values.every(id=>Number.isInteger(id)&&mask.has(id))&&minimum.every(id=>values.includes(id));
}
export function knowledgeView(l:Level,a:Attempt,rules?:Goals):KnowledgeView|undefined{
 if(!l.hidden)return undefined;
 const result=walk(l,a.history,extraCount(a),rules,a.shuffles),masked=maskedIds(l),known=new Set(result.ids.flat().filter(id=>!masked.has(id)));
 for(const id of [...(a.known??[]),...result.learned])known.add(id);
 return {level:l.id+'@'+l.version,ids:result.ids,known:[...known].sort((a,b)=>a-b),masked:[...masked].sort((a,b)=>a-b)};
}
export const hasUnknown=(v:KnowledgeView|undefined)=>!!v&&v.masked.some(id=>!v.known.includes(id));
