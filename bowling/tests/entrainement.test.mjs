// Tests des entraînements : Spares, 100 quilles (évasement à chaque lancer), Obstacles (dix niveaux, tous franchissables).
// Lancer : node tests/entrainement.test.mjs
import { MondePhysique, configurerDimensions, positionsQuilles, nbQuillesRangs, DIM } from '../js/ecran/jeu/physique.js';
import { Entrainement, CONFIGS_SPARES, rangsCent, demiEvasement, NIVEAUX_OBSTACLES, modeDepuis, NB_LANCERS } from '../js/ecran/jeu/entrainement.js';
import { Partie } from '../js/ecran/jeu/partie.js';

// Tests déterministes : pas d'aléa sur la masse des quilles
const SANS_ALEA = (id) => (id === 'aleaQuilles' ? 0 : undefined);
let echecs = 0;
const verifier = (nom, cond, detail = '') => { console.log((cond ? '  ✓ ' : '  ✗ ') + nom + (cond ? '' : '   ' + detail)); if (!cond) echecs++; };
const jouer = (phys, partie, params) => { partie.reglerVisee(params.position, params.angle || 0); partie.lancer({ puissance: params.puissance ?? 0.6, effet: params.effet || 0 }); let t = 0; while (partie.phase !== 'preparation' && t < 40) { phys.avancer(1 / 30); partie.maj(1 / 30); t += 1 / 30; } };

console.log('Noms des modes');
verifier('anciens liens repris : puissance → cent, effet → obstacle', modeDepuis('puissance') === 'cent' && modeDepuis('effet') === 'obstacle' && modeDepuis('spares') === 'spares' && modeDepuis('xyz') === null);

console.log('Spares');
{
  const phys = new MondePhysique(SANS_ALEA);
  const partie = new Partie(phys, () => undefined);
  const e = new Entrainement('spares', phys, () => undefined);
  partie.suivant = (res) => e.suivant(res);
  e.preparer();
  verifier('rack 7-10 posé', phys.quilles.filter((q) => q.presente).map((q) => q.numero).join('-') === '7-10');
  jouer(phys, partie, { position: -0.44 / 0.399 });
  verifier('lancer 1 : pas de spare, score 0, lancer 2/10', e.score === 0 && e.index === 1 && e.etat().lancer === 2, JSON.stringify(e.etat()));
  verifier('rack suivant posé (4-6-7-10)', phys.quilles.filter((q) => q.presente).map((q) => q.numero).join('-') === '4-6-7-10');
  for (let i = e.index; i < 9; i++) e.suivant({ tombees: 0, debout: 2 });
  const suite = e.suivant({ tombees: 2, debout: 0 });
  verifier('dernier lancer réussi : score 1, terminé', e.score === 1 && e.termine && suite.fin && suite.reussi);
}

console.log('100 quilles : la piste s’évase à chaque lancer');
{
  configurerDimensions({ longueurDeck: 3.9 });
  const phys = new MondePhysique(SANS_ALEA, { rangs: 14 });
  const e = new Entrainement('cent', phys, () => undefined);
  verifier('monde à 105 quilles, dernier rack de 14 rangées', phys.quilles.length === 105 && rangsCent(9) === 14 && nbQuillesRangs(14) === 105);
  let largeurPrec = 0;
  const lignes = [];
  for (let i = 0; i < NB_LANCERS; i++) {
    e.index = i;
    e.appliquerPiste(i);
    e.phys.poserRack(e.rack(i));
    const n = phys.quilles.filter((q) => q.presente).length;
    const demi = phys.demiEvasement || DIM.largeurPiste / 2;
    const xMax = Math.max(...phys.quilles.filter((q) => q.presente).map((q) => Math.abs(q.initiale.x)));
    lignes.push(n + ' q · ' + (demi * 2).toFixed(2) + ' m');
    verifier('lancer ' + (i + 1) + ' : ' + n + ' quilles, toutes sur le deck (quille extrême à ' + xMax.toFixed(2) + ' m, demi-largeur ' + demi.toFixed(2) + ' m)', xMax <= demi - 0.06, xMax + ' / ' + demi);
    verifier('lancer ' + (i + 1) + ' : la piste est au moins aussi large qu’au lancer précédent', demi >= largeurPrec - 1e-9, demi + ' < ' + largeurPrec);
    largeurPrec = demi;
    // Le rack complet, actif, tient 3 s sans boule : deck et parois portent bien toutes les quilles
    phys.activerQuilles();
    phys.simuler(3);
    verifier('lancer ' + (i + 1) + ' : rack stable 3 s (aucune quille tombée du deck)', phys.etatQuilles().nbTombees === phys.quilles.length - n, String(phys.etatQuilles().nbTombees - (phys.quilles.length - n)));
    phys.gelerQuilles();
  }
  console.log('    ' + lignes.join(' · '));
  // Une vraie boule sur le rack de 15 quilles (lancer 2) : elle traverse l'évasement et fait tomber des quilles
  const partie = new Partie(phys, () => undefined);
  const e2 = new Entrainement('cent', phys, () => undefined);
  partie.suivant = (res) => e2.suivant(res);
  e2.index = 1; e2.preparer();
  jouer(phys, partie, { position: 0.06 / 0.399, puissance: 0.9 });
  verifier('boule dans la poche sur le rack de 15 : au moins 8 quilles', e2.resultats[0] && e2.resultats[0].tombees >= 8, JSON.stringify(e2.resultats[0]));
  verifier('au lancer suivant, la piste s’élargit (appliquée au début du lancer)', (() => { e2.appliquerPiste(); return phys.demiEvasement > demiEvasement(1) - 1e-9 && Math.abs(phys.demiEvasement - demiEvasement(2)) < 1e-9; })());
  configurerDimensions({ longueurDeck: 0.95 });
}

