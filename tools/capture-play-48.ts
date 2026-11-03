import {chromium} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
import {fresh,levels,seededRestart,grantExtra,activeKey} from '../src/core/session';
import {campaign,stageNumber} from '../src/core/campaign';
const out='/workspace/scratch/3a5c9a735dde/release48-deliverables';mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true});
const cases=[['before-18',4180,6,390,844,0],['play48-18',4181,6,390,844,0],['play48-goals',4181,59,390,844,3],['play48-landscape',4181,59,568,320,3]] as const;
const report=[];
for(const [name,port,index,width,height,extras]of cases){
 const p=await browser.newPage({viewport:{width,height},deviceScaleFactor:2});const errors:string[]=[];p.on('pageerror',e=>errors.push(e.message));
 let s=seededRestart({...fresh(),current:index,completed:campaign.slice(0,stageNumber(index)-1).map(i=>levels[i].id)});s.settings.sound=false;s.wallet!.coins=420;s.completed.forEach(id=>s.wallet!.awarded[id]=1);
 if(extras){s=grantExtra(s,activeKey(s),extras);s.wallet!.tubes=0;}
 await p.addInitScript(s=>localStorage.setItem('water-sort-v1',JSON.stringify(s)),s);
 for(let i=0;i<50;i++){try{await p.goto(`http://127.0.0.1:${port}`);break;}catch(e){if(i===49)throw e;await new Promise(r=>setTimeout(r,100));}}
 await p.locator('#home-play').click();await p.waitForTimeout(900);await p.screenshot({path:`${out}/${name}.png`});
 if(errors.length)throw Error(errors.join('\n'));report.push({name,index,width,height,extras,errors});await p.close();
}
await browser.close();writeFileSync(`${out}/screenshots.json`,JSON.stringify({method:'Real browser screenshots of seeded QA states, not generated artwork or actual player progress.',cases:report},null,2)+'\n');
