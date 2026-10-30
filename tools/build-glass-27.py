"""Technical sprite extraction: crop only, retain generated RGBA, lossless WebP."""
from pathlib import Path
from PIL import Image
import json,hashlib,sys
src=Path(sys.argv[1]);im=Image.open(src).convert('RGBA');assert im.size==(1536,1024)
out=Path('public/art/glass');out.mkdir(parents=True,exist_ok=True);assets=[]
for name,box in [('tube',(364,78,640,958)),('cork',(926,356,1216,520))]:
 p=out/(name+'-27.webp');crop=im.crop(box);crop.save(p,lossless=True,method=6,exact=True)
 assert Image.open(p).convert('RGBA').tobytes()==crop.tobytes()
 assets.append({'path':p.name,'crop':box,'size':crop.size,'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
(out/'material-27.json').write_text(json.dumps({'sourceSha256':hashlib.sha256(src.read_bytes()).hexdigest(),'sourceSize':im.size,'processing':'Unmodified RGBA crop, lossless WebP; no repainted material or alpha reconstruction','assets':assets,'mapping':{'width':276,'innerWidth':204,'anchor':[138,27],'bottomMargin':39,'topSlice':80,'bottomSlice':170}},indent=2))
print(json.dumps(assets))
