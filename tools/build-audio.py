"""Build the 0.2 foley mix from the CC0 sources listed in docs/AUDIO_CREDITS.md.
Usage: python3 tools/build-audio.py /path/to/extracted-sources
Requires ffmpeg, numpy and scipy. The directory contains the named WAV/OGG originals.
"""
from pathlib import Path
import sys, subprocess, json
import numpy as np
from scipy.signal import butter,sosfilt,resample_poly
root=Path(sys.argv[1]);out=Path('public/audio');out.mkdir(parents=True,exist_ok=True);sr=44100

def read(name):
 raw=subprocess.check_output(['ffmpeg','-v','error','-i',str(root/name),'-f','f32le','-ac','1','-ar',str(sr),'-'])
 return np.frombuffer(raw,np.float32).copy()
def process(a,rms=.11,peak=.55):
 a=sosfilt(butter(2,[100,5200],btype='bandpass',fs=sr,output='sos'),a)
 a-=np.mean(a);value=np.sqrt(np.mean(a*a));a*=rms/max(value,1e-9)
 a=peak*np.tanh(a/peak*1.35)
 fade=min(int(sr*.012),len(a)//3);a[:fade]*=np.linspace(0,1,fade);tail=min(int(sr*.035),len(a)//3);a[-tail:]*=np.linspace(1,0,tail)
 return a
def segment(a,start,duration):return a[int(start*sr):int((start+duration)*sr)].copy()
def save(name,a):
 a=process(a);wav=out/(name+'.ogg');raw=np.asarray(a,np.float32).tobytes()
 subprocess.run(['ffmpeg','-y','-v','error','-f','f32le','-ar',str(sr),'-ac','1','-i','-','-c:a','libvorbis','-q:a','5',str(wav)],input=raw,check=True)
 return {'name':name,'duration':round(len(a)/sr,3),'peak':round(float(max(abs(a))),4),'rms':round(float(np.sqrt(np.mean(a*a))),4),'bytes':wav.stat().st_size}
stream=read('water-pour-01.wav');fill=read('water-vial-fill-01.wav');drop=read('water-drop-02.wav');glass=read('vial-glass-close-01.wav');pluck=read('pluck_001.ogg');click=read('click_002.ogg');back=read('back_001.ogg')
# Different parts of real recordings; never re-use the exact same transient consecutively.
report=[]
for i,(record,start)in enumerate([(stream,.45),(fill,.42),(fill,1.08)],1):report.append(save('pour-'+str(i),segment(record,start,.36)))
report.append(save('select',segment(drop,.025,.17)))
report.append(save('land',segment(glass,.025,.19)))
report.append(save('reject',segment(back,0,min(.16,len(back)/sr))))
# Short tuned resonances derived from a sampled pluck, with a dry attack and modest room tail.
def chord(notes,length):
 mix=np.zeros(int(sr*length));base=process(pluck,rms=.1,peak=.4)
 for semitones,at,gain in notes:
  pitched=resample_poly(base,1000,int(1000*2**(semitones/12)))
  offset=int(at*sr);count=min(len(pitched),len(mix)-offset);mix[offset:offset+count]+=pitched[:count]*gain
  for delay,wet in [(.045,.09),(.085,.04)]:
   start=offset+int(delay*sr);n=min(len(pitched),len(mix)-start)
   if n>0:mix[start:start+n]+=pitched[:n]*gain*wet
 return mix
report.append(save('hint',chord([(0,0,.8),(7,.08,.6)],.45)))
report.append(save('complete',chord([(0,0,.75),(7,.055,.65),(12,.1,.35)],.48)))
report.append(save('victory',chord([(0,0,.65),(4,.075,.65),(7,.15,.7),(12,.225,.75)],.85)))
(out/'mix-report.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))
