'use strict';
/* =========================================================
   픽셀 경매 디펜스 — 게임 엔진 (바닐라 JS / Canvas2D)
   ========================================================= */
const $ = (id) => document.getElementById(id);
const getNickname=nicknameField('nickname');
const canvas = $('cv');
const ctx = canvas.getContext('2d');
const VW = 780;
let VH = 520;
const DPR = Math.min(2, window.devicePixelRatio || 1);
canvas.width = Math.round(VW * DPR);
canvas.height = Math.round(VH * DPR);

/* ================= 상태 ================= */
const G = {
  mode: null, phase: 'title', wave: 0, time: 0, speed: 1, paused: false,
  players: [], deck: [], auction: null, sel: null, arena: null,
  banner: null, shake: 0, timer: null, result: null, muted: false, history: [],
  revealLayer: null, rounds: 0, coreHp: 0, coreMax: 0,
};

/* ================= 유틸 ================= */
const { loadoutUnit, checkpointRecovery, makeDeck, equip, botEquip, chooseAugment, pendingChoices, income, clamp, rand, shuffle, makePlayer, playerSlots, removeUnit, sellValue, upgradeCost, unitRange, unitRate, recomputeField, lotPreview, acquireUnit, resolveBids, botBid, updateField, projColor, leak, botUpgrade, setupFields, prepareBattle } = createCombat(G, {random: Math.random, SFX, addToast, onLoss(owner) {
  if (owner == null || owner === 0) schedule(0.5, () => endGame("dead"));
}});
/* ================= 배경 캐시 ================= */
const BG = {};
function buildBackgrounds() {
  const mk = (w, h, fn) => {
    const c = document.createElement('canvas');
    c.width = w * 2; c.height = h * 2;
    const g = c.getContext('2d');
    g.scale(2, 2); g.imageSmoothingEnabled = false;
    fn(g, w, h);
    return c;
  };
  BG.surv = mk(FW, FH, (g, w, h) => ART.tradeRoad(g,w,h,false));
  BG.coop = mk(CW, CH, (g, w, h) => ART.tradeRoad(g,w,h,true));
}

/* ================= 플레이어 / 필드 ================= */
function startAuction() {
  G.wave++;
  G.phase = 'auction';
  G.sel = null;
  if (!G.deck.length) G.deck = makeDeck();
  const key = G.deck.pop();
  const duration = G.wave === 1 ? FIRST_BOT_AUCTION_SECONDS : AUCTION_SECONDS;
  G.auction = {
    key, duration, prep:AUCTION_PREP_SECONDS, t: duration, bid: 0, committed: false,
    bids: [0, 0, 0, 0], revealT: 0, resolved: false, outcome: null, cards: [],
  };
  $('revealLayer').classList.add('hidden');
  showPanel('auction');
  fillAuctionCard(key);
  updateBidUI();
  setBanner(`WAVE ${G.wave}`, LOTS[key].name + ' 경매!');
  SFX.spawn();
}

function fillAuctionCard(key) {
  $('forecast').textContent=routeForecast(G.wave,G.mode,G.fourGates)+' ｜ '+auctionForecast(G.wave,G.deck.at(-1));
  showLotCard(key);
}

function updateBidUI() {
  const a = G.auction; if (!a) return;
  const p = G.players[0];
  a.bid = clamp(a.bid, 0, p.gold);
  $('bidNum').textContent = a.bid;
  $('bidOwn').textContent = p.gold;
  const plan = lotPreview(p, a.key);
  const advice = lotAdvice(plan);
  if ($('lotAdvice').textContent !== advice) $('lotAdvice').textContent = advice;
  const summary = bidPreviewText(a.key, p.gold, a.bid, plan);
  if ($('bidPreview').textContent !== summary) $('bidPreview').textContent = summary;
  const prep=a.prep>0;
  for(const btn of document.querySelectorAll('#auctionPanel .bid-btns button,#auctionPanel .action-row button'))btn.disabled=prep;
  $('aucHint').textContent=prep?'경매 준비 · 매물 확인':'비공개 동시 입찰 중';
  $('timerNum').closest('.auc-timer').classList.toggle('urgent', !prep && a.t <= 3);
  $('timerNum').textContent = Math.max(0, Math.ceil(prep?a.prep:a.t));
  $('timerFill').style.width = Math.max(0, (prep?a.prep/AUCTION_PREP_SECONDS:a.t/a.duration) * 100) + '%';
  $('btnPass').classList.toggle('primary', a.bid === 0);
}

function adjustBid(delta) {
  const a = G.auction; if (!a || a.prep>0 || G.phase !== 'auction') return;
  const p = G.players[0];
  const before = a.bid;
  a.bid = clamp(a.bid + delta, 0, p.gold);
  if (a.bid !== before) SFX.bid(a.bid);
  updateBidUI();
}

function confirmBid(auto) {
  const a = G.auction;
  if (!a || a.prep>0 || a.committed) return;
  const p = G.players[0];
  a.bid = clamp(a.bid, 0, p.gold);
  a.committed = true;
  a.bids = [a.bid];
  for (let i = 1; i < 4; i++) a.bids[i] = botBid(BOTS[i - 1], G.players[i], a);
  SFX.confirm();
  buildRevealCards();
  G.phase = 'reveal';
  a.revealT = 0;
  showPanel('none');
  setIdle('입찰 공개 중…');
  $('revealLayer').classList.remove('hidden');
  $('revealOutcome').innerHTML = '';
  $('revealOutcome').className = 'reveal-outcome';
  document.querySelector('.reveal-title').textContent = auto ? '시간 종료! 입찰 공개' : '입찰 공개';
}

function buildRevealCards() {
  const a = G.auction, wrap = $('bidCards');
  wrap.innerHTML = '';
  a.cards = [];
  G.players.forEach((p, i) => {
    const el = document.createElement('div');
    el.className = 'bid-card' + (i === 0 ? ' me' : '');
    el.innerHTML = `<div class="bc-name"><span><i class="bc-dot" style="background:${p.color}"></i>${p.name}${p.persona ? ' · ' + p.persona : ' · 나'}</span></div><div class="bc-amt">?</div>`;
    wrap.appendChild(el);
    a.cards.push(el);
  });
  // 내 카드가 항상 먼저 보이도록 정렬은 유지(플레이어 순서)
}

function logAuction(res) {
  const a = G.auction;
  const name = LOTS[a.key].name;
  const win = res.type === 'sold' ? G.players[res.winner].name : null;
  G.history.unshift({ wave: G.wave, name, type: res.type, winner: win, comparison:bidComparison(a.bids,res), price: res.price || res.max || 0 });
  if (G.history.length > MAX_WAVES) G.history.pop();
  renderHistory();
}

function renderHistory() {
  const html = G.history.length
    ? G.history.map(h => {
        if (h.type === 'sold') return `<div class="h-row"><span class="hw">W${h.wave}</span><span class="hu">${h.name}</span><span class="hp">${h.winner} ${h.price}G · ${h.comparison}</span></div>`;
        if (h.type === 'unsold') return `<div class="h-row unsold"><span class="hw">W${h.wave}</span><span class="hu">${h.name}</span><span class="hp">유찰 ${h.price}G 동점</span></div>`;
        return `<div class="h-row pass"><span class="hw">W${h.wave}</span><span class="hu">${h.name}</span><span class="hp">모두 패스</span></div>`;
      }).join('')
    : '<div class="h-empty">아직 경매 기록이 없다</div>';
  ['histAuction', 'histBattle'].forEach(id => { const el = $(id); if (el) el.innerHTML = html; });
}

