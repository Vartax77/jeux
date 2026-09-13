// Match : joueurs (téléphone, téléphone partagé, clavier, bot), ordre des tours, feuilles de score, classement,
// sérialisation pour la sauvegarde. Sans DOM (tests/match.test.mjs).

import { nouvelleFeuille, enregistrerLancer, feuilleComplete, positionCourante, quillesAvantBoule, calculerScores, statistiques } from './score.js';
import { COULEURS } from '../../commun/constantes.js';

export const TYPES_JOUEUR = Object.freeze(['telephone', 'partage', 'clavier', 'bot']);
export const NIVEAUX_BOT = Object.freeze({ debutant: 'Débutant', confirme: 'Confirmé', pro: 'Pro' });
export const MAX_JOUEURS_MATCH = 8;

export class Match extends EventTarget {
  constructor(options = {}) {
    super();
    this.options = { nbFrames: 10, gouttieresFermees: false, ...options };
    this.joueurs = [];
    this.etat = 'salon';        // salon | enCours | termine
    this.index = 0;
    this._compteur = 0;
  }

  // ---------- Salon ----------

  ajouterJoueur({ nom, couleur, type, jeton = null, niveau = null, main = 'droite', id = null }) {
    if (this.joueurs.length >= MAX_JOUEURS_MATCH) return null;
    if (!TYPES_JOUEUR.includes(type)) throw new Error('type de joueur inconnu : ' + type);
    const j = {
      id: id || ('j' + (++this._compteur) + '-' + Math.random().toString(36).slice(2, 6)),
      nom: String(nom || '').trim().slice(0, 16) || this._nomParDefaut(type, niveau),
      couleur: couleur || this._couleurLibre(), type, jeton, niveau: type === 'bot' ? (niveau || 'confirme') : null, main,
      feuille: nouvelleFeuille(this.options.nbFrames), connecte: true,
    };
    this.joueurs.push(j);
    this._emettre('joueurs');
    return j;
  }

  _nomParDefaut(type, niveau) {
    if (type === 'bot') return 'Bot ' + (NIVEAUX_BOT[niveau] || 'Confirmé');
    if (type === 'clavier') return 'Clavier';
    return 'Joueur ' + (this.joueurs.length + 1);
  }

  _couleurLibre() {
    const prises = new Set(this.joueurs.map((j) => j.couleur));
    return COULEURS.find((c) => !prises.has(c)) || COULEURS[this.joueurs.length % COULEURS.length];
  }

  retirerJoueur(id) {
    const i = this.joueurs.findIndex((j) => j.id === id);
    if (i < 0) return false;
    this.joueurs.splice(i, 1);
    this._emettre('joueurs');
    return true;
  }

  deplacerJoueur(id, delta) {
    const i = this.joueurs.findIndex((j) => j.id === id);
    const k = i + delta;
    if (i < 0 || k < 0 || k >= this.joueurs.length) return false;
    const [j] = this.joueurs.splice(i, 1);
    this.joueurs.splice(k, 0, j);
    this._emettre('joueurs');
    return true;
  }

  modifierJoueur(id, champs) {
    const j = this.joueurs.find((x) => x.id === id);
    if (!j) return false;
    if (champs.nom != null) j.nom = String(champs.nom).trim().slice(0, 16) || j.nom;
    if (champs.couleur) j.couleur = champs.couleur;
    if (champs.niveau && j.type === 'bot') { j.niveau = champs.niveau; }
    if (champs.main) j.main = champs.main;
    if (champs.connecte != null) j.connecte = !!champs.connecte;
    this._emettre('joueurs');
    return true;
  }

  joueur(id) { return this.joueurs.find((j) => j.id === id) || null; }
  joueursParJeton(jeton) { return this.joueurs.filter((j) => j.jeton === jeton); }

  reglerOptions(options) {
    Object.assign(this.options, options);
    if (this.etat === 'salon') for (const j of this.joueurs) j.feuille = nouvelleFeuille(this.options.nbFrames);
    this._emettre('options');
  }

