import { type Board, type Move, type Goal, apply, sealedTube, moves, won } from './rules';
export type Result = { status: 'FOUND'; path: Move[]; nodes: number } | { status: 'UNKNOWN' | 'UNSOLVABLE'; nodes: number };
// Only ordinary tube permutations are canonicalized. The fixed goal retains its identity.
const key = (b: Board,goal?:Goal) => (goal?b[goal.index].join('')+'#':'')+(goal?b.filter((_,i)=>i!==goal.index):b).map(t => t.join('')).sort().join('|');
export function solve(initial: Board, maxNodes = 200_000, maxMs = 750, goal?:Goal): Result {
  const start = performance.now(), seen = new Set<string>();
  const stack: { b: Board; path: Move[] }[] = [{ b: initial, path: [] }];
  let nodes = 0;
  while (stack.length) {
    if (nodes >= maxNodes || performance.now() - start >= maxMs) return { status: 'UNKNOWN', nodes };
    const { b, path } = stack.pop()!;
    const k = key(b,goal); if (seen.has(k)) continue; seen.add(k); nodes++;
    if (won(b,goal)) return { status: 'FOUND', path, nodes };
    const candidates = moves(b,goal).map(m => ({ m, score: (goal?.index===m.to?30:b[m.to].length ? 10 : 0) + (b[m.from].length === m.amount ? 4 : 0) - (sealedTube(b,m.from,goal) ? 20 : 0) }));
    candidates.sort((a, z) => a.score - z.score);
    for (const { m } of candidates) {
      const next = apply(b, m,goal); if (!seen.has(key(next,goal))) stack.push({ b: next, path: [...path, m] });
    }
  }
  return { status: 'UNSOLVABLE', nodes };
}
