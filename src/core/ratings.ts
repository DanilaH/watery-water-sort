import thresholds from './ratings.json' with {type:'json'};
export function targets(key:string){const t=(thresholds as Record<string,{three:number;two:number}>)[key];if(!t)throw Error('Missing rating');return t;}
export function stars(key:string,moves:number){const t=targets(key);return moves<=t.three?3:moves<=t.two?2:1;}
