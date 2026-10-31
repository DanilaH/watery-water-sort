import {goalAt,isFrozen,capacityAt,moveFor,type Board,type Goals,type Move} from './rules';
import type {KnowledgeView} from './knowledge';
/** Ranking reads only current top colours, visible run lengths, vessel roles and free space. */
export function visibleHint(board:Board,view:KnowledgeView,rules?:Goals):Move|null{
 const known=new Set(view.known);let best:{from:number;to:number;score:number}|undefined;
 for(let from=0;from<board.length;from++){
  const source=board[from];if(!source.length||goalAt(rules,from)||isFrozen(rules,from))continue;
  const top=source.at(-1)!;let visible=0;
  for(let d=source.length-1;d>=0&&known.has(view.ids[from][d])&&source[d]===top;d--)visible++;
  const concealed=view.ids[from].some(id=>!known.has(id));
  for(let to=0;to<board.length;to++){
   const target=board[to],space=capacityAt(rules,to)-target.length,goal=goalAt(rules,to);
   if(to===from||space<=0||isFrozen(rules,to)||goal&&goal.color!==top||target.length&&target.at(-1)!==top)continue;
   const score=(concealed?30:0)+(target.length?6:0)+(visible<=space?4:0)-(source.length===visible&&target.length===0?20:0);
   if(!best||score>best.score)best={from,to,score};
  }
 }
 return best?moveFor(board,best.from,best.to,rules):null;
}
