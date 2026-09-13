// Écran titre (survol de la salle) : Nouvelle partie, Entraînement, Profils, Réglages, Calibrage, Reprendre.

import { MODES, meilleursScores } from './jeu/entrainement.js';

function el(tag, attrs = {}, ...enfants) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (v !== null && v !== undefined) e.setAttribute(k, v);
  }
  for (const c of enfants) if (c != null) e.append(c);
  return e;
}

export class Titre {
  // deps : { lire, nouvellePartie(), entrainement(mode), profils(), reglages(), calibrage(), reprendre(), sauvegarde() → { resume } | null }
  constructor(conteneur, deps) {
    this.racine = conteneur;
    Object.assign(this, deps);
    this.visible = false;
  }

  afficher(visible) {
    this.visible = visible;
    this.racine.classList.toggle('cache', !visible);
    if (visible) this.rendre();
  }

  rendre() {
    const r = this.racine;
    r.textContent = '';
    const nom = String(this.lire('nomJeu') || 'Bowling');
    const carte = el('div', { class: 'titre-carte' });
    carte.append(el('h1', { class: 'titre-nom' }, nom), el('p', { class: 'titre-sous' }, 'Écran : la partie · iPhone : la manette'));
    const menu = el('div', { class: 'titre-menu' });
    const sauv = this.sauvegarde ? this.sauvegarde() : null;
    if (sauv) menu.append(el('button', { class: 'principal', type: 'button', onclick: () => this.reprendre() }, 'Reprendre — ' + sauv.resume));
    menu.append(el('button', { class: 'principal', type: 'button', onclick: () => this.nouvellePartie() }, 'Nouvelle partie'));
    const ent = el('div', { class: 'titre-entrainements' });
    const meilleurs = meilleursScores();
    for (const [mode, m] of Object.entries(MODES)) {
      const b = el('button', { class: 'secondaire', type: 'button', onclick: () => this.entrainement(mode) }, el('b', {}, m.titre), el('span', {}, m.description), meilleurs[mode] ? el('span', { class: 'record' }, 'Record : ' + meilleurs[mode].score + (meilleurs[mode].nom ? ' (' + meilleurs[mode].nom + ')' : '')) : null);
      ent.append(b);
    }
    menu.append(el('div', { class: 'titre-libelle' }, 'Entraînement'), ent);
    menu.append(el('div', { class: 'titre-ligne' },
      el('button', { class: 'secondaire', type: 'button', onclick: () => this.profils() }, 'Profils'),
      el('button', { class: 'secondaire', type: 'button', onclick: () => this.reglages() }, 'Réglages (Échap)'),
      el('button', { class: 'secondaire', type: 'button', onclick: () => this.calibrage() }, 'Calibrage (C)')));
    carte.append(menu, el('p', { class: 'aide' }, 'Les téléphones peuvent déjà se connecter (code et QR dans le banc, touche C, et dans le salon).'));
    r.append(carte);
  }
}
