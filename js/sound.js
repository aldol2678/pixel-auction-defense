'use strict';
const SFX = (() => {
  let ac = null, muted = false, lastHit = 0, master = null;
  function init() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ac = new AC();
      master = ac.createGain();
      master.gain.value = 0.5;
      master.connect(ac.destination);
    } catch (e) { ac = null; }
  }
  function tone(freq, dur, type = 'square', vol = 0.12, delay = 0, slide = null) {
    if (!ac || muted) return;
    const t0 = ac.currentTime + delay;
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, slide), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(master);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }
  function noise(dur = 0.08, vol = 0.16, hp = 800) {
    if (!ac || muted) return;
    const n = Math.floor(ac.sampleRate * dur);
    const buf = ac.createBuffer(1, n, ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = ac.createBufferSource(); src.buffer = buf;
    const f = ac.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp;
    const g = ac.createGain(); g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(master); src.start();
  }
  return {
    init,
    get muted() { return muted; },
    setMuted(v) { muted = !!v; },
    bid(n) { tone(420 + Math.min(600, n * 22), 0.05, 'square', 0.09); },
    confirm() { tone(520, 0.07, 'square', 0.12); tone(780, 0.09, 'square', 0.1, 0.06); },
    flip(i) { tone(300 + i * 90, 0.05, 'square', 0.1); },
    sold() { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.14, 'square', 0.12, i * 0.07)); },
    unsold() { tone(300, 0.16, 'sawtooth', 0.1); tone(200, 0.28, 'sawtooth', 0.1, 0.12, 90); },
    hit() {
      const now = performance.now();
      if (now - lastHit < 70) return;
      lastHit = now;
      noise(0.05, 0.07, 1400);
    },
    leak() { tone(180, 0.16, 'sawtooth', 0.14, 0, 70); noise(0.14, 0.12, 200); },
    clear() { [392, 523, 659].forEach((f, i) => tone(f, 0.16, 'triangle', 0.1, i * 0.09)); },
    upgrade() { [660, 880, 1180].forEach((f, i) => tone(f, 0.1, 'square', 0.09, i * 0.05)); },
    error() { tone(160, 0.12, 'square', 0.1); },
    spawn() { tone(240, 0.05, 'triangle', 0.05, 0, 180); },
  };
})();