function updateReveal(dt) {
  const a = G.auction;
  a.revealT += dt;
  const t = a.revealT;
  for (let i = 0; i < 4; i++) {
    const at = 0.25 + i * 0.26;
    const card = a.cards[i];
    if (!card) continue;
    if (t >= at && !card.classList.contains('open')) {
      card.classList.add('open');
      const eliminated = G.mode === 'survival' && !G.players[i].field.alive;
      card.querySelector('.bc-amt').textContent = eliminated ? '탈락' : a.bids[i] + 'G';
      SFX.flip(i);
    }
  }
  if (t >= 1.5 && !a.resolved) {
    a.resolved = true;
    const res = resolveBids(a.bids);
    a.outcome = res;
    const out = $('revealOutcome');
    if (res.type === 'sold') {
      if (a.cards[res.winner]) a.cards[res.winner].classList.add('win');
      const w = G.players[res.winner];
      w.gold -= res.price;
      const got = acquireUnit(w, a.key);
      if(!w.isHuman)botEquip(w);
      out.className = 'reveal-outcome sold pop';
      out.innerHTML = `<div class="big">낙찰! ${w.name} → ${LOTS[a.key].name}</div><div class="small">${res.price}G 지불 · ${bidComparison(a.bids,res)} · ${got.kind === 'gear' ? '장비 보관 · 장비 창에서 장착' : got.kind === 'relic' ? '유물 효과 발동' : got.kind === 'merged' ? '같은 유닛 합성 ★' + got.star : got.kind === 'sold' ? '슬롯이 꽉 차 자동 판매 +' + got.refund + 'G' : '내 필드에 배치'}</div>`;
      SFX.sold();
      if (res.winner === 0) addToast(`${LOTS[a.key].name} 낙찰! ${res.price}G`, 'good');
    } else if (res.type === 'unsold') {
      res.tied.forEach(i => { if (a.cards[i]) a.cards[i].classList.add('tie'); });
      out.className = 'reveal-outcome unsold pop';
      out.innerHTML = `<div class="big">유찰!</div><div class="small">최고가 ${res.max}G 동점 — 아무도 못 가져간다</div>`;
      SFX.unsold();
      addToast('동점 유찰! 골드는 그대로', 'bad');
    } else {
      out.className = 'reveal-outcome unsold pop';
      out.innerHTML = `<div class="big">모두 패스</div><div class="small">아무도 입찰하지 않았다</div>`;
      SFX.unsold();
    }
    logAuction(res);
    updateBattlePanelStatic();
  }
  if (t >= 4.3) startBattle();
}

/* ================= 전투 준비 ================= */
function startBattle() {
  G.phase = 'battle';
  $('revealLayer').classList.add('hidden');
  G.auction = null;
  showPanel('battle');

  prepareBattle();
  setBanner(`WAVE ${G.wave}`, G.mode === 'coop' ? '중앙 코어를 지켜라!' : '내 라인을 지켜라!');
  SFX.clear();
}

/* ================= 웨이브 종료 / 경제 ================= */
function endWave() {
  if (G.phase !== 'battle') return;
  G.phase = 'waveend';
  showPanel('none');
  setIdle('웨이브 클리어! 다음 경매 준비 중…');

  const recovery=checkpointRecovery();
  const msgs = recovery?[recovery]:[];
  for (const p of G.players) {
    if (G.mode === 'survival' && !p.field.alive) continue;
    const before = p.gold;
    p.gold += ECON.waveGold;
    let interest = Math.min(ECON.interestMax, Math.floor(p.gold * ECON.interestRate));
    p.gold += interest;
    const bonus = income(p);
    p.gold += bonus;
    if (p.isHuman) msgs.push(`+${ECON.waveGold}G` + (interest ? ` 이자 +${interest}G` : '') + (bonus ? ` 개척단 +${bonus}G` : ''));
    // 봇 강화 AI
    if (!p.isHuman) botUpgrade(p);
  }
  if (msgs.length) addToast(msgs[0], 'gold');
  SFX.clear();
  setBanner('클리어!', G.mode === 'coop' ? `코어 ${G.coreHp}/${G.coreMax}` : `라이프 ${G.players[0].field.lives}`);
  updateBattlePanelStatic();

  schedule(1.5, () => {
    if (G.wave >= MAX_WAVES) endGame('win');
    else startAuction();
  });
}

/* ================= 게임 진행 ================= */
function newGame(mode) {
  SFX.init();
  G.maxWaves=MAX_WAVES;
  G.expansion=true;G.routes=true;G.fourGates=true;G.fourGates=true;
  G.mode = mode;
  G.wave = 0;
  G.phase = 'auction';
  G.paused = false;
  G.speed = 1;
  G.result = null;
  G.shake = 0;
  G.coreHp = 0; G.coreMax = 0;
  G.timer = null;
  G.deck = makeDeck();
  G.sel = null;
  G.history = [];
  renderHistory();
  $('btnSpeed').textContent = '×1';
  $('modeLabel').textContent = mode === 'survival' ? '서바이벌 · 4인 라인전' : '협력 · 코어 방어';
  $('titleLayer').classList.add('hidden');
  fitCanvas();
  $('resultLayer').classList.add('hidden');
  $('menuLayer').close();
  $('revealLayer').classList.add('hidden');

  const human = makePlayer(0, getNickname() || '플레이어', '#7ef0c9', null);
  G.players = [human];
  BOTS.forEach((b, i) => {
    const p = makePlayer(i + 1, b.name, PLAYER_COLORS[i + 1], b.persona);
    p.ai = b;
    G.players.push(p);
  });

  setupFields(mode);
  G.coreMax = G.coreMax || 0;
  updateHUD(true);
  startAuction();
}

function endGame(reason) {
  if (G.phase === 'result') return;
  G.phase = 'result';
  G.sel = null;
  showPanel('none');
  setIdle('게임 끝 — 결과를 확인하자');
  const rows = G.players.map(p => {
    const alive = G.mode === 'survival' ? p.field.alive : true;
    const lives = G.mode === 'survival' ? p.field.lives : G.coreHp;
    return { p, alive, lives, kills: p.stats.kills, dmg: Math.round(p.stats.damage) };
  });
  let sorted;
  if (G.mode === 'coop') sorted = rows.slice().sort((a, b) => b.dmg - a.dmg);
  else sorted = rows.slice().sort((a, b) => (b.alive - a.alive) || (b.lives - a.lives) || (b.kills - a.kills));

  const myRank = sorted.findIndex(r => r.p.isHuman) + 1;
  const win = reason === 'win';
  const lastWave = G.wave >= MAX_WAVES;
  $('resultKicker').textContent = win ? 'ALL WAVES CLEAR' : (lastWave ? 'LAST STAND' : 'LINE BREAK');
  $('resultTitle').textContent = win ? (myRank === 1 ? '완벽한 승리!' : '살아남았다!')
    : (lastWave ? '마지막 웨이브에서…' : '탈락…');
  $('resultTitle').style.color = win ? '#7ef0c9' : (lastWave ? '#ffd166' : '#ff8fa3');
  $('resultSub').innerHTML = G.mode === 'coop'
    ? `웨이브 ${G.wave}/${MAX_WAVES} · 코어 ${G.coreHp}/${G.coreMax}<br>기여도 ${myRank}위`
    : `${G.wave}/${MAX_WAVES} 웨이브 · 최종 ${myRank}위 · 내 유닛 ${G.players[0].stats.kills}킬`;

  const report = bossReport(G.players[0].field.lastBoss);
  $('finalBoss').textContent = report;
  $('finalBoss').hidden = !report;
  const table = $('rankTable');
  table.innerHTML = sorted.map((r, i) => {
    const val = G.mode === 'coop'
      ? `딜 ${r.dmg.toLocaleString()} · 킬 ${r.kills}`
      : `${r.alive ? '라이프 ' + r.lives : 'W' + (r.p.diedWave || G.wave) + ' 탈락'} · 킬 ${r.kills}`;
    return `<tr class="${r.p.isHuman ? 'me' : ''}"><td>${i + 1}</td><td><i style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${r.p.color};margin-right:5px"></i>${r.p.name}${r.p.persona ? ' · ' + r.p.persona : ''}</td><td class="r">${val}</td></tr>`;
  }).join('');

  $('resultLayer').classList.remove('hidden');
  SFX.clear();
  if (!win) SFX.unsold();
  G.result = { reason, rank: myRank };
}

