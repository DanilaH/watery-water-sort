/** Deterministic candidate selection, followed by exact independent rating proofs in a separate tool. */
import {readFileSync,writeFileSync} from 'node:fs';
import {levels,levelGoals,type Level} from '../src/core/session';
import {solve} from '../src/core/solver';
import {moves,transition,won,sealedTube,goalAt,goalList,type Board,type Move} from '../src/core/rules';
import {knowledgeView} from '../src/core/knowledge';
let seed=470071;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
function probe(l:Level,trial:number,extra=false){
 let b=l.initial.map(t=>[...t]),g=levelGoals(l),history:Move[]=[],s=trial*997+470071;const rng=()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};if(extra)b.push([]);
 const tried=new Map<string,Set<string>>();
 for(let i=0;i<100&&!won(b,g);i++){
  const view=knowledgeView(l,{board:b,history,extra},levelGoals(l)),known=new Set(view?.known);
  const key=JSON.stringify([b.map((t,j)=>t.map((c,d)=>!view||known.has(view.ids[j][d])?c:`?${view.ids[j][d]}`)),g]);const used=tried.get(key)??new Set<string>();tried.set(key,used);
  const options=moves(b,g).filter(m=>!sealedTube(b,m.from,g)&&!used.has(m.from+':'+m.to)).map(m=>{
   let visible=0;for(let d=b[m.from].length-1;d>=0&&(!view||known.has(view.ids[m.from][d]))&&b[m.from][d]===m.color;d--)visible++;
   const cosmetic=visible===b[m.from].length&&!b[m.to].length&&!goalAt(g,m.to)&&m.to!==l.mini&&m.from!==l.mini&&m.to!==l.ice&&m.from!==l.ice;
   return {m,cosmetic,score:(goalAt(g,m.to)?30:0)+(b[m.to].length?10:0)+visible*2+(visible===b[m.from].length?4:0),tie:rng()};
  }).filter(v=>!v.cosmetic).sort((a,z)=>z.score-a.score||a.tie-z.tie);
  if(!options.length)return false;const m=options[0].m;used.add(m.from+':'+m.to);const t=transition(b,m,g);b=t.board;g=t.rules;history.push(m);
 }return won(b,g);
}
// Stage, stable content index, colours, ordinary empties, max greedy wins of 12.
const specs=[[3,2,3,1,10],[5,3,3,1,8],[8,16,3,0,12],[9,4,4,1,8],[10,26,3,0,10],[13,5,4,1,7],[14,34,3,1,9],[15,35,4,1,8],[16,24,4,0,8],[19,31,4,0,10],[20,36,4,1,7],[21,25,4,0,7]];
const bank=JSON.parse(readFileSync('src/core/levels-v1.json','utf8')) as Level[],report=[];
for(const [stage,index,colors,empty,maxWins]of specs){
 const old=bank[index],gs=goalList(levelGoals(old)),prefix=gs.length+Number(old.mini!==undefined)+Number(old.ice!==undefined);let accepted=false;
 for(let tries=0;tries<20000;tries++){
  const usedSeed=seed,flat=Array.from({length:colors*4},(_,n)=>Math.floor(n/4));
  for(let j=flat.length-1;j>0;j--){const k=Math.floor(random()*(j+1));[flat[j],flat[k]]=[flat[k],flat[j]];}
  const initial:Board=[...gs.map(g=>Array(4).fill(g.color)),...(old.mini!==undefined?[[]]:[]),...(old.ice!==undefined?[[]]:[]),...Array.from({length:colors},(_,n)=>flat.slice(n*4,n*4+4)),...Array.from({length:empty},()=>[])];
  const l:Level={...old,version:2,colors,initial,seed:usedSeed,witness:[]};
  if(initial.some((t,i)=>t.length&&i>=gs.length&&sealedTube(initial,i,levelGoals(l))))continue;
  if(old.hidden)l.hidden=initial.flatMap((t,index)=>t.length>1&&index>=prefix?[{index,layers:stage===14?[0,1]:[0,1,2]}]:[]).slice(0,stage===14?2:3);
  const r=solve(initial,35000,80,levelGoals(l));if(r.status!=='FOUND'||r.path.length< (stage===8?5:stage===3?8:9)||r.path.length>40)continue;
  const wins=Array.from({length:12},(_,i)=>probe(l,i)).filter(Boolean).length;if(wins>maxWins||wins<(stage===3?8:stage===15||stage===20?3:1))continue;
  const ad=solve([...initial,[]],35000,80,levelGoals(l));if(ad.status!=='FOUND')continue;
  l.witness=r.path;bank[index]=l;report.push({stage,id:l.id,seed:usedSeed,tries,colors,tubes:initial.length,greedyWins:wins,trials:12,dfsWitness:r.path.length,adDfsWitness:ad.path.length});console.log(report.at(-1));accepted=true;break;
 }
 if(!accepted)throw Error('No acceptable candidate '+stage);
}
writeFileSync('src/core/levels.json',JSON.stringify(bank,null,2)+'\n');
writeFileSync('docs/audits/campaign-balance-47/selection.json',JSON.stringify({method:'Deterministic candidate prefilter, not human difficulty or optimality. Visible-ranked greedy bots use no solver or Undo. Exact routes and broader independent probes follow separately.',rows:report},null,2)+'\n');
