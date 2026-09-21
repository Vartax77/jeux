import * as THREE from 'three';
import { Bullet, clamp, rnd, smooth } from './entities.js';
import { ProcCharacter } from './characters.js';

const mat = (c, extra = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, metalness: 0.35, ...extra });

// Interface commune avec Enemy : hittable, parts, alive, gone, removed, update, hit, telegraphs, dispose + hp/hpMax/name
class BossBase {
  constructor(game, def) {
    this.game = game; this.def = def; this.pos = new THREE.Vector3(...def.pos);
    this.alive = true; this.gone = false; this.removed = false; this.hittable = true; this.isBoss = true;
    this.state = 'enter'; this.clock = 0; this.parts = []; this.tele = []; this.fireTimer = 0; this.spawnTimer = 0;
    this.group = new THREE.Group(); this.group.position.copy(this.pos); game.scene.add(this.group);
  }
  add(geo, m, x, y, z, part, parent = this.group) { const mesh = new THREE.Mesh(geo, m); mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; mesh.userData = { part, enemy: this }; parent.add(mesh); if (part) this.parts.push(mesh); return mesh; }
  face() { const c = this.game.camera.position; this.group.lookAt(c.x, this.group.position.y, c.z); }
  pan(v) { return (this.game.project(v || this.group.position).x - 0.5) * 2; }
  telegraphs() { return this.tele; }
  shootAt(from, kind = 'bullet', onTarget = true) {
    const g = this.game, alive = g.alivePlayers(); if (!alive.length) return;
    const un = alive.filter(p => !p.cover), pool = un.length ? un : alive;
    const target = pool[Math.random() * pool.length | 0];
    g.audio.enemyShot(this.pan(from));
    g.bullets.push(new Bullet(g, from, target, onTarget, kind, from));
  }
  armorHit(wp, pan) { this.game.spawnSparks(wp, 0xffd080, 14, 3); this.game.audio.ricochet(pan); }
  damage(n, p, wp, pan) {
    this.hp = Math.max(0, this.hp - n); p.g.hits++; p.g.score += 40 * n;
    this.game.spawnSparks(wp, 0xffa040, 18, 3.5); this.game.audio.hitFlesh(pan);
    if (this.hp <= 0) this.die(p);
  }
  die(p) {
    this.alive = false; this.hittable = false; this.state = 'die'; this.clock = 0; this.tele = [];
    if (p) p.g.score += 2000;
    this.game.streak += 3; this.game.onEnemyDied(this);
  }
  minions() { return this.game.enemies.filter(e => e !== this && e.alive).length; }
  explosionTick(dt, center) { this.expT = (this.expT || 0) + dt; if (this.expT > 0.12) { this.expT = 0; const c = center.clone().add(new THREE.Vector3(rnd(-2, 2), rnd(0, 2), rnd(-2, 2))); this.game.spawnSparks(c, 0xffa040, 40, 6, 0.9); this.game.audio.bulletPop(this.pan(c)); this.game.shake = Math.max(this.game.shake, 0.4); } }
  dispose() { this.game.scene.remove(this.group); this.group.traverse(o => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } }); }
}

