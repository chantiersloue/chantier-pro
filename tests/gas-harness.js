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
    const plage = (r, c, nr, nc) => {
      const p = {
        getValues: () => Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => {
          const v = cellule(r + i, c + j); return v === undefined ? '' : v; })),
        getValue: () => { const v = cellule(r, c); return v === undefined ? '' : v; },
        setValues: vals => { vals.forEach((l, i) => l.forEach((v, j) => ecrire(r + i, c + j, v))); return p; },
        setValue: v => { ecrire(r, c, v); return p; },
        clearContent: () => { for (let i = 0; i < nr; i++) for (let j = 0; j < nc; j++) ecrire(r + i, c + j, ''); return p; },
        setFontWeight: () => p, setBackground: () => p, setFontColor: () => p,
      };
      return p;
    };
    f.api = {
      getName: () => nom,
      appendRow: l => { f.lignes.push(l.slice()); },
      getDataRange: () => plage(1, 1, Math.max(1, f.lignes.length), largeur()),
      getRange: (r, c, nr = 1, nc = 1) => plage(r, c, nr, nc),
      getLastRow: () => {
        for (let i = f.lignes.length; i > 0; i--) if (f.lignes[i - 1].some(v => v !== '' && v !== undefined)) return i;
        return 0;
      },
      setFrozenRows: () => {},
    };
    return f;
  }
  const feuilles = {};
  Object.entries(options.feuilles || {}).forEach(([n, l]) => { feuilles[n] = creerFeuille(n, l); });
  const ss = {
    getName: () => 'ChantierPro',
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
      getParents: () => it(el.parents),
      setSharing: (a, p) => { el.acces = a; el.permission = p; },
      getSharingAccess: () => el.acces, getSharingPermission: () => el.permission,
      isTrashed: () => el.corbeille, setTrashed: v => { el.corbeille = v; },
      getBlob: () => blob(el.contenu || '', el.nom),
      getFiles: () => it(el.enfants.filter(e => e.type === 'fichier')),
      getFolders: () => it(el.enfants.filter(e => e.type === 'dossier')),
      getFoldersByName: n => it(el.enfants.filter(e => e.type === 'dossier' && e.nom === n)),
      createFolder: n => creerElement('dossier', n, el).api,
      createFile: b => creerElement('fichier', b.getName(), el, { contenu: b.contenu }).api,
    };
    return el;
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
      (e.acces === 'ANYONE_WITH_LINK' || e.acces === 'ANYONE'));
    let i = depart;
    return { hasNext: () => i < liste.length, next: () => liste[i++].api, getContinuationToken: () => 'jeton:' + i };
  }

  // ── Blob / HTML → PDF ──
  function blob(contenu, nom) {
    const b = { contenu, nom,
      setName: n => { b.nom = n; return b; }, getName: () => b.nom,
      copyBlob: () => blob(contenu, b.nom) };
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
    formatDate: (d, tz, f) => f.replace('yyyy', d.getFullYear()).replace('MM', deux(d.getMonth() + 1))
      .replace('dd', deux(d.getDate())).replace('HH', deux(d.getHours())).replace('mm', deux(d.getMinutes())),
  };
  const declencheurs = [];
  const ScriptApp = {
    getProjectTriggers: () => declencheurs.map(t => ({ getHandlerFunction: () => t })),
    deleteTrigger: () => { declencheurs.length = 0; },
    newTrigger: fn => ({ timeBased: () => ({ everyHours: () => ({ create: () => declencheurs.push(fn) }) }) }),
  };
  const contexte = {
    SpreadsheetApp: { getActiveSpreadsheet: () => ss },
    DriveApp, HtmlService, GmailApp, MailApp, PropertiesService, Utilities, ScriptApp,
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }) },
    Session: { getEffectiveUser: () => ({ getEmail: () => 'franck@loue.test' }),
               getActiveUser: () => ({ getEmail: () => '' }) },
    ContentService: { MimeType: { TEXT: 'text', JSON: 'json', JAVASCRIPT: 'js' },
      createTextOutput: s => ({ contenu: s, setMimeType() { return this; } }) },
    Logger: { log: () => {} },
    console: { log: () => {}, error: () => {} },
  };
  return { contexte, feuilles, elements, mails, etat, proprietes, creerElement, declencheurs };
}

// Charge tous les fichiers .gs du dossier apps-script dans un contexte simulé
function chargerScript(google) {
  const dossier = path.join(__dirname, '..', 'apps-script');
  const ctx = vm.createContext(google.contexte);
  fs.readdirSync(dossier).filter(f => f.endsWith('.gs')).sort().forEach(f => {
    vm.runInContext(fs.readFileSync(path.join(dossier, f), 'utf8'), ctx, { filename: f });
  });
  return ctx;
}

module.exports = { creerGoogle, chargerScript };
