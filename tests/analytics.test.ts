import {test,expect,vi} from 'vitest';
const bridge=vi.hoisted(()=>({event:vi.fn()}));
vi.mock('@capacitor/core',()=>({Capacitor:{isNativePlatform:()=>true},registerPlugin:()=>bridge}));
import {Analytics} from '../src/platform/analytics';
const data={level:'water-003@1',stage:3,moves:2,extra:false,revision:2};
test('failed analytics never throws and retains only a bounded diagnostic history',async()=>{
 bridge.event.mockRejectedValue(Error('Offline'));const a=new Analytics();for(let i=0;i<300;i++)a.emit('undo',{...data,moves:i});expect(a.recent).toHaveLength(100);expect(a.recent.at(-1)?.data.moves).toBe(299);await Promise.resolve();await Promise.resolve();
});
test('a stalled bridge has a bounded number of in-flight calls',()=>{
 bridge.event.mockReset().mockImplementation(()=>new Promise(()=>{}));const a=new Analytics();for(let i=0;i<100;i++)a.emit('hint_request',data);expect(bridge.event).toHaveBeenCalledTimes(8);expect(a.recent).toHaveLength(100);
});
test('even a synchronous bridge failure does not reach gameplay',()=>{bridge.event.mockImplementation(()=>{throw Error('No bridge');});const a=new Analytics();expect(()=>a.emit('level_start',data)).not.toThrow();});

test('only the declared scalar event fields enter diagnostics or the bridge',()=>{bridge.event.mockResolvedValue({});const a=new Analytics();a.emit('undo',{...data,board:[[1,2]],token:'private'} as typeof data);expect(a.recent[0].data).toEqual(data);expect(bridge.event.mock.calls.at(-1)?.[0].data).toEqual(data);});
