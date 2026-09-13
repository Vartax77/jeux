// Fin de partie : classement, statistiques, Rejouer (mêmes joueurs) / Salon.

import { couleurHex } from '../commun/constantes.js';

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

export class Fin {
  constructor(conteneur, { rejouer, salon }) {
    this.racine = conteneur;
    this.rejouer = rejouer;
    this.salon = salon;
  }

  cacher() { this.racine.classList.add('cache'); }

  afficherEntrainement(e, record, { recommencer, menu }) {
    const r = this.racine;
    r.textContent = '';
    const carte = el('div', { class: 'fin-carte' });
    carte.append(el('h1', { class: 'fin-titre' }, e.titre + ' : ' + e.score + (e.mode === 'spares' ? ' spare' + (e.score > 1 ? 's' : '') + ' sur 10' : ' quilles')));
    if (record) carte.append(el('p', { class: 'aide' }, 'Nouveau record !'));
    const ligne = el('div', { class: 'fin-lancers' });
    e.resultats.forEach((x, i) => ligne.append(el('span', { class: 'fin-lancer' + (x.reussi || (e.mode !== 'spares' && x.debout === 0) ? ' ok' : '') }, (i + 1) + ' : ' + (e.mode === 'spares' ? (x.reussi ? '✓' : '✗') : x.tombees))));
    carte.append(ligne);
    carte.append(el('div', { class: 'fin-actions' },
      el('button', { class: 'principal', type: 'button', onclick: recommencer }, 'Recommencer'),
      el('button', { class: 'secondaire', type: 'button', onclick: menu }, 'Menu')));
    r.append(carte);
    r.classList.remove('cache');
  }

  afficher(classement, nbFrames, gains = {}) {
    const r = this.racine;
    r.textContent = '';
    const carte = el('div', { class: 'fin-carte' });
    carte.append(el('h1', { class: 'fin-titre' }, classement.length > 1 ? (classement[0].joueur.nom + ' gagne !') : 'Partie terminée'));
    const table = el('table', { class: 'fin-table' });
    table.append(el('thead', {}, el('tr', {}, el('th', {}, '#'), el('th', {}, 'Joueur'), el('th', {}, 'Score'), el('th', {}, 'Strikes'), el('th', {}, 'Spares'), el('th', {}, 'Meilleur lancer'), el('th', {}, 'Moyenne / boule'), el('th', {}, 'XP'))));
    const tbody = el('tbody');
    for (const e of classement) {
      const point = el('span', { class: 'point' });
      point.style.background = couleurHex(e.joueur.couleur);
      tbody.append(el('tr', { class: e.rang === 1 ? 'premier' : '' },
        el('td', {}, String(e.rang)), el('td', {}, point, ' ' + e.joueur.nom), el('td', { class: 'score' }, String(e.total)),
        el('td', {}, String(e.stats.strikes)), el('td', {}, String(e.stats.spares)), el('td', {}, String(e.stats.meilleur)), el('td', {}, e.stats.moyenne.toFixed(1).replace('.', ',')),
        el('td', {}, gains[e.joueur.id] ? '+' + gains[e.joueur.id].xp + ' · niveau ' + gains[e.joueur.id].niveau : '')));
    }
    table.append(tbody);
    carte.append(table);
    carte.append(el('p', { class: 'aide' }, nbFrames + ' frames · maximum ' + nbFrames * 30 + ' points'));
    carte.append(el('div', { class: 'fin-actions' },
      el('button', { class: 'principal', type: 'button', onclick: () => this.rejouer() }, 'Rejouer (mêmes joueurs)'),
      el('button', { class: 'secondaire', type: 'button', onclick: () => this.salon() }, 'Salon')));
    r.append(carte);
    r.classList.remove('cache');
  }
}
