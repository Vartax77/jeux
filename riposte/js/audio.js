// Sons synthétisés (aucun fichier). pan ∈ [-1, 1] = position horizontale à l'écran de la source.
export class Audio {
  constructor() { this.ctx = null; this.master = null; this.noise = null; this.enabled = true; this.samples = {}; }
  // Charge un échantillon optionnel (assets/sfx/<nom>.mp3) ; absent → on garde la synthèse
  async loadSample(name, url) {
    try { const r = await fetch(url); if (!r.ok) return; const buf = await r.arrayBuffer(); if (!this.ctx) this.init(); if (!this.ctx) return; this.samples[name] = await this.ctx.decodeAudioData(buf); } catch (_) {}
  }
  playSample(name, pan = 0, gain = 1, rate = 1) {
    const b = this.samples[name]; if (!b || !this.ok()) return false;
    const src = this.ctx.createBufferSource(); src.buffer = b; src.playbackRate.value = rate; src.connect(this._out(pan, gain)); src.start(); return true;
  }

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain(); this.master.gain.value = 0.5; this.master.connect(this.ctx.destination);
    const len = this.ctx.sampleRate * 2, buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noise = buf;
  }
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }
  get t() { return this.ctx.currentTime; }

  _out(pan = 0, gain = 1) {
    const g = this.ctx.createGain(); g.gain.value = gain;
    if (this.ctx.createStereoPanner) { const p = this.ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); g.connect(p); p.connect(this.master); }
    else g.connect(this.master);
    return g;
  }
  _noiseBurst({ pan = 0, gain = 0.6, dur = 0.15, freq = 1200, q = 1, type = 'lowpass', decay = 0.08 }) {
    const src = this.ctx.createBufferSource(); src.buffer = this.noise;
    const f = this.ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const env = this.ctx.createGain(); env.gain.setValueAtTime(gain, this.t); env.gain.exponentialRampToValueAtTime(0.001, this.t + Math.max(dur, decay));
    src.connect(f); f.connect(env); env.connect(this._out(pan));
    src.start(); src.stop(this.t + dur + 0.05);
  }
  _tone({ pan = 0, gain = 0.3, freq = 440, to = null, dur = 0.2, type = 'sine' }) {
    const o = this.ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, this.t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, this.t + dur);
    const env = this.ctx.createGain(); env.gain.setValueAtTime(gain, this.t); env.gain.exponentialRampToValueAtTime(0.001, this.t + dur);
    o.connect(env); env.connect(this._out(pan)); o.start(); o.stop(this.t + dur + 0.02);
  }

  ok() { return this.enabled && this.ctx && this.ctx.state === 'running'; }
  // Tir du joueur : claquement + corps grave
  // Tir 9 mm : claquement très bref et brillant, corps sec dans les médiums, coup de poing grave court, queue de réverbération courte
  shot(pan = 0) {
    if (!this.ok()) return;
    if (this.playSample('shot', pan, 0.9, 0.97 + Math.random() * 0.06)) return;   // fichier fourni : léger décalage de hauteur pour ne pas sonner « copié-collé »
    this._noiseBurst({ pan, gain: 1.0, dur: 0.02, freq: 6500, q: 0.7, type: 'highpass', decay: 0.012 });   // transitoire
    this._noiseBurst({ pan, gain: 0.8, dur: 0.06, freq: 1800, q: 1.2, type: 'bandpass', decay: 0.045 });   // crack
    this._tone({ pan, gain: 0.55, freq: 240, to: 55, dur: 0.07, type: 'sine' });                             // punch
    this._noiseBurst({ pan, gain: 0.35, dur: 0.28, freq: 700, q: 0.8, type: 'lowpass', decay: 0.22 });      // queue
    this._tone({ pan, gain: 0.12, freq: 2400, to: 900, dur: 0.05, type: 'triangle' });                        // métal de culasse
  }
  empty()            { if (!this.ok()) return; this._tone({ gain: 0.25, freq: 900, to: 700, dur: 0.05, type: 'square' }); }
  reload()           { if (!this.ok()) return; this._noiseBurst({ gain: 0.35, dur: 0.06, freq: 2500, type: 'highpass' }); setTimeout(() => this.ok() && this._tone({ gain: 0.3, freq: 520, to: 780, dur: 0.08, type: 'triangle' }), 90); }
  enemyShot(pan)     { if (!this.ok()) return; this._noiseBurst({ pan, gain: 0.5, dur: 0.18, freq: 1400, decay: 0.1 }); this._tone({ pan, gain: 0.25, freq: 120, to: 40, dur: 0.2, type: 'sawtooth' }); }
  lock(pan)          { if (!this.ok()) return; this._tone({ pan, gain: 0.18, freq: 1800, dur: 0.06, type: 'sine' }); }
  hitFlesh(pan)      { if (!this.ok()) return; this._noiseBurst({ pan, gain: 0.5, dur: 0.12, freq: 500, decay: 0.1 }); this._tone({ pan, gain: 0.3, freq: 200, to: 90, dur: 0.12 }); }
  headshot(pan)      { if (!this.ok()) return; this.hitFlesh(pan); this._tone({ pan, gain: 0.35, freq: 880, to: 1760, dur: 0.18, type: 'triangle' }); }
  ricochet(pan)      { if (!this.ok()) return; this._tone({ pan, gain: 0.25, freq: 2400 + Math.random() * 1500, to: 300, dur: 0.25, type: 'sine' }); this._noiseBurst({ pan, gain: 0.3, dur: 0.05, freq: 5000, type: 'highpass' }); }
  bulletPop(pan)     { if (!this.ok()) return; this._noiseBurst({ pan, gain: 0.6, dur: 0.08, freq: 2000, q: 3, type: 'bandpass' }); }
  whoosh(pan)        { if (!this.ok()) return; this._noiseBurst({ pan, gain: 0.45, dur: 0.3, freq: 900, q: 2, type: 'bandpass', decay: 0.25 }); }
  playerHit()        { if (!this.ok()) return; this._noiseBurst({ gain: 0.9, dur: 0.4, freq: 300, decay: 0.35 }); this._tone({ gain: 0.5, freq: 110, to: 35, dur: 0.5, type: 'sawtooth' }); }
  tick(urgent)       { if (!this.ok()) return; this._tone({ gain: urgent ? 0.3 : 0.15, freq: urgent ? 1200 : 800, dur: 0.05, type: 'square' }); }
  timeUp()           { if (!this.ok()) return; for (let i = 0; i < 3; i++) setTimeout(() => this.ok() && this._tone({ gain: 0.4, freq: 300, to: 150, dur: 0.25, type: 'square' }), i * 280); }
  bonus()            { if (!this.ok()) return; [660, 880, 1320].forEach((f, i) => setTimeout(() => this.ok() && this._tone({ gain: 0.3, freq: f, dur: 0.15, type: 'triangle' }), i * 90)); }
  action()           { if (!this.ok()) return; [440, 660].forEach((f, i) => setTimeout(() => this.ok() && this._tone({ gain: 0.35, freq: f, dur: 0.2, type: 'square' }), i * 120)); }
  wait()             { if (!this.ok()) return; this._tone({ gain: 0.3, freq: 660, to: 440, dur: 0.35, type: 'triangle' }); }
  clear()            { if (!this.ok()) return; [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.ok() && this._tone({ gain: 0.35, freq: f, dur: 0.35, type: 'triangle' }), i * 140)); }
  gameOver()         { if (!this.ok()) return; [440, 415, 392, 330].forEach((f, i) => setTimeout(() => this.ok() && this._tone({ gain: 0.35, freq: f, dur: 0.5, type: 'sawtooth' }), i * 300)); }
}
