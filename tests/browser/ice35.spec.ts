import {test,expect,type Page} from '@playwright/test';
import {fresh,levels,moved,attempt,goalFor,levelKey} from '../../src/core/session';
import {isFrozen,iceOpen,moveFor} from '../../src/core/rules';
import {mockReward,toggleSymbols} from './navigation';
import {advanceFrames} from './controlled-frames';
async function saved(page:Page){return page.evaluate(()=>JSON.parse(localStorage.getItem('water-sort-v1')!));}
async function open(page:Page,index=28,n=0){let s={...fresh(),current:index};s.settings.sound=false;s.completed=levels.slice(0,index).map(l=>l.id);for(const m of levels[index].witness.slice(0,n))s=moved(s,m);
 await page.addInitScript(s=>{if(sessionStorage.ice35)return;sessionStorage.ice35='1';localStorage.setItem('water-sort-v1',JSON.stringify(s));},s);await page.goto('/');
 await page.evaluate(async()=>{const p='/src/game/WaterScene.ts',m=await import(p),fn=m.WaterScene.prototype.positions;m.WaterScene.prototype.positions=function(){(window as any).iceScene=this;return fn.call(this);};});
 await page.locator('#home-play').click();await expect.poll(()=>page.evaluate(()=>!!(window as any).iceScene)).toBe(true);await page.waitForTimeout(280);return s;
}
async function tap(page:Page,i:number){const b=(await page.locator('#board').boundingBox())!,r=await page.evaluate(i=>(window as any).iceScene.positions()[i],i);await page.mouse.click(b.x+r.x,b.y+r.y+r.h/2);}
async function move(page:Page,from:number,to:number){await tap(page,from);await tap(page,to);await expect(page.locator('#hint')).toBeEnabled();}
async function record(page:Page){await page.evaluate(async()=>{const s=(window as any).iceScene,fn=s.thaw;(window as any).iceEvents=[];s.thaw=function(index:number){const received=this.flight?.received,result=fn.call(this,index);(window as any).iceEvents.push({index,received,held:this.iceHeld});return result;};const h='/src/platform/haptics.ts',hm=await import(h),play=hm.TouchFeedback.prototype.play;(window as any).iceTouches=[];hm.TouchFeedback.prototype.play=function(...a:any[]){(window as any).iceTouches.push(a[0]);return play.apply(this,a);};const p='/src/audio/sound.ts',m=await import(p),ice=m.Sound.prototype.ice;(window as any).iceSounds=0;m.Sound.prototype.ice=function(){(window as any).iceSounds++;return ice.call(this);};});}

test('field has no MINI/GOAL captions or symbols button; colour symbols live in settings',async({page})=>{
 await open(page,22);await expect(page.locator('#meta button')).toHaveCount(0);await expect(page.locator('#symbols')).toHaveCount(0);expect(await page.evaluate(()=>(window as any).iceScene.activeLabels.some((l:any)=>['МИНИ','ЦЕЛЬ'].includes(l.text)))).toBe(false);
 await toggleSymbols(page);expect((await saved(page)).settings.symbols).toBe(true);await expect(page.locator('#meta')).not.toContainText('Метки');await page.reload();await page.locator('#home-play').click();expect((await saved(page)).settings.symbols).toBe(true);
});

test('ice blocks matching pours, opens on visible fill once and Undo restores the gate',async({page})=>{
 await page.clock.install();await open(page);await record(page);await expect(page.locator('#objective')).toHaveText('Собери цвет — лёд расколется');await tap(page,0);expect(attempt(await saved(page)).history).toHaveLength(0);
 const first=levels[28].witness[0];await move(page,first.from,first.to);await tap(page,1);await tap(page,0);expect(attempt(await saved(page)).history).toHaveLength(1);expect(isFrozen(goalFor(await saved(page)),0)).toBe(true);
 await page.clock.pauseAt(new Date(await page.evaluate(()=>Date.now())+1000));const unlock=levels[28].witness[1];await tap(page,unlock.from);await tap(page,unlock.to);
 expect(iceOpen(goalFor(await saved(page)))).toBe(true);expect(await page.evaluate(()=>(window as any).iceScene.iceHeld)).toBe(0);
 await advanceFrames(page,'iceScene',1400);expect(await page.evaluate(()=>(window as any).iceEvents)).toEqual([{index:0,received:true,held:null}]);expect(await page.evaluate(()=>(window as any).iceSounds)).toBe(1);expect(await page.evaluate(()=>(window as any).iceTouches.filter((x:string)=>x==='ice').length)).toBe(1);expect(await page.evaluate(()=>(window as any).iceTouches.includes('color'))).toBe(false);expect(await page.evaluate(()=>(window as any).iceScene.frozen(0))).toBe(false);await expect(page.locator('#continue')).toBeHidden();await page.clock.resume();
 await page.locator('#undo').click();await expect(page.locator('#hint')).toBeEnabled();expect(isFrozen(goalFor(await saved(page)),0)).toBe(true);expect(await page.evaluate(()=>(window as any).iceScene.iceRelease)).toBeUndefined();
});

test('earned thaw survives reload, and restarting restores the original frozen layout',async({page})=>{
 await open(page,28,2);expect(iceOpen(goalFor(await saved(page)))).toBe(true);await record(page);await page.reload();await page.locator('#home-play').click();expect(iceOpen(goalFor(await saved(page)))).toBe(true);
 await page.locator('#restart').click();await page.getByRole('button',{name:'Начать заново',exact:true}).click();expect(isFrozen(goalFor(await saved(page)),0)).toBe(true);expect(attempt(await saved(page)).board).toEqual(levels[28].initial);
});

