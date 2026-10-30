import {starGlyph} from './VictoryUI';
type Options={earned:number;delta:number;before:number;total:number;reduced:boolean};
/** Pure presentation. The best result has already been saved before this starts. */
export class StarReward{
  private frame=0;
  private flights:HTMLElement[]=[];
  private animations:Animation[]=[];
  private total=0;
  constructor(private result:HTMLElement,private counters:HTMLElement[],private onArrival:(index:number)=>void){}
  setTotal(total:number,display=total){this.total=total;if(!this.frame)this.counters.forEach(e=>e.textContent=String(display));}
  cancel(){
    cancelAnimationFrame(this.frame);this.frame=0;
    this.flights.forEach(e=>e.remove());this.flights=[];
    this.animations.forEach(a=>a.cancel());this.animations=[];
    this.counters.forEach(e=>e.textContent=String(this.total));
    this.result.classList.remove('revealing-stars');
    this.result.querySelectorAll<HTMLElement>('.result-star').forEach(e=>e.classList.add('lit'));
  }
  run({earned,delta,before,total,reduced}:Options){
    this.cancel();this.total=total;
    const target=document.getElementById('star-bank')!;
    const items=Array.from({length:3},(_,i)=>{
      const e=starGlyph(i,i<earned,'result-star');
      e.setAttribute('aria-hidden','true');this.result.append(e);return e;
    });
    // replace the static text, retaining the accessible label on the parent.
    for(const child of [...this.result.childNodes])if(!items.includes(child as HTMLSpanElement))child.remove();
    this.result.classList.add('revealing-stars');
    this.counters.forEach(e=>e.textContent=String(before));
    const start=performance.now(),revealed=new Set<number>(),arrived=new Set<number>();
    const tick=(now:number)=>{
      const elapsed=now-start;
      for(let i=0;i<3;i++){
        if(elapsed>=(reduced?80:220)+i*(reduced?70:100)&&!revealed.has(i)){
          revealed.add(i);items[i].classList.add('lit');
          if(!reduced)this.animations.push(items[i].animate(i<earned?[{transform:'scale(.4) rotate(-20deg)',opacity:0},{transform:'scale(1.3) rotate(7deg)',opacity:1,offset:.62},{transform:'scale(1)',opacity:1}]:[{transform:'scale(.82)',opacity:0},{transform:'scale(1)',opacity:1}],{duration:i<earned?340:240,easing:'cubic-bezier(.2,.8,.2,1)'}));
        }
      }
      for(let i=0;i<delta;i++){
        const begin=(reduced?340:1050)+i*160,p=Math.max(0,Math.min(1,(elapsed-begin)/(reduced?140:460)));
        if(elapsed<begin||arrived.has(i))continue;
        let fly=this.flights[i];
        if(!fly){fly=document.createElement('span');fly.className='star-flight';fly.textContent='★';fly.setAttribute('aria-hidden','true');document.body.append(fly);this.flights[i]=fly;}
        const from=items[Math.max(0,earned-delta+i)].getBoundingClientRect(),to=target.getBoundingClientRect(),ease=p*p*(3-2*p);
        const x=from.x+from.width/2+(to.x+to.width/2-from.x-from.width/2)*ease;
        const y=from.y+from.height/2+(to.y+to.height/2-from.y-from.height/2)*ease-(reduced?0:Math.sin(p*Math.PI)*70);
        fly.style.transform=`translate(${x}px,${y}px) translate(-50%,-50%) scale(${1-.48*p})`;
        fly.style.opacity=String(reduced?.35:1);
        if(p>=1){
          arrived.add(i);fly.remove();this.counters.forEach(e=>e.textContent=String(before+arrived.size));
          this.onArrival(i);
          if(!reduced)this.animations.push(target.animate([{transform:'scale(1)'},{transform:'scale(1.14)',offset:.4},{transform:'scale(1)'}],{duration:170}));
        }
      }
      if(elapsed>Math.max(900,(reduced?340:1050)+Math.max(0,delta-1)*160+(reduced?140:460))+80){this.cancel();return;}
      this.frame=requestAnimationFrame(tick);
    };
    this.frame=requestAnimationFrame(tick);
  }
}
