// Silent recording of actual browser gameplay; no composited or simulated animation.
import {chromium} from 'playwright';
import {layout} from '../src/game/geometry.ts';
import fs from 'node:fs';
import path from 'node:path';
const levels=JSON.parse(fs.readFileSync(new URL('../src/core/levels.json',import.meta.url),'utf8'));
const output=process.env.UI_CAPTURE_DIR??'test-results/feel';fs.mkdirSync(output,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,recordVideo:{dir:output,size:{width:390,height:844}}});
await context.addInitScript(s=>localStorage.setItem('water-sort-v1',JSON.stringify(s)),{schema:1,artVersion:4,current:2,revision:0,completed:levels.slice(0,2).map(l=>l.id),attempts:{},settings:{sound:true,fast:false,symbols:false,light:false}});
const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto(process.argv[2]??'http://127.0.0.1:4175');await page.locator('canvas').waitFor();await page.waitForTimeout(700);
async function tap(i){const r=await page.locator('#board').boundingBox(),p=layout(r.width,r.height,levels[2].initial.length)[i];await page.mouse.click(r.x+p.x,r.y+p.y+p.h/2);}
async function shot(name){await page.screenshot({path:path.join(output,name+'.png')});}
await shot('gameplay');
for(const [i,m]of levels[2].witness.entries()){
 await tap(m.from);await page.waitForTimeout(180);await tap(m.to);
 if(i===0){await page.waitForTimeout(260);await shot('pour');await page.waitForTimeout(440);}else await page.waitForTimeout(720);
 if(i===1){await page.locator('#undo').click();await page.waitForTimeout(650);await tap(m.from);await page.waitForTimeout(150);await tap(m.to);await page.waitForTimeout(700);}
}
await page.waitForTimeout(600);await shot('completed');
await page.locator('#undo').click();await page.waitForTimeout(700);await shot('after-undo');
await page.locator('#hint').click();await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('Перелей'));await page.waitForTimeout(800);await shot('hint');
const video=page.video();await context.close();await video.saveAs(path.join(output,'gameplay.webm'));await browser.close();
fs.writeFileSync(path.join(output,'recording.json'),JSON.stringify({errors,level:3,moves:levels[2].witness.length,audio:false},null,2));console.log(JSON.stringify({output,errors}));
