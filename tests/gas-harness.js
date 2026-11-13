// Harnais de test : simule les services Google (Sheet, Drive, Gmail…) pour exécuter apps-script/*.gs avec Node.
// Utilisation : node tests/lot0.test.js
// Rien n'est envoyé ni écrit chez Google : tout se passe en mémoire.
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function creerGoogle(options = {}) {
  let compteurId = 0;
  const nouvelId = () => 'id' + (++compteurId);

  // ── Sheet ──
  function creerFeuille(nom, lignes) {
    const f = { nom, lignes: (lignes || []).map(l => l.slice()) };
    const largeur = () => Math.max(1, ...f.lignes.map(l => l.length));
    const cellule = (r, c) => (f.lignes[r - 1] || [])[c - 1];
    const ecrire = (r, c, v) => { while (f.lignes.length < r) f.lignes.push([]); f.lignes[r - 1][c - 1] = v; };
    // Comme Sheets : une plage qui dépasse la taille de la feuille (1000 lignes, 26 colonnes au départ) lève une erreur
    f.maxLignes = f.maxLignes || 1000;
    const plage = (r, c, nr, nc) => {
      if (r < 1 || c < 1 || nr < 1 || nc < 1 || r + nr - 1 > Math.max(f.maxLignes, f.lignes.length)) throw new Error('Those rows are out of bounds.');
      const p = {
        getValues: () => Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => {
          const v = cellule(r + i, c + j); return v === undefined ? '' : v; })),
        // Texte affiché (comme Sheets en France : virgule décimale)
        getDisplayValues: () => p.getValues().map(l => l.map(v => typeof v === 'number' ? String(v).replace('.', ',') : String(v))),
        getValue: () => { const v = cellule(r, c); return v === undefined ? '' : v; },
        setValues: vals => { vals.forEach((l, i) => l.forEach((v, j) => ecrire(r + i, c + j, v))); return p; },
        setValue: v => { ecrire(r, c, v); return p; },
        clearContent: () => { for (let i = 0; i < nr; i++) for (let j = 0; j < nc; j++) ecrire(r + i, c + j, ''); return p; },
        setFontWeight: () => p, setBackground: () => p, setFontColor: () => p,
        // Lot 2 : cases à cocher et listes de choix (la validation est gardée pour les tests)
        insertCheckboxes: () => { for (let i = 0; i < nr; i++) for (let j = 0; j < nc; j++) ecrire(r + i, c + j, false); f.cases = (f.cases || 0) + nr * nc; return p; },
        setDataValidation: v => { f.validations = (f.validations || []).concat([{ r, c, nr, nc, v }]); return p; },
        getDataValidation: () => { const t = (f.validations || []).filter(x => r >= x.r && r < x.r + x.nr && c >= x.c && c < x.c + x.nc); return t.length ? t[t.length - 1].v : null; },
        setNote: () => p, setWrap: () => p, setNumberFormat: () => p,
        getRow: () => r, getColumn: () => c, getNumRows: () => nr, getNumColumns: () => nc,
      };
      return p;
    };
    f.api = {
      getName: () => nom,
      appendRow: l => { f.lignes.push(l.slice()); },
      getDataRange: () => plage(1, 1, Math.max(1, f.lignes.length), largeur()),
      getRange: (r, c, nr = 1, nc = 1) => plage(r, c, nr, nc),
      getMaxRows: () => Math.max(f.maxLignes, f.lignes.length),
      getLastRow: () => {
        for (let i = f.lignes.length; i > 0; i--) if (f.lignes[i - 1].some(v => v !== '' && v !== undefined)) return i;
        return 0;
      },
      setFrozenRows: () => {},
      insertRowsAfter: (apres, n) => { f.maxLignes = Math.max(f.maxLignes, f.lignes.length) + n; },
      getLastColumn: () => Math.max(0, ...f.lignes.map(l => { for (let j = l.length; j > 0; j--) if (l[j - 1] !== '' && l[j - 1] !== undefined) return j; return 0; })),
      setColumnWidth: () => {},
    };
    return f;
  }
  const feuilles = {};
  Object.entries(options.feuilles || {}).forEach(([n, l]) => { feuilles[n] = creerFeuille(n, l); });
  const ss = {
    getName: () => options.nomSheet || 'ChantierPro',
    getEditors: () => (options.editeurs || ['franck@loue.test']).map(e => ({ getEmail: () => e })),
    getSheetByName: n => (feuilles[n] ? feuilles[n].api : null),
    insertSheet: n => { feuilles[n] = creerFeuille(n, []); return feuilles[n].api; },
  };

  // ── Drive ──
  const elements = {};   // id → élément
  function creerElement(type, nom, parent, extra) {
    const id = (extra && extra.id) || nouvelId();
    const el = { id, type, nom, parents: parent ? [parent] : [], enfants: [], acces: 'PRIVATE', permission: 'NONE',
      corbeille: false, contenu: extra && extra.contenu };
    if (parent) parent.enfants.push(el);
    elements[id] = el;
    const it = arr => { let i = 0; return { hasNext: () => i < arr.length, next: () => arr[i++].api,
      getContinuationToken: () => 'jeton:' + i }; };
    el.api = {
      getId: () => id, getName: () => el.nom, getUrl: () => 'https://drive.google.com/' + id,
      getMimeType: () => (extra && extra.mime) || 'application/pdf',
      getLastUpdated: () => new Date(2026, 9, 29),
      getDateCreated: () => new Date(el.cree || Date.now()),
      getParents: () => it(el.parents),
      setSharing: (a, p) => {
        // Option « heritage » : comme Drive, on ne peut pas retirer un partage hérité du dossier parent
        if (options.heritage && a === 'PRIVATE' && el.acces === 'PRIVATE' && accesEffectif(el) !== 'PRIVATE')
          throw new Error('Permission héritée du dossier parent');
        el.acces = a; el.permission = p;
      },
      getSharingAccess: () => accesEffectif(el), getSharingPermission: () => el.permission,
      isTrashed: () => el.corbeille, setTrashed: v => { el.corbeille = v; },
      getBlob: () => blob(el.contenu || '', el.nom, extra && extra.mime),
      getFiles: () => it(el.enfants.filter(e => e.type === 'fichier')),
      getFolders: () => it(el.enfants.filter(e => e.type === 'dossier')),
      getFoldersByName: n => it(el.enfants.filter(e => e.type === 'dossier' && e.nom === n)),
      getFilesByName: n => it(el.enfants.filter(e => e.type === 'fichier' && e.nom === n && !e.corbeille)),
      createFolder: n => creerElement('dossier', n, el).api,
      createFile: (b, contenu, mime) => typeof b === 'string'
        ? creerElement('fichier', b, el, { contenu: contenu, mime: mime }).api
        : creerElement('fichier', b.getName(), el, { contenu: b.contenu, mime: b.mime }).api,
      // Déplacement : même identifiant, nouveau dossier parent (comme Drive)
      moveTo: dest => {
        const cible = elements[dest.getId()];
        el.parents.forEach(p => { p.enfants = p.enfants.filter(e => e !== el); });
        el.parents = [cible]; cible.enfants.push(el);
        return el.api;
      },
      setContent: c => { el.contenu = c; return el.api; },
    };
    return el;
  }
  // Accès réel d'un élément : le sien, ou (option « heritage ») celui d'un dossier parent partagé
  function accesEffectif(el) {
    if (!options.heritage || el.acces !== 'PRIVATE') return el.acces;
    for (let p = el.parents[0]; p; p = p.parents[0]) if (p.acces !== 'PRIVATE') return p.acces;
    return el.acces;
  }
  const DriveApp = {
    Access: { ANYONE: 'ANYONE', ANYONE_WITH_LINK: 'ANYONE_WITH_LINK', PRIVATE: 'PRIVATE' },
    Permission: { VIEW: 'VIEW', EDIT: 'EDIT', NONE: 'NONE' },
    getFolderById: id => { const e = elements[id]; if (!e || e.type !== 'dossier') throw new Error('Dossier introuvable ' + id); return e.api; },
    getFileById: id => { const e = elements[id]; if (!e || e.type !== 'fichier') throw new Error('Fichier introuvable ' + id); return e.api; },
    searchFiles: () => recherche('fichier', 0),
    searchFolders: () => recherche('dossier', 0),
    continueFileIterator: j => recherche('fichier', Number(j.split(':')[1])),
    continueFolderIterator: j => recherche('dossier', Number(j.split(':')[1])),
  };
  function recherche(type, depart) {
    const liste = Object.values(elements).filter(e => e.type === type && !e.corbeille &&
      (accesEffectif(e) === 'ANYONE_WITH_LINK' || accesEffectif(e) === 'ANYONE'));
    let i = depart;
    return { hasNext: () => i < liste.length, next: () => liste[i++].api, getContinuationToken: () => 'jeton:' + i };
  }

  // ── Blob / HTML → PDF ──
  function blob(contenu, nom, mime) {
    const b = { contenu, nom, mime,
      setName: n => { b.nom = n; return b; }, getName: () => b.nom,
      getDataAsString: () => Buffer.isBuffer(contenu) ? contenu.toString('utf8') : String(contenu),
      getBytes: () => Array.from(Buffer.from(typeof contenu === 'string' ? contenu : contenu, typeof contenu === 'string' ? 'utf8' : undefined)),
      copyBlob: () => blob(contenu, b.nom, mime) };
    return b;
  }
  const HtmlService = { createHtmlOutput: html => ({ getAs: () => blob(html, 'sans-nom.pdf') }) };

  // ── Mails ──
  const mails = [];
  const etat = { quota: options.quota === undefined ? 100 : options.quota };
  const GmailApp = {
    sendEmail: (to, sujet, texte, opts) => {
      if (options.mailEnPanne) throw new Error('Service Gmail indisponible');
      const n = 1 + (opts && opts.bcc ? 1 : 0);
      if (etat.quota < n) throw new Error('Quota dépassé');
      etat.quota -= n;
      mails.push({ to, sujet, texte, opts: opts || {} });
    },
  };
  const MailApp = { getRemainingDailyQuota: () => etat.quota };

  // ── Divers ──
  const proprietes = Object.assign({}, options.proprietes || {});
  const PropertiesService = { getScriptProperties: () => ({
    getProperty: k => (k in proprietes ? proprietes[k] : null),
    setProperty: (k, v) => { proprietes[k] = String(v); },
    deleteProperty: k => { delete proprietes[k]; },
    getKeys: () => Object.keys(proprietes),
  }) };
  const deux = n => String(n).padStart(2, '0');
  const Utilities = {
    base64Decode: s => Array.from(Buffer.from(s, 'base64')),
    base64Encode: octets => Buffer.from(octets).toString('base64'),
    newBlob: (octets, mime, nom) => blob(Buffer.from(octets), nom, mime),
    // Lot 2 : signature HMAC, identifiants aléatoires, base64 « sûr pour les adresses », pause
    computeHmacSha256Signature: (valeur, cle) => {
      const enOctets = x => Array.isArray(x) ? Buffer.from(x.map(o => o & 0xFF)) : Buffer.from(String(x), 'utf8');
      return Array.from(require('crypto').createHmac('sha256', enOctets(cle)).update(enOctets(valeur)).digest()).map(o => o > 127 ? o - 256 : o);
    },
    getUuid: () => require('crypto').randomUUID(),
    base64EncodeWebSafe: o => (typeof o === 'string' ? Buffer.from(o, 'utf8') : Buffer.from(o.map(x => x & 0xFF))).toString('base64').replace(/\+/g, '-').replace(/\//g, '_'),
    base64DecodeWebSafe: t => Array.from(Buffer.from(String(t).replace(/-/g, '+').replace(/_/g, '/'), 'base64')).map(o => o > 127 ? o - 256 : o),
    sleep: ms => { etat.pauses = (etat.pauses || 0) + ms; },
    formatDate: (d, tz, f) => f.replace('yyyy', d.getFullYear()).replace('MM', deux(d.getMonth() + 1))
      .replace('dd', deux(d.getDate())).replace('HH', deux(d.getHours())).replace('mm', deux(d.getMinutes())),
  };
  const declencheurs = [];
  const cache = {};
  const ScriptApp = {
    getProjectTriggers: () => declencheurs.map(t => ({ getHandlerFunction: () => t })),
    // comme le vrai : ne retire QUE le déclencheur donné (un seul, s'il y en a plusieurs du même nom)
    deleteTrigger: d => { const i = declencheurs.indexOf(d.getHandlerFunction()); if (i > -1) declencheurs.splice(i, 1); },
    newTrigger: fn => ({
      timeBased: () => ({ everyHours: () => ({ create: () => declencheurs.push(fn) }), everyMinutes: () => ({ create: () => declencheurs.push(fn) }),
        after: () => ({ create: () => declencheurs.push(fn) }) }),
      forSpreadsheet: () => ({ onEdit: () => ({ create: () => declencheurs.push(fn) }) }),
    }),
  };
  const contexte = {
    SpreadsheetApp: { getActiveSpreadsheet: () => ss,
      newDataValidation: () => { const v = { liste: null, invalide: true,
        requireValueInList: l => { v.liste = l; return v; }, requireValueInRange: () => v, requireCheckbox: () => { v.liste = [true, false]; return v; },
        setAllowInvalid: b => { v.invalide = b; return v; }, setHelpText: () => v, build: () => v }; return v; } },
    DriveApp, HtmlService, GmailApp, MailApp, PropertiesService, Utilities, ScriptApp,
    LockService: { getScriptLock: () => ({ tryLock: () => !options.verrouOccupe, releaseLock: () => {} }),
                   getDocumentLock: () => ({ tryLock: () => !options.verrouOccupe, releaseLock: () => {} }) },
    CacheService: { getScriptCache: () => ({
      get: k => (cache[k] === undefined ? null : cache[k]), put: (k, v) => { cache[k] = String(v); }, remove: k => { delete cache[k]; } }) },
    Session: { getEffectiveUser: () => ({ getEmail: () => 'franck@loue.test' }),
               getActiveUser: () => ({ getEmail: () => '' }) },
    ContentService: { MimeType: { TEXT: 'text', JSON: 'json', JAVASCRIPT: 'js' },
      createTextOutput: s => ({ contenu: s, setMimeType() { return this; } }) },
    Logger: { log: () => {} },
    console: { log: () => {}, error: () => {} },
  };
  return { contexte, feuilles, elements, mails, etat, proprietes, creerElement, declencheurs, cache };
}

// Charge tous les fichiers .gs du dossier apps-script dans un contexte simulé
// fichierUnique (facultatif) : charger seulement ce fichier (ex. le Code.gs à coller de la livraison)
function chargerScript(google, fichierUnique) {
  const dossier = path.join(__dirname, '..', 'apps-script');
  const ctx = vm.createContext(google.contexte);
  const fichiers = fichierUnique ? [fichierUnique]
    : fs.readdirSync(dossier).filter(f => f.endsWith('.gs')).sort().map(f => path.join(dossier, f));
  fichiers.forEach(f => vm.runInContext(fs.readFileSync(f, 'utf8'), ctx, { filename: path.basename(f) }));
  return ctx;
}

module.exports = { creerGoogle, chargerScript };
