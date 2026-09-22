# Riposte — rail shooter façon Time Crisis (écran PC + iPhones pistolets)

Tout est statique (GitHub Pages, dépôt `jeux`, dossier `riposte/`). Liaison PeerJS. Three.js, ses chargeurs FBX/GLTF, PeerJS et le générateur de QR sont copiés en local dans `lib/`.

## Lancer
1. PC : `https://<utilisateur>.github.io/jeux/riposte/` — QR code + code. Cliquer une fois sur la page pour autoriser le son du PC.
2. iPhone (Safari) : scanner le QR code, « Connecter », accepter les capteurs. Tenir l'iPhone à plat, le haut vers l'écran ; viser le centre, « Recentrer ».
3. TIRER ouvre le menu : viser une zone et tirer dessus pour la lancer.

> HTTPS obligatoire (gyroscope iOS). Sur PC, **K** ajoute un joueur clavier/souris (clic = tir, Espace = couvrir).

## Structure
- `js/game.js` moteur (scène, thèmes, déroulé, HUD, menu) · `js/entities.js` ennemis et projectiles · `js/bosses.js` les trois boss
- `js/levels.js` **les trois zones en données** (rail, vagues, événements, boss) · `js/characters.js` personnages (procédural ou Mixamo)
- `js/assets.js` ressources optionnelles · `js/music.js` musique synthétisée · `js/audio.js` bruitages · `js/net.js` liaison iPhone

## Règles
- 8 balles, rechargées à couvert. À couvert : invulnérable, pas de tir. 3 vies par joueur. Chrono 40 s par point (boss : 90–120 s) ; à 0 = 1 vie pour tous.
- Gris = imprécis · rouge = tire à coup sûr · vert = grenade lente abattable · orange = charge · jaune = +5 s. L'anneau rouge annonce un tir.
- Tête = ×2. Jambes = à genoux 2 s puis un coup l'achève. Balles ennemies abattables (+50, grenade +150). Difficulté adaptative, ralenti sur le dernier ennemi.
- Boss : **Blindé** (4 panneaux qui s'ouvrent deux par deux, 3 coups chacun), **Hélicoptère** (réservoir ventral exposé quand il s'immobilise pour larguer des hommes), **Le Colonel** (bouclier ; exposé quand il lance une grenade, tête = 2 dégâts). Renforts plafonnés.
- Coop : vies, balles et score par joueur ; la caméra se baisse quand tous les joueurs vivants sont à couvert. Game over : TIRER = continue au point courant.

## Touches PC
`P` post-traitement (bloom, étalonnage, grain, vignette) activé/coupé — à couper si ça rame · `+`/`−` sensibilité · `R` recentrage (doux / fort / non) · `K` joueur clavier · `M` son · `N` musique · `C` continues limités ou illimités · `D` (au menu) change de difficulté · `Échap` pause pendant l'action, menu sinon · `L` panneau lobby

## Difficulté (Facile / Normal / Difficile)
Se choisit sur l'écran titre : viser une des trois pastilles et tirer dessus. Mémorisée comme les autres réglages. Elle ajuste, de façon cohérente dans tout le jeu :
- vies (4 / 3 / 2) et munitions (10 / 8 / 6) ;
- durée des chronos (+25 % / normal / −15 %) ;
- précision et fréquence de tir des ennemis, fenêtre d'annonce avant un tir (plus longue en facile) ;
- points de vie des boss (−25 % / normal / +30 %) ;
- continues par zone (5 / 3 / 1) ;
- multiplicateur de score au décompte final (×0,8 / ×1 / ×1,3) — les meilleurs scores sont conservés séparément par zone et par difficulté.

