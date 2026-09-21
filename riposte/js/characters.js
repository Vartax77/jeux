import * as THREE from 'three';
import { clone as skClone } from '../lib/jsm/utils/SkeletonUtils.js';

// Interface commune : group, parts (maillages cliquables, userData.part ∈ head|torso|arm|leg), gunTip(),
// play(name), update(dt), kneel(), hasAnim(name), dispose()

const mat = (c, extra = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7, ...extra });

// ------------------------------------------------------------ Procédural (toujours disponible)
export class ProcCharacter {
  constructor(color, { scale = 1, helmet = true, vest = true } = {}) {
    this.group = new THREE.Group(); this.parts = []; this.anim = 'idle'; this.t = 0; this.kneeling = false;
    const skin = 0xd9b48a, dark = 0x23262b, vestC = new THREE.Color(color).multiplyScalar(0.55).getHex();
    const add = (geo, m, x, y, z, part, parent = this.group) => { const mesh = new THREE.Mesh(geo, m); mesh.position.set(x, y, z); mesh.castShadow = true; mesh.userData = { part }; parent.add(mesh); if (part) this.parts.push(mesh); return mesh; };
    // Hanches = pivot des jambes ; torse pivot au-dessus
    this.hips = new THREE.Group(); this.hips.position.y = 0.9; this.group.add(this.hips);
    this.legL = new THREE.Group(); this.legL.position.set(-0.13, 0, 0); this.hips.add(this.legL);
    this.legR = new THREE.Group(); this.legR.position.set(0.13, 0, 0); this.hips.add(this.legR);
    add(new THREE.CylinderGeometry(0.11, 0.09, 0.88, 8), mat(dark), 0, -0.45, 0, 'leg', this.legL);
    add(new THREE.CylinderGeometry(0.11, 0.09, 0.88, 8), mat(dark), 0, -0.45, 0, 'leg', this.legR);
    add(new THREE.BoxGeometry(0.16, 0.08, 0.26), mat(0x111111), 0, -0.88, 0.04, null, this.legL);
    add(new THREE.BoxGeometry(0.16, 0.08, 0.26), mat(0x111111), 0, -0.88, 0.04, null, this.legR);
    this.torsoG = new THREE.Group(); this.torsoG.position.y = 0.9; this.group.add(this.torsoG);
    add(new THREE.BoxGeometry(0.5, 0.66, 0.3), mat(color), 0, 0.33, 0, 'torso', this.torsoG);
    if (vest) add(new THREE.BoxGeometry(0.44, 0.42, 0.34), mat(vestC), 0, 0.3, 0, 'torso', this.torsoG);
    add(new THREE.BoxGeometry(0.54, 0.08, 0.34), mat(0x111111), 0, 0.04, 0, null, this.torsoG);
    this.neck = add(new THREE.CylinderGeometry(0.06, 0.07, 0.1, 8), mat(skin), 0, 0.7, 0, null, this.torsoG);
    this.head = add(new THREE.SphereGeometry(0.17, 12, 10), mat(skin), 0, 0.86, 0, 'head', this.torsoG);
    if (helmet) { const h = add(new THREE.SphereGeometry(0.19, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(vestC), 0, 0.86, 0, 'head', this.torsoG); h.scale.set(1, 1.05, 1); }
    add(new THREE.BoxGeometry(0.3, 0.05, 0.02), mat(0x111111), 0, 0.85, 0.16, null, this.torsoG); // visière/lunettes
    this.armL = new THREE.Group(); this.armL.position.set(-0.33, 0.6, 0); this.torsoG.add(this.armL);
    add(new THREE.CylinderGeometry(0.07, 0.06, 0.6, 8), mat(color), 0, -0.3, 0, 'arm', this.armL);
    this.armR = new THREE.Group(); this.armR.position.set(0.33, 0.6, 0); this.torsoG.add(this.armR);
    add(new THREE.CylinderGeometry(0.07, 0.06, 0.6, 8), mat(color), 0, -0.3, 0, 'arm', this.armR);
    this.gun = add(new THREE.BoxGeometry(0.08, 0.12, 0.5), mat(0x1a1a1a), 0.02, -0.6, 0.2, 'arm', this.armR);
    this.armL.rotation.x = 0.2; this.armR.rotation.x = -0.4;
    this.group.scale.setScalar(scale);
  }
  colorize() {}
  hasAnim() { return false; }
  gunTip() { return this.gun.localToWorld(new THREE.Vector3(0, 0, 0.3)); }
  play(name) { this.anim = name; this.t = 0; if (name === 'shoot') this.recoil = 1; }
  kneel() { this.kneeling = true; this.legL.rotation.x = -1.4; this.legR.rotation.x = -1.2; this.legR.position.z = 0.3; this.torsoG.position.y = 0.55; this.hips.position.y = 0.55; }
  update(dt) {
    this.t += dt;
    const t = this.t;
    if (this.kneeling) { this.armR.rotation.x = -1.5; return; }
    switch (this.anim) {
      case 'idle': this.torsoG.position.y = 0.9 + Math.sin(t * 2.2) * 0.012; this.armR.rotation.x = -0.4 + Math.sin(t * 2.2) * 0.03; this.legL.rotation.x = this.legR.rotation.x = 0; break;
      case 'aim': this.armR.rotation.x += (-1.55 - this.armR.rotation.x) * Math.min(1, dt * 10); this.armL.rotation.x += (-1.2 - this.armL.rotation.x) * Math.min(1, dt * 10); this.torsoG.rotation.y += (0.25 - this.torsoG.rotation.y) * Math.min(1, dt * 8); break;
      case 'shoot': this.recoil = Math.max(0, (this.recoil || 0) - dt * 8); this.armR.rotation.x = -1.55 - this.recoil * 0.35; break;
      case 'run': { const s = Math.sin(t * 11); this.legL.rotation.x = s * 0.8; this.legR.rotation.x = -s * 0.8; this.armL.rotation.x = -s * 0.7; this.armR.rotation.x = s * 0.7 - 0.4; this.torsoG.position.y = 0.9 + Math.abs(s) * 0.05; this.torsoG.rotation.x = 0.18; break; }
      case 'die': { const k = Math.min(1, t / 0.6); this.group.rotation.x = -1.35 * k * k * (3 - 2 * k); this.armR.rotation.x = -0.4 + k; this.armL.rotation.x = 0.2 - k; break; }
    }
  }
  dispose() { this.group.traverse(o => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } }); }
}

