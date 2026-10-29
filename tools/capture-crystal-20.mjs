import {chromium} from 'playwright';import {mkdirSync,writeFileSync,readFileSync,readdirSync,statSync} from 'node:fs';import {createHash} from 'node:crypto';import {execFileSync} from 'node:child_process';
import {fresh} from '../src/core/session.ts';
const out=process.argv[2];mkdirSync(out,{recursive:true});const browser=await chromium.launch();
for(const [width,height,theme]of [[390,844,'blue'],[320,480,'blue'],[568,320,'blue'],[390,844,'ice']]){
 const page=await browser.newPage({viewport:{width,height}}),s={...fresh(),current:12};s.settings.sound=false;s.settings.theme=theme;
 await page.addInitScript(s=>localStorage.setItem('water-sort-v1',JSON.stringify(s)),s);await page.goto('http://127.0.0.1:4178');await page.locator('#home-play').click();await page.waitForTimeout(450);await page.screenshot({path:`${out}/crystal-${theme}-${width}x${height}.png`,animations:'disabled'});await page.close();
}
await browser.close();const hash=p=>createHash('sha256').update(readFileSync(p)).digest('hex');writeFileSync(`${out}/capture.json`,JSON.stringify({sourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),dist:readdirSync('dist',{recursive:true}).filter(p=>statSync(`dist/${p}`).isFile()).map(p=>({path:p,sha256:hash(`dist/${p}`)})),images:readdirSync(out).filter(p=>p.endsWith('.png')).map(p=>({path:p,sha256:hash(`${out}/${p}`)}))},null,2));
