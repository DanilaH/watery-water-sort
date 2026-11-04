import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {fresh,levels} from '../../src/core/session';
import {moves,transition,type Board,type Move} from '../../src/core/rules';
import {positionKey} from '../../src/core/solver';
import {layout} from '../../src/game/geometry';

test('a cyclic pour in a proven dead board shows help above the dock without spending stock',async({page})=>{
 const corpus=JSON.parse(gunzipSync(readFileSync('docs/audits/product-08/exploratory-corpus.json.gz')).toString()) as {level:string;board:Board;history:Move[];status:string}[];
 const repeat=(b:Board)=>moves(b).find(m=>positionKey(b)===positionKey(transition(b,m).board));
 const item=corpus.find(x=>x.status==='UNSOLVABLE'&&repeat(x.board))!,m=repeat(item.board)!;
 const s=fresh();s.current=levels.findIndex(l=>l.id===item.level);s.attempts[item.level+'@1']={board:item.board,history:item.history,extra:false};
 await page.setViewportSize({width:360,height:800});
 await page.addInitScript(s=>localStorage.setItem('water-sort-v1',JSON.stringify(s)),s);
 await page.goto('/');await page.locator('#home-play').click();
 const canvas=page.locator('#board canvas');await expect(canvas).toBeVisible();await page.waitForTimeout(350);
 const b=(await canvas.boundingBox())!,p=layout(b.width,b.height,item.board.length);
 for(const i of [m.from,m.to])await page.mouse.click(b.x+p[i].x,b.y+p[i].y+p[i].h/2);
 await expect(page.locator('#status')).toContainText('Решения нет');
 await expect(page.locator('#shuffle')).toHaveClass(/rescue-highlight/);
 expect((await page.locator('#notice').boundingBox())!.y+(await page.locator('#notice').boundingBox())!.height).toBeLessThan((await page.locator('#shuffle').boundingBox())!.y);
 await expect(page.locator('#shuffle-count')).toHaveText(String(s.wallet!.hints));
 await page.locator('#notice-restart').click();
 await expect(page.getByRole('heading',{name:'Начать заново?'})).toBeVisible();
});

for(const [width,height] of [[360,760],[640,320]])test(`pause stays inside native insets at ${width}×${height}`,async({page})=>{
 await page.setViewportSize({width,height});await page.goto('/');
 await page.evaluate(()=>{for(const [side,n]of Object.entries({top:37,bottom:44,left:24,right:16}))document.documentElement.style.setProperty('--safe-area-inset-'+side,n+'px');});
 await page.locator('#home-play').click();await page.locator('#settings').click();
 await expect(page.getByRole('heading',{name:'Пауза'})).toBeVisible();
 const b=(await page.locator('dialog').boundingBox())!;
 expect(b.x).toBeGreaterThanOrEqual(24);expect(b.x+b.width).toBeLessThanOrEqual(width-16);
 expect(b.y).toBeGreaterThanOrEqual(37);expect(b.y+b.height).toBeLessThanOrEqual(height-44);
 await expect(page.getByRole('button',{name:'Варианты',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'Лагуна',exact:true}).click();
 await expect(page.locator('body')).toHaveAttribute('data-theme','plum');
 await page.getByRole('button',{name:'Готово',exact:true}).click();await expect(page.locator('dialog')).toBeHidden();
});
