export type Board = number[][];
export type Move = { from: number; to: number; amount: number; color: number };
export const CAPACITY = 4;
export const clone = (b: Board): Board => b.map(t => [...t]);
export function moveFor(b: Board, from: number, to: number): Move | null {
  const a = b[from], z = b[to];
  if (from === to || !a?.length || !z || z.length >= CAPACITY) return null;
  const color = a[a.length - 1];
  if (z.length && z[z.length - 1] !== color) return null;
  let group = 1;
  while (group < a.length && a[a.length - 1 - group] === color) group++;
  return { from, to, color, amount: Math.min(group, CAPACITY - z.length) };
}
export function apply(b: Board, m: Move): Board {
  const valid = moveFor(b, m.from, m.to);
  if (!valid || valid.amount !== m.amount || valid.color !== m.color) throw new Error('Illegal move');
  const next = clone(b);
  next[m.from].splice(-m.amount); next[m.to].push(...Array(m.amount).fill(m.color));
  return next;
}
export function reverse(b: Board, m: Move): Board {
  const next = clone(b), a = next[m.from], z = next[m.to];
  if (!a || !z || a.length + m.amount > 4 || z.length < m.amount || !z.slice(-m.amount).every(c => c === m.color)) throw new Error('Invalid history');
  z.splice(-m.amount); a.push(...Array(m.amount).fill(m.color)); return next;
}
export const completeTube = (t: number[]) => t.length === 4 && t.every(c => c === t[0]);
export const won = (b: Board) => b.some(t => t.length) && b.every(t => !t.length || completeTube(t)) && validBoard(b);
export function validBoard(value: unknown): value is Board {
  if (!Array.isArray(value) || value.length < 4 || value.length > 11) return false;
  const counts = new Map<number, number>();
  for (const t of value) {
    if (!Array.isArray(t) || t.length > 4) return false;
    for (const c of t) {
      if (!Number.isInteger(c) || c < 0 || c > 7) return false;
      counts.set(c, (counts.get(c) ?? 0) + 1);
    }
  }
  return counts.size >= 2 && [...counts.values()].every(n => n === 4);
}
export function moves(b: Board): Move[] {
  return b.flatMap((_, from) => b.flatMap((__, to) => { const m = moveFor(b, from, to); return m ? [m] : []; }));
}
