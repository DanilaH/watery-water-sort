// CPU update cost only; this diagnostic is not a phone FPS/GPU/battery measurement.
import {chromium} from 'playwright';import fs from 'node:fs';
import {fresh,levels,moved,displaySlots} from '../src/core/session.ts';import {layout} from '../src/game/geometry.ts';
const out=process.env.UI_AUDIT_DIR??'test-results/feel-19';fs.mkdirSync(out,{recursive:true});const browser=await chromium.launch({args:['--no-sandbox']}),results=[];
for(const rate of [1,4]){
 const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2}),page=await context.newPage(),s=levels[11].witness.slice(0,-1).reduce((s,m)=>moved(s,m),{...fresh(),current:11});s.settings.sound=false;
 await page.addInitScript(s=>localStorage.setItem('water-sort-v1',JSON.stringify(s)),s);await page.goto(process.argv[2]??'http://127.0.0.1:4177');await page.locator('#home-play').click();await page.waitForTimeout(500);
 await page.evaluate(async()=>{const path='/src/game/WaterScene.ts',m=await import(path),animate=m.WaterScene.prototype.animate;
  m.WaterScene.prototype.animate=function(...args){const r=animate.apply(this,args),scene=this,update=this.sys.sceneUpdate.bind(this);window.renderStats=[];this.sys.sceneUpdate=function(...args){const phase=scene.flight?'pour':scene.bursts.length?'victory':'idle',start=performance.now();update(...args);window.renderStats.push({phase,ms:performance.now()-start,particles:scene.particles.length,bursts:scene.bursts.length});};return r;};
 });
 const cdp=await context.newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate});
 const box=await page.locator('#board').boundingBox(),ps=layout(box.width,box.height,displaySlots(s)),m=levels[11].witness.at(-1);
 for(const i of [m.from,m.to])await page.mouse.click(box.x+ps[i].x,box.y+ps[i].y+ps[i].h/2);await page.waitForTimeout(5400);
 const samples=await page.evaluate(()=>window.renderStats);const phases={};for(const phase of ['pour','victory','idle']){const values=samples.filter(x=>x.phase===phase).map(x=>x.ms).sort((a,b)=>a-b);phases[phase]={samples:values.length,p50:values[Math.floor(values.length*.5)],p95:values[Math.floor(values.length*.95)],max:values.at(-1)};}
 results.push({cpuThrottle:rate,phases,maxStoredParticles:Math.max(...samples.map(x=>x.particles)),maxBursts:Math.max(...samples.map(x=>x.bursts))});await context.close();
}
await browser.close();const report={results,note:'Headless Chromium dev server; DPR 2; final eight-colour pour and overlapping full-screen victory; 64 droplets per ordinary vessel, 96 for the goal. CPU update only; no claim about real Android FPS, rendering, speakers or haptics.'};fs.writeFileSync(out+'/render.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
