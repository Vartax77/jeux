// Constantes partagées entre l'écran (PC) et la manette (téléphone).

export const VERSION = 'V1.7';
export const VERSION_PROTOCOLE = 1;

// Identifiant PeerJS de l'écran = PREFIXE_SALLE + code de salle (ex. "bowl-K7M3P").
export const PREFIXE_SALLE = 'bowl-';
// Alphabet sans O/0/I/1 pour éviter les confusions à la saisie.
export const ALPHABET_CODE = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const LONGUEUR_CODE = 5;

export const MAX_JOUEURS = 4;

// Palette distinguable par les daltoniens (pas de paire rouge/vert).
export const COULEURS = [
  { id: 'bleu', nom: 'Bleu', hex: '#2f6fe4' },
  { id: 'orange', nom: 'Orange', hex: '#f28c28' },
  { id: 'vert', nom: 'Vert', hex: '#2ca05a' },
  { id: 'violet', nom: 'Violet', hex: '#8e44ad' },
];

export function couleurHex(id) {
  return (COULEURS.find((c) => c.id === id) || COULEURS[0]).hex;
}

// Réseau
export const INTERVALLE_PING_MS = 1000;      // l'écran envoie un ping par seconde à chaque manette
export const DELAI_PERTE_LIEN_MS = 4000;     // sans nouvelles pendant ce délai → "Reconnexion…"
export const DELAI_RECONNEXION_MS = 2000;    // la manette retente toutes les 2 s
export const DELAI_OUVERTURE_MS = 6000;      // délai max pour qu'une connexion s'ouvre avant de retenter
export const DELAI_OUBLI_PLACE_MIN = 10;     // l'écran garde la place d'une manette absente 10 minutes
export const DUREE_ARME_APRES_LEVE_MS = 250; // la manette reste à 60 Hz un instant après le relâcher
