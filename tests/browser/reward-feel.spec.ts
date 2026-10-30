import {test,expect,type Page} from '@playwright/test';
import {fresh,levels,moved,levelKey} from '../../src/core/session';
import {layout} from '../../src/game/geometry';
import {totalStars} from '../../src/core/progress';
async function prepare(page:Page,reduced=false){
 const s=levels[0].witness.slice(0,2).reduce((s,m)=>moved(s,m),fresh());s.settings.sound=false;
 await page.emulateMedia({reducedMotion:reduced?'reduce':'no-preference'});
 await page.addInitScript(s=>{if(!sessionStorage.reward16){localStorage.setItem('water-sort-v1',JSON.stringify(s));sessionStorage.reward16='1';}},s);
 await page.goto('/');await page.locator('#home-play').click();await page.waitForTimeout(300);
 await page.evaluate(async()=>{
  (window as any).arrivals=[];
  const path='/src/audio/sound.ts',m=await import(path),fn=m.Sound.prototype.collect;
  m.Sound.prototype.collect=function(i:number){(window as any).arrivals.push(i);return fn.call(this,i);};
  const scenePath='/src/game/WaterScene.ts',v=await import(scenePath),animate=v.WaterScene.prototype.animate;
  v.WaterScene.prototype.animate=function(...args:any[]){(window as any).waterScene=this;return animate.apply(this,args);};
 });
}
async function finish(page:Page){
 const b=(await page.locator('#board').boundingBox())!,ps=layout(b.width,b.height,4),m=levels[0].witness.at(-1)!;
 for(const i of [m.from,m.to])await page.mouse.click(b.x+ps[i].x,b.y+ps[i].y+ps[i].h/2);
 await expect(page.locator('#continue')).toBeVisible();
}
test('saved best result precedes cosmetic collection; replay and reload cannot farm stars',async({page})=>{
 await prepare(page);await finish(page);
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('water-sort-v1')!));
 expect(totalStars(saved)).toBe(3);expect(saved.best[levelKey(0)].history).toHaveLength(3);
 await expect.poll(()=>page.evaluate(()=>(window as any).arrivals.length)).toBe(3);
 await expect(page.locator('#star-total')).toHaveText('3');
 await page.reload();await page.locator('#home-play').click();await expect(page.locator('#earned-stars')).toHaveText('★★★');
 await page.waitForTimeout(1900);await expect(page.locator('.star-flight')).toHaveCount(0);
 await page.locator('#restart').click();await page.getByRole('button',{name:'Начать заново',exact:true}).click();
 const b=(await page.locator('#board').boundingBox())!,ps=layout(b.width,b.height,4);
 for(const m of levels[0].witness){for(const i of [m.from,m.to])await page.mouse.click(b.x+ps[i].x,b.y+ps[i].y+ps[i].h/2);if(m!==levels[0].witness.at(-1))await expect(page.locator('#hint')).toBeEnabled();}
 await expect(page.locator('#continue')).toBeVisible();await page.waitForTimeout(1800);
 await expect(page.locator('.star-flight')).toHaveCount(0);await expect(page.locator('#star-total')).toHaveText('3');
});
test('next cancels future reward arrivals and fountains without losing saved stars',async({page})=>{
 await prepare(page);
 // Snapshot at the actual click, before cancellation; remote click delivery can take
 // long enough for a legitimate star arrival to happen before the user event.
 await page.evaluate(()=>document.getElementById('continue')!.addEventListener('click',()=>{(window as any).arrivalsAtNext=[...(window as any).arrivals];},{capture:true,once:true}));
 await finish(page);await page.locator('#continue').click();
 await expect(page.locator('#level-title')).toHaveText('Уровень 2');await page.waitForTimeout(2000);
 const arrivals=await page.evaluate(()=>({atClick:(window as any).arrivalsAtNext,after:(window as any).arrivals}));expect(arrivals.atClick).toBeDefined();expect(arrivals.after).toEqual(arrivals.atClick);
 expect(await page.evaluate(()=>(window as any).waterScene.bursts)).toEqual([]);
 await expect(page.locator('.star-flight')).toHaveCount(0);await expect(page.locator('#star-total')).toHaveText('3');
});
test('an immediate next event cancels pending collection before its first arrival',async({page})=>{
 await prepare(page);
 await page.evaluate(()=>{
  const button=document.getElementById('continue') as HTMLButtonElement;
  const observer=new MutationObserver(()=>{
   if(button.hidden)return;observer.disconnect();
   (window as any).immediateNext={arrivals:[...(window as any).arrivals],revealing:document.getElementById('earned-stars')!.classList.contains('revealing-stars'),pendingBursts:(window as any).waterScene.bursts.length};
   button.click();
  });observer.observe(button,{attributes:true,attributeFilter:['hidden']});
 });
 const b=(await page.locator('#board').boundingBox())!,ps=layout(b.width,b.height,4),m=levels[0].witness.at(-1)!;
 for(const i of [m.from,m.to])await page.mouse.click(b.x+ps[i].x,b.y+ps[i].y+ps[i].h/2);
 await expect(page.locator('#level-title')).toHaveText('Уровень 2');
 const atClick=await page.evaluate(()=>(window as any).immediateNext);expect(atClick.arrivals).toEqual([]);expect(atClick.revealing).toBe(true);expect(atClick.pendingBursts).toBeGreaterThan(0);
 await page.waitForTimeout(2000);expect(await page.evaluate(()=>(window as any).arrivals)).toEqual([]);expect(await page.evaluate(()=>(window as any).waterScene.bursts)).toEqual([]);await expect(page.locator('.star-flight')).toHaveCount(0);await expect(page.locator('#star-total')).toHaveText('3');
});
test('background cancels future collection ticks, resume shows persisted total',async({page})=>{
 await prepare(page);await finish(page);
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});
 await page.waitForTimeout(1900);expect(await page.evaluate(()=>(window as any).arrivals)).toEqual([]);
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});document.dispatchEvent(new Event('visibilitychange'));});
 await expect(page.locator('#star-total')).toHaveText('3');await expect(page.locator('#continue')).toBeVisible();
});
test('reduced motion still collects exact progress with no stranded reward objects',async({page})=>{
 await prepare(page,true);await finish(page);
 await expect.poll(()=>page.evaluate(()=>(window as any).arrivals.length)).toBe(3);
 await expect(page.locator('#star-total')).toHaveText('3');await expect(page.locator('.star-flight')).toHaveCount(0);
 expect(await page.evaluate(()=>(window as any).waterScene.reduced)).toBe(true);
});
for(const [width,height]of [[320,480],[568,320]])test(`challenge label and reward counter fit ${width}x${height}`,async({page})=>{
 await page.setViewportSize({width,height});const s={...fresh(),current:7};
 await page.addInitScript(s=>localStorage.setItem('water-sort-v1',JSON.stringify(s)),s);await page.goto('/');
 await expect(page.locator('#home-challenge')).toBeVisible();await page.locator('#home-play').click();await expect(page.locator('#hard-badge')).toBeVisible();
 for(const id of ['star-bank','hard-badge','menu','settings']){const r=(await page.locator('#'+id).boundingBox())!;expect(r.x).toBeGreaterThanOrEqual(0);expect(r.y).toBeGreaterThanOrEqual(0);expect(r.x+r.width).toBeLessThanOrEqual(width);expect(r.y+r.height).toBeLessThanOrEqual(height);}
});
test('a colour completes on the first filled frame before the flight is cleared',async({page})=>{
 const s=moved(fresh(),levels[0].witness[0]);s.settings.sound=false;
 await page.addInitScript(s=>localStorage.setItem('water-sort-v1',JSON.stringify(s)),s);await page.goto('/');await page.locator('#home-play').click();await page.waitForTimeout(300);
 await page.evaluate(async()=>{
  const path='/src/game/WaterScene.ts',m=await import(path),fn=m.WaterScene.prototype.celebrate,animate=m.WaterScene.prototype.animate;
  (window as any).completions=[];
  m.WaterScene.prototype.animate=function(...args:any[]){
   const scene=this,update=this.sys.sceneUpdate;let previous=performance.now();
   this.sys.sceneUpdate=function(...frameArgs:any[]){const now=performance.now();scene.fillPreviousFrame=previous;previous=now;return update.apply(scene,frameArgs);};
   return animate.apply(this,args);
  };
  m.WaterScene.prototype.celebrate=function(index:number,final=false){const fullAt=this.flight.start+this.flight.timing.lift+this.flight.timing.flow;(window as any).completions.push({index,final,busy:this.busy,received:this.flight?.received,previousBeforeFill:this.fillPreviousFrame-fullAt,tail:performance.now()-fullAt});return fn.call(this,index,final);};
 });
 const b=(await page.locator('#board').boundingBox())!,ps=layout(b.width,b.height,4),m=levels[0].witness[1];
 for(const i of [m.from,m.to])await page.mouse.click(b.x+ps[i].x,b.y+ps[i].y+ps[i].h/2);
 await expect(page.locator('#hint')).toBeEnabled();const events=await page.evaluate(()=>(window as any).completions);
 expect(events).toHaveLength(1);expect(events[0]).toMatchObject({index:m.to,final:false,busy:true,received:true});expect(events[0].tail).toBeGreaterThanOrEqual(-1);expect(events[0].previousBeforeFill).toBeLessThan(1);
});
test('immediately reusing a completed vessel cancels its old cork contact',async({page})=>{
 const s=moved(fresh(),levels[0].witness[0]);s.settings.sound=false;
 await page.addInitScript(s=>localStorage.setItem('water-sort-v1',JSON.stringify(s)),s);await page.goto('/');await page.locator('#home-play').click();await page.waitForTimeout(300);
 await page.evaluate(async()=>{
  const path='/src/game/WaterScene.ts',m=await import(path),fn=m.WaterScene.prototype.animate;(window as any).seals=0;
  m.WaterScene.prototype.animate=function(...args:any[]){if(!(window as any).sealHook){(window as any).sealHook=true;const seal=this.onSeal;this.onSeal=()=>{(window as any).seals++;seal();};}return fn.apply(this,args);};
 });
 const b=(await page.locator('#board').boundingBox())!,ps=layout(b.width,b.height,4);
 for(const i of [0,1,1,2])await page.mouse.click(b.x+ps[i].x,b.y+ps[i].y+ps[i].h/2);
 await expect(page.locator('#status')).toContainText('Следующий ход');
 await expect(page.locator('#moves')).toHaveText('Ходов: 3');await expect(page.locator('#hint')).toBeEnabled();
 expect(await page.evaluate(()=>(window as any).seals)).toBe(0);
});
