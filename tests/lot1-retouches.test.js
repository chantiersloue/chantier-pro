// Tests des retouches du lot 1 après les essais de Franck : node tests/lot1-retouches.test.js
//  R1 : photos et croquis en grand dans les PDF (modeles/mise-en-page.js) + contrôle du PDF par le serveur
//  R2 : bordereau matériaux, liste de matériaux par défaut selon le Type (onglet « Matériaux bordereau »)
// (R3, le sablier de la file d'envoi, se teste dans le navigateur : voir docs/lot1-procedure.md)
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const zlib = require('zlib');
const { creerGoogle, chargerScript } = require('./gas-harness');

let reussis = 0;
function test(nom, fn) {
  try { fn(); reussis++; console.log('  ✓ ' + nom); }
  catch (e) { console.log('  ✗ ' + nom + '\n    ' + e.message); process.exitCode = 1; }
}

// Les modèles comme dans la page
const M = vm.createContext({});
fs.readdirSync(path.join(__dirname, '..', 'modeles')).filter(f => f.endsWith('.js')).sort()
  .forEach(f => vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'modeles', f), 'utf8'), M));
const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Images : vrai PNG ; « JPEG » = en-tête JPEG réaliste (APP0, tables, SOF0) suivi de rien
function png(w, h) {
  const crcT = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = b => { let c = 0xFFFFFFFF; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
  const bloc = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const c = Buffer.alloc(4); c.writeUInt32BE(crc(Buffer.concat([Buffer.from(t), d]))); return Buffer.concat([l, Buffer.from(t), d, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]), bloc('IHDR', ihdr), bloc('IDAT', zlib.deflateSync(Buffer.alloc(h * (1 + 3 * w)))), bloc('IEND', Buffer.alloc(0))]).toString('base64');
}
function jpeg(w, h) {
  const app0 = Buffer.from([0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00]);
  const dqt = Buffer.concat([Buffer.from([0xFF, 0xDB, 0x00, 0x43, 0x00]), Buffer.alloc(64, 1)]);
  const sof = Buffer.from([0xFF, 0xC0, 0x00, 0x11, 0x08, h >> 8, h & 255, w >> 8, w & 255, 0x03, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1]);
  return Buffer.concat([Buffer.from([0xFF, 0xD8]), app0, dqt, sof, Buffer.from([0xFF, 0xDA, 0x00, 0x02])]).toString('base64');
}
const photo = (w, h, label) => ({ data: jpeg(w, h), mimeType: 'image/jpeg', label: label || '' });
const croquis = () => ({ data: png(680, 422), mimeType: 'image/png', label: 'Croquis' });
const pages = html => 1 + (html.match(/page-break-before:always/g) || []).length;

console.log('R1 — mise en page des photos');

test('taille lue dans les octets : PNG, JPEG (après les tables), image illisible', () => {
  assert.strictEqual(JSON.stringify(M.mep_taille({ data: png(340, 211) })), '{"w":340,"h":211}');
  assert.strictEqual(JSON.stringify(M.mep_taille({ data: jpeg(1600, 1200) })), '{"w":1600,"h":1200}');
  assert.strictEqual(JSON.stringify(M.mep_taille({ data: jpeg(1200, 1600) })), '{"w":1200,"h":1600}');
  assert.strictEqual(M.mep_taille({ data: Buffer.from('pas une image').toString('base64') }), null);
  assert.strictEqual(M.mep_taille({ data: '' }), null);
});

test('une petite image (croquis) est AGRANDIE : largeur écrite en mm, proportions gardées', () => {
  const html = M.mep_image({ data: png(340, 211), mimeType: 'image/png' }, 277, 180, esc);
  assert.ok(/width:277mm;max-width:100%;height:auto/.test(html), html.slice(-120));
  const h = M.mep_image(photo(1200, 1600), 277, 180, esc);       // en hauteur : limitée par la hauteur
  assert.ok(/width:135mm/.test(h), h.slice(-120));
});

test('image de taille inconnue : ancien comportement (max-width / max-height), rien ne casse', () => {
  const h = M.mep_image({ data: Buffer.from('xx').toString('base64'), mimeType: 'image/jpeg' }, 180, 120, esc);
  assert.ok(/max-width:100%;max-height:120mm/.test(h));
});

