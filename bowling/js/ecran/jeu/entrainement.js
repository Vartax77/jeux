// Entraînements (cahier des charges §4.8) : Spares, 100 quilles, Obstacles.
// Chaque mode pilote le cycle de lancer (Partie) via son hook `suivant` et décrit son état pour le HUD.
// Sans DOM : testable en Node (tests/entrainement.test.mjs).

import { nbQuillesRangs } from './physique.js';

export const MODES = Object.freeze({
  spares: { titre: 'Spares', description: '10 lancers sur des configurations de quilles ; score = spares réussis.' },
  cent: { titre: '100 quilles', description: '10 lancers, une boule par rack ; le rack grossit de 10 à 105 quilles et la piste s’évase pour l’accueillir ; score = quilles tombées.' },
  obstacle: { titre: 'Obstacles', description: '10 niveaux d’obstacles à contourner, certains exigent un crochet ; score = quilles tombées.' },
});
// Anciens noms (liens et records des versions précédentes)
export const ALIAS_MODES = Object.freeze({ puissance: 'cent', effet: 'obstacle' });
export function modeDepuis(nom) { const m = ALIAS_MODES[nom] || nom; return MODES[m] ? m : null; }

export const CONFIGS_SPARES = Object.freeze([[7, 10], [4, 6, 7, 10], [3, 10], [2, 4, 5, 8], [6, 7], [2, 7], [4, 5], [3, 6, 9, 10], [5, 7], [6, 10]]);
export const NB_LANCERS = 10;

// ---------- 100 quilles ----------
// Rangées du rack à chaque lancer : 10 → 105 quilles en 10 lancers.
const RANGS_CENT = [4, 5, 6, 7, 8, 9, 10, 11, 12, 14];
export const RANGS_MAX_CENT = 14;
export function rangsCent(i) { return RANGS_CENT[Math.min(RANGS_CENT.length - 1, Math.max(0, i))]; }
// Demi-largeur de la piste évasée pour ce rack (null = piste normale suffisante).
export function demiEvasement(i) {
  const rangs = rangsCent(i);
  if (rangs <= 4) return null;
  return (rangs - 1) * 0.3048 / 2 + 0.22;
}

// ---------- Obstacles ----------
// Dix niveaux. Obstacle = mur bas entre x0 et x1 (m), à la fraction f de la piste (0 = ligne de faute, 1 = quille 1).
// La piste va de −0,527 à +0,527 m, la boule fait 21,6 cm : aucun passage n'est plus étroit que 29 cm.
// Chaque niveau est vérifié franchissable par tests/entrainement.test.mjs.
export const NIVEAUX_OBSTACLES = Object.freeze([
  { nom: 'Mur central', obstacles: [{ x0: -0.15, x1: 0.15, f: 0.55 }] },
  { nom: 'Barrière à gauche', obstacles: [{ x0: -0.53, x1: -0.05, f: 0.55 }] },
  { nom: 'Barrière à droite', obstacles: [{ x0: 0.05, x1: 0.53, f: 0.55 }] },
  { nom: 'Deux poteaux', obstacles: [{ x0: -0.24, x1: -0.14, f: 0.5 }, { x0: 0.14, x1: 0.24, f: 0.5 }] },
  { nom: 'Porte étroite', obstacles: [{ x0: -0.53, x1: -0.16, f: 0.6 }, { x0: 0.16, x1: 0.53, f: 0.6 }] },
  { nom: 'Porte décalée', obstacles: [{ x0: -0.53, x1: -0.40, f: 0.6 }, { x0: -0.10, x1: 0.53, f: 0.6 }] },
  { nom: 'Chicane', obstacles: [{ x0: -0.53, x1: -0.10, f: 0.4 }, { x0: 0.10, x1: 0.53, f: 0.78 }] },
  { nom: 'Quinconce', obstacles: [{ x0: -0.06, x1: 0.06, f: 0.45 }, { x0: -0.24, x1: -0.14, f: 0.62 }, { x0: 0.14, x1: 0.24, f: 0.62 }] },
  { nom: 'Grand mur à gauche', obstacles: [{ x0: -0.53, x1: 0.20, f: 0.5 }] },
  { nom: 'Porte et poteau', obstacles: [{ x0: -0.53, x1: 0.12, f: 0.55 }, { x0: 0.42, x1: 0.53, f: 0.55 }, { x0: -0.20, x1: -0.08, f: 0.85 }] },
]);

export class Entrainement extends EventTarget {
  constructor(mode, phys, lire) {
    super();
    const m = modeDepuis(mode);
    if (!m) throw new Error('mode inconnu : ' + mode);
    this.mode = m;
    this.phys = phys;
    this.lire = lire || (() => undefined);
    this.index = 0;          // lancer en cours (0..9)
    this.score = 0;
    this.resultats = [];
    this.termine = false;
  }

  get titre() { return MODES[this.mode].titre; }

  // Rack (numéros de quilles) du lancer i.
  rack(i = this.index) {
    if (this.mode === 'spares') return CONFIGS_SPARES[i % CONFIGS_SPARES.length].slice();
    if (this.mode === 'cent') { const n = nbQuillesRangs(rangsCent(i)); return Array.from({ length: n }, (_, k) => k + 1); }
    return Array.from({ length: 10 }, (_, k) => k + 1);
  }

  niveau(i = this.index) { return this.mode === 'obstacle' ? NIVEAUX_OBSTACLES[i % NIVEAUX_OBSTACLES.length] : null; }

  // Applique à la physique la piste du lancer i (évasement, obstacles). Appelé au début de chaque lancer.
  appliquerPiste(i = this.index) {
    this.phys.reglerEvasement(this.mode === 'cent' ? demiEvasement(i) : null);
    this.phys.reglerObstacles(this.mode === 'obstacle' ? this.niveau(i).obstacles : []);
  }

  // Met la piste et le rack en place pour le lancer courant.
  preparer() {
    this.appliquerPiste();
    this.phys.poserRack(this.rack());
    this._emettre('preparation', this.etat());
  }

  // Hook du cycle de lancer : enregistre le résultat et décrit la suite (le rack suivant est posé par la remise ;
  // la piste suivante est appliquée au début du lancer suivant, par appliquerPiste).
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
    this._emettre('lancer', { ...suite, etat: this.etat() });
    if (this.termine) this._emettre('fin', this.etat());
    return suite;
  }

  etat() {
    const niv = this.termine ? null : this.niveau();
    return {
      mode: this.mode, titre: this.titre, lancer: Math.min(NB_LANCERS, this.index + 1), total: NB_LANCERS, score: this.score, termine: this.termine,
      rack: this.termine ? [] : this.rack(), niveau: niv ? niv.nom : null, resultats: this.resultats.slice(),
    };
  }

  _emettre(nom, detail) { this.dispatchEvent(new CustomEvent(nom, { detail })); }
}

// Meilleurs scores par mode (localStorage bowling.entrainements), anciens noms repris.
const CLE = 'bowling.entrainements';
export function meilleursScores() {
  let m = {};
  try { m = JSON.parse(localStorage.getItem(CLE) || '{}') || {}; } catch (e) { m = {}; }
  for (const [ancien, nouveau] of Object.entries(ALIAS_MODES)) if (m[ancien] && !m[nouveau]) m[nouveau] = m[ancien];
  return m;
}
export function enregistrerScore(mode, score, nom = '') {
  const m = meilleursScores();
  const prec = m[mode];
  if (!prec || score > prec.score) { m[mode] = { score, nom, date: new Date().toISOString() }; try { localStorage.setItem(CLE, JSON.stringify(m)); } catch (e) { /* */ } return true; }
  return false;
}
