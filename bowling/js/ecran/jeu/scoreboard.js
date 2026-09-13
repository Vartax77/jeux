// Scoreboard en bandeau haut, style feuille de bowling : une ligne par joueur, une case par frame
// (marques + cumul), total, joueur courant surligné, frame courante en évidence.

import { couleurHex } from '../../commun/constantes.js';
import { marques, calculerScores, positionCourante } from './score.js';

function el(tag, classe, texte) {
  const e = document.createElement(tag);
  if (classe) e.className = classe;
  if (texte != null) e.textContent = texte;
  return e;
}

export class Scoreboard {
  constructor(conteneur) {
    this.racine = conteneur;
  }

  afficher(visible) {
    this.racine.classList.toggle('cache', !visible);
  }

  rendre(match) {
    const n = match.options.nbFrames;
    const table = el('table', 'feuille');
    const thead = el('thead');
    const tr = el('tr');
    tr.append(el('th', 'nom', ''));
    for (let i = 1; i <= n; i++) tr.append(el('th', 'frame', String(i)));
    tr.append(el('th', 'total', 'Total'));
    thead.append(tr);
    table.append(thead);
    const tbody = el('tbody');
    const courant = match.joueurCourant();
    for (const j of match.joueurs) {
      const ligne = el('tr', 'joueur' + (courant && courant.id === j.id ? ' courant' : ''));
      const nom = el('td', 'nom');
      const point = el('span', 'point');
      point.style.background = couleurHex(j.couleur);
      nom.append(point, el('span', 'texte', j.nom));
      if (j.type === 'bot') nom.append(el('span', 'type', 'bot'));
      if (j.type === 'clavier') nom.append(el('span', 'type', 'clavier'));
      if ((j.type === 'telephone' || j.type === 'partage') && j.connecte === false) nom.append(el('span', 'type ko', 'déconnecté'));
      ligne.append(nom);
      const sc = calculerScores(j.feuille);
      const pos = positionCourante(j.feuille);
      for (let i = 0; i < n; i++) {
        const cell = el('td', 'frame' + (courant && courant.id === j.id && pos && pos.frame === i + 1 ? ' courante' : ''));
        const m = marques(j.feuille, i);
        const boules = el('div', 'boules');
        const nb = i === n - 1 ? 3 : 2;
        for (let k = 0; k < nb; k++) boules.append(el('span', 'boule' + (m[k] === 'X' ? ' strike' : m[k] === '/' ? ' spare' : ''), m[k] == null ? '' : m[k]));
        cell.append(boules);
        cell.append(el('div', 'cumul', sc.totaux[i] == null ? '' : String(sc.totaux[i])));
        ligne.append(cell);
      }
      const total = el('td', 'total', String(sc.total));
      if (sc.provisoire !== sc.total) total.append(el('span', 'provisoire', ' (' + sc.provisoire + ')'));
      ligne.append(total);
      tbody.append(ligne);
    }
    table.append(tbody);
    this.racine.textContent = '';
    this.racine.append(table);
  }
}
