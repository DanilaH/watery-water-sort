import {fieldHeight} from './game/geometry';
import {extraCount,scoreMoves,type Shuffle} from './core/assist';
import {revealStartup} from './platform/startup';
import {playerMoves} from './core/goalStart';
import {Ads} from './platform/ads';
import {ECONOMY,settleEconomy,ownHint,adviceKey,creditCoins,purchaseBoost,spendBoost,boostStock,parseTubeTarget,type Boost} from './core/economy';
import {CoinReward} from './game/CoinReward';
import {Analytics,type EventName,type EventData} from './platform/analytics';
import {HintRoute} from './core/hintRoute';
import {campaign,stageNumber,continuation,available as levelAvailable} from './core/campaign';
import {hasUnknown} from './core/knowledge';
import {visibleHint} from './core/visibleHint';
import Phaser from 'phaser';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import './style.css';
import './ui29.css';
import './finish30.css';
import './ambient32.css';
import './economy42.css';
import './play48.css';
import './entry53.css';
import './pause55.css';
import './motion56.css';
import {mountAmbient} from './game/Ambient';
import {mountHomeHero} from './game/HomeHero';
import { Sound } from './audio/sound';
import { WaterScene } from './game/WaterScene';
import { goalList, goalAt, isMini, iceIndex, iceOpen, moveFor, sealedTube, won, moves, type Move } from './core/rules';
import { attempt, levels, moved, undone, seededRestart, startLatest, activeKey, levelByKey, levelFor, levelGoals, offerExtra, displaySlots, grantExtra, goalFor, knowledgeFor, reshuffled, type Save } from './core/session';
import { SaveStore } from './platform/storage';
import {stars,targets} from './core/ratings';
import {Rewarded,type Receipt} from './platform/rewarded';
import {THEMES,themeFor} from './core/themes';
import {positionKey,type Result} from './core/solver';
import {TouchFeedback,type Touch} from './platform/haptics';
import {renderVictoryTitle,renderResultStars,renderPotentialStars} from './game/VictoryUI';
import {StarReward} from './game/StarReward';
import {totalStars,earnedStars} from './core/progress';
import {isHard} from './core/difficulty';
const touch=new TouchFeedback();
const ads=new Ads(document.getElementById('banner-slot')!);
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const ambient=mountAmbient();
const $=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T;
const dialog=$<HTMLDialogElement>('dialog'),content=$('dialog-content'),audio=new Sound(),store=new SaveStore(()=>localStorage);
const reward=new StarReward($('earned-stars'),[$('star-total'),$('home-star-total')],index=>{audio.collect(index);haptic('collect');});
const coinReward=new CoinReward($('earned-coins'),$('wallet'),index=>{audio.collect(index);haptic('collect');});
let pendingCoins=0,interstitialBusy=false;
let pendingNext:{key:string;next:number|undefined;ready:boolean}|undefined;
let pendingStars:{before:number;delta:number;earned:number;total:number}|undefined;
const loaded=store.load();let state=settleEconomy(loaded.state),locked=loaded.corrupt||loaded.unavailable;
audio.setEnabled(state.settings.sound);if(state.settings.sound)void audio.load();
let recoveryNotice=loaded.recovered?'Откат к резервной копии':'';
let homeHero:Awaited<ReturnType<typeof mountHomeHero>>;
const homeHeroReady=mountHomeHero().then(hero=>{homeHero=hero;paint();});
const scene=new WaterScene('water');
// Downsample on 1× displays; retain native detail on common 2.5–3× phones.
const density=Math.min(3,Math.max(2,devicePixelRatio));
scene.setViewport($('board').clientWidth,$('board').clientHeight,density);
const game=new Phaser.Game({input:{touch:{capture:false}},type:Phaser.AUTO,parent:'board',transparent:true,antialias:true,scale:{mode:Phaser.Scale.NONE,width:Math.round($('board').clientWidth*density),height:Math.round($('board').clientHeight*density)},scene:[scene],audio:{noAudio:true}});
let previousSize='';
let entryRequest:string|undefined;
let mixActive=false,assistFrame=0,assistRequestId=0;
let assistWorker:Worker|undefined,assistTimer:ReturnType<typeof setTimeout>|undefined;
let worker:Worker|undefined,requestId=0,searching=false,queued:Move|null=null,lastMove:Move|null=null,kind:'pour'|'undo'='pour',newColor=false,pendingIce:number|null=null,pendingReveal=false;
let deadRevision:number|null=null;
const checkedPositions=new Map<string,Result['status']>();
let stallWorker:Worker|undefined,stallTimer:number|undefined,checkingPosition:string|undefined;
let signaledStall:string|undefined;
const stallKey=()=>activeKey(state)+':'+positionKey(attempt(state).board,goalFor(state));
function cancelStall(){stallWorker?.terminate();stallWorker=undefined;checkingPosition=undefined;clearTimeout(stallTimer);}
function checkPosition(){
 const a=attempt(state),rules=goalFor(state),key=stallKey();
 if(checkingPosition===key)return;
 cancelStall();
 // An untouched level has an authored solution. Check changed or restored boards proactively.
 if(atHome||blockers.size||(!playerMoves(a)&&!a.shuffles?.length)||checkedPositions.has(key)||hintRoute.get(a.board,rules)||!moves(a.board,rules).length||won(a.board,rules))return;
 try{
  const probe=new Worker(new URL('./core/stall.worker.ts',import.meta.url),{type:'module'});
  stallWorker=probe;checkingPosition=key;
  probe.onmessage=({data:status}:MessageEvent<Result['status']>)=>{
   if(stallWorker!==probe)return;cancelStall();
   if(checkedPositions.size>=256)checkedPositions.delete(checkedPositions.keys().next().value!);
   if(status!=='UNKNOWN')checkedPositions.set(key,status);
   if(!blockers.size&&!scene.busy&&stallKey()===key){paint();message(guidance());}
  };
  probe.onerror=e=>{e.preventDefault();if(stallWorker===probe)cancelStall();};
  stallTimer=window.setTimeout(()=>{if(stallWorker===probe)cancelStall();},1000);
  probe.postMessage({board:attempt(state).board,rules:goalFor(state)});
 }catch{cancelStall();}
}
function stuck(){
 const board=attempt(state).board,rules=goalFor(state);
 if(scene.busy||won(board,rules))return '';
 if(!moves(board,rules).length)return 'Нет доступных ходов · можно отменить ход или взять помощь';
 if(deadRevision===state.revision||checkedPositions.get(stallKey())==='UNSOLVABLE')return 'Решения нет · отмени ход или используй помощь';
 return '';
}

