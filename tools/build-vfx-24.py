"""Crop generated VFX atlas, retain alpha and downsample for game use. No painted replacements."""
from PIL import Image
from pathlib import Path
import hashlib,json,sys
source=Path(sys.argv[1]);im=Image.open(source).convert('RGBA');assert im.size==(1536,1024)
boxes=[(147,63,422,523),(610,88,962,511),(1135,144,1469,502),(66,617,515,949),(593,644,992,930),(1099,597,1464,964)]
out=Path('public/art/vfx');out.mkdir(parents=True,exist_ok=True);entries=[]
for i,box in enumerate(boxes):
 size=512 if i==3 else 128;crop=im.crop(box);crop.thumbnail((size-12,size-12),Image.Resampling.LANCZOS);frame=Image.new('RGBA',(size,size));frame.alpha_composite(crop,((size-crop.width)//2,(size-crop.height)//2));p=out/f'splash-{i}.webp';frame.save(p,'WEBP',lossless=True,method=6);entries.append({'path':p.name,'crop':box,'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'bytes':p.stat().st_size,'size':[size,size]})
(out/'sprites.json').write_text(json.dumps({'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'sourceSize':im.size,'processing':'Alpha-preserving crop, aspect-preserving Lanczos downsample, lossless WebP; no artwork reconstruction','sprites':entries},indent=2))
print(sum(x['bytes'] for x in entries))
