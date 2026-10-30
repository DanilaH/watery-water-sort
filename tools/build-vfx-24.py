"""Crop generated VFX atlas, retain alpha and downsample for game use. No painted replacements."""
from PIL import Image
from pathlib import Path
import hashlib,json,sys
source=Path(sys.argv[1]);im=Image.open(source).convert('RGBA');assert im.size==(1536,1024)
boxes=[(147,63,422,523),(610,88,962,511),(1135,144,1469,502),(66,617,515,949),(593,644,992,930),(1099,597,1464,964)]
out=Path('public/art/vfx');out.mkdir(parents=True,exist_ok=True);entries=[]
for i,box in enumerate(boxes):
 crop=im.crop(box);crop.thumbnail((116,116),Image.Resampling.LANCZOS);frame=Image.new('RGBA',(128,128));frame.alpha_composite(crop,((128-crop.width)//2,(128-crop.height)//2));p=out/f'splash-{i}.webp';frame.save(p,'WEBP',lossless=True,method=6);entries.append({'path':p.name,'crop':box,'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'bytes':p.stat().st_size})
(out/'sprites.json').write_text(json.dumps({'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'sourceSize':im.size,'frameSize':[128,128],'processing':'Alpha-preserving crop, aspect-preserving Lanczos downsample, lossless WebP; no artwork reconstruction','sprites':entries},indent=2))
print(sum(x['bytes'] for x in entries))
