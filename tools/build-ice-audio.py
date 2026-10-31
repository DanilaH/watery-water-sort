"""A short fracture texture from our CC0 glass recording; no oscillator/noise synthesis."""
from pathlib import Path
import subprocess,base64,json,hashlib,tempfile
import numpy as np
rate=44100
source=Path('public/audio/land.ogg')
raw=subprocess.check_output(['ffmpeg','-v','error','-i',str(source),'-f','f32le','-ac','1','-ar',str(rate),'-'])
sample=np.frombuffer(raw,dtype='<f4');mix=np.zeros(int(rate*.34),dtype=np.float64)
for i,(ms,pitch,gain)in enumerate([(0,1.06,.8),(17,1.32,.42),(38,.92,.45),(68,1.18,.33),(102,1.4,.24),(149,1.1,.18),(205,1.28,.1)]):
 length=min(len(sample),int(rate*.095));grain=np.interp(np.arange(0,length,pitch),np.arange(len(sample)),sample);n=len(grain);fade=np.minimum(1,np.arange(n)/(rate*.0015))*np.minimum(1,np.arange(n-1,-1,-1)/(rate*.013));grain=grain*fade*gain;start=int(ms*rate/1000);mix[start:start+n]+=grain[:len(mix)-start]
mix*=.68/max(.001,float(np.max(np.abs(mix))))
with tempfile.TemporaryDirectory()as d:
 p=Path(d)/'ice.ogg';subprocess.run(['ffmpeg','-v','error','-f','f32le','-ac','1','-ar',str(rate),'-i','-','-af','highpass=f=220,lowpass=f=7000,afade=t=out:st=0.26:d=0.08','-c:a','libvorbis','-q:a','5','-y',str(p)],input=mix.astype('<f4').tobytes(),check=True);encoded=p.read_bytes();decoded=np.frombuffer(subprocess.check_output(['ffmpeg','-v','error','-i',str(p),'-f','f32le','-ac','1','-ar',str(rate),'-']),dtype='<f4')
Path('src/audio/ice.ts').write_text('// CC0 recorded glass, processed by tools/build-ice-audio.py.\nexport const ICE_AUDIO="data:audio/ogg;base64,'+base64.b64encode(encoded).decode()+'";\n')
report={'source':str(source),'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'oggSha256':hashlib.sha256(encoded).hexdigest(),'bytes':len(encoded),'duration':len(decoded)/rate,'peak':float(np.max(np.abs(decoded))),'rms':float(np.sqrt(np.mean(decoded**2))),'license':'CC0; same recorded glass as the existing landing sample','method':'Seven short faded grains of the recorded glass; no generated noise or oscillators'}
Path('docs/audits/ice-35').mkdir(parents=True,exist_ok=True);Path('docs/audits/ice-35/audio.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report))
