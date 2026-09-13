// Cycle d'un lancer : préparation → roulement → impact → (comptage) → résultat → remise → préparation.
// Lot 2 : une piste, boules 1 et 2, remise en place ; pas encore de score ni de tours (lot 3).
// Sans DOM : testable en Node (tests/partie.test.mjs).

import { DIM } from './physique.js';

const PHASES = ['preparation', 'roulement', 'impact', 'resultat', 'remise'];

export class Partie extends EventTarget {
  constructor(physique, lire) {
    super();
    this.phys = physique;
    this.lire = (id, defaut) => { const v = lire ? lire(id) : undefined; return v === undefined || v === null ? defaut : v; };
    this.phase = 'preparation';
    this.boule = 1;          // 1re ou 2e boule de la frame
    this.frame = 1;
    this.visee = { position: 0, angle: 0 };
    this.chrono = 0;
    this.dernier = null;     // dernier résultat
    this.lance = null;       // paramètres du lancer en cours
    this.lanceur = null;     // identifiant de qui a lancé (jeton de manette ou 'clavier')
    this.coteImpact = 1;     // côté de la caméra d'impact (alterne)
    this.debout = 10;        // quilles debout avant le lancer
    this.modeRemise = 'rack';
    this.remiseFaite = false;
    this.verrouille = false;   // true : aucun lancer accepté (salon, fin de partie)
    this.suivant = null;       // hook (res) => { mode: 'respot'|'rack', boule, frame, fin } fourni par le match (lot 3)
    this.prochain = null;
    this.phys.nouveauRack();
  }

  // Nouvelle partie : rack complet, boule 1, frame 1, visée centrée, préparation.
  reinitialiser() {
    this.phys.rangerBoule();
    this.phys.nouveauRack();
    this.boule = 1;
    this.frame = 1;
    this.debout = 10;
    this.dernier = null;
    this.lance = null;
    this.prochain = null;
    this.visee = { position: 0, angle: 0 };
    this._changerPhase('preparation');
    this._emettre('visee', { ...this.visee });
  }

  // Reprise d'une partie sauvegardée : quilles debout (numéros), boule et frame.
  reprendre({ quillesDebout = null, boule = 1, frame = 1 } = {}) {
    this.reinitialiser();
    if (quillesDebout && quillesDebout.length < 10) this.phys.poserRack(quillesDebout);
    this.boule = boule;
    this.frame = frame;
    this.debout = this.phys.etatQuilles().nbDebout;
    this._emettre('phase', { phase: this.phase, boule: this.boule, frame: this.frame });
  }

  get phases() { return PHASES; }

  peutLancer() { return this.phase === 'preparation' && !this.verrouille; }

  // Visée : position ∈ [−1, 1] par pas de 0,05 ; angle ∈ [−4°, 4°] par pas de 0,25°.
  viser(quoi, sens) {
    if (quoi === 'position') this.visee.position = Math.round(Math.min(1, Math.max(-1, this.visee.position + (sens < 0 ? -0.05 : 0.05))) * 100) / 100;
    else if (quoi === 'angle') this.visee.angle = Math.round(Math.min(4, Math.max(-4, this.visee.angle + (sens < 0 ? -0.25 : 0.25))) * 100) / 100;
    this._emettre('visee', { ...this.visee });
  }

  reglerVisee(position, angle) {
    if (typeof position === 'number') this.visee.position = Math.min(1, Math.max(-1, position));
    if (typeof angle === 'number') this.visee.angle = Math.min(4, Math.max(-4, angle));
    this._emettre('visee', { ...this.visee });
  }

  // params : { puissance, effet, phase, position?, angle?, joueur?, nom? }
  lancer(params) {
    if (!this.peutLancer()) return false;
    const p = {
      position: typeof params.position === 'number' ? params.position : this.visee.position,
      angle: typeof params.angle === 'number' ? params.angle : this.visee.angle,
      puissance: params.puissance, effet: params.effet, phase: params.phase || 'normal',
    };
    this.debout = this.phys.etatQuilles().nbDebout;
    this.lance = this.phys.lancer(p);
    this.lance.joueur = params.joueur || 'clavier';
    this.lance.nom = params.nom || 'Clavier';
    this.lanceur = this.lance.joueur;
    this.impactVu = false;
    this._changerPhase('roulement');
    this._emettre('lancer', { lance: this.lance, boule: this.boule, frame: this.frame });
    return true;
  }

