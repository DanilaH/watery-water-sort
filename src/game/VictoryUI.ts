/** Separate enter/idle wrappers let the idle wave continue without replaying the entry. */
export function renderVictoryTitle(node:HTMLElement,word:string){
 if(node.dataset.word===word)return;
 node.dataset.word=word;node.setAttribute('aria-label',word);node.replaceChildren();
 for(const [i,char]of [...word].entries()){
  const letter=document.createElement('span');letter.className='victory-letter';letter.style.setProperty('--i',String(i));letter.setAttribute('aria-hidden','true');
  const inner=document.createElement('span');inner.className='victory-letter-wave';inner.textContent=char===' '?'\u00a0':char;letter.append(inner);node.append(letter);
 }
}
export function starGlyph(index:number,filled:boolean,className:string){
 const star=document.createElement('span');star.className=className;star.style.setProperty('--i',String(index));star.setAttribute('aria-hidden','true');star.dataset.filled=String(filled);
 const inner=document.createElement('span');inner.className='star-spark';inner.textContent=filled?'★':'☆';star.append(inner);return star;
}
export function renderResultStars(node:HTMLElement,earned:number){
 if(node.dataset.earned===String(earned)&&node.children.length===3)return;
 node.dataset.earned=String(earned);node.replaceChildren(...Array.from({length:3},(_,i)=>starGlyph(i,i<earned,'result-star lit')));
}
export function renderPotentialStars(node:HTMLElement,earned:number){
 if(node.children.length!==3)node.replaceChildren(...Array.from({length:3},(_,i)=>starGlyph(i,true,'potential-star')));
 [...node.children].forEach((child,i)=>{
  const star=child as HTMLElement,filled=i<earned;
  if(star.dataset.filled!==String(filled)){star.classList.toggle('star-lost',!filled);star.dataset.filled=String(filled);star.firstElementChild!.textContent=filled?'★':'☆';}
 });
 node.setAttribute('aria-label',`Условия звёзд · сейчас ${earned} из 3`);
}
