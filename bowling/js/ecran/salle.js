// Salle (côté écran) : ouvre l'identifiant PeerJS "bowl-XXXXX", accueille les manettes,
// mesure la latence, surveille les liens et conserve la place des manettes absentes.
//
// Événements émis (CustomEvent, détail entre parenthèses) :
//   ouverte (code) · code-indisponible (code) · signalisation ({etat}) · erreur ({type, message})
//   joueur-arrive ({joueur, reprise}) · joueur-lien ({joueur}) · joueur-latence ({joueur})
//   joueur-parti ({joueur}) · refus ({raison, nom}) · message ({joueur, message})

import {
  PREFIXE_SALLE, ALPHABET_CODE, LONGUEUR_CODE, MAX_JOUEURS, COULEURS,
  DELAI_PERTE_LIEN_MS, DELAI_RECONNEXION_MS, DELAI_OUBLI_PLACE_MIN, VERSION_PROTOCOLE,
} from '../commun/constantes.js';
import { TYPES, estMessageValide } from '../commun/protocole.js';
import { mediane } from '../commun/maths.js';

export function nouveauCode() {
  const alea = new Uint32Array(LONGUEUR_CODE);
  crypto.getRandomValues(alea);
  let code = '';
  for (let i = 0; i < LONGUEUR_CODE; i++) code += ALPHABET_CODE[alea[i] % ALPHABET_CODE.length];
  return code;
}

export function codeValide(code) {
  return typeof code === 'string' && code.length === LONGUEUR_CODE && [...code].every((c) => ALPHABET_CODE.includes(c));
}

export class Salle extends EventTarget {
  constructor(options = {}) {
    super();
    this.options = options;      // { serveur: 'hôte de signalisation' | '', delaiOubliMin: 10 }
    this.peer = null;
    this.code = null;
    this.joueurs = new Map();    // jeton → joueur
    this._minuteur = null;
    this._tic = 0;
  }

  get liste() {
    return [...this.joueurs.values()].sort((a, b) => a.index - b.index);
  }

  ouvrir(code) {
    this._detruirePeer();
    this.code = code;
    const opts = { debug: 1, secure: true };
    if (this.options.serveur) { opts.host = this.options.serveur; opts.port = 443; opts.path = '/'; }
    const peer = new window.Peer(PREFIXE_SALLE + code, opts);
    this.peer = peer;

    peer.on('open', () => {
      if (this.peer !== peer) return;
      this._emettre('signalisation', { etat: 'connecte' });
      this._emettre('ouverte', { code });
    });
    peer.on('connection', (conn) => { if (this.peer === peer) this._surConnexion(conn); });
    peer.on('disconnected', () => {
      if (this.peer !== peer) return;
      this._emettre('signalisation', { etat: 'deconnecte' });
      setTimeout(() => {
        if (this.peer === peer && !peer.destroyed && peer.disconnected) {
          try { peer.reconnect(); } catch (e) { /* on retentera au prochain cycle */ }
        }
      }, DELAI_RECONNEXION_MS);
    });
    peer.on('error', (err) => {
      if (this.peer !== peer) return;
      const type = err && err.type ? err.type : 'inconnu';
      if (type === 'unavailable-id') { this._emettre('code-indisponible', { code }); return; }
      this._emettre('erreur', { type, message: String((err && err.message) || err) });
      if (['network', 'server-error', 'socket-error', 'socket-closed'].includes(type)) {
        this._emettre('signalisation', { etat: 'deconnecte' });
      }
    });

    if (!this._minuteur) this._minuteur = setInterval(() => this._boucle(), 500);
  }

  fermer() {
    this._detruirePeer();
    if (this._minuteur) { clearInterval(this._minuteur); this._minuteur = null; }
    this.joueurs.clear();
  }

  _detruirePeer() {
    if (this.peer) {
      const p = this.peer;
      this.peer = null;
      try { p.destroy(); } catch (e) { /* ignoré */ }
    }
  }

  envoyer(j, msg) {
    if (j && j.conn && j.conn.open) {
      try { j.conn.send(msg); return true; } catch (e) { return false; }
    }
    return false;
  }

  diffuser(msg) {
    for (const j of this.joueurs.values()) this.envoyer(j, msg);
  }

  _surConnexion(conn) {
    // Le premier message doit être un "bonjour" ; sinon la connexion est fermée.
    const premier = (m) => {
      conn.off('data', premier);
      if (!estMessageValide(m) || m.type !== TYPES.BONJOUR) { try { conn.close(); } catch (e) { /* */ } return; }
      this._surBonjour(conn, m);
    };
    conn.on('data', premier);
    conn.on('error', () => { /* les erreurs de canal se traduisent par une fermeture */ });
  }

