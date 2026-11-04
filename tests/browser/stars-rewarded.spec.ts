import {home48} from './navigation';
import {levelButton} from './navigation';
import {test,expect,type Page} from '@playwright/test';
import {fresh,levels,levelKey,moved,attempt,displaySlots,seededRestart,type Save} from '../../src/core/session';
import {settleEconomy} from '../../src/core/economy';
import {layout} from '../../src/game/geometry';import proof from '../../docs/audits/campaign-54/optimal.json' with {type:'json'};
const fake=`export class Rewarded{
 async pending(){const r=JSON.parse(localStorage.getItem('receipts14')||'[]');if(window.failRecovery14&&r.length){window.failRecovery14=false;const set=Storage.prototype.setItem;window.restoreWrite=()=>Storage.prototype.setItem=set;Storage.prototype.setItem=function(k,v){if(k.startsWith('water-sort-v1'))throw Error('full');return set.call(this,k,v)}}return r}
 async ack(token){window.ackState=JSON.parse(localStorage.getItem('water-sort-v1'));localStorage.setItem('receipts14',JSON.stringify((await this.pending()).filter(r=>r.token!==token)))}
 async request(level){window.adCalls=(window.adCalls||0)+1;const s=window.adCase||'rewarded';if(s==='deferred')return new Promise(r=>window.finishAd=r);if(s==='throw')throw Error('SDK');if(s!=='rewarded')return {status:s};const receipt={level,token:'test-'+window.adCalls};localStorage.setItem('receipts14',JSON.stringify([receipt]));return {status:'rewarded',receipt}}
 async cancel(){window.finishAd?.({status:'closed'})}
}`;
async function open(page:Page,state:Save,scenario='rewarded',receipts:any[]=[]){
 state=settleEconomy(state);
 await page.route('**/src/platform/rewarded.ts',r=>r.fulfill({contentType:'application/javascript',body:fake}));
 await page.addInitScript(({s,scenario,receipts})=>{(window as any).adCase=scenario;if(!sessionStorage.seed14){sessionStorage.seed14='1';localStorage.setItem('water-sort-v1',JSON.stringify(s));localStorage.setItem('receipts14',JSON.stringify(receipts));}}, {s:state,scenario,receipts});
 await page.goto('/');await page.locator('#home-play').click();await page.locator('canvas').waitFor();await page.waitForTimeout(150);
}
async function saved(page:Page):Promise<Save>{return page.evaluate(()=>JSON.parse(localStorage.getItem('water-sort-v1')!));}
const level=(i:number)=>({...fresh(),current:i,completed:levels.slice(0,i).map(l=>l.id)});
async function watch(page:Page){await page.locator('#wallet').click();await page.getByRole('button',{name:'Получить 80 монет · реклама',exact:true}).click();}
for(const i of [0,1])test(`tutorial ${i+1} has no locked vessel or reward offer`,async({page})=>{await open(page,level(i));await expect(page.locator('#extra-tube')).toBeHidden();expect(displaySlots(await saved(page))).toBe(4);await home48(page);await page.locator('#home-levels').click();await page.getByRole('button',{name:'Если застрял',exact:true}).click();await expect(page.locator('dialog').getByRole('button',{name:'Добавить колбу',exact:true})).toHaveCount(0);});
for(const status of ['closed','unavailable','failed','throw'])test(`reward ${status} never grants a vessel or changes history`,async({page})=>{
 const state=moved(level(2),levels[2].witness[0]);await open(page,state,status);const before=await saved(page);await watch(page);await expect(page.locator('.dialog-body')).toContainText(status==='closed'?'не завершён':'недоступна');expect(attempt(await saved(page))).toEqual(attempt(before));expect((await saved(page)).wallet).toMatchObject({coins:before.wallet!.coins,tubes:before.wallet!.tubes,hints:before.wallet!.hints});await expect(page.locator('#extra-tube')).toBeVisible();await page.getByRole('button',{name:'Закрыть',exact:true}).click();await expect(page.locator('dialog')).toBeHidden();
});
test('coin reward saves before acknowledgement; an explicit inline purchase and use preserve every old move',async({page})=>{
 const state=moved(level(2),levels[2].witness[0]);state.wallet!.tubes=0;await open(page,state);const before=await saved(page);await watch(page);await expect(page.locator('.shop-balance')).toHaveText(String(before.wallet!.coins+80));
 const ack=await page.evaluate(()=>(window as any).ackState);expect(ack.wallet.coins).toBe(before.wallet!.coins+80);expect(attempt(ack).extra).toBe(false);expect(await page.evaluate(()=>(window as any).adCalls)).toBe(1);
 await page.getByRole('button',{name:'Закрыть',exact:true}).click();await page.locator('#extra-tube').click();expect((await saved(page)).wallet).toMatchObject({coins:before.wallet!.coins+20,tubes:3});expect(attempt(await saved(page)).extra).toBe(false);
 await page.locator('#extra-tube').click();const next=await saved(page);expect(attempt(next).board).toEqual([...attempt(before).board,[]]);expect(attempt(next).history).toEqual(attempt(before).history);await page.reload();await page.locator('#home-play').click();expect(attempt(await saved(page)).extra).toBe(true);
});
test('failed legacy tube receipt save remains pending and reload recovers it without another ad',async({page})=>{
 await page.addInitScript(()=>{(window as any).failRecovery14=!sessionStorage.failedOnce14;sessionStorage.failedOnce14='1';});await open(page,seededRestart(level(2)),'rewarded',[{token:'earned-before-update',level:levelKey(2)}]);expect(attempt(await saved(page)).extra).toBe(false);expect(await page.evaluate(()=>(window as any).ackState)).toBeUndefined();expect(await page.evaluate(()=>(window as any).adCalls||0)).toBe(0);
 await page.evaluate(()=>(window as any).restoreWrite());await page.reload();await expect.poll(async()=>attempt(await saved(page)).extra).toBe(true);expect(await page.evaluate(()=>(window as any).adCalls||0)).toBe(0);expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('receipts14')!))).toEqual([]);
});
test('a duplicate pending receipt is harmless and an old receipt unlocks only its own level',async({page})=>{
 await open(page,level(3),'rewarded',[{token:'old',level:levelKey(2)}]);const state=await saved(page);expect(attempt({...state,current:2}).extra).toBe(true);expect(attempt(state).extra).toBe(false);await expect(page.locator('#extra-tube')).toBeVisible();await page.evaluate(k=>localStorage.setItem('receipts14',JSON.stringify([{token:'duplicate',level:k}])),levelKey(2));const before=await saved(page);await page.reload();await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('receipts14')!))).toEqual([]);expect(await saved(page)).toEqual(before);
});
test('loading coin reward is single-flight and can be cancelled without granting a reward',async({page})=>{
 await open(page,level(2),'deferred');const balance=(await saved(page)).wallet!.coins;await page.locator('#wallet').click();await page.getByRole('button',{name:'Получить 80 монет · реклама',exact:true}).evaluate((b:HTMLButtonElement)=>{b.click();b.click();});await expect.poll(()=>page.evaluate(()=>(window as any).adCalls)).toBe(1);await page.getByRole('button',{name:'Закрыть',exact:true}).click();await expect(page.locator('.dialog-body')).toContainText('не завершён');expect(attempt(await saved(page)).extra).toBe(false);expect((await saved(page)).wallet!.coins).toBe(balance);await page.getByRole('button',{name:'Закрыть',exact:true}).click();await expect(page.locator('dialog')).toBeHidden();
});
test('three stars and the best move record survive replay and show in level selection',async({page})=>{
 const p=proof.find(p=>p.level===2&&!p.extra)!,state=p.path.slice(0,-1).reduce((s,m)=>moved(s,m),level(2));await open(page,state);const b=(await page.locator('#board canvas').boundingBox())!,ps=layout(b.width,b.height,displaySlots(state)),m=p.path.at(-1)!;for(const i of [m.from,m.to])await page.mouse.click(b.x+ps[i].x,b.y+ps[i].y+ps[i].h/2);await expect(page.locator('#earned-stars')).toHaveText('★★★');await expect(page.locator('#status')).toHaveText('');expect((await saved(page)).best?.[levelKey(2)].history).toHaveLength(p.optimal);
 await home48(page);await page.locator('#home-levels').click();await expect(levelButton(page,2)).toContainText('★★★');await expect(levelButton(page,2)).not.toContainText('ходов');await levelButton(page,2).click();await expect(page.locator('#moves')).toHaveText('Ходов: 0');expect((await saved(page)).best?.[levelKey(2)].history).toHaveLength(p.optimal);await page.reload();expect((await saved(page)).best?.[levelKey(2)].history).toHaveLength(p.optimal);
});
for(const [width,height]of [[320,480],[568,320],[390,844]])test(`locked maximum field fits ${width}x${height} without overlapping hit areas`,async({page})=>{
 await page.setViewportSize({width,height});await open(page,level(11));const b=(await page.locator('#board canvas').boundingBox())!,lock=(await page.locator('#extra-tube').boundingBox())!;expect(lock.width).toBeGreaterThanOrEqual(48);expect(lock.height).toBeGreaterThanOrEqual(48);expect(lock.x).toBeGreaterThanOrEqual(0);expect(lock.x>=b.x+b.width||lock.y>=b.y+b.height).toBe(true);await page.locator('#extra-tube').click();await expect(page.locator('#extra-tube')).toBeEnabled();expect(attempt(await saved(page)).board).toHaveLength(levels[11].initial.length+1);
});
