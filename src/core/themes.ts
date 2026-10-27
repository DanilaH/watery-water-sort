export const THEMES = [
 {id:'blue',name:'Синий',color:'#1b3272',light:false},
 {id:'plum',name:'Сливовый',color:'#42265f',light:false},
 {id:'graphite',name:'Графит',color:'#292f3a',light:false},
 {id:'ice',name:'Лёд',color:'#edf5ff',light:true},
] as const;
export type ThemeId = typeof THEMES[number]['id'];
export const isTheme = (id:unknown):id is ThemeId => THEMES.some(t=>t.id===id);
// Existing saves keep their explicit light/dark preference; a missing theme is valid.
export function themeFor(settings:{theme?:ThemeId;light:boolean}){
 return THEMES.find(t=>t.id===settings.theme)??THEMES[settings.light?3:0];
}
