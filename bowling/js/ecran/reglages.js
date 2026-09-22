// Réglages de l'écran : schéma déclaratif (groupes, champs, bornes, valeurs par défaut),
// persistance dans localStorage, rendu du panneau et des champs "par profil".
// Contrat du cahier des charges (§6) : tout ce qui se règle est ici, sans toucher au code.

const CLE = 'bowling.reglages';

export const SCHEMA = [
  {
    id: 'manette', titre: 'Manette', champs: [
      { id: 'modeLancer', type: 'choix', defaut: 'relacher', profil: true, libelle: 'Mode de lancer',
        options: [['relacher', 'Relâcher (fidèle)'], ['automatique', 'Automatique'], ['glisser', 'Glisser']],
        aide: 'Relâcher : le lancer part quand le pouce se lève. Automatique : le jeu retient le pic de vitesse du balancier. Glisser : glissement du doigt, sans mouvement du bras.' },
      { id: 'sourcePuissance', type: 'choix', defaut: 'pic', libelle: 'Source de la puissance',
        options: [['pic', 'Pic d’accélération'], ['vitesse', 'Vitesse estimée']],
        aide: 'Le pic est robuste ; la vitesse estimée dépend de l’orientation et dérive un peu.' },
      { id: 'aMin', type: 'nombre', defaut: 4, min: 1, max: 20, pas: 0.5, unite: 'm/s²', profil: true, libelle: 'Pic minimal (aMin)',
        aide: 'Sous ce pic d’accélération le geste est annulé ; c’est aussi le 0 % de puissance.' },
      { id: 'aMax', type: 'nombre', defaut: 32, min: 5, max: 60, pas: 1, unite: 'm/s²', profil: true, libelle: 'Pic de saturation (aMax)',
        aide: 'Pic au-delà duquel la puissance vaut 100 % : balancer plus fort n’apporte rien.' },
      { id: 'gainBrasGeste', type: 'nombre', defaut: 1, min: 0, max: 2, pas: 0.05, profil: true, libelle: 'Bras du personnage : amplitude',
        aide: '0 = mouvement scripté. Calé automatiquement par le calibrage de la puissance pour que ton geste complet donne un mouvement complet à l’écran.' },
      { id: 'signeBrasGeste', type: 'choix', defaut: 1, profil: true, libelle: 'Bras du personnage : sens', options: [[1, 'Normal'], [-1, 'Inversé']],
        aide: 'Calé par le calibrage (le grand mouvement va en arrière). À inverser à la main si le bras part à l’envers.' },
      { id: 'axeBras', type: 'choix', defaut: 1, profil: true, libelle: 'Bras du personnage : axe du téléphone', options: [[1, 'β — autour de la largeur (tenu debout)'], [0, 'α — autour de l’écran'], [2, 'γ — autour de la hauteur (tenu couché)']],
        aide: 'Quel axe du téléphone tourne quand le bras balance. Calé par le calibrage selon ta façon de tenir le téléphone.' },
      { id: 'courbePuissance', type: 'nombre', defaut: 1, min: 0.4, max: 3, pas: 0.05, profil: true, libelle: 'Courbe de la jauge de puissance',
        aide: '1 = proportionnel. Au-dessus de 1, il faut forcer davantage pour atteindre le haut de la jauge. Calé automatiquement par le lancer « moyen » du calibrage.' },
      { id: 'vGesteMin', type: 'nombre', defaut: 0.8, min: 0.2, max: 5, pas: 0.1, unite: 'm/s', libelle: 'Vitesse minimale (source vitesse)' },
      { id: 'vGesteMax', type: 'nombre', defaut: 4, min: 1, max: 10, pas: 0.1, unite: 'm/s', libelle: 'Vitesse de saturation (source vitesse)' },
      { id: 'dureeMin', type: 'nombre', defaut: 150, min: 50, max: 1000, pas: 10, unite: 'ms', libelle: 'Durée minimale du maintien',
        aide: 'Plus court : lancer annulé (évite les appuis accidentels).' },
      { id: 'toleranceRelacher', type: 'nombre', defaut: 80, min: 0, max: 250, pas: 10, unite: 'ms', libelle: 'Tolérance du relâcher',
        aide: 'Fenêtre autour du relâcher dans laquelle le jeu retient le meilleur instant (rattrape un pouce qui glisse).' },
      { id: 'axeEffet', type: 'choix', defaut: 'y', profil: true, libelle: 'Axe de la torsion (effet)',
        options: [['y', 'y — axe long du téléphone'], ['x', 'x — largeur'], ['z', 'z — perpendiculaire à l’écran']],
        aide: 'Axe du téléphone autour duquel on mesure la rotation du poignet.' },
      { id: 'signeEffet', type: 'choix', defaut: 1, profil: true, libelle: 'Sens de l’effet', options: [[1, 'Normal'], [-1, 'Inversé']],
        aide: 'À inverser si la courbe part du mauvais côté pour tout le monde.' },
      { id: 'effetZoneMorte', type: 'nombre', defaut: 15, min: 0, max: 45, pas: 1, unite: '°', profil: true, libelle: 'Zone morte de l’effet',
        aide: 'Rotation du poignet ignorée (un lancer « droit » reste droit).' },
      { id: 'effetAnglePlein', type: 'nombre', defaut: 75, min: 20, max: 180, pas: 5, unite: '°', profil: true, libelle: 'Angle d’effet maximal',
        aide: 'Rotation à partir de laquelle l’effet vaut 100 %.' },
      { id: 'main', type: 'choix', defaut: 'droite', profil: true, libelle: 'Main', options: [['droite', 'Droite'], ['gauche', 'Gauche']],
        aide: 'Un gaucher a l’effet en miroir. La manette envoie sa main ; ce réglage personnel la remplace.' },
      { id: 'seuilLob', type: 'nombre', defaut: 1.5, min: 0.3, max: 5, pas: 0.1, unite: 'm/s', libelle: 'Seuil de lob',
        aide: 'Vitesse verticale (vers le haut) au relâcher au-delà de laquelle la boule est lobée.' },
      { id: 'seuilArriere', type: 'nombre', defaut: 0.5, min: 0.1, max: 3, pas: 0.1, unite: 'm/s', libelle: 'Seuil de boule arrière',
        aide: 'Vitesse vers l’arrière au relâcher au-delà de laquelle la boule part derrière (sens avant calibré requis).' },
      { id: 'gagLob', type: 'bool', defaut: true, libelle: 'Gag « boule lobée » actif' },
      { id: 'gagArriere', type: 'bool', defaut: true, libelle: 'Gag « boule en arrière » actif' },
      { id: 'glisserMin', type: 'nombre', defaut: 0.6, min: 0.1, max: 3, pas: 0.1, unite: 'px/ms', libelle: 'Glisser : vitesse minimale' },
      { id: 'glisserMax', type: 'nombre', defaut: 3, min: 0.5, max: 8, pas: 0.1, unite: 'px/ms', libelle: 'Glisser : vitesse de saturation' },
      { id: 'glisserEffet', type: 'nombre', defaut: 1.5, min: 0.2, max: 5, pas: 0.1, libelle: 'Glisser : gain de l’effet' },
      { id: 'tauFuite', type: 'nombre', defaut: 0.6, min: 0.1, max: 3, pas: 0.1, unite: 's', libelle: 'Constante de fuite de la vitesse',
        aide: 'Limite la dérive de l’intégration : plus petite = oublie plus vite.' },
      { id: 'freqArme', type: 'choix', defaut: 60, libelle: 'Envoi pendant le geste', options: [[60, '60 par seconde'], [30, '30 par seconde']] },
      { id: 'freqRepos', type: 'choix', defaut: 10, libelle: 'Envoi au repos', options: [[20, '20 par seconde'], [10, '10 par seconde'], [5, '5 par seconde']] },
    ],
  },
  {
    id: 'reseau', titre: 'Réseau', champs: [
      { id: 'serveurSignalisation', type: 'texte', defaut: '', libelle: 'Serveur de signalisation (vide = serveur public PeerJS)',
        aide: 'Nom d’hôte d’un serveur PeerJS auto-hébergé, sans https://. Prend effet au prochain chargement de la page.' },
      { id: 'delaiPlace', type: 'nombre', defaut: 10, min: 1, max: 60, pas: 1, unite: 'min', libelle: 'Conservation de la place d’une manette absente' },
    ],
  },
  {
    id: 'physique', titre: 'Physique', champs: [
      { id: 'vMin', type: 'nombre', defaut: 4, min: 2, max: 8, pas: 0.5, unite: 'm/s', libelle: 'Vitesse à 0 % de puissance' },
      { id: 'vMax', type: 'nombre', defaut: 9, min: 5, max: 14, pas: 0.5, unite: 'm/s', libelle: 'Vitesse à 100 % de puissance',
        aide: 'À 9 m/s la boule met 2 s pour atteindre les quilles ; à 4 m/s, presque 5 s.' },
      { id: 'gainEffet', type: 'nombre', defaut: 0.9, min: 0, max: 2, pas: 0.05, libelle: 'Force du crochet',
        aide: 'À lift plein : 0,9 fait virer la boule d’environ 55 cm avec un angle d’entrée de 5 à 7°. 0,5 pour un jeu plus droit, 1,3 pour de gros crochets.' },
      { id: 'debutCrochet', type: 'nombre', defaut: 45, min: 0, max: 90, pas: 5, unite: '%', libelle: 'Fin de la glisse / début du crochet',
        aide: 'Avant ce point la boule patine sur l’huile et va droit.' },
      { id: 'finCrochet', type: 'nombre', defaut: 88, min: 50, max: 100, pas: 2, unite: '%', libelle: 'Fin du crochet / début du roulement',
        aide: 'Après ce point la boule roule et file droit dans sa nouvelle direction. Rapprocher les deux valeurs donne un virage court et sec.' },
      { id: 'inclinaisonAxe', type: 'nombre', defaut: 0.55, min: 0, max: 1.2, pas: 0.05, libelle: 'Inclinaison de l’axe de rotation (lift)',
        aide: 'Visuel : à quel point on voit la boule tourner sur le côté quand elle est liftée.' },
      { id: 'vitesseLob', type: 'nombre', defaut: 2.5, min: 0.5, max: 5, pas: 0.25, unite: 'm/s', libelle: 'Lob : vitesse verticale' },
      { id: 'perteLob', type: 'nombre', defaut: 0.35, min: 0, max: 0.8, pas: 0.05, libelle: 'Lob : perte de vitesse (fraction)' },
      { id: 'masseBoule', type: 'nombre', defaut: 6.8, min: 3, max: 8, pas: 0.1, unite: 'kg', libelle: 'Masse de la boule' },
      { id: 'masseQuille', type: 'nombre', defaut: 1.4, min: 0.6, max: 3, pas: 0.05, unite: 'kg', libelle: 'Masse d’une quille',
        aide: 'Une vraie quille pèse 1,55 kg ; 1,4 garde des strikes francs dans la poche sans les offrir partout.' },
      { id: 'frottementPiste', type: 'nombre', defaut: 0.04, min: 0, max: 0.5, pas: 0.01, libelle: 'Frottement piste / boule' },
      { id: 'rebondPiste', type: 'nombre', defaut: 0.05, min: 0, max: 0.8, pas: 0.05, libelle: 'Rebond piste / boule (lob)' },
      { id: 'frottementQuille', type: 'nombre', defaut: 0.25, min: 0, max: 1, pas: 0.05, libelle: 'Frottement deck / quilles',
        aide: 'Plus bas : les quilles glissent davantage et s’entraînent mieux.' },
      { id: 'rebondQuille', type: 'nombre', defaut: 0.4, min: 0, max: 0.9, pas: 0.05, libelle: 'Rebond deck / quilles' },
      { id: 'frottementBouleQuille', type: 'nombre', defaut: 0.1, min: 0, max: 1, pas: 0.05, libelle: 'Frottement boule / quille' },
      { id: 'rebondBouleQuille', type: 'nombre', defaut: 0.4, min: 0, max: 0.9, pas: 0.05, libelle: 'Rebond boule / quille',
        aide: 'Plus haut : les quilles partent plus vite mais la boule dévie davantage.' },
      { id: 'frottementQuilleQuille', type: 'nombre', defaut: 0.1, min: 0, max: 1, pas: 0.05, libelle: 'Frottement quille / quille' },
      { id: 'aleaQuilles', type: 'nombre', defaut: 0.1, min: 0, max: 0.3, pas: 0.05, libelle: 'Aléa sur la masse des quilles (±)',
        aide: 'Un peu de hasard dans l’action de quilles ; 0 = physique parfaitement reproductible.' },
      { id: 'rebondQuilleQuille', type: 'nombre', defaut: 0.7, min: 0, max: 0.95, pas: 0.05, libelle: 'Rebond quille / quille',
        aide: 'Plus haut : les quilles se renvoient mieux (action de quilles).' },
      { id: 'rebondKickback', type: 'nombre', defaut: 0.75, min: 0, max: 0.95, pas: 0.05, libelle: 'Rebond sur les parois du deck' },
      { id: 'amortissementQuille', type: 'nombre', defaut: 0.08, min: 0, max: 0.9, pas: 0.02, libelle: 'Amortissement de rotation des quilles (en l’air)',
        aide: 'Bas : les quilles tournoient librement quand elles volent. Le freinage au sol est réglé à part.' },
      { id: 'resistanceRoulement', type: 'nombre', defaut: 2.5, min: 0, max: 8, pas: 0.5, libelle: 'Freinage des quilles couchées sur le deck',
        aide: 'Une quille sur le flanc s’arrête au lieu de rouler sans fin. Plus haut : elle s’immobilise plus vite (comptage plus rapide).' },
      { id: 'inertieQuille', type: 'nombre', defaut: 1, min: 0.5, max: 8, pas: 0.5, libelle: 'Inertie de rotation des quilles (×)',
        aide: 'Multiplie la résistance des quilles à la culbute. 1 = calcul standard.' },
      { id: 'formeQuille', type: 'choix', defaut: 'spheres', libelle: 'Forme physique des quilles', options: [['spheres', 'Sphères empilées (lisse, recommandé)'], ['cone', 'Cône + tête']],
        aide: 'Prend effet au prochain chargement de la page.' },
      { id: 'glisseInitiale', type: 'nombre', defaut: 0.9, min: 0, max: 1, pas: 0.05, libelle: 'Roulement initial de la boule (fraction)',
        aide: '1 : la boule roule dès le lâcher ; 0 : elle glisse d’abord et perd de la vitesse.' },
      { id: 'delaiMaxQuilles', type: 'nombre', defaut: 4, min: 1, max: 8, pas: 0.5, unite: 's', libelle: 'Attente maximale avant le comptage' },
      { id: 'seuilChute', type: 'nombre', defaut: 40, min: 10, max: 80, pas: 5, unite: '°', libelle: 'Inclinaison à partir de laquelle une quille est tombée' },
      { id: 'deplacementChute', type: 'nombre', defaut: 0.3, min: 0.05, max: 0.6, pas: 0.05, unite: 'm', libelle: 'Déplacement à partir duquel une quille est tombée' },
    ],
  },
  {
    id: 'cameras', titre: 'Caméras', champs: [
      { id: 'dureeResultat', type: 'nombre', defaut: 2.5, min: 0.5, max: 6, pas: 0.25, unite: 's', libelle: 'Durée du plan résultat' },
      { id: 'dureeRemise', type: 'nombre', defaut: 2.6, min: 0.5, max: 6, pas: 0.25, unite: 's', libelle: 'Durée de la remise en place' },
      { id: 'planImpact', type: 'choix', defaut: 'derriere', libelle: 'Caméra à l’impact', options: [['derriere', 'Derrière la boule (voir les quilles tomber de face)'], ['cote', 'De côté, au-dessus des parois (coupe franche)']] },
      { id: 'distanceCoupeImpact', type: 'nombre', defaut: 2.5, min: 0.5, max: 6, pas: 0.25, unite: 'm', libelle: 'Distance des quilles où la caméra passe en plan d’impact' },
      { id: 'vueDessus', type: 'bool', defaut: false, libelle: 'Préparation : vue du dessus (T)' },
      { id: 'reculPreparation', type: 'nombre', defaut: 3.1, min: 1.2, max: 7, pas: 0.1, unite: 'm', libelle: 'Préparation : recul de la caméra (zoom)',
        aide: 'Molette de la souris, touches + et −, ou boutons − / + de la manette.' },
      { id: 'hauteurPreparation', type: 'nombre', defaut: 1.75, min: 0.6, max: 5, pas: 0.05, unite: 'm', libelle: 'Préparation : hauteur de la caméra' },
      { id: 'hauteurPoursuite', type: 'nombre', defaut: 1.25, min: 0.3, max: 3, pas: 0.05, unite: 'm', libelle: 'Poursuite : hauteur de la caméra' },
      { id: 'reculPoursuite', type: 'nombre', defaut: 3.2, min: 1, max: 6, pas: 0.1, unite: 'm', libelle: 'Poursuite : recul derrière la boule' },
      { id: 'lissageCamera', type: 'nombre', defaut: 5, min: 1, max: 12, pas: 0.5, libelle: 'Réactivité des mouvements de caméra',
        aide: 'Plus haut : la caméra suit plus sèchement.' },
      { id: 'champVision', type: 'nombre', defaut: 50, min: 35, max: 75, pas: 1, unite: '°', libelle: 'Champ de vision' },
      { id: 'sautsAutorises', type: 'bool', defaut: true, libelle: 'Passer les cinématiques (touche, toucher)' },
    ],
  },
  {
    id: 'affichage', titre: 'Affichage', champs: [
      { id: 'qualite', type: 'choix', defaut: 'normale', libelle: 'Qualité du rendu', options: [['basse', 'Basse (sans ombres)'], ['normale', 'Normale'], ['haute', 'Haute']],
        aide: 'Basse si l’image saccade.' },
      { id: 'ombres', type: 'bool', defaut: true, libelle: 'Ombres' },
      { id: 'pleinEcranAuto', type: 'bool', defaut: false, libelle: 'Plein écran automatique au premier clic' },
      { id: 'tailleTextes', type: 'nombre', defaut: 100, min: 70, max: 160, pas: 10, unite: '%', libelle: 'Taille des textes du jeu' },
      { id: 'nomBowling', type: 'texte', defaut: 'BOWLING', libelle: 'Nom du bowling (enseigne au-dessus des quilles)' },
      { id: 'nomJeu', type: 'texte', defaut: 'Bowling', libelle: 'Nom du jeu (écran titre)' },
      { id: 'guideVisee', type: 'choix', defaut: 'complet', libelle: 'Ligne de visée', options: [['complet', 'Jusqu’aux quilles, avec la cible'], ['court', 'Courte (7 m)'], ['aucun', 'Aucune']],
        aide: 'La cible marque l’arrivée en ligne droite ; le lift la décale ensuite.' },
      { id: 'afficherAide', type: 'bool', defaut: true, libelle: 'Afficher l’aide clavier (H)' },
      { id: 'afficherRejoindre', type: 'bool', defaut: true, libelle: 'Afficher la boîte « Rejoindre » (J)' },
    ],
  },
  {
    id: 'regles', titre: 'Règles', champs: [
      { id: 'recentrerVisee', type: 'bool', defaut: true, libelle: 'Recentrer la visée après chaque lancer' },
      { id: 'traceDernierLancer', type: 'bool', defaut: true, libelle: 'Afficher la trace du dernier lancer pendant la préparation' },
      { id: 'nbFrames', type: 'choix', defaut: 10, libelle: 'Nombre de frames', options: [[10, '10 (partie officielle)'], [5, '5 (partie courte)']],
        aide: 'Pris en compte à la prochaine partie (modifiable aussi dans le salon).' },
      { id: 'gouttieresFermees', type: 'bool', defaut: false, libelle: 'Gouttières fermées (bumpers)' },
      { id: 'calloutsActifs', type: 'bool', defaut: true, libelle: 'Annonces (STRIKE !, SPLIT, TURKEY…)' },
      { id: 'clavierPourTous', type: 'bool', defaut: false, libelle: 'Le clavier peut lancer pour tout le monde',
        aide: 'Pour tester seul : le clavier joue le tour de n’importe quel joueur. Sinon, seul un joueur « clavier » (ou K sur une manette déconnectée) lance au clavier.' },
      { id: 'delaiPassage', type: 'nombre', defaut: 3, min: 0, max: 10, pas: 0.5, unite: 's', libelle: 'Téléphone partagé : délai « Passe le téléphone »',
        aide: 'Temps pendant lequel le lancer est bloqué après « Passe le téléphone à… », pour ne pas lancer pour l’autre par réflexe.' },
      { id: 'niveauBotDefaut', type: 'choix', defaut: 'confirme', libelle: 'Niveau proposé pour un nouveau bot', options: [['debutant', 'Débutant'], ['confirme', 'Confirmé'], ['pro', 'Pro']] },
      { id: 'delaiBot', type: 'nombre', defaut: 1.2, min: 0, max: 5, pas: 0.1, unite: 's', libelle: 'Temps de réflexion d’un bot',
        aide: 'Suivi de 0,8 s de visée et 0,7 s d’armement, tous sautables.' },
    ],
  },
  {
    id: 'audio', titre: 'Audio', champs: [
      { id: 'volumeEffets', type: 'nombre', defaut: 70, min: 0, max: 100, pas: 5, unite: '%', libelle: 'Volume des effets (boule, quilles, pinsetter)' },
      { id: 'volumeFoule', type: 'nombre', defaut: 60, min: 0, max: 100, pas: 5, unite: '%', libelle: 'Volume de la foule' },
      { id: 'volumeMusique', type: 'nombre', defaut: 25, min: 0, max: 100, pas: 5, unite: '%', libelle: 'Volume de la musique' },
      { id: 'musiqueActive', type: 'bool', defaut: true, libelle: 'Musique d’ambiance',
        aide: 'Boucle originale synthétisée ; un fichier sons/musique.ogg (ou .mp3) la remplace.' },
      { id: 'spectateurs', type: 'bool', defaut: true, libelle: 'Spectateurs dans les gradins' },
    ],
  },
];

