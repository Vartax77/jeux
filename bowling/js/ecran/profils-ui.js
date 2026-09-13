// Profils (écran) : liste des profils connus (manettes et joueurs locaux), apparence (coiffure, teint, visage photo),
// statistiques et expérience, suppression.

import { COIFFURES, TEINTS } from './jeu/apparence.js';
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

// Niveau d'expérience : 100 XP par niveau, progression douce.
export function niveau(xp) { return 1 + Math.floor(Math.sqrt((xp || 0) / 100)); }
export const XP_PRO = 1000;
export function estPro(xp) { return (xp || 0) >= XP_PRO; }

// Découpe une image en disque 128×128 (dataURL JPEG) — visage photo.
export function decouperVisage(fichier) {
  return new Promise((resoudre, rejeter) => {
    const img = new Image();
    const url = URL.createObjectURL(fichier);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const c = document.createElement('canvas');
      c.width = 128; c.height = 128;
      const g = c.getContext('2d');
      const cote = Math.min(img.width, img.height);
      g.beginPath(); g.arc(64, 64, 64, 0, Math.PI * 2); g.closePath(); g.clip();
      g.drawImage(img, (img.width - cote) / 2, (img.height - cote) / 2, cote, cote, 0, 0, 128, 128);
      resoudre(c.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = () => { URL.revokeObjectURL(url); rejeter(new Error('image illisible')); };
    img.src = url;
  });
}

export class ProfilsUI {
  // deps : { profils, fermer(), apresModification() }
  constructor(conteneur, deps) {
    this.racine = conteneur;
    Object.assign(this, deps);
  }

  afficher(visible) {
    this.racine.classList.toggle('cache', !visible);
    if (visible) this.rendre();
  }

  rendre() {
    const r = this.racine;
    r.textContent = '';
    const carte = el('div', { class: 'profils-carte' });
    carte.append(el('h1', { class: 'fin-titre' }, 'Profils'));
    const liste = this.profils.liste();
    if (!liste.length) carte.append(el('p', { class: 'aide' }, 'Aucun profil : ils se créent quand un téléphone se connecte ou qu’un joueur clavier / partagé termine une partie.'));
    for (const p of liste) {
      const ligne = el('div', { class: 'profil' });
      const avatar = el('div', { class: 'profil-avatar' });
      if (p.photo) { const img = el('img', { src: p.photo, alt: '' }); avatar.append(img); } else { avatar.style.background = couleurHex(p.couleur || 'bleu'); avatar.textContent = (p.nom || '?').slice(0, 1).toUpperCase(); }
      const infos = el('div', { class: 'profil-infos' });
      infos.append(el('div', { class: 'profil-nom' }, p.nom || '(sans nom)', el('span', { class: 'type' }, p.local ? 'joueur local' : 'manette')));
      const st = p.stats;
      infos.append(el('div', { class: 'profil-stats' }, st ? (estPro(st.xp) ? 'PRO · ' : '') + 'Niveau ' + niveau(st.xp) + ' · ' + st.xp + ' XP · ' + st.parties + ' partie' + (st.parties > 1 ? 's' : '') + ' · moyenne ' + Math.round(st.totalScores / st.parties) + ' · meilleur ' + st.meilleur + ' · ' + st.strikes + ' strikes · ' + st.spares + ' spares' : 'Aucune partie terminée · ' + (p.lancers || 0) + ' lancer' + ((p.lancers || 0) > 1 ? 's' : '')));
      const options = el('div', { class: 'profil-options' });
      const selC = el('select', { onchange: (e) => { this.profils.modifier(p.cle, { coiffure: e.target.value }); this.apresModification(); } });
      for (const [k, v] of Object.entries(COIFFURES)) selC.append(el('option', { value: k, ...((p.coiffure || 'court') === k ? { selected: '' } : {}) }, 'Coiffure : ' + v));
      const selT = el('select', { onchange: (e) => { this.profils.modifier(p.cle, { teint: e.target.value }); this.apresModification(); } });
      for (const k of Object.keys(TEINTS)) selT.append(el('option', { value: k, ...((p.teint || 'medium') === k ? { selected: '' } : {}) }, 'Teint : ' + k));
      const photo = el('input', { type: 'file', accept: 'image/*', hidden: '', onchange: async (e) => { const f = e.target.files && e.target.files[0]; if (!f) return; try { const d = await decouperVisage(f); this.profils.modifier(p.cle, { photo: d }); this.apresModification(); this.rendre(); } catch (err) { alert('Photo illisible'); } } });
      options.append(selC, selT,
        el('label', { class: 'bouton secondaire' }, p.photo ? 'Changer la photo' : 'Photo du visage', photo),
        p.photo ? el('button', { class: 'secondaire', type: 'button', onclick: () => { this.profils.modifier(p.cle, { photo: undefined }); this.apresModification(); this.rendre(); } }, 'Retirer la photo') : null,
        el('button', { class: 'danger', type: 'button', onclick: () => { if (confirm('Supprimer le profil de ' + p.nom + ' ?')) { this.profils.supprimer(p.cle); this.apresModification(); this.rendre(); } } }, 'Supprimer'));
      ligne.append(avatar, infos, options);
      carte.append(ligne);
    }
    carte.append(el('p', { class: 'aide' }, 'Expérience : score + 10 par strike + 5 par spare (+ 50 au-delà de 200, + 300 pour 300). À ' + XP_PRO + ' XP le joueur passe « Pro » et reçoit la boule spéciale. La photo est découpée en disque (128 px) et reste sur cet ordinateur. Les profils des manettes se mettent à jour à chaque connexion (nom, couleur, main).'));
    carte.append(el('div', { class: 'fin-actions' }, el('button', { class: 'principal', type: 'button', onclick: () => this.fermer() }, 'Fermer')));
    r.append(carte);
  }
}