  // Saute la phase en cours (touche, toucher ou message de manette) si les réglages l'autorisent.
  passer() {
    if (!this.lire('sautsAutorises', true)) return false;
    if (this.phase === 'roulement' || this.phase === 'impact') {
      // Avance la simulation jusqu'à l'immobilité (au plus 8 s simulées), puis compte.
      let t = 0;
      while (t < 8 && !this.phys.toutStable()) { this.phys.simuler(0.1); t += 0.1; }
      this._compter();
      return true;
    }
    if (this.phase === 'resultat') { this._demarrerRemise(); return true; }
    if (this.phase === 'remise') { this._finirRemise(); return true; }
    return false;
  }

  maj(dt) {
    this.chrono += dt;
    const L = DIM.longueurPiste;
    switch (this.phase) {
      case 'roulement': {
        const b = this.phys.boule;
        const z = b.corps.position.z;
        if (!this.impactVu && z < -L + this.lire('distanceCoupeImpact', 2.0)) {
          this.impactVu = true;
          this.coteImpact = -this.coteImpact;
          this._changerPhase('impact');
        } else if (b.termine) {
          this._changerPhase('impact');
        } else if (this.chrono > 12) {
          this._changerPhase('impact');
        }
        break;
      }
      case 'impact': {
        const b = this.phys.boule;
        const limite = this.lire('delaiMaxQuilles', 4) + (b.termine ? 0 : 3);
        if (this.phys.toutStable() || this.chrono > limite) this._compter();
        break;
      }
      case 'resultat':
        if (this.chrono > this.lire('dureeResultat', 2.5)) this._demarrerRemise();
        break;
      case 'remise': {
        const duree = this.lire('dureeRemise', 2.6);
        // Respot : les quilles couchées sont retirées après le balayage (78 %) ; rack complet : dès la fin du balayage (50 %)
        if (!this.remiseFaite && this.chrono > duree * (this.modeRemise === 'respot' ? 0.78 : 0.5)) this._appliquerRemise();
        if (this.chrono > duree) this._finirRemise();
        break;
      }
      default:
        break;
    }
  }

  _compter() {
    const e = this.phys.etatQuilles();
    const b = this.phys.boule;
    const tombees = Math.max(0, this.debout - e.nbDebout);
    const res = {
      boule: this.boule, frame: this.frame, tombees, debout: e.nbDebout, quilles: e.tombees.slice(),
      strike: this.boule === 1 && e.nbDebout === 0, spare: this.boule === 2 && e.nbDebout === 0,
      gouttiere: b.gouttiere, phaseLancer: this.lance ? this.lance.phase : 'normal',
      joueur: this.lanceur, nom: this.lance ? this.lance.nom : '', puissance: this.lance ? this.lance.puissance : 0, effet: this.lance ? this.lance.effet : 0,
    };
    this.phys.rangerBoule();
    this.dernier = res;
    this.prochain = this.suivant ? this.suivant(res) : null;
    this.modeRemise = this.prochain ? this.prochain.mode : ((this.boule === 1 && e.nbDebout > 0) ? 'respot' : 'rack');
    this._changerPhase('resultat');
    this._emettre('resultat', res);
  }

  _demarrerRemise() {
    this.remiseFaite = false;
    this._changerPhase('remise');
    this._emettre('remise', { mode: this.modeRemise });
  }

  _appliquerRemise() {
    this.remiseFaite = true;
    if (this.modeRemise === 'respot') this.phys.retirerTombees();
    else if (this.prochain && Array.isArray(this.prochain.rack)) this.phys.poserRack(this.prochain.rack);
    else this.phys.nouveauRack();
    this._emettre('remise-appliquee', { mode: this.modeRemise });
  }

  _finirRemise() {
    if (!this.remiseFaite) this._appliquerRemise();
    if (this.prochain) { this.boule = this.prochain.boule || 1; this.frame = this.prochain.frame || this.frame; if (this.prochain.fin) this.verrouille = true; }
    else if (this.modeRemise === 'respot') this.boule = 2;
    else { this.boule = 1; this.frame++; }
    this.debout = this.phys.etatQuilles().nbDebout;
    this._changerPhase('preparation');
    this._emettre('preparation', { boule: this.boule, frame: this.frame, debout: this.debout });
  }

  _changerPhase(phase) {
    this.phase = phase;
    this.chrono = 0;
    this._emettre('phase', { phase, boule: this.boule, frame: this.frame });
  }

  _emettre(nom, detail) {
    this.dispatchEvent(new CustomEvent(nom, { detail }));
  }
}
