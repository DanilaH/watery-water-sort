/** Rebuild the campaign from the archived bank. Exact ratings are generated separately. */
import {readFileSync,writeFileSync} from 'node:fs';
import {solve} from '../src/core/solver';
import {levelGoals,type Level} from '../src/core/session';
import {goalList,moves,transition,won,sealedTube,goalAt,validBoard,type Board,type Move} from '../src/core/rules';
import {knowledgeView,validMask} from '../src/core/knowledge';

function random(seed:number){return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
function probe(l:Level,trial:number,extra=false){
 let b=l.initial.map(t=>[...t]),g=levelGoals(l);const history:Move[]=[];if(extra)b.push([]);
 const rng=random(540071+trial*997),tried=new Map<string,Set<string>>();
 for(let i=0;i<140&&!won(b,g);i++){
  const view=knowledgeView(l,{board:b,history,extra},levelGoals(l)),known=new Set(view?.known);
  const key=JSON.stringify([b.map((t,j)=>t.map((c,d)=>!view||known.has(view.ids[j][d])?c:'?'+view.ids[j][d])),g]);
  const used=tried.get(key)??new Set<string>();tried.set(key,used);
  const options=moves(b,g).filter(m=>!sealedTube(b,m.from,g)&&!used.has(m.from+':'+m.to)).map(m=>{
   let visible=0;for(let d=b[m.from].length-1;d>=0&&(!view||known.has(view.ids[m.from][d]))&&b[m.from][d]===m.color;d--)visible++;
   const cosmetic=visible===b[m.from].length&&!b[m.to].length&&!goalAt(g,m.to)&&m.to!==l.mini&&m.from!==l.mini&&m.to!==l.ice&&m.from!==l.ice;
   return {m,cosmetic,score:(goalAt(g,m.to)?30:0)+(b[m.to].length?10:0)+visible*2+(visible===b[m.from].length?4:0),tie:rng()};
  }).filter(v=>!v.cosmetic).sort((a,z)=>z.score-a.score||a.tie-z.tie);
  if(!options.length)return false;const m=options[0].m;used.add(m.from+':'+m.to);const t=transition(b,m,g);b=t.board;g=t.rules;history.push(m);
 }return won(b,g);
}
const wins=(l:Level,extra=false)=>Array.from({length:24},(_,i)=>probe(l,i,extra)).filter(Boolean).length;
const read=(p:string)=>JSON.parse(readFileSync(p,'utf8'));
const write=(p:string,v:unknown)=>writeFileSync(p,JSON.stringify(v,null,2)+'\n');
const old=read('src/core/levels-v47.json') as Level[],order=read('src/core/campaign.json').slice(0,60) as string[];
const bank=structuredClone(old),rows:unknown[]=[];let seed=540071;
const rng=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
const keep=new Set([1,2,3,4,6,7,11,12,16,21]);
const mechanics=['plain','hidden','goal','mini','ice','goal-hidden','plain','mini-hidden','dual','ice-hidden'];
for(let stage=1;stage<=100;stage++){
 const index=stage<=60?old.findIndex(l=>l.id===order[stage-1]):stage-1,previous=old[index];
 if(keep.has(stage)){rows.push({stage,id:previous.id,changed:false});continue;}
 const kind=stage<=60?'':mechanics[(stage-61)%10];
 const ng=previous?goalList(levelGoals(previous)).length:kind==='dual'?2:Number(kind.startsWith('goal'));
 const mini=previous?previous.mini!==undefined:kind.startsWith('mini'),ice=previous?previous.ice!==undefined:kind.startsWith('ice');
 const hidden=previous?!!previous.hidden:kind.includes('hidden'),relief=stage>=22&&stage%5===2;
 const colors=stage<=10?(stage===5?3:4):stage<=14?4:stage<=21?(stage===18?6:5):Math.min(ng===2?6:7,(stage<35?5:stage<61?6:7)-Number(relief));
 const empty=ng?Number(ice):1,maxWins=stage<=10?14:stage<=14?12:stage<=21?8:relief?10:stage<=40?6:4;
 let accepted=false;
 for(let tries=0;tries<6000;tries++){
  const usedSeed=seed,flat=Array.from({length:colors*4},(_,n)=>Math.floor(n/4));
  for(let j=flat.length-1;j>0;j--){const k=Math.floor(rng()*(j+1));[flat[j],flat[k]]=[flat[k],flat[j]];}
  const goals=Array.from({length:ng},(_,i)=>({index:i,color:i,capacity:8 as const})),prefix=ng+Number(mini)+Number(ice);
  const initial:Board=[...goals.map(g=>Array(4).fill(g.color)),...Array.from({length:Number(mini)+Number(ice)},()=>[]),...Array.from({length:colors},(_,i)=>flat.slice(i*4,i*4+4)),...Array.from({length:empty},()=>[])];
  const l:Level={id:previous?.id??'water-'+String(stage).padStart(3,'0'),version:previous?previous.version+1:1,colors,seed:usedSeed,initial,witness:[],...(ng===1?{goal:goals[0]}:ng?{goals}:{}),...(mini?{mini:ng}:{}),...(ice?{ice:ng+Number(mini)}:{})};
  if(hidden)l.hidden=initial.flatMap((t,index)=>t.length>1&&index>=prefix?[{index,layers:[0,1]}]:[]).slice(0,stage<22?2:3);
  const rules=levelGoals(l);
  if(initial.length>10||!validBoard(initial,rules)||!validMask(l)||initial.some((t,i)=>i>=prefix&&t.length&&sealedTube(initial,i,rules)))continue;
  const runs=initial.slice(prefix).reduce((n,t)=>n+t.filter((c,i)=>!i||c!==t[i-1]).length,0);if(runs<colors*(mini&&stage<=21?2:2.8))continue;
  const solution=solve(initial,45000,Infinity,rules);if(solution.status!=='FOUND'||solution.path.length>100)continue;
  const greedy=wins(l);if(greedy>maxWins)continue;
  l.witness=solution.path;bank[index]=l;if(stage>60)order.push(l.id);
  const row={stage,id:l.id,changed:true,seed:usedSeed,tries,colors,tubes:initial.length,greedyWins:greedy,withExtraWins:wins(l,true),trials:24,relief};
  rows.push(row);console.log(JSON.stringify(row));accepted=true;break;
 }
 if(!accepted)throw Error('No acceptable candidate at stage '+stage);
}
write('src/core/levels.json',bank);write('src/core/campaign.json',order);
write('docs/audits/campaign-54/selection.json',{seed:540071,method:'24 visible greedy trials per layout; no lookahead, Undo or boosters. Extra-buffer trials use one additional empty vessel. Not human win rates.',rows});
