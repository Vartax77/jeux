// Tests des règles et du score (cahier des charges §4.6). Lancer : node tests/score.test.mjs

import { nouvelleFeuille, enregistrerLancer, calculerScores, marques, estSplit, callout, jouerLancers, positionCourante, quillesAvantBoule, feuilleComplete, strikesConsecutifs, statistiques } from '../js/ecran/jeu/score.js';

let echecs = 0;
const verifier = (nom, cond, detail = '') => { console.log((cond ? '  ✓ ' : '  ✗ ') + nom + (cond ? '' : '   ' + detail)); if (!cond) echecs++; };
const total = (liste, n = 10) => calculerScores(jouerLancers(n, liste)).total;

console.log('Parties de test du cahier des charges');
verifier('12 strikes = 300', total(Array(12).fill(10)) === 300, String(total(Array(12).fill(10))));
verifier('dix frames « 9 puis spare » = 190', total([...Array(10).fill([9, 1]).flat(), 9]) === 190, String(total([...Array(10).fill([9, 1]).flat(), 9])));
verifier('que des gouttières = 0', total(Array(20).fill(0)) === 0);
const p165 = [10, 7, 3, 9, 0, 10, 10, 10, 2, 3, 6, 4, 7, 2, 10, 8, 1];
verifier('X, 7/, 9-, X, X, X, 2-3, 6/, 7-2, X-8-1 = 165', total(p165) === 165, String(total(p165)));
verifier('5 frames, 7 strikes = 150', total(Array(7).fill(10), 5) === 150, String(total(Array(7).fill(10), 5)));
verifier('5 frames, 6 strikes : dernière frame incomplète (120)', total(Array(6).fill(10), 5) === 120 && !feuilleComplete(jouerLancers(5, Array(6).fill(10))));

console.log('Marques');
{
  const f = jouerLancers(10, p165);
  const m = Array.from({ length: 10 }, (_, i) => marques(f, i).join(''));
  verifier('marques : X 7/ 9- X X X 23 6/ 72 X81', m.join(' ') === 'X 7/ 9- X X X 23 6/ 72 X81', m.join(' '));
  const sc = calculerScores(f);
  verifier('cumuls 20 39 48 78 100 115 120 137 146 165', sc.totaux.join(' ') === '20 39 48 78 100 115 120 137 146 165', sc.totaux.join(' '));
  verifier('feuille complète', feuilleComplete(f));
}
{
  const f = jouerLancers(10, [10, 10, 10, 0, 0]);
  const sc = calculerScores(f);
  verifier('cumuls 30, 50, 60, 60 puis inconnus', sc.totaux[0] === 30 && sc.totaux[1] === 50 && sc.totaux[2] === 60 && sc.totaux[3] === 60 && sc.totaux[4] === null, JSON.stringify(sc.totaux));
  verifier('total provisoire 60', sc.provisoire === 60, String(sc.provisoire));
  const g = jouerLancers(10, [10, 10]);
  const sg = calculerScores(g);
  verifier('deux strikes : frame 1 en attente, provisoire 30', sg.totaux[0] === null && sg.total === 0 && sg.provisoire === 30, JSON.stringify(sg));
  verifier('marques frame 4 : « -- »', marques(f, 3).join('') === '--', marques(f, 3).join(''));
}

