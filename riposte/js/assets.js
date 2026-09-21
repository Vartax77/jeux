import * as THREE from 'three';
import { FBXLoader } from '../lib/jsm/loaders/FBXLoader.js';
import { GLTFLoader } from '../lib/jsm/loaders/GLTFLoader.js';

// Tout est OPTIONNEL : chaque fichier absent est simplement remplacé par sa version procédurale.
// Déposer les fichiers dans riposte/assets/ (voir README, section « Ressources »).
export const MANIFEST = {
  // Personnage Mixamo (FBX « With Skin ») ou GLB. Un seul personnage suffit : il est teinté selon le type d'ennemi.
  character: ['assets/characters/soldier.fbx', 'assets/characters/soldier.glb'],
  // Animations Mixamo exportées « Without Skin » (le squelette doit être celui du personnage ci-dessus).
  animations: {
    idle:  'assets/anim/idle.fbx',
    aim:   'assets/anim/aim.fbx',
    shoot: 'assets/anim/shoot.fbx',
    die:   'assets/anim/death.fbx',
    kneel: 'assets/anim/kneel.fbx',
    run:   'assets/anim/run.fbx',
  },
  // Textures répétables (carrées, 1024×1024 ou 2048×2048, JPG)
  textures: {
    ground:    'assets/tex/ground.jpg',
    asphalt:   'assets/tex/asphalt.jpg',
    concrete:  'assets/tex/concrete.jpg',
    container: 'assets/tex/container.jpg',
    metal:     'assets/tex/metal.jpg',
    brick:     'assets/tex/brick.jpg',
  },
  // Panoramas de fond (paysage très large, 4096×1024 idéal, JPG), plaqués sur un cylindre lointain
  backdrops: {
    docks:  'assets/backdrops/docks.jpg',
    street: 'assets/backdrops/street.jpg',
    hangar: 'assets/backdrops/hangar.jpg',
  },
};

export class Assets {
  constructor() { this.character = null; this.clips = {}; this.textures = {}; this.backdrops = {}; this.report = []; }

  async load(onProgress = () => {}) {
    const fbx = new FBXLoader(), gltf = new GLTFLoader(), tex = new THREE.TextureLoader();
    const tryLoad = (loader, url) => new Promise(res => loader.load(url, r => res(r), undefined, () => res(null)));
    const steps = [];

    // Personnage
    steps.push(async () => {
      for (const url of MANIFEST.character) {
        const r = await tryLoad(url.endsWith('.glb') ? gltf : fbx, url);
        if (r) { this.character = url.endsWith('.glb') ? r.scene : r; this.character.userData.src = url;
          if (r.animations && r.animations.length) this.clips.embedded = r.animations; this.report.push('personnage : ' + url); return; }
      }
      this.report.push('personnage : procédural');
    });
    // Animations
    for (const [name, url] of Object.entries(MANIFEST.animations)) steps.push(async () => {
      const r = await tryLoad(fbx, url);
      if (r && r.animations && r.animations.length) { this.clips[name] = r.animations[0]; this.clips[name].name = name; this.report.push('animation ' + name + ' : ok'); }
    });
    // Textures
    for (const [name, url] of Object.entries(MANIFEST.textures)) steps.push(async () => {
      const t = await tryLoad(tex, url);
      if (t) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; this.textures[name] = t; this.report.push('texture ' + name + ' : ok'); }
    });
    // Fonds
    for (const [name, url] of Object.entries(MANIFEST.backdrops)) steps.push(async () => {
      const t = await tryLoad(tex, url);
      if (t) { t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; this.backdrops[name] = t; this.report.push('fond ' + name + ' : ok'); }
    });

    let done = 0;
    await Promise.all(steps.map(async s => { try { await s(); } catch (e) { console.warn(e); } done++; onProgress(done / steps.length); }));
    return this;
  }

  // Matériau texturé si la texture existe, sinon couleur unie
  // Texture de bruit générée (grain + rayures) pour casser l'uniformité des surfaces sans fichier
  noiseTexture(kind = 'grain') {
    this._noise = this._noise || {};
    if (this._noise[kind]) return this._noise[kind];
    try {
      const S = 256, cv = document.createElement('canvas'); cv.width = cv.height = S; const c = cv.getContext('2d');
      c.fillStyle = '#9a9a9a'; c.fillRect(0, 0, S, S);
      const img = c.getImageData(0, 0, S, S), d = img.data;
      for (let i = 0; i < d.length; i += 4) { const v = 135 + Math.random() * 50 + (kind === 'plates' && ((i / 4 / S | 0) % 64 < 2 || ((i / 4) % S) % 64 < 2) ? -60 : 0); d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; }
      c.putImageData(img, 0, 0);
      if (kind === 'grain') { c.globalAlpha = 0.25; c.fillStyle = '#000'; for (let k = 0; k < 40; k++) c.fillRect(Math.random() * S, Math.random() * S, Math.random() * 40, 1 + Math.random() * 2); }
      const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
      this._noise[kind] = t; return t;
    } catch (_) { return null; }
  }
  material(texName, color, repeat = [1, 1], extra = {}) {
    const t = this.textures[texName];
    if (!t) {
      const n = this.noiseTexture(texName === 'metal' || texName === 'container' ? 'plates' : 'grain');
      if (!n) return new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0.1, ...extra });
      const map = n.clone(); map.needsUpdate = true; map.repeat.set(repeat[0] * 2, repeat[1] * 2);
      return new THREE.MeshStandardMaterial({ map, color: new THREE.Color(color).multiplyScalar(1.6), roughness: 0.85, metalness: 0.1, ...extra });
    }
    const map = t.clone(); map.needsUpdate = true; map.repeat.set(repeat[0], repeat[1]);
    return new THREE.MeshStandardMaterial({ map, color: 0xffffff, roughness: 0.85, metalness: 0.1, ...extra });
  }
  get hasRig() { return !!this.character; }
}
