'use strict';
const el=id=>document.getElementById(id), colors=['#7ef0c9','#ff8fa3','#ffd166','#8bd3ff'];
const $=el;
const getNickname=nicknameField('roomNickname');
const show=(id,on)=>{el(id).hidden=!on;el(id).classList.toggle('hidden',!on);};
const put=(id,value)=>{const node=el(id), text=String(value);if(node.textContent!==text)node.textContent=text;};
let myBid=0;
el('howtoBox').querySelector('button').remove();
const guide=document.createElement('div');guide.id='onlineHelp';guide.hidden=true;
guide.append(el('howtoBox').querySelector('ol'));el('menuHelp').after(guide);
el('titleLayer').remove();
el('btnSpeed').remove();el('btnRestart').remove();
el('btnQuit').textContent='방 나가기';el('btnHome').textContent='방 나가기';
el('btnAgain').textContent='재경기 준비';
const menuExtra=document.createElement('p');menuExtra.id='menuExtra';el('menuHeading').after(menuExtra);
const watchBox=document.createElement('label');watchBox.id='onlineWatch';watchBox.innerHTML='관전 <select id="watch" aria-label="관전할 라인"></select>';el('boardWrap').append(watchBox);
const miniLanes=document.createElement('div');miniLanes.id='miniLanes';miniLanes.hidden=true;
el('boardWrap').prepend(miniLanes);
miniLanes.onclick=e=>{
  const btn=e.target.closest('button[data-watch]');
  if(btn){watched=Number(btn.dataset.watch);selected=null;apply(state);}
};
el('btnMenu').onclick=()=>{guide.hidden=true;el('menuLayer').showModal();el('btnMenu').setAttribute('aria-expanded','true');};
el('menuLayer').onclose=()=>el('btnMenu').setAttribute('aria-expanded','false');
el('menuHelp').onclick=()=>{guide.hidden=!guide.hidden;};
el('btnResume').onclick=()=>el('menuLayer').close();
el('augTitle').nextElementSibling.textContent='20초 안에 하나를 골라 줘. 시간이 끝나면 첫 후보를 선택해.';
el('cv').width=480;el('cv').setAttribute('aria-label','방어 필드');

