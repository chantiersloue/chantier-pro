// Un faux Google pour les programmes du planning (lot 11.1) : plusieurs classeurs, des onglets, un Drive, une horloge.
// Aucun appel réseau : tout est en mémoire. Utilisé par tests/lot11-*.test.js.
//   const g = creerFaux({ classeurs: { PLANNING: { nom: 'Planning Loué', onglets: { 'LISTES': [[…]] } } }, actif: 'PLANNING',
//                         dossiers: { DOSSIER: 'Planning' }, proprietes: { … } });
//   const ctx = charger(g, ['Regles.gs', 'Affiche.gs', 'Planning.gs']);
// Les méthodes de présentation (setFontSize, setBorder…) que le faux ne connaît pas sont acceptées et notées dans g.journal ;
// une méthode de LECTURE inconnue lève une erreur (pour ne pas laisser passer une faute de frappe).
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function creerFaux(options = {}) {
  let compteur = 0;
  const g = { journal: [], classeurs: {}, fichiers: {}, dossiers: {}, proprietes: Object.assign({}, options.proprietes || {}), declencheurs: [],
    maintenant: options.maintenant || Date.UTC(2026, 10, 19, 15, 10), exports: [], exportCode: 200, exportErreur: null,
    ui: { reponses: [], alertes: [], menus: [] }, verrouOccupe: false, flush: 0, crees: [] };

  const tolerant = (cible, nom) => {
    const p = new Proxy(cible, { get(t, k) {
      if (k in t || typeof k !== 'string') return t[k];
      if (/^(set|clear|hide|show|auto|merge|break|activate|trim|remove|add|toast|protect|copy)/.test(k)) return (...a) => { g.journal.push([nom, k, a.length ? a[0] : undefined]); return p; };
      throw new Error('faux Google : ' + nom + '.' + k + '() n’existe pas dans le faux (tests/faux-google-planning.js)');
    } });
    return p;
  };
  const blob = (contenu, nom, mime) => {
    const b = { nom: nom || '', mime: mime || 'application/pdf',
      getName: () => b.nom, setName: n => { b.nom = n; return b; }, getContentType: () => b.mime,
      getDataAsString: () => String(contenu), copyBlob: () => blob(contenu, b.nom, b.mime), getBytes: () => Array.from(Buffer.from(String(contenu))) };
    return b;
  };

  // ── Un onglet ──
  function creerOnglet(classeur, nom, lignes) {
    const f = { nom: nom, id: 1000 + (++compteur), lignes: (lignes || []).map(l => l.slice()), maxLignes: 1000, fonds: {}, textes: {}, tailles: {}, formules: {},
      validations: [], protections: [], cachees: [], hauteurs: {}, largeurs: {}, ecritures: 0, cases: {} };
    const cel = (r, c) => { const v = (f.lignes[r - 1] || [])[c - 1]; return v === undefined || v === null ? '' : v; };
    const ecrire = (r, c, v) => { f.ecritures++; while (f.lignes.length < r) f.lignes.push([]); f.lignes[r - 1][c - 1] = v; };
    const plage = (r, c, nr = 1, nc = 1) => {
      if (!(r >= 1 && c >= 1 && nr >= 1 && nc >= 1) || r + nr - 1 > Math.max(f.maxLignes, f.lignes.length)) throw new Error('Those rows are out of bounds.');
      const chaque = fn => { for (let i = 0; i < nr; i++) for (let j = 0; j < nc; j++) fn(r + i, c + j, i, j); };
      const matrice = (m, quoi) => { if (!Array.isArray(m) || m.length !== nr || m.some(l => !Array.isArray(l) || l.length !== nc)) throw new Error('The number of rows or columns in the data does not match the range (' + quoi + ' : attendu ' + nr + ' × ' + nc + ').'); };
      const p = tolerant({
        getValues: () => Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => cel(r + i, c + j))),
        getDisplayValues: () => Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => String(cel(r + i, c + j)))),
        getValue: () => cel(r, c),
        setValues: m => { matrice(m, 'setValues'); chaque((l, k, i, j) => ecrire(l, k, m[i][j])); return p; },
        setValue: v => { chaque((l, k) => ecrire(l, k, v)); return p; },
        setFormula: t => { f.formules[r + ':' + c] = t; ecrire(r, c, t); return p; },
        clearContent: () => { chaque((l, k) => { if (cel(l, k) !== '') ecrire(l, k, ''); }); return p; },
        insertCheckboxes: () => { chaque((l, k) => { f.cases[l + ':' + k] = true; if (typeof cel(l, k) !== 'boolean') ecrire(l, k, false); }); return p; },
        setDataValidation: v => { f.validations.push({ r, c, nr, nc, v }); return p; },
        clearDataValidations: () => { f.validations = f.validations.filter(x => x.r + x.nr - 1 < r || x.r > r + nr - 1 || x.c + x.nc - 1 < c || x.c > c + nc - 1); return p; },
        setBackgrounds: m => { matrice(m, 'setBackgrounds'); chaque((l, k, i, j) => { f.fonds[l + ':' + k] = m[i][j]; }); return p; },
        setBackground: v => { chaque((l, k) => { f.fonds[l + ':' + k] = v; }); return p; },
        setFontColors: m => { matrice(m, 'setFontColors'); chaque((l, k, i, j) => { f.textes[l + ':' + k] = m[i][j]; }); return p; },
        setFontWeights: m => { matrice(m, 'setFontWeights'); return p; },
        setFontSize: n => { chaque((l, k) => { f.tailles[l + ':' + k] = n; }); return p; },
        protect: () => { const pr = { description: '', editeurs: ['franck@loue.test', 'chef@loue.test'], domaine: true, r, c, nr, nc };
          pr.api = { setDescription: d => { pr.description = d; return pr.api; }, getEditors: () => pr.editeurs.slice(), removeEditors: l => { pr.editeurs = pr.editeurs.filter(e => l.indexOf(e) < 0); return pr.api; },
            canDomainEdit: () => pr.domaine, setDomainEdit: b => { pr.domaine = b; return pr.api; }, setWarningOnly: () => pr.api };
          f.protections.push(pr); return pr.api; },
        getRow: () => r, getColumn: () => c, getNumRows: () => nr, getNumColumns: () => nc, getSheet: () => f.api,
      }, 'Range');
      return p;
    };
    f.api = tolerant({
      getName: () => f.nom, getSheetId: () => f.id, getParent: () => classeur.api,
      setName: n => { if (classeur.onglets.some(o => o !== f && o.nom === n)) throw new Error('A sheet with the name "' + n + '" already exists.'); f.nom = n; return f.api; },
      getIndex: () => classeur.onglets.indexOf(f) + 1,
      getRange: (r, c, nr, nc) => { if (typeof r !== 'number') throw new Error('faux Google : getRange par adresse « ' + r + ' » non géré'); return plage(r, c, nr, nc); },
      getDataRange: () => plage(1, 1, Math.max(1, f.api.getLastRow()), Math.max(1, f.api.getLastColumn())),
      getLastRow: () => { for (let i = f.lignes.length; i > 0; i--) if ((f.lignes[i - 1] || []).some(v => v !== '' && v !== undefined && v !== null)) return i; return 0; },
      getLastColumn: () => Math.max(0, ...f.lignes.map(l => { for (let j = (l || []).length; j > 0; j--) if (l[j - 1] !== '' && l[j - 1] !== undefined && l[j - 1] !== null) return j; return 0; })),
      getMaxRows: () => Math.max(f.maxLignes, f.lignes.length), getMaxColumns: () => 26,
      insertRowsAfter: (apres, nb) => { f.maxLignes = Math.max(f.maxLignes, f.lignes.length) + nb; return f.api; },
      deleteRows: (debut, nb) => { f.ecritures++; f.lignes.splice(debut - 1, nb); return f.api; },
      deleteRow: l => { f.ecritures++; f.lignes.splice(l - 1, 1); return f.api; },
      clear: () => { f.ecritures++; f.lignes = []; f.fonds = {}; f.textes = {}; f.tailles = {}; f.formules = {}; f.validations = []; f.cases = {}; return f.api; },
      hideColumns: c => { f.cachees.push(c); return f.api; },
      setColumnWidth: (c, l) => { f.largeurs[c] = l; return f.api; },
      setRowHeight: (l, h) => { f.hauteurs[l] = h; return f.api; },
      setRowHeights: (l, nb, h) => { for (let i = 0; i < nb; i++) f.hauteurs[l + i] = h; return f.api; },
    }, 'Sheet');
    return f;
  }

  // ── Un classeur ──
  function creerClasseur(id, nom, onglets) {
    const c = { id: id, nom: nom, onglets: [], ouvertures: 0, enPanne: false, actif: null };
    c.api = tolerant({
      getId: () => c.id, getName: () => c.nom, getUrl: () => 'https://docs.google.com/spreadsheets/d/' + c.id,
      getSheets: () => c.onglets.map(o => o.api),
      getSheetByName: n => { const o = c.onglets.filter(x => x.nom === n)[0]; return o ? o.api : null; },
      insertSheet: (n, index) => {
        if (c.onglets.some(o => o.nom === n)) throw new Error('A sheet with the name "' + n + '" already exists.');
        const o = creerOnglet(c, n, []);
        c.onglets.splice(typeof index === 'number' ? Math.max(0, Math.min(index, c.onglets.length)) : c.onglets.length, 0, o);
        return o.api;
      },
      deleteSheet: api => { const i = c.onglets.findIndex(o => o.api === api); if (i < 0) throw new Error('onglet inconnu'); if (c.onglets.length === 1) throw new Error('You can\'t remove all the sheets in a document.'); c.onglets.splice(i, 1); },
      getActiveSheet: () => (c.actif && c.onglets.indexOf(c.actif) > -1 ? c.actif.api : (c.onglets[0] ? c.onglets[0].api : null)),
      setActiveSheet: api => { c.actif = c.onglets.filter(o => o.api === api)[0] || null; return api; },
    }, 'Spreadsheet');
    Object.entries(onglets || {}).forEach(([n, l]) => c.onglets.push(creerOnglet(c, n, l)));
    g.classeurs[id] = c;
    return c;
  }
  Object.entries(options.classeurs || {}).forEach(([id, c]) => creerClasseur(id, c.nom || id, c.onglets));
  g.onglet = (idClasseur, nom) => g.classeurs[idClasseur].onglets.filter(o => o.nom === nom)[0] || null;
  g.noms = idClasseur => g.classeurs[idClasseur].onglets.map(o => o.nom);

  // ── Drive ──
  const fichierApi = f => ({ getId: () => f.id, getName: () => f.nom, setName: n => { f.nom = n; return fichierApi(f); },
    isTrashed: () => f.corbeille, setTrashed: v => { if (g.avantCorbeille) g.avantCorbeille(f); f.corbeille = !!v; return fichierApi(f); },
    getBlob: () => blob(f.contenu, f.nom, f.mime), getAs: mime => blob('PDF officiel de ' + f.nom, f.nom + '.pdf', mime) });
  Object.entries(options.dossiers || {}).forEach(([id, nom]) => { g.dossiers[id] = { id: id, nom: nom, enPanne: false }; });
  g.fichiersDe = idDossier => Object.values(g.fichiers).filter(f => f.dossier === idDossier && !f.corbeille);
  const DriveApp = {
    getFolderById: id => { const d = g.dossiers[id]; if (!d || d.enPanne) throw new Error('Dossier introuvable'); return {
      getId: () => d.id, getName: () => d.nom,
      createFile: b => { if (g.avantCreation) g.avantCreation(d, b); const f = { id: 'fichier' + (++compteur), nom: b.getName(), contenu: b.getDataAsString(), mime: b.getContentType(), corbeille: false, dossier: d.id }; g.fichiers[f.id] = f; return fichierApi(f); } }; },
    getFileById: id => { const f = g.fichiers[id]; if (!f) throw new Error('Fichier introuvable'); return fichierApi(f); },
  };

  // ── L'interface (menu, fenêtres) : les réponses sont préparées par le test dans g.ui.reponses ──
  const Button = { OK: 'OK', CANCEL: 'CANCEL', YES: 'YES', NO: 'NO', CLOSE: 'CLOSE' };
  const ui = { Button: Button, ButtonSet: { OK: 'OK', OK_CANCEL: 'OK_CANCEL', YES_NO: 'YES_NO', YES_NO_CANCEL: 'YES_NO_CANCEL' },
    alert: (titre, texte, boutons) => { const r = g.ui.reponses.length ? g.ui.reponses.shift() : (boutons === 'YES_NO' || boutons === 'YES_NO_CANCEL' ? Button.YES : Button.OK);
      g.ui.alertes.push({ titre: titre, texte: texte === undefined ? '' : String(texte) }); return typeof r === 'string' ? r : Button.OK; },
    prompt: (titre, texte) => { const r = g.ui.reponses.length ? g.ui.reponses.shift() : { bouton: Button.CANCEL, texte: '' };
      g.ui.alertes.push({ titre: titre, texte: String(texte || ''), question: true });
      return { getSelectedButton: () => (r.bouton || Button.OK), getResponseText: () => String(r.texte || '') }; },
    createMenu: nom => { const m = { nom: nom, items: [] }; const api = { addItem: (t, f) => { m.items.push([t, f]); return api; }, addSeparator: () => api, addToUi: () => { g.ui.menus.push(m); } }; return api; } };

  // ── Le reste ──
  const paris = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const formatDate = (d, tz, f) => {
    if (tz !== 'Europe/Paris') throw new Error('faux Google : fuseau « ' + tz + ' » non géré');
    const p = {}; paris.formatToParts(d).forEach(x => { p[x.type] = x.value; });
    return f.replace('yyyy', p.year).replace('MM', p.month).replace('dd', p.day).replace('HH', p.hour).replace('mm', p.minute);
  };
  const validation = () => { const v = { plage: null, invalide: false }; const api = tolerant({ requireValueInRange: p => { v.plage = p; return api; }, setAllowInvalid: b => { v.invalide = b; return api; }, build: () => v }, 'DataValidationBuilder'); return api; };
  const verrou = () => ({ tryLock: () => !g.verrouOccupe, releaseLock: () => {}, waitLock: () => {} });
  g.contexte = {
    SpreadsheetApp: {
      getActiveSpreadsheet: () => g.classeurs[options.actif].api,
      openById: id => { const c = g.classeurs[id]; if (!c || c.enPanne) throw new Error('Document ' + id + ' is missing (perhaps it was deleted, or you don’t have read access?)'); c.ouvertures++; return c.api; },
      create: nom => { const id = 'classeur' + (++compteur); const c = creerClasseur(id, nom, { 'Feuille 1': [] }); g.crees.push(id);
        g.fichiers[id] = { id: id, nom: nom, contenu: '', mime: 'application/vnd.google-apps.spreadsheet', corbeille: false, dossier: '' }; return c.api; },
      flush: () => { g.flush++; }, getUi: () => ui, newDataValidation: validation,
    },
    DriveApp: DriveApp,
    UrlFetchApp: { fetch: (url, o) => { g.exports.push({ url: url, entetes: (o && o.headers) || {} }); if (g.exportErreur) throw new Error(g.exportErreur);
      return { getResponseCode: () => g.exportCode, getBlob: () => blob('PDF exporté par adresse', 'export.pdf', g.exportCode === 200 ? 'application/pdf' : 'text/html') }; } },
    ScriptApp: { getOAuthToken: () => 'jeton-faux',
      getProjectTriggers: () => g.declencheurs.map(t => ({ getHandlerFunction: () => t.fonction, _t: t })),
      deleteTrigger: d => { g.declencheurs = g.declencheurs.filter(t => t !== d._t); },
      newTrigger: fn => { const t = { fonction: fn, regle: [] }; const b = { timeBased: () => b, everyMinutes: n => { t.regle.push('minutes:' + n); return b; }, atHour: h => { t.regle.push('heure:' + h); return b; },
        everyDays: n => { t.regle.push('jours:' + n); return b; }, create: () => { g.declencheurs.push(t); return t; } }; return b; } },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => (k in g.proprietes ? g.proprietes[k] : null), setProperty: (k, v) => { g.proprietes[k] = String(v); }, deleteProperty: k => { delete g.proprietes[k]; } }) },
    LockService: { getScriptLock: verrou, getDocumentLock: verrou },
    Utilities: { formatDate: formatDate },
    Session: { getScriptTimeZone: () => 'Europe/Paris' },
    Logger: { log: () => {} }, console: { log: () => {}, error: (...a) => { g.journal.push(['console', 'error', a.join(' ')]); } },
    Date: class extends Date { constructor(...a) { if (a.length) super(...a); else super(g.maintenant); } static now() { return g.maintenant; } },
  };
  return g;
}

// Charge des fichiers du dossier planning/ dans le faux Google ; rend le contexte (ses fonctions sont appelables)
function charger(g, fichiers, dossier) {
  const ctx = vm.createContext(g.contexte);
  (fichiers || []).forEach(f => {
    const chemin = path.isAbsolute(f) ? f : path.join(dossier || path.join(__dirname, '..', 'planning'), f);
    vm.runInContext(fs.readFileSync(chemin, 'utf8'), ctx, { filename: path.basename(chemin) });
  });
  // Les constantes déclarées par « const » ne sont pas des propriétés du contexte : on les lit par leur nom
  ctx.lire = nom => vm.runInContext(nom, ctx);
  return ctx;
}

module.exports = { creerFaux, charger };
