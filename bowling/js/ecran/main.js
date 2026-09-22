// Écran (PC) — lot 3 : salon, partie à tours (téléphones, téléphone partagé, clavier, bots), score, sauvegarde.
// Ouvre la salle, accueille les manettes, détecte les lancers (lot 1), fait tourner le jeu 3D (lot 2),
// et orchestre la partie : tours, feuille de score, scoreboard, fin de partie, reprise après rafraîchissement.

import { COULEURS, couleurHex, VERSION, DELAI_OUBLI_PLACE_MIN } from '../commun/constantes.js';
import { TYPES } from '../commun/protocole.js';
import { vec } from '../commun/maths.js';
import { Salle, nouveauCode, codeValide } from './salle.js';
import { Reglages, rendrePanneau } from './reglages.js';
import { Profils } from './profils.js';
import { preparerEchantillon, nouveauGeste, ajouterAuGeste, terminerGeste, resultatGlisser } from './geste.js';
import { Banc, telecharger } from './banc.js';
import { MondePhysique, DIM } from './jeu/physique.js';
import { Partie } from './jeu/partie.js';
import { Hud } from './jeu/hud.js';
import { Clavier } from './jeu/clavier.js';
import { Match } from './jeu/match.js';
import { Bot } from './jeu/bot.js';
import { Scoreboard } from './jeu/scoreboard.js';
import { callout as calloutScore } from './jeu/score.js';
import { sauverPartie, chargerPartie, effacerPartie, resumerSauvegarde } from './jeu/sauvegarde.js';
import { Salon } from './salon.js';
import { Fin } from './fin.js';
import { AudioJeu } from './jeu/audio.js';
import { Entrainement, MODES, enregistrerScore, meilleursScores } from './jeu/entrainement.js';
import { configurerDimensions } from './jeu/physique.js';
import { Titre } from './titre.js';
import { ProfilsUI, niveau, estPro } from './profils-ui.js';
import { statistiques } from './jeu/score.js';
import qrcode from '../../lib/qrcode-generator.js';

const $ = (id) => document.getElementById(id);

// Étapes de calibrage : une consigne, un lancer. `mesure` extrait la grandeur retenue du résultat du geste.
const ETAPES_CALIB = {
  puissance: [
    { cle: 'lent', consigne: 'lance LENTEMENT', aide: 'un lancer tranquille, comme pour viser un spare', mesure: (r) => r.picA },
    { cle: 'moyen', consigne: 'lance NORMALEMENT', aide: 'ton geste habituel', mesure: (r) => r.picA },
    { cle: 'fort', consigne: 'lance FORT', aide: 'à pleine puissance, sans te faire mal', mesure: (r) => r.picA },
  ],
  lift: [
    { cle: 'gauche', consigne: 'lance en LIFTANT VERS LA GAUCHE', aide: 'ton lift maximal, la boule doit crocheter à gauche', mesure: (r) => (Number.isFinite(r.torsion) ? r.torsion : NaN) },
    { cle: 'droite', consigne: 'lance en LIFTANT VERS LA DROITE', aide: 'ton lift maximal, la boule doit crocheter à droite', mesure: (r) => (Number.isFinite(r.torsion) ? r.torsion : NaN) },
  ],
};

const reglages = new Reglages();
const lire = (id) => reglages.get(id);
const profils = new Profils();
const suivis = new Map();   // jeton → suivi (historique, geste, marqueurs…)
let adresseManette = localStorage.getItem('bowling.adresseManette') || adresseParDefaut();

// ---------- Utilitaires ----------

function adresseParDefaut() {
  const u = new URL(location.href);
  if (u.protocol === 'file:' || ['localhost', '127.0.0.1', '::1', '[::1]'].includes(u.hostname)) return '';
  return u.origin + u.pathname.replace(/[^/]*$/, '') + 'manette.html';
}

function nouveauSuivi() {
  return { historique: [], marqueurs: [], geste: null, timerFin: null, glisser: null, dernierEch: null, dernierResultat: null, calibration: null };
}

function reglagesEffectifs(j) {
  const p = profils.get(j.jeton);
  const eff = { ...reglages.valeurs };
  if (p && p.reglages) for (const [k, v] of Object.entries(p.reglages)) if (v != null && v !== '') eff[k] = v;
  if (!(p && p.reglages && p.reglages.main)) eff.main = j.main;
  return eff;
}

function configPour(j) {
  const eff = reglagesEffectifs(j);
  return { modeLancer: eff.modeLancer, freqArme: eff.freqArme, freqRepos: eff.freqRepos };
}

// Phase vue par une manette donnée.
function phaseManettePour(jm) {
  if (entrainement) return entrainement.termine ? 'fin' : (partie.peutLancer() ? 'preparation' : 'cinematique');
  if (match.etat === 'salon') return 'salon';
  if (match.etat === 'termine' || partie.verrouille) return 'fin';
  if (!partie.peutLancer()) return 'cinematique';
  return manetteDuJoueurCourant(jm) ? 'preparation' : 'attente';
}

// La manette jm est-elle celle du joueur courant (téléphone ou téléphone partagé) ?
function manetteDuJoueurCourant(jm) {
  const jc = match.joueurCourant();
  return !!(jc && (jc.type === 'telephone' || jc.type === 'partage') && jc.jeton === jm.jeton);
}

function etatPour(jm, message = '') {
  const sv = suivis.get(jm.jeton);
  if (sv && sv.calib) {
    const c = sv.calib;
    const e = ETAPES_CALIB[c.type][c.index];
    const texte = e ? 'Calibrage ' + (c.index + 1) + '/' + ETAPES_CALIB[c.type].length + ' : ' + e.consigne : 'Calibrage terminé';
    return { tonTour: !!jm.actif, phase: 'preparation', joueur: jm.nom, passe: '', premier: false, position: partie.visee.position, angle: partie.visee.angle, latence: jm.latence == null ? null : Math.round(jm.latence), message: texte };
  }
  const phase = phaseManettePour(jm);
  const jc = match.joueurCourant();
  const passe = phase === 'preparation' && attentePassage ? jc.nom : '';
  let texte = message;
  if (!texte && entrainement) texte = phase === 'preparation' ? entrainement.titre + ' · lancer ' + entrainement.etat().lancer + '/10' : '';
  else if (!texte) {
    if (phase === 'preparation') texte = passe ? '' : (jc && jc.type === 'partage' ? jc.nom + ' : ' : '') + 'À toi !';
    else if (phase === 'attente' && jc) texte = 'Au tour de ' + jc.nom;
    else texte = '';
  }
  return {
    tonTour: phase === 'preparation' && !!jm.actif && !attentePassage, phase, joueur: jc ? jc.nom : (entrainement ? entrainement.titre : ''), passe,
    premier: match.etat === 'salon' && salle.liste[0] === jm,
    position: partie.visee.position, angle: partie.visee.angle, latence: jm.latence == null ? null : Math.round(jm.latence), message: texte,
  };
}

function envoyerEtat(j, message = '') { salle.envoyer(j, { type: TYPES.ETAT, ...etatPour(j, message) }); }
function envoyerConfig(j) { salle.envoyer(j, { type: TYPES.CONFIG, ...configPour(j) }); }
function envoyerEtatATous(message = '') { for (const j of salle.liste) if (j.connecte) envoyerEtat(j, message); }

// ---------- Jeu : physique, cycle, HUD, clavier ----------

// Mode : partie (défaut) ou entraînement (index.html?mode=spares|puissance|effet)
const MODE = (() => { const m = new URL(location.href).searchParams.get('mode'); return m && MODES[m] ? m : 'partie'; })();
if (MODE === 'puissance') configurerDimensions({ longueurDeck: 3.6, largeurDeckExtra: 2.1 });
const RANGS = MODE === 'puissance' ? 13 : 4;
const phys = new MondePhysique(lire, { rangs: RANGS });
const partie = new Partie(phys, lire);
let entrainement = null;
const hud = new Hud($('hud'), lire);
const clavier = new Clavier(partie);
const bot = new Bot(partie, lire);
const scoreboard = new Scoreboard($('scoreboard'));
let match = new Match({ nbFrames: Number(lire('nbFrames')) || 10, gouttieresFermees: !!lire('gouttieresFermees') });
let dernierResultatMatch = null;   // résultat du match pour le dernier lancer
let attentePassage = false;         // téléphone partagé : « Passe le téléphone à … » affiché, lancer bloqué
let timerPassage = null;
let tourClavier = false;            // K : le clavier joue ce tour à la place d'une manette déconnectée
const dernierLanceurParJeton = new Map();
partie.verrouille = true;           // aucun lancer tant que la partie n'a pas commencé (salon)

