// ═══════════════════════════════════════════════════════════════════════════
//  Carnet.gs — Lot 4 : carnet de chantier (plans et documents en pages-images)
//
//  Lu par la page carnet.html (commun/carnet.js). Mesuré sur la copie TEST le 13/11/2026 : docs/lot4-etape0.md.
//
//  Ce que le programme de dépôt écrit dans le dossier de chaque chantier (clé « carnet » de dossiers.json) :
//    CARNET/carnet.json                      la liste des documents (lue ici, jamais écrite par le serveur)
//    CARNET/<dossier du document>/…          les images : aperçu léger, aperçu net, et des PAQUETS de tuiles voisines
//  Un paquet est un fichier où les tuiles sont mises bout à bout ; carnet.json dit où commence chaque tuile.
//  Le serveur lit un paquet en entier avec DriveApp (aucune nouvelle autorisation) et n'en rend que les tuiles demandées.
//
//  Règles :
//   - droit vérifié à chaque demande (accès au chantier, comme les notes) ; même réponse pour « inconnu » et « interdit » ;
//   - le serveur ne supprime RIEN et n'écrit rien dans le carnet ;
//   - aucun identifiant Drive ne part vers les téléphones ; un nom de fichier reçu n'est jamais utilisé : seuls les noms
//     écrits dans carnet.json le sont.
// ═══════════════════════════════════════════════════════════════════════════

const CARNET_FICHIER = 'carnet.json';
const CARNET_MAX_LECTURE = 300 * 1024;    // octets d'images par réponse, en lecture (une barre de réseau)
const CARNET_MAX_MASSE = 1500 * 1024;     // … et pour « Tout télécharger » (Wi-Fi)
const CARNET_MAX_TUILES = 64;             // tuiles demandées en une fois
const CARNET_CACHE_IDS_S = 21600;         // identifiants Drive gardés 6 h (le maximum du cache)
const CARNET_CACHE_LISTE_S = 600;         // liste gardée 10 min : un document déposé apparaît au plus tard 10 min après
const CARNET_CACHE_MAX = 30000;           // caractères par morceau (une valeur du cache ne dépasse pas 100 Ko, accents compris)
const CARNET_CACHE_MORCEAUX = 30;         // jusqu'à 900 000 caractères de liste ; au-delà, elle est relue à chaque demande
const CARNET_NOM_SUR = /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/;   // noms des fichiers d'images : jamais un chemin
const CARNET_REFUS = 'Ce chantier ne fait pas partie de vos chantiers : voyez avec le bureau.';

function carnetErreur_(code, message) { return Object.assign(new Error(message), { carnet: code }); }

// Le chantier demandé et son dossier CARNET (null : pas encore de carnet). Refus : chantier inconnu ou interdit.
function carnetChantier_(compte, corps) {
  const demande = typeof corps.chantier === 'string' ? corps.chantier.trim().slice(0, NOTE_MAX_CHANTIER) : '';
  const chantier = demande ? noteChantierConnu_(demande) : '';
  if (!chantier || !notePeutLire_(compte, chantier)) return null;
  const dossier = dossierChantier_(chantier, false);
  return { chantier: chantier, dossier: dossier ? dossier.getName() : '', carnet: dossier ? dossierParChemin_(dossier, dossiers_().documents.carnet, false) : null };
}

// La liste carnet.json du dossier CARNET : { liste, maj, doublon }. Deux fichiers de ce nom (Drive pour ordinateur en
// fabrique parfois) : le plus récent est pris, et « doublon » le signale.
function carnetListe_(carnet) {
  const cache = cacheScript_(), cle = 'carnet:liste:1:' + carnet.getId();
  const nombreGarde = Number(cache.get(cle + ':n')) || 0;
  if (nombreGarde > 0 && nombreGarde <= CARNET_CACHE_MORCEAUX) {
    const cles = []; for (let i = 0; i < nombreGarde; i++) cles.push(cle + ':' + i);
    const morceaux = cache.getAll(cles);
    if (cles.every(k => typeof morceaux[k] === 'string')) { try { return JSON.parse(cles.map(k => morceaux[k]).join('')); } catch (e) {} }
  }
  const it = carnet.getFilesByName(CARNET_FICHIER);
  let fichier = null, nombre = 0;
  while (it.hasNext()) {
    const f = it.next();
    if (f.isTrashed()) continue;
    nombre++;
    if (!fichier || f.getLastUpdated().getTime() > fichier.getLastUpdated().getTime()) fichier = f;
  }
  if (!fichier) {
    const sous = carnet.getFolders();
    while (sous.hasNext()) { if (!sous.next().isTrashed()) throw carnetErreur_('CARNET_ARRIVE', 'La liste du carnet est en cours d’arrivée : réessayez dans quelques minutes.'); }
    return { liste: { documents: [] }, maj: 0, doublon: false };
  }
  let liste;
  try { liste = JSON.parse(fichier.getBlob().getDataAsString('UTF-8')); } catch (e) { throw carnetErreur_('CARNET_ARRIVE', 'La liste du carnet est en cours d’arrivée : réessayez dans quelques minutes.'); }
  if (!liste || !Array.isArray(liste.documents)) throw carnetErreur_('CARNET_ARRIVE', 'La liste du carnet est en cours d’arrivée : réessayez dans quelques minutes.');
  const rendu = { liste: liste, maj: fichier.getLastUpdated().getTime(), doublon: nombre > 1 };
  // gardée par morceaux (une valeur du cache ne dépasse pas 100 Ko ; la liste d'un chantier riche en grands plans, si)
  const texte = JSON.stringify(rendu), parts = Math.ceil(texte.length / CARNET_CACHE_MAX);
  if (parts <= CARNET_CACHE_MORCEAUX) {
    const valeurs = {};
    for (let i = 0; i < parts; i++) valeurs[cle + ':' + i] = texte.slice(i * CARNET_CACHE_MAX, (i + 1) * CARNET_CACHE_MAX);
    valeurs[cle + ':n'] = String(parts);
    try { cache.putAll(valeurs, CARNET_CACHE_LISTE_S); } catch (e) {}
  }
  return rendu;
}

