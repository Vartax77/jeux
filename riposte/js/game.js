import * as THREE from 'three';
import { Net } from './net.js';
import { Audio } from './audio.js';
import { Music } from './music.js';
import { Assets } from './assets.js';
import { LEVELS } from './levels.js';
import { Enemy, Bullet, CFG, TYPES, clamp, smooth, rnd } from './entities.js';
import { makeBoss } from './bosses.js';

const SET = { fovX: 40, moveTime: 2.6, slowmo: 0.3, slowmoDur: 0.7, duckDepth: 0.75 };
const COLORS = ['#ff4d4d', '#4da6ff'];
const AUTOC = { soft: 'doux (si le pistolet a bougé de plus de 20°)', hard: 'fort (toujours)', off: 'non' };
const $ = id => document.getElementById(id);

export class Game {
  constructor() {
    this.audio = new Audio(); this.music = new Music(this.audio);
    this.assets = new Assets();
    this.net = new Net({ fovX: SET.fovX, autoCenter: 'soft', onEvent: (t, p, d) => this.onNet(t, p, d) });
    this.state = 'loading';
    this.timeScale = 1; this.slowmoLeft = 0;
    this.enemies = []; this.bullets = []; this.sparks = []; this.events = []; this.fx = [];
    this.levelIndex = 0; this.level = LEVELS[0];
    this.pointIndex = 0; this.waveIndex = 0; this.waveQueue = []; this.waveClock = 0;
    this.timer = 40; this.lastTickSec = -1; this.streak = 0; this.penalty = 0;
    this.moving = null; this.duck = 0; this.shake = 0; this.boss = null;
    this.banner = { text: '', until: 0, sub: '' }; this.ringHits = [];
    this.menuHover = -1;
    this._initDom(); this._initScene();
    this.env = null; this.buildTheme(this.level);
    this._placeCamera(this.level.points[0]);
    this.net.start();
    $('code').textContent = this.net.code; $('url').textContent = this.net.telUrl;
    try { const q = qrcode(0, 'M'); q.addData(this.net.telUrl); q.make(); $('qr').innerHTML = q.createSvgTag({ cellSize: 4, margin: 0 }); } catch (e) { console.warn('QR', e); }
    this.clock = new THREE.Clock();
    this.render = this.render.bind(this);
    requestAnimationFrame(this.render);
    this.assets.load(k => { $('load').textContent = 'Ressources : ' + Math.round(k * 100) + ' %'; }).then(() => {
      this.state = 'lobby';
      $('load').textContent = 'Ressources : ' + (this.assets.hasRig ? 'personnage Mixamo chargé' : 'personnages procéduraux') + ' · ' + Object.keys(this.assets.textures).length + ' texture(s) · ' + Object.keys(this.assets.backdrops).length + ' fond(s)';
      console.log(this.assets.report.join('\n')); $('load').title = this.assets.report.join('\n');
      this.buildTheme(this.level);
    });
  }

  // ------------------------------------------------------------ DOM / entrées PC
  _initDom() {
    this.cv2 = $('overlay'); this.ctx2 = this.cv2.getContext('2d');
    const enableAudio = () => { this.audio.init(); this.audio.resume(); };
    addEventListener('pointerdown', enableAudio); addEventListener('keydown', enableAudio);
    addEventListener('keydown', e => {
      const k = e.key.toLowerCase();
      if (k === 'l') $('lobby').classList.toggle('hidden');
      if (k === 'k') { const p = this.net.addLocalPlayer(); if (p) this.setBanner('Joueur clavier/souris ajouté (J' + (p.slot + 1) + ') — clic = tir, Espace = couvrir', 2.5); }
      if (k === 'm') { this.audio.enabled = !this.audio.enabled; this.music.setEnabled(this.audio.enabled); this.setBanner(this.audio.enabled ? 'Son activé' : 'Son coupé', 1.2); }
      if (k === 'n') { this.music.setEnabled(!this.music.enabled); this.setBanner(this.music.enabled ? 'Musique activée' : 'Musique coupée', 1.2); }
      if (e.key === '+' || e.key === '=') this.net.fovX = clamp(this.net.fovX + 2, 10, 90);
      if (e.key === '-') this.net.fovX = clamp(this.net.fovX - 2, 10, 90);
      if (k === 'r') { const modes = ['soft', 'hard', 'off']; this.net.autoCenter = modes[(modes.indexOf(this.net.autoCenter) + 1) % 3]; this.setBanner('Recentrage à la sortie de couvert : ' + AUTOC[this.net.autoCenter], 1.5); }
      if (k === 'escape' && this.state !== 'lobby' && this.state !== 'loading') this.toTitle();
      $('fov').textContent = this.net.fovX; $('autoc').textContent = AUTOC[this.net.autoCenter];
    });
    addEventListener('resize', () => this._resize());
  }
  _resize() {
    const w = innerWidth, h = innerHeight, r = Math.min(devicePixelRatio || 1, 2);
    this.renderer.setSize(w, h, false); this.renderer.setPixelRatio(r);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    this.cv2.width = Math.floor(w * r); this.cv2.height = Math.floor(h * r); this.ctx2.setTransform(r, 0, 0, r, 0, 0);
  }

