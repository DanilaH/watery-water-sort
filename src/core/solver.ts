import { type Board, type Move, apply, completeTube, moves, won } from './rules';
export type Result = { status: 'FOUND'; path: Move[]; nodes: number } | { status: 'UNKNOWN' | 'UNSOLVABLE'; nodes: number };
// Only tube permutation is canonicalized. Paths retain concrete tube indices.
const key = (b: Board) => b.map(t => t.join('')).sort().join('|');
export function solve(initial: Board, maxNodes = 200_000, maxMs = 750): Result {
  const start = performance.now(), seen = new Set<string>();
  const stack: { b: Board; path: Move[] }[] = [{ b: initial, path: [] }];
  let nodes = 0;
  while (stack.length) {
    if (nodes >= maxNodes || performance.now() - start >= maxMs) return { status: 'UNKNOWN', nodes };
    const { b, path } = stack.pop()!;
    const k = key(b); if (seen.has(k)) continue; seen.add(k); nodes++;
    if (won(b)) return { status: 'FOUND', path, nodes };
    const candidates = moves(b).map(m => ({ m, score: (b[m.to].length ? 10 : 0) + (b[m.from].length === m.amount ? 4 : 0) - (completeTube(b[m.from]) ? 20 : 0) }));
    candidates.sort((a, z) => a.score - z.score);
    for (const { m } of candidates) {
      const next = apply(b, m); if (!seen.has(key(next))) stack.push({ b: next, path: [...path, m] });
    }
  }
  return { status: 'UNSOLVABLE', nodes };
}
