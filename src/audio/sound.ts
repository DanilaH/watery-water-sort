// Original procedural sound design: no third-party recordings or sampled assets.
// Every cue owns its nodes; cancellation stops sources before context suspension.
export class Sound {
  private context?: AudioContext;
  private master?: GainNode;
  private voices: {stop:()=>void; priority:number}[]=[];
  enabled=true;
  private blocked=false;
  prime() {
    if(this.blocked || !this.enabled)return;
    this.context ??= new AudioContext();
    if(!this.master){this.master=this.context.createGain();this.master.gain.value=.42;const limiter=this.context.createDynamicsCompressor();limiter.threshold.value=-12;limiter.ratio.value=8;this.master.connect(limiter);limiter.connect(this.context.destination);}
    if(this.context.state==='suspended')void this.context.resume().catch(()=>{});
  }
  setEnabled(enabled:boolean){this.enabled=enabled;if(!enabled)this.stop();}
  block(blocked:boolean){this.blocked=blocked;if(blocked){this.stop();void this.context?.suspend();}}
  stop(){for(const v of [...this.voices])v.stop();this.voices=[];}
  private voice(duration:number,priority:number,make:(c:AudioContext,out:GainNode,t:number)=>AudioScheduledSourceNode[]) {
    if(!this.enabled||this.blocked)return ()=>{};
    this.prime();const c=this.context!;
    if(this.voices.length>=4){const low=[...this.voices].sort((a,b)=>a.priority-b.priority)[0];if(low.priority>priority)return ()=>{};low.stop();}
    const gain=c.createGain();gain.connect(this.master!);
    const sources=make(c,gain,c.currentTime);let stopped=false;
    const voice={priority,stop:()=>{if(stopped)return;stopped=true;clearTimeout(timer);for(const s of sources){try{s.stop();}catch{}s.disconnect();}gain.disconnect();this.voices=this.voices.filter(v=>v!==voice);}};
    const timer=setTimeout(voice.stop,duration*1000+100);this.voices.push(voice);return voice.stop;
  }
  tap(){this.tone([520+Math.random()*30],.09,.09,0);}
  reject(){this.tone([155],.08,.05,0);}
  finish(won:boolean){this.tone(won?[523.25,659.25,783.99,1046.5]:[659.25,987.77],won?.62:.28,won?.16:.12,3);}
  hint(){this.tone([440,660],.23,.09,1);}
  private tone(notes:number[],length:number,volume:number,priority:number){
    this.voice(length+.2,priority,(c,out,t)=>notes.map((f,i)=>{const osc=c.createOscillator(),env=c.createGain();osc.type='sine';osc.frequency.setValueAtTime(f,t);const at=t+i*.045;env.gain.setValueAtTime(0,t);env.gain.linearRampToValueAtTime(volume/Math.sqrt(notes.length),at+.008);env.gain.exponentialRampToValueAtTime(.0001,at+length);osc.connect(env);env.connect(out);osc.start(at);osc.stop(at+length+.01);osc.onended=()=>env.disconnect();return osc;}));
  }
  pour(durationMs:number,amount:number){
    const duration=durationMs/1000;
    return this.voice(duration,2,(c,out,t)=>{
      const buffer=c.createBuffer(1,Math.ceil(c.sampleRate*duration),c.sampleRate),data=buffer.getChannelData(0);
      const base=340+Math.random()*90;let phase=0,noise=0;
      // Filtered stream bed plus decaying, chirping bubble resonances; seed varies each cue.
      for(let i=0;i<data.length;i++){
        const time=i/c.sampleRate;noise=.91*noise+.09*(Math.random()*2-1);
        const pulse=(time*(15+amount*2))%1;
        phase+=2*Math.PI*(base+420*Math.exp(-pulse*8))/c.sampleRate;
        const envelope=Math.min(1,time/.025)*Math.min(1,(duration-time)/.045);
        data[i]=(noise*.24+Math.sin(phase)*Math.exp(-pulse*6)*.12)*envelope;
      }
      const source=c.createBufferSource();source.buffer=buffer;source.connect(out);source.start(t);return [source];
    });
  }
}
