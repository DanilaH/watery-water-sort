import {test,expect,type Page} from '@playwright/test';
import {fresh,levels,moved,attempt,levelKey,knowledgeFor,goalFor} from '../../src/core/session';
import {hasUnknown} from '../../src/core/knowledge';
import {mockReward,toggleSymbols,openLevels} from './navigation';
import {advanceFrames} from './controlled-frames';
async function saved(page:Page){return page.evaluate(()=>JSON.parse(localStorage.getItem('water-sort-v1')!));}
async function open(page:Page,index=34,n=0){let s={...fresh(),current:index};s.settings.sound=false;s.completed=levels.slice(0,index).map(l=>l.id);for(const m of levels[index].witness.slice(0,n))s=moved(s,m);
 await page.addInitScript(s=>{if(sessionStorage.hidden36)return;sessionStorage.hidden36='1';localStorage.setItem('water-sort-v1',JSON.stringify(s));},s);await page.goto('/');
 await page.evaluate(async()=>{const p='/src/game/WaterScene.ts',m=await import(p),fn=m.WaterScene.prototype.positions;m.WaterScene.prototype.positions=function(){(window as any).hiddenScene=this;return fn.call(this);};});
 await page.locator('#home-play').click();await expect.poll(()=>page.evaluate(()=>!!(window as any).hiddenScene)).toBe(true);await page.waitForTimeout(280);return s;
}
async function tap(page:Page,i:number){const b=(await page.locator('#board').boundingBox())!,r=await page.evaluate(i=>(window as any).hiddenScene.positions()[i],i);await page.mouse.click(b.x+r.x,b.y+r.y+r.h/2);}
async function move(page:Page,from:number,to:number){await tap(page,from);await tap(page,to);await expect(page.locator('#hint')).toBeEnabled();}
async function questions(page:Page){return page.evaluate(()=>(window as any).hiddenScene.activeLabels.filter((l:any)=>l.text==='?').length);}

test('only concealed portions carry question marks, top stays coloured even with symbols enabled',async({page})=>{
 await open(page);expect(await questions(page)).toBe(4);await expect(page.locator('#status')).toContainText('отмена их не спрячет');await toggleSymbols(page);expect(await questions(page)).toBe(4);
 const ls=await page.evaluate(()=>{const s=(window as any).hiddenScene;return s.board.map((t:number[],i:number)=>s.layers(t,s.knowledge.ids[i],performance.now()));});expect(ls[0]).toEqual([{color:1,amount:1,reveal:0},{color:1,amount:1,reveal:0},{color:0,amount:1,reveal:1},{color:2,amount:1,reveal:1}]);
});

test('discovery blends continuously at receive, with one tactile/audio cue and no Undo erasure',async({page})=>{
 await page.clock.install();await open(page,34,3);await page.evaluate(async()=>{const p='/src/platform/haptics.ts',m=await import(p),fn=m.TouchFeedback.prototype.play;(window as any).revealTicks=[];m.TouchFeedback.prototype.play=function(...args:any[]){(window as any).revealTicks.push(args[0]);return fn.apply(this,args);};const a='/src/audio/sound.ts',am=await import(a),rf=am.Sound.prototype.reveal;(window as any).revealSounds=0;am.Sound.prototype.reveal=function(){(window as any).revealSounds++;return rf.call(this);};});
 await page.clock.pauseAt(new Date(await page.evaluate(()=>Date.now())+1000));const m=levels[34].witness[3];await tap(page,m.from);await tap(page,m.to);
 const start=await page.evaluate(()=>{const s=(window as any).hiddenScene;return [...s.reveals.values()][0]-performance.now();});expect(start).toBeGreaterThan(0);
 await advanceFrames(page,'hiddenScene',Math.ceil(start/40)*40+80);const progress=await page.evaluate(()=>{const s=(window as any).hiddenScene;return s.layers(s.board[0],s.knowledge.ids[0],performance.now()).at(-1).reveal;});expect(progress).toBeGreaterThan(0);expect(progress).toBeLessThan(1);
 await advanceFrames(page,'hiddenScene',900);expect(await questions(page)).toBe(3);expect(await page.evaluate(()=>(window as any).revealTicks.filter((x:string)=>x==='reveal').length)).toBe(1);expect(await page.evaluate(()=>(window as any).revealSounds)).toBe(1);await page.clock.resume();
 await page.locator('#undo').click();await expect(page.locator('#hint')).toBeEnabled();expect(attempt(await saved(page)).known).toContain(1);await page.reload();await page.evaluate(async()=>{const p='/src/game/WaterScene.ts',m=await import(p),fn=m.WaterScene.prototype.positions;m.WaterScene.prototype.positions=function(){(window as any).hiddenScene=this;return fn.call(this);};});await page.locator('#home-play').click();expect(attempt(await saved(page)).known).toContain(1);await expect.poll(()=>questions(page)).toBe(3);
});

