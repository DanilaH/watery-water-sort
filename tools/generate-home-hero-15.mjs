// Original title artwork, using the game's silhouette and horizontal liquid surfaces.
import fs from 'node:fs';
import {vesselPolygon,surface,clip,LIQUID_FILL} from '../src/game/geometry.ts';
const fmt=n=>n.toFixed(2),points=p=>p.map(p=>`${fmt(p.x)},${fmt(p.y)}`).join(' ');
let svg='<svg class="home-hero" viewBox="0 0 300 270" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs><linearGradient id="hero-glass"><stop stop-color="#d3f5ff" stop-opacity=".3"/><stop offset=".32" stop-color="#e7fbff" stop-opacity=".04"/><stop offset="1" stop-color="#d3f5ff" stop-opacity=".3"/></linearGradient>';
for(const [id,a,b,c]of [['blue','#22b2e5','#4ee5f4','#189aca'],['purple','#9652d9','#cb89ff','#9d57e2'],['orange','#ed9d1e','#ffd149','#e7a51d']])svg+=`<linearGradient id="hero-${id}"><stop stop-color="${a}"/><stop offset=".35" stop-color="${b}"/><stop offset="1" stop-color="${c}"/></linearGradient>`;
svg+='</defs><ellipse cx="150" cy="246" rx="90" ry="5" fill="#0a1b4f" opacity=".12"/>';
for(const [x,y,deg,layers]of [[83,58,-14,['blue','purple']],[215,66,13,['purple','orange']],[150,40,0,['blue','blue','blue']]]){
 const a=deg*Math.PI/180,c=Math.cos(a),s=Math.sin(a),transform=p=>({x:x+p.x*c-p.y*s,y:y+p.x*s+p.y*c}),poly=vesselPolygon(48,181).map(transform);
 svg+=`<polygon points="${points(poly)}" fill="url(#hero-glass)"/>`;
 for(let i=0;i<layers.length;i++){
  if(layers[i]===layers[i+1])continue;let first=i;while(first>0&&layers[first-1]===layers[i])first--;
  const low=surface(poly,first/4*LIQUID_FILL),high=surface(poly,(i+1)/4*LIQUID_FILL),layer=clip(clip(poly,low,false),high,true);svg+=`<polygon points="${points(layer)}" fill="url(#hero-${layers[i]})"/>`;
  if(i===layers.length-1){const edge=layer.filter(p=>Math.abs(p.y-high)<.1),left=Math.min(...edge.map(p=>p.x)),right=Math.max(...edge.map(p=>p.x));svg+=`<ellipse cx="${fmt((left+right)/2)}" cy="${fmt(high)}" rx="${fmt((right-left)/2)}" ry="3" fill="white" fill-opacity=".3"/>`;}
 }
 svg+=`<polygon class="hero-outline" points="${points(poly)}" stroke="#d9eeff" stroke-width="2"/><ellipse class="hero-outline" cx="${x}" cy="${y}" rx="24" ry="3.2" transform="rotate(${deg} ${x} ${y})" stroke="#edf9ff" stroke-width="1.6"/>`;
 const h1=transform({x:-18,y:12}),h2=transform({x:-18,y:130});svg+=`<path d="M${fmt(h1.x)} ${fmt(h1.y)}L${fmt(h2.x)} ${fmt(h2.y)}" stroke="white" stroke-opacity=".5" stroke-width="3" stroke-linecap="round"/>`;
}
svg+='<path d="M120 17l2-7 2 7 7 2-7 2-2 7-2-7-7-2zM192 28l1.5-5 1.5 5 5 1.5-5 1.5-1.5 5-1.5-5-5-1.5z" fill="#b8deff" opacity=".8"/></svg>';
fs.writeFileSync('docs/design-15/home-hero.svg',svg+'\n');
