// Règles et score du ten-pin (cahier des charges §4.6). Sans DOM, testable en Node (tests/score.test.mjs).
//
// Une feuille = { nbFrames, frames: [{ lancers: [q1, q2, (q3)], ... }] }. Chaque lancer = nombre de quilles tombées.
// Dernière frame : 3 lancers possibles (strike → 2 bonus, spare → 1 bonus). Score max 300 (10 frames), 150 (5 frames).

// Adjacence des quilles (numéros 1..10) : deux quilles à un espacement l'une de l'autre.
export const ADJACENCES = Object.freeze({
  1: [2, 3], 2: [1, 3, 4, 5], 3: [1, 2, 5, 6], 4: [2, 5, 7, 8], 5: [2, 3, 4, 6, 8, 9],
  6: [3, 5, 9, 10], 7: [4, 8], 8: [4, 5, 7, 9], 9: [5, 6, 8, 10], 10: [6, 9],
});

export function nouvelleFeuille(nbFrames = 10) {
  return { nbFrames, frames: [] };
}

// Frame en cours (index) et numéro de la prochaine boule dans cette frame, ou null si la feuille est complète.
export function positionCourante(feuille) {
  const n = feuille.nbFrames;
  for (let i = 0; i < n; i++) {
    const f = feuille.frames[i];
    if (!f) return { frame: i + 1, boule: 1 };
    if (!frameComplete(feuille, i)) return { frame: i + 1, boule: f.lancers.length + 1 };
  }
  return null;
}

export function frameComplete(feuille, i) {
  const f = feuille.frames[i];
  if (!f) return false;
  const l = f.lancers;
  const derniere = i === feuille.nbFrames - 1;
  if (!derniere) return l.length === 2 || (l.length === 1 && l[0] === 10);
  // Dernière frame
  if (l.length === 3) return true;
  if (l.length === 2) return l[0] + l[1] < 10 && l[0] !== 10; // ni strike ni spare : 2 boules suffisent
  return false;
}

export function feuilleComplete(feuille) {
  return positionCourante(feuille) === null;
}

// Nombre de quilles debout avant la prochaine boule de la frame en cours (10 = rack complet).
export function quillesAvantBoule(feuille) {
  const p = positionCourante(feuille);
  if (!p) return 0;
  const f = feuille.frames[p.frame - 1];
  if (!f || p.boule === 1) return 10;
  const l = f.lancers;
  const derniere = p.frame === feuille.nbFrames;
  if (!derniere) return 10 - l[0];
  if (p.boule === 2) return l[0] === 10 ? 10 : 10 - l[0];
  // boule 3 de la dernière frame
  if (l[0] === 10) return l[1] === 10 ? 10 : 10 - l[1];
  return 10; // spare en 2 boules → rack complet
}

// Types des lancers d'une frame : [{ q, type: 'strike'|'spare'|'normal' }]. Un rack « frais » (10 quilles, aucune boule
// jouée dessus) est requis pour un strike ; sinon 10 quilles renversées en 2e boule sont un spare (ex. 0 puis 10).
export function typesLancers(feuille, i) {
  const f = feuille.frames[i];
  if (!f) return [];
  const out = [];
  let debout = 10, frais = true;
  for (const q of f.lancers) {
    let type = 'normal';
    if (q === 10 && frais) type = 'strike';
    else if (q === debout && q > 0 && !frais) type = 'spare';
    out.push({ q, type });
    if (type === 'normal') { debout -= q; frais = false; } else { debout = 10; frais = true; }
  }
  return out;
}

// Enregistre un lancer (quilles tombées). Retourne { frame, boule, strike, spare, rackSuivant: 'respot'|'rack'|null, termine }.
export function enregistrerLancer(feuille, quilles) {
  const p = positionCourante(feuille);
  if (!p) throw new Error('feuille complète');
  const debout = quillesAvantBoule(feuille);
  const q = Math.max(0, Math.min(debout, Math.round(quilles)));
  if (!feuille.frames[p.frame - 1]) feuille.frames[p.frame - 1] = { lancers: [] };
  const f = feuille.frames[p.frame - 1];
  f.lancers.push(q);
  const types = typesLancers(feuille, p.frame - 1);
  const type = types[types.length - 1].type;
  const strike = type === 'strike';
  const spareReel = type === 'spare';
  const termine = feuilleComplete(feuille);
  let rackSuivant = null;
  if (!termine) {
    const suivant = positionCourante(feuille);
    rackSuivant = suivant.boule === 1 ? 'rack' : (quillesAvantBoule(feuille) === 10 ? 'rack' : 'respot');
  }
  return { frame: p.frame, boule: p.boule, quilles: q, debout: debout - q, strike, spare: spareReel, rackSuivant, termine };
}

// Scores : total par frame (null tant qu'il n'est pas déterminé) et cumul.
export function calculerScores(feuille) {
  const n = feuille.nbFrames;
  const lancers = [];
  for (let i = 0; i < n; i++) for (const q of (feuille.frames[i] ? feuille.frames[i].lancers : [])) lancers.push({ frame: i, q });
  const totaux = [];
  let cumul = 0;
  for (let i = 0; i < n; i++) {
    const f = feuille.frames[i];
    if (!f) { totaux.push(null); continue; }
    const idx = lancers.findIndex((l) => l.frame === i);
    const derniere = i === n - 1;
    let valeur = null;
    if (derniere) {
      if (frameComplete(feuille, i)) valeur = f.lancers.reduce((a, b) => a + b, 0);
    } else if (f.lancers[0] === 10) {
      if (lancers.length >= idx + 3) valeur = 10 + lancers[idx + 1].q + lancers[idx + 2].q;
    } else if (f.lancers.length === 2 && f.lancers[0] + f.lancers[1] === 10) {
      if (lancers.length >= idx + 3) valeur = 10 + lancers[idx + 2].q;
    } else if (f.lancers.length === 2) {
      valeur = f.lancers[0] + f.lancers[1];
    }
    if (valeur === null) { totaux.push(null); continue; }
    cumul += valeur;
    totaux.push(cumul);
  }
  const dernier = totaux.filter((t) => t !== null);
  return { totaux, total: dernier.length ? dernier[dernier.length - 1] : 0, provisoire: totalProvisoire(feuille) };
}