const hintRoute=new HintRoute();
const blockers=new Set<string>();
const analytics=new Analytics();let activeSince:number|undefined,activeMs=0;
function measureActive(){if(activeSince!==undefined){activeMs+=performance.now()-activeSince;activeSince=undefined;}}
function syncActive(){measureActive();if(!atHome&&!blockers.size&&!document.hidden)activeSince=performance.now();}
function track(name:EventName,extra:Partial<EventData>={},index=state.current){const a=attempt({...state,current:index});analytics.emit(name,{level:activeKey(state,index),stage:stageNumber(index),revision:state.revision,moves:playerMoves(a),extra:a.extra,active_ms:Math.round(activeMs+(activeSince===undefined?0:performance.now()-activeSince)),...extra});}
let atHome=true,rewardBusy=false,recoveringRewards=false;
const rewarded=new Rewarded();let pendingReceipt:Receipt|undefined;
const hasStarted=()=>Object.keys(state.attempts).length>0||state.completed.length>0;
function haptic(event:Touch='select',heavy=false){touch.enabled=state.settings.haptics!==false;touch.blocked=event==='ui'?[...blockers].some(b=>b!=='home'&&b!=='dialog'):blockers.size>0;touch.play(event,heavy);}
function updateCoach(){
 const a=attempt(state),index=state.current,rules=goalFor(state);
 scene.coachTube=null;
 if(atHome||blockers.size||scene.busy||scene.hintMove||playerMoves(a)||state.completed.includes(levelFor(state).id))return;
 if(index===0){
  const board=a.board;
  scene.coachTube=scene.selected===null?(levels[0].witness[0]?.from??null):moves(board,rules).find(m=>m.from===scene.selected&&board[m.to].length===0)?.to??null;
 }else if(scene.selected===null){
  if(index===campaign.find(i=>goalList(levelGoals(levels[i])).length>0))scene.coachTube=goalList(rules)[0]?.index??null;
  if(index===campaign.find(i=>iceIndex(levelGoals(levels[i]))!==undefined)&&!iceOpen(rules))scene.coachTube=iceIndex(rules)??null;
 }
}
function message(text:string,important=false){updateCoach();const value=important?text:recoveryNotice||text;$('status').textContent=value;$('objective').hidden=!!value||!goalFor(state)||!$('objective').textContent||document.body.classList.contains('finished');}
function guidance(){
 if(won(attempt(state).board,goalFor(state)))return '';
 if(queued)return 'Следующий ход выбран · фон — отмена';
 const dead=stuck();if(dead)return dead;
 if(scene.hintMove)return 'Перелей в колбу со стрелкой';
 if(scene.selected!==null)return scene.busy?'Следующий ход: выбери цель':state.current<2?'Выбери пустую или с тем же цветом сверху':'';
 if(state.current===34&&attempt(state).history.length===0&&!state.completed.includes(levels[34].id)&&hasUnknown(knowledgeFor(state)))return 'Открой цвета · отмена их не спрячет';
 if(playerMoves(attempt(state))===0&&!state.completed.includes(levelFor(state).id)){
  const rules=goalFor(state),index=state.current;
  if(index===campaign.find(i=>goalList(levelGoals(levels[i])).length>0))return 'В большую колбу собирай только её цвет';
  if(index===campaign.find(i=>iceIndex(levelGoals(levels[i]))!==undefined)&&!iceOpen(rules))return 'Собери полный цвет, чтобы растопить лёд';
 }
 if(state.current===0&&attempt(state).history.length===0)return 'Выбери цветную колбу, затем пустую';
 if(state.current<2)return 'Одинаковые верхние слои льются вместе';
 return '';
}
function cancelSearch(){worker?.terminate();worker=undefined;requestId++;searching=false;}
function clearIntent(){queued=null;scene.queuedMove=null;scene.selected=null;scene.hintMove=null;}
function interrupt(){cancelStall();mixActive=false;cancelAnimationFrame(assistFrame);$('board').classList.remove('mixing48');$('board').querySelectorAll('.shuffle-veil').forEach(e=>e.remove());if(assistWorker&&dialog.open){const h=content.querySelector('h2');if(h)h.textContent='Перемешивание отменено';const p=content.querySelector('.dialog-body p');if(p)p.textContent='Заряд сохранён.';}cancelAssist();pendingReveal=false;pendingIce=null;reward.cancel();coinReward.cancel();$('earned-coins').hidden=true;pendingCoins=0;pendingStars=undefined;scene.resetEffects();clearIntent();cancelSearch();audio.stop();scene.setBoard(attempt(state).board);}
function syncLoop(){document.body.dataset.gamePaused=String(blockers.size>0);if(!scene.ready)return;if(blockers.size)game.loop.sleep();else game.loop.wake();}
scene.onReady=()=>{paint();if(!completeEntry())syncLoop();};
function block(reason:string,on:boolean){measureActive();if(on){blockers.add(reason);interrupt();}else blockers.delete(reason);audio.block([...blockers].some(x=>x!=='dialog'&&x!=='home'));paint();syncLoop();syncActive();if(!on){completePendingNext();completeEntry();checkPosition();}}
function commit(next:Save){try{next=settleEconomy(next);store.write(next);state=next;recoveryNotice='';$('home-error').hidden=true;return true;}catch{track('save_error');paint();const error='Не удалось сохранить. Изменение не принято — попробуй ещё раз.';message(error,true);if(atHome&&!dialog.open){$('home-error').textContent=error;$('home-error').hidden=false;}if(dialog.open){const body=content.querySelector('.dialog-body');let note=body?.querySelector<HTMLElement>('[role=alert]');if(body&&!note){note=document.createElement('p');note.setAttribute('role','alert');body.prepend(note);}if(note)note.textContent=error;if(body)body.scrollTop=0;}return false;}}
const BOOST_UI={
 hint:{id:'hint',badge:'hint-count',pack:'3 подсказки хода',action:'Подсказать ход'},
 shuffle:{id:'shuffle',badge:'shuffle-count',pack:'3 перемешивания',action:'Перемешать'},
 tube:{id:'extra-tube',badge:'tube-count',pack:'3 колбы',action:'Добавить колбу'}
} as const;
function paint(){
 const a=attempt(state),finished=won(a.board,goalFor(state))&&!scene.busy;
 document.body.classList.toggle('home',atHome);$('home').hidden=!atHome;$('home').inert=!atHome;$('app').inert=atHome;
 homeHero?.setActive(atHome&&![...blockers].some(x=>x!=='home')&&!document.hidden,reduced.matches);
 ambient.setActive(!document.hidden&&![...blockers].some(x=>x!=='home')&&!reduced.matches);
 $('app').setAttribute('aria-hidden',String(atHome));
 $('home-play').textContent=entryRequest!==undefined?'Подготавливаем…':hasStarted()?'Продолжить':'Играть';
 $<HTMLButtonElement>('home-play').disabled=entryRequest!==undefined;$('home-play').setAttribute('aria-busy',String(entryRequest!==undefined));
 if(entryRequest===undefined)$('home-summary').textContent=hasStarted()?`Уровень ${stageNumber(state.current)}`:'Собери каждый цвет в свою колбу';
 const theme=themeFor(state.settings);document.body.dataset.theme=theme.id;
 document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')!.content=theme.color;
 scene.reduced=reduced.matches;scene.setKnowledge(knowledgeFor(state));touch.enabled=state.settings.haptics!==false;reward.setTotal(totalStars(state),pendingStars?.before);
 $('coins').textContent=$('home-coins').textContent=String(state.wallet!.coins);
 const dead=!!stuck(),freeAdvice=levelFor(state).colors<=2,ownedAdvice=state.wallet!.hintAdvice?.key===adviceKey(state);
 paintBoost('hint',state.wallet!.hints,{hidden:dead||freeAdvice,price:!dead&&!freeAdvice&&!ownedAdvice,label:dead?'Помощь в тупике':freeAdvice?'Подсказать ход · бесплатно':ownedAdvice?'Повторить подсказку бесплатно':undefined});
 $<HTMLButtonElement>('wallet').disabled=$<HTMLButtonElement>('home-wallet').disabled=rewardBusy||recoveringRewards||interstitialBusy;
 const adsAllowed=!atHome&&!blockers.size&&stageNumber(state.current)>2&&!document.hidden;document.body.classList.toggle('with-banner',ads.native&&stageNumber(state.current)>2);ads.banner(adsAllowed);
 $('star-capacity').textContent=`/ ${levels.length*3}`;
 $('hard-badge').hidden=!isHard(state.current);$('home-challenge').hidden=!isHard(state.current);$('home-play').classList.toggle('hard-level',isHard(state.current));
 scene.lockedExtra=false;scene.goal=goalFor(state);scene.slots=displaySlots(state);scene.setBoard(a.board);scene.symbols=state.settings.symbols;scene.light=theme.light;audio.setEnabled(state.settings.sound);
 document.body.classList.toggle('packed-board',displaySlots(state)>=10);document.body.classList.toggle('pouring',scene.busy);document.body.classList.toggle('dense-board',displaySlots(state)>10);document.body.classList.toggle('goal-board',goalList(goalFor(state)).length>0);document.body.classList.toggle('light',theme.light);document.body.classList.toggle('finished',finished);
 $('level-title').innerHTML=`<span>Уровень</span> <strong>${stageNumber(state.current)}</strong>`;$('moves').textContent=`Ходов: ${playerMoves(a)}`;
 ($('undo') as HTMLButtonElement).disabled=playerMoves(a)===0||mixActive||scene.arranging;
 ($('hint') as HTMLButtonElement).disabled=scene.busy||scene.arranging||mixActive||searching||finished;
 const objective=goalFor(state);
 const colourNames=['голубой','жёлтый','фиолетовый','зелёный','розовый','синий','лимонный','оранжевый'];
 $('board').setAttribute('aria-label','Игровое поле'+goalList(objective).map(g=>` · большая колба: ${colourNames[g.color]} цвет`).join(''));
 // Colour is carried by the receiver's liquid. Only the first ice encounter needs text.
 $('objective').textContent=iceIndex(objective)!==undefined&&!iceOpen(objective)&&state.current===levels.findIndex(l=>l.ice!==undefined)&&!state.completed.includes(levelFor(state).id)?'Собери цвет — лёд расколется':'';
 $('objective').hidden=finished||!$('objective').textContent||!!$('status').textContent;
 $('star-target').hidden=false;($('star-target') as HTMLButtonElement).disabled=scene.busy;renderPotentialStars($('star-target'),stars(activeKey(state),scoreMoves(a)));
 $('earned-stars').hidden=!finished;const earned=stars(activeKey(state),scoreMoves(a));if(!finished||!$('earned-stars').classList.contains('revealing-stars'))renderResultStars($('earned-stars'),earned);$('earned-stars').setAttribute('aria-label',`${earned} из 3 звёзд`);
 const extra=$('extra-tube');extra.hidden=levelFor(state).colors<=2;(extra as HTMLButtonElement).disabled=mixActive||scene.arranging||scene.busy||rewardBusy||recoveringRewards||!offerExtra(state)||finished;
 extra.title=extraCount(a)>=3?'Все 3 колбы уже добавлены':state.wallet!.tubes?'Добавить колбу':`Купить 3 колбы за ${ECONOMY.packPrice} монет`;
 paintBoost('tube',boostStock(state.wallet!,'tube'),{hidden:extraCount(a)>=3});paintBoost('shuffle',boostStock(state.wallet!,'shuffle'));
 $<HTMLButtonElement>('shuffle').disabled=mixActive||scene.arranging||scene.busy||rewardBusy||recoveringRewards||finished||!!assistWorker;
 $('continue').hidden=!finished;
 const noticeKey=dead?stallKey():undefined;
 if(!scene.busy&&!blockers.size&&!atHome&&noticeKey!==signaledStall){
  signaledStall=noticeKey;if(dead)scene.stallReaction();
 }
 $('rescue').hidden=!dead;$('notice-restart').hidden=!dead;
 $('notice').classList.toggle('is-stuck',dead);
 const recommended=dead?rescueChoice():undefined;
 for(const kind of ['shuffle','tube'] as const)$(BOOST_UI[kind].id).classList.toggle('rescue-highlight',kind===recommended);
 $('continue').textContent=continuation(state)===undefined?'К уровням →':'Дальше →';
 const starGoal=$('next-star-goal'),target=targets(activeKey(state));
 starGoal.hidden=!finished||earned===3;
 const scored=scoreMoves(a)-(a.setup??0),shortBy=Math.max(1,scoreMoves(a)-(earned===1?target.two:target.three));
 const moveWord=(n:number)=>n%100>=11&&n%100<=14?'ходов':n%10===1?'ход':n%10>=2&&n%10<=4?'хода':'ходов';
 starGoal.textContent=earned===3?'':`${scored} ${moveWord(scored)} · до ${earned+1} ★ не хватило ${shortBy} ${moveWord(shortBy)}`;
 $('finish-title').hidden=!finished;renderVictoryTitle($('finish-title'),continuation(state)===undefined?'Пройдено!':earned===3?'Идеально!':'Получилось!');
 if(finished)message('');
 // Measure only after all layout classes, result controls and labels are final.
 syncField();
}
function paintBoost(kind:Boost,count:number,options:{hidden?:boolean;price?:boolean;label?:string}={}){
 const ui=BOOST_UI[kind],button=$(ui.id),badge=$(ui.badge),showPrice=count===0&&options.price!==false;
 badge.hidden=!!options.hidden;badge.classList.toggle('is-price',showPrice&&!badge.hidden);badge.replaceChildren();
 if(showPrice){const coin=document.createElement('i');coin.className='coin-icon';coin.setAttribute('aria-hidden','true');const price=document.createElement('strong');price.textContent=String(ECONOMY.packPrice);badge.append(coin,price);}
 else badge.textContent=String(count);
 const label=options.label??(options.hidden&&kind==='tube'?'Все 3 колбы уже добавлены':showPrice?`Купить ${ui.pack} за ${ECONOMY.packPrice} монет`:ui.action);
 button.setAttribute('aria-label',label);button.title=label;
}
function parkControls(){for(const id of ['menu','restart','star-target','rescue'])$('park').append($(id));}
let fieldTransition:Animation|undefined;
function easeField(from:number,duration:number){
 fieldTransition?.cancel();if(!reduced.matches)fieldTransition=$('board').animate([{opacity:from},{opacity:1}],{duration,easing:'ease-out'});
}
function close(){if(interstitialBusy)return;if(rewardBusy){void rewarded.cancel().catch(()=>{});return;}if(locked)return;const resumeField=!atHome&&dialog.classList.contains('compact-pause');cancelAssist();dialog.close();parkControls();block('dialog',false);checkPosition();message(guidance());if(resumeField)easeField(.78,150);}
let panelBack:(()=>void)|undefined;
function dismissPanel(){if(rewardBusy||interstitialBusy||locked||!panelBack)close();else panelBack();}
let opener:DOMRect|undefined;
const uiClicks=new WeakSet<Event>();
function enterPanel(origin:DOMRect|undefined,duration:number,pack=false){
 content.getAnimations().forEach(a=>a.cancel());if(reduced.matches)return;
 const r=content.getBoundingClientRect(),limit=(n:number)=>Math.max(-18,Math.min(18,n*.14));
 const x=origin?limit(origin.x+origin.width/2-r.x-r.width/2):0;
 const y=origin?limit(origin.y+origin.height/2-r.y-r.height/2):8;
 const frames:Keyframe[]=[{opacity:pack?0:.45,transform:`translate(${x}px,${y}px)`},{opacity:1,transform:'none'}];
 if(pack)frames.splice(1,0,{opacity:1,transform:'translateY(-2px)',offset:.74});
 content.animate(frames,{duration,easing:'cubic-bezier(.2,.75,.25,1)'});
}
function modal(title:string,description:string,buttons:{label:string;action:()=>void;primary?:boolean}[],back?:()=>void){
 panelBack=back;entryRequest=undefined;pendingNext=undefined;
 block('dialog',true);parkControls();content.replaceChildren();dialog.classList.remove('compact-pause','pack-dialog','rescue-dialog','game-pause');
 const header=document.createElement('header');header.className='dialog-header';
 const h=document.createElement('h2');h.textContent=title;h.tabIndex=-1;header.append(h);
 const x=document.createElement('button');x.className='dialog-close gel-button';x.textContent=back?'‹':'×';x.setAttribute('aria-label',back?'Назад':'Закрыть');x.onclick=dismissPanel;x.hidden=locked;header.append(x);
 const body=document.createElement('div');body.className='dialog-body';
 if(description){const p=document.createElement('p');p.textContent=description;body.append(p);}
 const footer=document.createElement('footer');footer.className='dialog-actions';
 for(const item of buttons){const b=document.createElement('button');b.textContent=item.label;b.className=item.primary?'primary gel-button gel-primary':'gel-button';b.onclick=item.action;footer.append(b);}
 content.append(header,body,footer);footer.hidden=!buttons.length;if(!dialog.open)dialog.showModal();h.focus({preventScroll:true});enterPanel(opener,180);return body;
}
function completeEntry(){
 if(entryRequest===undefined||!scene.ready||document.hidden||[...blockers].some(b=>b!=='home'))return false;
 const reason=entryRequest;entryRequest=undefined;activateGame(reason);return true;
}
function activateGame(reason='resume'){
 if(!scene.ready){entryRequest=reason;atHome=true;dialog.close();parkControls();blockers.delete('dialog');block('home',true);return;}
 entryRequest=undefined;atHome=false;dialog.close();parkControls();blockers.delete('dialog');blockers.delete('home');
 audio.block(blockers.size>0);paint();scene.reveal();checkPosition();message(guidance());$('settings').focus({preventScroll:true});$('hard-badge').classList.remove('challenge-enter');if(isHard(state.current)){void $('hard-badge').offsetWidth;$('hard-badge').classList.add('challenge-enter');}syncLoop();syncActive();if(stageNumber(state.current)>2)ads.prepare();track(playerMoves(attempt(state))?'level_resume':'level_start',{reason});
}
function resumeGame(){
 if(locked)return;
 // Persist the first start too, so returning without moves still says Continue.
 if(!state.attempts[activeKey(state)]&&!commit(seededRestart(state)))return;
 activateGame();
}
function showHome(){
 if(locked)return;entryRequest=undefined;pendingNext=undefined;
 track('level_leave',{reason:'home'});measureActive();activeMs=0;atHome=true;dialog.close();parkControls();blockers.delete('dialog');block('home',true);message(guidance());$('home-play').focus({preventScroll:true});
}
function switchLevel(index:number,reason='select'){
 if(index<0||index>=levels.length)return;pendingNext=undefined;
 measureActive();track('level_leave',{reason});interrupt();const selected={...state,current:index},existing=selected.attempts[activeKey(selected)];
 const unfinished=reason==='select'&&existing&&!won(existing.board,goalFor(selected));
 const n=unfinished?selected:startLatest(selected);
 if(commit(n)){activeMs=0;hintRoute.clear();activateGame(reason);if(reason==='next'&&!atHome)easeField(.42,160);}
}
function restart(){pendingNext=undefined;const n=seededRestart(state);if(commit(n)){track('level_restart');measureActive();activeMs=0;interrupt();hintRoute.clear();activateGame('restart');message(guidance());}}
function drainQueue(){if(!queued)return;const q=queued;clearIntent();const m=moveFor(attempt(state).board,q.from,q.to,goalFor(state));if(m)accept(m,true);}
function accept(m:Move,acknowledged=false){
 if(locked||blockers.size)return;
 cancelSearch();const before=attempt(state).board,beforeStars=totalStars(state),beforeRules=goalFor(state),beforeKnowledge=knowledgeFor(state);const first=!state.completed.includes(levelFor(state).id),next=moved(state,m);
 if(won(attempt(next).board,goalFor(next))&&!next.completed.includes(levels[next.current].id))next.completed.push(levels[next.current].id);
 const beforeCoins=state.wallet!.coins;
 if(!commit(next))return;
 pendingCoins=state.wallet!.coins-beforeCoins;if(pendingCoins)track('coins_earned',{reason:'stars',amount:pendingCoins,balance:state.wallet!.coins});
 if(won(attempt(state).board,goalFor(state))){track('level_complete',{first,stars:stars(activeKey(state),scoreMoves(attempt(state)))});if(first&&state.current===1&&state.completed.includes(levels[0].id))track('tutorial_complete');}
 hintRoute.accepted(before,m,beforeRules);checkPosition();clearIntent();lastMove=m;kind='pour';pendingReveal=(knowledgeFor(next)?.known.length??0)>(beforeKnowledge?.known.length??0);pendingIce=!iceOpen(beforeRules)&&iceOpen(goalFor(next))?iceIndex(goalFor(next))!:null;scene.iceHeld=pendingIce;newColor=!sealedTube(before,m.from,goalFor(state))&&sealedTube(attempt(next).board,m.to,goalFor(state));
 if(won(attempt(next).board,goalFor(next)))pendingStars={before:beforeStars,total:totalStars(next),delta:totalStars(next)-beforeStars,earned:stars(activeKey(next),scoreMoves(attempt(next)))};
 if(!acknowledged){audio.accept();haptic('accept');}scene.setBoard(attempt(state).board);scene.animate(before,m,state.settings.fast,beforeKnowledge);paint();message('');
}
scene.onTap=(i)=>{
 if(locked||blockers.size||mixActive||scene.arranging||won(attempt(state).board,goalFor(state)))return;
 if(i!==null)recoveryNotice='';
 if(searching){cancelSearch();paint();}audio.prime();
 if(i===null){if(scene.selected!==null)haptic();clearIntent();message(guidance());return;}
 const board=attempt(state).board;if(i>=board.length)return;
 if(scene.frozen(i)){scene.reject(i);audio.reject();haptic('land');message(scene.iceHeld===i?'Сейчас лёд расколется':'Собери цвет — лёд расколется');return;}
 // One future intention, based on the already committed board. Busy cells are valid inputs.
 if(queued)clearIntent();
 if(scene.selected===i){clearIntent();audio.tap();haptic();message(guidance());return;}
 if(scene.selected!==null){const m=moveFor(board,scene.selected,i,goalFor(state));
  if(m){
   if(scene.busy){queued=m;scene.queuedMove=m;scene.hintMove=null;audio.accept();haptic('accept');message(guidance());}
   else accept(m);
   return;
  }
 }
 scene.hintMove=null;scene.queuedMove=null;
 if(goalAt(goalFor(state),i)){scene.reject(i);audio.reject();haptic('ui');message('Цель принимает только свой цвет. Выбери обычную колбу.');return;}
 if(board[i].length){scene.selected=i;audio.tap();haptic();message(guidance());}
 else{scene.selected=null;scene.reject(i);audio.reject();haptic('ui');message('Сначала выбери цветную колбу');}
};
scene.onPour=(remainingMs,fill,endFill)=>{if(lastMove&&kind==='pour')audio.pour(remainingMs,lastMove.amount,fill,endFill,isMini(goalFor(state),lastMove.from));};
scene.onReceive=()=>{
 if(kind==='undo')return;
 if(pendingReveal&&lastMove){scene.land(lastMove.from,1);if(!newColor&&pendingIce===null){audio.reveal();haptic('reveal');}}pendingReveal=false;
 if(pendingIce!==null){scene.thaw(pendingIce);audio.ice();}
 if(!lastMove||!newColor){if(pendingIce!==null)haptic('ice');pendingIce=null;return;}
 scene.celebrate(lastMove.to);pendingIce=null;
 if(!won(attempt(state).board,goalFor(state)))audio.finish(false);else audio.fill();
};
scene.onSeal=()=>{if(!blockers.size&&!won(attempt(state).board,goalFor(state)))audio.seal();};
scene.onPhase=(phase,heavy)=>haptic(phase===0&&pendingIce!==null?'ice':phase===0?'color':phase===1?'colorRise':'colorSeal',heavy);
scene.onFinale=(order,heavy)=>{audio.seal();haptic(order===0?'victory':order===1?'victoryRise':'victoryPeak',heavy);};
scene.onComplete=()=>{
 const board=attempt(state).board;
 if(kind==='undo'){audio.land();paint();message(guidance());drainQueue();return;}
 if(won(board,goalFor(state))){
  if(lastMove)scene.celebrate(lastMove.to,true);audio.finish(true);paint();
  if(pendingStars){const presentation=pendingStars;pendingStars=undefined;reward.run({...presentation,reduced:reduced.matches});coinReward.run(pendingCoins,reduced.matches);pendingCoins=0;}
  return;
 }
 if(!newColor){audio.land();haptic('land');}
 paint();message(guidance());drainQueue();
};
function undo(){
 pendingNext=undefined;
 const a=attempt(state),m=a.history.at(-1);if(playerMoves(a)===0)return;
 if(a.shuffles?.at(-1)?.at===a.history.length){interrupt();if(commit(undone(state))){hintRoute.clear();scene.reveal();paint();checkPosition();message(guidance());audio.undo();}return;}if(!m)return;const before=a.board,beforeKnowledge=knowledgeFor(state);
 interrupt();if(commit(undone(state))){track('undo');hintRoute.clear();kind='undo';lastMove=null;scene.setBoard(attempt(state).board);
  if(goalAt(goalFor(state),m.to)){scene.land(m.from,m.amount);scene.land(m.to,m.amount);}else scene.animate(before,{from:m.to,to:m.from,amount:m.amount,color:m.color},true,beforeKnowledge);
  audio.undo();paint();checkPosition();message(guidance());}
}
$('undo').onclick=undo;
function askRestart(){if(stuck()){restart();return;}
 const fromPause=dialog.open&&dialog.classList.contains('compact-pause'),added=extraCount(attempt(state));
 modal('Начать заново?',added?'Ходы будут сброшены. Добавленные колбы останутся.':'Ходы будут сброшены.',[
  {label:fromPause?'Назад в паузу':'Продолжить игру',primary:true,action:fromPause?settings:close},
  {label:'Начать заново',action:restart}
 ],fromPause?settings:undefined);
}
$('restart').onclick=$('notice-restart').onclick=askRestart;
$('continue').onclick=()=>{void continueAfterWin();};
/** A dismissed SDK screen and a resumed WebView are independent events, in either order. */
function completePendingNext(){
 const request=pendingNext;
 if(!request||!request.ready||interstitialBusy||rewardBusy||recoveringRewards||locked||atHome||document.hidden||blockers.size)return;
 if(activeKey(state)!==request.key||!won(attempt(state).board,goalFor(state))){pendingNext=undefined;return;}
 // Consume before navigation: duplicate lifecycle events must never advance a second level.
 pendingNext=undefined;
 if(request.next===undefined)menu();else switchLevel(request.next,'next');
}
async function continueAfterWin(){
 if(pendingNext){completePendingNext();return;}
 if(interstitialBusy||rewardBusy||recoveringRewards||locked||blockers.size||!won(attempt(state).board,goalFor(state)))return;
 const index=state.current,next=continuation(state),key=activeKey(state,index),now=Date.now();
 const tutorialDone=levels.slice(0,2).every(l=>state.completed.includes(l.id));
 let after=state.wallet!.adAfter??0,attemptAfter=state.wallet!.adAttemptAfter??0;
 if(after>now+60000||attemptAfter>now+60000){const n=structuredClone(state);n.wallet!.adAfter=after=Math.min(after,now+60000);n.wallet!.adAttemptAfter=attemptAfter=Math.min(attemptAfter,now+60000);n.revision++;if(!commit(n))return;}
 const showAd=ads.native&&stageNumber(index)>2&&tutorialDone&&now>=after&&now>=attemptAfter;
 if(showAd){const n=structuredClone(state);n.wallet!.adAttemptAfter=now+60000;n.revision++;if(!commit(n))return;}
 const request={key,next,ready:!showAd};pendingNext=request;
 if(showAd){
  interstitialBusy=true;block('interstitial',true);track('interstitial_request');
  try{const r=await ads.show();track('interstitial_result',{status:r.status},index);if(r.status==='shown'){const n=structuredClone(state);n.wallet!.adAfter=Date.now()+60000;n.revision++;commit(n);}}
  catch{track('interstitial_result',{status:'failed'},index);}
  finally{if(pendingNext===request)request.ready=true;interstitialBusy=false;block('interstitial',false);}
 }
 completePendingNext();
}

