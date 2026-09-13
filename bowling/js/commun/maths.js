// Petites fonctions mathématiques partagées (vecteurs 3D, orientation, statistiques).

export const vec = {
  add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  echelle: (a, k) => [a[0] * k, a[1] * k, a[2] * k],
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  norme: (a) => Math.hypot(a[0], a[1], a[2]),
  normalise(a) {
    const n = Math.hypot(a[0], a[1], a[2]);
    return n > 1e-9 ? [a[0] / n, a[1] / n, a[2] / n] : [0, 0, 0];
  },
};

export function borner(x, min = 0, max = 1) {
  if (!Number.isFinite(x)) return min;
  return Math.min(max, Math.max(min, x));
}

export function mediane(valeurs) {
  if (!valeurs.length) return 0;
  const t = [...valeurs].sort((a, b) => a - b);
  const m = Math.floor(t.length / 2);
  return t.length % 2 ? t[m] : (t[m - 1] + t[m]) / 2;
}

const RAD = Math.PI / 180;

// Matrice de rotation (3×3) du repère du téléphone vers le repère terrestre,
// d'après la spécification W3C DeviceOrientation : R = Rz(alpha) · Rx(beta) · Ry(gamma).
// v_terre = appliquer(R, v_telephone). Repère terrestre : z vers le haut.
export function matriceOrientation(alphaDeg, betaDeg, gammaDeg) {
  const a = (alphaDeg || 0) * RAD, b = (betaDeg || 0) * RAD, g = (gammaDeg || 0) * RAD;
  const cA = Math.cos(a), sA = Math.sin(a);
  const cB = Math.cos(b), sB = Math.sin(b);
  const cG = Math.cos(g), sG = Math.sin(g);
  return [
    [cA * cG - sA * sB * sG, -sA * cB, cA * sG + sA * sB * cG],
    [sA * cG + cA * sB * sG, cA * cB, sA * sG - cA * sB * cG],
    [-cB * sG, sB, cB * cG],
  ];
}

export function appliquer(M, v) {
  return [
    M[0][0] * v[0] + M[0][1] * v[1] + M[0][2] * v[2],
    M[1][0] * v[0] + M[1][1] * v[1] + M[1][2] * v[2],
    M[2][0] * v[0] + M[2][1] * v[1] + M[2][2] * v[2],
  ];
}

export function transposer(M) {
  return [
    [M[0][0], M[1][0], M[2][0]],
    [M[0][1], M[1][1], M[2][1]],
    [M[0][2], M[1][2], M[2][2]],
  ];
}
