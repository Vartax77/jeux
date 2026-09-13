// Manette (téléphone) — lot 1.
// Rôle volontairement « bête » : activer les capteurs, se connecter à l'écran, envoyer les données brutes
// (accéléromètre, gyroscope, orientation) et les événements (pouce posé/levé, visée). Toute l'analyse
// est faite par l'écran (js/ecran/geste.js).

import {
  PREFIXE_SALLE, ALPHABET_CODE, LONGUEUR_CODE, COULEURS, couleurHex, VERSION_PROTOCOLE, VERSION,
  DELAI_RECONNEXION_MS, DELAI_PERTE_LIEN_MS, DELAI_OUVERTURE_MS, DUREE_ARME_APRES_LEVE_MS,
} from '../commun/constantes.js';
import { TYPES, estMessageValide } from '../commun/protocole.js';
import { T } from '../commun/textes.js';

const $ = (id) => document.getElementById(id);

// iPhone/iPad : signe des accélérations inversé par rapport à la convention W3C → corrigé avant l'envoi.
const estIOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const SIGNE_ACCEL = estIOS ? -1 : 1;
const params = new URL(location.href).searchParams;
const serveurSignalisation = (params.get('srv') || '').trim();

// ---------- Stockage local ----------

function charger(cle, defaut) {
  try { const v = localStorage.getItem('manette.' + cle); return v == null ? defaut : JSON.parse(v); } catch (e) { return defaut; }
}
function sauver(cle, valeur) {
  try { localStorage.setItem('manette.' + cle, JSON.stringify(valeur)); } catch (e) { /* stockage indisponible */ }
}
function genererJeton() {
  const a = new Uint8Array(12);
  crypto.getRandomValues(a);
  return [...a].map((x) => x.toString(16).padStart(2, '0')).join('');
}
const jeton = charger('jeton', null) || (() => { const j = genererJeton(); sauver('jeton', j); return j; })();
const profil = Object.assign({ nom: '', couleur: 'bleu', main: 'droite' }, charger('profil', {}));
let code = (params.get('salle') || charger('salle', '') || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

// ---------- État ----------

const etat = {
  lien: 'inactif',           // inactif | connexion | connecte | reconnexion
  tonTour: false,
  phase: 'preparation',      // salon | preparation | cinematique | attente | fin (envoyé par l'écran)
  joueur: '',                // nom du joueur courant
  passe: '',                 // nom du joueur à qui passer ce téléphone
  premier: false,            // ce téléphone peut commencer la partie
  modeLancer: 'relacher',
  freqArme: 60,
  freqRepos: 10,
  position: 0,
  angle: 0,
  latence: null,
  couleur: profil.couleur,
  quitte: false,
  capteursActifs: false,
};
let peer = null, conn = null;
let timerReconnexion = null, timerOuverture = null, timerVeilleLien = null;
let dernierSigneDeVie = 0;
let seq = 0, compteurEch = 0, evenementsSeconde = 0, freqMesuree = 0, derniereOrientation = null, normeGravite = null;
let pose = false, finArme = 0, pointeurId = null, glisse = null;
let timerRetour = null;

// ---------- Accueil ----------

const btnRejoindre = $('btn-rejoindre');
$('code').value = code;
$('nom').value = profil.nom;
$('code').addEventListener('input', (e) => {
  e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, LONGUEUR_CODE);
});

for (const c of COULEURS) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'pastille-couleur' + (c.id === profil.couleur ? ' choisie' : '');
  b.style.background = c.hex;
  b.setAttribute('aria-label', c.nom);
  b.addEventListener('click', () => {
    profil.couleur = c.id;
    for (const x of $('couleurs').children) x.classList.toggle('choisie', x === b);
  });
  $('couleurs').append(b);
}
for (const b of $('mains').querySelectorAll('button')) {
  b.classList.toggle('actif', b.dataset.main === profil.main);
  b.addEventListener('click', () => {
    profil.main = b.dataset.main;
    for (const x of $('mains').children) x.classList.toggle('actif', x === b);
  });
}

