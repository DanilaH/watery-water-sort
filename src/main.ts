import Phaser from 'phaser';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import './style.css';
import { Sound } from './audio/sound';
import { WaterScene } from './game/WaterScene';
import { moveFor, sealedTube, won, moves, type Move } from './core/rules';
import { attempt, levels, moved, undone, restarted, levelKey, offerExtra, displaySlots, grantExtra, goalFor, type Save } from './core/session';
import { SaveStore } from './platform/storage';
import {stars,targets} from './core/ratings';
import {Rewarded,type Receipt} from './platform/rewarded';
import {THEMES,themeFor} from './core/themes';
import type { Result } from './core/solver';
import {TouchFeedback,type Touch} from './platform/haptics';
import {StarReward} from './game/StarReward';
import {totalStars} from './core/progress';
import {isHard} from './core/difficulty';
const touch=new TouchFeedback();
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const $=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T;
const dialog=$<HTMLDialogElement>('dialog'),content=$('dialog-content'),audio=new Sound(),store=new SaveStore(()=>localStorage);
const reward=new StarReward($('earned-stars'),[$('star-total'),$('home-star-total')],index=>{audio.collect(index);haptic('collect');});
let pendingStars:{before:number;delta:number;earned:number;total:number}|undefined;
const loaded=store.load();let state=loaded.state,locked=loaded.corrupt||loaded.unavailable;
audio.setEnabled(state.settings.sound);if(state.settings.sound)void audio.load();
let recoveryNotice=loaded.recovered?'Откат к резервной копии':'';
const scene=new WaterScene('water');
const density=Math.min(2,Math.max(1,devicePixelRatio));
scene.setViewport($('board').clientWidth,$('board').clientHeight,density);
const game=new Phaser.Game({type:Phaser.AUTO,parent:'board',transparent:true,antialias:true,scale:{mode:Phaser.Scale.NONE,width:Math.round($('board').clientWidth*density),height:Math.round($('board').clientHeight*density)},scene:[scene],audio:{noAudio:true}});
let worker:Worker|undefined,requestId=0,searching=false,queued:Move|null=null,lastMove:Move|null=null,kind:'pour'|'undo'='pour',newColor=false;
let deadRevision:number|null=null;
let hintCache:{revision:number;move:Move}|null=null;
const blockers=new Set<string>();
let atHome=true,rewardBusy=false;
const rewarded=new Rewarded();let pendingReceipt:Receipt|undefined;
const hasStarted=()=>Object.keys(state.attempts).length>0||state.completed.length>0;
function haptic(event:Touch='select'){touch.enabled=state.settings.haptics!==false;touch.blocked=event==='ui'?[...blockers].some(b=>b!=='home'&&b!=='dialog'):blockers.size>0;touch.play(event);}
function message(text:string,important=false){$('status').textContent=important?text:recoveryNotice||text;}
function guidance(){
 if(won(attempt(state).board,goalFor(state)))return 'Все цвета собраны';
 if(queued)return 'Следующий ход выбран · фон — отмена';
 if(deadRevision===state.revision)return 'Из этого положения решения нет';
 if(!scene.busy&&!moves(attempt(state).board,goalFor(state)).length)return 'Нет доступных ходов';
 if(scene.hintMove)return 'Перелей в колбу со стрелкой';
 if(scene.selected!==null)return scene.busy?'Следующий ход: выбери цель':'Выбери пустую или с тем же цветом сверху';
 if(goalFor(state)&&attempt(state).history.length===0)return 'Большая колба принимает свой цвет. Обратно не льётся.';
 if(state.current===0&&attempt(state).history.length===0)return 'Выбери цветную колбу, затем пустую';
 if(state.current<2)return 'Одинаковые верхние слои льются вместе';
 return '';
}
function cancelSearch(){worker?.terminate();worker=undefined;requestId++;searching=false;}
function clearIntent(){queued=null;scene.queuedMove=null;scene.selected=null;scene.hintMove=null;}
function interrupt(){reward.cancel();pendingStars=undefined;scene.resetEffects();clearIntent();cancelSearch();audio.stop();scene.setBoard(attempt(state).board);}
function block(reason:string,on:boolean){if(on){blockers.add(reason);interrupt();}else blockers.delete(reason);audio.block([...blockers].some(x=>x!=='dialog'&&x!=='home'));paint();}
function commit(next:Save){try{store.write(next);state=next;recoveryNotice='';$('home-error').hidden=true;return true;}catch{paint();const error='Не удалось сохранить. Изменение не принято — попробуй ещё раз.';message(error,true);if(atHome&&!dialog.open){$('home-error').textContent=error;$('home-error').hidden=false;}if(dialog.open){const body=content.querySelector('.dialog-body');let note=body?.querySelector<HTMLElement>('[role=alert]');if(body&&!note){note=document.createElement('p');note.setAttribute('role','alert');body.prepend(note);}if(note)note.textContent=error;if(body)body.scrollTop=0;}return false;}}
function paint(){
 const a=attempt(state),finished=won(a.board,goalFor(state))&&!scene.busy;
 document.body.classList.toggle('home',atHome);$('home').hidden=!atHome;$('home').inert=!atHome;$('app').inert=atHome;
 $('app').setAttribute('aria-hidden',String(atHome));
 $('home-play').textContent=hasStarted()?'Продолжить':'Играть';
 $('home-summary').textContent=hasStarted()?`Уровень ${state.current+1} · ходов: ${a.history.length}`:'Собери каждый цвет в свою колбу';
 const theme=themeFor(state.settings);document.body.dataset.theme=theme.id;
 document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')!.content=theme.color;
 scene.reduced=reduced.matches;touch.enabled=state.settings.haptics!==false;reward.setTotal(totalStars(state),pendingStars?.before);
 $('star-capacity').textContent=`/ ${levels.length*3}`;
 $('hard-badge').hidden=!isHard(state.current);$('home-challenge').hidden=!isHard(state.current);$('home-play').classList.toggle('hard-level',isHard(state.current));
 scene.goal=goalFor(state);scene.slots=displaySlots(state);scene.setBoard(a.board);scene.symbols=state.settings.symbols;scene.light=theme.light;audio.setEnabled(state.settings.sound);
 document.body.classList.toggle('packed-board',displaySlots(state)>=10);document.body.classList.toggle('pouring',scene.busy);document.body.classList.toggle('dense-board',displaySlots(state)>10);document.body.classList.toggle('goal-board',!!goalFor(state));document.body.classList.toggle('light',theme.light);document.body.classList.toggle('finished',finished);
 $('level-title').innerHTML=`<span>Уровень</span> <strong>${state.current+1}</strong>`;$('moves').textContent=`Ходов: ${a.history.length}`;$('progress').textContent=`${levels.length} уровней`;
 ($('undo') as HTMLButtonElement).disabled=!a.history.length;
 ($('hint') as HTMLButtonElement).disabled=scene.busy||searching||finished;
 $('symbols').setAttribute('aria-pressed',String(state.settings.symbols));
 const objective=goalFor(state);$('objective').hidden=finished||!objective;$('objective').textContent=objective?`Собери ${['голубую','жёлтую','фиолетовую','зелёную','розовую','синюю','лимонную','оранжевую'][objective.color]} жидкость в большую колбу`:'';
 const target=targets(levelKey(state.current));$('star-target').hidden=finished;$('star-target').textContent=`Три звезды — за ${target.three} переливаний. Две — за ${target.two}.`;
 $('earned-stars').hidden=!finished;const earned=stars(levelKey(state.current),a.history.length);if(!finished||!$('earned-stars').classList.contains('revealing-stars'))$('earned-stars').textContent='★'.repeat(earned)+'☆'.repeat(3-earned);$('earned-stars').setAttribute('aria-label',`${earned} из 3 звёзд`);
 const extra=$('extra-tube');extra.hidden=atHome||!offerExtra(state)||won(a.board,goalFor(state));(extra as HTMLButtonElement).disabled=scene.busy||rewardBusy;
 if(offerExtra(state)){const r=scene.positions().at(-1)!;Object.assign(extra.style,{left:`${r.x-r.hitW/2}px`,top:`${r.y+r.h/2-r.hitH/2}px`,width:`${r.hitW}px`,height:`${r.hitH}px`});extra.style.setProperty('--vessel-width',(r.w+4)+'px');extra.style.setProperty('--vessel-height',(r.h+4)+'px');const glass=extra.querySelector<SVGSVGElement>('.locked-vessel')!;glass.setAttribute('viewBox',`0 0 ${r.w+4} ${r.h+4}`);const radius=r.w/2;glass.innerHTML=`<path d="M2 2h${r.w}v${r.h-radius}a${radius} ${radius} 0 0 1-${r.w} 0Z" fill="currentColor" fill-opacity=".06" stroke="currentColor" stroke-width="1.5"/><ellipse cx="${radius+2}" cy="2" rx="${radius}" ry="2" stroke="currentColor"/><path d="M6 10v${r.h*.64}" stroke="white" stroke-opacity=".42" stroke-width="2"/><g transform="translate(${radius+2} ${r.h*.5})"><path d="M-${radius-2} -17L${radius-2} 17M-${radius-2} 17L${radius-2} -17" stroke="currentColor" stroke-width="4" stroke-dasharray="5 3"/><rect x="-9" y="-6" width="18" height="16" rx="3" fill="currentColor"/><path d="M-5 -6v-5a5 5 0 0 1 10 0v5" stroke="currentColor" stroke-width="2.5"/></g>`;}
 $('continue').hidden=!finished;
 $('rescue').hidden=finished||scene.busy||!(deadRevision===state.revision||!moves(a.board,goalFor(state)).length);
 $('continue').textContent=state.current===levels.length-1?'К уровням →':'Дальше →';
 $('finish-title').hidden=!finished;$('finish-title').textContent=state.current===levels.length-1?'Пройдено!':earned===3?'Идеально!':'Получилось!';
 if(finished)message(`Ходов: ${a.history.length} · рекорд: ${state.best?.[levelKey(state.current)]?.history.length??a.history.length}`);
}
function close(){if(rewardBusy){void rewarded.cancel().catch(()=>{});return;}if(locked)return;dialog.close();block('dialog',false);message(guidance());}
function modal(title:string,description:string,buttons:{label:string;action:()=>void;primary?:boolean}[]){
 block('dialog',true);content.replaceChildren();
 const header=document.createElement('header');header.className='dialog-header';
 const h=document.createElement('h2');h.textContent=title;h.tabIndex=-1;header.append(h);
 const x=document.createElement('button');x.className='dialog-close';x.textContent='×';x.setAttribute('aria-label','Закрыть');x.onclick=close;x.hidden=locked;header.append(x);
 const body=document.createElement('div');body.className='dialog-body';
 if(description){const p=document.createElement('p');p.textContent=description;body.append(p);}
 const footer=document.createElement('footer');footer.className='dialog-actions';
 for(const item of buttons){const b=document.createElement('button');b.textContent=item.label;b.className=item.primary?'primary':'';b.onclick=()=>{audio.ui();item.action();};footer.append(b);}
 content.append(header,body,footer);if(!dialog.open)dialog.showModal();h.focus({preventScroll:true});return body;
}
function activateGame(){
 atHome=false;dialog.close();blockers.delete('dialog');blockers.delete('home');
 audio.block(blockers.size>0);paint();scene.reveal();message(guidance());$('menu').focus({preventScroll:true});$('hard-badge').classList.remove('challenge-enter');if(isHard(state.current)){void $('hard-badge').offsetWidth;$('hard-badge').classList.add('challenge-enter');}
}
function resumeGame(){
 if(locked)return;
 // Persist the first start too, so returning without moves still says Continue.
 if(!state.attempts[levelKey(state.current)]&&!commit(restarted(state)))return;
 audio.ui();activateGame();
}
function showHome(){
 if(locked)return;
 atHome=true;dialog.close();blockers.delete('dialog');block('home',true);message(guidance());$('home-play').focus({preventScroll:true});
}
function switchLevel(index:number){
 if(index<0||index>=levels.length)return;
 interrupt();const n=restarted({...state,current:index});
 if(commit(n)){hintCache=null;activateGame();}
}
function restart(){const n=restarted(state);if(commit(n)){interrupt();hintCache=null;activateGame();message('Та же задача — новая попытка');}}
function drainQueue(){if(!queued)return;const q=queued;clearIntent();const m=moveFor(attempt(state).board,q.from,q.to,goalFor(state));if(m)accept(m,true);}
function accept(m:Move,acknowledged=false){
 if(locked||blockers.size)return;
 cancelSearch();const before=attempt(state).board,beforeStars=totalStars(state);const next=moved(state,m);
 if(won(attempt(next).board,goalFor(next))&&!next.completed.includes(levels[next.current].id))next.completed.push(levels[next.current].id);
 if(!commit(next))return;
 hintCache=null;clearIntent();lastMove=m;kind='pour';newColor=!sealedTube(before,m.from,goalFor(state))&&sealedTube(attempt(next).board,m.to,goalFor(state));
 if(won(attempt(next).board,goalFor(next)))pendingStars={before:beforeStars,total:totalStars(next),delta:totalStars(next)-beforeStars,earned:stars(levelKey(next.current),attempt(next).history.length)};
 if(!acknowledged){audio.accept();haptic('accept');}scene.setBoard(attempt(state).board);scene.animate(before,m,state.settings.fast);paint();message('');
}
scene.onTap=(i)=>{
 if(locked||blockers.size||won(attempt(state).board,goalFor(state)))return;
 if(i!==null)recoveryNotice='';
 if(searching){cancelSearch();paint();}audio.prime();
 if(i===null){if(scene.selected!==null)haptic();clearIntent();message(guidance());return;}
 const board=attempt(state).board;if(i>=board.length)return;
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
 if(goalFor(state)?.index===i){scene.reject(i);audio.reject();message('Цель принимает только свой цвет. Выбери обычную колбу.');return;}
 if(board[i].length){scene.selected=i;audio.tap();haptic();message(guidance());}
 else{scene.selected=null;scene.reject(i);audio.reject();message('Сначала выбери цветную колбу');}
};
scene.onPour=(remainingMs,fill,endFill)=>{if(lastMove&&kind==='pour')audio.pour(remainingMs,lastMove.amount,fill,endFill);};
scene.onReceive=()=>{
 if(kind==='undo'||!lastMove||!newColor)return;
 scene.celebrate(lastMove.to);
 if(!won(attempt(state).board,goalFor(state)))audio.finish(false);else audio.fill();
};
scene.onSeal=()=>{if(!blockers.size&&!won(attempt(state).board,goalFor(state)))audio.seal();};
scene.onPhase=phase=>haptic(phase===0?'color':phase===1?'colorRise':'colorSeal');
scene.onFinale=order=>{audio.seal();haptic(order===0?'victory':order===1?'victoryRise':'victoryPeak');};
scene.onComplete=()=>{
 const board=attempt(state).board;
 if(kind==='undo'){audio.land();paint();message(guidance());drainQueue();return;}
 if(won(board,goalFor(state))){
  if(lastMove)scene.celebrate(lastMove.to,true);audio.finish(true);paint();
  if(pendingStars){const presentation=pendingStars;pendingStars=undefined;reward.run({...presentation,reduced:reduced.matches});}
  return;
 }
 if(!newColor){audio.land();haptic('land');}
 paint();message(guidance());drainQueue();
};
function undo(){
 const a=attempt(state),m=a.history.at(-1);if(!m)return;const before=a.board;
 interrupt();if(commit(undone(state))){hintCache=null;kind='undo';lastMove=null;scene.setBoard(attempt(state).board);
  if(goalFor(state)?.index===m.to){scene.land(m.from,m.amount);scene.land(m.to,m.amount);}else scene.animate(before,{from:m.to,to:m.from,amount:m.amount,color:m.color},true);
  audio.undo();paint();message(goalFor(state)?.index===m.to?'Ход отменён · большая бутылка остаётся на месте':'Возвращаем предыдущий ход');}
}
$('undo').onclick=undo;
function askRestart(){audio.ui();modal('Начать заново?','Текущие ходы будут сброшены. Открытая дополнительная колба сохранится.',[{label:'Продолжить игру',primary:true,action:close},{label:'Начать заново',action:restart}]);}
$('restart').onclick=askRestart;
$('continue').onclick=()=>{audio.ui();if(state.current===levels.length-1)menu();else switchLevel(state.current+1);};
$('symbols').onclick=()=>{const n=structuredClone(state);n.settings.symbols=!n.settings.symbols;if(commit(n)){paint();audio.ui();}};
function showHint(m:Move){clearIntent();scene.selected=m.from;scene.hintMove=m;audio.hint();message(guidance());}
$('hint').onclick=()=>{
 if(scene.busy||blockers.size||locked||won(attempt(state).board,goalFor(state)))return;audio.prime();
 if(hintCache?.revision===state.revision){showHint(hintCache.move);return;}
 cancelSearch();const id=++requestId,revision=state.revision;searching=true;paint();message('Ищу продолжение…');
 const failed=()=>{if(id!==requestId)return;cancelSearch();paint();message('Подсказка недоступна. Можно продолжить или отменить ход.');};
 try{
  worker=new Worker(new URL('./core/solver.worker.ts',import.meta.url),{type:'module'});
  worker.onmessage=(event:MessageEvent<{result:Result;revision:number;requestId:number}>)=>{
   if(event.data.requestId!==id||event.data.revision!==state.revision)return;
   const result=event.data.result;cancelSearch();paint();
   if(result.status==='FOUND'&&result.path.length){hintCache={revision,move:result.path[0]};showHint(result.path[0]);}
   else if(result.status==='UNSOLVABLE'){deadRevision=state.revision;paint();help(true);}
   else message('Решение пока не найдено. Попробуй отменить ход.');
  };
  worker.onerror=e=>{e.preventDefault();failed();};
  worker.onmessageerror=failed;
  worker.postMessage({board:attempt(state).board,goal:goalFor(state),revision,requestId:id});
 }catch{failed();}
};
async function applyReceipt(receipt:Receipt){
 const i=levels.findIndex((_,i)=>levelKey(i)===receipt.level);if(i<0||levels[i].colors<=2){await rewarded.ack(receipt.token);return true;}
 if(!attempt({...state,current:i}).extra&&!commit(grantExtra(state,receipt.level)))return false;
 await rewarded.ack(receipt.token).catch(()=>{});return true;
}
async function watchForTube(){
 if(rewardBusy)return;const key=levelKey(state.current);if(!offerExtra(state))return;
 rewardBusy=true;block('reward',true);const button=content.querySelector<HTMLButtonElement>('.dialog-actions .primary');if(button){button.disabled=true;button.textContent=pendingReceipt?'Получаем колбу…':'Загружаем рекламу…';}
 let granted=false,notice='';
 try{
  if(pendingReceipt&&pendingReceipt.level!==key){if(await applyReceipt(pendingReceipt))pendingReceipt=undefined;else throw Error('Save unavailable');}
  if(!pendingReceipt){const r=await rewarded.request(key);if(r.status==='rewarded'&&r.receipt?.level===key)pendingReceipt=r.receipt;else notice=r.status==='closed'?'Просмотр не завершён. Колба остаётся закрытой.':'Реклама пока недоступна. Попробуй позже.';}
  if(pendingReceipt){granted=await applyReceipt(pendingReceipt);if(granted)pendingReceipt=undefined;else notice='Награда получена, но колбу не удалось сохранить. Нажми «Получить колбу» — повторный просмотр не нужен.';}
 }catch{notice='Реклама пока недоступна. Попробуй позже.';}
 finally{rewardBusy=false;block('reward',false);}
 if(granted){interrupt();hintCache=null;activateGame();message('Колба открыта · ходы сохранены');}
 else{const body=content.querySelector('.dialog-body');if(body){let note=body.querySelector<HTMLElement>('.reward-notice');if(!note){note=document.createElement('p');note.className='reward-notice';note.setAttribute('role','status');body.append(note);}note.textContent=notice;}if(button){button.disabled=false;button.textContent=pendingReceipt?'Получить колбу':'Смотреть рекламу';}}
}
function askExtra(){
 if(!offerExtra(state)||won(attempt(state).board,goalFor(state)))return;
 modal('Дополнительная колба','Добавит место для переливания. Текущие ходы сохранятся.',[{label:pendingReceipt?'Получить колбу':'Смотреть рекламу',primary:true,action:()=>{void watchForTube();}},{label:'Позже',action:close}]);
}
$('extra-tube').onclick=askExtra;
async function recoverRewards(){
 try{const receipts=await rewarded.pending();if(!receipts.length)return;block('reward',true);for(const r of receipts){if(!await applyReceipt(r)){pendingReceipt=r;break;}}}
 catch{/* Offline/native bridge unavailability never blocks playing. */}
 finally{block('reward',false);}
}

