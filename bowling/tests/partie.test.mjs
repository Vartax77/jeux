// Test du cycle d'un lancer (machine à états), sans navigateur.
// Lancer : node tests/partie.test.mjs   (depuis le dossier bowling/)

import { MondePhysique } from '../js/ecran/jeu/physique.js';
import { Partie } from '../js/ecran/jeu/partie.js';

// Tests déterministes : pas d'aléa sur la masse des quilles
const SANS_ALEA = (id) => (id === 'aleaQuilles' ? 0 : undefined);
let echecs = 0;
const verifier = (nom, cond, detail = '') => { console.log((cond ? '  ✓ ' : '  ✗ ') + nom + (cond ? '' : '   ' + detail)); if (!cond) echecs++; };

const reglages = { dureeResultat: 1, dureeRemise: 1, distanceCoupeImpact: 2, delaiMaxQuilles: 4, sautsAutorises: true };
const phys = new MondePhysique(SANS_ALEA);
const partie = new Partie(phys, (id) => reglages[id]);
const phases = [];
const resultats = [];
partie.addEventListener('phase', (e) => phases.push(e.detail.phase));
partie.addEventListener('resultat', (e) => resultats.push(e.detail));

// Fait avancer le jeu pas à pas jusqu'à revenir en préparation (max 30 s simulées)
function jouerJusquaPreparation() {
  let t = 0;
  while (t < 30) {
    phys.avancer(1 / 60);
    partie.maj(1 / 60);
    t += 1 / 60;
    if (partie.phase === 'preparation') break;
  }
  return t;
}

console.log('Boule 1 dans la poche → strike → rack complet');
{
  partie.reglerVisee(0.06 / 0.399, 0);
  verifier('lancer accepté en préparation', partie.lancer({ puissance: 0.6, effet: 0, phase: 'normal', joueur: 'test', nom: 'Test' }));
  verifier('lancer refusé pendant le roulement', partie.lancer({ puissance: 0.6, effet: 0 }) === false);
  const t = jouerJusquaPreparation();
  verifier('cycle complet en moins de 12 s', t < 12, t.toFixed(1) + ' s');
  verifier('phases dans l’ordre', phases.join('>') === 'roulement>impact>resultat>remise>preparation', phases.join('>'));
  const r = resultats[0];
  verifier('résultat émis (strike)', r && r.strike && r.tombees === 10 && r.boule === 1, JSON.stringify(r));
  verifier('nouvelle frame, boule 1, 10 quilles', partie.boule === 1 && partie.frame === 2 && partie.debout === 10);
}

console.log('Boule 1 qui effleure la 7 → respot → boule 2');
{
  phases.length = 0;
  partie.reglerVisee(-0.44 / 0.399, 0);
  partie.lancer({ puissance: 0.5, effet: 0, phase: 'normal' });
  jouerJusquaPreparation();
  const r = resultats[1];
  verifier('quelques quilles tombées, pas strike', r && !r.strike && r.tombees >= 1 && r.tombees <= 7, JSON.stringify(r));
  verifier('boule 2, même frame, quilles restantes conservées', partie.boule === 2 && partie.frame === 2 && partie.debout === 10 - r.tombees, partie.boule + ' ' + partie.frame + ' ' + partie.debout);
  verifier('quilles debout replacées exactement', phys.quilles.filter((q) => q.presente).every((q) => Math.abs(q.corps.position.x - q.initiale.x) < 1e-9));
  partie.reglerVisee(0.06 / 0.399, 0);
  partie.lancer({ puissance: 0.6, effet: 0, phase: 'normal' });
  jouerJusquaPreparation();
  const r2 = resultats[2];
  verifier('boule 2 comptée par rapport aux quilles restantes', r2 && r2.boule === 2 && r2.tombees <= 10 - r.tombees, JSON.stringify(r2));
  verifier('après la boule 2 : frame suivante, rack complet', partie.boule === 1 && partie.frame === 3 && partie.debout === 10);
}

console.log('Gouttière et arrière');
{
  partie.reglerVisee(1, 3.5);
  partie.lancer({ puissance: 0.5, effet: 0, phase: 'normal' });
  jouerJusquaPreparation();
  const r = resultats[3];
  verifier('gouttière : 0 quille, drapeau gouttière', r && r.tombees === 0 && r.gouttiere, JSON.stringify(r));
  verifier('boule 2 avec 10 quilles', partie.boule === 2 && partie.debout === 10);
  partie.lancer({ puissance: 0.7, effet: 0, phase: 'arriere' });
  const t = jouerJusquaPreparation();
  const r2 = resultats[4];
  verifier('arrière : 0 quille, phase arriere', r2 && r2.tombees === 0 && r2.phaseLancer === 'arriere', JSON.stringify(r2));
  verifier('cycle terminé (pas de blocage)', t < 20 && partie.phase === 'preparation', t.toFixed(1));
}

console.log('Saut de phase');
{
  partie.reglerVisee(0.06 / 0.399, 0);
  partie.lancer({ puissance: 0.6, effet: 0, phase: 'normal' });
  phys.avancer(0.5); partie.maj(0.5);
  verifier('pendant le roulement, passer() compte immédiatement', partie.passer() && partie.phase === 'resultat', partie.phase);
  verifier('passer() en résultat → remise', partie.passer() && partie.phase === 'remise');
  verifier('passer() en remise → préparation', partie.passer() && partie.phase === 'preparation');
  reglages.sautsAutorises = false;
  partie.lancer({ puissance: 0.6, effet: 0, phase: 'normal' });
  verifier('sauts interdits : passer() refuse', partie.passer() === false);
  reglages.sautsAutorises = true;
  jouerJusquaPreparation();
}

console.log('Visée');
{
  partie.reglerVisee(0, 0);
  for (let i = 0; i < 30; i++) partie.viser('position', 1);
  for (let i = 0; i < 30; i++) partie.viser('angle', -1);
  verifier('bornes : position 1, angle −4', partie.visee.position === 1 && partie.visee.angle === -4, JSON.stringify(partie.visee));
  partie.viser('position', -1);
  verifier('pas de 0,05', partie.visee.position === 0.95);
}

console.log(echecs ? '\n' + echecs + ' test(s) en échec' : '\nTous les tests du cycle passent.');
process.exit(echecs ? 1 : 0);