function showHint(m:Move){const key=adviceKey(state),free=levelFor(state).colors<=2;const next=ownHint(state,key,m,free);if(!next){hintShop();return;}const spent=state.wallet!.hints-next.wallet!.hints;if(next!==state&&!commit(next))return;if(spent)track('hint_spent',{amount:spent,balance:state.wallet!.coins,hints:state.wallet!.hints});paint();track('hint_result',{status:'FOUND'});clearIntent();scene.selected=m.from;scene.hintMove=m;audio.hint();message(guidance());}
function requestHint(){
 if(scene.busy||blockers.size||locked||won(attempt(state).board,goalFor(state)))return;audio.prime();track('hint_request');
 if(stuck()){track('hint_result',{status:'UNSOLVABLE'});help(true);return;}
 const owned=state.wallet!.hintAdvice;if(owned?.key===adviceKey(state)){const legal=moveFor(attempt(state).board,owned.move.from,owned.move.to,goalFor(state));if(legal&&legal.amount===owned.move.amount&&legal.color===owned.move.color){showHint(owned.move);return;}}
 if(levelFor(state).colors>2&&!state.wallet!.hints){hintShop();return;}
 const view=knowledgeFor(state);if(hasUnknown(view)){const m=visibleHint(attempt(state).board,view!,goalFor(state));if(m){showHint(m);message('Открой следующий слой · отмена доступна');}else{track('hint_result',{status:'NO_VISIBLE_MOVE'});message('Нет доступного перелива · можно отменить ход');}return;}
 const planned=hintRoute.get(attempt(state).board,goalFor(state));if(planned){showHint(planned);return;}
 cancelSearch();const id=++requestId,revision=state.revision;searching=true;paint();message('Ищу продолжение…');
 const failed=()=>{if(id!==requestId)return;cancelSearch();paint();track('hint_result',{status:'ERROR'});message('Подсказка недоступна. Можно продолжить или отменить ход.');};
 try{
  worker=new Worker(new URL('./core/solver.worker.ts',import.meta.url),{type:'module'});
  worker.onmessage=(event:MessageEvent<{result:Result;revision:number;requestId:number}>)=>{
   if(event.data.requestId!==id||event.data.revision!==state.revision)return;
   const result=event.data.result;cancelSearch();paint();
   if(result.status==='FOUND'&&result.path.length&&hintRoute.set(attempt(state).board,goalFor(state),result.path)){showHint(hintRoute.get(attempt(state).board,goalFor(state))!);}
   else if(result.status==='UNSOLVABLE'){track('hint_result',{status:'UNSOLVABLE'});deadRevision=state.revision;paint();help(true);}
   else{track('hint_result',{status:'UNKNOWN'});message('Решение пока не найдено. Попробуй отменить ход.');}
  };
  worker.onerror=e=>{e.preventDefault();failed();};
  worker.onmessageerror=failed;
  worker.postMessage({board:attempt(state).board,goal:goalFor(state),revision,requestId:id,level:activeKey(state),extra:extraCount(attempt(state))});
 }catch{failed();}
}
$('hint').onclick=requestHint;
async function applyReceipt(receipt:Receipt){
 if(receipt.level.startsWith('coins:')){const next=creditCoins(state,receipt.token,receipt.level);if(!next)return false;const fresh=next!==state;if(fresh&&!commit(next))return false;if(fresh)track('reward_granted',{reason:'coins',amount:ECONOMY.adCoins,balance:state.wallet!.coins});await rewarded.ack(receipt.token).catch(()=>{});return true;}
 const target=parseTubeTarget(receipt.level);if(!target){await rewarded.ack(receipt.token);return true;}
 const l=levelByKey(target.key),i=l?levels.findIndex(v=>v.id===l.id):-1;if(!l||i<0||l.colors<=2){await rewarded.ack(receipt.token);return true;}
 const already=extraCount(state.attempts[target.key]??{extra:false})>=target.number;
 if(!already&&!commit(grantExtra(state,target.key,target.number)))return false;
 if(!already)track('reward_granted',{level:target.key},i);
 await rewarded.ack(receipt.token).catch(()=>{});return true;
}
function askExtra(){
 if(locked||scene.busy||scene.arranging||mixActive||rewardBusy||recoveringRewards||!offerExtra(state)||won(attempt(state).board,goalFor(state)))return;
 if(!state.wallet!.tubes){offerPack('tube');return;}
 const before=scene.positions().map(r=>({...r})),spent=spendBoost(state,'tube');
 if(spent&&commit(grantExtra(spent,activeKey(state),extraCount(attempt(state))+1))){track('boost_spent',{reason:'tube',amount:1});finishTube(before);}
}
$('extra-tube').onclick=askExtra;
$('star-target').onclick=()=>{
 const t=targets(activeKey(state)),offset=attempt(state).setup??0;
 const body=modal('Звёзды за уровень','',[{label:'Понятно',primary:true,action:settings}],settings);
 const rules=document.createElement('dl');rules.className='star-rules';
 for(const [rating,rule]of [['★★★',`До ${t.three-offset} ходов`],['★★',`До ${t.two-offset} ходов`],['★','Пройти уровень']]){
  const mark=document.createElement('dt'),label=document.createElement('dd');mark.textContent=rating;label.textContent=rule;rules.append(mark,label);
 }
 body.append(rules);
};
async function recoverRewards(){
 if(rewardBusy||recoveringRewards)return;recoveringRewards=true;try{const receipts=await rewarded.pending();if(!receipts.length)return;block('receipt-recovery',true);for(const r of receipts){if(!await applyReceipt(r)){pendingReceipt=r;break;}}}
 catch{/* Offline/native bridge unavailability never blocks playing. */}
 finally{recoveringRewards=false;block('receipt-recovery',false);}
}

