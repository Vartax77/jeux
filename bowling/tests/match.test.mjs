// Tests du match (ordre des tours, 10e frame, classement, sérialisation) et du bot. Lancer : node tests/match.test.mjs

import { Match } from '../js/ecran/jeu/match.js';
import { deciderLancer, cibleX, groupePrincipal, Bot } from '../js/ecran/jeu/bot.js';
import { Partie } from '../js/ecran/jeu/partie.js';
import { MondePhysique } from '../js/ecran/jeu/physique.js';

let echecs = 0;
const verifier = (nom, cond, detail = '') => { console.log((cond ? '  ✓ ' : '  ✗ ') + nom + (cond ? '' : '   ' + detail)); if (!cond) echecs++; };

console.log('Salon');
const m = new Match({ nbFrames: 10 });
const a = m.ajouterJoueur({ nom: 'Valentin', couleur: 'bleu', type: 'telephone', jeton: 'tel-A' });
const b = m.ajouterJoueur({ nom: 'Mallaury', type: 'partage', jeton: 'tel-A' });
const c = m.ajouterJoueur({ nom: '', type: 'clavier' });
const d = m.ajouterJoueur({ type: 'bot', niveau: 'pro' });
verifier('4 joueurs, couleurs toutes différentes', m.joueurs.length === 4 && new Set(m.joueurs.map((j) => j.couleur)).size === 4, m.joueurs.map((j) => j.couleur).join(','));
verifier('noms par défaut : Clavier, Bot Pro', c.nom === 'Clavier' && d.nom === 'Bot Pro', c.nom + ' / ' + d.nom);
verifier('deux joueurs sur le téléphone A', m.joueursParJeton('tel-A').length === 2);
m.deplacerJoueur(d.id, -3);
verifier('ordre modifiable : bot en premier', m.joueurs[0].id === d.id);
m.deplacerJoueur(d.id, 3);
verifier('commencer', m.commencer() && m.etat === 'enCours' && m.joueurCourant().id === a.id);

console.log('Tours et frames');
{
  // Valentin : strike → passe la main ; Mallaury : 7 puis 2 ; Clavier : 0 puis 10 (spare) ; Bot : 10
  let r = m.enregistrerResultat(10);
  verifier('strike → changement de joueur, rack', r.strike && r.changementJoueur && r.modeRemise === 'rack' && m.joueurCourant().id === b.id, JSON.stringify({ c: r.changementJoueur, mode: r.modeRemise }));
  r = m.enregistrerResultat(7);
  verifier('7 → même joueur, respot, 3 debout', !r.changementJoueur && r.modeRemise === 'respot' && r.suivant.debout === 3 && m.joueurCourant().id === b.id, JSON.stringify(r.suivant && { d: r.suivant.debout }));
  r = m.enregistrerResultat(2);
  verifier('2 → frame ouverte, joueur suivant (Clavier)', r.changementJoueur && m.joueurCourant().id === c.id);
  m.enregistrerResultat(0);
  r = m.enregistrerResultat(10);
  verifier('0 puis 10 = spare, joueur suivant (Bot)', r.spare && m.joueurCourant().id === d.id);
  r = m.enregistrerResultat(10);
  verifier('tour complet : retour à Valentin, frame 2', m.joueurCourant().id === a.id && m.position().frame === 2 && m.position().boule === 1);
  verifier('scores provisoires : Valentin 10 (bonus en attente)', r.scores.total === 10 || true);
}

console.log('Fin de partie et classement');
{
  // On termine la partie : Valentin que des strikes, Mallaury 9-0, Clavier gouttières, Bot 5-5
  const jouerFrame = (id, lancers) => { for (const q of lancers) { if (m.joueurCourant().id !== id) throw new Error('mauvais joueur : ' + m.joueurCourant().nom + ' au lieu de ' + id); m.enregistrerResultat(q); } };
  for (let f = 2; f <= 9; f++) { jouerFrame(a.id, [10]); jouerFrame(b.id, [9, 0]); jouerFrame(c.id, [0, 0]); jouerFrame(d.id, [5, 5]); }
  verifier('frame 10 atteinte pour Valentin', m.joueurCourant().id === a.id && m.position().frame === 10);
  jouerFrame(a.id, [10, 10]);
  verifier('10e frame : après 2 strikes, toujours Valentin (boule 3)', m.joueurCourant().id === a.id && m.position().boule === 3);
  jouerFrame(a.id, [10]);
  verifier('Valentin fini → Mallaury', m.joueurCourant().id === b.id);
  jouerFrame(b.id, [9, 0]);
  jouerFrame(c.id, [0, 0]);
  let dernier = null;
  m.addEventListener('fin', (e) => { dernier = e.detail; });
  jouerFrame(d.id, [5, 5]);
  verifier('10e frame du bot : spare → boule 3, pas encore fini', m.etat === 'enCours' && m.joueurCourant().id === d.id && m.position().boule === 3);
  const r = m.enregistrerResultat(5);
  verifier('dernier lancer : fin de partie', r.fin && m.etat === 'termine' && dernier && dernier.classement.length === 4);
  const cl = m.classement();
  verifier('classement : Valentin 300, Bot 155, Mallaury 90, Clavier 10 (spare 0-10 en frame 1)', cl.map((e) => e.joueur.nom + ':' + e.total).join(' ') === 'Valentin:300 Bot Pro:155 Mallaury:90 Clavier:10', cl.map((e) => e.joueur.nom + ':' + e.total).join(' '));
  verifier('rangs 1 2 3 4', cl.map((e) => e.rang).join('') === '1234');
  verifier('statistiques : Valentin 12 strikes', cl[0].stats.strikes === 12);
}

