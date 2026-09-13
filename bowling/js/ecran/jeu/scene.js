// Scène 3D (Three.js) : salle, piste, gouttières, quilles, boule, pinsetter, guide de visée.
// Style : cartoon lumineux, formes simples, textures dessinées sur canvas (aucun fichier externe).
// Repère identique à la physique : y vers le haut, la piste vers −z, +x = droite du joueur.

import * as THREE from 'three';
import { RoomEnvironment } from '../../../lib/three/RoomEnvironment.js';
import { DIM, positionsQuilles } from './physique.js';

const PAS_PISTES = 2.35; // entraxe des pistes voisines (décor) : assez large pour ne pas former un couloir

export function creerRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  return renderer;
}

// ---------- Textures dessinées ----------

function textureBoisPiste(longueurTotale) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 2048;
  const g = c.getContext('2d');
  const teintes = ['#d8b47c', '#d0aa72', '#dcba86', '#cba46c', '#d4ae76'];
  const nbPlanches = 39;
  const l = c.width / nbPlanches;
  for (let i = 0; i < nbPlanches; i++) {
    g.fillStyle = teintes[(i * 7) % teintes.length];
    g.fillRect(Math.floor(i * l), 0, Math.ceil(l) + 1, c.height);
    g.fillStyle = 'rgba(90,60,30,0.18)';
    g.fillRect(Math.floor(i * l), 0, 1, c.height);
  }
  // Fibres légères
  g.fillStyle = 'rgba(120,80,40,0.08)';
  for (let k = 0; k < 500; k++) { const x = Math.random() * c.width, y = Math.random() * c.height; g.fillRect(x, y, 1, 30 + Math.random() * 120); }
  // v (hauteur du canvas) : 0 = ligne de faute (bas de l'image), 1 = fond du deck → on dessine à l'envers
  const yDe = (metres) => c.height - (metres / longueurTotale) * c.height;
  // Ligne de faute
  g.fillStyle = '#2b2b2b';
  g.fillRect(0, yDe(0.03), c.width, yDe(0) - yDe(0.03));
  // Points de repère (2,1 m) et flèches (4,6 m), motifs classiques
  g.fillStyle = '#5a3d1e';
  for (let i = 0; i < 7; i++) {
    const x = ((i + 1) / 8) * c.width;
    g.beginPath(); g.arc(x, yDe(2.1), 5, 0, Math.PI * 2); g.fill();
    const y = yDe(4.57 + Math.abs(i - 3) * 0.12);
    g.beginPath(); g.moveTo(x, y - 40); g.lineTo(x - 9, y); g.lineTo(x + 9, y); g.closePath(); g.fill();
  }
  // Deck des quilles plus sombre
  g.fillStyle = 'rgba(60,40,20,0.22)';
  g.fillRect(0, 0, c.width, yDe(DIM.longueurPiste - 0.6));
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function textureQuille() {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#f7f4ee';
  g.fillRect(0, 0, c.width, c.height);
  // v = hauteur relative (0 = base, 1 = sommet) ; deux bandes rouges au cou (0,62–0,66 et 0,70–0,74)
  g.fillStyle = '#d7263d';
  for (const [v0, v1] of [[0.62, 0.66], [0.70, 0.74]]) g.fillRect(0, c.height * (1 - v1), c.width, c.height * (v1 - v0));
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function textureTexte(texte, { largeur = 1024, hauteur = 256, fond = '#1f3b8f', couleur = '#fff3b0', taille = 150 } = {}) {
  const c = document.createElement('canvas');
  c.width = largeur; c.height = hauteur;
  const g = c.getContext('2d');
  g.fillStyle = fond;
  g.fillRect(0, 0, largeur, hauteur);
  g.fillStyle = couleur;
  g.font = 'bold ' + taille + 'px "Trebuchet MS", "Segoe UI", system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(texte, largeur / 2, hauteur / 2 + 6);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Silhouette d'une quille : rayon en fonction de la hauteur (m), interpolée entre points clés.
function rayonQuille(y) {
  const cles = [[0, 0.026], [0.02, 0.048], [0.06, 0.058], [0.11, 0.06], [0.16, 0.054], [0.20, 0.042], [0.245, 0.033], [0.27, 0.031], [0.30, 0.034], [0.335, 0.036], [0.36, 0.030], [0.381, 0.004]];
  for (let i = 0; i < cles.length - 1; i++) {
    const [y0, r0] = cles[i], [y1, r1] = cles[i + 1];
    if (y >= y0 && y <= y1) {
      const t = (y - y0) / (y1 - y0);
      const s = t * t * (3 - 2 * t); // lissage
      return r0 + (r1 - r0) * s;
    }
  }
  return 0.004;
}

function geometrieQuille() {
  const pts = [];
  const n = 40;
  for (let i = 0; i <= n; i++) {
    const y = (i / n) * DIM.hauteurQuille;
    pts.push(new THREE.Vector2(rayonQuille(y), y - DIM.centreGraviteQuille));
  }
  return new THREE.LatheGeometry(pts, 36);
}

// ---------- Scène ----------

export class Scene3D {
  constructor(renderer, lire, { rangs = 4 } = {}) {
    this.renderer = renderer;
    this.rangs = rangs;
    this.lire = (id, defaut) => { const v = lire ? lire(id) : undefined; return v === undefined || v === null ? defaut : v; };
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#1a1d27');
    this.camera = new THREE.PerspectiveCamera(this.lire('champVision', 50), 16 / 9, 0.05, 120);

    try {
      const pmrem = new THREE.PMREMGenerator(renderer);
      this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      pmrem.dispose();
    } catch (e) {
      console.warn('Environnement de reflets indisponible :', e);
    }

    this._lumieres();
    this._salle();
    this._piste();
    this._quilles();
    this._boule();
    this._pinsetter();
    this._guide();
    this.majQualite();
  }

  // ---------- Construction ----------

  _lumieres() {
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x7a6552, 0.55));
    const soleil = new THREE.DirectionalLight(0xffffff, 1.7);
    soleil.position.set(3, 9, -5);
    soleil.target.position.set(0, 0, -10);
    soleil.castShadow = true;
    soleil.shadow.mapSize.set(2048, 2048);
    soleil.shadow.camera.near = 1;
    soleil.shadow.camera.far = 40;
    soleil.shadow.camera.left = -3;
    soleil.shadow.camera.right = 3;
    soleil.shadow.camera.top = 14;
    soleil.shadow.camera.bottom = -14;
    soleil.shadow.bias = -0.0005;
    soleil.shadow.normalBias = 0.02;
    this.scene.add(soleil, soleil.target);
    this.soleil = soleil;
    const appoint = new THREE.DirectionalLight(0xdfe8ff, 0.4);
    appoint.position.set(-4, 6, 4);
    this.scene.add(appoint);
    // Spot sur le deck : les quilles se détachent du fond au lieu de s'y fondre
    const spot = new THREE.SpotLight(0xfff4e0, 26, 9, Math.PI / 7, 0.45, 1.6);
    spot.position.set(0, 3.2, -DIM.longueurPiste + 2.2);
    spot.target.position.set(0, 0.2, -DIM.longueurPiste - 0.3);
    spot.castShadow = true;
    spot.shadow.mapSize.set(1024, 1024);
    spot.shadow.bias = -0.0006;
    this.scene.add(spot, spot.target);
    this.spotDeck = spot;
  }

  _salle() {
    const D = DIM;
    const longueur = D.approche + D.longueurPiste + D.longueurDeck + D.longueurFosse;
    const zFond = -(D.longueurPiste + D.longueurDeck + D.longueurFosse);
    const largeurSalle = PAS_PISTES * 5 + 2;
    const mat = (couleur, extra = {}) => new THREE.MeshStandardMaterial({ color: couleur, roughness: 0.85, metalness: 0, ...extra });

    // Sol général (sous les pistes, hors piste principale) : moquette sombre
    const sol = new THREE.Mesh(new THREE.PlaneGeometry(largeurSalle, longueur + 6), mat('#2b2e3b'));
    sol.rotation.x = -Math.PI / 2;
    sol.position.set(0, -0.01, (D.approche + 3 + zFond) / 2);
    sol.receiveShadow = true;
    this.scene.add(sol);

    // Mur du fond et murs latéraux, plafond
    const fond = new THREE.Mesh(new THREE.PlaneGeometry(largeurSalle, 4.2), mat('#232838'));
    fond.position.set(0, 2.1, zFond - 0.6);
    this.scene.add(fond);
    for (const s of [-1, 1]) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(longueur + 6, 4.2), mat('#2a2f42'));
      m.rotation.y = s > 0 ? -Math.PI / 2 : Math.PI / 2;
      m.position.set(s * largeurSalle / 2, 2.1, (D.approche + 3 + zFond) / 2);
      this.scene.add(m);
    }
    const plafond = new THREE.Mesh(new THREE.PlaneGeometry(largeurSalle, longueur + 6), mat('#30354a'));
    plafond.rotation.x = Math.PI / 2;
    plafond.position.set(0, 4.0, (D.approche + 3 + zFond) / 2);
    this.scene.add(plafond);
    // Rampes lumineuses au plafond
    const matNeon = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#fff6dc', emissiveIntensity: 1.6, roughness: 0.6 });
    for (let z = 2; z > zFond; z -= 4) {
      const neon = new THREE.Mesh(new THREE.BoxGeometry(largeurSalle - 2, 0.06, 0.25), matNeon);
      neon.position.set(0, 3.97, z);
      this.scene.add(neon);
    }

    // Panneau au-dessus des quilles (masque de la machine) avec le nom du bowling
    const nom = String(this.lire('nomBowling', 'BOWLING') || 'BOWLING').toUpperCase().slice(0, 18);
    // Masque : du plafond jusqu'à 60 cm au-dessus des quilles, il cache la machine et porte l'enseigne
    const hauteurMasque = 3.4 - 0.95;
    const panneau = new THREE.Mesh(new THREE.BoxGeometry(largeurSalle - 1, hauteurMasque, 0.4), mat('#1f3b8f', { roughness: 0.6 }));
    panneau.position.set(0, 0.95 + hauteurMasque / 2, -(D.longueurPiste + D.longueurDeck) - 0.35);
    this.scene.add(panneau);
    this.enseigne = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 1.05), new THREE.MeshStandardMaterial({ map: textureTexte(nom), emissive: '#ffffff', emissiveMap: textureTexte(nom, { fond: '#000000', couleur: '#ffffff' }), emissiveIntensity: 0.9, roughness: 0.5 }));
    this.enseigne.position.set(0, 1.75, -(D.longueurPiste + D.longueurDeck) - 0.14);
    this.scene.add(this.enseigne);
    const liseret = new THREE.Mesh(new THREE.BoxGeometry(largeurSalle - 1, 0.06, 0.44), new THREE.MeshStandardMaterial({ color: '#f2c94c', emissive: '#f2c94c', emissiveIntensity: 0.6, roughness: 0.5 }));
    liseret.position.set(0, 0.95, -(D.longueurPiste + D.longueurDeck) - 0.35);
    this.scene.add(liseret);
    // Fosse noire (ouverture sous le panneau)
    // Fosse : bloc noir entièrement SOUS le niveau de la piste (sommet à −2 cm), visible seulement par les
    // ouvertures : de chaque côté du deck (où la gouttière s'ouvre) et derrière lui.
    const longueurFosseVisible = D.longueurFosse + D.longueurDeck + 0.3;
    const hauteurFosse = D.profondeurFosse - 0.02;
    const fosse = new THREE.Mesh(new THREE.BoxGeometry(D.largeurPiste + 2 * D.largeurGouttiere + 0.2, hauteurFosse, longueurFosseVisible), mat('#07080b'));
    fosse.position.set(0, -0.02 - hauteurFosse / 2, -(D.longueurPiste - 0.3) - longueurFosseVisible / 2);
    this.scene.add(fosse);
  }

  _piste() {
    const D = DIM;
    const longueurPiste = D.longueurPiste + D.longueurDeck;
    const mapBois = textureBoisPiste(longueurPiste);
    const matBois = new THREE.MeshStandardMaterial({ map: mapBois, roughness: 0.28, metalness: 0.02, envMapIntensity: 0.8 });
    const matApproche = new THREE.MeshStandardMaterial({ color: '#c9ab7c', roughness: 0.7 });
    const matGouttiere = new THREE.MeshStandardMaterial({ color: '#555b6a', roughness: 0.45, metalness: 0.25, side: THREE.DoubleSide });
    const matBord = new THREE.MeshStandardMaterial({ color: '#b08a5a', roughness: 0.7 });
    const matKickback = new THREE.MeshStandardMaterial({ color: '#21242e', roughness: 0.7, metalness: 0.1 });
    const matQuilleDecor = new THREE.MeshStandardMaterial({ map: textureQuille(), roughness: 0.22, metalness: 0.02, envMapIntensity: 1.1 });
    const geoQuille = geometrieQuille();

    this.pistes = new THREE.Group();
    this.scene.add(this.pistes);

    for (let k = -2; k <= 2; k++) {
      const grp = new THREE.Group();
      grp.position.x = k * PAS_PISTES;
      const principale = k === 0;

      const piste = new THREE.Mesh(new THREE.PlaneGeometry(D.largeurPiste, longueurPiste), matBois);
      piste.rotation.x = -Math.PI / 2;
      piste.position.set(0, 0.001, -longueurPiste / 2);
      piste.receiveShadow = true;
      grp.add(piste);

      const approche = new THREE.Mesh(new THREE.PlaneGeometry(D.largeurPiste + 2 * D.largeurGouttiere + 0.1, D.approche + 1), matApproche);
      approche.rotation.x = -Math.PI / 2;
      approche.position.set(0, 0.001, (D.approche + 1) / 2);
      approche.receiveShadow = true;
      grp.add(approche);

      for (const s of [-1, 1]) {
        const xg = D.largeurPiste / 2 + D.largeurGouttiere / 2;
        // Gouttière : chenal creux (demi-tube), fond à la profondeur physique
        const rayonG = D.largeurGouttiere / 2;
        const longueurG = D.longueurPiste - 0.3;   // la gouttière s'ouvre sur la fosse le long du deck
        const geoG = new THREE.CylinderGeometry(rayonG, rayonG, longueurG, 20, 1, true, 0, Math.PI);
        geoG.rotateX(Math.PI / 2);
        geoG.rotateZ(-Math.PI / 2);
        const g = new THREE.Mesh(geoG, matGouttiere);
        g.position.set(s * xg, rayonG - D.profondeurGouttiere, -longueurG / 2);
        g.receiveShadow = true;
        grp.add(g);
        // Bord extérieur fin (capping) au niveau de la piste
        const bord = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.03, longueurPiste), matBord);
        bord.position.set(s * (D.largeurPiste / 2 + D.largeurGouttiere + 0.025), 0.0, -longueurPiste / 2);
        grp.add(bord);
        // Paroi du deck : basse (35 cm) et limitée au deck, pour ne pas masquer les quilles depuis l'approche
        const longueurKick = D.longueurDeck + 0.6;
        const kick = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.35, longueurKick), matKickback);
        kick.position.set(s * (D.largeurPiste / 2 + D.largeurGouttiere + 0.03), 0.175, -(D.longueurPiste - 0.3) - longueurKick / 2);
        grp.add(kick);
      }

      // Retour de boules (entre deux pistes), avec deux boules décoratives
      if (k === -2 || k === 0) {
        const retour = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.4, 1.3), new THREE.MeshStandardMaterial({ color: '#2f3340', roughness: 0.5, metalness: 0.2 }));
        retour.position.set(PAS_PISTES / 2, 0.2, 2.6);
        retour.castShadow = true;
        grp.add(retour);
        for (const [dz, col] of [[-0.35, '#f28c28'], [0.15, '#8e44ad']]) {
          const b = new THREE.Mesh(new THREE.SphereGeometry(D.rayonBoule, 24, 16), new THREE.MeshStandardMaterial({ color: col, roughness: 0.25 }));
          b.position.set(PAS_PISTES / 2, 0.4 + D.rayonBoule, 2.6 + dz);
          grp.add(b);
        }
      }

      // Quilles décoratives sur les pistes voisines
      if (!principale) {
        for (const p of positionsQuilles()) {
          const q = new THREE.Mesh(geoQuille, matQuilleDecor);
          q.position.set(p.x, D.centreGraviteQuille, p.z);
          grp.add(q);
        }
      }
      this.pistes.add(grp);
    }
    this.geoQuille = geoQuille;
    this.matQuille = matQuilleDecor;
    // Deck élargi (entraînement Lancers puissants)
    if (D.largeurDeckExtra > 0) {
      const large = new THREE.Mesh(new THREE.BoxGeometry(D.largeurDeckExtra * 2, 0.1, D.longueurDeck + 0.5), new THREE.MeshStandardMaterial({ color: '#8a6a4a', roughness: 0.6 }));
      large.position.set(0, -0.049, -(D.longueurPiste - 0.3) - (D.longueurDeck + 0.5) / 2 + 0.5);
      large.receiveShadow = true;
      this.scene.add(large);
    }
  }

  _quilles() {
    // Repères de placement sur le deck : les quilles ne flottent pas dans le vide visuellement
    const matRepere = new THREE.MeshStandardMaterial({ color: '#6b5336', roughness: 0.9 });
    for (const p of positionsQuilles(this.rangs)) {
      const r = new THREE.Mesh(new THREE.CircleGeometry(0.035, 16), matRepere);
      r.rotation.x = -Math.PI / 2;
      r.position.set(p.x, 0.003, p.z);
      this.scene.add(r);
    }
    this.quilles = positionsQuilles(this.rangs).map((p) => {
      const m = new THREE.Mesh(this.geoQuille, this.matQuille);
      m.castShadow = true;
      m.receiveShadow = true;
      m.position.set(p.x, DIM.centreGraviteQuille, p.z);
      this.scene.add(m);
      return m;
    });
  }

  _boule() {
    const r = DIM.rayonBoule;
    this.matBoule = new THREE.MeshStandardMaterial({ color: '#2f6fe4', roughness: 0.18, metalness: 0.05, envMapIntensity: 1.1 });
    const boule = new THREE.Mesh(new THREE.SphereGeometry(r, 48, 32), this.matBoule);
    boule.castShadow = true;
    // Trois trous de doigts
    const matTrou = new THREE.MeshStandardMaterial({ color: '#101014', roughness: 0.9 });
    for (const [lat, lon] of [[1.15, 0], [1.05, 0.55], [1.05, -0.55]]) {
      const trou = new THREE.Mesh(new THREE.CircleGeometry(0.013, 20), matTrou);
      const dir = new THREE.Vector3(Math.cos(lat) * Math.sin(lon), Math.sin(lat), Math.cos(lat) * Math.cos(lon));
      trou.position.copy(dir.clone().multiplyScalar(r + 0.0005));
      trou.lookAt(dir.clone().multiplyScalar(r * 2));
      boule.add(trou);
    }
    this.boule = boule;
    this.scene.add(boule);
  }

  _pinsetter() {
    const D = DIM;
    const mat = new THREE.MeshStandardMaterial({ color: '#4a5060', roughness: 0.5, metalness: 0.3 });
    this.balayeuse = new THREE.Mesh(new THREE.BoxGeometry(D.largeurPiste + 0.16, 0.09, 0.05), mat);
    this.balayeuse.position.set(0, 1.2, -D.longueurPiste + 0.4);
    this.balayeuse.castShadow = true;
    this.scene.add(this.balayeuse);
    this.rack = new THREE.Group();
    const cadre = new THREE.Mesh(new THREE.BoxGeometry(D.largeurPiste - 0.05, 0.05, 0.95), mat);
    this.rack.add(cadre);
    for (const p of positionsQuilles()) {
      const doigt = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.22, 10), mat);
      doigt.position.set(p.x, -0.13, p.z + D.longueurPiste + 0.4);
      this.rack.add(doigt);
    }
    this.rack.position.set(0, 1.45, -D.longueurPiste - 0.4);
    this.scene.add(this.rack);
    this.animerRemise(0, 'rack');
  }

  _guide() {
    this.guide = new THREE.Group();
    const geo = new THREE.CircleGeometry(0.03, 16);
    this.matGuide = new THREE.MeshBasicMaterial({ color: '#2f6fe4', transparent: true, opacity: 0.85 });
    this.pointsGuide = [];
    for (let i = 0; i < 14; i++) {
      const m = new THREE.Mesh(geo, this.matGuide);
      m.rotation.x = -Math.PI / 2;
      this.guide.add(m);
      this.pointsGuide.push(m);
    }
    this.scene.add(this.guide);
  }

  // ---------- Mise à jour ----------

  majQualite() {
    const q = this.lire('qualite', 'normale');
    const dpr = window.devicePixelRatio || 1;
    this.renderer.setPixelRatio(q === 'basse' ? 1 : q === 'haute' ? Math.min(2, dpr) : Math.min(1.5, dpr));
    const ombres = !!this.lire('ombres', true) && q !== 'basse';
    if (this.renderer.shadowMap.enabled !== ombres) { this.renderer.shadowMap.enabled = ombres; this.renderer.shadowMap.needsUpdate = true; }
    this.soleil.castShadow = ombres;
    this.soleil.shadow.mapSize.set(q === 'haute' ? 4096 : 2048, q === 'haute' ? 4096 : 2048);
    if (this.spotDeck) this.spotDeck.castShadow = ombres;
    this.camera.fov = this.lire('champVision', 50);
    this.camera.updateProjectionMatrix();
  }

  majEnseigne() {
    const nom = String(this.lire('nomBowling', 'BOWLING') || 'BOWLING').toUpperCase().slice(0, 18);
    this.enseigne.material.map = textureTexte(nom);
    this.enseigne.material.emissiveMap = textureTexte(nom, { fond: '#000000', couleur: '#ffffff' });
    this.enseigne.material.needsUpdate = true;
  }

  redimensionner(largeur, hauteur) {
    this.renderer.setSize(largeur, hauteur, false);
    this.camera.aspect = largeur / hauteur;
    this.camera.updateProjectionMatrix();
  }

  // Barrière d'entraînement (mur bas sur la piste) ; config = { jusquA, z } ou null.
  majBarriere(config) {
    if (this.barriere) { this.scene.remove(this.barriere); this.barriere = null; }
    if (!config) return;
    const x0 = -DIM.largeurPiste / 2 - 0.05, x1 = config.jusquA;
    const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 0.3, 0.1), new THREE.MeshStandardMaterial({ color: '#e0453a', roughness: 0.6 }));
    m.position.set((x0 + x1) / 2, 0.15, config.z);
    m.castShadow = true;
    this.scene.add(m);
    this.barriere = m;
  }

  // Texture depuis une image (dataURL) — visage photo des profils.
  textureImage(dataUrl) {
    const t = new THREE.TextureLoader().load(dataUrl);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  couleurBoule(hex, pro = false) {
    this.matBoule.color.set(hex);
    this.matGuide.color.set(hex);
    // Boule spéciale des joueurs « Pro » : métallisée et lumineuse
    this.matBoule.metalness = pro ? 0.7 : 0.05;
    this.matBoule.roughness = pro ? 0.12 : 0.18;
    this.matBoule.emissive.set(pro ? hex : '#000000');
    this.matBoule.emissiveIntensity = pro ? 0.25 : 0;
    this.matBoule.needsUpdate = true;
  }

  // Copie l'état physique vers les maillages. Pendant la remise en place, les quilles debout montent avec le rack
  // et les quilles couchées sont poussées par la barre (visuel seulement : la physique est appliquée après le balayage).
  synchroniser(phys) {
    const b = phys.boule;
    if (b.enJeu) {
      this.boule.visible = true;
      this.boule.position.copy(b.corps.position);
      this.boule.quaternion.copy(b.corps.quaternion);
    }
    const r = this.remise || { p: 0, mode: 'rack', levee: 0, zBarre: null };
    for (const q of phys.quilles) {
      const m = this.quilles[q.index];
      m.visible = q.presente;
      if (!q.presente) continue;
      m.position.copy(q.corps.position);
      m.quaternion.copy(q.corps.quaternion);
      if (r.p > 0) {
        if (q.debout) m.position.y += r.levee;
        else if (r.zBarre != null && m.position.z > r.zBarre - 0.08) m.position.z = r.zBarre - 0.08;
      }
    }
  }

  // Boule au départ pendant la préparation (dans la main du personnage si fournie), guide de visée.
  majPreparation(visee, visible, positionMain = null) {
    this.guide.visible = visible;
    if (!visible) return;
    const x0 = visee.position * (DIM.largeurPiste / 2 - DIM.rayonBoule - 0.02);
    const a = (visee.angle * Math.PI) / 180;
    this.boule.visible = true;
    if (positionMain) this.boule.position.copy(positionMain); else this.boule.position.set(x0, DIM.rayonBoule, 0);
    this.boule.quaternion.identity();
    for (let i = 0; i < this.pointsGuide.length; i++) {
      const d = 0.6 + i * 0.5;
      this.pointsGuide[i].position.set(x0 + Math.sin(a) * d, 0.004, -Math.cos(a) * d);
      this.pointsGuide[i].scale.setScalar(1 - i * 0.04);
    }
  }

  // Animation du pinsetter : progression p ∈ [0, 1], mode 'respot' (deuxième boule) ou 'rack' (rack complet).
  animerRemise(p, mode) {
    const D = DIM;
    const zBas = -D.longueurPiste + 0.45, zHaut = -(D.longueurPiste + D.longueurDeck);
    const lisse = (t) => Math.max(0, Math.min(1, t)) ** 2 * (3 - 2 * Math.max(0, Math.min(1, t)));
    const Y_RACK_REPOS = 1.45, Y_BARRE_REPOS = 1.2;
    let yBar = Y_BARRE_REPOS, zBar = zBas, yRack = Y_RACK_REPOS, levee = 0, zBarre = null;
    if (mode === 'respot') {
      // Le rack descend (0–0,3), saisit les quilles debout et les soulève (0,3–0,45) ; la barre balaie (0,45–0,75) ;
      // la physique retire les couchées à 0,78 ; le rack repose les quilles (0,85–1)
      const descente = lisse(p / 0.3), remontee = lisse((p - 0.3) / 0.15), repose = lisse((p - 0.85) / 0.15);
      yRack = Y_RACK_REPOS - 1.03 * descente + 0.35 * remontee - 0.35 * repose;
      levee = 0.35 * remontee - 0.35 * repose;
      yBar = Y_BARRE_REPOS - 1.08 * lisse((p - 0.3) / 0.15) + 1.08 * lisse((p - 0.75) / 0.1);
      const balayage = lisse((p - 0.45) / 0.3);
      zBar = zBas + (zHaut - zBas) * balayage - (zHaut - zBas) * lisse((p - 0.85) / 0.15);
      if (p > 0.45 && p < 0.78) zBarre = zBar;
    } else {
      // La barre balaie tout (0–0,45) ; la physique pose le rack complet à 0,5 ; le rack descend avec les quilles (0,55–0,85)
      yBar = Y_BARRE_REPOS - 1.08 * lisse(p / 0.12) + 1.08 * lisse((p - 0.45) / 0.1);
      const balayage = lisse((p - 0.12) / 0.33);
      zBar = zBas + (zHaut - zBas) * balayage - (zHaut - zBas) * lisse((p - 0.6) / 0.15);
      if (p > 0.12 && p < 0.5) zBarre = zBar;
      const descente = lisse((p - 0.55) / 0.3);
      yRack = Y_RACK_REPOS - 1.03 * descente + 1.03 * lisse((p - 0.88) / 0.12);
      levee = p >= 0.5 ? 0.42 * (1 - descente) : 0;
    }
    this.balayeuse.position.set(0, yBar, zBar);
    this.rack.position.y = yRack;
    this.remise = p > 0 ? { p, mode, levee, zBarre } : null;
  }

  rendre() {
    this.renderer.render(this.scene, this.camera);
  }
}
