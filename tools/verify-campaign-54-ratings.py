"""Check historical and current authored/prepared optima, routes and the complete rating registry."""
import copy,json,subprocess,sys,tempfile
from pathlib import Path
load=lambda p:json.loads(Path(p).read_text())
ratings={};expected_prepared={};expected_routes={}
with tempfile.TemporaryDirectory()as directory:
 for name,source,authored,prepared in [
  ('legacy','src/core/levels-v1.json','docs/audits/campaign-39/optimal.json','docs/audits/visual-goals-44/optimal.json'),
  ('previous','src/core/levels-v47.json','docs/audits/campaign-balance-47/optimal.json','docs/audits/campaign-balance-47/prepared.json'),
  ('current','src/core/levels.json','docs/audits/campaign-54/optimal.json','docs/audits/campaign-54/prepared.json')]:
  bank=load(source);original=load(authored);ready=load(prepared)
  for r in original:
   l=bank[r['level']];key=l['id']+'@'+str(l['version']);expected_routes[key+('+'if r['extra']else'')]=r['path']
   if not r['extra']:ratings[key]={'three':r['optimal'],'two':r['optimal']+max(2,(r['optimal']+4)//5)}
  for i,l in enumerate(bank):
   goals=l.get('goals',[l['goal']]if'goal'in l else[]);count=0
   for g in goals:
    if l['initial'][g['index']]:continue
    candidates=[]
    for source_index,t in enumerate(l['initial']):
     if source_index in [v['index']for v in goals]or source_index==l.get('ice')or not t or t[-1]!=g['color']:continue
     amount=1
     while amount<len(t)and t[-amount-1]==t[-1]:amount+=1
     candidates.append((min(amount,8-len(l['initial'][g['index']])),source_index))
    amount,source_index=min(candidates);l['initial'][g['index']].extend(l['initial'][source_index][-amount:]);del l['initial'][source_index][-amount:];count+=1
   for extra in [0,1]:
    r=next(r for r in ready if r['level']==i and r['extra']==extra);old=next(r for r in original if r['level']==i and r['extra']==extra)
    assert r['setup']==count and r['optimal']+count==old['optimal']
    if count:expected_prepared[l['id']+'@'+str(l['version'])+('+'if extra else'')]=r['path']
  bank_file=Path(directory)/(name+'.json');bank_file.write_text(json.dumps(bank))
  for proof,levels in [(authored,source),(prepared,str(bank_file))]:
   subprocess.run([sys.executable,'tools/verify-optimal.py',proof,'--levels',levels,'--ratings-subset'],check=True)
assert load('src/core/ratings.json')==ratings
assert load('src/core/optimalRoutes.json')==expected_routes
assert load('src/core/goalStartRoutes.json')==expected_prepared
print('Verified 880 historical/current authored/prepared paths, all versioned ratings and cached routes')
