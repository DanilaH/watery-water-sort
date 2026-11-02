import {test,expect,type Page} from '@playwright/test';
const home=(p:Page)=>p.locator('#home');
async function ready(page:Page){await expect(page.locator('body')).not.toHaveAttribute('data-booting','');await expect(home(page)).toBeVisible();expect(await page.locator('body').evaluate(b=>(b as HTMLElement).inert)).toBe(false);}
async function skin(page:Page){return page.locator('#home-play').evaluate(b=>({background:getComputedStyle(b).backgroundColor,image:getComputedStyle(b,'::before').borderImageSource,fallback:getComputedStyle(b,'::before').backgroundImage}));}

test('cold HTML stays hidden and inert until JavaScript is ready; static buttons already have the final classes',async({page})=>{
 let release!:()=>void;const gate=new Promise<void>(r=>release=r);
 await page.route(/\/(?:src\/main\.ts|assets\/index-[^/]+\.js)(?:\?.*)?$/,async route=>{await gate;await route.continue();});
 try{await page.goto('/',{waitUntil:'commit'});await expect(page.locator('body')).toHaveAttribute('data-booting','');await expect(page.locator('#home-play')).toHaveClass('gel-button gel-primary');await expect(home(page)).toBeHidden();expect(await page.locator('body').evaluate(b=>(b as HTMLElement).inert)).toBe(true);}
 finally{release();}
 await ready(page);expect((await skin(page)).image).toContain('button-gold-29.svg');expect((await skin(page)).background).toBe('rgba(0, 0, 0, 0)');
 await page.locator('#home-settings').click();await page.getByRole('button',{name:'Готово',exact:true}).click();await expect(page.locator('dialog')).toBeHidden();
});

test('delayed gold skin never exposes the old green button, and the first menu includes its final artwork and font',async({page})=>{
 let release!:()=>void;const gate=new Promise<void>(r=>release=r);
 await page.route('**/art/ui/button-gold-29.svg',async route=>{await gate;await route.continue();});
 try{await page.goto('/',{waitUntil:'domcontentloaded'});await expect(page.locator('body')).toHaveAttribute('data-theme','blue');await expect(home(page)).toBeHidden();expect(await page.locator('body').evaluate(b=>(b as HTMLElement).inert)).toBe(true);}
 finally{release();}
 await ready(page);await expect(page.locator('.home-hero[data-material=glass]')).toBeVisible();expect(await page.evaluate(()=>document.fonts.check('650 20px Rubik'))).toBe(true);await expect(page.locator('body')).not.toHaveAttribute('data-gold-fallback','');expect((await skin(page)).image).toContain('button-gold-29.svg');
 await page.locator('#home-play').click();await expect(home(page)).toBeHidden();await page.locator('#menu').click();await expect(home(page)).toBeVisible();
});

test('failed skins and font show usable stable fallback controls instead of trapping startup',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/art/ui/*-29.svg',r=>r.fulfill({status:404,body:''}));await page.route('**/fonts/rubik.woff',r=>r.fulfill({status:404,body:''}));await page.goto('/');await ready(page);
 for(const name of ['gold','blue','star','font'])await expect(page.locator('body')).toHaveAttribute(`data-${name}-fallback`,'');
 const s=await skin(page);expect(s.image).toBe('none');expect(s.fallback).toContain('linear-gradient');expect(s.background).toBe('rgba(0, 0, 0, 0)');await page.locator('#home-settings').click();await expect(page.locator('dialog')).toBeVisible();await page.getByRole('button',{name:'Готово',exact:true}).click();expect(errors).toEqual([]);
});

test('stalled image has a bounded startup and does not change the visible button when it eventually loads',async({page})=>{
 let release!:()=>void;const gate=new Promise<void>(r=>release=r);await page.route('**/art/ui/button-gold-29.svg',async route=>{await gate;await route.continue();});
 try{await page.goto('/',{waitUntil:'domcontentloaded'});await ready(page);await expect(page.locator('body')).toHaveAttribute('data-gold-fallback','');const before=await skin(page);release();await page.waitForLoadState('load');expect(await skin(page)).toEqual(before);await page.locator('#home-settings').click();await expect(page.locator('dialog')).toBeVisible();}
 finally{release();}
});
