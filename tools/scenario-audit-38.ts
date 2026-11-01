import {HintRoute} from '../src/core/hintRoute';
import {writeFileSync,mkdirSync} from 'node:fs';
import {levels,fresh,moved,undone,restarted,expanded,attempt,goalFor,knowledgeFor,validSave,levelKey,levelGoals,type Save} from '../src/core/session';
import {moves,won,sealedTube,goalAt,capacityAt,type Move} from '../src/core/rules';
import {solve} from '../src/core/solver';
import {hasUnknown} from '../src/core/knowledge';
import {visibleHint} from '../src/core/visibleHint';
import {stageNumber} from '../src/core/campaign';
const fixed=process.argv.includes('--fixed');
const out=process.argv.slice(2).find(a=>a!=='--fixed')??`docs/audits/scenario-38/${fixed?'fixed':'baseline'}.json`;
let seed=380013;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
const key=(s:Save)=>JSON.stringify([attempt(s).board,attempt(s).thawed,attempt(s).known]);
const rows:any[]=[];
for(let index=0;index<levels.length;index++)for(const extra of [false,true]){
 const l=levels[index];
 for(const policy of ['witness','hint-repeat','greedy','random-undo-reload']){
  const route=new HintRoute();let s={...fresh(),current:index};if(extra)s=expanded(s);let actions=0,undos=0,hints=0,unknown=0,dead=0,loop=0;const seen=new Map<string,number>();let maxHistory=0;const start=performance.now();
  if(policy==='witness'){
   for(const m of l.witness){s=moved(s,m);if(!validSave(s))throw Error('Invalid durable witness '+l.id);actions++;}
  }else for(let step=0;step<160&&!won(attempt(s).board,goalFor(s));step++){
   const k=key(s),n=(seen.get(k)??0)+1;seen.set(k,n);if(n>3){loop++;break;}
   const b=attempt(s).board,g=goalFor(s),view=knowledgeFor(s);let m:Move|null=null;
   if(policy==='hint-repeat'){
    hints++;if(fixed&&route.get(b,g))m=route.get(b,g)!;else if(hasUnknown(view))m=visibleHint(b,view!,g);else{const r=solve(b,200000,750,g);if(r.status==='FOUND'){m=r.path[0]??null;if(fixed)route.set(b,g,r.path);}else if(r.status==='UNKNOWN'){unknown++;break;}else dead++;}
   }else{
    const ms=moves(b,g);if(policy==='greedy'){
     ms.sort((a,z)=>{const score=(m:Move)=>{let visible=0;for(let d=b[m.from].length-1;d>=0&&(!view||view.known.includes(view.ids[m.from][d]))&&b[m.from][d]===b[m.from].at(-1);d--)visible++;return Number(!!goalAt(g,m.to))*30+Number(b[m.to].length>0)*8+Math.min(visible,capacityAt(g,m.to)-b[m.to].length)*2-Number(sealedTube(b,m.from,g))*40;};return score(z)-score(a);});m=ms[0]??null;
    }else m=ms[Math.floor(random()*ms.length)]??null;
   }
   if(!m){dead++;if(policy==='random-undo-reload'&&attempt(s).history.length){s=undone(s);undos++;continue;}break;}
   if(fixed)route.accepted(b,m,g);s=moved(s,m);actions++;maxHistory=Math.max(maxHistory,attempt(s).history.length);
   if(policy==='random-undo-reload'&&step%7===6){const before=structuredClone(attempt(s));s=undone(s);undos++;if(attempt(s).history.length!==before.history.length-1)throw Error('Undo count');s=moved(s,m);actions++;const reloaded=JSON.parse(JSON.stringify(s));if(!validSave(reloaded))throw Error('Reload validation');s=reloaded;}
   if(!validSave(s))throw Error('Invalid exploratory save '+l.id);
  }
  const finished=won(attempt(s).board,goalFor(s));
  // Every bad route must remain recoverable by free Undo, retaining learned information and entitlement.
  const known=[...(attempt(s).known??[])];while(attempt(s).history.length)s=undone(s);
  if(!validSave(s)||JSON.stringify(attempt(s).board)!==JSON.stringify([...l.initial,...(extra?[[]]:[])])||!known.every(id=>attempt(s).known?.includes(id)))throw Error('Broken recovery '+l.id);
  s=restarted(s);if(attempt(s).extra!==extra||!validSave(s))throw Error('Broken restart '+l.id);
  rows.push({id:l.id,stage:stageNumber(index),extra,policy,finished,actions,undos,hints,unknown,dead,loop,maxHistory,elapsedMs:Math.round((performance.now()-start)*100)/100});
 }
}
const summary=Object.fromEntries(['witness','hint-repeat','greedy','random-undo-reload'].map(policy=>{const rs=rows.filter(r=>r.policy===policy);return [policy,{runs:rs.length,finished:rs.filter(r=>r.finished).length,loops:rs.filter(r=>r.loop).length,unknown:rs.filter(r=>r.unknown).length,dead:rs.filter(r=>r.dead).length}];}));
mkdirSync(out.slice(0,out.lastIndexOf('/')),{recursive:true});writeFileSync(out,JSON.stringify({method:'Deterministic structural probes; not human difficulty or retention. 160-step and three-repeat caps (a random policy can escape repeats, so its repeat cutoff is not proof of a permanent loop). Greedy rankings use visible runs when masks remain. UI hint budget 200000 nodes / 750ms. Extra slot is simulated entitlement, not a real ad; six two-colour extra configurations are deliberately hypothetical because the UI does not offer them.',seed:380013,summary,rows},null,2)+'\n');console.log(JSON.stringify(summary,null,2));
