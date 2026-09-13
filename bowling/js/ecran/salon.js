// Salon (avant la partie) : code de salle + QR, joueurs (téléphones ajoutés automatiquement, clavier, bots,
// joueurs partagés sur un téléphone), ordre, options, Commencer, Reprendre une partie sauvegardée.

import { COULEURS, couleurHex } from '../commun/constantes.js';
import { NIVEAUX_BOT } from './jeu/match.js';

function el(tag, attrs = {}, ...enfants) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v;
    else if (k === 'text') e.textContent = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (v !== null && v !== undefined) e.setAttribute(k, v);
  }
  for (const c of enfants) if (c != null) e.append(c);
  return e;
}

export class Salon {
  // deps : { match(), salle, lire, regler(id, v), commencer(), reprendre(), effacerSauvegarde(), sauvegarde() → {resume} | null }
  constructor(conteneur, deps) {
    this.racine = conteneur;
    Object.assign(this, deps);
    this.qrSvg = '';
    this.code = '';
    this.visible = true;
  }

  afficher(visible) {
    this.visible = visible;
    this.racine.classList.toggle('cache', !visible);
    if (visible) this.rendre();
  }

  // Replié pendant un calibrage : on voit la scène et le personnage, un petit bandeau rappelle le salon.
  replier(actif) {
    this.racine.classList.toggle('replie', !!actif);
    let b = this.racine.querySelector('.salon-replie');
    if (actif && !b) { b = el('div', { class: 'salon-replie' }, 'Salon en pause : calibrage en cours (banc C pour annuler)'); this.racine.prepend(b); }
    if (!actif && b) b.remove();
  }

  majCode(code, svg) {
    this.code = code || '';
    this.qrSvg = svg || '';
    if (this.visible) this.rendre();
  }

