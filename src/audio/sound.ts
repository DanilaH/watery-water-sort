// Sample-based foley. Source licenses and processing are recorded in docs/AUDIO_CREDITS.md.
const FILES=['select','accept','cork','land','reject','hint','complete','victory','pour-1','pour-2','pour-3'] as const;
type Cue=typeof FILES[number];
export class Sound {
  private context?:AudioContext;
  private master?:GainNode;
  private buffers=new Map<Cue,AudioBuffer>();
  private loading?:Promise<void>;
  private voices:{stop:()=>void;release:()=>void;priority:number}[]=[];
  private pending=0;
  private blocked=false;
  private variant=0;
  enabled=true;
  load(){
    if(this.loading)return this.loading;
    this.context??=new AudioContext();const c=this.context;
    if(!this.master){this.master=c.createGain();this.master.gain.value=.8;const limiter=c.createDynamicsCompressor();limiter.threshold.value=-10;limiter.knee.value=12;limiter.ratio.value=5;this.master.connect(limiter);limiter.connect(c.destination);}
    this.loading=Promise.all(FILES.map(async name=>{try{const response=await fetch(`${import.meta.env.BASE_URL}audio/${name}.ogg`);if(!response.ok)throw Error('Audio unavailable');const buffer=await c.decodeAudioData(await response.arrayBuffer());this.buffers.set(name,buffer);}catch{/* Missing audio must never block a move. */}})).then(()=>{});
    return this.loading;
  }
  prime(){if(this.blocked||!this.enabled)return;void this.load();if(this.context?.state==='suspended')void this.context.resume().catch(()=>{});}
  setEnabled(on:boolean){this.enabled=on;if(!on)this.stop();}
  block(on:boolean){this.blocked=on;if(on){this.stop();setTimeout(()=>{if(this.blocked)void this.context?.suspend();},18);}}
  stop(){this.pending++;for(const v of [...this.voices])v.release();}
  private play(name:Cue,volume:number,priority:number,rate=1,durationMs?:number,fill?:{from:number;to:number}){
    if(!this.enabled||this.blocked)return;this.prime();const buffer=this.buffers.get(name),c=this.context;if(!c||!this.master)return;if(!buffer){const token=++this.pending,at=performance.now();void this.loading?.then(()=>{if(this.buffers.has(name)&&this.pending===token&&performance.now()-at<100){const remaining=durationMs===undefined?undefined:durationMs-(performance.now()-at);if(remaining===undefined||remaining>12)this.play(name,volume,priority,rate,remaining,fill);}});return;}
    if(this.voices.length>=4){const low=[...this.voices].sort((a,b)=>a.priority-b.priority)[0];if(low.priority>priority)return;low.stop();}
    const source=c.createBufferSource(),gain=c.createGain(),pan=c.createStereoPanner();source.buffer=buffer;source.playbackRate.value=rate;
    const duration=durationMs?Math.min(durationMs/1000,buffer.duration/rate):buffer.duration/rate,now=c.currentTime;
    gain.gain.setValueAtTime(0,now);gain.gain.linearRampToValueAtTime(volume,now+.006);gain.gain.setValueAtTime(volume,now+Math.max(.007,duration-.035));gain.gain.linearRampToValueAtTime(0,now+duration);
    pan.pan.value=name.startsWith('pour')?(Math.random()-.5)*.12:0;
    const filter=c.createBiquadFilter();filter.type='lowpass';filter.Q.value=.35;
    filter.frequency.setValueAtTime(fill?1900+2200*fill.from:12000,now);
    if(fill)filter.frequency.linearRampToValueAtTime(1900+2200*fill.to,now+duration);
    source.connect(filter);filter.connect(gain);gain.connect(pan);pan.connect(this.master);
    let stopped=false;const voice={priority,release:()=>{if(stopped)return;const now=c.currentTime;gain.gain.cancelScheduledValues(now);gain.gain.setValueAtTime(gain.gain.value,now);gain.gain.linearRampToValueAtTime(0,now+.012);try{source.stop(now+.015);}catch{}},stop:()=>{if(stopped)return;stopped=true;try{source.stop();}catch{}source.disconnect();filter.disconnect();gain.disconnect();pan.disconnect();this.voices=this.voices.filter(v=>v!==voice);}};
    source.onended=voice.stop;this.voices.push(voice);source.start(now);source.stop(now+duration+.005);
  }
  tap(){this.play('select',.55,0,.98+Math.random()*.04);}
  accept(){this.play('accept',.38,0,1,65);}
  land(){this.play('land',.28,0,1,115);}
  reject(){this.play('reject',.25,0);}
  hint(){this.play('hint',.5,1);}
  finish(won:boolean,sequence=0){this.play('cork',won?.36:.30,2,1,105);this.play(won?'victory':'complete',won?.75:.6,3,won?1:2**(Math.min(3,sequence*.6)/12));}
  ui(){this.play('select',.25,0,1.12);}
  undo(){this.play('land',.45,1,.85);}
  pour(durationMs:number,amount:number,fill=0,endFill=Math.min(1,fill+amount/4)){if(durationMs<=12)return;this.variant=(this.variant+1+Math.floor(Math.random()*2))%3;this.play(`pour-${this.variant+1}` as Cue,.80+amount*.025,2,.985+Math.random()*.03,durationMs,{from:fill,to:endFill});}
}
