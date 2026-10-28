import {chromium} from 'playwright';import fs from 'node:fs';
import {fresh,levels,moved} from '../src/core/session.ts';import {layout,pourTiming} from '../src/game/geometry.ts';
const out=process.env.UI_CAPTURE_DIR??'test-results/feel-16';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({args:['--no-sandbox']}),page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1});
await page.clock.install({time:new Date('2026-10-28T00:00:00Z')});
await page.goto(process.argv[2]??'http://127.0.0.1:4176');
async function load(index,nearEnd=false){const s=nearEnd?levels[index].witness.slice(0,-1).reduce((s,m)=>moved(s,m),{...fresh(),current:index}):{...fresh(),current:index};s.settings.sound=false;await page.evaluate(s=>localStorage.setItem('water-sort-v1',JSON.stringify(s)),s);await page.reload();await page.locator('#home-play').click();await page.evaluate(()=>document.fonts.ready);await page.clock.pauseAt(new Date((await page.evaluate(()=>Date.now()))+1000));}
async function pour(m,count,advance){const b=await page.locator('#board').boundingBox(),ps=layout(b.width,b.height,count);for(const i of [m.from,m.to])await page.mouse.click(b.x+ps[i].x,b.y+ps[i].y+ps[i].h/2,{force:true});await page.clock.runFor(advance);}
await load(0);await pour(levels[0].witness[0],4,550);await pour(levels[0].witness[1],4,450);await page.screenshot({path:out+'/color.png'});await page.clock.runFor(170);await page.screenshot({path:out+'/cork.png'});
const last=levels[0].witness.at(-1);await pour(last,4,pourTiming(last.amount).duration+100);await page.clock.runFor(440);await page.screenshot({path:out+'/fountains.png'});await page.clock.runFor(760);await page.screenshot({path:out+'/collection.png'});
await load(11,true);const m=levels[11].witness.at(-1);await pour(m,11,pourTiming(m.amount).duration+100);await page.clock.runFor(440);await page.screenshot({path:out+'/eight-colours.png'});
await browser.close();console.log('Deterministic frame captures: actual production renderer, browser clock stepped; no visual overrides.');
