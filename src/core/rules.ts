export type Board = number[][];
export type Move = { from: number; to: number; amount: number; color: number };
export const CAPACITY = 4;
export type Goal={index:number;color:number;capacity:8};
export const capacityAt=(goal:Goal|undefined,index:number)=>goal?.index===index?goal.capacity:CAPACITY;
export const validGoal=(goal:Goal|undefined,count:number)=>goal===undefined||!!goal&&Number.isInteger(goal.index)&&goal.index>=0&&goal.index<count&&Number.isInteger(goal.color)&&goal.color>=0&&goal.color<8&&goal.capacity===8;
export const clone = (b: Board): Board => b.map(t => [...t]);
export function moveFor(b: Board, from: number, to: number, goal?:Goal): Move | null {
  const a = b[from], z = b[to];
  if (from === to || goal?.index===from || !a?.length || !z || z.length >= capacityAt(goal,to)) return null;
  const color = a[a.length - 1];
  if (goal?.index===to&&color!==goal.color || z.length && z[z.length - 1] !== color) return null;
  let group = 1;
  while (group < a.length && a[a.length - 1 - group] === color) group++;
  return { from, to, color, amount: Math.min(group, capacityAt(goal,to) - z.length) };
}
export function apply(b: Board, m: Move, goal?:Goal): Board {
  const valid = moveFor(b, m.from, m.to, goal);
  if (!valid || valid.amount !== m.amount || valid.color !== m.color) throw new Error('Illegal move');
  const next = clone(b);
  next[m.from].splice(-m.amount); next[m.to].push(...Array(m.amount).fill(m.color));
  return next;
}
export function reverse(b: Board, m: Move, goal?:Goal): Board {
  const next = clone(b), a = next[m.from], z = next[m.to];
  if (!a || !z || goal?.index===m.from || a.length + m.amount > capacityAt(goal,m.from) || z.length < m.amount || !z.slice(-m.amount).every(c => c === m.color)) throw new Error('Invalid history');
  z.splice(-m.amount); a.push(...Array(m.amount).fill(m.color)); return next;
}
export const completeTube = (t: number[],capacity=4) => t.length === capacity && t.every(c => c === t[0]);
/** Four units of the goal colour in a small vessel still have to reach the large goal. */
export const sealedTube=(b:Board,index:number,goal?:Goal)=>completeTube(b[index],capacityAt(goal,index))&&(!goal||index===goal.index||b[index][0]!==goal.color);
export const won = (b: Board,goal?:Goal) => (!goal||validGoal(goal,b.length)&&sealedTube(b,goal.index,goal)) && b.some(t => t.length) && b.every((t,i) => !t.length || sealedTube(b,i,goal)) && validBoard(b,goal);
export function validBoard(value: unknown,goal?:Goal): value is Board {
  if (!Array.isArray(value) || value.length < 4 || value.length > 11 || !validGoal(goal,value.length)) return false;
  const counts = new Map<number, number>();
  for (const [index,t] of value.entries()) {
    if (!Array.isArray(t) || t.length > capacityAt(goal,index)) return false;
    for (const c of t) {
      if (goal?.index===index&&c!==goal.color || !Number.isInteger(c) || c < 0 || c > 7) return false;
      counts.set(c, (counts.get(c) ?? 0) + 1);
    }
  }
  return counts.size >= 2 && (!goal||counts.has(goal.color)) && [...counts].every(([color,n]) => n === (goal?.color===color?8:4));
}
export function moves(b: Board,goal?:Goal): Move[] {
  return b.flatMap((_, from) => b.flatMap((__, to) => { const m = moveFor(b, from, to,goal); return m ? [m] : []; }));
}
