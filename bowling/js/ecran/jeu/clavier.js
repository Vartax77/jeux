// Manette clavier (mode « Clavier/souris » du cahier des charges, §3.4).
// ← → : position · Q/A et D : angle · Espace maintenu : jauge de puissance oscillante, ← → règlent l'effet pendant l'appui,
// relâcher = lancer · L / B : prochain lancer lobé / en arrière · Entrée ou Espace : passer une phase.

export class Clavier extends EventTarget {
  constructor(partie) {
    super();
    this.partie = partie;
    this.touches = new Set();
    this.jauge = { active: false, valeur: 0, sens: 1, effet: 0 };
    this.gag = null;          // 'lob' | 'arriere' | null
    this.periodeJauge = 1.6;  // s pour un aller-retour 0 → 1 → 0
    this._surKeydown = (e) => this._keydown(e);
    this._surKeyup = (e) => this._keyup(e);
    window.addEventListener('keydown', this._surKeydown);
    window.addEventListener('keyup', this._surKeyup);
  }

  _dansChamp(e) {
    const t = e.target;
    return t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
  }

  _keydown(e) {
    if (this._dansChamp(e)) return;
    const k = e.key;
    if (e.repeat && k !== ' ') return;
    if (k === ' ' || k === 'Enter') {
      e.preventDefault();
      if (this.partie.peutLancer()) {
        if (k === ' ' && !this.jauge.active) { this.jauge.active = true; this.jauge.valeur = 0; this.jauge.sens = 1; this.jauge.effet = 0; this._emettre('jauge'); }
      } else if (!e.repeat) {
        this._emettre('passer');
      }
      return;
    }
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'q', 'Q', 'a', 'A', 'd', 'D'].includes(k)) e.preventDefault();
    this.touches.add(k.length === 1 ? k.toLowerCase() : k);
    if (k === 'l' || k === 'L') { this.gag = this.gag === 'lob' ? null : 'lob'; this._emettre('gag'); }
    if (k === 'b' || k === 'B') { this.gag = this.gag === 'arriere' ? null : 'arriere'; this._emettre('gag'); }
    if (k === 'Home') { this.partie.reglerVisee(0, 0); }
  }

  _keyup(e) {
    const k = e.key;
    this.touches.delete(k.length === 1 ? k.toLowerCase() : k);
    if (k === ' ' && this.jauge.active) {
      this.jauge.active = false;
      const phase = this.gag || 'normal';
      this.gag = null;
      this._emettre('lancer', { puissance: this.jauge.valeur, effet: this.jauge.effet, phase });
      this._emettre('gag');
    }
  }

  // À appeler chaque image ; dt en secondes.
  maj(dt) {
    const t = this.touches;
    if (this.jauge.active) {
      this.jauge.valeur += (this.jauge.sens * 2 * dt) / this.periodeJauge;
      if (this.jauge.valeur >= 1) { this.jauge.valeur = 1; this.jauge.sens = -1; }
      if (this.jauge.valeur <= 0) { this.jauge.valeur = 0; this.jauge.sens = 1; }
      if (t.has('ArrowLeft')) this.jauge.effet = Math.max(-1, this.jauge.effet - 1.6 * dt);
      if (t.has('ArrowRight')) this.jauge.effet = Math.min(1, this.jauge.effet + 1.6 * dt);
      return;
    }
    if (!this.partie.peutLancer()) return;
    this._accu = (this._accu || 0) + dt;
    // Visée : un pas tous les 60 ms tant que la touche est maintenue
    while (this._accu >= 0.06) {
      this._accu -= 0.06;
      if (t.has('ArrowLeft')) this.partie.viser('position', -1);
      if (t.has('ArrowRight')) this.partie.viser('position', 1);
      if (t.has('q') || t.has('a')) this.partie.viser('angle', -1);
      if (t.has('d')) this.partie.viser('angle', 1);
    }
  }

  detruire() {
    window.removeEventListener('keydown', this._surKeydown);
    window.removeEventListener('keyup', this._surKeyup);
  }

  _emettre(nom, detail = {}) {
    this.dispatchEvent(new CustomEvent(nom, { detail }));
  }
}
