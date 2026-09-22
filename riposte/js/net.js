// Réseau : l'écran PC est l'hôte PeerJS, chaque iPhone est un pistolet.
// Ce module ne connaît pas le jeu : il expose des joueurs avec un réticule filtré et émet des événements.

// Filtre « 1 € » (Casiez, Roussel, Vogel 2012) : lisse fort quand la main est immobile, peu quand elle bouge vite.
export class OneEuro {
  constructor(minCutoff = 1.5, beta = 2.0, dCutoff = 1.0) {
    this.minCutoff = minCutoff; this.beta = beta; this.dCutoff = dCutoff;
    this.xPrev = null; this.dxPrev = 0; this.tPrev = null;
  }
  static alpha(cutoff, dt) { const tau = 1 / (2 * Math.PI * cutoff); return 1 / (1 + tau / dt); }
  reset() { this.xPrev = null; this.dxPrev = 0; this.tPrev = null; }
  filter(x, t) {
    if (this.tPrev === null) { this.xPrev = x; this.tPrev = t; return x; }
    const dt = Math.max(1e-3, t - this.tPrev);
    const dx = (x - this.xPrev) / dt;
    const aD = OneEuro.alpha(this.dCutoff, dt);
    const dxHat = aD * dx + (1 - aD) * this.dxPrev;
    const cutoff = this.minCutoff + this.beta * Math.abs(dxHat);
    const a = OneEuro.alpha(cutoff, dt);
    const xHat = a * x + (1 - a) * this.xPrev;
    this.xPrev = xHat; this.dxPrev = dxHat; this.tPrev = t;
    return xHat;
  }
}

const wrap = d => ((d + 540) % 360) - 180;

export class Net {
  constructor({ maxPlayers = 2, fovX = 40, autoCenter = 'soft', onEvent = () => {} } = {}) {
    this.maxPlayers = maxPlayers;
    this.fovX = fovX;                 // degrés couverts par la largeur de l'écran
    this.autoCenter = autoCenter;     // recentrage à la sortie de couvert : 'soft' | 'hard' | 'off'
    this.softThreshold = 20;          // degrés de mouvement pendant le couvert au-delà desquels on recentre (mode soft)
    this.onEvent = onEvent;           // (type, player, data)
    this.players = Array(maxPlayers).fill(null);
    this.code = null; this.telUrl = null; this.peer = null;
  }

