import * as THREE from 'three';
import { Net } from './net.js';
import { Audio } from './audio.js';
import { LEVEL1 } from './level1.js';

// ============================================================ Réglages
const CFG = {
  fovX: 40,               // ouverture horizontale de visée (sensibilité), en degrés
  telegraphBase: 0.9,     // délai d'annonce d'un tir ennemi (s)
  telegraphMin: 0.5, telegraphMax: 1.3,
  bulletTime: 1.15,       // temps de vol d'une balle ennemie (s)
  grenadeTime: 2.2,
  moveTime: 2.6,          // durée d'un déplacement sur le rail (s)
  slowmo: 0.3, slowmoDur: 0.7,
  duckDepth: 0.75,        // baisse de caméra à couvert (m)
  yellowBonus: 5,         // secondes gagnées par ennemi jaune
};
const COLORS = ['#ff4d4d', '#4da6ff'];

const TYPES = {
  grunt:     { color: 0x7c8593, hp: 1, fireChance: 0.55, cooldown: [1.4, 2.6], accuracy: 0.45, telegraph: 1.0, score: 100 },
  red:       { color: 0xd62828, hp: 1, fireChance: 1.0,  cooldown: [1.0, 1.8], accuracy: 1.0,  telegraph: 1.0, score: 150 },
  yellow:    { color: 0xf2c14e, hp: 1, fires: false, life: 4.5, score: 500 },
  grenadier: { color: 0x3a7d44, hp: 2, fireChance: 1.0,  cooldown: [2.4, 3.4], accuracy: 1.0,  telegraph: 1.6, projectile: 'grenade', score: 200 },
  rusher:    { color: 0xd97706, hp: 2, fireChance: 1.0,  cooldown: [0.9, 1.4], accuracy: 1.0,  telegraph: 0.7, run: true, speed: 3.2, stopAt: 4.5, score: 250 },
};

const $ = id => document.getElementById(id);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smooth = t => t * t * (3 - 2 * t);
const rnd = (a, b) => a + Math.random() * (b - a);

