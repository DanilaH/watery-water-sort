// Visual studies on real application states. Does not modify production assets or saves.
import {chromium} from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import {fresh,levels,levelKey,moved,attempt,displaySlots} from '../src/core/session.ts';
import {layout} from '../src/game/geometry.ts';
const root=path.resolve('docs/design-15'),out=path.resolve(process.env.UI_CAPTURE_DIR??'test-results/design-15');fs.mkdirSync(out,{recursive:true});
const css=fs.readFileSync(root+'/variants.css','utf8'),hero=fs.readFileSync(root+'/home-hero.svg','utf8');
const proof=JSON.parse(fs.readFileSync('docs/audits/stars-14/optimal.json','utf8'));
const browser=await chromium.launch({headless:true,args:['--no-sandbox']}),context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,recordVideo:{dir:out+'/video',size:{width:390,height:844}}});
await context.route('**/__design/Rubik.woff',route=>route.fulfill({contentType:'font/woff',body:fs.readFileSync(root+'/Rubik.woff')}));
const page=await context.newPage(),errors=[],checks=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto(process.argv[2]??'http://127.0.0.1:4175');
const state=(index,light)=>({...fresh(),current:index,completed:levels.slice(0,index).map(l=>l.id),settings:{...fresh().settings,light,sound:false}});
async function decorate(){
 await page.addStyleTag({content:css});
 await page.evaluate(hero=>{
  document.body.classList.add('design');document.querySelector('.home-mark').insertAdjacentHTML('afterend',hero);
  const pairs=[['home-levels','Выбор уровней','<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>'],['home-settings','Настройки','<path d="M4 6h16M4 12h16M4 18h16"/><circle cx="8" cy="6" r="2.5"/><circle cx="16" cy="12" r="2.5"/><circle cx="10" cy="18" r="2.5"/>']];
  for(const [id,label,shape]of pairs){const el=document.getElementById(id);el.innerHTML=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" aria-hidden="true">${shape}</svg><span>${label}</span>`;}
  document.querySelector('#settings svg').innerHTML=pairs[1][2];
  document.querySelector('#menu svg').innerHTML='<path d="m3 11 9-8 9 8M5 10v10h5v-6h4v6h5V10"/>';
  document.querySelector('#hint svg').innerHTML='<path d="M8 16v-2a7 7 0 1 1 8 0v2zM9 20h6M10 23h4M12 3V1M4 6 2 4M20 6l2-2"/>';
 },hero);
 await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(250);
}
async function open(s,play=true){await page.evaluate(s=>localStorage.setItem('water-sort-v1',JSON.stringify(s)),s);await page.reload();await decorate();if(play){await page.locator('#home-play').click();await page.waitForTimeout(320);}}
async function shot(name){await page.screenshot({path:out+'/'+name+'.png'});}
async function measure(name){
 const result=await page.evaluate(()=>{const visible=e=>!!e.getClientRects().length&&!e.closest('[hidden]')&&getComputedStyle(e).visibility!=='hidden';const parent=document.querySelector('dialog[open]')??(document.body.classList.contains('home')?document.querySelector('#home'):document.querySelector('#app'));return [...parent.querySelectorAll('button,input')].filter(visible).map(e=>{const target=e.closest('label')??e,r=target.getBoundingClientRect();return {id:e.id||e.getAttribute('aria-label')||target.textContent.trim(),x:r.x,y:r.y,w:r.width,h:r.height,disabled:e.disabled,inside:r.x>=-.5&&r.y>=-.5&&r.right<=innerWidth+.5&&r.bottom<=innerHeight+.5};});});
 checks.push({name,viewport:page.viewportSize(),controls:result});
 const bad=result.filter(r=>!r.inside||r.w<44||r.h<44);if(bad.length)console.log('REVIEW '+name+' '+JSON.stringify(bad));
}
// Existing version, same board for comparison.
await page.evaluate(s=>localStorage.setItem('water-sort-v1',JSON.stringify(s)),state(2,false));await page.reload();await page.locator('#home-play').click();await page.waitForTimeout(400);await shot('current-game');await page.locator('#menu').click();await shot('current-home');
for(const [variant,light]of [['a',false],['b',true]]){
 await page.setViewportSize({width:390,height:844});await open(state(2,light),false);await shot(variant+'-home');await measure(variant+'-home');await page.locator('#home-play').click();await page.waitForTimeout(350);await shot(variant+'-game');await measure(variant+'-game');
 const b=await page.locator('#board').boundingBox(),ps=layout(b.width,b.height,displaySlots(state(2,light)));for(const i of [0,3]){await page.mouse.click(b.x+ps[i].x,b.y+ps[i].y+ps[i].h/2);await page.waitForTimeout(220);}await page.waitForTimeout(900);
 await page.locator('#extra-tube').click();await page.waitForTimeout(220);await shot(variant+'-reward');await measure(variant+'-reward');await page.getByRole('button',{name:'Позже',exact:true}).click();await page.locator('#settings').click();await page.waitForTimeout(220);await shot(variant+'-settings');await measure(variant+'-settings');await page.getByRole('button',{name:'Готово',exact:true}).click();
 const solution=proof.find(p=>p.level===2&&!p.extra);let s=state(2,light);for(const m of solution.path)s=moved(s,m);await open(s);await shot(variant+'-victory');await measure(variant+'-victory');await page.locator('#menu').click();await page.locator('#home-levels').click();await page.waitForTimeout(220);await shot(variant+'-levels');await measure(variant+'-levels');
 for(const [width,height]of [[320,480],[568,320]]){await page.setViewportSize({width,height});await open(state(11,light));await shot(`${variant}-dense-${width}x${height}`);await measure(`${variant}-dense-${width}x${height}`);await page.locator('#extra-tube').click();await page.waitForTimeout(220);await shot(`${variant}-reward-${width}x${height}`);await measure(`${variant}-reward-${width}x${height}`);await page.getByRole('button',{name:'Позже',exact:true}).click();await page.locator('#menu').click();await shot(`${variant}-home-${width}x${height}`);await measure(`${variant}-home-${width}x${height}`);}
}
await context.close();await browser.close();fs.writeFileSync(out+'/capture.json',JSON.stringify({base:'e407615dd508e92db4e2fb7d1985f3b1cfdc433b',prototype:true,errors,checks,limits:'Static styling injected into real Vite UI; home hero is new SVG. SDK and audio are not evaluated. Victory captured from a valid saved winning path; celebration is not redesigned.'},null,2));console.log(JSON.stringify({errors,screens:fs.readdirSync(out).filter(n=>n.endsWith('.png')).length,checks:checks.length}));