test('exploration hint never starts omniscient worker; full knowledge enables normal solver',async({page})=>{
 await open(page,34);await page.evaluate(()=>{const Original=window.Worker;(window as any).workers36=0;window.Worker=class extends Original{constructor(...args:ConstructorParameters<typeof Worker>){super(...args);(window as any).workers36++;}};});
 await page.locator('#hint').click();await expect(page.locator('#status')).toContainText('Открой следующий слой');expect(await page.evaluate(()=>(window as any).workers36)).toBe(0);
 const hint=await page.evaluate(()=>(window as any).hiddenScene.hintMove);await tap(page,hint.to);await expect(page.locator('#hint')).toBeEnabled();expect(attempt(await saved(page)).history).toHaveLength(1);
});

test('learned route restarts with no question marks and uses worker hints',async({page})=>{
 await open(page,34,levels[34].witness.length);await page.locator('#restart').click();await page.getByRole('button',{name:'Начать заново',exact:true}).click();expect(hasUnknown(knowledgeFor(await saved(page)))).toBe(false);expect(await questions(page)).toBe(0);await page.locator('#hint').click();await expect(page.locator('#status')).toContainText('Перелей');
});

for(const [width,height]of [[320,480],[390,844],[568,320]])for(const index of [38,39])test(`hidden combination ${index+1} wins and reselects at ${width}x${height}`,async({page})=>{
 await page.setViewportSize({width,height});await open(page,index,levels[index].witness.length-1);const m=levels[index].witness.at(-1)!;await tap(page,m.from);await tap(page,m.to);await expect(page.locator('#continue')).toBeVisible();await expect(page.locator('#earned-stars')).toHaveText('★★★');expect(hasUnknown(knowledgeFor(await saved(page)))).toBe(false);expect(await questions(page)).toBe(0);
 for(const id of ['board','continue']){const r=(await page.locator('#'+id).boundingBox())!;expect(r.x).toBeGreaterThanOrEqual(0);expect(r.x+r.width).toBeLessThanOrEqual(width);expect(r.y+r.height).toBeLessThanOrEqual(height);}
 await openLevels(page);await page.locator('.levels button').nth(index).click();expect(attempt(await saved(page)).history).toEqual([]);expect(hasUnknown(knowledgeFor(await saved(page)))).toBe(false);
});

test('reward preserves knowledge and restarting keeps both reward and discovery',async({page})=>{
 await open(page,34,4);await mockReward(page);await page.locator('#extra-tube').click();await page.getByRole('button',{name:'Смотреть рекламу',exact:true}).click();await expect(page.locator('dialog')).toBeHidden();const known=attempt(await saved(page)).known;await page.locator('#restart').click();await page.getByRole('button',{name:'Начать заново',exact:true}).click();const s=await saved(page);expect(attempt(s).extra).toBe(true);expect(attempt(s).known).toEqual(known);expect(knowledgeFor(s)?.ids.at(-1)).toEqual([]);
});

test('reduced motion reveals at receive; leaving early clears pending reveal effects',async({page})=>{
 await page.clock.install();await page.emulateMedia({reducedMotion:'reduce'});await open(page,34,3);await page.clock.pauseAt(new Date(await page.evaluate(()=>Date.now())+1000));const m=levels[34].witness[3];await tap(page,m.from);await tap(page,m.to);await advanceFrames(page,'hiddenScene',1300);expect(await page.evaluate(()=>{const s=(window as any).hiddenScene;return {reveals:s.reveals.size,waves:s.liquid.size};})).toEqual({reveals:0,waves:0});await page.clock.resume();
 await page.locator('#undo').click();await expect(page.locator('#hint')).toBeEnabled();const next=levels[34].witness[3];await tap(page,next.from);await tap(page,next.to);await page.locator('#menu').click();expect(await page.evaluate(()=>(window as any).hiddenScene.reveals.size)).toBe(0);await page.locator('#home-play').click();expect(attempt(await saved(page)).known).toContain(1);
});
