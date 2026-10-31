export type Board = number[][];
export type Move = { from: number; to: number; amount: number; color: number };
export const CAPACITY = 4;
export type Goal={index:number;color:number;capacity:8};
/** Legacy single-goal saves remain valid; new levels may declare two distinct receivers. */
export type Goals=Goal|readonly Goal[];
export const goalList=(goal?:Goals):readonly Goal[]=>goal===undefined?[]:Array.isArray(goal)?goal: [goal as Goal];
export const goalAt=(goal:Goals|undefined,index:number)=>goalList(goal).find(g=>g.index===index);
export const capacityAt=(goal:Goals|undefined,index:number)=>goalAt(goal,index)?.capacity??CAPACITY;
export const validGoal=(goal:Goals|undefined,count:number)=>goal===undefined||(()=>{
 const goals=goalList(goal);
 return goals.length>=1&&goals.length<=2&&goals.every(g=>!!g&&Number.isInteger(g.index)&&g.index>=0&&g.index<count&&Number.isInteger(g.color)&&g.color>=0&&g.color<8&&g.capacity===8)
  &&new Set(goals.map(g=>g.index)).size===goals.length&&new Set(goals.map(g=>g.color)).size===goals.length;
})();
export const clone = (b: Board): Board => b.map(t => [...t]);
export function moveFor(b: Board, from: number, to: number, goal?:Goals): Move | null {
  const a = b[from], z = b[to];
  if (from === to || goalAt(goal,from) || !a?.length || !z || z.length >= capacityAt(goal,to)) return null;
  const color = a[a.length - 1];
  if (goalAt(goal,to)&&color!==goalAt(goal,to)!.color || z.length && z[z.length - 1] !== color) return null;
  let group = 1;
  while (group < a.length && a[a.length - 1 - group] === color) group++;
  return { from, to, color, amount: Math.min(group, capacityAt(goal,to) - z.length) };
}
export function apply(b: Board, m: Move, goal?:Goals): Board {
  const valid = moveFor(b, m.from, m.to, goal);
  if (!valid || valid.amount !== m.amount || valid.color !== m.color) throw new Error('Illegal move');
  const next = clone(b);
  next[m.from].splice(-m.amount); next[m.to].push(...Array(m.amount).fill(m.color));
  return next;
}
export function reverse(b: Board, m: Move, goal?:Goals): Board {
  const next = clone(b), a = next[m.from], z = next[m.to];
  if (!a || !z || goalAt(goal,m.from) || a.length + m.amount > capacityAt(goal,m.from) || z.length < m.amount || !z.slice(-m.amount).every(c => c === m.color)) throw new Error('Invalid history');
  z.splice(-m.amount); a.push(...Array(m.amount).fill(m.color)); return next;
}
export const completeTube = (t: number[],capacity=4) => t.length === capacity && t.every(c => c === t[0]);
/** Four units of the goal colour in a small vessel still have to reach the large goal. */
export const sealedTube=(b:Board,index:number,goal?:Goals)=>completeTube(b[index],capacityAt(goal,index))&&(!goalList(goal).some(g=>g.color===b[index][0])||!!goalAt(goal,index));
export const won = (b: Board,goal?:Goals) => validGoal(goal,b.length)&&goalList(goal).every(g=>sealedTube(b,g.index,goal))&&b.some(t=>t.length)&&b.every((t,i)=>!t.length||sealedTube(b,i,goal))&&validBoard(b,goal);
export function validBoard(value: unknown,goal?:Goals): value is Board {
  if (!Array.isArray(value) || value.length < 4 || value.length > 11 || !validGoal(goal,value.length)) return false;
  const counts = new Map<number, number>();
  for (const [index,t] of value.entries()) {
    if (!Array.isArray(t) || t.length > capacityAt(goal,index)) return false;
    for (const c of t) {
      if (goalAt(goal,index)&&c!==goalAt(goal,index)!.color || !Number.isInteger(c) || c < 0 || c > 7) return false;
      counts.set(c, (counts.get(c) ?? 0) + 1);
    }
  }
  return counts.size >= 2 && goalList(goal).every(g=>counts.has(g.color)) && [...counts].every(([color,n]) => n === (goalList(goal).some(g=>g.color===color)?8:4));
}
export function moves(b: Board,goal?:Goals): Move[] {
  return b.flatMap((_, from) => b.flatMap((__, to) => { const m = moveFor(b, from, to,goal); return m ? [m] : []; }));
}
