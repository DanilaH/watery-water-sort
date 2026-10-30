/** A continuous damped surface mode. New impulses change velocity, never phase/position. */
export type LiquidMotion={x:number;v:number};
export function stepLiquid(s:LiquidMotion,dt:number,force=0){
 const decay=5.2,omega=23,damped=Math.sqrt(omega*omega-decay*decay),equilibrium=force/(omega*omega);
 const x=s.x-equilibrium,b=(s.v+decay*x)/damped,e=Math.exp(-decay*dt),c=Math.cos(damped*dt),sin=Math.sin(damped*dt);
 s.x=equilibrium+e*(x*c+b*sin);
 s.v=e*((-decay*x+b*damped)*c+(-decay*b-x*damped)*sin);
}
export const smooth=(t:number)=>{const u=Math.max(0,Math.min(1,t));return u*u*u*(u*(u*6-15)+10);};
/** Width follows flow rate and reaches zero with a flat tangent at both ends. */
export function streamEnvelope(elapsed:number,flow:number){const u=Math.max(0,Math.min(1,elapsed/flow));return smooth(u/.16)*smooth((1-u)/.22);}
