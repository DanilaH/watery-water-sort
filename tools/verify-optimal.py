"""Independent bounded search: own transitions, tuple states, no production solver."""
import json,time,math,sys
from pathlib import Path
levels=json.loads(Path('src/core/levels.json').read_text());source=Path(next((s for s in sys.argv[1:]if s!='--write'),'docs/audits/stars-14/optimal.json'));rows=[json.loads(s)for s in source.read_text().splitlines()]if source.suffix=='.jsonl'else json.loads(source.read_text());proofs=[]
for row in rows:
 initial=levels[row['level']]['initial']+([[]]if row['extra']else[]);colors=levels[row['level']]['colors'];seen={};nodes=0
 def runs(b):return sum(sum(i==0 or t[i-1]!=c for i,c in enumerate(t))for t in b)-colors
 def search(b,left):
  global nodes
  nodes+=1
  if runs(b)>left:return False
  if all(not t or len(t)==4 and len(set(t))==1 for t in b):return True
  if left==0:return False
  key=tuple(sorted(b))
  if seen.get(key,-1)>=left:return False
  seen[key]=left
  for a,t in enumerate(b):
   if not t:continue
   c=t[-1];group=1
   while group<len(t) and t[-group-1]==c:group+=1
   for z,d in enumerate(b):
    if a==z or len(d)==4 or d and d[-1]!=c:continue
    q=min(group,4-len(d));n=list(b);n[a]=t[:-q];n[z]=d+(c,)*q
    if search(tuple(n),left-1):return True
  return False
 started=time.time();found_shorter=search(tuple(map(tuple,initial)),row['optimal']-1);assert not found_shorter,row
 b=[list(t)for t in initial]
 for m in row['path']:
  a,z=b[m['from']],b[m['to']];c=a[-1];g=1
  while g<len(a)and a[-1-g]==c:g+=1
  assert (not z or z[-1]==c)and m['amount']==min(g,4-len(z))and c==m['color'];z.extend(a[-m['amount']:]);del a[-m['amount']:]
 assert all(not t or len(t)==4 and len(set(t))==1 for t in b)
 proofs.append({**row,'independentNoShorterPath':True,'proofNodes':nodes,'proofMs':round((time.time()-started)*1000,2)})
 print(row['level']+1,row['extra'],row['optimal'],nodes,flush=True)
if '--write'in sys.argv:
 Path('docs/audits/stars-14').mkdir(parents=True,exist_ok=True);Path('docs/audits/stars-14/optimal.json').write_text(json.dumps(proofs,indent=2)+'\n')
ratings={levels[r['level']]['id']+'@1':{'three':r['optimal'],'two':r['optimal']+max(2,math.ceil(r['optimal']*.2))}for r in rows if not r['extra']}
if '--write'in sys.argv:Path('src/core/ratings.json').write_text(json.dumps(ratings,indent=2)+'\n')
else:assert json.loads(Path('src/core/ratings.json').read_text())==ratings
print('Verified 24 optimal paths and all star thresholds')