/* ================= 타이머 ================= */
function schedule(t, fn) { G.timer = { t, fn }; }

/* ================= UI 동기화 ================= */
function setIdle(text) {
  const el = document.querySelector('#idlePanel .idle-text');
  if (el) el.textContent = text;
}

function showPanel(which) {
  $('auctionPanel').classList.toggle('hidden', which !== 'auction');
  $('battlePanel').classList.toggle('hidden', which !== 'battle');
  $('idlePanel').classList.toggle('hidden', which !== 'none');
}

function updateHUD(force) {
  const p = G.players[0];
  if (!p) return;
  $('waveNum').textContent = Math.max(1, G.wave);
  $('goldNum').textContent = Math.round(p.gold);
  $('myKills').textContent = p.stats.kills;
  if (G.mode === 'coop') $('lifeNum').textContent = G.coreHp;
  else $('lifeNum').textContent = p.field ? p.field.lives : 0;
}

let uiClock = 0;
function syncUI(dt) {
  uiClock += dt;
  if (uiClock < 0.1) return;
  uiClock = 0;
  placement.sync();
  const me=G.players[0];
  drawLoadout(me,me?playerSlots(me).filter(s=>s.unit).map(s=>loadoutUnit(s.unit,me.bag||[])):[],me?.field?.traits,G.phase,me?.field?.lastBoss,G.sel?.owner===0?G.sel.uid:null,G.auction?.key);
  renderGateReport(G.phase==='title'?[]:finishedGateWaves(G));
  if (!G.players.length) return;
  updateHUD();
  if (G.phase === 'auction' && G.auction) updateBidUI();
  if (G.phase === 'battle') updateBattlePanel();
  if (G.phase === 'auction') drawUnitPreview(G.auction.key,G.time);
  renderRivals();
}

function updateBattlePanel() {
  const p = G.players[0];
  const comp = (WAVES[G.wave - 1] || { comp: [] }).comp;
  const compSig = G.mode+G.wave+comp.map(c => c[0] + c[1]).join(',');
  const wc = $('waveComp');
  if (wc && wc.dataset.sig !== compSig) {
    wc.dataset.sig = compSig;
    wc.innerHTML = comp.map(([k, n]) => {
      const cnt = waveCount(k,n,G.mode,G.expansion,G.fourGates);
      const boss = ENEMIES[k].boss ? ' boss' : '';
      return `<span class="wc-chip${boss}">${ENEMIES[k].boss ? BOSS_PATTERNS[G.wave].name : ENEMIES[k].name} ×${cnt}</span>`;
    }).join('');
  }
  const f = p.field;
  $('enemyLeft').textContent = f.queue.length + f.enemies.length;
  renderSynergies(f.traits, f.synLabels);
  // 유닛 칩
  const row = $('unitRow');
  const units = f.units.filter(u => u.owner === 0);
  const sig = units.map(u => u.uid + ':' + u.type + u.star + (G.sel && G.sel.uid === u.uid ? 'S' : '')).join(',');
  if (row.dataset.sig !== sig) {
    row.dataset.sig = sig;
    row.innerHTML = units.length ? units.map(u => {
      const sel = (G.sel && G.sel.uid === u.uid) ? ' sel' : '';
      return `<div class="unit-chip${sel}" data-uid="${u.uid}"><span>${UNITS[u.type].name}</span><span class="st">${STAR[u.star].label}</span></div>`;
    }).join('') : '<span style="font-size:10px;color:#6f5f8f">유닛이 없다 — 경매에서 낙찰받자</span>';
  }
  // 선택 액션
  const selU = G.sel && units.find(u => u.uid === G.sel.uid);
  const box = $('selActions');
  if (selU) {
    box.classList.remove('hidden');
    $('selName').textContent = `${UNITS[selU.type].name} ${STAR[selU.star].label}${selU.star < 3 ? ' · 강화 ' + upgradeCost(selU) + 'G' : ' · 최대'}`;
    $('btnUpgrade').textContent = selU.star < 3 ? '강화 ' + upgradeCost(selU) + 'G' : '최대 ★';
    $('btnUpgrade').disabled = selU.star >= 3 || p.gold < upgradeCost(selU);
    $('btnUpgrade').style.opacity = $('btnUpgrade').disabled ? .45 : 1;
    $('btnSell').textContent = '판매 +' + sellValue(selU) + 'G';
  } else box.classList.add('hidden');

  if (G.mode === 'coop') {
    const board = $('coopBoard');
    board.classList.remove('hidden');
    const total = Math.max(1, G.players.reduce((a, q) => a + q.stats.damage, 0));
    const sorted = G.players.slice().sort((a, b) => b.stats.damage - a.stats.damage);
    board.innerHTML = sorted.map(q => {
      const pct = Math.round((q.stats.damage / total) * 100);
      const lead = q === sorted[0] ? ' lead' : '';
      return `<div class="coop-row${lead}"><span class="cr-name" style="color:${q.color}">${q.isHuman ? '나 · ' : ''}${q.name}</span><span class="cr-val">${pct}%</span><span>킬 ${q.stats.kills}</span></div>`;
    }).join('');
  } else {
    $('coopBoard').classList.add('hidden');
  }
}

function renderRivals() {
  const els = [$('rivalList'), $('rivalList2')].filter(Boolean);
  if (!els.length || G.players.length < 2) return;
  const rows = G.players.slice(1).map(p => {
    const dead = G.mode === 'survival' && !p.field.alive;
    const units = p.field.units.filter(u => u.owner === p.id).length;
    const life = G.mode === 'coop' ? '' : `<span class="rl"><img src="icons/heart.svg" width="10" height="10" alt="라이프"> ${p.field.lives}</span>`;
    return `<div class="rival-row${dead ? ' dead' : ''}"><span class="rival-dot" style="background:${p.color}"></span><span class="rn">${p.name} · ${p.persona}</span>${life}<span>유닛 ${units}</span><span class="rg">${Math.round(p.gold)}G</span></div>`;
  }).join('');
  els.forEach(el => { if (el.dataset.sig !== rows) { el.dataset.sig = rows; el.innerHTML = rows; } });
}

function updateBattlePanelStatic() { /* 다음 프레임 syncUI가 갱신한다 */ }

/* ================= 토스트 / 배너 ================= */
function addToast(text, cls) {
  const layer = $('toastLayer');
  const el = document.createElement('div');
  el.className = 'toast ' + (cls || '');
  el.textContent = text;
  layer.appendChild(el);
  while (layer.children.length > 3) layer.removeChild(layer.firstChild);
  setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 2200);
}

function setBanner(main, sub) {
  G.banner = { main, sub, life: 1.7, maxLife: 1.7 };
}

/* ================= 입력 ================= */
function canvasPos(ev) {
  const r = canvas.getBoundingClientRect();
  const cx = (ev.touches ? ev.touches[0].clientX : ev.clientX);
  const cy = (ev.touches ? ev.touches[0].clientY : ev.clientY);
  return { x: (cx - r.left) / r.width * VW, y: (cy - r.top) / r.height * VH };
}

function hitSlot(pos) {
  if (G.phase !== 'battle' && G.phase !== 'auction' && G.phase !== 'waveend') return null;
  const p = G.players[0];
  if (!p) return null;
  let view;
  if (G.mode === 'coop') {
    view = { s: coopScale(), x: coopOffset().x, y: coopOffset().y };
    const lx = (pos.x - view.x) / view.s, ly = (pos.y - view.y) / view.s;
    return ART.pickBoardSlot(p.field.slots, lx, ly, 3, 10);
  }
  view = survView();
  for (let i = 1; !rivalsOut() && i < G.players.length; i++) {
    const left = view.miniX + (i - 1) * (view.miniW + view.gap) + 3;
    const x = (pos.x - left) / view.miniS, y = (pos.y - view.miniY - 3) / view.miniS;
    if (x >= 0 && x <= FW && y >= 0 && y <= FH)
      return ART.pickBoardSlot(G.players[i].field.slots, x, y, 3 * 0.92, 10);
  }
  const lx = (pos.x - view.mainX) / view.mainS;
  const ly = (pos.y - view.mainY) / view.mainS;
  return ART.pickBoardSlot(p.field.slots, lx, ly, 3, 10);
}

