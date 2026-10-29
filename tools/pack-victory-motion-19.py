"""Package actual browser captures into a GIF; no synthetic animation frames."""
from pathlib import Path
from PIL import Image
import json,sys
source=Path(sys.argv[1]);output=Path(sys.argv[2]);meta=json.loads((source/'frames.json').read_text())
frames=[Image.open(p).convert('RGB') for p in sorted(source.glob('*.png'))]
w,h=frames[0].size;sheet=Image.new('RGB',(w,h*len(frames)))
for i,frame in enumerate(frames):sheet.paste(frame,(0,i*h))
palette=sheet.quantize(colors=256,method=Image.Quantize.MEDIANCUT)
frames=[frame.quantize(palette=palette,dither=Image.Dither.NONE) for frame in frames]
durations=[round(meta['frames'][i+1]-meta['frames'][i]) for i in range(len(frames)-1)]+[500]
frames[0].save(output,save_all=True,append_images=frames[1:],duration=durations,loop=0,disposal=2,optimize=False)
