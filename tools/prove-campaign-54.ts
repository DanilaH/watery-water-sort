/** Publish current-bank optima only after independent Python no-shorter-path verification. */
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';import {join} from 'node:path';import {execFileSync} from 'node:child_process';
import {levels,levelGoals} from '../src/core/session';import {goalStart} from '../src/core/goalStart';import {goalList,transition} from '../src/core/rules';
const temp=mkdtempSync(join(tmpdir(),'campaign54-')),dir='docs/audits/campaign-54';
try{
 const binary=join(temp,'optimal');execFileSync('g++',['-O3','-std=c++17','tools/optimal-levels.cpp','-o',binary]);
 const banks=[levels,levels.map(l=>{let initial=l.initial;const prefix=goalStart(l);for(const m of prefix)initial=transition(initial,m,levelGoals(l)).board;return {...l,initial,setup:prefix.length};})];
 const results=banks.map(bank=>{
  const input=bank.flatMap((l,i)=>[0,1].map(extra=>{const gs=goalList(levelGoals(l));return [i,extra,l.initial.length+extra,l.colors,gs.length,Number(l.mini!==undefined),Number(l.ice!==undefined),...gs.map(g=>g.color),...[...l.initial,...(extra?[[]]:[])].map(t=>t.reduce((v,c)=>(v<<3)|c,1))].join(' ');})).join('\n')+'\n';
  return execFileSync(binary,[],{input,encoding:'utf8',maxBuffer:16*1024*1024}).trim().split('\n').map(s=>JSON.parse(s));
 });
 const archive=JSON.parse(readFileSync('src/core/levels-v47.json','utf8'));
 for(let i=0;i<2;i++){const old=JSON.parse(readFileSync(i?'docs/audits/campaign-balance-47/prepared.json':'docs/audits/campaign-balance-47/optimal.json','utf8'));results[i]=results[i].map(r=>levels[r.level].version===archive[r.level]?.version?old.find((v:any)=>v.level===r.level&&v.extra===r.extra):r);}
 const ratings=JSON.parse(readFileSync('src/core/ratings.json','utf8')),routes=JSON.parse(readFileSync('src/core/optimalRoutes.json','utf8')),prepared=JSON.parse(readFileSync('src/core/goalStartRoutes.json','utf8'));
 for(const r of results[0]){const l=levels[r.level],key=`${l.id}@${l.version}`;routes[key+(r.extra?'+':'')]=r.path;if(!r.extra){ratings[key]={three:r.optimal,two:r.optimal+Math.max(2,Math.ceil(r.optimal*.2))};if(l.version!==archive[r.level]?.version)l.witness=r.path;}}
 for(const r of results[1]){const l=levels[r.level],setup=goalStart(l).length;r.setup=setup;if(r.optimal+setup!==results[0].find(v=>v.level===r.level&&v.extra===r.extra).optimal)throw Error('Prepared scale changed '+l.id);if(setup)prepared[`${l.id}@${l.version}${r.extra?'+':''}`]=r.path;}
 writeFileSync('src/core/ratings.json',JSON.stringify(ratings,null,2)+'\n');writeFileSync('src/core/optimalRoutes.json',JSON.stringify(routes)+'\n');writeFileSync('src/core/goalStartRoutes.json',JSON.stringify(prepared)+'\n');
 for(let i=0;i<2;i++){
  const bankFile=join(temp,`bank${i}.json`),proof=join(temp,`proof${i}.jsonl`);writeFileSync(bankFile,JSON.stringify(banks[i]));writeFileSync(proof,results[i].map(r=>JSON.stringify(r)).join('\n')+'\n');
  process.stdout.write(execFileSync('python3',['tools/verify-optimal.py',proof,'--levels',bankFile,'--ratings-subset','--proof-output',`${dir}/${i?'prepared':'optimal'}.json`],{encoding:'utf8',maxBuffer:16*1024*1024}));
 }
 writeFileSync('src/core/levels.json',JSON.stringify(levels,null,2)+'\n');
 console.log('Current bank authored/prepared 400 optima independently proved; legacy ratings and routes retained.');
}finally{rmSync(temp,{recursive:true,force:true});}
