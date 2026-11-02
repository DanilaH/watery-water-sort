import {test,expect,type Page} from '@playwright/test';
import {fresh,levels,moved,type Save} from '../../src/core/session';
const saved=(p:Page):Promise<Save>=>p.evaluate(()=>JSON.parse(localStorage.getItem('water-sort-v1')!));
async function open(p:Page,last=false){
 let s=fresh();s.settings.sound=false;s.current=last?levels.length-1:2;s.completed=(last?levels:levels.slice(0,2)).map(l=>l.id);for(const m of levels[s.current].witness)s=moved(s,m);
 await p.route('**/src/platform/ads.ts',r=>r.fulfill({contentType:'application/javascript',body:`export class Ads{native=true;prepare(){}banner(){}show(){window.adCalls43=(window.adCalls43||0)+1;return new Promise((resolve,reject)=>{window.dismiss43=(status='shown')=>resolve({status});window.fail43=()=>reject(Error('Bridge failure'))})}}`}));
 await p.route('**/src/main.ts',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text())+`\nwindow.activity43=typeof onNativeActivity==='function'?onNativeActivity:undefined;`});});
 await p.addInitScript(s=>{localStorage.setItem('water-sort-v1',JSON.stringify(s));(window as any).hidden43=false;Object.defineProperty(document,'hidden',{configurable:true,get:()=>(window as any).hidden43});},s);
 await p.goto('/');await p.locator('#home-play').click();await expect(p.locator('#continue')).toBeVisible();
}
type Reason='hidden'|'page'|'native';
async function lifecycle(p:Page,reason:Reason,on:boolean){await p.evaluate(({reason,on})=>{
 if(reason==='hidden'){(window as any).hidden43=on;document.dispatchEvent(new Event('visibilitychange'));}
 if(reason==='page')window.dispatchEvent(new Event(on?'pagehide':'pageshow'));
 if(reason==='native')(window as any).activity43(!on);
 },{reason,on});}
for(const reason of ['hidden','page','native'] as const)test(`dismiss before delayed ${reason} resume retains Next and advances automatically once`,async({page})=>{
 await open(page);await page.locator('#continue').click();await lifecycle(page,reason,true);await page.evaluate(()=>(window as any).dismiss43());await expect(page.locator('body')).toHaveAttribute('data-game-paused','true');expect((await saved(page)).current).toBe(2);
 // Repeated clicks during return cannot request another ad or discard the pending transition.
 await page.locator('#continue').evaluate((b:HTMLButtonElement)=>{b.click();b.click();});await lifecycle(page,reason,false);await expect(page.locator('#level-title')).toHaveText('Уровень 4');expect(await page.evaluate(()=>(window as any).adCalls43)).toBe(1);await lifecycle(page,reason,false);await expect(page.locator('#level-title')).toHaveText('Уровень 4');
});
for(const order of [['hidden','native','page'],['native','page','hidden'],['page','hidden','native']] as Reason[][])test(`all lifecycle blockers must clear after dismiss: ${order.join('/')}`,async({page})=>{
 await open(page);await page.locator('#continue').click();for(const r of order)await lifecycle(page,r,true);await page.evaluate(()=>(window as any).dismiss43());
 for(const r of order.slice(0,-1)){await lifecycle(page,r,false);expect((await saved(page)).current).toBe(2);}await lifecycle(page,order.at(-1)!,false);await expect(page.locator('#level-title')).toHaveText('Уровень 4');expect(await page.evaluate(()=>(window as any).adCalls43)).toBe(1);
});
test('foreground before dismiss never advances behind a still-open fullscreen ad',async({page})=>{
 await open(page);await page.locator('#continue').click();await lifecycle(page,'native',true);await lifecycle(page,'hidden',true);await lifecycle(page,'native',false);await lifecycle(page,'hidden',false);expect((await saved(page)).current).toBe(2);await expect(page.locator('body')).toHaveAttribute('data-game-paused','true');await page.evaluate(()=>(window as any).dismiss43());await expect(page.locator('#level-title')).toHaveText('Уровень 4');
});
test('explicit navigation home cancels a delayed transition instead of overriding the player',async({page})=>{
 await open(page);await page.locator('#continue').click();await lifecycle(page,'page',true);await page.locator('#menu').evaluate((b:HTMLButtonElement)=>b.click());await page.evaluate(()=>(window as any).dismiss43());await lifecycle(page,'page',false);await expect(page.locator('#home')).toBeVisible();expect((await saved(page)).current).toBe(2);await page.locator('#home-play').click();await page.locator('#continue').click();await expect(page.locator('#level-title')).toHaveText('Уровень 4');expect(await page.evaluate(()=>(window as any).adCalls43)).toBe(1);
});
test('bridge rejection still completes the requested transition after foreground returns',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await open(page);await page.locator('#continue').click();await lifecycle(page,'hidden',true);await page.evaluate(()=>(window as any).fail43());await lifecycle(page,'hidden',false);await expect(page.locator('#level-title')).toHaveText('Уровень 4');expect(errors).toEqual([]);
});
test('the last level opens level selection automatically after delayed resume',async({page})=>{
 await open(page,true);await page.locator('#continue').click();await lifecycle(page,'hidden',true);await page.evaluate(()=>(window as any).dismiss43());await lifecycle(page,'hidden',false);await expect(page.getByRole('heading',{name:'Уровни',exact:true})).toBeVisible();expect(await page.evaluate(()=>(window as any).adCalls43)).toBe(1);
});

test('explicit Undo cancels delayed Next and preserves the requested earlier board',async({page})=>{
 await open(page);const before=await saved(page);await page.locator('#continue').click();await lifecycle(page,'page',true);await page.locator('#undo').evaluate((b:HTMLButtonElement)=>b.click());await page.evaluate(()=>(window as any).dismiss43());await lifecycle(page,'page',false);const after=await saved(page);expect(after.current).toBe(2);expect(after.attempts['water-003@1'].history).toHaveLength(before.attempts['water-003@1'].history.length-1);await expect(page.locator('#continue')).toBeHidden();expect(await page.evaluate(()=>(window as any).adCalls43)).toBe(1);
});
