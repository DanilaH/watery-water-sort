import {expect,type Page} from '@playwright/test';
// Real navigation for pre-existing gameplay tests; new navigation tests use raw page.goto.
export async function resumeGame(page:Page){if(await page.locator('#home').isVisible()&&!await page.locator('dialog').isVisible()){await page.locator('#home-play').click();await expect(page.locator('#home')).toBeHidden();}}
export async function startGame(page:Page){await page.goto('/');await resumeGame(page);}
export async function reloadGame(page:Page){await page.reload();await resumeGame(page);}
export async function openLevels(page:Page){if(!await page.locator('#home').isVisible())await page.locator('#menu').click();await page.locator('#home-levels').click();}