console.log('Dernière frame');
{
  const f = nouvelleFeuille(10);
  for (let i = 0; i < 18; i++) enregistrerLancer(f, i % 2 ? 0 : 5); // 9 frames de 5-0
  let r = enregistrerLancer(f, 10);
  verifier('10e : strike boule 1 → rack, boule 2', r.strike && r.rackSuivant === 'rack' && positionCourante(f).boule === 2, JSON.stringify(r));
  r = enregistrerLancer(f, 10);
  verifier('10e : strike boule 2 → rack, boule 3', r.strike && r.rackSuivant === 'rack' && positionCourante(f).boule === 3, JSON.stringify(r));
  r = enregistrerLancer(f, 10);
  verifier('10e : 3 strikes → terminé, 45 + 30 = 75', r.termine && calculerScores(f).total === 75, JSON.stringify({ r, t: calculerScores(f).total }));
  verifier('marques XXX', marques(f, 9).join('') === 'XXX');
}
{
  const f = nouvelleFeuille(10);
  for (let i = 0; i < 18; i++) enregistrerLancer(f, 0);
  enregistrerLancer(f, 10);
  let r = enregistrerLancer(f, 7);
  verifier('10e : strike puis 7 → respot (3 quilles), boule 3', !r.strike && !r.spare && r.rackSuivant === 'respot' && quillesAvantBoule(f) === 3, JSON.stringify(r));
  r = enregistrerLancer(f, 3);
  verifier('10e : strike, 7, 3 = spare en boule 3, terminé, total 20', r.spare && r.termine && calculerScores(f).total === 20, JSON.stringify(r));
  verifier('marques X7/', marques(f, 9).join('') === 'X7/', marques(f, 9).join(''));
}
{
  const f = nouvelleFeuille(10);
  for (let i = 0; i < 18; i++) enregistrerLancer(f, 0);
  enregistrerLancer(f, 4);
  let r = enregistrerLancer(f, 6);
  verifier('10e : spare → rack, boule 3', r.spare && r.rackSuivant === 'rack' && positionCourante(f).boule === 3, JSON.stringify(r));
  r = enregistrerLancer(f, 10);
  verifier('10e : spare puis strike, terminé, total 20', r.strike && r.termine && calculerScores(f).total === 20, JSON.stringify(r));
  verifier('marques 4/X', marques(f, 9).join('') === '4/X', marques(f, 9).join(''));
}
{
  const f = nouvelleFeuille(10);
  for (let i = 0; i < 18; i++) enregistrerLancer(f, 0);
  enregistrerLancer(f, 3);
  const r = enregistrerLancer(f, 4);
  verifier('10e : deux boules simples → terminé sans 3e boule', r.termine && !r.rackSuivant && calculerScores(f).total === 7, JSON.stringify(r));
}
{
  const f = nouvelleFeuille(10);
  const r1 = enregistrerLancer(f, 6);
  verifier('frame 1 : 6 → respot, 4 debout', r1.rackSuivant === 'respot' && quillesAvantBoule(f) === 4);
  const r2 = enregistrerLancer(f, 4);
  verifier('frame 1 : 6 + 4 = spare → rack', r2.spare && r2.rackSuivant === 'rack');
  const r3 = enregistrerLancer(f, 10);
  verifier('frame 2 : strike → rack, frame 3', r3.strike && r3.rackSuivant === 'rack' && positionCourante(f).frame === 3);
  verifier('quilles plafonnées : lancer 9 sur 4 debout → 4', (() => { const g = nouvelleFeuille(10); enregistrerLancer(g, 6); return enregistrerLancer(g, 9).quilles === 4; })());
  const g0 = nouvelleFeuille(10); enregistrerLancer(g0, 0);
  const s0 = enregistrerLancer(g0, 10);
  verifier('0 puis 10 = spare (pas strike), marque -/', s0.spare && !s0.strike && marques(g0, 0).join('') === '-/', JSON.stringify(s0) + marques(g0, 0).join(''));
  const g1 = nouvelleFeuille(10); for (let i = 0; i < 18; i++) enregistrerLancer(g1, 0);
  enregistrerLancer(g1, 0); enregistrerLancer(g1, 10);
  const s1 = enregistrerLancer(g1, 10);
  verifier('10e : 0, 10, 10 = spare puis strike, marques -/X, total 20', s1.strike && marques(g1, 9).join('') === '-/X' && calculerScores(g1).total === 20, marques(g1, 9).join('') + ' ' + calculerScores(g1).total);
  const g2 = nouvelleFeuille(10); for (let i = 0; i < 18; i++) enregistrerLancer(g2, 0);
  enregistrerLancer(g2, 10); enregistrerLancer(g2, 0);
  const s2 = enregistrerLancer(g2, 10);
  verifier('10e : 10, 0, 10 = strike, 0, spare ; marques X-/, total 20', s2.spare && !s2.strike && marques(g2, 9).join('') === 'X-/' && calculerScores(g2).total === 20, marques(g2, 9).join('') + ' ' + calculerScores(g2).total);
}

console.log('Split, turkey, callouts');
{
  const tombees = (debout) => Array.from({ length: 10 }, (_, i) => !debout.includes(i + 1));
  verifier('7-10 : split', estSplit(tombees([7, 10])));
  verifier('4-6 : split', estSplit(tombees([4, 6])));
  verifier('2-7 : split', estSplit(tombees([2, 7])));
  verifier('4-6-7-10 : split', estSplit(tombees([4, 6, 7, 10])));
  verifier('3-10 : split', estSplit(tombees([3, 10])));
  verifier('4-7 : pas un split (adjacentes)', !estSplit(tombees([4, 7])));
  verifier('6-10 : pas un split', !estSplit(tombees([6, 10])));
  verifier('2-4-5-8 : pas un split (groupe connexe)', !estSplit(tombees([2, 4, 5, 8])));
  verifier('quille 1 debout : jamais un split', !estSplit(tombees([1, 7, 10])));
  verifier('une seule quille : pas un split', !estSplit(tombees([10])));
  const f = jouerLancers(10, [10, 10, 10]);
  verifier('3 strikes consécutifs', strikesConsecutifs(f) === 3);
  verifier('callout TURKEY au 3e strike', callout(f, { strike: true, quilles: 10, boule: 1 }).texte === 'TURKEY !');
  verifier('callout STRIKE au 1er', callout(jouerLancers(10, [10]), { strike: true, quilles: 10, boule: 1 }).texte === 'STRIKE !');
  verifier('callout SPLIT (boule 1, 7-10 debout)', callout(jouerLancers(10, [8]), { quilles: 8, boule: 1, tombees: tombees([7, 10]) }).texte === 'SPLIT');
  verifier('callout GOUTTIÈRE', callout(jouerLancers(10, [0]), { quilles: 0, boule: 1, gouttiere: true }).texte === 'GOUTTIÈRE');
  verifier('callout SPARE', callout(jouerLancers(10, [7, 3]), { spare: true, quilles: 3, boule: 2 }).texte === 'SPARE !');
  verifier('callout PARTIE PARFAITE', callout(jouerLancers(10, Array(12).fill(10)), { strike: true, quilles: 10, boule: 3 }).texte === 'PARTIE PARFAITE !');
  verifier('callout « 7 QUILLES »', callout(jouerLancers(10, [7]), { quilles: 7, boule: 1, tombees: tombees([4, 5, 8]) }).texte === '7 QUILLES');
  const st = statistiques(jouerLancers(10, p165));
  verifier('statistiques : 5 strikes, 2 spares, meilleur 10', st.strikes === 5 && st.spares === 2 && st.meilleur === 10, JSON.stringify(st));
}

console.log(echecs ? '\n' + echecs + ' test(s) en échec' : '\nTous les tests de score passent.');
process.exit(echecs ? 1 : 0);
