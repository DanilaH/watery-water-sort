import { fresh, validSave, type Save } from '../core/session';
export interface StorageLike {getItem(k:string):string|null;setItem(k:string,v:string):void;}
const PRIMARY='water-sort-v1', BACKUP=PRIMARY+'-backup';
export class SaveStore {
  constructor(private storage: StorageLike) {}
  load(): {state:Save; recovered:boolean; corrupt:boolean} {
    let hadData=false;
    for(const key of [PRIMARY,BACKUP]) {
      const raw=this.storage.getItem(key); if(raw===null)continue;hadData=true;
      try {const state:unknown=JSON.parse(raw);if(validSave(state)){
        // Enter the new art direction once; subsequent explicit theme choices survive.
        if(state.artVersion===undefined){state.artVersion=4;state.settings.light=false;}
        return {state,recovered:key===BACKUP,corrupt:false};
      }}catch{/* Try backup, never accept an invalid snapshot. */}
    }
    return {state:fresh(),recovered:false,corrupt:hadData};
  }
  write(s:Save) {
    if(!validSave(s))throw new Error('Invalid save');
    const previous=this.storage.getItem(PRIMARY);
    if(previous){try {if(validSave(JSON.parse(previous)))this.storage.setItem(BACKUP,previous);}catch(e){if(e instanceof SyntaxError){}else throw e;}}
    // localStorage setItem is atomic. Publish only after it succeeds.
    this.storage.setItem(PRIMARY,JSON.stringify(s));
  }
}
