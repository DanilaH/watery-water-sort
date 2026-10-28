import {levels,levelKey,type Save} from './session';
import {stars} from './ratings';

/** Derived from retained best solutions. There is no spendable or farmable balance. */
export function totalStars(save:Save){
  return levels.reduce((total,level,i)=>{
    const best=save.best?.[levelKey(i)];
    return total+(best?stars(levelKey(i),best.history.length):save.completed.includes(level.id)?1:0);
  },0);
}