btnRejoindre.addEventListener('click', () => {
  const message = $('accueil-message');
  message.textContent = '';
  const c = $('code').value.trim().toUpperCase();
  const nom = $('nom').value.trim();
  if (c.length !== LONGUEUR_CODE || ![...c].every((x) => ALPHABET_CODE.includes(x))) { message.textContent = T.codeInvalide; return; }
  if (!nom) { message.textContent = T.nomRequis; return; }
  code = c;
  profil.nom = nom;
  sauver('profil', profil);
  sauver('salle', code);

  // Les demandes d'autorisation doivent partir DANS le geste utilisateur (pas après un await).
  const demandes = [];
  const demander = (Cls) => {
    if (typeof Cls !== 'undefined' && typeof Cls.requestPermission === 'function') {
      try { demandes.push(Cls.requestPermission()); } catch (e) { demandes.push(Promise.reject(e)); }
    }
  };
  demander(window.DeviceMotionEvent);
  demander(window.DeviceOrientationEvent);
  demanderVeille();

  btnRejoindre.disabled = true;
  Promise.all(demandes).then((reponses) => {
    if (reponses.some((r) => r !== 'granted')) {
      message.textContent = T.capteursRefuses;
      btnRejoindre.disabled = false;
      return;
    }
    demarrerCapteurs();
    etat.quitte = false;
    montrerEcran('manette');
    rejoindre();
  }).catch(() => {
    message.textContent = T.capteursRefuses;
    btnRejoindre.disabled = false;
  });
});

if (location.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(location.hostname)) {
  $('accueil-message').textContent = T.capteursHttps;
}
if (typeof window.DeviceMotionEvent === 'undefined') {
  $('accueil-message').textContent = T.capteursIndisponibles;
}

function montrerEcran(nom) {
  $('ecran-accueil').classList.toggle('cache', nom !== 'accueil');
  $('ecran-manette').classList.toggle('cache', nom !== 'manette');
  btnRejoindre.disabled = false;
}

// ---------- Capteurs ----------

function demarrerCapteurs() {
  if (etat.capteursActifs) return;
  etat.capteursActifs = true;
  window.addEventListener('devicemotion', surMotion);
  window.addEventListener('deviceorientation', surOrientation);
  setInterval(() => { freqMesuree = evenementsSeconde; evenementsSeconde = 0; majPied(); }, 1000);
}

function surOrientation(e) {
  derniereOrientation = (e.alpha == null || e.beta == null || e.gamma == null) ? null : [e.alpha, e.beta, e.gamma];
}

function surMotion(e) {
  evenementsSeconde++;
  const acc = e.acceleration, ag = e.accelerationIncludingGravity, rr = e.rotationRate;
  const maintenant = performance.now();
  const ech = {
    type: TYPES.ECHANTILLON,
    seq: seq++,
    t: maintenant,
    dt: typeof e.interval === 'number' ? e.interval : null,
    a: acc && acc.x != null ? [SIGNE_ACCEL * acc.x, SIGNE_ACCEL * acc.y, SIGNE_ACCEL * acc.z] : null,
    ag: ag && ag.x != null ? [SIGNE_ACCEL * ag.x, SIGNE_ACCEL * ag.y, SIGNE_ACCEL * ag.z] : null,
    r: rr && rr.alpha != null ? [rr.alpha, rr.beta, rr.gamma] : null,
    o: derniereOrientation,
    pose,
  };
  if (ech.ag) normeGravite = Math.hypot(ech.ag[0], ech.ag[1], ech.ag[2]);
  const arme = pose || maintenant < finArme;
  compteurEch++;
  const diviseur = Math.max(1, Math.round(60 / (arme ? etat.freqArme : etat.freqRepos)));
  if (compteurEch % diviseur === 0) envoyer(ech);
}

// ---------- Écran allumé ----------

let verrouVeille = null;
function demanderVeille() {
  if (!('wakeLock' in navigator)) { majVeille(false); return; }
  navigator.wakeLock.request('screen').then((v) => {
    verrouVeille = v;
    majVeille(true);
    v.addEventListener('release', () => majVeille(false));
  }).catch(() => majVeille(false));
}
function majVeille(ok) {
  $('m-veille').textContent = ok ? T.ecranAllume : T.ecranNonMaintenu;
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && etat.lien !== 'inactif') demanderVeille();
});

// ---------- Réseau ----------

function rejoindre() {
  annulerReconnexion();
  passerLien('connexion');
  if (!peer || peer.destroyed) creerPeer();
  else if (peer.disconnected) { try { peer.reconnect(); } catch (e) { creerPeer(); } }
  else ouvrirConnexion();
  if (!timerVeilleLien) timerVeilleLien = setInterval(veillerLien, 1000);
}

function creerPeer() {
  if (peer) { try { peer.destroy(); } catch (e) { /* */ } }
  const opts = { debug: 0, secure: true };
  if (serveurSignalisation) { opts.host = serveurSignalisation; opts.port = 443; opts.path = '/'; }
  const p = new window.Peer(opts);
  peer = p;
  p.on('open', () => { if (peer === p && !etat.quitte) ouvrirConnexion(); });
  p.on('disconnected', () => { if (peer === p && !etat.quitte) planifierReconnexion(); });
  p.on('close', () => { if (peer === p && !etat.quitte) planifierReconnexion(); });
  p.on('error', (err) => {
    if (peer !== p || etat.quitte) return;
    const type = err && err.type;
    if (type === 'peer-unavailable') afficherMessage(T.salleIntrouvable);
    planifierReconnexion();
  });
}