function rescueOptions(){
 return (['shuffle','tube'] as const).filter(kind=>{const b=$<HTMLButtonElement>(BOOST_UI[kind].id);return !b.disabled&&!b.hidden;}).sort((a,b)=>Number(boostStock(state.wallet!,b)>0)-Number(boostStock(state.wallet!,a)>0));
}
function rescueChoice(){return rescueOptions()[0];}
function help(proven=deadRevision===state.revision){
 const a=attempt(state),options=rescueOptions(),recommended=options[0],buttons:{label:string;action:()=>void;primary?:boolean}[]=[];
 for(const kind of options){
  const stock=boostStock(state.wallet!,kind),ui=BOOST_UI[kind];
  buttons.push({label:stock?`${ui.action} · осталось ${stock}`:`${ui.pack} · ${ECONOMY.packPrice} монет`,primary:kind===recommended,action:kind==='shuffle'?askShuffle:askExtra});
 }
 if(playerMoves(a)>0)buttons.push({label:'Отменить ход',primary:!recommended,action:()=>{activateGame();undo();}});
 buttons.push({label:'Заново',action:askRestart});
 modal(proven?'Решения нет':'Если застрял',proven?'Из этой раскладки цвета уже не собрать.':'Выбери, как продолжить.',buttons);dialog.classList.add('rescue-dialog');
 message(guidance());
}
$('rescue').onclick=()=>help();
function menu(){
 const body=modal('Уровни',`Пройдено ${state.completed.length} из ${levels.length}`,[{label:atHome?'В главное меню':'Продолжить игру',primary:true,action:close}]);
 const grid=document.createElement('div');grid.className='levels';
 campaign.forEach(i=>{const l=levels[i],b=document.createElement('button'),done=state.completed.includes(l.id),available=levelAvailable(state,i);b.dataset.level=l.id;
  b.disabled=!available;b.classList.add('gel-button');if(i===state.current)b.classList.add('gel-primary');b.textContent=String(stageNumber(i));b.classList.toggle('completed',done);if(i===state.current)b.setAttribute('aria-current','step');
  b.setAttribute('aria-label',`Уровень ${stageNumber(i)}${l.goals?', две большие колбы':l.goal?', большая бутылка':''}${l.mini!==undefined?', мини-колба':''}${l.ice!==undefined?', лёд':''}${l.hidden?', скрытые слои':''}${done?', пройден':!available?', закрыт':''}`);
  const earned=earnedStars(state,i);if(available&&isHard(i)){const difficulty=document.createElement('small');difficulty.className='level-hard';difficulty.textContent='Сложный';b.append(difficulty);}

  const mark=document.createElement('small');mark.className='level-stars';mark.replaceChildren(...Array.from({length:3},(_,index)=>{const star=document.createElement('span');star.className='map-star';star.dataset.filled=String(index<earned);star.textContent=index<earned?'★':'☆';star.setAttribute('aria-hidden','true');return star;}));mark.setAttribute('aria-label',`${earned} из 3 звёзд`);if(done)b.append(mark);else if(i===state.current){const label=document.createElement('small');label.className='map-current';label.textContent='Текущий';b.append(label);}b.onclick=()=>switchLevel(i);grid.append(b);
 });body.append(grid);
 const current=grid.querySelector<HTMLElement>('[aria-current="step"]');
 if(current)body.scrollTop+=current.getBoundingClientRect().top-body.getBoundingClientRect().top-(body.clientHeight-current.offsetHeight)/2;


}
$('menu').onclick=showHome;
$('home-play').onclick=resumeGame;
$('home-levels').onclick=menu;
$('home-settings').onclick=settings;
function settings(){
 if(atHome){preferences();return;}
 const body=modal('Пауза','',[]);dialog.classList.add('compact-pause','game-pause');
 const stage=document.createElement('div');stage.className='pause-stage';stage.textContent=`Уровень ${stageNumber(state.current)}`;body.append(stage);
 const resume=document.createElement('button');resume.className='gel-button gel-primary pause-resume';resume.textContent='Продолжить';resume.onclick=close;body.append(resume);
 const actions=document.createElement('div');actions.className='pause-actions';
 for(const id of ['restart','menu','star-target','rescue'])actions.append($(id));body.append(actions);
 const options=document.createElement('button');options.className='pause-preferences';options.textContent='Настройки';options.onclick=preferences;body.append(options);
}
function preferences(){
 const body=modal('Настройки','',[],atHome?undefined:settings);dialog.classList.add('compact-pause');
 for(const [key,label]of Object.entries({sound:'Звуки',haptics:'Вибрация',fast:'Быстрое переливание',symbols:'Символы на цветах'})){
  const row=document.createElement('label');row.className='setting';const text=document.createElement('span');text.textContent=label;const input=document.createElement('input');input.type='checkbox';input.setAttribute('role','switch');input.checked=state.settings[key as keyof typeof state.settings]!==false;
  input.onchange=()=>{const n=structuredClone(state);n.settings[key as 'sound'|'haptics'|'fast'|'symbols']=input.checked;if(commit(n)){paint();audio.ui();haptic('ui');}else input.checked=!input.checked;};row.append(text,input);body.append(row);
 }
 const themes=document.createElement('fieldset');themes.className='theme-picker';const legend=document.createElement('legend');legend.textContent='Оформление';themes.append(legend);
 const choices=document.createElement('div');choices.className='theme-options';
 const selected=()=>{for(const b of choices.querySelectorAll<HTMLButtonElement>('button'))b.setAttribute('aria-pressed',String(b.dataset.themeChoice===themeFor(state.settings).id));};
 for(const theme of THEMES){const b=document.createElement('button');b.type='button';b.dataset.themeChoice=theme.id;b.textContent=theme.name;b.title=theme.name;b.setAttribute('aria-label',theme.name);b.style.setProperty('--swatch',theme.color);
  b.onclick=()=>{const n=structuredClone(state);n.settings.theme=theme.id;n.settings.light=theme.light;if(commit(n)){paint();selected();}};choices.append(b);
 }
 themes.append(choices);body.append(themes);selected();
}
$('settings').onclick=settings;
reduced.addEventListener('change',()=>{fieldTransition?.cancel();interrupt();paint();});
document.addEventListener('click',event=>{
 const button=event.target instanceof Element?event.target.closest('button'):null;
 if(!button||button.disabled)return;
 const origin=opener=button.getBoundingClientRect();uiClicks.add(event);
 setTimeout(()=>{if(opener===origin)opener=undefined;},0);
},{capture:true});
document.addEventListener('click',event=>{
 if(!uiClicks.has(event))return;
 opener=undefined;haptic('ui');
 if(event.target instanceof Element&&!event.target.closest('#undo'))audio.ui();
});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!dialog.open&&!atHome){e.preventDefault();settings();}});
dialog.addEventListener('cancel',e=>{e.preventDefault();dismissPanel();});
document.addEventListener('visibilitychange',()=>{block('hidden',document.hidden);if(!document.hidden)message(guidance());});
window.addEventListener('pagehide',()=>block('page',true));window.addEventListener('pageshow',()=>block('page',false));
function syncField(){if(!game)return;const width=$('board').clientWidth,visible=$('board').clientHeight,reserve=document.body.classList.contains('finished')?0:innerHeight<=430?76:114,height=fieldHeight(width,Math.max(1,visible-reserve),scene.slots,goalList(scene.goal).length),key=`${width}x${height}`;
 $('board').style.setProperty('--field-height',height+'px');$('board').classList.toggle('scroll-field',height>visible+1);if(key===previousSize)return;previousSize=key;
 scene.setViewport(width,height,density);game.scale.resize(Math.round(width*density),Math.round(height*density));
}
let previousWindow=`${innerWidth}x${innerHeight}`;const observer=new ResizeObserver(()=>{const size=`${innerWidth}x${innerHeight}`;if(size!==previousWindow){previousWindow=size;interrupt();}paint();});observer.observe($('board'));
function onNativeActivity(isActive:boolean){block('native',!isActive);if(isActive){message(guidance());ads.prepare();}}
if(Capacitor.isNativePlatform()){
 void App.addListener('appStateChange',({isActive})=>onNativeActivity(isActive));
 void App.addListener('backButton',()=>{if(dialog.open)dismissPanel();else if(!atHome)settings();else void App.exitApp();});
}
function cancelAssist(){assistRequestId++;assistWorker?.terminate();assistWorker=undefined;clearTimeout(assistTimer);}
function finishTube(before=scene.positions().map(r=>({...r}))){interrupt();hintRoute.clear();activateGame();scene.reflow(before);audio.land();haptic('land',true);paint();setTimeout(()=>paint(),500);}
function buyBoost(kind:Boost){
 if(rewardBusy||recoveringRewards||interstitialBusy||locked)return;
 if(state.wallet!.coins<ECONOMY.packPrice){coinShop('',kind);return;}
 const next=purchaseBoost(state,kind);if(next&&commit(next)){track('boost_purchase',{reason:kind,amount:ECONOMY.packPrice});close();paint();if(!reduced.matches)$(BOOST_UI[kind].badge).animate([
  {transform:'scale(.88)'},{transform:'scale(1.22)',offset:.48},{transform:'scale(1)'}
 ],{duration:250,easing:'ease-out'});}
}
function askShuffle(){
 if(scene.busy||scene.arranging||mixActive||rewardBusy||recoveringRewards||assistWorker||won(attempt(state).board,goalFor(state))||locked)return;
 if(!boostStock(state.wallet!,'shuffle')){offerPack('shuffle');return;}
 beginShuffle();
}
function beginShuffle(){
 if(assistWorker)return;const revision=state.revision;track('shuffle_request');
 const body=modal('Перемешиваем…','Подбираем решаемую позицию',[{label:'Отмена',action:()=>{cancelAssist();close();}}]);const id=++assistRequestId;
 const fail=()=>{if(id!==assistRequestId)return;cancelAssist();track('shuffle_result',{status:'UNKNOWN'});modal('Перемешивание не применено','Не удалось подобрать новую позицию. Заряд сохранён. Можно отменить ход или добавить колбу.',[{label:'Понятно',primary:true,action:close}]);};
 try{
  assistWorker=new Worker(new URL('./core/shuffle.worker.ts',import.meta.url),{type:'module'});
  assistWorker.onmessage=({data}:{data:{revision:number;event?:Shuffle}})=>{
   if(id!==assistRequestId||!assistWorker||data.revision!==state.revision||revision!==state.revision)return;
   const canvas=$('board').querySelector('canvas'),veil=document.createElement('img');try{if(canvas){const sample=document.createElement('canvas');sample.width=32;sample.height=32;const context=sample.getContext('2d')!;context.drawImage(canvas,0,0,32,32);if(context.getImageData(0,0,32,32).data.some((v,i)=>i%4===3&&v>8))veil.src=canvas.toDataURL();}}catch{}
   if(!data.event){fail();return;}
   try{const n=reshuffled(state,data.event),paid=spendBoost(n,'shuffle');if(!paid){fail();return;}if(!commit(paid)){cancelAssist();return;}}catch{fail();return;}
   cancelAssist();hintRoute.clear();activateGame();track('shuffle_result',{status:'APPLIED'});track('boost_spent',{reason:'shuffle',amount:1});
   const field=$('board');mixActive=true;field.classList.add('mixing48');if(!reduced.matches&&veil.src.length>2000){veil.className='shuffle-veil';field.append(veil);veil.animate([{opacity:1,filter:'blur(0px)',transform:'scale(1)'},{opacity:0,filter:'blur(6px)',transform:'scale(1.04)'}],{duration:380,easing:'ease-out'}).finished.then(()=>veil.remove(),()=>veil.remove());}
   if(!reduced.matches)attempt(state).board.forEach((t,i)=>{if(t.length&&!goalAt(goalFor(state),i)&&!sealedTube(attempt(state).board,i,goalFor(state)))scene.land(i,1.8);});
   audio.pour(520,3);const start=performance.now(),seen=new Set<number>(),key=activeKey(state);
   const tick=(now:number)=>{if(document.hidden||atHome||blockers.size||key!==activeKey(state)){veil.remove();field.classList.remove('mixing48');mixActive=false;paint();return;}
    for(const [i,t]of [0,150,320,480].entries())if(now-start>=t&&!seen.has(i)){seen.add(i);haptic(i===3?'colorSeal':'land',i===3);if(i===3)audio.land();}
    if(now-start<560)assistFrame=requestAnimationFrame(tick);else{veil.remove();field.classList.remove('mixing48');mixActive=false;paint();}
   };assistFrame=requestAnimationFrame(tick);paint();
  };
  assistWorker.onerror=e=>{e.preventDefault();fail();};assistWorker.onmessageerror=fail;
  assistWorker.postMessage({revision,level:levelFor(state),attempt:attempt(state),rules:goalFor(state),seed:crypto.getRandomValues(new Uint32Array(1))[0]});assistTimer=setTimeout(fail,3500);paint();
 }catch{fail();}
}
$('shuffle').onclick=askShuffle;
$('board').addEventListener('pointerdown',e=>{if(e.target===$('board'))scene.onTap(null);});

