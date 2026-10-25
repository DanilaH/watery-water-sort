import {chromium} from 'playwright';import {layout} from '../src/game/geometry.ts';import fs from 'node:fs';import path from 'node:path';
const output=process.env.UI_CAPTURE_DIR??'test-results/polish-07',url=process.argv[2]??'http://127.0.0.1:4175';fs.mkdirSync(output,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox']}),context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,recordVideo:{dir:output,size:{width:390,height:844}}}),page=await context.newPage(),errors=[];
page.on('pageerror',e=>errors.push(e.message));await page.goto(url);await page.locator('canvas').waitFor();await page.waitForTimeout(350);
const b=await page.locator('#board').boundingBox(),ps=layout(b.width,b.height,4),tap=async i=>page.mouse.click(b.x+ps[i].x,b.y+ps[i].y+ps[i].h/2),blank=()=>page.mouse.click(b.x+2,b.y+2),shot=async n=>page.screenshot({path:path.join(output,n+'.png')});
await shot('start');
for(const [from,to]of [[0,2],[1,0]]){await tap(from);await tap(to);await page.waitForFunction(()=>!document.querySelector('#hint').disabled);}
await page.waitForTimeout(400);await shot('complete-cork');await tap(0);await page.waitForTimeout(65);await shot('cork-removing');await page.waitForTimeout(250);await shot('cork-open');await blank();await page.waitForTimeout(250);await shot('cork-returned');
await tap(2);await tap(1);await page.locator('#continue').waitFor({state:'visible'});await page.waitForTimeout(500);await shot('victory');await page.locator('#undo').click();await page.waitForTimeout(400);await page.locator('#restart').click();await page.getByRole('button',{name:'Начать заново',exact:true}).click();await page.waitForTimeout(350);
for(const i of [0,2,1,0])await tap(i);
const queued=await page.locator('#status').textContent();await page.mouse.click(b.x+ps[1].x,b.y+ps[1].y-15);const badgeTap=await page.locator('#status').textContent();await tap(0);await shot('queue');await page.waitForFunction(()=>document.querySelector('#moves').textContent==='Ходов: 2');await page.waitForTimeout(600);
const video=page.video();await context.close();await video.saveAs(path.join(output,'polish.webm'));await browser.close();fs.writeFileSync(path.join(output,'capture.json'),JSON.stringify({errors,queued,badgeTap,videoAudio:false,clock:'real'},null,2));console.log(JSON.stringify({errors,queued,badgeTap}));