  // ---------- Partie ----------

  commencer() {
    if (!this.joueurs.length) return false;
    for (const j of this.joueurs) j.feuille = nouvelleFeuille(this.options.nbFrames);
    this.index = 0;
    this.etat = 'enCours';
    this._emettre('debut');
    return true;
  }

  // Rejouer avec les mêmes joueurs (retour en préparation, feuilles vierges).
  rejouer() {
    return this.commencer();
  }

  joueurCourant() {
    return this.etat === 'enCours' ? this.joueurs[this.index] : null;
  }

  // Position du joueur courant : { joueur, frame, boule, debout }
  position() {
    const j = this.joueurCourant();
    if (!j) return null;
    const p = positionCourante(j.feuille);
    if (!p) return null;
    return { joueur: j, frame: p.frame, boule: p.boule, debout: quillesAvantBoule(j.feuille) };
  }

  // Enregistre le lancer du joueur courant. Retourne le résultat de score enrichi de la suite à donner.
  enregistrerResultat(quilles) {
    const j = this.joueurCourant();
    if (!j) throw new Error('aucun joueur courant');
    const r = enregistrerLancer(j.feuille, quilles);
    let changementJoueur = false;
    let fin = false;
    if (r.termine || positionCourante(j.feuille).boule === 1) {
      // Frame terminée (ou feuille complète) : joueur suivant dont la feuille n'est pas finie
      const suivant = this._indexSuivant();
      if (suivant === -1) { fin = true; this.etat = 'termine'; }
      else { changementJoueur = suivant !== this.index || this.joueurs.length === 1; this.index = suivant; }
    }
    const sc = calculerScores(j.feuille);
    const res = { ...r, joueur: j, scores: sc, changementJoueur, fin, suivant: fin ? null : this.position(), modeRemise: fin ? 'rack' : (this.position().boule === 1 ? 'rack' : (this.position().debout === 10 ? 'rack' : 'respot')) };
    this._emettre('lancer', res);
    if (fin) this._emettre('fin', { classement: this.classement() });
    return res;
  }

  _indexSuivant() {
    const n = this.joueurs.length;
    for (let k = 1; k <= n; k++) {
      const i = (this.index + k) % n;
      if (!feuilleComplete(this.joueurs[i].feuille)) return i;
    }
    return -1;
  }

  classement() {
    return this.joueurs.map((j) => ({ joueur: j, total: calculerScores(j.feuille).total, stats: statistiques(j.feuille) }))
      .sort((a, b) => b.total - a.total)
      .map((e, i, arr) => ({ ...e, rang: i > 0 && arr[i - 1].total === e.total ? arr[i - 1].rang : i + 1 }));
  }

  // ---------- Sérialisation ----------

  versJSON() {
    return {
      options: { ...this.options }, etat: this.etat, index: this.index,
      joueurs: this.joueurs.map((j) => ({ id: j.id, nom: j.nom, couleur: j.couleur, type: j.type, jeton: j.jeton, niveau: j.niveau, main: j.main, feuille: { nbFrames: j.feuille.nbFrames, frames: j.feuille.frames.map((f) => ({ lancers: f.lancers.slice() })) } })),
    };
  }

  static depuisJSON(obj) {
    const m = new Match(obj.options || {});
    m.etat = obj.etat || 'salon';
    m.index = obj.index || 0;
    for (const j of obj.joueurs || []) {
      const nj = m.ajouterJoueur({ nom: j.nom, couleur: j.couleur, type: j.type, jeton: j.jeton, niveau: j.niveau, main: j.main, id: j.id });
      if (nj && j.feuille) nj.feuille = { nbFrames: j.feuille.nbFrames || m.options.nbFrames, frames: (j.feuille.frames || []).map((f) => ({ lancers: (f.lancers || []).slice() })) };
    }
    if (m.index >= m.joueurs.length) m.index = 0;
    return m;
  }

  _emettre(nom, detail = {}) {
    this.dispatchEvent(new CustomEvent(nom, { detail }));
  }
}
