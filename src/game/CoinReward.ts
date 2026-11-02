/** Presentation only. The wallet is committed before any coin is created. */
export class CoinReward{
 private effects:Animation[]=[];private timers:ReturnType<typeof setTimeout>[]=[];private nodes:HTMLElement[]=[];private version=0;
 constructor(private source:HTMLElement,private target:HTMLElement,private arrive:(index:number)=>void){}
 cancel(){this.version++;for(const t of this.timers)clearTimeout(t);for(const a of this.effects)a.cancel();for(const n of this.nodes)n.remove();this.timers=[];this.effects=[];this.nodes=[];}
 run(delta:number,reduced:boolean){
  this.cancel();if(delta<=0)return;const v=this.version;this.source.textContent=`+${delta}`;this.source.hidden=false;
  this.timers.push(setTimeout(()=>{if(v===this.version)this.source.hidden=true;},1700));
  if(reduced)return;const a=this.source.getBoundingClientRect(),b=this.target.getBoundingClientRect();const count=Math.min(8,Math.max(2,Math.ceil(delta/5)));
  for(let i=0;i<count;i++)this.timers.push(setTimeout(()=>{
   if(v!==this.version||document.hidden)return;const coin=document.createElement('span');coin.className='coin-flight coin-icon';coin.setAttribute('aria-hidden','true');document.body.append(coin);this.nodes.push(coin);
   const x=a.x+a.width/2,y=a.y+a.height/2,dx=b.x+b.width/2-x,dy=b.y+b.height/2-y;
   const frames=Array.from({length:13},(_,j)=>{const t=j/12;return {transform:`translate(${x+dx*t-12}px,${y+dy*t-Math.sin(Math.PI*t)*55-12}px) scale(${1-.45*t}) rotate(${t*220}deg)`,opacity:t>.9?1-(t-.9)*5:1};});
   const animation=coin.animate(frames,{duration:660,easing:'cubic-bezier(.2,.5,.4,1)',fill:'both'});this.effects.push(animation);animation.onfinish=()=>{coin.remove();if(v===this.version){this.arrive(i);const pulse=this.target.animate([{transform:'scale(1.13)'},{transform:'scale(1)'}],{duration:150});this.effects.push(pulse);}};
  },120+i*95));
 }
}
