// New adversarial integration probes. Real clock; synthetic faults are explicitly labelled.
import {chromium} from 'playwright';import fs from 'node:fs';import {layout} from '../src/game/geometry.ts';
const out=process.env.UI_AUDIT_DIR??'test-results/project-10';fs.mkdirSync(out,{recursive:true});const url=process.argv[2]??'http://127.0.0.1:4175',browser=await chromium.launch({headless:true,args:['--no-sandbox']}),results=[];
const initial={schema:1,artVersion:4,current:0,revision:0,completed:[],attempts:{},settings:{sound:true,fast:false,symbols:false,light:false}};
async function open(init,seed=initial){const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(s=>{if(!sessionStorage.seed){sessionStorage.seed='1';localStorage.setItem('water-sort-v1',JSON.stringify(s));}},seed);if(init)await page.addInitScript(init);await page.goto(url);await page.waitForTimeout(350);return {page,context,errors};}
for(const sound of [true,false]){
 const s=structuredClone(initial);s.settings.sound=sound;const {page,context,errors}=await open(()=>{window.AudioContext=class{constructor(){throw new DOMException('Audio hardware unavailable','NotSupportedError');}}},s);
 const before=await page.evaluate(()=>localStorage.getItem('water-sort-v1'));await page.locator('#settings').click();await page.waitForTimeout(100);results.push({case:'audio-context-construction-denied',synthetic:true,savedSoundSetting:sound,canvas:await page.locator('canvas').count(),settingsOpen:await page.locator('dialog').isVisible(),unchanged:before===await page.evaluate(()=>localStorage.getItem('water-sort-v1')),errors});await page.screenshot({path:out+`/audio-startup-${sound}.png`});await context.close();
}
for(const delayed of [false,true]){
 const {page,context,errors}=await open(delayed?()=>{const Native=Worker;window.Worker=class extends Native{postMessage(...args){setTimeout(()=>super.postMessage(...args),350);}}}:null);
 // The same real handlers run in one event-loop turn, before a Worker can answer.
 await page.evaluate(()=>{document.getElementById('hint').click();document.getElementById('symbols').click();});await page.waitForTimeout(1100);
 const failed={status:await page.locator('#status').textContent(),hintDisabled:await page.locator('#hint').isDisabled(),symbols:await page.locator('#symbols').getAttribute('aria-pressed')};await page.screenshot({path:out+`/hint-symbols-${delayed}.png`});
 const b=await page.locator('#board').boundingBox(),p=layout(b.width,b.height,4)[0];await page.mouse.click(b.x+p.x,b.y+p.y+p.h/2);results.push({case:'symbols-during-hint',delayedWorkerMessage:delayed,inputNote:'Two actual DOM click handlers in one event-loop turn, before the asynchronous Worker reply. No fake clock.',failed,recoveredByBoardSelection:await page.locator('#hint').isEnabled(),errors});await context.close();
}
// A muted player must still be able to enter and leave the same controls.
{
 const s=structuredClone(initial);s.settings.sound=false;const {page,context,errors}=await open(null,s);await page.locator('#hint').click();await page.waitForFunction(()=>document.getElementById('status').textContent.includes('Перелей'));await page.locator('#menu').click();await page.getByRole('button',{name:'Если застрял',exact:true}).click();await page.getByRole('button',{name:'Добавить колбу',exact:true}).click();await page.reload();await page.locator('canvas').waitFor();const save=await page.evaluate(()=>JSON.parse(localStorage.getItem('water-sort-v1')));results.push({case:'muted-hint-extra-reload',savedSound:save.settings.sound,extra:Object.values(save.attempts)[0].extra,tubes:Object.values(save.attempts)[0].board.length,errors});await context.close();
}
// Evidence of help-text clipping on the smallest supported landscape, without confusing it with inaccessible buttons.
{
 const seed=JSON.parse(fs.readFileSync(new URL('../docs/audits/review-05/deadend-save.json',import.meta.url),'utf8')),{page,context,errors}=await open(null,seed);await page.setViewportSize({width:568,height:320});await page.locator('#rescue').click();const sizes=await page.locator('.dialog-body').evaluate(e=>({height:e.clientHeight,scrollHeight:e.scrollHeight,text:e.textContent}));const buttons=await page.locator('.dialog-actions button').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return {text:e.textContent,x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom}}));await page.screenshot({path:out+'/help-landscape.png'});results.push({case:'help-small-landscape',sizes,buttons,errors});await context.close();
}
// Dense maximum-color field before/after the real extra-tube action, including short portrait.
for(const [width,height]of [[320,480],[390,844],[568,320]]){
 const levels=JSON.parse(fs.readFileSync(new URL('../src/core/levels.json',import.meta.url),'utf8')),s=structuredClone(initial);s.current=11;s.completed=levels.slice(0,11).map(l=>l.id);
 const {page,context,errors}=await open(null,s);await page.setViewportSize({width,height});await page.waitForTimeout(300);
 const before=await page.locator('#board').boundingBox(),beforePose=layout(before.width,before.height,10)[0];await page.screenshot({path:out+`/dense-before-${width}x${height}.png`});
 await page.locator('#menu').click();await page.getByRole('button',{name:'Если застрял',exact:true}).click();await page.getByRole('button',{name:'Добавить колбу',exact:true}).click();await page.waitForTimeout(400);
 const after=await page.locator('#board').boundingBox(),poses=layout(after.width,after.height,11);await page.screenshot({path:out+`/dense-extra-${width}x${height}.png`});
 results.push({case:'dense-extra-layout',viewport:[width,height],before:beforePose,after:poses[0],rowsBefore:new Set(layout(before.width,before.height,10).map(p=>p.y)).size,rowsAfter:new Set(poses.map(p=>p.y)).size,minHitWidth:Math.min(...poses.map(p=>p.hitW)),minHitHeight:Math.min(...poses.map(p=>p.hitH)),errors});await context.close();
}
await browser.close();fs.writeFileSync(out+'/adversarial.json',JSON.stringify({results},null,2));console.log(JSON.stringify(results));
