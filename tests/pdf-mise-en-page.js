// Contrôle de la mise en page des photos dans les PDF (retouche R1 du lot 1), avec le vrai Chrome du PC.
//   node tests/pdf-mise-en-page.js            → vérifie chaque cas (sans Chrome : le test est sauté)
//   node tests/pdf-mise-en-page.js --garder   → garde aussi les PDF fabriqués (dossier affiché à la fin)
// Pour chaque fiche type, on vérifie :
//  1. le nombre de pages du PDF fabriqué par Chrome = celui prévu par le modèle (rien ne déborde) ;
//  2. la photo de la page 1 tient sur la page 1, sans laisser plus de 30 mm vides en bas.
// Le PDF envoyé par mail est fabriqué par Google, avec un moteur proche de Chrome (essai 16 : « très proche ») :
// d'où la marge de sécurité des estimations.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const assert = require('assert');

const racine = path.join(__dirname, '..');
const CHROMES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
];
const chrome = CHROMES.find(c => fs.existsSync(c));
if (!chrome) { console.log('PDF : Chrome introuvable, contrôle sauté'); process.exit(0); }

// Les modèles, comme dans la page (un seul contexte, comme Modeles.gs)
const vm = require('vm');
const ctx = vm.createContext({});
fs.readdirSync(path.join(racine, 'modeles')).filter(f => f.endsWith('.js')).sort()
  .forEach(f => vm.runInContext(fs.readFileSync(path.join(racine, 'modeles', f), 'utf8'), ctx, { filename: f }));
