import {levelButton} from './navigation';
import {test,expect,type Page} from '@playwright/test';
import {fresh,levels,levelKey,moved,expanded,attempt,type Save} from '../../src/core/session';
import {layout} from '../../src/game/geometry';
async function seed(page:Page,state:Save){await page.addInitScript(s=>{if(sessionStorage.nav13)return;sessionStorage.nav13='1';localStorage.setItem('water-sort-v1',JSON.stringify(s));},state);}
async function saved(page:Page):Promise<Save>{return page.evaluate(()=>JSON.parse(localStorage.getItem('water-sort-v1')!));}
async function tap(page:Page,i:number,count=4){const b=(await page.locator('#board').boundingBox())!,p=layout(b.width,b.height,count)[i];await page.mouse.click(b.x+p.x,b.y+p.y+p.h/2);}
async function home(page:Page){await page.locator('#menu').click();await expect(page.locator('#home')).toBeVisible();}

test('first launch shows home; settings do not start the game; first Play persists a start',async({page})=>{
 await page.goto('/');await expect(page.getByRole('heading',{name:'Переливы',exact:true})).toBeVisible();await expect(page.locator('#home-play')).toHaveText('Играть');await expect(page.locator('#app')).toBeHidden();
 await page.locator('#home-settings').click();await page.getByRole('switch',{name:'Звуки',exact:true}).uncheck();await page.getByRole('button',{name:'Готово',exact:true}).click();await expect(page.locator('#home-play')).toHaveText('Играть');
 await page.locator('#home-play').click();await expect(page.locator('#home')).toBeHidden();expect(attempt(await saved(page)).history).toHaveLength(0);await home(page);await expect(page.locator('#home-play')).toHaveText('Продолжить');
 await page.reload();await expect(page.locator('#home-play')).toHaveText('Продолжить');expect((await saved(page)).settings.sound).toBe(false);
});

test('Continue retains the exact accepted attempt through home, settings, Escape and reload',async({page})=>{
 const state=moved(fresh(),levels[0].witness[0]);await seed(page,state);await page.goto('/');await expect(page.locator('#home-summary')).toContainText('ходов: 1');await page.locator('#home-play').click();await expect(page.locator('#moves')).toHaveText('Ходов: 1');await page.keyboard.press('Escape');await expect(page.locator('#home')).toBeVisible();expect(await saved(page)).toEqual(state);
 await page.locator('#home-settings').click();await page.keyboard.press('Escape');await expect(page.locator('#home')).toBeVisible();await page.reload();await expect(page.locator('#home')).toBeVisible();await page.locator('#home-play').click();expect(await saved(page)).toEqual(state);await expect(page.locator('#moves')).toHaveText('Ходов: 1');
});

for(const solved of [false,true])test(`selecting the current ${solved?'completed':'unfinished'} level starts fresh and preserves completion and extra tube`,async({page})=>{
 let state=fresh();for(const move of levels[0].witness.slice(0,solved?undefined:1))state=moved(state,move);state=expanded(state);if(solved)state.completed=[levels[0].id];await seed(page,state);await page.goto('/');await page.locator('#home-levels').click();await page.locator('.levels button').first().click();
 const next=await saved(page);expect(attempt(next).history).toHaveLength(0);expect(attempt(next).board).toEqual([...levels[0].initial,[]]);expect(attempt(next).extra).toBe(true);expect(next.completed).toEqual(state.completed);await expect(page.locator('#continue')).toBeHidden();
 await page.locator('canvas').waitFor();await page.waitForTimeout(150);await tap(page,0,5);await tap(page,4,5);await expect(page.locator('#moves')).toHaveText('Ходов: 1');
});

test('choosing another previously played level resets that level, not the attempt being left',async({page})=>{
 let state=moved(fresh(),levels[0].witness[0]);state.completed=[levels[0].id];state.current=1;state=moved(state,levels[1].witness[0]);state=expanded(state);state.current=0;const old=structuredClone(attempt(state));await seed(page,state);await page.goto('/');await page.locator('#home-levels').click();await levelButton(page,1).click();const next=await saved(page);
 expect(next.current).toBe(1);expect(next.attempts[levelKey(0)]).toEqual(old);expect(attempt(next).board).toEqual([...levels[1].initial,[]]);expect(attempt(next).history).toHaveLength(0);expect(attempt(next).extra).toBe(true);
});