test('fabrication : 1 photo en page 1 sous le tableau, dans toute la place restante', () => {
  const d = { chantier: 'C', blocs: [{ id: 1, type: 'divers', rows: [{ repere: 'R1' }, { repere: 'R2' }] }], photosBase64: [photo(1600, 1200, 'Façade')] };
  const html = M.modele_fabrication(d, esc);
  assert.ok(html.indexOf('data-mep="page1"') > -1, 'photo en page 1');
  assert.strictEqual(pages(html), 1);
  const largeur = Number(html.match(/data-mep="page1"[\s\S]*?width:([\d.]+)mm/)[1]);
  assert.ok(largeur > 120 && largeur <= 277, 'grande photo (avant : 95 mm de haut, soit 127 mm de large au plus) : ' + largeur + ' mm de large');
});

test('fabrication : un croquis a toujours une page entière ; la photo reste en page 1', () => {
  const d = { chantier: 'C', blocs: [{ id: 1, type: 'divers', rows: [{ repere: 'R1' }] }], photosBase64: [croquis(), photo(1600, 1200)] };
  const html = M.modele_fabrication(d, esc);
  assert.strictEqual(pages(html), 2);
  assert.ok(html.indexOf('data-mep="page1"') > -1);
  const pageCroquis = html.split('page-break-before:always')[1];
  assert.ok(pageCroquis.indexOf('image/png') > -1 && /width:277mm/.test(pageCroquis), 'croquis pleine largeur sur sa page');
});

test('fabrication : deux croquis = deux pages ; jamais en page 1', () => {
  const html = M.modele_fabrication({ chantier: 'C', blocs: [], photosBase64: [croquis(), croquis()] }, esc);
  assert.strictEqual(pages(html), 3);
  assert.ok(html.indexOf('data-mep="page1"') < 0);
});

test('fabrication : tableau trop long → la photo part sur une page à elle (pas en page 1)', () => {
  const rows = Array.from({ length: 20 }, (_, i) => ({ repere: 'R' + i }));
  const html = M.modele_fabrication({ chantier: 'C', blocs: [{ id: 1, type: 'divers', rows }], photosBase64: [photo(1600, 1200)] }, esc);
  assert.ok(html.indexOf('data-mep="page1"') < 0);
  assert.strictEqual(pages(html), 2);
});

test('paires : 2 photos en largeur sur une page debout ; 2 photos en hauteur sur une page couchée ; sinon une par page', () => {
  const q = M.modele_quitus({ chantier: 'C', photosBase64: [photo(1600, 1200), photo(1600, 1200), photo(1600, 1200)] }, esc);
  assert.strictEqual(pages(q), 2, 'quitus : 1 en page 1 + 2 sur la page 2');
  const q2 = M.modele_quitus({ chantier: 'C', photosBase64: [photo(1600, 1200), photo(1200, 1600), photo(1200, 1600)] }, esc);
  assert.strictEqual(pages(q2), 3, 'photos en hauteur sur page debout : une par page');
  const f = M.modele_fabrication({ chantier: 'C', blocs: [], photosBase64: [photo(1600, 1200), photo(1200, 1600), photo(1200, 1600)] }, esc);
  assert.strictEqual(pages(f), 2, 'fabrication : 2 photos en hauteur côte à côte');
});

test('quitus, bordereaux, attestation : signatures AVANT les photos (une photo qui remplit la page ne les repousse pas)', () => {
  const sig = 'data:image/png;base64,' + png(30, 15);
  [['modele_quitus', { chantier: 'C', sigLoue: sig, photosBase64: [photo(1600, 1200)] }],
   ['modele_bordereau', { type: 'bordereau-orga', sigLoue: sig, photosBase64: [photo(1600, 1200)] }],
   ['modele_attestation', { typeAttest: 'mise-oeuvre', signature: sig, photos: [photo(1600, 1200)] }]].forEach(([m, d]) => {
    const html = M[m](d, esc);
    assert.ok(html.indexOf(sig) > -1 && html.indexOf(sig) < html.indexOf('data-mep="page1"'), m);
  });
});

test('réception support : photos de chaque point sur leurs pages, titre du point en haut de chaque page', () => {
  const html = M.modele_reception({ chantier: 'C', points: [{ label: 'Planéité', state: 'nok', photos: [photo(1600, 1200), photo(1200, 1600)] },
    { label: 'Sol', state: 'ok', photos: [] }] }, esc);
  assert.strictEqual(pages(html), 3, '2 photos qui ne vont pas ensemble : 2 pages');
  assert.strictEqual((html.match(/Photos — Planéité \(\d\/2\)/g) || []).length, 2);
  assert.ok(html.indexOf('data-mep="page1"') < 0);
});

