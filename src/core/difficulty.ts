import {levelKey} from './session';
// Curated challenge milestones for the current bank; independent of star thresholds.
// 8 introduces six colours; 12 is the final eight-colour challenge.
const HARD=new Set(['water-008@1','water-012@1']);
export const isHard=(index:number)=>HARD.has(levelKey(index));
