import {hint48,home48} from './navigation';
import legacy from '../../src/core/levels-v1.json' with {type:'json'};
import {mockReward} from './navigation';
import {test,expect,type Page} from '@playwright/test';
import {fresh,levels,moved,attempt,goalFor,levelKey,replay,type Level,type Save} from '../../src/core/session';
import {won,moves} from '../../src/core/rules';
import {advanceFrames} from './controlled-frames';
async function saved(p:Page){return p.evaluate(()=>JSON.parse(localStorage.getItem('water-sort-v1')!));}
async function open(p:Page,index=4,n=0,old=false){let s={...fresh(),current:index};s.settings.sound=false;s.wallet!.hints=100;const l=old?legacy[index]as Level:levels[index];if(old)s.attempts[`${l.id}@1`]=replay(l,[],false);for(const m of l.witness.slice(0,n))s=moved(s,m);await p.addInitScript(s=>{if(sessionStorage.audit38)return;sessionStorage.audit38='1';localStorage.setItem('water-sort-v1',JSON.stringify(s));},s);await p.goto('/');await p.evaluate(async()=>{const path='/src/game/WaterScene.ts',m=await import(path),fn=m.WaterScene.prototype.positions;m.WaterScene.prototype.positions=function(){(window as any).auditScene=this;return fn.call(this);};const WorkerBase=window.Worker;(window as any).workerCalls38=0;window.Worker=class extends WorkerBase{constructor(...args:ConstructorParameters<typeof Worker>){super(...args);(window as any).workerCalls38++;}};});await p.locator('#home-play').click();await expect.poll(()=>p.evaluate(()=>!!(window as any).auditScene?.ready)).toBe(true);await p.waitForTimeout(300);}
async function tap(p:Page,i:number){const b=(await p.locator('#board canvas').boundingBox())!,r=await p.evaluate(i=>(window as any).auditScene.positions()[i],i);await p.mouse.click(b.x+r.x,b.y+r.y+r.h/2);}

test('following successive UI hints finishes the formerly cycling puzzle using one verified Worker route',async({page})=>{
 test.setTimeout(60000);await page.clock.install();await open(page);await page.clock.pauseAt(new Date(await page.evaluate(()=>Date.now())+1000));let n=0;
 while(!won(attempt(await saved(page)).board,goalFor(await saved(page)))){
  await hint48(page);await expect(page.locator('#status')).toContainText('Перелей');const m=await page.evaluate(()=>(window as any).auditScene.hintMove);expect(m).not.toBeNull();await tap(page,m.to);
  // This checks route continuity, not intermediate rendering (covered in the effect tests).
  await page.clock.fastForward(1200);await page.evaluate(()=>(window as any).auditScene.update());expect(++n).toBeLessThan(40);if(n===4){await home48(page);await page.locator('#home-play').click();}
 }
 expect(await page.evaluate(()=>(window as any).workerCalls38)).toBe(1);expect(n).toBe(12);await page.clock.resume();await expect(page.locator('#continue')).toBeVisible();
});

test('deviation and Undo discard the old recommendation instead of consuming stale moves',async({page})=>{
 await page.clock.install();await open(page,0);await page.clock.pauseAt(new Date(await page.evaluate(()=>Date.now())+1000));await hint48(page);await expect(page.locator('#status')).toContainText('Перелей');const m=await page.evaluate(()=>(window as any).auditScene.hintMove),s=await saved(page),other=moves(attempt(s).board,goalFor(s)).find(q=>q.from!==m.from||q.to!==m.to)!;
 await tap(page,m.from);await tap(page,other.from);await tap(page,other.to);await advanceFrames(page,'auditScene',1200);expect(attempt(await saved(page)).history).toHaveLength(1);await hint48(page);await expect(page.locator('#status')).toContainText('Перелей');expect(await page.evaluate(()=>(window as any).workerCalls38)).toBe(2);
 await page.locator('#undo').click();await advanceFrames(page,'auditScene',1000);await hint48(page);await expect(page.locator('#status')).toContainText('Перелей');expect(await page.evaluate(()=>(window as any).workerCalls38)).toBe(3);await page.clock.resume();
});

