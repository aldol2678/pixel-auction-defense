'use strict';
/* =========================================================
   ART — 도트 스프라이트 (16x16 픽셀맵) + 필드 배경
   외부 이미지 없이 코드로만 그린다. imageSmoothingEnabled=false.
   ========================================================= */
const ART = (() => {
  const S = 16;

  // 공통 팔레트 조각
  const K = '#2a1a2e';      // 외곽선
  const W = '#fff6e8';      // 흰색(얼굴/장갑)
  const E = '#2a1a2e';      // 눈

  const DEFS = {
    /* ---------------- 아군 유닛 ---------------- */
    archer: {
      pal: { K, W, E, G: '#5ec46a', B: '#8a5a3b', A: '#cf9a4e' },
      rows: [
        '................',
        '.....KKKKKK.....',
        '....KGGGGGGK....',
        '...KGGGGGGGGK...',
        '...KGWWWWWWGK...',
        '...KGWEWWEWGK...',
        '...KGWEWWEWGK...',
        '...KGWWKKWWGK...',
        '...KGWWWWWWGK...',
        '.A..KGGGGGGK....',
        'AK.KKBBBBBBKK...',
        'AW.KBBBBBBBBBBK.',
        'A..KBBWBBBBWBBK.',
        '.A.KBBBBBBBBBBK.',
        '...KBBK..KBBK...',
        '...KKK....KKK...',
      ],
    },
    cannoneer: {
      pal: { K, W, E, M: '#b8c6d6', G: '#ffd166', B: '#4f74c8', H: '#ffdcc0' },
      rows: [
        '................',
        '....KKKKKKKK....',
        '...KMMMMMMMMK...',
        '...KMMMGGMMMK...',
        '...KMHHHHHHMK...',
        '...KHWEWWEWHK...',
        '...KHWEWWEWHK...',
        '...KHWWKKWWHK...',
        '...KHHWWWWHHK...',
        '....KHHHHHHK....',
        '...KKBBBBBBKK...',
        '..KBBBBBBBBBBK..',
        '.MKBBWBBBBWBBK..',
        '..KBBBBBBBBBBK..',
        '...KBBK..KBBK...',
        '...KKKK..KKKK...',
      ],
    },
    toad: {
      pal: { K, W, E, G: '#7bd45a', D: '#4a9a3a', A: '#b6f57e' },
      rows: [
        '................',
        '...KKK....KKK...',
        '..KGGGK..KGGGK..',
        '..KGEGK..KGEGK..',
        '..KGGGKKKKGGGK..',
        '.KGGGGGGGGGGGGK.',
        'KGGGGGGGGGGGGGGK',
        'KGGDGGGGGGGGDGGK',
        'KGGGKKKKKKKKGGGK',
        'KGGGGGGGGGGGGGGK',
        '.KGGDGGGGGGDGGK.',
        '..KGGGGGGGGGGK..',
        '...KKGGGGGGKK...',
        '....KKGGGGKK....',
        '.....KKKKKK.....',
        '................',
      ],
    },
    firemage: {
      pal: { K, W, E, A: '#e5523c', R: '#ffb347', B: '#5a3a7a', H: '#ffdcc0' },
      rows: [
        '................',
        '................',
        '......KK........',
        '.....KAAK.......',
        '....KAAAARK.....',
        '...KAAAAAAARK...',
        '...KKKKKKKKKK...',
        '...KHWEWWEWHK...',
        '...KHWEWWEWHK...',
        '...KHWWKKWWHK...',
        '...KKBBBBBBKK...',
        '..KBBBBBBBBBBK..',
        '..KBBWBBBBWBBK..',
        '..KBBBBBBBBBBK..',
        '...KBBK..KBBK...',
        '...KKK....KKK...',
      ],
    },
    frostmage: {
      pal: { K, W, E, A: '#6fc9ff', R: '#ffffff', B: '#e8f4ff', H: '#ffdcc0', D: '#8fd0ee' },
      rows: [
        '................',
        '................',
        '......KK........',
        '.....KAAK.......',
        '....KAAARK......',
        '...KAAAAAARK....',
        '...KKKKKKKKKK...',
        '...KHWEWWEWHK...',
        '...KHWEWWEWHK...',
        '...KHWWKKWWHK...',
        '...KKBBBBBBKK...',
        '..KBBBBBBBBBBK..',
        '..KBBWBBBBWBBK..',
        '..KBBBBBBBBBBK..',
        '...KBBK..KBBK...',
        '...KKK....KKK...',
      ],
    },
    paladin: {
      pal: { K, W, E, M: '#dfe6f0', G: '#ffd166', Y: '#ffe9a8', H: '#ffdcc0' },
      rows: [
        '................',
        '....KKKKKKKK....',
        '...KMMMMMMMMK...',
        '...KMMMGGMMMK...',
        '...KMHHHHHHMK...',
        '...KHWEWWEWHK...',
        '...KHWEWWEWHK...',
        '...KHWWKKWWHK...',
        '...KHHWWWWHHK...',
        '....KHHHHHHK....',
        '...KKGGGGGGKK...',
        '..KGGWWWWWWGGK..',
        '..KGGWYYYYWGGK..',
        '..KGGWWWWWWGGK..',
        '...KGGK..KGGK...',
        '...KKK....KKK...',
      ],
    },
    drone: {
      pal: { K, W, E, A: '#9fb4c9', M: '#c0ccda', D: '#8a9bb0' },
      rows: [
        '................',
        '....A......A....',
        '...KAAAAAAAAK...',
        '....KKKKKKKK....',
        '...KMMMMMMMMK...',
        '..KMMEEMMEEMMK..',
        '..KMMMMMMMMMMK..',
        '..KMMWWWWWWMMK..',
        '..KMMWKKKKWMMK..',
        '..KMMMMMMMMMMK..',
        '...KMMMMMMMMK...',
        '....KKKKKKKK....',
        '.....K.MM.K.....',
        '......KMMK......',
        '......KKKK......',
        '................',
      ],
    },
    thunder: {
      pal: { K, W, E, M: '#e6eef8', Y: '#ffcf4d', B: '#4f74c8', H: '#ffdcc0' },
      rows: [
        '................',
        '....KKKKKKKK....',
        '...KMMMMMMMMK...',
        '...KMMMYYMMMK...',
        '...KMHHHHHHMK...',
        '...KHWEWWEWHK...',
        '...KHWEWWEWHK...',
        '...KHWWKKWWHK...',
        '...KHHWWWWHHK...',
        '....KHHHHHHK.Y..',
        '...KKBBBBBBKK.Y.',
        '..KBBBBBBBBBBK.Y',
        '..KBBWBBBBWBBKYY',
        '..KBBBBBBBBBBKY.',
        '...KBBK..KBBK...',
        '...KKK....KKK...',
      ],
    },
    lavagolem: {
      pal: { K, W, E, D: '#6b4a4a', R: '#ff7a3c', A: '#ffb347' },
      rows: [
        '................',
        '....KKKKKKKK....',
        '...KDDDDDDDDK...',
        '..KDDDDDDDDDDK..',
        '..KDRRDDDDDRRK..',
        '..KDWEDDDDEWDK..',
        '..KDDDDDDDDDDK..',
        '.KDDDDDKKDDDDDK.',
        '.KDDDRRRRRRDDDK.',
        '.KDDDDDDDDDDDDK.',
        '.KDDDDDDDDDDDDK.',
        '..KDDDDDDDDDDK..',
        '..KDDKKDDKKDDK..',
        '...KKK.KK.KKK...',
        '................',
        '................',
      ],
    },
    frostgolem: {
      pal: { K, W, E, D: '#8fd4f0', A: '#d8f6ff', B: '#5aa9d6' },
      rows: [
        '................',
        '..K..KKKKKK..K..',
        '..KAKDDDDDDKAK..',
        '..KAKDDDDDDKAK..',
        '...KDDDDDDDDK...',
        '..KDDWEDDEWDDK..',
        '..KDDDDDDDDDDK..',
        '.KDDDDDKKDDDDDK.',
        '.KDDDWWWWWWDDDK.',
        '.KDDDDDDDDDDDDK.',
        '.KDDDDDDDDDDDDK.',
        '..KDDDDDDDDDDK..',
        '..KDDKKDDKKDDK..',
        '...KKK.KK.KKK...',
        '................',
        '................',
      ],
    },

    /* ---------------- 적 ---------------- */
    slime: {
      pal: { K, W, E, G: '#79d95b', D: '#4f9e3c' },
      rows: [
        '................',
        '................',
        '......KKKK......',
        '....KKGGGGKK....',
        '...KGGGGGGGGK...',
        '..KGGWEGWEGGGK..',
        '..KGGGGGGGGGGK..',
        '..KGGGKKKKGGGK..',
        '.KGGGGGGGGGGGGK.',
        '.KGGGGGGGGGGGGK.',
        '.KGGGGGGGGGGGGK.',
        '..KGGGGGGGGGGK..',
        '...KKGGGGGGKK...',
        '.....KKKKKK.....',
        '................',
        '................',
      ],
    },
    bat: {
      pal: { K, W, E, A: '#a06be0', B: '#6b45a3' },
      rows: [
        '................',
        '................',
        '..KK........KK..',
        '.KAAK..KK..KAAK.',
        'KAAAAK.KK.KAAAAK',
        'KAAAAAKAAKAAAAAK',
        '.KAAAAKAAKAAAAK.',
        '..KAAAKAAKAAAK..',
        '...KKK.KK.KKK...',
        '.....KEAAEK.....',
        '.....KAAAAK.....',
        '......KAAK......',
        '.......KK.......',
        '................',
        '................',
        '................',
      ],
    },
    armored: {
      pal: { K, W, E, M: '#8892a8', B: '#5b6478', G: '#c8d2e0' },
      rows: [
        '................',
        '....KKKKKKKK....',
        '...KMMMMMMMMK...',
        '..KMMMMMMMMMMK..',
        '..KMMEMMMMEMMK..',
        '..KMMMMMMMMMMK..',
        '..KMMMKKKKMMMK..',
        '..KMMMMMMMMMMK..',
        '..KMMMMMMMMMMK..',
        '...KMMMMMMMMK...',
        '...KKMMMMMMKK...',
        '..KMMBBBBBBMMK..',
        '..KMMBBBBBBMMK..',
        '..KMMBBBBBBMMK..',
        '...KMMK..KMMK...',
        '...KKK....KKK...',
      ],
    },
    ghost: {
      pal: { K, W, E, G: '#c9d8ff' },
      rows: [
        '................',
        '.....KKKKKK.....',
        '....KWWWWWWK....',
        '...KWWWWWWWWK...',
        '...KWWEWWEWWK...',
        '...KWWEWWEWWK...',
        '...KWWWWKKWWK...',
        '...KWWWWWWWWK...',
        '...KWWWWWWWWK...',
        '...KWWWWWWWWK...',
        '...KWWWWWWWWK...',
        '...KWKWWWWKWK...',
        '...KWK.KW.KWK...',
        '....K..KK..K....',
        '................',
        '................',
      ],
    },
    kingslime: {
      pal: { K, W, E, G: '#ff8a5c', Y: '#ffd166', D: '#c95f37' },
      rows: [
        '................',
        '...G..G..G..G...',
        '...KKKKKKKKKK...',
        '..KYYYYYYYYYYK..',
        '...KKKKKKKKKK...',
        '...KKGGGGGGKK...',
        '..KGGGGGGGGGGK..',
        '.KGGWEGGGGEWGGK.',
        '.KGGGGGGGGGGGGK.',
        '.KGGGKKKKKKGGGK.',
        '.KGGGGGGGGGGGGK.',
        '.KGGGGGGGGGGGGK.',
        '..KGGGGGGGGGGK..',
        '...KKGGGGGGKK...',
        '.....KKKKKK.....',
        '................',
      ],
    },
  };

  DEFS.split = {...DEFS.kingslime, pal:{...DEFS.kingslime.pal,G:'#79deb2',D:'#419b81'}};
  DEFS.aegis = {...DEFS.kingslime,pal:{...DEFS.kingslime.pal,G:'#7bc6ff',Y:'#cef4ff',D:'#4275a8'}};
  DEFS.eclipse = {...DEFS.kingslime,pal:{...DEFS.kingslime.pal,G:'#bd83ef',Y:'#ffbb65',D:'#664180'}};
  DEFS.charge = {...DEFS.kingslime, pal:{...DEFS.kingslime.pal,G:'#ee6874',Y:'#ffad59'}};
  DEFS.scout = {"pal":{"a":"#8ed384","b":"#b17a46","w":"#fff8e3","X":"#302839"},"rows":["................","................",".......XX.......","......XaaX......",".....XaaaaXX....","....XaaaaaaaX...",".....XwwwwX.....",".....XwXwXX.....",".....XwwwX..bb..","....XbaabX.bX...","....XbbbbbXb....",".....XbbX.Xbb...",".....XbbX...bb..","....XX..XX......","................","................"]};
  DEFS.alchemist = {"pal":{"a":"#a4dfa0","b":"#ad68cb","w":"#fff8e3","X":"#302839"},"rows":["................","................","......XXX.......",".....XaaaX......","....XaaabaX.....","....XwwbwwX.....","....XwXbXwX.....",".....XbbbX......",".....XabaX..aa..","....XabaaaX.aa..","....XaaaabXabba.",".....XbbXXXabba.",".....XbbX..XbbX.","....XX..XX......","................","................"]};
  DEFS.warden = {"pal":{"a":"#7ce4eb","b":"#798bcf","w":"#fff8e3","X":"#302839"},"rows":["................","................","......a.....a...",".....aaa....a...",".....aba...aaa..","....XabbaX..a...","....XwXXwX..a...",".....XbbX...a...","....XabbbaX.a...","...XabaabbXXa...","...XabbbabX.a...","....XbbbbX..a...",".....XbbX...a...","....XX..XX..a...","................","................"]};
  DEFS.beacon = {"pal":{"a":"#ffd685","b":"#ab789f","w":"#fff8e3","X":"#302839"},"rows":["................","................","......a.........",".....aaa........","....XbaaX.......","....XwwwwX......","....XwXwXX......",".....XwwX...a...","....XbabbX.XaX..","...XbbabbXXawa..","....XbabbX.XaX..","....XbaabX..b...","...XbbabbbX.b...","....XX..XX..b...","................","................"]};
  DEFS.coil = {"pal":{"a":"#80eece","b":"#829cca","w":"#fff8e3","X":"#302839"},"rows":["................","................","....aa....aa....","....ab....ba....",".....abbba......","....XbbbbbX.....","...XabwaabaX....","...XbbwwbbbX....","....XabbaX......",".....baab.......","....bbaabb......","....XbbbbX......","...XbbXXbbX.....","...XXX..XXX.....","................","................"]};
  DEFS.blade = {"pal":{"a":"#e8efef","b":"#e5ad68","w":"#fff8e3","X":"#302839"},"rows":["................","................","..........aaa...",".........aaa....","........aaab....",".......aaab.....","......aaab......",".....aaab.......","...bbaab........","....bbb.........","....bb.b........","...bb...........","..bb............","................","................","................"]};
  DEFS.scope = {"pal":{"a":"#8bdbef","b":"#d5ad72","w":"#fff8e3","X":"#302839"},"rows":["................","................",".........aaaa...","........abbaaa..",".......abbaawa..","......bbbaaawa..",".....bbaabbaaa..","....bbaab.aaa...","...bbaab........","..bbaab.........","..abba..........","...aa...........","................","................","................","................"]};
  DEFS.spring = {"pal":{"a":"#ffc676","b":"#a393e1","w":"#fff8e3","X":"#302839"},"rows":["................","................","....bbbbbb......","...bb....ba.....","...baaaaab......","....bbaabb......",".....bbab.......","....baaabb......","...bbbaabb......","....baabb.......","....bbab........","....aaaaaa......","...bbbbbbbb.....","................","................","................"]};
  DEFS.lens = {"pal":{"a":"#b3eefa","b":"#bd8fe4","w":"#fff8e3","X":"#302839"},"rows":["................","................",".....bbbbb......","....baaaaab.....","...baawaaaab....","...baawaaaab....","....baaaaab.....",".....bbbbb......",".......bbb......","........bbb.....",".........bbb....","................","................","................","................","................"]};
  DEFS.banner = {"pal":{"a":"#f7c473","b":"#cd6487","w":"#fff8e3","X":"#302839"},"rows":["................","................","....a...........","....abbbbbb.....","....abbaabb.....","....abbbbba.....","....abbaabb.....","....abbbbb......","....a...........","....a...........","....a...........","...aaa..........","................","................","................","................"]};
  DEFS.compass = {"pal":{"a":"#92ebd7","b":"#deb97a","w":"#fff8e3","X":"#302839"},"rows":["................","................","......bb........",".....baab.......","....babbab......","...babbawab.....","..babbawaabb....","..baabwbbaab....","...baabbbab.....","....baaaab......",".....bbbb.......","................","................","................","................","................"]};
  DEFS.clock = {"pal":{"a":"#f2cf8d","b":"#a890ce","w":"#fff8e3","X":"#302839"},"rows":["................","................","...bbbbbbbb.....","...baaaaaab.....","....bawwab......",".....baab.......","......bb........",".....baab.......","....ba..ab......","...baaaaaab.....","...bbbbbbbb.....","................","................","................","................","................"]};
  // 검증: 16x16
  for (const key in DEFS) {
    const rows = DEFS[key].rows;
    if (rows.length !== 16) console.error('sprite row count', key, rows.length);
    rows.forEach((r, i) => { if (r.length !== 16) console.error('sprite row width', key, i, r.length, JSON.stringify(r)); });
  }

  const cache = {};
  const tintCache = {};

  function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }

  function build(key) {
    const def = DEFS[key];
    if (!def) return null;
    const c = makeCanvas(S, S);
    const g = c.getContext('2d');
    for (let y = 0; y < S; y++) {
      const row = def.rows[y];
      for (let x = 0; x < S; x++) {
        const ch = row[x];
        if (ch === '.' || ch === ' ') continue;
        const col = def.pal[ch];
        if (!col) continue;
        g.fillStyle = col;
        g.fillRect(x, y, 1, 1);
      }
    }
    return c;
  }

  function buildTint(key, color) {
    const src = cache[key];
    if (!src) return null;
    const c = makeCanvas(S, S);
    const g = c.getContext('2d');
    g.drawImage(src, 0, 0);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = color;
    g.fillRect(0, 0, S, S);
    return c;
  }

  function init() {
    for (const key in DEFS) cache[key] = build(key);
  }

  function sprite(key) { return cache[key]; }

  /** 가로 중앙, 발끝 기준으로 그린다. */
  function draw(ctx, key, cx, footY, scale, flip) {
    const c = cache[key];
    if (!c) return;
    const w = S * scale, h = S * scale;
    const x = Math.round(cx - w / 2), y = Math.round(footY - h);
    ctx.imageSmoothingEnabled = false;
    if (flip) {
      ctx.save();
      ctx.translate(x + w, y);
      ctx.scale(-1, 1);
      ctx.drawImage(c, 0, 0, w, h);
      ctx.restore();
    } else {
      ctx.drawImage(c, x, y, w, h);
    }
  }

  function drawTint(ctx, key, cx, footY, scale, color, flip) {
    const id = key + '|' + color;
    if (!tintCache[id]) tintCache[id] = buildTint(key, color);
    const c = tintCache[id];
    if (!c) return;
    const w = S * scale, h = S * scale;
    const x = Math.round(cx - w / 2), y = Math.round(footY - h);
    if (flip) {
      ctx.save(); ctx.translate(x + w, y); ctx.scale(-1, 1);
      ctx.drawImage(c, 0, 0, w, h); ctx.restore();
    } else ctx.drawImage(c, x, y, w, h);
  }

  function shadow(ctx, cx, footY, w) {
    ctx.save();
    ctx.globalAlpha = 0.28;
    ctx.fillStyle = '#241633';
    ctx.beginPath();
    ctx.ellipse(cx, footY - 1, w * 0.5, w * 0.18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /* ---------------- 배경 ---------------- */
  // 결정론적 난수
  function rnd(seed) {
    let s = seed | 0;
    return () => { s = (s * 1664525 + 1013904223) | 0; return ((s >>> 8) & 0xffff) / 0xffff; };
  }

  /** 서바이벌 필드: 잔디 + 길 + 작은 장식 */
  function bgSurvival(ctx, w, h, seed) {
    const R = rnd(seed || 7);
    // 잔디
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#3f714d');
    g.addColorStop(0.55, '#376545');
    g.addColorStop(1, '#2d5539');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // 잔디 결 (2px 도트 패턴)
    for (let i = 0; i < 420; i++) {
      const x = Math.floor(R() * w), y = Math.floor(R() * h);
      ctx.fillStyle = R() > 0.5 ? '#477e58' : '#2a4b35';
      ctx.fillRect(x, y, 2, 1);
    }
    for (let i = 0; i < 90; i++) {
      const x = Math.floor(R() * w), y = Math.floor(R() * h);
      ctx.fillStyle = '#4f8a60';
      ctx.fillRect(x, y, 1, 2);
    }

    // 길
    const laneTop = 76, laneBot = 144;
    const lg = ctx.createLinearGradient(0, laneTop, 0, laneBot);
    lg.addColorStop(0, '#9a7f59');
    lg.addColorStop(0.5, '#a98c63');
    lg.addColorStop(1, '#8e7450');
    ctx.fillStyle = lg;
    ctx.fillRect(0, laneTop, w, laneBot - laneTop);
    // 자갈
    for (let i = 0; i < 130; i++) {
      const x = Math.floor(R() * w), y = laneTop + 3 + Math.floor(R() * (laneBot - laneTop - 6));
      ctx.fillStyle = R() > 0.5 ? '#b99c72' : '#7c6244';
      ctx.fillRect(x, y, 3, 2);
    }
    // 길 경계 (흙 테두리)
    ctx.fillStyle = '#6b573a';
    ctx.fillRect(0, laneTop - 3, w, 3);
    ctx.fillRect(0, laneBot, w, 3);
    ctx.fillStyle = '#55845f';
    ctx.fillRect(0, laneTop - 5, w, 2);
    ctx.fillRect(0, laneBot + 3, w, 2);

    // 울타리
    for (let x = 10; x < w - 8; x += 34) {
      fence(ctx, x, laneTop - 6, 1);
      fence(ctx, x + 16, laneBot + 4, 1);
    }

    // 덤불 / 바위
    for (let i = 0; i < 12; i++) {
      const x = 12 + Math.floor(R() * (w - 30));
      const upper = R() > 0.5;
      const y = upper ? 14 + Math.floor(R() * 34) : 164 + Math.floor(R() * 34);
      if (R() > 0.45) bush(ctx, x, y + 12);
      else rock(ctx, x, y + 10);
    }
    // 꽃
    for (let i = 0; i < 34; i++) {
      const x = 6 + Math.floor(R() * (w - 12));
      const y = R() > 0.5 ? 20 + Math.floor(R() * 40) : 162 + Math.floor(R() * 42);
      ctx.fillStyle = ['#f7a3c0', '#ffe08a', '#c7a7ff', '#9be7ff'][Math.floor(R() * 4)];
      ctx.fillRect(x, y, 2, 2);
      ctx.fillStyle = '#2f5b3c';
      ctx.fillRect(x, y + 2, 1, 2);
    }
    // 나무
    tree(ctx, 28, 44); tree(ctx, w - 70, 28); tree(ctx, 54, 196); tree(ctx, w - 40, 196);
  }

  function fence(ctx, x, y, dir) {
    ctx.fillStyle = '#7a5b3a';
    ctx.fillRect(x, y - 6, 2, 12);
    ctx.fillStyle = '#94714a';
    ctx.fillRect(x, y - 6, 1, 12);
    ctx.fillStyle = '#8a6642';
    ctx.fillRect(x - 3, y - 3, 10, 2);
  }

  function bush(ctx, x, groundY) {
    ctx.fillStyle = '#26533a';
    ctx.fillRect(x - 8, groundY - 8, 16, 8);
    ctx.fillRect(x - 5, groundY - 12, 10, 5);
    ctx.fillStyle = '#356c48';
    ctx.fillRect(x - 6, groundY - 9, 7, 4);
    ctx.fillStyle = '#43825a';
    ctx.fillRect(x - 3, groundY - 11, 4, 3);
  }

  function rock(ctx, x, groundY) {
    ctx.fillStyle = '#6a6478';
    ctx.fillRect(x - 6, groundY - 6, 12, 6);
    ctx.fillStyle = '#827c92';
    ctx.fillRect(x - 4, groundY - 8, 8, 4);
    ctx.fillStyle = '#9a94a8';
    ctx.fillRect(x - 3, groundY - 8, 4, 2);
  }

  function tree(ctx, x, groundY) {
    ctx.fillStyle = '#4a3428';
    ctx.fillRect(x - 2, groundY - 14, 4, 14);
    ctx.fillStyle = '#1f4d31';
    ctx.fillRect(x - 13, groundY - 30, 26, 17);
    ctx.fillRect(x - 9, groundY - 37, 18, 8);
    ctx.fillRect(x - 16, groundY - 24, 32, 8);
    ctx.fillStyle = '#2c6b41';
    ctx.fillRect(x - 10, groundY - 29, 20, 8);
    ctx.fillRect(x - 6, groundY - 35, 12, 6);
    ctx.fillStyle = '#3d8f52';
    ctx.fillRect(x - 7, groundY - 27, 9, 5);
    ctx.fillRect(x - 2, groundY - 33, 5, 4);
    ctx.fillStyle = '#57ac68';
    ctx.fillRect(x - 5, groundY - 28, 3, 2);
  }

  /** 협력 아레나: 돌 광장 + 중앙 링 */
  function bgCoop(ctx, w, h, seed) {
    const R = rnd(seed || 11);
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, '#3a3358');
    g.addColorStop(0.5, '#2e2948');
    g.addColorStop(1, '#262140');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // 바닥 타일
    const T = 24;
    for (let y = 0; y < h; y += T) {
      for (let x = 0; x < w; x += T) {
        const alt = ((x / T) + (y / T)) % 2 === 0;
        ctx.fillStyle = alt ? '#332e50' : '#2c2747';
        ctx.fillRect(x, y, T, T);
        ctx.fillStyle = 'rgba(255,255,255,0.025)';
        ctx.fillRect(x, y, T, 1);
      }
    }
    // 십자 통로
    ctx.fillStyle = '#4a4168';
    ctx.fillRect(w / 2 - 46, 0, 92, h);
    ctx.fillRect(0, h / 2 - 46, w, 92);
    for (let i = 0; i < 120; i++) {
      const x = Math.floor(R() * w), y = Math.floor(R() * h);
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      ctx.fillRect(x, y, 2, 2);
    }
    // 중앙 링
    ctx.strokeStyle = '#6c5f96';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(w / 2, h / 2, 58, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = 'rgba(126,240,201,0.18)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(w / 2, h / 2, 66, 0, Math.PI * 2); ctx.stroke();
    // 모서리 장식
    for (const [cx, cy] of [[18, 18], [w - 18, 18], [18, h - 18], [w - 18, h - 18]]) {
      ctx.fillStyle = '#4b4370';
      ctx.fillRect(cx - 7, cy - 7, 14, 14);
      ctx.fillStyle = '#5f5688';
      ctx.fillRect(cx - 4, cy - 4, 8, 8);
    }
  }

  function drawRange(ctx, x, y, radius, candidate = false) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = candidate ? 'rgba(255,203,100,.09)' : 'rgba(126,240,201,.065)';
    ctx.fill();
    ctx.setLineDash([5, 4]);
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = '#243838';
    ctx.stroke();
    ctx.lineWidth = 1.8;
    ctx.strokeStyle = candidate ? '#ffce72' : '#a5ffde';
    ctx.stroke();
    ctx.restore();
  }

  // Let a tap land on either the character's body or its placement marker.
  function pickBoardSlot(slots, x, y, scale, footOffset) {
    let nearest = null, distance = Infinity;
    for (const slot of slots) {
      const dx = x - slot.x, dy = y - slot.y;
      const marker = Math.hypot(dx, dy);
      let score = marker <= 20 ? marker : Infinity;
      if (slot.unit && Math.abs(dx) <= 7 * scale && dy <= footOffset && dy >= footOffset - 15 * scale) {
        score = Math.min(score, Math.hypot(dx, dy - footOffset + 7 * scale));
      }
      if (score < distance) { nearest = slot; distance = score; }
    }
    return nearest;
  }

  function drawStance(ctx,x,foot,scale,stance){
    if(!stance)return;
    ctx.save();
    ctx.lineWidth=2;
    ctx.strokeStyle=stance==='shield'?'#a8e6ff':'#ffad64';
    ctx.beginPath();
    ctx.ellipse(x,foot-8*scale,9*scale,9*scale,0,0,2*Math.PI);
    if(stance==='shield'){ctx.fillStyle='rgba(101,198,255,.17)';ctx.fill();}
    else ctx.setLineDash([4,3]);
    ctx.stroke();
    ctx.restore();
  }
  function drawChargeCue(ctx,x,foot,scale,stage) {
    if (!stage) return;
    ctx.save();
    ctx.fillStyle=stage==='warn'?'#ffe481':'#ff9474';
    const top=foot-16*scale-9;
    if(stage==='warn'){
      ctx.fillRect(x-1,top-3,3,6);
      ctx.fillRect(x-1,top+5,3,2);
    }else{
      for(const offset of [-1,1])ctx.fillRect(x+offset*scale*7-3,foot-scale*4,7,2);
    }
    ctx.restore();
  }
  function tradeRoad(ctx,w,h,coop) {
    const random=rnd(coop?29:19);
    const paths=coop?GATE_PATHS:FORK_PATHS;
    const rect=(x,y,width,height,color)=>{ctx.fillStyle=color;ctx.fillRect(x,y,width,height);};
    const grad=ctx.createLinearGradient(0,0,w,h);
    grad.addColorStop(0,coop?'#343955':'#25483f');grad.addColorStop(.6,coop?'#47516e':'#527553');grad.addColorStop(1,coop?'#292e46':'#344f45');
    ctx.fillStyle=grad;ctx.fillRect(0,0,w,h);
    for(let i=0;i<w*h/125;i++){
      const x=Math.floor(random()*w),y=Math.floor(random()*h);
      rect(x,y,3+Math.floor(random()*5),2,random()>.5?'#ffffff12':'#17243430');
    }
    for(let i=0;i<(coop?33:22);i++){
      const x=Math.floor(random()*w),y=i%2?4+random()*20:h-13+random()*20;
      if(coop)rock(ctx,x,y);else if(i%4)tree(ctx,x,y);else bush(ctx,x,y);
    }
    ctx.save();ctx.lineJoin='round';ctx.lineCap='butt';
    for(const [width,color] of [[27,coop?'#25293f':'#243e36'],[23,coop?'#68758b':'#8b765c'],[18,coop?'#536079':'#bf9c70']]){
      ctx.strokeStyle=color;ctx.lineWidth=width;
      for(const points of paths){
        ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.stroke();
      }
    }
    for(const points of paths)for(let i=1;i<points.length;i++){
      const [x,y]=points[i-1], dx=points[i][0]-x,dy=points[i][1]-y,len=Math.hypot(dx,dy);
      for(let d=7;d<len;d+=8){
        const shift=(random()-.5)*13;
        rect(Math.round(x+(dx*d-dy*shift)/len),Math.round(y+(dy*d+dx*shift)/len),3,1,coop?'#929caf':'#dfbd89');
      }
    }
    ctx.restore();
    const gates=coop?paths.map(p=>p[0]):[[10,110],[415,110]];
    gates.forEach(([x,y],i)=>{
      rect(x-4,y-13,3,11,'#372e39');rect(x-7,y-17,9,5,'#483a46');rect(x-5,y-18,5,4,'#ffd88a');
      rect(x+3,y+9,3,10,'#372e39');rect(x+3,y+9,8,4,coop?['#7ef0c9','#ff8fa3','#ffd166','#8bd3ff'][i]:'#84ddbd');
    });
    if(!coop){
      for(const [x,y] of [[93,34],[106,29],[294,198],[306,201],[409,41],[420,44]])fence(ctx,x,y,1);
      bush(ctx,195,115);rock(ctx,148,115);
    }
  }
  function outpost(ctx,s,color,active){
    const x=s.x,y=s.y;
    ctx.fillStyle='#263036';ctx.fillRect(x-14,y-5,29,14);
    ctx.fillStyle='#787365';ctx.fillRect(x-14,y-7,27,12);
    ctx.fillStyle='#a49c80';ctx.fillRect(x-12,y-8,23,2);
    ctx.fillStyle=active?'#bcffe0':color;ctx.fillRect(x-12,y+3,23,2);
    if(!s.unit){ctx.fillStyle=active?'#e5ffeb':'#d6cdae';ctx.fillRect(x-4,y-3,8,2);ctx.fillRect(x-1,y-6,2,8);}
  }

function drawBase(ctx, lives, maxLives, time, flash=0) {
  const bx = 446, by = 110;   // 성 중심

  ctx.save();
  // 땅 그림자
  ctx.fillStyle = 'rgba(20,12,30,.22)';
  ctx.beginPath(); ctx.ellipse(bx - 2, 146, 30, 8, 0, 0, 6.28); ctx.fill();

  // 본체
  ctx.fillStyle = '#6d6690';
  ctx.fillRect(bx - 22, by - 26, 44, 62);
  ctx.fillStyle = '#928bb6';
  ctx.fillRect(bx - 20, by - 24, 40, 56);
  // 벽돌 결
  ctx.fillStyle = 'rgba(60,50,90,.35)';
  for (let y = by - 22; y < by + 30; y += 7) {
    ctx.fillRect(bx - 20, y, 40, 1);
    ctx.fillRect(bx - 20 + ((y / 7) % 2 ? 6 : 18), y + 1, 1, 6);
  }
  // 성가퀴(총안)
  ctx.fillStyle = '#5b5480';
  for (let i = 0; i < 4; i++) ctx.fillRect(bx - 22 + i * 12, by - 36, 8, 11);
  ctx.fillStyle = '#a8a2cc';
  for (let i = 0; i < 4; i++) ctx.fillRect(bx - 22 + i * 12, by - 36, 8, 3);
  // 지붕
  ctx.fillStyle = '#4b3560';
  ctx.fillRect(bx - 25, by - 40, 50, 5);
  // 문
  ctx.fillStyle = '#332a4a';
  ctx.fillRect(bx - 9, by + 8, 18, 28);
  ctx.fillStyle = '#5b4a76';
  ctx.fillRect(bx - 7, by + 10, 14, 26);
  ctx.fillStyle = '#8a76a8';
  ctx.fillRect(bx - 7, by + 10, 14, 2);
  // 문 손잡이
  ctx.fillStyle = '#ffd166';
  ctx.fillRect(bx + 3, by + 24, 2, 2);
  // 창문
  ctx.fillStyle = '#2b2340';
  ctx.fillRect(bx - 17, by - 16, 9, 11);
  ctx.fillRect(bx + 8, by - 16, 9, 11);
  ctx.fillStyle = flash > 0 ? '#ff8f8f' : '#ffd166';
  ctx.fillRect(bx - 16, by - 15, 7, 8);
  ctx.fillRect(bx + 9, by - 15, 7, 8);
  ctx.fillStyle = 'rgba(255,255,255,.5)';
  ctx.fillRect(bx - 16, by - 15, 7, 2);
  ctx.fillRect(bx + 9, by - 15, 7, 2);
  // 깃대 + 깃발 (라이프 색)
  ctx.fillStyle = '#4a3f60';
  ctx.fillRect(bx + 14, by - 62, 2, 30);
  const flag = lives > maxLives * 0.35 ? '#7ef0c9' : '#ff6b6b';
  const wave = Math.sin(time * 4) * 2;
  ctx.fillStyle = flag;
  ctx.beginPath();
  ctx.moveTo(bx + 16, by - 62);
  ctx.lineTo(bx + 16 + 16 + wave, by - 56);
  ctx.lineTo(bx + 16, by - 49);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.35)';
  ctx.fillRect(bx + 18, by - 60, 6, 3);
  // 피격 플래시
  if (flash > 0) {
    ctx.globalAlpha = flash * 1.4;
    ctx.fillStyle = '#ff6b6b';
    ctx.fillRect(bx - 22, by - 36, 44, 72);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

function drawCore(ctx, hp, maxHp, t, flash=0) {
  ctx.save();
  // 소켓
  ctx.fillStyle = '#3a3358';
  ctx.beginPath(); ctx.arc(CORE.x, CORE.y + 2, CORE.r + 8, 0, 6.28); ctx.fill();
  ctx.strokeStyle = '#6c5f96'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(CORE.x, CORE.y + 2, CORE.r + 8, 0, 6.28); ctx.stroke();
  // 크리스탈
  const pulse = 1 + Math.sin(t * 2.4) * 0.03;
  ctx.save();
  ctx.translate(CORE.x, CORE.y);
  ctx.scale(pulse, pulse);
  const grad = ctx.createLinearGradient(0, -24, 0, 24);
  grad.addColorStop(0, '#b9ffe9');
  grad.addColorStop(0.5, '#7ef0c9');
  grad.addColorStop(1, '#2fa88a');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(0, -26); ctx.lineTo(17, -4); ctx.lineTo(0, 26); ctx.lineTo(-17, -4);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#0f3a30'; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.55)';
  ctx.beginPath(); ctx.moveTo(-5, -18); ctx.lineTo(1, -16); ctx.lineTo(-6, 4); ctx.lineTo(-9, -2); ctx.closePath(); ctx.fill();
  ctx.restore();
  // 체력 아크
  const pct = Math.min(1,Math.max(0,hp/maxHp));
  ctx.strokeStyle = '#241b34'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(CORE.x, CORE.y + 2, CORE.r + 14, -Math.PI / 2, Math.PI * 1.5); ctx.stroke();
  ctx.strokeStyle = pct > 0.3 ? '#7ef0c9' : '#ff6b6b';
  ctx.beginPath(); ctx.arc(CORE.x, CORE.y + 2, CORE.r + 14, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pct); ctx.stroke();
  if (flash > 0) {
    ctx.globalAlpha = flash;
    ctx.fillStyle = '#ff6b6b';
    ctx.beginPath(); ctx.arc(CORE.x, CORE.y + 2, CORE.r + 10, 0, 6.28); ctx.fill();
    ctx.globalAlpha = 1;
  }
  // 코어 위 이름
  ctx.font = 'bold 9px ui-monospace, monospace';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(8,5,14,.6)';
  ctx.fillRect(CORE.x - 30, CORE.y + CORE.r + 22, 60, 12);
  ctx.fillStyle = '#ffd166';
  ctx.fillText('SHARED CORE', CORE.x, CORE.y + CORE.r + 31);
  ctx.textAlign = 'left';
  ctx.restore();

}

  return { drawBase, drawCore, tradeRoad, outpost, init, sprite, draw, drawTint, drawStance, drawChargeCue, drawRange, pickBoardSlot, shadow, bgSurvival, bgCoop, DEFS, S };
})();
