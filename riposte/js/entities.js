import * as THREE from 'three';
import { makeCharacter } from './characters.js';

export const CFG = {
  telegraphBase: 0.9, telegraphMin: 0.5, telegraphMax: 1.3,
  bulletTime: 1.15, grenadeTime: 2.2,
  yellowBonus: 5,
};
export const TYPES = {
  grunt:     { color: 0x7c8593, hp: 1, fireChance: 0.55, cooldown: [1.4, 2.6], accuracy: 0.45, telegraph: 1.0, score: 100 },
  red:       { color: 0xd62828, hp: 1, fireChance: 1.0,  cooldown: [1.0, 1.8], accuracy: 1.0,  telegraph: 1.0, score: 150 },
  yellow:    { color: 0xf2c14e, hp: 1, fires: false, life: 4.5, score: 500 },
  grenadier: { color: 0x3a7d44, hp: 2, fireChance: 1.0,  cooldown: [2.4, 3.4], accuracy: 1.0,  telegraph: 1.6, projectile: 'grenade', score: 200 },
  rusher:    { color: 0xd97706, hp: 2, fireChance: 1.0,  cooldown: [0.9, 1.4], accuracy: 1.0,  telegraph: 0.7, run: true, speed: 3.2, stopAt: 4.5, score: 250 },
};
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const smooth = t => t * t * (3 - 2 * t);
export const rnd = (a, b) => a + Math.random() * (b - a);

