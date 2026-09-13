// Audio (cahier des charges §4.9) : Web Audio, débloqué au premier geste. Chaque son a une version synthétisée ;
// si un fichier sons/<nom>.(ogg|mp3|wav) existe, il est utilisé à la place. Volumes séparés effets / foule / musique.

export const NOMS_SONS = Object.freeze([
  'roulement', 'impact-faible', 'impact-moyen', 'impact-fort', 'gouttiere', 'rebond', 'pinsetter',
  'foule-acclamation', 'foule-ovation', 'foule-oh', 'foule-rire', 'clic',
  'jingle-strike', 'jingle-spare', 'jingle-turkey', 'jingle-parfait', 'musique',
]);

const GROUPE = (nom) => (nom.startsWith('foule') ? 'foule' : nom === 'musique' ? 'musique' : 'effets');

export class AudioJeu {
  constructor(lire, base = 'sons/') {
    this.lire = (id, defaut) => { const v = lire ? lire(id) : undefined; return v === undefined || v === null ? defaut : v; };
    this.base = base;
    this.ctx = null;
    this.gains = {};
    this.fichiers = new Map();   // nom → AudioBuffer
    this.roulement = null;
    this.musique = null;
    this.disponible = typeof window !== 'undefined' && !!(window.AudioContext || window.webkitAudioContext);
    this.debloque = false;
  }

