import {hint48,home48,stars48} from './navigation';
import {test,expect,type Page} from '@playwright/test';
import {fresh,levels,attempt,levelKey,seededRestart,goalFor,displaySlots,moved} from '../../src/core/session';
import {goalList,moveFor} from '../../src/core/rules';import {goalStart,playerMoves} from '../../src/core/goalStart';import {targets} from '../../src/core/ratings';import proof from '../../docs/audits/campaign-54/prepared.json' with {type:'json'};
async function saved(page:Page){return page.evaluate(()=>JSON.parse(localStorage.getItem('water-sort-v1')!));}
async function open(page:Page,index:number,win=false){let s={...fresh(),current:index,completed:levels.map(l=>l.id)};s.settings.sound=false;
 if(win){s=seededRestart(s);for(const m of proof.find(p=>p.level===index&&!p.extra)!.path)s=moved(s,m);}
 await page.addInitScript(s=>{if(sessionStorage.visual44)return;sessionStorage.visual44='1';localStorage.setItem('water-sort-v1',JSON.stringify(s));},s);await page.goto('/');
 await page.evaluate(async()=>{const p='/src/game/WaterScene.ts',m=await import(p),f=m.WaterScene.prototype.positions;m.WaterScene.prototype.positions=function(){(window as any).visual44=this;return f.call(this);};});
 await page.locator('#home-play').click();await expect(page.locator('canvas')).toBeVisible();await page.waitForTimeout(350);
}
async function tap(page:Page,index:number){const r=await page.evaluate(i=>{const s=(window as any).visual44,p=s.positions()[i],b=document.getElementById('board')!.getBoundingClientRect();return {x:b.x+p.x,y:b.y+p.y+p.h/2};},index);await page.mouse.click(r.x,r.y);}
for(const [width,height]of [[320,480],[390,844],[568,320]])for(const index of [12,16])test(`real initial colour, zero moves, no text goal, unobstructed field ${index} at ${width}x${height}`,async({page})=>{
 await page.setViewportSize({width,height});await open(page,index);const s=await saved(page),a=attempt(s),gs=goalList(goalFor(s));expect(a).toEqual(attempt(seededRestart({...fresh(),current:index})));expect(playerMoves(a)).toBe(0);expect(gs.every(g=>a.board[g.index].length>0)).toBe(true);
 await expect(page.locator('#moves')).toHaveText('Ходов: 0');await expect(page.locator('#undo')).toBeDisabled();await expect(page.locator('#objective')).toBeHidden();await expect(page.locator('#status')).toHaveText(index===12?'В большую колбу собирай только её цвет':'');
 expect(await page.evaluate(()=>{const s=(window as any).visual44;return s.board.slice(0,s.goal.goals?.length??(Array.isArray(s.goal)?s.goal.length:1));})).toEqual(a.board.slice(0,gs.length));
 for(const id of ['board','feedback','undo','shuffle','extra-tube']){if(id==='extra-tube'&&!await page.locator('#'+id).isVisible())continue;const r=(await page.locator('#'+id).boundingBox())!;expect(r.x).toBeGreaterThanOrEqual(0);expect(r.y+r.height).toBeLessThanOrEqual(height+.1);expect(r.x+r.width).toBeLessThanOrEqual(width+.1);}
 if(process.env.QA_SCREENSHOT_DIR)await page.screenshot({path:`${process.env.QA_SCREENSHOT_DIR}/goal-${gs.length}-${width}x${height}.png`});
 await stars48(page);await expect(page.locator('.dialog-body')).toContainText(`${targets(levelKey(index)).three-goalStart(levels[index]).length} ходов`);await page.getByRole('button',{name:'Понятно',exact:true}).click();
 await page.reload();await page.locator('#home-play').click();expect(attempt(await saved(page))).toEqual(a);
});
test('select and replay start filled; Undo cannot remove setup; hint and star scale agree',async({page})=>{
 await open(page,16);await hint48(page);await expect(page.locator('#status')).toContainText('Перелей');const m=await page.evaluate(()=>(window as any).visual44.hintMove),before=await saved(page);expect(m).toEqual(moveFor(attempt(before).board,m.from,m.to,goalFor(before)));
 await tap(page,m.to);await expect(page.locator('#moves')).toHaveText('Ходов: 1');await expect(page.locator('#hint')).toBeEnabled();await page.locator('#undo').click();await expect(page.locator('#moves')).toHaveText('Ходов: 0');expect(attempt(await saved(page))).toEqual(attempt(before));await expect(page.locator('#undo')).toBeDisabled();
 await home48(page);await page.locator('#home-levels').click();await expect(page.locator('.level-mechanic')).toHaveCount(0);await expect(page.locator('.levels')).not.toContainText(/ходов|Мини|Цель/);await page.locator('[data-level="water-013"]').click();await expect(page.locator('#moves')).toHaveText('Ходов: 0');expect(attempt(await saved(page)).board[0].length).toBeGreaterThan(0);
});
test('selection feedback is visual after tutorial; completed result avoids duplicate counters',async({page})=>{
 await open(page,12,true);await expect(page.locator('#continue')).toBeVisible();await expect(page.locator('#status')).toHaveText('');await expect(page.locator('#earned-stars')).toHaveText('★★★');await expect(page.locator('#moves')).toHaveText(`Ходов: ${proof.find(p=>p.level===12&&!p.extra)!.optimal}`);
 await home48(page);await expect(page.locator('#home-summary')).toHaveText('Уровень 4');await page.locator('#home-levels').click();await page.locator('[data-level="water-014"]').click();const s=await saved(page),i=attempt(s).board.findIndex((t,i)=>t.length>0&&!goalList(goalFor(s)).some(g=>g.index===i));await tap(page,i);await expect(page.locator('#status')).toHaveText('');
});
