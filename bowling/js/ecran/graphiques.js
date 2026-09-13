// Graphique défilant (canvas 2D) : séries temporelles sur une fenêtre glissante, repères verticaux.

const COULEURS_REPERES = { pose: '#2ca05a', leve: '#e0453a', instant: '#f28c28' };

export class Graphique {
  // options : { fenetre (ms), min, max, series: [{ nom, couleur, val: (p) => number|null, epaisseur }], hauteur }
  constructor(canvas, options) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.fenetre = options.fenetre || 3000;
    this.min = options.min;
    this.max = options.max;
    this.series = options.series || [];
    this.hauteur = options.hauteur || 160;
  }

  dessiner(points, reperes, tFin) {
    const c = this.canvas, ctx = this.ctx;
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(200, c.clientWidth || c.parentElement.clientWidth || 600);
    const h = this.hauteur;
    if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) {
      c.width = Math.round(w * dpr);
      c.height = Math.round(h * dpr);
      c.style.height = h + 'px';
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#0f1116';
    ctx.fillRect(0, 0, w, h);

    const x = (t) => w - ((tFin - t) / this.fenetre) * w;
    const y = (v) => h - ((v - this.min) / (this.max - this.min)) * h;

    // Grille : min, 0, max + secondes
    ctx.strokeStyle = '#2a2f3c';
    ctx.lineWidth = 1;
    ctx.font = '11px system-ui, sans-serif';
    ctx.fillStyle = '#98a0ad';
    for (const v of [this.min, 0, this.max]) {
      if (v < this.min || v > this.max) continue;
      const py = Math.round(y(v)) + 0.5;
      ctx.beginPath(); ctx.moveTo(0, py); ctx.lineTo(w, py); ctx.stroke();
      ctx.fillText(String(v), 4, Math.min(h - 4, Math.max(12, py - 3)));
    }
    if (tFin > 0) {
      for (let t = Math.ceil((tFin - this.fenetre) / 1000) * 1000; t <= tFin; t += 1000) {
        const px = Math.round(x(t)) + 0.5;
        ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px, h); ctx.stroke();
      }
    }

    // Séries
    for (const s of this.series) {
      ctx.beginPath();
      let ouvert = false;
      for (const p of points) {
        if (p.t < tFin - this.fenetre) continue;
        const v = s.val(p);
        if (v == null || !Number.isFinite(v)) { ouvert = false; continue; }
        const px = x(p.t), py = Math.max(-4, Math.min(h + 4, y(v)));
        if (!ouvert) { ctx.moveTo(px, py); ouvert = true; } else ctx.lineTo(px, py);
      }
      ctx.strokeStyle = s.couleur;
      ctx.lineWidth = s.epaisseur || 1.3;
      ctx.stroke();
    }

    // Repères
    for (const r of reperes) {
      if (r.t < tFin - this.fenetre || r.t > tFin + 50) continue;
      const px = Math.round(x(r.t)) + 0.5;
      ctx.strokeStyle = COULEURS_REPERES[r.type] || '#fff';
      ctx.lineWidth = r.type === 'instant' ? 2 : 1;
      ctx.setLineDash(r.type === 'instant' ? [] : [4, 3]);
      ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px, h); ctx.stroke();
      ctx.setLineDash([]);
    }

    // Légende
    let lx = 40;
    for (const s of this.series) {
      ctx.fillStyle = s.couleur;
      ctx.fillRect(lx, 6, 10, 3);
      ctx.fillStyle = '#c8cdd6';
      ctx.fillText(s.nom, lx + 14, 12);
      lx += 14 + ctx.measureText(s.nom).width + 16;
    }
  }
}