  // À appeler dans un gestionnaire de clic/touche.
  debloquer() {
    if (this.debloque || !this.disponible) return this.debloque;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      for (const g of ['effets', 'foule', 'musique']) { const n = this.ctx.createGain(); n.connect(this.ctx.destination); this.gains[g] = n; }
      this.majVolumes();
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      this.debloque = true;
      this._chargerFichiers();
      this.majMusique();
    } catch (e) {
      this.disponible = false;
    }
    return this.debloque;
  }

  majVolumes() {
    if (!this.ctx) return;
    this.gains.effets.gain.value = (this.lire('volumeEffets', 70) / 100) ** 2;
    this.gains.foule.gain.value = (this.lire('volumeFoule', 60) / 100) ** 2;
    this.gains.musique.gain.value = (this.lire('volumeMusique', 25) / 100) ** 2;
  }

  async _chargerFichiers() {
    for (const nom of NOMS_SONS) {
      for (const ext of ['ogg', 'mp3', 'wav']) {
        try {
          const r = await fetch(this.base + nom + '.' + ext, { method: 'GET' });
          if (!r.ok) continue;
          const buf = await this.ctx.decodeAudioData(await r.arrayBuffer());
          this.fichiers.set(nom, buf);
          if (nom === 'musique') this.majMusique();
          break;
        } catch (e) { /* fichier absent ou illisible : version synthétisée */ }
      }
    }
  }

  // ---------- Lecture ----------

  jouer(nom, options = {}) {
    if (!this.ctx) return;
    const dest = this.gains[GROUPE(nom)];
    const buf = this.fichiers.get(nom);
    if (buf) {
      const s = this.ctx.createBufferSource();
      s.buffer = buf;
      const g = this.ctx.createGain();
      g.gain.value = options.gain ?? 1;
      s.playbackRate.value = options.vitesse ?? 1;
      s.connect(g).connect(dest);
      s.start();
      return;
    }
    const synth = this['_s_' + nom.replace(/-/g, '_')];
    if (synth) synth.call(this, dest, options);
  }

  // ---------- Synthèse ----------

  _bruit(duree) {
    const n = Math.floor(this.ctx.sampleRate * duree);
    const b = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }

  _enveloppe(g, t0, attaque, tenue, relache, niveau = 1) {
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.001, niveau), t0 + attaque);
    g.gain.setValueAtTime(Math.max(0.001, niveau), t0 + attaque + tenue);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + attaque + tenue + relache);
  }

  _ton(dest, freq, t0, duree, { type = 'triangle', niveau = 0.3, glisse = 0 } = {}) {
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (glisse) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * glisse), t0 + duree);
    const g = this.ctx.createGain();
    this._enveloppe(g, t0, 0.01, duree * 0.4, duree * 0.6, niveau);
    o.connect(g).connect(dest);
    o.start(t0); o.stop(t0 + duree + 0.05);
  }

  _souffle(dest, t0, duree, { niveau = 0.5, freq = 800, q = 1, type = 'bandpass', glisse = 0 } = {}) {
    const s = this.ctx.createBufferSource();
    s.buffer = this._bruit(duree + 0.1);
    const f = this.ctx.createBiquadFilter();
    f.type = type; f.frequency.setValueAtTime(freq, t0); f.Q.value = q;
    if (glisse) f.frequency.exponentialRampToValueAtTime(Math.max(40, freq * glisse), t0 + duree);
    const g = this.ctx.createGain();
    this._enveloppe(g, t0, 0.005, duree * 0.3, duree * 0.7, niveau);
    s.connect(f).connect(g).connect(dest);
    s.start(t0); s.stop(t0 + duree + 0.1);
  }

  _s_impact_faible(dest, o = {}) { this._impact(dest, 0.35 * (o.gain ?? 1), 1); }
  _s_impact_moyen(dest, o = {}) { this._impact(dest, 0.6 * (o.gain ?? 1), 3); }
  _s_impact_fort(dest, o = {}) { this._impact(dest, 0.9 * (o.gain ?? 1), 6); }
  _impact(dest, niveau, nb) {
    const t0 = this.ctx.currentTime;
    for (let i = 0; i < nb; i++) {
      const t = t0 + i * (0.03 + Math.random() * 0.05);
      this._souffle(dest, t, 0.12, { niveau: niveau * (0.7 + Math.random() * 0.5), freq: 1800 + Math.random() * 1500, q: 0.8, glisse: 0.35 });
      this._ton(dest, 900 + Math.random() * 700, t, 0.08, { type: 'square', niveau: niveau * 0.12, glisse: 0.5 });
    }
    this._ton(dest, 120, t0, 0.18, { type: 'sine', niveau: niveau * 0.6, glisse: 0.5 });
  }

  _s_gouttiere(dest) {
    const t0 = this.ctx.currentTime;
    this._ton(dest, 90, t0, 0.35, { type: 'sine', niveau: 0.6, glisse: 0.5 });
    this._souffle(dest, t0 + 0.05, 0.6, { niveau: 0.25, freq: 300, q: 0.7, type: 'lowpass' });
  }

  _s_rebond(dest) {
    const t0 = this.ctx.currentTime;
    this._ton(dest, 160, t0, 0.15, { type: 'sine', niveau: 0.6, glisse: 0.6 });
    this._souffle(dest, t0, 0.08, { niveau: 0.3, freq: 1200, q: 1, glisse: 0.4 });
  }

  _s_pinsetter(dest) {
    const t0 = this.ctx.currentTime;
    this._souffle(dest, t0, 1.6, { niveau: 0.18, freq: 220, q: 2, type: 'bandpass' });
    for (let i = 0; i < 4; i++) this._ton(dest, 70 + i * 10, t0 + 0.3 + i * 0.35, 0.12, { type: 'square', niveau: 0.15, glisse: 0.7 });
  }

  _s_clic(dest) { this._ton(dest, 1200, this.ctx.currentTime, 0.05, { type: 'square', niveau: 0.12, glisse: 0.6 }); }

  // Foule : bruit large bande modulé, niveau selon le type
  _foule(dest, duree, niveau, freq, glisse = 1) {
    const t0 = this.ctx.currentTime;
    this._souffle(dest, t0, duree, { niveau, freq, q: 0.6, type: 'bandpass', glisse });
    for (let i = 0; i < 6; i++) this._ton(dest, 200 + Math.random() * 500, t0 + Math.random() * duree * 0.5, 0.25 + Math.random() * 0.3, { type: 'sawtooth', niveau: niveau * 0.05 });
  }
  _s_foule_acclamation(dest, o = {}) { this._foule(dest, 1.2, 0.35 * (o.gain ?? 1), 1500); }
  _s_foule_ovation(dest) { this._foule(dest, 2.4, 0.6, 1800, 1.4); }
  _s_foule_oh(dest) { const t0 = this.ctx.currentTime; this._foule(dest, 0.9, 0.3, 700, 0.6); this._ton(dest, 330, t0, 0.7, { type: 'sine', niveau: 0.12, glisse: 0.75 }); }
  _s_foule_rire(dest) {
    const t0 = this.ctx.currentTime;
    for (let i = 0; i < 8; i++) this._ton(dest, 380 + Math.random() * 120, t0 + i * 0.11, 0.09, { type: 'sawtooth', niveau: 0.08 });
    this._foule(dest, 1.1, 0.2, 1200);
  }

  _jingle(dest, notes, pas = 0.12, type = 'triangle') {
    const t0 = this.ctx.currentTime;
    notes.forEach((n, i) => { if (n) this._ton(dest, 440 * 2 ** ((n - 69) / 12), t0 + i * pas, pas * 1.8, { type, niveau: 0.28 }); });
  }
  _s_jingle_strike(dest) { this._jingle(dest, [72, 76, 79, 84, 0, 84, 88], 0.11); }
  _s_jingle_spare(dest) { this._jingle(dest, [72, 76, 79, 83], 0.13); }
  _s_jingle_turkey(dest) { this._jingle(dest, [72, 72, 79, 79, 84, 84, 88, 91], 0.1, 'square'); }
  _s_jingle_parfait(dest) { this._jingle(dest, [60, 64, 67, 72, 76, 79, 84, 88, 91, 96], 0.09); }

  // ---------- Roulement (continu) ----------

  demarrerRoulement() {
    if (!this.ctx || this.roulement) return;
    const buf = this.fichiers.get('roulement');
    const g = this.ctx.createGain();
    g.gain.value = 0.0001;
    let source;
    if (buf) { source = this.ctx.createBufferSource(); source.buffer = buf; source.loop = true; source.connect(g); }
    else {
      source = this.ctx.createBufferSource();
      source.buffer = this._bruit(2);
      source.loop = true;
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = 180; f.Q.value = 0.9;
      source.connect(f).connect(g);
      this.roulementFiltre = f;
    }
    g.connect(this.gains.effets);
    source.start();
    this.roulement = { source, g };
  }

  // vitesse en m/s ; 0 = silence
  majRoulement(vitesse, surPiste = true) {
    if (!this.roulement) return;
    const cible = surPiste && vitesse > 0.1 ? Math.min(0.8, 0.12 + vitesse * 0.08) : 0.0001;
    this.roulement.g.gain.setTargetAtTime(cible, this.ctx.currentTime, 0.08);
    if (this.roulementFiltre) this.roulementFiltre.frequency.setTargetAtTime(120 + vitesse * 25, this.ctx.currentTime, 0.1);
    if (this.fichiers.get('roulement')) this.roulement.source.playbackRate.setTargetAtTime(0.7 + vitesse * 0.06, this.ctx.currentTime, 0.1);
  }

  arreterRoulement() {
    if (!this.roulement) return;
    const r = this.roulement;
    this.roulement = null;
    r.g.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.1);
    setTimeout(() => { try { r.source.stop(); } catch (e) { /* */ } }, 400);
  }

  // ---------- Musique (boucle originale, 8 mesures, 104 BPM) ----------

  majMusique() {
    if (!this.ctx) return;
    const actif = !!this.lire('musiqueActive', true);
    if (actif && !this.musique) this._demarrerMusique();
    else if (!actif && this.musique) this._arreterMusique();
  }

  _demarrerMusique() {
    const buf = this.fichiers.get('musique');
    if (buf) {
      const s = this.ctx.createBufferSource();
      s.buffer = buf; s.loop = true; s.connect(this.gains.musique); s.start();
      this.musique = { source: s };
      return;
    }
    // Séquenceur : basse + accords + mélodie pentatonique, en la mineur / do majeur, ambiance « salle de jeu ».
    const bpm = 104, noire = 60 / bpm, croche = noire / 2;
    const accords = [[57, 60, 64], [53, 57, 60], [60, 64, 67], [55, 59, 62]]; // Am F C G
    const melodie = [76, 79, 81, 79, 76, 74, 72, 74, 76, 79, 81, 84, 81, 79, 76, 74];
    const etat = { mesure: 0, prochain: this.ctx.currentTime + 0.1 };
    const planifier = () => {
      if (!this.musique) return;
      while (etat.prochain < this.ctx.currentTime + 0.6) {
        const t = etat.prochain, acc = accords[etat.mesure % 4];
        for (let i = 0; i < 4; i++) this._ton(this.gains.musique, 440 * 2 ** ((acc[0] - 12 - 69) / 12), t + i * noire, noire * 0.9, { type: 'triangle', niveau: 0.25 });
        for (let i = 0; i < 2; i++) for (const n of acc) this._ton(this.gains.musique, 440 * 2 ** ((n - 69) / 12), t + i * 2 * noire + croche, noire * 1.2, { type: 'sine', niveau: 0.09 });
        for (let i = 0; i < 8; i++) { const n = melodie[(etat.mesure % 2) * 8 + i]; if ((etat.mesure % 4) !== 3 || i % 2 === 0) this._ton(this.gains.musique, 440 * 2 ** ((n - 69) / 12), t + i * croche, croche * 0.9, { type: 'triangle', niveau: 0.11 }); }
        etat.prochain += 4 * noire;
        etat.mesure++;
      }
    };
    this.musique = { timer: setInterval(planifier, 250) };
    planifier();
  }

  _arreterMusique() {
    if (!this.musique) return;
    if (this.musique.timer) clearInterval(this.musique.timer);
    if (this.musique.source) { try { this.musique.source.stop(); } catch (e) { /* */ } }
    this.musique = null;
  }
}
