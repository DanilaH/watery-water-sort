import {extraCount,shuffledState,type Shuffle} from './assist';
import {walk} from './knowledge';
import {clone,goalAt,isFrozen,sealedTube,type Goals} from './rules';
import {solve} from './solver';
import type {Level,Attempt} from './session';
/** Bounded work, intended for a Worker. Only an independently replayable winning route is returned. */
export function generateShuffle(l:Level,a:Attempt,rules:Goals|undefined,seed:number,maxMs=1600):Shuffle|undefined{
 const current=walk(l,a.history,extraCount(a),undefinedRules(l),a.shuffles),fixed=a.board.map((_,i)=>!!goalAt(rules,i)||isFrozen(rules,i)||sealedTube(a.board,i,rules));
 const pool=current.ids.flatMap((ids,i)=>fixed[i]?[]:ids.map((id,d)=>({id,color:a.board[i][d]})));
 if(pool.length<2)return;
 const start=performance.now(),random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 for(let trial=0;trial<80&&performance.now()-start<maxMs;trial++){
  const units=[...pool];for(let i=units.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[units[i],units[j]]=[units[j],units[i]];}
  const board=clone(a.board),ids=current.ids.map(t=>[...t]);let cursor=0;
  board.forEach((t,i)=>{if(fixed[i])return;for(let d=0;d<t.length;d++){t[d]=units[cursor].color;ids[i][d]=units[cursor++].id;}});
  if(JSON.stringify(board)===JSON.stringify(a.board)||board.some((_,i)=>!fixed[i]&&sealedTube(board,i,rules)))continue;
  const result=solve(board,40000,Math.max(1,Math.min(70,maxMs-(performance.now()-start))),rules);
  if(result.status!=='FOUND'||!result.path.length||result.path.length>512)continue;
  const event={at:a.history.length,board,ids,path:result.path};shuffledState(a.board,current.ids,rules,event);return event;
 }
}
// Keep this module independent from the runtime session/economy cycle.
function undefinedRules(l:Level):Goals|undefined{return l.mini===undefined&&l.ice===undefined?l.goals??l.goal:{goals:l.goals??(l.goal?[l.goal]:[]),...(l.mini!==undefined?{mini:l.mini}:{}),...(l.ice!==undefined?{ice:l.ice,thawed:false}:{})};}
