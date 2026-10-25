import Phaser from 'phaser';
import { App } from '@capacitor/app';
import { Capacitor, registerPlugin } from '@capacitor/core';
import './style.css';
import { Sound } from './audio/sound';
import { WaterScene } from './game/WaterScene';
import { moveFor, completeTube, won, moves, type Move } from './core/rules';
import { attempt, levels, moved, undone, restarted, type Save } from './core/session';
import { SaveStore } from './platform/storage';
import type { Result } from './core/solver';
const haptics=registerPlugin<{impact(options:{strong:boolean}):Promise<void>}>('FeelHaptics');
const $=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T;
const dialog=$<HTMLDialogElement>('dialog'),content=$('dialog-content'),audio=new Sound(),store=new SaveStore(localStorage);
void audio.load();
const loaded=store.load();let state=loaded.state,locked=loaded.corrupt;
const scene=new WaterScene('water');
const density=Math.min(2,Math.max(1,devicePixelRatio));
scene.setViewport($('board').clientWidth,$('board').clientHeight,density);
const game=new Phaser.Game({type:Phaser.AUTO,parent:'board',transparent:true,antialias:true,scale:{mode:Phaser.Scale.NONE,width:Math.round($('board').clientWidth*density),height:Math.round($('board').clientHeight*density)},scene:[scene],audio:{noAudio:true}});
let worker:Worker|undefined,requestId=0,searching=false,queued:Move|null=null,lastMove:Move|null=null,kind:'pour'|'undo'='pour';
let hintCache:{revision:number;move:Move}|null=null;
const blockers=new Set<string>();
function haptic(strong=false){if(Capacitor.isNativePlatform()&&state.settings.haptics!==false)void haptics.impact({strong}).catch(()=>{});}
function message(text:string){$('status').textContent=text;}
function guidance(){
 if(won(attempt(state).board))return 'Все цвета собраны';
 if(queued)return 'Следующий ход выбран · тап по фону отменит его';
 if(!scene.busy&&!moves(attempt(state).board).length)return 'Нет доступных ходов · можно отменить ход';
 if(scene.hintMove)return 'Перелей в колбу со стрелкой';
 if(scene.selected!==null)return scene.busy?'Следующий ход: выбери колбу назначения':'Выбери пустую колбу или такой же верхний цвет';
 if(state.current===0&&attempt(state).history.length===0)return 'Выбери цветную колбу, затем пустую';
 if(state.current<2)return 'Переливается вся верхняя группа одного цвета';
 return '';
}
function cancelSearch(){worker?.terminate();worker=undefined;requestId++;searching=false;}
function clearIntent(){queued=null;scene.queuedMove=null;scene.selected=null;scene.hintMove=null;}
function interrupt(){scene.resetEffects();clearIntent();cancelSearch();audio.stop();scene.setBoard(attempt(state).board);}
function block(reason:string,on:boolean){if(on){blockers.add(reason);interrupt();}else blockers.delete(reason);audio.block([...blockers].some(x=>x!=='dialog'));paint();}
function commit(next:Save){try{store.write(next);state=next;return true;}catch{message('Не удалось сохранить. Ход не принят — попробуй ещё раз.');return false;}}
function paint(){
 const a=attempt(state),finished=won(a.board)&&!scene.busy;
 scene.slots=a.board.length;scene.setBoard(a.board);scene.symbols=state.settings.symbols;scene.light=state.settings.light;audio.setEnabled(state.settings.sound);
 document.body.classList.toggle('light',state.settings.light);document.body.classList.toggle('finished',finished);
 $('level-title').textContent=`Уровень ${state.current+1}`;$('moves').textContent=`Ходов: ${a.history.length}`;$('progress').textContent=`${state.current+1} / ${levels.length}`;
 ($('undo') as HTMLButtonElement).disabled=!a.history.length;
 ($('hint') as HTMLButtonElement).disabled=scene.busy||searching||finished;
 $('symbols').setAttribute('aria-pressed',String(state.settings.symbols));
 $('continue').hidden=!finished;
 $('continue').textContent=state.current===levels.length-1?'К уровням →':'Дальше →';
 $('finish-title').hidden=!finished;$('finish-title').textContent=state.current===levels.length-1?'Набор пройден':'Готово!';
 if(finished)message(`Все цвета собраны · ходов: ${a.history.length}`);
}
function close(){if(locked)return;dialog.close();block('dialog',false);message(guidance());}
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
function switchLevel(index:number){
 interrupt();const n=structuredClone(state);n.current=index;n.revision++;
 if(commit(n)){hintCache=null;dialog.close();blockers.delete('dialog');audio.block(blockers.size>0);paint();scene.reveal();message(guidance());}
}
function restart(){const n=restarted(state);if(commit(n)){interrupt();hintCache=null;dialog.close();blockers.delete('dialog');audio.block(false);paint();scene.reveal();message('Та же задача — новая попытка');}}
function drainQueue(){if(!queued)return;const q=queued;clearIntent();const m=moveFor(attempt(state).board,q.from,q.to);if(m)accept(m);}
function accept(m:Move){
 if(locked||blockers.size)return;
 cancelSearch();const before=attempt(state).board;const next=moved(state,m);
 if(won(attempt(next).board)&&!next.completed.includes(levels[next.current].id))next.completed.push(levels[next.current].id);
 if(!commit(next))return;
 hintCache=null;clearIntent();lastMove=m;kind='pour';scene.setBoard(attempt(state).board);scene.animate(before,m,state.settings.fast);paint();message('');
}
scene.onTap=(i)=>{
 if(locked||blockers.size||won(attempt(state).board))return;
 if(searching){cancelSearch();paint();}audio.prime();
 if(i===null){clearIntent();message(guidance());return;}
 const board=attempt(state).board;if(i>=board.length)return;
 // One future intention, based on the already committed board. Busy cells are valid inputs.
 if(queued)clearIntent();
 if(scene.selected===i){clearIntent();audio.tap();message(guidance());return;}
 if(scene.selected!==null){const m=moveFor(board,scene.selected,i);
  if(m){
   if(scene.busy){queued=m;scene.queuedMove=m;scene.hintMove=null;audio.tap();haptic();message(guidance());}
   else accept(m);
   return;
  }
 }
 scene.hintMove=null;scene.queuedMove=null;
 if(board[i].length){scene.selected=i;audio.tap();haptic();message(guidance());}
 else{scene.selected=null;scene.reject(i);audio.reject();message('Сначала выбери цветную колбу');}
};
scene.onPour=()=>{if(lastMove&&kind==='pour')audio.pour(state.settings.fast?154:269,lastMove.amount);};
scene.onComplete=()=>{
 const board=attempt(state).board;
 if(kind==='undo'){audio.land();paint();message(guidance());drainQueue();return;}
 if(won(board)){
  if(lastMove)scene.celebrate(lastMove.to,true);audio.finish(true);haptic(true);paint();return;
 }
 if(lastMove&&completeTube(board[lastMove.to])){scene.celebrate(lastMove.to);audio.finish(false,board.filter(completeTube).length-1);haptic(true);}else{audio.land();haptic();}
 paint();message(guidance());
 drainQueue();
};
$('undo').onclick=()=>{
 const a=attempt(state),m=a.history.at(-1);if(!m)return;const before=a.board;
 interrupt();if(commit(undone(state))){hintCache=null;kind='undo';lastMove=null;scene.setBoard(attempt(state).board);scene.animate(before,{from:m.to,to:m.from,amount:m.amount,color:m.color},true);audio.undo();paint();message('Возвращаем предыдущий ход');}
};
$('restart').onclick=()=>{audio.ui();if(!attempt(state).history.length){restart();return;}modal('Начать заново?','Вернётся та же раскладка. Текущие ходы будут сброшены.',[{label:'Начать заново',primary:true,action:restart},{label:'Продолжить',action:close}]);};
$('continue').onclick=()=>{audio.ui();if(state.current===levels.length-1)menu();else switchLevel(state.current+1);};
$('symbols').onclick=()=>{const n=structuredClone(state);n.settings.symbols=!n.settings.symbols;if(commit(n)){paint();audio.ui();}};
function showHint(m:Move){clearIntent();scene.selected=m.from;scene.hintMove=m;audio.hint();message(guidance());}
$('hint').onclick=()=>{
 if(scene.busy||blockers.size||locked||won(attempt(state).board))return;audio.prime();
 if(hintCache?.revision===state.revision){showHint(hintCache.move);return;}
 cancelSearch();const id=++requestId,revision=state.revision;searching=true;paint();message('Ищу продолжение…');
 worker=new Worker(new URL('./core/solver.worker.ts',import.meta.url),{type:'module'});
 worker.onmessage=(event:MessageEvent<{result:Result;revision:number;requestId:number}>)=>{
  if(event.data.requestId!==id||event.data.revision!==state.revision)return;
  const result=event.data.result;cancelSearch();paint();
  if(result.status==='FOUND'&&result.path.length){hintCache={revision,move:result.path[0]};showHint(result.path[0]);}
  else message(result.status==='UNSOLVABLE'?'Из этого положения решения нет. Можно отменить ходы.':'Решение пока не найдено. Попробуй отменить ход.');
 };
 worker.onerror=()=>{cancelSearch();paint();message('Подсказка недоступна. Можно продолжить или отменить ход.');};
 worker.postMessage({board:attempt(state).board,revision,requestId:id});
};
function menu(){
 audio.ui();const body=modal('Уровни',`Пройдено ${state.completed.length} из ${levels.length}`,[{label:won(attempt(state).board)&&state.current<levels.length-1?'Следующий уровень':'Продолжить',primary:true,action:()=>won(attempt(state).board)&&state.current<levels.length-1?switchLevel(state.current+1):close()}]);
 const grid=document.createElement('div');grid.className='levels';
 levels.forEach((l,i)=>{const b=document.createElement('button'),done=state.completed.includes(l.id),available=i===0||i===state.current||state.completed.includes(levels[i-1].id);
  b.disabled=!available;b.textContent=String(i+1);b.classList.toggle('completed',done);if(i===state.current)b.setAttribute('aria-current','step');
  b.setAttribute('aria-label',`Уровень ${i+1}${done?', пройден':!available?', закрыт':''}`);
  const mark=document.createElement('small');mark.textContent=done?'✓':i===state.current?'Сейчас':!available?'Закрыт':'';b.append(mark);b.onclick=()=>{audio.ui();switchLevel(i);};grid.append(b);
 });body.append(grid);
 const note=document.createElement('p');note.className='build-note';note.textContent='Тестовый набор · подсказки без лимита';body.append(note);
}
$('menu').onclick=menu;
$('settings').onclick=()=>{
 audio.ui();const body=modal('Настройки','',[{label:'Готово',primary:true,action:close}]);
 for(const [key,label]of Object.entries({sound:'Звуки',haptics:'Вибрация',fast:'Быстрое переливание',symbols:'Символы на цветах',light:'Светлая тема'})){
  const row=document.createElement('label');row.className='setting';const text=document.createElement('span');text.textContent=label;const input=document.createElement('input');input.type='checkbox';input.setAttribute('role','switch');input.checked=state.settings[key as keyof typeof state.settings]!==false;
  input.onchange=()=>{const n=structuredClone(state);n.settings[key as keyof typeof state.settings]=input.checked;if(commit(n)){paint();audio.ui();}else input.checked=!input.checked;};row.append(text,input);body.append(row);
 }
};
dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
document.addEventListener('visibilitychange',()=>{block('hidden',document.hidden);if(!document.hidden)message(guidance());});
window.addEventListener('pagehide',()=>block('page',true));window.addEventListener('pageshow',()=>block('page',false));
let previousSize='';const observer=new ResizeObserver(()=>{
 const width=$('board').clientWidth,height=$('board').clientHeight,key=`${width}x${height}`;if(key===previousSize)return;previousSize=key;
 interrupt();scene.setViewport(width,height,density);game.scale.resize(Math.round(width*density),Math.round(height*density));paint();message(guidance());
});observer.observe($('board'));
if(Capacitor.isNativePlatform()){
 void App.addListener('appStateChange',({isActive})=>{block('native',!isActive);if(isActive)message(guidance());});
 void App.addListener('backButton',()=>dialog.open?close():menu());
}
paint();message(guidance());
if(loaded.recovered)message('Прогресс восстановлен из резервной копии');
if(loaded.corrupt)modal('Сохранение повреждено','Основная и резервная копии не читаются. Начать заново можно только после подтверждения.',[{label:'Начать заново',action:()=>{if(commit(state)){locked=false;close();}}}]);