const drawLoadout=loadoutUI((uid,key)=>equipmentPhase(G.phase) && equip(G.players[0],uid,key),key=>{
  if(G.phase==='augment' && chooseAugment(G.players[0],key))G.phase='battle';
},uid=>{G.sel=uid===null?null:{uid,owner:0};},(x,y)=>{
  const slot=hitSlot(canvasPos({clientX:x,clientY:y}));
  return slot?.owner===0?slot.unit?.uid:null;
},()=>G.players[0].field.units.map(u=>({
  id:u.uid,key:u.type,star:u.star,owner:u.owner,mine:u.owner===0,interval:unitRate(u),range:unitRange(u)
})));
function awaitReward(){
  if(!pendingChoices(p=>!p.isHuman))return false;
  G.phase='augment';return true;
}
const placement = placementPreview(() => {
  if (!G.sel || !['auction','battle','waveend'].includes(G.phase)) return null;
  const p = G.players[0];
  const own = playerSlots(p);
  return own.some(s => s.unit?.uid === G.sel.uid) ? {id:G.sel.uid, slots:own} : null;
}, moveSelected);

function moveSelected(slot) {
  const p = G.players[0];
  const u = G.sel && p.field.units.find(u => u.uid === G.sel.uid && u.owner === p.id);
  if (!u || slot.owner !== p.id || slot.unit) return;
  u.slot.unit = null;
  u.slot = slot; slot.unit = u; u.x = slot.x; u.y = slot.y;
  recomputeField(p.field);
  SFX.bid(6);
  G.sel = null;
}

function onCanvasClick(ev) {
  if (G.phase === 'title' || G.phase === 'result') return;
  const slot = hitSlot(canvasPos(ev));
  if (slot?.unit) {
    G.sel = {uid:slot.unit.uid, owner:slot.owner};
    SFX.bid(2);
  } else if (G.sel && slot?.owner === 0) {
    if (!placement.choose(slot)) { moveSelected(slot); G.sel = null; }
  } else G.sel = null;
  placement.sync();
}

function tryUpgrade() {
  const p = G.players[0];
  const u = G.sel && p.field.units.find(x => x.uid === G.sel.uid && x.owner === 0);
  if (!u) return;
  const cost = upgradeCost(u);
  if (u.star >= 3 || p.gold < cost) { SFX.error(); addToast('골드가 부족하다', 'bad'); return; }
  p.gold -= cost;
  u.star++;
  u.spawnPop = 0.6;
  recomputeField(p.field);
  SFX.upgrade();
  addToast(`${UNITS[u.type].name} ${STAR[u.star].label} 강화!`, 'good');
}

function trySell() {
  const p = G.players[0];
  const u = G.sel && p.field.units.find(x => x.uid === G.sel.uid && x.owner === 0);
  if (!u) return;
  const v = sellValue(u);
  p.gold += v;
  removeUnit(p, u);
  G.sel = null;
  recomputeField(p.field);
  SFX.bid(3);
  addToast('판매 +' + v + 'G', 'gold');
}

function toggleSpeed() {
  G.speed = G.speed === 1 ? 2 : G.speed === 2 ? 3 : 1;
  $('btnSpeed').textContent = '×' + G.speed;
}

/* ================= 렌더 ================= */
function rivalsOut() {return G.mode==='survival' && G.players.length===4 && G.players.slice(1).every(p=>!p.field.alive);}
function survView() {
  const mainS = 1.6;
  return {
    miniS: (FW * 0.5 - 6) / FW, miniW: FW * 0.5, miniH: FH * 0.5 + 8, gap: 8,
    miniX: (VW - (FW * 0.5 * 3 + 16)) / 2, miniY: 8,
    mainS, mainX: (VW - FW * mainS) / 2, mainY: rivalsOut()?40:132,
  };
}
function coopScale() { return Math.min((VW - 40) / CW, (VH - 24) / CH); }
function coopOffset() {
  const s = coopScale();
  return { x: (VW - CW * s) / 2, y: (VH - CH * s) / 2 };
}

function render() {
  const height = rivalsOut()?408:520;
  if(VH!==height){VH=height;canvas.height=Math.round(VH*DPR);fitCanvas();}
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, VW, VH);
  // 배경
  const bg = ctx.createLinearGradient(0, 0, 0, VH);
  bg.addColorStop(0, '#1a1430');
  bg.addColorStop(1, '#120d22');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, VW, VH);

  if (!G.players.length) { drawTitleDecor(); return; }

  ctx.save();
  if (G.shake > 0) ctx.translate(rand(-G.shake, G.shake), rand(-G.shake, G.shake));

  if (G.mode === 'coop') renderCoop();
  else renderSurvival();

  ctx.restore();

  drawBanner();
  G.shake = Math.max(0, G.shake - 0.35);
}

function renderSurvival() {
  const v = survView();
  if(rivalsOut()){
    ctx.fillStyle='#d8c9ec';ctx.font='bold 19px system-ui';ctx.textAlign='left';ctx.fillText('라이벌 3명 탈락',16,26);
  }
  for (let i = 1; !rivalsOut() && i <= 3; i++) {
    const p = G.players[i];
    const x = v.miniX + (i - 1) * (v.miniW + v.gap);
    const y = v.miniY;
    drawPanelFrame(x, y, v.miniW, v.miniH, p.color, p.eliminated || !p.field.alive);
    ctx.save();
    ctx.beginPath(); ctx.rect(x + 3, y + 3, v.miniW - 6, v.miniH - 6); ctx.clip();
    renderField(p.field, v.miniS, x + 3, y + 3, { mini: true, owner: i });
    ctx.restore();
    drawMiniLabel(x, y, v.miniW, v.miniH, p);
  }
  // 내 필드
  drawPanelFrame(v.mainX - 3, v.mainY - 3, FW * v.mainS + 6, FH * v.mainS + 6, '#7ef0c9', false, true);
  ctx.save();
  ctx.beginPath(); ctx.rect(v.mainX, v.mainY, FW * v.mainS, FH * v.mainS); ctx.clip();
  renderField(G.players[0].field, v.mainS, v.mainX, v.mainY, { main: true, owner: 0 });
  ctx.restore();
  drawFieldBadge(v.mainX, v.mainY, '내 라인', G.players[0].field.lives, ECON.lives);
}

function renderCoop() {
  const s = coopScale(), o = coopOffset();
  drawPanelFrame(o.x - 3, o.y - 3, CW * s + 6, CH * s + 6, '#7ef0c9', false, true);
  ctx.save();
  ctx.beginPath(); ctx.rect(o.x, o.y, CW * s, CH * s); ctx.clip();
  renderField(G.arena, s, o.x, o.y, { coop: true });
  ctx.restore();
  drawCoreBadge(o);
}

function drawPanelFrame(x, y, w, h, color, dim, thick) {
  ctx.save();
  ctx.fillStyle = 'rgba(10,7,18,.55)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = dim ? '#3a3050' : color;
  ctx.lineWidth = thick ? 3 : 2;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  if (dim) {
    ctx.fillStyle = 'rgba(10,7,18,.5)';
    ctx.fillRect(x, y, w, h);
  }
  ctx.restore();
}

