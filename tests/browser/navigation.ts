import {fresh,seededRestart,attempt} from '../../src/core/session';
import {expect,type Page} from '@playwright/test';
// Real navigation for pre-existing gameplay tests; new navigation tests use raw page.goto.
export async function resumeGame(page:Page){await expect(page.locator('body')).not.toHaveAttribute('data-booting','');if(await page.locator('#home').isVisible()&&!await page.locator('dialog').isVisible()){await page.locator('#home-play').click();await expect(page.locator('#home')).toBeHidden();}}
export async function startGame(page:Page){await page.goto('/');await resumeGame(page);}
export async function reloadGame(page:Page){await page.reload();await resumeGame(page);}
export async function openLevels(page:Page){if(!await page.locator('#home').isVisible())await home48(page);await page.locator('#home-levels').click();}
export async function slotCount(page:Page){const {displaySlots}=await import('../../src/core/session');const s=await page.evaluate(()=>JSON.parse(localStorage.getItem('water-sort-v1')!));return displaySlots(s);}
export async function mockReward(page:Page){await page.evaluate(async()=>{const p='/src/platform/rewarded.ts',m=await import(p);m.Rewarded.prototype.request=async function(level:string){return {status:'rewarded',receipt:{level,token:'browser-test-'+level}};};});}
export async function unlockReward(page:Page){await page.locator('dialog').getByRole('button',{name:/^Добавить колбу/}).click();}

export async function toggleSymbols(page:Page){await page.locator('#settings').click();await page.locator('dialog').getByRole('button',{name:'Настройки',exact:true}).click();await page.getByRole('switch',{name:'Символы на цветах',exact:true}).click();await page.getByRole('button',{name:'Назад',exact:true}).click();await page.getByRole('button',{name:'Закрыть',exact:true}).click();}

/** Select stable content identity when a test targets a particular mechanic. */
export function levelButton(page:Page,index:number){return page.locator('.levels button[data-level="water-'+String(index+1).padStart(3,'0')+'"]');}

/** Expected UI start, including real receiver liquid. */
export function startingBoard(index:number,extra=false){const b=attempt(seededRestart({...fresh(),current:index})).board;return extra?[...b,[]]:b;}

/** Real pause navigation after the quiet HUD redesign. */
export async function pause48(page:Page){
 if(await page.locator('#restart').isVisible())return;
 if(await page.locator('dialog').isVisible())await page.getByRole('button',{name:'Закрыть',exact:true}).click();
 await page.locator('#settings').click();
}
export async function home48(page:Page){if(await page.locator('#home').isVisible())return;await pause48(page);await page.locator('#menu').click();}
export async function restart48(page:Page){await pause48(page);await page.locator('#restart').click();}
export async function hint48(page:Page){await page.locator('#hint').click();}
export async function stars48(page:Page){await pause48(page);await page.locator('#star-target').click();}
export async function help48(page:Page){await pause48(page);await page.locator('#rescue').click();}
