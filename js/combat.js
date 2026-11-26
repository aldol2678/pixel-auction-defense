'use strict';
const FW = 480, FH = 220;          // 서바이벌 필드 논리 크기
const CW = 480, CH = 360;          // 협력 아레나 논리 크기
const BASE_X = 422;                // 서바이벌 기지 x

const SLOTS_SURV = [
  { x: 92, y: 66 }, { x: 166, y: 66 }, { x: 240, y: 66 }, { x: 314, y: 66 },
  { x: 92, y: 156 }, { x: 166, y: 156 }, { x: 240, y: 156 }, { x: 314, y: 156 },
];
const SLOTS_COOP = [
  // 0: 아래(나)
  [{ x: 190, y: 292 }, { x: 240, y: 292 }, { x: 290, y: 292 }, { x: 190, y: 326 }, { x: 240, y: 326 }, { x: 290, y: 326 }],
  // 1: 위
  [{ x: 190, y: 68 }, { x: 240, y: 68 }, { x: 290, y: 68 }, { x: 190, y: 34 }, { x: 240, y: 34 }, { x: 290, y: 34 }],
  // 2: 왼쪽
  [{ x: 68, y: 146 }, { x: 68, y: 180 }, { x: 68, y: 214 }, { x: 34, y: 146 }, { x: 34, y: 180 }, { x: 34, y: 214 }],
  // 3: 오른쪽
  [{ x: 412, y: 146 }, { x: 412, y: 180 }, { x: 412, y: 214 }, { x: 446, y: 146 }, { x: 446, y: 180 }, { x: 446, y: 214 }],
];
const PLAYER_COLORS = ['#7ef0c9', '#ff8fa3', '#ffd166', '#8bd3ff'];
const LANES = [84, 110, 136];
// 자동 배치 순서: 기지에 가까운 슬롯부터 (누수를 막는 쪽)
const SLOT_ORDER_SURV = [3, 7, 2, 6, 1, 5, 0, 4];


