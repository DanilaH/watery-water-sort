import { fresh, validSave, type Save } from '../core/session';
export interface StorageLike {getItem(k:string):string|null;setItem(k:string,v:string):void;}
const PRIMARY='water-sort-v1', BACKUP=PRIMARY+'-backup';
export class SaveStore {
  constructor(private source: StorageLike | (()=>StorageLike)) {}
  private get storage(){return typeof this.source==='function'?this.source():this.source;}
  load(): {state:Save; recovered:boolean; corrupt:boolean; unavailable:boolean} {
    let hadData=false,unreadable=false;
    for(const key of [PRIMARY,BACKUP]) {
      let raw:string|null;
      try{raw=this.storage.getItem(key);}catch{unreadable=true;continue;}
      if(raw===null)continue;hadData=true;
      try {const state:unknown=JSON.parse(raw);if(validSave(state)){
        // Enter the new art direction once; subsequent explicit theme choices survive.
        if(state.artVersion===undefined){state.artVersion=4;state.settings.light=false;}
        return {state,recovered:!unreadable&&key===BACKUP,corrupt:false,unavailable:unreadable};
      }}catch{/* Try backup, never accept an invalid snapshot. */}
    }
    return {state:fresh(),recovered:false,corrupt:!unreadable&&hadData,unavailable:unreadable};
  }
  write(s:Save) {
    if(!validSave(s))throw new Error('Invalid save');
    const previous=this.storage.getItem(PRIMARY);
    if(previous){try {if(validSave(JSON.parse(previous)))this.storage.setItem(BACKUP,previous);}catch(e){if(e instanceof SyntaxError){}else throw e;}}
    // localStorage setItem is atomic. Publish only after it succeeds.
    this.storage.setItem(PRIMARY,JSON.stringify(s));
  }
}
