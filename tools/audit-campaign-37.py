"""Content audit, not a claim of player difficulty or measured retention."""
from pathlib import Path
import json,itertools,hashlib
levels=json.loads(Path('src/core/levels.json').read_text());order=json.loads(Path('src/core/campaign.json').read_text());proof=json.loads(Path('docs/audits/hidden-36/optimal.json').read_text());rows=[]
def canonical(l,mask=False):
 b=l['initial'];colors=sorted(set(sum(b,[])));goals=l.get('goals',[l['goal']]if 'goal'in l else []);gi={g['index']for g in goals};hidden={m['index']:set(m['layers'])for m in l.get('hidden',[])}
 def key(perm):
  colour=dict(zip(colors,perm))
  def tube(i):return tuple((colour[c],int(d in hidden.get(i,set()))if mask else 0)for d,c in enumerate(b[i]))
  targets=tuple(sorted((g['capacity'],colour[g['color']],tube(g['index']))for g in goals));special=tuple((role,tube(l[role]))for role in ['mini','ice']if role in l)
  normal=tuple(sorted(tube(i)for i in range(len(b))if i not in gi and i not in [l.get('mini'),l.get('ice')]))
  return targets,special,normal
 return hashlib.sha256(repr(min(key(p)for p in itertools.permutations(range(len(colors))))).encode()).hexdigest()
for i,l in enumerate(levels):
 p=next(r for r in proof if r['level']==i and not r['extra']);a=next(r for r in proof if r['level']==i and r['extra']);roles=[]
 if l.get('goals'):roles.append('two-goals')
 elif l.get('goal'):roles.append('goal')
 roles += [k for k in ['mini','ice','hidden']if k in l]
 rows.append({'id':l['id'],'oldStage':i+1,'stage':order.index(l['id'])+1,'colors':l['colors'],'optimal':p['optimal'],'extraOptimal':a['optimal'],'runs':sum(d==0 or t[d-1]!=c for t in l['initial']for d,c in enumerate(t)),'maskedUnits':sum(len(m['layers'])for m in l.get('hidden',[])),'roles':roles or ['ordinary'],'physicalFingerprint':canonical(l),'maskedFingerprint':canonical(l,True)})
physical={};masked={}
for r in rows:physical.setdefault(r['physicalFingerprint'],[]).append(r['id']);masked.setdefault(r['maskedFingerprint'],[]).append(r['id'])
def changes(seq):return sum(seq[i]['roles']!=seq[i-1]['roles']for i in range(1,len(seq)))
new=sorted(rows,key=lambda r:r['stage']);out={'method':'Exact physical canonicalization across colour renaming and ordinary/goal slot permutation; role identities and unit order preserved. Masked fingerprint also preserves authored question positions. These are structural metrics, not player difficulty.','levels':rows,'samePhysicsGroups':[v for v in physical.values()if len(v)>1],'sameMaskAndPhysicsGroups':[v for v in masked.values()if len(v)>1],'oldRoleTransitions':changes(rows),'newRoleTransitions':changes(new),'extraSlotShortensOptimum':[r['id']for r in rows if r['extraOptimal']<r['optimal']]}
p=Path('docs/audits/campaign-37');p.mkdir(parents=True,exist_ok=True);(p/'audit.json').write_text(json.dumps(out,indent=2)+'\n');print(json.dumps({k:v for k,v in out.items()if k not in ['levels','method']},indent=2))
