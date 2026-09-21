// Séquenceur simple : kick / caisse claire / charley / basse / arpège. Aucun fichier audio.
const NOTE = n => 440 * Math.pow(2, (n - 69) / 12);

const THEMES = {
  docks:  { bpm: 118, bass: [40, 40, 43, 40, 45, 43, 40, 38], arp: [52, 55, 59, 55, 52, 59, 62, 59], lead: [64, 67, 71, 67], wave: 'sawtooth' },
  street: { bpm: 128, bass: [38, 38, 41, 38, 45, 41, 38, 36], arp: [50, 53, 57, 60, 57, 53, 50, 53], lead: [62, 65, 69, 72], wave: 'square' },
  hangar: { bpm: 110, bass: [36, 36, 36, 43, 36, 36, 39, 41], arp: [48, 51, 55, 58, 55, 51, 48, 51], lead: [60, 63, 67, 70], wave: 'sawtooth' },
  boss:   { bpm: 140, bass: [36, 36, 42, 36, 36, 42, 39, 41], arp: [48, 54, 51, 54, 48, 55, 51, 54], lead: [60, 66, 63, 66], wave: 'square' },
  title:  { bpm: 96,  bass: [40, 43, 45, 47], arp: [52, 59, 64, 59, 55, 59, 64, 67], lead: [], wave: 'triangle' },
};

export class Music {
  constructor(audio) { this.audio = audio; this.theme = null; this.intense = false; this.step = 0; this.next = 0; this.timer = null; this.gain = null; this.enabled = true; }

  start(name) {
    const a = this.audio; if (!a.ctx) a.init(); if (!a.ctx) return;
    if (!this.gain) { this.gain = a.ctx.createGain(); this.gain.gain.value = 0.28; this.gain.connect(a.master); }
    const same = this.theme === THEMES[name];
    this.theme = THEMES[name] || THEMES.docks;
    if (same && this.timer) return;
    this.stop(false);
    this.step = 0; this.next = a.ctx.currentTime + 0.05;
    this.timer = setInterval(() => this.schedule(), 60);
  }
  stop(fade = true) {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    if (fade && this.gain) { const t = this.audio.ctx.currentTime; this.gain.gain.setTargetAtTime(0, t, 0.4); setTimeout(() => { if (this.gain) this.gain.gain.setTargetAtTime(0.28, this.audio.ctx.currentTime, 0.01); }, 900); }
  }
  setIntense(on) { this.intense = on; }
  setEnabled(on) { this.enabled = on; if (this.gain) this.gain.gain.setTargetAtTime(on ? 0.28 : 0, this.audio.ctx.currentTime, 0.05); }

  schedule() {
    const a = this.audio, ctx = a.ctx; if (!ctx || !this.theme) return;
    const spb = 60 / this.theme.bpm / 2;   // durée d'une croche
    while (this.next < ctx.currentTime + 0.2) { this.playStep(this.step, this.next, spb); this.step++; this.next += spb; }
  }
  playStep(i, t, spb) {
    const T = this.theme, ctx = this.audio.ctx, g = this.gain;
    const beat = i % 2 === 0, bar16 = i % 16;
    // Kick
    if (beat && (i % 4 === 0 || (this.intense && i % 8 === 6))) this.osc('sine', 120, 40, t, 0.18, 0.9, g);
    // Caisse claire
    if (i % 8 === 4) this.noise(t, 0.12, 1800, 0.5, g);
    // Charley
    this.noise(t, this.intense ? 0.04 : 0.03, 7000, (i % 2 ? 0.12 : 0.2), g, 'highpass');
    // Basse
    const b = T.bass[(i >> 1) % T.bass.length];
    if (beat) this.osc(T.wave, NOTE(b), NOTE(b), t, spb * 1.8, 0.35, g, 500);
    // Arpège
    const ar = T.arp[i % T.arp.length];
    this.osc('triangle', NOTE(ar), NOTE(ar), t, spb * 0.9, this.intense ? 0.22 : 0.14, g, 2500);
    // Lead en mode intense
    if (this.intense && T.lead.length && bar16 % 4 === 0) { const l = T.lead[(i >> 2) % T.lead.length]; this.osc('square', NOTE(l), NOTE(l), t, spb * 3, 0.12, g, 1800); }
  }
  osc(type, f0, f1, t, dur, vol, out, cutoff = 20000) {
    const ctx = this.audio.ctx, o = ctx.createOscillator(), e = ctx.createGain(), f = ctx.createBiquadFilter();
    o.type = type; o.frequency.setValueAtTime(f0, t); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    f.type = 'lowpass'; f.frequency.value = cutoff;
    e.gain.setValueAtTime(0.0001, t); e.gain.exponentialRampToValueAtTime(vol, t + 0.01); e.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f); f.connect(e); e.connect(out); o.start(t); o.stop(t + dur + 0.02);
  }
  noise(t, dur, freq, vol, out, type = 'bandpass') {
    const ctx = this.audio.ctx, s = ctx.createBufferSource(); s.buffer = this.audio.noise;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = 0.8;
    const e = ctx.createGain(); e.gain.setValueAtTime(vol, t); e.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(e); e.connect(out); s.start(t); s.stop(t + dur + 0.02);
  }
}