// ------------------------------------------------------------ Mixamo (squelette + animations)
export class RigCharacter {
  constructor(assets, color) {
    this.assets = assets; this.parts = []; this.anim = null; this.kneeling = false;
    this.group = new THREE.Group();
    const model = skClone(assets.character);
    // Mise à l'échelle automatique : 1,8 m de haut quelle que soit l'unité d'export (cm chez Mixamo)
    const box = new THREE.Box3().setFromObject(model); const h = Math.max(0.01, box.max.y - box.min.y);
    model.scale.setScalar(1.8 / h); model.position.y = -box.min.y * (1.8 / h);
    model.traverse(o => { if (o.isMesh || o.isSkinnedMesh) { o.castShadow = true; o.frustumCulled = false; } });
    this.model = model; this.group.add(model);
    this.colorize(color);
    // Hitboxes invisibles attachées aux os Mixamo
    this.bones = {};
    model.traverse(o => { if (o.isBone) this.bones[o.name.replace(/^mixamorig\d*:?/i, '')] = o; });
    model.updateMatrixWorld(true);
    // Tailles et décalages en mètres ; convertis dans l'unité locale de l'os (cm chez Mixamo) via son échelle monde
    const hb = (bone, part, size, offset = [0, 0, 0]) => {
      const b = this.bones[bone]; if (!b) return;
      const ws = b.getWorldScale(new THREE.Vector3()).x || 1;
      const m = new THREE.Mesh(new THREE.BoxGeometry(...size), new THREE.MeshBasicMaterial({ visible: false }));
      m.position.set(offset[0] / ws, offset[1] / ws, offset[2] / ws); m.scale.setScalar(1 / ws);
      m.userData = { part }; b.add(m); this.parts.push(m);
    };
    hb('Head', 'head', [0.26, 0.3, 0.26], [0, 0.08, 0]);
    hb('Spine1', 'torso', [0.5, 0.55, 0.3], [0, 0.12, 0]);
    hb('LeftArm', 'arm', [0.14, 0.55, 0.14], [0, -0.25, 0]); hb('RightArm', 'arm', [0.14, 0.55, 0.14], [0, -0.25, 0]);
    hb('LeftUpLeg', 'leg', [0.16, 0.85, 0.16], [0, -0.4, 0]); hb('RightUpLeg', 'leg', [0.16, 0.85, 0.16], [0, -0.4, 0]);
    this.mixer = new THREE.AnimationMixer(model);
    this.actions = {};
    const clips = { ...(assets.clips.embedded ? { embedded: assets.clips.embedded[0] } : {}), ...assets.clips };
    for (const [name, clip] of Object.entries(clips)) if (clip && clip.tracks) this.actions[name] = this.mixer.clipAction(clip);
    this.play('idle');
  }
  colorize(color) {
    const c = new THREE.Color(color);
    this.model.traverse(o => { if (o.isMesh || o.isSkinnedMesh) { const ms = Array.isArray(o.material) ? o.material : [o.material]; o.material = ms.map(m => { const n = m.clone(); n.color = n.color ? n.color.clone().lerp(c, 0.55) : c; return n; }); if (!Array.isArray(o.material)) o.material = o.material[0]; } });
  }
  hasAnim(name) { return !!this.actions[name]; }
  gunTip() { const b = this.bones.RightHand || this.bones.RightForeArm; return b ? b.getWorldPosition(new THREE.Vector3()) : this.group.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 1.3, 0)); }
  play(name) {
    const a = this.actions[name] || this.actions.idle || this.actions.embedded; if (!a || a === this.current) return;
    if (this.current) this.current.fadeOut(0.15);
    a.reset().fadeIn(0.15).play();
    if (name === 'die' || name === 'shoot') { a.setLoop(THREE.LoopOnce); a.clampWhenFinished = true; }
    this.current = a; this.anim = name;
  }
  kneel() { this.kneeling = true; this.play('kneel'); }
  update(dt) { this.mixer.update(dt); }
  dispose() { this.mixer.stopAllAction(); this.model.traverse(o => { if (o.isMesh || o.isSkinnedMesh) { o.geometry.dispose(); (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose()); } }); }
}

export function makeCharacter(assets, color, opts) {
  if (assets && assets.hasRig) { try { return new RigCharacter(assets, color); } catch (e) { console.warn('Personnage Mixamo inutilisable, repli procédural :', e); } }
  return new ProcCharacter(color, opts);
}
