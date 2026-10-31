// Production :4178. User-input capture; frames and timing come from the compositor.
import {chromium} from 'playwright';
import {fresh,levels,moved,attempt,displaySlots,goalFor} from '../src/core/session.ts';
import {goalList} from '../src/core/rules.ts';
import {layout,goalLayout,miniLayout} from '../src/game/geometry.ts';
import {mkdirSync,writeFileSync,readFileSync,readdirSync,statSync} from 'node:fs';
import {createHash} from 'node:crypto';import {execFileSync} from 'node:child_process';
const root=process.argv[2],browser=await chromium.launch();
for(const [kind,index,prior,steps]of [['teaching',22,0,4],['combined',27,levels[27].witness.length-2,2]]){
 const out=root+'/'+kind;mkdirSync(out+'/frames',{recursive:true});let state={...fresh(),current:index};for(const m of levels[index].witness.slice(0,prior))state=moved(state,m);state.settings.sound=false;
 const page=await browser.newPage({viewport:{width:390,height:844}}),frames=[],errors=[];page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(s=>localStorage.setItem('water-sort-v1',JSON.stringify(s)),state);await page.goto('http://127.0.0.1:4178');await page.evaluate(()=>document.fonts.ready);await page.locator('#home-play').click();await page.waitForTimeout(350);await page.screenshot({path:out+'/before.png'});
 const cdp=await page.context().newCDPSession(page);cdp.on('Page.screencastFrame',f=>{frames.push({time:f.metadata.timestamp,bytes:Buffer.from(f.data,'base64')});void cdp.send('Page.screencastFrameAck',{sessionId:f.sessionId}).catch(()=>{});});await cdp.send('Page.startScreencast',{format:'png',maxWidth:390,maxHeight:844,everyNthFrame:1});
 for(const m of levels[index].witness.slice(prior,prior+steps)){
  const b=await page.locator('#board').boundingBox(),gs=goalList(goalFor(state)),ps=miniLayout(gs.length?goalLayout(b.width,b.height,displaySlots(state),gs.map(g=>g.index)):layout(b.width,b.height,displaySlots(state)),levels[index].mini);
  for(const i of [m.from,m.to])await page.mouse.click(b.x+ps[i].x,b.y+ps[i].y+ps[i].h/2);
  state=moved(state,m);await page.waitForFunction(expected=>JSON.parse(localStorage.getItem('water-sort-v1')).attempts[expected.key].history.length===expected.n,{key:levels[index].id+'@1',n:attempt(state).history.length});await page.waitForTimeout(720);
 }
 await page.waitForTimeout(1300);await page.screenshot({path:out+'/after.png'});await page.waitForTimeout(400);await cdp.send('Page.stopScreencast');await page.close();if(errors.length)throw Error(JSON.stringify(errors));
 const hash=p=>createHash('sha256').update(readFileSync(p)).digest('hex'),images=frames.map((f,i)=>{const path='frames/'+String(i).padStart(4,'0')+'.png';writeFileSync(out+'/'+path,f.bytes);return {path,time:f.time,sha256:hash(out+'/'+path)};});
 writeFileSync(out+'/capture.json',JSON.stringify({sourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),dirty:!!execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim(),kind,clip:{x:0,y:0,width:390,height:844},images,errors,silent:true,dist:readdirSync('dist',{recursive:true}).filter(p=>statSync('dist/'+p).isFile()).map(p=>({path:p,sha256:hash('dist/'+p)}))},null,2));console.log(kind,frames.length);
}await browser.close();
