import { type Board, type Move, type Goals, goalList, goalAt, miniIndex, isMini, iceIndex, iceOpen, transition, sealedTube, moves, won } from './rules';
export type Result = { status: 'FOUND'; path: Move[]; nodes: number } | { status: 'UNKNOWN' | 'UNSOLVABLE'; nodes: number };
// Only ordinary tube permutations are canonicalized. The fixed goal retains its identity.
const key = (b:Board,goal?:Goals) => goalList(goal).map(g=>`${g.index}:${g.color}:${b[g.index].join('')}`).join(';')+'@'+(miniIndex(goal)===undefined?'':b[miniIndex(goal)!].join(''))+'!'+(iceIndex(goal)===undefined?'':Number(iceOpen(goal))+':'+b[iceIndex(goal)!].join(''))+'#'+b.filter((_,i)=>!goalAt(goal,i)&&!isMini(goal,i)&&i!==iceIndex(goal)).map(t=>t.join('')).sort().join('|');
export function solve(initial: Board, maxNodes = 200_000, maxMs = 750, goal?:Goals): Result {
  const start = performance.now(), seen = new Set<string>();
  const stack: { b: Board; path: Move[];rules?:Goals }[] = [{ b: initial, path: [],rules:goal }];
  let nodes = 0;
  while (stack.length) {
    if (nodes >= maxNodes || performance.now() - start >= maxMs) return { status: 'UNKNOWN', nodes };
    const { b, path, rules } = stack.pop()!;
    const k = key(b,rules); if (seen.has(k)) continue; seen.add(k); nodes++;
    if (won(b,rules)) return { status: 'FOUND', path, nodes };
    const candidates = moves(b,rules).map(m => ({ m, score: (goalAt(rules,m.to)?30:b[m.to].length ? 10 : 0) + (b[m.from].length === m.amount ? 4 : 0) - (sealedTube(b,m.from,rules) ? 20 : 0) }));
    candidates.sort((a, z) => a.score - z.score);
    for (const { m } of candidates) {
      const next=transition(b,m,rules);if(!seen.has(key(next.board,next.rules)))stack.push({b:next.board,path:[...path,m],rules:next.rules});
    }
  }
  return { status: 'UNSOLVABLE', nodes };
}
