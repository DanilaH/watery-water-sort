import {chromium} from 'playwright';
import {readFileSync} from 'node:fs';
const root='/workspace/scratch/3a5c9a735dde/store-media';
const cases=JSON.parse(readFileSync(root+'/render/cases.json','utf8'));
const b=await chromium.launch({headless:true,args:['--no-zygote','--single-process']});
const p=await b.newPage();
for (const orientation of ['portrait','landscape']){
 await p.setViewportSize(orientation==='portrait'?{width:1080,height:1920}:{width:1920,height:1080});
 for(const name of cases){
  await p.setContent(readFileSync(root+'/render/'+orientation+'-'+name+'.html','utf8'),{waitUntil:'load'});
  await p.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode()))});
  await p.screenshot({path:root+'/'+orientation+'/'+name+'.jpg',type:'jpeg',quality:96});
  console.log(orientation,name);
 }
}
await b.close();
