from pathlib import Path
import base64,json
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'store-media'
def data(p,mime='image/png'):
 return 'data:'+mime+';base64,'+base64.b64encode(p.read_bytes()).decode()
star=data(ROOT/'watery-water-sort/public/art/ui/star-gold-29.svg','image/svg+xml')
font=data(ROOT/'watery-water-sort/public/fonts/rubik.woff','font/woff')
cases=[
 ('01-colors','Разложи всё<br><em>по цветам</em>','Переливай слои и продумывай ходы.','#3ee6f4'),
 ('02-giant','Собери цвет<br><em>в большой колбе</em>','Для нужного цвета — отдельная большая колба.','#62ebcc'),
 ('03-hidden','Не все цвета<br><em>видны сразу</em>','Переливай верхние слои, чтобы увидеть нижние.','#e77bff'),
 ('04-ice','Освободи колбу<br><em>изо льда</em>','Собери один цвет, чтобы разбить лёд.','#8edfff'),
 ('05-stars','Пройди уровень<br><em>на три звезды</em>','Уложись в цель по ходам и улучши результат.','#ffcf4c'),
]
template='''<!doctype html><html lang="ru"><meta charset="utf-8"><style>
@font-face{font-family:Rubik;src:url("@@FONT@@") format("woff");font-weight:300 900}
*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden}
body{font-family:Rubik,sans-serif;background:#0b1428;color:#f5f9ff}
.poster{position:relative;width:100%;height:100%;overflow:hidden;background:radial-gradient(ellipse at 82% 25%,#263875 0,transparent 58%),linear-gradient(150deg,#111f3b,#091224 76%);isolation:isolate}
.glow{position:absolute;inset:-150px;background:radial-gradient(ellipse at 11% 44%,var(--accent),transparent 46%);opacity:.13;filter:blur(70px)}
.orbit{position:absolute;left:-340px;top:960px;width:1250px;height:1250px;border:2px solid #a2e6ff10;border-radius:50%}
.dot{position:absolute;width:10px;height:10px;border:2px solid #b8edff55;border-radius:50%;right:60px;top:360px}
.copy{position:absolute;z-index:3;left:76px;right:56px;top:72px}
h1{font-size:82px;line-height:1.06;letter-spacing:-3.1px;font-weight:800;margin:0;text-shadow:0 5px 0 #050b1944}
em{font-style:normal;color:var(--accent)}
p{font-size:32px;line-height:1.4;color:#bdcfe8;font-weight:450;max-width:880px;margin:30px 0 0}
.screen{position:absolute;left:115px;top:429px;width:850px;height:1457.143px;border-radius:36px;overflow:hidden;z-index:2;box-shadow:0 34px 75px #0007,0 0 0 2px #d0ebff24}
.screen img{display:block;width:100%;height:100%}
.detail{display:none}
.wide .copy{left:112px;right:auto;top:145px;width:1000px}
.wide h1{font-size:98px;line-height:1.08;letter-spacing:-3.5px}
.wide p{font-size:36px;max-width:850px;margin-top:36px;line-height:1.45}
.wide .screen{left:1250px;top:56px;width:564px;height:966.857px;border-radius:30px;box-shadow:0 25px 80px #0009,0 0 0 2px #d0ebff30}
.wide .orbit{left:-210px;top:390px;width:1460px;height:1460px}
.wide .dot{top:100px;right:780px}
.wide .detail{display:block;position:absolute;left:80px;top:540px;width:1030px;height:500px;overflow:hidden;opacity:.98}
.wide .detail img{position:absolute;width:100%;height:auto;top:-155px;mask-image:linear-gradient(to right,transparent,#000 7%,#000 92%,transparent)}
.wide[data-case="02-giant"] .detail{left:280px;width:570px;height:520px;top:510px;mask-image:linear-gradient(to bottom,transparent,#000 5%,#000 97%,transparent)}
.wide[data-case="02-giant"] .detail img{width:1030px;left:-240px;top:-130px}
.wide[data-case="05-stars"] .detail{display:none}
.wide[data-case="05-stars"] .win-detail{display:flex;gap:25px;position:absolute;left:170px;top:650px;width:810px;height:260px;align-items:center;filter:drop-shadow(0 0 35px #ffbc2829)}
.win-detail{display:none}
.win-detail img{width:240px;height:240px;object-fit:contain}
</style><body><main class="poster @@CLASS@@" data-case="@@ID@@" style="--accent:@@ACCENT@@"><div class="glow"></div><div class="orbit"></div><div class="dot"></div><section class="copy"><h1>@@TITLE@@</h1><p>@@BODY@@</p></section><div class="detail"><img src="@@BOARD@@"></div><div class="win-detail"><img src="@@STAR@@"><img src="@@STAR@@"><img src="@@STAR@@"></div><div class="screen"><img src="@@SCREEN@@"></div></main></body></html>'''
for name,title,body,accent in cases:
 for orientation in ('portrait','landscape'):
  s=template
  for k,v in {'FONT':font,'STAR':star,'CLASS':'wide' if orientation=='landscape' else '', 'ID':name,'ACCENT':accent,'TITLE':title,'BODY':body,'BOARD':data(OUT/'source'/f'{name}-board.png'),'SCREEN':data(OUT/'source'/f'{name}.png')}.items():s=s.replace('@@'+k+'@@',v)
  (OUT/'render'/f'{orientation}-{name}.html').write_text(s)
(OUT/'render/cases.json').write_text(json.dumps([c[0] for c in cases]))