export function champsProfil() {
  return SCHEMA.flatMap((g) => g.champs.filter((c) => c.profil));
}

export function defauts() {
  const d = {};
  for (const g of SCHEMA) for (const c of g.champs) d[c.id] = c.defaut;
  return d;
}

function champParId(id) {
  for (const g of SCHEMA) for (const c of g.champs) if (c.id === id) return c;
  return null;
}

// Convertit une valeur brute (chaîne d'un formulaire ou valeur importée) vers le type du champ.
export function normaliser(champ, valeur) {
  if (!champ) return valeur;
  if (champ.type === 'nombre') {
    const n = typeof valeur === 'number' ? valeur : parseFloat(String(valeur).replace(',', '.'));
    if (!Number.isFinite(n)) return null;
    return Math.min(champ.max, Math.max(champ.min, n));
  }
  if (champ.type === 'bool') return valeur === true || valeur === 'true' || valeur === 1;
  if (champ.type === 'choix') {
    const trouve = champ.options.find(([v]) => String(v) === String(valeur));
    return trouve ? trouve[0] : null;
  }
  return String(valeur ?? '');
}

export class Reglages {
  constructor() {
    this.valeurs = { ...defauts(), ...Reglages._charger() };
  }

  static _charger() {
    try {
      const brut = JSON.parse(localStorage.getItem(CLE) || '{}');
      const propre = {};
      for (const [id, v] of Object.entries(brut)) {
        const c = champParId(id);
        if (!c) continue;
        const n = normaliser(c, v);
        if (n !== null) propre[id] = n;
      }
      return propre;
    } catch (e) { return {}; }
  }