// Rendu 3D : facultatif (sans WebGL, le banc et la salle fonctionnent quand même).
let scene = null, cameras = null, renderer = null, personnage = null, spectateurs = null;
const audio = new AudioJeu(lire);
const debloquerAudio = () => { if (audio.debloquer()) audio.majMusique(); };
window.addEventListener('pointerdown', debloquerAudio);
window.addEventListener('keydown', debloquerAudio);
const positionMain = { valeur: null };
let tempsGlobal = 0;
async function demarrerRendu() {
  try {
    const [{ creerRenderer, Scene3D }, { Cameras }] = await Promise.all([import('./jeu/scene.js'), import('./jeu/cameras.js')]);
    renderer = creerRenderer($('vue'));
    scene = new Scene3D(renderer, lire, { rangs: RANGS });
    cameras = new Cameras(scene.camera, renderer.domElement, lire);
    const { Personnage, Spectateurs } = await import('./jeu/personnage.js');
    personnage = new Personnage();
    scene.scene.add(personnage.groupe);
    spectateurs = new Spectateurs(36);
    spectateurs.groupe.visible = lire('spectateurs') !== false;
    scene.scene.add(spectateurs.groupe);
    redimensionner();
    cameras.definir(MODE === 'partie' ? 'titre' : 'preparation', contexteCamera(), true);
    if (MODE === 'partie') majPanneauAccueil(); else scene.majPanneau(MODES[MODE].titre);
  } catch (e) {
    scene = null; cameras = null; renderer = null;
    $('sans-webgl').classList.remove('cache');
    $('sans-webgl-detail').textContent = String(e && e.message ? e.message : e);
    console.error('Rendu 3D indisponible :', e);
  }
}