for(const [index,n]of [[33,8],[33,9]])test(`real worker respects ice access before/after thaw at history ${n}`,async({page})=>{
 await open(page,index,n);await page.locator('#hint').click();await expect(page.locator('#status')).toContainText('Перелей');const hint=await page.evaluate(()=>(window as any).iceScene.hintMove),s=await saved(page);expect(hint).toEqual(moveFor(attempt(s).board,hint.from,hint.to,goalFor(s)));if(!iceOpen(goalFor(s))){expect(hint.from).not.toBe(2);expect(hint.to).not.toBe(2);}await tap(page,hint.to);await expect(page.locator('#hint')).toBeEnabled();expect(attempt(await saved(page)).history).toHaveLength(n+1);
});

for(const [width,height]of [[320,480],[390,844],[568,320]])test(`ice combined with two goals completes and replays at ${width}x${height}`,async({page})=>{
 await page.setViewportSize({width,height});await open(page,33,levels[33].witness.length-1);const m=levels[33].witness.at(-1)!;await tap(page,m.from);await tap(page,m.to);await expect(page.locator('#continue')).toBeVisible();await expect(page.locator('#earned-stars')).toHaveText('★★★');
 const s=await saved(page);expect(s.best[levelKey(33)].history).toHaveLength(levels[33].witness.length);expect(attempt(s).thawed).toBe(true);const boxes=await page.evaluate(()=>['board','continue'].map(id=>{const r=document.getElementById(id)!.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom};}));for(const r of boxes){expect(r.x).toBeGreaterThanOrEqual(0);expect(r.right).toBeLessThanOrEqual(width);expect(r.bottom).toBeLessThanOrEqual(height);}expect(boxes[1].y).toBeGreaterThanOrEqual(boxes[0].bottom);
 await page.locator('#continue').click();await expect(page.getByRole('heading',{name:'Уровни',exact:true})).toBeVisible();await page.locator('.levels button').nth(33).click();expect(isFrozen(goalFor(await saved(page)),2)).toBe(true);expect(attempt(await saved(page)).history).toEqual([]);
});

test('rewarded ordinary buffer preserves locked ice; restart retains the ad slot and refreezes',async({page})=>{
 await open(page,29,2);await mockReward(page);const before=await saved(page);await page.locator('#extra-tube').click();await page.getByRole('button',{name:'Смотреть рекламу',exact:true}).click();await expect(page.locator('dialog')).toBeHidden();let s=await saved(page);expect(attempt(s).board).toEqual([...attempt(before).board,[]]);expect(isFrozen(goalFor(s),0)).toBe(true);
 const unlock=levels[29].witness[2];await move(page,unlock.from,unlock.to);expect(iceOpen(goalFor(await saved(page)))).toBe(true);await page.locator('#restart').click();await page.getByRole('button',{name:'Начать заново',exact:true}).click();s=await saved(page);expect(attempt(s).extra).toBe(true);expect(isFrozen(goalFor(s),0)).toBe(true);await page.reload();await page.locator('#home-play').click();expect(attempt(await saved(page)).extra).toBe(true);
});

test('reduced motion releases ice without a continuing decorative loop',async({page})=>{
 await page.clock.install();await page.emulateMedia({reducedMotion:'reduce'});await open(page,28,1);await record(page);await page.clock.pauseAt(new Date(await page.evaluate(()=>Date.now())+1000));const m=levels[28].witness[1];await tap(page,m.from);await tap(page,m.to);await advanceFrames(page,'iceScene',1300);expect(await page.evaluate(()=>{const s=(window as any).iceScene;return {reduced:s.reduced,releasing:!!s.iceRelease,frozen:s.frozen(0),waves:s.liquid.size};})).toEqual({reduced:true,releasing:false,frozen:false,waves:0});await page.clock.resume();
});

test('leaving before visual thaw cancels its sound/effects and retains the accepted earned access',async({page})=>{
 await page.clock.install();await open(page,28,1);await record(page);await page.clock.pauseAt(new Date(await page.evaluate(()=>Date.now())+1000));const m=levels[28].witness[1];await tap(page,m.from);await tap(page,m.to);await page.locator('#menu').click();await expect(page.locator('#home')).toBeVisible();await page.clock.fastForward(1000);expect(await page.evaluate(()=>(window as any).iceSounds)).toBe(0);expect(await page.evaluate(()=>{const s=(window as any).iceScene;return s.iceHeld===null&&!s.iceRelease;})).toBe(true);await page.clock.resume();await page.locator('#home-play').click();expect(iceOpen(goalFor(await saved(page)))).toBe(true);
});

test('fracture audio is a bounded decoded material sample',async({page})=>{
 await page.goto('/');const stats=await page.evaluate(async()=>{const p='/src/audio/ice.ts',m=await import(p),c=new AudioContext(),r=await fetch(m.ICE_AUDIO),b=await c.decodeAudioData(await r.arrayBuffer()),s=b.getChannelData(0);let peak=0,energy=0;for(const x of s){peak=Math.max(peak,Math.abs(x));energy+=x*x;}await c.close();return {peak,rms:Math.sqrt(energy/s.length),duration:b.duration};});expect(stats.peak).toBeLessThan(.85);expect(stats.rms).toBeGreaterThan(.025);expect(stats.duration).toBeLessThan(.5);
});
