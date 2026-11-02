import seededRoutes from './goalStartRoutes.json' with {type:'json'};
import {goalStart} from './goalStart';
import routes from './optimalRoutes.json' with {type:'json'};
import {solve,type Result} from './solver';
import {moves,transition,won,goalList,miniIndex,iceIndex,iceOpen,type Board,type Goals,type Move} from './rules';
import {levels,levelGoals} from './session';
const signature=(b:Board,g?:Goals)=>JSON.stringify([b,g]);
const stateKey=(b:Board,g?:Goals)=>JSON.stringify([b.filter((_,i)=>goalList(g).some(x=>x.index===i)||miniIndex(g)===i||iceIndex(g)===i),b.filter((_,i)=>!goalList(g).some(x=>x.index===i)&&miniIndex(g)!==i&&iceIndex(g)!==i).map(t=>t.join('')).sort(),!!iceOpen(g)]);
const lower=(b:Board)=>{const colors=new Set<number>();let runs=0;for(const t of b)for(let i=0;i<t.length;i++){colors.add(t[i]);if(i===0||t[i-1]!==t[i])runs++;}return runs-colors.size;};
/** Offline independently proven paths are reused only on exactly matching boards/rules. */
export function solveHint(board:Board,goal:Goals|undefined,level?:string,extra=false,maxMs=750):Result{
 const l=levels.find(l=>`${l.id}@${l.version}`===level),seed=(routes as Record<string,Move[]>)[(level??'')+(extra?'+':'')];
 const seeded=(seededRoutes as Record<string,Move[]>)[(level??'')+(extra?'+':'')];
 for(const candidate of [seed, l&&seeded?[...goalStart(l),...seeded]:undefined])if(l&&candidate){const seed=candidate;let current={board:extra?[...l.initial,[]]:l.initial,rules:levelGoals(l)};for(let i=0;i<=seed.length;i++){if(signature(board,goal)===signature(current.board,current.rules))return {status:'FOUND',path:seed.slice(i).map(m=>({...m})),nodes:0};if(i<seed.length)current=transition(current.board,seed[i],current.rules);}}
 const start=performance.now(),fallback=solve(board,200000,Math.min(100,maxMs/4),goal);if(fallback.status==='UNSOLVABLE')return fallback;
 let nodes=fallback.nodes,timedOut=false;const path:Move[]=[];
 const limit=fallback.status==='FOUND'?fallback.path.length-1:Math.max(32,lower(board)+12);
 for(let depth=lower(board);depth<=limit;depth++){
  const seen=new Map<string,number>();
  const visit=(b:Board,g:Goals|undefined,left:number):Move[]|undefined=>{
   if(++nodes%64===0&&performance.now()-start>=maxMs){timedOut=true;return;}
   if(lower(b)>left)return;if(won(b,g))return [...path];if(!left)return;
   const k=stateKey(b,g);if((seen.get(k)??-1)>=left)return;seen.set(k,left);
   const candidates=moves(b,g).map(m=>({m,next:transition(b,m,g)})).sort((a,z)=>lower(a.next.board)-lower(z.next.board));
   for(const {m,next} of candidates){path.push(m);const r=visit(next.board,next.rules,left-1);path.pop();if(r)return r;if(timedOut)return;}
  };
  const result=visit(board,goal,depth);if(result)return {status:'FOUND',path:result,nodes};if(timedOut)break;
 }
 return fallback.status==='FOUND'?{...fallback,nodes}:{status:'UNKNOWN',nodes};
}
