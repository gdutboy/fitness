import { breakfasts, dinners, lunches, recipeById } from './data.js';
export const STORAGE_KEY = 'huanbao.fitness.v1';
export const SCHEMA = 1;
export const localDate = (date=new Date()) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
export function validDate(value) { if(!/^\d{4}-\d{2}-\d{2}$/.test(value||'')) return false; const d=new Date(value+'T12:00:00'); return !isNaN(d)&&localDate(d)===value; }
export function addDays(key,n) { const d=new Date(key+'T12:00:00'); d.setDate(d.getDate()+n); return localDate(d); }
export function dayDiff(a,b) { return Math.round((Date.parse(a+'T00:00:00Z')-Date.parse(b+'T00:00:00Z'))/86400000); }
export function monday(key) {const d=new Date(key+'T12:00:00');return addDays(key,-((d.getDay()+6)%7));}
export function freshState() {return {schema:SCHEMA,profile:{name:'环宝',height:null,age:null,startWeight:null,targetWeight:null},days:{},shopping:{},savedAt:null};}
export function blankDay() {return {meals:{},swaps:{},stairs:0,minutes:null,exercise:'',feeling:'normal',period:false,weight:null,note:''};}
export function getDay(state,date) {return state.days[date] || blankDay();}
export function planFor(date,day=blankDay()) {
 const n=((dayDiff(date,'2026-01-05')%28)+28)%28, weekday=new Date(date+'T12:00:00').getDay();
 const base={breakfast:breakfasts[(n+Math.floor(n/7))%breakfasts.length],lunch:weekday===0||weekday===6?dinners[(n+5)%dinners.length]:lunches[weekday-1],dinner:dinners[(n+Math.floor(n/7)*3)%dinners.length]};
 for(const slot of Object.keys(base)) {const id=day.swaps?.[slot]; if(id&&optionsFor(slot,date).some(r=>r.id===id))base[slot]=recipeById[id];}
 return base;
}
export function optionsFor(slot,date) {return slot==='breakfast'?breakfasts:slot==='dinner'?dinners:[0,6].includes(new Date(date+'T12:00:00').getDay())?dinners:lunches;}
export function workoutFor(date,day=blankDay()) {
 if(day.feeling==='pain') return {kind:'recovery',title:'今天，让身体缓一缓',sub:'暂停引起疼痛的动作。可休息或轻柔活动；疼痛持续时及时咨询医生。',target:0,label:'休息也算照顾自己'};
 if(day.feeling==='tired') return {kind:'recovery',title:'轻松恢复日',sub:'按体感减少或跳过爬楼，舒缓活动即可。今天不追次数。',target:0,label:'恢复完成'};
 const weekday=new Date(date+'T12:00:00').getDay();
 if(weekday===1||weekday===4)return {kind:'strength',title:'轻力量 · 15 分钟',sub:'用全身力量练习替换部分爬楼。晚间爬楼可做 0–2 次，不额外叠加。',target:2,label:'力量练习完成'};
 if(weekday===0)return {kind:'recovery',title:'给自己一个恢复日',sub:'散步、舒缓活动或完整休息均可。今天无需爬满三次。',target:0,label:'休息也算照顾自己'};
 return {kind:'stairs',title:'晚间爬楼 · 约 20 分钟',sub:'约 20:00 开始，每次 30 层、共 3 次，记录实际用时。饭后按舒适程度开始，不赶时间。',target:3,label:'晚间活动完成'};
}
export function completion(day) {return Object.values(day.meals||{}).filter(Boolean).length+(day.exercise?1:0);}
export function weeklyStats(state,date) {const start=monday(date),today=localDate(); const dates=Array.from({length:7},(_,i)=>addDays(start,i)).filter(d=>d<=today);const total=dates.reduce((n,d)=>n+completion(getDay(state,d)),0);return {days:dates.filter(d=>completion(getDay(state,d))>0).length,total,possible:dates.length*4,percent:dates.length?Math.round(total/(dates.length*4)*100):0};}
export function shoppingList(state,date) {const items=new Map(),start=monday(date);for(let i=0;i<7;i++){const key=addDays(start,i),plan=planFor(key,getDay(state,key));for(const recipe of Object.values(plan)){if(recipe.type==='canteen')continue;for(const [name,amount,unit] of recipe.ingredients){const id=`${name}|${unit}`,prev=items.get(id);items.set(id,{id,name,amount:Math.round(((prev?.amount||0)+amount)*10)/10,unit});}}}return [...items.values()].sort((a,b)=>a.name.localeCompare(b.name,'zh-CN'));}
export function validateState(input) {
 const fail=()=>{throw new Error('备份格式不正确，未更改当前记录。');};
 if(!input||typeof input!=='object'||input.schema!==SCHEMA||!input.profile||!input.days||typeof input.days!=='object'||Array.isArray(input.days))fail();
 const state=freshState(),p=input.profile;
 if(typeof p.name!=='string'||p.name.length>24)fail();state.profile.name=p.name;
 for(const [key,min,max] of [['height',120,220],['age',18,100],['startWeight',30,250],['targetWeight',30,250]]) { const v=p[key]; if(v!=null&&(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max))fail();state.profile[key]=v??null; }
 if(Object.keys(input.days).length>20000)fail();
 for(const [date,raw] of Object.entries(input.days)) {
  if(!validDate(date)||!raw||typeof raw!=='object')fail();const d=blankDay();
  if(!Number.isInteger(raw.stairs)||raw.stairs<0||raw.stairs>3)fail();d.stairs=raw.stairs;
  if(!['','done','partial','rest'].includes(raw.exercise)||!['normal','tired','pain'].includes(raw.feeling))fail();d.exercise=raw.exercise;d.feeling=raw.feeling;
  if(typeof raw.period!=='boolean')fail();d.period=raw.period;
  for(const [k,min,max] of [['weight',30,250],['minutes',0,240]]){if(raw[k]!=null&&(typeof raw[k]!=='number'||!Number.isFinite(raw[k])||raw[k]<min||raw[k]>max))fail();d[k]=raw[k]??null;}
  if(typeof raw.note!=='string'||raw.note.length>500)fail();d.note=raw.note;
  for(const slot of ['breakfast','lunch','dinner']) {const m=raw.meals?.[slot];if(m!==undefined&&!['done','swap','actual',''].includes(m))fail();if(m)d.meals[slot]=m;const id=raw.swaps?.[slot];if(id!==undefined&&!optionsFor(slot,date).some(r=>r.id===id))fail();if(id)d.swaps[slot]=id;}
  state.days[date]=d;
 }
 if(input.shopping&&typeof input.shopping==='object'&&!Array.isArray(input.shopping)){for(const [k,v]of Object.entries(input.shopping)){if(k.length>120||typeof v!=='boolean')fail();state.shopping[k]=v;}}
 state.savedAt=typeof input.savedAt==='string'?input.savedAt:null;return state;
}
export function readState(storage) {const raw=storage.getItem(STORAGE_KEY);return raw?validateState(JSON.parse(raw)):freshState();}
export function persist(storage,state) {const clean=validateState(state);clean.savedAt=new Date().toISOString();storage.setItem(STORAGE_KEY,JSON.stringify(clean));return clean;}
export function mergeStates(current,incoming) {const next=structuredClone(current);next.profile=incoming.profile;next.days={...current.days,...incoming.days};next.shopping={...current.shopping,...incoming.shopping};return validateState(next);}
export function weightTrend(state) {return Object.entries(state.days).filter(([,d])=>d.weight!=null).sort(([a],[b])=>a.localeCompare(b)).map(([date,d])=>({date,weight:d.weight}));}
