# Riposte — rail shooter façon Time Crisis (écran PC + iPhones pistolets)

Tout est statique (GitHub Pages, dépôt `jeux`, dossier `riposte/`). Liaison PeerJS ; Three.js, PeerJS et le générateur de QR sont copiés en local dans `lib/`.

## Lancer
1. PC : ouvrir `https://<utilisateur>.github.io/jeux/riposte/` — QR code + code à 6 caractères.
2. iPhone (Safari) : scanner le QR code (ou ouvrir `tel.html` et saisir le code), « Connecter », accepter l'accès aux capteurs.
3. Tenir l'iPhone à plat, le haut de l'appareil vers l'écran ; viser le centre et appuyer « Recentrer ».
4. TIRER pour lancer la partie.

> HTTPS obligatoire : iOS refuse le gyroscope sur une page `http://`. Tester sur GitHub Pages.
> Sur PC, la touche **K** ajoute un joueur clavier/souris (clic = tir, Espace = couvrir) pour tester sans téléphone.

## Règles (lot 2)
- 8 balles, rechargées automatiquement à couvert. À couvert : invulnérable, on ne tire pas.
- 3 vies par joueur. Une balle ennemie reçue = 1 vie. Chrono 40 s par point de rail ; à 0 = 1 vie pour tous, chrono remis.
- Ennemis : gris (imprécis), rouge (tire à coup sûr), vert (grenade lente, abattable), orange (charge), jaune (+5 s, ne tire pas).
- Un anneau rouge se referme sur l'ennemi qui va tirer : l'abattre avant, ou se couvrir. Les balles ennemies sont visibles et abattables (+50, grenade +150).
- Tête = ×2 points. Jambes = l'ennemi tombe à genoux 2 s et ne tire plus ; le coup suivant l'achève.
- Difficulté adaptative : le délai d'annonce se resserre avec les kills consécutifs, se relâche après une vie perdue.
- Ralenti sur le dernier ennemi de chaque vague.
- Coop : chaque joueur a ses vies, ses balles, son score. La caméra se baisse quand tous les joueurs vivants sont à couvert.
- Game over : TIRER = continue (reprise au point courant, vies pleines).

## Touches PC
`+` / `−` sensibilité · `R` recentrage à la sortie de couvert (doux / fort / non) · `K` joueur clavier/souris · `M` son · `L` panneau lobby.

## Lot 2 — checklist de validation
- [ ] Le QR code connecte l'iPhone ; TIRER lance la partie ; bandeau « ZONE 1 » puis « ACTION ! ».
- [ ] Le réticule est stable main immobile et suit sans retard main rapide (filtre 1 €).
- [ ] Recentrage doux : sortir de couvert sans avoir bougé le pistolet ne fait pas sauter le réticule ; après l'avoir baissé/relevé (> 20°), il revient au centre. R change le mode (doux / fort / non).
- [ ] Tirer sur un ennemi le fait tomber ; tête = son aigu et ×2 ; jambes = à genoux.
- [ ] L'anneau rouge apparaît avant chaque tir ennemi ; se couvrir évite la balle (bruit de passage) ; ne pas se couvrir = vignette rouge, vie en moins, téléphone qui flashe.
- [ ] Une balle ennemie en vol peut être abattue.
- [ ] 8 balles puis « RECHARGE » ; se couvrir recharge.
- [ ] Chrono : tic-tac sous 10 s ; à 0, tout le monde perd une vie.
- [ ] Après la vague 2 d'un point : « ATTENDEZ ! », la caméra glisse au point suivant.
- [ ] 3 points nettoyés → « ZONE NETTOYÉE » + statistiques ; TIRER relance.
- [ ] 0 vie pour tous → GAME OVER ; TIRER continue au point courant.
- [ ] À deux : deux réticules, deux HUD, cibles partagées ; un joueur éliminé laisse l'autre finir.
- [ ] Performance : fluide en plein écran (F11) sur le PC.
