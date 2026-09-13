// Banc de calibrage (tiroir « Banc », touche C) : cartes des manettes, graphiques capteurs, dernier lancer,
// journal et export CSV, notes. C'est l'interface du lot 1, déplacée dans un tiroir au-dessus du jeu.

import { couleurHex, MAX_JOUEURS } from '../commun/constantes.js';
import { rendreChampsProfil } from './reglages.js';
import { Graphique } from './graphiques.js';

const $ = (id) => document.getElementById(id);

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

export const fmt = (x, d = 1) => (x == null || !Number.isFinite(x) ? '–' : x.toFixed(d).replace('.', ','));
export const pct = (x) => (x == null ? '–' : Math.round(x * 100) + ' %');

export function telecharger(nom, contenu, type) {
  const blob = new Blob(['\ufeff' + contenu], { type });
  const a = el('a', { href: URL.createObjectURL(blob), download: nom });
  document.body.append(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

export class Banc {
  // deps : { salle, profils, reglages, suivis, reglagesEffectifs(j), envoyerEtat(j, msg), envoyerConfig(j), demarrerCalibration(j) }
  constructor(deps) {
    Object.assign(this, deps);
    this.cartes = new Map();
    this.journal = [];
    this.choisi = null;
    this.ouvert = false;

    this.graphAccel = new Graphique($('graph-accel'), { fenetre: 3000, min: -30, max: 30, series: [
      { nom: 'x', couleur: '#4da3ff', val: (p) => (p.a ? p.a[0] : null) },
      { nom: 'y', couleur: '#ffb84d', val: (p) => (p.a ? p.a[1] : null) },
      { nom: 'z', couleur: '#7ee2a2', val: (p) => (p.a ? p.a[2] : null) },
      { nom: '‖a‖', couleur: '#ffffff', epaisseur: 1.8, val: (p) => p.normeA },
    ] });
    this.graphRot = new Graphique($('graph-rot'), { fenetre: 3000, min: -720, max: 720, series: [
      { nom: 'autour de x (β)', couleur: '#4da3ff', val: (p) => (p.r ? p.r[1] : null) },
      { nom: 'autour de y (γ)', couleur: '#ffb84d', val: (p) => (p.r ? p.r[2] : null) },
      { nom: 'autour de z (α)', couleur: '#7ee2a2', val: (p) => (p.r ? p.r[0] : null) },
    ] });
    this.graphVit = new Graphique($('graph-vit'), { fenetre: 3000, min: -8, max: 8, series: [
      { nom: 'vitesse', couleur: '#ffffff', epaisseur: 1.8, val: (p) => (p.vitesse == null ? null : p.vitesse) },
      { nom: 'verticale', couleur: '#7ee2a2', val: (p) => (p.vVert == null ? null : p.vVert) },
      { nom: 'avant', couleur: '#ffb84d', val: (p) => (p.avant == null ? null : p.avant) },
      { nom: 'torsion (°/10)', couleur: '#c58bff', val: (p) => (p.torsion == null ? null : p.torsion / 10) },
    ] });

    $('btn-vider').addEventListener('click', () => { this.journal.length = 0; $('journal').querySelector('tbody').textContent = ''; });
    $('btn-csv').addEventListener('click', () => this.exporterCSV());
    this.majBadgeManettes();
    this.majTitreGraph();
  }

  basculer(force) {
    const t = $('banc');
    this.ouvert = force == null ? t.classList.contains('cache') : force;
    t.classList.toggle('cache', !this.ouvert);
    $('btn-banc').classList.toggle('actif', this.ouvert);
    return this.ouvert;
  }

  // ---------- Cartes ----------

  creerCarte(j) {
    if (this.cartes.has(j.jeton)) return;
    const carte = el('div', { class: 'carte', 'data-jeton': j.jeton });
    carte.append(
      el('div', { class: 'carte-entete' },
        el('span', { class: 'point' }),
        el('strong', { class: 'nom' }),
        el('span', { class: 'meta' }),
        el('span', { class: 'lien etiquette' })),
      el('div', { class: 'carte-ligne mesures' },
        'Latence ', el('b', { class: 'latence' }, '–'), ' · Reçus ', el('b', { class: 'freq' }, '–'), '/s · Horloge ', el('b', { class: 'offset' }, '–')),
      el('label', { class: 'carte-ligne' }, el('input', { type: 'checkbox', class: 'actif', onchange: (e) => { j.actif = e.target.checked; this.envoyerEtat(j); this.majCarte(j); } }), ' Actif (peut lancer)'),
      el('div', { class: 'carte-ligne resultat' }, 'Dernier lancer : —'),
      el('div', { class: 'carte-ligne calib' },
        el('button', { class: 'secondaire btn-calib', type: 'button', onclick: () => this.demarrerCalibration(j) }, 'Calibrer le sens avant (3 lancers)'),
        el('span', { class: 'calib-etat' }),
        el('button', { class: 'secondaire btn-calib-oubli', type: 'button', onclick: () => { this.profils.setDirection(j.jeton, null); const s = this.suivis.get(j.jeton); if (s) s.calibration = null; this.majCarte(j); } }, 'Oublier')),
      el('div', { class: 'carte-ligne calib-puissance' },
        el('button', { class: 'secondaire btn-calib-puissance', type: 'button', onclick: () => this.demarrerCalibrage(j, 'puissance') }, 'Calibrer la puissance (3 lancers)'),
        el('button', { class: 'secondaire btn-calib-lift', type: 'button', onclick: () => this.demarrerCalibrage(j, 'lift') }, 'Calibrer le lift (2 lancers)'),
        el('button', { class: 'secondaire btn-calib-refaire cache', type: 'button', onclick: () => this.refaireEtapeCalibrage(j) }, 'Refaire ce lancer'),
        el('span', { class: 'calib-puissance-etat' })),
      el('details', { class: 'perso' }, el('summary', {}, 'Réglages personnels'), el('div', { class: 'champs-profil' })),
    );
    carte.querySelector('.actif').checked = !!j.actif;
    carte.addEventListener('click', (e) => {
      if (e.target.closest('input, select, button, summary, details')) return;
      this.choisir(j.jeton);
    });
    this._rendreProfil(carte, j);
    $('cartes').append(carte);
    this.cartes.set(j.jeton, carte);
    $('cartes-vide').classList.add('cache');
    if (!this.choisi) this.choisir(j.jeton);
  }

  _rendreProfil(carte, j) {
    const p = this.profils.get(j.jeton);
    rendreChampsProfil(carte.querySelector('.champs-profil'), p ? p.reglages : {}, this.reglages.valeurs, (id, v) => {
      this.profils.setReglage(j.jeton, id, v);
      this.envoyerConfig(j);
      this.majCarte(j);
    });
  }

  majCarte(j) {
    const c = this.cartes.get(j.jeton);
    if (!c) return;
    const s = this.suivis.get(j.jeton);
    const p = this.profils.get(j.jeton);
    c.style.borderLeftColor = couleurHex(j.couleur);
    c.querySelector('.point').style.background = couleurHex(j.couleur);
    c.querySelector('.nom').textContent = j.nom;
    const eff = this.reglagesEffectifs(j);
    c.querySelector('.meta').textContent = (j.plateforme === 'ios' ? 'iOS' : (j.plateforme || '?')) + ' · ' + (eff.main === 'gauche' ? 'gaucher' : 'droitier') + ' · ' + eff.modeLancer;
    const lien = c.querySelector('.lien');
    lien.textContent = j.connecte ? 'connectée' : 'reconnexion…';
    lien.className = 'lien etiquette ' + (j.connecte ? 'ok' : 'ko');
    c.classList.toggle('perdue', !j.connecte);
    c.classList.toggle('choisie', this.choisi === j.jeton);
    c.classList.toggle('inactive', !j.actif);
    if (s) {
      const r = s.dernierResultat;
      c.querySelector('.resultat').textContent = r ? 'Dernier lancer : ' + this.resumeResultat(r) : 'Dernier lancer : —';
      const cp = c.querySelector('.calib-puissance-etat');
      const eff = this.reglagesEffectifs(j);
      const etapes = s.calib ? this.ETAPES_CALIB[s.calib.type] : null;
      c.querySelector('.btn-calib-refaire').classList.toggle('cache', !(s.calib && s.calib.index > 0));
      c.querySelector('.btn-calib-puissance').textContent = s.calib && s.calib.type === 'puissance' ? 'Annuler le calibrage' : 'Calibrer la puissance (3 lancers)';
      c.querySelector('.btn-calib-lift').textContent = s.calib && s.calib.type === 'lift' ? 'Annuler le calibrage' : 'Calibrer le lift (2 lancers)';
      if (s.calib && etapes && etapes[s.calib.index]) cp.textContent = (s.calib.index + 1) + '/' + etapes.length + ' — ' + etapes[s.calib.index].consigne + ' (' + etapes[s.calib.index].aide + ')';
      else {
        const perso = p && p.reglages ? p.reglages : {};
        const puiss = perso.aMax ? 'puissance ' + eff.aMin + '→' + eff.aMax + ' m/s², courbe ' + Number(eff.courbePuissance || 1).toFixed(2).replace('.', ',') : 'puissance par défaut (' + eff.aMin + '→' + eff.aMax + ')';
        const lift = perso.effetAnglePlein ? 'lift ' + eff.effetZoneMorte + '→' + eff.effetAnglePlein + '°' : 'lift par défaut (' + eff.effetZoneMorte + '→' + eff.effetAnglePlein + '°)';
        cp.textContent = puiss + ' · ' + lift;
      }
      const calib = c.querySelector('.calib-etat');
      if (s.calibration) calib.textContent = 'en cours : ' + s.calibration.vecteurs.length + '/3 lancers';
      else if (p && p.directionAvant) calib.textContent = 'sens avant calibré ✓';
      else calib.textContent = 'non calibré (gag « arrière » inactif)';
    }
    this.majLatence(j);
  }

  majLatence(j) {
    const c = this.cartes.get(j.jeton);
    if (!c) return;
    c.querySelector('.latence').textContent = j.latence == null ? '–' : Math.round(j.latence) + ' ms';
    c.querySelector('.freq').textContent = String(j.freq);
    c.querySelector('.offset').textContent = j.offsets.length ? (j.offset >= 0 ? '+' : '') + Math.round(j.offset) + ' ms' : '–';
  }

  retirerCarte(j) {
    const c = this.cartes.get(j.jeton);
    if (c) c.remove();
    this.cartes.delete(j.jeton);
    if (this.choisi === j.jeton) { this.choisi = null; const premier = this.salle.liste[0]; if (premier) this.choisir(premier.jeton); else this.majTitreGraph(); }
    if (!this.cartes.size) $('cartes-vide').classList.remove('cache');
    this.majBadgeManettes();
  }

  redessinerProfils() {
    for (const j of this.salle.liste) { const c = this.cartes.get(j.jeton); if (c) this._rendreProfil(c, j); this.majCarte(j); }
  }

  majBadgeManettes() {
    const n = this.salle.liste.length;
    const actives = this.salle.liste.filter((j) => j.connecte).length;
    $('badge-manettes').textContent = n + ' manette' + (n > 1 ? 's' : '') + (n ? ' (' + actives + ' en ligne, ' + MAX_JOUEURS + ' max)' : '');
  }

  resumeResultat(r) {
    if (r.type === 'refuse') return 'refusé (' + (r.raison === 'pasTonTour' ? 'pas son tour' : r.raison) + ')';
    if (r.type === 'annule') return 'annulé (' + (r.raison === 'tropCourt' ? 'trop court' : 'trop faible') + ') · pic ' + fmt(r.picA) + ' m/s² · ' + Math.round(r.duree) + ' ms';
    return 'puissance ' + pct(r.puissance) + ' · effet ' + fmt(r.effet, 2) + ' · ' + r.phase + ' · pic ' + fmt(r.picA) + ' m/s² · torsion ' + fmt(r.torsion, 0) + '° · ' + Math.round(r.duree) + ' ms';
  }

  // ---------- Dernier lancer ----------

  afficherDernier(j, r) {
    const d = $('dernier');
    d.textContent = '';
    const grand = (val, lib) => el('div', { class: 'grand' }, el('div', { class: 'val' }, val), el('div', { class: 'lib' }, lib));
    if (r.type !== 'lancer') {
      d.append(el('div', { class: 'ligne-grands' }, grand(r.type === 'refuse' ? 'REFUSÉ' : 'ANNULÉ', j.nom + ' · ' + (r.raison === 'tropCourt' ? 'geste trop court' : r.raison === 'tropFaible' ? 'geste trop faible' : 'pas son tour'))));
      if (r.type === 'annule') { const eff = this.reglagesEffectifs(j); d.append(el('div', { class: 'aide' }, 'Pic ' + fmt(r.picA) + ' m/s² (minimum ' + fmt(eff.aMin) + ') · maintien ' + Math.round(r.duree) + ' ms (minimum ' + eff.dureeMin + ')')); }
      return;
    }
    d.append(el('div', { class: 'ligne-grands' },
      grand(pct(r.puissance), 'puissance'),
      grand(fmt(r.effet, 2), 'effet (− gauche / + droite)'),
      grand(r.phase, 'phase'),
      grand(j.nom, r.mode)));
    d.append(el('div', { class: 'aide' },
      'Pic ' + fmt(r.picA) + ' m/s² · vitesse ' + fmt(r.vitesse, 2) + ' m/s · verticale ' + fmt(r.vVert, 2) + ' m/s · avant ' + (r.avant == null ? 'non calibré' : fmt(r.avant, 2) + ' m/s') +
      ' · torsion ' + fmt(r.torsion, 0) + '° · maintien ' + Math.round(r.duree) + ' ms · instant retenu ' + Math.round(r.instant - r.tLeve) + ' ms après le relâcher · ' + r.nbEchantillons + ' échantillons' +
      (r.orientationConnue ? '' : ' · orientation inconnue (vitesse verticale approchée)')));
  }

  // ---------- Journal ----------

  journaliser(j, r) {
    const entree = { heure: new Date(), jeton: j.jeton, nom: j.nom, ...r };
    this.journal.unshift(entree);
    if (this.journal.length > 200) this.journal.pop();
    const tbody = $('journal').querySelector('tbody');
    const tr = el('tr', {},
      el('td', { text: entree.heure.toLocaleTimeString('fr-FR') }),
      el('td', { text: j.nom }),
      el('td', { text: r.mode || '' }),
      el('td', { text: r.type === 'lancer' ? 'lancer' : r.type === 'annule' ? 'annulé' : 'refusé', class: 'res-' + r.type }),
      el('td', { text: r.type === 'lancer' ? pct(r.puissance) : '' }),
      el('td', { text: r.type === 'lancer' ? fmt(r.effet, 2) : '' }),
      el('td', { text: r.type === 'lancer' ? r.phase : (r.raison || '') }),
      el('td', { text: r.type === 'refuse' ? '' : fmt(r.picA) }),
      el('td', { text: r.type === 'refuse' ? '' : fmt(r.vitesse, 2) }),
      el('td', { text: r.type === 'refuse' ? '' : fmt(r.vVert, 2) }),
      el('td', { text: r.avant == null ? '' : fmt(r.avant, 2) }),
      el('td', { text: r.type === 'refuse' ? '' : fmt(r.torsion, 0) }),
      el('td', { text: r.duree == null ? '' : String(Math.round(r.duree)) }),
      el('td', { text: r.latence == null ? '' : Math.round(r.latence) + '' }),
      el('td', { text: r.quilles == null ? '' : String(r.quilles) }),
    );
    tbody.prepend(tr);
    while (tbody.children.length > 200) tbody.lastChild.remove();
  }

  // Complète la dernière ligne du journal d'un lancer avec le nombre de quilles tombées.
  completerQuilles(jeton, quilles) {
    const e = this.journal.find((x) => x.jeton === jeton && x.type === 'lancer' && x.quilles == null);
    if (!e) return;
    e.quilles = quilles;
    const tbody = $('journal').querySelector('tbody');
    const idx = this.journal.indexOf(e);
    const tr = tbody.children[idx];
    if (tr && tr.lastElementChild) tr.lastElementChild.textContent = String(quilles);
  }

  exporterCSV() {
    const lignes = [['heure', 'joueur', 'mode', 'resultat', 'raison', 'puissance', 'effet', 'phase', 'picA_mps2', 'vitesse_mps', 'vVert_mps', 'avant_mps', 'torsion_deg', 'duree_ms', 'instant_apres_leve_ms', 'echantillons', 'latence_ms', 'quilles']];
    for (const e of [...this.journal].reverse()) {
      lignes.push([e.heure.toISOString(), e.nom, e.mode || '', e.type, e.raison || '', e.puissance == null ? '' : e.puissance.toFixed(3), e.effet == null ? '' : e.effet.toFixed(3), e.phase || '',
        e.picA == null ? '' : e.picA.toFixed(2), e.vitesse == null ? '' : e.vitesse.toFixed(3), e.vVert == null ? '' : e.vVert.toFixed(3), e.avant == null ? '' : e.avant.toFixed(3),
        e.torsion == null ? '' : e.torsion.toFixed(1), e.duree == null ? '' : Math.round(e.duree), (e.instant != null && e.tLeve != null) ? Math.round(e.instant - e.tLeve) : '', e.nbEchantillons ?? '', e.latence == null ? '' : Math.round(e.latence), e.quilles ?? '']);
    }
    const csv = lignes.map((l) => l.map((v) => '"' + String(v).replace(/"/g, '""') + '"').join(';')).join('\n');
    telecharger('bowling-journal-' + new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-') + '.csv', csv, 'text/csv;charset=utf-8');
  }

  // ---------- Graphiques ----------

  choisir(jeton) {
    this.choisi = jeton;
    for (const j of this.salle.liste) this.majCarte(j);
    this.majTitreGraph();
  }

  majTitreGraph() {
    const j = this.choisi ? this.salle.joueurs.get(this.choisi) : null;
    $('graph-joueur').textContent = j ? j.nom : 'aucune manette';
  }

  // À appeler à chaque image seulement quand le tiroir est ouvert.
  dessinerGraphiques() {
    const s = this.choisi ? this.suivis.get(this.choisi) : null;
    if (s && s.historique.length) {
      const tFin = s.historique[s.historique.length - 1].t;
      this.graphAccel.dessiner(s.historique, s.marqueurs, tFin);
      this.graphRot.dessiner(s.historique, s.marqueurs, tFin);
      this.graphVit.dessiner(s.historique, s.marqueurs, tFin);
    } else {
      this.graphAccel.dessiner([], [], 0);
      this.graphRot.dessiner([], [], 0);
      this.graphVit.dessiner([], [], 0);
    }
  }

  // ---------- Notes ----------

  noter(texte) {
    const n = $('notes');
    const ligne = el('div', { text: new Date().toLocaleTimeString('fr-FR') + ' — ' + texte });
    n.prepend(ligne);
    while (n.children.length > 30) n.lastChild.remove();
  }
}
