import {createServer} from 'vite';
import {chromium} from 'playwright';
import {mkdirSync,writeFileSync} from 'node:fs';
import {fresh,levels,seededRestart,moved,attempt,displaySlots,goalFor} from '../src/core/session.ts';
import {campaign,stageNumber} from '../src/core/campaign.ts';
import {goalList} from '../src/core/rules.ts';
import {layout,goalLayout,miniLayout} from '../src/game/geometry.ts';
const out='/workspace/scratch/3a5c9a735dde/store-media/source';mkdirSync(out,{recursive:true});
const server=await createServer({server:{host:'127.0.0.1',port:4187}});await server.listen();
const browser=await chromium.launch({headless:true,args:['--no-zygote','--single-process','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:420,height:720},deviceScaleFactor:3});
const report=[];
for(const [name,index,finish] of [['01-colors',6,false],['02-giant',17,false],['03-hidden',43,false],['04-ice',32,false],['05-stars',0,true]] as const){
 if(process.argv[2]&&process.argv[2]!==name)continue;
 let s=seededRestart({...fresh(),current:index,completed:campaign.slice(0,stageNumber(index)-1).map(i=>levels[i].id)});
 s.settings.sound=false;s.wallet!.coins=120;
 if(finish){for(const m of levels[index].witness.slice(attempt(s).setup??0,-1))s=moved(s,m);}
 await page.goto('http://127.0.0.1:4187');
 await page.evaluate(s=>{localStorage.clear();localStorage.setItem('water-sort-v1',JSON.stringify(s));},s);
 await page.reload();await page.locator('body:not([data-booting])').waitFor();await page.locator('#home-play').click();await page.locator('#home').waitFor({state:'hidden'});await page.waitForTimeout(1500);
 if(finish){const m=levels[index].witness.at(-1)!;const b=(await page.locator('#board').boundingBox())!;const gs=goalList(goalFor(s));const ps=miniLayout(gs.length?goalLayout(b.width,b.height,displaySlots(s),gs.map(g=>g.index)):layout(b.width,b.height,displaySlots(s)),levels[index].mini);
 for(const i of [m.from,m.to]){await page.mouse.click(b.x+ps[i].x,b.y+ps[i].y+ps[i].h/2);await page.waitForTimeout(180);}
 await page.locator('#continue').waitFor({state:'visible'});await page.waitForTimeout(2400);}
 await page.screenshot({path:out+'/'+name+'.png'});await page.locator('#board').screenshot({path:out+'/'+name+'-board.png'});
 report.push({name,index,stage:stageNumber(index),viewport:[420,720],source:'Actual game rendered in Chromium; valid prepared QA state; victory uses real final move.'});
}
writeFileSync(out+'/capture.json',JSON.stringify(report,null,2));await browser.close();await server.close();
