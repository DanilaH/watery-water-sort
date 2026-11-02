import {levels,allLevels,type Save} from './session';
import {stars} from './ratings';
/** Highest earned stars survive content revisions, without comparing unlike move counts. */
export function earnedStars(save:Save,index:number){
 const id=levels[index].id;let earned=save.completed.includes(id)?1:0;
 for(const l of allLevels)if(l.id===id){const key=`${l.id}@${l.version}`,best=save.best?.[key];if(best)earned=Math.max(earned,stars(key,best.history.length));}
 return earned;
}
export const totalStars=(save:Save)=>levels.reduce((total,_,index)=>total+earnedStars(save,index),0);
