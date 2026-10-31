import data from './levels.json' with {type:'json'};
import ids from './campaign.json' with {type:'json'};
import type {Save} from './session';
/** Content indices remain stable save identities. Only this presentation order changes. */
export const campaign=ids.map(id=>data.findIndex(l=>l.id===id));
if(campaign.length!==data.length||new Set(campaign).size!==data.length||campaign.some(i=>i<0))throw Error('Campaign must contain each puzzle exactly once');
const ranks=new Map(campaign.map((index,rank)=>[index,rank]));
export const stageNumber=(index:number)=>{const rank=ranks.get(index);if(rank===undefined)throw Error('Unknown puzzle');return rank+1;};
export const nextLevel=(index:number)=>campaign[stageNumber(index)];
export function available(s:Pick<Save,'current'|'completed'|'attempts'|'unlocked'>,index:number){
 const rank=stageNumber(index)-1,l=data[index],previous=data[campaign[rank-1]];
 return rank===0||index===s.current||s.completed.includes(l.id)||!!s.attempts[`${l.id}@${l.version}`]||!!s.unlocked?.includes(l.id)||!!previous&&s.completed.includes(previous.id);
}
/** Preserve the old frontier, in-progress puzzle and records without awarding completion. */
export function migrateCampaign(s:Save):Save{
 if(s.campaignVersion===1)return s;
 const n=structuredClone(s);n.campaignVersion=1;
 n.unlocked=data.filter((l,i)=>i===0||i===s.current||s.completed.includes(l.id)||i>0&&s.completed.includes(data[i-1].id)).map(l=>l.id);
 return n;
}
/** Old saves can resume late in the new order. Fill earlier gaps after that attempt. */
export function continuation(s:Pick<Save,'current'|'completed'>){
 const rank=stageNumber(s.current)-1;
 return campaign.slice(0,rank).find(i=>!s.completed.includes(data[i].id))??nextLevel(s.current);
}
