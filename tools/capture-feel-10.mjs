// Capture the actual production UI and Web Audio mix. Not a physical-speaker latency measurement.
import {chromium} from 'playwright';import fs from 'node:fs';import path from 'node:path';import {spawnSync} from 'node:child_process';import {layout} from '../src/game/geometry.ts';
const out=process.env.FEEL_CAPTURE_DIR??'test-results/feel-10';fs.mkdirSync(out,{recursive:true});const framesDir=path.resolve(out,'frames');fs.mkdirSync(framesDir,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox']}),context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage(),errors=[],frames=[];page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(()=>{
 const connect=AudioNode.prototype.connect,resume=AudioContext.prototype.resume;
 AudioNode.prototype.connect=function(dest,...args){if(dest instanceof AudioDestinationNode&&!window.demoAudio){const stream=this.context.createMediaStreamDestination();connect.call(this,stream);window.demoAudio={stream,chunks:[]};}return connect.call(this,dest,...args);};
 AudioContext.prototype.resume=function(){return resume.call(this).then(()=>{const a=window.demoAudio;if(a&&!a.recorder){a.recorder=new MediaRecorder(a.stream.stream,{mimeType:'audio/webm;codecs=opus'});a.recorder.ondataavailable=e=>a.chunks.push(e.data);a.start=Date.now()/1000;a.recorder.start();}});};
});
const cdp=await context.newCDPSession(page);cdp.on('Page.screencastFrame',e=>{const file=path.join(framesDir,String(frames.length).padStart(5,'0')+'.jpg');fs.writeFileSync(file,Buffer.from(e.data,'base64'));frames.push({file,t:e.metadata.timestamp});void cdp.send('Page.screencastFrameAck',{sessionId:e.sessionId}).catch(()=>{});});
await cdp.send('Page.startScreencast',{format:'jpeg',quality:90,maxWidth:390,maxHeight:844,everyNthFrame:1});
await page.goto(process.argv[2]??'http://127.0.0.1:4175');await page.locator('canvas').waitFor();await page.waitForTimeout(350);
const box=await page.locator('#board').boundingBox();await page.mouse.click(box.x+1,box.y+1);await page.waitForTimeout(180);
async function tap(i,count=4){const b=await page.locator('#board').boundingBox(),p=layout(b.width,b.height,count)[i];await page.mouse.click(b.x+p.x,b.y+p.y+p.h/2);}
await tap(1);await page.waitForTimeout(200);await tap(3);await page.waitForTimeout(145);await page.screenshot({path:out+'/stream.png'});await page.waitForTimeout(450);
await tap(0);await tap(1);await page.waitForTimeout(650);await page.screenshot({path:out+'/color.png'});
await tap(1);await tap(2);await page.waitForTimeout(600);
await tap(3);await tap(0);await page.locator('#continue').waitFor({state:'visible'});await page.waitForTimeout(800);await page.screenshot({path:out+'/victory.png'});
await page.locator('#continue').click();await page.locator('#settings').click();await page.getByLabel('Быстрое переливание').check();await page.getByRole('button',{name:'Готово',exact:true}).click();await page.waitForTimeout(200);
const levels=JSON.parse(fs.readFileSync(new URL('../src/core/levels.json',import.meta.url),'utf8'));for(const m of levels[1].witness.slice(0,2)){await tap(m.from);await tap(m.to);}await page.waitForTimeout(1100);
const audio=await page.evaluate(async()=>{const a=window.demoAudio;await new Promise(resolve=>{a.recorder.onstop=resolve;a.recorder.stop();});const blob=new Blob(a.chunks,{type:'audio/webm'});const data=await new Promise(resolve=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.readAsDataURL(blob);});return {start:a.start,base64:data.split(',')[1]};});
await cdp.send('Page.stopScreencast');fs.writeFileSync(out+'/mix.webm',Buffer.from(audio.base64,'base64'));
const lines=[];for(let i=0;i<frames.length;i++){lines.push(`file '${frames[i].file}'`);if(i<frames.length-1)lines.push('duration '+Math.max(.001,frames[i+1].t-frames[i].t));}lines.push(`file '${frames.at(-1).file}'`);fs.writeFileSync(out+'/frames.txt',lines.join('\n'));
const offset=audio.start-frames[0].t,ff=spawnSync('ffmpeg',['-y','-v','error','-f','concat','-safe','0','-i',out+'/frames.txt','-itsoffset',String(offset),'-i',out+'/mix.webm','-vf','fps=30','-c:v','libx264','-crf','23','-pix_fmt','yuv420p','-c:a','aac','-b:a','128k','-movflags','+faststart','-shortest',out+'/feel.mp4'],{encoding:'utf8'});if(ff.status!==0)throw Error(ff.stderr);
await context.close();await browser.close();fs.writeFileSync(out+'/capture.json',JSON.stringify({errors,frames:frames.length,audioOffset:offset,videoAudio:true,note:'CDP frame timestamps and captured Web Audio bus, desktop Chromium production build. No microphone, Android device, subjective listening or speaker latency measurement.'},null,2));console.log(JSON.stringify({errors,frames:frames.length,audioOffset:offset,video:out+'/feel.mp4'}));