test('note : texte long → photos à partir d’une nouvelle page ; légendes échappées', () => {
  const longue = Array(80).fill('Point de suivi.').join('\n');
  const html = M.modele_note({ chantier: 'C', commentaires: longue, photosBase64: [photo(1600, 1200, 'Appui <b>')] }, esc);
  assert.ok(html.indexOf('data-mep="page1"') < 0);
  assert.ok(html.indexOf('Appui &lt;b&gt;') > -1 && html.indexOf('Appui <b>') < 0);
});

test('serveur sans photo en page 1 imposée (_mepSansPage1) et format réel (_mepFormat)', () => {
  const d = { chantier: 'C', blocs: [], photosBase64: [photo(1600, 1200)] };
  assert.ok(M.modele_fabrication(Object.assign({}, d, { _mepSansPage1: true }), esc).indexOf('data-mep="page1"') < 0);
  // Format Letter couché (279 × 216 mm) : la photo pleine page est calculée pour ce format
  const h = M.modele_fabrication(Object.assign({}, d, { _mepSansPage1: true, _mepFormat: { l: 216, h: 279 } }), esc);
  const largeur = Number(h.match(/width:([\d.]+)mm;max-width/)[1]);
  assert.ok(largeur <= 259, 'largeur dans le format réel : ' + largeur);
});

// ── Contrôle du PDF par le serveur ──
function environnement(feuilles) {
  const g = creerGoogle({
    proprietes: { DRIVE_ROOT_ID: 'RACINE', DRIVE_PLANNING_ID: 'PLANNING' },
    feuilles: Object.assign({
      'Contacts': [['Nom', 'Role', 'Email', 'ChefEquipe', 'Destinataire', 'ConducteurDefaut', 'ChefAtelier', 'absenceNotif'],
        ['Franck PAVAGEAU', 'Conducteur de travaux', 'franck@loue.test', 'O', 'N', 'O', 'N', 'O']],
      'Contacts notes': [['Nom', 'Email']],
      'Chantiers': [['Nom', 'Référence', 'Statut', 'Conducteur'], ['CHANTIER TEST 1', 'LIEU', 'En cours', 'Franck PAVAGEAU']],
      'Materiaux': [['Materiaux'], ['Médium']],
    }, feuilles || {}),
  });
  g.racine = g.creerElement('dossier', 'Loué Menuiserie - Chantiers', null, { id: 'RACINE' });
  g.creerElement('dossier', 'Planning', null, { id: 'PLANNING' });
  g.ctx = chargerScript(g);
  return g;
}
// Faux moteur PDF : nombre de pages et format choisis par le test ; garde les HTML reçus
function moteurPdf(g, pagesEnTrop, format) {
  const recus = [];
  g.ctx.HtmlService = { createHtmlOutput: html => ({ getAs: () => {
    recus.push(html);
    const contenu = Number((html.match(/data-mep-contenu="(\d+)"/) || [])[1] || 1);
    const n = contenu + (html.match(/page-break-before:always/g) || []).length + (recus.length === 1 ? pagesEnTrop : 0);
    const texte = '%PDF-1.4\n' + Array.from({ length: n }, () => '<< /Type /Page /MediaBox [0 0 ' + (format || '842 595') + '] >>').join('\n')
      + '\n<< /Type /Pages /Count ' + n + ' >>';
    return { contenu: texte, ordre: recus.length, nom: '', setName(x) { this.nom = x; return this; }, getName() { return this.nom; },
      getDataAsString: () => texte, getBytes: () => Array.from(Buffer.from(texte)), copyBlob() { return this; } };
  } }) };
  return recus;
}
const poster = (g, corps) => JSON.parse(g.ctx.doPost({ postData: { contents: JSON.stringify(corps) } }).contenu);
function envoyerQuitusAvecPhoto(g, id) {
  poster(g, { action: 'photo', id: 'photo-' + id, fiche: 'fiche-' + id, mime: 'image/jpeg', data: jpeg(1600, 1200) });
  return poster(g, { action: 'fiche', id: 'fiche-' + id, donnees: { type: 'quitus', chantier: 'CHANTIER TEST 1', date: '10/11/2026', intervenant: 'Client',
    solde: 'OUI', destinataires: [], photosBase64: [{ photoRef: 'photo-' + id, label: 'Porte' }] } });
}

