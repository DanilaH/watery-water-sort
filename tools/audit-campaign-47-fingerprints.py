import json,itertools,hashlib
from pathlib import Path
levels=json.loads(Path('src/core/levels-v1.json').read_text());groups={}
for l in levels:
 goals=l.get('goals',[l['goal']]if'goal'in l else []);gi={g['index']for g in goals};special={l[k]for k in ('mini','ice')if k in l};colors=sorted(set(sum(l['initial'],[])));best=None
 for p in itertools.permutations(range(len(colors))):
  ren=dict(zip(colors,p));ts=[tuple(ren[c]for c in t)for t in l['initial']]
  key=(tuple(sorted((g['capacity'],ren[g['color']],ts[g['index']])for g in goals)),tuple((k,ts[l[k]])for k in ('mini','ice')if k in l),tuple(sorted(t for i,t in enumerate(ts)if i not in gi|special)))
  if best is None or key<best:best=key
 fingerprint=hashlib.sha256(repr(best).encode()).hexdigest();groups.setdefault(fingerprint,[]).append(l['id'])
Path('docs/audits/campaign-47/physical-duplicates.json').write_text(json.dumps({'method':'Exact colour-renaming and role-preserving vessel-permutation equivalence of authored initial physics; hidden masks deliberately ignored. These pairs can differ in information available to the player. Prepared starts are audited separately.','groups':[g for g in groups.values()if len(g)>1]},indent=2)+'\n')
print([g for g in groups.values()if len(g)>1])
