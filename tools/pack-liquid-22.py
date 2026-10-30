"""Package actual compositor frames with their measured timing; no synthetic motion."""
from pathlib import Path
from PIL import Image
import json,sys,hashlib
source=Path(sys.argv[1]);output=Path(sys.argv[2]);meta=json.loads((source/'capture.json').read_text());records=[]
for r in meta['images']:
 if not records or r['time']-records[-1]['time']>=.028:records.append(r)
x,y,w,h=meta['clip'].values()
frames=[Image.open(source/r['path']).convert('RGB').crop((x,y,x+w,y+h)) for r in records]
sheet=Image.new('RGB',(w,h*len(frames)))
for i,frame in enumerate(frames):sheet.paste(frame,(0,i*h))
palette=sheet.quantize(colors=256,method=Image.Quantize.MEDIANCUT)
frames=[f.quantize(palette=palette,dither=Image.Dither.NONE) for f in frames]
ticks=[round((r['time']-records[0]['time'])*100) for r in records]
durations=[(b-a)*10 for a,b in zip(ticks,ticks[1:])]+[150]
frames[0].save(output,save_all=True,append_images=frames[1:],duration=durations,loop=0,disposal=2,optimize=False)
output.with_suffix('.json').write_text(json.dumps({'source':'Chromium compositor PNGs','crop':meta['clip'],'frames':len(frames),'durationsMs':durations,'interpolation':False,'silent':True,'sha256':hashlib.sha256(output.read_bytes()).hexdigest()},indent=2))
