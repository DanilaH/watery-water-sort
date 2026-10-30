import {describe,it,expect} from 'vitest';
import {stepLiquid,streamEnvelope,completionCork,FILL_BEATS} from '../src/game/liquid';
import {layout,planPour,pourPose} from '../src/game/geometry';
describe('continuous liquid response',()=>{
 it('rests without input and retains displacement when a new impulse arrives',()=>{
  const s={x:0,v:0};stepLiquid(s,1);expect(s).toEqual({x:0,v:0});s.v+=38;stepLiquid(s,.04);const before=s.x;s.v+=38;expect(s.x).toBe(before);expect(s.v).toBeGreaterThan(38);
 });
 it('decays without a phase reset and gives the same free motion at different frame rates',()=>{
  const a={x:1.5,v:27},b={...a};for(let i=0;i<60;i++)stepLiquid(a,1/60);for(let i=0;i<144;i++)stepLiquid(b,1/144);
  expect(a.x).toBeCloseTo(b.x,10);expect(a.v).toBeCloseTo(b.v,10);stepLiquid(a,2);expect(Math.abs(a.x)+Math.abs(a.v)).toBeLessThan(.001);
 });
 it('starts and ends the stream at zero width with no endpoint speed jump in either mode',()=>{
  for(const flow of [131,313]){expect(streamEnvelope(0,flow)).toBe(0);expect(streamEnvelope(flow,flow)).toBe(0);expect(streamEnvelope(flow/2,flow)).toBe(1);expect(streamEnvelope(.001,flow)).toBeLessThan(1e-10);expect(streamEnvelope(flow-.001,flow)).toBeLessThan(1e-10);}
 });
 it('meets lift, flow and return with continuous position and no artificial travel kick',()=>{
  const [a,b]=layout(390,520,4),plan=planPour(a,b,390,520,4,2),at=(t:number)=>pourPose(a,b,t,390,520,-17,plan);
  for(const t of [0,.25,.73,1]){const left=at(Math.max(0,t-1e-6)),p=at(t),right=at(Math.min(1,t+1e-6));for(const key of ['x','y','angle'] as const){expect(Math.abs(p[key]-left[key])).toBeLessThan(.001);expect(Math.abs(right[key]-p[key])).toBeLessThan(.001);}}
 });
});

it('cork apex and landing match the tactile beats, with smooth joins',()=>{
 expect(completionCork(FILL_BEATS[1]).drop).toBe(-28);expect(completionCork(FILL_BEATS[2]).drop).toBeCloseTo(0,8);expect(completionCork(750).drop).toBeCloseTo(0,8);
 for(const t of [0,260,570,750]){const a=completionCork(t-.001),b=completionCork(t),c=completionCork(t+.001);expect(Math.abs(b.drop-a.drop)).toBeLessThan(.00001);expect(Math.abs(c.drop-b.drop)).toBeLessThan(.00001);}
 for(const t of [120,210]){const a=completionCork(t-.001),c=completionCork(t+.001);expect(Math.abs(c.opacity-a.opacity)).toBeLessThan(.00001);}
});
