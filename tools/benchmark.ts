import { apply, type Board } from '../src/core/rules';
import { solve } from '../src/core/solver';
import { levels } from '../src/core/session';
const hard=levels.filter(l=>l.colors>=6);let found=0,unknown=0;const times:number[]=[];
for(let i=0;i<200;i++){const l=hard[i%hard.length];let b:Board=l.initial;const prefix=i%(l.witness.length-1);for(const m of l.witness.slice(0,prefix))b=apply(b,m);const start=performance.now(),r=solve(b);times.push(performance.now()-start);if(r.status==='FOUND')found++;else if(r.status==='UNKNOWN')unknown++;else throw Error('Known reachable state incorrectly rejected');}
times.sort((a,b)=>a-b);console.log(JSON.stringify({samples:200,found,unknown,p50Ms:times[99],p95Ms:times[189],maxMs:times[199],note:'Host Node, witness prefixes; not a phone benchmark or independent human-state corpus.'},null,2));
