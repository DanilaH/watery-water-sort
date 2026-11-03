import {test,expect,type Page} from '@playwright/test';
import {fresh,seededRestart,attempt,goalFor,grantExtra,activeKey} from '../../src/core/session';
import {moves} from '../../src/core/rules';
async function open(page:Page,dense=false){
 let s=seededRestart({...fresh(),current:dense?59:2});s.settings.sound=false;if(dense)s=grantExtra(s,activeKey(s),3);
 await page.addInitScript(s=>localStorage.setItem('water-sort-v1',JSON.stringify(s)),s);await page.goto('/');
 await page.evaluate(async()=>{const path='/src/game/WaterScene.ts',m=await import(path),fn=m.WaterScene.prototype.positions;m.WaterScene.prototype.positions=function(){(window as any).touchScene50=this;return fn.call(this);};});
 await page.locator('#home-play').tap();await expect.poll(()=>page.evaluate(()=>!!(window as any).touchScene50?.ready)).toBe(true);
 await page.evaluate(()=>{const s=(window as any).touchScene50,fn=s.onTap;(window as any).tapCalls50=[];s.onTap=function(i:number|null){(window as any).tapCalls50.push(i);return fn.call(this,i);};});return s;
}
async function point(page:Page,i:number){return page.evaluate(i=>{const s=(window as any).touchScene50,r=s.positions()[i],b=s.game.canvas.getBoundingClientRect();return {x:b.x+r.x,y:b.y+(r.hitY??r.y+r.h/2)};},i);}
async function selected(page:Page){return page.evaluate(()=>(window as any).touchScene50.selected);}
for(const density of [2,3])test(`short real touch selects once, second tap deselects, two taps pour at DPR ${density}`,async({browser})=>{
 const c=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:density}),page=await c.newPage();try{
 const s=await open(page),m=moves(attempt(s).board,goalFor(s))[0],p=await point(page,m.from);
 await page.touchscreen.tap(p.x,p.y);await page.waitForTimeout(400);expect(await selected(page)).toBe(m.from);expect(await page.evaluate(()=>(window as any).tapCalls50)).toEqual([m.from]);
 await page.touchscreen.tap(p.x,p.y);await page.waitForTimeout(400);expect(await selected(page)).toBeNull();expect(await page.evaluate(()=>(window as any).tapCalls50)).toEqual([m.from,m.from]);
 await page.touchscreen.tap(p.x,p.y);const q=await point(page,m.to);await page.touchscreen.tap(q.x,q.y);await expect.poll(()=>page.evaluate(()=>Object.values(JSON.parse(localStorage.getItem('water-sort-v1')!).attempts).some((a:any)=>a.history.length===1))).toBe(true);
 expect(await page.evaluate(()=>(window as any).tapCalls50)).toEqual([m.from,m.from,m.from,m.to]);
 }finally{await c.close();}
});
test('a real mouse remains usable immediately after touch on a hybrid device',async({browser})=>{
 const c=await browser.newContext({viewport:{width:390,height:844},hasTouch:true}),page=await c.newPage();try{const s=await open(page),m=moves(attempt(s).board,goalFor(s))[0],p=await point(page,m.from);await page.touchscreen.tap(p.x,p.y);expect(await selected(page)).toBe(m.from);await page.mouse.click(p.x,p.y);expect(await selected(page)).toBeNull();expect(await page.evaluate(()=>(window as any).tapCalls50)).toEqual([m.from,m.from]);}finally{await c.close();}
});
test('scrollable field accepts a short tap but panning never selects or pours',async({browser})=>{
 const c=await browser.newContext({viewport:{width:320,height:480},isMobile:true,hasTouch:true,deviceScaleFactor:3}),page=await c.newPage();try{
 await open(page,true);await page.evaluate(()=>{document.body.classList.add('with-banner');document.getElementById('app')!.style.setProperty('--banner-height','60px');});await expect(page.locator('#board')).toHaveClass(/scroll-field/);await page.waitForTimeout(300);
 // Top ordinary vessel, outside the two receivers and closed ice.
 const p=await point(page,3);await page.touchscreen.tap(p.x,p.y);await page.waitForTimeout(400);expect({selected:await selected(page),calls:await page.evaluate(()=>(window as any).tapCalls50)}).toEqual({selected:3,calls:[3]});
 const b=(await page.locator('#board').boundingBox())!,client=await c.newCDPSession(page),x=b.x+b.width/2,y=b.y+b.height-20;
 await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});for(let n=1;n<=6;n++){await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y-n*16}]});await page.waitForTimeout(30);}await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await expect.poll(()=>page.locator('#board').evaluate(e=>e.scrollTop)).toBeGreaterThan(0);expect(await page.evaluate(()=>(window as any).tapCalls50)).toEqual([3]);expect(await selected(page)).toBe(3);
 }finally{await c.close();}
});

test('touch stays single when the browser has no mouse sourceCapabilities',async({browser})=>{
 const c=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),page=await c.newPage();try{await page.addInitScript(()=>Object.defineProperty(MouseEvent.prototype,'sourceCapabilities',{get:()=>null,configurable:true}));const s=await open(page),m=moves(attempt(s).board,goalFor(s))[0],p=await point(page,m.from);await page.touchscreen.tap(p.x,p.y);await page.waitForTimeout(400);expect(await selected(page)).toBe(m.from);expect(await page.evaluate(()=>(window as any).tapCalls50)).toEqual([m.from]);}finally{await c.close();}
});