test('serveur : PDF comme prévu → fabriqué une seule fois', () => {
  const g = environnement();
  const recus = moteurPdf(g, 0);
  assert.strictEqual(envoyerQuitusAvecPhoto(g, '0001-abcd').code, 'ENREGISTRE');
  assert.strictEqual(recus.length, 1);
});

test('serveur : une page de trop (photo rejetée) → PDF refait une fois, photo sur une page à elle, format réel lu', () => {
  const g = environnement();
  const recus = moteurPdf(g, 1, '612 792');   // format Letter debout
  const logs = [];
  g.ctx.console = { log: x => logs.push(String(x)), error: () => {}, warn: () => {} };
  assert.strictEqual(envoyerQuitusAvecPhoto(g, '0002-abcd').code, 'ENREGISTRE');
  assert.strictEqual(recus.length, 2, 'refait une fois');
  assert.ok(recus[0].indexOf('data-mep="page1"') > -1 && recus[1].indexOf('data-mep="page1"') < 0);
  assert.ok(logs.some(l => /216 × 279 mm/.test(l)), logs.join(' | '));
  assert.strictEqual(g.mails.length, 1, 'un seul mail');
  assert.strictEqual(g.mails[0].opts.attachments[0].ordre, 2, 'c’est le PDF REFAIT qui part (relecture, 2e tour)');
});

test('serveur : note de plusieurs pages avec photos → pages du contenu comptées, PDF fabriqué une seule fois', () => {
  const g = environnement();
  const recus = moteurPdf(g, 0);
  const longue = Array(90).fill('Point de suivi du chantier, à reprendre.').join('\n');
  g.ctx.pdfDuModele_(g.ctx.modele_note, { chantier: 'C', commentaires: longue, photosBase64: [photo(1600, 1200)] }, 'x.pdf');
  assert.ok(/data-mep-contenu="2"/.test(recus[0]), 'contenu estimé sur 2 pages');
  assert.strictEqual(recus.length, 1);
});

test('serveur : PDF illisible (pages non trouvées) → gardé tel quel', () => {
  const g = environnement();   // faux moteur du harnais : le « PDF » est le HTML
  assert.strictEqual(envoyerQuitusAvecPhoto(g, '0003-abcd').code, 'ENREGISTRE');
  assert.strictEqual(g.mails.length, 1);
});

test('infoPdf_ : vrai PDF de Chrome (si présent) — pages et format A4', () => {
  const g = environnement();
  const pdf = '%PDF-1.4\n1 0 obj << /Type /Pages /Kids [2 0 R 3 0 R] /Count 2 >>\n2 0 obj << /Type /Page /MediaBox [0 0 595.28 841.89] >>\n3 0 obj << /Type /Page >>';
  const info = g.ctx.infoPdf_({ getDataAsString: () => pdf });
  assert.strictEqual(info.pages, 2);
  assert.strictEqual(info.l + 'x' + info.h, '210x297');
});

console.log('R2 — bordereau matériaux');

test('listes : types et matériaux de l’onglet « Matériaux bordereau » (lignes vides ignorées)', () => {
  const g = environnement({ 'Matériaux bordereau': [['Type', 'Matériau', 'Quantité'],
    ['Kit pose fenêtre', 'Vis inox 4x40', 20], ['Kit pose fenêtre', 'Cartouche mousse', 1], ['', 'orphelin', 3], ['Clés de chantier', '', '']] });
  const l = JSON.parse(g.ctx.doGet({ parameter: { action: 'getContacts' } }).contenu);
  assert.strictEqual(l.materiauxBordereau.length, 3);
  assert.strictEqual(JSON.stringify(l.materiauxBordereau[0]), '{"type":"Kit pose fenêtre","materiau":"Vis inox 4x40","quantite":"20"}');
  assert.ok(l.materiaux.length === 1, 'onglet Materiaux toujours lu (fabrication)');
});

test('listes : onglet absent → liste vide (la page reprend l’onglet Materiaux, comme avant)', () => {
  const l = JSON.parse(environnement().ctx.doGet({ parameter: { action: 'getContacts' } }).contenu);
  assert.strictEqual(JSON.stringify(l.materiauxBordereau), '[]');
});

