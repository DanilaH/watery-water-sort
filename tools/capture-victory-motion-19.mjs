// Real browser frames, no simulated animation. Sound is disabled for this visual recording.
import {chromium} from 'playwright';import {mkdirSync,writeFileSync} from 'node:fs';
import {fresh,levels,moved} from '../src/core/session.ts';import {layout} from '../src/game/geometry.ts';
const out=process.argv[2];mkdirSync(out,{recursive:true});const browser=await chromium.launch(),page=await browser.newPage({viewport:{width:390,height:844}});
const s=levels[0].witness.slice(0,-1).reduce((s,m)=>moved(s,m),fresh());s.settings.sound=false;
await page.addInitScript(s=>localStorage.setItem('water-sort-v1',JSON.stringify(s)),s);await page.goto('http://127.0.0.1:4178');await page.locator('#home-play').click();await page.waitForTimeout(300);
const b=await page.locator('#board').boundingBox(),ps=layout(b.width,b.height,4),m=levels[0].witness.at(-1);for(const i of [m.from,m.to])await page.mouse.click(b.x+ps[i].x,b.y+ps[i].y+ps[i].h/2);
await page.locator('#continue').waitFor();const row=await page.locator('#feedback').boundingBox(),clip={x:Math.floor(row.x),y:Math.floor(row.y-8),width:Math.ceil(row.width),height:Math.ceil(row.height+16)},frames=[];
for(let i=0;i<32;i++){const time=await page.evaluate(()=>performance.now());await page.screenshot({path:`${out}/${String(i).padStart(2,'0')}.png`,clip});frames.push(time);await page.waitForTimeout(70);}
writeFileSync(`${out}/frames.json`,JSON.stringify({viewport:{width:390,height:844},clip,frames,sound:false},null,2));await browser.close();