  rendre() {
    const m = this.match();
    const r = this.racine;
    r.textContent = '';
    const carte = el('div', { class: 'salon-carte' });
    carte.append(el('h1', { class: 'salon-titre' }, 'Salon'));

    // Rejoindre
    const rejoindre = el('div', { class: 'salon-rejoindre' });
    rejoindre.append(el('div', { class: 'salon-code' }, this.code || '·····'));
    const qr = el('div', { class: 'salon-qr' });
    qr.innerHTML = this.qrSvg || '<div class="hud-qr-vide">adresse de la manette à renseigner dans le banc (C)</div>';
    rejoindre.append(qr);
    rejoindre.append(el('p', { class: 'aide' }, 'Les téléphones qui se connectent apparaissent ici. Chaque téléphone peut porter plusieurs joueurs (téléphone partagé).'));
    carte.append(rejoindre);

    // Joueurs
    const joueurs = el('div', { class: 'salon-joueurs' });
    joueurs.append(el('h2', {}, 'Joueurs ' + (m.joueurs.length ? '(' + m.joueurs.length + ')' : '')));
    if (!m.joueurs.length) joueurs.append(el('p', { class: 'aide' }, 'Aucun joueur : connecte un téléphone, ou ajoute un joueur clavier ou un bot.'));
    m.joueurs.forEach((j, i) => {
      const ligne = el('div', { class: 'salon-joueur' + (j.connecte === false ? ' ko' : '') });
      const point = el('span', { class: 'point' });
      point.style.background = couleurHex(j.couleur);
      ligne.append(el('span', { class: 'ordre' }, String(i + 1)), point);
      const nom = el('input', { type: 'text', value: j.nom, maxlength: '16', class: 'nom', onchange: (e) => { m.modifierJoueur(j.id, { nom: e.target.value }); this.rendre(); } });
      ligne.append(nom);
      const type = { telephone: 'téléphone', partage: 'téléphone partagé', clavier: 'clavier', bot: 'bot' }[j.type];
      let detail = type;
      if (j.type === 'partage' || j.type === 'telephone') { const hote = this.salle.liste.find((x) => x.jeton === j.jeton); detail = type + (hote ? ' · ' + hote.nom : '') + (j.connecte === false ? ' · déconnecté' : ''); }
      ligne.append(el('span', { class: 'type' }, detail));
      if (j.type === 'bot') {
        const sel = el('select', { onchange: (e) => { m.modifierJoueur(j.id, { niveau: e.target.value, nom: 'Bot ' + NIVEAUX_BOT[e.target.value] }); this.rendre(); } });
        for (const [k, v] of Object.entries(NIVEAUX_BOT)) sel.append(el('option', { value: k, ...(j.niveau === k ? { selected: '' } : {}) }, v));
        ligne.append(sel);
      }
      const couleur = el('select', { class: 'couleur', onchange: (e) => { m.modifierJoueur(j.id, { couleur: e.target.value }); this.rendre(); } });
      for (const c of COULEURS) couleur.append(el('option', { value: c, ...(j.couleur === c ? { selected: '' } : {}) }, c));
      ligne.append(couleur);
      ligne.append(
        el('button', { class: 'secondaire petit', type: 'button', title: 'Monter', disabled: i === 0 ? '' : null, onclick: () => { m.deplacerJoueur(j.id, -1); this.rendre(); } }, '▲'),
        el('button', { class: 'secondaire petit', type: 'button', title: 'Descendre', disabled: i === m.joueurs.length - 1 ? '' : null, onclick: () => { m.deplacerJoueur(j.id, 1); this.rendre(); } }, '▼'),
        el('button', { class: 'secondaire petit', type: 'button', title: 'Retirer', onclick: () => { m.retirerJoueur(j.id); this.rendre(); } }, '✕'),
      );
      joueurs.append(ligne);
    });
    const ajouts = el('div', { class: 'salon-ajouts' });
    ajouts.append(el('button', { class: 'secondaire', type: 'button', onclick: () => { m.ajouterJoueur({ type: 'clavier', nom: this._nomLibre('Clavier') }); this.rendre(); } }, '+ Joueur clavier'));
    const niveau = el('select', {});
    for (const [k, v] of Object.entries(NIVEAUX_BOT)) niveau.append(el('option', { value: k, ...(k === (this.lire('niveauBotDefaut') || 'confirme') ? { selected: '' } : {}) }, v));
    ajouts.append(el('button', { class: 'secondaire', type: 'button', onclick: () => { m.ajouterJoueur({ type: 'bot', niveau: niveau.value }); this.rendre(); } }, '+ Bot'), niveau);
    for (const t of this.salle.liste) {
      ajouts.append(el('button', { class: 'secondaire', type: 'button', onclick: () => { const nom = prompt('Prénom du joueur qui partagera le téléphone de ' + t.nom + ' :', ''); if (nom && nom.trim()) { m.ajouterJoueur({ type: 'partage', jeton: t.jeton, nom: nom.trim(), main: t.main }); this.rendre(); } } }, '+ Joueur sur le téléphone de ' + t.nom));
    }
    joueurs.append(ajouts);
    carte.append(joueurs);

    // Options
    const options = el('div', { class: 'salon-options' });
    options.append(el('h2', {}, 'Options'));
    const frames = el('select', { onchange: (e) => { this.regler('nbFrames', Number(e.target.value)); m.reglerOptions({ nbFrames: Number(e.target.value) }); } });
    for (const n of [10, 5]) frames.append(el('option', { value: String(n), ...(m.options.nbFrames === n ? { selected: '' } : {}) }, n + ' frames'));
    options.append(el('label', { class: 'salon-option' }, frames));
    const opt = (id, libelle) => el('label', { class: 'salon-option' }, el('input', { type: 'checkbox', ...(this.lire(id) ? { checked: '' } : {}), onchange: (e) => this.regler(id, e.target.checked) }), ' ' + libelle);
    options.append(opt('gouttieresFermees', 'Gouttières fermées (bumpers)'), opt('gagLob', 'Gag : boule lobée'), opt('gagArriere', 'Gag : boule en arrière'), opt('clavierPourTous', 'Le clavier peut lancer pour tout le monde (test solo)'));
    carte.append(options);

    // Actions
    const actions = el('div', { class: 'salon-actions' });
    const sauv = this.sauvegarde ? this.sauvegarde() : null;
    if (sauv) {
      actions.append(el('button', { class: 'principal', type: 'button', onclick: () => this.reprendre() }, 'Reprendre la partie sauvegardée — ' + sauv.resume));
      actions.append(el('button', { class: 'secondaire', type: 'button', onclick: () => { this.effacerSauvegarde(); this.rendre(); } }, 'Oublier'));
    }
    actions.append(el('button', { class: 'principal', type: 'button', disabled: m.joueurs.length ? null : '', onclick: () => this.commencer() }, 'Commencer' + (m.joueurs.length ? ' (' + m.joueurs.length + ' joueur' + (m.joueurs.length > 1 ? 's' : '') + ')' : '')));
    actions.append(el('p', { class: 'aide' }, 'Le premier téléphone connecté peut aussi commencer en touchant sa zone. Échap : réglages · C : banc de calibrage.'));
    carte.append(actions);
    r.append(carte);
  }

  _nomLibre(base) {
    const m = this.match();
    const noms = new Set(m.joueurs.map((j) => j.nom));
    if (!noms.has(base)) return base;
    for (let i = 2; i < 20; i++) if (!noms.has(base + ' ' + i)) return base + ' ' + i;
    return base;
  }
}
