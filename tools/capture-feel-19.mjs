import {chromium} from 'playwright';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFileSync,mkdirSync,writeFileSync,readdirSync,statSync} from 'node:fs';
const levels=JSON.parse(readFileSync('src/core/levels.json','utf8'));
const {fresh,moved}=await import('../src/core/session.ts');
const {layout,goalLayout}=await import('../src/game/geometry.ts');
const dir=process.argv[2]||'/tmp/feel19-captures';mkdirSync(dir,{recursive:true});
const browser=await chromium.launch();const evidence=[];
for(const [width,height]of [[390,844],[320,480],[568,320]])for(const index of [0,15]){
 const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1});
 let s={...fresh(),current:index};for(const m of levels[index].witness.slice(0,-1))s=moved(s,m);s.settings.sound=false;
 await page.addInitScript(s=>localStorage.setItem('water-sort-v1',JSON.stringify(s)),s);
 await page.goto('http://127.0.0.1:4178');await page.locator('#home-play').click();await page.waitForTimeout(300);
 const b=await page.locator('#board').boundingBox();
 // Derive slot count from the trusted authored bank (reward offer adds one display slot).
 const {displaySlots}=await import('../src/core/session.ts');const ps=index?goalLayout(b.width,b.height,displaySlots(s),0):layout(b.width,b.height,displaySlots(s));
 const m=levels[index].witness.at(-1);for(const i of [m.from,m.to])await page.mouse.click(b.x+ps[i].x,b.y+ps[i].y+ps[i].h/2);
 await page.locator('#continue').waitFor();await page.waitForTimeout(850);
 const name=`${index?'goal':'normal'}-${width}x${height}`;await page.screenshot({path:`${dir}/${name}-pop.png`,animations:'disabled'});
 await page.waitForTimeout(2400);await page.screenshot({path:`${dir}/${name}-result.png`,animations:'disabled'});
 const boxes=await page.evaluate(()=>Object.fromEntries(['board','feedback','finish-title','earned-stars','continue','undo'].map(id=>{const r=document.getElementById(id).getBoundingClientRect();return [id,{x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom,right:r.right}]})));
 evidence.push({name,boxes});await page.close();
}
for(const current of [2,12])for(const [width,height]of [[390,844],[320,480]]){
 const page=await browser.newPage({viewport:{width,height}}),s={...fresh(),current};s.settings.sound=false;
 await page.addInitScript(s=>localStorage.setItem('water-sort-v1',JSON.stringify(s)),s);await page.goto('http://127.0.0.1:4178');await page.locator('#home-play').click();await page.waitForTimeout(400);
 const name=`${current===2?'advertising':'objective'}-${width}x${height}`;await page.screenshot({path:`${dir}/${name}.png`,animations:'disabled'});await page.close();
}
await browser.close();
const hash=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
const dist=readdirSync('dist',{recursive:true}).filter(p=>statSync(`dist/${p}`).isFile()).map(p=>({path:p,sha256:hash(`dist/${p}`)}));
const images=readdirSync(dir).filter(p=>p.endsWith('.png')).map(p=>({path:p,sha256:hash(`${dir}/${p}`)}));
writeFileSync(`${dir}/capture.json`,JSON.stringify({head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),dist,images,evidence},null,2));
