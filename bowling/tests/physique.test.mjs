// Tests de la physique du bowling, sans navigateur.
// Lancer : node tests/physique.test.mjs   (depuis le dossier bowling/)

import { MondePhysique, DIM, positionsQuilles } from '../js/ecran/jeu/physique.js';

// Tests déterministes : pas d'aléa sur la masse des quilles
const SANS_ALEA = (id) => (id === 'aleaQuilles' ? 0 : undefined);
let echecs = 0;
function verifier(nom, condition, detail = '') {
  console.log((condition ? '  ✓ ' : '  ✗ ') + nom + (condition ? '' : '   ' + detail));
  if (!condition) echecs++;
}

// Joue un lancer jusqu'à la fin de la trajectoire et la stabilité des quilles (max 8 s simulées).
function jouer(monde, params) {
  monde.lancer(params);
  let t = 0;
  while (t < 8) {
    monde.simuler(0.1);
    t += 0.1;
    if (monde.boule.termine && monde.quillesStables() && t > 1) break;
  }
  const e = monde.etatQuilles();
  return { ...e, boule: { ...monde.boule, corps: undefined, x: monde.boule.corps.position.x, y: monde.boule.corps.position.y, z: monde.boule.corps.position.z }, duree: t };
}

console.log('Géométrie');
{
  const p = positionsQuilles();
  verifier('10 quilles', p.length === 10);
  verifier('quille 1 en (0, −18,29)', Math.abs(p[0].x) < 1e-9 && Math.abs(p[0].z + DIM.longueurPiste) < 1e-9);
  verifier('quille 7 à gauche, quille 10 à droite', p[6].x < 0 && p[9].x > 0 && Math.abs(p[6].x + 1.5 * DIM.espacementQuilles) < 1e-9);
}

console.log('Rack actif immobile 30 s');
{
  const m = new MondePhysique(SANS_ALEA);
  m.activerQuilles();
  m.simuler(30);
  const e = m.etatQuilles();
  verifier('aucune quille tombée', e.nbTombees === 0, JSON.stringify(e.tombees));
  const q1 = m.quilles[0].corps.position;
  verifier('quille 1 n’a pas dérivé (< 5 mm)', Math.hypot(q1.x, q1.z + DIM.longueurPiste) < 0.005, String(Math.hypot(q1.x, q1.z + DIM.longueurPiste)));
}

console.log('Lancers dans la poche (vitesse moyenne, droit)');
{
  // position ∈ [−1,1] → x0 = position × 0,399 ; la poche 1-3 est à 5–7 cm à droite de la quille 1.
  let strikesPoche = 0, somme = 0, n = 0;
  const details = [];
  for (const x of [0.03, 0.04, 0.05, 0.06, 0.07, 0.08, 0.09, 0.10]) {
    const m = new MondePhysique(SANS_ALEA);
    const r = jouer(m, { position: x / 0.399, angle: 0, puissance: 0.6, effet: 0, phase: 'normal' });
    n++; somme += r.nbTombees;
    if (x >= 0.05 && x <= 0.07 && r.nbTombees === 10) strikesPoche++;
    details.push(x.toFixed(2) + '→' + r.nbTombees);
  }
  console.log('    ' + details.join(' · ') + '  (moyenne ' + (somme / n).toFixed(1) + ')');
  verifier('au moins 2 strikes sur les 3 lancers pleine poche (5–7 cm)', strikesPoche >= 2, strikesPoche + '/3');
  verifier('moyenne ≥ 8 quilles sur toute la zone 3–10 cm', somme / n >= 8, (somme / n).toFixed(2));
}

console.log('Quille 1 de face');
{
  const m = new MondePhysique(SANS_ALEA);
  const r = jouer(m, { position: 0, angle: 0, puissance: 0.6, effet: 0, phase: 'normal' });
  console.log('    ' + r.nbTombees + ' quilles, restantes : ' + r.tombees.map((t, i) => (t ? null : i + 1)).filter(Boolean).join('-'));
  verifier('au moins 4 quilles tombées', r.nbTombees >= 4, String(r.nbTombees));
}