// ============================================================ Ennemi
export class Enemy {
  constructor(game, def) {
    this.game = game; this.type = def.type; this.T = TYPES[def.type];
    this.hp = this.T.hp; this.alive = true; this.gone = false; this.removed = false; this.hittable = false;
    this.state = 'rise'; this.clock = 0; this.telegraph = 1; this.cool = 0; this.legged = false; this.lifeLeft = this.T.life || Infinity;
    this.pos = new THREE.Vector3(...def.pos); this.baseY = def.pos[1];
    this.char = makeCharacter(game.assets, this.T.color);
    this.group = this.char.group; this.parts = this.char.parts;
    for (const m of this.parts) m.userData.enemy = this;
    this.group.position.copy(this.pos); this.group.position.y = this.baseY - 2.1;
    // Halo d'annonce
    this.glow = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xff3030, transparent: true, opacity: 0, depthWrite: false }));
    this.glow.scale.set(0.001, 0.001, 1); game.scene.add(this.glow);
    game.scene.add(this.group);
    this.face();
  }
  face() { const c = this.game.camera.position; this.group.lookAt(c.x, this.group.position.y, c.z); }
  gunTip() { return this.char.gunTip(); }
  headPos() { const h = this.parts.find(m => m.userData.part === 'head'); return h ? h.getWorldPosition(new THREE.Vector3()) : this.group.position.clone().add(new THREE.Vector3(0, 1.7, 0)); }
  pan() { return (this.game.project(this.headPos()).x - 0.5) * 2; }
  telegraphs() { return this.state === 'aim' && this.alive ? [{ pos: this.gunTip(), k: clamp(this.clock / this.telegraph, 0, 1) }] : []; }

  hit(part, p, pan) {
    if (!this.alive) return;
    const g = this.game; p.g.hits++;
    const mesh = this.parts.find(m => m.userData.part === part);
    const wp = mesh ? mesh.getWorldPosition(new THREE.Vector3()) : this.gunTip();
    if (part === 'head') { g.spawnSparks(wp, 0xff3333, 22, 3.5); g.audio.headshot(pan); this.die(p, true); return; }
    g.spawnSparks(wp, 0xff3333, 12, 2.5); g.audio.hitFlesh(pan);
    if (part === 'leg' && !this.legged && !this.T.run) {
      this.legged = true; this.hp = 1; this.enter('crawl'); this.glow.material.opacity = 0; this.char.kneel();
      return;
    }
    this.hp--;
    if (this.hp <= 0) this.die(p, false); else this.flash();
  }
  flash() { this.group.traverse(o => { if (o.isMesh && o.material && o.material.emissive && o.userData.part) { o.material.emissive.setHex(0x660000); setTimeout(() => o.material.emissive.setHex(0), 90); } }); }
  die(p, headshot) {
    this.alive = false; this.hittable = false; this.enter('die'); this.glow.material.opacity = 0;
    this.char.play('die');
    const g = this.game, pts = this.T.score * (headshot ? 2 : 1);
    if (p) { p.g.score += pts; if (headshot) p.g.headshots++; }
    g.streak++;
    if (this.type === 'yellow') { g.timer += CFG.yellowBonus; g.audio.bonus(); g.setBanner('+' + CFG.yellowBonus + ' s', 0.9, '', p ? p.slot : -1); }
    g.onEnemyDied(this);
  }
  fire() {
    const g = this.game, alive = g.alivePlayers(); if (!alive.length) return;
    const uncovered = alive.filter(p => !p.cover);
    const pool = uncovered.length ? uncovered : alive;
    const target = pool[Math.random() * pool.length | 0];
    const onTarget = Math.random() < this.T.accuracy;
    g.audio.enemyShot(this.pan());
    g.bullets.push(new Bullet(g, this.gunTip(), target, onTarget, this.T.projectile || 'bullet', this.headPos()));
    this.glow.material.opacity = 0; this.glow.scale.set(0.001, 0.001, 1);
    this.char.play('shoot');
  }
  update(dt) {
    const g = this.game; this.clock += dt;
    this.char.update(dt);
    switch (this.state) {
      case 'rise': {
        const k = smooth(clamp(this.clock / 0.55, 0, 1));
        this.group.position.y = this.baseY - 2.1 + 2.1 * k;
        if (k >= 1) { this.hittable = true; if (this.T.run) { this.enter('run'); this.char.play('run'); } else if (this.T.fires === false) this.enter('idle'); else { this.enter('cool'); this.cool = rnd(0.25, 0.7); } }
        break; }
      case 'run': {
        const c = g.camera.position, dir = c.clone().sub(this.group.position).setY(0);
        if (dir.length() > this.T.stopAt) { dir.normalize(); this.group.position.addScaledVector(dir, this.T.speed * dt); this.pos.copy(this.group.position); this.pos.y = this.baseY; this.face(); }
        else { this.enter('aim'); this.telegraph = g.telegraphTime(this.type); this.char.play('aim'); }
        break; }
      case 'idle': { this.lifeLeft -= dt; if (this.lifeLeft <= 0) this.enter('leave'); break; }
      case 'cool': {
        this.cool -= dt;
        if (this.cool <= 0) {
          if (Math.random() < this.T.fireChance) { this.enter('aim'); this.telegraph = g.telegraphTime(this.type); this.char.play('aim'); g.audio.lock(this.pan()); }
          else { this.cool = rnd(...this.T.cooldown); this.char.play('idle'); }
        }
        break; }
      case 'aim': {
        const k = clamp(this.clock / this.telegraph, 0, 1);
        this.glow.position.copy(this.gunTip());
        this.glow.material.opacity = 0.2 + 0.8 * k; const s = 0.15 + 0.35 * k; this.glow.scale.set(s, s, 1);
        if (k >= 1) { this.fire(); this.enter('cool'); this.cool = rnd(...this.T.cooldown); }
        break; }
      case 'crawl': { if (this.clock > 2.0) { this.enter('cool'); this.cool = rnd(0.6, 1.2); } break; }
      case 'leave': { this.hittable = false; this.group.position.y -= 3 * dt; if (this.group.position.y < this.baseY - 2.2) { this.gone = true; this.removed = true; } break; }
      case 'die': {
        if (!this.char.hasAnim('die')) { /* animation gérée par le personnage procédural */ }
        if (this.clock > 1.4) this.group.position.y -= 1.5 * dt;
        if (this.clock > 2.6) { this.gone = true; this.removed = true; }
        break; }
    }
  }
  enter(s) { this.state = s; this.clock = 0; }
  dispose() { this.game.scene.remove(this.group); this.game.scene.remove(this.glow); this.glow.material.dispose(); this.char.dispose(); }
}

// ============================================================ Projectile ennemi (abattable)
export class Bullet {
  constructor(game, from, target, onTarget, kind, srcPos) {
    this.game = game; this.target = target; this.onTarget = onTarget; this.kind = kind; this.removed = false; this.src = srcPos.clone();
    this.t = 0; this.dur = kind === 'grenade' ? CFG.grenadeTime : CFG.bulletTime;
    this.from = from.clone();
    const cam = game.camBase.pos.clone(); cam.x += target.slot === 0 ? -0.18 : 0.18;
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
    if (this.onTarget && p.g && p.g.alive && !p.cover) g.damagePlayer(p, this.src);
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