// ============================================================ Moteur
export class Game {
  constructor() {
    this.level = LEVEL1;
    this.audio = new Audio();
    this.net = new Net({ fovX: CFG.fovX, autoCenter: true, onEvent: (t, p, d) => this.onNet(t, p, d) });
    this.state = 'lobby';
    this.timeScale = 1; this.slowmoLeft = 0;
    this.enemies = []; this.bullets = []; this.sparks = [];
    this.pointIndex = 0; this.waveIndex = 0; this.waveQueue = []; this.waveClock = 0;
    this.timer = this.level.timePerPoint; this.lastTickSec = -1;
    this.streak = 0; this.penalty = 0;
    this.moving = null; this.duck = 0; this.shake = 0;
    this.banner = { text: '', until: 0, sub: '' };
    this.ringHits = [];      // marqueurs 2D (impacts, anneaux d'annonce)
    this.stats = null;
    this._initDom(); this._initScene(); this._buildEnvironment();
    this._placeCamera(this.level.points[0]);
    this.net.start();
    $('code').textContent = this.net.code; $('url').textContent = this.net.telUrl;
    try { const q = qrcode(0, 'M'); q.addData(this.net.telUrl); q.make(); $('qr').innerHTML = q.createSvgTag({ cellSize: 4, margin: 0 }); } catch (e) { console.warn('QR', e); }
    this.clock = new THREE.Clock();
    this.render = this.render.bind(this);
    requestAnimationFrame(this.render);
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
      if (k === 'm') { this.audio.enabled = !this.audio.enabled; this.setBanner(this.audio.enabled ? 'Son activé' : 'Son coupé', 1.2); }
      if (e.key === '+' || e.key === '=') this.net.fovX = clamp(this.net.fovX + 2, 10, 90);
      if (e.key === '-') this.net.fovX = clamp(this.net.fovX - 2, 10, 90);
      if (k === 'r') this.net.autoCenter = !this.net.autoCenter;
      $('fov').textContent = this.net.fovX; $('autoc').textContent = this.net.autoCenter ? 'oui' : 'non';
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
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.05;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0e1620);
    this.scene.fog = new THREE.Fog(0x0e1620, 28, 85);
    this.camera = new THREE.PerspectiveCamera(58, 1, 0.1, 220);
    this.camBase = { pos: new THREE.Vector3(), look: new THREE.Vector3() };
    const hemi = new THREE.HemisphereLight(0x9cc0e8, 0x2a2118, 0.8); this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xffdcb0, 1.7); sun.position.set(18, 26, -8); sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048); sun.shadow.camera.near = 1; sun.shadow.camera.far = 90;
    sun.shadow.camera.left = -45; sun.shadow.camera.right = 45; sun.shadow.camera.top = 45; sun.shadow.camera.bottom = -45; sun.shadow.bias = -0.0008;
    this.scene.add(sun);
    // Points (particules) pour les étincelles et impacts
    this.sparkMax = 500;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.sparkMax * 3), 3));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(this.sparkMax * 3), 3));
    this.sparkGeo = g;
    this.sparkPts = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.12, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.sparkPts.frustumCulled = false; this.scene.add(this.sparkPts);
    this.envMeshes = []; this.raycaster = new THREE.Raycaster();
    this._resize();
  }

  _box(w, h, d, color, x, y, z, { rough = 0.85, shadow = true, env = true } = {}) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0.1 }));
    m.position.set(x, y, z); m.castShadow = shadow; m.receiveShadow = true; this.scene.add(m);
    if (env) this.envMeshes.push(m);
    return m;
  }

  _buildEnvironment() {
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(260, 260), new THREE.MeshStandardMaterial({ color: 0x2b3038, roughness: 0.95 }));
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; this.scene.add(ground); this.envMeshes.push(ground);
    // Marquages au sol
    const lineMat = new THREE.MeshStandardMaterial({ color: 0x9a8a3a, roughness: 1 });
    for (let z = 0; z > -80; z -= 8) { const l = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 4), lineMat); l.rotation.x = -Math.PI / 2; l.position.set(-9, 0.01, z - 2); this.scene.add(l); }
    // Entrepôts et grues (silhouettes)
    const palette = [0x394655, 0x4a3f3a, 0x2f4a4a, 0x50505a];
    for (let i = 0; i < 14; i++) {
      const side = i % 2 ? 1 : -1, w = rnd(6, 14), h = rnd(5, 13), d = rnd(8, 18);
      const x = side > 0 ? rnd(30, 44) : rnd(-16, -30);
      this._box(w, h, d, palette[i % palette.length], x, h / 2, -i * 6 - rnd(0, 6), { shadow: false });
    }
    for (let i = 0; i < 6; i++) { const x = rnd(-8, 28), z = -rnd(5, 70); this._box(0.5, rnd(8, 14), 0.5, 0x6b6f77, x - 2.5, 5, z, { shadow: false }); this._box(0.5, rnd(8, 14), 0.5, 0x6b6f77, x + 2.5, 5, z, { shadow: false }); this._box(6, 0.4, 0.4, 0x6b6f77, x, 9, z, { shadow: false }); }
    // Conteneurs de décor
    const cont = [0xb5482a, 0x2a6fb5, 0x3d8a3d, 0xb5a02a, 0x7a2ab5];
    for (let i = 0; i < 16; i++) {
      // Hors du couloir de jeu (x de -6 à 22) pour ne jamais masquer un ennemi
      const x = i % 2 ? rnd(24, 34) : rnd(-18, -7), z = -rnd(4, 75);
      this._box(2.4, 2.5, 6, cont[i % cont.length], x, 1.25, z);
    }
    for (let i = 0; i < 4; i++) this._box(2.4, 2.5, 6, cont[i], rnd(-4, 22), 1.25, -rnd(62, 78));
    // Couverts du joueur et caisses des ennemis, tirés du niveau
    for (const pt of this.level.points) {
      const p = new THREE.Vector3(...pt.pos), l = new THREE.Vector3(...pt.look);
      const dir = l.clone().sub(p).setY(0).normalize();
      const c = p.clone().add(dir.multiplyScalar(1.7));
      this._box(2.2, 1.15, 0.9, 0x8a6a3a, c.x, 0.575, c.z);
      for (const w of pt.waves) for (const e of w.enemies) {
        const ep = new THREE.Vector3(...e.pos), toCam = p.clone().sub(ep).setY(0).normalize();
        const cp = ep.clone().add(toCam.multiplyScalar(0.9));
        this._box(1.3, 1.0, 0.7, 0x5a5f6a, cp.x, 0.5, cp.z).lookAt(p.x, 0.5, p.z);
      }
    }
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
    if (p.local) return;
    const g = p.g;
    if (!force && g.lastAmmo === g.ammo && g.lastLives === g.lives) return;
    g.lastAmmo = g.ammo; g.lastLives = g.lives;
    this.net.send(p, { t: 'st', ammo: g.ammo, max: this.level.ammo, lives: g.lives, alive: g.alive });
  }

  onCover(p, on) {
    if (!p.g) return;
    if (on && p.g.alive && p.g.ammo < this.level.ammo && this.state !== 'lobby') { p.g.ammo = this.level.ammo; this.audio.reload(); this._pushState(p); }
  }

  onFire(p) {
    if (!p.g) return;
    if (this.state === 'lobby') { this.startGame(); return; }
    if (this.state === 'gameover') { this.continueGame(); return; }
    if (this.state === 'clear') { this.restartLevel(); return; }
    if (!p.g.alive || p.cover) return;
    if (p.g.ammo <= 0) { this.audio.empty(); this.net.send(p, { t: 'ev', k: 'empty' }); this.setBanner('RECHARGE — mets-toi à couvert', 0.8, '', p.slot); return; }
    p.g.ammo--; p.g.shots++; p.lastFire = performance.now(); this._pushState(p);
    const pan = (p.x - 0.5) * 2;
    this.audio.shot(pan * 0.3);
    this.shake = Math.min(this.shake + 0.08, 0.35);
    this.raycaster.setFromCamera(new THREE.Vector2(p.x * 2 - 1, -(p.y * 2 - 1)), this.camera);
    const targets = [];
    for (const e of this.enemies) if (e.hittable) targets.push(...e.parts);
    for (const b of this.bullets) targets.push(b.mesh);
    targets.push(...this.envMeshes);
    const hits = this.raycaster.intersectObjects(targets, false);
    if (!hits.length) return;
    const h = hits[0], o = h.object;
    this.ringHits.push({ x: p.x, y: p.y, t: performance.now(), color: COLORS[p.slot], kind: 'shot' });
    if (o.userData.enemy) { o.userData.enemy.hit(o.userData.part, p, pan); return; }
    if (o.userData.bullet) { o.userData.bullet.shotDown(p, pan); return; }
    this.spawnSparks(h.point, 0xffd080, 14, 3);
    this.audio.ricochet(pan);
  }

  // ------------------------------------------------------------ Déroulé
  startGame() {
    this.audio.init(); this.audio.resume();
    this.players().forEach(p => { this._initPlayer(p); this._pushState(p, true); });
    this.pointIndex = 0; this.waveIndex = 0; this.streak = 0; this.penalty = 0;
    $('lobby').classList.add('hidden'); $('hud').classList.remove('hidden'); $('stats').classList.add('hidden');
    this._placeCamera(this.level.points[0]);
    this.state = 'intro';
    this.setBanner(this.level.name, 2.2, 'Appuyez sur COUVRIR pour vous protéger, TIRER pour tirer.');
    this.stateClock = 0;
  }
  restartLevel() { this.clearField(); this.startGame(); }
  continueGame() {
    this.clearField();
    this.players().forEach(p => { p.g.lives = this.level.lives; p.g.ammo = this.level.ammo; p.g.alive = true; this._pushState(p); });
    $('stats').classList.add('hidden');
    this.waveIndex = 0; this.penalty = 0.2;
    this._placeCamera(this.level.points[this.pointIndex]);
    this.beginPoint();
  }
  clearField() { for (const e of this.enemies) e.dispose(); for (const b of this.bullets) b.dispose(); this.enemies = []; this.bullets = []; this.waveQueue = []; }

  beginPoint() {
    this.state = 'action'; this.timer = this.level.timePerPoint; this.lastTickSec = -1;
    this.setBanner('ACTION !', 1.2); this.audio.action();
    this.startWave();
  }
  startWave() {
    const pt = this.level.points[this.pointIndex];
    const w = pt.waves[this.waveIndex];
    this.waveQueue = w.enemies.map(e => ({ ...e })).sort((a, b) => a.delay - b.delay);
    this.waveClock = 0;
  }
  endWave() {
    const pt = this.level.points[this.pointIndex];
    this.waveIndex++;
    if (this.waveIndex < pt.waves.length) { this.startWave(); return; }
    // Point nettoyé : on avance
    this.waveIndex = 0;
    if (this.pointIndex + 1 >= this.level.points.length) { this.zoneClear(); return; }
    this.state = 'wait'; this.setBanner('ATTENDEZ !', 1.6); this.audio.wait();
    const from = this.level.points[this.pointIndex], to = this.level.points[this.pointIndex + 1];
    this.moving = { from, to, t: 0 };
    this.pointIndex++;
  }
  zoneClear() {
    this.state = 'clear'; this.audio.clear();
    this.setBanner('ZONE NETTOYÉE', 3);
    this.showStats('ZONE 1 TERMINÉE', 'TIRER pour recommencer');
  }
  gameOver() {
    this.state = 'gameover'; this.audio.gameOver();
    this.setBanner('GAME OVER', 3);
    this.showStats('GAME OVER', 'TIRER pour continuer (reprise au point actuel)');
  }
  showStats(title, hint) {
    $('stTitle').textContent = title; $('stHint').textContent = hint;
    const rows = this.players().map(p => {
      const g = p.g, acc = g.shots ? Math.round(100 * g.hits / g.shots) : 0;
      return `<div class="strow" style="color:${COLORS[p.slot]}"><b>J${p.slot + 1}</b> score ${g.score} · précision ${acc} % (${g.hits}/${g.shots}) · têtes ${g.headshots} · balles abattues ${g.bullets}</div>`;
    });
    $('stRows').innerHTML = rows.join('');
    $('stats').classList.remove('hidden');
  }

  timeOut() {
    this.audio.timeUp(); this.setBanner('TEMPS ÉCOULÉ', 1.5);
    for (const p of this.alivePlayers()) this.damagePlayer(p, null, true);
    this.timer = this.level.timePerPoint; this.lastTickSec = -1;
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

  // ------------------------------------------------------------ Caméra
  _placeCamera(pt) { this.camBase.pos.set(...pt.pos); this.camBase.look.set(...pt.look); }
  project(v3) {
    const v = v3.clone().project(this.camera);
    return { x: (v.x + 1) / 2, y: (1 - v.y) / 2, behind: v.z > 1 };
  }
  telegraphTime(type) { return clamp((CFG.telegraphBase - 0.03 * this.streak + this.penalty) * (TYPES[type].telegraph || 1), CFG.telegraphMin, CFG.telegraphMax * (TYPES[type].telegraph || 1)); }

  // ------------------------------------------------------------ Boucle
  render() {
    requestAnimationFrame(this.render);
    const raw = Math.min(this.clock.getDelta(), 0.05);
    const now = performance.now() / 1000;
    this.net.update(now);
    if (this.slowmoLeft > 0) { this.slowmoLeft -= raw; this.timeScale = this.slowmoLeft > 0 ? CFG.slowmo : 1; }
    const dt = raw * this.timeScale;
    this.update(dt, raw);
    this.updateCamera(raw);
    this.renderer.render(this.scene, this.camera);
    this.draw2D();
    this.updateHud();
  }

  update(dt, raw) {
    this.penalty = Math.max(0, this.penalty - raw * 0.08);
    if (this.state === 'intro') { this.stateClock += raw; if (this.stateClock > 2.2) this.beginPoint(); }
    if (this.state === 'wait' && this.moving) {
      this.moving.t += raw / CFG.moveTime;
      const k = smooth(clamp(this.moving.t, 0, 1));
      this.camBase.pos.lerpVectors(new THREE.Vector3(...this.moving.from.pos), new THREE.Vector3(...this.moving.to.pos), k);
      this.camBase.look.lerpVectors(new THREE.Vector3(...this.moving.from.look), new THREE.Vector3(...this.moving.to.look), k);
      if (this.moving.t >= 1) { this.moving = null; this.beginPoint(); }
    }
    if (this.state === 'action') {
      // Chrono
      this.timer -= dt;
      const sec = Math.ceil(this.timer);
      if (sec !== this.lastTickSec && sec <= 10 && sec > 0) { this.audio.tick(sec <= 5); this.lastTickSec = sec; }
      if (this.timer <= 0) this.timeOut();
      // Apparitions
      this.waveClock += dt;
      while (this.waveQueue.length && this.waveQueue[0].delay <= this.waveClock) this.enemies.push(new Enemy(this, this.waveQueue.shift()));
      // Fin de vague
      if (!this.waveQueue.length && this.enemies.every(e => e.gone || !e.alive)) this.endWave();
    }
    for (const e of this.enemies) e.update(dt);
    this.enemies = this.enemies.filter(e => { if (e.removed) e.dispose(); return !e.removed; });
    for (const b of this.bullets) b.update(dt);
    this.bullets = this.bullets.filter(b => { if (b.removed) b.dispose(); return !b.removed; });
    this.updateSparks(dt);
  }

  updateCamera(raw) {
    const alive = this.alivePlayers();
    const allCovered = alive.length > 0 && alive.every(p => p.cover) && this.state === 'action';
    this.duck += ((allCovered ? 1 : 0) - this.duck) * Math.min(1, raw * 9);
    this.shake = Math.max(0, this.shake - raw * 1.8);
    const s = this.shake * 0.06;
    const pos = this.camBase.pos.clone(); pos.y -= CFG.duckDepth * this.duck;
    pos.x += (Math.random() - 0.5) * s; pos.y += (Math.random() - 0.5) * s;
    const look = this.camBase.look.clone(); look.y -= (CFG.duckDepth + 0.5) * this.duck;
    this.camera.position.copy(pos); this.camera.lookAt(look);
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
    const pa = this.sparkGeo.attributes.position.array, ca = this.sparkGeo.attributes.color.array;
    let n = 0;
    for (const s of this.sparks) {
      s.life -= dt; if (s.life <= 0) continue;
      s.v.y -= 9 * dt; s.p.addScaledVector(s.v, dt);
      if (s.p.y < 0.02) { s.p.y = 0.02; s.v.y *= -0.3; s.v.x *= 0.6; s.v.z *= 0.6; }
      const k = s.life / s.max;
      pa[n * 3] = s.p.x; pa[n * 3 + 1] = s.p.y; pa[n * 3 + 2] = s.p.z;
      ca[n * 3] = s.c.r * k; ca[n * 3 + 1] = s.c.g * k; ca[n * 3 + 2] = s.c.b * k;
      n++;
    }
    this.sparks = this.sparks.filter(s => s.life > 0);
    this.sparkGeo.setDrawRange(0, n);
    this.sparkGeo.attributes.position.needsUpdate = true; this.sparkGeo.attributes.color.needsUpdate = true;
  }

  // ------------------------------------------------------------ Couche 2D (réticules, annonces, vignette)
  setBanner(text, dur, sub = '', slot = -1) { this.banner = { text, sub, until: performance.now() + dur * 1000, slot }; }

  draw2D() {
    const c = this.ctx2, W = innerWidth, H = innerHeight, now = performance.now();
    c.clearRect(0, 0, W, H);
    // Vignette de dégâts
    for (const p of this.players()) {
      const k = 1 - (now - p.g.hitAt) / 900;
      if (k > 0) { const g = c.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, H * 0.8); g.addColorStop(0, 'rgba(255,0,0,0)'); g.addColorStop(1, `rgba(255,0,0,${0.55 * k})`); c.fillStyle = g; c.fillRect(0, 0, W, H); }
    }
    // Annonces de tir ennemi : anneau rouge qui se referme sur l'ennemi
    for (const e of this.enemies) {
      if (e.state !== 'aim' || !e.alive) continue;
      const s = this.project(e.gunTip()); if (s.behind) continue;
      const k = clamp(e.clock / e.telegraph, 0, 1);
      const x = s.x * W, y = s.y * H, r = 46 - 34 * k;
      c.strokeStyle = `rgba(255,${Math.round(90 * (1 - k))},40,${0.35 + 0.6 * k})`; c.lineWidth = 2 + 3 * k;
      c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.stroke();
      if (k > 0.75) { c.fillStyle = `rgba(255,40,40,${(k - 0.75) * 2})`; c.beginPath(); c.arc(x, y, 5, 0, Math.PI * 2); c.fill(); }
    }
    // Marqueurs (impacts, provenance des tirs reçus)
    for (let i = this.ringHits.length - 1; i >= 0; i--) {
      const m = this.ringHits[i], age = (now - m.t) / (m.kind === 'from' ? 900 : 350), a = 1 - age;
      if (a <= 0) { this.ringHits.splice(i, 1); continue; }
      c.globalAlpha = a; c.strokeStyle = m.color; c.lineWidth = m.kind === 'from' ? 5 : 3;
      c.beginPath(); c.arc(m.x * W, m.y * H, m.kind === 'from' ? 30 + age * 80 : 8 + age * 26, 0, Math.PI * 2); c.stroke(); c.globalAlpha = 1;
    }
    // Réticules
    for (const p of this.players()) {
      if (!p.g.alive) continue;
      const col = COLORS[p.slot], x = p.x * W, y = p.y * H;
      if (p.cover) {
        c.fillStyle = col; c.font = '700 20px system-ui'; c.textAlign = 'center';
        c.fillText('À COUVERT', p.slot === 0 ? W * 0.25 : W * 0.75, H - 60);
        continue;
      }
      const recoil = Math.max(0, 1 - (now - p.lastFire) / 110) * 7;
      c.strokeStyle = col; c.lineWidth = 2.5;
      c.beginPath(); c.arc(x, y, 16 + recoil, 0, Math.PI * 2); c.stroke();
      c.beginPath();
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { c.moveTo(x + dx * (7 + recoil), y + dy * (7 + recoil)); c.lineTo(x + dx * 26, y + dy * 26); }
      c.stroke();
      c.fillStyle = col; c.beginPath(); c.arc(x, y, 2.5, 0, Math.PI * 2); c.fill();
      if (p.g.ammo === 0) { c.font = '700 14px system-ui'; c.textAlign = 'center'; c.fillText('RECHARGE', x, y + 44); }
    }
    // Bandeau
    if (now < this.banner.until) {
      const left = (this.banner.until - now) / 1000, a = Math.min(1, left * 3);
      c.globalAlpha = a; c.textAlign = 'center';
      c.fillStyle = this.banner.slot >= 0 ? COLORS[this.banner.slot] : '#fff';
      c.font = '900 ' + (this.banner.sub ? 54 : 64) + 'px system-ui'; c.fillText(this.banner.text, W / 2, H * 0.42);
      if (this.banner.sub) { c.font = '500 20px system-ui'; c.fillStyle = '#cdd6e2'; c.fillText(this.banner.sub, W / 2, H * 0.42 + 44); }
      c.globalAlpha = 1;
    }
  }

  updateHud() {
    for (let i = 0; i < 2; i++) {
      const p = this.net.players[i], el = $('p' + (i + 1));
      if (!p || !p.g) { el.classList.add('hidden'); continue; }
      el.classList.remove('hidden');
      const g = p.g;
      el.querySelector('.lives').textContent = g.alive ? '♥'.repeat(g.lives) + '♡'.repeat(Math.max(0, this.level.lives - g.lives)) : '✕ ÉLIMINÉ';
      const pips = el.querySelector('.ammo');
      if (pips.childElementCount !== this.level.ammo) pips.innerHTML = '<i></i>'.repeat(this.level.ammo);
      [...pips.children].forEach((d, k) => d.classList.toggle('off', k >= g.ammo));
      el.querySelector('.score').textContent = String(g.score).padStart(6, '0');
      el.querySelector('.ping').textContent = p.local ? 'clavier' : (p.ping ?? '–') + ' ms';
    }
    const t = $('timer');
    if (this.state === 'action') { t.textContent = Math.max(0, Math.ceil(this.timer)); t.classList.toggle('urgent', this.timer <= 10); }
    else t.textContent = this.state === 'wait' ? '—' : '';
    $('wave').textContent = this.state === 'action' ? `Point ${this.pointIndex + 1}/${this.level.points.length} · vague ${this.waveIndex + 1}` : '';
  }
}

