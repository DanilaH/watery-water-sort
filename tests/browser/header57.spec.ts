import {test,expect} from '@playwright/test';
import {fresh} from '../../src/core/session';
import {campaign} from '../../src/core/campaign';

for(const [width,height,left,right] of [[320,480,0,0],[390,844,34,0],[640,320,48,16]]){
 test(`level panel stays centered as the coin balance grows at ${width}×${height}`,async({page})=>{
  const s={...fresh(),current:campaign[17]};
  await page.setViewportSize({width,height});
  await page.addInitScript(s=>localStorage.setItem('water-sort-v1',JSON.stringify(s)),s);
  await page.goto('/');
  await page.evaluate(({left,right})=>{
   document.documentElement.style.setProperty('--safe-area-inset-left',left+'px');
   document.documentElement.style.setProperty('--safe-area-inset-right',right+'px');
  },{left,right});
  await page.locator('#home-play').click();
  await expect(page.locator('#level-title')).toHaveText(/Уровень\s*18/);
  for(const coins of ['0','230','123456789']){
   await page.locator('#coins').evaluate((e,n)=>e.textContent=n,coins);
   const [wallet,title,settings]=await Promise.all(['#wallet','#level-title','#settings'].map(id=>page.locator(id).boundingBox()));
   expect(Math.abs(title!.x+title!.width/2-width/2)).toBeLessThanOrEqual(1);
   expect(wallet!.x).toBeGreaterThanOrEqual(left);
   expect(wallet!.x+wallet!.width).toBeLessThan(title!.x);
   expect(title!.x+title!.width).toBeLessThan(settings!.x);
   expect(settings!.x+settings!.width).toBeLessThanOrEqual(width-right);
  }
 });
}
