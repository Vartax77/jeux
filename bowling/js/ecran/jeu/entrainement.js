// Entraînements (cahier des charges §4.8) : Spares, Lancers puissants, Contrôle de l'effet.
// Chaque mode pilote le cycle de lancer (Partie) via son hook `suivant` et décrit son état pour le HUD.
// Sans DOM : testable en Node.

import { nbQuillesRangs } from './physique.js';

export const MODES = Object.freeze({
  spares: { titre: 'Spares', description: '10 lancers sur des configurations de quilles ; score = spares réussis.' },
  puissance: { titre: 'Lancers puissants', description: '10 lancers, une boule par rack ; le rack grossit de 10 à 91 quilles ; score = quilles tombées.' },
  effet: { titre: 'Contrôle de l’effet', description: '10 lancers avec une barrière qui impose une courbe de plus en plus marquée ; score = quilles tombées.' },
});

export const CONFIGS_SPARES = Object.freeze([[7, 10], [4, 6, 7, 10], [3, 10], [2, 4, 5, 8], [6, 7], [2, 7], [4, 5], [3, 6, 9, 10], [5, 7], [6, 10]]);
export const NB_LANCERS = 10;

// Rangs du rack au lancer i (0..9) en Lancers puissants : 4 → 13 rangées (10 → 91 quilles).
export function rangsPuissance(i) { return 4 + i; }

// Barrière au lancer i (0..9) en Contrôle de l'effet : de plus en plus longue vers la droite.
export function barriereEffet(i) { return { jusquA: 0.05 + i * 0.03, fraction: 0.55 }; }

export class Entrainement extends EventTarget {
  constructor(mode, phys, lire) {
    super();
    if (!MODES[mode]) throw new Error('mode inconnu : ' + mode);
    this.mode = mode;
    this.phys = phys;
    this.lire = lire || (() => undefined);
    this.index = 0;          // lancer en cours (0..9)
    this.score = 0;
    this.resultats = [];
    this.termine = false;
  }

  get titre() { return MODES[this.mode].titre; }

  // Rack (numéros de quilles) du lancer courant.
  rack(i = this.index) {
    if (this.mode === 'spares') return CONFIGS_SPARES[i % CONFIGS_SPARES.length].slice();
    if (this.mode === 'puissance') { const n = nbQuillesRangs(rangsPuissance(i)); return Array.from({ length: n }, (_, k) => k + 1); }
    return Array.from({ length: 10 }, (_, k) => k + 1);
  }

  barriere(i = this.index) { return this.mode === 'effet' ? barriereEffet(i) : null; }

  // Met la piste en place pour le lancer courant.
  preparer() {
    this.phys.poserRack(this.rack());
    this.phys.reglerBarriere(this.barriere());
    this._emettre('preparation', this.etat());
  }

  // Hook du cycle de lancer : enregistre le résultat, prépare la suite.
  suivant(res) {
    const tombees = res.tombees || 0;
    let points = 0, reussi = false;
    if (this.mode === 'spares') { reussi = res.debout === 0; points = reussi ? 1 : 0; }
    else points = tombees;
    this.score += points;
    this.resultats.push({ index: this.index, tombees, points, reussi, debout: res.debout });
    this.index++;
    this.termine = this.index >= NB_LANCERS;
    const suite = { mode: 'rack', boule: 1, frame: Math.min(NB_LANCERS, this.index + 1), fin: this.termine, rack: this.termine ? null : this.rack(), points, reussi };
    if (!this.termine) this.phys.reglerBarriere(this.barriere());
    this._emettre('lancer', { ...suite, etat: this.etat() });
    if (this.termine) this._emettre('fin', this.etat());
    return suite;
  }

  etat() {
    return { mode: this.mode, titre: this.titre, lancer: Math.min(NB_LANCERS, this.index + 1), total: NB_LANCERS, score: this.score, termine: this.termine, rack: this.termine ? [] : this.rack(), barriere: this.termine ? null : this.barriere(), resultats: this.resultats.slice() };
  }

  _emettre(nom, detail) { this.dispatchEvent(new CustomEvent(nom, { detail })); }
}

// Meilleurs scores par mode (localStorage bowling.entrainements).
const CLE = 'bowling.entrainements';
export function meilleursScores() {
  try { return JSON.parse(localStorage.getItem(CLE) || '{}') || {}; } catch (e) { return {}; }
}
export function enregistrerScore(mode, score, nom = '') {
  const m = meilleursScores();
  const prec = m[mode];
  if (!prec || score > prec.score) { m[mode] = { score, nom, date: new Date().toISOString() }; try { localStorage.setItem(CLE, JSON.stringify(m)); } catch (e) { /* */ } return true; }
  return false;
}
