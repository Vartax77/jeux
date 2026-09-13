// Test de l'analyse du geste avec des données synthétiques.
// Lancer : node tests/geste.test.mjs   (depuis le dossier bowling/)

import { preparerEchantillon, nouveauGeste, ajouterAuGeste, terminerGeste, resultatGlisser } from '../js/ecran/geste.js';
import { defauts } from '../js/ecran/reglages.js';
import { matriceOrientation, appliquer } from '../js/commun/maths.js';

let echecs = 0;
function verifier(nom, condition, detail = '') {
  console.log((condition ? '  ✓ ' : '  ✗ ') + nom + (condition ? '' : '   ' + detail));
  if (!condition) echecs++;
}
const proche = (a, b, eps) => Math.abs(a - b) <= eps;

// Balancier synthétique : téléphone à plat (orientation nulle → repère téléphone = repère terrestre),
// mouvement arrière (−y) puis avant (+y), torsion autour de y, éventuelle montée (+z) à la fin.
function balancier({ dureeMs = 1000, aArriere = 8, aAvant = 15, torsionDegParS = 60, montee = 0, orientation = [0, 0, 0] }) {
  const ech = [];
  for (let t = 0; t <= dureeMs; t += 1000 / 60) {
    let ay = 0, az = 0;
    if (t < 300) ay = -aArriere;
    else if (t < 650) ay = accelAvant(aAvant);
    else az = montee;
    ech.push({ type: 'echantillon', seq: ech.length, t, dt: 16.67, a: [0, ay, az], ag: [0, ay, az + 9.81], r: [0, 0, torsionDegParS], o: orientation, pose: true });
  }
  return ech;
}
function accelAvant(aAvant) { return aAvant; }

function jouer(ech, tPose, tLeve, reglages, dir = null) {
  const prepares = ech.map(preparerEchantillon);
  const g = nouveauGeste(tPose, reglages, prepares[0], dir);
  for (const p of prepares) if (p.t >= tPose - 20) ajouterAuGeste(g, p);
  return terminerGeste(g, tLeve);
}

const R = defauts();

console.log('Orientation W3C');
{
  const M = matriceOrientation(0, 90, 0);        // téléphone debout, écran face à l'utilisateur
  const y = appliquer(M, [0, 1, 0]);             // l'axe long du téléphone pointe vers le haut
  verifier('beta=90° : axe y du téléphone → z terrestre', proche(y[2], 1, 1e-9) && proche(y[0], 0, 1e-9) && proche(y[1], 0, 1e-9), JSON.stringify(y));
  const M2 = matriceOrientation(0, 0, 0);
  const z = appliquer(M2, [0, 0, 1]);
  verifier('orientation nulle : identité', proche(z[2], 1, 1e-9), JSON.stringify(z));
}

console.log('Lancer normal (mode Relâcher)');
{
  const res = jouer(balancier({}), 0, 640, R);
  verifier('type lancer', res.type === 'lancer', JSON.stringify(res));
  verifier('puissance ≈ (15−4)/(32−4) = 0,39', proche(res.puissance, 11 / 28, 0.02), String(res.puissance));
  verifier('effet ≈ (38°−15)/(75−15) ≈ 0,39 (torsion 60°/s × 0,64 s)', proche(res.effet, (60 * 0.64 - 15) / 60, 0.06), String(res.effet) + ' torsion ' + res.torsion);
  verifier('phase normal', res.phase === 'normal', res.phase);
  verifier('instant retenu dans la fenêtre de tolérance', Math.abs(res.instant - 640) <= R.toleranceRelacher + 1, String(res.instant));
}

console.log('Lancer annulé');
{
  const court = jouer(balancier({}), 0, 100, R);
  verifier('maintien trop court → annulé', court.type === 'annule' && court.raison === 'tropCourt', JSON.stringify(court));
  const faible = jouer(balancier({ aArriere: 1, aAvant: 2 }), 0, 640, R);
  verifier('geste trop faible → annulé', faible.type === 'annule' && faible.raison === 'tropFaible', JSON.stringify(faible));
  const immobile = jouer(balancier({ aArriere: 0, aAvant: 0, torsionDegParS: 0 }), 0, 3000, R);
  verifier('immobile 3 s → annulé', immobile.type === 'annule', JSON.stringify(immobile));
}

console.log('Gags');
{
  const lob = jouer(balancier({ montee: 12 }), 0, 950, R);
  verifier('relâcher pendant une montée → lob', lob.type === 'lancer' && lob.phase === 'lob', JSON.stringify(lob));
  const dir = [0, 1, 0];
  const arriere = jouer(balancier({}), 0, 250, R, dir);
  verifier('relâcher pendant le mouvement arrière (sens calibré) → arriere', arriere.type === 'lancer' && arriere.phase === 'arriere', JSON.stringify(arriere));
  const sansCalib = jouer(balancier({}), 0, 250, R);
  verifier('même geste sans sens calibré → normal (jamais punir sur un doute)', sansCalib.type === 'lancer' && sansCalib.phase === 'normal', JSON.stringify(sansCalib));
  const gaucher = jouer(balancier({}), 0, 640, { ...R, main: 'gauche' });
  const droitier = jouer(balancier({}), 0, 640, R);
  verifier('gaucher : effet en miroir', proche(gaucher.effet, -droitier.effet, 1e-9), gaucher.effet + ' vs ' + droitier.effet);
  const inverse = jouer(balancier({}), 0, 640, { ...R, signeEffet: -1 });
  verifier('signeEffet −1 : effet inversé', proche(inverse.effet, -droitier.effet, 1e-9));
}

console.log('Mode Automatique');
{
  const auto = jouer(balancier({}), 0, 950, { ...R, modeLancer: 'automatique' }, [0, 1, 0]);
  verifier('instant retenu = pic de vitesse avant (vers 650 ms), pas le relâcher tardif', auto.type === 'lancer' && auto.instant > 550 && auto.instant < 720, JSON.stringify(auto));
  verifier('phase normal malgré un relâcher pendant la montée', auto.phase === 'normal', auto.phase);
}

console.log('Mode Glisser');
{
  const ok = resultatGlisser({ t: 0, dx: 30, dy: 300, duree: 150, vitesse: 2 }, R, 150);
  verifier('glissement vers le haut → lancer', ok.type === 'lancer' && ok.puissance > 0.5, JSON.stringify(ok));
  verifier('effet léger vers la droite', ok.effet > 0 && ok.effet < 0.3, String(ok.effet));
  const trop = resultatGlisser({ t: 0, dx: 0, dy: 10, duree: 50, vitesse: 0.2 }, R, 50);
  verifier('glissement trop court → annulé', trop.type === 'annule');
}

console.log(echecs ? '\n' + echecs + ' test(s) en échec' : '\nTous les tests passent.');
process.exit(echecs ? 1 : 0);
