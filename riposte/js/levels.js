// Trois zones — données pures. Repère : x droite, y haut, z fond (négatif = devant).
// Ennemi : { type, pos:[x,y,z], delay } — y > 0 = position en hauteur (une plate-forme est créée dessous).
// Événement : { at (s après le début de la vague), type: 'explode' | 'drop' | 'glass', pos }
// Boss : { type: 'tank' | 'heli' | 'chief', pos, time }

const G = 'grunt', R = 'red', Y = 'yellow', GR = 'grenadier', RU = 'rusher';
const e = (type, x, y, z, delay = 0) => ({ type, pos: [x, y, z], delay });

const RAW = [
  // ============================================================ ZONE 1 — LES DOCKS
  { id: 'docks', name: 'ZONE 1 — LES DOCKS', intro: 'Un cargo détourné. Les mercenaires tiennent le quai. Reprenez-le.',
    theme: 'docks', timePerPoint: 40, ammo: 8, lives: 3,
    points: [
      { pos: [0, 1.6, 0], look: [0, 1.4, -12], cover: 'crate',
        waves: [
          { enemies: [e(G, -4, 0, -12), e(G, 3.5, 0, -14, 1.0), e(G, 0, 0, -18, 2.4)] },
          { enemies: [e(R, -2.5, 0, -11), e(G, 5, 0, -16, 0.6), e(Y, -6, 0, -20, 1.5), e(G, 2, 0, -22, 2.2)],
            events: [{ at: 1.2, type: 'drop', pos: [-7, 0, -16] }] },
        ] },
      { pos: [6, 1.6, -14], look: [14, 1.4, -26], cover: 'crate',
        waves: [
          { enemies: [e(G, 12, 0, -22), e(G, 16, 0, -26, 0.8), e(GR, 9, 0, -30, 1.6), e(R, 18, 0, -30, 2.6)] },
          { enemies: [e(RU, 14, 0, -34), e(G, 10, 0, -24, 0.5), e(R, 17, 0, -24, 1.4), e(G, 18, 2.6, -28, 2.0), e(Y, 20, 0, -34, 3.0)],
            events: [{ at: 0.5, type: 'explode', pos: [11, 0.6, -21] }] },
        ] },
      { pos: [14, 1.6, -30], look: [14, 1.4, -48], cover: 'crate',
        waves: [
          { enemies: [e(G, 10, 0, -42), e(G, 18, 0, -42), e(R, 14, 0, -46, 1.2), e(GR, 8, 0, -50, 2.0), e(RU, 19, 0, -52, 3.2)] },
          { enemies: [e(R, 11, 0, -40), e(R, 17, 0, -40, 0.4), e(G, 8, 2.6, -44, 1.0), e(G, 9, 0, -48, 1.6), e(G, 20, 0, -48, 1.6), e(RU, 14, 0, -56, 2.8)] },
        ],
        boss: { type: 'tank', pos: [14, 0, -50], time: 90 } },
    ] },

  // ============================================================ ZONE 2 — LA RUE
  { id: 'street', name: 'ZONE 2 — LA RUE', intro: 'Ils se replient vers le centre-ville. Aux fenêtres, sur les toits : partout.',
    theme: 'street', timePerPoint: 40, ammo: 8, lives: 3,
    points: [
      { pos: [0, 1.6, 0], look: [0, 1.6, -16], cover: 'car',
        waves: [
          { enemies: [e(G, -3, 0, -14), e(G, 3, 0, -16, 0.8), e(G, -8.6, 3.2, -20, 1.6), e(R, 8.6, 3.2, -18, 2.4)] },
          { enemies: [e(R, 0, 0, -20), e(G, -8.6, 6.5, -24, 0.6), e(G, 8.6, 6.5, -22, 0.6), e(Y, 4, 0, -26, 1.8), e(GR, -4, 0, -28, 2.6)],
            events: [{ at: 0.8, type: 'glass', pos: [-8.6, 3.2, -20] }] },
        ] },
      { pos: [0, 1.6, -22], look: [0, 1.6, -40], cover: 'car',
        waves: [
          { enemies: [e(G, -4, 0, -36), e(G, 4, 0, -36), e(RU, 0, 0, -44, 1.0), e(R, -8.6, 3.2, -38, 1.8), e(R, 8.6, 3.2, -34, 2.6)],
            events: [{ at: 2.0, type: 'explode', pos: [3, 0.6, -33] }] },
          { enemies: [e(G, -2, 0, -40), e(G, 2, 0, -40), e(GR, -8.6, 6.5, -42, 1.2), e(GR, 8.6, 6.5, -42, 1.2), e(R, 0, 2.6, -46, 2.2), e(Y, -5, 0, -48, 3.0)] },
          { enemies: [e(RU, -3, 0, -50), e(RU, 3, 0, -50, 0.4), e(R, -8.6, 3.2, -44, 1.0), e(R, 8.6, 3.2, -44, 1.0), e(G, 0, 2.6, -48, 2.0)] },
        ] },
      { pos: [0, 1.6, -44], look: [0, 1.6, -62], cover: 'car',
        waves: [
          { enemies: [e(G, -5, 0, -58), e(G, 5, 0, -58), e(G, 0, 0, -62, 0.8), e(R, -8.6, 3.2, -56, 1.6), e(R, 8.6, 6.5, -60, 2.4), e(GR, 5, 2.6, -66, 3.2)] },
          { enemies: [e(R, -3, 0, -60), e(R, 3, 0, -60, 0.3), e(RU, 0, 0, -68, 1.0), e(G, -8.6, 6.5, -62, 1.5), e(G, 8.6, 6.5, -62, 1.5), e(Y, -5, 2.6, -70, 2.5)],
            events: [{ at: 1.5, type: 'explode', pos: [-4, 0.6, -55] }] },
        ],
        boss: { type: 'heli', pos: [0, 7, -66], time: 100 } },
    ] },

  // ============================================================ ZONE 3 — LE HANGAR
  { id: 'hangar', name: 'ZONE 3 — LE HANGAR', intro: 'Leur chef est retranché dans le hangar. Passerelles, projecteurs, pas d\'issue.',
    theme: 'hangar', timePerPoint: 40, ammo: 8, lives: 3,
    points: [
      { pos: [0, 1.6, 0], look: [0, 1.6, -18], cover: 'crate',
        waves: [
          { enemies: [e(G, -5, 0, -14), e(G, 5, 0, -14, 0.6), e(G, -10, 4, -20, 1.4), e(G, 10, 4, -20, 1.4), e(R, 0, 0, -22, 2.4)] },
          { enemies: [e(R, -10, 4, -18), e(R, 10, 4, -18, 0.4), e(GR, 0, 4, -26, 1.2), e(RU, -3, 0, -30, 2.0), e(RU, 3, 0, -30, 2.2), e(Y, 0, 0, -34, 3.0)],
            events: [{ at: 1.0, type: 'drop', pos: [6, 0, -24] }] },
        ] },
      { pos: [0, 1.6, -20], look: [0, 1.6, -40], cover: 'crate',
        waves: [
          { enemies: [e(G, -4, 0, -34), e(G, 4, 0, -34), e(R, -10, 4, -38, 1.0), e(R, 10, 4, -38, 1.0), e(GR, 0, 4, -44, 2.0), e(G, 0, 0, -48, 2.6)] },
          { enemies: [e(RU, -5, 0, -46), e(RU, 5, 0, -46, 0.3), e(RU, 0, 0, -50, 0.6), e(R, -10, 4, -42, 1.4), e(R, 10, 4, -42, 1.4), e(Y, 0, 4, -52, 2.4)],
            events: [{ at: 0.6, type: 'explode', pos: [-6, 0.6, -33] }] },
          { enemies: [e(R, -3, 0, -44), e(R, 3, 0, -44), e(R, 0, 4, -50, 1.0), e(GR, -10, 4, -46, 1.6), e(GR, 10, 4, -46, 1.6), e(G, -6, 0, -54, 2.2), e(G, 6, 0, -54, 2.2)] },
        ] },
      { pos: [0, 1.6, -40], look: [0, 1.6, -60], cover: 'crate',
        waves: [
          { enemies: [e(G, -6, 0, -56), e(G, 6, 0, -56), e(R, -10, 4, -58, 0.8), e(R, 10, 4, -58, 0.8), e(RU, 0, 0, -66, 1.6), e(GR, 0, 4, -64, 2.4)] },
        ],
        boss: { type: 'chief', pos: [0, 0, -58], time: 120 } },
    ] },
];

