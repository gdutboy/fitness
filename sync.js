import {freshState, blankDay, validateState} from './core.js';
export const SYNC_KEY='huanbao.fitness.sync.v1';
export const SYNC_URL='https://xiulian-sync.gdutboy.xyz/v1/fitness/data';
const clean=s=>{const v=validateState(s);v.savedAt=null;return v;};
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
// Apply only fields changed locally since the last acknowledged snapshot.
// Missing meal keys are intentional undo operations, not missing records.
export function reconcile(base,local,remote){
 const b=clean(base),l=clean(local),r=clean(remote);
 for(const date of new Set([...Object.keys(l.days),...Object.keys(r.days)])){
  b.days[date]??=blankDay(); l.days[date]??=blankDay(); r.days[date]??=blankDay();
 }
 function merge(b,l,r){
  if(equal(b,l))return structuredClone(r);
  if(object(b)&&object(l)&&object(r)){
   const out={};
   for(const k of new Set([...Object.keys(b),...Object.keys(l),...Object.keys(r)])){
    if(['__proto__','constructor','prototype'].includes(k))continue;
    const v=merge(b[k],l[k],r[k]);if(v!==undefined)out[k]=v;
   }
   return out;
  }
  return structuredClone(l);
 }
 return clean(merge(b,l,r));
}
export function createSync({storage,getState,replaceState,onStatus=()=>{},request=globalThis.fetch,url=SYNC_URL,withLock=fn=>fn()}){
 let busy=null,base=freshState(),timer=null,stopped=false,metadataError=false;
 try{const raw=storage.getItem(SYNC_KEY);if(raw)base=clean(JSON.parse(raw).base);}catch{metadataError=true;}
 const status=message=>onStatus(message);
 const remember=s=>{const next=clean(s);storage.setItem(SYNC_KEY,JSON.stringify({base:next}));base=next;};
 async function api(method,body){
  const ctl=new AbortController(),timeout=setTimeout(()=>ctl.abort(),10000);
  try{
   const response=await request(url,{method,cache:'no-store',signal:ctl.signal,headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});
   if(response.status===409)return null;
   if(!response.ok)throw new Error('network');
   const envelope=await response.json();
   if(!Number.isSafeInteger(envelope.rev)||envelope.rev<0)throw new Error('invalid revision');
   return {...envelope,data:envelope.data===null?freshState():clean(envelope.data)};
  }finally{clearTimeout(timeout);}
 }
 async function run(){
  try{const raw=storage.getItem(SYNC_KEY);base=raw?clean(JSON.parse(raw).base):freshState();metadataError=false;}catch{metadataError=true;}
  if(metadataError){status('同步信息异常，已保留本机记录，请先导出备份。');return;}
  status('正在读取后台记录…');
  try{
   for(let tries=0;tries<5&&!stopped;tries++){
    const remote=await api('GET');if(!remote)throw new Error('invalid response');
    const current=clean(getState()),merged=reconcile(base,current,remote.data);
    if(!equal(merged,remote.data)){
     status('正在保存到后台…');
     const ack=await api('PUT',{baseRev:remote.rev,data:merged});
     if(!ack)continue;
    }
    const latest=clean(getState()),applied=reconcile(current,latest,merged);
    if(!equal(latest,applied))replaceState(applied);
    remember(merged);
    if(equal(clean(getState()),base)){status('已与后台同步');return;}
   }
   throw new Error('retry');
  }catch{
   status('记录已留在本机，暂未同步，联网后自动重试');
   if(!stopped)timer=setTimeout(sync,30000);
  }
 }
 function sync(){if(stopped)return Promise.resolve();if(busy)return busy;clearTimeout(timer);busy=Promise.resolve().then(()=>withLock(run)).finally(()=>{busy=null;});return busy;}
 function changed(){status('已保存到本机，等待同步…');clearTimeout(timer);timer=setTimeout(sync,500);}
 return {sync,changed,stop(){stopped=true;clearTimeout(timer);}};
}
