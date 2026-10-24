// Freeze actual renderer frames with Playwright's clock; no production debug hooks.
import {chromium} from 'playwright';
import {layout} from '../src/game/geometry.ts';
import fs from 'node:fs';
import path from 'node:path';
const levels=JSON.parse(fs.readFileSync(new URL('../src/core/levels.json',import.meta.url),'utf8')),level=levels[2];
const output=process.env.UI_CAPTURE_DIR??'test-results/outlet';fs.mkdirSync(output,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.clock.install({time:new Date('2026-01-01T00:00:00Z')});
await page.addInitScript(s=>localStorage.setItem('water-sort-v1',JSON.stringify(s)),{schema:1,artVersion:4,current:2,revision:0,completed:[],attempts:{},settings:{sound:false,fast:false,symbols:false,light:false}});
await page.goto(process.argv[2]??'http://127.0.0.1:4175');await page.locator('canvas').waitFor();await page.clock.pauseAt(new Date('2026-01-01T00:00:10Z'));
async function tap(i){const b=await page.locator('#board').boundingBox(),p=layout(b.width,b.height,level.initial.length)[i];await page.mouse.click(b.x+p.x,b.y+p.y+p.h/2);}
for(const [index,m] of level.witness.entries()){
 await tap(m.from);await tap(m.to);await page.clock.runFor(280);
 if([0,6,8,11].includes(index))await page.screenshot({path:path.join(output,`pour-step-${index+1}.png`)});
 await page.clock.runFor(340);
}
await page.screenshot({path:path.join(output,'completed.png')});await browser.close();fs.writeFileSync(path.join(output,'capture.json'),JSON.stringify({errors,method:'Paused browser clock at 280ms of each 560ms animation',steps:[1,7,9,12]},null,2));console.log(JSON.stringify({output,errors}));
