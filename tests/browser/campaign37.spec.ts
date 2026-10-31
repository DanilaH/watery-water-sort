import {test,expect,type Page} from '@playwright/test';
import {fresh,levels,moved,attempt,levelKey,type Save} from '../../src/core/session';
import {campaign,stageNumber} from '../../src/core/campaign';
import {openLevels,levelButton} from './navigation';
async function saved(p:Page){return p.evaluate(()=>JSON.parse(localStorage.getItem('water-sort-v1')!));}
async function open(p:Page,s:Save){s.settings.sound=false;await p.addInitScript(s=>{if(sessionStorage.campaign37)return;sessionStorage.campaign37='1';localStorage.setItem('water-sort-v1',JSON.stringify(s));},s);await p.goto('/');await p.evaluate(async()=>{const path='/src/game/WaterScene.ts',m=await import(path),fn=m.WaterScene.prototype.positions;m.WaterScene.prototype.positions=function(){(window as any).campaignScene=this;return fn.call(this);};});await p.locator('#home-play').click();await expect.poll(()=>p.evaluate(()=>!!(window as any).campaignScene)).toBe(true);await p.waitForTimeout(280);}
async function tap(p:Page,i:number){const b=(await p.locator('#board').boundingBox())!,r=await p.evaluate(i=>(window as any).campaignScene.positions()[i],i);await p.mouse.click(b.x+r.x,b.y+r.y+r.h/2);}

test('ordinary third puzzle advances into the large-goal tutorial and grid follows campaign order',async({page})=>{
 let s={...fresh(),current:2,completed:[levels[0].id,levels[1].id]};for(const m of levels[2].witness.slice(0,-1))s=moved(s,m);await open(page,s);const last=levels[2].witness.at(-1)!;await tap(page,last.from);await tap(page,last.to);await expect(page.locator('#continue')).toBeVisible();await page.locator('#continue').click();await expect(page.locator('#level-title')).toHaveText('Уровень 4');expect((await saved(page)).current).toBe(12);expect(attempt(await saved(page)).board).toEqual(levels[12].initial);await expect(page.locator('#objective')).toContainText('большую колбу');
 await openLevels(page);const ids=await page.locator('.levels button').evaluateAll(bs=>bs.map(b=>(b as HTMLElement).dataset.level));expect(ids).toEqual(campaign.map(i=>levels[i].id));await expect(levelButton(page,12)).toHaveAttribute('aria-current','step');await expect(levelButton(page,3)).toBeDisabled();await expect(levelButton(page,11)).toHaveAttribute('aria-label',/Уровень 40/);
});

test('resuming a legacy high-colour puzzle keeps the board and fills the earliest lesson gap after victory',async({page})=>{
 let s={...fresh(),current:7,completed:levels.slice(0,7).map(l=>l.id)};delete s.campaignVersion;for(const m of levels[7].witness.slice(0,-1))s=moved(s,m);const before=structuredClone(attempt(s));await open(page,s);await expect(page.locator('#level-title')).toHaveText('Уровень 26');expect(attempt(await saved(page))).toEqual(before);
 const last=levels[7].witness.at(-1)!;await tap(page,last.from);await tap(page,last.to);await expect(page.locator('#continue')).toBeVisible();await page.locator('#continue').click();await expect(page.locator('#level-title')).toHaveText('Уровень 4');const next=await saved(page);expect(next.current).toBe(12);expect(next.best[levelKey(7)].history).toHaveLength(levels[7].witness.length);expect(next.campaignVersion).toBe(1);expect(next.completed).not.toContain(levels[12].id);
});

test('legacy unlocked frontier stays selectable even when its new predecessor was never completed',async({page})=>{
 const s={...fresh(),current:16,completed:levels.slice(0,17).map(l=>l.id)};delete s.campaignVersion;await open(page,s);await openLevels(page);await expect(levelButton(page,17)).toBeEnabled();await expect(levelButton(page,24)).toBeDisabled();await levelButton(page,17).click();const next=await saved(page);expect(next.current).toBe(17);expect(next.unlocked).toContain(levels[17].id);await page.reload();await page.locator('#home-play').click();await expect(page.locator('#level-title')).toHaveText('Уровень 17');expect(attempt(await saved(page)).board).toEqual(levels[17].initial);
});

for(const [width,height]of [[320,480],[568,320],[390,844]])test(`new final level ends the campaign at ${width}x${height}`,async({page})=>{
 await page.setViewportSize({width,height});let s={...fresh(),current:11,completed:levels.filter((_,i)=>i!==11).map(l=>l.id)};for(const m of levels[11].witness.slice(0,-1))s=moved(s,m);await open(page,s);await expect(page.locator('#level-title')).toHaveText('Уровень 40');const last=levels[11].witness.at(-1)!;await tap(page,last.from);await tap(page,last.to);await expect(page.locator('#continue')).toHaveText('К уровням →');await expect(page.getByRole('heading',{name:'Пройдено!',exact:true})).toBeVisible();await page.locator('#continue').click();await expect(page.getByRole('heading',{name:'Уровни',exact:true})).toBeVisible();expect((await saved(page)).completed).toHaveLength(40);
});

test('failed write while changing campaign stage leaves the completed puzzle and its saved record intact',async({page})=>{
 let s={...fresh(),current:2,completed:[levels[0].id,levels[1].id]};for(const m of levels[2].witness)s=moved(s,m);await open(page,s);const before=await saved(page);await page.evaluate(()=>{Storage.prototype.setItem=function(){throw new DOMException('full','QuotaExceededError');};});await page.locator('#continue').click();await expect(page.locator('#status')).toContainText('Изменение не принято');expect(await saved(page)).toEqual(before);await expect(page.locator('#level-title')).toHaveText('Уровень 3');
});
