import * as THREE from 'three';

// Objets modelés en primitives, avec relief : servent tant qu'aucun assets/props/<nom>.glb n'est déposé.
// Couleurs prises de photos de terminaux à conteneurs (teintes sourdes, jamais saturées).
export const CONTAINER_COLORS = [0x8a3a2c, 0x2b5a92, 0x3a6a3f, 0x6b2a2a, 0x9a5a2a, 0x5a5f66, 0x1f2a30, 0x2a6a7a];

let _corrugated = null;
// Carte de normales de tôle ondulée : nervures verticales, générée une fois
function corrugatedNormal() {
  if (_corrugated) return _corrugated;
  try {
    const S = 256, cv = document.createElement('canvas'); cv.width = cv.height = S; const c = cv.getContext('2d');
    const img = c.createImageData(S, S), d = img.data;
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const t = (x % 32) / 32, slope = Math.sin(t * Math.PI * 2) * 0.9;        // profil trapézoïdal adouci
      const nx = -slope, nz = 1, l = Math.hypot(nx, nz); const i = (y * S + x) * 4;
      d[i] = 128 + (nx / l) * 127; d[i + 1] = 128; d[i + 2] = 128 + (nz / l) * 127; d[i + 3] = 255;
    }
    c.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; _corrugated = t; return t;
  } catch (_) { return null; }
}

const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0.25, ...extra });
function box(w, h, d, mat, x, y, z, parent) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; }

// Conteneur 20 pieds : 6,06 × 2,59 × 2,44 m — l'axe long est Z
export function makeContainer(color = CONTAINER_COLORS[0], L = 6.06, H = 2.59, W = 2.44) {
  const g = new THREE.Group();
  const n = corrugatedNormal();
  const wallMat = std(color, { roughness: 0.6, metalness: 0.35 });
  if (n) { const nm = n.clone(); nm.needsUpdate = true; nm.repeat.set(L / 0.28, 1); wallMat.normalMap = nm; wallMat.normalScale.set(0.9, 0.9); }
  const endMat = std(color, { roughness: 0.6, metalness: 0.35 });
  if (n) { const nm2 = n.clone(); nm2.needsUpdate = true; nm2.repeat.set(W / 0.28, 1); endMat.normalMap = nm2; endMat.normalScale.set(0.9, 0.9); }
  const roofMat = std(new THREE.Color(color).multiplyScalar(0.85), { roughness: 0.8, metalness: 0.3 });
  const t = 0.05, frame = std(new THREE.Color(color).multiplyScalar(0.55), { roughness: 0.5, metalness: 0.5 });
  // Parois (la carte de normales ne s'applique qu'aux longues faces et aux bouts)
  box(t, H - 0.3, L - 0.3, wallMat, -W / 2 + t / 2, H / 2, 0, g); box(t, H - 0.3, L - 0.3, wallMat, W / 2 - t / 2, H / 2, 0, g);
  box(W - 0.3, H - 0.3, t, endMat, 0, H / 2, -L / 2 + t / 2, g);
  const door = box(W - 0.3, H - 0.3, t, endMat, 0, H / 2, L / 2 - t / 2, g);
  box(W, t, L, roofMat, 0, H - t / 2, 0, g); box(W, 0.12, L, frame, 0, 0.06, 0, g);
  // Châssis : longerons, traverses, coins d'angle
  for (const sx of [-1, 1]) { box(0.16, 0.16, L, frame, sx * (W / 2 - 0.08), 0.08, 0, g); box(0.16, 0.16, L, frame, sx * (W / 2 - 0.08), H - 0.08, 0, g);
    for (const sz of [-1, 1]) { box(0.16, H, 0.16, frame, sx * (W / 2 - 0.08), H / 2, sz * (L / 2 - 0.08), g); } }
  for (const sz of [-1, 1]) { box(W, 0.16, 0.16, frame, 0, 0.08, sz * (L / 2 - 0.08), g); box(W, 0.16, 0.16, frame, 0, H - 0.08, sz * (L / 2 - 0.08), g); }
  // Barres de verrouillage des portes (4) et poignées
  const barMat = std(0x9aa0a8, { roughness: 0.35, metalness: 0.8 });
  for (const x of [-0.75, -0.3, 0.3, 0.75]) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, H - 0.5, 8), barMat); b.position.set(x, H / 2, L / 2 + 0.04); g.add(b); box(0.22, 0.05, 0.05, barMat, x + 0.09, H * 0.45, L / 2 + 0.05, g); }
  door.userData.part = 'door';
  return g;
}

