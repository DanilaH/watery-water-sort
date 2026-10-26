// Cue requests and animation state only: this is not microphone or physical-device testing.
import {chromium} from 'playwright';
import fs from 'node:fs';
import {layout} from '../src/game/geometry.ts';
import {apply} from '../src/core/rules.ts';
const levels=JSON.parse(fs.readFileSync(new URL('../src/core/levels.json',import.meta.url),'utf8'));
const output=process.env.FEEL_AUDIT_DIR??'test-results/feel-09';fs.mkdirSync(output,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox']}),results=[];
const fresh=(current=0)=>({schema:1,artVersion:4,current,revision:0,completed:[],attempts:{},settings:{sound:true,fast:false,symbols:false,light:false}});
async function open(s){const page=await browser.newPage({viewport:{width:390,height:844}});const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(s=>localStorage.setItem('water-sort-v1',JSON.stringify(s)),s);await page.goto(process.argv[2]??'http://127.0.0.1:4175');await page.locator('canvas').waitFor();await page.waitForTimeout(350);
 await page.evaluate(async()=>{const sp='/src/game/WaterScene.ts',ap='/src/audio/sound.ts',s=await import(sp),a=await import(ap);window.feelEvents=[];const event=(key,detail)=>window.feelEvents.push({key,time:performance.now(),...detail});document.addEventListener('pointerdown',e=>event('input',{target:e.target.tagName}),true);
 for(const key of ['tap','pour','land','finish']){const original=a.Sound.prototype[key];a.Sound.prototype[key]=function(...args){event(key,{args});return original.apply(this,args);};}
 for(const key of ['animate','celebrate']){const original=s.WaterScene.prototype[key];s.WaterScene.prototype[key]=function(...args){const r=original.apply(this,args);window.feelScene=this;event(key,{args,duration:this.flight?.duration});return r;};}
 });return {page,errors};}
async function move(page,m,count){const b=await page.locator('#board').boundingBox(),ps=layout(b.width,b.height,count);for(const i of [m.from,m.to])await page.mouse.click(b.x+ps[i].x,b.y+ps[i].y+ps[i].h/2);await expectSettled(page);}
async function expectSettled(page){await page.waitForTimeout(700);}
async function events(page){return page.evaluate(()=>{const es=window.feelEvents,t=es[0]?.time;return es.map(e=>({...e,time:e.time-t}));});}
for(const amount of [1,2,3]){
 let picked;for(let current=0;current<levels.length&&!picked;current++){const l=levels[current];let board=l.initial,history=[];for(const m of l.witness){if(m.amount===amount){const s=fresh(current);s.revision=history.length;s.attempts[`${l.id}@${l.version}`]={board,history,extra:false};picked={s,m};break;}board=apply(board,m);history=[...history,m];}}
 const {page,errors}=await open(picked.s);await move(page,picked.m,levels[picked.s.current].initial.length);results.push({case:'amount',amount,events:await events(page),errors});await page.close();
}
{
 const {page,errors}=await open(fresh());for(const m of levels[0].witness.slice(0,2))await move(page,m,4);
 await page.evaluate(()=>window.feelEvents=[]);await move(page,{from:1,to:2},4);results.push({case:'relocate-complete-color',amount:4,events:await events(page),won:await page.locator('#continue').isVisible(),errors});await page.close();
}
{
 const dead=JSON.parse(fs.readFileSync(new URL('../docs/audits/review-05/deadend-save.json',import.meta.url),'utf8'));
 const {page,errors}=await open(dead);await page.setViewportSize({width:568,height:320});await page.locator('#rescue').click();await page.screenshot({path:output+'/rescue-landscape.png'});await page.getByRole('button',{name:'Добавить колбу',exact:true}).click();await page.waitForTimeout(400);await page.screenshot({path:output+'/extra-landscape.png'});
 const board=await page.locator('#board').boundingBox();results.push({case:'rescue-landscape',board,poses:layout(board.width,board.height,8),errors});await page.close();
}
fs.writeFileSync(output+'/events.json',JSON.stringify({note:'Cue requests, not acoustic latency. Real clock, desktop Chromium. Each amount case uses a valid witnessed prefix, not an invented board.',results},null,2));await browser.close();console.log(JSON.stringify(results.map(r=>({case:r.case,amount:r.amount,events:r.events?.filter(e=>e.key!=='input'&&e.key!=='animate'),errors:r.errors}))));