test('verifierConfig crée l’onglet (titres seulement) s’il n’existe pas, sans toucher à un onglet rempli', () => {
  const g = environnement();
  const r = g.ctx.verifierConfig();
  assert.ok(/Matériaux bordereau » créé/.test(r), r);
  assert.strictEqual(JSON.stringify(g.feuilles['Matériaux bordereau'].lignes[0]), '["Type","Matériau","Quantité"]');
  const g2 = environnement({ 'Matériaux bordereau': [['Type', 'Matériau', 'Quantité'], ['Kit', 'Vis', 2]] });
  g2.ctx.verifierConfig();
  assert.strictEqual(g2.feuilles['Matériaux bordereau'].lignes.length, 2);
});

test('PDF : « Matériaux remis » sous la ligne Nombre × Type, texte échappé ; fiche ancienne sans ce champ : rien', () => {
  const html = M.modele_bordereau({ type: 'bordereau-materiaux', nombre: '1', typeDoc: 'Kit', listeMateriaux: '20 × Vis <inox>\n1 × Mousse' }, esc);
  assert.ok(html.indexOf('Matériaux remis') > -1 && html.indexOf('20 × Vis &lt;inox&gt;') > -1);
  assert.ok(html.indexOf('Matériaux remis') > html.indexOf('1 × Kit'));
  assert.ok(M.modele_bordereau({ type: 'bordereau-materiaux', nombre: '1', typeDoc: 'Kit' }, esc).indexOf('Matériaux remis') < 0);
  assert.ok(M.modele_bordereau({ type: 'bordereau-orga', listeMateriaux: 'x' }, esc).indexOf('Matériaux remis') < 0, 'jamais pour l’organigramme');
});

test('serveur : le bordereau matériaux envoyé contient la liste', () => {
  const g = environnement();
  const recus = moteurPdf(g, 0);
  poster(g, { action: 'photo', id: 'photo-0101-abcd', fiche: 'fiche-0101-abcd', mime: 'image/jpeg', data: jpeg(800, 600) });
  const r = poster(g, { action: 'fiche', id: 'fiche-0101-abcd', donnees: { type: 'bordereau-materiaux', chantier: 'CHANTIER TEST 1', date: '10/11/2026',
    soussigne: 'S', preneur: 'P', entreprise: 'E', typeDoc: 'Kit', nombre: '1', listeMateriaux: '2 × Cales', destinataires: [],
    photosBase64: [{ photoRef: 'photo-0101-abcd' }] } });
  assert.strictEqual(r.code, 'ENREGISTRE', JSON.stringify(r));
  assert.ok(recus[0].indexOf('2 × Cales') > -1);
});

console.log('Relecture — cas ajoutés');

test('serveur : PDF refait PIRE que le premier → le premier est gardé', () => {
  const g = environnement();
  const recus = [];
  g.ctx.HtmlService = { createHtmlOutput: html => ({ getAs: () => {
    recus.push(html);
    const n = 1 + (html.match(/page-break-before:always/g) || []).length + (recus.length === 1 ? 1 : 3);
    const texte = Array.from({ length: n }, () => '<< /Type /Page /MediaBox [0 0 595 842] >>').join('\n');
    return { nom: recus.length, setName(x) { return this; }, getName() { return 'x'; }, getDataAsString: () => texte, getBytes: () => [], copyBlob() { return this; } };
  } }) };
  const blob = g.ctx.pdfDuModele_(g.ctx.modele_quitus, { chantier: 'C', photosBase64: [photo(1600, 1200)] }, 'x.pdf');
  assert.strictEqual(recus.length, 2);
  assert.strictEqual(blob.nom, 1, 'premier PDF gardé');
});

test('serveur : croquis seul (aucune photo en page 1) → contrôlé aussi ; PDF illisible → noté dans le journal', () => {
  const g = environnement();
  const recus = moteurPdf(g, 1);
  g.ctx.pdfDuModele_(g.ctx.modele_fabrication, { chantier: 'C', blocs: [], photosBase64: [croquis()] }, 'x.pdf');
  assert.strictEqual(recus.length, 2, 'page de trop sur une page de croquis : refait');
  assert.ok(/_mepMargeEnPlus|data-mep="photos"/.test(recus[1]));
  const g2 = environnement();   // faux moteur du harnais : pas de pages lisibles
  const logs = [];
  g2.ctx.console = { log: x => logs.push(String(x)), error: () => {}, warn: () => {} };
  g2.ctx.pdfDuModele_(g2.ctx.modele_fabrication, { chantier: 'C', blocs: [], photosBase64: [croquis()] }, 'x.pdf');
  assert.ok(logs.some(l => /illisible/.test(l)), logs.join(' | '));
});

