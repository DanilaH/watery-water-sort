"""0.16 material finish bank, from CC0 Tinysized recordings. No oscillators/plucks.
Usage: python tools/build-material-audio.py /path/to/sfx-cc0
Requires ffmpeg, numpy, scipy. Original filenames/license: docs/AUDIO_CREDITS.md.
"""
from pathlib import Path
import hashlib,json,subprocess,sys
import numpy as np
from scipy.signal import butter,sosfilt

root=Path(sys.argv[1]);out=Path('public/audio');sr=44100;sources={}
def read(name):
    p=root/name;sources[name]=hashlib.sha256(p.read_bytes()).hexdigest()
    return np.frombuffer(subprocess.check_output(['ffmpeg','-v','error','-i',str(p),'-f','f32le','-ac','1','-ar',str(sr),'-']),np.float32).copy()
def cut(a,start,length):return a[round(start*sr):round((start+length)*sr)].copy()
def trim(a):
    at=np.where(np.abs(a)>.02)[0]
    return a[max(0,int(at[0])-round(.004*sr)):] if len(at) else a
def layer(length,parts):
    mix=np.zeros(round(length*sr))
    for a,at,gain in parts:
        begin=round(at*sr);n=min(len(a),len(mix)-begin)
        if n>0:mix[begin:begin+n]+=a[:n]*gain
    return mix
def save(name,a,rms=.095,high=6000):
    a=sosfilt(butter(2,[130,high],btype='bandpass',fs=sr,output='sos'),a)
    a-=np.mean(a);a*=rms/max(1e-9,np.sqrt(np.mean(a*a)))
    a=.68*np.tanh(a/.68)
    attack=min(round(.003*sr),len(a)//4);tail=min(round(.055*sr),len(a)//4)
    a[:attack]*=np.linspace(0,1,attack);a[-tail:]*=np.linspace(1,0,tail)
    p=out/(name+'.ogg')
    subprocess.run(['ffmpeg','-y','-v','error','-f','f32le','-ar',str(sr),'-ac','1','-i','-','-c:a','libvorbis','-q:a','5',str(p)],input=a.astype(np.float32).tobytes(),check=True)
    # Verify the actual compressed delivery, not only the pre-encode waveform.
    decoded=np.frombuffer(subprocess.check_output(['ffmpeg','-v','error','-i',str(p),'-f','f32le','-ac','1','-ar',str(sr),'-']),np.float32)
    return dict(name=name,duration=round(len(decoded)/sr,3),peak=round(float(max(abs(decoded))),4),rms=round(float(np.sqrt(np.mean(decoded**2))),4),bytes=p.stat().st_size,sha256=hashlib.sha256(p.read_bytes()).hexdigest())

cork=trim(read('bottle-glass-cork-01.wav'))
uncork=trim(read('bottle-glass-uncork-01.wav'))
water=read('water-vial-fill-01.wav')
drop=trim(read('water-drop-03.wav'))
coin=trim(read('coinflip-01.wav'))
report=[
    save('cork',cut(cork,0,.26),.11,4800),
    save('complete',layer(.36,[(cut(water,1.68,.26),0,.65),(cut(drop,0,.22),.045,.3)]),.085,6500),
    # Air release, watery splash and a short room reflection, not a tuned victory chord.
    save('victory',layer(.90,[(cut(uncork,0,.4),.19,.6),(cut(water,.02,.42),.24,.55),(cut(drop,0,.3),.42,.25),(cut(uncork,0,.35),.32,.10)]),.11,7200),
    save('collect',cut(coin,0,.19),.08,4800),
]
(out/'material-report.json').write_text(json.dumps(dict(sampleRate=sr,sources=sources,assets=report),indent=2)+'\n')
print(json.dumps(report,indent=2))
