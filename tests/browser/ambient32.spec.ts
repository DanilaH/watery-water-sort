import {test,expect} from '@playwright/test';
import {layout} from '../../src/game/geometry';
test('ambient stays behind usable controls, sleeps with blockers and respects reduced motion',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/');const layer=page.locator('#ambient'),mote=layer.locator('i').first();await expect(layer).toHaveAttribute('data-paused','false');expect(await layer.evaluate(e=>getComputedStyle(e).pointerEvents)).toBe('none');expect(await mote.evaluate(e=>getComputedStyle(e).animationPlayState)).toBe('running');
 await page.locator('#home-settings').click();await expect(layer).toHaveAttribute('data-paused','true');expect(await mote.evaluate(e=>getComputedStyle(e).animationPlayState)).toBe('paused');await page.getByRole('button',{name:'Готово',exact:true}).click();await expect(layer).toHaveAttribute('data-paused','false');
 await page.locator('#home-play').click();const b=(await page.locator('#board').boundingBox())!,ps=layout(b.width,b.height,4);for(const i of [0,2])await page.mouse.click(b.x+ps[i].x,b.y+ps[i].y+ps[i].h/2);await expect(page.locator('#moves')).toHaveText('Ходов: 1');
 await page.evaluate(()=>window.dispatchEvent(new Event('pagehide')));await expect(layer).toHaveAttribute('data-paused','true');await page.evaluate(()=>window.dispatchEvent(new Event('pageshow')));await expect(layer).toHaveAttribute('data-paused','false');
 await page.emulateMedia({reducedMotion:'reduce'});await expect(layer).toBeHidden();expect(await mote.evaluate(e=>getComputedStyle(e).animationName)).toBe('none');await page.emulateMedia({reducedMotion:'no-preference'});await expect(layer).toBeVisible();await expect(layer).toHaveAttribute('data-paused','false');
});