test('Restart cancellation leaves progress intact; confirmation retains extra tube and completed levels',async({page})=>{
 const state=expanded(moved(fresh(),levels[0].witness[0]));state.completed=[levels[0].id];await seed(page,state);await page.goto('/');await page.locator('#home-play').click();await page.locator('#restart').click();await page.getByRole('button',{name:'Продолжить игру',exact:true}).click();expect(await saved(page)).toEqual(state);
 await page.locator('#restart').click();await page.getByRole('button',{name:'Начать заново',exact:true}).click();const next=await saved(page);expect(attempt(next).board).toEqual([...levels[0].initial,[]]);expect(next.completed).toEqual(state.completed);expect(attempt(next).extra).toBe(true);
 await page.locator('#restart').click();await expect(page.getByRole('heading',{name:'Начать заново?',exact:true})).toBeVisible();
});

test('failed level reset cannot discard the attempt; home Continue still restores it',async({page})=>{
 const state=moved(fresh(),levels[0].witness[0]);await seed(page,state);await page.goto('/');await page.locator('#home-levels').click();await page.evaluate(()=>{const set=Storage.prototype.setItem;(window as any).restoreWrite=()=>Storage.prototype.setItem=set;Storage.prototype.setItem=function(k,v){if(k.startsWith('water-sort-v1'))throw Error('full');set.call(this,k,v);};});await page.locator('.levels button').first().click();await expect(page.getByRole('alert')).toContainText('Изменение не принято');expect(await saved(page)).toEqual(state);await page.getByRole('button',{name:'Закрыть',exact:true}).click();await page.evaluate(()=>(window as any).restoreWrite());await page.locator('#home-play').click();await expect(page.locator('#moves')).toHaveText('Ходов: 1');expect(await saved(page)).toEqual(state);
});

test('home interrupts queued actions, preserving only the accepted move',async({page})=>{
 await page.goto('/');await page.locator('#home-play').click();await page.locator('canvas').waitFor();await page.waitForTimeout(150);const box=(await page.locator('#board').boundingBox())!,poses=layout(box.width,box.height,4),click=(i:number)=>page.mouse.click(box.x+poses[i].x,box.y+poses[i].y+poses[i].h/2);
 await page.evaluate(()=>{new MutationObserver(()=>{if(document.getElementById('status')!.textContent!.includes('Следующий ход выбран')&&!(window as any).homeAtQueue){(window as any).homeAtQueue={moves:JSON.parse(localStorage.getItem('water-sort-v1')!).attempts['water-001@1'].history.length,busy:document.body.classList.contains('pouring')};document.getElementById('menu')!.click();}}).observe(document.getElementById('status')!,{childList:true,subtree:true,characterData:true});});
 await click(0);await click(2);await click(1);await click(0);await expect(page.locator('#home')).toBeVisible();expect(await page.evaluate(()=>(window as any).homeAtQueue)).toEqual({moves:1,busy:true});await page.waitForTimeout(700);expect(attempt(await saved(page)).history).toHaveLength(1);await page.locator('#home-play').click();await expect(page.locator('#moves')).toHaveText('Ходов: 1');
});

for(const [width,height]of [[320,480],[568,320]])test(`home fits ${width}x${height} with full controls and independent settings`,async({page})=>{
 await page.setViewportSize({width,height});await page.goto('/');for(const id of ['home-play','home-levels','home-settings']){const r=(await page.locator('#'+id).boundingBox())!;expect(r.height).toBeGreaterThanOrEqual(48);expect(r.y).toBeGreaterThanOrEqual(0);expect(r.y+r.height).toBeLessThanOrEqual(height);}
 await page.locator('#home-settings').click();await expect(page.getByRole('heading',{name:'Настройки',exact:true})).toBeVisible();await page.getByRole('button',{name:'Готово',exact:true}).click();await expect(page.locator('#home')).toBeVisible();
});
