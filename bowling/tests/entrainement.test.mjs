// Tests des entraînements (racks, barrières, score, N rangées de quilles). Lancer : node tests/entrainement.test.mjs
import { MondePhysique, configurerDimensions, positionsQuilles, nbQuillesRangs } from '../js/ecran/jeu/physique.js';
import { Entrainement, CONFIGS_SPARES, rangsPuissance, barriereEffet } from '../js/ecran/jeu/entrainement.js';
import { Partie } from '../js/ecran/jeu/partie.js';

// Tests déterministes : pas d'aléa sur la masse des quilles
const SANS_ALEA = (id) => (id === 'aleaQuilles' ? 0 : undefined);
let echecs = 0;
const verifier = (nom, cond, detail = '') => { console.log((cond ? '  ✓ ' : '  ✗ ') + nom + (cond ? '' : '   ' + detail)); if (!cond) echecs++; };

console.log('Géométrie étendue');
verifier('13 rangées = 91 quilles', nbQuillesRangs(13) === 91 && positionsQuilles(13).length === 91);
verifier('rang 13 à 3,17 m derrière la quille 1', Math.abs(positionsQuilles(13)[90].z - positionsQuilles(13)[0].z + 12 * 0.3048 * Math.sqrt(3) / 2) < 1e-9);

console.log('Spares');
{
  const phys = new MondePhysique(SANS_ALEA);
  const partie = new Partie(phys, () => undefined);
  const e = new Entrainement('spares', phys, () => undefined);
  partie.suivant = (res) => e.suivant(res);
  e.preparer();
  verifier('rack 7-10 posé', phys.quilles.filter((q) => q.presente).map((q) => q.numero).join('-') === '7-10');
  // Lancer sur la 7 : pas un spare (la 10 reste)
  partie.reglerVisee(-0.44 / 0.399, 0);
  partie.lancer({ puissance: 0.6, effet: 0 });
  let t = 0; while (partie.phase !== 'preparation' && t < 30) { phys.avancer(1 / 30); partie.maj(1 / 30); t += 1 / 30; }
  verifier('lancer 1 : pas de spare, score 0, lancer 2/10', e.score === 0 && e.index === 1 && e.etat().lancer === 2, JSON.stringify(e.etat()));
  verifier('rack suivant posé (4-6-7-10)', phys.quilles.filter((q) => q.presente).map((q) => q.numero).join('-') === '4-6-7-10');
  // On simule un spare réussi : rack 6-7 (index 4) avec une quille seule…
  for (let i = e.index; i < 9; i++) e.suivant({ tombees: 0, debout: 2 });
  verifier('après 9 lancers : lancer 10/10, rack 6-10', e.index === 9 && e.rack().join('-') === '6-10');
  const suite = e.suivant({ tombees: 2, debout: 0 });
  verifier('dernier lancer réussi : score 1, terminé', e.score === 1 && e.termine && suite.fin && suite.reussi);
}

console.log('Lancers puissants');
{
  configurerDimensions({ longueurDeck: 3.6, largeurDeckExtra: 2.1 });
  const phys = new MondePhysique(() => undefined, { rangs: 13 });
  verifier('monde à 91 quilles', phys.quilles.length === 91);
  const e = new Entrainement('puissance', phys, () => undefined);
  e.preparer();
  verifier('lancer 1 : 10 quilles', phys.quilles.filter((q) => q.presente).length === 10);
  verifier('rangs 4 → 13', rangsPuissance(0) === 4 && rangsPuissance(9) === 13);
  // Une vraie boule dans la poche d'un rack de 10 sur ce monde étendu
  const partie = new Partie(phys, () => undefined);
  partie.suivant = (res) => e.suivant(res);
  e.preparer();
  partie.reglerVisee(0.06 / 0.399, 0);
  partie.lancer({ puissance: 0.9, effet: 0 });
  let t = 0; while (partie.phase !== 'preparation' && t < 30) { phys.avancer(1 / 30); partie.maj(1 / 30); t += 1 / 30; }
  verifier('lancer 1 compté (≥ 6 quilles), rack 2 = 15 quilles', e.score >= 6 && phys.quilles.filter((q) => q.presente).length === 15, e.score + ' / ' + phys.quilles.filter((q) => q.presente).length);
  // Rack de 91 quilles stable 5 s
  e.index = 9; e.preparer();
  verifier('rack 10 = 91 quilles', phys.quilles.filter((q) => q.presente).length === 91);
  phys.activerQuilles(); phys.simuler(5);
  verifier('91 quilles actives stables 5 s', phys.etatQuilles().nbTombees === 0, String(phys.etatQuilles().nbTombees));
  configurerDimensions({ longueurDeck: 0.95, largeurDeckExtra: 0 });
}

console.log('Contrôle de l’effet');
{
  const phys = new MondePhysique(SANS_ALEA);
  const e = new Entrainement('effet', phys, () => undefined);
  e.preparer();
  verifier('barrière posée', !!phys.barriere && phys.barriere.config.jusquA === 0.05);
  verifier('barrière plus longue au 10e lancer', barriereEffet(9).jusquA > barriereEffet(0).jusquA + 0.2);
  // Boule droite au centre : bloquée par la barrière → 0 quille
  const partie = new Partie(phys, () => undefined);
  partie.suivant = (res) => e.suivant(res);
  partie.reglerVisee(0, 0);
  partie.lancer({ puissance: 0.6, effet: 0 });
  let t = 0; while (partie.phase !== 'preparation' && t < 30) { phys.avancer(1 / 30); partie.maj(1 / 30); t += 1 / 30; }
  verifier('boule droite arrêtée par la barrière : 0 quille', e.resultats[0].tombees === 0, JSON.stringify(e.resultats[0]));
  // Boule à droite avec effet vers la gauche : passe et touche des quilles
  e.preparer();
  partie.reglerVisee(0.7, 0);
  partie.lancer({ puissance: 0.6, effet: -1 });
  t = 0; while (partie.phase !== 'preparation' && t < 30) { phys.avancer(1 / 30); partie.maj(1 / 30); t += 1 / 30; }
  verifier('boule à droite + effet gauche : passe la barrière et touche des quilles', e.resultats[1].tombees >= 1, JSON.stringify(e.resultats[1]));
}

console.log(echecs ? '\n' + echecs + ' test(s) en échec' : '\nTous les tests d’entraînement passent.');
process.exit(echecs ? 1 : 0);
