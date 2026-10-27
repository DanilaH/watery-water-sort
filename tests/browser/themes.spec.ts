import {test,expect} from '@playwright/test';
import {fresh,moved,levels} from '../../src/core/session';
import {THEMES} from '../../src/core/themes';
import {startGame,reloadGame} from './navigation';

test('all four themes persist without changing an accepted attempt',async({page})=>{
 const s=moved(fresh(),levels[0].witness[0]);await page.addInitScript(s=>{if(!sessionStorage.seedTheme){sessionStorage.seedTheme='1';localStorage.setItem('water-sort-v1',JSON.stringify(s));}},s);
 await startGame(page);
 for(const t of THEMES){
  await page.locator('#settings').click();await page.getByRole('button',{name:t.name,exact:true}).click();
  await expect(page.locator('body')).toHaveAttribute('data-theme',t.id);await expect(page.getByRole('button',{name:t.name,exact:true})).toHaveAttribute('aria-pressed','true');
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('water-sort-v1')!));expect(saved.attempts).toEqual(s.attempts);expect(saved.revision).toBe(s.revision);expect(saved.settings.theme).toBe(t.id);
  await page.getByRole('button',{name:'Готово',exact:true}).click();await reloadGame(page);await expect(page.locator('body')).toHaveAttribute('data-theme',t.id);await expect(page.locator('#moves')).toHaveText('Ходов: 1');
 }
});

test('legacy light preference loads as Ice without resetting progress',async({page})=>{
 const s=moved(fresh(),levels[0].witness[0]);s.settings.light=true;
 await page.addInitScript(s=>localStorage.setItem('water-sort-v1',JSON.stringify(s)),s);await startGame(page);await expect(page.locator('body')).toHaveAttribute('data-theme','ice');await expect(page.locator('#moves')).toHaveText('Ходов: 1');
});

test('failed theme save keeps the current theme and selected button',async({page})=>{
 await startGame(page);await page.locator('#settings').click();await page.evaluate(()=>{Storage.prototype.setItem=()=>{throw new Error('storage failed');};});
 await page.getByRole('button',{name:'Сливовый',exact:true}).click();await expect(page.locator('body')).toHaveAttribute('data-theme','blue');await expect(page.getByRole('button',{name:'Синий',exact:true})).toHaveAttribute('aria-pressed','true');await expect(page.getByRole('button',{name:'Сливовый',exact:true})).toHaveAttribute('aria-pressed','false');await expect(page.locator('.dialog-body [role=alert]')).toBeVisible();
});

test('all themes fit small portrait and landscape with reduced motion',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});for(const [width,height]of [[568,320],[320,480]]){await page.setViewportSize({width,height});await startGame(page);await page.locator('#settings').click();
 for(const t of THEMES){const b=page.getByRole('button',{name:t.name,exact:true});await b.scrollIntoViewIfNeeded();const r=(await b.boundingBox())!;expect(r.width).toBeGreaterThanOrEqual(48);expect(r.height).toBeGreaterThanOrEqual(48);await b.click();await expect(page.locator('body')).toHaveAttribute('data-theme',t.id);expect(await b.evaluate(e=>e.scrollWidth<=e.clientWidth)).toBe(true);}
 await page.getByRole('button',{name:'Готово',exact:true}).click();await expect(page.locator('dialog')).not.toBeVisible();expect(await page.locator('#app').evaluate(e=>getComputedStyle(e).animationName)).toBe('none');}
});
