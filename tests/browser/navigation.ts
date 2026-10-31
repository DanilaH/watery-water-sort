import {expect,type Page} from '@playwright/test';
// Real navigation for pre-existing gameplay tests; new navigation tests use raw page.goto.
export async function resumeGame(page:Page){if(await page.locator('#home').isVisible()&&!await page.locator('dialog').isVisible()){await page.locator('#home-play').click();await expect(page.locator('#home')).toBeHidden();}}
export async function startGame(page:Page){await page.goto('/');await resumeGame(page);}
export async function reloadGame(page:Page){await page.reload();await resumeGame(page);}
export async function openLevels(page:Page){if(!await page.locator('#home').isVisible())await page.locator('#menu').click();await page.locator('#home-levels').click();}
export async function slotCount(page:Page){const {displaySlots}=await import('../../src/core/session');const s=await page.evaluate(()=>JSON.parse(localStorage.getItem('water-sort-v1')!));return displaySlots(s);}
export async function mockReward(page:Page){await page.evaluate(async()=>{const p='/src/platform/rewarded.ts',m=await import(p);m.Rewarded.prototype.request=async function(level:string){return {status:'rewarded',receipt:{level,token:'browser-test-'+level}};};});}
export async function unlockReward(page:Page){await page.getByRole('button',{name:'Добавить колбу',exact:true}).click();await page.getByRole('button',{name:'Смотреть рекламу',exact:true}).click();}

export async function toggleSymbols(page:Page){await page.locator('#settings').click();await page.getByRole('switch',{name:'Символы на цветах',exact:true}).click();await page.getByRole('button',{name:'Готово',exact:true}).click();}

/** Select stable content identity when a test targets a particular mechanic. */
export function levelButton(page:Page,index:number){return page.locator('.levels button[data-level="water-'+String(index+1).padStart(3,'0')+'"]');}
