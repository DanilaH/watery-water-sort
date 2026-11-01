/** Reproducible candidate selection. Exact optima are established separately. */
import {readFileSync,writeFileSync} from 'node:fs';
import {solve} from '../src/core/solver';
import {validBoard,won,transition,sealedTube,goalList,type Board} from '../src/core/rules';
import {levelGoals,type Level} from '../src/core/session';
import {HintRoute} from '../src/core/hintRoute';
import {walk,knowledgeView,hasUnknown,validMask} from '../src/core/knowledge';
import {visibleHint} from '../src/core/visibleHint';
const file='src/core/levels.json',old:Level[]=JSON.parse(readFileSync(file,'utf8')).slice(0,40);
let seed=390041;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
const specs=[
 [4,0,0,0,0],[4,1,0,0,0],[4,0,1,0,0],[4,0,0,0,1],[4,0,0,1,0],
 [3,2,0,0,0],[4,1,1,0,0],[4,0,0,1,1],[6,0,0,0,0],[4,0,1,0,1],
 [3,2,1,0,0],[4,1,0,1,0],[4,0,0,0,0],[5,1,0,0,1],[4,0,1,1,0],
 [4,2,0,0,1],[5,0,0,1,0],[4,1,1,0,1],[7,0,0,0,0],[4,2,0,1,1],
];
// Physical duplicate check ignores cosmetic colour IDs, ordinary slot order and masks.
function identity(l:Level){
 const gs=goalList(levelGoals(l)),fixed=gs.length+Number(l.mini!==undefined)+Number(l.ice!==undefined),colors=[...new Set(l.initial.flat())].sort((a,b)=>a-b);let best='~';
 function visit(order:number[],rest:number[]){if(rest.length){for(const c of rest)visit([...order,c],rest.filter(n=>n!==c));return;}
  const rename=new Map(order.map((c,i)=>[c,i])),ts=l.initial.map(t=>t.map(c=>rename.get(c)).join(''));
  const k=JSON.stringify([gs.map(g=>rename.get(g.color)),l.mini!==undefined,l.ice!==undefined,ts.slice(0,fixed),ts.slice(fixed).sort()]);if(k<best)best=k;
 }visit([],colors);return best;
}
const keys=new Set(old.map(identity)),added:Level[]=[];
function repeatedHints(l:Level,extra:boolean){
 let board:Board=[...l.initial.map(t=>[...t]),...(extra?[[]]:[])],rules=levelGoals(l),history:any[]=[],known:number[]=[],route=new HintRoute();const seen=new Map<string,number>();
 for(let step=0;step<120&&!won(board,rules);step++){
  const k=JSON.stringify([board,rules,known]),n=(seen.get(k)??0)+1;seen.set(k,n);if(n>3)return false;
  const view=knowledgeView(l,{board,history,extra,...(l.hidden?{known}:{})},levelGoals(l));let m=route.get(board,rules);
  if(!m){if(hasUnknown(view))m=visibleHint(board,view!,rules)??undefined;else{const r=solve(board,200000,750,rules);if(r.status!=='FOUND')return false;route.set(board,rules,r.path);m=r.path[0];}}
  if(!m)return false;route.accepted(board,m,rules);const next=transition(board,m,rules);board=next.board;rules=next.rules;history.push(m);if(l.hidden)known=[...new Set([...known,...walk(l,history,extra,levelGoals(l)).learned])];
 }return won(board,rules);
}
for(const [offset,spec]of specs.entries()){
 const [colors,ng,mini,ice,hidden]=spec,id='water-'+String(41+offset).padStart(3,'0');let accepted=false;
 for(let tries=0;tries<600&&!accepted;tries++){
  const usedSeed=seed,flat=Array.from({length:colors*4+ng*4},(_,n)=>n<colors*4?Math.floor(n/4):Math.floor((n-colors*4)/4));
  for(let j=flat.length-1;j>0;j--){const k=Math.floor(random()*(j+1));[flat[j],flat[k]]=[flat[k],flat[j]];}
  const prefix=ng+mini+ice,empty=mini?0:ng?1:2;
  const initial:Board=[...Array.from({length:prefix},()=>[]),...Array.from({length:flat.length/4},(_,n)=>flat.slice(n*4,n*4+4)),...Array.from({length:empty},()=>[])];
  const goals=Array.from({length:ng},(_,i)=>({index:i,color:i,capacity:8 as const}));
  const l:Level={id,version:1,colors,initial,witness:[],seed:usedSeed,...(ng===1?{goal:goals[0]}:ng?{goals}:{}),...(mini?{mini:ng}:{}),...(ice?{ice:ng+mini}:{})};
  if(!validBoard(initial,levelGoals(l))||initial.some((t,i)=>t.length&&sealedTube(initial,i,levelGoals(l))))continue;
  if(hidden)l.hidden=initial.flatMap((t,index)=>t.length>1&&index>=prefix?[{index,layers:offset%2?[0,1]:[1,2]}]:[]).slice(0,offset===19?3:2);
  if(!validMask(l))throw Error('Mask');
  const r=solve(initial,35000,120,levelGoals(l));if(r.status!=='FOUND'||r.path.length>48)continue;
  let board=initial,rules=levelGoals(l);for(const m of r.path){const n=transition(board,m,rules);board=n.board;rules=n.rules;}if(!won(board,rules))throw Error('Witness');l.witness=r.path;
  if(!repeatedHints(l,false)||!repeatedHints(l,true))continue;
  const key=identity(l);if(keys.has(key))continue;keys.add(key);added.push(l);accepted=true;console.log(id,spec.join('/'),tries,'witness',r.path.length);
 }
 if(!accepted)throw Error('Candidate budget '+id);
}
writeFileSync(file,JSON.stringify([...old,...added],null,2)+'\n');
const order=JSON.parse(readFileSync('src/core/campaign.json','utf8')).slice(0,40);writeFileSync('src/core/campaign.json',JSON.stringify([...order,...added.map(l=>l.id)],null,2)+'\n');
