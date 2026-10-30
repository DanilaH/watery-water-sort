"""Compile generated UI atlas with alpha-preserving crops and aspect-preserving downsampling."""
from pathlib import Path
from PIL import Image
import hashlib,json,sys,base64
src=Path(sys.argv[1]);out=Path(sys.argv[2]);out.mkdir(parents=True,exist_ok=True);im=Image.open(src).convert('RGBA');assert im.size==(1536,1024)
assets=[]
for name,box,size in [('button-blue',(56,68,576,555),(288,288)),('button-gold',(640,138,1508,465),(768,288)),('star-gold',(550,535,980,952),(256,256)),('star-empty',(1045,535,1478,952),(256,256))]:
 crop=im.crop(box);crop.thumbnail(size,Image.Resampling.LANCZOS);p=out/(name+'-29.webp');crop.save(p,lossless=True,method=6,exact=True)
 assert Image.open(p).convert('RGBA').tobytes()==crop.tobytes()
 assets.append({'path':p.name,'crop':box,'size':crop.size,'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
(out/'material-29.json').write_text(json.dumps({'sourceSha256':hashlib.sha256(src.read_bytes()).hexdigest(),'sourceSize':im.size,'processing':'RGBA crop, aspect-preserving Lanczos downsample, pixel-exact lossless WebP; no painted replacements','assets':assets},indent=2))

# Image-only SVG containers preserve the compressed raster and make uploads text-safe.
for a in assets:
 p=out/a['path'];b=p.read_bytes();w,h=a['size'];encoded=base64.b64encode(b).decode();target=p.with_suffix('.svg')
 target.write_text(f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}"><image width="{w}" height="{h}" href="data:image/webp;base64,{encoded}"/></svg>\n')
 a['embeddedWebPBytes']=len(b);a['embeddedWebPSha256']=a['sha256'];a['path']=target.name;a['bytes']=target.stat().st_size;a['sha256']=hashlib.sha256(target.read_bytes()).hexdigest();p.unlink()
meta=json.loads((out/'material-29.json').read_text());meta['assets']=assets;meta['transport']='SVG image-only containers embed original lossless WebP bytes exactly; no re-drawing, scripts, external references or pixel changes. GitHub binary blob upload was unavailable.'
(out/'material-29.json').write_text(json.dumps(meta,indent=2))

print(json.dumps(assets))
