// Physique du bowling (cannon-es). Aucune dépendance au DOM : testable en Node (tests/physique.test.mjs).
//
// Repère : y vers le haut, la piste s'étend vers −z depuis la ligne de faute (z = 0) ; +x = droite du joueur.
// Les quilles sont « gelées » (hors simulation, pose exacte) tant que la boule n'est pas à DIM.distanceActivation
// de la quille 1 ; elles deviennent dynamiques à l'approche et sont remises exactement en place entre deux boules.

import * as CANNON from '../../../lib/cannon-es.js';

export const DIM = {
  longueurPiste: 18.29,        // ligne de faute → centre de la quille 1
  largeurPiste: 1.054,
  largeurGouttiere: 0.24,
  profondeurGouttiere: 0.09,
  approche: 4.57,
  longueurDeck: 0.95,          // quille 1 → bord de la fosse
  longueurFosse: 1.6,
  profondeurFosse: 0.7,
  rayonBoule: 0.108,
  hauteurQuille: 0.381,
  centreGraviteQuille: 0.15,   // hauteur du centre de gravité au-dessus de la base
  espacementQuilles: 0.3048,
  distanceActivation: 3.0,
  hauteurBumper: 0.12,
};

// Modifie les dimensions avant la construction du monde et de la scène (entraînement « Lancers puissants » : deck plus long).
export function configurerDimensions(patch) { Object.assign(DIM, patch); }

// Positions des quilles (index 0.. = quilles 1..) : 1 devant ; 2-3 ; 4-5-6 ; 7-8-9-10…, numéros croissants de gauche à droite.
// rangs = 4 → les 10 quilles officielles ; jusqu'à 13 rangs (91 quilles) pour l'entraînement.
export function positionsQuilles(rangs = 4) {
  const L = DIM.longueurPiste, e = DIM.espacementQuilles, r = e * Math.sqrt(3) / 2;
  const pos = [];
  for (let rang = 0; rang < rangs; rang++) {
    for (let i = 0; i <= rang; i++) pos.push({ x: (i - rang / 2) * e, z: -L - rang * r });
  }
  return pos;
}

// Nombre de quilles d'un rack de n rangées.
export function nbQuillesRangs(rangs) { return (rangs * (rangs + 1)) / 2; }

// Réglages lus à chaque usage via lire(id), pour que le panneau agisse immédiatement.
const DEFAUTS = {
  vMin: 4, vMax: 9, gainEffet: 0.9, debutCrochet: 45, finCrochet: 88, inclinaisonAxe: 0.55, vitesseLob: 2.5, perteLob: 0.35,
  masseBoule: 6.8, masseQuille: 1.4, frottementPiste: 0.04, rebondPiste: 0.05,
  frottementQuille: 0.25, rebondQuille: 0.4, frottementBouleQuille: 0.1, rebondBouleQuille: 0.4,
  frottementQuilleQuille: 0.1, rebondQuilleQuille: 0.7, rebondKickback: 0.75, resistanceRoulement: 2.5,
  amortissementQuille: 0.08, delaiMaxQuilles: 4, seuilChute: 35, deplacementChute: 0.3, glisseInitiale: 0.9,
  gouttieresFermees: false, formeQuille: 'spheres', inertieQuille: 1, aleaQuilles: 0.1,
};

