import {chromium} from 'playwright';
import {layout} from '../src/game/geometry.ts';
import fs from 'node:fs';
import path from 'node:path';
const levels=JSON.parse(fs.readFileSync(new URL('../src/core/levels.json',import.meta.url),'utf8'));
const output=process.env.UI_CAPTURE_DIR??'test-results/ui-capture';fs.mkdirSync(output,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2});const errors=[];page.on('pageerror',e=>errors.push(e.message));let current=0;
await page.goto(process.argv[2]??'http://127.0.0.1:4175');
async function reset(index=0,light=false,symbols=false){current=index;await page.evaluate(s=>localStorage.setItem('water-sort-v1',JSON.stringify(s)),{schema:1,artVersion:4,current:index,revision:0,completed:levels.slice(0,index).map(l=>l.id),attempts:{},settings:{sound:true,fast:false,symbols,light}});await page.reload();await page.locator('canvas').waitFor();await page.waitForTimeout(300);}
async function tap(i){const r=await page.locator('#board').boundingBox(),p=layout(r.width,r.height,levels[current].initial.length+1)[i];await page.mouse.click(r.x+p.x,r.y+p.y+p.h/2);}
async function shot(name){await page.screenshot({path:path.join(output,name+'.png')});}
await reset();await shot('start-dark');await reset(0,true);await shot('start-light');
await reset(2,true);await tap(0);await tap(3);await page.waitForTimeout(230);await shot('safe-pour');await page.waitForTimeout(400);
await reset(2);await page.locator('#hint').click();await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('Перелей'));await shot('hint');await tap(0);await page.waitForTimeout(220);await shot('manual-after-hint');
await reset();for(const m of levels[0].witness.slice(0,2)){await tap(m.from);await tap(m.to);await page.waitForTimeout(610);}await shot('color-complete');await page.locator('#undo').click();await page.waitForTimeout(120);await shot('undo');
await reset(0,true);for(const m of levels[0].witness){await tap(m.from);await tap(m.to);await page.waitForTimeout(620);}await shot('victory');await page.reload();await page.waitForTimeout(300);await shot('victory-resume');
const matrix=[];for(const [w,h]of [[320,568],[360,640],[390,844],[568,320],[640,360],[844,390],[768,1024],[1024,768],[320,480]]){
 await page.setViewportSize({width:w,height:h});for(const light of [false,true]){await reset(11,light,true);await shot(`${w}x${h}-${light?'light':'dark'}`);}
 matrix.push(await page.locator('canvas').evaluate(c=>({viewport:[innerWidth,innerHeight],canvas:[c.width,c.height],css:[c.getBoundingClientRect().width,c.getBoundingClientRect().height]})));
 if(w===568){await page.locator('#settings').click();await page.waitForTimeout(220);await shot('settings-small-landscape');await page.getByRole('button',{name:'Закрыть',exact:true}).click();}
}
await page.setViewportSize({width:390,height:844});await reset(3,true);await page.locator('#menu').click();await page.waitForTimeout(200);await shot('menu-light');await page.getByRole('button',{name:'Закрыть',exact:true}).click();await page.locator('#settings').click();await page.waitForTimeout(200);await shot('settings-light');
await browser.close();fs.writeFileSync(path.join(output,'capture.json'),JSON.stringify({errors,matrix},null,2));console.log(JSON.stringify({output,errors,shots:fs.readdirSync(output).filter(n=>n.endsWith('.png')).length}));