function ouvrirConnexion() {
  if (etat.quitte || !peer || peer.destroyed || peer.disconnected) return;
  if (conn && conn.open) return;
  if (conn) { try { conn.close(); } catch (e) { /* */ } }
  const c = peer.connect(PREFIXE_SALLE + code, { reliable: false, serialization: 'json' });
  conn = c;
  clearTimeout(timerOuverture);
  timerOuverture = setTimeout(() => { if (conn === c && !c.open) planifierReconnexion(); }, DELAI_OUVERTURE_MS);
  c.on('open', () => {
    if (conn !== c) return;
    clearTimeout(timerOuverture);
    dernierSigneDeVie = performance.now();
    envoyer({
      type: TYPES.BONJOUR, version: VERSION_PROTOCOLE, jeton, nom: profil.nom, couleur: profil.couleur, main: profil.main,
      plateforme: estIOS ? 'ios' : 'autre', ua: navigator.userAgent.slice(0, 120),
    });
  });
  c.on('data', (m) => { if (conn === c) gererMessage(m); });
  c.on('close', () => { if (conn === c) planifierReconnexion(); });
  c.on('error', () => { if (conn === c) planifierReconnexion(); });
}

function envoyer(m) {
  if (conn && conn.open) { try { conn.send(m); } catch (e) { /* le lien se fermera */ } }
}

function planifierReconnexion() {
  if (etat.quitte || timerReconnexion) return;
  passerLien('reconnexion');
  timerReconnexion = setTimeout(() => {
    timerReconnexion = null;
    if (etat.quitte) return;
    if (!peer || peer.destroyed) creerPeer();
    else if (peer.disconnected) { try { peer.reconnect(); } catch (e) { creerPeer(); } }
    else ouvrirConnexion();
  }, DELAI_RECONNEXION_MS);
}

function annulerReconnexion() {
  clearTimeout(timerReconnexion); timerReconnexion = null;
  clearTimeout(timerOuverture); timerOuverture = null;
}

// Sans ping de l'écran pendant DELAI_PERTE_LIEN_MS, le lien est considéré perdu (coupure Wi-Fi silencieuse).
function veillerLien() {
  if (etat.lien === 'connecte' && performance.now() - dernierSigneDeVie > DELAI_PERTE_LIEN_MS) {
    if (conn) { try { conn.close(); } catch (e) { /* */ } }
    planifierReconnexion();
  }
}

function fermerReseau() {
  annulerReconnexion();
  if (timerVeilleLien) { clearInterval(timerVeilleLien); timerVeilleLien = null; }
  if (conn) { try { conn.close(); } catch (e) { /* */ } conn = null; }
  if (peer) { try { peer.destroy(); } catch (e) { /* */ } peer = null; }
  passerLien('inactif');
}

function gererMessage(m) {
  if (!estMessageValide(m)) return;
  dernierSigneDeVie = performance.now();
  switch (m.type) {
    case TYPES.BIENVENUE:
      if (m.couleur) etat.couleur = m.couleur;
      appliquerConfig(m.config);
      appliquerEtat(m.etat);
      passerLien('connecte');
      afficherMessage('');
      break;
    case TYPES.REFUS:
      etat.quitte = true;
      fermerReseau();
      montrerEcran('accueil');
      $('accueil-message').textContent = m.raison === 'sallePleine' ? T.sallePleine : m.raison === 'versionProtocole' ? T.versionProtocole : T.refus;
      break;
    case TYPES.PING:
      envoyer({ type: TYPES.PONG, t: m.t, tp: performance.now() });
      break;
    case TYPES.ETAT:
      appliquerEtat(m);
      break;
    case TYPES.CONFIG:
      appliquerConfig(m);
      break;
    case TYPES.RESULTAT:
      montrerResultat(m);
      break;
    default:
      break;
  }
}

function appliquerConfig(c) {
  if (!c) return;
  if (c.modeLancer && T.modes[c.modeLancer]) etat.modeLancer = c.modeLancer;
  if (typeof c.freqArme === 'number' && c.freqArme > 0) etat.freqArme = c.freqArme;
  if (typeof c.freqRepos === 'number' && c.freqRepos > 0) etat.freqRepos = c.freqRepos;
  majZone();
  majPied();
}

