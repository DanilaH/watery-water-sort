import {chromium} from 'playwright';
import {mkdirSync,writeFileSync,readFileSync,readdirSync,statSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fresh} from '../src/core/session.ts';
const out=process.argv[2];
mkdirSync(out+'/frames',{recursive:true});const browser=await chromium.launch(),page=await browser.newPage({viewport:{width:390,height:844}}),s={...fresh(),current:11},frames=[],errors=[];
s.settings.sound=false;await page.addInitScript(s=>localStorage.setItem('water-sort-v1',JSON.stringify(s)),s);
page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:4178');await page.locator('#home-play').click();await page.waitForTimeout(500);
const cdp=await page.context().newCDPSession(page);
cdp.on('Page.screencastFrame',f=>{frames.push({time:f.metadata.timestamp,bytes:Buffer.from(f.data,'base64')});void cdp.send('Page.screencastFrameAck',{sessionId:f.sessionId}).catch(()=>{});});
await cdp.send('Page.startScreencast',{format:'png',maxWidth:390,maxHeight:844,everyNthFrame:1});await page.waitForTimeout(250);await page.locator('#extra-tube').click();await page.waitForTimeout(900);await page.getByRole('button',{name:'Позже',exact:true}).click();await page.waitForTimeout(450);await cdp.send('Page.stopScreencast');await page.close();await browser.close();if(errors.length)throw Error(JSON.stringify(errors));
const hash=p=>createHash('sha256').update(readFileSync(p)).digest('hex'),images=frames.map((f,i)=>{const path='frames/'+String(i).padStart(4,'0')+'.png';writeFileSync(out+'/'+path,f.bytes);return {path,time:f.time,sha256:hash(out+'/'+path)};});
writeFileSync(out+'/capture.json',JSON.stringify({sourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),dirty:!!execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim(),kind:'locked slot, first-click offer, Later returns without requesting an advertisement',clip:{x:0,y:0,width:390,height:844},images,errors,silent:true,dist:readdirSync('dist',{recursive:true}).filter(p=>statSync('dist/'+p).isFile()).map(p=>({path:p,sha256:hash('dist/'+p)}))},null,2));