function drawMiniLabel(x, y, w, h, p) {
  ctx.save();
  ctx.font = 'bold 10px ui-monospace, monospace';
  ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  const name = p.name + (p.eliminated || !p.field.alive ? ' 탈락' : '');
  ctx.fillStyle = 'rgba(8,5,14,.62)';
  ctx.fillRect(x + 4, y + 4, ctx.measureText(name).width + 8, 14);
  ctx.fillStyle = p.color;
  ctx.fillText(name, x + 8, y + 6);
  // 하트(라이프)
  const lives = p.field.lives;
  const bw = 54, bh = 5;
  ctx.fillStyle = 'rgba(8,5,14,.62)';
  ctx.fillRect(x + w - bw - 6, y + 5, bw, bh + 8);
  ctx.fillStyle = '#40243a';
  ctx.fillRect(x + w - bw - 4, y + 7, bw - 4, bh);
  ctx.fillStyle = lives > ECON.lives * 0.35 ? '#ff8fa3' : '#ff5a7a';
  ctx.fillRect(x + w - bw - 4, y + 7, (bw - 4) * clamp(lives / ECON.lives, 0, 1), bh);
  ctx.fillStyle = '#ffd9e2';
  ctx.font = 'bold 9px ui-monospace, monospace';
  const heart = $('lifeIcon');
  if (heart.naturalWidth) ctx.drawImage(heart, x + w - bw - 2, y + 15, 10, 10);
  ctx.fillText(lives, x + w - bw + 10, y + 16);
  // 유닛 수
  const n = p.field.units.length;
  if (n) {
    ctx.fillStyle = 'rgba(8,5,14,.62)';
    ctx.fillRect(x + 4, y + h - 16, 40, 12);
    ctx.fillStyle = '#cbb8ef';
    ctx.fillText('유닛 ' + n, x + 7, y + h - 15);
  }
  // 상태
  if (p.field.active) {
    ctx.fillStyle = '#ffd166';
    ctx.font = 'bold 9px ui-monospace, monospace';
    ctx.fillText('W' + G.wave, x + w - 24, y + h - 15);
  }
  ctx.restore();
}

function drawFieldBadge(x, y, label, lives, maxLives) {
  ctx.save();
  ctx.font = 'bold 11px ui-monospace, monospace';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(8,5,14,.7)';
  const wTxt = ctx.measureText(label).width;
  ctx.fillRect(x + 6, y + 6, wTxt + 14 + 72, 18);
  ctx.fillStyle = '#7ef0c9';
  ctx.fillText(label, x + 13, y + 16);
  ctx.fillStyle = '#ff8fa3';
  const heart = $('lifeIcon');
  if (heart.naturalWidth) ctx.drawImage(heart, x + wTxt + 21, y + 10, 12, 12);
  ctx.fillText(lives + '/' + maxLives, x + wTxt + 36, y + 16);
  ctx.restore();
}

function drawCoreBadge(o) {
  const s = coopScale();
  ctx.save();
  const w = 168, h = 26;
  const x = 14, y = 12;
  ctx.fillStyle = 'rgba(8,5,14,.75)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#7ef0c9';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + .5, y + .5, w - 1, h - 1);
  ctx.fillStyle = '#ffd166';
  ctx.font = 'bold 11px ui-monospace, monospace';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('CORE ' + G.coreHp + ' / ' + G.coreMax, x + w / 2, y + h / 2 + 1);
  ctx.textAlign = 'left';
  // 체력 바
  ctx.fillStyle = '#40243a';
  ctx.fillRect(x + 8, y + h - 5, w - 16, 3);
  ctx.fillStyle = G.coreHp > G.coreMax * 0.3 ? '#7ef0c9' : '#ff6b6b';
  ctx.fillRect(x + 8, y + h - 5, (w - 16) * clamp(G.coreHp / G.coreMax, 0, 1), 3);
  ctx.restore();
}

function renderField(f, s, ox, oy, opts) {
  opts = opts || {};
  ctx.save();
  ctx.translate(ox, oy);
  ctx.scale(s, s);

  // 배경
  const bg = (G.mode === 'coop') ? BG.coop : BG.surv;
  if (bg) ctx.drawImage(bg, 0, 0, G.mode === 'coop' ? CW : FW, G.mode === 'coop' ? CH : FH);

  // 협력: 구역 표시
  if (G.mode === 'coop') drawCoopZones(f, opts);

  const selected = G.sel && f.units.find(u => u.uid === G.sel.uid);
  const gearRange=!opts.mini && drawLoadout.drawGearRange(ctx,f.slots);
  if (selected && !gearRange) {
    const range = unitRange(selected, f);
    ART.drawRange(ctx, selected.x, selected.y, range);
    placement.draw(ctx, f.slots, selected.uid, selected.type, range);
  }

  // 슬롯
  for (const slot of f.slots) {
    if (opts.mini) continue;
    drawSlot(slot, f);
  }

  // 기지/코어
  if (G.mode === 'coop') {
    ART.drawCore(ctx,G.coreHp,G.coreMax,G.time,f.coreFlash);
  } else ART.drawBase(ctx,f.lives,f.maxLives,G.time,f.coreFlash);

  // 유닛 (y 정렬)
  const units = f.units.slice().sort((a, b) => a.y - b.y);
  for (const u of units) drawUnit(u, opts);

  // 적
  for (const e of f.enemies) drawEnemy(f, e, opts);

  // 발사체
  for (const sh of f.shots) drawShot(sh, opts);

  // 이펙트
  for (const fx of f.fx) drawFx(fx);
  for (const p of f.parts) {
    if (p.life <= 0) continue;
    ctx.globalAlpha = clamp(p.life / p.maxLife, 0, 1);
    ctx.fillStyle = p.color;
    ctx.fillRect(Math.round(p.x), Math.round(p.y), 2, 2);
  }
  ctx.globalAlpha = 1;

  // 데미지 숫자
  if (!opts.mini) {
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const n of f.nums) {
      ctx.globalAlpha = clamp(n.life * 2.2, 0, 1);
      ctx.font = 'bold 9px ui-monospace, monospace';
      ctx.fillStyle = '#241633';
      ctx.fillText(n.text, Math.round(n.x) + 1, Math.round(n.y) + 1);
      ctx.fillStyle = n.color;
      ctx.fillText(n.text, Math.round(n.x), Math.round(n.y));
    }
    ctx.globalAlpha = 1;
  }
  if (selected && !opts.mini && selected.owner === 0 && ['auction','battle','waveend'].includes(G.phase)
      && f.slots.some(slot => slot.owner === 0 && !slot.unit)) {
    placement.drawHint(ctx, selected.x, selected.y);
  }
  ctx.restore();
}

function drawSlot(slot, f) {
  if(G.routes){ART.outpost(ctx,slot,PLAYER_COLORS[slot.owner],G.sel?.owner===slot.owner && !slot.unit);return;}
  const sel = G.sel && G.sel.uid === slot.unit?.uid;
  ctx.save();
  ctx.globalAlpha = slot.unit ? 0.35 : 0.6;
  ctx.strokeStyle = sel ? '#7ef0c9' : (slot.owner === 0 ? '#9dd8c4' : '#cbb8ef');
  ctx.lineWidth = sel ? 2 : 1;
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(slot.x - 13, slot.y - 9, 26, 18, 4) : ctx.rect(slot.x - 13, slot.y - 9, 26, 18);
  ctx.stroke();
  if (!slot.unit) {
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = '#0c1a16';
    ctx.fillRect(slot.x - 4, slot.y - 1, 8, 2);
    ctx.fillRect(slot.x - 1, slot.y - 4, 2, 8);
  }
  ctx.restore();
}

