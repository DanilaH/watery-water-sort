import {test,expect,type Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {layout} from '../../src/game/geometry';
import type {Save} from '../../src/core/session';
const levels=JSON.parse(readFileSync(new URL('../../src/core/levels.json',import.meta.url),'utf8'));
const fresh=():Save=>({schema:1,artVersion:4,current:0,revision:0,completed:[],attempts:{},settings:{sound:true,fast:false,symbols:false,light:false}});
const levelKey=(i:number)=>`${levels[i].id}@${levels[i].version}`;
const attempt=(s:Save)=>s.attempts[levelKey(s.current)]??{board:levels[s.current].initial,history:[],extra:false};
import {moves} from '../../src/core/rules';
const dead=JSON.parse(readFileSync(new URL('../../docs/audits/review-05/deadend-save.json',import.meta.url),'utf8')) as Save;
async function open(page:Page,s:Save=fresh()){
 await page.addInitScript(s=>{if(sessionStorage.seed09)return;localStorage.setItem('water-sort-v1',JSON.stringify(s));sessionStorage.seed09='1';},s);
 await page.goto('/');await page.locator('canvas').waitFor();await page.waitForTimeout(300);
}
async function saved(page:Page):Promise<Save>{return page.evaluate(()=>JSON.parse(localStorage.getItem('water-sort-v1')!));}
async function tap(page:Page,i:number){const s=await saved(page),b=(await page.locator('#board').boundingBox())!,p=layout(b.width,b.height,attempt(s).board.length)[i];await page.mouse.click(b.x+p.x,b.y+p.y+p.h/2);}
async function help(page:Page){await page.locator('#menu').click();await page.getByRole('button',{name:'Если застрял',exact:true}).click();}
for(const failure of ['constructor','postMessage','async'])test(`hint recovers from ${failure} failure and retries`,async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await open(page);
 await page.evaluate(failure=>{const Original=window.Worker;(window as any).restoreWorker=()=>window.Worker=Original;
 if(failure==='constructor')window.Worker=class{constructor(){throw new DOMException('blocked','SecurityError');}} as any;
 else if(failure==='postMessage'){const post=Worker.prototype.postMessage;(window as any).restoreWorker=()=>Worker.prototype.postMessage=post;Worker.prototype.postMessage=()=>{throw new DOMException('clone failed','DataCloneError');};}
 else window.Worker=class{onerror:any;terminate(){}postMessage(){queueMicrotask(()=>this.onerror(new ErrorEvent('error',{cancelable:true,message:'blocked'})));}} as any;
 },failure);
 await page.locator('#hint').click();await expect(page.locator('#status')).toContainText('Подсказка недоступна');await expect(page.locator('#hint')).toBeEnabled();
 await page.evaluate(()=>(window as any).restoreWorker());await page.locator('#hint').click();await expect(page.locator('#status')).toContainText('Перелей');expect(errors).toEqual([]);
});
for(const stall of [800,220])test(`pour cue respects remaining water phase after ${stall}ms stall`,async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await open(page);
 await page.evaluate(async stall=>{const sp='/src/game/WaterScene.ts',ap='/src/audio/sound.ts',s=await import(sp),a=await import(ap);(window as any).cues=[];const animate=s.WaterScene.prototype.animate;
 s.WaterScene.prototype.animate=function(...args:any[]){const r=animate.apply(this,args);const until=performance.now()+stall;while(performance.now()<until){}return r;};
 for(const key of ['pour','land']){const fn=a.Sound.prototype[key];a.Sound.prototype[key]=function(...args:any[]){(window as any).cues.push({key,args});return fn.apply(this,args);};}
 },stall);
 await tap(page,0);await tap(page,2);await expect(page.locator('#hint')).toBeEnabled();
 const cues=await page.evaluate(()=>(window as any).cues),pours=cues.filter((c:any)=>c.key==='pour');expect(cues.filter((c:any)=>c.key==='land')).toHaveLength(1);
 if(stall===800)expect(pours).toHaveLength(0);else{expect(pours).toHaveLength(1);expect(pours[0].args[0]).toBeGreaterThan(0);expect(pours[0].args[0]).toBeLessThan(112);}
 await expect(page.locator('#moves')).toHaveText('Ходов: 1');expect(errors).toEqual([]);
});
test('extra tube preserves history and survives undo, restart, reload and level switching',async({page})=>{
 const seeded=structuredClone(dead);seeded.completed=levels.slice(0,6).map((l:any)=>l.id);await open(page,seeded);await page.locator('#rescue').click();await page.getByRole('button',{name:'Добавить колбу',exact:true}).click();let s=await saved(page);
 expect(attempt(s).extra).toBe(true);expect(attempt(s).board.slice(0,-1)).toEqual(attempt(dead).board);expect(attempt(s).history).toEqual(attempt(dead).history);
 const intoExtra=moves(attempt(s).board).find(m=>m.to===7)!;await tap(page,intoExtra.from);await tap(page,7);await expect(page.locator('#hint')).toBeEnabled();expect(attempt(await saved(page)).history).toHaveLength(8);
 await page.reload();await page.locator('canvas').waitFor();await page.locator('#undo').click();await expect(page.locator('#hint')).toBeEnabled();expect(attempt(await saved(page)).board).toEqual(attempt(s).board);await page.locator('#undo').click();await expect(page.locator('#hint')).toBeEnabled();s=await saved(page);expect(attempt(s).extra).toBe(true);expect(attempt(s).board).toHaveLength(8);expect(attempt(s).history).toHaveLength(6);
 await page.locator('#restart').click();await page.getByRole('button',{name:'Начать заново',exact:true}).click();s=await saved(page);expect(attempt(s).board).toEqual([...levels[6].initial,[]]);expect(attempt(s).history).toHaveLength(0);
 await help(page);await expect(page.getByRole('button',{name:'Добавить колбу',exact:true})).toHaveCount(0);await expect(page.locator('.dialog-body')).toContainText('уже добавлена');await page.getByRole('button',{name:'Закрыть',exact:true}).click();
 await page.locator('#menu').click();await page.locator('.levels button').nth(0).click();expect(attempt(await saved(page)).extra).toBe(false);await page.locator('#menu').click();await page.locator('.levels button').nth(6).click();expect(attempt(await saved(page)).extra).toBe(true);
});
test('failed extra-tube save keeps the old board and offers retry',async({page})=>{
 await open(page,dead);await page.locator('#rescue').click();const original=await saved(page);
 await page.evaluate(()=>{const set=Storage.prototype.setItem;(window as any).restoreWrite=()=>Storage.prototype.setItem=set;Storage.prototype.setItem=function(k,v){if(k.startsWith('water-sort-v1'))throw Error('full');set.call(this,k,v);};});
 await page.getByRole('button',{name:'Добавить колбу',exact:true}).click();await expect(page.getByRole('alert')).toContainText('Изменение не принято');expect(await saved(page)).toEqual(original);await expect(page.locator('dialog')).toBeVisible();await page.evaluate(()=>(window as any).restoreWrite());await page.getByRole('button',{name:'Добавить колбу',exact:true}).click();expect(attempt(await saved(page)).extra).toBe(true);
});
test('proven dead end with legal moves offers help, then hints work with an extra tube',async({page})=>{
 const corpus=JSON.parse(gunzipSync(readFileSync(new URL('../../docs/audits/product-08/exploratory-corpus.json.gz',import.meta.url))).toString());const item=corpus.find((x:any)=>x.status==='UNSOLVABLE'&&moves(x.board).length>0),s=fresh();s.current=levels.findIndex((l:any)=>l.id===item.level);s.revision=item.history.length;s.attempts[levelKey(s.current)]={board:item.board,history:item.history,extra:false};
 await open(page,s);await expect(page.locator('#rescue')).toBeHidden();await page.locator('#hint').click();await expect(page.getByRole('heading',{name:'Решения нет',exact:true})).toBeVisible();await page.getByRole('button',{name:'Закрыть',exact:true}).click();await expect(page.locator('#rescue')).toBeVisible();await page.locator('#rescue').click();await page.getByRole('button',{name:'Добавить колбу',exact:true}).click();await page.locator('#hint').click();await expect(page.locator('#status')).toContainText('Перелей');await expect(page.locator('#rescue')).toBeHidden();
});
test('help supports undo and restart confirmation',async({page})=>{
 await open(page,dead);await page.locator('#rescue').click();await page.getByRole('button',{name:'Отменить ход',exact:true}).click();await expect(page.locator('dialog')).toBeHidden();await expect(page.locator('#hint')).toBeEnabled();expect(attempt(await saved(page)).history).toHaveLength(6);
 await help(page);await page.locator('dialog').getByRole('button',{name:'Заново',exact:true}).click();await expect(page.getByRole('heading',{name:'Начать заново?'})).toBeVisible();await page.getByRole('button',{name:'Продолжить',exact:true}).click();expect(attempt(await saved(page)).history).toHaveLength(6);
});
for(const count of [10,11])test(`landscape gives ${count} tubes more height with exclusive 48px targets`,async({page})=>{
 const s=fresh();s.current=11;if(count===11){s.attempts[levelKey(11)]={board:[...levels[11].initial,[]],history:[],extra:true};}await page.setViewportSize({width:568,height:320});await open(page,s);
 const b=(await page.locator('#board').boundingBox())!,ps=layout(b.width,b.height,count);expect(b.height).toBeGreaterThanOrEqual(220);expect(ps[0].h).toBeGreaterThan(73);
 for(const p of ps){expect(p.hitW).toBeGreaterThanOrEqual(48);expect(p.hitH).toBeGreaterThanOrEqual(48);}
 for(const id of ['menu','settings','symbols','undo','hint','restart']){const r=(await page.locator('#'+id).boundingBox())!;expect(r.height).toBeGreaterThanOrEqual(48);expect(r.y).toBeGreaterThanOrEqual(0);expect(r.y+r.height).toBeLessThanOrEqual(320);}
 await help(page);for(const button of await page.locator('.dialog-actions button').all()){const r=(await button.boundingBox())!;expect(r.height).toBeGreaterThanOrEqual(48);expect(r.y+r.height).toBeLessThanOrEqual(320);}
});