const message=t=>{el('message').textContent=t;};
const connection=t=>{el('network').textContent=t;};
let session=JSON.parse(sessionStorage.getItem('auction-room')||'null'), state, previous, arrived=0;
let socket,poller,polling=false,channel=Promise.resolve(),sequence=0,selected=null,offset=0,draftTimer;
let background,backgroundMode,watched=null,retrySocket;
ART.init();
['archer','firemage','frostgolem','cannoneer'].forEach((k,i)=>ART.draw(el('crest').getContext('2d'),k,20+i*40,46,2.35));
async function post(path,body={},auth=true){
  const headers={'Content-Type':'application/json'};
  if(auth&&session)headers.Authorization='Bearer '+session.token;
  const res=await fetch(path,{method:'POST',headers,body:JSON.stringify(body),cache:'no-store'});
  const data=await res.json();
  if(!res.ok)throw Object.assign(new Error(data.error||'연결을 확인해 줘.'),{status:res.status});
  return data;
}
const path=(op)=>'/api/'+session.code+'/'+op;
function toggleSound(){
  SFX.init();SFX.setMuted(!SFX.muted);
  for(const id of ['lobbySound','menuSound','btnSound'])el(id).setAttribute('aria-pressed',String(!SFX.muted));
  el('btnSound').querySelector('img').src='icons/'+(SFX.muted?'muted':'volume')+'.svg';
  for(const id of ['lobbySound','menuSound'])put(id,SFX.muted?'효과음 꺼짐':'효과음 켜짐');
  if(!SFX.muted)SFX.confirm();
}
for(const id of ['lobbySound','menuSound','btnSound'])el(id).onclick=toggleSound;
async function enter(create){
  SFX.init();
  const key=el('code').value.trim().toUpperCase();
  if(!create&&!/^[A-HJ-NP-Z2-9]{4}$/.test(key)){message('네 자리 방 코드를 입력해 줘.');return;}
  el('create').disabled=el('join').disabled=true;
  try{
    session=await post(create?'/api/create':'/api/'+key+'/join',{mode:el('mode').value,marketVersion:4,name:getNickname()},false);
    sessionStorage.setItem('auction-room',JSON.stringify(session));message('');connect();
  }catch(e){message(e.message);}finally{el('create').disabled=el('join').disabled=false;}
}
function reset(){
  clearInterval(poller);clearTimeout(retrySocket);clearTimeout(draftTimer);watched=null;session=null;sessionStorage.removeItem('auction-room');
  if(socket){socket.onclose=null;socket.close();socket=null;}
  drawLoadout(null,[],{},'lobby');renderGateReport([]);
  state=previous=null;sequence=0;selected=null;
  el('menuLayer').close();show('app',false);show('onlineLobby',true);show('room',false);show('entry',true);connection('');
}
async function sync(){
  if(!session||polling)return;
  const current=session;polling=true;
  try{const data=await post(path('sync'));if(current===session){apply(data);connection('접속 중');}}
  catch(e){if(current===session){if(e.status===403||e.status===404)reset();message(e.message);}}
  finally{polling=false;}
}
function connect(){
  const current=session;
  sync();clearInterval(poller);
  poller=setInterval(()=>{if(!socket||socket.readyState!==1)sync();},600);
  try{
    socket=new WebSocket((location.protocol==='https:'?'wss://':'ws://')+location.host+path('socket'),session.token);
    socket.onmessage=e=>{if(current===session){apply(JSON.parse(e.data));connection('실시간 연결');}};
    socket.onclose=()=>{if(current===session){connection('다시 연결 중…');sync();clearTimeout(retrySocket);retrySocket=setTimeout(()=>{if(current===session)connect();},4000);}};
    socket.onerror=()=>{};
  }catch{}
}
function command(op,body={}){
  const current=session,wave=state?.wave,roundId=state?.roundId||0;
  channel=channel.then(async()=>{
    if(current!==session||!session)return;
    try{
      const data=await post(path(op),{...body,wave,roundId,seq:++sequence});
      if(current===session){apply(data);message('');}
    }catch(e){message(e.message);await sync();}
  });
  return channel;
}
el('create').onclick=()=>enter(true);el('join').onclick=()=>enter(false);
el('code').onkeydown=e=>{if(e.key==='Enter')enter(false);};
el('start').onclick=()=>{SFX.init();command('start');};
el('btnAgain').onclick=()=>command('ready',{ready:!state.seats[state.me].ready});
el('copy').onclick=async()=>{try{await navigator.clipboard.writeText(session.code);message('방 코드를 복사했어.');}catch{message('방 코드 '+session.code);}};
el('leave').onclick=async()=>{try{await post(path('leave'));reset();message('방에서 나왔어.');}catch(e){message(e.message);}};
el('btnQuit').onclick=el('btnHome').onclick=el('leave').onclick;
const bidButtons=[...document.querySelectorAll('#auctionPanel .bid-btns button,#auctionPanel .action-row button')];
const price=()=>Math.max(0,Math.min(myBid,state.players[state.me].gold));
function auctionReady(){
  return state?.phase==='auction' && Date.now()+offset>=state.opensAt && state.players[state.me].alive && !state.ownOffer.locked;
}
function setBid(n){
  if(!auctionReady())return;
  myBid=Math.max(0,Math.min(n,state.players[state.me].gold));showPrice();
  clearTimeout(draftTimer);
  const wave=state.wave;
  draftTimer=setTimeout(()=>{if(auctionReady() && state.wave===wave)command('bid',{amount:price()});},90);
}
function showPrice(){
  if(Number(amountInput.value)!==price() || !amountInput.value)amountInput.value=price();amountInput.max=state.players[state.me].gold;put('bidOwn',state.players[state.me].gold);
  put('lotAdvice',lotAdvice(state.lotPreview));
  put('bidPreview',bidPreviewText(state.key,state.players[state.me].gold,price(),state.lotPreview));
}
function confirmPrice(amount){
  if(!auctionReady())return;
  clearTimeout(draftTimer);myBid=amount;command('confirm',{amount});
}
for(const b of document.querySelectorAll('[data-bid]'))b.onclick=()=>setBid(myBid+Number(b.dataset.bid));
el('btnAllin').onclick=()=>setBid(state.players[state.me].gold);
el('btnPass').onclick=()=>confirmPrice(0);
el('btnConfirm').onclick=()=>confirmPrice(price());
document.addEventListener('keydown',e=>{
  if((e.code==='Space'||e.code==='Enter')&&auctionReady()&&!e.repeat&&!document.querySelector('dialog[open]')&&!e.target.closest('input,select,button,summary,a')){
    e.preventDefault();confirmPrice(price());
  }
});
el('btnUpgrade').onclick=()=>command('upgrade',{unit:selected});
el('btnSell').onclick=()=>command('sell',{unit:selected});
el('btnCancelSel').onclick=()=>{selected=null;renderUnits();};
function outcome(h){
  const res=h.outcome;
  if(res.type==='sold')return state.seats[res.winner].name+' 낙찰 · '+res.price+'G · '+bidComparison(h.bids,res);
  return res.type==='unsold'?'동점 유찰 · '+res.max+'G':'모두 패스';
}
function setHTML(id,html){if(el(id).dataset.last!==html){el(id).innerHTML=html;el(id).dataset.last=html;}}
function apply(next){
  if(!session||next.code!==session.code||state&&next.now<state.now)return;
  previous=state;state=next;arrived=performance.now();
  offset=next.now-Date.now();sequence=Math.max(sequence,next.lastSeq||0);
  const {phase,me,seats,mode,host}=next, lobby=phase==='lobby', coop=mode==='coop';
  show('entry',false);show('room',true);el('roomCode').textContent=next.code;
  el('modeName').textContent=coop?'협력 · 중앙 코어':'서바이벌 · 4인 라인전';
  el('roomTitle').textContent=lobby?'대기실':phase==='result'?'최종 결과':'웨이브 '+next.wave+' / '+(next.maxWaves||10);
  setHTML('roster',seats.map((s,i)=>{
    const p=next.players?.[i],role=s.online?'접속 중':s.human?'재접속 대기':'봇';
    return '<div class="seat '+(i===me?'mine':'')+'" style="--accent:'+colors[i]+'"><b>'+s.name+(i===me?' · 나':'')+'</b><small>'+(host===i?'방장 · ':'')+role+'</small>'+(p?'<small>'+p.gold+'G · '+(coop?p.damage+' 피해':p.alive?'<img src="/icons/heart.svg" width="12" height="12" alt="라이프"> '+p.lives:'탈락')+'</small>':'')+'</div>';
  }).join(''));
  show('onlineLobby',lobby);show('app',!lobby);show('lobby',lobby);show('start',host===me);
  if(lobby){put('lobbyHint',host===me?'코드를 친구에게 알려 줘. 시작할 때 빈자리는 봇이 맡아.':'방장이 시작하면 함께 입장해.');return;}
  const p=next.players[me], myField=next.fields[coop?0:me];
  renderGateReport(next.gateHistory||[]);
  drawLoadout(next.inventory,next.inventory.units||myField.slots.filter(s=>s.owner===me&&s.unit).map(s=>s.unit),myField.traits,phase,next.lastBoss,selected,next.key);
  show('onlineWatch',!coop);
  if(!coop){
    if(watched===null)watched=me;
    setHTML('watch',seats.map((s,i)=>'<option value="'+i+'">'+s.name+(i===me?' · 나':'')+'</option>').join(''));
    el('watch').value=String(watched);
  }
  const otherLines=coop?[]:seats.map((_,i)=>i).filter(i=>i!==watched);
  miniLanes.hidden=coop || !otherLines.some(i=>next.players[i].alive);
  if(!miniLanes.hidden)setHTML('miniLanes',otherLines.map(i=>'<button data-watch="'+i+'" aria-label="'+seats[i].name+' 라인 관전"><canvas width="144" height="55"></canvas><span>'+seats[i].name+' · '+(next.players[i].alive?next.players[i].lives+' HP':'탈락')+'</span></button>').join(''));
  if(previous?.phase!==phase){
    if(phase==='auction')SFX.spawn();
    if(phase==='reveal')(next.history[0].outcome.type==='sold'?SFX.sold:SFX.unsold)();
    if(phase==='waveend'||phase==='result')SFX.clear();
  }else if(phase==='battle' && previous?.players){
    if((coop && next.core<previous.core)||p.lives<previous.players[me].lives)SFX.leak();
    else if(p.kills>previous.players[me].kills)SFX.hit();
  }
  put('menuExtra','방 '+next.code+' · '+seats[me].name+' · '+el('network').textContent);
  put('waveNum',next.wave);put('goldNum',p.gold);put('lifeNum',coop?next.core:p.lives);put('myKills',p.kills);
  el('waveNum').nextElementSibling.textContent='/'+next.maxWaves;
  el('lifeIcon').src='icons/'+(coop?'core':'heart')+'.svg';
  put('modeLabel',(coop?'협력 · 코어 방어':'서바이벌')+' · '+seats[me].name);
  for(const [id,on] of Object.entries({auctionPanel:phase==='auction',battlePanel:phase==='battle',idlePanel:['reveal','waveend','augment'].includes(phase),
    revealLayer:phase==='reveal',resultLayer:phase==='result'}))show(id,on);
  const newWave=previous?.wave!==next.wave||previous?.roundId!==next.roundId;
  if(newWave || phase==='auction' && previous?.phase!=='auction'){myBid=next.ownOffer?.amount||0;selected=null;}
  if(phase==='auction'){
    if(newWave || previous?.key!==next.key)showLotCard(next.key);
    put('forecast',(next.routes?routeForecast(next.wave,next.mode,next.fourGates)+' ｜ ':'')+auctionForecast(next.wave,next.nextKey));
    if(next.ownOffer.locked)myBid=next.ownOffer.amount;
    showPrice();paintTimer();
  }else if(phase==='reveal'){
    const h=next.history[0];
    setHTML('bidCards',h.bids.map((v,i)=>'<div class="bid-card open '+(h.outcome.winner===i?'win ':'')+(i===me?'me':'')+'"><div class="bc-name"><i class="bc-dot" style="background:'+colors[i]+'"></i>'+seats[i].name+(i===me?' · 나':'')+'</div><div class="bc-amt">'+v+'G</div></div>').join(''));
    put('revealOutcome',outcome(h));
  }else if(phase==='result'){
    const rows=next.players.map((v,i)=>({...v,i})).sort((a,b)=>coop?b.damage-a.damage||b.kills-a.kills:Number(b.alive)-Number(a.alive)||b.lives-a.lives||b.kills-a.kills);
    const won=next.wave===next.maxWaves&&(coop?next.core>0:p.alive);
    put('resultTitle',won?'완벽한 승리!':'방어 종료');put('resultSub','W'+next.wave+' · 재경기 준비 '+seats.filter(s=>s.online&&s.ready).length+'/'+seats.filter(s=>s.online&&s.human).length);
    put('btnAgain',seats[me].ready?'준비 취소':'재경기 준비');
    setHTML('rankTable',rows.map((r,i)=>'<tr class="'+(r.i===me?'me':'')+'"><td>'+(i+1)+'</td><td>'+seats[r.i].name+'</td><td>'+(coop?r.damage+' 피해':r.lives+' 라이프')+'</td><td>'+r.kills+'킬</td></tr>').join(''));
    const report=bossReport(next.lastBoss);put('finalBoss',report);el('finalBoss').hidden=!report;
  }
  if(phase==='battle'){
    put('enemyLeft',myField.remaining);
    renderSynergies(myField.traits,myField.synLabels);
    show('coopBoard',coop);
    if(coop)setHTML('coopBoard',next.players.map((v,i)=>'<div class="coop-row"><b class="cr-name" style="color:'+colors[i]+'">'+seats[i].name+'</b><span class="cr-val">'+v.damage+' 피해 · '+v.kills+'킬</span></div>').join(''));
    setHTML('waveComp',WAVES[next.wave-1].comp.map(([k,n])=>'<span class="wc-chip">'+(ENEMIES[k].boss?BOSS_PATTERNS[next.wave].name:ENEMIES[k].name)+' ×'+waveCount(k,n,next.mode,next.maxWaves>10,next.fourGates)+'</span>').join(''));
  }
  el('idlePanel').firstElementChild.textContent=phase==='waveend'?'웨이브 종료 · '+(next.recovery||'생존 보상 정산'):phase==='augment'?'증강 선택 중':'입찰 공개 중';
  const rivals=seats.map((s,i)=>i===me?'':'<div class="rival-row"><i class="rival-dot" style="background:'+colors[i]+'"></i>'+s.name+' · '+(s.online?'접속 중':s.human?'재접속 대기':'봇')+' · '+next.players[i].gold+'G</div>').join('');
  const history=next.history.map(h=>'<div class="h-row">W'+h.wave+' · '+LOTS[h.key].name+' · '+outcome(h)+'</div>').join('')||'아직 경매 기록이 없어.';
  for(const id of ['histAuction','histBattle'])setHTML(id,history);
  for(const id of ['rivalList','rivalList2'])setHTML(id,rivals);
  const active=phase==='auction' || phase==='battle';
  const selHost=phase==='auction'?el('auctionPanel'):el('battlePanel');
  if(active && el('selActions').parentElement!==selHost)selHost.insertBefore(el('selActions'),phase==='auction'?el('auctionPanel').querySelector('.history'):el('slotHint'));
  renderUnits();
}
function slots(){return state.fields[state.mode==='coop'?0:state.me].slots.filter(s=>s.owner===state.me);}
const drawLoadout=loadoutUI((unit,key)=>command('equip',{unit,key}),key=>command('augment',{key}),uid=>{
  selected=uid;
  if(uid!==null && state.mode==='survival')watched=state.me;
  apply(state);
},(x,y)=>{
  const slot=onlineBoardSlot(x,y);
  return slot?.owner===state.me?slot.unit?.id:null;
},()=>state.fields[state.mode==='coop'?0:state.me].slots.filter(s=>s.unit).map(s=>({
  ...s.unit,owner:s.owner,mine:s.owner===state.me
})));
const placement = placementPreview(() => {
  if(!state?.fields || !['auction','battle'].includes(state.phase) || !state.players[state.me].alive) return null;
  if(state.mode==='survival' && watched!==state.me) return null;
  const own=slots();
  return own.some(s=>s.unit && s.unit.id===selected) ? {id:selected,slots:own} : null;
}, slot=>command('move',{unit:selected,slot:slot.idx}));
function renderUnits(){
  drawLoadout.inspect(selected);
  placement.sync();
  const own=slots(),u=own.map(s=>s.unit).find(u=>u?.id===selected);
  if(selected!==null && !state.fields.some(f=>f.slots.some(s=>s.unit?.id===selected)))selected=null;
  setHTML('unitRow',own.filter(s=>s.unit).map(s=>'<button data-id="'+s.unit.id+'" class="unit-chip '+(s.unit.id===selected?'sel':'')+'">'+UNITS[s.unit.key].name+' ★'+s.unit.star+'</button>').join('')||'<small>다음 경매에서 유닛을 낙찰받아 줘.</small>');
  show('selActions',!!u && ['auction','battle'].includes(state.phase));if(!u)return;
  const cost=UPGRADE_COST[u.star]||0,free=state.players[state.me].gold-(state.ownOffer?.amount||0);
  el('btnUpgrade').disabled=!cost||free<cost;el('btnUpgrade').textContent=cost?'강화 '+cost+'G':'최대 강화';
  put('selName',UNITS[u.key].name+' '+STAR[u.star].label);
}
el('unitRow').onclick=e=>{
 const id=e.target.closest('button')?.dataset.id;if(!id)return;
 selected=Number(id);if(state.mode==='survival' && watched!==state.me){watched=state.me;apply(state);}else renderUnits();
};
function paintTimer(){
 const now=Date.now()+offset, prep=now<(state.opensAt||0);
 const remaining=Math.max(0,((prep?state.opensAt:state.endsAt)-now)/1000);
 put('timerNum',Math.ceil(remaining));
 el('timerFill').style.width=Math.min(100,remaining/(prep?AUCTION_PREP_SECONDS:AUCTION_SECONDS)*100)+'%';
 el('timerNum').closest('.auc-timer').classList.toggle('urgent',!prep&&remaining<=3);
 put('aucHint',prep?'경매 준비 · 매물 확인':state.ownOffer.locked?'입찰 확정':state.ownOffer.amount?'접수 '+state.ownOffer.amount+'G · 수정 가능':'비공개 동시 입찰 중');
 const locked=!auctionReady();amountInput.disabled=locked;
 for(const b of bidButtons)if(b.disabled!==locked)b.disabled=locked;
}
// Keep the touch keypad and the original direct numeric bid on desktop and mobile.
const amountInput=document.createElement('input');
amountInput.type='number';amountInput.min='0';amountInput.inputMode='numeric';amountInput.id='price';
amountInput.setAttribute('aria-label','내 입찰가');el('bidNum').replaceChildren(amountInput);
amountInput.oninput=()=>setBid(Math.floor(Number(amountInput.value)||0));
amountInput.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();confirmPrice(price());}};
const board=el('cv'),ctx=board.getContext('2d');
function onlineBoardSlot(clientX,clientY){
  if(!state?.fields)return null;
  const field=state.fields[state.mode==='coop'?0:watched];
  const rect=board.getBoundingClientRect(),scale=Math.min(rect.width/board.width,rect.height/board.height);
  const x=(clientX-rect.left-(rect.width-board.width*scale)/2)/scale,y=(clientY-rect.top-(rect.height-board.height*scale)/2)/scale;
  return ART.pickBoardSlot(field.slots,x,y,1.8,3);
}
board.onclick=e=>{
  if(!state?.fields||!['battle','auction'].includes(state.phase))return;
  const slot=onlineBoardSlot(e.clientX,e.clientY);
  if(slot?.unit)selected=slot.unit.id;
  else if(slot?.owner===state.me && slots().some(s=>s.unit && s.unit.id===selected)){
    if(!placement.choose(slot))command('move',{unit:selected,slot:slot.idx});
  }else selected=null;
  renderUnits();
};
function paint(ts){
  requestAnimationFrame(paint);
  if(!state?.fields)return;
  if(state.phase==='auction')paintTimer();
  const coop=state.mode==='coop',idx=coop?0:(watched??state.me),f=state.fields[idx];
  const mapKey=state.mode+':'+!!state.routes;
  if(backgroundMode!==mapKey){
    board.height=coop?360:220;background=document.createElement('canvas');background.width=480;background.height=board.height;
    if(state.routes)ART.tradeRoad(background.getContext('2d'),480,board.height,coop);
    else (coop?ART.bgCoop:ART.bgSurvival)(background.getContext('2d'),480,board.height,11);
    backgroundMode=mapKey;
  }
  if(!miniLanes.hidden){
    for(const btn of miniLanes.children){
      const field=state.fields[Number(btn.dataset.watch)],c=btn.firstElementChild,mini=c.getContext('2d');
      mini.save();mini.scale(c.width/480,c.height/220);mini.imageSmoothingEnabled=false;
      mini.drawImage(background,0,0);
      for(const s of field.slots)if(s.unit)ART.draw(mini,s.unit.key,s.x,s.y+6,2.6);
      for(const e of field.enemies)ART.draw(mini,e.pattern||e.key,e.x,e.y+3,e.small?1.5:2.2);
      mini.restore();
    }
  }
  ctx.drawImage(background,0,0);ctx.imageSmoothingEnabled=false;
  const inspected=selected!==null && f.slots.find(s=>s.unit?.id===selected);
  const gearRange=drawLoadout.drawGearRange(ctx,f.slots);
  if(inspected && !gearRange && Number.isFinite(inspected.unit.range)){
    ART.drawRange(ctx,inspected.x,inspected.y,inspected.unit.range);
    placement.draw(ctx,f.slots,selected,inspected.unit.key,inspected.unit.range);
  }
  if(coop)ART.drawCore(ctx,state.core,COOP.coreHp,ts/1000);
  else ART.drawBase(ctx,state.players[idx].lives,ECON.lives,ts/1000);
  for(const s of f.slots){
    ctx.strokeStyle=s.unit?.id===selected?'#fff':colors[s.owner];ctx.lineWidth=s.unit?.id===selected?3:1;
    if(state.routes)ART.outpost(ctx,s,colors[s.owner],inspected?.owner===s.owner && !s.unit);
    else ctx.strokeRect(s.x-14,s.y-7,28,14);
    if(s.unit){ART.shadow(ctx,s.x,s.y+12,24);ART.draw(ctx,s.unit.key,s.x,s.y+10,3);if(s.unit.star>1){ctx.fillStyle='#ffdd70';ctx.fillText('★'.repeat(s.unit.star),s.x-10,s.y-26);}}
  }
  const prior=previous?.wave===state.wave?previous.fields?.[idx]?.enemies:[],t=Math.min(1,(ts-arrived)/500);
  for(const e of f.enemies){
    const old=prior?.find(o=>o.id===e.id),x=old?old.x+(e.x-old.x)*t:e.x,y=old?old.y+(e.y-old.y)*t:e.y;
    const scale=e.key==='kingslime'?2.6:e.small?1.2:1.6;
    ART.draw(ctx,e.pattern||e.key,x,y+4,scale);
    if(e.stance)ART.drawStance(ctx,x,y+4,scale,e.stance);
    if(e.pattern==='charge')ART.drawChargeCue(ctx,x,y+4,scale,e.charge);
    ctx.fillStyle='#382436';ctx.fillRect(x-9,y-25,18,3);ctx.fillStyle='#f791a1';ctx.fillRect(x-9,y-25,18*Math.max(0,e.hp),3);
  }
  for(const sh of f.shots){ctx.fillStyle=sh.color;ctx.fillRect(sh.x,sh.y,4,3);}
  if(inspected && inspected.owner===state.me && ['auction','battle'].includes(state.phase)
      && f.slots.some(s=>s.owner===state.me && !s.unit))placement.drawHint(ctx,inspected.x,inspected.y);
}
el('watch').onchange=()=>{selected=null;watched=Number(el('watch').value);apply(state);};
requestAnimationFrame(paint);if(session)connect();
