import legacyBank from '../src/core/levels-v1.json' with {type:'json'};
import type {Level as LegacyLevel} from '../src/core/session';
const levels=legacyBank as LegacyLevel[];
import {readFileSync,writeFileSync} from 'node:fs';
import {levelGoals} from '../src/core/session';
import {goalStart} from '../src/core/goalStart';
import {walk} from '../src/core/knowledge';
import {transition,won} from '../src/core/rules';
import {solve} from '../src/core/solver';
const audit=JSON.parse(readFileSync('docs/audits/campaign-47/audit.json','utf8'));
const rows=[];
for(const row of audit.rows){
 if(!row.graph.trapWitness)continue;
 const l=levels.find(l=>l.id===row.id)!;
 const trap=walk(l,[...goalStart(l),...row.graph.trapWitness],false,levelGoals(l));
 const trapped=solve(trap.board,200000,750,trap.rules);
 const rescued=solve([...trap.board,[]],200000,750,trap.rules);
 if(trapped.status!=='UNSOLVABLE')throw Error('Trap not independently exhausted '+row.id);
 if(rescued.status==='FOUND'){
  let b=[...trap.board,[]],g=trap.rules;for(const m of rescued.path){const t=transition(b,m,g);b=t.board;g=t.rules;}if(!won(b,g))throw Error('Invalid rescue');
 }
 rows.push({stage:row.stage,id:row.id,trapDepth:row.graph.trapWitness.length,withoutAd:trapped.status,withAd:rescued.status,...(rescued.status==='FOUND'?{rescueMoves:rescued.path.length}:{}),rewardEligible:l.colors>2});
}
writeFileSync('docs/audits/campaign-47/rescue.json',JSON.stringify({method:'One earliest proved trap per complete graph, exhausted again by production DFS; append one empty rewarded slot and validate every found rescue route. Not a probability of entering a trap. All these states also have free Undo/restart available.',rows},null,2)+'\n');
console.log(rows);
