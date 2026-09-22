// Trois niveaux, un seul endroit où les régler. Tout le reste du jeu lit ces valeurs — rien n'est codé en dur ailleurs.
export const DIFFS = {
  easy:   { label: 'FACILE',    lives: 4, ammo: 10, timeMul: 1.25, accMul: 0.70, fireMul: 0.75, telegraphMul: 1.35, bossHpMul: 0.75, continues: 5, scoreMul: 0.8 },
  normal: { label: 'NORMAL',    lives: 3, ammo: 8,  timeMul: 1.00, accMul: 1.00, fireMul: 1.00, telegraphMul: 1.00, bossHpMul: 1.00, continues: 3, scoreMul: 1.0 },
  hard:   { label: 'DIFFICILE', lives: 2, ammo: 6,  timeMul: 0.85, accMul: 1.25, fireMul: 1.20, telegraphMul: 0.80, bossHpMul: 1.30, continues: 1, scoreMul: 1.3 },
};
export const DIFF_ORDER = ['easy', 'normal', 'hard'];
