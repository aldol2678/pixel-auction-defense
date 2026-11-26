'use strict';
/* =========================================================
   DATA — 유닛 / 진영 / 시너지 / 적 / 웨이브 / 봇 성향
   ========================================================= */

// Names also reach older room clients. Keep their plain-text and markup displays compatible.
function playerNickname(value) {
  if (typeof value !== 'string') return '';
  const clean = value.normalize('NFC').replace(/[<>&"'\x00-\x1f\x7f\u202a-\u202e\u2066-\u2069]/gu, '').trim();
  return Array.from(clean).slice(0, 12).join('').trim();
}

const FACTIONS = {
  nature: { key: 'nature', name: '자연', color: '#7ef0c9' },
  fire:   { key: 'fire',   name: '불꽃', color: '#ff9a6c' },
  frost:  { key: 'frost',  name: '서리', color: '#8bd3ff' },
  tech:   { key: 'tech',   name: '기계', color: '#c9d3e0' },
  holy:   { key: 'holy',   name: '성광', color: '#ffd166' },
};

/* rarity: 1 일반 / 2 희귀 / 3 전설
   dmg: 1성 기준 1회 피해, rate: 공격 간격(초), range: 사거리(필드 px)
   cost: 경매 기준 가치(골드), splash: 범위 피해 반경, slow: {amt, dur},
   poison: {dps, dur}, chain: 연쇄 수, aura: 인접 유닛 공격력 보너스 */
const UNITS = {
  archer: {
    key: 'archer', name: '도트 궁수', rarity: 1, faction: 'nature', cost: 8,
    dmg: 7, rate: 0.55, range: 116, projSpeed: 360, proj: 'arrow',
    desc: '빠른 단일 사격. 값이 싸서 초반 주력.',
    tip: '사거리가 길어 라인 어디에 놔도 좋다',
  },
  cannoneer: {
    key: 'cannoneer', name: '대포병', rarity: 1, faction: 'tech', cost: 9,
    dmg: 18, rate: 1.4, range: 128, projSpeed: 250, proj: 'ball', splash: 34,
    desc: '느리지만 묵직한 범위 포격.',
    tip: '몰려오는 슬라임에 강하다',
  },
  toad: {
    key: 'toad', name: '독 두꺼비', rarity: 1, faction: 'nature', cost: 8,
    dmg: 4, rate: 0.9, range: 96, projSpeed: 240, proj: 'blob', poison: { dps: 6, dur: 3 },
    desc: '독을 묻혀 3초간 지속 피해.',
    tip: '방어력이 높은 적에게도 독은 통한다',
  },
  firemage: {
    key: 'firemage', name: '화염 법사', rarity: 2, faction: 'fire', cost: 13,
    dmg: 12, rate: 1.0, range: 110, projSpeed: 280, proj: 'fire', splash: 38,
    desc: '불덩이를 던져 주변까지 태운다.',
    tip: '스플래시의 정석',
  },
  frostmage: {
    key: 'frostmage', name: '빙결 술사', rarity: 2, faction: 'frost', cost: 13,
    dmg: 8, rate: 0.9, range: 106, projSpeed: 300, proj: 'ice', slow: { amt: 0.45, dur: 1.8 }, splash: 26,
    desc: '얼려서 발을 묶는다. 느려진 적은 오래 맞는다.',
    tip: '보스전에서 빛난다',
  },
  paladin: {
    key: 'paladin', name: '성기사', rarity: 2, faction: 'holy', cost: 14,
    dmg: 14, rate: 0.8, range: 72, projSpeed: 0, proj: 'melee', aura: 0.12,
    desc: '짧은 사거리 대신 인접 유닛 공격력 +12%.',
    tip: '유닛 사이에 두면 시너지가 커진다',
  },
  drone: {
    key: 'drone', name: '톱니 드론', rarity: 2, faction: 'tech', cost: 14,
    dmg: 4, rate: 0.22, range: 100, projSpeed: 420, proj: 'bolt',
    desc: '0.22초 연사. 단일 화력이 무섭다.',
    tip: '방어력에 약하니 독·화염과 함께',
  },
  thunder: {
    key: 'thunder', name: '번개 기사', rarity: 3, faction: 'holy', cost: 20,
    dmg: 16, rate: 1.15, range: 122, projSpeed: 0, proj: 'chain', chain: 3,
    desc: '번개가 3명을 연쇄로 때린다.',
    tip: '적이 붙어 있을 때 최고 효율',
  },
  lavagolem: {
    key: 'lavagolem', name: '용암 골렘', rarity: 3, faction: 'fire', cost: 21,
    dmg: 24, rate: 1.6, range: 88, projSpeed: 260, proj: 'lava', splash: 46, poison: { dps: 4, dur: 2 },
    desc: '넓은 범위 폭발 + 화상.',
    tip: '한 방이 크다. 보스에 유효',
  },
  frostgolem: {
    key: 'frostgolem', name: '서리 골렘', rarity: 3, faction: 'frost', cost: 21,
    dmg: 20, rate: 1.5, range: 86, projSpeed: 280, proj: 'ice', splash: 42, slow: { amt: 0.6, dur: 2.2 },
    desc: '광역 빙결. 느려진 적을 녹인다.',
    tip: '사거리가 짧아 길가에 붙여야 한다',
  },
};

const CLASSIC_UNITS=Object.keys(UNITS);
Object.assign(UNITS, {
  scout:{key:'scout',name:'황야 석궁수',rarity:2,faction:'nature',cost:13,dmg:16,rate:1.05,range:148,projSpeed:440,proj:'arrow',desc:'먼 길목까지 닿는 장거리 단일 사격.'},
  alchemist:{key:'alchemist',name:'연금 포격수',rarity:2,faction:'tech',cost:15,dmg:9,rate:1.1,range:112,projSpeed:260,proj:'blob',splash:26,poison:{dps:4,dur:2},desc:'독탄이 터지며 주변 적에게 독을 남긴다.'},
  warden:{key:'warden',name:'수정 파수꾼',rarity:2,faction:'frost',cost:14,dmg:12,rate:.84,range:82,projSpeed:0,proj:'melee',slow:{amt:.35,dur:2.4},desc:'길목에 접근한 적을 수정창으로 둔화시킨다.'},
  beacon:{key:'beacon',name:'등불 사제',rarity:2,faction:'holy',cost:14,dmg:11,rate:.9,range:115,projSpeed:310,proj:'fire',aura:.08,desc:'등불로 공격하며 주변 아군 공격력을 8% 높인다.'},
  coil:{key:'coil',name:'전류 수호기',rarity:3,faction:'tech',cost:20,dmg:19,rate:1.3,range:96,projSpeed:0,proj:'chain',chain:4,desc:'코일에서 튄 전류가 최대 네 적을 잇는다.'}
});
const TRAITS = {
  frontier:{category:'종족',effects:['개척단을 보유한 플레이어는 생존 정산 때 1G 추가','개척단을 보유한 플레이어는 생존 정산 때 2G 추가'],name:'개척단',max:3,desc:'생존 정산 +1/2G'}, elemental:{category:'종족',effects:['원소 유닛이 표식이 있는 적에게 주는 직접 피해 +8%','원소 유닛이 표식이 있는 적에게 주는 직접 피해 +18%'],name:'원소',max:4,desc:'표식 대상 직접 피해 +8/18%'},
  workshop:{category:'종족',effects:['공방 유닛의 직접 공격이 방어력 1 무시','공방 유닛의 직접 공격이 방어력 2 무시'],name:'공방',max:3,desc:'직접 공격 방어력 1/2 무시'}, shooter:{category:'직업',effects:['사수의 공격 간격 8% 감소','사수의 공격 간격 15% 감소 · 사거리 +12'],name:'사수',max:3,desc:'공격 간격 −8/15%, 3종 사거리 +12'},
  caster:{category:'직업',effects:['술사의 세 번째 공격마다 직접 피해 +20%','술사의 세 번째 공격마다 직접 피해 +45%'],name:'술사',max:4,desc:'매 3번째 공격 직접 피해 +20/45%'}, guard:{category:'직업',effects:['웨이브마다 돌파 피해 1 흡수','웨이브마다 돌파 피해 2 흡수'],name:'수호자',max:3,desc:'웨이브당 누수 피해 1/2 흡수'}
};
const ROSTER = {
  archer:['frontier','shooter'],cannoneer:['frontier','shooter'],paladin:['frontier','guard'],
  firemage:['elemental','caster'],frostmage:['elemental','caster'],lavagolem:['elemental','guard'],frostgolem:['elemental','guard'],
  drone:['workshop','shooter'],toad:['workshop','caster'],thunder:['workshop','caster'],
  scout:['elemental','shooter'],alchemist:['workshop','shooter'],warden:['elemental','guard'],beacon:['frontier','caster'],coil:['workshop','guard']
};
const GEAR = {
  blade:{name:'톱날 칼날',cost:10,desc:'장착 유닛 공격력 +35%',damage:.35},
  scope:{name:'별빛 조준경',cost:9,desc:'장착 유닛 사거리 +28',range:28},
  spring:{name:'태엽 가속기',cost:12,desc:'장착 유닛 공격 간격 −25%',speed:.25},
  lens:{name:'사냥꾼 렌즈',cost:13,desc:'장착 유닛 공격력 +15%, 사거리 +16',damage:.15,range:16}
};
const RELICS = {
  banner:{name:'개척자의 깃발',cost:16,desc:'내 모든 유닛 공격력 +16%',damage:.16},
  compass:{name:'은하 나침반',cost:15,desc:'내 모든 유닛 사거리 +14',range:14},
  clock:{name:'청동 모래시계',cost:17,desc:'내 모든 유닛 공격 간격 −12%',speed:.12}
};
const AUGMENTS = {
  breaker:{name:'파쇄탄',desc:'내 유닛의 직접 공격이 방어력 2 무시',pierce:2},
  force:{name:'집중 화력',desc:'내 유닛 공격력 +28%',damage:.28},
  reach:{name:'원거리 교범',desc:'내 유닛 사거리 +24',range:24},
  haste:{name:'속사 훈련',desc:'내 유닛 공격 간격 −20%',speed:.20},
  precision:{name:'정밀 조준',desc:'내 유닛 공격력 +14%, 사거리 +12',damage:.14,range:12},
  pursuit:{name:'추격 본능',desc:'내 유닛 공격 간격 −12%, 사거리 +10',speed:.12,range:10}
};
const LOTS = {...UNITS};
for(const [kind, catalog] of [['gear',GEAR],['relic',RELICS]]) {
  for(const [key,def] of Object.entries(catalog)) LOTS[key]={...def,key,kind,rarity:kind==='gear'?2:3};
}
function lotLabel(key) {return GEAR[key]?'장비':RELICS[key]?'유물':'유닛';}
function traitCounts(types) {
  const counts={};
  for(const key of new Set(types)) for(const trait of ROSTER[key]) counts[trait]=(counts[trait]||0)+1;
  return counts;
}
function traitLevel(counts, key) {
  const n=counts?.[key]||0;
  return n>=TRAITS[key].max?2:n>=2?1:0;
}
function traitsText(counts) {
  return Object.entries(counts||{}).map(([k,n])=>TRAITS[k].name+' '+n+'/'+(n<2?2:TRAITS[k].max)).join(' · ');
}

const UNIT_KEYS = Object.keys(UNITS);

/* 같은 진영 2 / 4명일 때 */
const SYNERGY = {
  nature: {
    2: { label: '자연 2 — 공격력 +12%', dmgMul: 1.12 },
    4: { label: '자연 4 — 공격력 +28% · 공격속도 +10%', dmgMul: 1.28, rateMul: 0.90 },
  },
  fire: {
    2: { label: '불꽃 2 — 범위 피해 +25%', splashMul: 1.25 },
    4: { label: '불꽃 4 — 범위 피해 +50% · 화상', splashMul: 1.50, poisonAll: { dps: 3, dur: 2 } },
  },
  frost: {
    2: { label: '서리 2 — 슬로우 지속 +40%', slowMul: 1.4 },
    4: { label: '서리 4 — 슬로우 65% · 지속 +60%', slowMul: 1.6, slowForce: 0.65 },
  },
  tech: {
    2: { label: '기계 2 — 공격속도 +12%', rateMul: 0.88 },
    4: { label: '기계 4 — 공격속도 +25% · 사거리 +15', rateMul: 0.75, rangeAdd: 15 },
  },
  holy: {
    2: { label: '성광 2 — 공격력 +10% · 클리어 +2G', dmgMul: 1.10, bonusGold: 2 },
    4: { label: '성광 4 — 공격력 +20% · 클리어 +4G', dmgMul: 1.20, bonusGold: 4 },
  },
};

/* 성급 배율 */
const STAR = {
  1: { dmg: 1.0, rate: 1.0, label: '★' },
  2: { dmg: 1.75, rate: 1.06, label: '★★' },
  3: { dmg: 2.9, rate: 1.12, label: '★★★' },
};
const UPGRADE_COST = { 1: 12, 2: 22 };

const ENEMIES = {
  slime: { key: 'slime', name: '슬라임', hp: 24, speed: 24, armor: 0, leak: 1, size: 2.0, gold: 0 },
  bat: { key: 'bat', name: '박쥐', hp: 15, speed: 46, armor: 0, leak: 1, size: 1.8, gold: 0 },
  armored: { key: 'armored', name: '갑옷 병사', hp: 52, speed: 19, armor: 2, leak: 1, size: 2.0, gold: 0 },
  ghost: { key: 'ghost', name: '유령', hp: 34, speed: 30, armor: 1, leak: 1, size: 2.0, gold: 0 },
  kingslime: { key: 'kingslime', name: '왕슬라임', hp: 300, speed: 15, armor: 3, leak: 3, size: 3.1, gold: 0, boss: true },
};

/* 웨이브 구성 (서바이벌 = 필드 1개 기준, 협력 = ×COOP_MULT) */
const WAVES = [
  { n: 1, comp: [['slime', 4]] },
  { n: 2, comp: [['slime', 5], ['bat', 2]] },
  { n: 3, comp: [['bat', 5], ['slime', 3]] },
  { n: 4, comp: [['armored', 3], ['slime', 4]] },
  { n: 5, comp: [['kingslime', 1], ['slime', 4]], boss: true },
  { n: 6, comp: [['ghost', 4], ['bat', 4]] },
  { n: 7, comp: [['armored', 4], ['ghost', 3]] },
  { n: 8, comp: [['bat', 7], ['armored', 4], ['ghost', 2]] },
  { n: 9, comp: [['ghost', 5], ['armored', 4], ['slime', 4]] },
  { n: 10, comp: [['kingslime', 1], ['armored', 5], ['bat', 5]], boss: true },
  { n: 11, comp: [['ghost', 4], ['slime', 5]] },
  { n: 12, comp: [['armored', 3], ['bat', 6]] },
  { n: 13, comp: [['slime', 7], ['ghost', 5]] },
  { n: 14, comp: [['bat', 5], ['armored', 4], ['ghost', 3]] },
  { n: 15, comp: [['armored', 4], ['ghost', 4], ['kingslime', 1]], boss: true },
  { n: 16, comp: [['ghost', 4], ['bat', 5], ['slime', 4]] },
  { n: 17, comp: [['armored', 5], ['slime', 5], ['bat', 3]] },
  { n: 18, comp: [['bat', 6], ['ghost', 6], ['armored', 2]] },
  { n: 19, comp: [['armored', 5], ['ghost', 5], ['bat', 5]] },
  { n: 20, comp: [['ghost', 4], ['armored', 5], ['bat', 4], ['kingslime', 1]], boss: true },
];
const MAX_WAVES = WAVES.length;
const CLASSIC_WAVES = 10;
const CAMPAIGN_ENEMY_HP = 0.85;

// Older rooms finish the campaign they started, including after a Worker update.
function campaignLength(game) { return game.maxWaves ?? CLASSIC_WAVES; }
function waveCount(type, count, mode, expansion, fourGates=false) {
  if(fourGates && mode==="coop" && ENEMIES[type].boss)return 4;
  return expansion && ENEMIES[type].boss ? count : Math.max(1, Math.round(count * (mode === 'coop' ? COOP.count : 1)));
}


const CORE = { x: 240, y: 180, r: 26 };
const COOP = { count: 1.8, hp: 1.5, coreHp: 60, leakMul: 1.5 };

const BOTS = [
  { id: 1, name: '뿌슝', persona: '올인러', color: '#ff8fa3', aggression: 1.0, reserve: 0, desc: '한 방에 전 재산을 건다' },
  { id: 2, name: '짠짠', persona: '이자러', color: '#7ef0c9', aggression: 0.32, reserve: 20, desc: '이자 5G가 세상에서 제일 좋다' },
  { id: 3, name: '저격', persona: '스나이퍼', color: '#8bd3ff', aggression: 0.72, reserve: 9, desc: '한 끗 차이로 낚아챈다' },
];

const ECON = {
  startGold: 30,
  waveGold: 10,
  interestRate: 0.1,
  interestMax: 5,
  lives: 14,
};

// 경매 타이머
const AUCTION_PREP_SECONDS = 5;
const GATE_BOSS_HP_SHARE = 0.225; // Four bosses share 90% of the former single boss HP.
const AUCTION_SECONDS = 10;
const FIRST_BOT_AUCTION_SECONDS = 15;

function equipmentPhase(phase) {
  return ['auction','reveal','battle','waveend'].includes(phase);
}

function bossReport(outcome) {
  if (!outcome) return '';
  const name = BOSS_PATTERNS[outcome.wave]?.name || '보스';
  if(outcome.total===4)return 'W'+outcome.wave+' '+name+' · 처치 '+outcome.kills+'/4 · 돌파 '+outcome.escapes+'/4'+(outcome.kills?' · 증강 1회':outcome.escapes===4?' · 증강 없음':'');
  const result = outcome.killed ? (outcome.reward ? '처치 · 증강 보상' : '처치') : '통과 · 증강 없음';
  return 'W' + outcome.wave + ' ' + name + ' ' + result;
}

const BOSS_PATTERNS = {
  5: {id:'split', name:'분열왕', guide:'처치한 위치에 작은 슬라임 3마리 출현', count:3, childHP:0.5},
  10: {id:'charge', name:'돌격왕', guide:'번쩍인 뒤 1초간 질주 · 둔화 가능', cycle:5, warning:0.8, burst:1, speed:2.2},
  15: {id:'aegis', name:'수정왕', guide:'푸른 방벽이 켜진 2초 동안 받는 피해 35% 감소', cycle:5, duration:2, reduction:.35},
  20: {id:'eclipse', name:'황혼 군주', guide:'체력 절반에서 유령 둘 소환 후 가속', speed:1.35, summons:2}
};

function bossStance(enemy) {
  if(enemy.pattern==='aegis' && enemy.t % BOSS_PATTERNS[15].cycle < BOSS_PATTERNS[15].duration)return 'shield';
  if(enemy.pattern==='eclipse' && enemy.enraged)return 'enraged';
  return '';
}

function chargeStage(age) {
  const rule = BOSS_PATTERNS[10], t = age % rule.cycle;
  if (t >= rule.cycle - rule.burst) return 'dash';
  return t >= rule.cycle - rule.burst - rule.warning ? 'warn' : '';
}

function auctionForecast(wave, nextKey) {
  const next = nextKey ? '다음 경매 · ' + lotLabel(nextKey)+' · '+LOTS[nextKey].name : '마지막 경매';
  const bossWave = BOSS_PATTERNS[wave] ? wave : wave + 1;
  const boss = BOSS_PATTERNS[bossWave];
  return boss ? next + ' ｜ W' + bossWave + ' ' + boss.name + ' · ' + boss.guide : next;
}

function bidComparison(bids, result) {
  if (result.type !== 'sold') return '';
  const second = Math.max(...bids.filter((_,i) => i !== result.winner));
  return second ? '2위 ' + second + 'G · ' + (result.price-second) + 'G 차이' : '단독 입찰';
}

function synergyTier(count) { return count >= 4 ? 4 : count >= 2 ? 2 : 0; }

function lotAdvice(plan) {
  if (plan?.synergy) return '낙찰 시 ' + plan.synergy;
  if (plan?.kind === 'merged') return '낙찰 시 ' + plan.star + '성 합성';
  if (plan?.kind === 'sold') return '빈칸 없음 · 낙찰 시 자동 판매 +' + plan.refund + 'G';
  return '';
}

function bidPreviewText(type, gold, amount, plan) {
  if (!amount) return '패스 시 잔액 ' + gold + 'G';
  if (!plan) return '';
  const name = LOTS[type].name;
  let outcome = name + ' 배치';
  if (plan.kind === 'merged') outcome = name + ' ' + plan.star + '성 합성';
  if (plan.kind === 'sold') outcome = '빈칸 없음 · 자동판매 +' + plan.refund + 'G';
  if (plan.kind === 'gear') outcome = name + ' · 장비 보관';
  if (plan.kind === 'relic') outcome = name + ' · 유물 즉시 적용';
  const balance = gold - amount + plan.refund;
  return '낙찰 시 ' + outcome + ' · 잔액 ' + balance + 'G';
}

// Board geometry is shared by the renderer, route forecast and authoritative simulation.
const FORK_PATHS = [62,158].map(y => [[-14,110],[83,110],[130,y],[218,y],[265,110],[418,110]]);
const FORK_POSTS = [[55,76],[61,146],[171,35],[171,185],[213,110],[272,162],[326,76],[367,147]];
function gateLayout(points,owner) {
  const turns=[2,0,3,1][owner];
  return points.map(([x,y])=>{
    for(let i=0;i<turns;i++)[x,y]=[-y,x];
    return [240+x,180+y];
  });
}
const GATE_PATHS = [0,1,2,3].map(i=>gateLayout([[0,-164],[0,-118],[50,-84],[50,-58],[0,-30]],i));
const GATE_POSTS = [0,1,2,3].map(i=>gateLayout([[-26,-144],[26,-136],[17,-83],[72,-93],[76,-52],[10,-57]],i));
const GATE_NAMES=['남문','북문','서문','동문'];
function finishedGateWaves(game){
  if(game.mode!=='coop')return [];
  const settled=game.phase==='waveend'||game.phase==='result';
  return (game.arena?.gateHistory||[]).filter(row=>row.wave<game.wave || settled);
}
function forkFor(wave,type) {
  const index=WAVES[wave-1].comp.findIndex(([key])=>key===type);
  return (wave+Math.max(0,index))%2;
}
function routeForecast(wave,mode,fourGates=false) {
  if(fourGates && mode==='coop' && BOSS_PATTERNS[wave])return BOSS_PATTERNS[wave].name+' · 네 관문에 1마리씩 동시 출현 · 첫 처치 시 팀 증강';
  if(mode==='coop')return '네 관문 → 중앙 코어';
  const groups=[[],[]];
  for(const [key] of WAVES[wave-1].comp)groups[forkFor(wave,key)].push(ENEMIES[key].boss?BOSS_PATTERNS[wave].name:ENEMIES[key].name);
  return groups.map((names,i)=>names.length?(i?'아랫길 ':'윗길 ')+names.join('·'):'').filter(Boolean).join(' / ');
}
function walkRoute(e,points,remaining) {
  while(e.nextPoint<points.length){
    const [x,y]=points[e.nextPoint], dx=x-e.x,dy=y-e.y,dist=Math.hypot(dx,dy);
    if(remaining<dist){
      e.x+=remaining*dx/dist;e.y+=remaining*dy/dist;
      return false;
    }
    remaining-=dist;e.x=x;e.y=y;e.nextPoint++;
  }
  return true;
}