// ============================================================ Ennemi
class Enemy {
  constructor(game, def) {
    this.game = game; this.type = def.type; this.T = TYPES[def.type];
    this.hp = this.T.hp; this.alive = true; this.gone = false; this.removed = false; this.hittable = false;
    this.state = 'rise'; this.clock = 0; this.telegraph = 1; this.cool = 0; this.legged = false; this.lifeLeft = this.T.life || Infinity;
    this.pos = new THREE.Vector3(...def.pos);
    this.group = new THREE.Group(); this.group.position.copy(this.pos); this.group.position.y = -2.1;
    this.parts = [];
    const mat = c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7 });
    const body = this.T.color, skin = 0xd9b48a, dark = 0x222528;
    const add = (geo, m, x, y, z, part) => { const mesh = new THREE.Mesh(geo, m); mesh.position.set(x, y, z); mesh.castShadow = true; mesh.userData = { enemy: this, part }; this.group.add(mesh); this.parts.push(mesh); return mesh; };
    this.legL = add(new THREE.CylinderGeometry(0.11, 0.1, 0.9, 8), mat(dark), -0.13, 0.45, 0, 'leg');
    this.legR = add(new THREE.CylinderGeometry(0.11, 0.1, 0.9, 8), mat(dark), 0.13, 0.45, 0, 'leg');
    this.torso = add(new THREE.BoxGeometry(0.5, 0.65, 0.3), mat(body), 0, 1.22, 0, 'torso');
    this.head = add(new THREE.SphereGeometry(0.17, 12, 10), mat(skin), 0, 1.75, 0, 'head');
    this.armL = add(new THREE.CylinderGeometry(0.07, 0.06, 0.6, 8), mat(body), -0.34, 1.2, 0, 'arm');
    this.armR = add(new THREE.CylinderGeometry(0.07, 0.06, 0.6, 8), mat(body), 0.34, 1.25, 0.15, 'arm');
    this.armR.rotation.x = -Math.PI / 2 + 0.2;
    this.gun = add(new THREE.BoxGeometry(0.08, 0.12, 0.45), mat(0x1a1a1a), 0.34, 1.28, 0.55, 'arm');
    // Halo d'annonce au bout du canon
    this.glow = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xff3030, transparent: true, opacity: 0, depthWrite: false }));
    this.glow.position.set(0.34, 1.28, 0.8); this.glow.scale.set(0.001, 0.001, 1); this.group.add(this.glow);
    if (this.T.projectile === 'grenade') { this.gun.scale.set(2.5, 2.5, 0.6); }
    game.scene.add(this.group);
    this.face();
  }
  face() { const c = this.game.camera.position; this.group.lookAt(c.x, this.group.position.y, c.z); }
  gunTip() { return this.gun.getWorldPosition(new THREE.Vector3()); }
  pan() { return (this.game.project(this.head.getWorldPosition(new THREE.Vector3())).x - 0.5) * 2; }

  hit(part, p, pan) {
    if (!this.alive) return;
    const g = this.game; p.g.hits++;
    const wp = this.parts.find(m => m.userData.part === part)?.getWorldPosition(new THREE.Vector3()) || this.gunTip();
    if (part === 'head') { g.spawnSparks(wp, 0xff3333, 22, 3.5); g.audio.headshot(pan); this.die(p, true); return; }
    g.spawnSparks(wp, 0xff3333, 12, 2.5); g.audio.hitFlesh(pan);
    if (part === 'leg' && !this.legged && this.hp > 0 && !this.T.run) {
      // Touché aux jambes : tombe à genoux, ne tire plus pendant 2 s, le prochain coup l'achève
      this.legged = true; this.hp = 1; this.state = 'crawl'; this.clock = 0; this.glow.material.opacity = 0;
      this.legL.visible = this.legR.visible = false; this.group.position.y = -0.72;
      return;
    }
    this.hp--;
    if (this.hp <= 0) this.die(p, false);
    else { this.torso.material.emissive = new THREE.Color(0x660000); setTimeout(() => this.torso.material.emissive.setHex(0), 90); }
  }
  die(p, headshot) {
    this.alive = false; this.hittable = false; this.state = 'die'; this.clock = 0; this.glow.material.opacity = 0;
    const g = this.game, pts = this.T.score * (headshot ? 2 : 1);
    if (p) { p.g.score += pts; if (headshot) p.g.headshots++; }
    g.streak++;
    if (this.type === 'yellow') { g.timer += CFG.yellowBonus; g.audio.bonus(); g.setBanner('+' + CFG.yellowBonus + ' s', 0.9, '', p ? p.slot : -1); }
    // Dernier ennemi de la vague : ralenti
    if (!g.waveQueue.length && g.enemies.every(e => e === this || !e.alive)) g.slowmoLeft = CFG.slowmoDur;
  }
  fire() {
    const g = this.game, alive = g.alivePlayers(); if (!alive.length) return;
    const uncovered = alive.filter(p => !p.cover);
    const target = (uncovered.length ? uncovered : alive)[Math.random() * (uncovered.length ? uncovered.length : alive.length) | 0];
    const onTarget = Math.random() < this.T.accuracy;
    g.audio.enemyShot(this.pan());
    g.bullets.push(new Bullet(g, this.gunTip(), target, onTarget, this.T.projectile || 'bullet', this.pos));
    this.glow.material.opacity = 0; this.glow.scale.set(0.001, 0.001, 1);
    this.armR.rotation.x = -Math.PI / 2 - 0.25; setTimeout(() => { this.armR.rotation.x = -Math.PI / 2 + 0.2; }, 120);
  }
  update(dt) {
    const g = this.game; this.clock += dt;
    const bob = Math.sin(performance.now() / 400 + this.pos.x) * 0.015;
    switch (this.state) {
      case 'rise': {
        const k = smooth(clamp(this.clock / 0.55, 0, 1));
        this.group.position.y = -2.1 + 2.1 * k;
        if (k >= 1) { this.hittable = true; this.enter(this.T.run ? 'run' : (this.T.fires === false ? 'idle' : 'cool')); this.cool = rnd(0.25, 0.7); }
        break; }
      case 'run': {
        const c = g.camera.position, dir = c.clone().sub(this.group.position).setY(0);
        if (dir.length() > this.T.stopAt) { dir.normalize(); this.group.position.addScaledVector(dir, this.T.speed * dt); this.pos.copy(this.group.position); this.pos.y = 0; this.face(); this.group.position.y = Math.abs(Math.sin(this.clock * 12)) * 0.08; }
        else { this.group.position.y = 0; this.enter('aim'); this.telegraph = g.telegraphTime(this.type); }
        break; }
      case 'idle': {
        this.group.position.y = bob; this.lifeLeft -= dt;
        if (this.lifeLeft <= 0) { this.enter('leave'); }
        break; }
      case 'cool': {
        this.group.position.y = bob; this.cool -= dt;
        if (this.cool <= 0) {
          if (Math.random() < this.T.fireChance) { this.enter('aim'); this.telegraph = g.telegraphTime(this.type); g.audio.lock(this.pan()); }
          else this.cool = rnd(...this.T.cooldown);
        }
        break; }
      case 'aim': {
        const k = clamp(this.clock / this.telegraph, 0, 1);
        this.glow.material.opacity = 0.2 + 0.8 * k; const s = 0.15 + 0.35 * k; this.glow.scale.set(s, s, 1);
        if (k >= 1) { this.fire(); this.enter('cool'); this.cool = rnd(...this.T.cooldown); }
        break; }
      case 'crawl': {
        if (this.clock > 2.0) { this.enter('cool'); this.cool = rnd(0.6, 1.2); }
        break; }
      case 'leave': {
        this.hittable = false; this.group.position.y -= 3 * dt;
        if (this.group.position.y < -2.2) { this.gone = true; this.removed = true; }
        break; }
      case 'die': {
        const k = clamp(this.clock / 0.55, 0, 1);
        this.group.rotation.x = -1.35 * smooth(k);
        if (this.clock > 1.1) this.group.position.y -= 1.5 * dt;
        if (this.clock > 2.3) { this.gone = true; this.removed = true; }
        break; }
    }
  }
  enter(s) { this.state = s; this.clock = 0; }
  dispose() { this.game.scene.remove(this.group); for (const m of this.parts) { m.geometry.dispose(); m.material.dispose(); } }
}

