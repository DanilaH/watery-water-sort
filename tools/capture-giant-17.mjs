import {chromium} from 'playwright';import fs from 'node:fs';
import {fresh,levels,moved,displaySlots} from '../src/core/session.ts';import {moveFor} from '../src/core/rules.ts';import {goalLayout} from '../src/game/geometry.ts';
const out=process.env.UI_CAPTURE_DIR??'test-results/giant-17';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({args:['--no-sandbox']}),page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1}),errors=[],checks=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(process.argv[2]??'http://127.0.0.1:4178');
async function load(index,history=0,theme='blue'){let s={...fresh(),current:index};for(const m of levels[index].witness.slice(0,history))s=moved(s,m);s.settings.sound=false;s.settings.theme=theme;await page.evaluate(s=>localStorage.setItem('water-sort-v1',JSON.stringify(s)),s);await page.reload();await page.evaluate(()=>document.fonts.ready);await page.locator('#home-play').click();await page.waitForTimeout(300);return s;}
async function shot(name){await page.screenshot({path:out+'/'+name+'.png',animations:'disabled'});}
async function move(m,s){const b=await page.locator('#board').boundingBox(),ps=goalLayout(b.width,b.height,displaySlots(s),0);for(const i of [m.from,m.to])await page.mouse.click(b.x+ps[i].x,b.y+ps[i].y+ps[i].h/2);}
await load(12);await shot('01-introduction');await load(12,1);await shot('02-half-full');
for(const theme of ['blue','plum','graphite','ice']){await load(13,0,theme);await shot('03-'+theme);}
for(const [width,height]of [[320,480],[568,320],[390,844]]){
 await page.setViewportSize({width,height});let s=await load(15);await shot(`04-field-${width}x${height}`);
 s=await load(15,levels[15].witness.length-1);await move(levels[15].witness.at(-1),s);await page.locator('#continue').waitFor();await page.waitForTimeout(340);await shot(`05-victory-${width}x${height}`);await page.waitForTimeout(1800);await shot(`06-result-${width}x${height}`);
 checks.push({viewport:[width,height],continue:await page.locator('#continue').boundingBox(),board:await page.locator('#board').boundingBox()});
}
// Non-final goal completion shows the crystal base falling while ordinary colours remain.
await page.setViewportSize({width:390,height:844});let s={...fresh(),current:12};for(const [from,to]of [[3,0],[2,0],[1,4]])s=moved(s,moveFor(s.attempts['water-013@1']?.board??levels[12].initial,from,to,levels[12].goal));s.settings.sound=false;
await page.evaluate(s=>localStorage.setItem('water-sort-v1',JSON.stringify(s)),s);await page.reload();await page.locator('#home-play').click();await page.waitForTimeout(300);await move(moveFor(s.attempts['water-013@1'].board,1,0,levels[12].goal),s);await page.waitForTimeout(470);await shot('07-goal-completion');await page.waitForTimeout(1000);await shot('08-goal-stays-tall');
await browser.close();fs.writeFileSync(out+'/capture.json',JSON.stringify({errors,checks,note:'Production renderer, real input and clocks, valid witness-replay fixtures, no CSS/SDK overrides.'},null,2));if(errors.length)throw Error(JSON.stringify(errors));console.log(JSON.stringify({errors,checks}));
