// HUD : calque DOM au-dessus de la 3D. Aucune logique de jeu, seulement de l'affichage.

const NOMS_PHASES = { preparation: 'Préparation', roulement: 'Roulement', impact: 'Impact', resultat: 'Résultat', remise: 'Remise en place' };

function el(tag, classe, html) {
  const e = document.createElement(tag);
  if (classe) e.className = classe;
  if (html != null) e.innerHTML = html;
  return e;
}

export class Hud {
  constructor(conteneur, lire) {
    this.lire = (id, defaut) => { const v = lire ? lire(id) : undefined; return v === undefined || v === null ? defaut : v; };
    this.racine = conteneur;
    this.racine.innerHTML = '';

    this.etat = el('div', 'hud-etat');
    this.etat.append(
      (this.pFrame = el('div', 'hud-frame', 'Frame 1 · Boule 1')),
      (this.pDebout = el('div', 'hud-debout', 'Quilles debout : 10')),
      (this.pPhase = el('div', 'hud-phase', 'Préparation')),
      (this.pLanceur = el('div', 'hud-lanceur', ''))
    );

    this.rejoindre = el('div', 'hud-rejoindre');
    this.rejoindre.append(
      el('div', 'hud-rejoindre-titre', 'Rejoindre'),
      (this.pCode = el('div', 'hud-code', '—')),
      (this.pQr = el('div', 'hud-qr')),
      (this.pManettes = el('div', 'hud-manettes', '0 manette')),
      el('div', 'hud-rejoindre-aide', 'J : masquer · C : banc')
    );

    this.visee = el('div', 'hud-visee');
    this.visee.append(
      (this.pPosition = el('div', 'hud-ligne', 'Position <b>0,00</b>')),
      (this.pAngle = el('div', 'hud-ligne', 'Angle <b>0,00°</b>')),
      (this.pEffet = el('div', 'hud-ligne', 'Effet <b>0</b>')),
      (this.pJauge = el('div', 'hud-jauge', '<div class="hud-jauge-barre"><div class="hud-jauge-remplissage"></div></div><span>Puissance</span>')),
      (this.pGag = el('div', 'hud-gag', ''))
    );
    this.jaugeRemplissage = this.pJauge.querySelector('.hud-jauge-remplissage');

    this.aide = el('div', 'hud-aide');
    this.aide.innerHTML = [
      '<b>Clavier</b>',
      '← → position · Q/D angle · Début : recentrer',
      'Espace maintenu : jauge, ← → effet, relâcher : lancer',
      'L : lancer lobé · B : lancer en arrière',
      'Espace ou Entrée : passer · V caméra libre · F plein écran',
      'C banc de calibrage · Échap réglages · J rejoindre · H aide',
    ].join('<br>');

    this.callout = el('div', 'hud-callout');
    this.toast = el('div', 'hud-toast');
    this.tour = el('div', 'hud-tour cache');
    this.tour.append((this.pTourTitre = el('div', 'hud-tour-titre', '')), (this.pTourSous = el('div', 'hud-tour-sous', '')));

    this.entrainement = el('div', 'hud-entrainement cache');
    this.racine.append(this.etat, this.rejoindre, this.visee, this.aide, this.callout, this.toast, this.tour, this.entrainement);
    this.aide.classList.toggle('cache', !this.lire('afficherAide', true));
    this.rejoindre.classList.toggle('cache', !this.lire('afficherRejoindre', true));
    this.majTailleTextes();
  }

  majTailleTextes() {
    this.racine.style.fontSize = (this.lire('tailleTextes', 100) / 100) + 'rem';
  }

  majEntrainement(e) {
    if (!e) { this.entrainement.classList.add('cache'); return; }
    this.entrainement.classList.remove('cache');
    this.entrainement.innerHTML = '<div>' + e.titre + ' — lancer <b>' + e.lancer + '</b> / ' + e.total + ' · score <b>' + e.score + '</b></div>' +
      '<div class="rack">' + (e.rack && e.rack.length ? (e.rack.length <= 10 ? 'quilles ' + e.rack.join('-') : e.rack.length + ' quilles') : '') + (e.niveau ? ' · niveau ' + e.lancer + ' : ' + e.niveau : '') + '</div>';
  }

  // Bandeau central bas : « À toi, Valentin », « Passe le téléphone à Mallaury », « Bot Pro joue… »…
  majTour({ titre = '', sous = '', classe = '' } = {}) {
    this.pTourTitre.textContent = titre;
    this.pTourSous.textContent = sous;
    this.tour.className = 'hud-tour ' + classe + (titre ? '' : ' cache');
  }

