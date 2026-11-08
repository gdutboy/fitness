// Local verification server; production mounts route.mjs in the existing sync service.
import http from 'node:http';
import {createFitnessRoute} from './route.mjs';
const route=createFitnessRoute(process.env.DATA_DIR||'./.fitness-test-data');
http.createServer(async(req,res)=>{
 const headers={'Content-Type':'application/json','Cache-Control':'no-store','Access-Control-Allow-Origin':'http://127.0.0.1:4178','Access-Control-Allow-Methods':'GET, PUT, OPTIONS','Access-Control-Allow-Headers':'Content-Type'};
 if(req.method==='OPTIONS'){res.writeHead(204,headers).end();return;}
 const [code,body]=req.url==='/v1/fitness/data'?await route(req):[404,{error:'Not found'}];
 res.writeHead(code,headers).end(JSON.stringify(body));
}).listen(Number(process.env.PORT||8542),'127.0.0.1');
