// Sauvegarde de la partie en cours (cahier des charges §4.7-6 et §7) : état enregistré après chaque lancer,
// reprise proposée au retour. Stockage : localStorage `bowling.partie`.

const CLE = 'bowling.partie';
export const VERSION_SAUVEGARDE = 1;

function stockage() {
  try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch (e) { return null; }
}

// contenu : { match: Match.versJSON(), quillesDebout: [numéros], mode: 'respot'|'rack' }
export function sauverPartie(contenu) {
  const s = stockage();
  if (!s) return false;
  try {
    s.setItem(CLE, JSON.stringify({ version: VERSION_SAUVEGARDE, date: new Date().toISOString(), ...contenu }));
    return true;
  } catch (e) {
    return false;
  }
}

export function chargerPartie() {
  const s = stockage();
  if (!s) return null;
  try {
    const raw = s.getItem(CLE);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (!obj || obj.version !== VERSION_SAUVEGARDE || !obj.match || obj.match.etat !== 'enCours') return null;
    return obj;
  } catch (e) {
    return null;
  }
}

export function effacerPartie() {
  const s = stockage();
  if (s) s.removeItem(CLE);
}

// Résumé lisible d'une sauvegarde : « Frame 4 · Valentin, Mallaury »
export function resumerSauvegarde(obj) {
  if (!obj || !obj.match) return '';
  const m = obj.match;
  const courant = m.joueurs[m.index] || m.joueurs[0];
  const frame = courant && courant.feuille ? Math.min(m.options.nbFrames || 10, (courant.feuille.frames || []).length || 1) : 1;
  return 'Frame ' + frame + ' · ' + m.joueurs.map((j) => j.nom).join(', ');
}
