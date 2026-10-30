/** Research only: exact BFS using production rules, not a new gameplay feature. */
import {moves,apply,won,validBoard,type Board,type Move} from '../src/core/rules';

function afterFirst(initial:Board,first:Move){
 const next=apply(initial,first),queue=[{board:next,path:[first]}],seen=new Set([JSON.stringify(next)]);
 for(let head=0;head<queue.length;head++){
  const {board,path}=queue[head];
  if(won(board))return {status:'FOUND',distance:path.length,path,nodes:head+1};
  for(const move of moves(board)){
   const board=apply(queue[head].board,move),key=JSON.stringify(board);
   if(!seen.has(key)){seen.add(key);queue.push({board,path:[...path,move]});}
  }
 }
 return {status:'UNSOLVABLE',distance:null,path:[],nodes:queue.length};
}
const boards:Board[]=[[[0,0,1,0],[0,1,1,1],[2,2,2,2],[]],[[1,1,0,0],[1,0,0,1],[2,2,2,2],[]]];
const cases=boards.map(board=>{
 if(!validBoard(board))throw Error('Invalid research board');
 const routes=moves(board).map(first=>({first:[first.from,first.to],...afterFirst(board,first)}));
 const optimal=Math.min(...routes.filter(r=>r.distance!==null).map(r=>r.distance!));
 for(const route of routes.filter(r=>r.status==='FOUND')){
  let state=board;for(const move of route.path)state=apply(state,move);if(!won(state))throw Error('Invalid witness');
 }
 return {board,optimal,optimalFirst:routes.filter(r=>r.distance===optimal).map(r=>r.first),routes};
});
if(cases.some(c=>c.optimal!==4||c.optimalFirst.length!==1)||cases[0].optimalFirst[0][0]===cases[1].optimalFirst[0][0])throw Error('Counterexample not verified');
console.log(JSON.stringify({scope:'Naively hide bottom three layers of the first two vessels, preserving current maximal-group rules. Not a captured Magic Sort level.',ordering:'bottom to top; tube indices zero-based',observation:[['?','?','?',0],['?','?','?',1],[2,2,2,2],[]],cases},null,2));
