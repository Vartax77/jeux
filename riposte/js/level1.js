// Zone 1 — données pures. Le moteur ne contient aucun placement d'ennemi.
// Repère : x = droite, y = haut, z = vers le fond (négatif = devant le joueur).
// Types : grunt (gris, tire parfois, imprécis) · red (précis, tire à coup sûr) · yellow (bonus temps, ne tire pas)
//         grenadier (projectile lent, abattable) · rusher (charge le joueur, tire à bout portant)

export const LEVEL1 = {
  name: 'ZONE 1 — LES DOCKS',
  timePerPoint: 40,          // secondes par point de rail (remis à chaque point)
  ammo: 8,
  lives: 3,
  points: [
    { pos: [0, 1.6, 0], look: [0, 1.4, -12], cover: true,
      waves: [
        { enemies: [
          { type: 'grunt', pos: [-4, 0, -12], delay: 0.0 },
          { type: 'grunt', pos: [3.5, 0, -14], delay: 1.0 },
          { type: 'grunt', pos: [0, 0, -18], delay: 2.4 },
        ] },
        { enemies: [
          { type: 'red',   pos: [-2.5, 0, -11], delay: 0.0 },
          { type: 'grunt', pos: [5, 0, -16], delay: 0.6 },
          { type: 'yellow', pos: [-6, 0, -20], delay: 1.5 },
          { type: 'grunt', pos: [2, 0, -22], delay: 2.2 },
        ] },
      ] },
    { pos: [6, 1.6, -14], look: [14, 1.4, -26], cover: true,
      waves: [
        { enemies: [
          { type: 'grunt', pos: [12, 0, -22], delay: 0.0 },
          { type: 'grunt', pos: [16, 0, -26], delay: 0.8 },
          { type: 'grenadier', pos: [9, 0, -30], delay: 1.6 },
          { type: 'red',   pos: [18, 0, -30], delay: 2.6 },
        ] },
        { enemies: [
          { type: 'rusher', pos: [14, 0, -34], delay: 0.0 },
          { type: 'grunt', pos: [10, 0, -24], delay: 0.5 },
          { type: 'red',   pos: [17, 0, -24], delay: 1.4 },
          { type: 'grunt', pos: [13, 0, -28], delay: 2.0 },
          { type: 'yellow', pos: [20, 0, -34], delay: 3.0 },
        ] },
      ] },
    { pos: [14, 1.6, -30], look: [14, 1.4, -48], cover: true,
      waves: [
        { enemies: [
          { type: 'grunt', pos: [10, 0, -42], delay: 0.0 },
          { type: 'grunt', pos: [18, 0, -42], delay: 0.0 },
          { type: 'red',   pos: [14, 0, -46], delay: 1.2 },
          { type: 'grenadier', pos: [8, 0, -50], delay: 2.0 },
          { type: 'rusher', pos: [19, 0, -52], delay: 3.2 },
        ] },
        { enemies: [
          { type: 'red',   pos: [11, 0, -40], delay: 0.0 },
          { type: 'red',   pos: [17, 0, -40], delay: 0.4 },
          { type: 'grunt', pos: [14, 0, -44], delay: 1.0 },
          { type: 'grunt', pos: [9, 0, -48], delay: 1.6 },
          { type: 'grunt', pos: [20, 0, -48], delay: 1.6 },
          { type: 'rusher', pos: [14, 0, -56], delay: 2.8 },
        ] },
      ] },
  ],
};
