// Analyse du geste de lancer, côté écran. Fonctions pures : elles ne touchent ni au DOM ni au réseau,
// ce qui permet de les tester avec des données synthétiques (voir tests/geste.test.mjs).
//
// Cycle : preparerEchantillon() sur chaque échantillon reçu → nouveauGeste() au "pose" →
// ajouterAuGeste() pour chaque échantillon pendant le maintien → terminerGeste() au "leve".

import { vec, borner, matriceOrientation, appliquer, transposer } from '../commun/maths.js';

// Index dans r = [alpha (autour de z), beta (autour de x), gamma (autour de y)]
const INDEX_AXE = { x: 1, y: 2, z: 0 };

// Enrichit un échantillon brut : matrice d'orientation, accélération dans le repère terrestre,
// direction "haut" dans le repère du téléphone (déduite de ag − a), norme de l'accélération.
export function preparerEchantillon(ech) {
  const a = Array.isArray(ech.a) ? ech.a : [0, 0, 0];
  const oValide = Array.isArray(ech.o) && ech.o.length === 3 && ech.o.every((x) => typeof x === 'number' && Number.isFinite(x));
  const R = oValide ? matriceOrientation(ech.o[0], ech.o[1], ech.o[2]) : null;
  const aW = R ? appliquer(R, a) : null;
  let up = null;
  if (Array.isArray(ech.ag) && Array.isArray(ech.a)) {
    const g = vec.sub(ech.ag, ech.a); // = réaction à la gravité, pointe vers le haut (convention W3C)
    const n = vec.norme(g);
    if (n > 1) up = vec.echelle(g, 1 / n);
  }
  return { ...ech, a, R, aW, up, normeA: vec.norme(a) };
}

// Ouvre un geste au moment où le pouce se pose.
// reglages : réglages effectifs du joueur ; dernierEch : dernier échantillon préparé (pour l'orientation de départ) ;
// directionAvant : vecteur unitaire du sens "avant" dans le repère de départ, ou null si non calibré.
export function nouveauGeste(tPose, reglages, dernierEch, directionAvant = null) {
  return {
    tPose,
    tLeve: null,
    termine: false,
    reglages,
    R0: dernierEch && dernierEch.R ? dernierEch.R : null,
    R0t: dernierEch && dernierEch.R ? transposer(dernierEch.R) : null,
    dir: Array.isArray(directionAvant) ? directionAvant : null,
    v: [0, 0, 0],       // vitesse estimée dans le repère terrestre (m/s)
    vVertFallback: 0,   // vitesse verticale estimée sans orientation (m/s)
    torsion: 0,         // rotation cumulée autour de l'axe d'effet (°)
    picA: 0,
    tPic: tPose,
    dernierT: null,
    nb: 0,
    trace: [],
  };
}

// Intègre un échantillon préparé dans le geste. Annote aussi l'échantillon (p.vitesse, p.vVert, p.avant,
// p.torsion) pour les graphiques.
export function ajouterAuGeste(g, p) {
  if (g.termine) return;
  const R = g.reglages;
  let dt = 0;
  if (g.dernierT != null) dt = Math.min(0.05, Math.max(0, (p.t - g.dernierT) / 1000));
  g.dernierT = p.t;

  const fuite = Math.exp(-dt / Math.max(0.05, R.tauFuite));
  if (p.aW) g.v = vec.add(vec.echelle(g.v, fuite), vec.echelle(p.aW, dt));
  const aVert = p.up ? vec.dot(p.a, p.up) : 0;
  g.vVertFallback = g.vVertFallback * fuite + aVert * dt;

  if (Array.isArray(p.r)) {
    const i = INDEX_AXE[R.axeEffet] ?? 2;
    const w = p.r[i];
    if (typeof w === 'number' && Number.isFinite(w)) g.torsion += w * dt;
  }

  if (p.normeA > g.picA) { g.picA = p.normeA; g.tPic = p.t; }

  const vitesse = p.aW ? vec.norme(g.v) : Math.abs(g.vVertFallback);
  const vVert = p.aW ? g.v[2] : g.vVertFallback;
  const vPose = p.aW && g.R0t ? appliquer(g.R0t, g.v) : null;
  const avant = vPose && g.dir ? vec.dot(vPose, g.dir) : null;

  p.vitesse = vitesse; p.vVert = vVert; p.avant = avant; p.torsion = g.torsion;
  g.trace.push({ t: p.t, vitesse, vVert, vPose, avant, torsion: g.torsion, normeA: p.normeA });
  g.nb++;
}