  // ------------------------------------------------------------ Scène
  _initScene() {
    this.renderer = new THREE.WebGLRenderer({ canvas: $('gl'), antialias: true, powerPreference: 'high-performance' });
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.3;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 260);
    this.camBase = { pos: new THREE.Vector3(), look: new THREE.Vector3() };
    this.hemi = new THREE.HemisphereLight(0x9cc0e8, 0x2a2118, 0.8); this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffdcb0, 1.7); this.sun.position.set(18, 26, -8); this.sun.castShadow = true;
    const sc = this.sun.shadow; sc.mapSize.set(1536, 1536); sc.camera.near = 1; sc.camera.far = 120; sc.camera.left = -50; sc.camera.right = 50; sc.camera.top = 50; sc.camera.bottom = -50; sc.bias = -0.0008;
    this.scene.add(this.sun); this.scene.add(this.sun.target);
    // Contre-jour froid : détache les silhouettes du décor
    this.rim = new THREE.DirectionalLight(0x7fb4ff, 1.2); this.scene.add(this.rim); this.scene.add(this.rim.target);
    // Lumière d'appoint côté joueur (comble les faces sombres)
    this.fill = new THREE.PointLight(0xffe4c0, 8, 30, 1.2); this.scene.add(this.fill);
    this.sparkMax = 700;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.sparkMax * 3), 3));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(this.sparkMax * 3), 3));
    this.sparkGeo = g;
    this.sparkPts = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.12, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.sparkPts.frustumCulled = false; this.scene.add(this.sparkPts);
    this.envMeshes = []; this.raycaster = new THREE.Raycaster();
    this._resize();
  }

  // ------------------------------------------------------------ Thèmes de zone
  _box(w, h, d, material, x, y, z, { shadow = true, env = true } = {}) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    m.position.set(x, y, z); m.castShadow = shadow; m.receiveShadow = true; this.env.add(m);
    if (env) this.envMeshes.push(m);
    return m;
  }
  buildTheme(level) {
    if (this.env) { this.scene.remove(this.env); this.env.traverse(o => { if (o.isMesh) { o.geometry.dispose(); if (o.material.map) o.material.map.dispose(); o.material.dispose(); } }); }
    this.env = new THREE.Group(); this.env.userData.theme = level.theme; this.scene.add(this.env); this.envMeshes = [];
    const A = this.assets, t = level.theme;
    const sky = { docks: 0x0e1620, street: 0x141018, hangar: 0x0a0b0d }[t];
    this.scene.background = new THREE.Color(sky); this.scene.fog = new THREE.Fog(sky, t === 'hangar' ? 20 : 28, t === 'hangar' ? 70 : 95);
    this.hemi.color.setHex({ docks: 0x9cc0e8, street: 0xc9a0d8, hangar: 0x8a9ab0 }[t]); this.hemi.intensity = t === 'hangar' ? 0.7 : 1.1;
    this.sun.color.setHex({ docks: 0xffd8a8, street: 0xffc890, hangar: 0xe8f0ff }[t]); this.sun.intensity = t === 'hangar' ? 1.4 : 2.6;
    // Fond panoramique lointain (texture si fournie, sinon ligne d'horizon peinte)
    const back = A.backdrops[t];
    if (back) { const cyl = new THREE.Mesh(new THREE.CylinderGeometry(120, 120, 60, 48, 1, true), new THREE.MeshBasicMaterial({ map: back, side: THREE.BackSide, fog: false })); cyl.position.set(7, 18, -30); this.env.add(cyl); }
    else this._paintedSkyline(t);
    const groundMat = A.material(t === 'hangar' ? 'concrete' : t === 'street' ? 'asphalt' : 'ground', { docks: 0x2b3038, street: 0x24262b, hangar: 0x3a3c40 }[t], [40, 40]);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), groundMat); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; this.env.add(ground); this.envMeshes.push(ground);
    if (t === 'docks') this._themeDocks(); else if (t === 'street') this._themeStreet(); else this._themeHangar();
    // Couverts du joueur, caisses et plates-formes des ennemis, lampadaire par zone de combat
    for (const pt of level.points) {
      const p = new THREE.Vector3(...pt.pos), l = new THREE.Vector3(...pt.look), dir = l.clone().sub(p).setY(0).normalize();
      { const all = pt.waves.flatMap(w => w.enemies.map(e => e.pos)); if (all.length) {
          const cx = all.reduce((a, e) => a + e[0], 0) / all.length, cz = all.reduce((a, e) => a + e[2], 0) / all.length;
          const side = dir.x > 0.3 ? -1 : 1, lx = cx + side * 3.5, lz = cz + 1.5;
          if (t !== 'hangar') { const mat = A.material('metal', 0x555a66); this._box(0.18, 5.5, 0.18, mat, lx, 2.75, lz, { shadow: false }); this._box(1.2, 0.12, 0.3, mat, lx - side * 0.5, 5.5, lz, { shadow: false }); const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffe8b0 })); bulb.position.set(lx - side * 1.0, 5.4, lz); this.env.add(bulb); }
          const pl = new THREE.PointLight(0xffe0a0, t === 'hangar' ? 60 : 90, 26, 1.6); pl.position.set(lx - side * 1.0, t === 'hangar' ? 6.5 : 5.3, lz); this.env.add(pl);
      } }
      const c = p.clone().add(dir.clone().multiplyScalar(pt.cover === 'car' ? 2.6 : 1.9));
      if (pt.cover === 'car') this._car(c.x, c.z, Math.atan2(dir.x, dir.z) + Math.PI / 2, 0x8a2a2a, true);
      else this._box(2.2, 1.15, 0.9, A.material('metal', 0x8a6a3a, [2, 1]), c.x, 0.575, c.z).lookAt(p.x, 0.575, p.z);
      for (const w of pt.waves) for (const e of w.enemies) {
        const ep = new THREE.Vector3(...e.pos), toCam = p.clone().sub(ep).setY(0).normalize();
        if (ep.y > 0.1) {
          this._box(2.2, 0.3, 2.2, A.material('metal', 0x50555e, [2, 2]), ep.x, ep.y - 0.15, ep.z);
          const rail = this._box(2.2, 0.5, 0.08, A.material('metal', 0x50555e, [2, 1]), ep.x, ep.y + 0.25, ep.z, { env: false }); rail.position.add(toCam.clone().multiplyScalar(1.05)); rail.lookAt(p.x, ep.y + 0.25, p.z);
        } else { const cp = ep.clone().add(toCam.multiplyScalar(0.9)); this._box(1.3, 1.0, 0.7, A.material('metal', 0x5a5f6a, [1, 1]), cp.x, 0.5, cp.z).lookAt(p.x, 0.5, p.z); }
      }
    }
  }
  _paintedSkyline(t) {
    if (t === 'hangar') return;
    const palette = { docks: [0x394655, 0x4a3f3a, 0x2f4a4a], street: [0x2a2233, 0x3a2a3a, 0x1f2a3a] }[t];
    for (let i = 0; i < 26; i++) {
      const side = i % 2 ? 1 : -1, w = rnd(6, 14), h = rnd(6, 18), d = rnd(8, 18);
      const x = side > 0 ? rnd(34, 60) : rnd(-24, -48);
      const m = this._box(w, h, d, new THREE.MeshStandardMaterial({ color: palette[i % palette.length], roughness: 1 }), x, h / 2, -i * 5 - rnd(0, 6), { shadow: false });
      for (let k = 0; k < 6; k++) { const win = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.9), new THREE.MeshBasicMaterial({ color: Math.random() < 0.6 ? 0xffd27a : 0x334455 })); win.position.set(side > 0 ? -w / 2 - 0.02 : w / 2 + 0.02, rnd(1, h - 1) - h / 2, rnd(-d / 2 + 1, d / 2 - 1)); win.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2; m.add(win); }
    }
  }
  _car(x, z, rotY, color, low = false) {
    const A = this.assets, g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rotY; this.env.add(g);
    const body = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.6, 1.9), new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.4 })); body.position.y = 0.55; body.castShadow = true; g.add(body); this.envMeshes.push(body);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(2.2, low ? 0.35 : 0.55, 1.7), new THREE.MeshStandardMaterial({ color: 0x3a5a7a, roughness: 0.3, metalness: 0.3 })); cab.position.set(-0.2, low ? 1.02 : 1.12, 0); cab.castShadow = true; g.add(cab); this.envMeshes.push(cab);
    for (const [wx, wz] of [[-1.4, -0.95], [1.4, -0.95], [-1.4, 0.95], [1.4, 0.95]]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.25, 12), A.material('metal', 0x1a1a1a)); w.rotation.x = Math.PI / 2; w.position.set(wx, 0.33, wz); g.add(w); }
    return g;
  }
  _themeDocks() {
    const A = this.assets, cont = [0xb5482a, 0x2a6fb5, 0x3d8a3d, 0xb5a02a, 0x7a2ab5];
    for (let i = 0; i < 16; i++) { const x = i % 2 ? rnd(24, 34) : rnd(-18, -7), z = -rnd(4, 75); this._box(2.4, 2.5, 6, A.material('container', cont[i % cont.length], [1, 2]), x, 1.25, z); }
    for (let i = 0; i < 4; i++) this._box(2.4, 2.5, 6, A.material('container', cont[i], [1, 2]), rnd(-4, 22), 1.25, -rnd(62, 78));
    for (let i = 0; i < 5; i++) { const x = i % 2 ? rnd(27, 36) : rnd(-18, -10), z = -rnd(5, 70), m = A.material('metal', 0x6b6f77); this._box(0.5, 12, 0.5, m, x - 2.5, 6, z, { shadow: false }); this._box(0.5, 12, 0.5, m, x + 2.5, 6, z, { shadow: false }); this._box(6, 0.4, 0.4, m, x, 11, z, { shadow: false }); }
    const water = new THREE.Mesh(new THREE.PlaneGeometry(300, 120), new THREE.MeshStandardMaterial({ color: 0x0b2a3a, roughness: 0.2, metalness: 0.6 })); water.rotation.x = -Math.PI / 2; water.position.set(0, 0.02, -140); this.env.add(water);
    const lineMat = new THREE.MeshStandardMaterial({ color: 0x9a8a3a, roughness: 1 });
    for (let z = 0; z > -80; z -= 8) { const l = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 4), lineMat); l.rotation.x = -Math.PI / 2; l.position.set(-9, 0.01, z - 2); this.env.add(l); }
  }
  _themeStreet() {
    const A = this.assets;
    for (const side of [-1, 1]) {
      for (let z = 4; z > -90; z -= 12) {
        const h = rnd(9, 14), m = this._box(6, h, 12, A.material('brick', side < 0 ? 0x5a3f36 : 0x4a4a55, [2, 4]), side * 13, h / 2, z - 6);
        for (let k = 0; k < 3; k++) for (const y of [2.2, 5.5, 8.5]) { if (y > h - 1) continue; const w = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.6), new THREE.MeshBasicMaterial({ color: Math.random() < 0.5 ? 0xffd27a : 0x22303a })); w.position.set(side * -3.02, y - h / 2, -4.5 + k * 3); w.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2; m.add(w); }
      }
      for (let z = -2; z > -80; z -= 14) this._box(0.25, 5, 0.25, A.material('metal', 0x555a66), side * 9, 2.5, z, { shadow: false });
    }
    for (let i = 0; i < 7; i++) this._car(i % 2 ? rnd(-8, -5) : rnd(5, 8), -rnd(6, 76), rnd(-0.2, 0.2), [0x2a4a8a, 0x8a8a8a, 0x2a2a2a, 0xc0c0c0, 0x8a2a2a][i % 5]);
    const lane = new THREE.MeshStandardMaterial({ color: 0xd8d0a0, roughness: 1 });
    for (let z = 0; z > -90; z -= 6) { const l = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 3), lane); l.rotation.x = -Math.PI / 2; l.position.set(0, 0.01, z - 1.5); this.env.add(l); }
  }
  _themeHangar() {
    const A = this.assets, wall = A.material('concrete', 0x2e3138, [8, 3]), steel = A.material('metal', 0x50555e, [4, 1]);
    this._box(0.5, 10, 100, wall, -14.5, 5, -40); this._box(0.5, 10, 100, wall, 14.5, 5, -40);
    this._box(30, 0.5, 100, wall, 0, 9.5, -40, { shadow: false });
    this._box(30, 10, 0.5, wall, 0, 5, -80);
    for (const side of [-1, 1]) { this._box(3.2, 0.3, 96, steel, side * 11.4, 3.85, -40); this._box(0.08, 1.0, 96, steel, side * 9.85, 4.5, -40, { shadow: false }); for (let z = 0; z > -80; z -= 8) this._box(0.2, 4, 0.2, steel, side * 12.9, 2, z - 2); }
    for (let z = -6; z > -78; z -= 16) for (const side of [-1, 1]) { const l = new THREE.SpotLight(0xfff0d0, 40, 30, 0.6, 0.5, 1.2); l.position.set(side * 8, 9, z); l.target.position.set(side * 3, 0, z - 4); this.env.add(l); this.env.add(l.target); const cone = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.6, 10), new THREE.MeshBasicMaterial({ color: 0xfff0d0 })); cone.position.copy(l.position); this.env.add(cone); }
    for (let i = 0; i < 8; i++) this._box(1.2, 1.2, 1.2, A.material('metal', 0x6a5a3a), rnd(-8, 8) + (i % 2 ? 6 : -6), 0.6, -rnd(8, 74));
  }

  // ------------------------------------------------------------ Réseau → jeu
  onNet(type, p, data) {
    if (type === 'error') { const el = $('err'); el.style.display = 'block'; el.textContent = 'Erreur réseau : ' + (data && data.type); return; }
    if (type === 'join') { this._initPlayer(p); this._status(p, 'connecté', COLORS[p.slot]); this._pushState(p, true); return; }
    if (type === 'leave') { this._status(p, 'déconnecté', '#333'); return; }
    if (type === 'cover') { this.onCover(p, data); return; }
    if (type === 'fire') { this.onFire(p); return; }
  }
  _status(p, txt, color) { $('s' + (p.slot + 1)).textContent = txt; $('d' + (p.slot + 1)).style.background = color; }
  _initPlayer(p) { p.g = { lives: this.level.lives, ammo: this.level.ammo, score: 0, shots: 0, hits: 0, headshots: 0, bullets: 0, alive: true, hitAt: -9, lastAmmo: -1, lastLives: -1 }; }
  players() { const a = []; this.net.forEach(p => { if (p.g) a.push(p); }); return a; }
  alivePlayers() { return this.players().filter(p => p.g.alive); }
  _pushState(p, force = false) {
    if (p.local) return; const g = p.g;
    if (!force && g.lastAmmo === g.ammo && g.lastLives === g.lives) return;
    g.lastAmmo = g.ammo; g.lastLives = g.lives;
    this.net.send(p, { t: 'st', ammo: g.ammo, max: this.level.ammo, lives: g.lives, alive: g.alive });
  }
  get inFight() { return this.state === 'action' || this.state === 'boss'; }
  onCover(p, on) {
    if (!p.g) return;
    if (on && p.g.alive && p.g.ammo < this.level.ammo && this.inFight) { p.g.ammo = this.level.ammo; this.audio.reload(); this._pushState(p); }
  }
  onFire(p) {
    if (!p.g || this.state === 'loading') return;
    if (this.state === 'lobby') { this.toTitle(); return; }
    if (this.state === 'title') { if (this.menuHover >= 0) this.startLevel(this.menuHover); return; }
    if (this.state === 'gameover') { this.continueGame(); return; }
    if (this.state === 'clear') { if (this.levelIndex + 1 < LEVELS.length) this.startLevel(this.levelIndex + 1); else this.toTitle(); return; }
    if (!p.g.alive || p.cover) return;
    if (p.g.ammo <= 0) { this.audio.empty(); this.net.send(p, { t: 'ev', k: 'empty' }); this.setBanner('RECHARGE — mets-toi à couvert', 0.8, '', p.slot); return; }
    p.g.ammo--; p.g.shots++; p.lastFire = performance.now(); this._pushState(p);
    const pan = (p.x - 0.5) * 2;
    this.audio.shot(pan * 0.3); this.shake = Math.min(this.shake + 0.08, 0.35);
    this.raycaster.setFromCamera(new THREE.Vector2(p.x * 2 - 1, -(p.y * 2 - 1)), this.camera);
    const targets = [];
    for (const e of this.enemies) if (e.hittable) targets.push(...e.parts);
    for (const b of this.bullets) targets.push(b.mesh);
    targets.push(...this.envMeshes);
    const hits = this.raycaster.intersectObjects(targets, false);
    if (!hits.length) return;
    const h = hits[0], o = h.object;
    this.ringHits.push({ x: p.x, y: p.y, t: performance.now(), color: COLORS[p.slot], kind: 'shot' });
    if (o.userData.enemy) { o.userData.enemy.hit(o.userData.part, p, pan, o); return; }
    if (o.userData.bullet) { o.userData.bullet.shotDown(p, pan); return; }
    this.spawnSparks(h.point, 0xffd080, 14, 3); this.audio.ricochet(pan);
  }

  // ------------------------------------------------------------ Déroulé
  toTitle() {
    this.clearField(); this.boss = null;
    this.state = 'title'; $('lobby').classList.add('hidden'); $('hud').classList.add('hidden'); $('stats').classList.add('hidden'); $('bossbar').classList.add('hidden');
    this.audio.init(); this.audio.resume(); this.music.start('title');
    this.setLevel(0); this._placeCamera(this.level.points[0]); this.camBase.look.y += 0.4;
  }
  setLevel(i) {
    this.levelIndex = i; this.level = LEVELS[i];
    if (!this.env || this.env.userData.theme !== this.level.theme) this.buildTheme(this.level);
  }
  startLevel(i) {
    this.clearField(); this.boss = null;
    this.setLevel(i);
    this.players().forEach(p => { this._initPlayer(p); this._pushState(p, true); });
    this.pointIndex = 0; this.waveIndex = 0; this.streak = 0; this.penalty = 0;
    $('hud').classList.remove('hidden'); $('stats').classList.add('hidden'); $('bossbar').classList.add('hidden');
    this._placeCamera(this.level.points[0]);
    this.state = 'intro'; this.stateClock = 0;
    this.setBanner(this.level.name, 3.2, this.level.intro);
    this.music.start(this.level.theme); this.music.setIntense(false);
  }
  continueGame() {
    this.clearField();
    this.players().forEach(p => { p.g.lives = this.level.lives; p.g.ammo = this.level.ammo; p.g.alive = true; this._pushState(p); });
    $('stats').classList.add('hidden'); this.waveIndex = 0; this.penalty = 0.2;
    this._placeCamera(this.level.points[this.pointIndex]);
    if (this.boss) { this.boss = null; this.beginBoss(); } else this.beginPoint();
  }
  clearField() { for (const e of this.enemies) e.dispose(); for (const b of this.bullets) b.dispose(); for (const f of this.fx) f.dispose(); this.enemies = []; this.bullets = []; this.fx = []; this.waveQueue = []; this.events = []; this.bossDown = false; this.bossDownT = 0; this.music.setIntense(false); }

  beginPoint() {
    this.state = 'action'; this.timer = this.level.timePerPoint; this.lastTickSec = -1;
    this.setBanner('ACTION !', 1.2); this.audio.action(); this.music.setIntense(false);
    this.startWave();
  }
  startWave() {
    const w = this.level.points[this.pointIndex].waves[this.waveIndex];
    this.waveQueue = w.enemies.map(e => ({ ...e })).sort((a, b) => a.delay - b.delay);
    this.events = (w.events || []).map(e => ({ ...e })).sort((a, b) => a.at - b.at);
    this.waveClock = 0;
  }
  spawnEnemy(def) { this.enemies.push(new Enemy(this, { delay: 0, ...def })); }
  endWave() {
    const pt = this.level.points[this.pointIndex];
    this.waveIndex++;
    if (this.waveIndex < pt.waves.length) { this.startWave(); return; }
    this.waveIndex = 0;
    if (pt.boss) { this.beginBoss(); return; }
    if (this.pointIndex + 1 >= this.level.points.length) { this.zoneClear(); return; }
    this.state = 'wait'; this.setBanner('ATTENDEZ !', 1.6); this.audio.wait();
    this.moving = { from: pt, to: this.level.points[this.pointIndex + 1], t: 0 };
    this.pointIndex++;
  }
  beginBoss() {
    const def = this.level.points[this.pointIndex].boss;
    this.state = 'boss'; this.timer = def.time; this.lastTickSec = -1; this.bossDown = false;
    this.boss = makeBoss(this, def); this.enemies.push(this.boss);
    this.setBanner('ALERTE', 2.4, this.boss.name); this.audio.action(); this.music.start('boss'); this.music.setIntense(true);
    $('bossbar').classList.remove('hidden'); $('bossname').textContent = this.boss.name;
  }
  onEnemyDied(e) {
    if (e.isBoss) { this.bossDown = true; return; }
    if (this.state === 'action' && !this.waveQueue.length && this.enemies.every(x => x === e || !x.alive)) this.slowmoLeft = SET.slowmoDur;
  }
  zoneClear() {
    this.state = 'clear'; this.audio.clear(); this.music.stop(); $('bossbar').classList.add('hidden');
    this.setBanner('ZONE NETTOYÉE', 3);
    const last = this.levelIndex + 1 >= LEVELS.length;
    this.showStats(this.level.name.replace(/^ZONE \d — /, '') + ' — TERMINÉ', last ? 'Toutes les zones sont libérées. TIRER pour revenir au titre.' : 'TIRER pour passer à la zone suivante');
  }
  gameOver() {
    this.state = 'gameover'; this.audio.gameOver(); this.music.stop();
    this.setBanner('GAME OVER', 3);
    this.showStats('GAME OVER', 'TIRER pour continuer (reprise au point actuel)');
  }
  showStats(title, hint) {
    $('stTitle').textContent = title; $('stHint').textContent = hint;
    $('stRows').innerHTML = this.players().map(p => { const g = p.g, acc = g.shots ? Math.round(100 * g.hits / g.shots) : 0; return `<div class="strow" style="color:${COLORS[p.slot]}"><b>J${p.slot + 1}</b> score ${g.score} · précision ${acc} % (${g.hits}/${g.shots}) · têtes ${g.headshots} · balles abattues ${g.bullets}</div>`; }).join('');
    $('stats').classList.remove('hidden');
  }
  timeOut() {
    this.audio.timeUp(); this.setBanner('TEMPS ÉCOULÉ', 1.5);
    for (const p of this.alivePlayers()) this.damagePlayer(p, null, true);
    this.timer = this.state === 'boss' ? this.level.points[this.pointIndex].boss.time : this.level.timePerPoint; this.lastTickSec = -1;
  }
  damagePlayer(p, fromPos, silent = false) {
    if (!p.g.alive) return;
    p.g.lives--; p.g.hitAt = performance.now(); this.streak = 0; this.penalty = Math.min(this.penalty + 0.25, 0.5);
    this.shake = 0.6; if (!silent) this.audio.playerHit();
    this.net.send(p, { t: 'ev', k: 'hit' });
    if (fromPos) { const s = this.project(fromPos); this.ringHits.push({ x: s.x, y: s.y, t: performance.now(), color: '#ff2020', kind: 'from' }); }
    if (p.g.lives <= 0) { p.g.alive = false; this.net.send(p, { t: 'ev', k: 'dead' }); }
    this._pushState(p);
    if (this.alivePlayers().length === 0) this.gameOver();
  }

  // ------------------------------------------------------------ Événements scriptés
  runEvent(ev) {
    const pos = new THREE.Vector3(...ev.pos);
    if (ev.type === 'explode') { this.spawnSparks(pos, 0xffa040, 120, 8, 1.2); this.spawnSparks(pos, 0xff3020, 60, 4, 1.6); this.shake = 0.8; this.audio.playerHit(); this.fx.push(new Fire(this, pos)); }
    if (ev.type === 'drop') this.fx.push(new Drop(this, pos));
    if (ev.type === 'glass') { this.spawnSparks(pos, 0xbfe6ff, 80, 5, 1.0); this.audio.bulletPop(this.project(pos).x * 2 - 1); }
  }

  // ------------------------------------------------------------ Caméra
  _placeCamera(pt) { this.camBase.pos.set(...pt.pos); this.camBase.look.set(...pt.look); }
  project(v3) { const v = v3.clone().project(this.camera); return { x: (v.x + 1) / 2, y: (1 - v.y) / 2, behind: v.z > 1 }; }
  telegraphTime(type) { const m = TYPES[type].telegraph || 1; return clamp((CFG.telegraphBase - 0.03 * this.streak + this.penalty) * m, CFG.telegraphMin, CFG.telegraphMax * m); }

  // ------------------------------------------------------------ Boucle
  render() {
    requestAnimationFrame(this.render);
    const raw = Math.min(this.clock.getDelta(), 0.05), now = performance.now() / 1000;
    this.net.update(now);
    if (this.slowmoLeft > 0) { this.slowmoLeft -= raw; this.timeScale = this.slowmoLeft > 0 ? SET.slowmo : 1; }
    const dt = raw * this.timeScale;
    this.update(dt, raw); this.updateCamera(raw);
    this.sun.target.position.copy(this.camBase.pos).add(new THREE.Vector3(0, 0, -12)); this.sun.position.copy(this.sun.target.position).add(new THREE.Vector3(14, 22, 16));
    const fwd = this.camBase.look.clone().sub(this.camBase.pos).setY(0).normalize();
    this.rim.target.position.copy(this.camBase.pos); this.rim.position.copy(this.camBase.pos).addScaledVector(fwd, 40).add(new THREE.Vector3(-10, 18, 0));
    this.fill.position.copy(this.camBase.pos).add(new THREE.Vector3(0, 3.5, 0)).addScaledVector(fwd, 4);
    this._cullLights();
    this.renderer.render(this.scene, this.camera);
    this.draw2D(); this.updateHud();
  }
  update(dt, raw) {
    this.penalty = Math.max(0, this.penalty - raw * 0.08);
    if (this.state === 'title') this.camBase.look.x = this.level.points[0].look[0] + Math.sin(performance.now() / 4000) * 3;
    if (this.state === 'intro') { this.stateClock += raw; if (this.stateClock > 3.2) this.beginPoint(); }
    if (this.state === 'wait' && this.moving) {
      this.moving.t += raw / SET.moveTime; const k = smooth(clamp(this.moving.t, 0, 1));
      this.camBase.pos.lerpVectors(new THREE.Vector3(...this.moving.from.pos), new THREE.Vector3(...this.moving.to.pos), k);
      this.camBase.look.lerpVectors(new THREE.Vector3(...this.moving.from.look), new THREE.Vector3(...this.moving.to.look), k);
      if (this.moving.t >= 1) { this.moving = null; this.beginPoint(); }
    }
    if (this.inFight && !this.bossDown) {
      this.timer -= dt;
      const sec = Math.ceil(this.timer);
      if (sec !== this.lastTickSec && sec <= 10 && sec > 0) { this.audio.tick(sec <= 5); this.lastTickSec = sec; }
      if (this.timer <= 10 && this.state === 'action') this.music.setIntense(true);
      if (this.timer <= 0) this.timeOut();
    }
    if (this.state === 'action') {
      this.waveClock += dt;
      while (this.waveQueue.length && this.waveQueue[0].delay <= this.waveClock) this.enemies.push(new Enemy(this, this.waveQueue.shift()));
      while (this.events.length && this.events[0].at <= this.waveClock) this.runEvent(this.events.shift());
      if (!this.waveQueue.length && this.enemies.every(e => e.gone || !e.alive)) this.endWave();
    }
    if (this.state === 'boss' && this.bossDown) { this.bossDownT = (this.bossDownT || 0) + raw; if (this.bossDownT === raw) this.slowmoLeft = 1.2; if (this.bossDownT > 3.8) { this.bossDown = false; this.bossDownT = 0; this.zoneClear(); } }
    for (const e of this.enemies) e.update(dt);
    this.enemies = this.enemies.filter(e => { if (e.removed) e.dispose(); return !e.removed; });
    for (const b of this.bullets) b.update(dt);
    this.bullets = this.bullets.filter(b => { if (b.removed) b.dispose(); return !b.removed; });
    for (const f of this.fx) f.update(dt);
    this.fx = this.fx.filter(f => { if (f.done) f.dispose(); return !f.done; });
    this.updateSparks(dt);
  }
  updateCamera(raw) {
    const alive = this.alivePlayers();
    const allCovered = alive.length > 0 && alive.every(p => p.cover) && this.inFight;
    this.duck += ((allCovered ? 1 : 0) - this.duck) * Math.min(1, raw * 9);
    this.shake = Math.max(0, this.shake - raw * 1.8);
    const s = this.shake * 0.06;
    const pos = this.camBase.pos.clone(); pos.y -= SET.duckDepth * this.duck; pos.x += (Math.random() - 0.5) * s; pos.y += (Math.random() - 0.5) * s;
    const look = this.camBase.look.clone(); look.y -= (SET.duckDepth + 0.5) * this.duck;
    this.camera.position.copy(pos); this.camera.lookAt(look);
  }

  // Éteint les lumières ponctuelles/projecteurs à plus de 34 m de la caméra (coût GPU par lumière)
  _cullLights() {
    if (!this.env) return;
    const c = this.camBase.pos;
    for (const o of this.env.children) if (o.isPointLight || o.isSpotLight) o.visible = o.position.distanceTo(c) < 34;
  }

  // ------------------------------------------------------------ Particules
  spawnSparks(pos, color, n = 12, speed = 3, life = 0.5) {
    const c = new THREE.Color(color);
    for (let i = 0; i < n; i++) {
      if (this.sparks.length >= this.sparkMax) this.sparks.shift();
      const v = new THREE.Vector3(rnd(-1, 1), rnd(-0.4, 1.2), rnd(-1, 1)).normalize().multiplyScalar(rnd(0.3, 1) * speed);
      this.sparks.push({ p: pos.clone(), v, life: rnd(0.4, 1) * life, max: life, c });
    }
  }
  updateSparks(dt) {
    const pa = this.sparkGeo.attributes.position.array, ca = this.sparkGeo.attributes.color.array; let n = 0;
    for (const s of this.sparks) {
      s.life -= dt; if (s.life <= 0) continue;
      s.v.y -= 9 * dt; s.p.addScaledVector(s.v, dt);
      if (s.p.y < 0.02) { s.p.y = 0.02; s.v.y *= -0.3; s.v.x *= 0.6; s.v.z *= 0.6; }
      const k = s.life / s.max;
      pa[n * 3] = s.p.x; pa[n * 3 + 1] = s.p.y; pa[n * 3 + 2] = s.p.z; ca[n * 3] = s.c.r * k; ca[n * 3 + 1] = s.c.g * k; ca[n * 3 + 2] = s.c.b * k; n++;
    }
    this.sparks = this.sparks.filter(s => s.life > 0);
    this.sparkGeo.setDrawRange(0, n); this.sparkGeo.attributes.position.needsUpdate = true; this.sparkGeo.attributes.color.needsUpdate = true;
  }

  // ------------------------------------------------------------ Couche 2D
  setBanner(text, dur, sub = '', slot = -1) { this.banner = { text, sub, until: performance.now() + dur * 1000, slot }; }
  draw2D() {
    const c = this.ctx2, W = innerWidth, H = innerHeight, now = performance.now();
    c.clearRect(0, 0, W, H);
    if (this.state === 'title') this.drawTitle(c, W, H);
    for (const p of this.players()) { const k = 1 - (now - p.g.hitAt) / 900; if (k > 0) { const g = c.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, H * 0.8); g.addColorStop(0, 'rgba(255,0,0,0)'); g.addColorStop(1, `rgba(255,0,0,${0.55 * k})`); c.fillStyle = g; c.fillRect(0, 0, W, H); } }
    for (const e of this.enemies) for (const t of (e.telegraphs ? e.telegraphs() : [])) {
      const s = this.project(t.pos); if (s.behind) continue;
      const k = clamp(t.k, 0, 1), x = s.x * W, y = s.y * H, r = 46 - 34 * k;
      c.strokeStyle = `rgba(255,${Math.round(90 * (1 - k))},40,${0.35 + 0.6 * k})`; c.lineWidth = 2 + 3 * k;
      c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.stroke();
      if (k > 0.75) { c.fillStyle = `rgba(255,40,40,${(k - 0.75) * 2})`; c.beginPath(); c.arc(x, y, 5, 0, Math.PI * 2); c.fill(); }
    }
    for (let i = this.ringHits.length - 1; i >= 0; i--) {
      const m = this.ringHits[i], age = (now - m.t) / (m.kind === 'from' ? 900 : 350), a = 1 - age;
      if (a <= 0) { this.ringHits.splice(i, 1); continue; }
      c.globalAlpha = a; c.strokeStyle = m.color; c.lineWidth = m.kind === 'from' ? 5 : 3;
      c.beginPath(); c.arc(m.x * W, m.y * H, m.kind === 'from' ? 30 + age * 80 : 8 + age * 26, 0, Math.PI * 2); c.stroke(); c.globalAlpha = 1;
    }
    for (const p of this.players()) {
      if (!p.g.alive) continue;
      const col = COLORS[p.slot], x = p.x * W, y = p.y * H;
      if (p.cover && this.inFight) { c.fillStyle = col; c.font = '700 20px system-ui'; c.textAlign = 'center'; c.fillText('À COUVERT', p.slot === 0 ? W * 0.25 : W * 0.75, H - 60); continue; }
      const recoil = Math.max(0, 1 - (now - p.lastFire) / 110) * 7;
      c.strokeStyle = col; c.lineWidth = 2.5;
      c.beginPath(); c.arc(x, y, 16 + recoil, 0, Math.PI * 2); c.stroke();
      c.beginPath(); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { c.moveTo(x + dx * (7 + recoil), y + dy * (7 + recoil)); c.lineTo(x + dx * 26, y + dy * 26); } c.stroke();
      c.fillStyle = col; c.beginPath(); c.arc(x, y, 2.5, 0, Math.PI * 2); c.fill();
      if (p.g.ammo === 0 && this.inFight) { c.font = '700 14px system-ui'; c.textAlign = 'center'; c.fillText('RECHARGE', x, y + 44); }
    }
    if (now < this.banner.until) {
      const left = (this.banner.until - now) / 1000, a = Math.min(1, left * 3);
      c.globalAlpha = a; c.textAlign = 'center'; c.fillStyle = this.banner.slot >= 0 ? COLORS[this.banner.slot] : '#fff';
      c.font = '900 ' + (this.banner.sub ? 54 : 64) + 'px system-ui'; c.fillText(this.banner.text, W / 2, H * 0.42);
      if (this.banner.sub) { c.font = '500 20px system-ui'; c.fillStyle = '#cdd6e2'; c.fillText(this.banner.sub, W / 2, H * 0.42 + 44); }
      c.globalAlpha = 1;
    }
  }
  drawTitle(c, W, H) {
    c.fillStyle = 'rgba(0,0,0,.45)'; c.fillRect(0, 0, W, H);
    c.textAlign = 'center'; c.fillStyle = '#fff'; c.font = '900 96px system-ui'; c.fillText('RIPOSTE', W / 2, H * 0.28);
    c.fillStyle = '#9aa4b5'; c.font = '500 18px system-ui'; c.fillText('Visez une zone et TIREZ pour la choisir', W / 2, H * 0.36);
    const cw = Math.min(300, W * 0.26), ch = 150, gap = 28, x0 = W / 2 - (cw * 3 + gap * 2) / 2, y0 = H * 0.46;
    this.menuHover = -1;
    LEVELS.forEach((L, i) => {
      const x = x0 + i * (cw + gap), y = y0;
      let hover = false;
      for (const p of this.players()) if (p.x * W > x && p.x * W < x + cw && p.y * H > y && p.y * H < y + ch) hover = true;
      if (hover) this.menuHover = i;
      c.fillStyle = hover ? 'rgba(255,255,255,.18)' : 'rgba(255,255,255,.07)'; c.strokeStyle = hover ? '#fff' : '#3a4250'; c.lineWidth = 2;
      c.beginPath(); c.roundRect(x, y, cw, ch, 12); c.fill(); c.stroke();
      const [z, n] = L.name.split(' — ');
      c.fillStyle = '#fff'; c.font = '800 20px system-ui'; c.fillText(z, x + cw / 2, y + 44);
      c.font = '700 26px system-ui'; c.fillText(n, x + cw / 2, y + 82);
      c.fillStyle = '#9aa4b5'; c.font = '400 14px system-ui'; c.fillText({ docks: 'Extérieur · boss : blindé', street: 'Ville · boss : hélicoptère', hangar: 'Intérieur · boss : le colonel' }[L.theme], x + cw / 2, y + 118);
    });
    c.fillStyle = '#7b8494'; c.font = '400 13px system-ui'; c.fillText('Échap : revenir ici à tout moment · N : musique · M : son', W / 2, H * 0.9);
  }
  updateHud() {
    for (let i = 0; i < 2; i++) {
      const p = this.net.players[i], el = $('p' + (i + 1));
      if (!p || !p.g) { el.classList.add('hidden'); continue; }
      el.classList.remove('hidden'); const g = p.g;
      el.querySelector('.lives').textContent = g.alive ? '♥'.repeat(g.lives) + '♡'.repeat(Math.max(0, this.level.lives - g.lives)) : '✕ ÉLIMINÉ';
      const pips = el.querySelector('.ammo');
      if (pips.childElementCount !== this.level.ammo) pips.innerHTML = '<i></i>'.repeat(this.level.ammo);
      [...pips.children].forEach((d, k) => d.classList.toggle('off', k >= g.ammo));
      el.querySelector('.score').textContent = String(g.score).padStart(6, '0');
      el.querySelector('.ping').textContent = p.local ? 'clavier' : (p.ping ?? '–') + ' ms';
    }
    const t = $('timer');
    if (this.inFight) { t.textContent = Math.max(0, Math.ceil(this.timer)); t.classList.toggle('urgent', this.timer <= 10); } else t.textContent = this.state === 'wait' ? '—' : '';
    $('wave').textContent = this.state === 'action' ? `Point ${this.pointIndex + 1}/${this.level.points.length} · vague ${this.waveIndex + 1}` : this.state === 'boss' ? 'BOSS' : '';
    if (this.boss && this.state === 'boss') $('bossfill').style.width = Math.round(100 * this.boss.hp / this.boss.hpMax) + '%';
  }
}

