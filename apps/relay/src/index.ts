/// <reference types="@cloudflare/workers-types" />
import { DurableObject } from 'cloudflare:workers';
import { commandSchema, deviceId, fresh, hash, MAX_FRAME, randomHex, timingEqual, tokenSchema } from '../../../packages/protocol/src/index';
interface Env { ROOMS:DurableObjectNamespace<Room>; LIMITER:RateLimit; ALLOWED_ORIGINS:string; }
type Attachment={role:'pending'|'device'|'browser';nonce:string;seq:number;deadline:number;count:number;window:number;};
type Pair={codeHash:string;expires:number;attempts:number;claim?:string;claimHash?:string;tokenHash?:string;approved?:boolean};
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
export default {async fetch(req:Request,env:Env):Promise<Response>{
 const url=new URL(req.url),origin=req.headers.get('Origin');
 const allowed=env.ALLOWED_ORIGINS.split(',');
 if(origin&&!allowed.includes(origin))return json({error:'Origin nicht freigegeben'},403);
 const cors:Record<string,string>=origin?{'Access-Control-Allow-Origin':origin,'Vary':'Origin'}:{};
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:{...cors,'Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type,Authorization','Access-Control-Max-Age':'600'}});
 if(url.pathname==='/health')return json({service:'bruce-control-relay',protocol:1});
 const match=url.pathname.match(/^\/v1\/devices\/([a-f0-9]{32})\/(enroll|pair|claim|ws)$/);
 if(!match||!deviceId.safeParse(match[1]).success)return json({error:'Unbekannter Endpunkt'},404);
 if(req.headers.get('Content-Length')&&Number(req.headers.get('Content-Length'))>2048)return json({error:'Zu groß'},413);
 if(!(await env.LIMITER.limit({key:req.headers.get('CF-Connecting-IP')||'local'})).success)return json({error:'Zu viele Anfragen'},429);
 try {
  const stub=env.ROOMS.getByName(match[1]);
  if(match[2]==='ws') {
   if(req.headers.get('Upgrade')?.toLowerCase()!=='websocket')return json({error:'WebSocket erforderlich'},426);
   return stub.fetch(req);
  }
  if(req.method!=='POST')return json({error:'POST erforderlich'},405);
  const raw=await req.text();if(raw.length>2048)return json({error:'Zu groß'},413);
  let body:Record<string,unknown>;try{body=JSON.parse(raw);}catch{return json({error:'Ungültiges JSON'},400);}
  const result=await stub.http(match[2],body);
  return new Response(result.body,{status:result.status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});
 }catch{return json({error:'Relay vorübergehend nicht verfügbar'},503);}
}} satisfies ExportedHandler<Env>;
export class Room extends DurableObject<Env>{
 constructor(ctx:DurableObjectState,env:Env){super(ctx,env);this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping','pong'));}
 async http(action:string,b:Record<string,unknown>):Promise<{status:number;body:string}>{
  const respond=(data:unknown,status=200)=>({status,body:JSON.stringify(data)});
  if(action==='enroll'){
   if(!tokenSchema.safeParse(b.token).success)return respond({error:'Ungültiges Token'},400);
   const h=await hash(String(b.token));const existing=await this.ctx.storage.get<string>('device');
   if(existing&&!timingEqual(existing,h))return respond({error:'Gerät bereits registriert'},403);
   if(!existing)await this.ctx.storage.put('device',h);
   return respond({ok:true});
  }
  const p=await this.ctx.storage.get<Pair>('pair');
  if(!p||p.expires<Date.now())return respond({error:'Kopplung abgelaufen. Am Gerät neu starten.'},410);
  if(action==='pair'){
   if(p.attempts>=5)return respond({error:'Zu viele Versuche. Am Gerät neu starten.'},429);
   p.attempts++; await this.ctx.storage.put('pair',p);
   if(typeof b.code!=='string'||!/^\d{8}$/.test(b.code)||!timingEqual(await hash(b.code),p.codeHash))return respond({error:'Code ungültig'},403);
   if(p.claim)return respond({error:'Kopplung läuft bereits'},409);
   const secret=randomHex(),token=randomHex();p.claim=crypto.randomUUID();p.claimHash=await hash(secret);p.tokenHash=await hash(token);
   await this.ctx.storage.put('pair',p);
   for(const ws of this.sockets('device'))ws.send(JSON.stringify({v:1,type:'pair.request',claim:p.claim}));
   return respond({claim:p.claim,secret,token,expires:p.expires});
  }
  if(action==='claim'){
   if(typeof b.secret!=='string'||!p.claimHash||!timingEqual(await hash(b.secret),p.claimHash))return respond({error:'Nicht autorisiert'},403);
   return respond({approved:!!p.approved,expires:p.expires});
  }
  return respond({error:'Unbekannt'},404);
 }
 async fetch(_request:Request):Promise<Response>{
  if(this.ctx.getWebSockets().length>=5)return json({error:'Zu viele Verbindungen'},429);
  const pair=new WebSocketPair();this.ctx.acceptWebSocket(pair[1],['pending']);
  pair[1].serializeAttachment({role:'pending',nonce:crypto.randomUUID(),seq:0,deadline:Date.now()+10000,count:0,window:Date.now()} satisfies Attachment);
  await this.schedule(Date.now()+10000);
  return new Response(null,{status:101,webSocket:pair[0]});
 }
 sockets(role:'device'|'browser'){return this.ctx.getWebSockets().filter(s=>(s.deserializeAttachment() as Attachment).role===role&&s.readyState===1);}
 async webSocketMessage(ws:WebSocket,message:string|ArrayBuffer){
  const a=ws.deserializeAttachment() as Attachment;
  const fail=(error:string,id?:string)=>ws.send(JSON.stringify({v:1,type:'result',ok:false,id,error}));
  if(Date.now()>a.deadline){ws.close(4001,'Sitzung abgelaufen');return;}
  if(Date.now()-a.window>1000){a.window=Date.now();a.count=0;}
  if(++a.count>20){ws.close(4008,'Rate limit');return;}ws.serializeAttachment(a);
  if(typeof message!=='string'){
   if(a.role!=='device'||message.byteLength>10000){ws.close(1009,'Binärdaten ungültig');return;}
   for(const s of this.sockets('browser'))s.send(message);return;
  }
  if(message.length>MAX_FRAME){ws.close(1009,'Nachricht zu groß');return;}
  let m:Record<string,unknown>;try{m=JSON.parse(message);}catch{fail('Ungültiges JSON');return;}
  if(a.role==='pending'){
   if(m.type!=='auth'||m.v!==1||!['browser','device'].includes(String(m.role))||!tokenSchema.safeParse(m.token).success){ws.close(4003,'Authentifizierung fehlgeschlagen');return;}
   const role=m.role as 'browser'|'device';
   const stored=await this.ctx.storage.get<{hash:string;expires:number}>('browser');
   const expected=role==='device'?await this.ctx.storage.get<string>('device'):(stored&&stored.expires>Date.now()?stored.hash:undefined);
   if(!expected||!timingEqual(await hash(String(m.token)),expected)){ws.close(4003,'Authentifizierung fehlgeschlagen');return;}
   for(const old of this.sockets(role))old.close(4002,'Sitzung ersetzt');
   a.role=role;a.deadline=role==='browser'?Math.min(Date.now()+86400000,stored!.expires):Date.now()+86400000;
   ws.serializeAttachment(a);ws.send(JSON.stringify({v:1,type:'ready',nonce:a.nonce,deviceOnline:this.sockets('device').length>0}));
   for(const s of this.sockets('browser'))s.send(JSON.stringify({v:1,type:'presence',online:this.sockets('device').length>0}));return;
  }
  if(a.role==='device'){
   if(m.type==='pair.open'&&typeof m.code==='string'&&/^\d{8}$/.test(m.code)){
    await this.ctx.storage.put('pair',{codeHash:await hash(m.code),expires:Date.now()+120000,attempts:0} satisfies Pair);await this.schedule(Date.now()+120000);return;
   }
   if(m.type==='pair.approve'){
    const p=await this.ctx.storage.get<Pair>('pair');
    if(p&&p.expires>Date.now()&&p.claim===m.claim&&p.tokenHash&&!p.approved){p.approved=true;await this.ctx.storage.put({browser:{hash:p.tokenHash,expires:Date.now()+30*86400000},pair:p});for(const s of this.sockets('browser'))s.close(4001,'Neu gekoppelt');}return;
   }
   if(m.type==='pair.revoke'){await this.ctx.storage.delete(['browser','pair']);for(const s of this.sockets('browser'))s.close(4003,'Kopplung widerrufen');return;}
   if(m.type==='result'&&typeof m.id==='string'){
    const pending=await this.ctx.storage.get<{expires:number}>('p:'+m.id);if(!pending)return;
    await this.ctx.storage.delete('p:'+m.id);
    if(pending.expires>=Date.now())for(const s of this.sockets('browser'))s.send(message);
   }
   return;
  }
  const parsed=commandSchema.safeParse(m);
  if(!parsed.success){fail('Befehl oder Parameter ungültig',String(m.id));return;}
  const c=parsed.data;
  if(c.nonce!==a.nonce||c.seq<=a.seq||!fresh(c.ts)){fail('Replay oder abgelaufener Befehl',c.id);return;}
  a.seq=c.seq;ws.serializeAttachment(a);
  const seen=await this.ctx.storage.get('seen:'+c.id);if(seen){fail('Befehl bereits verarbeitet',c.id);return;}
  const ds=this.sockets('device');if(!ds.length){fail('Gerät offline',c.id);return;}
  const list=await this.ctx.storage.list({prefix:'p:'});if(list.size>=8){fail('Gerät beschäftigt',c.id);return;}
  await this.ctx.storage.put({['seen:'+c.id]:Date.now()+60000,['p:'+c.id]:{expires:Date.now()+15000}});
  await this.schedule(Date.now()+10000);
  ws.send(JSON.stringify({v:1,type:'ack',id:c.id}));ds[0].send(JSON.stringify(c));
 }
 async schedule(at:number){const alarm=await this.ctx.storage.getAlarm();if(!alarm||alarm>at)await this.ctx.storage.setAlarm(at);}
 async alarm(){
  const now=Date.now();let next=Infinity;
  for(const s of this.ctx.getWebSockets()){const a=s.deserializeAttachment() as Attachment;if(a.deadline<now)s.close(4001,'Sitzung abgelaufen');else next=Math.min(next,a.deadline);}
  const seen=await this.ctx.storage.list<number>({prefix:'seen:'});for(const [key,until] of seen){if(until<now)await this.ctx.storage.delete(key);else next=Math.min(next,until);}
  const pending=await this.ctx.storage.list<{expires:number}>({prefix:'p:'});for(const [key,p] of pending){if(p.expires<now){await this.ctx.storage.delete(key);for(const s of this.sockets('browser'))s.send(JSON.stringify({v:1,type:'result',id:key.slice(2),ok:false,error:'Geräteantwort abgelaufen; Ausführung möglicherweise erfolgt'}));}else next=Math.min(next,p.expires);}
  const p=await this.ctx.storage.get<Pair>('pair');if(p&&p.expires<now)await this.ctx.storage.delete('pair');else if(p)next=Math.min(next,p.expires);
  if(Number.isFinite(next))await this.ctx.storage.setAlarm(Math.max(now+100,next+1));
 }
 async webSocketClose(ws:WebSocket,code:number,reason:string){const a=ws.deserializeAttachment() as Attachment;ws.close(code,reason);if(a.role==='device')for(const s of this.sockets('browser'))s.send(JSON.stringify({v:1,type:'presence',online:false}));}
 async webSocketError(ws:WebSocket){ws.close(1011,'Verbindungsfehler');}
}
