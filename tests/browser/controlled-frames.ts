import type {Page} from '@playwright/test';
/** A paused clock plus explicit frames makes short animation phases independent of host GPU stalls. */
export async function advanceFrames(page:Page,sceneKey:string,milliseconds:number){
 for(let elapsed=0;elapsed<milliseconds;elapsed+=40){
  await page.clock.fastForward(40);
  await page.evaluate(key=>{const scene=(window as any)[key];if(!scene)throw Error('Scene not observed');scene.update();},sceneKey);
 }
}
