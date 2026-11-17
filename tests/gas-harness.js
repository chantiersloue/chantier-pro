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
        // Lot 5 : protection « avertissement seulement » d'une plage (gardée pour les tests)
        protect: () => { const pr = { avertissement: false, description: '', r, c, nr, nc,
          setDescription: d => { pr.description = d; return pr; }, setWarningOnly: b => { pr.avertissement = b; return pr; } };
          f.protections = (f.protections || []).concat([pr]); return pr; },
        getRow: () => r, getColumn: () => c, getNumRows: () => nr, getNumColumns: () => nc,
      };
      return p;
    };
    f.api = {
      getName: () => f.nom,
      // Renommer un onglet, supprimer une ligne (utilisés par la porte de service de la copie TEST)
      setName: n => { if (feuilles[n]) throw new Error('Un onglet porte déjà ce nom'); delete feuilles[f.nom]; f.nom = n; feuilles[n] = f; return f.api; },
      deleteRow: r => { f.lignes.splice(r - 1, 1); },
      getMaxColumns: () => 26, isSheetHidden: () => false,
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
    getSheets: () => Object.keys(feuilles).map(n => feuilles[n].api),
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
    if (extra && typeof extra.taille === 'number') el.taille = extra.taille;
    if (extra && extra.maj) el.maj = extra.maj;
    el.api = {
      getId: () => id, getName: () => el.nom, getUrl: () => 'https://drive.google.com/' + id,
      getMimeType: () => (extra && extra.mime) || 'application/pdf',
      getLastUpdated: () => new Date(el.maj || new Date(2026, 9, 29).getTime()),
      // Lot 5 : « taille » (octets) donnée à la création ou posée ensuite sur l'élément l'emporte sur le contenu
      getSize: () => (typeof el.taille === 'number' ? el.taille
        : Buffer.isBuffer(el.contenu) ? el.contenu.length : Buffer.byteLength(String(el.contenu || ''), 'utf8')),
      getDateCreated: () => new Date(el.cree || Date.now()),
      getParents: () => it(el.parents),
      setSharing: (a, p) => {
        // Option « heritage » : comme Drive, on ne peut pas retirer un partage hérité du dossier parent
        if (options.heritage && a === 'PRIVATE' && el.acces === 'PRIVATE' && accesEffectif(el) !== 'PRIVATE')
          throw new Error('Permission héritée du dossier parent');
        el.acces = a; el.permission = p;
      },
      getSharingAccess: () => accesEffectif(el), getSharingPermission: () => el.permission,
      // Lot 5 : comme Drive, ce que contient un dossier mis à la corbeille est à la corbeille lui aussi, et en sort avec lui ;
      // les parcours (getFiles, getFolders, getFoldersByName) RENDENT ces éléments : c'est au code de tester isTrashed().
      // etat.avantCorbeille(el, valeur) : appelée avant chaque setTrashed ; si elle lève une erreur, c'est une panne simulée.
      isTrashed: () => aLaCorbeille(el),
      setTrashed: v => {
        if (typeof etat.avantCorbeille === 'function') etat.avantCorbeille(el, v);
        el.corbeille = v; etat.corbeilles.push({ id: id, nom: el.nom, valeur: v });
        return el.api;
      },
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
  // À la corbeille : lui-même, ou l'un des dossiers qui le contiennent
  function aLaCorbeille(el) {
    for (let p = el, n = 0; p && n < 50; p = p.parents[0], n++) if (p.corbeille) return true;
    return false;
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
    // Lot 5 : place du compte (octets), réglable par etat.stockage = { utilise, limite }
    getStorageUsed: () => etat.stockage.utilise,
    getStorageLimit: () => etat.stockage.limite,
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
      // comme le vrai Apps Script : des octets SIGNÉS, de −128 à 127
      getBytes: () => Array.from(Buffer.from(typeof contenu === 'string' ? contenu : contenu, typeof contenu === 'string' ? 'utf8' : undefined)).map(o => o > 127 ? o - 256 : o),
      copyBlob: () => blob(contenu, b.nom, mime) };
    return b;
  }
  const HtmlService = { createHtmlOutput: html => ({ getAs: () => blob(html, 'sans-nom.pdf') }) };

  // ── Mails ──
  const mails = [];
  const etat = { quota: options.quota === undefined ? 100 : options.quota,
    // Lot 5 : place du compte vue par DriveApp ; service avancé Drive (null = non activé) ; mises à la corbeille faites ;
    // nombre de fois où le verrou du script a été demandé ; écritures forcées (flush)
    stockage: Object.assign({ utilise: 0, limite: 15 * 1024 * 1024 * 1024 }, options.stockage || {}),
    driveAvance: options.driveAvance || null, corbeilles: [], verrousScript: 0, flush: 0, avantCorbeille: null };
  const GmailApp = {
    sendEmail: (to, sujet, texte, opts) => {
      if (options.mailEnPanne || etat.mailEnPanne) throw new Error('Service Gmail indisponible');
      // Lot 5b : etat.avantMail(to, sujet, texte, opts) est appelée avant chaque envoi ; si elle lève une erreur, c'est un refus simulé
      if (typeof etat.avantMail === 'function') etat.avantMail(to, sujet, texte, opts || {});
      // Lot 5b : comme Google, le quota compte chaque adresse réelle de « À », « Copie » et « Copie cachée » (un « À » vide
      // compte 0) ; un mail sans aucun destinataire, ou à plus de 50 destinataires, est refusé
      const adresses = v => String(v || '').split(/[,;\s]+/).filter(a => a.indexOf('@') > -1);
      const n = adresses(to).length + adresses(opts && opts.cc).length + adresses(opts && opts.bcc).length;
      if (!n) throw new Error('Failed to send email: no recipient');
      if (n > 50) throw new Error('Limit Exceeded: Email Recipients Per Message.');
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
    base64Encode: octets => (typeof octets === 'string' ? Buffer.from(octets, 'utf8') : Buffer.from(octets.map(x => x & 0xFF))).toString('base64'),
    newBlob: (octets, mime, nom) => blob(typeof octets === 'string' ? Buffer.from(octets, 'utf8') : Buffer.from(octets.map(x => x & 0xFF)), nom, mime),
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
      // réglages enchaînables, comme le vrai : everyHours, everyMinutes, after, atHour, everyDays, nearMinute, inTimezone
      timeBased: () => { const b = { create: () => declencheurs.push(fn) };
        ['everyHours', 'everyMinutes', 'after', 'atHour', 'everyDays', 'nearMinute', 'inTimezone'].forEach(m => { b[m] = () => b; });
        return b; },
      forSpreadsheet: () => ({ onEdit: () => ({ create: () => declencheurs.push(fn) }) }),
    }),
  };
  const contexte = {
    SpreadsheetApp: { getActiveSpreadsheet: () => ss, flush: () => { etat.flush++; },
      newDataValidation: () => { const v = { liste: null, invalide: true,
        requireValueInList: l => { v.liste = l; return v; }, requireValueInRange: () => v, requireCheckbox: () => { v.liste = [true, false]; return v; },
        setAllowInvalid: b => { v.invalide = b; return v; }, setHelpText: () => v, build: () => v }; return v; } },
    DriveApp, HtmlService, GmailApp, MailApp, PropertiesService, Utilities, ScriptApp,
    LockService: { getScriptLock: () => { etat.verrousScript++; return { tryLock: () => !options.verrouOccupe, releaseLock: () => {} }; },
                   getDocumentLock: () => ({ tryLock: () => !options.verrouOccupe, releaseLock: () => {} }) },
    CacheService: { getScriptCache: () => ({
      get: k => (cache[k] === undefined ? null : cache[k]), put: (k, v) => { cache[k] = String(v); },
      getAll: cles => { const r = {}; cles.forEach(k => { if (cache[k] !== undefined) r[k] = cache[k]; }); return r; },
      putAll: (valeurs) => { Object.keys(valeurs).forEach(k => { if (String(valeurs[k]).length > 100000) throw new Error('Argument too large: value'); cache[k] = String(valeurs[k]); }); }, remove: k => { delete cache[k]; } }) },
    Session: { getEffectiveUser: () => ({ getEmail: () => 'franck@loue.test' }),
               getActiveUser: () => ({ getEmail: () => '' }) },
    ContentService: { MimeType: { TEXT: 'text', JSON: 'json', JAVASCRIPT: 'js' },
      createTextOutput: s => ({ contenu: s, setMimeType() { return this; } }) },
    Logger: { log: () => {} },
    console: { log: () => {}, error: () => {} },
  };
  // Lot 5 : service avancé « Drive » (API Drive v3), présent seulement si l'option driveAvance est donnée à la création.
  // etat.driveAvance = { usage, usageInDrive, usageInDriveTrash, limit } (octets) ; l'API rend des textes, comme la vraie.
  // etat.driveAvance = null ensuite : l'appel échoue (service en panne).
  if (options.driveAvance) contexte.Drive = { About: { get: () => {
    if (!etat.driveAvance) throw new Error('Service avancé Drive indisponible');
    const q = {}; Object.keys(etat.driveAvance).forEach(k => { q[k] = String(etat.driveAvance[k]); });
    return { storageQuota: q };
  } } };
  // Lot 5 : service avancé « Gmail » (API Gmail v1), présent seulement si l'option gmail est donnée à la création.
  // etat.gmail = [{ id, labels: ['SENT'…], taille, date (ms), de, a, cc, cci, objet, pj: vrai/faux, pjTaille (octets du PDF joint) }] : la boîte du compte.
  // list comprend la recherche utilisée par le serveur (in:sent, has:attachment, subject:"…", before:AAAA/MM/JJ, -in:inbox,
  // -is:starred, -to: -cc: -bcc:) ; trash et untrash posent et retirent le libellé TRASH ; il n'y a PAS de suppression.
  etat.gmail = options.gmail || []; etat.corbeillesMail = []; etat.avantCorbeilleMail = null;
  if (options.gmail) {
    const trouver = id => { const m = etat.gmail.filter(x => x.id === id)[0]; if (!m) throw new Error('Requested entity was not found.'); return m; };
    const cherche = (m, q) => {
      if (m.labels.indexOf('TRASH') > -1 || m.labels.indexOf('SPAM') > -1) return false;
      const sujets = (q.match(/(^| )subject:"[^"]*"/g) || []).map(s => s.replace(/^.*subject:"/, '').replace(/"$/, '').toLowerCase());
      if (!sujets.every(s => String(m.objet).toLowerCase().indexOf(s) > -1)) return false;
      const reste = q.replace(/(^| )subject:"[^"]*"/g, ' ').split(/\s+/).filter(Boolean);
      return reste.every(t => {
        if (t === 'in:sent') return m.labels.indexOf('SENT') > -1;
        if (t === 'has:attachment') return !!m.pj;
        if (t === '-in:inbox') return m.labels.indexOf('INBOX') < 0;
        if (t === '-is:starred') return m.labels.indexOf('STARRED') < 0;
        if (/^before:/.test(t)) { const d = t.slice(7).split('/').map(Number); return m.date < new Date(d[0], d[1] - 1, d[2]).getTime(); }
        if (/^-(to|cc|bcc):/.test(t)) { const champ = { to: 'a', cc: 'cc', bcc: 'cci' }[t.slice(1, t.indexOf(':'))]; return String(m[champ] || '').toLowerCase().indexOf(t.slice(t.indexOf(':') + 1).toLowerCase()) < 0; }
        throw new Error('faux Gmail : mot de recherche inconnu « ' + t + ' »');
      });
    };
    contexte.Gmail = { Users: { Messages: {
      list: (moi, o) => {
        const tous = etat.gmail.filter(m => cherche(m, String((o && o.q) || ''))), debut = Number((o && o.pageToken) || 0), n = Math.min(500, (o && o.maxResults) || 100);
        const rep = { messages: tous.slice(debut, debut + n).map(m => ({ id: m.id })) };
        if (debut + n < tous.length) rep.nextPageToken = String(debut + n);
        return rep;
      },
      get: (moi, id) => { const m = trouver(id); etat.lecturesMail = (etat.lecturesMail || 0) + 1;
        return { id: m.id, labelIds: m.labels.slice(), sizeEstimate: m.taille, internalDate: String(m.date),
          payload: { headers: [['From', m.de], ['To', m.a], ['Cc', m.cc], ['Bcc', m.cci], ['Subject', m.objet]].filter(h => h[1]).map(h => ({ name: h[0], value: h[1] })),
            parts: [{ filename: '', mimeType: 'text/plain', body: { size: 300 } }].concat(m.pj ? [{ filename: 'document.pdf', mimeType: 'application/pdf', body: { size: m.pjTaille === undefined ? 150000 : m.pjTaille, attachmentId: 'pj' } }] : []) } }; },
      trash: (moi, id) => { const m = trouver(id); if (typeof etat.avantCorbeilleMail === 'function') etat.avantCorbeilleMail(m);
        if (m.labels.indexOf('TRASH') < 0) m.labels.push('TRASH'); etat.corbeillesMail.push({ id: id, valeur: true }); return { id: id }; },
      untrash: (moi, id) => { const m = trouver(id); m.labels = m.labels.filter(l => l !== 'TRASH'); etat.corbeillesMail.push({ id: id, valeur: false }); return { id: id }; },
    } } };
  }
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
