// Protocole des messages échangés entre la manette (téléphone) et l'écran (PC).
// Un canal de données WebRTC (PeerJS) par téléphone, messages JSON, champ `type` obligatoire.
//
// Téléphone → écran
//   bonjour     { version, jeton, nom, couleur, main, plateforme, ua }
//               jeton : identifiant persistant du téléphone (permet de retrouver sa place)
//   echantillon { seq, t, dt, a, ag, r, o, pose }
//               t  : horloge du téléphone (performance.now(), ms)
//               dt : intervalle annoncé par le capteur (ms)
//               a  : accélération sans gravité [x, y, z] en m/s², convention W3C
//                    (iOS inverse le signe : la manette le corrige avant l'envoi)
//               ag : accélération avec gravité [x, y, z] en m/s² (au repos, à plat, z ≈ +9,8)
//               r  : vitesse angulaire [alpha, beta, gamma] en °/s
//                    alpha = autour de z (perpendiculaire à l'écran), beta = autour de x (largeur),
//                    gamma = autour de y (axe long du téléphone)
//               o  : orientation [alpha, beta, gamma] en ° (DeviceOrientation), ou null
//               pose : true si le pouce est posé sur LANCER
//   pose        { t }                       pouce posé sur LANCER
//   leve        { t }                       pouce levé
//   glisser     { t, dx, dy, duree, vitesse } résumé d'un glissement (mode Glisser) ; dy > 0 = vers le haut
//   visee       { quoi: 'position'|'angle', sens: -1|1 }  un pas de visée
//   saut        { t }                       toucher pendant une cinématique : demande de passer la phase (lot 2)
//   commencer   { t }                       toucher sur COMMENCER dans le salon (premier téléphone) (lot 3)
//   pong        { t, tp }                   t = horodatage du ping (horloge écran), tp = horloge téléphone
//
// Écran → téléphone
//   bienvenue   { index, couleur, config, etat }
//   refus       { raison }                  'sallePleine' | 'versionProtocole'
//   ping        { t }
//   etat        { tonTour, phase, position, angle, latence, message, joueur, passe, premier }
//               phase : 'salon' | 'preparation' (on peut lancer) | 'cinematique' (boule en cours, résultat, remise)
//                       | 'attente' (au tour d'un autre) | 'fin' (partie terminée)
//               joueur : nom du joueur courant ; passe : nom du joueur à qui passer ce téléphone (téléphone partagé) ;
//               premier : true si ce téléphone peut commencer la partie depuis le salon (lot 3)
//   config      { modeLancer, freqArme, freqRepos }
//   resultat    { resultat: 'lancer'|'annule'|'refuse', puissance, effet, phase, raison }

export const TYPES = Object.freeze({
  BONJOUR: 'bonjour',
  BIENVENUE: 'bienvenue',
  REFUS: 'refus',
  ECHANTILLON: 'echantillon',
  POSE: 'pose',
  LEVE: 'leve',
  GLISSER: 'glisser',
  VISEE: 'visee',
  SAUT: 'saut',
  COMMENCER: 'commencer',
  PING: 'ping',
  PONG: 'pong',
  ETAT: 'etat',
  CONFIG: 'config',
  RESULTAT: 'resultat',
});

export function estMessageValide(m) {
  return !!m && typeof m === 'object' && typeof m.type === 'string';
}
