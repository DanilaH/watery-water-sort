import { writeFileSync,readFileSync } from 'node:fs';
import { solve } from '../src/core/solver';
import { apply, won, type Board } from '../src/core/rules';
let seed = 81347;
function random() { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }
const levels: {id:string; version:1; colors:number; initial:Board; witness:unknown; seed:number}[] = [];
// First two are deliberately legible, then select reproducible shuffled starts.
const tutorials: Board[] = [[[0,0,1,1],[1,1,0,0],[],[]], [[0,1,0,1],[1,0,1,0],[],[]]];
for (let i=0;i<12;i++) {
  const colors = i < 2 ? 2 : Math.min(8, 3 + Math.floor((i-2)*.6));
  for (let tries=0;;tries++) {
    if (tries>500) throw new Error('Generation budget exhausted');
    const usedSeed=seed;
    const flat=Array.from({length:colors*4}, (_,n)=> Math.floor(n/4));
    for(let j=flat.length-1;j>0;j--) {const k=Math.floor(random()*(j+1));[flat[j],flat[k]]=[flat[k],flat[j]];}
    const initial=tutorials[i] ?? [...Array.from({length:colors},(_,n)=>flat.slice(n*4,n*4+4)),[],[]];
    const result=solve(initial,100_000,500);
    if(result.status!=='FOUND' || !result.path.length)continue;
    let b=initial;for(const m of result.path)b=apply(b,m);if(!won(b))throw Error('Invalid witness');
    levels.push({id:'water-'+String(i+1).padStart(3,'0'),version:1,colors,initial,witness:result.path,seed:usedSeed});break;
  }
}
const authored=JSON.parse(readFileSync('src/core/levels.json','utf8')).filter((l:{goal?:unknown;goals?:unknown;mini?:number})=>l.goal||l.goals||l.mini!==undefined);
writeFileSync('src/core/levels.json',JSON.stringify([...levels,...authored],null,2)+'\n');
console.log(`Generated ${levels.length} witnessed prototype levels. Human difficulty calibration pending.`);
