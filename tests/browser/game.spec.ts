import {startGame,reloadGame,openLevels,resumeGame} from './navigation';
import { test,expect } from '@playwright/test';
import { layout } from '../../src/game/geometry';
import {readFileSync} from 'node:fs';
const levels=JSON.parse(readFileSync(new URL('../../src/core/levels.json',import.meta.url),'utf8'));
async function tap(page:import('@playwright/test').Page,index:number,count=4){const box=(await page.locator('#board').boundingBox())!;const p=layout(box.width,box.height,count)[index];await page.mouse.click(box.x+p.x,box.y+p.y+p.h/2);}
test('complete tutorial, retain move during animation, undo after reload',async({page})=>{
 await page.setViewportSize({width:390,height:844});const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await startGame(page);await expect(page.locator('canvas')).toBeVisible();await page.waitForTimeout(300);
 await tap(page,0);await tap(page,2);await expect(page.locator('#moves')).toHaveText('Ходов: 1');await reloadGame(page);await expect(page.locator('#moves')).toHaveText('Ходов: 1');await page.locator('#undo').click();await expect(page.locator('#moves')).toHaveText('Ходов: 0');await page.waitForTimeout(350);
 for(const m of levels[0].witness){await tap(page,m.from);await tap(page,m.to);await page.waitForTimeout(600);}
 await expect(page.getByRole('heading',{name:'Готово!'})).toBeVisible();await page.getByRole('button',{name:'Дальше →'}).click();await expect(page.locator('#level-title')).toHaveText('Уровень 2');expect(errors).toEqual([]);
});
test('hint, symbols, fast mode, themes and layouts',async({page})=>{
 await startGame(page);await page.locator('#hint').click();await expect(page.locator('#status')).toContainText('Перелей');await page.locator('#symbols').click();await expect(page.locator('#symbols')).toHaveAttribute('aria-pressed','true');
 await page.locator('#settings').click();await page.getByLabel('Быстрое переливание').check();await page.getByRole('button',{name:'Лёд',exact:true}).click();await page.getByRole('button',{name:'Готово',exact:true}).click();await expect(page.locator('body')).toHaveClass('light');
 for(const [width,height]of [[320,568],[844,390],[768,1024]]){await page.setViewportSize({width,height});await page.waitForTimeout(150);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);for(const id of ['undo','restart','hint','symbols','board','banner-slot']){const b=(await page.locator('#'+id).boundingBox())!;expect(b.x).toBeGreaterThanOrEqual(0);expect(b.x+b.width).toBeLessThanOrEqual(width+1);expect(b.y+b.height).toBeLessThanOrEqual(height+1);}}
});

test('all revised foley assets decode and stay within audio headroom',async({page})=>{
 await startGame(page);
 const results=await page.evaluate(async()=>{
  const context=new AudioContext();const names=['select','accept','cork','land','reject','hint','complete','victory','pour-1','pour-2','pour-3'];
  const results=[];
  for(const name of names){const response=await fetch('/audio/'+name+'.ogg');const buffer=await context.decodeAudioData(await response.arrayBuffer());const samples=buffer.getChannelData(0);let peak=0,energy=0;for(const v of samples){peak=Math.max(peak,Math.abs(v));energy+=v*v;}results.push({name,peak,rms:Math.sqrt(energy/samples.length),duration:buffer.duration});}
  await context.close();return results;
 });
 expect(results).toHaveLength(11);for(const cue of results){expect(cue.peak).toBeLessThan(.85);expect(cue.rms).toBeGreaterThan(.025);expect(cue.duration).toBeLessThan(1);}
});
