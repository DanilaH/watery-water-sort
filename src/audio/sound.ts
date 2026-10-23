// Sample-based foley. Source licenses and processing are recorded in docs/AUDIO_CREDITS.md.
const FILES=['select','land','reject','hint','complete','victory','pour-1','pour-2','pour-3'] as const;
type Cue=typeof FILES[number];
export class Sound {
  private context?:AudioContext;
  private master?:GainNode;
  private buffers=new Map<Cue,AudioBuffer>();
  private loading?:Promise<void>;
  private voices:{stop:()=>void;priority:number}[]=[];
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
  block(on:boolean){this.blocked=on;if(on){this.stop();void this.context?.suspend();}}
  stop(){for(const v of [...this.voices])v.stop();this.voices=[];}
  private play(name:Cue,volume:number,priority:number,rate=1,durationMs?:number){
    if(!this.enabled||this.blocked)return;this.prime();const buffer=this.buffers.get(name),c=this.context;if(!buffer||!c||!this.master)return;
    if(this.voices.length>=4){const low=[...this.voices].sort((a,b)=>a.priority-b.priority)[0];if(low.priority>priority)return;low.stop();}
    const source=c.createBufferSource(),gain=c.createGain(),pan=c.createStereoPanner();source.buffer=buffer;source.playbackRate.value=rate;
    const duration=durationMs?Math.min(durationMs/1000,buffer.duration/rate):buffer.duration/rate,now=c.currentTime;
    gain.gain.setValueAtTime(0,now);gain.gain.linearRampToValueAtTime(volume,now+.006);gain.gain.setValueAtTime(volume,now+Math.max(.007,duration-.035));gain.gain.linearRampToValueAtTime(0,now+duration);
    pan.pan.value=name.startsWith('pour')?(Math.random()-.5)*.12:0;
    source.connect(gain);gain.connect(pan);pan.connect(this.master);
    let stopped=false;const voice={priority,stop:()=>{if(stopped)return;stopped=true;try{source.stop();}catch{}source.disconnect();gain.disconnect();pan.disconnect();this.voices=this.voices.filter(v=>v!==voice);}};
    source.onended=voice.stop;this.voices.push(voice);source.start(now);source.stop(now+duration+.005);
  }
  tap(){this.play('select',.55,0,.98+Math.random()*.04);}
  land(){this.play('land',.32,0);}
  reject(){this.play('reject',.25,0);}
  hint(){this.play('hint',.5,1);}
  finish(won:boolean){this.play(won?'victory':'complete',won?.75:.6,3);}
  pour(durationMs:number,amount:number){this.variant=(this.variant+1+Math.floor(Math.random()*2))%3;this.play(`pour-${this.variant+1}` as Cue,.9+amount*.025,2,.97+Math.random()*.06,durationMs);}
}
