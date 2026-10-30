import {chromium} from 'playwright';
import {mkdirSync,writeFileSync,readFileSync,readdirSync,statSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fresh} from '../src/core/session.ts';
const out=process.argv[2];mkdirSync(out,{recursive:true});const browser=await chromium.launch();const errors=[];
for(const [width,height,theme,current]of [
 [390,844,'blue',11],[390,844,'plum',11],[390,844,'graphite',11],[390,844,'ice',11],
 [320,480,'blue',11],[568,320,'blue',11],[390,844,'blue',12]
]){
 const page=await browser.newPage({viewport:{width,height}}),s={...fresh(),current};s.settings.sound=false;s.settings.theme=theme;s.settings.light=theme==='ice';
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(s=>localStorage.setItem('water-sort-v1',JSON.stringify(s)),s);await page.goto('http://127.0.0.1:4178');await page.locator('#home-play').click();await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(500);
 await page.screenshot({path:`${out}/${theme}-${width}x${height}-${current+1}.png`,animations:'disabled'});await page.close();
}
await browser.close();if(errors.length)throw Error(JSON.stringify(errors));
const hash=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
writeFileSync(`${out}/capture.json`,JSON.stringify({sourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),dirty:!!execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim(),errors,dist:readdirSync('dist',{recursive:true}).filter(p=>statSync(`dist/${p}`).isFile()).map(p=>({path:p,sha256:hash(`dist/${p}`)})),images:readdirSync(out).filter(p=>p.endsWith('.png')).map(p=>({path:p,sha256:hash(`${out}/${p}`)}))},null,2));