export class MondePhysique {
  constructor(lire = null, { rangs = 4 } = {}) {
    this.rangs = rangs;
    this.lire = (id) => { const v = lire ? lire(id) : undefined; return v === undefined || v === null ? DEFAUTS[id] : v; };
    this.pasFixe = 1 / 240;   // 240 Hz : une quille lancée à 8 m/s avance de 3 cm par pas, moins que sa tête (7 cm) — plus de traversées
    this.accumulateur = 0;
    this.temps = 0;

    const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.81, 0), allowSleep: true });
    world.broadphase = new CANNON.SAPBroadphase(world);
    world.solver.iterations = 20;
    world.defaultContactMaterial.friction = 0.3;
    world.defaultContactMaterial.restitution = 0.1;
    this.world = world;

    this.matPiste = new CANNON.Material('piste');
    this.matBoule = new CANNON.Material('boule');
    this.matQuille = new CANNON.Material('quille');
    this.matKickback = new CANNON.Material('kickback');
    this.matBumper = new CANNON.Material('bumper');
    this.cmPisteBoule = new CANNON.ContactMaterial(this.matPiste, this.matBoule, { friction: 0.04, restitution: 0.05 });
    this.cmPisteQuille = new CANNON.ContactMaterial(this.matPiste, this.matQuille, { friction: 0.35, restitution: 0.3 });
    this.cmBouleQuille = new CANNON.ContactMaterial(this.matBoule, this.matQuille, { friction: 0.1, restitution: 0.25 });
    this.cmQuilleQuille = new CANNON.ContactMaterial(this.matQuille, this.matQuille, { friction: 0.15, restitution: 0.4 });
    this.cmKickbackQuille = new CANNON.ContactMaterial(this.matKickback, this.matQuille, { friction: 0.1, restitution: 0.5 });
    this.cmKickbackBoule = new CANNON.ContactMaterial(this.matKickback, this.matBoule, { friction: 0.1, restitution: 0.3 });
    this.cmBumperBoule = new CANNON.ContactMaterial(this.matBumper, this.matBoule, { friction: 0.05, restitution: 0.6 });
    for (const cm of [this.cmPisteBoule, this.cmPisteQuille, this.cmBouleQuille, this.cmQuilleQuille, this.cmKickbackQuille, this.cmKickbackBoule, this.cmBumperBoule]) world.addContactMaterial(cm);
    this.majMateriaux();

    this._creerDecor();
    this._creerBoule();
    this._creerQuilles();
    this.bumpers = null;
    this.reglerBumpers(!!this.lire('gouttieresFermees'));
    // Chocs : chaque contact réel du moteur produit un événement { type, force, x, z } lu par l'écran (sons synchronisés).
    this.chocs = [];
    this._derniersChocs = new Map();
    this._ecouterChocs();
    // Enregistrement de l'action de quilles (ralenti) : instantanés à 60 Hz pendant que les quilles sont actives.
    this.enregistrement = null;
  }

  _ecouterChocs() {
    const typeDe = (corps) => (corps === this.boule.corps ? 'boule' : corps.estQuille ? 'quille' : corps.material === this.matKickback ? 'kickback' : corps.material === this.matBumper ? 'bumper' : 'piste');
    const surChoc = (e) => {
      const a = e.target, b = e.body;
      const ta = typeDe(a), tb = typeDe(b);
      const force = Math.abs(e.contact.getImpactVelocityAlongNormal());
      let type = null;
      if ((ta === 'boule' && tb === 'quille') || (ta === 'quille' && tb === 'boule')) type = 'boule-quille';
      else if (ta === 'quille' && tb === 'quille') type = 'quille-quille';
      else if (ta === 'quille' && (tb === 'piste' || tb === 'kickback')) type = tb === 'kickback' ? 'quille-paroi' : 'quille-sol';
      else if (ta === 'boule' && (tb === 'kickback' || tb === 'bumper')) type = 'boule-paroi';
      else if (ta === 'boule' && tb === 'piste' && force > 1.2) type = 'boule-sol';
      if (!type) return;
      const seuil = type === 'quille-sol' ? 0.6 : type === 'boule-sol' ? 1.2 : 0.35;
      if (force < seuil) return;
      // Un même couple ne sonne pas plus d'une fois par 60 ms (contacts multiples d'une même collision)
      const cle = (a.id < b.id ? a.id + '-' + b.id : b.id + '-' + a.id);
      const t = this.temps;
      if (this._derniersChocs.get(cle) > t - 0.06) return;
      this._derniersChocs.set(cle, t);
      if (this.chocs.length < 24) this.chocs.push({ type, force, x: e.contact.bi.position.x, z: e.contact.bi.position.z, t });
    };
    this.boule.corps.addEventListener('collide', surChoc);
    for (const q of this.quilles) { q.corps.estQuille = true; q.corps.addEventListener('collide', surChoc); }
  }

  // Vide et retourne les chocs survenus depuis le dernier appel.
  prendreChocs() { const c = this.chocs; this.chocs = []; return c; }

  // ---------- Enregistrement pour le ralenti ----------

  _enregistrer() {
    const e = this.enregistrement;
    if (!e || !e.actif) return;
    e.compteur = (e.compteur || 0) + 1;
    if (e.compteur % 4 !== 0) return;   // 240 Hz → 60 Hz
    if (e.images.length >= 480) { e.actif = false; return; }
    const b = this.boule.corps;
    e.images.push({
      t: this.temps - e.debut,
      boule: [b.position.x, b.position.y, b.position.z, b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w, this.boule.enJeu && !this.boule.termine],
      quilles: this.quilles.map((q) => (q.presente ? [q.corps.position.x, q.corps.position.y, q.corps.position.z, q.corps.quaternion.x, q.corps.quaternion.y, q.corps.quaternion.z, q.corps.quaternion.w] : null)),
    });
  }

  demarrerEnregistrement() { this.enregistrement = { actif: true, debut: this.temps, images: [], compteur: 0 }; }
  arreterEnregistrement() { if (this.enregistrement) this.enregistrement.actif = false; }

  // Image enregistrée la plus proche d'un instant (s depuis le début de l'enregistrement).
  imageEnregistree(t) {
    const e = this.enregistrement;
    if (!e || !e.images.length) return null;
    let i = Math.round(t * 60);
    if (i < 0) i = 0;
    if (i >= e.images.length) i = e.images.length - 1;
    return e.images[i];
  }

  // ---------- Construction ----------

  _boiteStatique(hx, hy, hz, x, y, z, materiau = this.matPiste) {
    const corps = new CANNON.Body({ mass: 0, material: materiau, shape: new CANNON.Box(new CANNON.Vec3(hx, hy, hz)) });
    corps.position.set(x, y, z);
    this.world.addBody(corps);
    return corps;
  }

  _creerDecor() {
    const D = DIM;
    const L = D.longueurPiste, deck = D.longueurDeck, fosse = D.longueurFosse;
    const demiPiste = D.largeurPiste / 2;
    const largeurTotale = D.largeurPiste + 2 * D.largeurGouttiere + 0.4;
    // Piste (surface y = 0) de la ligne de faute au bord de la fosse
    this._boiteStatique(demiPiste, 0.05, (L + deck) / 2, 0, -0.05, -(L + deck) / 2);
    // Approche : toute la largeur, de la ligne de faute vers +z
    this._boiteStatique(largeurTotale / 2, 0.05, (D.approche + 1) / 2, 0, -0.05, (D.approche + 1) / 2);
    // Gouttières : jusqu'au début du deck seulement. Le long du deck, elles s'ouvrent sur la fosse : une quille
    // qui y tombe est hors jeu et disparaît proprement, au lieu de rester coincée entre gouttière, paroi et bord
    // du deck (coin de boîtes statiques dont le solveur l'éjectait en l'air).
    const zK0 = -(L - 0.3);
    const xg = demiPiste + D.largeurGouttiere / 2;
    for (const s of [-1, 1]) this._boiteStatique(D.largeurGouttiere / 2, 0.05, -zK0 / 2, s * xg, -D.profondeurGouttiere - 0.05, zK0 / 2);
    // Murs extérieurs : le long de la piste (bas), puis « kickbacks » plus hauts le long du deck et de la fosse,
    // sur lesquels les quilles rebondissent (comme dans un vrai bowling).
    const xm = demiPiste + D.largeurGouttiere + 0.03;
    const zK = -(L - 0.3);
    this.kickbacks = [];
    for (const s of [-1, 1]) {
      this._boiteStatique(0.03, 0.25, (0.2 - zK) / 2, s * xm, 0.0, (0.2 + zK) / 2);
      this.kickbacks.push(this._boiteStatique(0.03, 0.5, (deck + fosse + 0.3) / 2, s * xm, 0.25, zK - (deck + fosse + 0.3) / 2, this.matKickback));
    }
    this.corpsEvasement = [];
    this.demiEvasement = null;
    this.corpsObstacles = [];
    this.obstaclesConfig = [];
    // Fosse : plancher (sous le deck aussi, pour ce qui tombe à côté) et fond
    const longueurFosseTotale = fosse + deck + 0.3;
    this._boiteStatique(largeurTotale / 2, 0.05, longueurFosseTotale / 2, 0, -D.profondeurFosse - 0.05, zK0 - longueurFosseTotale / 2);
    this._boiteStatique(largeurTotale / 2, 0.8, 0.05, 0, -D.profondeurFosse + 0.8, -(L + deck + fosse) - 0.05);
    // Mur du fond de l'approche (boule lancée en arrière)
    this._boiteStatique(largeurTotale / 2, 0.6, 0.05, 0, 0.6, D.approche + 0.6);
  }

  _creerBoule() {
    const corps = new CANNON.Body({
      mass: this.lire('masseBoule'), material: this.matBoule, shape: new CANNON.Sphere(DIM.rayonBoule),
      linearDamping: 0.01, angularDamping: 0.01, allowSleep: false,
    });
    corps.position.set(0, DIM.rayonBoule, 1.2);
    this.boule = { corps, enJeu: false, lance: null, gouttiere: false, dansFosse: false, enLAir: false, arret: false, termine: false, tempsLent: 0, distanceMax: 0 };
  }

  _creerQuilles() {
    const cg = DIM.centreGraviteQuille;
    this.quilles = positionsQuilles(this.rangs).map((p, i) => {
      const corps = new CANNON.Body({
        mass: this.lire('masseQuille'), material: this.matQuille,
        linearDamping: 0.02, angularDamping: this.lire('amortissementQuille'), allowSleep: true, sleepSpeedLimit: 0.06, sleepTimeLimit: 0.8,
      });
      // Base plate (cylindre bas : la quille tient debout) + trois sphères (ventre, cou, tête : contacts lisses
      // boule/quille et quille/quille). Origine du corps au centre de gravité.
      const forme = this.lire('formeQuille');
      if (forme === 'cone') {
        corps.addShape(new CANNON.Cylinder(0.035, 0.06, 0.26, 10), new CANNON.Vec3(0, 0.13 - cg, 0));
        corps.addShape(new CANNON.Sphere(0.034), new CANNON.Vec3(0, 0.33 - cg, 0));
      } else {
        corps.addShape(new CANNON.Cylinder(0.05, 0.05, 0.06, 12), new CANNON.Vec3(0, 0.03 - cg, 0));
        corps.addShape(new CANNON.Sphere(0.06), new CANNON.Vec3(0, 0.105 - cg, 0));
        corps.addShape(new CANNON.Sphere(0.045), new CANNON.Vec3(0, 0.205 - cg, 0));
        corps.addShape(new CANNON.Sphere(0.033), new CANNON.Vec3(0, 0.275 - cg, 0));
        corps.addShape(new CANNON.Sphere(0.036), new CANNON.Vec3(0, 0.335 - cg, 0));
      }
      corps.position.set(p.x, cg, p.z);
      this._appliquerInertie(corps);
      return { index: i, numero: i + 1, corps, initiale: { x: p.x, z: p.z }, presente: true, debout: true, active: false };
    });
    this.quillesActives = false;
  }

  _appliquerInertie(corps) {
    corps.updateMassProperties();
    const k = this.lire('inertieQuille');
    if (k && k !== 1) {
      corps.inertia.scale(k, corps.inertia);
      corps.invInertia.set(corps.inertia.x > 0 ? 1 / corps.inertia.x : 0, corps.inertia.y > 0 ? 1 / corps.inertia.y : 0, corps.inertia.z > 0 ? 1 / corps.inertia.z : 0);
      corps.updateInertiaWorld(true);
    }
  }

  // Le frottement de cannon-es n'est pas un coefficient de Coulomb : sa borne agit comme une impulsion par pas,
  // donc il est ~1/pas fois trop fort. Conversion empirique (mesurée sur un bloc glissant) : μ_cannon ≈ μ_réel × pas / 4.
  frottement(muReel) {
    return Math.max(0, muReel) * this.pasFixe / 4;
  }

  majMateriaux() {
    this.cmPisteBoule.friction = this.frottement(this.lire('frottementPiste'));
    this.cmPisteBoule.restitution = this.lire('rebondPiste');
    this.cmPisteQuille.friction = this.frottement(this.lire('frottementQuille'));
    this.cmPisteQuille.restitution = this.lire('rebondQuille');
    this.cmBouleQuille.friction = this.frottement(this.lire('frottementBouleQuille'));
    this.cmBouleQuille.restitution = this.lire('rebondBouleQuille');
    this.cmQuilleQuille.friction = this.frottement(this.lire('frottementQuilleQuille'));
    this.cmQuilleQuille.restitution = this.lire('rebondQuilleQuille');
    this.cmKickbackQuille.friction = this.frottement(0.2);
    this.cmKickbackQuille.restitution = this.lire('rebondKickback');
    this.cmKickbackBoule.friction = this.frottement(0.2);
    this.cmBumperBoule.friction = this.frottement(0.1);
    if (this.boule) { this.boule.corps.mass = this.lire('masseBoule'); this.boule.corps.updateMassProperties(); }
    if (this.quilles) for (const q of this.quilles) { q.corps.mass = this.lire('masseQuille'); q.corps.angularDamping = this.lire('amortissementQuille'); this._appliquerInertie(q.corps); }
  }

  reglerBumpers(actif) {
    if (actif && !this.bumpers) {
      const longueur = DIM.longueurPiste + DIM.longueurDeck;
      const x = DIM.largeurPiste / 2 + 0.02;
      this.bumpers = [-1, 1].map((s) => this._boiteStatique(0.02, DIM.hauteurBumper / 2 + 0.05, longueur / 2, s * x, DIM.hauteurBumper / 2 - 0.05, -longueur / 2, this.matBumper));
    } else if (!actif && this.bumpers) {
      for (const b of this.bumpers) this.world.removeBody(b);
      this.bumpers = null;
    }
  }

  // ---------- Quilles ----------

  _poserQuille(q) {
    // Aléa de masse (±aleaQuilles) : deux impacts identiques ne donnent jamais exactement la même chute
    const alea = this.lire('aleaQuilles');
    q.corps.mass = this.lire('masseQuille') * (1 + (alea ? (Math.random() * 2 - 1) * alea : 0));
    this._appliquerInertie(q.corps);
    q.corps.position.set(q.initiale.x, DIM.centreGraviteQuille, q.initiale.z);
    q.corps.quaternion.set(0, 0, 0, 1);
    q.corps.velocity.set(0, 0, 0);
    q.corps.angularVelocity.set(0, 0, 0);
    q.corps.force.set(0, 0, 0);
    q.corps.torque.set(0, 0, 0);
  }

  // Ajoute au monde toutes les quilles présentes (elles deviennent dynamiques).
  activerQuilles() {
    if (this.quillesActives) return;
    this.demarrerEnregistrement();
    for (const q of this.quilles) {
      if (!q.presente || q.active) continue;
      this.world.addBody(q.corps);
      q.corps.wakeUp();
      q.active = true;
    }
    this.quillesActives = true;
  }

  // Retire les quilles du monde ; les quilles debout retrouvent leur pose exacte.
  gelerQuilles() {
    for (const q of this.quilles) {
      if (q.active) { this.world.removeBody(q.corps); q.active = false; }
      if (q.presente && q.debout) this._poserQuille(q);
    }
    this.quillesActives = false;
  }

  // Évalue chaque quille : debout ou tombée (inclinaison, déplacement, chute du deck).
  etatQuilles() {
    const cosSeuil = Math.cos((this.lire('seuilChute') * Math.PI) / 180);
    const depl = this.lire('deplacementChute');
    const haut = new CANNON.Vec3();
    const tombees = [];
    for (const q of this.quilles) {
      if (!q.presente) { tombees.push(true); q.debout = false; continue; }
      const c = q.corps;
      c.quaternion.vmult(new CANNON.Vec3(0, 1, 0), haut);
      const dx = c.position.x - q.initiale.x, dz = c.position.z - q.initiale.z;
      // Règle du bowling : une quille inclinée qui s'appuie contre une paroi du deck est comptée tombée
      const contreParoi = haut.y < Math.cos(15 * Math.PI / 180) && Math.abs(c.position.x) > DIM.largeurPiste / 2 + 0.08;
      const tombee = haut.y < cosSeuil || contreParoi || Math.hypot(dx, dz) > depl || c.position.y < DIM.centreGraviteQuille - 0.12;
      q.debout = !tombee;
      tombees.push(tombee);
    }
    const nbTombees = tombees.filter(Boolean).length;
    return { tombees, nbTombees, nbDebout: this.quilles.length - nbTombees };
  }

  // Retire définitivement les quilles tombées (pour la deuxième boule) et remet les autres en place.
  retirerTombees() {
    const e = this.etatQuilles();
    for (const q of this.quilles) if (e.tombees[q.index]) { if (q.active) { this.world.removeBody(q.corps); q.active = false; } q.presente = false; q.debout = false; }
    this.gelerQuilles();
    return e;
  }

  // Rack complet : les 10 quilles debout, gelées.
  nouveauRack() {
    for (const q of this.quilles) {
      if (q.active) { this.world.removeBody(q.corps); q.active = false; }
      q.presente = true;
      q.debout = true;
      this._poserQuille(q);
    }
    this.quillesActives = false;
  }

  // Remet un sous-ensemble précis de quilles (entraînement Spares, lot 5) : numeros = [7, 10]…
  poserRack(numeros) {
    this.nouveauRack();
    const garder = new Set(numeros);
    for (const q of this.quilles) if (!garder.has(q.numero)) { q.presente = false; q.debout = false; }
  }

  // Évasement (mode 100 quilles) : sur les 3 derniers mètres, la piste s'élargit en 8 marches jusqu'à la
  // demi-largeur `demi`, puis un deck de cette largeur porte le rack, bordé de parois. null = piste normale.
  reglerEvasement(demi) {
    for (const b of this.corpsEvasement) this.world.removeBody(b);
    this.corpsEvasement = [];
    const D = DIM, L = D.longueurPiste, zK = -(L - 0.3), demiPiste = D.largeurPiste / 2;
    if (!demi || demi <= demiPiste + 0.01) {
      for (const k of this.kickbacks) if (!k.world) this.world.addBody(k);
      this.demiEvasement = null;
      return;
    }
    for (const k of this.kickbacks) if (k.world) this.world.removeBody(k);
    const zDebut = -(L - 3.0), n = 8;
    for (let i = 0; i < n; i++) {
      const z0 = zDebut + (zK - zDebut) * i / n, z1 = zDebut + (zK - zDebut) * (i + 1) / n;
      const hx = demiPiste + (demi - demiPiste) * ((i + 1) / n);
      this.corpsEvasement.push(this._boiteStatique(hx, 0.05, Math.abs(z1 - z0) / 2 + 0.001, 0, -0.05, (z0 + z1) / 2));
    }
    const longueurDeck = D.longueurDeck + 0.3;
    this.corpsEvasement.push(this._boiteStatique(demi, 0.05, longueurDeck / 2, 0, -0.05, zK - longueurDeck / 2));
    for (const s of [-1, 1]) this.corpsEvasement.push(this._boiteStatique(0.03, 0.4, longueurDeck / 2, s * (demi + 0.05), 0.35, zK - longueurDeck / 2, this.matKickback));
    this.demiEvasement = demi;
  }

  // Obstacles (mode Obstacles) : liste de { x0, x1, f } — murs bas entre x0 et x1, à la fraction f de la piste.
  reglerObstacles(liste) {
    for (const b of this.corpsObstacles) this.world.removeBody(b);
    this.corpsObstacles = [];
    this.obstaclesConfig = [];
    for (const o of liste || []) {
      const z = -DIM.longueurPiste * o.f;
      this.corpsObstacles.push(this._boiteStatique((o.x1 - o.x0) / 2, 0.15, 0.05, (o.x0 + o.x1) / 2, 0.1, z, this.matKickback));
      this.obstaclesConfig.push({ ...o, z });
    }
  }

  quillesStables() {
    for (const q of this.quilles) {
      if (!q.active) continue;
      const c = q.corps;
      if (c.sleepState === CANNON.Body.SLEEPING) continue;
      if (c.velocity.length() > 0.15 || c.angularVelocity.length() > 0.6) return false;
    }
    return true;
  }

  // ---------- Boule ----------

  // params : { position ∈ [−1,1], angle (°), puissance ∈ [0,1], effet ∈ [−1,1], phase: 'normal'|'lob'|'arriere' }
  lancer(params) {
    const D = DIM, b = this.boule;
    const puissance = Math.min(1, Math.max(0, Number(params.puissance) || 0));
    const effet = Math.min(1, Math.max(-1, Number(params.effet) || 0));
    const position = Math.min(1, Math.max(-1, Number(params.position) || 0));
    const angle = (Math.min(4, Math.max(-4, Number(params.angle) || 0)) * Math.PI) / 180;
    const phase = ['lob', 'arriere'].includes(params.phase) ? params.phase : 'normal';
    const vMin = this.lire('vMin'), vMax = this.lire('vMax');
    let vitesse = vMin + puissance * (vMax - vMin);
    let dirX = Math.sin(angle), dirZ = -Math.cos(angle), vy = 0, y0 = D.rayonBoule + 0.002;
    if (phase === 'arriere') { dirX = -dirX; dirZ = -dirZ; vitesse = Math.max(2, vitesse * 0.5); }
    if (phase === 'lob') { vy = this.lire('vitesseLob'); vitesse *= (1 - this.lire('perteLob')); y0 = D.rayonBoule + 0.25; }

    const x0 = position * (D.largeurPiste / 2 - D.rayonBoule - 0.02);
    const c = b.corps;
    if (!c.world) this.world.addBody(c);
    c.position.set(x0, y0, 0);
    c.quaternion.set(0, 0, 0, 1);
    c.velocity.set(dirX * vitesse, vy, dirZ * vitesse);
    const roulement = (vitesse / D.rayonBoule) * this.lire('glisseInitiale');
    // Axe de rotation incliné par le lift : la boule tourne visiblement sur le côté, et cette composante
    // verticale est ce qui la fait virer quand elle accroche.
    const inclinaison = effet * this.lire('inclinaisonAxe');
    c.angularVelocity.set(dirZ * roulement, roulement * inclinaison, -dirX * roulement);
    c.force.set(0, 0, 0); c.torque.set(0, 0, 0);
    c.wakeUp();
    Object.assign(b, { enJeu: true, lance: { position, angle: params.angle, puissance, effet, phase, vitesse }, gouttiere: false, dansFosse: false, enLAir: false, arret: false, termine: false, tempsLent: 0, distanceMax: 0, tempsLancer: this.temps });
    return b.lance;
  }

  rangerBoule() {
    const c = this.boule.corps;
    if (c.world) this.world.removeBody(c);
    c.velocity.set(0, 0, 0); c.angularVelocity.set(0, 0, 0);
    c.position.set(0, DIM.rayonBoule, 1.2);
    this.boule.enJeu = false;
    this.boule.termine = true;
  }

  // Trajectoire en trois phases, comme une vraie boule :
  //   glisse  (0 → debutCrochet)      : la boule patine sur l'huile, elle va droit ;
  //   crochet (debutCrochet → finCrochet) : elle accroche le sec, l'axe de rotation la fait virer ;
  //   roulement (au-delà)             : elle roule enfin, plus de dérive — elle file droit dans sa nouvelle direction.
  // La phase de crochet est courte et franche : c'est ce point de cassure qui rend la trajectoire lisible
  // et qui donne un angle d'entrée en poche (bien plus efficace qu'une boule droite).
  _appliquerCrochet() {
    const b = this.boule, D = DIM;
    if (!b.enJeu || !b.lance || b.gouttiere || b.dansFosse) return;
    if (!b.lance.effet) return;
    const p = b.corps.position;
    if (p.z > 0 || p.z < -D.longueurPiste || Math.abs(p.x) > D.largeurPiste / 2 + 0.1 || p.y > D.rayonBoule + 0.03) return;
    const progression = -p.z / D.longueurPiste;
    const debut = this.lire('debutCrochet') / 100;
    const fin = Math.max(debut + 0.05, this.lire('finCrochet') / 100);
    if (progression <= debut || progression >= fin) return;
    // Profil en cloche sur la phase de crochet : accroche progressive, apogée au milieu, relâche en fin de virage
    const t = (progression - debut) / (fin - debut);
    const cloche = Math.sin(Math.PI * t);
    // La déviation doit dépendre de la DISTANCE parcourue, pas du temps passé : sans cela une boule lente,
    // qui reste deux fois plus longtemps dans la zone, dévierait quatre fois plus. On met donc l'accélération
    // à l'échelle du carré de la vitesse (v / 6,5 m/s), puis on laisse un écart volontaire et mesuré :
    // une boule lente accroche un peu plus qu'une boule lancée à fond.
    const v = b.corps.velocity.length();
    const echelle = (v / 6.5) ** 2;
    const facteurVitesse = 1.25 - 0.5 * b.lance.puissance;
    const ax = b.lance.effet * this.lire('gainEffet') * facteurVitesse * echelle * cloche;
    // Décalage de vitesse latérale + rotation de roulement cohérente : la boule roule sur sa nouvelle trajectoire
    // au lieu de glisser (sinon le frottement de la piste annulerait le crochet).
    const dv = ax * this.pasFixe;
    b.corps.velocity.x += dv;
    b.corps.angularVelocity.z -= dv / D.rayonBoule;
  }

  _suivreBoule() {
    const b = this.boule, D = DIM;
    if (!b.enJeu) return;
    const p = b.corps.position, v = b.corps.velocity;
    const demiPiste = D.largeurPiste / 2;
    if (!b.gouttiere && p.y < D.rayonBoule - 0.03 && Math.abs(p.x) > demiPiste && p.z < 0 && p.z > -(D.longueurPiste + D.longueurDeck)) b.gouttiere = true;
    if (p.y > D.rayonBoule + 0.06) b.enLAir = true;
    if (p.z < -(D.longueurPiste + D.longueurDeck) - 0.1) b.dansFosse = true;
    b.distanceMax = Math.max(b.distanceMax, -p.z);
    // Activation des quilles à l'approche
    if (!this.quillesActives && p.z < -D.longueurPiste + D.distanceActivation && p.z > -D.longueurPiste - D.longueurDeck) this.activerQuilles();
    // Arrêt : très lente pendant 1,5 s
    if (v.length() < 0.08) { b.tempsLent += this.pasFixe; if (b.tempsLent > 1.5) b.arret = true; } else b.tempsLent = 0;
    // Fin de trajectoire
    if (b.dansFosse || b.arret || p.z > D.approche + 0.3 || p.y < -2) b.termine = true;
  }

  _suivreQuilles() {
    const D = DIM;
    const haut = this._hautTmp || (this._hautTmp = new CANNON.Vec3());
    const resistance = this.lire('resistanceRoulement');
    for (const q of this.quilles) {
      if (!q.active) continue;
      const p = q.corps.position;
      // Garde-fou contre les pics numériques (quille pincée entre boule et paroi) : une quille ne dépasse
      // jamais 12 m/s ni 60 rad/s — au-delà de ce qu'un vrai impact produit, et invisible en jeu.
      const vl = q.corps.velocity.length();
      if (vl > 12) q.corps.velocity.scale(12 / vl, q.corps.velocity);
      const wl = q.corps.angularVelocity.length();
      if (wl > 60) q.corps.angularVelocity.scale(60 / wl, q.corps.angularVelocity);
      // Résistance au roulement : une quille couchée sur le deck (proche du sol, très inclinée) est freinée
      // en rotation et en translation, comme le bois sur le bois — sinon elle roule à l'infini au ralenti.
      if (resistance > 0 && p.y < 0.09) {
        q.corps.quaternion.vmult(new CANNON.Vec3(0, 1, 0), haut);
        if (haut.y < 0.5) {
          const k = Math.exp(-resistance * this.pasFixe);
          q.corps.angularVelocity.scale(k, q.corps.angularVelocity);
          q.corps.velocity.x *= k; q.corps.velocity.z *= k;
        }
      }
      if (p.y < -0.35 || p.z < -(D.longueurPiste + D.longueurDeck + D.longueurFosse) || p.z > 0) {
        this.world.removeBody(q.corps);
        q.active = false; q.presente = false; q.debout = false;
      }
    }
  }

  // ---------- Boucle ----------

  avancer(dtReel) {
    const dt = Math.min(Math.max(0, dtReel), 0.05);
    this.accumulateur += dt;
    let n = 0;
    while (this.accumulateur >= this.pasFixe && n < 16) {
      this._pas();
      this.accumulateur -= this.pasFixe;
      n++;
    }
    if (n >= 16) this.accumulateur = 0;
    return n;
  }

  _pas() {
    this._appliquerCrochet();
    this.world.step(this.pasFixe);
    this.temps += this.pasFixe;
    this._suivreBoule();
    this._suivreQuilles();
    this._enregistrer();
  }

  // Étape de la simulation de durée arbitraire (tests).
  simuler(secondes) {
    const n = Math.round(secondes / this.pasFixe);
    for (let i = 0; i < n; i++) this._pas();
  }

  // Tout est immobile : boule terminée (ou absente) et quilles stables.
  toutStable() {
    return (!this.boule.enJeu || this.boule.termine) && this.quillesStables();
  }
}