// ============================================================ BLINDÉ — quatre panneaux faibles qui s'ouvrent à tour de rôle
export class TankBoss extends BossBase {
  constructor(game, def) {
    super(game, def); this.name = 'BLINDÉ « MARTEAU »';
    const body = mat(0x4a5a4a), dark = mat(0x2b2f33);
    this.add(new THREE.BoxGeometry(4.2, 1.5, 5.4), body, 0, 1.05, 0, 'armor');
    this.add(new THREE.BoxGeometry(4.6, 0.5, 5.6), dark, 0, 0.35, 0, 'armor');
    for (const s of [-1, 1]) for (let i = 0; i < 5; i++) this.add(new THREE.CylinderGeometry(0.42, 0.42, 0.5, 10), dark, s * 2.15, 0.45, -2 + i, 'armor').rotation.z = Math.PI / 2;
    this.turret = this.add(new THREE.BoxGeometry(2.2, 0.9, 2.6), body, 0, 2.25, 0, 'armor');
    this.barrel = this.add(new THREE.CylinderGeometry(0.14, 0.16, 2.6, 10), dark, 0, 2.3, 2.2, 'armor'); this.barrel.rotation.x = Math.PI / 2;
    this.panels = [];
    const spots = [[-1.35, 1.1], [1.35, 1.1], [-0.75, 1.85], [0.75, 1.85]];
    spots.forEach(([x, y], i) => { const m = this.add(new THREE.BoxGeometry(0.75, 0.6, 0.16), mat(0x2f3540, { emissive: 0x000000 }), x, y, 2.78, 'weak'); m.userData.idx = i; this.panels.push({ mesh: m, hp: 3, open: false, dead: false }); });
    this.hpMax = 12; this.hp = 12; this.cycle = 0; this.face();
    this.group.position.y = -3;
  }
  hit(part, p, pan, mesh) {
    if (!this.alive) return;
    if (part === 'weak') {
      const target = mesh && mesh.userData.idx !== undefined ? this.panels[mesh.userData.idx] : null;
      if (!target || !target.open || target.dead) { this.armorHit(mesh ? mesh.getWorldPosition(new THREE.Vector3()) : this.group.position.clone(), pan); return; }
      target.hp--; const wp = target.mesh.getWorldPosition(new THREE.Vector3());
      if (target.hp <= 0) { target.dead = true; target.open = false; target.mesh.material.emissive.setHex(0x000000); target.mesh.material.color.setHex(0x111111); this.game.spawnSparks(wp, 0xffa040, 40, 6, 0.9); this.game.shake = 0.35; }
      this.damage(1, p, wp, pan); return;
    }
    this.armorHit(this.group.position.clone().add(new THREE.Vector3(0, 1.5, 2.5)), pan);
  }
  setOpen(q, on) { q.open = on; q.mesh.material.emissive.setHex(on ? 0xff5a1a : 0x000000); q.mesh.material.emissiveIntensity = on ? 1.4 : 0; q.mesh.position.z = on ? 3.1 : 2.78; }
  update(dt) {
    const g = this.game; this.clock += dt;
    if (this.state === 'enter') { this.group.position.y = -3 + 3 * smooth(clamp(this.clock / 2, 0, 1)); if (this.clock >= 2) { this.state = 'closed'; this.clock = 0; } return; }
    if (this.state === 'die') { this.explosionTick(dt, this.group.position.clone().add(new THREE.Vector3(0, 1.5, 0))); if (this.clock > 2.2) this.group.position.y -= 1.5 * dt; if (this.clock > 4) { this.gone = true; this.removed = true; } return; }
    // Cycle des panneaux : fermé 2 s, ouvert (2 panneaux) 3 s
    this.cycle -= dt;
    if (this.cycle <= 0) {
      const anyOpen = this.panels.some(q => q.open);
      for (const q of this.panels) if (q.open) this.setOpen(q, false);
      if (!anyOpen) { const alive = this.panels.filter(q => !q.dead).sort(() => Math.random() - 0.5); alive.slice(0, 2).forEach(q => this.setOpen(q, true)); this.cycle = 3.0; g.audio.lock(this.pan()); }
      else this.cycle = 2.0;
    }
    // Tir : annonce 1,1 s puis rafale de 3
    this.fireTimer += dt;
    const tip = this.barrel.localToWorld(new THREE.Vector3(0, 1.3, 0));
    const period = 2.6, ann = 1.1;
    const ph = this.fireTimer % period;
    this.tele = ph > period - ann ? [{ pos: tip, k: (ph - (period - ann)) / ann }] : [];
    if (this.fireTimer >= period) { this.fireTimer -= period; this.burst = 3; this.burstT = 0; }
    if (this.burst > 0) { this.burstT -= dt; if (this.burstT <= 0) { this.shootAt(tip); this.burst--; this.burstT = 0.16; g.shake = Math.max(g.shake, 0.15); } }
    // Renforts toutes les 12 s
    this.spawnTimer += dt;
    if (this.spawnTimer > 12 && this.minions() < 4) { this.spawnTimer = 0; g.spawnEnemy({ type: 'grunt', pos: [this.pos.x - 5, 0, this.pos.z + 4] }); g.spawnEnemy({ type: 'grunt', pos: [this.pos.x + 5, 0, this.pos.z + 4] }); }
  }
}

