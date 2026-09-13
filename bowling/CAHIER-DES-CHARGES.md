# Bowling — Cahier des charges V1

*Jeu de bowling façon Wii Sports : la partie se joue sur l'écran du PC, les iPhone servent de manettes à mouvement. Document de référence, conservé dans `jeux/bowling/`. Statut : validé (« ok » sur toutes les recommandations du §8) ; les écarts décidés en cours de lot sont marqués « [lot 1] », « [lot 2] »…*

## 0. Principes

1. **Fidèle à l'expérience, original dans les assets.** On reproduit la sensation (geste, rythme, caméras, réactions, score), pas les éléments protégés : pas de Mii ni d'élément graphique ou sonore Nintendo. Personnages, logos, musique : originaux.
2. **Complet dès la V1 = tout ce qui se règle est réglable sans toucher au code.** Sensibilité, physique, durées, sons, règles : dans un panneau de réglages avec export/import. Le banc de calibrage du lot 1 reste dans le produit final.
3. **Ne jamais punir le joueur sur un doute.** Quand les capteurs sont ambigus, le jeu retient l'interprétation la plus favorable (lancer normal) plutôt qu'un raté.
4. **L'écran est la référence, le téléphone est une télécommande.** Comme la manette Wii : aucune information de jeu essentielle sur le téléphone.
5. **Chaque brique a un repli.** Clavier/souris si les téléphones échouent, saisie du code si le QR ne se lit pas, sons synthétisés si les fichiers audio manquent, partage de connexion iPhone si le Wi-Fi bloque le pair-à-pair.

## 1. Périmètre V1

### Inclus
- Partie de 1 à 4 joueurs, 10 frames (option 5), règles officielles du ten-pin, 10e frame complète.
- Un téléphone par joueur **ou** un seul téléphone qu'on se passe **ou** joueur au clavier/souris ; mélange possible.
- Joueur ordinateur (bot) à 3 niveaux, pour le solo et les tests.
- Trois entraînements : Spares (configurations de quilles restantes), Lancers puissants (rack qui grossit à chaque frame : 10, 15, 21, 28, 36, 45, 55, 66, 78, 91 quilles), Contrôle de l'effet (barrières sur la piste imposant une courbe).
- Personnages originaux paramétrables (couleur, coiffure, teint, main), option visage à partir d'une photo (découpe en cercle dans le navigateur, rien n'est envoyé nulle part).
- Spectateurs animés, réactions, callouts, sons, musique d'ambiance originale.
- Profils, statistiques, niveau d'expérience (titre « Pro » à 1000 points → boule spéciale).
- Sauvegarde automatique de la partie en cours (un rafraîchissement reprend où on en était).
- Panneau de réglages complet + banc de calibrage + export/import JSON.
- PWA écran et manette (installables, pages en cache hors ligne).
- Documentation : README d'installation et d'utilisation, ce cahier des charges.

