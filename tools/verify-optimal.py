"""Independent bounded search: own transitions, tuple states, no production solver."""
import json,time,math,sys
from pathlib import Path
levels=json.loads(Path('src/core/levels.json').read_text());source=Path(next((s for s in sys.argv[1:]if s!='--write'),('docs/audits/giant-17/optimal.json' if Path('docs/audits/giant-17/optimal.json').exists() else 'docs/audits/stars-14/optimal.json')));rows=[json.loads(s)for s in source.read_text().splitlines()]if source.suffix=='.jsonl'else json.loads(source.read_text());proofs=[]
assert len(rows)==len(levels)*2 and {(r['level'],int(r['extra'])) for r in rows}=={(i,extra) for i in range(len(levels)) for extra in [0,1]}, 'Incomplete optimal proof bank'
for row in rows:
 initial=levels[row['level']]['initial']+([[]]if row['extra']else[]);colors=levels[row['level']]['colors'];goal=levels[row['level']].get('goal');seen={};nodes=0
 assert not goal or goal['index']==0, 'Offline goal proof expects slot 0'
 def finished(b):return (not goal or len(b[0])==8) and all((len(t)==8 and set(t)=={goal['color']}) if goal and i==0 else not t or len(t)==4 and len(set(t))==1 and (not goal or t[0]!=goal['color']) for i,t in enumerate(b))
 def runs(b):return sum(sum(i==0 or t[i-1]!=c for i,c in enumerate(t))for t in b)-colors
 def search(b,left):
  global nodes
  nodes+=1
  if runs(b)>left:return False
  if finished(b):return True
  if left==0:return False
  key=(b[0],tuple(sorted(b[1:]))) if goal else tuple(sorted(b))
  if seen.get(key,-1)>=left:return False
  seen[key]=left
  for a,t in enumerate(b):
   if not t or goal and a==0:continue
   c=t[-1];group=1
   while group<len(t) and t[-group-1]==c:group+=1
   for z,d in enumerate(b):
    capacity=8 if goal and z==0 else 4
    if a==z or len(d)==capacity or d and d[-1]!=c or goal and z==0 and c!=goal['color']:continue
    q=min(group,capacity-len(d));n=list(b);n[a]=t[:-q];n[z]=d+(c,)*q
    if search(tuple(n),left-1):return True
  return False
 started=time.time();found_shorter=search(tuple(map(tuple,initial)),row['optimal']-1);assert not found_shorter,row
 b=[list(t)for t in initial]
 for m in row['path']:
  a,z=b[m['from']],b[m['to']];c=a[-1];g=1
  while g<len(a)and a[-1-g]==c:g+=1
  capacity=8 if goal and m['to']==0 else 4
  assert not goal or m['from']!=0 and (m['to']!=0 or c==goal['color'])
  assert (not z or z[-1]==c)and m['amount']==min(g,capacity-len(z))and c==m['color'];z.extend(a[-m['amount']:]);del a[-m['amount']:]
 assert finished(b)
 proofs.append({**row,'independentNoShorterPath':True,'proofNodes':nodes,'proofMs':round((time.time()-started)*1000,2)})
 print(row['level']+1,row['extra'],row['optimal'],nodes,flush=True)
if '--write'in sys.argv:
 Path('docs/audits/giant-17').mkdir(parents=True,exist_ok=True);Path('docs/audits/giant-17/optimal.json').write_text(json.dumps(proofs,indent=2)+'\n')
ratings={levels[r['level']]['id']+'@1':{'three':r['optimal'],'two':r['optimal']+max(2,math.ceil(r['optimal']*.2))}for r in rows if not r['extra']}
if '--write'in sys.argv:Path('src/core/ratings.json').write_text(json.dumps(ratings,indent=2)+'\n')
else:assert json.loads(Path('src/core/ratings.json').read_text())==ratings
print(f'Verified {len(rows)} optimal paths and all star thresholds')