// ============================================================ HÉLICOPTÈRE — balaie, s'immobilise pour larguer des hommes : moteur exposé
export class HeliBoss extends BossBase {
  constructor(game, def) {
    super(game, def); this.name = 'HÉLICOPTÈRE « FRELON »';
    const body = mat(0x2f3a4a), dark = mat(0x1e2228);
    this.add(new THREE.BoxGeometry(1.8, 1.5, 4.6), body, 0, 0, 0, 'armor');
    this.add(new THREE.BoxGeometry(1.2, 1.0, 1.4), mat(0x9bc4e8, { roughness: 0.2, metalness: 0.1 }), 0, 0.15, 2.4, 'armor');
    this.add(new THREE.BoxGeometry(0.5, 0.5, 4.5), body, 0, 0.3, -4.2, 'armor');
    this.add(new THREE.BoxGeometry(0.15, 1.4, 0.8), body, 0, 0.9, -6.2, 'armor');
    for (const s of [-1, 1]) this.add(new THREE.BoxGeometry(0.15, 0.15, 3.2), dark, s * 0.9, -1.1, 0, 'armor');
    // Point faible : réservoir ventral, visible depuis le sol (une trappe au sommet ne se verrait jamais d'en bas)
    this.engine = this.add(new THREE.BoxGeometry(1.1, 0.55, 1.6), mat(0x3a3f47, { emissive: 0x000000 }), 0, -0.95, 0.4, 'weak');
    this.rotor = new THREE.Group(); this.rotor.position.set(0, 1.3, -0.3); this.group.add(this.rotor);
    for (const a of [0, Math.PI / 2]) { const b = this.add(new THREE.BoxGeometry(9, 0.06, 0.35), dark, 0, 0, 0, 'armor', this.rotor); b.rotation.y = a; b.castShadow = false; }
    this.tail = this.add(new THREE.BoxGeometry(1.6, 0.05, 0.2), dark, 0.2, 0.9, -6.2, 'armor'); this.tail.rotation.z = Math.PI / 2;
    this.hpMax = 14; this.hp = 14; this.cycleT = 0; this.phase = 'strafe'; this.x0 = def.pos[0]; this.y0 = def.pos[1];
    this.group.position.y = this.y0 + 14; this.face();
  }
  hit(part, p, pan) {
    if (!this.alive) return;
    const wp = this.engine.getWorldPosition(new THREE.Vector3());
    if (part === 'weak' && this.phase === 'hover') { this.damage(1, p, wp, pan); return; }
    this.armorHit(part === 'weak' ? wp : this.group.position.clone(), pan);
  }
  update(dt) {
    const g = this.game; this.clock += dt;
    this.rotor.rotation.y += dt * (this.alive ? 28 : 6);
    if (this.state === 'enter') { this.group.position.y = this.y0 + 14 * (1 - smooth(clamp(this.clock / 2.5, 0, 1))); this.face(); if (this.clock >= 2.5) { this.state = 'fight'; this.clock = 0; } return; }
    if (this.state === 'die') {
      this.group.rotation.z += dt * 2.5; this.group.position.y -= 3 * dt; this.group.position.x += dt * 1.5;
      this.explosionTick(dt, this.group.position);
      if (this.group.position.y < 0.5) { if (!this.boomed) { this.boomed = true; g.spawnSparks(this.group.position, 0xffa040, 200, 9, 1.4); g.shake = 0.9; g.audio.playerHit(); } this.gone = true; this.removed = true; }
      return;
    }
    this.cycleT += dt;
    if (this.phase === 'strafe') {
      this.group.position.x = this.x0 + Math.sin(this.cycleT * 1.05) * 7;
      this.group.position.y = this.y0 + Math.sin(this.cycleT * 2.1) * 0.5;
      this.group.rotation.z = -Math.cos(this.cycleT * 1.05) * 0.25;
      this.face(); this.group.rotation.z = -Math.cos(this.cycleT * 1.05) * 0.25;
      this.fireTimer += dt;
      const tip = this.group.localToWorld(new THREE.Vector3(0, -0.6, 2.6));
      const period = 1.8, ann = 0.9, ph = this.fireTimer % period;
      this.tele = ph > period - ann ? [{ pos: tip, k: (ph - (period - ann)) / ann }] : [];
      if (this.fireTimer >= period) { this.fireTimer -= period; this.burst = 2; this.burstT = 0; }
      if (this.burst > 0) { this.burstT -= dt; if (this.burstT <= 0) { this.shootAt(tip, 'bullet', Math.random() < 0.8); this.burst--; this.burstT = 0.14; } }
      if (this.cycleT > 6) { this.phase = 'hover'; this.cycleT = 0; this.tele = []; this.engine.material.emissive.setHex(0xff6a1a); this.engine.material.emissiveIntensity = 1.5; g.audio.lock(this.pan()); this.dropped = false; }
    } else {
      this.group.rotation.z *= 0.9; this.group.position.y = this.y0 - 1.5 + Math.sin(this.cycleT * 3) * 0.15;
      if (!this.dropped && this.cycleT > 0.8 && this.minions() < 4) { this.dropped = true; const x = this.group.position.x, z = this.pos.z + 6; g.spawnEnemy({ type: 'grunt', pos: [x - 2, 0, z] }); g.spawnEnemy({ type: 'rusher', pos: [x + 2, 0, z] }); }
      if (this.cycleT > 3.2) { this.phase = 'strafe'; this.cycleT = 0; this.engine.material.emissive.setHex(0x000000); this.fireTimer = 0; }
    }
  }
}

