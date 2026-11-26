// The room owns the simulation clock, balances, bids and seat assignments.
function makeMatch(room, mode, now, seed) {
  const G = {fourGates:room.marketVersion>=4,routes:room.marketVersion>=3,maxWaves:room.marketVersion>=2?MAX_WAVES:CLASSIC_WAVES, expansion:room.marketVersion!==0, mode, phase:'lobby', wave:0, uid:0, coreHp:0, coreMax:0, shake:0,
    seed, players:[], history:[], lastStep:now, deadline:0};
  const sim = roomCombat(G);
  G.players = room.seats.map((s,i)=>sim.makePlayer(i,s.name,PLAYER_COLORS[i],null));
  sim.setupFields(mode);
  G.deck = G.expansion?sim.makeDeck():sim.shuffle(CLASSIC_UNITS.slice());
  nextAuction(room,G,sim,now);
  return G;
}
function roomCombat(G) {
  function random() {
    G.seed = (Math.imul(1664525,G.seed) + 1013904223) >>> 0;
    return G.seed / 4294967296;
  }
  const noop = ()=>{};
  return createCombat(G,{random,SFX:{hit:noop,leak:noop},addToast:noop,onLoss:noop});
}
function living(G,i) { return G.mode === 'coop' || G.players[i].field.alive; }
function nextAuction(room,G,sim,now) {
  G.wave++;
  G.phase='auction';
  G.opensAt=now+(G.fourGates?AUCTION_PREP_SECONDS:0)*1000;
  G.deadline=G.opensAt+AUCTION_SECONDS*1000;
  G.key=G.deck.pop();
  G.offers=room.seats.map((s,i)=>{
    const bot=!s.online;
    return {amount: bot && living(G,i) ? sim.botBid(BOTS[(i+2)%3],G.players[i],G):0, locked:bot||!living(G,i), auto:bot};
  });
}
function reveal(room,G,sim,now) {
  const bids=G.offers.map(o=>o.amount);
  const outcome=sim.resolveBids(bids);
  if(outcome.type==='sold'){
    const winner=G.players[outcome.winner];
    winner.gold-=outcome.price;
    sim.acquireUnit(winner,G.key);
    if(!room.seats[winner.id].online)sim.botEquip(winner);
  }
  G.history.unshift({wave:G.wave,key:G.key,bids,outcome});
  G.phase='reveal';
  G.deadline=now+3200;
}
function advance(room,now) {
  const G=room.game;
  if(!G) return;
  if(G.phase==='result'){
    const humans=room.seats.filter(s=>s.online && s.token);
    if(humans.length && humans.every(s=>s.ready)){
      if(!G.expansion)room.marketVersion=0;
      room.roundId=(room.roundId||0)+1;
      room.seats.forEach(s=>{s.ready=false;});
      room.expires=now+1800000;
      room.game=makeMatch(room,room.mode,now,crypto.getRandomValues(new Uint32Array(1))[0]);
    }
    return;
  }
  const sim=roomCombat(G);
  if(G.phase==='augment'){
    if(!sim.pendingChoices(p=>!room.seats[p.id].online || now>=G.deadline)){
      G.phase='battle';G.lastStep=now;
    }
    return;
  }
  if(G.phase==='auction'){
    if(now<G.opensAt)return;
    for(const [i,s] of room.seats.entries()){
      if(!s.online && s.leftAt && !G.offers[i].locked && (now-s.leftAt>=8000 || now>=G.deadline+200))
        G.offers[i]={amount:0,locked:true,auto:true};
    }
    if(now>=G.deadline+200 || G.offers.every(o=>o.locked)) reveal(room,G,sim,now);
  } else if(G.phase==='reveal' && now>=G.deadline){
    sim.prepareBattle(); G.phase='battle'; G.lastStep=now;
  } else if(G.phase==='waveend' && now>=G.deadline){
    if(G.wave>=campaignLength(G)) G.phase='result';
    else nextAuction(room,G,sim,now);
  } else if(G.phase==='battle'){
    const steps=Math.min(300,Math.floor((now-G.lastStep)*30/1000));
    const fields=G.mode==='coop'?[G.arena]:G.players.map(p=>p.field);
    for(let n=0;n<steps;n++){
      for(const field of fields) sim.updateField(field,1/30);
      G.lastStep+=1000/30;
      if(G.mode==='coop'?G.coreHp<=0:fields.every(f=>!f.alive)){G.phase='result';return;}
      if(sim.pendingChoices(p=>!room.seats[p.id].online)){
        G.phase='augment';G.deadline=now+20000;return;
      }
      if(!fields.every(f=>f.cleared)) continue;
      for(const p of G.players){
        if(!living(G,p.id))continue;
        p.gold+=ECON.waveGold;
        p.gold+=Math.min(ECON.interestMax,Math.floor(p.gold*ECON.interestRate))+sim.income(p);
        if(!room.seats[p.id].online)sim.botUpgrade(p);
      }
      G.recovery=sim.checkpointRecovery();
      G.phase='waveend';G.deadline=now+1500;return;
    }
  }
}
function act(room,i,m,now) {
  const G=room.game;
  if(!G||m.wave!==G.wave||!living(G,i))return false;
  const p=G.players[i], sim=roomCombat(G);
  if(m.t==='bid'||m.t==='confirm'){
    if(G.phase!=='auction'||now<G.opensAt||now>G.deadline+200||G.offers[i].locked||!Number.isSafeInteger(m.amount)||m.amount<0||m.amount>p.gold)return false;
    G.offers[i]={amount:m.amount,locked:m.t==='confirm',auto:false};
    return true;
  }
  if(m.t==='augment')return G.phase==='augment' && sim.chooseAugment(p,m.key);
  if(m.t==='equip')return equipmentPhase(G.phase) && sim.equip(p,m.unit,m.key);
  if(!['auction','battle'].includes(G.phase))return false;
  const u=p.field.units.find(u=>u.uid===m.unit&&u.owner===i);
  if(!u)return false;
  if(m.t==='upgrade'){
    const cost=sim.upgradeCost(u);
    const reserved=G.phase==='auction'?G.offers[i].amount:0;
    if(!cost||p.gold-reserved<cost)return false;
    p.gold-=cost;u.star++;
  }else if(m.t==='sell'){
    p.gold+=sim.sellValue(u);sim.removeUnit(p,u);
  }else if(m.t==='move'){
    const to=p.field.slots.find(s=>s.owner===i&&s.idx===m.slot&&!s.unit);
    if(!to)return false;
    u.slot.unit=null;to.unit=u;u.slot=to;u.x=to.x;u.y=to.y;
  }else return false;
  sim.recomputeField(p.field);return true;
}
function view(room,i,now) {
  const G=room.game;
  const base={t:'state',roundId:room.roundId||0,code:room.code,mode:room.mode,me:i,host:room.host,now,expires:room.expires,
    seats:room.seats.map(s=>({name:s.name,online:s.online,human:!!s.token,ready:!!s.ready})),phase:G?.phase||'lobby'};
  if(!G)return base;
  const sim=roomCombat(G);
  const fields=G.mode==='coop'?[G.arena]:G.players.map(p=>p.field);
  return {...base,fourGates:!!G.fourGates,opensAt:G.opensAt,routes:!!G.routes,maxWaves:campaignLength(G),recovery:G.recovery,wave:G.wave,key:G.key,nextKey:G.phase==='auction' ? G.deck.at(-1)||null : null,endsAt:G.deadline,ownOffer:G.phase==='auction'?G.offers[i]:null,
    lotPreview:G.phase==='auction'?sim.lotPreview(G.players[i],G.key):null,
    gateHistory:finishedGateWaves(G),lastBoss:G.players[i].field.lastBoss || null,
    inventory:{units:sim.playerSlots(G.players[i]).filter(s=>s.unit).map(s=>sim.loadoutUnit(s.unit,G.players[i].bag||[])),bag:G.players[i].bag||[],relics:G.players[i].relics||[],augments:G.players[i].augments||[],choices:G.players[i].choices||[]},
    history:G.history,core:G.coreHp,players:G.players.map(p=>({gold:p.gold,lives:p.field.lives,alive:living(G,p.id),kills:p.stats.kills,damage:Math.round(p.stats.damage),color:p.color})),
    fields:fields.map(f=>({traits:f.traits,synLabels:f.traits?undefined:f.synLabels,shield:f.shield,slots:f.slots.map(s=>({x:s.x,y:s.y,idx:s.idx,owner:s.owner,unit:s.unit?{id:s.unit.uid,key:s.unit.type,star:s.unit.star,gear:s.unit.gear,interval:sim.unitRate(s.unit),range:sim.unitRange(s.unit,f)}:null})),
      enemies:f.enemies.filter(e=>!e.dead).map(e=>({id:e.netId,key:e.type,pattern:e.pattern,stance:bossStance(e),small:!!e.small,charge:e.pattern==='charge'?chargeStage(e.t):'',x:e.x,y:e.y,hp:e.hp/e.maxHp})),shots:(G.phase==='battle' && f.active?f.shots:[]).map(s=>({x:s.x,y:s.y,color:s.color})),remaining:f.queue.length+f.enemies.length}))};
}
