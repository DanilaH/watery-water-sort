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
palette=sheet.quantize(colors=240,method=Image.Quantize.MEDIANCUT)
# Reserve small cork/highlight accents that otherwise lose to the large blue background.
accents=[0x916039,0xce9a59,0xe9bd7b,0x734624,0xb57c43,0x755b4c,0x3e3541,0xf1fdff,0xbef067,0xffd35d,0xf5f8ff,0xb3c9ef,0x00d9f5,0xffd000,0x17386c,0x3056a7]
colours=palette.getpalette()
for i,c in enumerate(accents,240):colours[i*3:i*3+3]=[c>>16&255,c>>8&255,c&255]
palette.putpalette(colours)
frames=[f.quantize(palette=palette,dither=Image.Dither.NONE) for f in frames]
ticks=[round((r['time']-records[0]['time'])*100) for r in records]
durations=[(b-a)*10 for a,b in zip(ticks,ticks[1:])]+[150]
frames[0].save(output,save_all=True,append_images=frames[1:],duration=durations,loop=0,disposal=2,optimize=False)
output.with_suffix('.json').write_text(json.dumps({'source':'Chromium compositor PNGs','crop':meta['clip'],'frames':len(frames),'durationsMs':durations,'interpolation':False,'silent':True,'reservedAccentColours':[hex(c) for c in accents],'sha256':hashlib.sha256(output.read_bytes()).hexdigest()},indent=2))