  _surBonjour(conn, m) {
    if (m.version !== VERSION_PROTOCOLE) {
      try { conn.send({ type: TYPES.REFUS, raison: 'versionProtocole' }); } catch (e) { /* */ }
      setTimeout(() => { try { conn.close(); } catch (e) { /* */ } }, 500);
      this._emettre('refus', { raison: 'versionProtocole', nom: m.nom });
      return;
    }
    const jeton = String(m.jeton || '').slice(0, 64);
    let j = this.joueurs.get(jeton);
    const reprise = !!j;
    if (!j) {
      if (this.joueurs.size >= MAX_JOUEURS) {
        try { conn.send({ type: TYPES.REFUS, raison: 'sallePleine' }); } catch (e) { /* */ }
        setTimeout(() => { try { conn.close(); } catch (e) { /* */ } }, 500);
        this._emettre('refus', { raison: 'sallePleine', nom: m.nom });
        return;
      }
      const indices = new Set([...this.joueurs.values()].map((x) => x.index));
      let index = 0;
      while (indices.has(index)) index++;
      j = {
        jeton, index, nom: '', couleur: null, main: 'droite', plateforme: '', ua: '',
        conn: null, connecte: false, derniereActivite: performance.now(),
        latence: null, rtt: null, offsets: [], offset: 0,
        seqDernier: -1, compteurEch: 0, freq: 0, actif: true, dateArrivee: Date.now(),
      };
      this.joueurs.set(jeton, j);
    } else if (j.conn && j.conn !== conn) {
      const ancienne = j.conn;
      j.conn = null;
      try { ancienne.close(); } catch (e) { /* */ }
    }
    j.nom = String(m.nom || ('Joueur ' + (j.index + 1))).slice(0, 14);
    j.main = m.main === 'gauche' ? 'gauche' : 'droite';
    j.plateforme = String(m.plateforme || '').slice(0, 16);
    j.ua = String(m.ua || '').slice(0, 120);
    j.couleur = this._attribuerCouleur(j, m.couleur);
    j.conn = conn;
    j.connecte = true;
    j.derniereActivite = performance.now();
    j.seqDernier = -1;

    conn.on('data', (d) => { if (j.conn === conn) this._surDonnees(j, d); });
    conn.on('close', () => {
      if (j.conn === conn) { j.connecte = false; this._emettre('joueur-lien', { joueur: j }); }
    });
    this._emettre('joueur-arrive', { joueur: j, reprise });
  }

  _attribuerCouleur(j, souhait) {
    const prises = new Set([...this.joueurs.values()].filter((x) => x !== j).map((x) => x.couleur));
    if (souhait && COULEURS.some((c) => c.id === souhait) && !prises.has(souhait)) return souhait;
    if (j.couleur && !prises.has(j.couleur)) return j.couleur;
    return (COULEURS.find((c) => !prises.has(c.id)) || COULEURS[0]).id;
  }

  _surDonnees(j, m) {
    if (!estMessageValide(m)) return;
    j.derniereActivite = performance.now();
    if (!j.connecte) { j.connecte = true; this._emettre('joueur-lien', { joueur: j }); }

    if (m.type === TYPES.PONG) {
      const maintenant = performance.now();
      if (typeof m.t !== 'number' || typeof m.tp !== 'number') return;
      const rtt = maintenant - m.t;
      j.rtt = rtt;
      j.latence = rtt / 2;
      j.offsets.push(m.tp - (m.t + rtt / 2)); // horloge téléphone − horloge écran
      if (j.offsets.length > 8) j.offsets.shift();
      j.offset = mediane(j.offsets);
      this._emettre('joueur-latence', { joueur: j });
      return;
    }
    if (m.type === TYPES.ECHANTILLON) {
      if (typeof m.seq === 'number') {
        if (m.seq <= j.seqDernier) return; // échantillon en retard : ignoré
        j.seqDernier = m.seq;
      }
      j.compteurEch++;
    }
    this._emettre('message', { joueur: j, message: m });
  }

  _boucle() {
    const maintenant = performance.now();
    this._tic = (this._tic + 1) % 2;
    const chaqueSeconde = this._tic === 0;
    const oubli = (this.options.delaiOubliMin || DELAI_OUBLI_PLACE_MIN) * 60000;
    for (const [jeton, j] of [...this.joueurs]) {
      if (chaqueSeconde) {
        j.freq = j.compteurEch;
        j.compteurEch = 0;
        if (j.connecte) this.envoyer(j, { type: TYPES.PING, t: maintenant });
      }
      if (j.connecte && maintenant - j.derniereActivite > DELAI_PERTE_LIEN_MS) {
        j.connecte = false;
        this._emettre('joueur-lien', { joueur: j });
      }
      if (!j.connecte && maintenant - j.derniereActivite > oubli) {
        this.joueurs.delete(jeton);
        this._emettre('joueur-parti', { joueur: j });
      }
    }
  }

  _emettre(nom, detail) {
    this.dispatchEvent(new CustomEvent(nom, { detail }));
  }
}
