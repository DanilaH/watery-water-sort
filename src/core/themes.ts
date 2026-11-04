export const THEMES = [
 {id:'blue',name:'Синий',color:'#132039',light:false},
 {id:'plum',name:'Лагуна',color:'#21454d',light:false},
 {id:'graphite',name:'Графит',color:'#222934',light:false},
 {id:'ice',name:'Лёд',color:'#d8e6f4',light:true},
] as const;
export type ThemeId = typeof THEMES[number]['id'];
export const isTheme = (id:unknown):id is ThemeId => THEMES.some(t=>t.id===id);
// Existing saves keep their explicit light/dark preference; a missing theme is valid.
export function themeFor(settings:{theme?:ThemeId;light:boolean}){
 return THEMES.find(t=>t.id===settings.theme)??THEMES[settings.light?3:0];
}
