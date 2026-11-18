// LAST DAWN — audio.js
// Fully procedural sound via WebAudio: no audio files, nothing loaded over
// the network, every effect synthesised from oscillators and noise.
export function createAudio() {
  let ctx = null;
  let master = null;
  let muted = false;

  function ensure() {
    if (ctx) return;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
    } catch (e) { ctx = null; }
  }

  function tone(freq, dur, type = 'square', vol = 0.2, slideTo = null, when = 0) {
    if (!ctx || muted) return;
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  function noise(dur, vol = 0.2, when = 0, lowpass = 900) {
    if (!ctx || muted) return;
    const t = ctx.currentTime + when;
    const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lowpass;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(master);
    src.start(t);
  }

  const S = {
    unlock() { ensure(); if (ctx && ctx.state === 'suspended') ctx.resume(); },
    setMuted(m) { muted = m; },
    toggleMuted() { muted = !muted; return muted; },
    slash()   { noise(0.12, 0.25, 0, 2200); tone(220, 0.1, 'sawtooth', 0.12, 80); },
    harvest() { tone(160, 0.08, 'triangle', 0.2, 240); },
    place()   { noise(0.1, 0.3, 0, 500); tone(120, 0.14, 'square', 0.2, 90); },
    towerShoot() { tone(880, 0.08, 'square', 0.1, 320); },
    hit()     { tone(300, 0.07, 'square', 0.2, 120); noise(0.06, 0.15, 0, 1800); },
    enemyDie(){ noise(0.2, 0.25, 0, 600); tone(180, 0.25, 'sawtooth', 0.15, 40); },
    emberHit(){ tone(90, 0.3, 'sawtooth', 0.3, 45); },
    night()   { tone(196, 0.5, 'sine', 0.2, 98); tone(98, 0.7, 'sine', 0.15, 49, 0.4); },
    dawn()    { tone(523, 0.4, 'triangle', 0.18, 784); tone(659, 0.4, 'triangle', 0.15, 988, 0.15); },
    victory() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.45, 'triangle', 0.22, null, i * 0.16)); },
    defeat()  { [392, 311, 233, 155].forEach((f, i) => tone(f, 0.55, 'sawtooth', 0.2, f * 0.8, i * 0.2)); },
    select()  { tone(600, 0.05, 'square', 0.1); },
    waveClear(){ tone(784, 0.3, 'triangle', 0.18, 1175); },
  };
  return S;
}