// Les documents montrés : jamais un document retiré, et pour chaque code seulement le DERNIER déposé (dernier indice)
function carnetDocuments_(liste, chantier, dossier) {
  // le programme de dépôt écrit le nom du chantier, ou à défaut celui de son dossier : les deux sont acceptés
  if (liste.chantier && cleChantier_(liste.chantier) !== cleChantier_(chantier) && cleChantier_(liste.chantier) !== cleChantier_(dossier)) throw carnetErreur_('CARNET_ARRIVE', 'Le carnet de ce dossier appartient à un autre chantier : prévenez le bureau.');
  const parCode = {}, ordre = [];
  liste.documents.forEach(d => {
    if (!d || d.retire === true || typeof d.id !== 'string' || !CARNET_NOM_SUR.test(d.id) || typeof d.dossier !== 'string' || !Array.isArray(d.pages)) return;
    if (/[\/\\]/.test(d.dossier) || !d.dossier.trim()) return;
    const code = String(d.code || d.id);
    if (!parCode[code]) ordre.push(code);
    parCode[code] = d;
  });
  return ordre.map(c => parCode[c]);
}

// Action « carnet » : la liste des documents du chantier ET leur description (pages, niveaux, paquets), en une demande
function carnetLister_(compte, corps) {
  const debut = Date.now(), ou = carnetChantier_(compte, corps);
  if (!ou) return avecJeton_({ ok: false, code: 'INTERDIT', message: CARNET_REFUS }, compte);
  try {
    const lu = ou.carnet ? carnetListe_(ou.carnet) : { liste: { documents: [] }, maj: 0, doublon: false };
    // « empreinte » : change dès qu'un document est redéposé sous le même identifiant (le téléphone efface alors ce qu'il en gardait)
    const empreinte = d => String(d.depose || [d.poids, d.pages.length, d.pages[0] && d.pages[0].leger && d.pages[0].leger.o, d.pages[0] && d.pages[0].net && d.pages[0].net.o, d.date].join('-'));
    const docs = carnetDocuments_(lu.liste, ou.chantier, ou.dossier).map(d => ({ id: d.id, code: String(d.code || ''), indice: String(d.indice || ''),
      intitule: String(d.intitule || ''), date: String(d.date || ''), poids: Number(d.poids) || 0, empreinte: empreinte(d), pages: d.pages }));
    return avecJeton_({ ok: true, code: 'OK', message: docs.length + ' document(s)',
      data: { chantier: ou.chantier, documents: docs, maj: lu.maj, heure: Date.now(), ms: Date.now() - debut } }, compte);
  } catch (e) {
    if (e && e.carnet) return avecJeton_({ ok: false, code: e.carnet, message: e.message }, compte);
    throw e;
  }
}

