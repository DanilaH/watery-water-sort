import {chromium} from 'playwright';
import fs from 'node:fs';
import {fresh,levels,moved} from '../src/core/session.ts';
import {layout} from '../src/game/geometry.ts';
const out=process.env.UI_CAPTURE_DIR??'test-results/feel-16';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({args:['--no-sandbox']}),context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,recordVideo:{dir:out+'/video',size:{width:390,height:844}}}),page=await context.newPage(),errors=[];
page.on('pageerror',e=>errors.push(e.message));await page.goto(process.argv[2]??'http://127.0.0.1:4176');
async function seed(s){await page.evaluate(s=>localStorage.setItem('water-sort-v1',JSON.stringify(s)),s);await page.reload();await page.evaluate(()=>document.fonts.ready);await page.locator('#home-play').click();await page.waitForTimeout(300);}
async function shot(name){await page.screenshot({path:out+'/'+name+'.png'});}
async function tap(i,count){const b=await page.locator('#board').boundingBox(),r=layout(b.width,b.height,count)[i];await page.mouse.click(b.x+r.x,b.y+r.y+r.h/2);}
const s=fresh();s.settings.sound=true;await seed(s);await shot('01-field');
for(const m of levels[0].witness){await tap(m.from,4);await tap(m.to,4);
 if(m===levels[0].witness[1]){await page.waitForTimeout(410);await shot('02-color');}
 if(m===levels[0].witness.at(-1)){await page.locator('#continue').waitFor();await page.waitForTimeout(500);await shot('03-fountains');await page.waitForTimeout(640);await shot('04-stars-in-flight');await page.waitForTimeout(900);await shot('05-result');}
 else await page.waitForFunction(()=>!document.body.classList.contains('pouring'));
}
const bank=await page.locator('#star-total').innerText();await page.locator('#menu').click();await shot('06-home');
await seed({...fresh(),current:7});await shot('07-challenge');await page.locator('#menu').click();await shot('08-challenge-home');
const checks=[];
for(const [width,height]of [[320,480],[568,320],[390,844]]){
 await page.setViewportSize({width,height});const done=levels[11].witness.reduce((s,m)=>moved(s,m),{...fresh(),current:11});done.settings.sound=false;await seed(done);await shot(`09-result-${width}x${height}`);
 checks.push({viewport:[width,height],continue:await page.locator('#continue').boundingBox(),bank:await page.locator('#star-bank').boundingBox()});
}
await page.setViewportSize({width:390,height:844});const large=levels[11].witness.slice(0,-1).reduce((s,m)=>moved(s,m),{...fresh(),current:11});large.settings.sound=false;await seed(large);const lm=levels[11].witness.at(-1);await tap(lm.from,11);await tap(lm.to,11);await page.locator('#continue').waitFor();await page.waitForTimeout(500);await shot('10-eight-colour-fountains');await page.waitForTimeout(1500);
await context.close();await browser.close();fs.writeFileSync(out+'/capture.json',JSON.stringify({errors,bank,checks,note:'Production build. Real clocks and actual game input. Seeded valid witness replays for dense result captures.'},null,2));if(errors.length)throw Error(JSON.stringify(errors));console.log(JSON.stringify({errors,bank,checks}));
