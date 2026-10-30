import {describe,it,expect} from 'vitest';
import {area,vesselPolygon,LIQUID_FILL} from '../src/game/geometry';
import {liquidMesh,liquidBand,liquidContour,boundaryY} from '../src/game/liquidSurface';
describe('layered liquid interfaces',()=>{
 it('preserves each colour volume, with no gaps, at both wave directions and near-empty levels',()=>{
  for(const [width,height]of [[26,91],[54,218],[68,390]])for(const units of [[1,1,1,1],[.03,.2,1,2],[.001,.003,.01,.02]])for(const displacement of [-3,-1,1,3]){
   const poly=vesselPolygon(width,height),capacity=4,fractions=[0];for(const amount of units)fractions.push(fractions.at(-1)!+amount/capacity*LIQUID_FILL);
   const mesh=liquidMesh(poly,fractions,displacement,height),full=area(poly);let total=0;
   for(let i=0;i<units.length;i++){const actual=mesh.columns.reduce((s,c)=>s+area(liquidBand(mesh,c,i,i+1)),0);expect(Math.abs(actual/full-(fractions[i+1]-fractions[i]))).toBeLessThan(.0002);total+=actual;expect(Math.abs(area(liquidContour(mesh,i,i+1))-actual)).toBeLessThan(.00001);
    for(const c of mesh.columns)for(const x of [c.left,c.right])expect(boundaryY(mesh,mesh.boundaries[i],x)+1e-5).toBeGreaterThanOrEqual(boundaryY(mesh,mesh.boundaries[i+1],x));
   }
   expect(Math.abs(total/full-fractions.at(-1)!)).toBeLessThan(.0002);
  }
 });
 it('keeps the bottom fixed, moves internal boundaries and settles continuously to flat layers',()=>{
  const poly=vesselPolygon(54,218),fractions=[0,.2175,.435,.6525,.87],moving=liquidMesh(poly,fractions,2,218),quiet=liquidMesh(poly,fractions,0,218),almost=liquidMesh(poly,fractions,.0001,218);
  expect(moving.boundaries[0].amplitude).toBe(0);expect(moving.boundaries.slice(1).every(b=>b.amplitude>0)).toBe(true);expect(moving.boundaries[1].amplitude).toBeLessThan(moving.boundaries.at(-1)!.amplitude);
  for(let i=0;i<fractions.length;i++)expect(Math.abs(boundaryY(quiet,quiet.boundaries[i],-20)-boundaryY(almost,almost.boundaries[i],-20))).toBeLessThan(.001);
 });
});
