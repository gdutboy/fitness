import fs from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {validateState} from '../core.js';
const LIMIT=2*1024*1024;
export function createFitnessRoute(dataRoot){
 const dir=path.join(dataRoot,'fitness'),file=path.join(dir,'latest.json');
 let chain=Promise.resolve();
 async function read(){
  try{const out=JSON.parse(await fs.readFile(file,'utf8'));validateState(out.data);if(!Number.isSafeInteger(out.rev)||out.rev<1)throw new Error('bad revision');return out;}
  catch(e){if(e.code==='ENOENT')return {rev:0,data:null,updatedAt:null};throw e;}
 }
 async function write(file,data){
  const tmp=file+'.'+randomUUID()+'.tmp';
  try{await fs.writeFile(tmp,JSON.stringify(data),{mode:0o600});await fs.rename(tmp,file);}finally{await fs.rm(tmp,{force:true});}
 }
 async function route(req){
  if(req.method==='GET')return [200,await read()];
  if(req.method!=='PUT')return [405,{error:'Method not allowed'}];
  if(!req.headers['content-type']?.startsWith('application/json'))return [415,{error:'JSON required'}];
  let size=0,chunks=[];
  for await(const chunk of req.iterator({destroyOnReturn:false})){size+=chunk.length;if(size>LIMIT){req.resume();return [413,{error:'Data too large'}];}chunks.push(chunk);}
  let input,data;
  try{input=JSON.parse(Buffer.concat(chunks));data=validateState(input.data);if(!Number.isSafeInteger(input.baseRev)||input.baseRev<0)throw new Error();}
  catch{return [400,{error:'Invalid fitness data'}];}
  const commit=async()=>{
   const old=await read();
   if(old.rev!==input.baseRev)return [409,{error:'Revision changed'}];
   const history=path.join(dir,'history');await fs.mkdir(history,{recursive:true});
   if(old.data){
    await write(path.join(history,`${old.rev}.json`),old);
    const versions=(await fs.readdir(history)).filter(f=>/^\d+\.json$/.test(f)).sort((a,b)=>parseInt(a)-parseInt(b));
    for(const f of versions.slice(0,-30))await fs.rm(path.join(history,f));
   }
   data.savedAt=new Date().toISOString();
   const out={rev:old.rev+1,data,updatedAt:data.savedAt};await write(file,out);return [200,out];
  };
  const pending=chain.then(commit,commit);chain=pending.catch(()=>{});return pending;
 }
 return async req=>{try{return await route(req);}catch{return [503,{error:'Storage unavailable; existing data preserved'}];}};
}
