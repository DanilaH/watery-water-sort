import {toggleSymbols} from './navigation';
import {test,expect,type Page} from '@playwright/test';
import {fresh,levels,moved,displaySlots} from '../../src/core/session';
import {layout} from '../../src/game/geometry';
async function open(page:Page,fast=false){const s=moved(fresh(),levels[0].witness[0]);s.settings.sound=false;s.settings.fast=fast;
 await page.addInitScript(s=>localStorage.setItem('water-sort-v1',JSON.stringify(s)),s);await page.goto('/');await page.locator('#home-play').click();await page.waitForTimeout(300);
 await page.evaluate(async()=>{const p='/src/game/WaterScene.ts',m=await import(p),g='/src/game/geometry.ts',geo=await import(g),fn=m.WaterScene.prototype.tube;(window as any).bodyFrames=[];
  m.WaterScene.prototype.tube=function(...args:any[]){const result=fn.apply(this,args),r=args[0],index=args[5];(window as any).materialScene=this;(window as any).bodyFrames.push({index,motion:this.bodyMotion.get(index)?.x??0,area:geo.area(result.poly),reference:geo.area(geo.vesselPolygon(r.w,r.h))});return result;};});
 await toggleSymbols(page);await expect.poll(()=>page.evaluate(()=>!!(window as any).materialScene)).toBe(true);
 await page.evaluate(()=>{const s=(window as any).materialScene,phase=s.onPhase,seal=s.onSeal;(window as any).materialBeats=[];(window as any).materialSeats=[];s.onPhase=(n:number,heavy:boolean)=>{(window as any).materialBeats.push(n);phase(n,heavy);};s.onSeal=()=>{(window as any).materialSeats.push(performance.now());seal();};});return s;
}
async function finishColour(page:Page,s:ReturnType<typeof fresh>){const b=(await page.locator('#board').boundingBox())!,ps=layout(b.width,b.height,displaySlots(s)),m=levels[0].witness[1];for(const i of [m.from,m.to])await page.mouse.click(b.x+ps[i].x,b.y+ps[i].y+ps[i].h/2);return m.to;}
for(const fast of [false,true])test(`fill deforms area-preserving glass, reaches three beats, and Undo clears it (${fast?'fast':'normal'})`,async({page})=>{
 const s=await open(page,fast),target=await finishColour(page,s);await expect.poll(()=>page.evaluate(()=>(window as any).materialBeats)).toEqual([0,1,2]);
 const frames=await page.evaluate(i=>(window as any).bodyFrames.filter((f:any)=>f.index===i),target);expect(frames.some((f:any)=>f.motion>.2)).toBe(true);expect(frames.some((f:any)=>f.motion<-.2)).toBe(true);for(const f of frames)expect(Math.abs(f.area/f.reference-1)).toBeLessThan(.000001);
 expect(await page.evaluate(()=>(window as any).materialSeats.length)).toBe(1);await expect(page.locator('#continue')).toBeHidden();await page.locator('#undo').click();await expect(page.locator('#moves')).toHaveText('Ходов: 1');expect(await page.evaluate(()=>(window as any).materialScene.bodyMotion.size)).toBe(0);
 await page.waitForTimeout(800);expect(await page.evaluate(()=>(window as any).materialSeats.length)).toBe(1);await page.locator('#menu').click();expect(await page.evaluate(()=>{const s=(window as any).materialScene;return s.bodyMotion.size+s.liquid.size+s.particles.length;})).toBe(0);
});
test('reduced motion omits body deformation and splashes while retaining the solved colour',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});const s=await open(page),target=await finishColour(page,s);await expect.poll(()=>page.evaluate(()=>(window as any).materialBeats)).toEqual([0,1,2]);expect(await page.evaluate(()=>{const s=(window as any).materialScene;return s.bodyMotion.size+s.liquid.size+s.particles.length;})).toBe(0);expect(await page.evaluate(i=>(window as any).materialScene.board[i].length,target)).toBe(4);
});
