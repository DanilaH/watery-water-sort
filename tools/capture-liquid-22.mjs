// Capture real compositor PNG frames, acknowledging each immediately. No synthetic clock.
import {chromium} from 'playwright';
import {mkdirSync,writeFileSync,readFileSync,readdirSync,statSync} from 'node:fs';
import {createHash} from 'node:crypto';import {execFileSync} from 'node:child_process';
import {fresh,displaySlots} from '../src/core/session.ts';import {layout} from '../src/game/geometry.ts';
const out=process.argv[2];mkdirSync(out,{recursive:true});mkdirSync(`${out}/frames`,{recursive:true});const browser=await chromium.launch(),page=await browser.newPage({viewport:{width:390,height:844}}),s=fresh(),actions=[],errors=[],frames=[];s.settings.sound=false;
page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(s=>localStorage.setItem('water-sort-v1',JSON.stringify(s)),s);await page.goto('http://127.0.0.1:4178');await page.locator('#home-play').click();await page.waitForTimeout(350);
const b=await page.locator('#board').boundingBox(),poses=layout(b.width,b.height,displaySlots(s)),clip={x:Math.floor(b.x),y:Math.floor(b.y),width:Math.floor(b.width),height:Math.floor(b.height)},cdp=await page.context().newCDPSession(page);
cdp.on('Page.screencastFrame',frame=>{frames.push({time:frame.metadata.timestamp,bytes:Buffer.from(frame.data,'base64')});void cdp.send('Page.screencastFrameAck',{sessionId:frame.sessionId});});
await cdp.send('Page.startScreencast',{format:'png',maxWidth:390,maxHeight:844,everyNthFrame:1});
const tap=async i=>{actions.push({index:i,time:Date.now()/1000});await page.mouse.click(b.x+poses[i].x,b.y+poses[i].y+poses[i].h/2);};
await page.waitForTimeout(100);await tap(1);await page.waitForTimeout(150);await tap(1);await page.waitForTimeout(170);await tap(1);await page.waitForTimeout(150);await tap(3);await page.waitForTimeout(1500);
await cdp.send('Page.stopScreencast');await page.screenshot({path:`${out}/settled.png`});await browser.close();if(errors.length)throw Error(JSON.stringify(errors));const hash=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
const images=frames.map((f,i)=>{const path=`frames/${String(i).padStart(4,'0')}.png`;writeFileSync(`${out}/${path}`,f.bytes);return {path,time:f.time,sha256:hash(`${out}/${path}`)};});
writeFileSync(`${out}/capture.json`,JSON.stringify({sourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),dirty:!!execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim(),source:'Chromium compositor PNG frames; real timestamps; no clock manipulation',silent:true,clip,actions,images,errors,dist:readdirSync('dist',{recursive:true}).filter(p=>statSync(`dist/${p}`).isFile()).map(p=>({path:p,sha256:hash(`dist/${p}`)}))},null,2));
