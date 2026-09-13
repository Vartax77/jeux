// Personnages originaux (cahier des charges §4.3) : joueur construit en primitives (aucun modèle externe, aucun asset
// Nintendo), coiffure, teint, couleur du joueur, visage photo optionnel (lot 5). Animations procédurales :
// repos, balancier (pouce posé), lancer, réactions (joie, déception, haussement d'épaules). Spectateurs instanciés.

import * as THREE from 'three';
import { DIM } from './physique.js';

import { COIFFURES, TEINTS } from './apparence.js';
export { COIFFURES, TEINTS };
const CHEVEUX = ['#2b1a0e', '#5a3a1e', '#c98a3a', '#e6d27a', '#1a1a1a', '#8b3a2e'];

function mat(couleur, extra = {}) { return new THREE.MeshStandardMaterial({ color: couleur, roughness: 0.75, ...extra }); }

export class Personnage {
  constructor() {
    this.groupe = new THREE.Group();
    this.etat = 'repos';
    this.chrono = 0;
    this.balancier = 0;
    this.arme = false;
    this.main = 'droite';
    this.x = 0;
    this._construire({ couleur: '#2f6fe4', coiffure: 'court', teint: 'medium', main: 'droite' });
  }

  _construire(profil) {
    const g = this.groupe;
    while (g.children.length) g.remove(g.children[0]);
    const teint = TEINTS[profil.teint] || TEINTS.medium;
    const chemise = profil.couleur || '#2f6fe4';
    const matPeau = mat(teint), matChemise = mat(chemise), matPantalon = mat('#2c3140'), matChaussure = mat('#1c1c22');
    const ombre = (m) => { m.castShadow = true; return m; };
    // Jambes
    for (const s of [-1, 1]) {
      const j = ombre(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.055, 0.42, 12), matPantalon));
      j.position.set(s * 0.09, 0.21, 0);
      g.add(j);
      const c = ombre(new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.06, 0.2), matChaussure));
      c.position.set(s * 0.09, 0.03, 0.03);
      g.add(c);
    }
    // Tronc
    const tronc = ombre(new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.17, 0.42, 16), matChemise));
    tronc.position.y = 0.63;
    g.add(tronc);
    const epaules = ombre(new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), matChemise));
    epaules.position.y = 0.84;
    g.add(epaules);
    // Bras (pivot à l'épaule) : bras gauche et droit ; le bras lanceur dépend de la main
    this.bras = {};
    for (const [cote, s] of [['gauche', -1], ['droite', 1]]) {
      const pivot = new THREE.Group();
      pivot.position.set(s * 0.19, 0.84, 0);
      const b = ombre(new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.36, 12), matChemise));
      b.position.y = -0.18;
      pivot.add(b);
      const m = ombre(new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 10), matPeau));
      m.position.y = -0.38;
      pivot.add(m);
      pivot.rotation.z = s * 0.15;
      g.add(pivot);
      this.bras[cote] = pivot;
    }
    // Tête
    const tete = new THREE.Group();
    tete.position.y = 1.02;
    const crane = ombre(new THREE.Mesh(new THREE.SphereGeometry(0.16, 20, 16), matPeau));
    tete.add(crane);
    const yeux = [];
    for (const s of [-1, 1]) {
      const oeil = new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 8), mat('#111'));
      oeil.position.set(s * 0.055, 0.03, 0.14);
      tete.add(oeil);
      yeux.push(oeil);
    }
    const bouche = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.008, 6, 12, Math.PI), mat('#7a2a2a'));
    bouche.position.set(0, -0.05, 0.145);
    bouche.rotation.x = Math.PI; bouche.rotation.z = Math.PI;
    tete.add(bouche);
    this.bouche = bouche;
    // Visage photo (disque) : remplace yeux/bouche s'il est fourni
    if (profil.textureVisage) {
      const visage = new THREE.Mesh(new THREE.CircleGeometry(0.13, 32), new THREE.MeshStandardMaterial({ map: profil.textureVisage, roughness: 0.9 }));
      visage.position.set(0, 0, 0.152);
      tete.add(visage);
      for (const o of yeux) o.visible = false;
      bouche.visible = false;
    }
    // Coiffure
    const couleurCheveux = profil.couleurCheveux || CHEVEUX[Math.abs(hachage(profil.nom || chemise)) % CHEVEUX.length];
    const matCheveux = mat(couleurCheveux);
    switch (profil.coiffure || 'court') {
      case 'long': {
        const cap = new THREE.Mesh(new THREE.SphereGeometry(0.168, 20, 16, 0, Math.PI * 2, 0, Math.PI * 0.55), matCheveux);
        tete.add(cap);
        const arriere = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.12, 0.3, 16, 1, false, Math.PI * 0.9, Math.PI * 1.2), matCheveux);
        arriere.position.set(0, -0.12, -0.04);
        tete.add(arriere);
        break;
      }
      case 'chignon': {
        tete.add(new THREE.Mesh(new THREE.SphereGeometry(0.168, 20, 16, 0, Math.PI * 2, 0, Math.PI * 0.5), matCheveux));
        const ch = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 10), matCheveux);
        ch.position.set(0, 0.12, -0.12);
        tete.add(ch);
        break;
      }
      case 'casquette': {
        const cal = new THREE.Mesh(new THREE.SphereGeometry(0.17, 20, 16, 0, Math.PI * 2, 0, Math.PI * 0.45), mat(chemise));
        tete.add(cal);
        const visiere = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.02, 0.12), mat(chemise));
        visiere.position.set(0, 0.06, 0.2);
        tete.add(visiere);
        break;
      }
      case 'chauve':
        break;
      default:
        tete.add(new THREE.Mesh(new THREE.SphereGeometry(0.168, 20, 16, 0, Math.PI * 2, 0, Math.PI * 0.5), matCheveux));
    }
    g.add(tete);
    this.tete = tete;
    this.main = profil.main === 'gauche' ? 'gauche' : 'droite';
    this.groupe.position.set(this.x, 0, 1.15);
  }

  appliquerProfil(profil) { this._construire(profil); }

  // Position latérale (mètres) : suit la visée.
  placer(x) { this.x = x; }

  // Pouce posé : balancier visible.
  armer(actif) { this.arme = actif; if (actif && this.etat === 'repos') this.etat = 'balancier'; if (!actif && this.etat === 'balancier') this.etat = 'repos'; }

  lancer() { this.etat = 'lancer'; this.chrono = 0; this.arme = false; }

  // type : 'joie' (strike/spare), 'deception' (gouttière, zéro), 'hausse' (autre)
  reagir(type) { this.etat = type; this.chrono = 0; }

  repos() { this.etat = 'repos'; this.chrono = 0; }

  animer(dt, tempsGlobal) {
    this.chrono += dt;
    const g = this.groupe;
    const lanceur = this.bras[this.main], autre = this.bras[this.main === 'droite' ? 'gauche' : 'droite'];
    const s = this.main === 'droite' ? 1 : -1;
    const cibleX = this.x;
    g.position.x += (cibleX - g.position.x) * Math.min(1, dt * 8);
    let zCorps = 1.15, yCorps = 0, incl = 0, rotLanceur = 0, rotAutre = 0, tourne = 0;
    switch (this.etat) {
      case 'balancier': {
        const w = Math.sin(tempsGlobal * 2.2);
        rotLanceur = -0.9 + w * 0.5;           // bras qui balance derrière
        rotAutre = 0.2;
        incl = 0.08;
        zCorps = 1.15 + Math.sin(tempsGlobal * 2.2) * 0.03;
        break;
      }
      case 'lancer': {
        const t = Math.min(1, this.chrono / 0.7);
        const e = t * t * (3 - 2 * t);
        rotLanceur = -1.4 + e * 2.4;          // de derrière à devant
        rotAutre = 0.3 - e * 0.4;
        zCorps = 1.15 - e * 0.45;             // pas en avant
        incl = 0.25 * Math.sin(t * Math.PI);
        if (this.chrono > 1.1) { this.etat = 'repos'; this.chrono = 0; }
        break;
      }
      case 'joie': {
        const t = this.chrono;
        yCorps = Math.abs(Math.sin(t * 7)) * 0.18 * (t < 1.6 ? 1 : 0);
        rotLanceur = 2.6 + Math.sin(t * 9) * 0.3; rotAutre = 2.6 + Math.cos(t * 9) * 0.3;
        tourne = Math.sin(t * 4) * 0.3;
        if (t > 2.2) this.repos();
        break;
      }
      case 'deception': {
        const t = this.chrono;
        incl = 0.35;
        rotLanceur = 0.1; rotAutre = 0.1;
        tourne = Math.sin(t * 3) * 0.15;
        if (t > 2.2) this.repos();
        break;
      }
      case 'hausse': {
        const t = this.chrono;
        rotLanceur = 0.9 * Math.sin(Math.min(t * 3, Math.PI)); rotAutre = rotLanceur;
        if (t > 1.6) this.repos();
        break;
      }
      default: {
        // Respiration
        yCorps = Math.sin(tempsGlobal * 1.6) * 0.008;
        rotLanceur = Math.sin(tempsGlobal * 1.6) * 0.04; rotAutre = -rotLanceur;
      }
    }
    lanceur.rotation.x = rotLanceur;
    autre.rotation.x = rotAutre;
    lanceur.rotation.z = s * 0.15; autre.rotation.z = -s * 0.15;
    g.position.z += (zCorps - g.position.z) * Math.min(1, dt * 10);
    g.position.y = yCorps;
    g.rotation.x = incl;
    g.rotation.y = tourne;
    if (this.bouche) this.bouche.rotation.z = this.etat === 'deception' ? 0 : Math.PI; // sourire / moue
  }

  // Position mondiale de la main lanceuse (pour y poser la boule pendant la préparation).
  positionMain(cible) {
    const lanceur = this.bras[this.main];
    const m = lanceur.children[1];
    return m.getWorldPosition(cible || new THREE.Vector3());
  }
}

