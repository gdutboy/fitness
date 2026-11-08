import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {mkdtemp,readFile,writeFile,mkdir,rm,readdir} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createFitnessRoute} from '../server/route.mjs';
import {createSync,reconcile,SYNC_KEY} from '../sync.js';
import {freshState,blankDay} from '../core.js';
const date='2026-11-08';
function memory(){const map=new Map();return {getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v)};}
async function backend(t){
 const dir=await mkdtemp(path.join(os.tmpdir(),'fitness-test-')),route=createFitnessRoute(dir);
 const server=http.createServer(async(req,res)=>{const [code,body]=await route(req);res.writeHead(code,{'Content-Type':'application/json'}).end(JSON.stringify(body));});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 t.after(async()=>{await new Promise(r=>{server.close(r);server.closeAllConnections();});await rm(dir,{recursive:true,force:true});});
 const url=`http://127.0.0.1:${server.address().port}/v1/fitness/data`;
 return {dir,url,get:async()=>fetch(url).then(r=>r.json()),put:async(data,baseRev)=>fetch(url,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({data,baseRev})})};
}
function device(t,url,initial=freshState(),extra={}){
 let state=structuredClone(initial),message='';const storage=extra.storage||memory();
 const sync=createSync({url,storage,getState:()=>state,replaceState:s=>{state=structuredClone(s);},onStatus:s=>{message=s;},...extra});t.after(()=>sync.stop());
 return {sync,storage,get state(){return state;},get message(){return message;},edit:fn=>fn(state)};
}
test('field merge preserves remote edits and local meal undo',()=>{
 const b=freshState();b.days[date]={...blankDay(),meals:{breakfast:'done'}};
 const l=structuredClone(b),r=structuredClone(b);delete l.days[date].meals.breakfast;r.days[date].weight=60;r.days[date].meals.dinner='done';
 const out=reconcile(b,l,r);assert.equal(out.days[date].meals.breakfast,undefined);assert.equal(out.days[date].weight,60);assert.equal(out.days[date].meals.dinner,'done');
});
test('fresh browser restores backend and never uploads its defaults',async t=>{
 const b=await backend(t),saved=freshState();saved.profile.name='测试';saved.days[date]={...blankDay(),weight:60};await b.put(saved,0);
 const d=device(t,b.url);await d.sync.sync();assert.equal(d.state.days[date].weight,60);assert.equal((await b.get()).rev,1);assert.equal(d.message,'已与后台同步');
});
test('first migration keeps local logs and remote fields on same day',async t=>{
 const b=await backend(t),remote=freshState();remote.days[date]={...blankDay(),weight:60};await b.put(remote,0);
 const local=freshState();local.days[date]={...blankDay(),stairs:2};const d=device(t,b.url,local);await d.sync.sync();
 const out=await b.get();assert.equal(out.data.days[date].stairs,2);assert.equal(out.data.days[date].weight,60);
});
test('offline edits survive reload and merge newer remote records',async t=>{
 const b=await backend(t),d=device(t,b.url);await d.sync.sync();d.edit(s=>{s.days[date]={...blankDay(),note:'离线'};});
 const offline=device(t,b.url,d.state,{storage:d.storage,request:async()=>{throw new Error('offline');}});await offline.sync.sync();assert.match(offline.message,/暂未同步/);offline.sync.stop();
 const remote=freshState();remote.days[date]={...blankDay(),weight:61};await b.put(remote,0);
 const restored=device(t,b.url,offline.state,{storage:d.storage});await restored.sync.sync();const out=await b.get();assert.equal(out.data.days[date].note,'离线');assert.equal(out.data.days[date].weight,61);
});
test('edits during upload are not marked saved or overwritten',async t=>{
 const b=await backend(t);let d,first=true;
 d=device(t,b.url,freshState(),{request:async(url,opts)=>{if(opts.method==='PUT'&&first){first=false;d.edit(s=>{s.days[date].stairs=3;});}return fetch(url,opts);}});
 d.edit(s=>{s.days[date]={...blankDay(),stairs:1};});await d.sync.sync();assert.equal((await b.get()).data.days[date].stairs,3);assert.equal(d.message,'已与后台同步');
});
test('concurrent revision conflict re-fetches without losing either device edit',async t=>{
 const b=await backend(t);let raced=false;
 const d=device(t,b.url,freshState(),{request:async(url,opts)=>{if(opts.method==='PUT'&&!raced){raced=true;const other=freshState();other.days[date]={...blankDay(),weight:62};await b.put(other,0);}return fetch(url,opts);}});
 d.edit(s=>{s.days[date]={...blankDay(),stairs:2};});await d.sync.sync();const out=await b.get();assert.equal(out.data.days[date].stairs,2);assert.equal(out.data.days[date].weight,62);
});
test('undo and clearing a weight propagate to another device',async t=>{
 const b=await backend(t),a=device(t,b.url);a.edit(s=>{s.days[date]={...blankDay(),weight:60,meals:{breakfast:'done'}};});await a.sync.sync();const other=device(t,b.url);await other.sync.sync();
 a.edit(s=>{delete s.days[date].meals.breakfast;s.days[date].weight=null;});await a.sync.sync();await other.sync.sync();assert.equal(other.state.days[date].weight,null);assert.equal(other.state.days[date].meals.breakfast,undefined);
});
test('backend rejects stale and invalid writes; survives route restart',async t=>{
 const b=await backend(t);await b.put(freshState(),0);assert.equal((await b.put(freshState(),0)).status,409);assert.equal((await b.put({schema:999},1)).status,400);
 const route=createFitnessRoute(b.dir),[code,out]=await route({method:'GET'});assert.equal(code,200);assert.equal(out.rev,1);
});
test('corrupt server file fails closed and is not replaced with empty state',async t=>{
 const b=await backend(t);await mkdir(path.join(b.dir,'fitness'));const file=path.join(b.dir,'fitness/latest.json');await writeFile(file,'broken');assert.equal((await b.put(freshState(),0)).status,503);assert.equal(await readFile(file,'utf8'),'broken');
});
test('keeps bounded history and does not touch family data',async t=>{
 const b=await backend(t);const sibling=path.join(b.dir,'family.json');await writeFile(sibling,'keep');
 for(let rev=0;rev<34;rev++)assert.equal((await b.put(freshState(),rev)).status,200);
 assert.equal((await readdir(path.join(b.dir,'fitness/history'))).length,30);assert.equal(await readFile(sibling,'utf8'),'keep');
});
test('broken sync metadata and local quota failure never claim cloud success',async t=>{
 const b=await backend(t),storage=memory();storage.setItem(SYNC_KEY,'bad');const d=device(t,b.url,freshState(),{storage});await d.sync.sync();assert.match(d.message,/异常/);assert.equal((await b.get()).rev,0);
 const remote=freshState();remote.days[date]={...blankDay(),weight:60};await b.put(remote,0);
 const full=device(t,b.url,freshState(),{replaceState:()=>{throw new Error('quota');}});await full.sync.sync();assert.match(full.message,/暂未同步/);assert.equal((await b.get()).rev,1);
});
test('a second tab reloads the shared baseline instead of resurrecting undone records',async t=>{
 const b=await backend(t),storage=memory();let state=freshState();
 const hooks={storage,getState:()=>state,replaceState:s=>{state=s;}};
 const a=device(t,b.url,freshState(),hooks),other=device(t,b.url,freshState(),hooks);
 state.days[date]={...blankDay(),meals:{breakfast:'done'}};await a.sync.sync();
 const remote=(await b.get()).data;delete remote.days[date].meals.breakfast;await b.put(remote,1);
 await other.sync.sync();assert.equal(state.days[date].meals.breakfast,undefined);assert.equal((await b.get()).rev,2);
});
test('oversized request returns 413 without replacing stored data',async t=>{
 const b=await backend(t);await b.put(freshState(),0);
 const response=await fetch(b.url,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:'x'.repeat(3*1024*1024)})});
 assert.equal(response.status,413);assert.equal((await response.json()).error,'Data too large');assert.equal((await b.get()).rev,1);
});