  majEtat({ phase, boule, frame, debout, lanceur, joueur }) {
    if (frame != null && boule != null) this.pFrame.textContent = (joueur ? joueur + ' · ' : '') + 'Frame ' + frame + ' · Boule ' + boule;
    if (debout != null) this.pDebout.textContent = 'Quilles debout : ' + debout;
    if (phase) { this.pPhase.textContent = NOMS_PHASES[phase] || phase; this.pPhase.dataset.phase = phase; }
    if (lanceur !== undefined) this.pLanceur.textContent = lanceur ? 'Lanceur : ' + lanceur : '';
    this.visee.classList.toggle('inactif', phase && phase !== 'preparation');
  }

  majVisee({ position, angle }) {
    this.pPosition.innerHTML = 'Position <b>' + (position >= 0 ? '+' : '') + position.toFixed(2).replace('.', ',') + '</b>';
    this.pAngle.innerHTML = 'Angle <b>' + (angle >= 0 ? '+' : '') + angle.toFixed(2).replace('.', ',') + '°</b>';
  }

  majJauge({ active, valeur, effet }) {
    this.pJauge.classList.toggle('active', !!active);
    this.jaugeRemplissage.style.width = Math.round((valeur || 0) * 100) + '%';
    const e = effet || 0;
    this.pEffet.innerHTML = 'Effet <b>' + (e > 0.05 ? '→ ' : e < -0.05 ? '← ' : '') + Math.abs(e).toFixed(2).replace('.', ',') + '</b>';
  }

  majGag(gag) {
    this.pGag.textContent = gag === 'lob' ? 'Prochain lancer : LOBÉ (L)' : gag === 'arriere' ? 'Prochain lancer : EN ARRIÈRE (B)' : '';
  }

  majRejoindre({ code, svg, nbManettes }) {
    if (code != null) this.pCode.textContent = code;
    if (svg != null) this.pQr.innerHTML = svg;
    if (nbManettes != null) this.pManettes.textContent = nbManettes + (nbManettes > 1 ? ' manettes' : ' manette');
  }

  basculerAide(force) {
    const visible = force == null ? this.aide.classList.contains('cache') : force;
    this.aide.classList.toggle('cache', !visible);
    return visible;
  }

  basculerRejoindre(force) {
    const visible = force == null ? this.rejoindre.classList.contains('cache') : force;
    this.rejoindre.classList.toggle('cache', !visible);
    return visible;
  }

  // Grand texte central (STRIKE !, SPARE !, …), disparaît après `duree` s.
  annoncer(texte, classe = '', duree = 2.2) {
    clearTimeout(this._tCallout);
    this.callout.textContent = texte;
    this.callout.className = 'hud-callout visible ' + classe;
    this._tCallout = setTimeout(() => this.callout.classList.remove('visible'), duree * 1000);
  }

  // Pluie de confettis (strike, turkey, partie parfaite).
  confettis(nb = 80, duree = 3) {
    const c = el('div', 'confettis');
    const couleurs = ['#ffd54a', '#e0453a', '#2f6fe4', '#7ee2a2', '#c58bff', '#f28c28'];
    for (let i = 0; i < nb; i++) {
      const p = el('div', 'confetti');
      p.style.left = Math.random() * 100 + 'vw';
      p.style.background = couleurs[i % couleurs.length];
      p.style.animationDuration = (duree * (0.6 + Math.random() * 0.6)) + 's';
      p.style.animationDelay = (Math.random() * 0.8) + 's';
      p.style.transform = 'rotate(' + Math.random() * 360 + 'deg)';
      c.append(p);
    }
    document.body.append(c);
    setTimeout(() => c.remove(), (duree + 1.5) * 1000);
  }

  // Petit message discret en bas.
  message(texte, duree = 3) {
    clearTimeout(this._tToast);
    this.toast.textContent = texte;
    this.toast.classList.add('visible');
    this._tToast = setTimeout(() => this.toast.classList.remove('visible'), duree * 1000);
  }

  texteResultat(res) {
    if (res.phaseLancer === 'arriere') return { texte: 'EN ARRIÈRE !', classe: 'gag' };
    if (res.strike) return { texte: 'STRIKE !', classe: 'strike' };
    if (res.spare) return { texte: 'SPARE !', classe: 'spare' };
    if (res.gouttiere && res.tombees === 0) return { texte: 'GOUTTIÈRE', classe: 'gouttiere' };
    if (res.tombees === 0) return { texte: 'AUCUNE QUILLE', classe: 'zero' };
    return { texte: res.tombees + (res.tombees > 1 ? ' QUILLES' : ' QUILLE'), classe: '' };
  }
}
