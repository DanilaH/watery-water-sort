// Same UI/board in both variants. Disable only settled-vessel/layout caching in the control.
import {chromium} from 'playwright';import {layout} from '../src/game/geometry.ts';import fs from 'node:fs';
const out=process.env.UI_AUDIT_DIR??'test-results/recovery-08',url=process.argv[2]??'http://127.0.0.1:4175';fs.mkdirSync(out,{recursive:true});const levels=JSON.parse(fs.readFileSync(new URL('../src/core/levels.json',import.meta.url))),browser=await chromium.launch({headless:true,args:['--no-sandbox']}),results=[];
for(const throttle of [1,4])for(const cached of [false,true]){
 const all=[],idle=[],counts=[];
 for(let repeat=0;repeat<3;repeat++){
  const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2}),page=await context.newPage();await page.addInitScript(()=>localStorage.setItem('water-sort-v1',JSON.stringify({schema:1,artVersion:4,current:11,revision:0,completed:[],attempts:{},settings:{sound:false,fast:false,symbols:false,light:false}})));await page.goto(url);await page.locator('canvas').waitFor();await page.waitForTimeout(250);
  await page.evaluate(async()=>{const p='/src/game/WaterScene.ts',m=await import(p),orig=m.WaterScene.prototype.positions;m.WaterScene.prototype.positions=function(){window.benchScene=this;m.WaterScene.prototype.positions=orig;return orig.call(this);};});
  const b=await page.locator('#board').boundingBox(),ps=layout(b.width,b.height,10);await page.mouse.click(b.x+1,b.y+1);await page.waitForTimeout(700);const cdp=await context.newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:throttle});
  await page.evaluate(async cached=>{const s=window.benchScene;if(!cached){s.restingTube=function(r,l,selected,target,i,now){this.tube(r,l,0,selected,target,i,now)};const p='/src/game/geometry.ts',g=await import(p);s.positions=function(){return g.layout(this.viewWidth,this.viewHeight,this.slots)}}const update=s.sys.sceneUpdate.bind(s),tube=s.tube.bind(s);window.bench={times:[],tubeCalls:0};s.tube=function(...a){window.bench.tubeCalls++;return tube(...a)};s.sys.sceneUpdate=function(...a){const t=performance.now();update(...a);window.bench.times.push(performance.now()-t)};},cached);
  await page.waitForTimeout(700);idle.push(...await page.evaluate(()=>window.bench.times));await page.evaluate(()=>window.bench={times:[],tubeCalls:0});
  const m=levels[11].witness[0];for(const i of [m.from,m.to])await page.mouse.click(b.x+ps[i].x,b.y+ps[i].y+ps[i].h/2);await page.waitForTimeout(750);const r=await page.evaluate(()=>window.bench);all.push(...r.times);counts.push(r.tubeCalls);await context.close();
 }
 const stats=a=>{a.sort((a,b)=>a-b);return {samples:a.length,p50Ms:a[Math.floor(a.length*.5)],p95Ms:a[Math.floor(a.length*.95)],maxMs:a.at(-1)}};results.push({throttle,cached,active:stats(all),idle:stats(idle),tubeCalls:counts});
}
await browser.close();fs.writeFileSync(out+'/render-benchmark.json',JSON.stringify({results,note:'Headless Chromium dev server, three contexts per variant, same 390x844 dense field, real-time first pour. CPU update cost only, not phone FPS/GPU/battery. Control disables both new caches in diagnostic hooks.'},null,2));console.log(JSON.stringify(results));
