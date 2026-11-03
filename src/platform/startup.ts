/** The first visible menu already has its final skins, font, artwork and saved theme.
 * Only essential local UI assets participate; audio and level textures load independently.
 */
export async function revealStartup(heroReady:Promise<unknown>){
 const loaded=new Set<string>();
 const image=(name:string,path:string)=>new Promise<void>((resolve,reject)=>{
  const img=new Image();
  img.onload=()=>{Promise.resolve().then(()=>img.decode?.()).then(()=>{loaded.add(name);resolve();},reject);};
  img.onerror=reject;img.src=path;
 });
 const work=[image('blue','art/ui/button-blue-29.svg'),image('gold','art/ui/button-gold-29.svg'),image('star','art/ui/star-gold-29.svg'),
  Promise.resolve().then(()=>document.fonts?.load('650 20px Rubik')).then(faces=>{if(faces?.length)loaded.add('font');}),heroReady];
 let deadline:ReturnType<typeof setTimeout>|undefined;
 // Broken/stalled files must not strand the user on an invisible menu.
 await Promise.race([Promise.allSettled(work),new Promise<void>(resolve=>{deadline=setTimeout(resolve,2000);})]);
 clearTimeout(deadline);
 for(const name of ['blue','gold','star','font'])if(!loaded.has(name))document.body.setAttribute(`data-${name}-fallback`,'');
 // Give decoded fonts and final DOM geometry a paint opportunity before reveal.
 // A backgrounded WebView need not run RAF, so this settlement is bounded too.
 await new Promise<void>(resolve=>{
  let first=0,second=0;
  const finish=()=>{clearTimeout(timer);cancelAnimationFrame(first);cancelAnimationFrame(second);resolve();};
  const timer=setTimeout(finish,120);
  first=requestAnimationFrame(()=>{second=requestAnimationFrame(finish);});
 });
 document.body.setAttribute('data-startup-ready','');
 document.body.removeAttribute('data-booting');document.body.inert=false;
}
