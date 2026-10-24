// Read-only UX diagnostic; run with node --import tsx against the Vite dev server.
import {chromium} from 'playwright';
import {layout} from '../src/game/geometry.ts';
import fs from 'node:fs';
const levels=JSON.parse(fs.readFileSync(new URL('../src/core/levels.json',import.meta.url),'utf8')),dir=process.env.UI_AUDIT_DIR??'test-results/ux-review-05';
fs.mkdirSync(dir,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});let page,context;const errors=[],results=[];
async function reset(index=0,viewport={width:390,height:844}){
 if(context)await context.close();context=await browser.newContext({viewport,deviceScaleFactor:2});page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 
 await page.addInitScript(s=>localStorage.setItem('water-sort-v1',JSON.stringify(s)),{schema:1,artVersion:4,current:index,revision:0,completed:[],attempts:{},settings:{sound:true,fast:false,symbols:false,light:false}});
 await page.goto(process.argv[2]??'http://127.0.0.1:4175');await page.locator('canvas').waitFor();
 await page.evaluate(async()=>{const path='/src/game/WaterScene.ts',m=await import(path),original=m.WaterScene.prototype.positions;m.WaterScene.prototype.positions=function(){window.__scene=this;m.WaterScene.prototype.positions=original;return original.call(this);};});
 const b=await page.locator('#board').boundingBox();await page.mouse.click(b.x+1,b.y+1);
 await page.evaluate(async()=>{window.__events=[];const path='/src/audio/sound.ts',m=await import(path);for(const name of ['tap','reject','land','pour','finish']){const f=m.Sound.prototype[name];m.Sound.prototype[name]=function(...args){window.__events.push({cue:name,args,time:performance.now()});return f.apply(this,args);};}});
}
async function tap(i,index=0){const b=await page.locator('#board').boundingBox(),p=layout(b.width,b.height,levels[index].initial.length)[i];await page.mouse.click(b.x+p.x,b.y+p.y+p.h/2);}
async function data(){return page.evaluate(()=>({selected:window.__scene.selected,hint:window.__scene.hintMove,busy:window.__scene.busy,history:JSON.parse(localStorage.getItem('water-sort-v1')).attempts,status:document.querySelector('#status').textContent,events:window.__events}));}
await reset();await tap(0);await tap(2);await page.waitForTimeout(140);await tap(1);await tap(0);results.push({case:'chain-target-during-pour',phase:'input',...(await data())});await page.waitForTimeout(800);results.push({case:'chain-target-during-pour',phase:'after',...(await data())});await page.screenshot({path:dir+'/ignored-chain.png'});
await reset();await tap(1);await tap(3);await tap(0);await tap(2);results.push({case:'disjoint-queue',phase:'input',...(await data())});await page.waitForTimeout(1300);results.push({case:'disjoint-queue',phase:'after',...(await data())});
await reset();await tap(0);await tap(1);await page.waitForTimeout(40);results.push({case:'incompatible-source-switch',...(await data())});await page.screenshot({path:dir+'/switch-reject.png'});
await reset(2);await page.locator('#hint').click();for(let k=0;k<30;k++){if((await page.locator('#status').textContent()).includes('Перелей'))break;await page.waitForTimeout(40);}await page.waitForTimeout(150);results.push({case:'hint',...(await data())});await page.screenshot({path:dir+'/hint.png'});
await reset();for(const m of levels[0].witness){await tap(m.from);await tap(m.to);await page.waitForTimeout(620);}results.push({case:'victory',...(await data()),continue:await page.locator('#continue').isVisible()});await page.screenshot({path:dir+'/victory.png'});await page.locator('#undo').click();await page.waitForTimeout(400);results.push({case:'undo-victory',...(await data()),continue:await page.locator('#continue').isVisible()});await page.screenshot({path:dir+'/undo.png'});
await reset();await page.locator('#restart').click();results.push({case:'restart-before-any-move',confirmation:await page.locator('dialog').isVisible()});
await context.close();await browser.close();fs.writeFileSync(dir+'/interactions.json',JSON.stringify({errors,results},null,2));console.log(JSON.stringify({errors,results}));