const esc = s => String(s === undefined || s === null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// ── Images d'essai fabriquées ici (aucun fichier extérieur) ──
// Images unies (PNG fabriqué ici) ; une « photo » est déclarée image/jpeg (Chrome reconnaît le vrai format tout seul,
// et mep_taille lit la taille dans les octets) ; un croquis est déclaré image/png.
function png(w, h, couleur) {
  const zlib = require('zlib');
  const ligne = Buffer.alloc(1 + w * 3); for (let i = 0; i < w; i++) couleur.forEach((c, k) => { ligne[1 + i * 3 + k] = c; });
  const brut = Buffer.concat(Array.from({ length: h }, () => ligne));
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = buf => { let c = 0xFFFFFFFF; for (const x of buf) c = crcTable[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
  const bloc = (type, data) => { const t = Buffer.from(type); const l = Buffer.alloc(4); l.writeUInt32BE(data.length);
    const c = Buffer.alloc(4); c.writeUInt32BE(crc(Buffer.concat([t, data]))); return Buffer.concat([l, t, data, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  const b = Buffer.concat([Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]), bloc('IHDR', ihdr), bloc('IDAT', zlib.deflateSync(brut)), bloc('IEND', Buffer.alloc(0))]);
  return { data: b.toString('base64'), mimeType: 'image/png' };
}
const photo = (w, h, label) => Object.assign(png(w, h, [70, 130, 180]), { mimeType: 'image/jpeg', label: label || '' });
const PAYSAGE = () => photo(1600, 1200, 'Façade côté rue');
const PORTRAIT = () => photo(1200, 1600);
const CROQUIS = () => Object.assign(png(340, 211, [255, 243, 200]), { label: 'Croquis' });
module.exports = { png };

// ── Fabrication du PDF et mesures par Chrome ──
const dossier = fs.mkdtempSync(path.join(os.tmpdir(), 'loue-pdf-'));
function chromeExec(args) {
  try { return execFileSync(chrome, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check'].concat(args), { stdio: ['ignore', 'pipe', 'ignore'], timeout: 60000 }).toString(); }
  catch (e) { return (e.stdout || '').toString(); }
}
function pagesDuPdf(fichier) {
  const t = fs.readFileSync(fichier).toString('latin1');
  return (t.match(/\/Type\s*\/Page[^s]/g) || []).length;
}
// Mesures (mm) de la photo de la page 1, dans une page de la largeur utile : haut du bloc (= hauteur réelle du
// contenu au-dessus), bas de la photo, largeur de la photo, et hauteur du contenu estimée par le modèle
function mesurePage1(html, largeurMm) {
  const script = '<script>window.addEventListener("load",function(){var e=document.querySelector("[data-mep=page1]");'
    + 'var mm=function(x){return (x*25.4/96).toFixed(1)};var r=e?e.getBoundingClientRect():null;var i=e?e.querySelector("img").getBoundingClientRect():null;'
    + 'document.body.insertAdjacentHTML("beforeend","<pre id=mesure>"+(r?[mm(r.top+scrollY),mm(i.bottom+scrollY),mm(i.width),e.getAttribute("data-estime")].join(","):"")+"</pre>")});</script>';
  const f = path.join(dossier, 'mesure.html');
  fs.writeFileSync(f, html.replace('<body>', '<body style="width:' + largeurMm + 'mm">').replace('</body>', script + '</body>'));
  const m = chromeExec(['--dump-dom', '--virtual-time-budget=3000', 'file:///' + f.replace(/\\/g, '/')]).match(/<pre id="mesure">([^<]*)/);
  const v = m ? m[1].split(',').map(Number) : [];
  return { haut: v[0], bas: v[1], largeur: v[2], estime: v[3] };
}

let reussis = 0, n = 0;
function cas(nom, fonction, d, page) {
  n++;
  const html = ctx[fonction](d, esc);
  let detail = '';
  const fichier = path.join(dossier, nom.replace(/[^\w-]+/g, '_') + '.pdf');
  const source = fichier.replace(/\.pdf$/, '.html');
  fs.writeFileSync(source, html);
  chromeExec(['--no-pdf-header-footer', '--print-to-pdf=' + fichier, 'file:///' + source.replace(/\\/g, '/')]);
  try {
    assert.ok(fs.existsSync(fichier), 'PDF non fabriqué');
    const prevues = (page.pagesContenu || 1) + (html.match(/page-break-before:always/g) || []).length;
    const reelles = pagesDuPdf(fichier);
    assert.strictEqual(reelles, prevues, reelles + ' page(s) au lieu de ' + prevues + ' : quelque chose déborde');
    if (html.indexOf('data-mep="page1"') > -1) {
      const m = mesurePage1(html, page.largeur);
      assert.ok(m.bas > 0, 'mesure impossible');
      detail = ' — contenu estimé ' + m.estime + ' mm, réel ' + (m.haut - 3).toFixed(1) + ' mm';
      const reel = m.haut - 3;   // le bloc de la photo commence 3 mm sous le contenu
      assert.ok(m.estime >= reel - 1, 'estimation trop faible : ' + m.estime + ' mm estimés pour ' + reel.toFixed(1) + ' mm réels');
      assert.ok(m.bas <= page.hauteur + 0.5, 'photo de la page 1 trop haute : bas à ' + m.bas + ' mm pour ' + page.hauteur + ' mm');
      // Place perdue : seulement si la photo est limitée par la hauteur (une photo en largeur sur une page debout
      // est limitée par la largeur : la place en dessous est normale)
      const limiteeParLaHauteur = m.largeur < page.largeur - 1;
      assert.ok(!limiteeParLaHauteur || page.hauteur - m.bas <= 20, 'trop de place perdue sous la photo de la page 1 : ' + (page.hauteur - m.bas).toFixed(1) + ' mm');
    } else if (page.page1Attendue) throw new Error('la photo devait rester en page 1');
    reussis++; console.log('  ✓ ' + nom + ' (' + reelles + ' page(s))' + detail);
  } catch (e) { console.log('  ✗ ' + nom + '\n    ' + e.message); process.exitCode = 1; }
}
module.exports.cas = cas;
module.exports.images = { PAYSAGE, PORTRAIT, CROQUIS };

if (require.main === module) {
  const PAYSAGE_A4 = { largeur: 277, hauteur: 190 }, DEBOUT_A4 = { largeur: 180, hauteur: 267 };
  const avec = (o, extra) => Object.assign({}, o, extra);
  console.log('PDF — mise en page des photos (Chrome : ' + path.basename(chrome) + ')');
  require('./pdf-cas.js')(cas, { PAYSAGE, PORTRAIT, CROQUIS, PAYSAGE_A4, DEBOUT_A4, avec });
  console.log(reussis + '/' + n + ' cas réussis');
  if (process.argv.indexOf('--garder') > -1) console.log('PDF gardés dans ' + dossier);
  else fs.rmSync(dossier, { recursive: true, force: true });
}