## Lot 4 — finition
- **Calibrage guidé** : au tout premier lancement (rien encore enregistré), TIRER dans le lobby lance un calibrage à 2 tirs (repère gauche, repère droit) qui déduit la sensibilité — plus besoin de régler +/− à l'aveugle. Un appui long (0,7 s) sur le bouton « Recentrer » du téléphone relance ce calibrage à tout moment.
- **Réglages persistants** : sensibilité, mode de recentrage, son, musique, continues limités/illimités — conservés d'une session à l'autre (stockage local du navigateur).
- **Pause** : `Échap` pendant l'action ou un boss suspend le jeu (rien ne bouge) ; `Échap` ou TIRER reprend. En dehors d'un combat, `Échap` retourne au menu comme avant.
- **Continues** : 3 par zone par défaut (`C` pour illimités). Ils s'épuisent : au 4ᵉ game over, TIRER renvoie directement au menu. Un continue utilisé plafonne le rang de la zone à C.
- **Rang de fin de zone** (S/A/B/C, selon vies restantes, précision et continues utilisés) et **meilleur score conservé** par zone, affichés dans les statistiques de fin.
- **Téléphone** : bordure qui pulse en rouge dans les 3 dernières secondes de chaque chrono, teinte orange pendant un boss.
- **Variété** : mort tirée au hasard parmi `death.fbx` / `death2.fbx` / `death3.fbx` / `death4.fbx` (celles présentes) ; réaction visuelle sur `hit.fbx` si déposé (facultatif, mêmes réglages d'export que les autres animations).

## Ressources optionnelles (dossier `assets/`, tout est facultatif)
Le jeu tourne sans aucun fichier. Chaque fichier présent remplace sa version procédurale au chargement ; le panneau du lobby indique ce qui a été trouvé (détail dans la console F12).

### Personnage animé — Mixamo (gratuit, compte Adobe)
1. Sur mixamo.com, onglet **Characters**, choisir un soldat (ex. « Swat », « Vanguard », « Soldier »). Bouton **Download** : Format **FBX Binary**, Pose **T-pose**, **With Skin** → enregistrer sous `assets/characters/soldier.fbx`.
2. Onglet **Animations**, pour chacune ci-dessous : chercher, cliquer, **Download** avec Format **FBX Binary**, Skin **Without Skin**, 30 fps, Keyframe reduction none :
   | Fichier | Animation Mixamo conseillée |
   |---|---|
   | `assets/anim/idle.fbx` | Rifle Idle ou Pistol Idle |
   | `assets/anim/aim.fbx` | Rifle Aiming Idle |
   | `assets/anim/shoot.fbx` | Firing Rifle |
   | `assets/anim/death.fbx` | Death From Front Headshot ou Falling Back Death |
   | `assets/anim/kneel.fbx` | Crouch Idle ou Kneeling Idle |
   | `assets/anim/run.fbx` | Rifle Run |
3. Recharger la page : le lobby doit afficher « personnage Mixamo chargé ». Sinon, ouvrir la console (F12) : le message indique le fichier fautif.
Le même personnage sert à tous les types d'ennemis, teinté selon la couleur du type. Les hitboxes (tête, torse, bras, jambes) sont attachées aux os.

### Textures — Runway (ou autre générateur d'images)
Carrées, **répétables** (« seamless / tileable »), JPG 1024×1024 ou 2048×2048, sans texte ni logo :
| Fichier | Prompt |
|---|---|
| `assets/tex/ground.jpg` | seamless tileable texture, wet concrete dock floor, oil stains, top-down, flat lighting, no text |
| `assets/tex/asphalt.jpg` | seamless tileable texture, dark asphalt road, cracks, top-down, flat lighting |
| `assets/tex/concrete.jpg` | seamless tileable texture, raw grey concrete wall, subtle stains, flat lighting |
| `assets/tex/container.jpg` | seamless tileable texture, corrugated shipping container metal, rust streaks, neutral grey (la couleur est appliquée par le jeu) |
| `assets/tex/metal.jpg` | seamless tileable texture, scratched painted steel plate, rivets, flat lighting |
| `assets/tex/brick.jpg` | seamless tileable texture, old brick wall, weathered, flat lighting |

### Objets 3D — Runway → TRELLIS (dossier `assets/props/`)
Chaque fichier présent remplace la boîte correspondante dans le décor ; absent, la boîte reste. Le jeu remet le modèle à sa hauteur réelle et le pose au sol, aucune retouche d'échelle à faire. Pas de Mixamo pour les objets : image → TRELLIS → *Download GLB* → renommer → déposer.

| Fichier | Objet | Hauteur réelle | Prompt Runway (format 1:1) |
|---|---|---|---|
| `palette.glb` | palette bois | 0,15 m | `single wooden euro pallet, worn, 3/4 view, centered, plain grey background, flat even lighting, no text` |
| `caisse.glb` | caisse bois | 1,0 m | `single large wooden shipping crate, planks, stencil marks, 3/4 view, centered, plain grey background, flat lighting` |
| `conteneur.glb` | conteneur 20 pieds | 2,6 m | `single 20ft shipping container, corrugated steel, rust streaks, closed doors, 3/4 view, centered, plain grey background, flat lighting` |
| `baril.glb` | baril | 0,9 m | `single rusty blue oil drum, 3/4 view, centered, plain grey background, flat lighting` |
| `chariot.glb` | chariot élévateur | 2,1 m | `single yellow forklift, no driver, 3/4 view, centered, plain grey background, flat lighting` |
| `voiture.glb` | berline | 1,45 m | `single dark grey sedan car, parked, 3/4 view, centered, plain grey background, flat lighting` |
| `4x4.glb` | 4×4 | 1,9 m | `single black SUV, 3/4 view, centered, plain grey background, flat lighting` |
| `lampadaire.glb` | lampadaire | 5,5 m | `single tall industrial street lamp post, single arm, 3/4 view, centered, plain grey background, flat lighting` |
| `grue.glb` | grue portuaire | 22 m | `single harbor gantry crane, 3/4 view, whole structure visible, centered, plain grey background, flat lighting` |
| `poubelle.glb` | conteneur à ordures | 1,2 m | `single green metal dumpster, 3/4 view, centered, plain grey background, flat lighting` |
| `bidon.glb` | bidon | 0,6 m | `single jerry can, olive, 3/4 view, centered, plain grey background, flat lighting` |

Le nom ne se voit pas dans le jeu ; ce qui compte est le fichier au bon nom. Un GLB fait 1 à 20 Mo ; viser *Simplify* 0.95 dans TRELLIS. Ajouter `wood.jpg` (planches) et refaire `container.jpg` (tôle ondulée seule) dans `assets/tex/` améliore les boîtes restantes.

### Fonds panoramiques — Runway
Paysage très large, **4096×1024** (rapport 4:1), horizon au milieu, sans texte ; le bord gauche doit raccorder avec le bord droit (demander « seamless horizontal panorama ») :
| Fichier | Prompt |
|---|---|
| `assets/backdrops/docks.jpg` | 360 seamless horizontal panorama, industrial harbor at night, cranes, container stacks, distant city lights, fog, cinematic, no text |
| `assets/backdrops/street.jpg` | 360 seamless horizontal panorama, rainy city street at night, neon signs, wet asphalt reflections, tall buildings, no text |
| `assets/backdrops/hangar.jpg` | 360 seamless horizontal panorama, interior of a huge dark industrial hangar, steel trusses, spotlights, haze, no text |

## Lot 3 — checklist de validation
- [ ] Lobby → TIRER → menu titre : les trois cartes ; viser + tirer lance la zone choisie ; Échap revient au menu.
- [ ] Zone 1 : bandeau + texte d'intro, musique, chute de conteneur (pt 1 vague 2), explosion (pt 2). Boss blindé : panneaux ouverts brillants, rafales, renforts ; barre de vie ; explosion finale ; « ZONE NETTOYÉE » ; TIRER → zone 2.
- [ ] Zone 2 : ennemis aux fenêtres (3,2 m) et sur les toits (6,5 m), voitures en couvert, vitre brisée. Boss hélico : balayage, immobilisation, largage de 2 hommes, réservoir ventral brillant.
- [ ] Zone 3 : passerelles, projecteurs, ambiance sombre. Boss colonel : bouclier (ricochets), fenêtre d'exposition pendant la grenade, renforts orange.
- [ ] Musique : boucle par zone, s'intensifie sous 10 s de chrono, thème de boss ; N la coupe.
- [ ] Performance en plein écran (F11). Si ça rame en zone 3 (projecteurs), le dire : on réduira.
- [ ] Après dépôt des fichiers Mixamo : « personnage Mixamo chargé » ; animations visée/tir/mort/genoux/course cohérentes ; hitboxes tête/torse justes (tirer sur la tête = son aigu).
