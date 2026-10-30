import {test,expect} from '@playwright/test';

test('menu glass and liquid move without changing progress, and sleep behind navigation',async({page})=>{
 await page.goto('/');const hero=page.locator('.home-hero[data-material=glass]');await expect(hero).toHaveAttribute('data-motion','playing');
 const saved=await page.evaluate(()=>localStorage.getItem('water-sort-v1')),first=await hero.innerHTML();await page.waitForTimeout(250);expect(await hero.innerHTML()).not.toBe(first);expect(await page.evaluate(()=>localStorage.getItem('water-sort-v1'))).toBe(saved);await expect(page.locator('canvas')).toHaveCount(1);
 await page.locator('#home-settings').click();await expect(hero).toHaveAttribute('data-motion','paused');const paused=await hero.innerHTML();await page.waitForTimeout(200);expect(await hero.innerHTML()).toBe(paused);
 await page.getByRole('button',{name:'Готово',exact:true}).click();await expect(hero).toHaveAttribute('data-motion','playing');await expect.poll(()=>hero.innerHTML()).not.toBe(paused);
 await page.locator('#home-play').click();await expect(hero).toHaveAttribute('data-motion','paused');const inGame=await hero.innerHTML();await page.waitForTimeout(200);expect(await hero.innerHTML()).toBe(inGame);
 await page.locator('#menu').click();await expect(hero).toHaveAttribute('data-motion','playing');await page.evaluate(()=>window.dispatchEvent(new Event('pagehide')));await expect(hero).toHaveAttribute('data-motion','paused');const background=await hero.innerHTML();await page.waitForTimeout(200);expect(await hero.innerHTML()).toBe(background);await page.evaluate(()=>window.dispatchEvent(new Event('pageshow')));await expect(hero).toHaveAttribute('data-motion','playing');await expect.poll(()=>hero.innerHTML()).not.toBe(background);
});

test('reduced motion keeps a static illustration and live preference changes preserve layout',async({page})=>{
 await page.setViewportSize({width:320,height:480});await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/');const hero=page.locator('.home-hero[data-material=glass]');await expect(hero).toHaveAttribute('data-motion','reduced');const quiet=await hero.innerHTML(),box=await hero.boundingBox();await page.waitForTimeout(250);expect(await hero.innerHTML()).toBe(quiet);
 await page.emulateMedia({reducedMotion:'no-preference'});await expect(hero).toHaveAttribute('data-motion','playing');await expect.poll(()=>hero.innerHTML()).not.toBe(quiet);expect(await hero.boundingBox()).toEqual(box);
 await page.emulateMedia({reducedMotion:'reduce'});await expect(hero).toHaveAttribute('data-motion','reduced');const again=await hero.innerHTML();await page.waitForTimeout(250);expect(await hero.innerHTML()).toBe(again);expect(await hero.boundingBox()).toEqual(box);
});