function hachage(s) { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) | 0; return h; }

// ---------- Spectateurs ----------

export class Spectateurs {
  constructor(nb = 36) {
    this.groupe = new THREE.Group();
    this.nb = nb;
    this.corps = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.16, 0.19, 0.5, 10), new THREE.MeshStandardMaterial({ roughness: 0.8 }), nb);
    this.tetes = new THREE.InstancedMesh(new THREE.SphereGeometry(0.13, 12, 10), new THREE.MeshStandardMaterial({ roughness: 0.8 }), nb);
    this.corps.castShadow = false; this.tetes.castShadow = false;
    this.bases = [];
    const teintes = Object.values(TEINTS);
    const couleurs = ['#e0453a', '#2f6fe4', '#f28c28', '#2ca05a', '#8e44ad', '#f2c94c', '#38bdf8', '#e879a3'];
    const c = new THREE.Color();
    for (let i = 0; i < nb; i++) {
      const rang = Math.floor(i / 12), col = i % 12;
      const x = (col - 5.5) * 0.85 + (rang % 2) * 0.4, z = 6.4 + rang * 1.0, y = 0.35 + rang * 0.45;
      this.bases.push({ x, y, z, phase: Math.random() * Math.PI * 2, vitesse: 0.8 + Math.random() * 0.6 });
      this.corps.setColorAt(i, c.set(couleurs[i % couleurs.length]));
      this.tetes.setColorAt(i, c.set(teintes[i % teintes.length]));
    }
    // Gradins
    const matGradin = new THREE.MeshStandardMaterial({ color: '#3a3f52', roughness: 0.9 });
    for (let r = 0; r < 3; r++) {
      const marche = new THREE.Mesh(new THREE.BoxGeometry(11, 0.45 * (r + 1), 1.0), matGradin);
      marche.position.set(0, 0.225 * (r + 1), 6.4 + r * 1.0);
      marche.receiveShadow = true;
      this.groupe.add(marche);
    }
    this.groupe.add(this.corps, this.tetes);
    this.reaction = null;
    this.chrono = 0;
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._p = new THREE.Vector3(); this._s = new THREE.Vector3(1, 1, 1);
    this.animer(0, 0);
  }

  // type : 'acclamation' | 'ovation' | 'oh' | 'rire'
  reagir(type) { this.reaction = type; this.chrono = 0; }

  animer(dt, t) {
    this.chrono += dt;
    const r = this.reaction;
    const intensite = r ? Math.max(0, 1 - this.chrono / (r === 'ovation' ? 3 : 2)) : 0;
    if (r && intensite === 0) this.reaction = null;
    for (let i = 0; i < this.nb; i++) {
      const b = this.bases[i];
      let saut = Math.sin(t * b.vitesse + b.phase) * 0.01, incl = 0, secousse = 0;
      if (r === 'acclamation' || r === 'ovation') saut += Math.abs(Math.sin(t * (r === 'ovation' ? 9 : 6) + b.phase)) * (r === 'ovation' ? 0.25 : 0.15) * intensite;
      else if (r === 'oh') incl = -0.35 * intensite;
      else if (r === 'rire') secousse = Math.sin(t * 14 + b.phase) * 0.12 * intensite;
      this._q.setFromEuler(new THREE.Euler(incl, 0, secousse));
      this._p.set(b.x, b.y + saut, b.z);
      this._m.compose(this._p, this._q, this._s);
      this.corps.setMatrixAt(i, this._m);
      this._p.set(b.x + Math.sin(secousse) * 0.35, b.y + saut + 0.38 + Math.cos(incl) * 0.0, b.z - Math.sin(incl) * 0.35);
      this._m.compose(this._p, this._q, this._s);
      this.tetes.setMatrixAt(i, this._m);
    }
    this.corps.instanceMatrix.needsUpdate = true;
    this.tetes.instanceMatrix.needsUpdate = true;
  }
}