console.log('Effleurer la quille 7');
{
  const m = new MondePhysique(SANS_ALEA);
  const r = jouer(m, { position: -0.44 / 0.399, angle: 0, puissance: 0.5, effet: 0, phase: 'normal' });
  console.log('    ' + r.nbTombees + ' quilles');
  verifier('entre 1 et 4 quilles, la 10 reste debout', r.nbTombees >= 1 && r.nbTombees <= 4 && !r.tombees[9], String(r.nbTombees));
  verifier('la boule n’est pas allée dans la gouttière avant les quilles', !r.boule.gouttiere || r.boule.distanceMax > DIM.longueurPiste - 0.5);
}

console.log('Gouttière');
{
  const m = new MondePhysique(SANS_ALEA);
  const r = jouer(m, { position: 1, angle: 3.5, puissance: 0.5, effet: 0, phase: 'normal' });
  verifier('boule dans la gouttière', r.boule.gouttiere, JSON.stringify({ x: r.boule.x, z: r.boule.z }));
  verifier('aucune quille touchée', r.nbTombees === 0, String(r.nbTombees));
  verifier('boule arrivée dans la fosse', r.boule.dansFosse, JSON.stringify({ x: r.boule.x, y: r.boule.y, z: r.boule.z, arret: r.boule.arret }));
}

console.log('Effet');
{
  const m1 = new MondePhysique(SANS_ALEA), m2 = new MondePhysique(SANS_ALEA);
  const xAt = (m, effet) => {
    m.lancer({ position: 0, angle: 0, puissance: 0.6, effet, phase: 'normal' });
    while (m.boule.corps.position.z > -DIM.longueurPiste + 0.3 && !m.boule.termine) m.simuler(0.05);
    return m.boule.corps.position.x;
  };
  const droit = xAt(m1, 0), crochet = xAt(m2, 1);
  console.log('    x aux quilles : droit ' + droit.toFixed(3) + ' m, effet +1 ' + crochet.toFixed(3) + ' m');
  verifier('effet +1 dévie la boule vers la droite de 40 cm au moins', crochet - droit > 0.4, String(crochet - droit));
  const m3 = new MondePhysique(SANS_ALEA);
  const gauche = xAt(m3, -1);
  verifier('effet −1 dévie d’autant vers la gauche (symétrie)', droit - gauche > 0.4 && Math.abs((crochet - droit) - (droit - gauche)) < 0.05, String(droit - gauche));
  const m4 = new MondePhysique(SANS_ALEA);
  const demi = xAt(m4, 0.5);
  verifier('effet 0,5 dévie environ deux fois moins que l’effet plein', demi - droit > 0.15 && demi - droit < (crochet - droit) * 0.8, String(demi - droit));
  // Trajectoire en trois phases : droite, puis virage, puis droite à nouveau
  {
    const m = new MondePhysique(SANS_ALEA);
    m.lancer({ position: -0.5, angle: 0, puissance: 0.6, effet: 1, phase: 'normal' });
    const xA = (frac) => { while (-m.boule.corps.position.z < frac * DIM.longueurPiste && !m.boule.termine) m.simuler(1 / 120); return m.boule.corps.position.x; };
    const x20 = xA(0.2), x40 = xA(0.4), x70 = xA(0.7), x92 = xA(0.92), x99 = xA(0.99);
    console.log('    trajectoire : 20 % ' + x20.toFixed(2) + ' · 40 % ' + x40.toFixed(2) + ' · 70 % ' + x70.toFixed(2) + ' · 92 % ' + x92.toFixed(2) + ' · 99 % ' + x99.toFixed(2));
    verifier('phase de glisse : la boule va droit sur les 40 premiers %', Math.abs(x40 - x20) < 0.02, String(x40 - x20));
    verifier('phase de crochet : elle vire nettement entre 40 et 92 %', x92 - x40 > 0.4, String(x92 - x40));
    verifier('phase de roulement : elle repart droit après le virage', Math.abs((x99 - x92) / 0.07 - (x92 - x70) / 0.22) < 0.6, String((x99 - x92) / 0.07) + ' vs ' + String((x92 - x70) / 0.22));
  }
}