// Total « à ce stade » en comptant les bonus non encore connus à 0 (affiché en gris).
export function totalProvisoire(feuille) {
  let total = 0;
  for (let i = 0; i < feuille.nbFrames; i++) {
    const f = feuille.frames[i];
    if (!f) continue;
    total += f.lancers.reduce((a, b) => a + b, 0);
  }
  // + bonus connus
  const lancers = [];
  for (let i = 0; i < feuille.nbFrames; i++) for (const q of (feuille.frames[i] ? feuille.frames[i].lancers : [])) lancers.push({ frame: i, q });
  for (let i = 0; i < feuille.nbFrames - 1; i++) {
    const f = feuille.frames[i];
    if (!f) continue;
    const idx = lancers.findIndex((l) => l.frame === i);
    if (f.lancers[0] === 10) { if (lancers[idx + 1]) total += lancers[idx + 1].q; if (lancers[idx + 2]) total += lancers[idx + 2].q; }
    else if (f.lancers.length === 2 && f.lancers[0] + f.lancers[1] === 10 && lancers[idx + 2]) total += lancers[idx + 2].q;
  }
  return total;
}

// Marques d'affichage d'une frame : ['X'], ['7', '/'], ['9', '-'], ['X', '8', '1']…
export function marques(feuille, i) {
  return typesLancers(feuille, i).map((l) => (l.type === 'strike' ? 'X' : l.type === 'spare' ? '/' : l.q === 0 ? '-' : String(l.q)));
}

// Strikes consécutifs terminés par le dernier lancer (pour « turkey »).
export function strikesConsecutifs(feuille) {
  const types = [];
  for (let i = 0; i < feuille.nbFrames; i++) for (const l of typesLancers(feuille, i)) types.push(l.type);
  let n = 0;
  for (let k = types.length - 1; k >= 0 && types[k] === 'strike'; k--) n++;
  return n;
}

// Split : quille 1 tombée, au moins 2 quilles debout, et les quilles debout ne forment pas un seul groupe adjacent.
export function estSplit(tombees) {
  if (!tombees[0]) return false;
  const debout = [];
  for (let i = 0; i < 10; i++) if (!tombees[i]) debout.push(i + 1);
  if (debout.length < 2) return false;
  const ens = new Set(debout);
  const vus = new Set();
  const pile = [debout[0]];
  while (pile.length) {
    const q = pile.pop();
    if (vus.has(q)) continue;
    vus.add(q);
    for (const v of ADJACENCES[q]) if (ens.has(v) && !vus.has(v)) pile.push(v);
  }
  return vus.size < debout.length;
}

// Callout à annoncer après un lancer. resultat : { quilles, strike, spare, tombees (bool[10]), gouttiere, phaseLancer, boule }
export function callout(feuille, resultat) {
  const sc = calculerScores(feuille);
  const nb = strikesConsecutifs(feuille);
  if (feuilleComplete(feuille) && sc.total === scoreParfait(feuille.nbFrames)) return { texte: 'PARTIE PARFAITE !', classe: 'parfaite' };
  if (resultat.phaseLancer === 'arriere') return { texte: 'EN ARRIÈRE !', classe: 'gag' };
  if (resultat.strike) return nb >= 3 ? { texte: 'TURKEY !', classe: 'turkey' } : { texte: 'STRIKE !', classe: 'strike' };
  if (resultat.spare) return { texte: 'SPARE !', classe: 'spare' };
  if (resultat.boule === 1 && resultat.tombees && estSplit(resultat.tombees)) return { texte: 'SPLIT', classe: 'split' };
  if (resultat.gouttiere && resultat.quilles === 0) return { texte: 'GOUTTIÈRE', classe: 'gouttiere' };
  if (resultat.quilles === 0) return { texte: 'AUCUNE QUILLE', classe: 'zero' };
  return { texte: resultat.quilles + (resultat.quilles > 1 ? ' QUILLES' : ' QUILLE'), classe: '' };
}

export function scoreParfait(nbFrames) {
  return nbFrames * 30;
}

// Statistiques d'une feuille : strikes, spares, meilleur lancer, ouvertures.
export function statistiques(feuille) {
  let strikes = 0, spares = 0, meilleur = 0, lancers = 0, quilles = 0;
  for (let i = 0; i < feuille.nbFrames; i++) {
    for (const l of typesLancers(feuille, i)) {
      lancers++; quilles += l.q; meilleur = Math.max(meilleur, l.q);
      if (l.type === 'strike') strikes++;
      else if (l.type === 'spare') spares++;
    }
  }
  return { strikes, spares, meilleur, lancers, quilles, moyenne: lancers ? quilles / lancers : 0 };
}

// Joue une partie complète depuis une liste de lancers (tests, bots) : retourne la feuille.
export function jouerLancers(nbFrames, liste) {
  const f = nouvelleFeuille(nbFrames);
  for (const q of liste) { if (feuilleComplete(f)) break; enregistrerLancer(f, q); }
  return f;
}