  _sauver() {
    try { localStorage.setItem(CLE, JSON.stringify(this.valeurs)); } catch (e) { /* stockage indisponible */ }
  }

  get(id) { return this.valeurs[id]; }

  set(id, valeur) {
    const c = champParId(id);
    if (!c) return false;
    const n = normaliser(c, valeur);
    if (n === null) return false;
    this.valeurs[id] = n;
    this._sauver();
    return true;
  }

  reinitialiser(groupeId = null) {
    if (groupeId) {
      const g = SCHEMA.find((x) => x.id === groupeId);
      if (g) for (const c of g.champs) this.valeurs[c.id] = c.defaut;
    } else {
      this.valeurs = defauts();
    }
    this._sauver();
  }

  exporter() { return { ...this.valeurs }; }

  importer(obj) {
    if (!obj || typeof obj !== 'object') return;
    const d = defauts();
    for (const [id, v] of Object.entries(obj)) {
      const c = champParId(id);
      if (!c) continue;
      const n = normaliser(c, v);
      if (n !== null) d[id] = n;
    }
    this.valeurs = d;
    this._sauver();
  }
}

// ---------- Rendu ----------

function el(tag, attrs = {}, ...enfants) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v;
    else if (k === 'text') e.textContent = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (v !== null && v !== undefined) e.setAttribute(k, v);
  }
  for (const c of enfants) if (c != null) e.append(c);
  return e;
}

