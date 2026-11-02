"""Independent Python transitions and exhaustive reachability for the first 21 revised starts.
No TS imports, no solver oracle. Hidden colours are known to this physical graph.
"""
import json
from collections import deque
from pathlib import Path
levels={l['id']:l for l in json.loads(Path('src/core/levels.json').read_text())}
audit=json.loads(Path('docs/audits/campaign-balance-47/audit.json').read_text())

def check(l,blocked=-1):
    goals={g['index']:g for g in l.get('goals',[l['goal']] if 'goal' in l else [])}
    mini=l.get('mini'); ice=l.get('ice'); b=tuple(tuple(t) for t in l['initial'])
    def cap(i): return 2 if i==mini else goals.get(i,{}).get('capacity',4)
    def sealed(board,i,open_):
        t=board[i]
        return (i!=ice or open_) and i!=mini and len(t)==cap(i) and len(set(t))==1 and (t[0]not in [g['color']for g in goals.values()] or i in goals)
    def win(board,open_):return (ice is None or open_) and all(sealed(board,i,open_) for i in goals) and all(not t or sealed(board,i,open_) for i,t in enumerate(board))
    def steps(board,open_):
        for i,t in enumerate(board):
            if not t or i==blocked or i in goals or i==ice and not open_:continue
            color=t[-1]; amount=next((k for k,c in enumerate(reversed(t)) if c!=color),len(t))
            for j,z in enumerate(board):
                if i==j or j==blocked or j==ice and not open_ or len(z)>=cap(j) or z and z[-1]!=color or j in goals and goals[j]['color']!=color:continue
                n=min(amount,cap(j)-len(z));v=list(board);v[i]=t[:-n];v[j]=z+(color,)*n;v=tuple(v)
                thaw=open_ or (ice is not None and not sealed(board,i,open_) and sealed(v,j,open_))
                yield (i,j,n,color),v,thaw
    # Same deterministic player setup, independently derived from legal transitions.
    opened=False;prefix=[]; requested_block=blocked; blocked=-1
    for goal in goals:
        if b[goal]:continue
        choices=[x for x in steps(b,opened)if x[0][1]==goal]
        assert choices,(l['id'],goal,blocked,b)
        m,b,opened=min(choices,key=lambda x:(x[0][2],x[0][0]));prefix.append(m)
    blocked=requested_block
    def key(board,open_):return (tuple(board[i]for i in goals),None if mini is None else board[mini],None if ice is None else (open_,board[ice]),tuple(sorted(t for i,t in enumerate(board)if i!=blocked and i not in goals and i not in (mini,ice))))
    nodes=[(b,opened,0)];seen={key(b,opened):0};rev=[[]];wins=[];truncated=False
    for idx,(board,open_,depth) in enumerate(nodes):
        if win(board,open_):wins.append(idx);continue
        for _,v,thaw in steps(board,open_):
            k=key(v,thaw);n=seen.get(k)
            if n is None:
                if len(nodes)>=audit['method']['graphLimit']:truncated=True;continue
                n=len(nodes);seen[k]=n;nodes.append((v,thaw,depth+1));rev.append([])
            if n!=idx:rev[n].append(idx)
    good=set(wins);queue=deque(wins)
    while queue:
        for p in rev[queue.popleft()]:
            if p not in good:good.add(p);queue.append(p)
    return {'complete':not truncated,'states':len(nodes),'deadStates':len(nodes)-len(good) if not truncated else None,'shortest':nodes[wins[0]][2]if wins else None},prefix

rows=[]
for row in audit['rows'][:21]:
    for blocked,expected in [(-1,row['graph'])]+([(row['withoutOneEmpty']['blocked'],row['withoutOneEmpty'])]if row['withoutOneEmpty']else []):
        actual,prefix=check(levels[row['id']],blocked)
        for k,v in actual.items():assert v==expected.get(k),(row['stage'],blocked,k,v,expected.get(k))
        assert len(prefix)==row['setupMoves']
        rows.append({'stage':row['stage'],'blocked':blocked,**actual,'matches':True})
result={'method':'Independent Python rules and legal setup derivation; exhaustive graphs for first 21 stages, with/without one ordinary empty. Compare completion, state count, exact shortest length and dead-state count against TypeScript audit. Not a human playtest.','checked':len(rows),'allMatched':True,'rows':rows}
Path('docs/audits/campaign-balance-47/independent.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({'checked':len(rows),'allMatched':True}))