block('home',true);message(guidance());
if(loaded.recovered){track('save_recovered');message(guidance());}
function startupIssue(){
 if(locked&&loaded.unavailable){showReadFailure();return;}
 if(loaded.corrupt)showCorrupt();
}
function showReadFailure(){modal('Прогресс недоступен','Не удалось прочитать сохранение. Прогресс не изменён. Проверь доступ к хранилищу и попробуй ещё раз.',[{label:'Повторить чтение',primary:true,action:()=>{
 const retry=store.load();
 if(retry.unavailable){showReadFailure();return;}
 state=settleEconomy(retry.state);locked=retry.corrupt;recoveryNotice=retry.recovered?'Откат к резервной копии':'';
 if(retry.corrupt){showCorrupt();return;}
 interrupt();close();scene.reveal();void recoverRewards();
 }}]);}
function showCorrupt(){modal('Сохранение повреждено','Основная и резервная копии не читаются. Начать заново можно только после подтверждения.',[{label:'Начать заново',action:()=>{if(commit(state)){locked=false;close();}}}]);}
startupIssue();
if(!locked)void recoverRewards();

function postRewardCooldown(){const n=structuredClone(state);n.wallet!.adAfter=Date.now()+60000;n.revision++;commit(n);}
function hintShop(){offerPack('hint');}
function offerPack(kind:Boost,afterAd=false){
 if(state.wallet!.coins<ECONOMY.packPrice){coinShop('',kind);return;}
 const ui=BOOST_UI[kind],price=ECONOMY.packPrice;
 const origin=opener??$(ui.id).getBoundingClientRect();
 const body=modal(ui.pack,afterAd?`+${ECONOMY.adCoins} монет начислено · баланс ${state.wallet!.coins}`:'',[
  {label:`Купить за ${price} монет`,primary:true,action:()=>{if(dialog.open&&dialog.classList.contains('pack-dialog'))buyBoost(kind);}},
  {label:'Отмена',action:close}
 ]);
 dialog.classList.add('pack-dialog');

 const exchange=document.createElement('div');exchange.className='pack-exchange';
 const cost=document.createElement('div');cost.className='pack-token pack-cost';
 const coin=document.createElement('i');coin.className='coin-icon';coin.setAttribute('aria-hidden','true');
 const amount=document.createElement('strong');amount.textContent=String(price);cost.append(coin,amount);cost.setAttribute('aria-label',`${price} монет`);
 const arrow=document.createElement('span');arrow.className='pack-arrow';arrow.textContent='→';arrow.setAttribute('aria-hidden','true');
 const reward=document.createElement('div');reward.className='pack-token pack-reward';
 const symbols=document.createElement('span');symbols.className='pack-symbols';symbols.setAttribute('aria-hidden','true');
 const icon=$(ui.id).querySelector('svg')!;
 for(let i=0;i<ECONOMY.packHints;i++)symbols.append(icon.cloneNode(true));
 const label=document.createElement('strong');label.textContent=ui.pack;reward.append(symbols,label);
 exchange.append(cost,arrow,reward);body.append(exchange);enterPanel(origin,310,true);
}
function coinShop(notice='',kind?:Boost){
 const body=modal('Монеты',notice,[{label:`Получить ${ECONOMY.adCoins} монет · реклама`,primary:true,action:()=>{void watchForCoins(kind);}}]);
 const current=state.wallet!.coins,summary=document.createElement('div');summary.className='coin-offer';
 const row=(name:string,value:number,className:string)=>{const el=document.createElement('div');el.className=className;const label=document.createElement('small');label.textContent=name;const number=document.createElement('strong');number.textContent=String(value);el.append(label,number);return el;};
 const gain=row('За просмотр рекламы',ECONOMY.adCoins,'coin-offer-gain');gain.querySelector('strong')!.textContent=`+${ECONOMY.adCoins}`;
 const totals=document.createElement('div');totals.className='coin-offer-totals';
 const balance=row('Сейчас',current,'shop-balance');
 const arrow=document.createElement('span');arrow.textContent='→';arrow.setAttribute('aria-hidden','true');
 totals.append(balance,arrow,row('После рекламы',current+ECONOMY.adCoins,'coin-offer-after'));
 summary.append(gain,totals);
 if(kind){const context=document.createElement('small');context.className='coin-offer-context';context.textContent=`${BOOST_UI[kind].pack} · ${ECONOMY.packPrice} монет`;summary.append(context);}
 body.prepend(summary);
}
$('wallet').onclick=()=>coinShop();$('home-wallet').onclick=()=>coinShop();
async function watchForCoins(kind?:Boost){
 if(rewardBusy||recoveringRewards||interstitialBusy||locked)return;
 rewardBusy=true;block('reward',true);
 const footer=content.querySelector('.dialog-actions'),cta=footer?.querySelector<HTMLButtonElement>('button');
 if(cta){cta.disabled=true;cta.textContent=pendingReceipt?'Сохраняем награду…':'Загружаем рекламу…';cta.setAttribute('aria-busy','true');}
 if(footer&&!pendingReceipt){const cancel=document.createElement('button');cancel.className='gel-button';cancel.textContent='Отменить';cancel.onclick=()=>{cancel.disabled=true;void rewarded.cancel().catch(()=>{cancel.disabled=false;});};footer.append(cancel);}
 let credited=false;
 let notice='Реклама пока недоступна. Попробуй позже.',cooldown=false;
 try{
  if(pendingReceipt){if(!await applyReceipt(pendingReceipt)){notice='Награда ожидает сохранения. Повторный просмотр не нужен.';return;}pendingReceipt=undefined;credited=true;notice='Предыдущая награда сохранена. Повторный просмотр не нужен.';return;}
  if(!state.wallet!.adOrder){const n=structuredClone(state);n.wallet!.adOrder=`coins:${crypto.randomUUID()}`;n.revision++;if(!commit(n)){notice='Не удалось сохранить предложение. Реклама не запущена.';return;}}
  const order=state.wallet!.adOrder!;track('reward_request',{reason:'coins'});const r=await rewarded.request(order);cooldown=r.wasShown===true||r.status==='rewarded';track('reward_result',{reason:'coins',status:r.status});
  if(r.status==='rewarded'&&r.receipt?.level===order){pendingReceipt=r.receipt;if(await applyReceipt(pendingReceipt)){pendingReceipt=undefined;credited=true;notice=`+${ECONOMY.adCoins} монет начислено.`;}else notice='Награда получена и ожидает сохранения. Повторный просмотр не нужен.';}
  else if(r.status==='closed')notice='Просмотр не завершён. Монеты не начислены.';
 }catch{/* Persisted offers and native receipts remain available for retry/recovery. */}
 finally{rewardBusy=false;if(cooldown)postRewardCooldown();block('reward',false);if(credited&&kind&&state.wallet!.coins>=ECONOMY.packPrice)offerPack(kind,true);else coinShop(notice,kind);}
}

// Reveal only after synchronous startup has bound controls and restored the theme.
void revealStartup(homeHeroReady);