test('engine and covered game animations sleep while menu hero keeps moving; nested blockers wake only when all close',async({page})=>{
 await open(page,0);const running=()=>page.evaluate(()=>(window as any).auditScene.game.loop.running);expect(await running()).toBe(true);await home48(page);expect(await running()).toBe(false);const hero=page.locator('.home-hero[data-material=glass]'),first=await hero.innerHTML();await page.waitForTimeout(200);expect(await hero.innerHTML()).not.toBe(first);
 await page.locator('#home-settings').click();expect(await running()).toBe(false);await page.evaluate(()=>window.dispatchEvent(new Event('pagehide')));await page.getByRole('button',{name:'Готово',exact:true}).click();expect(await running()).toBe(false);await page.evaluate(()=>window.dispatchEvent(new Event('pageshow')));expect(await running()).toBe(false);await page.locator('#home-play').click();expect(await running()).toBe(true);
 await page.locator('#settings').click();expect(await running()).toBe(false);await page.getByRole('button',{name:'Готово',exact:true}).click();expect(await running()).toBe(true);await tap(page,0);await tap(page,2);await expect(page.locator('#moves')).toHaveText('Ходов: 1');
});

test('sleeping during an accepted pour clears its visual work and resumes the durable board without replay',async({page})=>{
 await page.clock.install();await open(page,0);await page.clock.pauseAt(new Date(await page.evaluate(()=>Date.now())+1000));await tap(page,0);await tap(page,2);const before=await saved(page);await home48(page);expect(await page.evaluate(()=>(window as any).auditScene.game.loop.running)).toBe(false);await page.clock.fastForward(2000);expect(await saved(page)).toEqual(before);await page.locator('#home-play').click();await advanceFrames(page,'auditScene',500);expect(attempt(await saved(page)).board).toEqual(attempt(before).board);expect(await page.evaluate(()=>{const s=(window as any).auditScene;return !s.flight&&!s.bursts.length&&!s.particles.length;})).toBe(true);await page.clock.resume();
});

test('a reveal redraws only affected vessels while unchanged neighbours retain material and cached commands',async({page})=>{
 await page.clock.install();await open(page,34,3,true);await page.clock.pauseAt(new Date(await page.evaluate(()=>Date.now())+1000));const m=legacy[34].witness[3];await tap(page,m.from);await tap(page,m.to);const end=await page.evaluate(()=>{const s=(window as any).auditScene;return s.flight.start+s.flight.timing.lift+s.flight.timing.flow-performance.now();});await advanceFrames(page,'auditScene',Math.ceil(end/40)*40+40);
 await page.evaluate(()=>{const s=(window as any).auditScene,fn=s.tube;(window as any).tubeCalls38=[];s.tube=function(...a:any[]){(window as any).tubeCalls38.push(a[5]);return fn.apply(this,a);};});await advanceFrames(page,'auditScene',40);const calls=await page.evaluate(()=>(window as any).tubeCalls38);expect(calls).toContain(0);expect(calls).not.toContain(1);expect(calls).not.toContain(3);expect(await page.evaluate(()=>(window as any).auditScene.glass.tubes.get(1).visible)).toBe(true);await page.clock.resume();
});

test('repeated home/settings cycles retain one canvas and bounded pools',async({page})=>{
 // Twenty real pointer cycles now include the pause menu on every trip home.
 // Keep every cycle and its animation/actionability checks on slower CI runners.
 test.setTimeout(120000);await open(page,37);const stats=()=>page.evaluate(()=>{const s=(window as any).auditScene;return {canvas:document.querySelectorAll('canvas').length,labels:s.labels.length+s.activeLabels.length,glass:s.glass.tubes.size,events:s.input.listenerCount('pointerdown')};});const before=await stats();
 for(let i=0;i<20;i++){await home48(page);await page.locator('#home-play').click();await page.locator('#settings').click();await page.getByRole('button',{name:'Готово',exact:true}).click();}
 await page.waitForTimeout(350);expect(await stats()).toEqual(before);
});