// Palette EUR 1,2 × 0,8 × 0,144 m
export function makePallet(color = 0x9a8262) {
  const g = new THREE.Group(); const wood = std(color, { roughness: 0.9, metalness: 0 }), wood2 = std(new THREE.Color(color).multiplyScalar(0.85), { roughness: 0.9, metalness: 0 });
  const L = 1.2, W = 0.8;
  for (let i = 0; i < 5; i++) box(L, 0.022, 0.1, wood, 0, 0.133, -W / 2 + 0.05 + i * (W - 0.1) / 4, g);            // planches du dessus
  for (const z of [-W / 2 + 0.072, 0, W / 2 - 0.072]) box(L, 0.022, 0.145, wood2, 0, 0.100, z, g);                // traverses
  for (const x of [-L / 2 + 0.072, 0, L / 2 - 0.072]) for (const z of [-W / 2 + 0.072, 0, W / 2 - 0.072]) box(0.145, 0.078, 0.145, wood2, x, 0.050, z, g);  // dés
  for (const x of [-L / 2 + 0.05, 0, L / 2 - 0.05]) box(0.1, 0.022, W, wood, x, 0.011, 0, g);                     // semelles
  return g;
}

// Baril 200 L : Ø 0,58 × 0,88 m
export function makeBarrel(color = 0x2b5a92) {
  const g = new THREE.Group(); const m = std(color, { roughness: 0.55, metalness: 0.5 }), rim = std(0x2a2d31, { roughness: 0.5, metalness: 0.6 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.29, 0.29, 0.88, 20), m); body.position.y = 0.44; body.castShadow = body.receiveShadow = true; g.add(body);
  for (const y of [0.30, 0.58]) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.29, 0.018, 8, 24), rim); r.rotation.x = Math.PI / 2; r.position.y = y; g.add(r); }
  for (const y of [0.02, 0.86]) { const r = new THREE.Mesh(new THREE.CylinderGeometry(0.30, 0.30, 0.04, 20), rim); r.position.y = y; g.add(r); }
  return g;
}

// Caisse bois à cadre : dimensions libres
export function makeCrate(w = 1.2, h = 1.0, d = 0.8, color = 0x8a7a62) {
  const g = new THREE.Group(); const wood = std(color, { roughness: 0.9, metalness: 0 }), edge = std(new THREE.Color(color).multiplyScalar(0.7), { roughness: 0.9, metalness: 0 });
  box(w - 0.06, h - 0.06, d - 0.06, wood, 0, h / 2, 0, g);
  const e = 0.06;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(e, h, e, edge, sx * (w / 2 - e / 2), h / 2, sz * (d / 2 - e / 2), g);
  for (const sy of [e / 2, h - e / 2]) { for (const sz of [-1, 1]) box(w, e, e, edge, 0, sy, sz * (d / 2 - e / 2), g); for (const sx of [-1, 1]) box(e, e, d, edge, sx * (w / 2 - e / 2), sy, 0, g); }
  // Planches horizontales suggérées par de fines rainures sombres
  const groove = std(new THREE.Color(color).multiplyScalar(0.45), { roughness: 1 });
  for (let y = 0.2; y < h - 0.1; y += 0.2) { box(w - 0.04, 0.012, 0.004, groove, 0, y, d / 2 - 0.028, g); box(w - 0.04, 0.012, 0.004, groove, 0, y, -d / 2 + 0.028, g); }
  return g;
}

export function makeProp(name, opts = {}) {
  switch (name) {
    case 'conteneur': return makeContainer(opts.color ?? CONTAINER_COLORS[Math.random() * CONTAINER_COLORS.length | 0]);
    case 'palette': return makePallet();
    case 'baril': return makeBarrel(opts.color ?? [0x2b5a92, 0x8a3a2c, 0x3a6a3f, 0x4a4a4a][Math.random() * 4 | 0]);
    case 'caisse': return makeCrate(opts.w ?? 1.2, opts.h ?? 1.0, opts.d ?? 0.8);
    default: return null;
  }
}
