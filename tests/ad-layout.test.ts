import {test,expect,vi,beforeEach} from 'vitest';
const bridge=vi.hoisted(()=>({banner:vi.fn(),show:vi.fn(),prepare:vi.fn().mockResolvedValue({}),addListener:vi.fn().mockResolvedValue({remove:async()=>{}})}));
vi.mock('@capacitor/core',()=>({Capacitor:{isNativePlatform:()=>true},registerPlugin:()=>bridge}));
import {Ads} from '../src/platform/ads';
const style=()=>{const map=new Map<string,string>();return {setProperty:(k:string,v:string)=>map.set(k,v),getPropertyValue:(k:string)=>map.get(k)??''};};
beforeEach(()=>{vi.stubGlobal('ResizeObserver',class{observe(){}});vi.stubGlobal('requestAnimationFrame',()=>1);vi.stubGlobal('innerWidth',390);vi.stubGlobal('innerHeight',844);vi.stubGlobal('window',{addEventListener(){}});bridge.banner.mockReset();});
function setup(){const slotStyle=style(),appStyle=style(),rect={x:16,y:760,width:358,height:60};vi.stubGlobal('document',{hidden:false,addEventListener(){},getElementById:()=>({style:appStyle})});const slot={style:slotStyle,getBoundingClientRect:()=>rect} as unknown as HTMLElement;return {ads:new Ads(slot),slotStyle,appStyle,rect};}
test('preflight measures while hidden, and a placed banner does not shrink its stable reservation',async()=>{
 const {ads,slotStyle,appStyle}=setup();bridge.banner.mockResolvedValue({heightCss:61,status:'reserve'});await (ads as any).update();expect(slotStyle.getPropertyValue('--banner-height')).toBe('61px');expect(appStyle.getPropertyValue('--banner-height')).toBe('61px');ads.banner(true);bridge.banner.mockResolvedValue({heightCss:60,status:'placed'});await (ads as any).update();expect(slotStyle.getPropertyValue('--banner-height')).toBe('61px');ads.banner(false);await (ads as any).update();expect(slotStyle.getPropertyValue('--banner-height')).toBe('61px');
});
test('orientation starts a new reservation instead of retaining a tall portrait banner forever',async()=>{
 const {ads,slotStyle,rect}=setup();bridge.banner.mockResolvedValue({heightCss:90,status:'reserve'});await (ads as any).update();expect(slotStyle.getPropertyValue('--banner-height')).toBe('90px');vi.stubGlobal('innerWidth',844);vi.stubGlobal('innerHeight',390);rect.width=812;bridge.banner.mockResolvedValue({heightCss:50,status:'placed'});await (ads as any).update();expect(slotStyle.getPropertyValue('--banner-height')).toBe('50px');
});
test('late geometry from a previous visibility epoch cannot resize the new scene',async()=>{
 const {ads,slotStyle}=setup();let finish!:(v:any)=>void;bridge.banner.mockImplementation(()=>new Promise(r=>finish=r));const pending=(ads as any).update();ads.banner(true);finish({heightCss:80,status:'reserve'});await pending;expect(slotStyle.getPropertyValue('--banner-height')).toBe('');
});
test('native failure does not reject the controller update or fabricate a reservation',async()=>{
 const {ads,slotStyle}=setup();bridge.banner.mockRejectedValue(Error('No fill'));await expect((ads as any).update()).resolves.toBeUndefined();expect(slotStyle.getPropertyValue('--banner-height')).toBe('');
});

test('synchronous or asynchronous fullscreen bridge failure returns a failed result',async()=>{const {ads}=setup();bridge.show.mockImplementation(()=>{throw Error('Missing plugin')});await expect(ads.show()).resolves.toEqual({status:'failed'});bridge.show.mockRejectedValue(Error('Offline'));await expect(ads.show()).resolves.toEqual({status:'failed'});});