function redimensionner() {
  if (scene) scene.redimensionner(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', redimensionner);

function contexteCamera() {
  const b = phys.boule.corps.position;
  return { visee: partie.visee, boule: { x: b.x, y: b.y, z: b.z }, cote: partie.coteImpact };
}

const PLAN_PAR_PHASE = { preparation: 'preparation', roulement: 'roulement', impact: 'impact', resultat: 'resultat', ralenti: 'ralenti', remise: 'remise' };

partie.addEventListener('phase', (e) => {
  const { phase, boule, frame } = e.detail;
  const jc = match.joueurCourant();
  // Hors préparation, le HUD garde le nom du lanceur (le match a déjà pu passer au joueur suivant).
  const nom = phase === 'preparation' ? (jc ? jc.nom : '') : (partie.lance ? partie.lance.nom : (jc ? jc.nom : ''));
  hud.majEtat({ phase, boule, frame, debout: partie.debout, joueur: nom });
  if (cameras) cameras.definir(PLAN_PAR_PHASE[phase] || 'preparation', contexteCamera(), (phase === 'impact' && lire('planImpact') === 'cote') || phase === 'ralenti');
  if (phase === 'ralenti') hud.message('Ralenti', 1);
  if (phase !== 'preparation') { hud.majTour({}); envoyerEtatATous(); }
});
partie.addEventListener('lancer', (e) => {
  const l = e.detail.lance;
  if (personnage) personnage.lancer();
  hud.majEtat({ lanceur: l.nom });
  hud.message((l.phase === 'lob' ? 'Boule lobée · ' : l.phase === 'arriere' ? 'Boule en arrière · ' : '') + 'puissance ' + Math.round(l.puissance * 100) + ' % · effet ' + l.effet.toFixed(2).replace('.', ','), 2);
});

// Le match décide de la suite de chaque lancer (respot / rack, boule, frame, joueur) — appelé avant l'événement 'resultat'.
partie.suivant = (res) => {
  if (entrainement) return entrainement.suivant(res);
  if (match.etat !== 'enCours') return null;
  const r = match.enregistrerResultat(res.tombees);
  dernierResultatMatch = r;
  return { mode: r.modeRemise, boule: r.fin ? 1 : r.suivant.boule, frame: r.fin ? r.frame : r.suivant.frame, fin: r.fin };
};

partie.addEventListener('resultat', (e) => {
  const r = e.detail;
  const rm = dernierResultatMatch;
  let c;
  if (entrainement) {
    const dernier = entrainement.resultats[entrainement.resultats.length - 1];
    c = entrainement.mode === 'spares' ? (dernier && dernier.reussi ? { texte: 'SPARE !', classe: 'spare' } : { texte: r.tombees ? r.tombees + (r.tombees > 1 ? ' QUILLES' : ' QUILLE') : 'RATÉ', classe: r.tombees ? '' : 'zero' })
      : (r.debout === 0 && r.tombees >= 10 ? { texte: r.tombees + ' QUILLES — TOUT !', classe: 'strike' } : hud.texteResultat(r));
    hud.majEntrainement(entrainement.etat());
  } else if (rm && rm.joueur) c = calloutScore(rm.joueur.feuille, { quilles: r.tombees, strike: rm.strike, spare: rm.spare, tombees: r.quilles, gouttiere: r.gouttiere, phaseLancer: r.phaseLancer, boule: rm.boule });
  else c = hud.texteResultat(r);
  if (lire('calloutsActifs') !== false) hud.annoncer(c.texte, c.classe, Math.max(1.5, lire('dureeResultat') || 2.5));
  if (scene) scene.majPanneau(c.texte, { couleur: c.classe === 'strike' || c.classe === 'turkey' || c.classe === 'parfaite' ? '#ffd54a' : c.classe === 'spare' ? '#7ee2a2' : c.classe === 'gouttiere' || c.classe === 'zero' || c.classe === 'split' ? '#ff9a90' : '#ffb347', clignote: c.classe !== '' });
  hud.majEtat({ debout: r.debout });
  reagir(c, r);
  banc.noter((r.nom || 'Clavier') + ' : ' + r.tombees + ' quille' + (r.tombees > 1 ? 's' : '') + ' — ' + c.texte.toLowerCase());
  const jc = rm ? rm.joueur : null;
  if (jc && jc.jeton) banc.completerQuilles(jc.jeton, r.tombees);
  if (rm) {
    scoreboard.rendre(match);
    if (rm.fin) effacerPartie();
    else sauverPartie({ match: match.versJSON(), mode: rm.modeRemise, quillesDebout: rm.modeRemise === 'respot' ? r.quilles.map((t, i) => (t ? null : i + 1)).filter(Boolean) : null });
  }
  dernierResultatMatch = null;
});
partie.addEventListener('remise', () => { audio.jouer('pinsetter'); });

// Ralenti : sur strike/spare (ou toujours), rejoué depuis l'enregistrement de la physique, caméra de côté.
partie.ralenti = (res) => {
  if (!scene) return false;
  const mode = lire('ralentiStrike') || 'strike';
  if (mode === 'aucun') return false;
  if (mode === 'tous') return (res.tombees || 0) > 0;
  return !!(res.strike || res.spare) || (dernierResultatMatch && (dernierResultatMatch.strike || dernierResultatMatch.spare));
};

// Réactions du personnage, des spectateurs et de la foule selon le résultat.
function reagir(c, r) {
  const grand = c.classe === 'strike' || c.classe === 'turkey' || c.classe === 'parfaite';
  if (grand) { hud.confettis(c.classe === 'parfaite' ? 220 : c.classe === 'turkey' ? 130 : 80); }
  if (personnage) personnage.reagir(grand || c.classe === 'spare' ? 'joie' : (c.classe === 'gouttiere' || c.classe === 'zero' || c.classe === 'gag') ? 'deception' : 'hausse');
  if (spectateurs) spectateurs.reagir(c.classe === 'parfaite' || c.classe === 'turkey' ? 'ovation' : grand || c.classe === 'spare' ? 'acclamation' : c.classe === 'gag' ? 'rire' : (c.classe === 'gouttiere' || c.classe === 'zero') ? 'oh' : 'acclamation');
  if (!audio.ctx) return;
  if (c.classe === 'parfaite') { audio.jouer('jingle-parfait'); audio.jouer('foule-ovation'); }
  else if (c.classe === 'turkey') { audio.jouer('jingle-turkey'); audio.jouer('foule-ovation'); }
  else if (c.classe === 'strike') { audio.jouer('jingle-strike'); audio.jouer('foule-ovation'); }
  else if (c.classe === 'spare') { audio.jouer('jingle-spare'); audio.jouer('foule-acclamation'); }
  else if (c.classe === 'gag') { audio.jouer('foule-rire'); }
  else if (c.classe === 'gouttiere' || c.classe === 'zero') { audio.jouer('foule-oh'); }
  else if (c.classe === 'split') { audio.jouer('foule-oh'); }
  else audio.jouer('foule-acclamation', { gain: 0.3 + 0.07 * (r.tombees || 0) });
}

partie.addEventListener('preparation', (e) => {
  const jc = match.joueurCourant();
  hud.majEtat({ phase: 'preparation', boule: e.detail.boule, frame: e.detail.frame, debout: e.detail.debout, lanceur: '', joueur: jc ? jc.nom : (entrainement ? entrainement.titre : '') });
  if (entrainement) {
    if (entrainement.termine) terminerEntrainement();
    else { if (scene) scene.majBarriere(phys.barriere ? phys.barriere.config : null); hud.majEntrainement(entrainement.etat()); envoyerEtatATous(); }
    return;
  }
  if (match.etat === 'termine') { terminerPartie(); return; }
  if (match.etat === 'enCours') demarrerTour();
});

// ---------- Entraînement ----------

function demarrerEntrainement() {
  entrainement = new Entrainement(MODE, phys, lire);
  titre.afficher(false);
  salon.afficher(false);
  scoreboard.afficher(false);
  partie.verrouille = false;
  partie.reinitialiser();
  entrainement.preparer();
  partie.debout = phys.etatQuilles().nbDebout;
  hud.majEtat({ debout: partie.debout, joueur: entrainement.titre, boule: 1, frame: 1 });
  if (scene) scene.majBarriere(phys.barriere ? phys.barriere.config : null);
  hud.majEntrainement(entrainement.etat());
  hud.majTour({ titre: entrainement.titre, sous: MODES[MODE].description });
  setTimeout(() => hud.majTour({}), 4000);
  envoyerEtatATous();
  banc.noter('Entraînement : ' + entrainement.titre);
}

function terminerEntrainement() {
  partie.verrouille = true;
  const e = entrainement.etat();
  const nom = salle.liste[0] ? salle.liste[0].nom : 'Clavier';
  const record = enregistrerScore(MODE, e.score, nom);
  hud.majEntrainement(e);
  fin.afficherEntrainement(e, record, { recommencer: () => location.reload(), menu: () => { location.href = 'index.html'; } });
  envoyerEtatATous();
}
partie.addEventListener('visee', () => {
  hud.majVisee(partie.visee);
  envoyerEtatATous();
});

// ---------- Tours ----------

// Qui a le droit de lancer maintenant ? source : 'clavier' | 'telephone' (avec jeton) | 'bot'
function lancerAutorise(source, jeton = null) {
  if (entrainement) return !entrainement.termine && partie.peutLancer() && source !== 'bot';
  const jc = match.joueurCourant();
  if (!jc || !partie.peutLancer()) return false;
  if (source === 'bot') return jc.type === 'bot';
  if (source === 'clavier') return jc.type === 'clavier' || tourClavier || !!lire('clavierPourTous');
  if (source === 'telephone') return (jc.type === 'telephone' || jc.type === 'partage') && jc.jeton === jeton && !attentePassage && !tourClavier;
  return false;
}

function demarrerTour() {
  const jc = match.joueurCourant();
  if (!jc) return;
  if (lire('recentrerVisee') !== false) partie.reglerVisee(0, 0);
  clearTimeout(timerPassage);
  attentePassage = false;
  tourClavier = false;
  bot.arreter();
  if (scene) scene.couleurBoule(couleurHex(jc.couleur), joueurPro(jc));
  if (scene) { const pos0 = match.position(); scene.majPanneau(jc.nom + ' · frame ' + (pos0 ? pos0.frame : 1) + ' · boule ' + (pos0 ? pos0.boule : 1)); }
  if (personnage) personnage.appliquerProfil(profilPersonnage(jc));
  scoreboard.rendre(match);
  const pos = match.position();
  hud.majEtat({ phase: 'preparation', boule: pos ? pos.boule : 1, frame: pos ? pos.frame : 1, debout: partie.debout, joueur: jc.nom });
  if (jc.type === 'bot') {
    bot.demarrer(jc, partie.debout === 10 ? null : phys.etatQuilles().tombees);
    hud.majTour({ titre: jc.nom + ' joue…', sous: 'Espace ou un toucher : passer', classe: 'bot' });
  } else if (jc.type === 'telephone' || jc.type === 'partage') {
    const manette = salle.joueurs.get(jc.jeton);
    const partage = match.joueursParJeton(jc.jeton).length > 1;
    if (partage && manette && manette.connecte && dernierLanceurParJeton.get(jc.jeton) !== jc.id && (lire('delaiPassage') || 0) > 0) {
      attentePassage = true;
      majBanniereTour();
      timerPassage = setTimeout(() => { attentePassage = false; if (match.joueurCourant() === jc && partie.peutLancer()) { majBanniereTour(); envoyerEtatATous(); } }, (lire('delaiPassage') || 0) * 1000);
    } else {
      majBanniereTour();
    }
  } else {
    hud.majTour({ titre: 'À toi, ' + jc.nom, sous: 'Au clavier : ← → Q D pour viser, Espace pour lancer' });
  }
  envoyerEtatATous();
}

// Joueur « Pro » (expérience) → boule spéciale.
function joueurPro(j) {
  const p = (j.jeton && profils.get(j.jeton)) || profils.parNom(j.nom);
  return !!(p && p.stats && estPro(p.stats.xp));
}

// Apparence du personnage d'un joueur (couleur du joueur ; coiffure, teint et visage depuis le profil écran, lot 5).
function profilPersonnage(j) {
  const p = (j.jeton && profils.get(j.jeton)) || profils.parNom(j.nom) || null;
  return { nom: j.nom, couleur: couleurHex(j.couleur), main: j.main, coiffure: (p && p.coiffure) || (j.type === 'bot' ? 'casquette' : 'court'), teint: (p && p.teint) || 'medium', textureVisage: p && p.photo ? textureDepuisImage(p.photo) : null };
}
const cacheTextures = new Map();
function textureDepuisImage(dataUrl) {
  if (!scene || !dataUrl) return null;
  if (cacheTextures.has(dataUrl)) return cacheTextures.get(dataUrl);
  const t = scene.textureImage(dataUrl);
  cacheTextures.set(dataUrl, t);
  return t;
}

// Bandeau du tour d'un joueur téléphone (connecté ou non).
function majBanniereTour() {
  const jc = match.joueurCourant();
  if (!jc || !partie.peutLancer()) return;
  if (jc.type !== 'telephone' && jc.type !== 'partage') return;
  const manette = salle.joueurs.get(jc.jeton);
  if (tourClavier) hud.majTour({ titre: 'Tour de ' + jc.nom + ' au clavier', sous: 'K : rendre la main au téléphone' });
  else if (!manette || !manette.connecte) hud.majTour({ titre: 'Manette de ' + jc.nom + ' déconnectée', sous: 'Reprise automatique à la reconnexion · K : jouer ce tour au clavier', classe: 'alerte' });
  else if (attentePassage) hud.majTour({ titre: 'Passe le téléphone à ' + jc.nom, sous: 'téléphone de ' + manette.nom, classe: 'passage' });
  else hud.majTour({ titre: 'À toi, ' + jc.nom, sous: match.joueursParJeton(jc.jeton).length > 1 ? 'téléphone de ' + manette.nom : '' });
}

// Au départ, chaque téléphone est dans la main de son propriétaire (le joueur « téléphone » de ce jeton).
function initialiserPorteurs() {
  dernierLanceurParJeton.clear();
  for (const j of match.joueurs) if (j.type === 'telephone') dernierLanceurParJeton.set(j.jeton, j.id);
}

function demarrerPartie() {
  if (!match.commencer()) { hud.message('Ajoute au moins un joueur', 2); return; }
  initialiserPorteurs();
  effacerPartie();
  phys.reglerBumpers(!!lire('gouttieresFermees'));
  partie.verrouille = false;
  salon.afficher(false);
  fin.cacher();
  scoreboard.afficher(true);
  partie.reinitialiser();
  demarrerTour();
  banc.noter('Partie commencée : ' + match.joueurs.map((j) => j.nom).join(', '));
}

function reprendrePartie() {
  const sauv = chargerPartie();
  if (!sauv) { hud.message('Aucune partie sauvegardée', 2); return; }
  lierMatch(Match.depuisJSON(sauv.match));
  initialiserPorteurs();
  for (const j of match.joueurs) if (j.type === 'telephone' || j.type === 'partage') j.connecte = !!(salle.joueurs.get(j.jeton) && salle.joueurs.get(j.jeton).connecte);
  const pos = match.position();
  partie.verrouille = false;
  salon.afficher(false);
  fin.cacher();
  scoreboard.afficher(true);
  partie.reprendre({ quillesDebout: sauv.mode === 'respot' ? sauv.quillesDebout : null, boule: pos ? pos.boule : 1, frame: pos ? pos.frame : 1 });
  demarrerTour();
  banc.noter('Partie reprise : ' + resumerSauvegarde(sauv));
}

function terminerPartie() {
  partie.verrouille = true;
  bot.arreter();
  hud.majTour({});
  scoreboard.rendre(match);
  const cl = match.classement();
  const gains = {};
  for (const e of cl) {
    const j = e.joueur;
    if (j.type === 'bot') continue;
    const cle = j.type === 'telephone' && j.jeton ? j.jeton : ('nom:' + j.nom.trim().toLowerCase());
    if (!profils.get(cle)) profils.assurerParNom(j.nom);
    const avant = (profils.get(cle) && profils.get(cle).stats && profils.get(cle).stats.xp) || 0;
    const st = profils.enregistrerPartie(cle, { total: e.total, strikes: e.stats.strikes, spares: e.stats.spares, meilleur: e.stats.meilleur });
    if (st) gains[j.id] = { xp: st.xp - avant, niveau: niveau(st.xp) };
  }
  fin.afficher(cl, match.options.nbFrames, gains);
  banc.noter('Partie terminée : ' + cl.map((e) => e.joueur.nom + ' ' + e.total).join(', '));
  envoyerEtatATous();
}

function rejouer() {
  fin.cacher();
  demarrerPartie();
}

function retourSalon() {
  bot.arreter();
  partie.verrouille = true;
  fin.cacher();
  titre.afficher(false);
  if (cameras) cameras.definir('preparation', contexteCamera(), true);
  scoreboard.afficher(false);
  hud.majTour({});
  const options = { nbFrames: Number(lire('nbFrames')) || 10, gouttieresFermees: !!lire('gouttieresFermees') };
  const precedent = match;
  lierMatch(new Match(options));
  // Les joueurs précédents (hors partagés déconnectés) reviennent dans le salon, dans le même ordre
  for (const j of precedent.joueurs) {
    if ((j.type === 'telephone' || j.type === 'partage') && !salle.joueurs.get(j.jeton)) continue;
    match.ajouterJoueur({ nom: j.nom, couleur: j.couleur, type: j.type, jeton: j.jeton, niveau: j.niveau, main: j.main });
  }
  for (const jm of salle.liste) assurerJoueurTelephone(jm);
  partie.reinitialiser();
  salon.afficher(true);
  envoyerEtatATous();
}

function lierMatch(nouveau) {
  match = nouveau;
  match.addEventListener('joueurs', () => { if (match.etat === 'salon') envoyerEtatATous(); });
}
lierMatch(match);

// Dans le salon, chaque téléphone connecté est un joueur.
function assurerJoueurTelephone(jm) {
  if (match.etat !== 'salon') return;
  const existant = match.joueurs.find((j) => j.type === 'telephone' && j.jeton === jm.jeton);
  if (existant) { match.modifierJoueur(existant.id, { nom: jm.nom, couleur: jm.couleur, main: jm.main, connecte: true }); return; }
  match.ajouterJoueur({ nom: jm.nom, couleur: jm.couleur, type: 'telephone', jeton: jm.jeton, main: jm.main });
}

// ---------- Entrées : clavier, bot ----------

clavier.addEventListener('lancer', (e) => {
  const d = e.detail;
  if (!partie.peutLancer()) { if (match.etat === 'salon') hud.message('Commence une partie dans le salon', 2.5); return; }
  if (!lancerAutorise('clavier')) { hud.message('Ce n’est pas au clavier de jouer (K : prendre ce tour)', 2.5); return; }
  const jc = match.joueurCourant();
  if (entrainement && scene) scene.couleurBoule(couleurHex(COULEURS[0]));
  if (jc && jc.jeton) dernierLanceurParJeton.set(jc.jeton, jc.id);
  partie.lancer({ puissance: d.puissance, effet: d.effet, phase: d.phase, joueur: jc ? jc.id : 'clavier', nom: jc ? jc.nom : 'Clavier' });
});
clavier.addEventListener('passer', () => passer());
clavier.addEventListener('jauge', () => { if (personnage) personnage.armer(true); audio.jouer('clic'); });
clavier.addEventListener('gag', () => hud.majGag(clavier.gag));

function passer() {
  if (bot.actif) { if (bot.passer()) hud.message('Passé', 0.8); return true; }
  if (partie.passer()) { hud.message('Passé', 0.8); return true; }
  return false;
}

bot.addEventListener('lancer', (e) => {
  if (!lancerAutorise('bot')) return;
  const jc = match.joueurCourant();
  partie.lancer({ ...e.detail, joueur: jc.id, nom: jc.nom });
});

function basculerTourClavier() {
  const jc = match.joueurCourant();
  if (!jc || (jc.type !== 'telephone' && jc.type !== 'partage') || !partie.peutLancer()) { hud.message('K : seulement pendant le tour d’un joueur téléphone', 2); return; }
  tourClavier = !tourClavier;
  attentePassage = false;
  clearTimeout(timerPassage);
  majBanniereTour();
  envoyerEtatATous();
}

// Raccourcis d'interface (hors jeu) : Échap réglages, C banc, V caméra libre, F plein écran, H aide, J rejoindre
window.addEventListener('keydown', (e) => {
  const t = e.target;
  if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA')) { if (e.key === 'Escape') { t.blur(); } return; }
  switch (e.key) {
    case 'Escape': basculerTiroir(); break;
    case 'c': case 'C': banc.basculer(); break;
    case 'v': case 'V': if (cameras) hud.message(cameras.basculerLibre() ? 'Caméra libre : souris pour tourner, molette pour zoomer, V pour revenir' : 'Caméra du jeu', 2.5); break;
    case 'f': case 'F': basculerPleinEcran(); break;
    case 'h': case 'H': hud.basculerAide(); break;
    case 'j': case 'J': hud.basculerRejoindre(); break;
    case 'k': case 'K': basculerTourClavier(); break;
    case '+': case '=': zoomPreparation(1); break;
    case '-': zoomPreparation(-1); break;
    case 't': case 'T': basculerVueDessus(); break;
    case 'm': case 'M': if (entrainement) location.href = 'index.html'; else if (titre.visible) titre.afficher(false); else allerAuTitre(); break;
    default: break;
  }
});

function basculerPleinEcran() {
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  else document.documentElement.requestFullscreen().catch(() => hud.message('Plein écran refusé par le navigateur', 2));
}
$('btn-plein-ecran').addEventListener('click', basculerPleinEcran);
window.addEventListener('pointerdown', () => { if (lire('pleinEcranAuto') && !document.fullscreenElement && !pleinEcranTente) { pleinEcranTente = true; basculerPleinEcran(); } }, { once: false });
let pleinEcranTente = false;

// Bandeau haut : visible tant que la souris bouge, puis s'estompe.
let timerBandeau = null;
window.addEventListener('pointermove', () => {
  $('version').closest('header').classList.add('visible');
  clearTimeout(timerBandeau);
  timerBandeau = setTimeout(() => $('version').closest('header').classList.remove('visible'), 2500);
});

// ---------- Boucle ----------

let derniereImage = performance.now();
function boucle(maintenant) {
  const dt = Math.min(0.05, Math.max(0, (maintenant - derniereImage) / 1000));
  derniereImage = maintenant;
  if (!document.hidden) {
    clavier.maj(dt);
    bot.maj(dt);
    phys.avancer(dt);
    partie.maj(dt);
  }
  hud.majJauge(bot.actif ? bot.jauge() : clavier.jauge);
  tempsGlobal += dt;
  suivreSons(dt);
  enregistrerTrace();
  if (scene) {
    if (partie.phase === 'ralenti') {
      const img = phys.imageEnregistree(partie.chrono * (Number(lire('vitesseRalenti')) || 0.35));
      if (img) scene.synchroniserDepuisImage(img); else scene.synchroniser(phys);
    } else scene.synchroniser(phys);
    scene.animerLed(tempsGlobal);
    scene.afficherTrace(partie.phase === 'preparation' && lire('traceDernierLancer') !== false);
    if (personnage) {
      personnage.placer(partie.visee.position * (DIM.largeurPiste / 2 - DIM.rayonBoule - 0.02));
      personnage.animer(dt, tempsGlobal);
      positionMain.valeur = partie.phase === 'preparation' ? personnage.positionMain(positionMain.valeur || undefined) : null;
    }
    if (spectateurs) spectateurs.animer(dt, tempsGlobal);
    scene.majPreparation(partie.visee, partie.phase === 'preparation', positionMain.valeur);
    if (partie.phase === 'remise') scene.animerRemise(Math.min(1, partie.chrono / Math.max(0.1, lire('dureeRemise') || 2.6)), partie.modeRemise);
    else scene.animerRemise(0, 'rack');
    cameras.maj(dt, contexteCamera());
    scene.rendre();
  }
  if (banc.ouvert) banc.dessinerGraphiques();
  requestAnimationFrame(boucle);
}
document.addEventListener('visibilitychange', () => { derniereImage = performance.now(); });

// ---------- Bras du personnage piloté par le téléphone ----------

// Le bras suit la rotation accumulée du téléphone autour de l'axe du balancier depuis la pose du pouce.
// On intègre la vitesse angulaire (remise à zéro à chaque geste) : indépendant de la façon de tenir le
// téléphone, et sans dérive sensible sur la seconde que dure un geste.
function majBrasPersonnage(j, s, p) {
  if (!s.geste || s.geste.termine) return;
  if (!p.r || !Number.isFinite(p.r[0]) || !Number.isFinite(p.r[1]) || !Number.isFinite(p.r[2])) return; // pas de gyroscope : animation scriptée
  const dt = Math.min(0.1, Math.max(0, (p.dt || 16.7) / 1000));
  // Rotation accumulée depuis la pose du pouce, sur les trois axes du téléphone (°)
  const acc = s.angleBras || (s.angleBras = [0, 0, 0]);
  for (let k = 0; k < 3; k++) acc[k] += p.r[k] * dt;
  // Extrêmes par axe, pour le calibrage (quel axe porte le balancier, dans quel sens, avec quelle amplitude)
  const ext = s.brasExtremes || (s.brasExtremes = [[0, 0], [0, 0], [0, 0]]);
  for (let k = 0; k < 3; k++) { ext[k][0] = Math.min(ext[k][0], acc[k]); ext[k][1] = Math.max(ext[k][1], acc[k]); }
  if (!personnage) return;
  const jc = match.joueurCourant();
  const cest_lui = s.calib || (jc && jc.jeton === j.jeton) || !!lire('clavierPourTous');
  if (!cest_lui) return;
  const eff = reglagesEffectifs(j);
  const gain = Number(eff.gainBrasGeste);
  if (!(gain > 0)) return;
  const axe = [0, 1, 2].includes(Number(eff.axeBras)) ? Number(eff.axeBras) : 1;
  const signe = (Number(eff.signeBrasGeste) === -1 ? -1 : 1);
  const angle = Math.max(-150, Math.min(110, acc[axe] * gain * signe)) * Math.PI / 180;
  personnage.piloterBras(angle);
  if (s.calib) hud.majTour({ titre: hud.pTourTitre.textContent, sous: 'bras : ' + Math.round(angle * 180 / Math.PI) + '°' + (angle < -0.2 ? ' (en arrière)' : angle > 0.2 ? ' (devant)' : ''), classe: 'passage' });
}

// ---------- Trace du dernier lancer ----------

const trace = { points: [], dernierZ: null, couleur: '#ffffff' };
function enregistrerTrace() {
  const b = phys.boule;
  if (!b.enJeu || b.termine) return;
  const p = b.corps.position;
  if (p.z > 0.2 || p.z < -DIM.longueurPiste - 0.3) return;
  if (trace.dernierZ === null || trace.dernierZ - p.z >= 0.25) { trace.points.push({ x: p.x, z: p.z }); trace.dernierZ = p.z; }
}
partie.addEventListener('lancer', () => { trace.points = []; trace.dernierZ = null; if (scene) { trace.couleur = '#' + scene.matBoule.color.getHexString(); scene.majTrace(null); } });
partie.addEventListener('resultat', () => { if (scene && trace.points.length > 1) scene.majTrace(trace.points, trace.couleur); });

// ---------- Zoom et vue du dessus (préparation) ----------

function zoomPreparation(sens) {
  const v = Math.min(7, Math.max(1.2, (Number(lire('reculPreparation')) || 3.1) - sens * 0.3));
  reglages.set('reculPreparation', Math.round(v * 10) / 10);
  hud.message('Recul caméra : ' + v.toFixed(1).replace('.', ',') + ' m', 1);
}
function basculerVueDessus() {
  reglages.set('vueDessus', !lire('vueDessus'));
  hud.message(lire('vueDessus') ? 'Vue du dessus (T pour revenir)' : 'Vue normale', 1.5);
}
window.addEventListener('wheel', (e) => {
  if (!partie.peutLancer() || e.target.closest('#banc, #tiroir, #salon, #fin, #titre, #profils')) return;
  zoomPreparation(e.deltaY < 0 ? 1 : -1);
}, { passive: true });

// ---------- Sons liés à la physique ----------

const sons = { roulement: false, impact: false, gouttiere: false, yPrec: 0, vyPrec: 0 };
function suivreSons() {
  const b = phys.boule;
  if (!audio.ctx) return;
  if (b.enJeu && !b.termine) {
    if (!sons.roulement) { audio.demarrerRoulement(); sons.roulement = true; sons.impact = false; sons.gouttiere = false; }
    const p = b.corps.position, v = b.corps.velocity;
    const surSol = p.y < DIM.rayonBoule + 0.03;
    audio.majRoulement(v.length(), surSol);
    if (b.gouttiere && !sons.gouttiere) { sons.gouttiere = true; audio.jouer('gouttiere'); }
    if (b.enLAir && surSol && sons.vyPrec < -1 && v.y > -0.5) audio.jouer('rebond');
    sons.vyPrec = v.y;
  } else if (sons.roulement) { audio.arreterRoulement(); sons.roulement = false; }
  // Chocs synchronisés sur les contacts réels (au plus 6 par image pour ne pas saturer)
  const chocs = phys.prendreChocs();
  let joues = 0;
  for (const c of chocs) {
    if (joues >= 6) break;
    audio.jouer('choc-' + c.type, { vitesse: c.force });
    joues++;
  }
}

// ---------- Salle ----------

const salle = new Salle({ serveur: reglages.get('serveurSignalisation') || '', delaiOubliMin: reglages.get('delaiPlace') || DELAI_OUBLI_PLACE_MIN });
const banc = new Banc({ salle, profils, reglages, suivis, reglagesEffectifs, envoyerEtat, envoyerConfig, demarrerCalibration, demarrerCalibrage, refaireEtapeCalibrage, ETAPES_CALIB });
const salon = new Salon($('salon'), {
  match: () => match, salle, lire, regler: (id, v) => { reglages.set(id, v); apresChangementReglages(); },
  commencer: demarrerPartie, reprendre: reprendrePartie, effacerSauvegarde: effacerPartie,
  sauvegarde: () => { const s = chargerPartie(); return s ? { resume: resumerSauvegarde(s) } : null; },
});
const fin = new Fin($('fin'), { rejouer, salon: retourSalon });
const titre = new Titre($('titre'), {
  lire, nouvellePartie: () => { titre.afficher(false); retourSalon(); }, entrainement: (mode) => { location.href = 'index.html?mode=' + mode; },
  profils: () => profilsUI.afficher(true), reglages: () => basculerTiroir(true), calibrage: () => banc.basculer(true),
  reprendre: () => { titre.afficher(false); reprendrePartie(); }, sauvegarde: () => { const s = chargerPartie(); return s ? { resume: resumerSauvegarde(s) } : null; },
});
const profilsUI = new ProfilsUI($('profils'), { profils, fermer: () => profilsUI.afficher(false), apresModification: () => { cacheTextures.clear(); banc.redessinerProfils(); } });

function majPanneauAccueil() { if (scene) scene.majPanneau(String(lire('nomJeu') || 'Bowling') + ' · bienvenue'); }
function allerAuTitre() {
  if (match.etat === 'enCours') { if (!confirm('Abandonner la partie en cours ?')) return; effacerPartie(); }
  bot.arreter();
  partie.verrouille = true;
  fin.cacher();
  salon.afficher(false);
  scoreboard.afficher(false);
  hud.majTour({});
  lierMatch(new Match({ nbFrames: Number(lire('nbFrames')) || 10, gouttieresFermees: !!lire('gouttieresFermees') }));
  partie.reinitialiser();
  if (cameras) cameras.definir('titre', contexteCamera(), true);
  majPanneauAccueil();
  titre.afficher(true);
  envoyerEtatATous();
}

salle.addEventListener('ouverte', (e) => {
  localStorage.setItem('bowling.salle', e.detail.code);
  afficherCode(e.detail.code);
});
salle.addEventListener('code-indisponible', () => { salle.ouvrir(nouveauCode()); });
salle.addEventListener('signalisation', (e) => {
  const b = $('badge-signalisation');
  b.textContent = 'Signalisation : ' + (e.detail.etat === 'connecte' ? 'connectée' : 'déconnectée');
  b.className = 'etiquette ' + (e.detail.etat === 'connecte' ? 'ok' : 'ko');
});
salle.addEventListener('erreur', (e) => { banc.noter('Erreur réseau (' + e.detail.type + ') : ' + e.detail.message); hud.message('Réseau : ' + e.detail.message, 4); });
salle.addEventListener('refus', (e) => {
  banc.noter('Connexion refusée pour « ' + (e.detail.nom || '?') + ' » : ' + (e.detail.raison === 'sallePleine' ? 'salle pleine (4 manettes)' : 'version du protocole différente'));
});
salle.addEventListener('joueur-arrive', (e) => {
  const j = e.detail.joueur;
  profils.assurer(j);
  if (!suivis.has(j.jeton)) suivis.set(j.jeton, nouveauSuivi());
  salle.envoyer(j, { type: TYPES.BIENVENUE, index: j.index, couleur: j.couleur, config: configPour(j), etat: etatPour(j) });
  banc.creerCarte(j);
  banc.majCarte(j);
  majManettes();
  banc.noter((e.detail.reprise ? 'Manette reconnectée : ' : 'Manette connectée : ') + j.nom);
  hud.message((e.detail.reprise ? 'Manette reconnectée : ' : 'Manette connectée : ') + j.nom, 2.5);
  assurerJoueurTelephone(j);
  for (const jj of match.joueursParJeton(j.jeton)) match.modifierJoueur(jj.id, { connecte: true });
  if (match.etat === 'salon') salon.rendre();
  else { scoreboard.rendre(match); majBanniereTour(); }
  salle.envoyer(j, { type: TYPES.ETAT, ...etatPour(j) });
});
salle.addEventListener('joueur-lien', (e) => {
  const j = e.detail.joueur;
  banc.majCarte(j);
  majManettes();
  for (const jj of match.joueursParJeton(j.jeton)) match.modifierJoueur(jj.id, { connecte: !!j.connecte });
  if (match.etat === 'salon') salon.rendre();
  else { scoreboard.rendre(match); majBanniereTour(); }
});
salle.addEventListener('joueur-latence', (e) => { banc.majLatence(e.detail.joueur); });
salle.addEventListener('joueur-parti', (e) => {
  const j = e.detail.joueur;
  banc.retirerCarte(j);
  suivis.delete(j.jeton);
  majManettes();
  banc.noter('Place libérée : ' + j.nom);
  if (match.etat === 'salon') { for (const jj of match.joueursParJeton(j.jeton)) match.retirerJoueur(jj.id); salon.rendre(); }
  else { for (const jj of match.joueursParJeton(j.jeton)) match.modifierJoueur(jj.id, { connecte: false }); scoreboard.rendre(match); majBanniereTour(); }
});
salle.addEventListener('message', (e) => gererMessage(e.detail.joueur, e.detail.message));

function majManettes() {
  banc.majBadgeManettes();
  hud.majRejoindre({ nbManettes: salle.liste.filter((j) => j.connecte).length });
}

// ---------- Messages des manettes ----------

function gererMessage(j, m) {
  const s = suivis.get(j.jeton);
  if (!s) return;
  switch (m.type) {
    case TYPES.ECHANTILLON: {
      if (typeof m.t !== 'number') return;
      const p = preparerEchantillon(m);
      majBrasPersonnage(j, s, p);
      s.historique.push(p);
      if (s.historique.length > 900) s.historique.splice(0, s.historique.length - 900);
      s.dernierEch = p;
      if (s.geste && !s.geste.termine && p.t >= s.geste.tPose - 20) ajouterAuGeste(s.geste, p);
      break;
    }
    case TYPES.POSE: {
      if (typeof m.t !== 'number') return;
      if (!j.actif || (!lancerAutorise('telephone', j.jeton) && !s.calib)) {
        salle.envoyer(j, { type: TYPES.RESULTAT, resultat: 'refuse', raison: 'pasTonTour' });
        banc.journaliser(j, { type: 'refuse', raison: 'pasTonTour', mode: reglagesEffectifs(j).modeLancer, instant: m.t });
        return;
      }
      if (s.timerFin) { clearTimeout(s.timerFin); s.timerFin = null; }
      const p = profils.get(j.jeton);
      s.angleBras = [0, 0, 0];
      s.brasExtremes = [[0, 0], [0, 0], [0, 0]];
      if (personnage) personnage.armer(true);
      s.geste = nouveauGeste(m.t, reglagesEffectifs(j), s.dernierEch, p ? p.directionAvant : null);
      s.glisser = null;
      s.marqueurs.push({ t: m.t, type: 'pose' });
      break;
    }
    case TYPES.GLISSER: {
      s.glisser = m;
      break;
    }
    case TYPES.LEVE: {
      if (personnage) personnage.armer(false);
      if (typeof m.t !== 'number' || !s.geste || s.geste.termine) return;
      const R = s.geste.reglages;
      const delai = Math.min(300, R.toleranceRelacher + 80);
      const geste = s.geste;
      s.timerFin = setTimeout(() => { if (s.geste === geste) finaliserLancer(j, s, m.t); }, delai);
      break;
    }
    case TYPES.VISEE: {
      if (!lancerAutorise('telephone', j.jeton) && !(attentePassage && manetteDuJoueurCourant(j))) return;
      if (m.quoi === 'zoom') { zoomPreparation(m.sens < 0 ? -1 : 1); return; }
      if (m.quoi === 'vue') { basculerVueDessus(); return; }
      if (m.quoi === 'position' || m.quoi === 'angle') partie.viser(m.quoi, m.sens < 0 ? -1 : 1);
      break;
    }
    case TYPES.SAUT: {
      if (passer()) hud.message('Passé (' + j.nom + ')', 0.8);
      break;
    }
    case TYPES.COMMENCER: {
      if (match.etat === 'salon' && salle.liste[0] === j) demarrerPartie();
      break;
    }
    default:
      break;
  }
}

function finaliserLancer(j, s, tLeve) {
  s.timerFin = null;
  const geste = s.geste;
  const R = geste.reglages;
  let res;
  if (R.modeLancer === 'glisser') {
    res = resultatGlisser(s.glisser, R, tLeve - geste.tPose);
    geste.termine = true;
  } else {
    res = terminerGeste(geste, tLeve);
  }
  res.tPose = geste.tPose;
  res.tLeve = tLeve;
  res.latence = j.latence;
  s.marqueurs.push({ t: tLeve, type: 'leve' });
  if (res.type === 'lancer') s.marqueurs.push({ t: res.instant, type: 'instant' });
  if (s.marqueurs.length > 60) s.marqueurs.splice(0, s.marqueurs.length - 60);
  s.dernierResultat = res;

  // Calibration du sens avant : moyenne des directions au relâcher sur 3 lancers valides
  if (s.calibration && res.type === 'lancer' && Array.isArray(res.vPose) && vec.norme(res.vPose) > 0.3) {
    s.calibration.vecteurs.push(vec.normalise(res.vPose));
    if (s.calibration.vecteurs.length >= 3) {
      const somme = s.calibration.vecteurs.reduce((acc, v) => vec.add(acc, v), [0, 0, 0]);
      profils.setDirection(j.jeton, vec.normalise(somme));
      s.calibration = null;
      banc.noter('Sens avant calibré pour ' + j.nom);
    }
  }
  if (res.type === 'lancer') profils.compterLancer(j.jeton);

  // Calibrage guidé (puissance : lent / moyen / fort ; lift : poignet droit / tourné). Le jeu ne lance pas.
  if (s.calib && res.type !== 'refuse') {
    enregistrerEtapeCalibrage(j, s, res);
    salle.envoyer(j, { type: TYPES.RESULTAT, resultat: 'lancer', puissance: res.puissance, effet: res.effet, phase: res.phase });
    banc.journaliser(j, { ...res, mode: 'calibrage' });
    banc.majCarte(j);
    banc.afficherDernier(j, res);
    envoyerEtat(j);
    return;
  }

  // Le lancer part dans le jeu si c'est bien le tour d'un joueur porté par ce téléphone.
  if (res.type === 'lancer') {
    const jc = match.joueurCourant();
    if (lancerAutorise('telephone', j.jeton)) {
      if (jc) dernierLanceurParJeton.set(j.jeton, jc.id);
      if (entrainement) { if (scene) scene.couleurBoule(couleurHex(j.couleur)); if (personnage) personnage.appliquerProfil(profilPersonnage({ nom: j.nom, couleur: j.couleur, jeton: j.jeton, main: j.main, type: 'telephone' })); }
      const ok = partie.lancer({ puissance: res.puissance, effet: res.effet, phase: res.phase, joueur: jc ? jc.id : j.jeton, nom: jc ? jc.nom : j.nom });
      if (!ok) { res.type = 'refuse'; res.raison = 'pasTonTour'; }
    } else { res.type = 'refuse'; res.raison = 'pasTonTour'; }
  }

  salle.envoyer(j, { type: TYPES.RESULTAT, resultat: res.type, puissance: res.puissance, effet: res.effet, phase: res.phase, raison: res.raison });
  banc.journaliser(j, res);
  banc.majCarte(j);
  banc.afficherDernier(j, res);
}

function demarrerCalibration(j) {
  const s = suivis.get(j.jeton);
  if (!s) return;
  s.calibration = { vecteurs: [] };
  banc.majCarte(j);
  envoyerEtat(j, 'Calibrage : 3 lancers normaux');
}

function demarrerCalibrage(j, type) {
  const s = suivis.get(j.jeton);
  if (!s || !ETAPES_CALIB[type]) return;
  s.calib = s.calib && s.calib.type === type ? null : { type, index: 0, valeurs: {}, bras: [] };
  banc.majCarte(j);
  banc.noter(s.calib ? 'Calibrage ' + (type === 'lift' ? 'du lift' : 'de la puissance') + ' de ' + j.nom + ' : ' + ETAPES_CALIB[type].length + ' lancers guidés (le jeu ne lance pas)' : 'Calibrage annulé pour ' + j.nom);
  if (s.calib) {
    // Le personnage prend l'apparence du joueur calibré et suivra son bras ; le salon se replie pour le voir
    if (personnage) personnage.appliquerProfil(profilPersonnage({ nom: j.nom, couleur: j.couleur, jeton: j.jeton, main: j.main, type: 'telephone' }));
    if (scene) scene.couleurBoule(couleurHex(j.couleur));
    if (banc.ouvert) banc.basculer(false);
    if (match.etat === 'salon') salon.replier(true);
    afficherConsigneCalibrage(j, s);
  } else finirCalibrage(j, s);
  envoyerEtat(j);
}

function afficherConsigneCalibrage(j, s) {
  const c = s.calib;
  const e = ETAPES_CALIB[c.type][c.index];
  if (!e) return;
  hud.majTour({ titre: 'Calibrage ' + (c.index + 1) + '/' + ETAPES_CALIB[c.type].length + ' — ' + e.consigne, sous: e.aide + ' · le personnage suit ton bras', classe: 'passage' });
}

function finirCalibrage(j, s) {
  hud.majTour({});
  if (match.etat === 'salon') salon.replier(false);
  else majBanniereTour();
  if (personnage) personnage.repos();
}

// Refaire l'étape précédente (geste raté).
function refaireEtapeCalibrage(j) {
  const s = suivis.get(j.jeton);
  if (!s || !s.calib || s.calib.index === 0) return;
  s.calib.index--;
  delete s.calib.valeurs[ETAPES_CALIB[s.calib.type][s.calib.index].cle];
  s.calib.bras.pop();
  banc.majCarte(j);
  afficherConsigneCalibrage(j, s);
  envoyerEtat(j);
}

function enregistrerEtapeCalibrage(j, s, res) {
  const c = s.calib;
  const etapes = ETAPES_CALIB[c.type];
  const etape = etapes[c.index];
  if (!etape) return;
  const v = etape.mesure(res);
  if (!Number.isFinite(v)) return;
  c.valeurs[etape.cle] = v;
  c.bras.push(s.brasExtremes ? s.brasExtremes.map((e) => e.slice()) : null);
  (c.rotations || (c.rotations = [])).push(s.angleBras ? s.angleBras.slice() : null);
  c.index++;
  if (c.index < etapes.length) { banc.majCarte(j); afficherConsigneCalibrage(j, s); return; }
  s.calib = null;
  if (c.type === 'puissance') appliquerCalibragePuissance(j, c.valeurs);
  else appliquerCalibrageLift(j, c.valeurs, c.rotations);
  appliquerCalibrageBras(j, c.bras);
  envoyerConfig(j);
  banc.redessinerProfils();
  banc.majCarte(j);
  finirCalibrage(j, s);
}

// Bras : à partir des rotations accumulées pendant les lancers de calibrage, on retient l'axe du téléphone
// qui a le plus tourné (c'est celui du balancier), le sens qui met le grand mouvement en arrière, et le gain
// qui fait atteindre ~110° d'amplitude au personnage. Rien à régler à la main.
function appliquerCalibrageBras(j, brasParLancer) {
  const lancers = (brasParLancer || []).filter(Boolean);
  if (!lancers.length) return;
  const amplitude = [0, 0, 0], sommeSignee = [0, 0, 0];
  for (const ext of lancers) for (let k = 0; k < 3; k++) {
    const amp = ext[k][1] - ext[k][0];
    amplitude[k] += amp;
    sommeSignee[k] += Math.abs(ext[k][0]) >= Math.abs(ext[k][1]) ? ext[k][0] : ext[k][1]; // l'extrême dominant, signé
  }
  let axe = 0;
  for (let k = 1; k < 3; k++) if (amplitude[k] > amplitude[axe]) axe = k;
  const ampMoy = amplitude[axe] / lancers.length;
  if (ampMoy < 25) { banc.noter('Bras non calibré pour ' + j.nom + ' : rotation trop faible (' + Math.round(ampMoy) + '°) — le gyroscope tourne-t-il ?'); return; }
  // Le grand mouvement (balancier arrière) doit être négatif à l'écran
  const signe = sommeSignee[axe] > 0 ? -1 : 1;
  const gain = Math.round(Math.min(2, Math.max(0.5, 110 / ampMoy)) * 20) / 20;
  profils.setReglage(j.jeton, 'axeBras', axe);
  profils.setReglage(j.jeton, 'signeBrasGeste', signe);
  profils.setReglage(j.jeton, 'gainBrasGeste', gain);
  const nomsAxes = ['α (autour de l’écran)', 'β (autour de la largeur)', 'γ (autour de la hauteur)'];
  banc.noter('Bras calibré pour ' + j.nom + ' : axe ' + nomsAxes[axe] + ', amplitude ' + Math.round(ampMoy) + '° → gain ' + gain.toFixed(2).replace('.', ',') + (signe === -1 ? ', sens inversé' : ''));
}

function appliquerCalibragePuissance(j, v) {
  let aMin = Math.max(1, Math.round(v.lent * 0.85));
  let aMax = Math.round(v.fort * 1.05);
  if (aMax < aMin + 6) aMax = aMin + 6;
  // Le lancer « moyen » doit tomber à 50 % de la jauge : on cherche l'exposant qui l'y place.
  const brut = Math.min(0.999, Math.max(0.001, (v.moyen - aMin) / (aMax - aMin)));
  let courbe = Math.log(0.5) / Math.log(brut);
  courbe = Math.round(Math.min(3, Math.max(0.4, courbe)) * 20) / 20;
  profils.setReglage(j.jeton, 'aMin', aMin);
  profils.setReglage(j.jeton, 'aMax', aMax);
  profils.setReglage(j.jeton, 'courbePuissance', courbe);
  const texte = 'Puissance calibrée pour ' + j.nom + ' : ' + aMin + ' → ' + aMax + ' m/s², courbe ' + courbe.toFixed(2).replace('.', ',');
  banc.noter(texte + ' (lent ' + Math.round(v.lent) + ', moyen ' + Math.round(v.moyen) + ', fort ' + Math.round(v.fort) + ')');
  hud.message(texte, 3.5);
}

// Lift : un lancer lifté à gauche, un à droite. On en tire le SENS (quel signe de torsion envoie la boule à gauche,
// selon la main et la prise du téléphone), l'amplitude du plein effet, et une zone morte proportionnelle.
// Le geste mesure la torsion autour d'UN axe du téléphone. Selon la prise, le balancier lui-même peut tourner
// autour de cet axe et noyer le mouvement du poignet : tous les lancers partent alors du même côté. On regarde
// donc les trois axes : celui du poignet est celui où « gauche » et « droite » tournent en sens opposés avec la plus
// grande différence — jamais celui du balancier, qui tourne dans le même sens aux deux lancers.
const NOM_AXE_EFFET = ['z', 'x', 'y']; // index du gyroscope (α, β, γ) → réglage axeEffet (voir INDEX_AXE dans geste.js)
function appliquerCalibrageLift(j, v, rotations) {
  let gauche = v.gauche, droite = v.droite, axe = null;
  const rg = rotations && rotations[0], rd = rotations && rotations[1];
  if (rg && rd) {
    let meilleur = -1;
    for (let k = 0; k < 3; k++) {
      if (!Number.isFinite(rg[k]) || !Number.isFinite(rd[k])) continue;
      if (Math.sign(rg[k]) === Math.sign(rd[k]) || Math.min(Math.abs(rg[k]), Math.abs(rd[k])) < 8) continue;
      const ecart = Math.abs(rg[k] - rd[k]);
      if (ecart > meilleur) { meilleur = ecart; axe = k; }
    }
    if (axe !== null) { gauche = rg[axe]; droite = rd[axe]; }
  }
  const ampG = Math.abs(gauche), ampD = Math.abs(droite);
  const detail = ' (gauche ' + Math.round(gauche) + '°, droite ' + Math.round(droite) + '°' + (rg && rd ? ' ; axes α/β/γ gauche ' + rg.map(Math.round).join('/') + ', droite ' + rd.map(Math.round).join('/') : '') + ')';
  if (ampG < 8 || ampD < 8) { banc.noter('Lift non calibré pour ' + j.nom + ' : torsion trop faible' + detail + ' — tourne franchement le poignet.'); hud.message('Lift non calibré : tourne plus franchement le poignet', 3.5); return; }
  if (Math.sign(gauche) === Math.sign(droite)) { banc.noter('Lift non calibré pour ' + j.nom + ' : aucun axe ne tourne en sens opposés entre les deux lancers' + detail); hud.message('Lift non calibré : les deux lancers tournent dans le même sens', 3.5); return; }
  // Sens : dans geste.js, effet = signe(torsion) × signeEffet × signeMain, et effet négatif = crochet à gauche.
  const signeMain = reglagesEffectifs(j).main === 'gauche' ? -1 : 1;
  const signeEffet = Math.sign(gauche) * signeMain === -1 ? 1 : -1;
  if (axe !== null) profils.setReglage(j.jeton, 'axeEffet', NOM_AXE_EFFET[axe]);
  const plein = Math.round(0.9 * Math.min(ampG, ampD));
  const zone = Math.max(6, Math.round(plein * 0.15));
  profils.setReglage(j.jeton, 'signeEffet', signeEffet);
  profils.setReglage(j.jeton, 'effetZoneMorte', zone);
  profils.setReglage(j.jeton, 'effetAnglePlein', Math.max(zone + 15, plein));
  const texte = 'Lift calibré pour ' + j.nom + ' : axe ' + (axe !== null ? NOM_AXE_EFFET[axe] : reglagesEffectifs(j).axeEffet) + ', plein effet ' + Math.max(zone + 15, plein) + '°, zone morte ' + zone + '°' + (signeEffet === -1 ? ', sens inversé' : '');
  banc.noter(texte + detail + (ampG / ampD > 1.5 || ampD / ampG > 1.5 ? ' — amplitudes très différentes : le plein effet est calé sur le côté le plus faible' : ''));
  hud.message(texte, 3.5);
}

// ---------- Code de salle et QR ----------

function afficherCode(code) {
  $('code').textContent = code;
  hud.majRejoindre({ code });
  majQR();
  salon.majCode(code, dernierSvgQR);
}
let dernierSvgQR = '';

function lienManette() {
  const code = salle.code || '';
  if (!adresseManette) return '';
  const srv = reglages.get('serveurSignalisation');
  return adresseManette + '?salle=' + encodeURIComponent(code) + (srv ? '&srv=' + encodeURIComponent(srv) : '');
}

function majQR() {
  const conteneur = $('qr');
  const aide = $('qr-aide');
  conteneur.textContent = '';
  const lien = lienManette();
  if (!lien) {
    aide.textContent = 'Renseigne l’adresse en ligne de manette.html (ci-dessous) pour obtenir le QR code. Sans QR, les téléphones peuvent ouvrir cette adresse et saisir le code.';
    hud.majRejoindre({ svg: '<div class="hud-qr-vide">adresse de la manette à renseigner dans le banc (C)</div>' });
    return;
  }
  try {
    const qr = qrcode(0, 'M');
    qr.addData(lien);
    qr.make();
    const svg = qr.createSvgTag({ cellSize: 6, margin: 2, scalable: true });
    conteneur.innerHTML = svg;
    hud.majRejoindre({ svg });
    dernierSvgQR = svg;
    salon.majCode(salle.code || '', svg);
    aide.textContent = lien;
  } catch (e) {
    aide.textContent = 'QR code impossible : ' + e.message;
  }
}

$('adresse-manette').value = adresseManette;
$('adresse-manette').addEventListener('change', (e) => {
  adresseManette = e.target.value.trim();
  localStorage.setItem('bowling.adresseManette', adresseManette);
  majQR();
});
$('btn-nouveau-code').addEventListener('click', () => { if (confirm('Changer le code déconnecte les manettes en place. Continuer ?')) salle.ouvrir(nouveauCode()); });
$('btn-copier').addEventListener('click', async () => {
  const lien = lienManette();
  if (!lien) { banc.noter('Aucun lien : renseigne d’abord l’adresse de la manette.'); return; }
  try { await navigator.clipboard.writeText(lien); banc.noter('Lien copié.'); } catch (e) { banc.noter('Copie impossible, lien : ' + lien); }
});
$('btn-banc').addEventListener('click', () => banc.basculer());

// ---------- Réglages (tiroir) ----------

function apresChangementReglages() {
  for (const j of salle.liste) envoyerConfig(j);
  banc.redessinerProfils();
  majQR();
  phys.majMateriaux();
  phys.reglerBumpers(!!lire('gouttieresFermees'));
  if (match.etat === 'salon') { match.reglerOptions({ nbFrames: Number(lire('nbFrames')) || 10, gouttieresFermees: !!lire('gouttieresFermees') }); salon.rendre(); }
  if (scene) { scene.majQualite(); scene.majEnseigne(); }
  hud.majTailleTextes();
  audio.majVolumes();
  audio.majMusique();
  if (spectateurs) spectateurs.groupe.visible = lire('spectateurs') !== false;
  hud.basculerAide(!!lire('afficherAide'));
  hud.basculerRejoindre(!!lire('afficherRejoindre'));
}

rendrePanneau($('reglages-contenu'), reglages, apresChangementReglages);

function basculerTiroir(force) {
  const t = $('tiroir');
  const ouvrir = force == null ? t.classList.contains('cache') : force;
  t.classList.toggle('cache', !ouvrir);
}
$('btn-reglages').addEventListener('click', () => basculerTiroir());
$('btn-fermer-reglages').addEventListener('click', () => basculerTiroir(false));

$('btn-exporter').addEventListener('click', () => {
  const contenu = JSON.stringify({ version: VERSION, date: new Date().toISOString(), reglages: reglages.exporter(), profils: profils.exporter() }, null, 2);
  telecharger('bowling-reglages.json', contenu, 'application/json');
});
$('fichier-import').addEventListener('change', async (e) => {
  const f = e.target.files && e.target.files[0];
  if (!f) return;
  try {
    const obj = JSON.parse(await f.text());
    if (obj.reglages) reglages.importer(obj.reglages);
    if (obj.profils) profils.importer(obj.profils);
    rendrePanneau($('reglages-contenu'), reglages, apresChangementReglages);
    apresChangementReglages();
    banc.noter('Réglages importés.');
  } catch (err) {
    banc.noter('Import impossible : ' + err.message);
  }
  e.target.value = '';
});
$('btn-reinit').addEventListener('click', () => {
  if (!confirm('Remettre tous les réglages à leur valeur par défaut ? (les profils sont conservés)')) return;
  reglages.reinitialiser();
  rendrePanneau($('reglages-contenu'), reglages, apresChangementReglages);
  apresChangementReglages();
});

// ---------- Démarrage ----------

$('version').textContent = VERSION;
hud.majEtat({ phase: 'preparation', boule: 1, frame: 1, debout: 10 });
hud.majVisee(partie.visee);
majManettes();
majQR();
scoreboard.afficher(false);
if (MODE !== 'partie') { salon.afficher(false); demarrerEntrainement(); }
else { salon.afficher(false); titre.afficher(true); }
$('btn-menu').addEventListener('click', () => { if (entrainement) location.href = 'index.html'; else allerAuTitre(); });
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  const dejaControle = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('sw.js').catch(() => {});
  // Une nouvelle version vient de prendre le contrôle (le service worker a été remplacé) : proposer de recharger
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!dejaControle) return;
    const b = document.createElement('div');
    b.className = 'maj-dispo';
    b.innerHTML = 'Nouvelle version prête — <button type="button">Recharger</button>';
    b.querySelector('button').addEventListener('click', () => location.reload());
    document.body.append(b);
  });
}
demarrerRendu().then(() => requestAnimationFrame(boucle));
const codeSauve = localStorage.getItem('bowling.salle');
salle.ouvrir(codeValide(codeSauve) ? codeSauve : nouveauCode());
window.addEventListener('beforeunload', () => salle.fermer());