// Crée le contrôle d'un champ. Options : heritage (le champ peut être vide = "hérite du global"),
// valeurHeritee (affichée en placeholder ou en première option).
export function creerControle(champ, valeur, onChange, { heritage = false, valeurHeritee } = {}) {
  let ctrl;
  if (champ.type === 'nombre') {
    ctrl = el('input', { type: 'number', min: champ.min, max: champ.max, step: champ.pas });
    ctrl.value = valeur == null ? '' : String(valeur);
    if (heritage) ctrl.placeholder = valeurHeritee == null ? '' : String(valeurHeritee);
    ctrl.addEventListener('change', () => {
      if (heritage && ctrl.value.trim() === '') { onChange(champ.id, null); return; }
      const n = normaliser(champ, ctrl.value);
      if (n === null) { ctrl.value = valeur == null ? '' : String(valeur); return; }
      ctrl.value = String(n);
      valeur = n;
      onChange(champ.id, n);
    });
  } else if (champ.type === 'choix') {
    ctrl = el('select');
    if (heritage) {
      const lib = champ.options.find(([v]) => String(v) === String(valeurHeritee));
      ctrl.append(el('option', { value: '', text: '(global : ' + (lib ? lib[1] : '—') + ')' }));
    }
    for (const [v, lib] of champ.options) ctrl.append(el('option', { value: String(v), text: lib }));
    ctrl.value = valeur == null ? '' : String(valeur);
    ctrl.addEventListener('change', () => {
      if (heritage && ctrl.value === '') { onChange(champ.id, null); return; }
      const n = normaliser(champ, ctrl.value);
      if (n !== null) onChange(champ.id, n);
    });
  } else if (champ.type === 'bool') {
    ctrl = el('input', { type: 'checkbox' });
    ctrl.checked = !!valeur;
    ctrl.addEventListener('change', () => onChange(champ.id, ctrl.checked));
  } else {
    ctrl = el('input', { type: 'text' });
    ctrl.value = valeur == null ? '' : String(valeur);
    ctrl.addEventListener('change', () => onChange(champ.id, ctrl.value.trim()));
  }
  const libelle = el('span', { class: 'libelle' }, champ.libelle + (champ.unite ? ' (' + champ.unite + ')' : ''), champ.profil ? el('span', { class: 'badge-p', title: 'Réglable par profil' }, 'P') : null);
  const ligne = el('label', { class: 'champ ' + (champ.type === 'bool' ? 'champ-bool' : '') }, libelle, ctrl);
  const bloc = el('div', { class: 'bloc-champ' }, ligne);
  if (champ.aide) bloc.append(el('div', { class: 'aide' }, champ.aide));
  return bloc;
}

