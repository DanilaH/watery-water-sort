import {stageNumber} from './campaign';
const HARD=new Set([15,18,26,...Array.from({length:17},(_,i)=>20+i*5)]);
export const isHard=(index:number)=>HARD.has(stageNumber(index));
