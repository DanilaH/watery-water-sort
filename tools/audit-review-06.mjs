import {chromium} from 'playwright';
import {layout} from '../src/game/geometry.ts';
import fs from 'node:fs';
const dir=process.env.UI_CAPTURE_DIR??'test-results/review-06';fs.mkdirSync(dir,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto(process.argv[2]??'http://127.0.0.1:4175');await page.locator('canvas').waitFor();await page.waitForTimeout(400);
const b=await page.locator('#board').boundingBox(),ps=layout(b.width,b.height,4),tap=async i=>page.mouse.click(b.x+ps[i].x,b.y+ps[i].y+ps[i].h/2);
for(const i of [0,2,1,0])await tap(i);
const before=await page.locator('#status').textContent();if(!before.includes('Следующий ход выбран'))throw Error('Queue not established');
await page.mouse.click(b.x+ps[1].x,b.y+ps[1].y-15);
const after=await page.locator('#status').textContent();await page.waitForTimeout(1300);
const moves=await page.locator('#moves').textContent();
const targets=[];
for(const [w,h]of [[390,844],[320,480],[568,320]]){await page.setViewportSize({width:w,height:h});await page.waitForTimeout(150);targets.push({viewport:[w,h],buttons:await page.locator('button').evaluateAll(bs=>bs.filter(b=>b.getBoundingClientRect().width).map(b=>{const r=b.getBoundingClientRect();return {id:b.id,width:r.width,height:r.height}}))});}
await page.setViewportSize({width:568,height:320});await page.locator('#settings').click();targets.push({settings:await page.locator('.dialog-actions button').evaluateAll(bs=>bs.map(b=>({text:b.textContent,height:b.getBoundingClientRect().height})))});
const result={errors,queueBadge:{before,after,moves,markerY:ps[1].y-15,hitTop:ps[1].y+(ps[1].h-ps[1].hitH)/2},targets};fs.writeFileSync(dir+'/interactions.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));await browser.close();
