/** A small, fixed pool of compositor-only decorations behind the game and menu. */
export function mountAmbient(){
 const layer=document.createElement('div');layer.id='ambient';layer.setAttribute('aria-hidden','true');layer.inert=true;layer.dataset.paused='true';
 const positions=[5,14,23,31,38,46,54,62,69,77,85,94,18,82];
 positions.forEach((x,i)=>{
  const mote=document.createElement('i');mote.className=i%4===1?'ambient-spark':'ambient-bubble';
  for(const [name,value]of Object.entries({x:x+'%',size:(i%4===1?5:9+i%4*3)+'px',time:(24+i%5*3)+'s',delay:-(i*7.3+4)+'s',sway:((i%2?1:-1)*(18+i%3*10))+'px'}))mote.style.setProperty('--'+name,value);
  layer.append(mote);
 });
 document.body.prepend(layer);
 return {setActive(active:boolean){layer.dataset.paused=String(!active);}};
}
