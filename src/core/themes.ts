export const THEMES = [
 {id:'blue',name:'Синий',color:'#15295d',light:false},
 {id:'plum',name:'Сливовый',color:'#351e4f',light:false},
 {id:'graphite',name:'Графит',color:'#222934',light:false},
 {id:'ice',name:'Лёд',color:'#edf5ff',light:true},
] as const;
export type ThemeId = typeof THEMES[number]['id'];
export const isTheme = (id:unknown):id is ThemeId => THEMES.some(t=>t.id===id);
// Existing saves keep their explicit light/dark preference; a missing theme is valid.
export function themeFor(settings:{theme?:ThemeId;light:boolean}){
 return THEMES.find(t=>t.id===settings.theme)??THEMES[settings.light?3:0];
}
