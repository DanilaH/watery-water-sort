import {clone,goalList,moves,transition,type Move} from './rules';
import type {Level} from './session';
/** Move existing exposed liquid into each receiver before the player's first turn.
 * The replayable prefix preserves the authored bank and old saves. It is never undoable.
 */
export function goalStart(l:Level):Move[]{
 let board=clone(l.initial);const rules=l.mini===undefined&&l.ice===undefined?l.goals??l.goal:{goals:goalList(l.goals??l.goal),...(l.mini!==undefined?{mini:l.mini}:{}),...(l.ice!==undefined?{ice:l.ice}:{})};
 const prefix:Move[]=[];
 for(const goal of goalList(rules)){
  if(board[goal.index].length)continue;
  const move=moves(board,rules).filter(m=>m.to===goal.index).sort((a,b)=>a.amount-b.amount||a.from-b.from)[0];
  if(!move)throw Error(`No visible starting colour: ${l.id}`);
  prefix.push(move);board=transition(board,move,rules).board;
 }
 return prefix;
}
export const playerMoves=(a:{history:Move[];setup?:number})=>a.history.length-(a.setup??0);