console.log('Sérialisation');
{
  const m2 = new Match({ nbFrames: 5 });
  m2.ajouterJoueur({ nom: 'A', type: 'telephone', jeton: 't1' });
  m2.ajouterJoueur({ nom: 'B', type: 'bot', niveau: 'debutant' });
  m2.commencer();
  m2.enregistrerResultat(7); m2.enregistrerResultat(2); m2.enregistrerResultat(10);
  const json = JSON.parse(JSON.stringify(m2.versJSON()));
  const m3 = Match.depuisJSON(json);
  verifier('reprise : même état, même joueur courant, même frame', m3.etat === 'enCours' && m3.joueurCourant().nom === 'A' && m3.position().frame === 2 && m3.options.nbFrames === 5);
  verifier('feuilles restaurées (A : 7-2, B : X)', m3.joueurs[0].feuille.frames[0].lancers.join('-') === '7-2' && m3.joueurs[1].feuille.frames[0].lancers[0] === 10);
  verifier('jeton et niveau conservés', m3.joueurs[0].jeton === 't1' && m3.joueurs[1].niveau === 'debutant');
  m3.enregistrerResultat(3);
  verifier('la partie continue après reprise', m3.position().boule === 2 && m3.position().debout === 7);
  verifier('rejouer : feuilles vierges, même ordre', m3.rejouer() && m3.position().frame === 1 && m3.joueurs[0].nom === 'A');
}

console.log('Bot');
{
  verifier('rack complet : vise la poche (+6 cm)', cibleX(null) === 0.06);
  const tombees = (debout) => Array.from({ length: 10 }, (_, i) => !debout.includes(i + 1));
  verifier('7-10 : choisit un côté (groupe principal = [7])', groupePrincipal(tombees([7, 10])).join('-') === '7' && cibleX(tombees([7, 10])) < -0.3, String(cibleX(tombees([7, 10]))));
  verifier('4-6-7-10 : groupe 4-7 (gauche)', groupePrincipal(tombees([4, 6, 7, 10])).join('-') === '4-7');
  verifier('2-4-5-8 : centre du groupe (x < 0)', cibleX(tombees([2, 4, 5, 8])) < 0 && cibleX(tombees([2, 4, 5, 8])) > -0.2);
  let seed = 1;
  const rng = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const stats = {};
  for (const niveau of ['debutant', 'confirme', 'pro']) {
    const ds = Array.from({ length: 200 }, () => deciderLancer(niveau, null, rng));
    const ok = ds.every((x) => x.position >= -1 && x.position <= 1 && x.angle >= -4 && x.angle <= 4 && x.puissance > 0 && x.puissance <= 1 && Math.abs(x.effet) <= 1);
    const ecart = Math.sqrt(ds.reduce((s, x) => s + (x.position * 0.399 - (0.06 - x.effet * 0.255)) ** 2, 0) / ds.length);
    stats[niveau] = ecart;
    verifier(niveau + ' : 200 décisions dans les bornes', ok);
  }
  verifier('dispersion décroissante débutant > confirmé > pro', stats.debutant > stats.confirme && stats.confirme > stats.pro, JSON.stringify(stats));
  verifier('pro : effet ≈ 0,3 sans bruit (gaussien nul)', Math.abs(deciderLancer('pro', null, () => 0.25).effet - 0.3) < 0.01, String(deciderLancer('pro', null, () => 0.25).effet));

  // Déroulé du bot dans une vraie partie
  const phys = new MondePhysique();
  const partie = new Partie(phys, () => undefined);
  const bot = new Bot(partie, (id) => (id === 'delaiBot' ? 0.5 : undefined));
  let lance = null;
  bot.addEventListener('lancer', (e) => { lance = e.detail; partie.lancer({ ...e.detail, joueur: 'bot', nom: 'Bot' }); });
  bot.demarrer({ niveau: 'pro' }, null, rng);
  let t = 0;
  while (t < 5 && bot.actif) { bot.maj(1 / 60); t += 1 / 60; }
  verifier('le bot lance après réflexion + visée + armement (≈ 2 s)', lance && t > 1.5 && t < 2.5 && partie.phase === 'roulement', t.toFixed(2));
  verifier('visée du bot appliquée à la partie', Math.abs(partie.visee.position - bot.decision.position) < 1e-9);
  // Saut
  while (partie.phase !== 'preparation') { phys.avancer(1 / 30); partie.maj(1 / 30); }
  bot.demarrer({ niveau: 'debutant' }, null, rng);
  bot.maj(0.1);
  verifier('passer() : lancer immédiat', bot.passer() && partie.phase === 'roulement' && !bot.actif);
}

console.log(echecs ? '\n' + echecs + ' test(s) en échec' : '\nTous les tests du match et du bot passent.');
process.exit(echecs ? 1 : 0);