function help(proven=deadRevision===state.revision){
 const a=attempt(state),buttons:{label:string;action:()=>void;primary?:boolean}[]=[];
 if(offerExtra(state))buttons.push({label:'Добавить колбу',primary:true,action:askExtra});
 if(a.history.length)buttons.push({label:'Отменить ход',primary:a.extra,action:()=>{activateGame();undo();}});
 buttons.push({label:'Заново',action:askRestart});
 modal(proven?'Решения нет':'Если застрял',
  (proven?'Из этой раскладки цвета уже не собрать. ':'')+(a.extra?'Дополнительная колба уже добавлена. Она останется при перезапуске.':offerExtra(state)?'Дополнительную колбу можно открыть за просмотр рекламы.':'Можно отменить ход или начать уровень заново.'),buttons);
 message(guidance());
}
$('rescue').onclick=()=>{audio.ui();help();};
function menu(){
 audio.ui();const body=modal('Уровни',`Пройдено ${state.completed.length} из ${levels.length}`,[{label:atHome?'В главное меню':'Продолжить игру',primary:true,action:close}]);
 const grid=document.createElement('div');grid.className='levels';
 levels.forEach((l,i)=>{const b=document.createElement('button'),done=state.completed.includes(l.id),available=done||i===0||i===state.current||state.completed.includes(levels[i-1].id);
  b.disabled=!available;b.textContent=String(i+1);b.classList.toggle('completed',done);if(i===state.current)b.setAttribute('aria-current','step');
  b.setAttribute('aria-label',`Уровень ${i+1}${l.goal?', большая бутылка':''}${done?', пройден':!available?', закрыт':''}`);
  const record=state.best?.[levelKey(i)],earned=record?stars(levelKey(i),record.history.length):done?1:0;if(isHard(i)){const difficulty=document.createElement('small');difficulty.className='level-hard';difficulty.textContent='Сложный';b.append(difficulty);}
  if(l.goal){const mechanic=document.createElement('small');mechanic.className='level-mechanic';mechanic.textContent='Большая цель';b.append(mechanic);}
  const mark=document.createElement('small');mark.className='level-stars';mark.textContent='★'.repeat(earned)+'☆'.repeat(3-earned);mark.setAttribute('aria-label',`${earned} из 3 звёзд`);b.append(mark);if(record){const best=document.createElement('small');best.textContent=`${record.history.length} ходов`;b.append(best);}b.onclick=()=>{audio.ui();switchLevel(i);};grid.append(b);
 });body.append(grid);
 if(!won(attempt(state).board,goalFor(state))){const helpButton=document.createElement('button');helpButton.className='help-button';helpButton.textContent='Если застрял';helpButton.onclick=()=>{audio.ui();help();};body.append(helpButton);}
 const note=document.createElement('p');note.className='build-note';note.textContent='Тестовый набор · подсказки без лимита';body.append(note);
}
$('menu').onclick=()=>{audio.ui();showHome();};
$('home-play').onclick=resumeGame;
$('home-levels').onclick=menu;
$('home-settings').onclick=settings;
function settings(){
 audio.ui();const body=modal('Настройки','',[{label:'Готово',primary:true,action:close}]);
 for(const [key,label]of Object.entries({sound:'Звуки',haptics:'Вибрация',fast:'Быстрое переливание',symbols:'Метки на цветах'})){
  const row=document.createElement('label');row.className='setting';const text=document.createElement('span');text.textContent=label;const input=document.createElement('input');input.type='checkbox';input.setAttribute('role','switch');input.checked=state.settings[key as keyof typeof state.settings]!==false;
  input.onchange=()=>{const n=structuredClone(state);n.settings[key as 'sound'|'haptics'|'fast'|'symbols']=input.checked;if(commit(n)){paint();audio.ui();haptic('ui');}else input.checked=!input.checked;};row.append(text,input);body.append(row);
 }
 const themes=document.createElement('fieldset');themes.className='theme-picker';const legend=document.createElement('legend');legend.textContent='Оформление';themes.append(legend);
 const choices=document.createElement('div');choices.className='theme-options';
 const selected=()=>{for(const b of choices.querySelectorAll<HTMLButtonElement>('button'))b.setAttribute('aria-pressed',String(b.dataset.themeChoice===themeFor(state.settings).id));};
 for(const theme of THEMES){const b=document.createElement('button');b.type='button';b.dataset.themeChoice=theme.id;b.textContent=theme.name;b.setAttribute('aria-label',theme.name);b.style.setProperty('--swatch',theme.color);
  b.onclick=()=>{const n=structuredClone(state);n.settings.theme=theme.id;n.settings.light=theme.light;if(commit(n)){paint();selected();audio.ui();}};choices.append(b);
 }
 themes.append(choices);body.append(themes);selected();
}
$('settings').onclick=settings;
reduced.addEventListener('change',()=>{interrupt();paint();});
document.addEventListener('click',event=>{const button=(event.target as Element).closest('button');if(button&&!button.disabled)haptic('ui');},{capture:true});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!dialog.open&&!atHome){e.preventDefault();showHome();}});
dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
document.addEventListener('visibilitychange',()=>{block('hidden',document.hidden);if(!document.hidden)message(guidance());});
window.addEventListener('pagehide',()=>block('page',true));window.addEventListener('pageshow',()=>block('page',false));
let previousSize='';const observer=new ResizeObserver(()=>{
 const width=$('board').clientWidth,height=$('board').clientHeight,key=`${width}x${height}`;if(key===previousSize)return;previousSize=key;
 interrupt();scene.setViewport(width,height,density);game.scale.resize(Math.round(width*density),Math.round(height*density));paint();message(guidance());
});observer.observe($('board'));
if(Capacitor.isNativePlatform()){
 void App.addListener('appStateChange',({isActive})=>{block('native',!isActive);if(isActive)message(guidance());});
 void App.addListener('backButton',()=>{if(dialog.open)close();else if(!atHome)showHome();else void App.exitApp();});
}
block('home',true);message(guidance());
if(loaded.recovered)message(guidance());
function startupIssue(){
 if(locked&&loaded.unavailable){showReadFailure();return;}
 if(loaded.corrupt)showCorrupt();
}
function showReadFailure(){modal('Прогресс недоступен','Не удалось прочитать сохранение. Прогресс не изменён. Проверь доступ к хранилищу и попробуй ещё раз.',[{label:'Повторить чтение',primary:true,action:()=>{
 const retry=store.load();
 if(retry.unavailable){showReadFailure();return;}
 state=retry.state;locked=retry.corrupt;recoveryNotice=retry.recovered?'Откат к резервной копии':'';
 if(retry.corrupt){showCorrupt();return;}
 interrupt();close();scene.reveal();
 }}]);}
function showCorrupt(){modal('Сохранение повреждено','Основная и резервная копии не читаются. Начать заново можно только после подтверждения.',[{label:'Начать заново',action:()=>{if(commit(state)){locked=false;close();}}}]);}
startupIssue();
if(!locked)void recoverRewards();