function createCombat(G, { random, SFX, addToast, onLoss }) {
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const rand = (a, b) => a + random() * (b - a);
const pick = (arr) => arr[Math.floor(random() * arr.length)];
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

function makeDeck() {
  const deck=[];
  for(let offset=0;offset<campaignLength(G);offset+=10){
    const chapter=shuffle([...shuffle(UNIT_KEYS.slice()).slice(0,6),...shuffle(Object.keys(GEAR)).slice(0,2),...shuffle(Object.keys(RELICS)).slice(0,2)]);
    deck.push(...chapter);
  }
  return deck;
}
function equip(p, uid, key) {
  const u=p.field.units.find(v=>v.owner===p.id && v.uid===uid);
  if(!u || (key===null?!u.gear:!Object.hasOwn(GEAR,key)||!p.bag?.includes(key)))return false;
  if(key!==null)p.bag.splice(p.bag.indexOf(key),1);
  if(u.gear)p.bag.push(u.gear);
  u.gear=key;
  return true;
}
function botEquip(p) {
  const units=p.field.units.filter(u=>u.owner===p.id&&!u.gear).sort((a,b)=>b.star-a.star);
  for(const u of units)if(p.bag?.length)equip(p,u.uid,p.bag[0]);
}
function modifier(u,k) {
  const p=G.players[u.owner];
  let sum=GEAR[u.gear]?.[k]||0;
  for(const key of p.relics||[])sum+=RELICS[key][k]||0;
  for(const key of p.augments||[])sum+=AUGMENTS[key][k]||0;
  return sum;
}
function hasTrait(u,k) {
  return ROSTER[u.type].includes(k)?traitLevel(G.players[u.owner].field.traits,k):0;
}
function income(p) {
  if(!G.expansion)return p.field.synergy.bonusGold||0;
  return p.field.units.some(u=>u.owner===p.id && ROSTER[u.type].includes('frontier'))?traitLevel(p.field.traits,'frontier'):0;
}
function checkpointRecovery() {
  if(campaignLength(G)<=CLASSIC_WAVES || ![10,15].includes(G.wave))return '';
  if(G.mode==='coop'){
    if(G.coreHp<=0)return '';
    const gain=Math.min(G.coreMax-G.coreHp,15);
    G.coreHp+=gain;
    return '중간 정비 · 코어 +'+gain;
  }
  for(const p of G.players)if(p.field.alive)p.field.lives=Math.min(p.field.maxLives,p.field.lives+4);
  return '중간 정비 · 생존 라인 라이프 최대 +4';
}
function rewardBoss(f) {
  for(const p of G.players) {
    if(p.field!==f || p.rewardWave===G.wave)continue;
    p.rewardWave=G.wave;
    p.choices=shuffle(Object.keys(AUGMENTS).filter(k=>!p.augments.includes(k) && (k!=='breaker'||campaignLength(G)>CLASSIC_WAVES))).slice(0,3);
  }
  if(G.wave===10 || G.wave===20){
    // The last augmentation can be used against the royal guard immediately.
    for(let i=0;i<3;i++)spawnEnemy(f,'armored');
  }
}
function chooseAugment(p,key) {
  if(!p.choices?.includes(key))return false;
  p.augments.push(key);p.choices=[];
  return true;
}
function pendingChoices(isBot) {
  for(const p of G.players)if(p.choices?.length && (isBot(p)||!p.field.alive))chooseAugment(p,p.choices[0]);
  return G.players.some(p=>p.choices?.length);
}

function makeSlots(list, owner) {
  return list.map((p, i) => ({ idx: i, x: p.x, y: p.y, owner, unit: null }));
}

function makeField(owner, mode) {
  const f = {
    owner, mode, entryCount:0,
    slots: [], units: [], enemies: [], shots: [], fx: [], nums: [], parts: [],
    lives: ECON.lives, maxLives: ECON.lives,
    queue: [], spawnT: 0, spawnGap: 0.85, active: false, cleared: true, alive: true,
    kills: 0, damage: 0, synergy: { dmgMul: 1, rateMul: 1, splashMul: 1, slowMul: 1, rangeAdd: 0, bonusGold: 0 },
    synLabels: [], coreFlash: 0, lastLeak: 0,
  };
  if (mode === 'survival') f.slots = makeSlots(G.routes?FORK_POSTS.map(([x,y])=>({x,y})):SLOTS_SURV, owner);
  return f;
}

function makePlayer(i, name, color, persona) {
  return {
    id: i, name, color, persona, isHuman: i === 0,
    bag:[], relics:[], augments:[], choices:[], gold: ECON.startGold, field: null, slots: [], eliminated: false,
    stats: { kills: 0, damage: 0 }, ai: null,
  };
}

function playerSlots(p) { return p.field.slots.filter(s => s.owner === p.id); }

/* ================= 유닛 ================= */
function createUnit(p, type, slot) {
  const u = {
    uid: (G.uid = (G.uid || 0) + 1), type, star: 1, owner: p.id,
    x: slot.x, y: slot.y, slot,
    cd: rand(0.15, 0.5), flash: 0, recoil: 0, bob: rand(0, 6.28),
    kills: 0, dmgDealt: 0, spawnPop: 0.35,
  };
  slot.unit = u;
  p.field.units.push(u);
  return u;
}

function removeUnit(p, u) {
  const f = p.field;
  if(u.gear){p.bag.push(u.gear);u.gear=null;}
  const i = f.units.indexOf(u);
  if (i >= 0) f.units.splice(i, 1);
  if (u.slot) { u.slot.unit = null; u.slot = null; }
}

function sellValue(u) {
  const base = UNITS[u.type].cost;
  const mul = u.star === 1 ? 0.5 : u.star === 2 ? 0.95 : 1.5;
  return Math.max(1, Math.floor(base * mul));
}

function upgradeCost(u) { return UPGRADE_COST[u.star] || 0; }

function unitRange(u, field = G.players[u.owner].field) {
  const d = UNITS[u.type];
  return d.range + (field.synergy.rangeAdd || 0) + modifier(u,'range') + (hasTrait(u,'shooter')===2?12:0);
}
function unitDamage(u) {
  const d = UNITS[u.type], st = STAR[u.star], syn = G.players[u.owner].field.synergy;
  return d.dmg * st.dmg * (syn.dmgMul || 1) * (u.auraMul || 1) * (1+modifier(u,'damage'));
}
function unitRate(u) {
  const d = UNITS[u.type], st = STAR[u.star], syn = G.players[u.owner].field.synergy;
  const shooter=hasTrait(u,'shooter');
  return d.rate * st.rate * (syn.rateMul || 1) * (shooter===2?.85:shooter===1?.92:1) * Math.max(.35,1-modifier(u,'speed'));
}

// Compare against the combat calculations without changing the worn item or inventory.
function loadoutUnit(u,bag){
  const stats=unit=>({damage:unitDamage(unit),interval:unitRate(unit),range:unitRange(unit)});
  const projected={};
  for(const gear of new Set([null,...bag])){
    projected[gear||'empty']=stats({...u,gear});
  }
  return {id:u.uid,key:u.type,star:u.star,gear:u.gear,current:stats(u),projected};
}

function recomputeField(field) {
  const counts = {};
  for (const u of field.units) {
    const fac = UNITS[u.type].faction;
    counts[fac] = (counts[fac] || 0) + 1;
  }
  const syn = { dmgMul: 1, rateMul: 1, splashMul: 1, slowMul: 1, rangeAdd: 0, bonusGold: 0 };
  const labels = [];
  if(G.expansion){
    field.traits=traitCounts(field.units.map(u=>u.type));
    for(const [k,n] of Object.entries(field.traits))if(n>=2)labels.push(TRAITS[k].name+' '+n+' · '+TRAITS[k].desc);
  }
  for (const fac of G.expansion?[]:Object.keys(counts)) {
    const tier = synergyTier(counts[fac]);
    if (!tier) continue;
    const s = SYNERGY[fac][tier];
    labels.push(s.label);
    if (s.dmgMul) syn.dmgMul *= s.dmgMul;
    if (s.rateMul) syn.rateMul *= s.rateMul;
    if (s.splashMul) syn.splashMul *= s.splashMul;
    if (s.slowMul) syn.slowMul *= s.slowMul;
    if (s.rangeAdd) syn.rangeAdd += s.rangeAdd;
    if (s.bonusGold) syn.bonusGold += s.bonusGold;
    if (s.poisonAll) syn.poisonAll = s.poisonAll;
    if (s.slowForce) syn.slowForce = Math.max(syn.slowForce || 0, s.slowForce);
  }
  field.synergy = syn;
  field.synLabels = labels;
  // 성기사 오라
  for (const u of field.units) u.auraMul = 1;
  const pals = field.units.filter(u => UNITS[u.type].aura);
  for (const p of pals) {
    for (const u of field.units) {
      if (u === p) continue;
      const d = Math.hypot(u.x - p.x, u.y - p.y);
      if (d <= 74) u.auraMul = (u.auraMul || 1) + UNITS[p.type].aura;
    }
  }
}

/** 유닛 획득: 합성 → 빈칸 → 자동판매 */
function acquisitionPlan(p, type) {
  const field = p.field;
  for (let star = 1; star <= 2; star++) {
    const unit = field.units.find(u => u.owner === p.id && u.type === type && u.star === star);
    if (unit) return {kind:'merged', unit, star:star + 1};
  }
  const slots = playerSlots(p);
  const slot = field.mode === 'coop' ? slots.find(s => !s.unit)
    : (G.routes?[4,2,3,7,5,1,0,6]:SLOT_ORDER_SURV).map(i => slots[i]).find(s => s && !s.unit);
  if (slot) return {kind:'placed', slot};
  return {kind:'sold', refund:Math.floor(UNITS[type].cost * 0.5)};
}

function lotPreview(p, type) {
  if(LOTS[type].kind)return {kind:LOTS[type].kind,refund:0};
  const plan = acquisitionPlan(p, type);
  if(G.expansion){
    let synergy='';
    if(plan.kind==='placed'){
      const next=traitCounts([...p.field.units.map(u=>u.type),type]);
      synergy=ROSTER[type].filter(k=>traitLevel(next,k)>traitLevel(p.field.traits,k)).map(k=>TRAITS[k].name+' '+next[k]+' 활성').join(' · ');
    }
    return {kind:plan.kind,star:plan.star,refund:plan.refund||0,synergy};
  }
  const faction = UNITS[type].faction;
  const count = p.field.units.filter(u => UNITS[u.type].faction === faction).length;
  const next = count + (plan.kind === 'placed' ? 1 : 0);
  return {kind:plan.kind, star:plan.star, refund:plan.refund || 0,
    synergy:synergyTier(next) > synergyTier(count) ? SYNERGY[faction][synergyTier(next)].label : ''};
}

function acquireUnit(p, type) {
  if(GEAR[type]){p.bag.push(type);return {kind:'gear'};}
  if(RELICS[type]){p.relics.push(type);return {kind:'relic'};}
  const plan = acquisitionPlan(p, type);
  if (plan.kind === 'sold') {
    p.gold += plan.refund;
    return plan;
  }
  if (plan.kind === 'merged') {
    plan.unit.star = plan.star;
    plan.unit.spawnPop = 0.5;
  } else {
    plan.unit = createUnit(p, type, plan.slot);
  }
  recomputeField(p.field);
  return {kind:plan.kind, unit:plan.unit, star:plan.star};
}

/* ================= 경매 ================= */
function resolveBids(bids) {
  const max = Math.max.apply(null, bids);
  if (!isFinite(max) || max <= 0) return { type: 'pass' };
  const tied = [];
  bids.forEach((b, i) => { if (b === max) tied.push(i); });
  if (tied.length > 1) return { type: 'unsold', max, tied };
  return { type: 'sold', winner: tied[0], price: max };
}

function botBid(bot, p, a) {
  if (G.mode === 'survival' && !p.field.alive) return 0;
  const def = LOTS[a.key];
  const gold = p.gold;
  if (gold <= 0) return 0;
  const own = p.field.units.filter(u => u.owner === p.id);
  const sameFac = own.filter(u => UNITS[u.type].faction === def.faction).length;
  const need = own.length === 0 ? 6 : 0;
  let val = def.cost + sameFac * 2.5 + need + (G.wave - 1) * 0.45;
  if (def.rarity >= 3) val += 2;
  const lives = G.mode === 'coop' ? G.coreHp : p.field.lives;
  const maxLives = G.mode === 'coop' ? G.coreMax : ECON.lives;
  const pressure = 1 + Math.max(0, (maxLives * 0.55 - lives)) * 0.07;
  const reserve = bot.reserve + (G.wave <= 2 ? 3 : 0);
  const avail = Math.max(0, gold - reserve);

  let bid;
  if (bot.persona === '올인러') {
    const thrill = random();
    bid = Math.round(avail * (0.5 + 0.5 * thrill));
    if (def.rarity >= 3) bid = Math.round(bid * 1.1);
  } else if (bot.persona === '이자러') {
    if (def.cost >= 13 && random() < 0.72) bid = Math.round(Math.min(avail, val * 0.8));
    else if (random() < 0.3) bid = Math.round(Math.min(avail, 3 + G.wave));
    else bid = 0;
  } else {
    const est = Math.round(gold * 0.24 + val * 0.78);
    bid = Math.round(Math.min(avail, Math.max(est, val * 0.72)));
    if (random() < 0.55) bid += 1;
  }
  bid = Math.round(bid * pressure);
  bid = clamp(bid, 0, gold);
  if (bid < 3) bid = 0;
  return bid;
}

function buildQueue() {
  const w = WAVES[G.wave - 1];
  const q = [];
  for (const [type, n] of w.comp) {
    const cnt = waveCount(type,n,G.mode,G.expansion,G.fourGates);
    for (let i = 0; i < cnt; i++) q.push(type);
  }
  // 보스는 마지막에
  q.sort((a, b) => (ENEMIES[a].boss ? 1 : 0) - (ENEMIES[b].boss ? 1 : 0));
  return q;
}

function spawnEnemy(field, type, parent, gate) {
  const def = ENEMIES[type];
  const hpMul = (1 + 0.30 * Math.min(9,G.wave-1) + 0.13 * Math.max(0,G.wave-10)) * (G.mode === 'coop' ? COOP.hp : 1);
  const hpFactor = campaignLength(G) > CLASSIC_WAVES ? CAMPAIGN_ENEMY_HP : 1;
  const hp = Math.max(1, Math.round(def.hp * hpMul * hpFactor * (gate!=null ? GATE_BOSS_HP_SHARE : 1)));
  const e = {
    netId: (G.enemyId = (G.enemyId || 0) + 1), type, hp, maxHp: hp, armor: def.armor, leak: def.leak,
    speed: def.speed * (1 + 0.015 * (G.wave - 1)) * rand(0.94, 1.06),
    x: 0, y: 0, t: 0, wob: rand(0, 6.28), lane: pick(LANES),
    slowT: 0, slowAmt: 0, poisonT: 0, poisonDps: 0, flash: 0, dead: false,
    boss: !!def.boss, pattern: def.boss ? BOSS_PATTERNS[G.wave]?.id : null,
  };
  if(G.routes){
    const coop=G.mode==='coop';
    if(gate!=null)e.gateBoss=true;
    e.route=gate ?? parent?.route ?? (coop?(field.entryCount++ + G.wave)%4:forkFor(G.wave,type));
    const path=(coop?GATE_PATHS:FORK_PATHS)[e.route];
    e.nextPoint=parent?.nextPoint ?? 1;
    [e.x,e.y]=parent?[parent.x,parent.y]:path[0];
  } else if (G.mode === 'coop') {
    const edge = Math.floor(random() * 4);
    const off = rand(-12, 12);
    if (edge === 0) { e.x = 2; e.y = CORE.y + off; }
    else if (edge === 1) { e.x = CW - 2; e.y = CORE.y + off; }
    else if (edge === 2) { e.y = 2; e.x = CORE.x + off; }
    else { e.y = CH - 2; e.x = CORE.x + off; }
  } else {
    e.x = -14;
    e.y = e.lane;
  }
  field.enemies.push(e);
  return e;
}

/* ================= 전투 업데이트 ================= */
function updateField(f, dt) {
  if (!f.active) return;
  f.coreFlash = Math.max(0, (f.coreFlash || 0) - dt);
  // 스폰
  if (f.queue.length) {
    f.spawnT -= dt;
    let guard = 0;
    while (f.spawnT <= 0 && f.queue.length && guard++ < 6) {
      if(G.fourGates && G.mode==='coop' && ENEMIES[f.queue[0]].boss){
        const type=f.queue[0];
        for(let gate=0;gate<4 && f.queue[0]===type;gate++){
          f.queue.shift();spawnEnemy(f,type,null,gate);
        }
      }else spawnEnemy(f,f.queue.shift());
      f.spawnT += f.spawnGap;
    }
  }
  // 유닛
  for (const u of f.units) {
    u.cd -= dt;
    if (u.flash > 0) u.flash -= dt;
    if (u.recoil > 0) u.recoil = Math.max(0, u.recoil - dt * 5);
    if (u.spawnPop > 0) u.spawnPop = Math.max(0, u.spawnPop - dt * 2);
    if (u.cd > 0) continue;
    const target = findTarget(f, u);
    if (!target) continue;
    u.cd = unitRate(u);
    u.recoil = 1;
    fire(f, u, target);
  }
  // 발사체
  for (let i = f.shots.length - 1; i >= 0; i--) {
    const s = f.shots[i];
    s.life -= dt;
    const tx = s.tx, ty = s.ty;
    const dx = tx - s.x, dy = ty - s.y;
    const d = Math.hypot(dx, dy);
    const step = s.speed * dt;
    if (d <= step || s.life <= 0) {
      s.x = tx; s.y = ty;
      impact(f, s);
      f.shots.splice(i, 1);
    } else {
      s.x += dx / d * step; s.y += dy / d * step;
      s.ang = Math.atan2(dy, dx);
    }
  }
  // 적 이동/상태
  for (let i = f.enemies.length - 1; i >= 0; i--) {
    const e = f.enemies[i];
    if (!e) continue;
    if (e.dead) { f.enemies.splice(i, 1); continue; }
    if (e.flash > 0) e.flash -= dt;
    // 슬로우
    if(e.markTime>0)e.markTime-=dt;
    let sp = 1;
    if (e.slowT > 0) { e.slowT -= dt; sp = 1 - e.slowAmt; }
    // 독
    if (e.poisonT > 0) {
      e.poisonT -= dt;
      damageEnemy(f, e, e.poisonDps * dt, { ignoreArmor: true, silent: true, credit: e.poisonOwner != null ? e.poisonOwner : 0 });
      if (e.dead) { f.enemies.splice(i,1); continue; }
    }
    if (e.enraged) sp *= BOSS_PATTERNS[20].speed;
    if (e.pattern === 'charge' && chargeStage(e.t) === 'dash') sp *= BOSS_PATTERNS[10].speed;
    // 이동
    if(G.routes){
      const coop=G.mode==='coop', path=(coop?GATE_PATHS:FORK_PATHS)[e.route];
      e.t+=dt;
      if(walkRoute(e,path,e.speed*sp*dt)){
        if(coop)coreLeak(f,e);else leak(f,e);
        f.enemies.splice(i,1);
      }
    }else if (G.mode === 'coop') {
      const dx = CORE.x - e.x, dy = CORE.y - e.y;
      const d = Math.hypot(dx, dy) || 1;
      e.x += dx / d * e.speed * sp * dt;
      e.y += dy / d * e.speed * sp * dt;
      e.t += dt;
      if (d < CORE.r + 4) { coreLeak(f, e); f.enemies.splice(i, 1); }
    } else {
      e.x += e.speed * sp * dt;
      e.t += dt;
      e.y = e.lane + Math.sin(e.t * 1.6 + e.wob) * 2.5;
      if (e.x >= BASE_X - 4) { leak(f, e); f.enemies.splice(i, 1); }
    }
  }
  // 이펙트
  for (let i = f.fx.length - 1; i >= 0; i--) {
    const x = f.fx[i];
    x.life -= dt;
    if (x.life <= 0) f.fx.splice(i, 1);
    else if (x.vx) { x.x += x.vx * dt; x.y += x.vy * dt; }
  }
  for (let i = f.nums.length - 1; i >= 0; i--) {
    const n = f.nums[i];
    n.life -= dt; n.y -= 22 * dt;
    if (n.life <= 0) f.nums.splice(i, 1);
  }
  for (let i = f.parts.length - 1; i >= 0; i--) {
    const p = f.parts[i];
    p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 120 * dt;
    if (p.life <= 0) f.parts.splice(i, 1);
  }
  // 클리어 판정
  if ((!f.queue.length && !f.enemies.length) || (G.mode==='coop' && G.coreHp<=0)) {
    clearCombatEffects(f);
    f.cleared = true;
    f.active = false;
  }
}

// The simulation stops ticking a finished field, even while other lanes keep fighting.
function clearCombatEffects(field) {
  field.shots.length = field.fx.length = field.nums.length = field.parts.length = 0;
  field.coreFlash = 0;
  for (const unit of field.units) {
    unit.recoil = unit.flash = unit.spawnPop = 0;
  }
}

function findTarget(f, u) {
  const r = unitRange(u, f);
  let best = null, bd = Infinity;
  for (const e of f.enemies) {
    if (e.dead) continue;
    const d = Math.hypot(e.x - u.x, e.y - u.y);
    if (d <= r && d < bd) { bd = d; best = e; }
  }
  return best;
}

function fire(f, u, target) {
  const def = UNITS[u.type];
  const tier=hasTrait(u,'caster');
  u.attackCount=(u.attackCount||0)+1;
  const directBonus=tier && u.attackCount%3===0 ? (tier===2?1.45:1.2) : 1;
  const dmg = unitDamage(u);
  const syn = G.players[u.owner].field.synergy;
  if (def.proj === 'melee' || def.proj === 'chain') {
    if (def.proj === 'chain') {
      // 연쇄 번개
      let cur = target, d = dmg, hitList = [cur];
      const used = new Set([cur]);
      for (let c = 1; c < (def.chain || 1); c++) {
        let next = null, nd = 90;
        for (const e of f.enemies) {
          if (used.has(e) || e.dead) continue;
          const dd = Math.hypot(e.x - cur.x, e.y - cur.y);
          if (dd < nd) { nd = dd; next = e; }
        }
        if (!next) break;
        hitList.push(next); used.add(next); cur = next;
      }
      let px = u.x, py = u.y - 14;
      let dd = dmg;
      hitList.forEach((e, i) => {
        f.fx.push({ type: 'bolt', x1: px, y1: py, x2: e.x, y2: e.y - 8, life: 0.18, maxLife: 0.18, color: '#ffe066' });
        directHit(f,e,dd*directBonus,u);
        applyOnHit(f, e, def, syn, u);
        px = e.x; py = e.y - 8;
        dd *= 0.62;
      });
      SFX.hit();
    } else {
      // 근접
      f.fx.push({ type: 'slash', x: target.x, y: target.y, life: 0.16, maxLife: 0.16, color: '#fff2b0' });
      directHit(f,target,dmg*directBonus,u);
      applyOnHit(f, target, def, syn, u);
      SFX.hit();
    }
    return;
  }
  const sx = u.x, sy = u.y - 12;
  const dx = target.x - sx, dy = (target.y - 8) - sy;
  const L = Math.hypot(dx, dy) || 1;
  f.shots.push({
    x: sx, y: sy, tx: target.x, ty: target.y - 8, target,
    vx: dx / L, vy: dy / L, speed: def.projSpeed, life: 2.2,
    dmg, directBonus, def, owner: u.owner, unit: u, ang: Math.atan2(dy, dx),
    color: projColor(def.proj), syn,
  });
}

function projColor(k) {
  return { arrow: '#f7f1c8', ball: '#5a5566', fire: '#ff9a3c', ice: '#9fe8ff', blob: '#9bff6a', lava: '#ff6a2c', bolt: '#ffe066' }[k] || '#fff';
}

function impact(f, s) {
  const def = s.def;
  const e = s.target;
  // 대상이 이미 죽었으면 그 자리에서만 터진다
  if (e && !e.dead) {
    directHit(f,e,s.dmg*(s.directBonus||1),s.unit);
    applyOnHit(f, e, def, s.syn, s.unit);
  }
  const splashR = (def.splash || 0) * (s.syn.splashMul || 1) * (def.splash ? 1 : 0);
  if (def.splash) {
    const radius = def.splash * (s.syn.splashMul || 1);
    for (const o of f.enemies) {
      if (o === e || o.dead) continue;
      const d = Math.hypot(o.x - s.x, o.y - s.y);
      if (d <= radius) {
        damageEnemy(f, o, s.dmg * 0.55, { credit: s.owner, unit: s.unit });
        if (def.slow) applySlow(f, o, def.slow, s.syn);
        if (def.poison) applyPoison(o, def.poison, s.owner);
      }
    }
    f.fx.push({ type: 'boom', x: s.x, y: s.y, r: radius, life: 0.22, maxLife: 0.22, color: projColor(def.proj) });
  }
  f.fx.push({ type: 'spark', x: s.x, y: s.y, life: 0.14, maxLife: 0.14, color: projColor(def.proj) });
  for (let i = 0; i < 3; i++) {
    f.parts.push({ x: s.x, y: s.y, vx: rand(-40, 40), vy: rand(-70, -10), life: 0.35, maxLife: 0.35, color: projColor(def.proj) });
  }
  SFX.hit();
}

function applyOnHit(f, e, def, syn, unit) {
  if (def.slow) applySlow(f, e, def.slow, syn);
  if (def.poison) applyPoison(e, def.poison, unit ? unit.owner : 0);
  if (syn.poisonAll) applyPoison(e, syn.poisonAll, unit ? unit.owner : 0);
}

function applySlow(f, e, slow, syn) {
  const amt = Math.max(e.slowAmt || 0, (syn.slowForce || slow.amt));
  const dur = slow.dur * (syn.slowMul || 1);
  if (dur > (e.slowT || 0)) e.slowT = dur;
  e.slowAmt = amt;
}

function applyPoison(e, poison, owner) {
  e.poisonT = Math.max(e.poisonT || 0, poison.dur);
  e.poisonDps = Math.max(e.poisonDps || 0, poison.dps);
  e.poisonOwner = owner;
}

function directHit(f,e,raw,u) {
  const elemental=hasTrait(u,'elemental');
  if(elemental){
    if(e.markTime>0)raw*=elemental===2?1.18:1.08;
    e.markTime=2;
  }
  damageEnemy(f,e,raw,{credit:u.owner,unit:u,pierce:hasTrait(u,'workshop')+modifier(u,'pierce')});
}
function damageEnemy(f, e, raw, opt) {
  if (e.dead) return;
  let dmg = raw;
  if (!opt.ignoreArmor) dmg = Math.max(raw * 0.4, raw - Math.max(0,e.armor-(opt.pierce||0)));
  if (bossStance(e)==='shield') dmg *= 1-BOSS_PATTERNS[15].reduction;
  e.hp -= dmg;
  if(e.pattern==='eclipse' && !e.enraged && e.hp>0 && e.hp<=e.maxHp/2){
    e.enraged=true;
    for(let i=0;i<(e.gateBoss?Number(e.route<BOSS_PATTERNS[20].summons):BOSS_PATTERNS[20].summons);i++){
      const ghost=spawnEnemy(f,'ghost',e);
      if(!G.routes){ghost.x=e.x;ghost.y=ghost.lane=e.y+(i===0?-8:8);}
    }
  }
  e.flash = 0.09;
  const owner = (opt.credit != null) ? opt.credit : 0;
  creditDamage(owner, dmg);
  if (!opt.silent && dmg >= 1) {
    f.nums.push({ x: e.x + rand(-4, 4), y: e.y - 12, text: Math.round(dmg), life: 0.6, color: opt.crit ? '#ffe066' : '#fff' });
  }
  if (e.hp <= 0) { e.lastOwner = owner; killEnemy(f, e); }
}

function creditDamage(owner, dmg) {
  const p = G.players[owner];
  if (!p) return;
  p.stats.damage += dmg;
  if (p.field) p.field.damage += dmg;
}

function recordBoss(f,e,killed){
  if(e.gateBoss){
    if(f.lastBoss?.wave!==G.wave)f.lastBoss={wave:G.wave,total:4,kills:0,escapes:0};
    const result=f.lastBoss;
    if(killed)result.kills++;else result.escapes++;
    result.killed=result.kills>0;result.reward=result.killed;
    if(killed && result.kills===1)rewardBoss(f);
  }else{
    f.lastBoss={wave:G.wave,killed,reward:killed && !!G.expansion};
    if(killed && G.expansion)rewardBoss(f);
  }
}
function killEnemy(f, e) {
  if (e.dead) return;
  e.dead = true;
  if(e.boss)recordBoss(f,e,true);
  if (e.pattern === 'split') {
    const rule = BOSS_PATTERNS[5];
    for (let i=0; i<(e.gateBoss?Number(e.route<rule.count):rule.count); i++) {
      const child = spawnEnemy(f,'slime',e);
      const spread = (i-1)*7;
      child.small=true;
      if(!G.routes){child.x=e.x;child.y=child.lane=e.y+spread;}
      child.hp=child.maxHp=Math.max(1,Math.round(child.maxHp*rule.childHP));
    }
  }
  const owner = (e.lastOwner != null) ? e.lastOwner : (e.poisonOwner != null ? e.poisonOwner : 0);
  creditKill(owner);
  f.fx.push({ type: 'puff', x: e.x, y: e.y, r: e.boss ? 46 : 20, life: 0.35, maxLife: 0.35, color: '#fff' });
  for (let i = 0; i < (e.boss ? 22 : 6); i++) {
    f.parts.push({ x: e.x, y: e.y, vx: rand(-70, 70), vy: rand(-110, -20), life: 0.6, maxLife: 0.6, color: e.boss ? '#ffd166' : '#b6f57e' });
  }
  if (e.boss) { G.shake = Math.max(G.shake, 6); SFX.leak(); }
}
let lastHitOwner = 0;

function creditKill(owner) {
  const p = G.players[owner];
  if (!p) return;
  p.stats.kills++;
  if (p.field) p.field.kills++;
}

function leak(f, e) {
  if (!f.alive) return;
  e.dead = true;
  if(e.boss)recordBoss(f,e,false);
  const blocked=Math.min(f.shield||0,e.leak);
  f.shield=(f.shield||0)-blocked;
  f.lives -= e.leak-blocked;
  f.coreFlash = 0.45;
  if (G.mode === 'survival' && f.owner === 0) {
    G.shake = Math.max(G.shake, 5);
    SFX.leak();
    addToast(`라이프 −${e.leak-blocked}!`, 'bad');
  }
  if (f.lives <= 0) {
    f.lives = 0;
    f.alive = false;
    G.players[f.owner].diedWave = G.wave;
    f.cleared = true;
    f.active = false;
    f.enemies.length = 0;
    f.queue.length = 0;
    f.units.length = 0;
    f.slots.forEach(s => s.unit = null);
    addToast(`${G.players[f.owner].name} 라인 붕괴!`, 'bad');
    if (G.mode === 'survival') onLoss(f.owner);
  }
}

function coreLeak(f, e) {
  if(e.dead || G.coreHp<=0)return;
  e.dead = true;
  if(e.boss)recordBoss(f,e,false);
  const raw = e.gateBoss ? 1 : Math.round(e.leak * COOP.leakMul);
  const blocked=Math.min(f.shield||0,raw);f.shield=(f.shield||0)-blocked;
  const dmg=Math.min(G.coreHp,raw-blocked);
  G.coreHp-=dmg;
  const wave=f.gateHistory?.at(-1);
  const gate=wave?.wave===G.wave && wave.gates[e.route];
  if(gate){
    gate.damage+=dmg;
    gate.blocked+=blocked;
    const type=e.small?'smallSlime':e.type;
    gate.enemies[type]=(gate.enemies[type]||0)+1;
  }
  f.coreFlash = 0.5;
  G.shake = Math.max(G.shake, 5);
  SFX.leak();
  addToast(`코어 피해 −${dmg}`, 'bad');
  if (G.coreHp <= 0) onLoss();
}

function botUpgrade(p) {
  const ups = p.field.units.filter(u => u.owner === p.id && u.star < 3).sort((a, b) => a.star - b.star);
  if (!ups.length) return;
  for (const u of ups) {
    const cost = upgradeCost(u);
    if (p.gold >= cost + 5 && random() < 0.85) {
      p.gold -= cost;
      u.star++;
      u.spawnPop = 0.5;
      recomputeField(p.field);
      return;
    }
  }
}

function setupFields(mode) {
  if (mode === 'survival') {
    G.players.forEach(p => {
      p.field = makeField(p.id, 'survival');
      p.slots = p.field.slots;
    });
    // 기본 궁수 1기 지급
    for(const p of G.players){
      const starter=G.routes?6:[5,4,5,4][p.id];
      createUnit(p,'archer',p.field.slots[starter]);
    }
    G.players.forEach(p => recomputeField(p.field));
  } else {
    const arena = makeField(0, 'coop');
    arena.slots = [];
    G.players.forEach((p, i) => {
      const slots = makeSlots(G.routes?GATE_POSTS[i].map(([x,y])=>({x,y})):SLOTS_COOP[i], i);
      slots.forEach((s, k) => { s.idx = arena.slots.length; arena.slots.push(s); });
      p.field = arena;
      p.slots = slots;
    });
    G.arena = arena;
    G.coreMax = COOP.coreHp;
    G.coreHp = COOP.coreHp;
    // 기본 궁수 1기씩
    G.players.forEach(p => {
      createUnit(p, 'archer', p.slots[G.routes?5:1]);
      recomputeField(arena);
    });
  }
}
function prepareBattle() {
  for(const f of new Set(G.players.map(p=>p.field))){
    f.entryCount=0;
    f.shield=traitLevel(f.traits,'guard');
    for(const u of f.units)u.attackCount=0;
  }
  const isCoop = G.mode === 'coop';
  if (isCoop) {
    const f = G.arena;
    if(G.routes){
      f.gateHistory??=[];
      if(f.gateHistory.at(-1)?.wave!==G.wave){
        f.gateHistory.push({wave:G.wave,gates:GATE_PATHS.map(()=>({damage:0,blocked:0,enemies:{}}))});
      }
    }
    f.enemies.length = 0; clearCombatEffects(f);
    f.queue = buildQueue();
    f.spawnT = 0.4; f.spawnGap = 0.6; f.active = true; f.cleared = false;
  } else {
    for (const p of G.players) {
      const f = p.field;
      if (!f.alive) { f.cleared = true; f.active = false; continue; }
      f.enemies.length = 0; clearCombatEffects(f);
      f.queue = buildQueue();
      f.spawnT = 0.4 + random() * 0.3;
      f.spawnGap = 0.85;
      f.active = true; f.cleared = false;
      for (const u of f.units) u.cd = rand(0.1, 0.6);
    }
  }
}
return { loadoutUnit, checkpointRecovery, makeDeck, equip, botEquip, income, chooseAugment, pendingChoices, clamp, rand, pick, shuffle, makeSlots, makeField, makePlayer, playerSlots, createUnit, removeUnit, sellValue, upgradeCost, unitRange, unitDamage, unitRate, recomputeField, lotPreview, acquireUnit, resolveBids, botBid, buildQueue, spawnEnemy, updateField, findTarget, fire, projColor, impact, applyOnHit, applySlow, applyPoison, damageEnemy, creditDamage, killEnemy, creditKill, leak, coreLeak, botUpgrade, setupFields, prepareBattle };
}
