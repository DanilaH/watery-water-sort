// Production preview on 127.0.0.1:4178; output directory is argv[2].

import {chromium} from 'playwright';import {fresh,levels,moved,displaySlots} from '../src/core/session.ts';import {goalLayout} from '../src/game/geometry.ts';import{mkdirSync,writeFileSync}from'node:fs';
const out=process.argv[2];mkdirSync(out,{recursive:true});const browser=await chromium.launch(),results=[];
for(const theme of ['blue','plum','graphite','ice'])for(const [width,height]of [[320,480],[390,844],[568,320]]){
 let s={...fresh(),current:15};for(const m of levels[15].witness.slice(0,-1))s=moved(s,m);s.settings={...s.settings,sound:false,theme};
 const page=await browser.newPage({viewport:{width,height}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(s=>localStorage.setItem('water-sort-v1',JSON.stringify(s)),s);await page.goto('http://127.0.0.1:4178');await page.evaluate(()=>document.fonts.ready);await page.locator('#home-play').click();await page.waitForTimeout(400);
 const before=await page.locator('#board').boundingBox(),ps=goalLayout(before.width,before.height,displaySlots(s),0),m=levels[15].witness.at(-1);
 for(const i of [m.from,m.to])await page.mouse.click(before.x+ps[i].x,before.y+ps[i].y+ps[i].h/2);
 await page.waitForSelector('body.finished');await page.waitForTimeout(650);const after=await page.locator('#board').boundingBox();
 const boxes={};for(const id of ['finish-title','earned-stars','continue','undo','hint','restart'])boxes[id]=await page.locator('#'+id).boundingBox();
 const a=boxes['earned-stars'],b=boxes.continue;if(a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y)throw Error('Stars overlap Next');
 if(JSON.stringify(before)!==JSON.stringify(after))throw Error('Board resize '+theme+' '+width);
 for(const [id,r]of Object.entries(boxes))if(!r||r.x<-.5||r.y<-.5||r.x+r.width>width+.5||r.y+r.height>height+.5)throw Error('Offscreen '+id+' '+theme+' '+width);
 await page.screenshot({path:out+'/'+theme+'-'+width+'.png'});await page.locator('#continue').click();await page.waitForTimeout(200);
 if(await page.locator('#victory-effects').count()||await page.locator('.star-flight').count())throw Error('Stale effect');if(errors.length)throw Error(JSON.stringify(errors));
 results.push({theme,width,height,before,after,boxes,errors,nextClearsEffects:true});await page.close();
}await browser.close();writeFileSync(out+'/report.json',JSON.stringify({scope:'Production preview; actual last move; no physical phone',results},null,2));console.log('Passed',results.length);