function drawCoopZones(f, opts) {
  for (let i = 0; i < 4; i++) {
    const slots = f.slots.filter(s => s.owner === i);
    if (!slots.length) continue;
    const col = G.players[i].color;
    const xs = slots.map(s => s.x), ys = slots.map(s => s.y);
    const x0 = Math.min.apply(null, xs) - 22, x1 = Math.max.apply(null, xs) + 22;
    const y0 = Math.min.apply(null, ys) - 18, y1 = Math.max.apply(null, ys) + 20;
    ctx.fillStyle = hexA(col, i === 0 ? 0.14 : 0.08);
    if(!G.routes)ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    ctx.strokeStyle = hexA(col, 0.45);
    ctx.lineWidth = 1;
    if(!G.routes)ctx.strokeRect(x0 + .5, y0 + .5, x1 - x0 - 1, y1 - y0 - 1);
    // 이름 라벨 (구역 바깥쪽)
    const label = (i === 0 ? '나 · ' : '') + G.players[i].name;
    ctx.font = 'bold 9px ui-monospace, monospace';
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    const tw = ctx.measureText(label).width + 8;
    let lx, ly;
    if (i === 0) { lx = (x0 + x1) / 2 - tw / 2; ly = CH - 11; }
    else if (i === 1) { lx = (x0 + x1) / 2 - tw / 2; ly = y1 + 11; }
    else if (i === 2) { lx = Math.max(4, x0 - 2); ly = y0 - 10; }
    else { lx = Math.min(CW - tw - 4, x1 - tw + 2); ly = y0 - 10; }
    ctx.fillStyle = 'rgba(8,5,14,.72)';
    ctx.fillRect(lx, ly - 6, tw, 12);
    ctx.fillStyle = col;
    ctx.fillText(label, lx + 4, ly);
  }
  ctx.textAlign = 'left';
}

function hexA(hex, a) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

function drawUnit(u, opts) {
  const t = G.time;
  const bob = Math.sin(t * 3 + u.bob) * 1.1;
  const pop = u.spawnPop > 0 ? 1 + u.spawnPop * 0.25 : 1;
  const rec = u.recoil ? u.recoil * 2 : 0;
  const footY = u.y + 10 + bob;
  const sc = 3.0 * pop * (opts.mini ? 0.92 : 1);
  ART.shadow(ctx, u.x, u.y + 12, 24);
  const ang = 0;
  if (u.flash > 0) ART.drawTint(ctx, u.type, u.x - rec, footY, sc, '#ffffff');
  else ART.draw(ctx, u.type, u.x - rec, footY, sc);
  // 성급 표시
  if (u.star > 1 && !opts.mini) {
    const w = u.star === 2 ? 10 : 15;
    ctx.fillStyle = 'rgba(12,8,20,.65)';
    ctx.fillRect(u.x - w / 2 - 1, u.y - 34, w, 7);
    ctx.fillStyle = '#ffd166';
    ctx.font = 'bold 7px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(STAR[u.star].label, u.x, u.y - 33);
    ctx.textAlign = 'left';
  }
  if (u.spawnPop > 0) u.spawnPop -= 0.016;
}

function drawEnemy(f, e, opts) {
  const def = ENEMIES[e.type];
  const sc = def.size * (e.small ? 0.78 : 1) * 1.35 * (opts && opts.mini ? 0.92 : 1);
  const bob = Math.sin(G.time * 6 + e.wob) * (e.type === 'bat' ? 2.5 : 1);
  const foot = e.y + 8 + bob;
  ART.shadow(ctx, e.x, e.y + 9, 15 * (sc / 2.4));
  if (e.slowT > 0) {
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = '#8bd3ff';
    ctx.beginPath(); ctx.arc(e.x, e.y + 2, 12, 0, 6.28); ctx.fill();
    ctx.restore();
  }
  const sprite = e.pattern || e.type;
  if (e.flash > 0) ART.drawTint(ctx, sprite, e.x, foot, sc, '#ffffff');
  else ART.draw(ctx, sprite, e.x, foot, sc);
  if(e.boss)ART.drawStance(ctx,e.x,foot,sc,bossStance(e));
  if (e.pattern === 'charge') ART.drawChargeCue(ctx,e.x,foot,sc,chargeStage(e.t));
  if (e.poisonT > 0) {
    ctx.fillStyle = 'rgba(155,255,106,.9)';
    ctx.fillRect(e.x - 4, e.y - 14 + Math.sin(G.time * 8) * 2, 2, 2);
    ctx.fillRect(e.x + 3, e.y - 12 + Math.cos(G.time * 7) * 2, 2, 2);
  }
  // HP 바
  const w = e.boss ? 34 : 18, h = 3;
  const y = e.y - (e.boss ? 52 : 32);
  ctx.fillStyle = 'rgba(10,6,18,.75)';
  ctx.fillRect(e.x - w / 2 - 1, y - 1, w + 2, h + 2);
  ctx.fillStyle = e.boss ? '#ffd166' : '#ff6b6b';
  ctx.fillRect(e.x - w / 2, y, w * clamp(e.hp / e.maxHp, 0, 1), h);
}

function drawShot(s, opts) {
  if (!s.def) return;
  const col = projColor(s.def.proj);
  const len = s.def.proj === 'arrow' ? 8 : 4;
  ctx.save();
  ctx.translate(s.x, s.y);
  ctx.rotate(s.ang || 0);
  ctx.fillStyle = col;
  ctx.fillRect(-len, -1.5, len, 3);
  ctx.fillStyle = 'rgba(255,255,255,.7)';
  ctx.fillRect(-len, -1.5, 2, 3);
  if (s.def.proj === 'ball' || s.def.proj === 'lava') {
    ctx.fillStyle = '#2a1a2e';
    ctx.fillRect(-2, -2, 4, 4);
  }
  ctx.restore();
}

function drawFx(fx) {
  const k = clamp(fx.life / fx.maxLife, 0, 1);
  ctx.save();
  if (fx.type === 'boom') {
    ctx.globalAlpha = k * 0.7;
    ctx.fillStyle = fx.color;
    ctx.beginPath(); ctx.arc(fx.x, fx.y, fx.r * (1.15 - k * 0.35), 0, 6.28); ctx.fill();
    ctx.globalAlpha = k;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(fx.x, fx.y, fx.r * (1.2 - k * 0.3), 0, 6.28); ctx.stroke();
  } else if (fx.type === 'spark') {
    ctx.globalAlpha = k;
    ctx.fillStyle = fx.color;
    ctx.fillRect(fx.x - 2, fx.y - 2, 4, 4);
  } else if (fx.type === 'bolt') {
    ctx.globalAlpha = k;
    ctx.strokeStyle = fx.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    const segs = 4;
    ctx.moveTo(fx.x1, fx.y1);
    for (let i = 1; i <= segs; i++) {
      const t = i / segs;
      ctx.lineTo(fx.x1 + (fx.x2 - fx.x1) * t + rand(-4, 4), fx.y1 + (fx.y2 - fx.y1) * t + rand(-4, 4));
    }
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.8)';
    ctx.lineWidth = 1;
    ctx.stroke();
  } else if (fx.type === 'slash') {
    ctx.globalAlpha = k;
    ctx.strokeStyle = fx.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(fx.x, fx.y, 10, -0.9, 0.9);
    ctx.stroke();
  } else if (fx.type === 'puff') {
    ctx.globalAlpha = k * 0.8;
    ctx.fillStyle = '#fff';
    for (let i = 0; i < 4; i++) {
      const a = i / 4 * 6.28;
      const r = fx.r * (1 - k) * 0.8 + 3;
      ctx.beginPath(); ctx.arc(fx.x + Math.cos(a) * r, fx.y + Math.sin(a) * r, 3, 0, 6.28); ctx.fill();
    }
  }
  ctx.restore();
}

function drawBanner() {
  if (!G.banner) return;
  const b = G.banner;
  b.life -= 0.016;
  if (b.life <= 0) { G.banner = null; return; }
  const k = b.life / b.maxLife;
  const a = k > 0.8 ? (1 - k) / 0.2 : k > 0.15 ? 1 : k / 0.15;
  ctx.save();
  ctx.globalAlpha = clamp(a, 0, 1);
  ctx.textAlign = 'center';
  const y = 196 - (k > 0.8 ? (1 - (1 - k) / 0.2) * 10 : 0);
  ctx.font = 'bold 30px ui-monospace, monospace';
  ctx.fillStyle = '#0b0712';
  ctx.fillText(b.main, VW / 2 + 2, y + 2);
  ctx.fillStyle = '#ffd166';
  ctx.fillText(b.main, VW / 2, y);
  if (b.sub) {
    ctx.font = 'bold 11px ui-monospace, monospace';
    ctx.fillStyle = '#cbb8ef';
    ctx.fillText(b.sub, VW / 2, y + 18);
  }
  ctx.restore();
}