// Panneau complet des réglages globaux. onChange(id, valeur) est appelé après chaque modification.
export function rendrePanneau(conteneur, reglages, onChange) {
  conteneur.textContent = '';
  for (const g of SCHEMA) {
    const details = el('details', { class: 'groupe', open: g.id === 'manette' ? '' : null });
    details.append(el('summary', {}, g.titre, g.lot ? el('span', { class: 'etiquette' }, 'lot ' + g.lot) : null));
    if (!g.champs.length) {
      details.append(el('div', { class: 'aide' }, 'Ces réglages arrivent au lot ' + g.lot + '.'));
    } else {
      if (g.lot) details.append(el('div', { class: 'aide' }, 'D’autres réglages arrivent au lot ' + g.lot + '.'));
      for (const c of g.champs) {
        details.append(creerControle(c, reglages.get(c.id), (id, v) => { reglages.set(id, v); onChange(id, v); }));
      }
      details.append(el('button', { class: 'secondaire', type: 'button', onclick: () => { reglages.reinitialiser(g.id); rendrePanneau(conteneur, reglages, onChange); onChange(null, null); } }, 'Réinitialiser « ' + g.titre + ' »'));
    }
    conteneur.append(details);
  }
}

// Champs "par profil" d'une manette. surcharges : { id: valeur | null }. onChange(id, valeur|null).
export function rendreChampsProfil(conteneur, surcharges, reglagesGlobaux, onChange) {
  conteneur.textContent = '';
  for (const c of champsProfil()) {
    const v = surcharges && surcharges[c.id] != null ? surcharges[c.id] : null;
    conteneur.append(creerControle(c, v, onChange, { heritage: true, valeurHeritee: reglagesGlobaux[c.id] }));
  }
}
