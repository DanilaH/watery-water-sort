// Production preview on 127.0.0.1:4178; output directory is argv[2].
import {chromium} from 'playwright';
import {fresh,levels,moved} from '../src/core/session.ts';
import {mkdirSync,writeFileSync,readFileSync,readdirSync,statSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const out=process.argv[2];mkdirSync(out+'/frames',{recursive:true});
let s=fresh();for(let i=0;i<13;i++){s={...s,current:i};for(const m of levels[i].witness)s=moved(s,m);}s={...s,current:13};s=moved(s,levels[13].witness[0]);s.settings.sound=false;
const browser=await chromium.launch(),page=await browser.newPage({viewport:{width:390,height:844}}),frames=[],errors=[],screens=[];
page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(s=>localStorage.setItem('water-sort-v1',JSON.stringify(s)),s);await page.goto('http://127.0.0.1:4178');await page.evaluate(()=>document.fonts.ready);await page.waitForFunction(()=>document.querySelector('.home-hero')?.getAttribute('data-material')==='glass');await page.waitForTimeout(300);
const shot=async name=>{await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));const path=out+'/'+name+'.png';await page.screenshot({path});screens.push({path:name+'.png',sha256:createHash('sha256').update(readFileSync(path)).digest('hex')});};
const cdp=await page.context().newCDPSession(page);cdp.on('Page.screencastFrame',f=>{frames.push({time:f.metadata.timestamp,bytes:Buffer.from(f.data,'base64')});void cdp.send('Page.screencastFrameAck',{sessionId:f.sessionId}).catch(()=>{});});
await cdp.send('Page.startScreencast',{format:'png',maxWidth:390,maxHeight:844,everyNthFrame:1});
await shot('home');await page.waitForTimeout(300);await page.locator('#home-play').click();await page.waitForTimeout(700);await page.waitForFunction(()=>getComputedStyle(document.getElementById('app')).opacity==='1');await shot('field');await page.locator('#settings').click();await page.waitForTimeout(350);await shot('settings');await page.getByRole('button',{name:'Сливовый',exact:true}).click();await page.waitForTimeout(350);await page.getByRole('button',{name:'Готово',exact:true}).click();await page.waitForTimeout(300);await page.locator('#menu').click();await page.waitForTimeout(300);await page.locator('#home-levels').click();await page.waitForTimeout(350);await shot('levels');await page.locator('.levels button').nth(11).click();await page.waitForTimeout(650);await cdp.send('Page.stopScreencast');await page.close();await browser.close();if(errors.length)throw Error(JSON.stringify(errors));
const hash=p=>createHash('sha256').update(readFileSync(p)).digest('hex'),images=frames.map((f,i)=>{const path='frames/'+String(i).padStart(4,'0')+'.png';writeFileSync(out+'/'+path,f.bytes);return {path,time:f.time,sha256:hash(out+'/'+path)};});
writeFileSync(out+'/capture.json',JSON.stringify({sourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),dirty:!!execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim(),kind:'real menu/goal field/settings/theme/level selection tour; seeded progress uses actual witness moves',clip:{x:0,y:0,width:390,height:844},images,screens,errors,silent:true,dist:readdirSync('dist',{recursive:true}).filter(p=>statSync('dist/'+p).isFile()).map(p=>({path:p,sha256:hash('dist/'+p)}))},null,2));

