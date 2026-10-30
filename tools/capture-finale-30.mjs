// Production preview on 127.0.0.1:4178; output directory is argv[2].

import {chromium} from 'playwright';
import {fresh,levels,moved,displaySlots,goalFor} from '../src/core/session.ts';
import {layout,goalLayout} from '../src/game/geometry.ts';
import {mkdirSync,writeFileSync,readFileSync,readdirSync,statSync} from 'node:fs';
import {createHash} from 'node:crypto';import {execFileSync} from 'node:child_process';
const browser=await chromium.launch();
for(const [kind,index] of [['victory',0],['giant',12]]){
 const out=process.argv[2]+'/'+kind;mkdirSync(out+'/frames',{recursive:true});
 let s={...fresh(),current:index};for(const m of levels[index].witness.slice(0,-1))s=moved(s,m);s.settings.sound=false;
 const page=await browser.newPage({viewport:{width:390,height:844}}),frames=[],errors=[];page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(s=>localStorage.setItem('water-sort-v1',JSON.stringify(s)),s);
 await page.goto('http://127.0.0.1:4178');await page.evaluate(()=>document.fonts.ready);await page.locator('#home-play').click();await page.waitForTimeout(500);
 const before=await page.locator('#board').boundingBox(),ps=goalFor(s)?goalLayout(before.width,before.height,displaySlots(s),0):layout(before.width,before.height,displaySlots(s));
 const cdp=await page.context().newCDPSession(page);cdp.on('Page.screencastFrame',f=>{frames.push({time:f.metadata.timestamp,bytes:Buffer.from(f.data,'base64')});void cdp.send('Page.screencastFrameAck',{sessionId:f.sessionId}).catch(()=>{});});
 await cdp.send('Page.startScreencast',{format:'png',maxWidth:390,maxHeight:844,everyNthFrame:1});
 const m=levels[index].witness.at(-1),tap=async i=>page.mouse.click(before.x+ps[i].x,before.y+ps[i].y+ps[i].h/2);await tap(m.from);await page.waitForTimeout(140);await tap(m.to);
 await page.waitForSelector('body.finished');await page.waitForFunction(()=>document.querySelectorAll('#victory-effects').length>0);await page.waitForTimeout(500);
 const after=await page.locator('#board').boundingBox();if(JSON.stringify(before)!==JSON.stringify(after))throw Error('Victory resized field');await page.screenshot({path:out+'/celebration.png'});await page.waitForTimeout(1600);await page.screenshot({path:out+'/result.png'});
 await cdp.send('Page.stopScreencast');await page.close();if(errors.length)throw Error(JSON.stringify(errors));
 const hash=p=>createHash('sha256').update(readFileSync(p)).digest('hex'),images=frames.map((f,i)=>{const path='frames/'+String(i).padStart(4,'0')+'.png';writeFileSync(out+'/'+path,f.bytes);return {path,time:f.time,sha256:hash(out+'/'+path)};});
 writeFileSync(out+'/capture.json',JSON.stringify({sourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),dirty:!!execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim(),kind,seed:'actual witness moves except last; final move performed via pointer',before,after,clip:{x:0,y:0,width:390,height:844},images,errors,silent:true,dist:readdirSync('dist',{recursive:true}).filter(p=>statSync('dist/'+p).isFile()).map(p=>({path:p,sha256:hash('dist/'+p)}))},null,2));console.log(kind,frames.length,before);
}await browser.close();

