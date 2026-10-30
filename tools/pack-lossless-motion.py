"""Lossless animated WebP from actual compositor PNG frames and measured timestamps."""
from pathlib import Path
from PIL import Image,ImageChops
import json,sys,hashlib
source=Path(sys.argv[1]);output=Path(sys.argv[2]);meta=json.loads((source/'capture.json').read_text());records=[]
for r in meta['images']:
 if not records or r['time']-records[-1]['time']>=.028:records.append(r)
frames=[Image.open(source/r['path']).convert('RGB') for r in records]
ticks=[round((r['time']-records[0]['time'])*1000) for r in records]
durations=[b-a for a,b in zip(ticks,ticks[1:])]+[150]
frames[0].save(output,save_all=True,append_images=frames[1:],duration=durations,loop=0,lossless=True,method=6,minimize_size=False,allow_mixed=False)
# Animated WebP can merge identical frames, so check decoded pixels against all originals.
decoded=Image.open(output);source_pixels={hashlib.sha256(f.tobytes()).hexdigest() for f in frames}
for i in range(decoded.n_frames):
 decoded.seek(i);assert hashlib.sha256(decoded.convert('RGB').tobytes()).hexdigest() in source_pixels
output.with_suffix('.json').write_text(json.dumps({'source':'Chromium compositor PNGs','sourceCommit':meta['sourceCommit'],'dirty':meta['dirty'],'lossless':True,'crop':None,'interpolation':False,'silent':True,'frames':len(frames),'decodedFrames':decoded.n_frames,'durationsMs':durations,'sha256':hashlib.sha256(output.read_bytes()).hexdigest()},indent=2))
print(output.name,output.stat().st_size,decoded.n_frames)
