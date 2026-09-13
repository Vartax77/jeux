// Bot : trois niveaux. Il choisit position, angle, puissance et effet avec un bruit décroissant, puis lance
// dans la même physique que les humains. Déroulé visible : réflexion → visée → armement → lancer (sautable).

import { positionsQuilles, DIM } from './physique.js';
import { ADJACENCES } from './score.js';

export const NIVEAUX = Object.freeze({
  debutant: { sigmaPosition: 0.10, sigmaAngle: 0.9, sigmaPuissance: 0.18, puissance: 0.55, effet: 0, sigmaEffet: 0.25 },
  confirme: { sigmaPosition: 0.05, sigmaAngle: 0.4, sigmaPuissance: 0.10, puissance: 0.60, effet: 0, sigmaEffet: 0.12 },
  pro:      { sigmaPosition: 0.02, sigmaAngle: 0.15, sigmaPuissance: 0.05, puissance: 0.65, effet: 0.3, sigmaEffet: 0.05 },
});

const POCHE_X = 0.06;            // m à droite de la quille 1
const DEVIATION_EFFET_PLEIN = 0.255; // m de crochet à effet 1 (mesuré au lot 2)
const DEMI_COURSE = DIM.largeurPiste / 2 - DIM.rayonBoule - 0.02; // position 1 = 0,399 m

function gaussien(rng) {
  let u = 0, v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// Groupes connexes de quilles debout ; retourne le plus fourni (à égalité, celui qui contient la plus petite quille).
export function groupePrincipal(tombees) {
  const debout = [];
  for (let i = 0; i < 10; i++) if (!tombees || !tombees[i]) debout.push(i + 1);
  if (!debout.length) return [];
  const ens = new Set(debout), vus = new Set();
  const groupes = [];
  for (const d of debout) {
    if (vus.has(d)) continue;
    const g = [];
    const pile = [d];
    while (pile.length) {
      const q = pile.pop();
      if (vus.has(q)) continue;
      vus.add(q); g.push(q);
      for (const v of ADJACENCES[q]) if (ens.has(v) && !vus.has(v)) pile.push(v);
    }
    groupes.push(g.sort((a, b) => a - b));
  }
  groupes.sort((a, b) => b.length - a.length || a[0] - b[0]);
  return groupes[0];
}

// Abscisse visée (m) selon les quilles debout : poche si rack complet, sinon centre du groupe principal.
export function cibleX(tombees) {
  const debout = tombees ? tombees.filter((t) => !t).length : 10;
  if (debout === 10) return POCHE_X;
  const g = groupePrincipal(tombees);
  if (!g.length) return 0;
  const pos = positionsQuilles();
  const xs = g.map((n) => pos[n - 1].x);
  const centre = xs.reduce((a, b) => a + b, 0) / xs.length;
  // Une quille seule sur un bord : viser légèrement vers l'intérieur pour ne pas partir en gouttière
  return Math.max(-0.38, Math.min(0.38, centre));
}

// Décision d'un lancer : { position, angle, puissance, effet, cibleX }
export function deciderLancer(niveau, tombees, rng = Math.random) {
  const N = NIVEAUX[niveau] || NIVEAUX.confirme;
  const x = cibleX(tombees);
  const effet = Math.max(-1, Math.min(1, N.effet + gaussien(rng) * N.sigmaEffet));
  const xDepart = x - effet * DEVIATION_EFFET_PLEIN + gaussien(rng) * N.sigmaPosition;
  const position = Math.max(-1, Math.min(1, xDepart / DEMI_COURSE));
  const angle = Math.max(-4, Math.min(4, gaussien(rng) * N.sigmaAngle));
  const puissance = Math.max(0.05, Math.min(1, N.puissance + gaussien(rng) * N.sigmaPuissance));
  return { position: Math.round(position * 100) / 100, angle: Math.round(angle * 100) / 100, puissance, effet, cibleX: x };
}

// Déroulé visible du tour d'un bot. Émet 'lancer' { puissance, effet, phase } quand il lance.
export class Bot extends EventTarget {
  constructor(partie, lire) {
    super();
    this.partie = partie;
    this.lire = (id, defaut) => { const v = lire ? lire(id) : undefined; return v === undefined || v === null ? defaut : v; };
    this.actif = false;
    this.etape = null;
    this.chrono = 0;
  }

  // joueur : { niveau } ; tombees : bool[10] des quilles tombées (null = rack complet)
  demarrer(joueur, tombees, rng = Math.random) {
    this.decision = deciderLancer(joueur.niveau, tombees, rng);
    this.depart = { ...this.partie.visee };
    this.actif = true;
    this.etape = 'reflexion';
    this.chrono = 0;
    this.dureeReflexion = this.lire('delaiBot', 1.2);
    this.dureeVisee = 0.8;
    this.dureeArmement = 0.7;
    this.dispatchEvent(new CustomEvent('etape', { detail: { etape: this.etape } }));
  }

  arreter() { this.actif = false; this.etape = null; }

  passer() {
    if (!this.actif) return false;
    this._lancer();
    return true;
  }

  maj(dt) {
    if (!this.actif) return;
    this.chrono += dt;
    if (this.etape === 'reflexion' && this.chrono >= this.dureeReflexion) { this.etape = 'visee'; this.chrono = 0; this._emettreEtape(); }
    else if (this.etape === 'visee') {
      const t = Math.min(1, this.chrono / this.dureeVisee);
      const s = t * t * (3 - 2 * t);
      this.partie.reglerVisee(this.depart.position + (this.decision.position - this.depart.position) * s, this.depart.angle + (this.decision.angle - this.depart.angle) * s);
      if (t >= 1) { this.etape = 'armement'; this.chrono = 0; this._emettreEtape(); }
    } else if (this.etape === 'armement' && this.chrono >= this.dureeArmement) this._lancer();
  }

  // Progression de l'armement (0..1) pour la jauge du HUD.
  jauge() {
    if (!this.actif) return null;
    if (this.etape !== 'armement') return { active: false, valeur: 0, effet: this.decision.effet };
    return { active: true, valeur: Math.min(1, this.chrono / this.dureeArmement) * this.decision.puissance, effet: this.decision.effet };
  }

  _lancer() {
    if (!this.actif) return;
    this.partie.reglerVisee(this.decision.position, this.decision.angle);
    this.actif = false;
    this.etape = null;
    this.dispatchEvent(new CustomEvent('lancer', { detail: { puissance: this.decision.puissance, effet: this.decision.effet, phase: 'normal' } }));
  }

  _emettreEtape() { this.dispatchEvent(new CustomEvent('etape', { detail: { etape: this.etape } })); }
}