function drawTitleDecor() {
  // 타이틀 아래 도트 퍼레이드
  const baseY = 470;
  ctx.save();
  const g = ctx.createLinearGradient(0, baseY - 40, 0, baseY + 50);
  g.addColorStop(0, 'rgba(38,28,60,0)');
  g.addColorStop(0.35, 'rgba(34,25,56,.9)');
  g.addColorStop(1, 'rgba(18,13,32,.95)');
  ctx.fillStyle = g;
  ctx.fillRect(0, baseY - 40, VW, 120);
  ctx.fillStyle = '#2c5138';
  ctx.fillRect(0, baseY + 6, VW, 6);
  ctx.fillStyle = '#3d6b4a';
  for (let x = 0; x < VW; x += 8) ctx.fillRect(x, baseY + 5, 4, 1);

  const keys = ['archer', 'cannoneer', 'toad', 'firemage', 'frostmage', 'paladin', 'drone', 'thunder', 'lavagolem', 'frostgolem'];
  keys.forEach((k, i) => {
    const x = 52 + i * 75;
    const bob = Math.sin(G.time * 2 + i * 0.9) * 2;
    ART.shadow(ctx, x, baseY + 6, 30);
    ART.draw(ctx, k, x, baseY + 4 + bob, 2.9);
  });
  ctx.restore();
}

/* ================= 메인 루프 ================= */
let last = performance.now();
function loop(now) {
  const raw = Math.min(0.05, (now - last) / 1000);
  last = now;
  G.time += raw;

  if (!G.paused) update(raw);
  render();
  syncUI(raw);
  maybeFit();
  requestAnimationFrame(loop);
}

function update(raw) {
  if (G.timer) {
    G.timer.t -= raw;
    if (G.timer.t <= 0) { const fn = G.timer.fn; G.timer = null; fn(); }
  }
  const dt = raw * G.speed;
  if (G.phase === 'auction' && G.auction) {
    const previewTime=Math.min(raw,G.auction.prep);
    G.auction.prep-=previewTime;
    G.auction.t-=raw-previewTime;
    if (G.auction.t <= 0) { confirmBid(true); }
  } else if (G.phase === 'reveal' && G.auction) {
    updateReveal(raw);
  } else if (G.phase === 'battle') {
    if (G.mode === 'coop') {
      if(G.coreHp<=0)return;
      updateField(G.arena, dt);
      if (G.coreHp>0 && !awaitReward() && G.arena.cleared) endWave();
    } else {
      for (const p of G.players) if (p.field.active) updateField(p.field, dt);
      if(awaitReward())return;
      const allDone = G.players.every(p => !p.field.alive || p.field.cleared);
      if (allDone && G.players[0].field.alive) endWave();
    }
  }
  // 선택 유닛이 사라졌으면 해제
  if (G.sel && G.players[0]) {
    const f = G.players[G.sel.owner ?? 0].field;
    if (!f.units.find(u => u.uid === G.sel.uid)) G.sel = null;
  }
}

/* ================= 초기화 ================= */
function fitCanvas() {
  const wrap = $('boardWrap');
  const r = wrap.getBoundingClientRect();
  const availW = Math.max(200, r.width - 10);
  const availH = Math.max(150, r.height - 10);
  const ar = VW / VH;
  let w = availW, h = w / ar;
  if (h > availH) { h = availH; w = h * ar; }
  const portrait = G.phase !== 'title' && window.innerHeight > window.innerWidth * 1.1;
  const wrapEl = $('boardWrap');
  if (portrait) {
    // 세로: 보드는 캔버스 높이에 맞추고, 패널이 남은 높이를 쓴다 (뷰포트 폭 기준으로 안정 계산)
    w = Math.min(availW, window.innerWidth - 12);
    h = w / ar;
    wrapEl.style.flex = '0 0 auto';
    wrapEl.style.height = Math.ceil(h + 14) + 'px';
  } else {
    wrapEl.style.flex = '';
    wrapEl.style.height = '';
  }
  canvas.style.width = Math.floor(w) + 'px';
  canvas.style.height = Math.floor(h) + 'px';
  lastWrap = { w: wrap.getBoundingClientRect().width, h: wrap.getBoundingClientRect().height };
}

let lastWrap = { w: 0, h: 0 };
let fitClock = 0;
function maybeFit() {
  fitClock += 1;
  if (fitClock % 12 !== 0) return;   // 5fps 정도만 확인
  const r = $('boardWrap').getBoundingClientRect();
  if (Math.abs(r.width - lastWrap.w) > 3 || Math.abs(r.height - lastWrap.h) > 3) fitCanvas();
}

function bindUI() {
  $('btnSurvival').addEventListener('click', () => newGame('survival'));
  $('btnCoop').addEventListener('click', () => newGame('coop'));
  $('btnHowto').addEventListener('click', () => { $('howtoBox').classList.remove('hidden'); $('btnHowtoClose').focus(); });
  $('btnHowtoClose').addEventListener('click', () => { $('howtoBox').classList.add('hidden'); $('btnHowto').focus(); });

  document.querySelectorAll('[data-bid]').forEach(b => {
    b.addEventListener('click', () => adjustBid(parseInt(b.dataset.bid, 10)));
  });
  $('btnAllin').addEventListener('click', () => {
    const a = G.auction; if (!a) return;
    a.bid = G.players[0].gold; SFX.bid(50); updateBidUI();
  });
  $('btnPass').addEventListener('click', () => {
    const a = G.auction; if (!a) return;
    a.bid = 0; updateBidUI(); confirmBid(false);
  });
  $('btnConfirm').addEventListener('click', () => confirmBid(false));
  $('revealLayer').addEventListener('click', () => {
    if (G.phase === 'reveal' && G.auction && G.auction.resolved) startBattle();
  });

  $('btnSound').addEventListener('click', () => {
    SFX.init();
    const m = !SFX.muted;
    SFX.setMuted(m);
    $('btnSound').querySelector('img').src = m ? 'icons/muted.svg' : 'icons/volume.svg';
    $('btnSound').setAttribute('aria-pressed', String(!m));
    $('btnSound').classList.toggle('on', !m);
    G.muted = m;
  });
  $('btnSpeed').addEventListener('click', toggleSpeed);
  const menu = $('menuLayer');
  function syncMenuSound() {
    $('menuSound').textContent = G.muted ? '효과음 꺼짐' : '효과음 켜짐';
    $('menuSound').setAttribute('aria-pressed', String(!G.muted));
  }
  $('btnMenu').addEventListener('click', () => {
    const title = G.phase === 'title';
    G.paused = !title && G.phase !== 'result';
    $('menuHeading').textContent = title ? '메인 메뉴' : G.paused ? '잠깐 쉬기' : '결과 메뉴';
    $('btnResume').textContent = G.paused ? '계속하기' : '닫기';
    $('menuHelp').hidden = !title;
    $('btnRestart').hidden = title;
    $('btnQuit').hidden = title;
    syncMenuSound();
    menu.showModal();
    $('btnMenu').setAttribute('aria-expanded', 'true');
  });
  menu.addEventListener('close', () => {
    if (!menu.open) {
      G.paused = false;
      $('btnMenu').setAttribute('aria-expanded', 'false');
    }
  });
  menu.addEventListener('click', ev => {
    if (ev.target !== menu) return;
    const rect = menu.getBoundingClientRect();
    if (ev.clientX < rect.left || ev.clientX > rect.right || ev.clientY < rect.top || ev.clientY > rect.bottom) menu.close();
  });
  $('menuSound').addEventListener('click', () => { $('btnSound').click(); syncMenuSound(); });
  $('menuHelp').addEventListener('click', () => { menu.close(); $('btnHowto').click(); });
  $('btnResume').addEventListener('click', () => menu.close());
  $('btnRestart').addEventListener('click', () => { menu.close(); newGame(G.mode); });
  $('btnQuit').addEventListener('click', () => {
    menu.close();
    G.paused = false;
    $('resultLayer').classList.add('hidden');
    G.phase = 'title';
    G.players = [];
    G.auction = null;
    $('titleLayer').classList.remove('hidden');
    fitCanvas();
    showPanel('none');
    setIdle('모드를 고르면 경매가 시작된다');
    $('modeLabel').textContent = '대기 중';
    $('waveNum').textContent = '–'; $('goldNum').textContent = '–'; $('lifeNum').textContent = $('myKills').textContent = '–';
  });
  $('btnAgain').addEventListener('click', () => newGame(G.mode));
  $('btnHome').addEventListener('click', () => {
    G.phase = 'title'; G.players = []; G.auction = null;
    $('resultLayer').classList.add('hidden');
    $('titleLayer').classList.remove('hidden');
    fitCanvas();
    showPanel('none');
    setIdle('모드를 고르면 경매가 시작된다');
    $('waveNum').textContent = '–'; $('goldNum').textContent = '–'; $('lifeNum').textContent = $('myKills').textContent = '–';
  });

  $('btnUpgrade').addEventListener('click', tryUpgrade);
  $('btnSell').addEventListener('click', trySell);
  $('btnCancelSel').addEventListener('click', () => { G.sel = null; });
  $('unitRow').addEventListener('click', (ev) => {
    const chip = ev.target.closest('.unit-chip');
    if (!chip) return;
    const uid = parseInt(chip.dataset.uid, 10);
    const u = G.players[0].field.units.find(x => x.uid === uid);
    if (u) { G.sel = { uid, owner: u.owner }; SFX.bid(2); }
  });

  canvas.addEventListener('click', onCanvasClick);
  canvas.addEventListener('touchstart', (ev) => { ev.preventDefault(); onCanvasClick(ev); }, { passive: false });

  window.addEventListener('keydown', (ev) => {
    if ($('traitDialog').open || ev.target.closest?.('button[data-trait]') || $('augmentDialog').open || menu.open || ev.target === $('btnMenu') || ev.target.closest?.('#placement')) return;
    if (G.phase === 'auction') {
      if (ev.code === 'Space' || ev.code === 'Enter') { ev.preventDefault(); confirmBid(false); }
      else if (ev.code === 'ArrowUp') { ev.preventDefault(); adjustBid(1); }
      else if (ev.code === 'ArrowDown') { ev.preventDefault(); adjustBid(-1); }
    } else if (G.phase === 'reveal' && G.auction && G.auction.resolved && (ev.code === 'Space' || ev.code === 'Enter')) {
      startBattle();
    }
  });
  window.addEventListener('resize', fitCanvas);
  window.addEventListener('orientationchange', () => setTimeout(fitCanvas, 120));
  setTimeout(fitCanvas, 60);
  setTimeout(fitCanvas, 400);
}