  // ---------- Hôte ----------
  start() {
    // Le code est conservé dans l'onglet : un F5 garde la même salle et les téléphones se reconnectent seuls
    let saved = null; try { saved = sessionStorage.getItem('riposte-code'); } catch (_) {}
    this.code = saved || (Array.from({ length: 4 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ'[Math.random() * 24 | 0]).join('') + (10 + Math.random() * 90 | 0));
    try { sessionStorage.setItem('riposte-code', this.code); } catch (_) {}
    this.telUrl = new URL('tel.html?c=' + this.code, location.href).href;
    this.peer = new Peer('riposte-' + this.code, { debug: 1 });
    this.peer.on('error', e => {
      if (e.type === 'unavailable-id') { try { sessionStorage.removeItem('riposte-code'); } catch (_) {} this.onEvent('error', null, { type: 'code déjà utilisé, rechargez la page (F5)' }); return; }
      this.onEvent('error', null, e);
    });
    this.peer.on('disconnected', () => { try { this.peer.reconnect(); } catch (_) {} });
    this.peer.on('connection', conn => this._accept(conn));
    setInterval(() => this.forEach(p => { if (!p.local) this.send(p, { t: 'ping', ts: performance.now() }); }), 1000);
    return this;
  }

  _newPlayer(slot, local = false) {
    return { slot, local, conn: null, ready: false,
      yaw: 0, pitch: 0, yaw0: null, pitch0: null,
      fx: new OneEuro(), fy: new OneEuro(),
      rx: 0.5, ry: 0.5,      // réticule brut (avant filtre)
      x: 0.5, y: 0.5,        // réticule filtré, normalisé [0..1]
      cover: false, ping: null, lastFire: 0 };
  }

  _accept(conn) {
    // Même téléphone (même identifiant PeerJS) déjà connu → on remplace sa liaison, il garde sa place et son état
    const same = this.players.findIndex(p => p && p.conn && p.conn.peer === conn.peer);
    if (same >= 0) {
      const p = this.players[same]; try { p.conn.close(); } catch (_) {}
      p.conn = conn; p.ready = false;
      conn.on('open', () => { p.ready = true; conn.send({ t: 'hello', n: same + 1 }); this.onEvent('rejoin', p); });
      conn.on('data', m => this._onData(p, m));
      conn.on('close', () => { if (this.players[same] === p && p.conn === conn) { this.players[same] = null; this.onEvent('leave', p); } });
      return;
    }
    const slot = this.players.findIndex(p => p === null);
    if (slot < 0) { conn.on('open', () => { conn.send({ t: 'full' }); setTimeout(() => conn.close(), 300); }); return; }
    const p = this._newPlayer(slot); p.conn = conn; this.players[slot] = p;
    conn.on('open', () => { p.ready = true; conn.send({ t: 'hello', n: slot + 1 }); this.onEvent('join', p); });
    conn.on('data', m => this._onData(p, m));
    conn.on('close', () => { if (this.players[slot] === p) { this.players[slot] = null; this.onEvent('leave', p); } });
    conn.on('error', e => console.warn('J' + (slot + 1), e));
  }

  _onData(p, m) {
    switch (m.t) {
      case 'a':
        p.yaw = m.y; p.pitch = m.p;
        if (p.yaw0 === null) { p.yaw0 = m.y; p.pitch0 = m.p; }
        this._aim(p);
        break;
      case 'fire': this.onEvent('fire', p); break;
      case 'cover': this.setCover(p, !!m.on); break;
      case 'center': this.center(p); break;
      case 'calibrate': this.onEvent('calibrate', p); break;
      case 'pong': p.ping = Math.round(performance.now() - m.ts); break;
    }
  }

  _aim(p) {
    const fovY = this.fovX * (innerHeight / innerWidth);
    p.rx = 0.5 + wrap(p.yaw - p.yaw0) / this.fovX;
    p.ry = 0.5 - (p.pitch - p.pitch0) / fovY;
  }

  center(p) { p.yaw0 = p.yaw; p.pitch0 = p.pitch; p.fx.reset(); p.fy.reset(); this._aim(p); this.onEvent('center', p); }

  setCover(p, on) {
    if (p.cover === on) return;
    p.cover = on;
    if (on) { p.yawC = p.yaw; p.pitchC = p.pitch; }
    else if (!p.local && this.autoCenter === 'hard') this.center(p);
    else if (!p.local && this.autoCenter === 'soft' && p.yawC !== undefined) {
      const moved = Math.max(Math.abs(wrap(p.yaw - p.yawC)), Math.abs(p.pitch - p.pitchC));
      if (moved > this.softThreshold) this.center(p);
    }
    this.onEvent('cover', p, on);
  }

  // À appeler chaque image : applique le filtre 1 € sur le réticule.
  update(tSec) {
    this.forEach(p => {
      p.x = p.fx.filter(p.rx, tSec);
      p.y = p.fy.filter(p.ry, tSec);
    });
  }

  send(p, obj) { if (p && p.conn && p.conn.open) { try { p.conn.send(obj); } catch (_) {} } }
  forEach(fn) { for (const p of this.players) if (p && p.ready) fn(p); }
  get count() { let n = 0; this.forEach(() => n++); return n; }

  // ---------- Joueur local clavier/souris (tests sur PC) ----------
  addLocalPlayer() {
    const slot = this.players.findIndex(p => p === null);
    if (slot < 0) return null;
    const p = this._newPlayer(slot, true); p.ready = true; p.yaw0 = 0; p.pitch0 = 0;
    p.fx = new OneEuro(30, 0); p.fy = new OneEuro(30, 0);   // quasi sans filtre : la souris est déjà stable
    this.players[slot] = p;
    addEventListener('mousemove', e => { p.rx = e.clientX / innerWidth; p.ry = e.clientY / innerHeight; });
    addEventListener('mousedown', e => { if (e.button === 0) this.onEvent('fire', p); });
    addEventListener('keydown', e => { if (e.code === 'Space' && !e.repeat) { e.preventDefault(); this.setCover(p, true); } });
    addEventListener('keyup', e => { if (e.code === 'Space') this.setCover(p, false); });
    this.onEvent('join', p);
    return p;
  }
}
