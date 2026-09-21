# Riposte — rail shooter façon Time Crisis (écran PC + iPhones pistolets)

Tout est statique (GitHub Pages, dépôt `jeux`, dossier `riposte/`). Liaison PeerJS, bibliothèques copiées en local dans `lib/`.

## Lancer
1. PC : ouvrir `https://<utilisateur>.github.io/jeux/riposte/` — un code à 6 caractères s'affiche.
2. iPhone (Safari) : ouvrir `.../jeux/riposte/tel.html`, saisir le code, « Connecter », accepter l'accès aux capteurs.
3. Tenir l'iPhone comme une télécommande (haut vers l'écran). Viser le centre de l'écran et appuyer « Recentrer ».

> HTTPS obligatoire : iOS refuse l'accès au gyroscope sur une page en `http://`. Tester donc sur GitHub Pages, pas sur un serveur local en http.

## Lot 1 — liaison + visée : checklist de validation
- [ ] Le code s'affiche sur le PC ; l'iPhone se connecte avec ce code (statut « Joueur 1 · connecté »).
- [ ] Un deuxième iPhone se connecte en Joueur 2 ; un troisième est refusé (« Salle pleine »).
- [ ] Le réticule suit le mouvement du téléphone sans saccade (ping affiché < 60 ms en Wi-Fi local).
- [ ] « Recentrer » ramène le réticule au centre.
- [ ] Après 3 minutes de jeu, la dérive reste supportable (sinon : noter de combien, ça calibrera le lot 4).
- [ ] Un tap sur TIRER pose un impact ; une cible touchée devient verte puis se déplace ; le compteur touches/tirs monte.
- [ ] COUVRIR maintenu : le réticule disparaît, « À COUVERT » s'affiche, les tirs sont ignorés ; relâcher rétablit la visée.
- [ ] Les touches + / − changent la sensibilité ; noter la valeur qui vous convient (défaut 40°).
- [ ] Verrouiller/déverrouiller l'iPhone : la connexion reprend ou un message clair demande de recharger.
