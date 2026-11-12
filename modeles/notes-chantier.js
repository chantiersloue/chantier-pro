// ═══════════════════════════════════════════════════════════════
// MODÈLE du PDF « Notes de chantier » (export d'un chantier) — lot 3
// Utilisé par le serveur (PDF rangé dans le dossier du chantier) :
// apps-script/Modeles.gs est une COPIE générée par « node outils/construire.js » — ne jamais la modifier à la main.
// Règles : tableaux et styles en ligne seulement (le convertisseur PDF de Google ne connaît ni flex ni grid),
// pas de backticks imbriqués, tout texte saisi passe par esc().
// d : { chantier, date, exportePar, notes: [{ cree, auteur, texte, fait, faitPar, faitLe, modifPar, modifLe,
//       photos: [{ data, mimeType }] }], nonReprises } (textes bruts ; images déjà contrôlées) ; esc : échappement
// ═══════════════════════════════════════════════════════════════
function modele_notes_chantier(d, esc) {
  var notes = Array.isArray(d.notes) ? d.notes : [];
  function photos(liste) {
    var ok = (Array.isArray(liste) ? liste : []).filter(function (p) { return p && p.data; });
    if (!ok.length) return '';
    var cases = ok.map(function (p) {
      return '<td style="padding:4px 6px 0 0;vertical-align:top"><img src="data:' + esc(p.mimeType || 'image/jpeg') + ';base64,' + p.data
        + '" style="width:165px;height:auto;border:1px solid #D8D4CE"></td>';
    }).join('');
    return '<table style="border-collapse:collapse;margin-top:4px"><tr>' + cases + '</tr></table>';
  }
  var lignes = notes.map(function (n) {
    var pied = [];
    if (n.fait) pied.push('Fait' + (n.faitPar ? ' par ' + esc(n.faitPar) : '') + (n.faitLe ? ' le ' + esc(n.faitLe) : ''));
    if (n.modifPar) pied.push('Modifiée par ' + esc(n.modifPar) + (n.modifLe ? ' le ' + esc(n.modifLe) : ''));
    return '<tr style="page-break-inside:avoid">'
      + '<td style="width:24%;vertical-align:top;padding:8px 8px 8px 0;border-bottom:1px solid #D8D4CE">'
      + '<div style="font-size:10px;font-weight:700;color:#1A2B4A">' + esc(n.cree || '—') + '</div>'
      + '<div style="font-size:10px;color:#6A6460">' + esc(n.auteur || '—') + '</div>'
      + (n.fait ? '<div style="font-size:9px;font-weight:700;color:#2E7D4F;margin-top:3px">FAIT</div>' : '') + '</td>'
      + '<td style="vertical-align:top;padding:8px 0;border-bottom:1px solid #D8D4CE">'
      + '<div style="font-size:11px;line-height:1.6;white-space:pre-wrap;word-break:break-word;overflow-wrap:break-word'
      + (n.fait ? ';color:#6A6460' : '') + '">' + (n.texte ? esc(n.texte) : '<i>(photo sans texte)</i>') + '</div>'
      + photos(n.photos)
      + (pied.length ? '<div style="font-size:9px;color:#6A6460;margin-top:4px">' + pied.join(' · ') + '</div>' : '')
      + '</td></tr>';
  }).join('');
  var nb = notes.length, faites = notes.filter(function (n) { return n.fait; }).length;

  return '<html><head><meta charset="utf-8"><style>@page{size:A4;margin:1.5cm}body{font-family:Arial,sans-serif;font-size:10px;margin:0}*{box-sizing:border-box}</style></head><body>'
    + '<table style="width:100%;border-collapse:collapse;margin-bottom:12px;border-bottom:3px solid #1A2B4A"><tr>'
    + '<td style="vertical-align:middle;width:40%;padding-bottom:10px"><div style="font-weight:800;font-size:16px;color:#1A2B4A">Loué Menuiserie</div>'
    + '<div style="font-size:9px;color:#6A6460">Menuiserie · Charpente · Agencement</div></td>'
    + '<td style="vertical-align:middle;text-align:center;width:40%;padding-bottom:10px"><div style="font-weight:800;font-size:15px;color:#1A2B4A">NOTES DE CHANTIER</div>'
    + '<div style="font-size:11px;color:#6A6460;margin-top:4px">Chantier : <b>' + esc(d.chantier || '—') + '</b></div></td>'
    + '<td style="vertical-align:middle;text-align:right;width:20%;padding-bottom:10px"><div style="font-size:9px;color:#6A6460">Export du ' + esc(d.date || '—') + '</div>'
    + '<div style="font-size:9px;color:#6A6460">par ' + esc(d.exportePar || '—') + '</div></td>'
    + '</tr></table>'
    + '<div style="font-size:10px;color:#6A6460;margin-bottom:8px">' + nb + ' note' + (nb > 1 ? 's' : '') + ', dont ' + faites + ' faite' + (faites > 1 ? 's' : '')
    + ', de la plus ancienne à la plus récente.'
    + (d.nonReprises ? ' ' + Number(d.nonReprises) + ' photo(s) non reprise(s) dans ce PDF : voir le dossier PHOTOS CHANTIER/NOTES du chantier.' : '') + '</div>'
    + '<table style="width:100%;border-collapse:collapse">' + lignes + '</table>'
    + '</body></html>';
}