function appliquerEtat(s) {
  if (!s) return;
  if (typeof s.tonTour === 'boolean') etat.tonTour = s.tonTour;
  if (typeof s.phase === 'string') etat.phase = s.phase;
  if (typeof s.joueur === 'string') etat.joueur = s.joueur;
  if (typeof s.passe === 'string') etat.passe = s.passe;
  if (typeof s.premier === 'boolean') etat.premier = s.premier;
  if (typeof s.position === 'number') etat.position = s.position;
  if (typeof s.angle === 'number') etat.angle = s.angle;
  if (s.latence != null) etat.latence = s.latence;
  if (typeof s.message === 'string') afficherMessage(s.message);
  $('v-position').textContent = etat.position.toFixed(2).replace('.', ',');
  $('v-angle').textContent = etat.angle.toFixed(2).replace('.', ',') + '°';
  majBandeau();
  majZone();
}

function passerLien(nouveau) {
  etat.lien = nouveau;
  majBandeau();
  majZone();
}

// ---------- Interface manette ----------

function majBandeau() {
  $('pastille').style.background = couleurHex(etat.couleur);
  document.documentElement.style.setProperty('--joueur', couleurHex(etat.couleur));
  $('m-nom').textContent = profil.nom;
  $('m-etat').textContent = { inactif: '', connexion: T.connexion, connecte: T.connecte, reconnexion: T.reconnexion }[etat.lien] || '';
  $('m-latence').textContent = etat.lien === 'connecte' && etat.latence != null ? etat.latence + ' ms' : '';
}

function majPied() {
  $('m-mode').textContent = T.modes[etat.modeLancer] || etat.modeLancer;
  $('m-capteurs').textContent = T.capteurs + ' : ' + (etat.capteursActifs ? freqMesuree + ' Hz' + (normeGravite != null ? ' · g ' + normeGravite.toFixed(1).replace('.', ',') : '') : '–');
}

function afficherMessage(texte) {
  $('m-message').textContent = texte || '';
}

function consigne() {
  if (etat.modeLancer === 'glisser') return T.consigneGlisser;
  if (etat.modeLancer === 'automatique') return T.consigneAutomatique;
  return T.consigneRelacher;
}

function majZone() {
  if (timerRetour) return; // un retour de lancer est affiché : on ne l'écrase pas
  const z = $('zone-lancer');
  z.classList.remove('retour-ok', 'retour-annule', 'retour-refuse');
  const disponible = etat.lien === 'connecte' && etat.tonTour;
  const commencer = etat.lien === 'connecte' && etat.phase === 'salon' && etat.premier;
  z.classList.toggle('attente', !disponible && !commencer);
  z.classList.toggle('commencer', commencer);
  z.classList.toggle('armee', pose);
  if (!disponible) {
    if (etat.lien !== 'connecte') { $('zl-titre').textContent = etat.lien === 'reconnexion' ? T.reconnexion : T.connexion; $('zl-texte').textContent = ''; }
    else if (etat.phase === 'salon') { $('zl-titre').textContent = (etat.premier ? T.commencer : T.salon).toUpperCase(); $('zl-texte').textContent = etat.premier ? T.commencerAide : T.salonAide; }
    else if (etat.phase === 'cinematique') { $('zl-titre').textContent = T.passer.toUpperCase(); $('zl-texte').textContent = T.passerAide; }
    else if (etat.phase === 'fin') { $('zl-titre').textContent = T.partieTerminee.toUpperCase(); $('zl-texte').textContent = T.partieTermineeAide; }
    else if (etat.passe) { $('zl-titre').textContent = (T.passeTelephone + ' ' + etat.passe).toUpperCase(); $('zl-texte').textContent = ''; }
    else { $('zl-titre').textContent = T.attendsTonTour.toUpperCase(); $('zl-texte').textContent = etat.joueur ? T.auTourDe + ' ' + etat.joueur : ''; }
  } else if (pose) {
    $('zl-titre').textContent = etat.modeLancer === 'glisser' ? T.glisse.toUpperCase() : T.balance.toUpperCase();
    $('zl-texte').textContent = '';
  } else {
    $('zl-titre').textContent = T.lancer;
    $('zl-texte').textContent = consigne();
  }
}

function montrerRetour(titre, texte, classe) {
  const z = $('zone-lancer');
  clearTimeout(timerRetour);
  z.classList.remove('armee', 'attente', 'retour-ok', 'retour-annule', 'retour-refuse');
  z.classList.add(classe);
  $('zl-titre').textContent = titre;
  $('zl-texte').textContent = texte;
  timerRetour = setTimeout(() => { timerRetour = null; majZone(); }, 1800);
}