test('pages de photos : 8 mm gardés libres ; plus encore quand le serveur refait (_mepMargeEnPlus)', () => {
  const h1 = M.mep_photos([photo(1200, 1600)], Object.assign(M.mep_zone({}, 297, 210, 10), { reste: 0, esc }));
  const h2 = M.mep_photos([photo(1200, 1600)], Object.assign(M.mep_zone({ _mepMargeEnPlus: 10 }, 297, 210, 10), { reste: 0, esc }));
  const l = h => Number(h.match(/width:([\d.]+)mm;max-width/)[1]);
  assert.ok(Math.abs(l(h1) - 182 * 0.75) < 0.2, 'photo en hauteur : (190 - 8) × 3/4 = ' + l(h1));
  assert.ok(l(h2) < l(h1));
});

test('photo dont la légende contient « croquis » (croquis papier photographié) : page entière, dans la fiche de fabrication seulement', () => {
  const html = M.modele_fabrication({ chantier: 'C', blocs: [], photosBase64: [photo(1600, 1200, 'Croquis du placard')] }, esc);
  assert.ok(html.indexOf('data-mep="page1"') < 0);
  assert.strictEqual(pages(html), 2);
  const q = M.modele_quitus({ chantier: 'C', photosBase64: [photo(1600, 1200, 'Croquis du placard')] }, esc);
  assert.ok(q.indexOf('data-mep="page1"') > -1, 'quitus : une photo reste une photo');
});

test('commentaire tapé sur téléphone (« Ligne 1<div>Ligne 2</div><div><br></div>… ») : chaque ligne comptée, lignes vides comprises', () => {
  const est = c => Number(M.modele_fabrication({ chantier: 'C', blocs: [], commentaires: c, photosBase64: [photo(1600, 1200)] }, esc).match(/data-estime="(\d+)"/)[1]);
  const tel = 'Ligne 1<div>Ligne 2</div><div><br></div><div>Ligne 4</div><div><br></div><div>Ligne 6</div>';
  const br = 'Ligne 1<br>Ligne 2<br><br>Ligne 4<br><br>Ligne 6';
  assert.strictEqual(est(tel), est(br), 'mêmes 6 lignes');
  assert.ok(est(tel) >= 44 + 8 + 6 * 3.9, String(est(tel)));
});

test('estimations : chantier long, zone, précision, commentaire agrandi comptés (fabrication) ; chantier long (note)', () => {
  const base = { chantier: 'C', blocs: [], photosBase64: [photo(1600, 1200)] };
  const est = (m, d) => Number(M[m](d, esc).match(/data-estime="(\d+)"/)[1]);
  const long = '403-OPALE / STEEN RAIMONDEAU — ST GILLES X DE VIE ET ENCORE DU TEXTE';
  assert.ok(est('modele_fabrication', Object.assign({}, base, { chantier: long, zone: 'R+1 bâtiment A logements 101 à 115 et circulations', delaiPrecision: 'a\nb\nc' })) >= 55, 'mesuré dans Chrome : 57,7 mm (44 sans ces lignes)');
  assert.ok(est('modele_fabrication', Object.assign({}, base, { commentaires: '<span style="font-size:1.4em">A</span>' })) > est('modele_fabrication', Object.assign({}, base, { commentaires: 'A' })));
  assert.ok(est('modele_note', { chantier: long, photosBase64: [photo(1600, 1200)] }) >= 45);
});

test('Matériaux bordereau : quantité lue comme affichée dans le Sheet (2,5 reste « 2,5 »)', () => {
  const g = environnement({ 'Matériaux bordereau': [['Type', 'Matériau', 'Quantité'], ['Kit', 'Mastic', 2.5]] });
  const l = JSON.parse(g.ctx.doGet({ parameter: { action: 'getContacts' } }).contenu);
  assert.strictEqual(l.materiauxBordereau[0].quantite, '2,5');
});

console.log(reussis + ' test(s) réussi(s)' + (process.exitCode ? ' — DES TESTS ÉCHOUENT' : ''));
