// Local DOM component tests, not a substitute for real-browser visual QA.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import * as core from '../core.js';
import * as data from '../data.js';
const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
const source=(await readFile(new URL('../app.js',import.meta.url),'utf8')).replace(/^import .*?;\n/gm,'');
function app(t,route='today',raw=null){
 const dom=new JSDOM(html,{url:`https://fitness.test/fitness/#${route}`,runScripts:'outside-only'}),w=dom.window,errors=[];
 Object.assign(w,core,{createSync:()=>({sync:async()=>{},changed:()=>{}}),recipeById:data.recipeById,moves:data.moves,structuredClone});
 w.scrollTo=()=>{};
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
 w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};
 if(raw)w.localStorage.setItem(core.STORAGE_KEY,raw);
 w.addEventListener('error',e=>{errors.push(e.message);});
 w.eval(source);
 t.after(()=>{assert.deepEqual(errors,[]);w.close();});
 const q=s=>{const el=w.document.querySelector(s);assert.ok(el,`missing ${s}`);return el;};
 return {w,q,click:s=>q(s).click(),saved:()=>JSON.parse(w.localStorage.getItem(core.STORAGE_KEY)),submit:s=>q(s).dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}))};
}
test('all four screens render without script errors or undefined content',t=>{
 for(const route of ['today','meals','exercise','records']){const a=app(t,route);assert.ok(a.q('#main').textContent.length>100);assert.equal(a.q('#main').textContent.includes('undefined'),false);assert.equal(a.q(`#navigation a[href="#${route}"]`).getAttribute('aria-current'),'page');}
});
test('meal check-in, reload and undo preserve the correct date',t=>{
 const a=app(t);a.click('[data-action="meal"][data-slot="breakfast"]');a.click('[data-action="meal-save"][data-value="done"]');assert.equal(a.saved().days[core.localDate()].meals.breakfast,'done');
 const b=app(t,'today',JSON.stringify(a.saved()));assert.ok(b.q('[data-action="meal"][data-slot="breakfast"]').classList.contains('checked'));b.click('[data-action="meal"][data-slot="breakfast"]');b.click('[data-action="meal-save"][data-value=""]');assert.equal(b.saved().days[core.localDate()].meals.breakfast,undefined);
});
test('meal swap updates displayed recipe and saved state; shopping list opens',t=>{
 const a=app(t,'meals');a.click('[data-action="swap"][data-slot="dinner"]');const option=a.q('.swap-option:not(.selected)'),id=option.dataset.id;option.click();assert.equal(a.saved().days[core.localDate()].swaps.dinner,id);assert.ok(a.q('#main').textContent.includes(data.recipeById[id].name));a.click('[data-action="shopping"]');assert.ok(a.w.document.querySelectorAll('.shop-item').length>10);const check=a.q('[data-shopping]');check.click();assert.equal(a.saved().shopping[check.dataset.shopping],true);
});
test('exercise records three rounds and minutes, recovery selection changes advice',t=>{
 const a=app(t,'exercise');a.click('[data-action="stairs"][data-count="3"]');assert.equal(a.saved().days[core.localDate()].stairs,3);a.q('#minutes').value='20';a.submit('#minutes-form');assert.equal(a.saved().days[core.localDate()].minutes,20);a.click('[data-action="feeling"][data-value="pain"]');assert.ok(a.q('#main').textContent.includes('暂停引起疼痛的动作'));a.click('#period-checkbox');assert.equal(a.saved().days[core.localDate()].period,true);a.click('[data-action="exercise-log"]');a.click('[data-action="exercise-save"][data-value="rest"]');assert.equal(a.saved().days[core.localDate()].exercise,'rest');
});
test('profile converts jin to kg and refuses an underweight target',t=>{
 const a=app(t);a.click('#settings-button');a.q('#profile-height').value='170';a.q('#profile-age').value='40';a.q('#profile-start').value='140';a.q('#profile-target').value='120';a.submit('#profile-form');assert.equal(a.saved().profile.targetWeight,60);assert.equal(a.saved().profile.startWeight,70);assert.ok(a.q('#main').textContent.includes('140'));a.click('#settings-button');a.q('#profile-target').value='70';a.submit('#profile-form');assert.ok(a.q('#profile-error').textContent.length>0);assert.equal(a.saved().profile.targetWeight,60);
});
test('body record escapes user notes and supports deleting only the measurement',t=>{
 const a=app(t,'records');a.click('[data-action="body-log"]');a.q('#body-weight').value='138';a.q('#body-note').value='<img src=x onerror=alert(1)> & hello';a.submit('#body-form');assert.equal(a.saved().days[core.localDate()].weight,69);assert.equal(a.w.document.querySelectorAll('.entry-detail img').length,0);assert.ok(a.q('.entry-detail').textContent.includes('<img'));a.click('[data-action="body-log"]');a.q('#body-weight').value='';a.submit('#body-form');assert.equal(a.saved().days[core.localDate()].weight,null);
});
test('future plans can be changed but check-in remains disabled',t=>{
 const a=app(t);a.click('[data-action="week"][data-dir="1"]');assert.equal(a.q('[data-action="meal"]').disabled,true);assert.equal(a.q('[data-action="stairs"]').disabled,true);
});
test('invalid stored data is never overwritten by an attempted check-in',t=>{
 const raw='{"schema":99,"private":"keep"}',a=app(t,'today',raw);assert.ok(a.q('.storage-alert'));a.click('[data-action="meal"][data-slot="breakfast"]');a.click('[data-action="meal-save"][data-value="done"]');assert.equal(a.w.localStorage.getItem(core.STORAGE_KEY),raw);
});
test('storage quota failure does not show a completed check-in',t=>{
 const a=app(t);a.w.Storage.prototype.setItem=function(){throw new Error('quota');};a.click('[data-action="meal"][data-slot="breakfast"]');a.click('[data-action="meal-save"][data-value="done"]');assert.equal(a.q('[data-action="meal"][data-slot="breakfast"]').classList.contains('checked'),false);assert.ok(a.q('.storage-alert').textContent.includes('保存失败'));
});
test('backup importer rejects invalid file then merges valid data after confirmation',async t=>{
 const a=app(t,'records');a.click('[data-action="import"]');const input=a.q('#backup-file');
 const choose=async text=>{Object.defineProperty(input,'files',{configurable:true,value:[{size:text.length,text:async()=>text}]});input.dispatchEvent(new a.w.Event('change',{bubbles:true}));await new Promise(r=>setTimeout(r,0));};
 await choose('{nope}');assert.ok(a.q('#import-result').textContent.includes('不是有效'));assert.equal(a.w.localStorage.getItem(core.STORAGE_KEY),null);
 const s=core.freshState();s.days[core.localDate()]={...core.blankDay(),note:'imported',weight:69};await choose(JSON.stringify(s));assert.equal(a.w.localStorage.getItem(core.STORAGE_KEY),null);a.click('[data-action="import-confirm"]');assert.equal(a.saved().days[core.localDate()].note,'imported');
});