function montrerResultat(m) {
  if (m.resultat === 'lancer') {
    const p = m.puissance == null ? '' : Math.round(m.puissance * 100) + ' %';
    const e = m.effet == null ? '' : ' · effet ' + m.effet.toFixed(2).replace('.', ',');
    const ph = m.phase && m.phase !== 'normal' ? ' · ' + (T.phases[m.phase] || m.phase) : '';
    montrerRetour(T.lancerEnvoye.toUpperCase(), p + e + ph, 'retour-ok');
  } else if (m.resultat === 'annule') {
    montrerRetour(T.lancerAnnule.toUpperCase(), T.raisons[m.raison] || '', 'retour-annule');
  } else {
    montrerRetour(T.pasTonTour.toUpperCase(), '', 'retour-refuse');
  }
}

// Zone LANCER : pouce posé / levé (+ glissement en mode Glisser)
const zone = $('zone-lancer');
zone.addEventListener('contextmenu', (e) => e.preventDefault());
zone.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  if (pose || pointeurId != null) return;
  if (etat.lien !== 'connecte') return;
  if (!etat.tonTour) {
    // Salon : le premier téléphone peut commencer ; cinématique : un toucher la passe ; sinon, ce n'est pas son tour.
    if (etat.phase === 'salon') { if (etat.premier) envoyer({ type: TYPES.COMMENCER, t: performance.now() }); return; }
    if (etat.phase === 'cinematique') { envoyer({ type: TYPES.SAUT, t: performance.now() }); return; }
    if (etat.phase === 'fin') return;
    montrerRetour(T.pasTonTour.toUpperCase(), '', 'retour-refuse');
    return;
  }
  pointeurId = e.pointerId;
  try { zone.setPointerCapture(e.pointerId); } catch (err) { /* */ }
  pose = true;
  const t = performance.now();
  glisse = { x0: e.clientX, y0: e.clientY, t0: t, x: e.clientX, y: e.clientY, t };
  envoyer({ type: TYPES.POSE, t });
  if (timerRetour) { clearTimeout(timerRetour); timerRetour = null; }
  majZone();
});
zone.addEventListener('pointermove', (e) => {
  if (e.pointerId !== pointeurId || !glisse) return;
  glisse.x = e.clientX; glisse.y = e.clientY; glisse.t = performance.now();
});
const lever = (e) => {
  if (e.pointerId !== pointeurId) return;
  e.preventDefault();
  pointeurId = null;
  if (!pose) return;
  pose = false;
  const t = performance.now();
  finArme = t + DUREE_ARME_APRES_LEVE_MS;
  if (etat.modeLancer === 'glisser' && glisse) {
    const dx = e.clientX - glisse.x0, dy = glisse.y0 - e.clientY; // dy > 0 = vers le haut
    const duree = Math.max(1, t - glisse.t0);
    envoyer({ type: TYPES.GLISSER, t, dx, dy, duree, vitesse: Math.hypot(dx, dy) / duree });
  }
  envoyer({ type: TYPES.LEVE, t });
  glisse = null;
  majZone();
};
zone.addEventListener('pointerup', lever);
zone.addEventListener('pointercancel', lever);

// Visée : répétition tant que le bouton est maintenu
for (const b of document.querySelectorAll('.fleche')) {
  let timer = null;
  const pas = () => envoyer({ type: TYPES.VISEE, quoi: b.dataset.visee, sens: Number(b.dataset.sens) });
  const arreter = () => { clearInterval(timer); timer = null; b.classList.remove('enfonce'); };
  b.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (etat.lien !== 'connecte' || !etat.tonTour) return;
    try { b.setPointerCapture(e.pointerId); } catch (err) { /* */ }
    b.classList.add('enfonce');
    pas();
    clearInterval(timer);
    timer = setInterval(pas, 120);
  });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) b.addEventListener(ev, arreter);
  b.addEventListener('contextmenu', (e) => e.preventDefault());
}

$('btn-quitter').addEventListener('click', () => {
  etat.quitte = true;
  pose = false; pointeurId = null;
  fermerReseau();
  montrerEcran('accueil');
  $('accueil-message').textContent = '';
});

// Gestes système restants (pincement, rebond) : neutralisés.
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('touchmove', (e) => { if (e.target.closest('#ecran-manette')) e.preventDefault(); }, { passive: false });

majBandeau();
majZone();
majPied();

// PWA : cache des pages pour l'ouverture depuis l'écran d'accueil (la signalisation reste en ligne).
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
