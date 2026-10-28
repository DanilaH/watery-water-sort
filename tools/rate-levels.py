"""Recompute exact optima then independently prove no shorter path. Run from repository root."""
import json,subprocess,tempfile,sys
from pathlib import Path
with tempfile.TemporaryDirectory()as d:
 binary=Path(d)/'optimal';subprocess.run(['g++','-O3','-std=c++17','tools/optimal-levels.cpp','-o',str(binary)],check=True)
 lines=[]
 for i,l in enumerate(json.loads(Path('src/core/levels.json').read_text())):
  assert not l.get('goal') or l['goal']['index']==0, 'Offline goal canonicalization expects slot 0'
  for extra in [0,1]:
   b=l['initial']+[[]]*extra;codes=[]
   for tube in b:
    code=1
    for c in tube:code=(code<<3)|c
    codes.append(code)
   lines.append(' '.join(map(str,[i,extra,len(b),l['colors'],l.get('goal',{}).get('color',-1),*codes])))
 output=Path(d)/'optimal.jsonl';output.write_text(subprocess.check_output([str(binary)],input='\n'.join(lines)+'\n',text=True))
 subprocess.run([sys.executable,'tools/verify-optimal.py',str(output),'--write'],check=True)
