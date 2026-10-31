"""Independent bounded search: own transitions, tuple states, no production solver."""
import json,time,math,sys
from pathlib import Path
levels=json.loads(Path('src/core/levels.json').read_text());source=Path(next((s for s in sys.argv[1:]if s!='--write'),('docs/audits/mini-34/optimal.json' if Path('docs/audits/mini-34/optimal.json').exists() else 'docs/audits/dual-goals-33/optimal.json' if Path('docs/audits/dual-goals-33/optimal.json').exists() else 'docs/audits/giant-17/optimal.json' if Path('docs/audits/giant-17/optimal.json').exists() else 'docs/audits/stars-14/optimal.json')));rows=[json.loads(s)for s in source.read_text().splitlines()]if source.suffix=='.jsonl'else json.loads(source.read_text());proofs=[]
assert len(rows)==len(levels)*2 and {(r['level'],int(r['extra'])) for r in rows}=={(i,extra) for i in range(len(levels)) for extra in [0,1]}, 'Incomplete optimal proof bank'
for row in rows:
 initial=levels[row['level']]['initial']+([[]]if row['extra']else[]);colors=levels[row['level']]['colors'];level=levels[row['level']];goals=level.get('goals',[level['goal']] if level.get('goal') else []);first=len(goals);mini=level.get('mini');fixed=first+int(mini is not None);goal_colors={g['color'] for g in goals};seen={};nodes=0
 assert [g['index'] for g in goals]==list(range(first)), 'Offline proof expects fixed prefix goals'
 assert mini is None or mini==first
 def capacity(i):return 8 if i<first else 2 if i==mini else 4
 def finished(b):return all((len(b[g['index']])==8 and set(b[g['index']])=={g['color']})for g in goals) and (mini is None or not b[mini]) and all(not t or len(t)==4 and len(set(t))==1 and t[0] not in goal_colors for t in b[fixed:])
 def runs(b):return sum(sum(i==0 or t[i-1]!=c for i,c in enumerate(t))for t in b)-colors
 def search(b,left):
  global nodes
  nodes+=1
  if runs(b)>left:return False
  if finished(b):return True
  if left==0:return False
  key=(b[:fixed],tuple(sorted(b[fixed:])))
  if seen.get(key,-1)>=left:return False
  seen[key]=left
  for a,t in enumerate(b):
   if not t or a<first:continue
   c=t[-1];group=1
   while group<len(t) and t[-group-1]==c:group+=1
   for z,d in enumerate(b):
    limit=capacity(z)
    if a==z or len(d)==limit or d and d[-1]!=c or z<first and c!=goals[z]['color']:continue
    q=min(group,limit-len(d));n=list(b);n[a]=t[:-q];n[z]=d+(c,)*q
    if search(tuple(n),left-1):return True
  return False
 started=time.time();found_shorter=search(tuple(map(tuple,initial)),row['optimal']-1);assert not found_shorter,row
 b=[list(t)for t in initial]
 for m in row['path']:
  a,z=b[m['from']],b[m['to']];c=a[-1];g=1
  while g<len(a)and a[-1-g]==c:g+=1
  limit=capacity(m['to'])
  assert m['from']>=first and (m['to']>=first or c==goals[m['to']]['color'])
  assert (not z or z[-1]==c)and m['amount']==min(g,limit-len(z))and c==m['color'];z.extend(a[-m['amount']:]);del a[-m['amount']:]
 assert finished(b)
 proofs.append({**row,'independentNoShorterPath':True,'proofNodes':nodes,'proofMs':round((time.time()-started)*1000,2)})
 print(row['level']+1,row['extra'],row['optimal'],nodes,flush=True)
if '--write'in sys.argv:
 Path('docs/audits/mini-34').mkdir(parents=True,exist_ok=True);Path('docs/audits/mini-34/optimal.json').write_text(json.dumps(proofs,indent=2)+'\n')
ratings={levels[r['level']]['id']+'@'+str(levels[r['level']]['version']):{'three':r['optimal'],'two':r['optimal']+max(2,math.ceil(r['optimal']*.2))}for r in rows if not r['extra']}
if '--write'in sys.argv:Path('src/core/ratings.json').write_text(json.dumps(ratings,indent=2)+'\n')
else:assert json.loads(Path('src/core/ratings.json').read_text())==ratings
print(f'Verified {len(rows)} optimal paths and all star thresholds')