function boot() {
  ART.init();
  const party = $('titleParty').getContext('2d');
  ['archer','toad','firemage','drone','frostgolem'].forEach((key,i) => ART.draw(party,key,14+i*27,23,1.25));
  buildBackgrounds();
  bindUI();
  fitCanvas();
  showPanel('none');
  setIdle('모드를 고르면 경매가 시작된다');
  $('waveNum').textContent = '–';
  $('goldNum').textContent = '–';
  $('lifeNum').textContent = $('myKills').textContent = '–';
  requestAnimationFrame(loop);
}

boot();

/* ================= 테스트 훅 ================= */
window.PAD = {
  G, UNITS, LOTS, ENEMIES, resolveBids,
  startGame: (m) => newGame(m),
  setSpeed: (n) => { G.speed = n; },
  bid: (n) => { if (G.auction) { G.auction.bid = Math.min(n, G.players[0].gold); updateBidUI(); } },
  confirm: () => confirmBid(false),
  resolveBids,
  skipReveal: () => { if (G.phase === 'reveal') startBattle(); },
  tick: (seconds, step) => { const st = step || 1 / 60; let t = 0; G.speed = 1; while (t < seconds) { update(st); t += st; } },
  skipRevealNow: () => { if (G.phase === 'reveal' && G.auction) { G.auction.revealT = 5; updateReveal(0.001); } },
  // 테스트: 입찰가를 강제로 넣고 실제 공개 처리 경로를 태운다
  forceBids: (bids) => {
    if (!G.auction) return null;
    G.auction.bids = bids.slice();
    G.auction.committed = true;
    G.auction.resolved = false;
    G.auction.revealT = 1.5;
    updateReveal(0.02);
    return { outcome: G.auction.outcome, gold: G.players.map(p => p.gold) };
  },
  // 밸런스 시뮬레이션용 자동 플레이 (렌더 없이 update만 돌린다)
  autoPlay: (opts) => {
    opts = opts || {};
    newGame(opts.mode || 'survival');
    const log = [];
    let t = 0, spend = 0, won = 0;
    const maxT = opts.maxT || 1600;
    while (t < maxT) {
      if (G.phase === 'result') break;
      if (G.phase === 'auction' && G.auction.prep<=0) {
        const p = G.players[0];
        const val = LOTS[G.auction.key].cost;
        const want = Math.round(val * (opts.aggr || 1.15) + 2 + (opts.waveBid == null ? 1.5 : opts.waveBid) * G.wave);
        const bid = Math.max(0, Math.min(p.gold, want));
        G.auction.bid = bid;
        log.push({ t: Math.round(t), wave: G.wave, buy: G.auction.key, bid, gold: Math.round(p.gold) });
        confirmBid(false);
        spend += bid;
      }
      if (G.phase === 'battle' && opts.upgrade) {
        const p = G.players[0];
        const ups = p.field.units.filter(u => u.owner === 0 && u.star < 3).sort((a, b) => a.star - b.star);
        for (const u of ups) {
          const c = upgradeCost(u);
          if (p.gold >= c + (opts.reserve || 8)) { p.gold -= c; u.star++; u.spawnPop = 0.6; recomputeField(p.field); break; }
        }
      }
      if (G.phase === 'waveend' && log[log.length - 1] && log[log.length - 1].ev !== 'end') {
        const p = G.players[0];
        log.push({ ev: 'end', wave: G.wave, lives: G.mode === 'coop' ? G.coreHp : p.field.lives, gold: Math.round(p.gold), units: p.field.units.filter(u => u.owner === 0).map(u => u.type + u.star).join(',') });
      }
      if(G.phase==='augment'){chooseAugment(G.players[0],G.players[0].choices[0]);G.phase='battle';}
      update(1 / 30);
      t += 1 / 30;
    }
    return {
      mode: G.mode, wave: G.wave, phase: G.phase, result: G.result,
      gold: Math.round(G.players[0].gold), lives: G.mode === 'coop' ? G.coreHp : G.players[0].field.lives,
      units: G.players[0].field.units.filter(u => u.owner === 0).map(u => u.type + u.star).join(','),
      kills: G.players[0].stats.kills, log,
      ranks: (G.result ? [...G.players].sort((a, b) => (b.field.alive - a.field.alive) || b.stats.kills - a.stats.kills).map(p => p.name + ':' + p.field.lives) : []),
      bots: G.players.slice(1).map(p => ({ name: p.name, lives: p.field.lives, gold: Math.round(p.gold), units: p.field.units.length, kills: p.stats.kills, dmg: Math.round(p.stats.damage) })),
    };
  },
  state: () => ({
    phase: G.phase, wave: G.wave, mode: G.mode,
    gold: G.players[0] ? G.players[0].gold : null,
    lives: G.mode === 'coop' ? G.coreHp : (G.players[0] && G.players[0].field ? G.players[0].field.lives : null),
    enemies: G.players[0] && G.players[0].field ? G.players[0].field.enemies.length : 0,
    units: G.players[0] && G.players[0].field ? G.players[0].field.units.filter(u => u.owner === 0).length : 0,
    auction: G.auction ? { key: G.auction.key, bid: G.auction.bid, bids: G.auction.bids.slice(), resolved: G.auction.resolved, outcome: G.auction.outcome } : null,
  }),
};