// Rapproche les ennemis de la caméra (Time Crisis joue à 4–10 m, pas à 20) : positions ramenées vers le point de rail.
// y conservé (fenêtres, passerelles). Distance minimale 5 m pour ne pas coller au couvert.
const NEAR = 0.6, MIN = 5;
function pull(pt, pos, k) {
  if (pos[1] > 0.1) {   // en hauteur : le x reste sur la structure ; la distance garantit qu'il reste dans le champ de la caméra
    const dz = pos[2] - pt[2], dy = pos[1] + 1.2 - pt[1], dx = Math.abs(pos[0] - pt[0]);
    const minD = Math.max(MIN, dy / Math.tan(20 * Math.PI / 180), dx / Math.tan(30 * Math.PI / 180));
    return [pos[0], pos[1], pt[2] + Math.sign(dz) * Math.max(minD, Math.abs(dz) * k)];
  }
  const dx = pos[0] - pt[0], dz = pos[2] - pt[2], d = Math.hypot(dx, dz) || 1;
  const nd = Math.max(MIN, d * k);
  return [pt[0] + dx / d * nd, pos[1], pt[2] + dz / d * nd];
}
export const LEVELS = RAW.map(L => ({ ...L, points: L.points.map(pt => ({ ...pt,
  waves: pt.waves.map(w => ({ ...w, enemies: w.enemies.map(e => ({ ...e, pos: pull(pt.pos, e.pos, NEAR) })), events: (w.events || []) })),   // les événements de décor gardent leur place d'origine (hors des lignes de tir)
  boss: pt.boss ? { ...pt.boss, pos: pull(pt.pos, pt.boss.pos, 0.7) } : undefined })) }));
