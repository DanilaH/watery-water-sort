import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {fresh,levels,moved,attempt} from '../../src/core/session';
import {moves,transition,type Board,type Move} from '../../src/core/rules';
import {positionKey} from '../../src/core/solver';
import {layout} from '../../src/game/geometry';

test('a resumed cyclic dead board shows help before any pour and restarts directly',async({page})=>{
 const corpus=JSON.parse(gunzipSync(readFileSync('docs/audits/product-08/exploratory-corpus.json.gz')).toString()) as {level:string;board:Board;history:Move[];status:string}[];
 const repeat=(b:Board)=>moves(b).find(m=>positionKey(b)===positionKey(transition(b,m).board));
 const item=corpus.find(x=>x.status==='UNSOLVABLE'&&repeat(x.board))!;
 const s=fresh();s.current=levels.findIndex(l=>l.id===item.level);s.attempts[item.level+'@1']={board:item.board,history:item.history,extra:false};
 await page.setViewportSize({width:360,height:800});
 await page.addInitScript(s=>localStorage.setItem('water-sort-v1',JSON.stringify(s)),s);
 await page.goto('/');await page.locator('#home-play').click();
 await expect(page.locator('#status')).toContainText('Решения нет');
 await expect(page.locator('#shuffle')).toHaveClass(/rescue-highlight/);
 await expect(page.locator('.boosters .rescue-highlight')).toHaveCount(1);
 expect((await page.locator('#notice').boundingBox())!.y+(await page.locator('#notice').boundingBox())!.height).toBeLessThan((await page.locator('#shuffle').boundingBox())!.y);
 await expect(page.locator('#shuffle-count')).toHaveText(String(s.wallet!.hints));
 await page.locator('#notice-restart').click();
 await expect(page.locator('dialog')).toBeHidden();
 await expect(page.locator('#moves')).toHaveText('Ходов: 0');
 expect(attempt(await page.evaluate(()=>JSON.parse(localStorage.getItem('water-sort-v1')!))).history).toHaveLength(0);
});

for(const [width,height] of [[360,760],[320,480],[640,320]])test(`pause stays inside native insets at ${width}×${height}`,async({page})=>{
 await page.setViewportSize({width,height});await page.goto('/');
 await page.evaluate(()=>{for(const [side,n]of Object.entries({top:37,bottom:44,left:24,right:16}))document.documentElement.style.setProperty('--safe-area-inset-'+side,n+'px');});
 await page.locator('#home-play').click();await page.locator('#settings').click();
 await expect(page.getByRole('heading',{name:'Пауза'})).toBeVisible();
 const b=(await page.locator('dialog').boundingBox())!;
 expect(b.x).toBeGreaterThanOrEqual(24);expect(b.x+b.width).toBeLessThanOrEqual(width-16);
 expect(b.y).toBeGreaterThanOrEqual(37);expect(b.y+b.height).toBeLessThanOrEqual(height-44);
 await expect(page.getByRole('button',{name:'Варианты',exact:true})).toHaveCount(0);
 const scroll=()=>page.locator('.dialog-body').evaluate(el=>el.scrollTop);
 const lagoon=page.getByRole('button',{name:'Лагуна',exact:true});await lagoon.scrollIntoViewIfNeeded();const before=await scroll();
 await lagoon.click();expect(await scroll()).toBe(before);
 await expect(page.locator('body')).toHaveAttribute('data-theme','plum');
 await page.getByRole('button',{name:'Закрыть',exact:true}).click();await expect(page.locator('dialog')).toBeHidden();
});

test('a repeated board with an exit does not suggest rescue',async({page})=>{
 const l=levels[0],s=moved(fresh(),l.witness[0]);
 await page.addInitScript(s=>{
  localStorage.setItem('water-sort-v1',JSON.stringify(s));
  const NativeWorker=window.Worker;
  window.Worker=class extends NativeWorker{
   constructor(url:string|URL,options?:WorkerOptions){
    super(url,options);
    if(String(url).includes('stall.worker'))this.addEventListener('message',e=>document.documentElement.dataset.stallResult=e.data);
   }
  };
 },s);
 await page.goto('/');await page.locator('#home-play').click();
 const canvas=page.locator('#board canvas');await expect(canvas).toBeVisible();await page.waitForTimeout(350);
 const b=(await canvas.boundingBox())!,p=layout(b.width,b.height,l.initial.length);
 for(const i of [1,2])await page.mouse.click(b.x+p[i].x,b.y+p[i].y+p[i].h/2);
 await expect(page.locator('html')).toHaveAttribute('data-stall-result','FOUND');
 await expect(page.locator('#hint')).toBeEnabled();
 await expect(page.locator('#notice-restart')).toBeHidden();
 await expect(page.locator('#shuffle')).not.toHaveClass(/rescue-highlight/);
});

test('the first losing pour warns even when legal pours remain',async({page})=>{
 const s={...fresh(),current:2},l=levels[s.current];
 await page.addInitScript(s=>localStorage.setItem('water-sort-v1',JSON.stringify(s)),s);
 await page.goto('/');await page.locator('#home-play').click();
 const canvas=page.locator('#board canvas');await expect(canvas).toBeVisible();await page.waitForTimeout(300);
 const b=(await canvas.boundingBox())!,p=layout(b.width,b.height,l.initial.length);
 for(const i of [1,3])await page.mouse.click(b.x+p[i].x,b.y+p[i].y+p[i].h/2);
 await expect(page.locator('#status')).toContainText('Решения нет');
 await expect(page.locator('#moves')).toHaveText('Ходов: 1');
 const a=attempt(await page.evaluate(()=>JSON.parse(localStorage.getItem('water-sort-v1')!)));
 expect(moves(a.board).length).toBeGreaterThan(0);
});