test('covered victory letter/star/button animations freeze without changing the recorded result',async({page})=>{
 await open(page,0,levels[0].witness.length);await page.waitForTimeout(600);const before=await saved(page);await page.locator('#settings').click();const state=await page.locator('#continue').evaluate(e=>getComputedStyle(e).animationPlayState);expect(state).toBe('paused');await page.waitForTimeout(150);expect(await saved(page)).toEqual(before);await page.getByRole('button',{name:'Готово',exact:true}).click();expect(await page.locator('#continue').evaluate(e=>getComputedStyle(e).animationPlayState)).toBe('running');
});

test('all campaign role layouts reuse bounded glass/label pools and keep one live input listener',async({page})=>{
 test.setTimeout(90000);await open(page,0);const s=await saved(page);s.completed=levels.map(l=>l.id);await page.evaluate(s=>localStorage.setItem('water-sort-v1',JSON.stringify(s)),s);await page.reload();
 await page.evaluate(async()=>{const path='/src/game/WaterScene.ts',m=await import(path),fn=m.WaterScene.prototype.positions;m.WaterScene.prototype.positions=function(){(window as any).auditScene=this;return fn.call(this);};});await page.locator('#home-play').click();
 // Resource stress uses the same DOM handlers without pointer-action animation waits.
 // Pointer targets/navigation are covered separately; explicitly render every chosen board.
 for(const [index,l]of levels.entries()){
  const p=await page.evaluate(id=>{
   (document.getElementById('menu') as HTMLButtonElement).click();(document.getElementById('home-levels') as HTMLButtonElement).click();
   (document.querySelector(`.levels button[data-level="${id}"]`) as HTMLButtonElement).click();
   const s=(window as any).auditScene;s.update();return {current:JSON.parse(localStorage.getItem('water-sort-v1')!).current,canvas:document.querySelectorAll('canvas').length,labels:s.labels.length+s.activeLabels.length,glass:s.glass.tubes.size,cache:s.tubes.size,events:s.input.listenerCount('pointerdown')};
  },l.id);
  expect(p.current).toBe(index);expect(p.canvas).toBe(1);expect(p.labels).toBeLessThanOrEqual(32);expect(p.glass).toBeLessThanOrEqual(11);expect(p.cache).toBeLessThanOrEqual(11);expect(p.events).toBe(1);
 }

});


test('the sampled mini trap explains free Undo; a mocked rewarded buffer preserves the move and restores legal options',async({page})=>{
 await page.clock.install();await open(page,23);await page.clock.pauseAt(new Date(await page.evaluate(()=>Date.now())+1000));await tap(page,3);await tap(page,0);await advanceFrames(page,'auditScene',1200);await expect(page.locator('#status')).toContainText('Нет доступных ходов');await expect(page.locator('#status')).toContainText('отменить');await expect(page.locator('#undo')).toBeEnabled();expect(moves(attempt(await saved(page)).board,goalFor(await saved(page)))).toHaveLength(0);
 await page.locator('#undo').click();await advanceFrames(page,'auditScene',1200);expect(attempt(await saved(page)).board).toEqual(levels[23].initial);await expect(page.locator('#moves')).toHaveText('Ходов: 0');
 await tap(page,3);await tap(page,0);await advanceFrames(page,'auditScene',1200);await mockReward(page);await page.locator('#extra-tube').click();await page.getByRole('button',{name:'Смотреть рекламу',exact:true}).click();await expect(page.locator('dialog')).toBeHidden();const s=await saved(page);expect(attempt(s).history).toHaveLength(1);expect(attempt(s).extra).toBe(true);expect(moves(attempt(s).board,goalFor(s)).length).toBeGreaterThan(0);await page.clock.resume();
});
