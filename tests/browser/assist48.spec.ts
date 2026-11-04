import {generateShuffle} from '../../src/core/shuffle';
import {levelFor} from '../../src/core/session';
import {test,expect,type Page} from '@playwright/test';
import {fresh,seededRestart,attempt,goalFor,activeKey,grantExtra,type Save} from '../../src/core/session';
import {extraCount} from '../../src/core/assist';
import {home48,restart48,pause48} from './navigation';
async function saved(p:Page):Promise<Save>{return p.evaluate(()=>JSON.parse(localStorage.getItem('water-sort-v1')!));}
async function open(p:Page,s=seededRestart({...fresh(),current:2})){
 s.settings.sound=false;await p.addInitScript(s=>{if(sessionStorage.assist48)return;sessionStorage.assist48='1';localStorage.setItem('water-sort-v1',JSON.stringify(s));},s);
 await p.goto('/');await p.evaluate(async()=>{const path='/src/game/WaterScene.ts',m=await import(path),fn=m.WaterScene.prototype.positions;m.WaterScene.prototype.positions=function(){(window as any).scene48=this;return fn.call(this);};});await p.locator('#home-play').click();await expect(p.locator('canvas')).toBeVisible();
}
async function add(p:Page){await p.locator('#extra-tube').click();}
test('quiet HUD has only currency, stage, pause and four actions; advice is on the field and pause retains settings, restart and stars',async({page})=>{
 await open(page);for(const id of ['moves','star-bank','star-target','restart','menu'])await expect(page.locator('#'+id)).toBeHidden();
 await expect(page.locator('nav button:visible')).toHaveCount(4);await expect(page.locator('.locked-vessel')).toHaveCount(0);await expect(page.locator('#coins')).toBeVisible();
 await pause48(page);await expect(page.locator('dialog #hint')).toHaveCount(0);for(const id of ['menu','restart','star-target'])await expect(page.locator('#'+id)).toBeVisible();await page.getByRole('button',{name:'Готово',exact:true}).click();await expect(page.locator('dialog')).toBeHidden();
});
for(const [w,h]of [[320,480],[390,844],[568,320]])test(`three ordinary tubes merge into the grid and survive Undo/restart/reload ${w}x${h}`,async({page})=>{
 await page.setViewportSize({width:w,height:h});const s=seededRestart({...fresh(),current:59}),before=structuredClone(attempt(s));await open(page,s);
 for(let n=1;n<=3;n++){await add(page);await expect.poll(async()=>extraCount(attempt(await saved(page)))).toBe(n);if(n<3)await expect(page.locator('#extra-tube')).toBeEnabled();}
 const now=await saved(page);expect(attempt(now).history).toEqual(before.history);expect(now.wallet!.tubes).toBe(0);expect(attempt(now).board.slice(0,before.board.length)).toEqual(before.board);await expect(page.locator('#extra-tube')).toBeDisabled();
 const poses=await page.evaluate(()=>{const s=(window as any).scene48;return s.positions().map((r:any)=>({x:r.x,y:r.y,w:r.hitW,h:r.hitH}));});expect(poses).toHaveLength(before.board.length+3);for(const p of poses){expect(p.w).toBeGreaterThanOrEqual(48);expect(p.h).toBeGreaterThanOrEqual(48);}
 for(const id of ['board','shuffle','extra-tube','settings']){const b=(await page.locator('#'+id).boundingBox())!;expect(b.x).toBeGreaterThanOrEqual(0);expect(b.x+b.width).toBeLessThanOrEqual(w+.1);expect(b.y+b.height).toBeLessThanOrEqual(h+.1);}
 if(process.env.QA_SCREENSHOT_DIR)await page.screenshot({path:`${process.env.QA_SCREENSHOT_DIR}/play48-${w}x${h}.png`});
 await restart48(page);await page.getByRole('button',{name:'Начать заново',exact:true}).click();expect(extraCount(attempt(await saved(page)))).toBe(3);await page.reload();await page.locator('#home-play').click();expect(extraCount(attempt(await saved(page)))).toBe(3);expect((await saved(page)).wallet!.tubes).toBe(0);
});
test('real Worker shuffle spends one stock only after a proved change; Undo restores the board without refunding the stock',async({page})=>{
 await open(page,seededRestart({...fresh(),current:34}));const before=await saved(page);await page.locator('#shuffle').click();
 await expect.poll(async()=>(await saved(page)).wallet!.hints).toBe(before.wallet!.hints-1);await expect(page.locator('dialog')).toBeHidden();const n=await saved(page);expect(attempt(n).shuffles).toHaveLength(1);expect(attempt(n).board.flat().sort()).toEqual(attempt(before).board.flat().sort());expect(attempt(n).board).not.toEqual(attempt(before).board);
 await expect(page.locator('#undo')).toBeEnabled();await page.locator('#undo').click();expect(attempt(await saved(page)).board).toEqual(attempt(before).board);expect((await saved(page)).wallet!.hints).toBe(before.wallet!.hints-1);
 await page.reload();await page.locator('#home-play').click();expect(attempt(await saved(page)).board).toEqual(attempt(before).board);
});
test('no proved shuffle means no stock or board change',async({page})=>{
 await page.route('**/src/core/shuffle.worker.ts*',r=>r.fulfill({contentType:'application/javascript',body:'self.onmessage=({data})=>self.postMessage({revision:data.revision});'}));await open(page);const before=await saved(page);
 await page.locator('#shuffle').click();await expect(page.getByRole('heading',{name:'Перемешивание не применено'})).toBeVisible();expect(await saved(page)).toEqual(before);
});
test('cancel and background during pending work cannot spend stock or apply a late shuffle',async({page})=>{
 let release!:()=>void;const gate=new Promise<void>(r=>release=r);await page.route('**/src/core/shuffle.worker.ts*',async r=>{await gate;await r.continue().catch(()=>{});});await open(page);const before=await saved(page);
 await page.locator('#shuffle').click();await expect(page.getByRole('heading',{name:'Перемешиваем…'})).toBeVisible();await page.evaluate(()=>window.dispatchEvent(new Event('pagehide')));release();await page.evaluate(()=>window.dispatchEvent(new Event('pageshow')));await expect(page.getByRole('heading',{name:'Перемешивание отменено'})).toBeVisible();expect(await saved(page)).toEqual(before);await page.locator('dialog').getByRole('button',{name:'Отмена',exact:true}).click();await expect(page.locator('dialog')).toBeHidden();
});
test('third numbered rewarded tube recovers from old backup, persists before acknowledgement and cannot grant a fourth',async({page})=>{
 const s=seededRestart({...fresh(),current:2});s.wallet!.tubes=0;const target=`tube:${activeKey(s)}:3`;
 await page.route('**/src/platform/rewarded.ts',r=>r.fulfill({contentType:'application/javascript',body:`export class Rewarded{async pending(){return [{token:'third48',level:'${target}'}]}async ack(){window.ack48=JSON.parse(localStorage.getItem('water-sort-v1'))}async request(){throw Error('Do not show')}async cancel(){}}`}));
 await open(page,s);await expect.poll(async()=>extraCount(attempt(await saved(page)))).toBe(3);const ack=await page.evaluate(()=>(window as any).ack48);expect(extraCount(attempt(ack))).toBe(3);await page.reload();await page.locator('#home-play').click();expect(extraCount(attempt(await saved(page)))).toBe(3);await expect(page.locator('#extra-tube')).toBeDisabled();
});
test('inline tube price buys only the selected stock without applying a tube',async({page})=>{
 const s=seededRestart({...fresh(),current:2});s.wallet!.tubes=0;s.wallet!.coins=60;await open(page,s);await page.locator('#extra-tube').click();await page.getByRole('button',{name:'Купить за 60 монет',exact:true}).click();const n=await saved(page);expect(n.wallet!.coins).toBe(0);expect(n.wallet!.tubes).toBe(3);expect(n.wallet!.hints).toBe(s.wallet!.hints);expect(attempt(n).board).toEqual(attempt(s).board);
});

test('an already queued worker reply after Cancel is rejected even when the board revision did not change',async({page})=>{
 const s=seededRestart({...fresh(),current:2}),event=generateShuffle(levelFor(s),attempt(s),goalFor(s),480066)!;expect(event).toBeDefined();
 await page.addInitScript(event=>{const Original=window.Worker;window.Worker=class extends Original{
  constructor(url:string|URL,options?:WorkerOptions){if(String(url).includes('shuffle.worker'))return {onmessage:null,onerror:null,onmessageerror:null,terminate(){},postMessage(data:any){(window as any).late48=()=>(this as any).onmessage?.({data:{revision:data.revision,event}});}} as any;super(url,options);}
 } as typeof Worker;},event);
 await open(page,s);const before=await saved(page);await page.locator('#shuffle').click();await expect.poll(()=>page.evaluate(()=>typeof(window as any).late48)).toBe('function');await page.locator('dialog').getByRole('button',{name:'Отмена',exact:true}).click();await page.evaluate(()=>(window as any).late48());expect(await saved(page)).toEqual(before);await expect(page.locator('dialog')).toBeHidden();
});
