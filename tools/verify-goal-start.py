"""Independently derive the prepared board, then disprove every shorter solution."""
import json,subprocess,tempfile,sys
from pathlib import Path
bank=json.loads(Path('src/core/levels.json').read_text())
rows=json.loads(Path('docs/audits/visual-goals-44/optimal.json').read_text())
old=json.loads(Path('docs/audits/campaign-39/optimal.json').read_text())
routes=json.loads(Path('src/core/goalStartRoutes.json').read_text())
expected_routes={}
for i,l in enumerate(bank):
 goals=l.get('goals',[l['goal']] if 'goal' in l else [])
 count=0
 for g in goals:
  if l['initial'][g['index']]:continue
  candidates=[]
  for source,t in enumerate(l['initial']):
   if source in [g['index'] for g in goals] or source==l.get('ice') or not t or t[-1]!=g['color']:continue
   group=1
   while group<len(t) and t[-group-1]==t[-1]:group+=1
   candidates.append((min(group,8-len(l['initial'][g['index']])),source))
  amount,source=min(candidates)
  l['initial'][g['index']].extend(l['initial'][source][-amount:]);del l['initial'][source][-amount:];count+=1
 for extra in [0,1]:
  r=next(r for r in rows if r['level']==i and r['extra']==extra)
  original=next(r for r in old if r['level']==i and r['extra']==extra)
  assert r['setup']==count and r['optimal']+count==original['optimal']
  assert r['independentNoShorterPath'] is True
  if count:expected_routes[l['id']+'@'+str(l['version'])+('+' if extra else '')]=r['path']
assert routes==expected_routes
with tempfile.TemporaryDirectory() as directory:
 source=Path(directory)/'levels.json';source.write_text(json.dumps(bank))
 subprocess.run([sys.executable,'tools/verify-optimal.py','docs/audits/visual-goals-44/optimal.json','--levels',str(source)],check=True)
print('Independent prepared-board derivation, cached hints and historical star scale verified')