console.log('Lob et arrière');
{
  const m = new MondePhysique(SANS_ALEA);
  const r = jouer(m, { position: 0, angle: 0, puissance: 0.7, effet: 0, phase: 'lob' });
  verifier('lob : la boule a quitté le sol puis termine sa course', r.boule.enLAir && r.boule.termine, JSON.stringify({ enLAir: r.boule.enLAir, termine: r.boule.termine }));
  const m2 = new MondePhysique(SANS_ALEA);
  const r2 = jouer(m2, { position: 0, angle: 0, puissance: 0.7, effet: 0, phase: 'arriere' });
  verifier('arrière : la boule part derrière et termine', r2.boule.z > 0.5 && r2.boule.termine, JSON.stringify({ z: r2.boule.z, termine: r2.boule.termine }));
  verifier('arrière : aucune quille', r2.nbTombees === 0);
}

console.log('Remise en place');
{
  const m = new MondePhysique(SANS_ALEA);
  const r = jouer(m, { position: -0.44 / 0.399, angle: 0, puissance: 0.5, effet: 0, phase: 'normal' });
  const e = m.retirerTombees();
  verifier('quilles tombées retirées', m.quilles.filter((q) => !q.presente).length === e.nbTombees);
  const debout = m.quilles.filter((q) => q.presente);
  verifier('quilles debout exactement replacées', debout.every((q) => Math.abs(q.corps.position.x - q.initiale.x) < 1e-9 && Math.abs(q.corps.position.z - q.initiale.z) < 1e-9 && Math.abs(q.corps.position.y - DIM.centreGraviteQuille) < 1e-9 && q.corps.quaternion.w === 1));
  verifier('quilles gelées (hors simulation)', debout.every((q) => !q.active) && !m.quillesActives);
  m.nouveauRack();
  verifier('nouveau rack : 10 quilles présentes', m.quilles.every((q) => q.presente && q.debout));
  m.poserRack([7, 10]);
  verifier('rack 7-10', m.quilles.filter((q) => q.presente).map((q) => q.numero).join('-') === '7-10');
}

console.log('Chocs et enregistrement (lot B)');
{
  const m = new MondePhysique(SANS_ALEA);
  m.lancer({ position: 0.06 / 0.399, angle: 0, puissance: 0.6, effet: 0, phase: 'normal' });
  let t = 0, chocs = [];
  while (t < 8) { m.simuler(0.05); t += 0.05; chocs.push(...m.prendreChocs()); if (m.boule.termine && m.quillesStables() && t > 1) break; }
  const types = new Set(chocs.map((c) => c.type));
  console.log('    ' + chocs.length + ' chocs : ' + [...types].join(', '));
  verifier('des chocs boule/quille et quille/quille sont émis', types.has('boule-quille') && types.has('quille-quille'), [...types].join(','));
  verifier('les chocs portent une vitesse d’impact plausible (0,3 – 12 m/s)', chocs.every((c) => c.force >= 0.3 && c.force <= 12), String(Math.max(...chocs.map((c) => c.force))));
  verifier('pas de rafale : au plus 24 chocs en attente à la fois, et au moins 5 au total', chocs.length >= 5);
  const e = m.enregistrement;
  verifier('enregistrement à 60 Hz démarré à l’activation, ≥ 60 images', e && e.images.length >= 60, String(e && e.images.length));
  const img = m.imageEnregistree(0.5);
  verifier('une image contient boule et 10 quilles', img && img.boule.length === 8 && img.quilles.length === 10 && img.quilles.filter(Boolean).length >= 1);
  verifier('les images progressent dans le temps', e.images[10].t > e.images[0].t && Math.abs(e.images[1].t - e.images[0].t - 1 / 60) < 1e-6, String(e.images[1].t - e.images[0].t));
}

console.log('Gouttières fermées');
{
  const m = new MondePhysique(SANS_ALEA);
  m.reglerBumpers(true);
  const r = jouer(m, { position: 1, angle: 3.5, puissance: 0.5, effet: 0, phase: 'normal' });
  verifier('avec bumpers : pas de gouttière, quilles touchées', !r.boule.gouttiere && r.nbTombees >= 1, JSON.stringify({ g: r.boule.gouttiere, n: r.nbTombees }));
}

console.log(echecs ? '\n' + echecs + ' test(s) en échec' : '\nTous les tests physiques passent.');
process.exit(echecs ? 1 : 0);