// Un fichier d'images du document, retrouvé par son nom (écrit dans carnet.json) puis par son identifiant gardé en cache.
// La clé du cache change avec la date de carnet.json : un nouveau dépôt ne sert jamais un ancien fichier.
function carnetFichier_(carnet, maj, doc, nom, taille) {
  if (typeof nom !== 'string' || !CARNET_NOM_SUR.test(nom)) throw carnetErreur_('CARNET_ARRIVE', 'Ce document est incomplet : prévenez le bureau.');
  const cache = cacheScript_(), cle = 'carnet:f:1:' + carnet.getId() + ':' + maj + ':' + doc.id + ':' + nom;
  const bon = f => !!f && !f.isTrashed() && (!taille || f.getSize() === taille);
  const id = cache.get(cle);
  if (id) { try { const f = DriveApp.getFileById(id); if (bon(f)) return f; } catch (e) {} cache.remove(cle); }
  const dossiers = carnet.getFoldersByName(doc.dossier);
  while (dossiers.hasNext()) {
    const d = dossiers.next();
    if (d.isTrashed()) continue;
    const it = d.getFilesByName(nom);
    while (it.hasNext()) { const f = it.next(); if (bon(f)) { cache.put(cle, f.getId(), CARNET_CACHE_IDS_S); return f; } }
  }
  throw carnetErreur_('CARNET_ARRIVE', 'Ce document est en cours d’arrivée : réessayez dans quelques minutes.');
}

// Action « carnetTuiles » : { chantier, doc, page (à partir de 1), quoi: 'leger' | 'net' | 'tuiles', niveau, tuiles: [[colonne, ligne], …], masse }
// Rend les images en base64. Pour les tuiles : autant que le plafond le permet (au moins une), le reste dans « reste ».
function carnetTuiles_(compte, corps) {
  const debut = Date.now(), ou = carnetChantier_(compte, corps);
  if (!ou || !ou.carnet) return avecJeton_({ ok: false, code: 'INTERDIT', message: CARNET_REFUS }, compte);
  try {
    const lu = carnetListe_(ou.carnet);
    const doc = carnetDocuments_(lu.liste, ou.chantier, ou.dossier).filter(d => d.id === corps.doc)[0];
    const page = doc && doc.pages[Number(corps.page) - 1];
    if (!page) return avecJeton_({ ok: false, code: 'CARNET_INCONNU', message: 'Ce document n’est plus au carnet : rouvrez la liste.' }, compte);
    const rendre = (images, reste, lus) => avecJeton_({ ok: true, code: 'OK', message: images.length + ' image(s)',
      data: { images: images, reste: reste, maj: lu.maj, ms: Date.now() - debut, octetsLus: lus } }, compte);
    if (corps.quoi === 'leger' || corps.quoi === 'net') {
      const im = page[corps.quoi];
      if (!im || !im.f) return avecJeton_({ ok: false, code: 'CARNET_INCONNU', message: 'Image absente : rouvrez la liste.' }, compte);
      const octets = carnetFichier_(ou.carnet, lu.maj, doc, im.f, Number(im.o) || 0).getBlob().getBytes();
      return rendre([{ quoi: corps.quoi, b64: Utilities.base64Encode(octets) }], [], octets.length);
    }
    const niveau = (Array.isArray(page.niveaux) ? page.niveaux : []).filter(n => n && n.z === Number(corps.niveau))[0];
    const voulues = Array.isArray(corps.tuiles) ? corps.tuiles.slice(0, CARNET_MAX_TUILES) : [];
    if (corps.quoi !== 'tuiles' || !niveau || !voulues.length) return avecJeton_({ ok: false, code: 'CARNET_INCONNU', message: 'Demande incomprise : rouvrez la liste.' }, compte);
    // Où est chaque tuile : « colonne,ligne » → [paquet, début, longueur]
    const ou2 = {};
    (niveau.paquets || []).forEach((p, i) => (p.tuiles || []).forEach(t => { ou2[t[0] + ',' + t[1]] = [i, Number(t[2]), Number(t[3])]; }));
    const plafond = corps.masse === true ? CARNET_MAX_MASSE : CARNET_MAX_LECTURE;
    const ouverts = {}, images = [], reste = [];
    let total = 0, lus = 0;
    voulues.forEach(v => {
      const cle = Array.isArray(v) ? Number(v[0]) + ',' + Number(v[1]) : '', place = ou2[cle];
      if (!place) return;                                              // tuile inconnue : ignorée
      if (images.length && total + place[2] > plafond) { reste.push([Number(v[0]), Number(v[1])]); return; }
      if (!ouverts[place[0]]) {
        const p = niveau.paquets[place[0]];
        ouverts[place[0]] = carnetFichier_(ou.carnet, lu.maj, doc, p.f, Number(p.o) || 0).getBlob().getBytes();
        lus += ouverts[place[0]].length;
      }
      const octets = ouverts[place[0]];
      if (!(place[1] >= 0) || !(place[2] > 0) || place[1] + place[2] > octets.length) throw carnetErreur_('CARNET_ARRIVE', 'Ce document est incomplet : prévenez le bureau.');
      images.push({ c: Number(v[0]), l: Number(v[1]), b64: Utilities.base64Encode(octets.slice(place[1], place[1] + place[2])) });
      total += place[2];
    });
    return rendre(images, reste, lus);
  } catch (e) {
    if (e && e.carnet) return avecJeton_({ ok: false, code: e.carnet, message: e.message }, compte);
    throw e;
  }
}
