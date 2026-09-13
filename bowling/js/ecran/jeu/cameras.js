// Caméras : plans fixes ou dynamiques, transitions lissées, coupe franche pour l'impact, caméra libre (V).

import * as THREE from 'three';
import { OrbitControls } from '../../../lib/three/OrbitControls.js';
import { DIM } from './physique.js';

export class Cameras {
  constructor(camera, domElement, lire) {
    this.camera = camera;
    this.lire = (id, defaut) => { const v = lire ? lire(id) : undefined; return v === undefined || v === null ? defaut : v; };
    this.plan = 'preparation';
    this.pos = new THREE.Vector3(0, 1.8, 3.2);
    this.regard = new THREE.Vector3(0, 0.5, -8);
    this.ciblePos = this.pos.clone();
    this.cibleRegard = this.regard.clone();
    this.libre = false;
    this.controles = new OrbitControls(camera, domElement);
    this.controles.enabled = false;
    this.controles.target.set(0, 0.3, -DIM.longueurPiste);
    this.camera.position.copy(this.pos);
    this.camera.lookAt(this.regard);
  }

  basculerLibre(force) {
    this.libre = force == null ? !this.libre : force;
    this.controles.enabled = this.libre;
    if (this.libre) {
      this.controles.target.set(0, 0.3, -DIM.longueurPiste + 2);
      this.camera.position.set(3, 2.5, -DIM.longueurPiste + 6);
      this.controles.update();
    } else {
      this.camera.position.copy(this.pos);
      this.camera.lookAt(this.regard);
    }
    return this.libre;
  }

  // Change de plan. ctx : { visee, boule (Vector3-like), cote }
  definir(plan, ctx, coupe = false) {
    this.plan = plan;
    this._calculerCible(ctx);
    if (coupe && !this.libre) {
      this.pos.copy(this.ciblePos);
      this.regard.copy(this.cibleRegard);
      this.camera.position.copy(this.pos);
      this.camera.lookAt(this.regard);
    }
  }

  _calculerCible(ctx) {
    const L = DIM.longueurPiste;
    const p = this.ciblePos, r = this.cibleRegard;
    switch (this.plan) {
      case 'preparation': {
        const x = (ctx.visee ? ctx.visee.position : 0) * 0.3;
        p.set(x * 0.5, 1.75, 3.1);
        r.set(x, 0.45, -7);
        break;
      }
      case 'roulement': {
        const b = ctx.boule || { x: 0, y: 0.1, z: 0 };
        const h = this.lire('hauteurPoursuite', 1.25), recul = this.lire('reculPoursuite', 3.2);
        const zc = Math.max(b.z + recul, -L + 3.5);
        p.set(b.x * 0.6, b.y + h, zc);
        r.set(b.x * 0.6, 0.3, Math.min(b.z - 4, -4));
        break;
      }
      case 'impact': {
        const s = ctx.cote || 1;
        p.set(s * 2.3, 0.55, -L + 1.0);
        r.set(0, 0.3, -L - 0.35);
        break;
      }
      case 'resultat':
        p.set(0, 1.5, -L + 4.2);
        r.set(0, 0.35, -L - 0.4);
        break;
      case 'remise':
        p.set(0, 1.9, -L + 5.2);
        r.set(0, 0.5, -L - 0.4);
        break;
      case 'titre': {
        // Survol lent de la salle
        const a = (this.temps || 0) * 0.12;
        p.set(Math.sin(a) * 7, 3.2 + Math.sin(a * 0.7) * 0.6, -L / 2 + 4 + Math.cos(a) * 9);
        r.set(0, 0.4, -L / 2 - 2);
        break;
      }
      default:
        break;
    }
  }

  maj(dt, ctx) {
    this.temps = (this.temps || 0) + dt;
    if (this.libre) { this.controles.update(); return; }
    this._calculerCible(ctx);
    const k = 1 - Math.exp(-dt * this.lire('lissageCamera', 5));
    this.pos.lerp(this.ciblePos, k);
    this.regard.lerp(this.cibleRegard, k);
    this.camera.position.copy(this.pos);
    this.camera.lookAt(this.regard);
  }
}
