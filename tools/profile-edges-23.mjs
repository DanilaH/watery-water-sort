// Scene-update CPU timing only; this is not an Android GPU/FPS benchmark.
import {chromium} from 'playwright';import {writeFileSync} from 'node:fs';
const browser=await chromium.launch(),results=[];
for(const [current,width,height,dpr]of [[0,390,844,3],[11,320,480,2.75],[12,390,844,3]]){
 const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:dpr});await page.goto('http://127.0.0.1:4178');await page.evaluate(async current=>{const p='/src/core/session.ts',m=await import(p),s=m.fresh();s.current=current;s.settings.sound=false;localStorage.setItem('water-sort-v1',JSON.stringify(s));},current);await page.reload();await page.locator('#home-play').click();await page.waitForTimeout(350);
 await page.evaluate(async()=>{const p='/src/game/WaterScene.ts',m=await import(p),fn=m.WaterScene.prototype.positions;m.WaterScene.prototype.positions=function(){window.edgeScene=this;return fn.call(this);};});await page.locator('#symbols').click();await page.waitForTimeout(100);
 await page.evaluate(()=>{const s=window.edgeScene,sys=s.sys,fn=sys.sceneUpdate;window.edgeTimes=[];sys.sceneUpdate=function(...a){const start=performance.now(),busy=s.busy;try{return fn.apply(this,a);}finally{if(busy)window.edgeTimes.push(performance.now()-start);}};});
 await page.evaluate(()=>{const s=window.edgeScene;s.onTap(s.goal?3:1);});await page.waitForTimeout(50);await page.evaluate(current=>{const s=window.edgeScene;s.onTap(s.goal?0:current===11?8:3);},current);await page.waitForTimeout(900);
 const timing=await page.evaluate(()=>{const a=window.edgeTimes.sort((a,b)=>a-b);return {frames:a.length,p95:a[Math.floor(a.length*.95)],max:a.at(-1)};});const render=await page.locator("#board canvas").evaluate(c=>({width:c.width,height:c.height}));results.push({current,viewport:{width,height,dpr},render,...timing});await page.close();
}
await browser.close();writeFileSync(process.argv[2],JSON.stringify({scope:'Browser scene update CPU time only; no physical Android GPU measurement',results},null,2));console.log(JSON.stringify(results));
