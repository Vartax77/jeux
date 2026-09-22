import * as THREE from 'three';
import { EffectComposer } from '../lib/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from '../lib/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from '../lib/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from '../lib/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from '../lib/jsm/postprocessing/OutputPass.js';

// Étalonnage façon « cadre de référence » : ombres teal, lumières orange, vignette, grain, léger flou chromatique
const GradeShader = {
  uniforms: { tDiffuse: { value: null }, time: { value: 0 }, strength: { value: 1 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float time; uniform float strength; varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
    void main(){
      vec2 uv = vUv; vec2 d = (uv - 0.5);
      // aberration chromatique très légère vers les bords
      float ca = 0.0015 * strength * dot(d, d) * 4.0;
      vec3 c; c.r = texture2D(tDiffuse, uv + d * ca).r; c.g = texture2D(tDiffuse, uv).g; c.b = texture2D(tDiffuse, uv - d * ca).b;
      float l = dot(c, vec3(0.299, 0.587, 0.114));
      // teal dans les ombres, orange dans les hautes lumières
      vec3 shadow = vec3(0.86, 1.0, 1.08), high = vec3(1.08, 1.0, 0.86);
      vec3 tint = mix(shadow, high, smoothstep(0.15, 0.75, l));
      c = mix(c, c * tint, strength);
      // contraste doux en S
      c = mix(c, c * c * (3.0 - 2.0 * c), 0.35 * strength);
      // vignette
      float v = 1.0 - smoothstep(0.35, 0.95, length(d) * 1.35) * 0.45 * strength;
      c *= v;
      // grain
      c += (hash(uv * 1000.0 + time) - 0.5) * 0.035 * strength;
      gl_FragColor = vec4(c, 1.0);
    }`,
};

export class Post {
  constructor(renderer, scene, camera) {
    this.renderer = renderer; this.enabled = true;
    this.composer = new EffectComposer(renderer);
    this.composer.addPass(new RenderPass(scene, camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.55, 0.6, 0.85);   // force, rayon, seuil : seules les lumières et flashs fleurissent
    this.composer.addPass(this.bloom);
    this.grade = new ShaderPass(GradeShader); this.composer.addPass(this.grade);
    this.composer.addPass(new OutputPass());
  }
  setSize(w, h) { this.composer.setSize(w, h); this.bloom.setSize(w, h); }
  render(dt) { this.grade.uniforms.time.value += dt; this.composer.render(dt); }
}
