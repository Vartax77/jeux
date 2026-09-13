// Profils des joueurs, indexés par le jeton persistant de leur manette.
// Contenu : identité (nom, couleur, main), surcharges de réglages (P), sens avant calibré.

const CLE = 'bowling.profils';

export class Profils {
  constructor() {
    this.tous = Profils._charger();
  }

  static _charger() {
    try {
      const brut = JSON.parse(localStorage.getItem(CLE) || '{}');
      return brut && typeof brut === 'object' ? brut : {};
    } catch (e) { return {}; }
  }

  _sauver() {
    try { localStorage.setItem(CLE, JSON.stringify(this.tous)); } catch (e) { /* stockage indisponible */ }
  }

  get(jeton) { return this.tous[jeton] || null; }

  // Profil d'un joueur sans manette (clavier, partagé, bot), retrouvé par son nom : clé `nom:<nom>`.
  parNom(nom) { return nom ? (this.tous['nom:' + String(nom).trim().toLowerCase()] || null) : null; }

  assurerParNom(nom, champs = {}) {
    const cle = 'nom:' + String(nom).trim().toLowerCase();
    const p = this.tous[cle] || (this.tous[cle] = { reglages: {}, directionAvant: null, lancers: 0, local: true });
    p.nom = String(nom).trim();
    Object.assign(p, champs);
    p.vu = Date.now();
    this._sauver();
    return p;
  }

  liste() { return Object.entries(this.tous).map(([cle, p]) => ({ cle, ...p })).sort((a, b) => (b.vu || 0) - (a.vu || 0)); }

  // Apparence et champs libres (coiffure, teint, photo…) : mise à jour partielle.
  modifier(cle, champs) {
    const p = this.tous[cle];
    if (!p) return null;
    Object.assign(p, champs);
    this._sauver();
    return p;
  }

  // Statistiques après une partie : { total, strikes, spares, meilleur, lancers, quilles }
  enregistrerPartie(cle, st) {
    const p = this.tous[cle];
    if (!p) return null;
    const s = p.stats || (p.stats = { parties: 0, meilleur: 0, totalScores: 0, strikes: 0, spares: 0, meilleurLancer: 0, xp: 0 });
    s.parties++;
    s.totalScores += st.total;
    s.meilleur = Math.max(s.meilleur, st.total);
    s.strikes += st.strikes;
    s.spares += st.spares;
    s.meilleurLancer = Math.max(s.meilleurLancer, st.meilleur);
    s.xp += st.total + st.strikes * 10 + st.spares * 5 + (st.total >= 200 ? 50 : 0) + (st.total === 300 ? 300 : 0);
    s.derniere = Date.now();
    this._sauver();
    return s;
  }

  // Crée ou met à jour le profil d'après ce que la manette annonce.
  assurer(j) {
    const p = this.tous[j.jeton] || (this.tous[j.jeton] = { reglages: {}, directionAvant: null, lancers: 0 });
    p.nom = j.nom;
    p.couleur = j.couleur;
    p.main = j.main;
    p.vu = Date.now();
    if (!p.reglages) p.reglages = {};
    this._sauver();
    return p;
  }

  setReglage(jeton, id, valeur) {
    const p = this.tous[jeton];
    if (!p) return;
    if (valeur === null || valeur === undefined || valeur === '') delete p.reglages[id];
    else p.reglages[id] = valeur;
    this._sauver();
  }

  setDirection(jeton, dir) {
    const p = this.tous[jeton];
    if (!p) return;
    p.directionAvant = Array.isArray(dir) ? dir : null;
    this._sauver();
  }

  compterLancer(jeton) {
    const p = this.tous[jeton];
    if (!p) return;
    p.lancers = (p.lancers || 0) + 1;
    this._sauver();
  }

  supprimer(jeton) {
    delete this.tous[jeton];
    this._sauver();
  }

  exporter() { return JSON.parse(JSON.stringify(this.tous)); }

  importer(obj) {
    if (!obj || typeof obj !== 'object') return;
    this.tous = {};
    for (const [jeton, p] of Object.entries(obj)) {
      if (!p || typeof p !== 'object') continue;
      this.tous[jeton] = {
        nom: String(p.nom || ''), couleur: p.couleur || null, main: p.main === 'gauche' ? 'gauche' : 'droite',
        reglages: p.reglages && typeof p.reglages === 'object' ? { ...p.reglages } : {},
        directionAvant: Array.isArray(p.directionAvant) && p.directionAvant.length === 3 ? p.directionAvant.map(Number) : null,
        lancers: Number(p.lancers) || 0, vu: Number(p.vu) || 0,
        coiffure: p.coiffure || undefined, teint: p.teint || undefined, photo: typeof p.photo === 'string' && p.photo.startsWith('data:image/') ? p.photo : undefined,
        stats: p.stats && typeof p.stats === 'object' ? { ...p.stats } : undefined, local: !!p.local,
      };
    }
    this._sauver();
  }
}