// ============================================================ CHEF — bouclier ; s'expose quand il lance une grenade
export class ChiefBoss extends BossBase {
  constructor(game, def) {
    super(game, def); this.name = 'LE COLONEL';
    this.char = new ProcCharacter(0x5b1d8a, { scale: 1.3 });
    this.group.add(this.char.group);
    for (const m of this.char.parts) { m.userData.enemy = this; this.parts.push(m); }
    this.shield = this.add(new THREE.BoxGeometry(1.1, 1.5, 0.1), mat(0x3a4a5a, { metalness: 0.7, roughness: 0.3 }), 0, -0.55, 0.25, 'shield', this.char.armL);
    this.shield.add(new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.8, 0.02), mat(0xd62828)));
    this.shield.children[0].position.z = 0.06;
    this.hpMax = 10; this.hp = 10; this.phase = 'guard'; this.phaseT = 0;
    this.char.armL.rotation.x = 0.35; this.char.armL.rotation.y = -0.3;
    this.group.position.y = -2.5; this.face();
  }
  hit(part, p, pan) {
    if (!this.alive) return;
    const wp = this.char.head.getWorldPosition(new THREE.Vector3());
    if (part === 'shield' || (this.phase === 'guard' && (part === 'torso' || part === 'head'))) { this.armorHit(this.shield.getWorldPosition(new THREE.Vector3()), pan); return; }
    if (part === 'head') { this.damage(2, p, wp, pan); this.game.audio.headshot(pan); return; }
    this.damage(1, p, wp, pan);
  }
  update(dt) {
    const g = this.game; this.clock += dt; this.char.update(dt);
    if (this.state === 'enter') { this.group.position.y = -2.5 + 2.5 * smooth(clamp(this.clock / 1.2, 0, 1)); if (this.clock >= 1.2) { this.state = 'fight'; this.clock = 0; this.char.play('aim'); } return; }
    if (this.state === 'die') { if (this.clock === dt) this.char.play('die'); if (this.clock > 2) this.group.position.y -= 1.5 * dt; if (this.clock > 3.4) { this.gone = true; this.removed = true; } return; }
    this.phaseT += dt;
    const tip = this.char.gunTip();
    if (this.phase === 'guard') {
      this.char.armL.rotation.x += (0.35 - this.char.armL.rotation.x) * Math.min(1, dt * 8);
      this.fireTimer += dt;
      const period = 2.0, ann = 0.8, ph = this.fireTimer % period;
      this.tele = ph > period - ann ? [{ pos: tip, k: (ph - (period - ann)) / ann }] : [];
      if (this.fireTimer >= period) { this.fireTimer -= period; this.shootAt(tip, 'bullet', true); this.char.play('shoot'); setTimeout(() => this.alive && this.char.play('aim'), 250); }
      if (this.phaseT > 4) { this.phase = 'throw'; this.phaseT = 0; this.tele = []; g.audio.lock(this.pan()); }
    } else {
      // Bouclier baissé : tête et torse exposés, annonce longue puis grenade
      this.char.armL.rotation.x += (1.6 - this.char.armL.rotation.x) * Math.min(1, dt * 6);
      const ann = 1.5;
      this.tele = [{ pos: tip, k: clamp(this.phaseT / ann, 0, 1) }];
      if (this.phaseT >= ann && !this.thrown) { this.thrown = true; this.shootAt(tip, 'grenade', true); }
      if (this.phaseT > 2.3) { this.phase = 'guard'; this.phaseT = 0; this.thrown = false; this.fireTimer = 0; }
    }
    this.spawnTimer += dt;
    if (this.spawnTimer > 10 && this.minions() < 3) { this.spawnTimer = 0; g.spawnEnemy({ type: 'rusher', pos: [this.pos.x + (Math.random() < 0.5 ? -6 : 6), 0, this.pos.z + 2] }); }
  }
  dispose() { super.dispose(); this.char.dispose(); }
}

export function makeBoss(game, def) {
  return def.type === 'tank' ? new TankBoss(game, def) : def.type === 'heli' ? new HeliBoss(game, def) : new ChiefBoss(game, def);
}
