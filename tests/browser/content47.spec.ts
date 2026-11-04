import {home48,restart48} from './navigation';
import {test,expect,type Page} from '@playwright/test';
import legacy from '../../src/core/levels-v1.json' with {type:'json'};
import legacyProof from '../../docs/audits/campaign-39/optimal.json' with {type:'json'};
import {fresh,replay,levels,levelKey,activeKey,attempt,type Level} from '../../src/core/session';
import {SaveStore} from '../../src/platform/storage';
async function saved(page:Page){return page.evaluate(()=>JSON.parse(localStorage.getItem('water-sort-v1')!));}
async function openLegacy(page:Page,index=2,win=false){const s={...fresh(),current:index,completed:levels.map(l=>l.id)};s.settings.sound=false;const l=legacy[index]as Level;s.attempts[`${l.id}@1`]=replay(l,win?legacyProof.find(p=>p.level===index&&!p.extra)!.path:l.witness.slice(0,1),false);
 await page.addInitScript(s=>{if(sessionStorage.content47)return;sessionStorage.content47='1';localStorage.setItem('water-sort-v1',JSON.stringify(s));},s);await page.goto('/');await page.locator('#home-play').click();return s;
}
test('legacy Continue and restart retain the exact old board; map selection resumes the saved revision',async({page})=>{
 const s=await openLegacy(page);expect(attempt(await saved(page))).toEqual(attempt(s));expect(activeKey(await saved(page))).toBe('water-003@1');
 await restart48(page);await page.getByRole('button',{name:'Начать заново',exact:true}).click();expect(activeKey(await saved(page))).toBe('water-003@1');expect(attempt(await saved(page)).board).toEqual(legacy[2].initial);
 await home48(page);await page.locator('#home-levels').click();await page.locator('[data-level="water-003"]').click();const next=await saved(page);expect(activeKey(next)).toBe('water-003@1');expect(attempt(next).board).toEqual(legacy[2].initial);expect(next.attempts['water-003@1']).toBeDefined();
 await page.reload();await page.locator('#home-play').click();expect(activeKey(await saved(page))).toBe('water-003@1');
});
test('legacy stars remain on the map after the revised board starts and old Next still advances',async({page})=>{
 await openLegacy(page,2,true);await expect(page.locator('#continue')).toBeVisible();await page.locator('#continue').click();await expect(page.locator('#level-title')).toHaveText('Уровень 4');
 await home48(page);await page.locator('#home-levels').click();const button=page.locator('[data-level="water-003"]');await expect(button.locator('.map-star[data-filled="true"]')).toHaveCount(3);await button.click();
 await home48(page);await page.locator('#home-levels').click();await expect(page.locator('[data-level="water-003"] .map-star[data-filled="true"]')).toHaveCount(3);
});
for(const [width,height]of [[320,480],[390,844],[568,320]])test(`revised receiver starts coloured and the tighter field fits ${width}x${height}`,async({page})=>{
 await page.setViewportSize({width,height});const s={...fresh(),current:26};s.settings.sound=false;
 await page.addInitScript(s=>localStorage.setItem('water-sort-v1',JSON.stringify(s)),s);await page.goto('/');await page.locator('#home-play').click();const a=attempt(await saved(page));expect(a.board[0]).toEqual([0,0,0,0]);expect(a.history).toHaveLength(0);await expect(page.locator('#undo')).toBeDisabled();
 for(const id of ['board','shuffle','extra-tube']){const b=(await page.locator('#'+id).boundingBox())!;expect(b.x).toBeGreaterThanOrEqual(0);expect(b.x+b.width).toBeLessThanOrEqual(width+.1);expect(b.y+b.height).toBeLessThanOrEqual(height+.1);}
 if(process.env.QA_SCREENSHOT_DIR)await page.screenshot({path:`${process.env.QA_SCREENSHOT_DIR}/campaign47-${width}x${height}.png`});
});
