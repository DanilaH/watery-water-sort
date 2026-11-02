/** Read-only content audit of the exact v46 player starts. No changes to campaign/rating/save data. */
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {levels,levelGoals,levelKey,type Level} from '../src/core/session';
import {campaign} from '../src/core/campaign';
import {goalStart} from '../src/core/goalStart';
import {walk,knowledgeView} from '../src/core/knowledge';
import {moves,transition,won,goalAt,goalList,miniIndex,iceIndex,iceOpen,sealedTube,type Board,type Goals,type Move} from '../src/core/rules';
import {stars} from '../src/core/ratings';
const out='docs/audits/campaign-47';mkdirSync(out,{recursive:true});
const proofs=JSON.parse(readFileSync('docs/audits/visual-goals-44/optimal.json','utf8'));
const LIMIT=20000,TRIALS=24,STEP=120;
const signature=(b:Board,g?:Goals,blocked=-1)=>JSON.stringify([
 goalList(g).map(t=>[t.color,b[t.index]]),miniIndex(g)===undefined?null:b[miniIndex(g)!],
 iceIndex(g)===undefined?null:[iceOpen(g),b[iceIndex(g)!]],
 b.filter((_,i)=>i!==blocked&&!goalAt(g,i)&&i!==miniIndex(g)&&i!==iceIndex(g)).map(t=>t.join('')).sort()
]);
function start(l:Level,extra=false){const prefix=goalStart(l),v=walk(l,prefix,extra,levelGoals(l));return {board:v.board,rules:v.rules,prefix};}
const available=(b:Board,g:Goals|undefined,blocked=-1)=>moves(b,g).filter(m=>m.from!==blocked&&m.to!==blocked);
/** Every legal move, with only equivalent ordinary vessel permutations collapsed. No search pruning. */
function graph(board:Board,rules:Goals|undefined,blocked=-1){
 const nodes:{b:Board;g?:Goals;depth:number;parent:number;move?:Move}[]=[{b:board,g:rules,depth:0,parent:-1}];
 const seen=new Map([[signature(board,rules,blocked),0]]),reverse:number[][]=[[]],wins:number[]=[];
 let truncated=false,edges=0,shortest:number|undefined,witness:Move[]|undefined;
 for(let cursor=0;cursor<nodes.length;cursor++){
  const n=nodes[cursor];if(won(n.b,n.g)){
   wins.push(cursor);if(shortest===undefined){shortest=n.depth;witness=[];let i=cursor;while(nodes[i].parent>=0){witness.push(nodes[i].move!);i=nodes[i].parent;}witness.reverse();}continue;
  }
  for(const m of available(n.b,n.g,blocked)){
   const t=transition(n.b,m,n.g),key=signature(t.board,t.rules,blocked);let id=seen.get(key);
   if(id===undefined){if(nodes.length>=LIMIT){truncated=true;continue;}id=nodes.length;seen.set(key,id);nodes.push({b:t.board,g:t.rules,depth:n.depth+1,parent:cursor,move:m});reverse.push([]);}
   if(id!==cursor){reverse[id].push(cursor);edges++;}
  }
 }
 const good=new Set(wins),queue=[...wins];for(let i=0;i<queue.length;i++)for(const p of reverse[queue[i]])if(!good.has(p)){good.add(p);queue.push(p);}
 // In a truncated graph, missing winning paths do not establish dead states.
 const dead=truncated?undefined:nodes.map((n,i)=>({n,i})).filter(({i})=>!good.has(i));
 let trapWitness:Move[]|undefined;
 if(dead?.length){trapWitness=[];let i=dead[0].i;while(nodes[i].parent>=0){trapWitness.push(nodes[i].move!);i=nodes[i].parent;}trapWitness.reverse();}
 return {complete:!truncated,states:nodes.length,edges,shortest,witness,deadStates:dead?.length,earliestTrapDepth:dead?.length?Math.min(...dead.map(({n})=>n.depth)):undefined,trapWitness};
}
function bot(l:Level,index:number,extra:boolean,blocked:number,policy:'greedy'|'explore',trial:number){
 let {board,rules,prefix}=start(l,extra),history=[...prefix],steps=0,seed=(470001+index*7919+trial*997)>>>0;
 const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const tried=new Map<string,Set<string>>();let outcome='budget';
 for(;steps<STEP&&!won(board,rules);steps++){
  const view=knowledgeView(l,{board,history,extra},levelGoals(l)),known=view?new Set(view.known):undefined;
  // This models a player who never moves a sealed tube or just relocates a uniform tube to an identical empty slot.
  // Neither policy reads buried colours, invokes a solver, uses Undo or buys hints.
  const observable=JSON.stringify([board.map((t,i)=>t.map((c,d)=>!view||known!.has(view.ids[i][d])?String(c):`?${view.ids[i][d]}`)),iceOpen(rules)]);
  const used=tried.get(observable)??new Set<string>();tried.set(observable,used);
  const candidates=available(board,rules,blocked).filter(m=>!sealedTube(board,m.from,rules)&&!used.has(`${m.from}:${m.to}`)).map(m=>{
   let visible=0;for(let d=board[m.from].length-1;d>=0&&(!view||known!.has(view.ids[m.from][d]))&&board[m.from][d]===m.color;d--)visible++;
   const score=(goalAt(rules,m.to)?30:0)+(board[m.to].length?10:0)+Math.min(visible,(goalAt(rules,m.to)?.capacity??(m.to===miniIndex(rules)?2:4))-board[m.to].length)*2+(visible===board[m.from].length?4:0);
   const cosmetic=visible===board[m.from].length&&!board[m.to].length&&!goalAt(rules,m.to)&&m.to!==miniIndex(rules)&&m.to!==iceIndex(rules)&&m.from!==miniIndex(rules)&&m.from!==iceIndex(rules);
   return {m,score,cosmetic,random:random()};
  }).filter(c=>!c.cosmetic);
  if(!candidates.length){outcome=available(board,rules,blocked).length?'no-untried-useful-move':'no-legal-move';break;}
  candidates.sort((a,b)=>policy==='greedy'?b.score-a.score||a.random-b.random:a.random-b.random);
  const c=candidates[0];used.add(`${c.m.from}:${c.m.to}`);const t=transition(board,c.m,rules);board=t.board;rules=t.rules;history.push(c.m);
 }
 const success=won(board,rules);return {success,steps,stars:success?stars(levelKey(index),history.length):0,outcome:success?'won':outcome};
}
function bots(l:Level,index:number,extra=false,blocked=-1){
 return Object.fromEntries((['greedy','explore'] as const).map(policy=>{
  const runs=Array.from({length:TRIALS},(_,trial)=>bot(l,index,extra,blocked,policy,trial));
  return [policy,{wins:runs.filter(r=>r.success).length,trials:TRIALS,threeStars:runs.filter(r=>r.stars===3).length,meanWinningMoves:runs.some(r=>r.success)?Number((runs.filter(r=>r.success).reduce((s,r)=>s+r.steps,0)/runs.filter(r=>r.success).length).toFixed(2)):null,outcomes:runs.reduce((s,r)=>(s[r.outcome]=(s[r.outcome]??0)+1,s),{} as Record<string,number>)}];
 }));
}
const rows:any[]=[];
for(const [rank,index]of campaign.entries()){
 const l=levels[index],s=start(l),g=graph(s.board,s.rules),base=proofs.find((r:any)=>r.level===index&&!r.extra),ad=proofs.find((r:any)=>r.level===index&&r.extra);
 const emptyOrdinary=s.board.map((t,i)=>!t.length&&!goalAt(s.rules,i)&&i!==miniIndex(s.rules)&&i!==iceIndex(s.rules)?i:-1).filter(i=>i>=0);
 // Equivalent ordinary empty slots need only one counterfactual; the physical slot stays empty and unusable.
 const blocked=emptyOrdinary[0],removal=blocked===undefined?undefined:graph(s.board,s.rules,blocked);
 // Check supplied witnesses against actual moves and terminal rules, independently of graph bookkeeping.
 for(const [check,block]of [[g,-1],[removal,blocked]] as const)if(check?.witness){let b=s.board,r=s.rules;for(const m of check.witness){if(m.from===block||m.to===block)throw Error('Blocked move');const t=transition(b,m,r);b=t.board;r=t.rules;}if(!won(b,r))throw Error('False witness');}
 const row={stage:rank+1,id:l.id,colors:l.colors,roles:[...(goalList(s.rules).length?[goalList(s.rules).length===2?'dual':'goal']:[]),...(l.mini!==undefined?['mini']:[]),...(l.ice!==undefined?['ice']:[]),...(l.hidden?['hidden']:[])],tubes:s.board.length,emptyOrdinary,freeUnits:s.board.reduce((n,t,i)=>n+(i===miniIndex(s.rules)?2:goalAt(s.rules,i)?.capacity??4)-t.length,0),setupMoves:s.prefix.length,optimal:base.optimal,playerOptimal:base.optimal-s.prefix.length,adPlayerOptimal:ad.optimal-s.prefix.length,graph:g,withoutOneEmpty:removal?{blocked,...removal}:null,bots:bots(l,index),withAd:l.colors>2?bots(l,index,true):null,withoutOneEmptyBots:blocked===undefined?null:bots(l,index,false,blocked)};
 rows.push(row);writeFileSync(`${out}/audit.json`,JSON.stringify({source:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),method:{graphLimit:LIMIT,botTrials:TRIALS,botStepBudget:STEP,seedFormula:'470001 + contentIndex*7919 + trial*997',hidden:'Graphs have complete physical information; bots rank only visible runs and do not inspect hidden layers. Bots remember tried actions on labelled observable boards; no future-state lookahead or hidden-colour cycle oracle. Not a human win-rate estimate.',canonicalization:'Colour identity and all special vessel roles fixed; only ordinary vessel permutations collapsed. Blocked empty slot excluded. Won nodes terminal. All legal moves included in graphs.',truncation:'Only complete graphs prove dead-state counts or absence. A found path proves solvability even when incomplete. Missing paths with truncation are UNKNOWN.',counterfactual:'Disable one ordinary empty slot; retain empty placeholder to avoid changing min-four validation or special indices. Not a released level edit.'},rows},null,2)+'\n');
 console.log(JSON.stringify({stage:row.stage,id:l.id,optimal:row.playerOptimal,graph:g.complete?`${g.states}/${g.deadStates} dead`:`>${g.states}`,remove:removal?`${removal.complete?'exact':'partial'} ${removal.shortest??'no witness'}`:'none',greedy:(row.bots.greedy as any).wins,explore:(row.bots.explore as any).wins}));
}
