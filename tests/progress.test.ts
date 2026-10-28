import {test,expect} from 'vitest';
import {fresh,levels,moved,restarted,levelKey} from '../src/core/session';
import {totalStars} from '../src/core/progress';
test('star total derives from proven best records and keeps legacy completions at one',()=>{
 const legacy=fresh();legacy.completed=[levels[1].id];expect(totalStars(legacy)).toBe(1);
 const win=levels[0].witness.reduce((s,m)=>moved(s,m),legacy);expect(totalStars(win)).toBe(4);
 const replay=levels[0].witness.reduce((s,m)=>moved(s,m),restarted(win));expect(totalStars(replay)).toBe(4);
 expect(totalStars(restarted(replay))).toBe(4);expect(replay.best?.[levelKey(0)]?.history).toHaveLength(3);
});