// Clôt le geste au moment du "leve" (tLeve, horloge téléphone) et calcule le résultat.
export function terminerGeste(g, tLeve) {
  const R = g.reglages;
  g.tLeve = tLeve;
  g.termine = true;
  const duree = tLeve - g.tPose;

  // Instant du lancer retenu
  const score = (s) => (s.avant != null ? s.avant : s.vitesse);
  let candidats;
  if (R.modeLancer === 'automatique') {
    candidats = g.trace.filter((s) => s.t >= g.tPose + 50);
  } else {
    const tol = Math.max(0, R.toleranceRelacher);
    candidats = g.trace.filter((s) => s.t >= tLeve - tol && s.t <= tLeve + tol);
  }
  if (!candidats.length && g.trace.length) candidats = [g.trace[g.trace.length - 1]];
  let instant = null;
  for (const s of candidats) if (!instant || score(s) > score(instant)) instant = s;

  const base = {
    mode: R.modeLancer,
    duree,
    picA: g.picA,
    tPic: g.tPic,
    nbEchantillons: g.nb,
    instant: instant ? instant.t : tLeve,
    vitesse: instant ? instant.vitesse : 0,
    vVert: instant ? instant.vVert : 0,
    avant: instant ? instant.avant : null,
    torsion: instant ? instant.torsion : g.torsion,
    vPose: instant ? instant.vPose : null,
    orientationConnue: !!g.R0,
  };

  if (duree < R.dureeMin) return { type: 'annule', raison: 'tropCourt', ...base };
  if (g.picA < R.aMin) return { type: 'annule', raison: 'tropFaible', ...base };

  let puissance;
  if (R.sourcePuissance === 'vitesse') {
    puissance = borner((base.vitesse - R.vGesteMin) / Math.max(0.01, R.vGesteMax - R.vGesteMin));
  } else {
    puissance = borner((g.picA - R.aMin) / Math.max(0.01, R.aMax - R.aMin));
  }
  // Courbe de la jauge : exposant 1 = linéaire ; > 1 = il faut forcer davantage pour monter dans le haut de la jauge
  // (calé par le lancer « moyen » du calibrage, pour qu'un geste habituel tombe vers 50 %).
  const courbe = Number(R.courbePuissance);
  if (Number.isFinite(courbe) && courbe > 0 && courbe !== 1) puissance = Math.pow(puissance, courbe);

  const signeMain = R.main === 'gauche' ? -1 : 1;
  const ampl = Math.max(0, Math.abs(base.torsion) - R.effetZoneMorte) / Math.max(1, R.effetAnglePlein - R.effetZoneMorte);
  const effet = borner(ampl, 0, 1) * Math.sign(base.torsion || 0) * (R.signeEffet === -1 ? -1 : 1) * signeMain;

  let phase = 'normal';
  if (R.gagArriere && base.avant != null && base.avant < -R.seuilArriere) phase = 'arriere';
  else if (R.gagLob && base.vVert > R.seuilLob) phase = 'lob';

  return { type: 'lancer', puissance, effet, phase, ...base };
}

// Mode Glisser : résultat calculé à partir du résumé du glissement envoyé par la manette.
export function resultatGlisser(gl, R, duree) {
  const base = { mode: 'glisser', duree, picA: 0, nbEchantillons: 0, instant: gl ? gl.t : 0, vitesse: gl ? gl.vitesse : 0, vVert: 0, avant: null, torsion: 0, vPose: null, orientationConnue: false };
  if (!gl || !(gl.dy > 40)) return { type: 'annule', raison: 'tropCourt', ...base };
  const puissance = borner((gl.vitesse - R.glisserMin) / Math.max(0.01, R.glisserMax - R.glisserMin));
  const effet = borner((gl.dx / Math.max(40, gl.dy)) * R.glisserEffet, -1, 1);
  return { type: 'lancer', puissance, effet, phase: 'normal', ...base };
}
