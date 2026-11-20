// Fabrique les deux fichiers « à coller » du planning (lot 11.1), à partir des fichiers du dossier planning/ :
//   A-COLLER-PLANNING/1-Programme-du-planning.gs      → à coller dans le Sheet « Planning Loué » (Extensions → Apps Script)
//   A-COLLER-PLANNING/2-Programme-de-publication.gs   → à coller dans un projet Apps Script À PART, dans le compte de Loué
// Usage :  node outils/construire-planning.js             (fabrique)
//          node outils/construire-planning.js --verifier  (dit seulement si les fichiers sont à jour ; code de sortie 1 sinon)
// Aucun secret ni identifiant n'est écrit dans ces fichiers : les réglages sont dans les « Propriétés du script ».
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const RACINE = path.join(__dirname, '..');
const SOURCE = path.join(RACINE, 'planning');
const SORTIE = path.join(RACINE, 'A-COLLER-PLANNING');
const LIVRAISONS = [
  { fichier: '1-Programme-du-planning.gs', sources: ['Regles.gs', 'Affiche.gs', 'Planning.gs'],
    // @OnlyCurrentDoc : Google ne donne à ce programme que le droit de toucher CE Sheet (rien d'autre dans le Drive)
    tete: '/**\n * @OnlyCurrentDoc\n */\n// PLANNING LOUÉ — programme du planning, à coller dans le Sheet « Planning Loué » (Extensions → Apps Script).\n' },
  { fichier: '2-Programme-de-publication.gs', sources: ['Regles.gs', 'Affiche.gs', 'Publication.gs'],
    tete: '// PLANNING LOUÉ — programme de publication, à coller dans un projet Apps Script À PART (script.google.com), dans le compte de Loué.\n' },
];

function assembler(l) {
  const morceaux = l.sources.map(f => {
    const texte = fs.readFileSync(path.join(SOURCE, f), 'utf8').replace(/\r\n/g, '\n').replace(/\s+$/, '');
    return '// ─────────────── ' + f + ' ───────────────\n' + texte + '\n';
  });
  const corps = morceaux.join('\n');
  const empreinte = crypto.createHash('sha256').update(corps).digest('hex').slice(0, 10);
  return { texte: l.tete + '// NE PAS MODIFIER ICI : fichier fabriqué par outils/construire-planning.js — empreinte ' + empreinte + '\n\n' + corps, empreinte: empreinte };
}

function construire(verifier) {
  const resultats = LIVRAISONS.map(l => {
    const a = assembler(l), cible = path.join(SORTIE, l.fichier);
    const actuel = fs.existsSync(cible) ? fs.readFileSync(cible, 'utf8').replace(/\r\n/g, '\n') : null;
    const aJour = actuel === a.texte;
    if (!verifier && !aJour) { fs.mkdirSync(SORTIE, { recursive: true }); fs.writeFileSync(cible, a.texte); }
    return { fichier: l.fichier, empreinte: a.empreinte, aJour: aJour };
  });
  return resultats;
}

module.exports = { construire, assembler, LIVRAISONS, SORTIE };

if (require.main === module) {
  const verifier = process.argv.indexOf('--verifier') > -1;
  const r = construire(verifier);
  r.forEach(x => console.log((verifier ? (x.aJour ? '✅ à jour     ' : '❌ PAS À JOUR ') : '✅ fabriqué   ') + x.fichier + ' (empreinte ' + x.empreinte + ')'));
  if (verifier && r.some(x => !x.aJour)) { console.log('Lance : node outils/construire-planning.js'); process.exitCode = 1; }
}
