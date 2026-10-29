"""Prepare the approved transparent sprite and five texture-consistent fracture pieces.
Usage: python tools/build-crystal-assets.py APPROVED_PNG
This only crops transparent padding, downsamples and partitions the same artwork.
"""
from pathlib import Path
from PIL import Image
import sys,json,hashlib
source=Path(sys.argv[1]);original=Image.open(source).convert('RGBA');bbox=original.getchannel('A').point(lambda a:255 if a>8 else 0).getbbox();assert bbox
image=original.crop(bbox);image.thumbnail((512,512),Image.Resampling.LANCZOS)
out=Path('public/art');out.mkdir(parents=True,exist_ok=True);image.save(out/'goal-crystal-base.webp',lossless=True,method=6)
w,h=image.size;seeds=[(.24,.13),(.76,.13),(.12,.66),(.88,.66),(.5,.8)];masks=[bytearray(w*h) for _ in seeds];alpha=image.getchannel('A').tobytes()
for y in range(h):
 for x in range(w):
  i=min(range(5),key=lambda i:(x/w-seeds[i][0])**2+(y/h-seeds[i][1])**2);masks[i][y*w+x]=alpha[y*w+x]
for i,mask in enumerate(masks):
 shard=image.copy();shard.putalpha(Image.frombytes('L',(w,h),bytes(mask)));shard.save(out/f'goal-crystal-shard-{i}.webp',lossless=True,method=6)
files=[p for p in sorted(out.glob('goal-crystal-*.webp'))]
report=dict(sourceSha256=hashlib.sha256(source.read_bytes()).hexdigest(),crop=list(bbox),width=w,height=h,files=[dict(path=str(p),bytes=p.stat().st_size,sha256=hashlib.sha256(p.read_bytes()).hexdigest()) for p in files])
(out/'goal-crystal.json').write_text(json.dumps(report,indent=2));print(json.dumps(report))
