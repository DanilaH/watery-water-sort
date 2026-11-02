/** Exact A* on the new start, followed by an independent no-shorter-path proof. */
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';import {join} from 'node:path';import {execFileSync} from 'node:child_process';
import {levels,levelGoals} from '../src/core/session';import {goalStart} from '../src/core/goalStart';import {goalList,transition} from '../src/core/rules';
const temporary=mkdtempSync(join(tmpdir(),'goal-start-'));
try{
 const bank=levels.map(l=>{let b=l.initial;const setup=goalStart(l);for(const m of setup)b=transition(b,m,levelGoals(l)).board;return {...l,initial:b,setup:setup.length};});
 const bankFile=join(temporary,'levels.json'),binary=join(temporary,'optimal'),proofFile=join(temporary,'optimal.jsonl');writeFileSync(bankFile,JSON.stringify(bank));
 execFileSync('g++',['-O3','-std=c++17','tools/optimal-levels.cpp','-o',binary]);
 const input=bank.flatMap((l,i)=>[0,1].map(extra=>{const gs=goalList(levelGoals(l));return [i,extra,l.initial.length+extra,l.colors,gs.length,Number(l.mini!==undefined),Number(l.ice!==undefined),...gs.map(g=>g.color),...[...l.initial,...(extra?[[]]:[])].map(t=>t.reduce((v,c)=>(v<<3)|c,1))].join(' ');})).join('\n')+'\n';
 const rows=execFileSync(binary,[],{input,encoding:'utf8',maxBuffer:16*1024*1024}).trim().split('\n').map(s=>JSON.parse(s));
 for(const row of rows){row.setup=bank[row.level].setup;}
 writeFileSync(proofFile,rows.map(r=>JSON.stringify(r)).join('\n')+'\n');
 process.stdout.write(execFileSync('python3',['tools/verify-optimal.py',proofFile,'--levels',bankFile,'--proof-output','docs/audits/visual-goals-44/optimal.json'],{encoding:'utf8',maxBuffer:16*1024*1024}));
 const legacy=JSON.parse(readFileSync('docs/audits/campaign-39/optimal.json','utf8'));for(const r of rows){if(legacy.find((v:any)=>v.level===r.level&&v.extra===r.extra).optimal!==r.optimal+r.setup)throw Error('Prepared start changes historical star scale');}
 writeFileSync('src/core/goalStartRoutes.json',JSON.stringify(Object.fromEntries(rows.filter(r=>r.setup>0).map(r=>[`${levels[r.level].id}@${levels[r.level].version}${r.extra?'+':''}`,r.path])))+'\n');
 console.log('Verified starting boards, remaining optima and unchanged historical star scale.');
}finally{rmSync(temporary,{recursive:true,force:true});}
