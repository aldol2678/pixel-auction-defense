const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const codePattern=/^[A-HJ-NP-Z2-9]{4}$/;
const json=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
const fault=(message,status=400)=>json({error:message},status);
function token(){return crypto.randomUUID();}
function code(){return Array.from(crypto.getRandomValues(new Uint8Array(4)),n=>alphabet[n%alphabet.length]).join('');}
const seatNames=['민트','딸기','망고','소다'];
const modes=['survival','coop'];
const paths=new Set(['join','sync','start','bid','confirm','sell','upgrade','equip','augment','move','ready','leave']);
export default {
  async fetch(req,env){
    const url=new URL(req.url),p=url.pathname;
    if(!p.startsWith('/api/'))return serveAsset(p,req.method);
    const origin=req.headers.get('Origin');
    if(origin && origin!==url.origin)return fault('접속 주소를 확인해 줘.',403);
    if(p==='/api/create' && req.method==='POST'){
      const body=await req.json().catch(()=>null);
      if(!modes.includes(body?.mode)) return fault('모드를 골라 줘.');
      for(let n=0;n<6;n++){
        const key=code(),stub=env.ROOMS.get(env.ROOMS.idFromName(key));
        const response=await stub.fetch('https://room/create',{method:'POST',body:JSON.stringify({code:key,mode:body.mode,name:playerNickname(body.name),marketVersion:[1,2,3,4].includes(body.marketVersion)?body.marketVersion:0})});
        if(response.status!==409)return response;
      }
      return fault('잠시 뒤 다시 시도해 줘.',503);
    }
    const parts=p.split('/'),key=parts[2],op=parts[3];
    if(parts.length!==4||!codePattern.test(key))return fault('방 코드를 확인해 줘.',404);
    if(op==='socket' && req.headers.get('Upgrade')==='websocket')
      return env.ROOMS.get(env.ROOMS.idFromName(key)).fetch(req);
    if(req.method!=='POST'||!paths.has(op))return fault('지원하지 않는 요청이야.',404);
    if((req.headers.get('content-length')||0)>2048)return fault('요청이 너무 커.',413);
    return env.ROOMS.get(env.ROOMS.idFromName(key)).fetch(req);
  }
};
export class AuctionRoom {
  constructor(ctx){
    this.ctx=ctx; this.timer=null;this.queue=Promise.resolve();
    ctx.blockConcurrencyWhile(async()=>{this.room=await ctx.storage.get('room');});
  }
  run(fn){const task=this.queue.then(fn);this.queue=task.catch(()=>{});return task;}
  fetch(req){return this.run(()=>this.handle(req));}
  async handle(req){
    const op=new URL(req.url).pathname.split('/').pop(), now=Date.now();
    if(this.room&&now>=this.room.expires)await this.expire();
    if(op==='create'){
      if(this.room)return fault('이미 존재하는 방이야.',409);
      const {code,mode,marketVersion,name}=await req.json();
      this.room={code,mode,marketVersion,expires:now+1800000,host:0,seats:Array.from({length:4},(_,i)=>({name:seatNames[i],online:false,token:null,seq:0}))};
      return this.claim(0,now,name);
    }
    if(!this.room)return fault('방을 찾을 수 없어. 코드를 다시 확인해 줘.',404);
    if(op==='join'){
      const info=await req.json().catch(()=>({}));
      if((this.room.marketVersion||0)>([1,2,3,4].includes(info.marketVersion)?info.marketVersion:0))return fault('게임을 새로고침한 뒤 참가해 줘.',409);
      const seat=this.room.seats.findIndex(s=>!s.token);
      if(this.room.game||seat<0)return fault('이미 시작했거나 가득 찬 방이야.',409);
      return this.claim(seat,now,info.name);
    }
    const bearer=op==='socket'?req.headers.get('Sec-WebSocket-Protocol'):req.headers.get('Authorization')?.replace(/^Bearer /,'');
    const i=this.room.seats.findIndex(s=>s.token && s.token===bearer);
    if(i<0)return fault('이 자리로 접속할 수 없어.',403);
    this.presence(now);
    advance(this.room,now);
    const s=this.room.seats[i];
    if(op==='socket'){
      const [client,ws]=Object.values(new WebSocketPair());
      for(const old of this.ctx.getWebSockets(String(i)))old.close(1000,'reconnected');
      this.ctx.acceptWebSocket(ws,[String(i)]);
      ws.serializeAttachment({seat:i});this.connected(i,now);await this.save();this.broadcast();
      return new Response(null,{status:101,webSocket:client,headers:{'Sec-WebSocket-Protocol':bearer}});
    }
    const m=await req.json().catch(()=>({}));
    if(op==='leave'){
      for(const ws of this.ctx.getWebSockets(String(i)))ws.close(1000,'left');
      this.disconnect(i,now);
      if(!this.room.game){s.token=null;s.seq=0;s.name=seatNames[i];}
    }else {
      this.connected(i,now);
      if(op==='start'){
        if(i!==this.room.host||this.room.game)return fault('대기 중인 방장만 시작할 수 있어.',409);
        this.room.marketVersion??=0;
        this.room.game=makeMatch(this.room,this.room.mode,now,crypto.getRandomValues(new Uint32Array(1))[0]);
      }else if(op!=='sync'){
        if((m.roundId??0)!==(this.room.roundId||0)||!Number.isSafeInteger(m.seq)||m.seq<=s.seq)
          return fault('이미 처리했거나 이전 판의 조작이야.',409);
        if(op==='ready'){
          if(this.room.game?.phase!=='result'||typeof m.ready!=='boolean')return fault('결과 화면에서 준비할 수 있어.',409);
          s.ready=m.ready;
        }else if(!act(this.room,i,{...m,t:op},now))return fault('현재 상태에서 할 수 없는 조작이야.',409);
        s.seq=m.seq;
      }
    }
    advance(this.room,now);await this.save();
    if(op!=='sync')this.broadcast();
    return json(this.snapshot(i));
  }
  connected(i,now){
    const s=this.room.seats[i];s.seen=now;
    if(!s.online){s.online=true;s.joined=now;s.leftAt=0;
      if(this.room.host==null)this.room.host=i;
      const G=this.room.game;
      if(G?.phase==='auction' && G.offers[i].auto && living(G,i) && now<G.deadline)
        G.offers[i]={amount:0,locked:false,auto:false};
    }
  }
  async claim(i,now,name){
    const s=this.room.seats[i];s.name=playerNickname(name)||('플레이어 '+(i+1));s.token=token();this.connected(i,now);
    await this.save();this.broadcast();return json({code:this.room.code,token:s.token,seat:i});
  }
  snapshot(i){return {...view(this.room,i,Date.now()),lastSeq:this.room.seats[i].seq};}
  disconnect(i,now){
    const s=this.room.seats[i];if(!s.online)return;
    s.online=false;s.leftAt=now;s.ready=false;
    if(this.room.host===i){
      const earliest=this.room.seats.map((v,j)=>({...v,j})).filter(v=>v.online).sort((a,b)=>a.joined-b.joined)[0];
      this.room.host=earliest?.j??null;
    }
  }
  presence(now){
    this.room.seats.forEach((s,i)=>{
      if(s.online && now-s.seen>9000 && !this.ctx.getWebSockets(String(i)).length)this.disconnect(i,now);
      if(!this.room.game && !s.online && s.token && now-s.leftAt>30000){s.token=null;s.seq=0;s.name=seatNames[i];}
    });
  }
  broadcast(){
    for(const ws of this.ctx.getWebSockets()){
      const i=ws.deserializeAttachment()?.seat;
      if(i!=null && ws.readyState===1)ws.send(JSON.stringify(this.snapshot(i)));
    }
  }
  async webSocketClose(ws){
    await this.run(async()=>{
      if(!this.room)return;
      const i=ws.deserializeAttachment()?.seat;
      if(i!=null && !this.ctx.getWebSockets(String(i)).some(other=>other!==ws&&other.readyState===1))this.disconnect(i,Date.now());
      try{ws.close(1000);}catch{}
      await this.save();this.broadcast();
    });
  }
  webSocketError(ws){return this.webSocketClose(ws);}
  webSocketMessage(ws){ws.close(1003,'Use the room controls');}
  async save(){
    await this.ctx.storage.put('room',this.room);
    const running=this.room.game && this.room.game.phase!=='result';
    const next=Math.min(this.room.expires,Date.now()+(running?7000:15000));
    const old=await this.ctx.storage.getAlarm();
    if(old===null||old<=Date.now()||old>next+500)await this.ctx.storage.setAlarm(next);
    if(running && !this.timer && this.ctx.getWebSockets().length){
      this.timer=setTimeout(()=>{this.timer=null;this.ctx.waitUntil(this.run(()=>this.tick()));},500);
    }
  }
  async tick(){
    if(!this.room)return;
    const now=Date.now();if(now>=this.room.expires)return this.expire();
    this.presence(now);advance(this.room,now);await this.save();this.broadcast();
  }
  alarm(){return this.run(()=>this.tick());}
  async expire(){
    for(const ws of this.ctx.getWebSockets())ws.close(1000,'expired');
    clearTimeout(this.timer);this.timer=null;this.room=null;
    await this.ctx.storage.deleteAlarm();await this.ctx.storage.deleteAll();
  }
}