// ============================================================ Projectile ennemi (abattable)
class Bullet {
  constructor(game, from, target, onTarget, kind, srcPos) {
    this.game = game; this.target = target; this.onTarget = onTarget; this.kind = kind; this.removed = false; this.src = srcPos.clone();
    this.t = 0; this.dur = kind === 'grenade' ? CFG.grenadeTime : CFG.bulletTime;
    this.from = from.clone();
    const cam = game.camBase.pos.clone(); cam.x += target.slot === 0 ? -0.18 : 0.18;
    // Tir raté : passe à côté (décalage latéral/vertical net)
    if (!onTarget) { cam.x += (Math.random() < 0.5 ? -1 : 1) * rnd(1.0, 1.8); cam.y += rnd(-0.4, 0.9); }
    this.to = cam;
    const r = kind === 'grenade' ? 0.2 : 0.09;
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), new THREE.MeshStandardMaterial({ color: kind === 'grenade' ? 0x3b6b2a : 0xffe08a, emissive: kind === 'grenade' ? 0x102008 : 0xffb020, emissiveIntensity: kind === 'grenade' ? 0.4 : 1.6, roughness: 0.4 }));
    if (kind !== 'grenade') m.scale.set(1, 1, 2.6);
    m.userData = { bullet: this }; m.position.copy(from); m.lookAt(this.to);
    this.mesh = m; game.scene.add(m);
    if (kind !== 'grenade') { const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.03, 1.2, 6), new THREE.MeshBasicMaterial({ color: 0xffd070, transparent: true, opacity: 0.5 })); tr.rotation.x = Math.PI / 2; tr.position.z = -0.7; m.add(tr); }
  }
  update(dt) {
    this.t += dt / this.dur;
    if (this.t >= 1) { this.arrive(); return; }
    const p = this.from.clone().lerp(this.to, this.t);
    if (this.kind === 'grenade') { p.y += Math.sin(this.t * Math.PI) * 2.2; this.mesh.rotation.x += dt * 6; }
    this.mesh.position.copy(p);
    if (this.kind !== 'grenade') this.mesh.lookAt(this.to);
  }
  arrive() {
    this.removed = true;
    const g = this.game, p = this.target, pan = (this.to.x - g.camBase.pos.x);
    if (this.onTarget && p.g.alive && !p.cover) { g.damagePlayer(p, this.src); }
    else { g.audio.whoosh(clamp(pan, -1, 1)); if (this.kind === 'grenade') g.spawnSparks(this.mesh.position, 0xffa040, 30, 5, 0.8); }
  }
  shotDown(p, pan) {
    this.removed = true; p.g.hits++; p.g.bullets++;
    const g = this.game;
    p.g.score += this.kind === 'grenade' ? 150 : 50;
    g.spawnSparks(this.mesh.position, this.kind === 'grenade' ? 0xffa040 : 0xfff0a0, this.kind === 'grenade' ? 40 : 16, this.kind === 'grenade' ? 6 : 4, 0.7);
    g.audio.bulletPop(pan);
  }
  dispose() { this.game.scene.remove(this.mesh); this.mesh.geometry.dispose(); this.mesh.material.dispose(); }
}