### Exclus (décisions conscientes)
- Jeu en ligne à distance (la brique PeerJS le permettra ; lot ultérieur, commun avec Bump).
- Test de forme (mode transversal de Wii Sports).
- Vibrations sur iPhone : Safari n'expose pas l'API. Le retour se fait sur l'écran et par le son.
- Modèles 3D ou textures importés : tout est généré (primitives, textures dessinées sur canvas). Les sons peuvent être remplacés par des fichiers CC0 déposés dans `sons/`.
- Android : devrait fonctionner (signe de l'accélération inversé par rapport à iOS, prévu dans le code) mais ni testé ni calibré.
- Avatar cartoon généré par IA (évolution optionnelle, comme pour Bump).

## 2. Architecture

### Fichiers (dépôt `jeux`, dossier `bowling/`)
```
bowling/
  index.html              écran (PC)
  manette.html            téléphone
  README.md
  CAHIER-DES-CHARGES.md
  manifest.webmanifest, sw.js, icones/
  js/
    ecran/                scene, physique, cameras, regles, ui, reseau, audio, personnages, reglages
    manette/              capteurs, reseau, ui
    commun/               protocole, constantes, textes
  lib/                    three, cannon-es, peerjs, qrcode — copiés dans le dépôt
  sons/                   optionnel : fichiers CC0 ; sinon sons synthétisés
```
Pourquoi pas un fichier unique comme Bump : le produit a des icônes, un service worker, des sons optionnels et deux pages ; et copier les bibliothèques dans `lib/` garantit que le jeu fonctionne même si un CDN tombe ou change de version. Seule dépendance externe à l'exécution : le serveur de signalisation PeerJS (§5).

### Bibliothèques
Three.js (rendu 3D), cannon-es (physique), PeerJS (WebRTC), qrcode (génération du QR). Versions figées dans `lib/`.

### Hébergement et cycle de développement
- GitHub Pages : `https://<identifiant>.github.io/jeux/bowling/` (écran) et `.../manette.html` (téléphone). HTTPS obligatoire pour les capteurs iPhone.
- Pendant les réglages : manette en ligne, écran servi en local sur le PC (`localhost`), le pair-à-pair fonctionne entre les deux. L'écran est mis en ligne à chaque lot validé.
- Navigateur écran : Chrome ou Edge, plein écran (F11 ou bouton du menu), 16:9, TV en HDMI possible. Téléphones : Safari, puis PWA au lot 5.

## 3. La manette (téléphone)

### 3.1 Écran
- Portrait, fond aux couleurs du joueur. Trois zones : bandeau haut (nom, état de connexion, latence, « À toi » / « Attends »), zone visée (◀ ▶ Position, ◀ ▶ Angle, valeurs affichées), zone LANCER (au moins 55 % de la hauteur, écartée des bords gauche et droit de 24 px pour ne pas déclencher le retour arrière de Safari).
- Première ouverture : bouton « Activer les capteurs » (Safari exige un toucher pour afficher la demande), puis nom et choix couleur/main si aucun profil. Le code de salle est pré-rempli par l'URL du QR (`manette.html?salle=XXXXX`) ou saisi à la main.
- États affichés sans ambiguïté : Connexion… / Connecté / Reconnexion… / Ce n'est pas ton tour / Tiens et balance / Lancer envoyé / Lancer annulé.

### 3.2 Cycle de vie
- Autorisation demandée pour `DeviceMotion` **et** `DeviceOrientation`, directement dans le gestionnaire du toucher (pas après une attente asynchrone, sinon Safari refuse). En cas de refus : message expliquant qu'il faut recharger la page pour redemander.
- Écran maintenu allumé : Wake Lock (iOS 16.4+), repli vidéo silencieuse en boucle.
- Gestes système neutralisés : zoom double-tap, sélection, loupe d'appui long, rebond de défilement (`touch-action`, `user-select`, `overscroll-behavior`, page en position fixe).
- Orientation : mise en page valable en portrait et en paysage ; le geste est calculé par rapport à la position de départ de chaque lancer, donc indépendant de la façon de tenir.
- Perte de l'onglet (verrouillage, appel, notification) : reconnexion automatique, le joueur retrouve sa place (jeton persistant dans le téléphone).
- Batterie : flux capteurs à 60 Hz uniquement pendant le lancer armé (doigt posé), 10 Hz sinon pour l'affichage du banc.

### 3.3 Transposition des commandes Wii
| Sur Wii | Sur téléphone |
|---|---|
| Croix gauche/droite : déplacer le joueur | Boutons ◀ ▶ Position (appui maintenu = déplacement continu) |
| A puis croix : orienter le lancer | Boutons ◀ ▶ Angle |
| Tenir B, balancer, relâcher B | Poser le pouce sur LANCER, balancer, lever le pouce |
| Vitesse du bras → puissance | Pic d'accélération / vitesse intégrée pendant le geste |
| Rotation du poignet → effet | Rotation du téléphone autour de son axe long (gyroscope) entre le départ et le relâcher |
| Relâcher trop tard → boule lobée | Relâcher pendant une montée → boule lobée, rebonds, perte de vitesse |
| Relâcher trop tôt → boule en arrière | Relâcher pendant le mouvement arrière → boule derrière, 0 quille, rires (désactivable) |
| Dragonne | Aucun équivalent : le lancer est **un relâcher du pouce**, pas de la main. La puissance sature sur un geste modéré : balancer fort n'apporte rien. Une coque à lanière est un plus si vous en avez. |

### 3.4 Modes de lancer (par profil, changeable à tout moment)
1. **Relâcher** (défaut, fidèle) : l'instant du lancer est le relâcher, avec fenêtre de tolérance (±80 ms) pour rattraper un pouce qui glisse.
2. **Automatique** : le pouce reste posé pendant tout le geste ; le jeu prend comme instant de lancer le pic de vitesse avant du balancier. Pour un joueur qui relâche trop tôt ou trop tard de façon répétée.
3. **Glisser** : sans mouvement du bras, un glissement du doigt vers le haut sur la zone LANCER (vitesse → puissance, courbure → effet). Pour jouer assis, ou un invité mal à l'aise.
4. **Clavier/souris** (sur le PC) : ← → position, Q/D angle, Espace maintenu = jauge de puissance oscillante, relâcher = lancer, ← → pendant l'appui = effet.

### 3.5 Algorithme du geste (côté écran, entièrement paramétré)
1. Au **poser** : mémoriser l'orientation neutre et le vecteur gravité ; vider le tampon.
2. Pendant le **maintien** : accumuler les échantillons (accélération sans gravité, avec gravité, vitesse angulaire, orientation, horodatage). Vitesse linéaire estimée par intégration avec fuite (limite la dérive). Repérer le mouvement arrière (première phase du balancier).
3. Au **relâcher** :
   - Puissance = valeur de 0 à 1, projetée depuis le pic d'accélération (ou la vitesse estimée) entre `aMin` (geste minimal) et `aMax` (saturation). Sous `aMin` ou maintien plus court que `dureeMin` → lancer annulé, retour à la préparation.
   - Effet = angle de rotation autour de l'axe long (axe y du téléphone, réglage `axeEffet`), zone morte `effetZoneMorte`, 100 % atteint à `effetAnglePlein` [lot 1 : remplace `effetGain`], plafond ±1, signe inversé pour un gaucher (et réglage global `signeEffet`).
   - Sens « avant » : calibré par joueur sur 3 lancers normaux et mémorisé dans son profil [lot 1] ; tant qu'il ne l'est pas, le gag « boule en arrière » reste inactif.
   - Phase : composante verticale de la vitesse au relâcher (montée au-delà de `seuilLob` → lob) ; sens (même sens que le mouvement arrière → boule arrière). En cas de doute : lancer normal.
4. Le résultat (puissance, effet, phase, position, angle) s'affiche sur le banc de calibrage à chaque lancer.

### 3.6 Protocole de messages (JSON, un canal de données par téléphone)
- Téléphone → écran : `bonjour {version, jeton, nom, couleur, main, plateforme}`, `echantillon {seq, t, dt, a, ag, r, o, pose}` (60 Hz si posé, 10 Hz sinon), `pose {t}`, `leve {t}`, `glisser {t, dx, dy, duree, vitesse}` [lot 1], `visee {quoi: position|angle, sens: ±1}`, `saut {t}` [lot 2 : toucher pendant une cinématique = passer la phase], `commencer {t}` [lot 3 : le premier téléphone lance la partie depuis le salon], `pong {t, tp}`.
- Écran → téléphone : `bienvenue {index, couleur, config, etat}` [lot 1], `etat {tonTour, phase, position, angle, latence, message, joueur, passe, premier}` [lot 2 : `phase` = preparation | cinematique | attente ; la zone LANCER affiche « Passer ▶ » pendant une cinématique] [lot 3 : phases `salon` et `fin` ; `joueur` = nom du joueur courant ; `passe` = nom à qui passer ce téléphone (téléphone partagé, lancer bloqué pendant `delaiPassage`) ; `premier` = ce téléphone peut commencer], `config {modeLancer, freqArme, freqRepos}`, `ping {t}`, `refus {raison}` (salle pleine, version de protocole), `resultat {resultat, puissance, effet, phase, raison}` [lot 1].
- Convention capteurs : accélérations en convention W3C (iOS inverse le signe, corrigé par la manette) ; `r = [alpha (z), beta (x), gamma (y)]`. Détail dans `js/commun/protocole.js`.
- Horloges alignées par ping/pong (décalage moyen), pour rapprocher l'instant du relâcher des échantillons.

## 4. Le jeu (écran)

### 4.1 Direction artistique
- Cartoon lumineux et propre : formes simples, couleurs saturées, ombres douces, aucune texture photo. Piste en bois clair verni, bowling chaleureux (pistes voisines décoratives, retour de boules, panneau au-dessus des quilles avec un logo original, éclairage de plafond).
- Lisibilité à 3 m : textes de score d'au moins 28 px en 1080p, contrastes forts, palette joueurs distinguable par les daltoniens (bleu, orange, vert, violet).
- Rendu : tone mapping filmique, ombres portées (désactivables), anticrénelage, résolution adaptable (qualité Basse / Normale / Haute).

### 4.2 Scène et dimensions (échelle réelle, en mètres)
- Piste : 18,29 m de la ligne de faute à la quille 1, largeur 1,05 m ; gouttières de 0,24 m de chaque côté ; approche de 4,57 m ; deck des quilles ; fosse derrière.
- Quilles : 10, hauteur 0,38 m, diamètre 0,12 m, espacées de 0,305 m en triangle ; masse 1,5 kg, centre de gravité bas.
- Boule : diamètre 0,216 m, masse 6 kg ; couleur du joueur ; boule « Pro » pailletée après 1000 points.
- Barrières (Contrôle de l'effet) : blocs posés sur la piste, décoratifs mais solides.

### 4.3 Personnages originaux
- « Bonshommes » construits par primitives : tête ronde, corps arrondi, bras articulés (pivots épaule et coude), jambes simples ; tenue à la couleur du joueur ; 6 coiffures, 6 teints ; visage dessiné (yeux/bouche, 5 expressions) **ou** photo découpée en cercle appliquée sur la tête (outil intégré : import, cadrage, aperçu).
- Animations procédurales : attente (respiration), déplacement latéral, balancier qui suit en temps réel l'inclinaison et la vitesse du téléphone, lancer, boule lobée (sursaut), boule arrière (se retourne), joie (saut, poing levé), déception (tête basse), turkey (petite danse).
- Spectateurs : 8 bonshommes assis derrière, même constructeur, couleurs aléatoires ; réactions collectives (bras levés, applaudissements, rires, « oh » déçu) synchronisées avec les sons.

### 4.4 Caméras (durées réglables, toutes sautables d'une touche ou d'un toucher)
1. Préparation : derrière et au-dessus du joueur, quilles visibles ; flèche de visée pointillée au sol qui suit position et angle.
2. Balancier : même caméra, le personnage bouge avec le téléphone.
3. Roulement : poursuite derrière la boule, légèrement en hauteur, cadrée sur les quilles ; la courbe de l'effet est bien visible.
4. Impact : à 2 m des quilles, coupe sur une caméra basse de côté au niveau du deck ; suivi jusqu'à immobilisation (4 s maximum). [lot 2] Le côté alterne à chaque lancer ; distance réglable (`distanceCoupeImpact`).
5. Résultat : callout plein écran (STRIKE !, SPARE !, SPLIT, TURKEY, GOUTTIÈRE, PARTIE PARFAITE), réaction du joueur et des spectateurs, mise à jour du score.
6. Remise en place : barre du pinsetter, quilles retirées ou replacées, retour en 1 avec bandeau « À toi, <nom> » (ou « Passe le téléphone à <nom> » en mode partagé).

[lot 2] Les plans 1, 3, 4, 6 et un plan « résultat » (callout texte seulement) sont livrés ; le personnage et les réactions arrivent au lot 4. Passer une cinématique : Espace/Entrée au clavier, toucher sur le téléphone (message `saut`), réglage `sautsAutorises`. Pendant le roulement, passer avance la simulation jusqu'à l'immobilité puis compte.

### 4.5 Physique
- Moteur cannon-es, pas fixe de 1/120 s avec sous-pas, mise en veille des corps immobiles.
- Vitesse de lancement = `vMin` + puissance × (`vMax` − `vMin`), défaut 4 → 9 m/s. Trajectoire initiale selon position + angle. [lot 2] Position ±1 (= ±0,40 m) par pas de 0,05 ; angle **±4° par pas de 0,25°** (à 18 m, 3° suffisent à traverser la piste : les ±12° du banc étaient trop larges). Roulement initial `glisseInitiale` (défaut 0,9 : la boule roule presque dès le lâcher).
- Effet : accélération latérale = effet × `gainEffet` × profil(distance), profil nul sur les 60 % premiers de la piste puis croissant (l'huile puis le sec : la boule part droit et crochète tard, comme au vrai bowling). Rotation visuelle de la boule cohérente. [lot 2] L'effet est appliqué comme un décalage de vitesse latérale **avec la rotation de roulement correspondante** (et non une force), sinon le frottement de la piste annule le crochet. Défaut `gainEffet` 2,5 → déviation ≈ 25 cm aux quilles à effet plein.
- Lob : vitesse verticale initiale, rebonds amortis, perte `perteLob` de vitesse. Arrière : la boule part vers l'approche, lancer = 0 quille.
- Quilles : forme composée (cylindre + sphère), frottement `frottementQuille`, restitution `rebondQuille` ; contacts boule-quille et quille-quille. [lot 2] Forme retenue : base cylindrique plate (tenue debout) + trois sphères ventre/cou/tête (contacts lisses) ; l'alternative « cône + tête » reste en réglage. Les quilles sont **gelées** (hors simulation, pose exacte) tant que la boule n'est pas à 3 m : aucune chute spontanée possible. Masse par défaut 1,2 kg (réel 1,55 kg, réglable) : plus généreux dans la poche. **Le frottement de cannon-es n'est pas un coefficient de Coulomb** (sa borne agit comme une impulsion par pas) : les réglages sont exprimés en valeurs réelles et convertis en interne (μ × pas / 4, mesuré). Kickbacks (parois du deck) et fosse modélisés.
- Comptage : une quille est tombée si son axe s'écarte de plus de 40° de la verticale, si son centre a bougé de plus de 0,3 m ou si elle a quitté le deck. Comptage quand toutes les quilles dorment, ou après `delaiMaxQuilles` (4 s). [lot 2] Résultats mesurés par le test automatique : pleine poche (5–7 cm à droite de la quille 1) → strike ≈ 2 fois sur 3 ; zone 3–10 cm → 8,5 quilles en moyenne ; quille 1 de face → split 4-6-7-10 ; effleurer la 7 → 3 quilles ; gouttière → 0.
- Pinsetter : entre deux boules, les quilles debout sont remises exactement à leur place (pas de quille déplacée jouable, comme sur Wii) ; après la frame, rack complet.
- Gouttière : la boule y tombe si son centre dépasse le bord ; elle y roule jusqu'à la fosse sans toucher les quilles. Option « Gouttières fermées » (rebonds) pour les enfants.
- Anti-blocage : boule immobile plus de 2 s hors gouttière → fin de trajectoire ; quille sortie de la zone → tombée.

### 4.6 Règles et score
- Ten-pin officiel : 10 frames, 2 boules par frame, strike = 10 + les 2 boules suivantes, spare = 10 + la boule suivante ; 10e frame : strike → 2 boules bonus (rack remis après chaque strike), spare → 1 boule bonus ; maximum 300.
- Callouts : Strike, Spare, Split (quille 1 tombée et quilles restantes non adjacentes), Turkey (3 strikes de suite), Gouttière, Partie parfaite (300, feu d'artifice). [lot 3] Split formalisé par le graphe d'adjacence des quilles (deux quilles à un espacement) : split si les quilles debout forment au moins deux groupes séparés (7-10, 4-6, 2-7, 4-6-7-10 oui ; 4-7, 6-10 non). Un strike exige un rack « frais » : 0 puis 10 est un spare. Textes livrés au lot 3 (feu d'artifice et réactions au lot 4).
- Pas de ligne de faute (comme sur Wii).
- Fin de partie : classement, meilleur lancer, statistiques (moyenne, strikes, spares), points d'expérience.
- Cas de test (à réussir en lot 3) : 12 strikes = 300 ; dix frames « 9 puis spare » = 190 ; que des gouttières = 0 ; la partie `X, 7/, 9-, X, X, X, 2-3, 6/, 7-2, X-8-1` = 165. [lot 3] Les quatre passent dans `tests/score.test.mjs`, plus les variantes de 10e frame (XXX, X7/, 4/X, -/X, X-/, deux boules simples) et 5 frames (7 strikes = 150).

### 4.7 Déroulé d'une partie
1. Titre (survol de la salle) → Nouvelle partie / Entraînement / Profils / Réglages / Calibrage.
2. Salon : code de salle en grand + QR ; les téléphones apparaissent au fur et à mesure (nom, couleur, main, mode de lancer) ; ajout d'un joueur clavier ou d'un bot ; ordre modifiable ; Commencer depuis l'écran ou depuis le premier téléphone.
3. Tours : l'écran active le téléphone du joueur courant, les autres reçoivent « Attends ». Toute tentative hors tour est ignorée, avec message. [lot 3] Le clavier ne lance que pour un joueur « clavier », ou pour n'importe qui si le réglage `clavierPourTous` est actif (test solo), ou pour une manette déconnectée après **K**. Téléphone partagé : « Passe le téléphone à <nom> » sur l'écran et sur le téléphone, lancer bloqué pendant `delaiPassage` (3 s).
4. Interruptions : téléphone déconnecté → bandeau « Manette de <nom> déconnectée », pause pour ce joueur, reprise automatique, option « jouer ce tour au clavier ». [lot 3] Livré (touche K, réversible).
5. Fin : classement, Rejouer (mêmes joueurs) / Menu.
6. Rafraîchissement ou plantage : au retour, proposition de reprendre la partie sauvegardée (état enregistré après chaque lancer). [lot 3] Livré : `localStorage bowling.partie` (joueurs, feuilles, quilles debout, mode de remise) ; le salon propose « Reprendre — Frame n · joueurs » ; les téléphones retrouvent leur joueur par leur jeton ; une manette absente laisse le tour en pause avec l'option K.

### 4.8 Modes
- **Partie** : 1–4 joueurs, 10 ou 5 frames, options gouttières fermées / gags (lob, arrière).
- **Spares** : 10 lancers sur des configurations tirées d'une liste (7-10, 4-6-7-10, 3-10, 2-4-5-8, 6-7, etc.) ; score = spares réussis ; meilleur score enregistré.
- **Lancers puissants** : 10 frames, une boule par frame, rack qui grossit (10 → 91 quilles) ; score = quilles tombées cumulées.
- **Contrôle de l'effet** : 10 lancers, barrières placées pour imposer une courbe croissante ; score = quilles tombées.
- **Bot** : 3 niveaux (Débutant, Confirmé, Pro) — position, angle, puissance et effet choisis avec un bruit décroissant ; joue avec les mêmes animations et durées (sautables). [lot 3] Livré : rack complet → poche (+6 cm) ; sinon centre du groupe de quilles debout le plus fourni (un 7-10 le force à choisir un côté) ; le Pro joue avec un effet 0,3 compensé au départ. Déroulé visible : réflexion (`delaiBot` 1,2 s) → visée (0,8 s) → armement (0,7 s) → lancer, sautable d'une touche ou d'un toucher.

### 4.9 Sons et musique
- Web Audio, débloqué au premier clic du menu (politique des navigateurs).
- Sons : roulement (grave, hauteur selon la vitesse), impact quilles (variantes selon le nombre), gouttière, rebond du lob, pinsetter, foule (acclamations graduées, rires, « oh »), interface, jingles Strike / Spare / Turkey / Partie parfaite.
- Chaque son a une version synthétisée intégrée ; si un fichier du même nom existe dans `sons/` (CC0), il est utilisé à la place. Liste des noms attendus dans le README.
- Musique : boucle d'ambiance originale synthétisée, volume faible par défaut, désactivable ; volumes séparés (effets, foule, musique).

### 4.10 Interface écran
- Scoreboard en bandeau haut, style feuille de bowling : 10 cases par joueur, marques X / / -, totaux cumulés, joueur courant surligné, frame courante clignotante. [lot 3] Livré (DOM) ; total provisoire entre parenthèses tant que des bonus sont en attente.
- Bandeau bas : « À toi, Valentin », position et angle actuels, mode de lancer, latence.
- Menus au clavier et à la souris ; panneau de réglages (touche Échap) et banc de calibrage (touche C) accessibles en cours de partie.
- Textes centralisés dans `commun/textes.js` (français, traduisible).

## 5. Réseau et robustesse
- PeerJS : l'écran crée un pair d'identifiant `bowl-XXXXX` (5 caractères, sans O/0/I/1) ; chaque téléphone se connecte à cet identifiant ; canal de données non ordonné (aucune file d'attente sur les échantillons), numéro de séquence pour ignorer les échantillons en retard.
- Dépendance Internet : le serveur public de signalisation PeerJS sert uniquement à la mise en relation ; ensuite le trafic est direct sur le Wi-Fi. Internet est donc nécessaire au démarrage (et pour charger les pages, sauf PWA installée). Adresse du serveur de signalisation modifiable dans les réglages (repli vers un serveur auto-hébergé si le public tombe).
- Latence : mesurée en continu (ping), affichée ; attendue sous 30 ms sur le même Wi-Fi.
- Wi-Fi qui isole les appareils (réseau invité, réseau public) : le pair-à-pair échoue → message explicite et solution : partage de connexion depuis un iPhone, PC connecté dessus ; ou jeu au clavier.
- Reconnexion : le téléphone retente toutes les 2 s ; l'écran conserve la place 10 minutes ; jeton persistant côté téléphone.
- Salle pleine (5e téléphone) : refus propre. Un téléphone déjà connu qui recharge la page reprend sa place.
- Onglet écran en arrière-plan : physique en pause (pas de rattrapage brutal au retour).

## 6. Réglages exposés (le contrat « zéro retouche de code »)
Panneau sur l'écran, groupé, avec valeur par défaut, bornes, description, bouton Réinitialiser par groupe, Exporter/Importer JSON. Les réglages **par profil** sont marqués (P).

| Groupe | Réglages |
|---|---|
| Manette | mode de lancer (P), `sourcePuissance`, `aMin` / `aMax` (P), `vGesteMin` / `vGesteMax`, `dureeMin`, tolérance du relâcher, `axeEffet`, `signeEffet`, `effetZoneMorte` et `effetAnglePlein` (P), main (P), `seuilLob`, `seuilArriere`, gags lob/arrière actifs, réglages du mode Glisser, `tauFuite`, fréquences d'envoi |
| Physique | `vMin`, `vMax`, `gainEffet`, début du crochet (%), `perteLob`, masse boule, masse quille, frottements, restitutions, `delaiMaxQuilles`, seuil de chute (°) |
| Caméras | durée de chaque phase, hauteur et recul de la poursuite, sauts autorisés |
| Audio | volumes effets / foule / musique, musique activée |
| Affichage | qualité, ombres, plein écran automatique, taille des textes |
| Règles | nombre de frames, gouttières fermées, callouts, bots |
| Réseau | serveur de signalisation, délai de conservation de la place |
| Système | export/import de tout (réglages + profils + statistiques), remise à zéro |

## 7. Persistance et PWA
- Écran (`localStorage`) : réglages, profils (nom, couleur, coiffure, teint, main, mode, sensibilité, photo réduite), statistiques et expérience, partie en cours.
- Téléphone : jeton, profil léger (nom, couleur, main), dernier code de salle.
- PWA : manifeste + service worker pour les deux pages (icônes, plein écran depuis l'écran d'accueil iPhone) ; cache des pages et de `lib/` ; la signalisation reste dépendante d'Internet.

## 8. Remises en question et décisions à valider

| # | Sujet | Recommandation | Alternative | À valider |
|---|---|---|---|---|
| 1 | Fidélité graphique | Ambiance, caméras, rythme et callouts fidèles ; personnages, logos et sons originaux | Aucune : pas de Mii ni d'asset Nintendo | — |
| 2 | « Aucune optimisation à demander ensuite » | Garanti par le panneau de réglages, le banc de calibrage et le protocole de validation, pas par des valeurs devinées : le calibrage se fait avec vous au lot 1 puis au lot 6 | Valeurs figées dans le code (à exclure) | OK ? |
| 3 | Mode de lancer par défaut | Relâcher (fidèle) avec tolérance ; Automatique proposé à quiconque relâche mal | Automatique par défaut | Choix |
| 4 | Puissance plafonnée sur un geste modéré | Oui (sécurité du téléphone, pas de course à la violence) | Plafond haut | OK ? |
| 5 | Téléphone partagé, clavier, bot | Inclus tous les trois | Téléphones seulement | OK ? |
| 6 | Structure | Dossier multi-fichiers + bibliothèques copiées dans `lib/` | Fichier unique + CDN (fragile, PWA impossible) | OK ? |
| 7 | Entraînements | Les trois inclus en V1 | Partie seule en V1 | Choix |
| 8 | Visage photo | Découpe en cercle incluse en V1 ; cartoon IA exclu | Sans photo | Choix |
| 9 | Réalisme | Physique réelle mais réglée pour le plaisir : strike accessible sur un lancer propre dans la poche (entre les quilles 1 et 3), splits possibles | Réalisme strict | OK ? |
| 10 | Musique | Boucle originale synthétisée, volume bas, désactivable | Pas de musique | Choix |
| 11 | Dépendance Internet (signalisation) | Acceptée ; serveur alternatif possible plus tard | Serveur local + certificat installé sur chaque iPhone | OK ? |
| 12 | Écran du téléphone minimal | Oui (pas de 3D, pas d'info de jeu : batterie et lisibilité) | Mini-vue de la visée sur le téléphone | OK ? |
| 13 | Langue | Français partout, textes centralisés | Bilingue | OK ? |
| 14 | Joueurs et frames | 1–4 joueurs, 10 frames (option 5) | Jusqu'à 8 | OK ? |
| 15 | Noms | Nom du jeu, nom du bowling (logo au-dessus des quilles) | — | À me donner |

## 9. Inconnues à trancher au lot 1 (banc de calibrage)
1. Le pair-à-pair passe-t-il sur votre box entre iPhone (Wi-Fi) et PC (Ethernet ou Wi-Fi) ? Isolation Wi-Fi ?
2. Fréquence réelle des capteurs sous Safari (60 Hz attendu) et régularité des horodatages.
3. Latence mesurée (attendue sous 30 ms).
4. Comportement de l'autorisation capteurs après un refus, après fermeture de Safari, après ajout à l'écran d'accueil.
5. Wake Lock disponible (iOS 16.4 ou plus) ; sinon repli vidéo.
6. Fiabilité du relâcher du pouce en plein geste (glissement précoce ? tardif ?) → mode par défaut pour chacun de vous.
7. Amplitude de vos gestes → `aMin` / `aMax` par profil.
8. Verrouillage automatique de l'iPhone pendant une attente longue (tour des autres joueurs).
9. Prise en main naturelle pendant le geste (portrait ou paysage).
10. Disponibilité du serveur public PeerJS et collisions d'identifiants (aucune attendue avec 5 caractères).

## 10. Protocole de validation
À exécuter à chaque lot concerné, puis en totalité avant le gel de la V1.

### Connexion (lot 1)
- [ ] Rejoindre par QR (appareil photo iPhone → Safari) et par saisie du code.
- [ ] Deux téléphones connectés simultanément, nommés et colorés.
- [ ] Verrouiller l'iPhone 30 s, déverrouiller : reconnexion sans intervention, même place.
- [ ] Passer sur une autre appli 1 min, revenir : idem.
- [ ] Couper le Wi-Fi 10 s : « Reconnexion… » puis reprise.
- [ ] Recharger la page manette : même place.
- [ ] Un 5e appareil : refus propre.
- [ ] Latence affichée sous 30 ms ; aucun échantillon en retard traité.

### Capteurs et geste (lot 1, puis lot 6)
- [ ] Autorisation demandée après un toucher ; refusée, puis accordée après rechargement.
- [ ] L'écran du téléphone ne s'éteint pas pendant 5 min de partie.
- [ ] Aucun zoom, sélection ou retour arrière déclenché par le geste (20 lancers).
- [ ] Pouce posé immobile 3 s puis levé : aucun lancer (annulé).
- [ ] 10 lancers doux / 10 moyens / 10 forts par joueur : puissances croissantes, saturation atteinte sur les forts.
- [ ] 10 lancers droits : effet dans la zone morte ; 10 lancers avec torsion : effet du bon signe, inversé pour un gaucher.
- [ ] Relâcher en montée → lob ; relâcher en arrière → arrière ; geste ambigu → lancer normal.
- [ ] Lancer hors tour : ignoré, avec message.
- [ ] Modes Automatique et Glisser : 10 lancers chacun, cohérents.

### Physique (lot 2)
- [ ] Rack immobile 30 s sans boule : aucune quille ne bouge.
- [ ] Boule dans la poche à vitesse moyenne : strike dans la grande majorité des cas.
- [ ] Boule de face sur la quille 1 : split fréquent.
- [ ] Boule effleurant la quille 7 ou 10 : une seule quille.
- [ ] Gouttière : aucune quille touchée, boule jusqu'à la fosse.
- [ ] Lob : rebonds amortis, jamais de boule qui traverse la piste.
- [ ] Comptage terminé en moins de 4 s dans tous les cas ; sur 50 lancers, aucune quille comptée debout alors qu'elle est couchée, ni l'inverse.
- [ ] Remise en place : quilles debout exactement replacées.
- [ ] 60 images/s stables sur le PC ; plus de 30 en qualité Basse sur un ordinateur modeste.

### Règles et déroulé (lot 3)
- [ ] Les quatre parties de test du §4.6 donnent 300, 190, 0 et 165.
- [ ] 10e frame : strike-strike-strike, strike-spare, spare-strike, deux boules simples.
- [ ] Callouts justes : split (7-10, 2-7), turkey, gouttière.
- [ ] Tours : 2 téléphones + 1 clavier + 1 bot, ordre respecté ; téléphone partagé avec message de passage.
- [ ] Rafraîchir l'écran en pleine partie : reprise proposée, score et tour corrects.
- [ ] Déconnexion d'un téléphone pendant son tour : pause, option clavier, reprise.

### Présentation (lot 4)
- [ ] Séquence complète de caméras sans coupure brutale ; chaque phase sautable.
- [ ] Réactions joueur et spectateurs cohérentes (strike, spare, gouttière, arrière, turkey, 300).
- [ ] Sons synchronisés, jamais coupés, volumes indépendants ; musique désactivable.
- [ ] Textes lisibles à 3 m en 1080p et en 4K ; couleurs joueurs distinguables.
- [ ] Photo de visage : import, cadrage, rendu correct sur la tête, profil sauvegardé.

### Produit (lot 5)
- [ ] Menu, profils, statistiques, expérience (passage « Pro » et boule spéciale).
- [ ] Entraînements : les trois modes jouables de bout en bout, scores enregistrés.
- [ ] Réglages : chaque réglage a un effet visible ; export puis import restitue tout ; réinitialisation.
- [ ] PWA : écran et manette installables ; pages chargeables sans Internet une fois installées.
- [ ] Plein écran, TV en HDMI 1080p et 4K, changement de résolution en cours de partie.
- [ ] Onglet écran en arrière-plan 1 min puis retour : pas de saut de physique.
- [ ] README suffisant pour qu'un tiers installe et joue.

## 11. Découpage en lots vers la V1 complète

| Lot | Contenu | Validation |
|---|---|---|
| 1 | Manette (capteurs, connexion, états) + écran « banc de calibrage » (courbes, latence, détection du lancer, réglages Manette) + squelette du panneau de réglages | Checklists Connexion et Capteurs ; inconnues du §9 tranchées |
| 2 | Moteur 3D : salle, piste, boule, quilles, physique, effet, gouttière, pinsetter, caméras ; jouable au clavier — **livré** ; [lot 2] les téléphones lancent aussi dès ce lot (tout le monde en phase de préparation, les tours arrivent au lot 3) ; le banc devient un tiroir (touche C) | Checklist Physique |
| 3 | Règles, scoreboard, tours 1–4 joueurs, téléphone partagé, bot, sauvegarde et reprise, salon — **livré** ; [lot 3] jusqu'à 8 joueurs dans le salon (4 téléphones + partagés, clavier, bots), réglages `nbFrames`, `calloutsActifs`, `clavierPourTous`, `delaiPassage`, `niveauBotDefaut`, `delaiBot` | Checklist Règles |
| 4 | Personnages, animations, spectateurs, callouts, sons, musique, lisibilité — **livré** ([lot 4] primitives Three.js, sons synthétisés remplaçables par fichiers dans `sons/`, musique séquencée Web Audio) | Checklist Présentation |
| 5 | Menus, profils, statistiques, expérience, entraînements, panneau de réglages complet, PWA, `lib/` figées, README — **livré** ([lot 5] entraînements par `index.html?mode=`, profils locaux par nom, XP et Pro à 1 000 XP avec boule spéciale, service worker « réseau d'abord ») | Checklist Produit |
| 6 | Session de validation complète à deux, calibrage des profils, corrections, gel de la V1 — **à faire ensemble** : checklists du README §6, corrections en retour | Toutes les checklists cochées |

Chaque lot est livré fonctionnel et mis en ligne ; on ne passe au suivant qu'après sa checklist. La V1 est « complète » quand la dernière case est cochée, pas avant.
