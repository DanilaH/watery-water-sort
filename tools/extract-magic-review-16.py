"""Reproduce analysis strips from the user's two recordings; no app code is changed."""
import argparse, subprocess, tempfile, hashlib, json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
p=argparse.ArgumentParser();p.add_argument('first',type=Path);p.add_argument('second',type=Path);p.add_argument('--out',type=Path,default=Path('docs/audits/magic-sort-16'));a=p.parse_args();a.out.mkdir(parents=True,exist_ok=True)
font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',15)
panels=[('color',a.first,[(41.5,'Льётся'),(41.95,'Спираль'),(42.35,'Пробка'),(42.8,'Завершено')],(0,140,288,500)),('giant',a.first,[(63.65,'Долив цвета'),(64.25,'Завершение'),(64.85,'Распад основания'),(65.45,'Высота сохранена')],(0,140,288,500)),('parallel',a.first,[(40.0,'Первое переливание'),(40.2,'Хвост струи'),(40.4,'Возврат'),(41.9,'Новая операция + FX')],(0,140,288,500)),('coins',a.second,[(217.1,'Награда'),(217.6,'Монеты летят'),(218.3,'Прибытие в HUD'),(218.7,'1060 → 1080')],(0,0,288,550)),('hard',a.first,[(299.6,'Заранее: HARD / ×3'),(304.0,'Метка на поле'),(410.0,'Награда: 60')],(0,0,288,620))]
with tempfile.TemporaryDirectory() as td:
 for name,video,cases,box in panels:
  width=288*len(cases);height=box[3]-box[1]+54;sheet=Image.new('RGB',(width,height),'#e6eaf1');d=ImageDraw.Draw(sheet)
  for i,(t,label) in enumerate(cases):
   f=Path(td)/f'{name}-{i}.png';subprocess.run(['ffmpeg','-v','error','-ss',str(t),'-i',str(video),'-frames:v','1','-vf','scale=288:640',str(f)],check=True);im=Image.open(f).crop(box);sheet.paste(im,(i*288,54));d.text((i*288+7,5),label,font=font,fill='#18314f');d.text((i*288+7,27),f'{int(t)//60:02}:{t%60:05.2f}',font=font,fill='#405c7b')
  sheet.save(a.out/(name+'.webp'),quality=91)
sources=[]
for video in [a.first,a.second]:
 info=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_format','-show_streams','-of','json',str(video)]));s=next(s for s in info['streams'] if s['codec_type']=='video');sources.append({'filename':video.name,'sha256':hashlib.sha256(video.read_bytes()).hexdigest(),'bytes':video.stat().st_size,'container_duration':float(info['format']['duration']),'video_duration':float(s['duration']),'size':[s['width'],s['height']],'frames':int(s['nb_frames'])})
(a.out/'sources.json').write_text(json.dumps({'sources':sources,'panels':[{'file':n+'.webp','source':v.name,'times':[t for t,_ in cs]} for n,v,cs,_ in panels],'method':'195 overview frames at 1/4 fps; selected events re-examined at 5–10 fps. Timing estimates ±0.1–0.2 s; no touch telemetry or physical haptic measurements. Audio PCM envelopes/spectra inspected, no subjective listening validation.'},ensure_ascii=False,indent=2)+'\n')
