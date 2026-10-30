import {test,expect,type Page} from '@playwright/test';
import {fresh,levels,moved,displaySlots} from '../../src/core/session';
import {layout,goalLayout} from '../../src/game/geometry';
async function open(page:Page,index=0,last=false){
 let s={...fresh(),current:index};if(last)for(const m of levels[index].witness.slice(0,-1))s=moved(s,m);s.settings.sound=false;
 await page.addInitScript(s=>localStorage.setItem('water-sort-v1',JSON.stringify(s)),s);await page.goto('/');await page.locator('#home-play').click();await page.waitForTimeout(300);
 await page.evaluate(async()=>{const p='/src/game/WaterScene.ts',m=await import(p),fn=m.WaterScene.prototype.positions;m.WaterScene.prototype.positions=function(){(window as any).scene19=this;return fn.call(this);};});
}
async function tap(page:Page,i:number){const b=(await page.locator('#board').boundingBox())!,s=await page.evaluate(()=>JSON.parse(localStorage.getItem('water-sort-v1')!)),ps=levels[s.current].goal?goalLayout(b.width,b.height,displaySlots(s),0):layout(b.width,b.height,displaySlots(s)),p=ps[i];await page.mouse.click(b.x+p.x,b.y+p.y+p.h/2);}
async function move(page:Page,from:number,to:number){await tap(page,from);await tap(page,to);}
for(const [width,height]of [[320,480],[390,844],[568,320]])test(`goal edges align with actual rows, without a fraction counter ${width}x${height}`,async({page})=>{
 await page.setViewportSize({width,height});await open(page,15);await tap(page,1);
 const data=await page.evaluate(()=>{const s=(window as any).scene19,ps=s.positions();return {goal:ps[0],top:Math.min(...ps.slice(1).map((p:any)=>p.y)),bottom:Math.max(...ps.slice(1).map((p:any)=>p.y+p.h)),texts:s.activeLabels.map((l:any)=>l.text)};});
 expect(data.goal.y).toBeCloseTo(data.top,5);expect(data.goal.y+data.goal.h).toBeCloseTo(data.bottom,5);expect(data.texts.some((t:string)=>/\/\s*8/.test(t))).toBe(false);
});
test('potential stars react to overspending and Undo; exact conditions remain reachable',async({page})=>{
 await open(page,0,true);await move(page,1,2);await expect(page.locator('#hint')).toBeEnabled();await move(page,2,1);await expect(page.locator('#hint')).toBeEnabled();
 await expect(page.locator('#star-target [data-filled=true]')).toHaveCount(2);await expect(page.locator('#star-target .star-lost')).toHaveCount(1);
 await page.locator('#undo').click();await expect(page.locator('#star-target [data-filled=true]')).toHaveCount(3);await page.locator('#star-target').click();await expect(page.getByRole('heading',{name:'Звёзды за уровень'})).toBeVisible();await expect(page.locator('.dialog-body')).toContainText('не больше 3 ходов');await expect(page.locator('.dialog-body')).toContainText('не больше 5');
});
test('word, stars, fountains and breathing next button coexist, with continuing idle movement',async({page})=>{
 await open(page,0,true);const last=levels[0].witness.at(-1)!;await move(page,last.from,last.to);await expect(page.locator('#continue')).toBeVisible();
 await expect(page.locator('#victory-effects')).toBeVisible();await expect.poll(()=>page.locator('#earned-stars .lit').count()).toBe(3);
 const styles=await page.evaluate(()=>({letters:document.querySelectorAll('.victory-letter').length,wave:getComputedStyle(document.querySelector('.victory-letter-wave')!).animationName,star:getComputedStyle(document.querySelector('.result-star .star-spark')!).animationName,next:getComputedStyle(document.getElementById('continue')!).animationName,nextSkin:getComputedStyle(document.getElementById('continue')!,'::before').animationName}));
 expect(styles.letters).toBe('Идеально!'.length);expect(styles.wave).toBe('letter-wave');expect(styles.star).toBe('star-idle');expect(styles.next).toBe('none');expect(styles.nextSkin).toBe('gel-continue-breathe');
 const hitBefore=(await page.locator('#continue').boundingBox())!;const a=await page.locator('.victory-letter-wave').first().evaluate(e=>e.getBoundingClientRect().y);await page.waitForTimeout(300);const b=await page.locator('.victory-letter-wave').first().evaluate(e=>e.getBoundingClientRect().y);expect(Math.abs(a-b)).toBeGreaterThan(.05);const hitAfter=(await page.locator('#continue').boundingBox())!;for(const key of ['x','y','width','height'] as const)expect(Math.abs(hitBefore[key]-hitAfter[key])).toBeLessThan(.01);
 await page.locator('#continue').click();await expect(page.locator('#victory-effects')).toHaveCount(0);
});
test('large bottle supplies heavy fill and pop events while small bottles stay ordinary',async({page})=>{
 await open(page,12,true);await tap(page,1);await page.evaluate(()=>{const s=(window as any).scene19,w=window as any;w.heavyBeats=[];w.heavyPops=[];const phase=s.onPhase,pop=s.onFinale;s.onPhase=(n:number,heavy:boolean)=>{w.heavyBeats.push({n,heavy});phase(n,heavy);};s.onFinale=(n:number,heavy:boolean)=>{w.heavyPops.push({n,heavy});pop(n,heavy);};});
 await tap(page,0);await expect(page.locator('#continue')).toBeVisible();await expect.poll(()=>page.evaluate(()=>(window as any).heavyPops.length)).toBe(2);
 const data=await page.evaluate(()=>({beats:(window as any).heavyBeats,pops:(window as any).heavyPops}));expect(data.beats).toEqual([{n:0,heavy:true},{n:1,heavy:true},{n:2,heavy:true}]);expect(data.pops.filter((b:any)=>b.heavy)).toHaveLength(1);expect(data.pops.filter((b:any)=>!b.heavy)).toHaveLength(1);
});
test('reduced motion disables letter, star and button loops while preserving readable rewards',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await open(page,0,true);const m=levels[0].witness.at(-1)!;await move(page,m.from,m.to);await expect(page.locator('#continue')).toBeVisible();await expect.poll(()=>page.locator('#earned-stars .lit').count()).toBe(3);
 for(const selector of ['.victory-letter','.victory-letter-wave','.result-star .star-spark','#continue'])expect(await page.locator(selector).first().evaluate(e=>getComputedStyle(e).animationName)).toBe('none');await expect(page.getByRole('heading',{name:'Идеально!'})).toBeVisible();
});
