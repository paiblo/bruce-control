// Executes the deployed bundle inside the actual Cloudflare workerd runtime via Miniflare.
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
const mf=new Miniflare(convertV4MiniflareOptions({modules:true,scriptPath:'apps/relay/dist/worker.js',compatibilityDate:'2026-11-10',durableObjects:{ROOMS:{className:'Room',useSQLite:true}},ratelimits:{LIMITER:{simple:{limit:1000,period:60},namespace_id:'1001'}},bindings:{ALLOWED_ORIGINS:'https://paiblo.github.io'}}));
const device=randomBytes(16).toString('hex'),token=randomBytes(32).toString('hex');let count=0;
const http=async(action,body,dev=device,origin='https://paiblo.github.io')=>mf.dispatchFetch(`http://local/v1/devices/${dev}/${action}`,{method:'POST',headers:{'Content-Type':'application/json',Origin:origin},body:JSON.stringify(body)});
const connect=async(role,auth,dev=device)=>{const r=await mf.dispatchFetch(`http://local/v1/devices/${dev}/ws`,{headers:{Upgrade:'websocket'}});assert.equal(r.status,101);r.webSocket.accept();const messages=[];r.webSocket.addEventListener('message',e=>{try{messages.push(JSON.parse(e.data));}catch{messages.push(e.data);}});r.webSocket.send(JSON.stringify({v:1,type:'auth',role,token:auth}));return {ws:r.webSocket,messages};};
const wait=async(test)=>{for(let i=0;i<200;i++){if(test())return;await new Promise(r=>setTimeout(r,10));}throw new Error('Timed out');};
const check=(name)=>{console.log('PASS',name);count++;};
try{
 assert.equal((await http('enroll',{token})).status,200);assert.equal((await http('enroll',{token:randomBytes(32).toString('hex')})).status,403);check('enrollment ownership');
 assert.equal((await http('pair',{code:'12345678'},device,'https://evil.invalid')).status,403);check('origin enforcement');
 const unauth=await connect('device',randomBytes(32).toString('hex'));let closed=false;unauth.ws.addEventListener('close',()=>closed=true);await wait(()=>closed);check('invalid device token rejected');
 const d=await connect('device',token);await wait(()=>d.messages.some(m=>m.type==='ready'));
 d.ws.send(JSON.stringify({v:1,type:'pair.open',code:'12345678'}));await new Promise(r=>setTimeout(r,30));
 assert.equal((await http('pair',{code:'00000000'})).status,403);const pair=await (await http('pair',{code:'12345678'})).json();assert.equal(typeof pair.token,'string');await wait(()=>d.messages.some(m=>m.type==='pair.request'));
 assert.equal((await (await http('claim',{secret:pair.secret})).json()).approved,false);check('pair requires physical approval');
 const premature=await connect('browser',pair.token);let denied=false;premature.ws.addEventListener('close',()=>denied=true);await wait(()=>denied);check('pending pair cannot control');
 d.ws.send(JSON.stringify({v:1,type:'pair.approve',claim:pair.claim}));await new Promise(r=>setTimeout(r,30));assert.equal((await (await http('claim',{secret:pair.secret})).json()).approved,true);check('approval activates browser token');
 const b=await connect('browser',pair.token);await wait(()=>b.messages.some(m=>m.type==='ready'));const nonce=b.messages.find(m=>m.type==='ready').nonce;
 const cmd={v:1,type:'command',id:randomUUID(),nonce,seq:1,ts:Date.now(),method:'device.info',params:{}};b.ws.send(JSON.stringify(cmd));await wait(()=>d.messages.some(m=>m.type==='command'));assert.equal(d.messages.filter(m=>m.type==='command').length,1);check('authenticated command routing and ack');
 d.ws.send(JSON.stringify({v:1,type:'result',id:cmd.id,ok:true,data:{board:'EXPLICIT TEST FIXTURE'}}));await wait(()=>b.messages.some(m=>m.type==='result'&&m.ok));check('device results routed to paired browser');
 b.ws.send(JSON.stringify(cmd));await wait(()=>b.messages.some(m=>m.error?.includes('Replay')));assert.equal(d.messages.filter(m=>m.type==='command').length,1);check('replay blocked');
 b.ws.send(JSON.stringify({...cmd,id:randomUUID(),seq:2,ts:Date.now()-60000}));await wait(()=>b.messages.filter(m=>m.error?.includes('abgelaufener')).length>1);check('expired command rejected');
 const other=await connect('browser',pair.token,randomBytes(16).toString('hex'));let isolated=false;other.ws.addEventListener('close',()=>isolated=true);await wait(()=>isolated);check('device room isolation');
 d.ws.send(JSON.stringify({v:1,type:'pair.revoke'}));let revoked=false;b.ws.addEventListener('close',()=>revoked=true);await wait(()=>revoked);check('device revocation closes browser');
 d.ws.close();console.log(`${count} relay runtime checks passed`);
}finally{await mf.dispose();}
