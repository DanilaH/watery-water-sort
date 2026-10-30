// Start production preview on 127.0.0.1:4178; pass output directory as argv[2].
import {chromium} from 'playwright';
import {mkdirSync,writeFileSync,readFileSync,readdirSync,statSync} from 'node:fs';import {createHash}from'node:crypto';import{execFileSync}from'node:child_process';
const out=process.argv[2];mkdirSync(out+'/frames',{recursive:true});
const browser=await chromium.launch(),page=await browser.newPage({viewport:{width:390,height:844}}),frames=[],errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:4178');await page.evaluate(()=>document.fonts.ready);await page.waitForSelector('.home-hero[data-motion=playing]');await page.waitForTimeout(100);
const cdp=await page.context().newCDPSession(page);cdp.on('Page.screencastFrame',f=>{frames.push({time:f.metadata.timestamp,bytes:Buffer.from(f.data,'base64')});void cdp.send('Page.screencastFrameAck',{sessionId:f.sessionId}).catch(()=>{});});
await cdp.send('Performance.enable');const before=(await cdp.send('Performance.getMetrics')).metrics;await cdp.send('Page.startScreencast',{format:'png',maxWidth:390,maxHeight:844,everyNthFrame:1});
await page.waitForTimeout(2400);await page.screenshot({path:out+'/menu.png'});await page.waitForTimeout(7600);await cdp.send('Page.stopScreencast');const after=(await cdp.send('Performance.getMetrics')).metrics;
await browser.close();if(errors.length)throw Error(JSON.stringify(errors));
const hash=p=>createHash('sha256').update(readFileSync(p)).digest('hex'),images=frames.map((f,i)=>{const path='frames/'+String(i).padStart(4,'0')+'.png';writeFileSync(out+'/'+path,f.bytes);return {path,time:f.time,sha256:hash(out+'/'+path)};});
const metrics=Object.fromEntries(['TaskDuration','ScriptDuration','LayoutDuration','RecalcStyleDuration'].map(name=>[name,after.find(x=>x.name===name).value-before.find(x=>x.name===name).value]));
writeFileSync(out+'/capture.json',JSON.stringify({sourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),dirty:!!execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim(),kind:'real idle menu animation; no clock manipulation or interpolated frames',clip:{x:0,y:0,width:390,height:844},images,errors,silent:true,metrics:{scope:'Chrome task seconds during 10s screencast; includes app and recording, not a phone benchmark',...metrics},dist:readdirSync('dist',{recursive:true}).filter(p=>statSync('dist/'+p).isFile()).map(p=>({path:p,sha256:hash('dist/'+p)}))},null,2));console.log(frames.length,metrics);

