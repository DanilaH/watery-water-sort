// Read-only audit of 0.7; diagnostics run outside the production bundle.
import {chromium} from 'playwright';import {layout} from '../src/game/geometry.ts';import fs from 'node:fs';
const out=process.env.UI_AUDIT_DIR??'test-results/full-review-07',url=process.argv[2]??'http://127.0.0.1:4175';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox']}),results=[],errors=[],levels=JSON.parse(fs.readFileSync(new URL('../src/core/levels.json',import.meta.url)));
const fresh=(current=0)=>({schema:1,artVersion:4,current,revision:0,completed:levels.slice(0,current).map(l=>l.id),attempts:{},settings:{sound:true,fast:false,symbols:false,light:false}});
async function open(seed=fresh(),init){const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(s=>{if(!sessionStorage.seed){localStorage.setItem('water-sort-v1',JSON.stringify(s));sessionStorage.seed='1';}},seed);if(init)await page.addInitScript(init);await page.goto(url);return {page,context};}
async function controls(page,count=4){await page.locator('canvas').waitFor();await page.waitForTimeout(180);const b=await page.locator('#board').boundingBox(),ps=layout(b.width,b.height,count);return async i=>page.mouse.click(b.x+ps[i].x,b.y+ps[i].y+ps[i].h/2);}
const hist=p=>p.evaluate(()=>Object.values(JSON.parse(localStorage.getItem('water-sort-v1')).attempts).flatMap(a=>a.history));
// Failure after a successful move, followed by storage recovery.
{
 const {page,context}=await open(),tap=await controls(page);await tap(0);await tap(2);await page.waitForTimeout(650);
 await page.evaluate(()=>{const set=Storage.prototype.setItem;window.restoreStorage=()=>Storage.prototype.setItem=set;Storage.prototype.setItem=function(k,v){if(k.startsWith('water-sort-v1'))throw new DOMException('full','QuotaExceededError');return set.call(this,k,v)}});
 await page.locator('#undo').click();const failed={status:await page.locator('#status').textContent(),hintDisabled:await page.locator('#hint').isDisabled(),history:(await hist(page)).length};await page.screenshot({path:out+'/undo-storage-failure.png'});await page.evaluate(()=>window.restoreStorage());await tap(1);await tap(0);await page.waitForTimeout(650);results.push({case:'undo-write-failure-then-recovery',failed,recoveredHistory:(await hist(page)).length});await context.close();
}
// Failure while a visual flight is in progress.
{
 const {page,context}=await open(),tap=await controls(page);await tap(0);await tap(2);await page.evaluate(()=>{Storage.prototype.setItem=function(){throw new DOMException('full','QuotaExceededError')}});await page.locator('#undo').click();await page.waitForTimeout(800);results.push({case:'undo-write-failure-during-flight',hintDisabled:await page.locator('#hint').isDisabled(),status:await page.locator('#status').textContent(),history:(await hist(page)).length});await page.screenshot({path:out+'/interrupted-undo-failure.png'});await context.close();
}
// Storage reads blocked at boot (no synthetic application hooks).
{
 const before=errors.length,{page,context}=await open(fresh(),()=>{Storage.prototype.getItem=function(k){if(k.startsWith('water-sort-v1'))throw new DOMException('blocked','SecurityError');return null;}});await page.waitForTimeout(700);results.push({case:'storage-read-unavailable',canvas:await page.locator('canvas').count(),error:errors.slice(before)});await page.screenshot({path:out+'/storage-read-unavailable.png'});await context.close();
}
// Real backup recovery, corrupted primary, then successful next move and reload.
{
 const {page,context}=await open(),tap=await controls(page);await tap(0);await tap(2);await page.waitForTimeout(620);await tap(1);await tap(0);await page.waitForTimeout(620);await page.evaluate(()=>localStorage.setItem('water-sort-v1','broken'));await page.reload();await page.locator('canvas').waitFor();const recoveredMessage=await page.locator('#status').textContent();const tap2=await controls(page);await tap2(1);await tap2(0);await page.waitForTimeout(620);await page.reload();results.push({case:'backup-recovery',recoveredMessage,history:(await hist(page)).length,canvas:await page.locator('canvas').count()});await context.close();
}
// UI measurements at a won state on narrow devices.
{
 const seed=fresh();let board=structuredClone(levels[0].initial);for(const m of levels[0].witness){board[m.to].push(...board[m.from].splice(-m.amount))}seed.attempts[`${levels[0].id}@${levels[0].version}`]={board,history:levels[0].witness,extra:false};seed.completed=[levels[0].id];
 const {page,context}=await open(seed);await controls(page);for(const [width,height]of [[320,480],[568,320],[390,844]]){await page.setViewportSize({width,height});await page.waitForTimeout(150);const measured=await page.locator('#feedback').evaluate(f=>({height:f.getBoundingClientRect().height,statusFont:getComputedStyle(document.querySelector('#status')).fontSize,continueHeight:document.querySelector('#continue').getBoundingClientRect().height,textOverflow:document.querySelector('#status').scrollWidth>document.querySelector('#status').clientWidth}));results.push({case:'won-layout',viewport:[width,height],...measured});await page.screenshot({path:`${out}/won-${width}x${height}.png`});}await context.close();
}
// CPU and redraw frequency on dense field. Browser measurements are not phone benchmarks.
for(const throttle of [1,4]){
 const {page,context}=await open(fresh(11)),tap=await controls(page,levels[11].initial.length),cdp=await context.newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:throttle});
 await page.evaluate(async()=>{const path='/src/game/WaterScene.ts',m=await import(path),orig=m.WaterScene.prototype.positions;m.WaterScene.prototype.positions=function(){window.auditScene=this;m.WaterScene.prototype.positions=orig;return orig.call(this)}});await tap(0);await page.mouse.click(18,120);await page.waitForTimeout(700);
 await page.evaluate(()=>{const s=window.auditScene,orig=s.sys.sceneUpdate.bind(s),clear=s.ink.clear.bind(s.ink),render=s.game.renderer.render.bind(s.game.renderer);window.perf={updates:[],redraws:0,renders:0};s.sys.sceneUpdate=function(...a){const t=performance.now();orig(...a);window.perf.updates.push(performance.now()-t)};s.ink.clear=function(...a){window.perf.redraws++;return clear(...a)};s.game.renderer.render=function(...a){window.perf.renders++;return render(...a)}});
 await page.waitForTimeout(2000);const idle=await page.evaluate(()=>window.perf);await page.evaluate(()=>window.perf={updates:[],redraws:0,renders:0});
 const m=levels[11].witness[0];await tap(m.from);await tap(m.to);await page.waitForTimeout(750);const active=await page.evaluate(()=>window.perf);const summarize=x=>{const a=x.updates.sort((a,b)=>a-b);return {frames:a.length,redraws:x.redraws,renders:x.renders,p50UpdateMs:a[Math.floor(a.length*.5)],p95UpdateMs:a[Math.floor(a.length*.95)],maxUpdateMs:a.at(-1)}};results.push({case:'dense-render-cost',throttle,idle:summarize(idle),active:summarize(active)});await context.close();
}
await browser.close();fs.writeFileSync(out+'/results.json',JSON.stringify({results,errors},null,2));console.log(JSON.stringify({results,errors}));
