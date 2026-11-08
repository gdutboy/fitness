import test from 'node:test';
import assert from 'node:assert/strict';
import {allRecipes} from '../data.js';
import {localDate,validDate,addDays,monday,dayDiff,freshState,blankDay,planFor,optionsFor,workoutFor,shoppingList,validateState,persist,mergeStates,weightTrend,weeklyStats,STORAGE_KEY} from '../core.js';

test('local dates survive month boundaries, leap dates and week rollover',()=>{
 assert.equal(addDays('2026-12-31',1),'2027-01-01');assert.equal(monday('2026-11-08'),'2026-11-02');assert.equal(dayDiff('2026-04-05','2026-04-01'),4);assert.equal(validDate('2026-02-30'),false);assert.equal(validDate('2028-02-29'),true);
});
test('28-day schedule is deterministic and uses canteen only on weekdays',()=>{
 const signatures=new Set();for(let i=0;i<28;i++){const date=addDays('2026-11-02',i),p=planFor(date);signatures.add(Object.values(p).map(r=>r.id).join());assert.deepEqual(p,planFor(addDays(date,28)));const wd=new Date(date+'T12:00:00').getDay();assert.equal(p.lunch.type==='canteen',wd!==0&&wd!==6);for(const r of Object.values(p))assert.ok(r.steps.length>=2);}
 assert.ok(signatures.size>=25);
});
test('every home recipe includes consistent shopping quantities and cooking guidance',()=>{
 assert.equal(new Set(allRecipes.map(r=>r.id)).size,allRecipes.length);
 for(const r of allRecipes){if(r.type==='home'){assert.ok(r.ingredients.length>=3);for(const [name,q,u] of r.ingredients){assert.equal(typeof name,'string');assert.ok(q>0);assert.equal(typeof u,'string');}assert.ok(r.time>0);}}
});
test('meal swap survives serialization and is restricted to its meal category',()=>{
 const state=freshState(),date='2026-11-05';state.days[date]=blankDay();state.days[date].swaps.dinner='d7';assert.equal(planFor(date,validateState(JSON.parse(JSON.stringify(state))).days[date]).dinner.id,'d7');state.days[date].swaps.dinner='b1';assert.throws(()=>validateState(state));
});
test('shopping aggregation excludes weekday canteen and responds to selected swaps',()=>{
 const state=freshState(),date='2026-11-02';const before=shoppingList(state,date);assert.ok(before.length>10);assert.ok(before.every(i=>i.amount>0));assert.equal(new Set(before.map(i=>i.id)).size,before.length);state.days[date]=blankDay();const old=planFor(date).breakfast.id;state.days[date].swaps.breakfast=optionsFor('breakfast',date).find(r=>r.id!==old).id;assert.notDeepEqual(shoppingList(state,date),before);
});
test('strength replaces stairs and pain overrides planned training without forcing period changes',()=>{
 assert.equal(workoutFor('2026-11-02').kind,'strength');assert.equal(workoutFor('2026-11-03').target,3);assert.equal(workoutFor('2026-11-08').target,0);const d=blankDay();d.period=true;assert.equal(workoutFor('2026-11-03',d).target,3);d.feeling='pain';assert.equal(workoutFor('2026-11-03',d).target,0);
});
test('private health profile starts empty and no menstrual dates are seeded',()=>{const state=freshState();assert.equal(state.profile.height,null);assert.equal(state.profile.startWeight,null);assert.deepEqual(state.days,{});});
test('backup validation rejects corrupt values, impossible dates and unsafe swaps',()=>{
 for(const change of [s=>s.schema=99,s=>s.profile.height=Infinity,s=>s.days['2026-02-30']=blankDay(),s=>{s.days['2026-11-02']={...blankDay(),stairs:90};},s=>{s.days['2026-11-02']={...blankDay(),note:'x'.repeat(501)};},s=>{s.days['2026-11-02']={...blankDay(),weight:-1};}]){const s=freshState();change(s);assert.throws(()=>validateState(s));}
});
test('round-trip preserves personal logs; merging retains distinct days and explicitly overwrites conflicts',()=>{
 const current=freshState();current.days['2026-11-01']={...blankDay(),note:'keep'};current.days['2026-11-02']={...blankDay(),note:'old'};const incoming=freshState();incoming.days['2026-11-02']={...blankDay(),weight:61,period:true,note:'incoming'};const result=mergeStates(current,validateState(JSON.parse(JSON.stringify(incoming))));assert.equal(result.days['2026-11-01'].note,'keep');assert.equal(result.days['2026-11-02'].note,'incoming');assert.equal(result.days['2026-11-02'].period,true);assert.equal(current.days['2026-11-02'].note,'old');
});
test('storage namespace is separate and failed writes leave caller state unchanged',()=>{
 const s=freshState(),writes=[];const result=persist({setItem:(key,value)=>writes.push([key,value])},s);assert.equal(writes[0][0],STORAGE_KEY);assert.ok(result.savedAt);assert.equal(s.savedAt,null);assert.throws(()=>persist({setItem:()=>{throw new Error('quota');}},s));assert.equal(s.savedAt,null);
});
test('weight trend includes only real entries and sorts calendar order',()=>{
 const s=freshState();s.days['2026-11-03']={...blankDay(),weight:61.5};s.days['2026-11-01']={...blankDay(),weight:62};s.days['2026-11-02']=blankDay();assert.deepEqual(weightTrend(s).map(p=>p.date),['2026-11-01','2026-11-03']);
});
test('weekly record rate excludes future days, allows partial exercise and undo',()=>{
 const today=localDate(),s=freshState();s.days[today]={...blankDay(),meals:{breakfast:'done'},exercise:'partial'};const stats=weeklyStats(s,today);assert.equal(stats.days,1);assert.equal(stats.total,2);s.days[today].meals={};s.days[today].exercise='';assert.equal(weeklyStats(s,today).total,0);assert.equal(weeklyStats(s,addDays(today,14)).possible,0);
});
