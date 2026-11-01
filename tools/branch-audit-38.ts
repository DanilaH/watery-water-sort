import proof from '../docs/audits/campaign-39/optimal.json' with {type:'json'};
import {mkdirSync,writeFileSync} from 'node:fs';
import {levels,fresh,moved,undone,expanded,attempt,goalFor,knowledgeFor,validSave,levelKey,offerExtra,type Save} from '../src/core/session';
import {moves,won,type Move} from '../src/core/rules';import {solve} from '../src/core/solver';import {stars} from '../src/core/ratings';import {stageNumber} from '../src/core/campaign';
const rows:any[]=[];let seed=380013;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
for(let i=0;i<levels.length;i++)for(const extra of [false,true]){
 const l=levels[i],path=proof.find(r=>r.level===i&&!!r.extra===extra)!.path;for(const prefix of [...new Set([0,Math.floor(path.length/2),path.length-1])]){
  let base={...fresh(),current:i};if(extra)base=expanded(base);for(const m of path.slice(0,prefix))base=moved(base,m);
  const alternatives=moves(attempt(base).board,goalFor(base)).filter(m=>JSON.stringify(m)!==JSON.stringify(path[prefix]));
  for(let k=alternatives.length-1;k>0;k--){const n=Math.floor(random()*(k+1));[alternatives[k],alternatives[n]]=[alternatives[n],alternatives[k]];}
  for(const m of alternatives.slice(0,4)){
   let changed=moved(base,m);if(!validSave(JSON.parse(JSON.stringify(changed))))throw Error('Branch save');const r=solve(attempt(changed).board,25000,100,goalFor(changed));const canReward=offerExtra(changed)&&!won(attempt(changed).board,goalFor(changed));let rescue:ReturnType<typeof solve>|undefined;
   if(canReward){const buffered=expanded(changed);rescue=solve(attempt(buffered).board,25000,100,goalFor(buffered));}
   // Undo works even after an accepted bad route or an ad that arrives after that route.
   const retained=[...(attempt(changed).known??[])];if(!extra&&canReward)changed=expanded(changed);let recovered=undone(changed);
   if(JSON.stringify(attempt(recovered).board)!==JSON.stringify([...attempt(base).board,...(!extra&&attempt(changed).extra?[[]]:[])])||!retained.every(id=>attempt(recovered).known?.includes(id)))throw Error('Undo loss');
   for(const next of path.slice(prefix))recovered=moved(recovered,next);
   if(!won(attempt(recovered).board,goalFor(recovered))||!validSave(recovered)||stars(levelKey(i),attempt(recovered).history.length)!==3)throw Error('Lost three-star recovery');
   rows.push({id:l.id,stage:stageNumber(i),extra,prefix,move:m,status:r.status,nodes:r.nodes,...(r.status==='FOUND'?{verifiedContinuation:r.path.length}:{}),extraRescue:rescue?.status,extraRescueNodes:rescue?.nodes,undoAndThreeStars:true});
  }
 }
}
const counts=(key:string)=>Object.fromEntries(['FOUND','UNKNOWN','UNSOLVABLE'].map(status=>[status,rows.filter(r=>r[key]===status).length]));
const summary={branches:rows.length,status:counts('status'),bufferTrials:rows.filter(r=>r.extraRescue).length,bufferStatus:counts('extraRescue'),provedTrapsRescued:rows.filter(r=>r.status==='UNSOLVABLE'&&r.extraRescue==='FOUND').length,allUndoRecoveriesThreeStars:rows.every(r=>r.undoAndThreeStars)};
const out=process.argv[2]??'docs/audits/scenario-38/branches.json';mkdirSync(out.slice(0,out.lastIndexOf('/')),{recursive:true});writeFileSync(out,JSON.stringify({method:'Deterministic sample of up to four off-witness legal moves at three optimal-path prefixes, both physical buffer configurations. Alternative moves are not presumed mistakes. DFS budget 25000 nodes / 100ms; UNKNOWN is not a dead end. Reward trials only on non-winning boards where the real offerExtra predicate allows it. No real ad/phone/human tested.',seed:380013,summary,rows},null,2)+'\n');console.log(JSON.stringify(summary,null,2));
