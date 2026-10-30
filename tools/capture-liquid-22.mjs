// Record actual browser video without screenshot polling slowing the animation.
import {chromium} from 'playwright';
import {mkdirSync,writeFileSync,readFileSync,readdirSync,statSync,renameSync} from 'node:fs';
import {createHash} from 'node:crypto';import {execFileSync} from 'node:child_process';
import {fresh,displaySlots} from '../src/core/session.ts';import {layout} from '../src/game/geometry.ts';
const out=process.argv[2];mkdirSync(out,{recursive:true});const browser=await chromium.launch(),context=await browser.newContext({viewport:{width:390,height:844},recordVideo:{dir:out,size:{width:390,height:844}}}),page=await context.newPage(),s=fresh(),actions=[],errors=[];s.settings.sound=false;
page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(s=>localStorage.setItem('water-sort-v1',JSON.stringify(s)),s);await page.goto('http://127.0.0.1:4178');await page.locator('#home-play').click();await page.waitForTimeout(350);
const b=await page.locator('#board').boundingBox(),poses=layout(b.width,b.height,displaySlots(s)),clip={x:Math.floor(b.x),y:Math.floor(b.y),width:Math.floor(b.width),height:Math.floor(b.height)};
const tap=async i=>{actions.push({index:i,time:Date.now()});await page.mouse.click(b.x+poses[i].x,b.y+poses[i].y+poses[i].h/2);};
await tap(1);await page.waitForTimeout(150);await tap(1);await page.waitForTimeout(170);await tap(1);await page.waitForTimeout(150);await tap(3);await page.waitForTimeout(1700);
await page.screenshot({path:`${out}/settled.png`});const video=page.video();await context.close();renameSync(await video.path(),`${out}/liquid.webm`);await browser.close();if(errors.length)throw Error(JSON.stringify(errors));const hash=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
writeFileSync(`${out}/capture.json`,JSON.stringify({sourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),dirty:!!execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim(),silent:true,clip,actions,videoSha256:hash(`${out}/liquid.webm`),errors,dist:readdirSync('dist',{recursive:true}).filter(p=>statSync(`dist/${p}`).isFile()).map(p=>({path:p,sha256:hash(`dist/${p}`)}))},null,2));