// ============================================================ Effets scriptés
class Fire {
  constructor(game, pos) { this.game = game; this.pos = pos.clone(); this.t = 0; this.done = false; this.light = new THREE.PointLight(0xff7a20, 40, 14, 1.5); this.light.position.copy(pos).add(new THREE.Vector3(0, 1, 0)); game.scene.add(this.light); }
  update(dt) { this.t += dt; this.light.intensity = 30 + Math.sin(this.t * 30) * 12; if (Math.random() < 0.5) this.game.spawnSparks(this.pos.clone().add(new THREE.Vector3(rnd(-0.6, 0.6), 0.3, rnd(-0.6, 0.6))), 0xff8030, 2, 1.2, 0.9); if (this.t > 9) this.done = true; }
  dispose() { this.game.scene.remove(this.light); }
}
class Drop {
  constructor(game, pos) { this.game = game; this.done = false; this.t = 0; this.mesh = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.5, 6), game.assets.material('container', 0xb5482a, [1, 2])); this.mesh.castShadow = true; this.mesh.position.copy(pos).add(new THREE.Vector3(0, 14, 0)); this.mesh.rotation.y = rnd(-0.4, 0.4); game.env.add(this.mesh); game.envMeshes.push(this.mesh); this.y0 = pos.y + 1.25; }
  update(dt) { this.t += dt; const y = Math.max(this.y0, this.mesh.position.y - 14 * dt * Math.min(1, this.t * 3)); if (this.mesh.position.y > this.y0 && y <= this.y0) { this.game.shake = 0.7; this.game.audio.playerHit(); this.game.spawnSparks(this.mesh.position.clone().setY(0.2), 0xaaaaaa, 60, 5, 1); this.done = true; } this.mesh.position.y = y; }
  dispose() { /* le conteneur reste dans le décor */ }
}