console.log('Obstacles : les dix niveaux, visibles et franchissables');
{
  // Recherche d'un lancer qui passe tous les obstacles et atteint les quilles (boule seule : pas d'activation des quilles)
  function franchissable(obstacles) {
    const essais = [];
    for (const effet of [0, 1, -1, 0.5, -0.5]) for (let position = -1; position <= 1.001; position += 0.1) for (const angle of [0, -1, 1, -2, 2, -3, 3]) essais.push({ effet, position, angle });
    for (const e of essais) {
      const m = new MondePhysique(SANS_ALEA);
      m.reglerObstacles(obstacles);
      m.lancer({ position: e.position, angle: e.angle, puissance: 0.6, effet: e.effet, phase: 'normal' });
      let t = 0;
      while (t < 6 && !m.boule.termine && m.boule.corps.position.z > -(DIM.longueurPiste - DIM.distanceActivation - 0.2)) { m.simuler(1 / 30); t += 1 / 30; }
      // Suite sans quilles actives : on regarde si elle arrive au deck, sur la piste, au centre
      while (t < 6 && !m.boule.termine && m.boule.corps.position.z > -(DIM.longueurPiste - 0.3)) { m.gelerQuilles(); m.simuler(1 / 60); t += 1 / 60; }
      const p = m.boule.corps.position;
      if (!m.boule.gouttiere && p.z <= -(DIM.longueurPiste - 0.3) && Math.abs(p.x) < 0.42 && m.boule.corps.velocity.length() > 1) return e;
    }
    return null;
  }
  const phys = new MondePhysique(SANS_ALEA);
  const e = new Entrainement('obstacle', phys, () => undefined);
  verifier('dix niveaux définis', NIVEAUX_OBSTACLES.length === 10);
  for (let i = 0; i < NIVEAUX_OBSTACLES.length; i++) {
    e.index = i;
    e.appliquerPiste(i);
    const niv = NIVEAUX_OBSTACLES[i];
    const physOk = phys.corpsObstacles.length === niv.obstacles.length && phys.obstaclesConfig.every((o) => Number.isFinite(o.z));
    // Aucun passage plus étroit que la boule (21,6 cm) + marge : trous entre obstacles d'une même ligne et bords de piste
    const lignes = {};
    for (const o of niv.obstacles) (lignes[o.f] || (lignes[o.f] = [])).push(o);
    let passageMin = Infinity;
    for (const liste of Object.values(lignes)) {
      const bornes = [[-0.527, -0.527], ...liste.map((o) => [o.x0, o.x1]).sort((a, b) => a[0] - b[0]), [0.527, 0.527]];
      for (let k = 0; k < bornes.length - 1; k++) { const trou = bornes[k + 1][0] - bornes[k][1]; if (trou > 0.001) passageMin = Math.min(passageMin, trou); }
    }
    const solution = franchissable(niv.obstacles);
    verifier('niveau ' + (i + 1) + ' « ' + niv.nom + ' » : ' + niv.obstacles.length + ' obstacle(s) posés, passage le plus étroit ' + Math.round(passageMin * 100) + ' cm, franchissable' + (solution ? ' (ex. position ' + solution.position.toFixed(1) + ', angle ' + solution.angle + '°, effet ' + solution.effet + ')' : ''), physOk && passageMin >= 0.28 && !!solution, JSON.stringify({ physOk, passageMin }));
  }
  e.appliquerPiste(0);
  const partie = new Partie(phys, () => undefined);
  partie.suivant = (res) => e.suivant(res);
  e.index = 0; e.preparer();
  jouer(phys, partie, { position: 0 });
  verifier('niveau 1 : une boule droite au centre est arrêtée par le mur central (0 quille)', e.resultats[0].tombees === 0, JSON.stringify(e.resultats[0]));
  e.appliquerPiste();
  verifier('niveau 2 appliqué au lancer suivant (barrière à gauche)', phys.obstaclesConfig.length === 1 && phys.obstaclesConfig[0].x0 < -0.5);
  e.index = 0; e.appliquerPiste(0);
  // Contourner par la droite : la boule (rayon 10,8 cm) doit passer à droite de x = 0,15 + 0,108
  jouer(phys, partie, { position: 0.9 });
  verifier('niveau 1 : en contournant par la droite, la boule touche des quilles', e.resultats[1].tombees >= 1, JSON.stringify(e.resultats[1]));
}

console.log(echecs ? '\n' + echecs + ' test(s) en échec' : '\nTous les tests d’entraînement passent.');
process.exit(echecs ? 1 : 0);
