import Phaser from 'phaser';
import { App } from '@capacitor/app';
import { Capacitor, registerPlugin } from '@capacitor/core';
const haptics=registerPlugin<{impact(options:{strong:boolean}):Promise<void>}>('FeelHaptics');
import './style.css';
import { Sound } from './audio/sound';
import { WaterScene } from './game/WaterScene';
import { moveFor, completeTube, won, type Move } from './core/rules';
import { attempt, levels, moved, undone, restarted, type Save } from './core/session';
import { SaveStore } from './platform/storage';
import type { Result } from './core/solver';
const $ = <T extends HTMLElement>(id:string)=>document.getElementById(id) as T;
const status=$('status'), dialog=$<HTMLDialogElement>('dialog'), content=$('dialog-content');
const audio=new Sound(),store=new SaveStore(localStorage);
void audio.load();
const loaded=store.load();let state=loaded.state,locked=loaded.corrupt;
const scene=new WaterScene('water');
let worker:Worker|undefined,requestId=0,queued:Move|null=null,lastMove:Move|null=null;
let hintCache:{revision:number;move:Move}|null=null;
const blockers=new Set<string>();
const game=new Phaser.Game({type:Phaser.AUTO,parent:'board',backgroundColor:'rgba(0,0,0,0)',transparent:true,antialias:true,scale:{mode:Phaser.Scale.RESIZE,width:$('board').clientWidth,height:$('board').clientHeight},scene:[scene],audio:{noAudio:true}});
function cancelSearch(){worker?.terminate();worker=undefined;requestId++;$('hint').removeAttribute('disabled');}
let winTimer:ReturnType<typeof setTimeout>|undefined;
function haptic(strong=false){if(Capacitor.isNativePlatform()&&state.settings.haptics!==false)void haptics.impact({strong}).catch(()=>{});}
function interrupt(){clearTimeout(winTimer);scene.skip();queued=null;cancelSearch();audio.stop();scene.selected=null;scene.hintMove=null;scene.setBoard(attempt(state).board);}
function block(reason:string,on:boolean){if(on){blockers.add(reason);interrupt();}else blockers.delete(reason);audio.block([...blockers].some(reason=>reason!=='dialog'));}
function commit(next:Save){try{store.write(next);state=next;return true;}catch{status.textContent='Не удалось сохранить. Ход не принят — попробуй ещё раз.';return false;}}
function paint(){
  scene.slots=levels[state.current].initial.length+1;scene.setBoard(attempt(state).board);scene.symbols=state.settings.symbols;scene.light=state.settings.light;audio.setEnabled(state.settings.sound);
  document.body.classList.toggle('light',state.settings.light);
  $('level-title').textContent=`Уровень ${state.current+1}`;$('moves').textContent=`Ходов: ${attempt(state).history.length}`;$('progress').textContent=`${state.current+1} / ${levels.length}`;
  ($('undo') as HTMLButtonElement).disabled=!attempt(state).history.length;
  $('symbols').setAttribute('aria-pressed',String(state.settings.symbols));
}
function message(text:string){status.textContent=text;}
function close(){dialog.close();block('dialog',false);paint();}
function modal(title:string,body:string,buttons:{label:string;action:()=>void;primary?:boolean}[]){
  block('dialog',true);dialog.classList.remove('victory');content.replaceChildren();const h=document.createElement('h2');h.textContent=title;content.append(h);
  if(body){const p=document.createElement('p');p.textContent=body;content.append(p);}
  for(const b of buttons){const el=document.createElement('button');el.textContent=b.label;el.className=b.primary?'primary':'';el.onclick=()=>{audio.prime();b.action();};content.append(el);}
  if(!dialog.open)dialog.showModal();
}
function switchLevel(index:number){scene.resetEffects();interrupt();const n=structuredClone(state);n.current=index;n.revision++;if(commit(n)){hintCache=null;close();paint();message(index<2?'Выбери колбу, затем перелей в пустую.':'Собери каждый цвет в отдельную колбу.');if(won(attempt(state).board))victory();}}
function victory(){
  const last=state.current===levels.length-1;
  modal(last?'Набор пройден':'Готово!',`Все цвета на своих местах. Ходов: ${attempt(state).history.length}.`,[
    {label:last?'К уровням':'Следующий уровень',primary:true,action:()=>last?menu():switchLevel(state.current+1)},
    {label:'Повторить',action:()=>{const n=restarted(state);if(commit(n)){close();paint();}}},
    {label:'Посмотреть поле',action:close}
  ]);
  dialog.classList.add('victory');
}
function accept(m:Move){
  if(locked||blockers.size)return;
  cancelSearch();const before=attempt(state).board;let next=moved(state,m);
  if(won(attempt(next).board)&&!next.completed.includes(levels[next.current].id))next.completed.push(levels[next.current].id);
  if(!commit(next))return;
  hintCache=null;scene.hintMove=null;scene.selected=null;lastMove=m;paint();scene.animate(before,m,state.settings.fast);message('');
}
scene.onTap=(i)=>{
  if(locked||blockers.size)return;audio.prime();
  if(i===null){scene.selected=null;return;}
  if(i>=attempt(state).board.length){modal('Дополнительная колба','В этой пробной сборке реклама ещё не подключена. Все уровни решаются без дополнительной колбы.',[{label:'Продолжить',primary:true,action:close}]);return;}
  if(scene.busyTube(i)){return;}
  if(scene.selected===i){scene.selected=null;audio.tap();return;}
  if(scene.selected!==null){const m=moveFor(attempt(state).board,scene.selected,i);if(m){
    if(scene.busy){queued=m;scene.hintMove=m;message('Следующий ход выбран');}else accept(m);return;
  }scene.reject(i);audio.reject();message('Нужен такой же верхний цвет и свободное место.');}
  if(attempt(state).board[i].length){scene.selected=i;audio.tap();haptic();}
};
scene.onPour=()=>{if(lastMove)audio.pour(state.settings.fast?154:269,lastMove.amount);};
scene.onComplete=()=>{
  const board=attempt(state).board;
  if(won(board)){
    const revision=state.revision;
    board.forEach((tube,index)=>{if(completeTube(tube))scene.celebrate(index,true);});
    haptic(true);
    winTimer=setTimeout(()=>{if(state.revision===revision&&!dialog.open&&!blockers.size){victory();audio.finish(true);}},120);return;
  }
  if(lastMove&&completeTube(board[lastMove.to])){scene.celebrate(lastMove.to);audio.finish(false);haptic(true);}else{audio.land();haptic();}
  message('Собери каждый цвет в отдельную колбу.');
  if(queued){const q=queued;queued=null;scene.hintMove=null;const valid=moveFor(board,q.from,q.to);if(valid)accept(valid);}
};
$('undo').onclick=()=>{interrupt();if(commit(undone(state))){hintCache=null;paint();audio.tap();message('Ход отменён');}};
$('restart').onclick=()=>modal('Начать заново?','Вернётся та же раскладка. Текущие ходы будут сброшены.',[{label:'Начать заново',primary:true,action:()=>{if(commit(restarted(state))){scene.resetEffects();hintCache=null;close();paint();message('Та же задача — новая попытка.');}}},{label:'Продолжить',action:close}]);
$('symbols').onclick=()=>{const n=structuredClone(state);n.settings.symbols=!n.settings.symbols;if(commit(n))paint();};
$('hint').onclick=()=>{
  if(scene.busy||blockers.size||locked)return;audio.prime();
  if(hintCache?.revision===state.revision){scene.hintMove=hintCache.move;message('Перелей из выделенной колбы в отмеченную.');return;}
  if(won(attempt(state).board)){victory();return;}
  cancelSearch();const id=++requestId,revision=state.revision;worker=new Worker(new URL('./core/solver.worker.ts',import.meta.url),{type:'module'});
  ($('hint') as HTMLButtonElement).disabled=true;message('Ищу продолжение…');
  worker.onmessage=(event:MessageEvent<{result:Result;revision:number;requestId:number}>)=>{
    if(event.data.requestId!==id||event.data.revision!==state.revision)return;
    const result=event.data.result;cancelSearch();
    if(result.status==='FOUND'&&result.path.length){scene.hintMove=result.path[0];hintCache={revision,move:result.path[0]};audio.hint();message('Перелей из выделенной колбы в отмеченную.');}
    else message(result.status==='UNSOLVABLE'?'Из этого положения решения нет. Можно отменить ходы.':'Из этого положения решение не найдено. Попробуй отменить ход.');
  };
  worker.onerror=()=>{cancelSearch();message('Подсказка недоступна. Можно продолжить или отменить ход.');};
  worker.postMessage({board:attempt(state).board,revision,requestId:id});
};
function menu(){
  modal('Переливы','Пробная сборка: 12 уровней, подсказки без лимита. Реклама и дополнительная колба пока недоступны.',[{label:'Продолжить',primary:true,action:()=>{close();if(won(attempt(state).board))victory();}}]);
  const grid=document.createElement('div');grid.className='levels';
  levels.forEach((l,i)=>{const b=document.createElement('button');b.textContent=`${i+1}${state.completed.includes(l.id)?' ✓':''}`;b.disabled=i>0&&!state.completed.includes(levels[i-1].id);b.onclick=()=>switchLevel(i);grid.append(b);});content.append(grid);
}
$('menu').onclick=menu;
$('settings').onclick=()=>{
  modal('Настройки','',[{label:'Готово',primary:true,action:close}]);
  for(const [key,label] of Object.entries({sound:'Звуки',haptics:'Вибрация',fast:'Быстрое переливание',symbols:'Символы на цветах',light:'Светлая тема'})){
    const row=document.createElement('label');row.className='setting';row.textContent=label;const input=document.createElement('input');input.type='checkbox';input.checked=state.settings[key as keyof typeof state.settings]!==false;input.onchange=()=>{const n=structuredClone(state);n.settings[key as keyof typeof state.settings]=input.checked;if(commit(n))paint();else input.checked=!input.checked;};row.append(input);content.insertBefore(row,content.lastChild);
  }
};
dialog.addEventListener('cancel',e=>{e.preventDefault();if(!locked)close();});
document.addEventListener('visibilitychange',()=>block('hidden',document.hidden));
window.addEventListener('pagehide',()=>block('page',true));window.addEventListener('pageshow',()=>block('page',false));
const observer=new ResizeObserver(()=>{interrupt();game.scale.resize($('board').clientWidth,$('board').clientHeight);paint();});observer.observe($('board'));
if(Capacitor.isNativePlatform()){
  void App.addListener('appStateChange',({isActive})=>block('native',!isActive));
  void App.addListener('backButton',()=>{if(dialog.open){if(!locked)close();}else menu();});
}
paint();
if(loaded.recovered)message('Прогресс восстановлен из резервной копии.');
if(loaded.corrupt)modal('Сохранение повреждено','Основная и резервная копии не читаются. Начать заново можно только после подтверждения.',[{label:'Начать заново',action:()=>{if(commit(state)){locked=false;close();}}}]);
// Browser automation observes public UI; no production mutation/debug bridge.
