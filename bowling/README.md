# Bowling — README (V1 complète)

Jeu de bowling façon Wii Sports : la partie se joue sur l'écran du PC, les iPhone servent de manettes à mouvement. Tout est statique (aucun serveur à installer) : un dossier `bowling/` publié sur GitHub Pages suffit. Le cahier des charges est dans `CAHIER-DES-CHARGES.md` (écarts marqués « [lot n] »).

## 1. Ce que contient la V1

- **Manette** (`manette.html`) : capteurs de l'iPhone, connexion par QR ou code, zone LANCER, visée, reconnexion automatique, états clairs (salon, à toi, attends ton tour, passe le téléphone, passer la cinématique, partie terminée), installable sur l'écran d'accueil.
- **Écran** (`index.html`) : titre (survol de la salle) → Nouvelle partie / Entraînement / Profils / Réglages / Calibrage / Reprendre.
- **Jeu 3D** : salle, cinq pistes, enseigne au nom du bowling, boule aux couleurs du joueur, quilles, physique réglée (poche → strike la plupart du temps, splits possibles), gouttières, bumpers, pinsetter, caméras (préparation, poursuite, coupe d'impact, résultat, remise), tout sautable.
- **Personnages originaux** (assemblés en primitives, aucun asset Nintendo) : couleur du joueur, coiffure, teint, visage photo optionnel ; balancier quand le pouce est posé, lancer, joie, déception ; spectateurs qui acclament, s'exclament ou rient.
- **Partie** : salon, 1 à 8 joueurs (4 téléphones maximum, téléphone partagé, clavier, bots à 3 niveaux), tours, règles ten-pin, scoreboard, annonces, confettis, fin de partie avec classement, XP et niveaux, sauvegarde et reprise.
- **Entraînements** : Spares (10 configurations), Lancers puissants (rack de 10 à 91 quilles), Contrôle de l'effet (barrières) ; records enregistrés.
- **Sons** synthétisés (roulement, impacts, gouttière, rebond, pinsetter, foule, jingles, musique originale) remplaçables par des fichiers dans `sons/` ; volumes séparés.
- **Réglages** (Échap) : 9 groupes, ~90 réglages, export/import JSON ; **banc de calibrage** (C) du lot 1 toujours là.
- **PWA** : écran et manette installables ; pages et bibliothèques en cache (la mise en relation reste en ligne).

## 1 bis. Journal des versions

- **V1.7** : correction du carré noir autour des quilles (le bloc de la fosse, allongé en V1.5 le long du deck, dépassait de 18 cm au-dessus de la piste ; il reste maintenant entièrement sous le niveau de la piste).
- **V1.6** : les lancers de calibrage **calibrent aussi le bras du personnage** : quel axe du téléphone tourne pendant le balancier (selon ta façon de le tenir), dans quel sens (le grand mouvement va en arrière) et avec quelle amplitude (un geste complet donne ~110° à l'écran) — enregistrés dans le profil, plus rien à régler à la main. Pendant le calibrage : consigne affichée en grand sur l'écran, angle du bras en direct, personnage aux couleurs du joueur, salon replié pour voir la scène.
- **V1.5** : réalisme des chocs de quilles, corrigé sur mesures et non à l'impression. Diagnostic sur un lancer en poche : jusqu'à **5 cm d'interpénétration** entre quilles (elles se traversaient), une quille catapultée à 2,7 m par un coin de gouttière, et des quilles couchées qui roulaient sans fin. Corrections : physique à **240 Hz** (une quille à 8 m/s avance de 3 cm par pas, moins que sa tête) et 20 itérations de solveur — interpénétration mesurée : 0 cm ; cou de la quille comblé (il y avait un trou de 5 cm dans sa forme physique) ; la gouttière s'ouvre sur la fosse le long du deck (plus de coin où se coincer) ; freinage au sol des quilles couchées (`resistanceRoulement`) et rotation libre en l'air (amortissement 0,08 au lieu de 0,2) ; rebonds deck et parois plus vifs ; plafond de sécurité 12 m/s / 60 rad/s ; masse des quilles 1,4 kg (la poche reste franche sans strikes offerts partout).
- **V1.4** : le **bras du personnage suit le téléphone en direct** dès que le pouce est posé (rotation accumulée par le gyroscope, remise à zéro à chaque geste ; réglages « amplitude » et « sens » dans Manette, mouvement scripté en secours si le gyroscope manque) ; **crochet refait en trois phases** — glisse droite, virage franc, roulement droit — au lieu d'une dérive continue : à lift plein la boule vire d'environ 55 cm avec un **angle d'entrée de 5 à 10°**, ce qui change vraiment le résultat en poche ; déviation mise à l'échelle de la distance et non du temps (une boule lente ne dévie plus quatre fois plus) ; axe de rotation incliné par le lift, visible à l'écran ; nouveaux réglages `finCrochet` et `inclinaisonAxe`.
- **V1.3** : calibrage guidé et raccourci — puissance en **3 lancers** (lent / normal / fort) au lieu de 6, le lancer normal calant en plus la courbe de la jauge ; nouveau **calibrage du lift** en 2 lancers (poignet droit / poignet tourné) ; bouton « Refaire ce lancer » ; nouveau réglage `courbePuissance` (par joueur).
- **V1.2** (deuxième passe visuelle, d'après tes captures) : parois du deck ramenées de 70 à 35 cm et limitées au deck (elles remplissaient l'écran depuis l'approche) ; entraxe des pistes voisines porté de 1,83 à 2,35 m ; masque au-dessus des quilles descendu jusqu'au plafond pour cacher la machine ; pinsetter au repos remonté derrière ce masque (il flottait au-dessus des quilles) ; spot sur le deck pour détacher les quilles du fond ; quilles plus brillantes, repères de placement sur le deck ; gouttière et fosse resserrées et assombries ; retours de boules reculés.
- **V1.1** (après le premier test réel) : caméra d'impact **derrière la boule** par défaut (l'ancienne vue de côté était placée derrière les parois de la piste voisine ; elle reste disponible, repositionnée, dans Réglages → Caméras) ; gouttières en chenal creux et bords fins ; pinsetter qui **soulève** les quilles debout et **pousse** les couchées avant que la physique ne les retire ; **calibrage de la puissance par joueur** dans le banc (3 lancers doux + 3 forts → `aMin`/`aMax` du profil), plafond par défaut relevé de 22 à 32 m/s² ; crochet dépendant de la vitesse (boule lente = 30 % de plus, boule à fond = 30 % de moins) ; aléa de masse ±10 % sur les quilles et rebond quille/quille 0,7 pour une action de quilles jamais identique.
- **V1** : lots 1 à 5.

## 2. Mise en ligne (GitHub Pages)

Les capteurs de l'iPhone exigent une page en **HTTPS** : la manette doit être servie en ligne. GitHub Pages le fait gratuitement.

1. Sur github.com, connecté à ton compte : bouton **New repository** → nom `jeux` → **Public** → coche **Add a README file** → **Create repository**.
2. Dans le dépôt : **Settings** → menu de gauche **Pages** → *Build and deployment* → Source : **Deploy from a branch** → Branch : **main**, dossier **/ (root)** → **Save**.
3. Retour à l'onglet **Code** : **Add file → Upload files** → glisse le **dossier `bowling` entier** (pas seulement son contenu) dans la zone → **Commit changes**. Le dépôt doit ressembler à `jeux/bowling/index.html`, `jeux/bowling/manette.html`, `jeux/bowling/js/…`, `jeux/bowling/lib/…` (voir §10).
   - Le fichier ZIP livré contient déjà ce dossier `bowling` : décompresse-le, puis envoie le dossier.
   - Pour une mise à jour, même manipulation : les fichiers portant le même nom sont remplacés. Le service worker se met à jour au rechargement suivant (deux rechargements si la page était déjà ouverte).
4. Après une minute environ, la page est en ligne à `https://<ton-identifiant>.github.io/jeux/bowling/manette.html` (remplace `<ton-identifiant>` par ton identifiant GitHub). Ouvre-la sur l'iPhone pour vérifier.

À chaque nouveau lot : même manipulation, en remplaçant les fichiers (**Upload files** accepte l'écrasement).

## 3. Écran en local pendant les réglages

L'écran (`index.html`) peut tourner directement depuis ton PC, sans attendre la mise en ligne, pendant que la manette reste en ligne : le pair-à-pair fonctionne entre les deux.

Dans PowerShell, depuis le dossier qui contient `jeux` :

```
cd jeux\bowling
npx serve .
```

- `cd jeux\bowling` : change de dossier. Tape `cd je` puis **Tab** pour compléter `jeux`, puis `\bo` et **Tab** pour `bowling` — la complétion évite les fautes de frappe.
- `npx` : exécute un outil npm sans l'installer durablement. La première fois, il demande `Ok to proceed? (y)` : réponds `y`.
- `serve` : petit serveur web qui sert les fichiers d'un dossier.
- `.` : le dossier courant (`bowling`).

Le terminal affiche l'adresse, en général `http://localhost:3000`. Ouvre-la dans **Chrome ou Edge**. Laisse la fenêtre PowerShell ouverte (Ctrl+C l'arrête).

Sur l'écran, ouvre le banc (touche **C**) et renseigne le champ **« Adresse en ligne de manette.html »** avec `https://<ton-identifiant>.github.io/jeux/bowling/manette.html` : le QR code apparaît. Ce champ est mémorisé.

Quand l'écran est lui-même en ligne (`…/jeux/bowling/`), l'adresse se remplit toute seule.

## 4. Jouer

### Le titre
Ouvre l'écran : le titre survole la salle. **Nouvelle partie** ouvre le salon ; **Entraînement** propose Spares, Lancers puissants et Contrôle de l'effet (avec le record de chacun) ; **Profils** gère l'apparence et les statistiques ; **Réglages** et **Calibrage** ouvrent les tiroirs. Touche **M** pour revenir au titre (en partie, il demande confirmation avant d'abandonner). Le premier clic ou la première touche débloque le son.

### Le salon
Nouvelle partie : le salon s'affiche sur la scène 3D, avec le code de salle et le QR. Chaque téléphone qui rejoint apparaît comme joueur (nom et couleur du téléphone). Ajoute si besoin un joueur clavier, un bot, ou un deuxième joueur sur un téléphone (« + Joueur sur le téléphone de … » : il jouera avec ce téléphone, on se le passe). Renomme, change les couleurs, ordonne avec ▲ ▼, choisis 10 ou 5 frames, puis **Commencer** — ou, sur le premier téléphone, un toucher sur **COMMENCER ▶**.

Pour tester seul avec un téléphone et le clavier : coche « Le clavier peut lancer pour tout le monde ».

### La partie
- Le bandeau bas dit qui joue : « À toi, Valentin », « Passe le téléphone à Mallaury », « Bot Pro joue… ». Le scoreboard en haut se remplit ; la ligne surlignée est le joueur courant, la case jaune sa frame.
- Chaque téléphone ne peut lancer qu'à son tour ; hors tour il affiche « Attends ton tour — Au tour de … ». Pendant une cinématique, un toucher la passe.
- **K** : si la manette du joueur courant est déconnectée (bandeau rouge), le clavier prend ce tour ; K de nouveau pour rendre la main. Dès que le téléphone se reconnecte, le tour reprend normalement.
- Fin de partie : classement et statistiques, **Rejouer** avec les mêmes joueurs ou retour au **Salon** (les joueurs sont conservés).
- Tu fermes ou rafraîchis la page ? Au retour, le salon propose « Reprendre la partie sauvegardée — Frame n · joueurs ».

### Au clavier (joueur « clavier », ou tout le monde avec l'option)
- **← →** : position sur la piste (±1 par pas de 0,05, soit ±40 cm). **Q** (ou A) / **D** : angle (±4° par pas de 0,25°). **Début** (Home) : recentrer.
- **Espace maintenu** : la jauge de puissance monte et redescend (1,6 s l'aller-retour) ; **← →** pendant l'appui règlent l'effet ; **relâcher** lance.
- **L** : le prochain lancer sera lobé ; **B** : en arrière (gags du cahier des charges, pour les vérifier sans téléphone).
- **Espace** ou **Entrée** hors préparation : passer la cinématique (roulement compris : la simulation se termine instantanément et compte).
- **V** : caméra libre (souris pour tourner, molette pour zoomer, V pour revenir). **F** : plein écran. **H** : aide. **C** : banc. **Échap** : réglages.

### Calibrer un joueur (puissance et lift)
Banc (C) → carte du joueur. Pendant un calibrage, les gestes du joueur ne lancent pas de boule et sont acceptés hors tour ; **« Refaire ce lancer »** annule l'étape précédente si le geste est raté.

- **« Calibrer la puissance (3 lancers) »** : le téléphone guide — *lance LENTEMENT*, *lance NORMALEMENT*, *lance FORT*. Le lent fixe `aMin` (85 % de son pic), le fort fixe `aMax` (105 %), et le **normal cale la courbe de la jauge** (`courbePuissance`) pour que ton geste habituel tombe à 50 % au lieu de saturer à 100 %.
- **« Calibrer le lift (2 lancers) »** : *lance POIGNET DROIT*, puis *lance en TOURNANT LE POIGNET*. Le premier fixe la zone morte (125 % de la torsion résiduelle : un geste droit donne bien une boule droite), le second le plein effet (90 % de ton amplitude maximale : ton lift maximal donne bien un crochet plein).

Chaque calibrage cale aussi le **bras du personnage** (axe du téléphone, sens, amplitude) d'après tes vrais balanciers : pendant les lancers, le personnage suit ton bras et l'écran affiche son angle — si le mouvement va à l'envers, c'est visible tout de suite.

Les valeurs obtenues sont dans « Réglages personnels » de la carte, modifiables à la main, et résumées sous les boutons. À refaire après un changement de main, de téléphone ou de façon de lancer.

### Au téléphone
Même connexion qu'au lot 1 (QR ou code). À son tour, la zone affiche LANCER ; le geste est analysé comme au lot 1 (puissance, effet, phase), la boule prend la couleur du joueur et part avec la visée courante (◀ ▶ du téléphone ou clavier). Le banc (C) continue de tout tracer et journaliser, avec le nombre de quilles tombées.

### Déroulé d'un lancer
Préparation → roulement (caméra de poursuite) → **coupe** sur une caméra basse de côté à 2 m des quilles (le côté alterne) → comptage dès que tout est immobile (4 s maximum) → annonce (STRIKE !, SPARE !, SPLIT, TURKEY !, « 7 QUILLES », GOUTTIÈRE, EN ARRIÈRE !, PARTIE PARFAITE !) → pinsetter : après la boule 1, les quilles debout sont **remises exactement à leur place** ; après la boule 2 ou un strike, rack complet (la 10e frame donne ses boules bonus) → joueur suivant. Toutes les durées sont dans **Réglages → Caméras**.

### Entraînements
Chacun se joue au clavier ou avec n'importe quel téléphone connecté, 10 lancers, puis un écran de fin avec le détail et le record.
- **Spares** : 7-10, 4-6-7-10, 3-10, 2-4-5-8, 6-7, 2-7, 4-5, 3-6-9-10, 5-7, 6-10 ; score = spares réussis.
- **Lancers puissants** : une boule par rack, le rack passe de 10 à 91 quilles (13 rangées) sur un deck élargi ; score = quilles tombées cumulées.
- **Contrôle de l'effet** : une barrière rouge bloque le centre-gauche de la piste, de plus en plus loin vers la droite ; il faut partir à droite et crocheter vers la gauche (effet négatif) ; score = quilles tombées.
Les entraînements s'ouvrent par `index.html?mode=spares|puissance|effet` (c'est ce que font les boutons du titre).

### Profils, statistiques, expérience
Un profil est créé pour chaque téléphone (par son jeton) et pour chaque joueur clavier ou partagé (par son nom) à la fin d'une partie. Dans **Profils** : coiffure, teint, **photo du visage** (choisis une image, elle est découpée en disque de 128 px et posée sur la tête du personnage), statistiques (parties, moyenne, meilleur, strikes, spares), XP et niveau. À 1 000 XP le joueur devient **Pro** : boule métallisée et lumineuse.

### Sons
Tout est synthétisé. Pour remplacer un son, dépose un fichier `sons/<nom>.ogg` (ou `.mp3`, `.wav`), nom exact parmi : `roulement`, `impact-faible`, `impact-moyen`, `impact-fort`, `gouttiere`, `rebond`, `pinsetter`, `foule-acclamation`, `foule-ovation`, `foule-oh`, `foule-rire`, `clic`, `jingle-strike`, `jingle-spare`, `jingle-turkey`, `jingle-parfait`, `musique` (boucle). Sources CC0 conseillées : freesound.org (filtre « Creative Commons 0 »). Volumes et musique dans Réglages → Audio.

### Régler sans toucher au code
- **Physique** : vitesses min/max, force du crochet, début (fin de la glisse) et fin (début du roulement) du virage, inclinaison de l'axe, masses, frottements et rebonds (valeurs « réelles », converties en interne), inertie et forme des quilles, seuils de chute, attente maximale. Les changements s'appliquent immédiatement (sauf la forme des quilles : rechargement).
- **Caméras** : durées du résultat et de la remise, distance de la coupe d'impact, hauteur et recul de la poursuite, réactivité, champ de vision, sauts autorisés.
- **Affichage** : qualité (Basse = sans ombres, pixel ratio 1), ombres, plein écran automatique, taille des textes, **nom du bowling** (enseigne au-dessus des quilles), aide et boîte Rejoindre.
- **Règles** : nombre de frames, gouttières fermées, annonces, clavier pour tous, délai « Passe le téléphone », niveau de bot proposé, temps de réflexion des bots.
- **Audio** : volumes effets / foule / musique, musique, spectateurs.
- **Affichage** : aussi le nom du jeu (titre) et le nom du bowling (enseigne).

## 5. Mode d'emploi du banc

1. Ouvre l'écran. Le code de salle (5 caractères) et le QR code s'affichent en haut à droite du jeu et dans le banc (C). Le badge **Signalisation : connectée** confirme que le serveur public PeerJS répond.
2. Sur l'iPhone : appareil photo → viser le QR → ouvrir dans Safari. Le code est pré-rempli. Prénom, couleur, main → **Activer les capteurs et rejoindre** → accepter la demande d'accès aux mouvements.
3. La carte de la manette apparaît dans le banc (touche **C**) : latence, échantillons reçus par seconde (≈ 10 au repos, 60 pendant un geste), décalage d'horloge. La visée (partagée) est dans le HUD du jeu, en bas à gauche.
4. Clique sur une carte pour voir ses capteurs dans les trois graphiques (accélération, vitesse angulaire, geste).
5. Lancer : pose le pouce sur **LANCER**, balance le bras comme au bowling, lève le pouce. Le résultat s'affiche sur le téléphone (1,8 s), dans « Dernier lancer », sur la carte et dans le journal.
6. **Actif (peut lancer)** : décoche pour simuler « ce n'est pas son tour » (les lancers sont alors refusés).
7. **Calibrer le sens avant (3 lancers)** : fais 3 lancers normaux ; le banc mémorise ta direction « avant ». Sans ce calibrage, le gag « boule en arrière » reste inactif (le jeu ne punit jamais sur un doute).
8. **Réglages personnels** (dans la carte) : mode de lancer, sensibilité (aMin/aMax), effet, main — vides = valeurs globales. Le panneau global est derrière **Réglages (Échap)**.
9. **Exporter en CSV** : le journal des lancers, à me transmettre pour ajuster les valeurs par défaut.

Pour bien lire un lancer :
- **Puissance** : de 0 à 100 %, calculée sur le pic d'accélération entre `aMin` (0 %) et `aMax` (100 %). Si tes lancers « forts » plafonnent trop tôt, monte `aMax` ; si les lancers doux sont annulés, baisse `aMin`.
- **Effet** : de −1 (courbe vers la gauche) à +1 (droite), calculé sur la rotation du poignet autour de l'axe long du téléphone, au-delà de la zone morte. Si le signe est faux pour tout le monde, inverse **Sens de l'effet** ; si c'est faux pour un gaucher seulement, vérifie sa **Main**.
- **Phase** : `normal`, `lob` (relâcher pendant une montée) ou `arriere` (relâcher pendant le mouvement arrière, sens calibré requis).
- **Annulé** : maintien plus court que `dureeMin` ou pic sous `aMin`.

## 6. Checklists (cahier des charges §10)

### Connexion
- [ ] Rejoindre par QR (appareil photo → Safari) et par saisie du code.
- [ ] Deux téléphones connectés en même temps, nommés et colorés (une couleur déjà prise est remplacée).
- [ ] Verrouiller l'iPhone 30 s, déverrouiller : la carte repasse de « reconnexion… » à « connectée » sans rien faire, même place.
- [ ] Passer sur une autre appli 1 min, revenir : idem.
- [ ] Couper le Wi-Fi 10 s : « Reconnexion… » sur le téléphone, puis reprise.
- [ ] Recharger la page manette : même place, même couleur.
- [ ] Un 5e appareil : message « Salle pleine ».
- [ ] Latence affichée sous 30 ms ; « Horloge » stable à ±5 ms.

### Capteurs et geste
- [ ] Autorisation demandée après le toucher ; refusée puis accordée après rechargement.
- [ ] Le pied de la manette affiche « Écran maintenu allumé » et le téléphone ne s'éteint pas pendant 5 min.
- [ ] Aucun zoom, sélection ou retour arrière déclenché en 20 lancers.
- [ ] Au repos, à plat : « Capteurs : 60 Hz · g 9,8 » sur le téléphone ; sur l'écran, courbe z de l'accélération sans gravité proche de 0.
- [ ] Pouce posé immobile 3 s puis levé : « Lancer annulé (geste trop faible) ».
- [ ] 10 lancers doux / 10 moyens / 10 forts par joueur : puissances croissantes, saturation atteinte sur les forts.
- [ ] 10 lancers droits : effet proche de 0 ; 10 lancers avec torsion du poignet : effet du bon signe ; un gaucher a le signe inversé.
- [ ] Relâcher en montée → `lob` ; après calibrage du sens, relâcher en arrière → `arriere` ; geste ambigu → `normal`.
- [ ] Carte décochée « Actif » : le lancer est refusé avec message sur le téléphone.
- [ ] Mode Automatique puis Glisser (réglages personnels) : 10 lancers chacun, cohérents.

### Inconnues du cahier des charges (§9) et où lire la réponse
1. Pair-à-pair sur ta box : la carte passe à « connectée » et la latence s'affiche.
2. Fréquence des capteurs : pied de la manette (« 60 Hz ») et « Reçus » sur la carte pendant un geste.
3. Latence : carte.
4. Autorisation après refus : message sur l'accueil de la manette.
5. Wake Lock : pied de la manette.
6. Fiabilité du relâcher : colonne « Durée » et « instant retenu … ms après le relâcher » dans « Dernier lancer ».
7. Amplitude des gestes : colonne « Pic » du journal → choix de `aMin`/`aMax`.
8. Verrouillage automatique pendant l'attente : test « Actif » décoché pendant 3 min.
9. Prise en main : graphiques (quel axe bouge le plus pendant le balancier ; l'effet doit être autour de y).
10. Serveur PeerJS : badge « Signalisation ».

### Physique (lot 2) — à dérouler à l'écran
Le test automatique (`node tests/physique.test.mjs`) vérifie déjà chaque ligne en simulation ; à l'écran il reste à confirmer que ça se voit et que ça plaît.
- [ ] Rack immobile 30 s sans boule : aucune quille ne bouge (elles sont gelées tant que la boule n'approche pas).
- [ ] Boule dans la poche (position ≈ +0,15, angle 0, puissance moyenne) : strike la plupart du temps ; sinon 8–9 quilles avec une quille de coin qui reste (7 ou 10), comme au vrai bowling.
- [ ] Boule de face sur la quille 1 (position 0) : split fréquent (4-6-7-10 typique).
- [ ] Boule effleurant la 7 ou la 10 (position ±1, angle 0) : 1 à 3 quilles.
- [ ] Gouttière (position ±1, angle ±3,5°) : aucune quille, boule jusqu'à la fosse, annonce GOUTTIÈRE.
- [ ] Lob (L puis Espace) : rebonds amortis, la boule finit sa course sur la piste ou dans la fosse.
- [ ] Arrière (B puis Espace) : la boule part vers l'approche, s'arrête au mur, 0 quille, annonce EN ARRIÈRE !, boule suivante.
- [ ] Comptage terminé en moins de 4 s après l'impact ; sur 50 lancers, aucune quille comptée debout alors qu'elle est couchée, ni l'inverse.
- [ ] Remise en place : quilles debout exactement replacées ; rack complet après la boule 2.
- [ ] Gouttières fermées (Réglages → Règles) : la boule rebondit sur les bumpers.
- [ ] Effet ±1 au clavier (← → pendant l'appui) : la boule crochète sur la fin de piste, d'environ 25 cm à effet plein ; monter `gainEffet` si tu veux plus spectaculaire.
- [ ] 60 images/s stables (Chrome/Edge : F12 → Performance, ou l'œil) ; plus de 30 en qualité Basse.
- [ ] Aucune saccade de la caméra ; coupe franche à l'impact ; le côté alterne.
- [ ] Onglet caché 1 min puis retour : le jeu reprend sans sauter (le temps est borné à 50 ms par image).

### Règles et déroulé (lot 3) — à dérouler à l'écran
Les tests automatiques couvrent déjà les règles (300 / 190 / 0 / 165, 10e frame), les tours, le bot et la reprise ; à l'écran, il reste à confirmer le ressenti.
- [ ] Salon : deux téléphones apparaissent, + clavier, + bot, ordre modifié, Commencer depuis le premier téléphone.
- [ ] Tours respectés sur un tour complet (2 téléphones + clavier + bot) ; un téléphone hors tour reçoit « Ce n'est pas ton tour ».
- [ ] Téléphone partagé : « Passe le téléphone à … » sur l'écran et sur le téléphone, LANCER apparaît après 3 s.
- [ ] Scoreboard juste sur une partie complète (compare avec un calcul à la main sur une frame avec strike et une avec spare).
- [ ] Callouts : SPLIT sur un 7-10 ou 4-6 ; TURKEY au 3e strike de suite ; SPARE ; GOUTTIÈRE.
- [ ] 10e frame : strike-strike-strike, strike puis spare, spare puis strike, deux boules simples.
- [ ] Bot : vise la poche, réussit souvent en Pro, rate parfois en Débutant ; Espace ou un toucher passe sa réflexion.
- [ ] Rafraîchir l'écran en pleine partie : « Reprendre », score et tour corrects, quilles debout identiques, le téléphone reprend son tour.
- [ ] Verrouiller un iPhone pendant son tour : bandeau rouge ; déverrouiller : reprise automatique ; ou K puis lancer au clavier.
- [ ] Fin de partie : classement, Rejouer, Salon.

### Présentation (lot 4) et produit (lot 5) — à dérouler à l'écran
- [ ] Séquence de caméras sans à-coup ; chaque phase sautable.
- [ ] Personnage : balancier quand le pouce est posé, lancer, joie sur strike/spare, déception sur gouttière ; spectateurs réactifs.
- [ ] Sons : roulement qui suit la vitesse, impact à l'arrivée, gouttière, pinsetter, foule et jingles ; volumes indépendants ; musique désactivable.
- [ ] Textes lisibles à 3 m (Réglages → Affichage → taille des textes).
- [ ] Photo de visage : import, découpe, rendu sur la tête, conservé après rechargement.
- [ ] Titre, profils, statistiques et XP après une partie ; boule spéciale à 1 000 XP (tu peux vérifier en éditant l'XP dans l'export JSON).
- [ ] Les trois entraînements jouables de bout en bout, records affichés sur le titre.
- [ ] Export puis import des réglages restitue tout ; réinitialisation.
- [ ] PWA : « Installer » proposé par Chrome/Edge sur l'écran ; sur l'iPhone, Partager → « Sur l'écran d'accueil » pour la manette ; ouverture sans réseau des pages une fois installées.
- [ ] Plein écran (F) sur TV 1080p et 4K ; changement de résolution en cours de partie.

### Gel de la V1 (lot 6)
La V1 est gelée quand toutes les cases des checklists ci-dessus sont cochées à deux, sur ta box, avec les vraies valeurs de calibrage du banc exportées en JSON. Les corrections issues de cette validation sont le seul contenu du lot 6.

### Ce que je n'ai pas pu vérifier d'ici
Le rendu 3D n'est pas exécutable dans mon environnement (pas de WebGL) : la géométrie, les caméras, la synchronisation et le cycle sont testés sans image, mais **couleurs, lumière, lisibilité des textes, échelle des plans** ne l'ont été que sur plan. Ce qui ne te plaît pas se règle d'abord dans Réglages (Affichage, Caméras) ; dis-moi le reste avec une capture d'écran.

## 7. Tests automatiques

Depuis PowerShell, dans le dossier `bowling` (`cd jeux\bowling`, avec Tab pour compléter) :

```
node tests/score.test.mjs
node tests/match.test.mjs
node tests/entrainement.test.mjs
node tests/physique.test.mjs
node tests/partie.test.mjs
node tests/geste.test.mjs
```

- `node` : exécute le script avec Node.js.
- `tests/physique.test.mjs` : le fichier de test (`.mjs` = module JavaScript). Tape `node te` puis **Tab**, puis `ph` et **Tab**.

Chaque test affiche ses lignes ✓/✗ et se termine par « Tous les tests … passent. ». Score : les quatre parties du cahier des charges, marques, cumuls, 10e frame, splits, callouts. Match : salon, tours, 10e frame, classement, sérialisation, bot (cibles, bornes, dispersion, déroulé). Physique : géométrie, rack stable 30 s, poche, quille 1 de face, effleurement de la 7, gouttière, effet, lob, arrière, remise en place, bumpers. Cycle : phases, comptage, respot, rack, gouttière, arrière, sauts, visée.

## 8. Dépannage

- **« Accès aux capteurs refusé »** : Safari ne redemande pas dans la même page. Recharge la page (ou ferme l'onglet et rouvre le QR). Si le refus persiste : Réglages iPhone → Safari → **Mouvement et orientation** activé.
- **La manette reste sur « Connexion… »** : l'écran est-il ouvert et son badge « Signalisation : connectée » ? Le code est-il le bon (le QR le pré-remplit) ? Les deux appareils ont-ils Internet (le serveur public PeerJS sert à la mise en relation) ?
- **Connexion établie puis rien ne passe / « Reconnexion… » en boucle** : le Wi-Fi isole les appareils (réseau invité, entreprise, hôtel). Solution : sur un iPhone, Réglages → **Partage de connexion** ; connecte le PC à ce partage ; les autres téléphones aussi.
- **Latence anormale (> 100 ms) alors que tout fonctionne** : le trafic passe par un relais public (TURN) parce que le pair-à-pair direct est bloqué par la box. Même solution : partage de connexion iPhone.
- **« Écran non maintenu »** : iOS antérieur à 16.4, ou refus du navigateur. Réglages iPhone → Luminosité et affichage → **Verrouillage automatique** → Jamais, le temps de la partie.
- **Pas de QR code** : renseigne l'adresse en ligne de `manette.html` sur l'écran.
- **Le code « ne prend pas »** : l'alphabet exclut O, 0, I et 1.
- **Le retour arrière de Safari se déclenche** : le geste part trop près du bord gauche ; la zone LANCER est déjà écartée de 24 px, garde le pouce dans la zone colorée.
- **Le geste donne toujours « trop faible »** : baisse `aMin` (réglages personnels) ; vérifie que le téléphone est bien tenu dans la main qui balance.
- **« Affichage 3D indisponible »** : le navigateur n'a pas créé de contexte WebGL. Chrome/Edge : Paramètres → Système → **Utiliser l'accélération graphique si disponible** → relancer le navigateur. Le banc et la salle fonctionnent quand même.
- **Image saccadée** : Réglages → Affichage → Qualité **Basse** (sans ombres), ou fermer le banc (C) qui redessine trois graphiques par image quand il est ouvert.
- **Le téléphone dit « Ce n'est pas ton tour » alors que c'est bien son tour** : sa carte est décochée « Actif » dans le banc (C), ou un joueur partagé attend encore les 3 s du passage.
- **Une quille reste couchée « debout »** ou l'inverse : Réglages → Physique → `seuilChute` (inclinaison) et `deplacementChute`.
- **Un téléphone connecté pendant la partie ne joue pas** : normal, il rejoindra au prochain salon (il affiche « Attends ton tour »).
- **« Passe le téléphone à … » alors que c'est le même joueur** : l'écran a perdu la trace du dernier lanceur (reprise de partie) ; attends les 3 s ou baisse `delaiPassage`.
- **Le bot ne joue pas** : sa réflexion dure `delaiBot` + 1,5 s ; Espace la passe. S'il reste bloqué, ouvre le banc (C) et regarde les événements.
- **Pas de son** : clique ou appuie sur une touche une fois (les navigateurs exigent un geste) ; vérifie Réglages → Audio.
- **La page ne se met pas à jour après un envoi sur GitHub** : recharge deux fois (le service worker sert d'abord l'ancienne version puis la nouvelle) ; en dernier recours, Chrome → F12 → Application → Service workers → Unregister.

## 9. Conventions et écarts par rapport au cahier des charges

- Toutes les accélérations sont envoyées en **convention W3C** (au repos, téléphone à plat écran vers le haut : `ag.z ≈ +9,8`). iPhone inverse le signe : la manette le corrige avant l'envoi.
- Vitesse angulaire `r = [alpha, beta, gamma]` : alpha autour de z, beta autour de x, **gamma autour de y (axe long du téléphone)**. La torsion du poignet est mesurée autour de l'axe choisi dans **Axe de la torsion** (défaut y).
- Protocole (§3.6) : trois messages ajoutés — `bienvenue` (réponse au `bonjour`), `resultat` (retour du lancer vers la manette), `glisser` (résumé d'un glissement). Détail dans `js/commun/protocole.js`.
- Réglage `effetGain` remplacé par `effetAnglePlein` (angle de torsion qui donne 100 % d'effet), plus lisible. Réglages ajoutés : `axeEffet`, `signeEffet`, `sourcePuissance`, `vGesteMin/Max`, `seuilArriere`, `tauFuite`.
- Le sens « avant » du geste n'est pas devinable sans référence : il est **calibré par joueur** (3 lancers) et mémorisé dans son profil ; tant qu'il ne l'est pas, le gag « boule en arrière » est inactif.
- [lot 2] Visée : angle **±4° par pas de 0,25°** (au lieu de ±12° par 0,5° au banc), position ±1 par 0,05 ; visée partagée par tous les lanceurs dans ce lot.
- [lot 2] Protocole : `etat` gagne `phase` (preparation | cinematique | attente) ; nouveau message téléphone → écran `saut {t}` (toucher pendant une cinématique).
- [lot 2] **Frottement cannon-es** : sa borne agit comme une impulsion par pas, pas comme un coefficient de Coulomb ; sans correction, les quilles absorbaient l'énergie de la boule (4 quilles par lancer dans la poche). Les réglages sont en valeurs réelles, convertis en interne (μ × pas / 4, mesuré sur un bloc glissant).
- [lot 2] Quilles gelées hors simulation tant que la boule est à plus de 3 m ; forme physique base plate + 3 sphères ; masse par défaut 1,2 kg (réel 1,55) pour la générosité de la poche ; kickbacks et fosse modélisés.
- [lot 2] Le crochet est un décalage de vitesse latérale avec rotation de roulement cohérente (une force serait annulée par le frottement).
- [lot 3] Protocole : `etat` gagne `joueur`, `passe`, `premier` et les phases `salon` / `fin` ; nouveau message téléphone → écran `commencer {t}`.
- [lot 3] Strike = 10 quilles sur un rack « frais » ; 0 puis 10 est un spare (marque « -/ »). Split = quilles debout en au moins deux groupes non adjacents, quille 1 tombée.
- [lot 3] Le clavier ne lance que pour un joueur « clavier », sauf option `clavierPourTous` ou touche K sur une manette déconnectée.
- [lot 3] Le salon accepte jusqu'à 8 joueurs (4 téléphones maximum, le reste en partagé, clavier ou bots).
- [lot 4] Personnages et spectateurs en primitives Three.js ; sons synthétisés avec remplacement par fichier ; musique = séquenceur Web Audio (la mineur, 104 BPM).
- [lot 5] Entraînements par paramètre d'URL `?mode=` (le monde physique est construit avec 91 quilles et un deck élargi pour Lancers puissants) ; profils locaux clés `nom:<nom>` ; XP = score + 10/strike + 5/spare ; Pro à 1 000 XP.
- [lot 5] PWA : service worker « réseau d'abord, cache en secours » (cache `bowling-v1` à renommer dans `sw.js` pour forcer une mise à jour).

## 10. Structure

```
bowling/
  index.html, css/ecran.css                 écran : jeu plein écran + tiroirs banc (C) et réglages (Échap)
  js/ecran/main.js                          glue : salle, manettes, lancers, boucle de jeu, raccourcis
  js/ecran/jeu/                             physique.js (cannon-es), partie.js (cycle), scene.js (Three.js), cameras.js, clavier.js, hud.js,
                                            score.js (règles), match.js (joueurs, tours), bot.js, scoreboard.js, sauvegarde.js
  js/ecran/banc.js, salon.js, fin.js        banc de calibrage, salon, écran de fin
  js/ecran/titre.js, profils-ui.js          titre, profils
  js/ecran/jeu/audio.js, personnage.js, apparence.js, entrainement.js
  manifest.webmanifest, manette.webmanifest, sw.js, icones/   PWA
  js/ecran/                                 salle.js, geste.js, reglages.js, profils.js, graphiques.js
  manette.html, css/manette.css, js/manette/main.js
  js/commun/                                constantes.js, protocole.js, textes.js, maths.js
  lib/                                      peerjs.min.js, qrcode-generator.js, cannon-es.js, three/ (+ licences, VERSIONS.txt)
  sons/                                     vide pour l'instant (lot 4)
  tests/                                    geste, physique, partie, score, match, entrainement (.test.mjs)
  CAHIER-DES-CHARGES.md, README.md
```

`index.html` déclare une *import map* (`"three": "./lib/three/three.module.js"`) : les modules importent `three` par ce nom. Ne pas la retirer.

Stockage local : écran → `bowling.reglages`, `bowling.profils`, `bowling.salle`, `bowling.adresseManette`, `bowling.partie` (partie en cours), `bowling.entrainements` (records) ; téléphone → `manette.jeton`, `manette.profil`, `manette.salle`.

## 11. Après la V1
Idées notées mais hors V1 : jeu à distance (brique PeerJS commune avec les autres jeux), visage cartoon, jusqu'à 8 téléphones, bilingue.
