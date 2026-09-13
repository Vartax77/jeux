// Service worker : met en cache les pages et les bibliothèques pour ouvrir le jeu et la manette sans réseau
// (la mise en relation PeerJS reste dépendante d'Internet). Changer VERSION_CACHE force la mise à jour.
const VERSION_CACHE = 'bowling-v1';
const FICHIERS = [
  './', './index.html', './manette.html', './css/ecran.css', './css/manette.css',
  './manifest.webmanifest', './manette.webmanifest',
  './icones/icone-192.png', './icones/icone-512.png', './icones/icone-maskable-512.png', './icones/apple-touch-icon.png',
  './lib/peerjs.min.js', './lib/qrcode-generator.js', './lib/cannon-es.js',
  './lib/three/three.module.js', './lib/three/three.core.js', './lib/three/RoomEnvironment.js', './lib/three/OrbitControls.js',
  './js/commun/constantes.js', './js/commun/protocole.js', './js/commun/textes.js', './js/commun/maths.js',
  './js/manette/main.js',
  './js/ecran/main.js', './js/ecran/salle.js', './js/ecran/geste.js', './js/ecran/reglages.js', './js/ecran/profils.js', './js/ecran/graphiques.js',
  './js/ecran/banc.js', './js/ecran/salon.js', './js/ecran/fin.js', './js/ecran/titre.js', './js/ecran/profils-ui.js',
  './js/ecran/jeu/physique.js', './js/ecran/jeu/partie.js', './js/ecran/jeu/scene.js', './js/ecran/jeu/cameras.js', './js/ecran/jeu/clavier.js',
  './js/ecran/jeu/hud.js', './js/ecran/jeu/score.js', './js/ecran/jeu/match.js', './js/ecran/jeu/bot.js', './js/ecran/jeu/scoreboard.js',
  './js/ecran/jeu/sauvegarde.js', './js/ecran/jeu/audio.js', './js/ecran/jeu/personnage.js', './js/ecran/jeu/apparence.js', './js/ecran/jeu/entrainement.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION_CACHE).then((c) => c.addAll(FICHIERS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((cles) => Promise.all(cles.filter((k) => k !== VERSION_CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

// Réseau d'abord (pour recevoir les mises à jour), cache en secours (hors ligne).
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request).then((r) => { const copie = r.clone(); caches.open(VERSION_CACHE).then((c) => c.put(e.request, copie)); return r; })
      .catch(() => caches.match(e.request).then((r) => r || caches.match('./index.html')))
  );
});
