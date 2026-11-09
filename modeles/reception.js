// ═══════════════════════════════════════════════════════════════
// MODÈLE UNIQUE du PDF « Réception support »
// Utilisé tel quel par la page (aperçu, impression sur PC) ET par le serveur (PDF envoyé par mail) :
// apps-script/Modeles.gs est une COPIE générée par « node outils/construire.js » — ne jamais la modifier à la main.
// Règles : tableaux et styles en ligne seulement (le convertisseur PDF de Google ne connaît ni flex ni grid),
// pas de backticks imbriqués, tout texte saisi passe par esc().
// d : données de la fiche (textes bruts ; images déjà contrôlées) ; esc : fonction d'échappement
// ═══════════════════════════════════════════════════════════════
function modele_reception(d, esc) {
  var points = (d.points || []).filter(function (p) { return p; });
  var nb = function (s) { return points.filter(function (p) { return p.state === s; }).length; };
  var nbOk = nb('ok'), nbNok = nb('nok'), nbSo = nb('so');
  var conf = nbNok > 0 ? '#B32E2E' : '#196B3B';
  var CASE = 'padding:6px 8px;border:1px solid #D8D4CE;';
  var ETIQ = CASE + 'background:#FAFAF8;font-size:9px;color:#6A6460;font-weight:700;text-transform:uppercase;width:35%';
  var TEXTE = 'white-space:pre-wrap;word-break:break-word;overflow-wrap:break-word;';

  var lignes = points.map(function (p, i) {
    var s = p.state;
    var sc = s === 'ok' ? '#196B3B' : s === 'nok' ? '#B32E2E' : s === 'so' ? '#888888' : '#999999';
    var sl = s === 'ok' ? '✓ Conforme' : s === 'nok' ? '✗ Non conforme' : s === 'so' ? '— Sans objet' : 'Non évalué';
    return '<tr style="background:' + (i % 2 === 0 ? 'white' : '#FAFAF8') + '">'
      + '<td style="' + CASE + 'font-size:11px">' + esc(p.label || '') + '</td>'
      + '<td style="' + CASE + 'font-size:10px;font-weight:700;color:' + sc + ';text-align:center">' + sl + '</td>'
      + '<td style="' + CASE + 'font-size:10px;color:#6A6460;' + TEXTE + '">' + esc(p.comment || '') + '</td></tr>';
  }).join('');

  // Photos de chaque point : une page par point, deux photos par ligne
  var photosHtml = points.map(function (p) {
    var ph = (p.photos || []).filter(function (x) { return x && x.data; });
    if (!ph.length) return '';
    var rangs = '';
    for (var i = 0; i < ph.length; i += 2) {
      var cellule = function (x) {
        return '<td style="text-align:center;vertical-align:top;width:50%;padding:4px">'
          + (x ? '<img src="data:' + (x.mimeType || x.mime || 'image/jpeg') + ';base64,' + x.data + '" style="max-width:100%;max-height:100mm;border:1px solid #ddd;">' : '') + '</td>';
      };
      rangs += '<table style="width:100%;border-collapse:collapse;page-break-inside:avoid"><tr>' + cellule(ph[i]) + cellule(ph[i + 1]) + '</tr></table>';
    }
    return '<div style="page-break-before:always;padding-top:10px">'
      + '<div style="font-weight:700;font-size:11px;color:#0D7A6B;border-bottom:2px solid #0D7A6B;padding-bottom:4px;margin-bottom:8px">Photos — ' + esc(p.label || '') + '</div>'
      + rangs + '</div>';
  }).join('');

  return '<html><head><meta charset="utf-8"><style>@page{size:A4;margin:1.5cm}body{font-family:Arial,sans-serif;font-size:10px;margin:0}*{box-sizing:border-box}</style></head><body>'
    + '<table style="width:100%;border-collapse:collapse;margin-bottom:14px;border-bottom:3px solid #0D7A6B"><tr>'
    + '<td style="vertical-align:middle;width:40%;padding-bottom:10px"><div style="font-weight:800;font-size:16px;color:#1A2B4A">Loué Menuiserie</div>'
    + '<div style="font-size:9px;color:#6A6460">Menuiserie · Charpente · Agencement</div></td>'
    + '<td style="text-align:center;vertical-align:middle;padding-bottom:10px"><div style="font-weight:800;font-size:14px;color:#0D7A6B">RÉCEPTION SUPPORT</div>'
    + '<div style="font-size:10px;color:#6A6460;margin-top:2px">' + esc(d.lotLabel || '') + '</div></td>'
    + '<td style="text-align:right;vertical-align:middle;font-size:10px;color:#6A6460;padding-bottom:10px">'
    + '<div>' + esc(d.date || '—') + '</div><div style="font-weight:700">' + esc(d.signataire || '—') + '</div></td>'
    + '</tr></table>'
    + '<table style="width:100%;border-collapse:collapse;margin-bottom:10px">'
    + '<tr><td style="' + ETIQ + '">Chantier</td><td style="' + CASE + 'font-weight:700">' + esc(d.chantier || '—')
    + (d.precision ? ' — <span style="font-weight:400;color:#6A6460">' + esc(d.precision) + '</span>' : '') + '</td></tr>'
    + '<tr><td style="' + ETIQ + '">Lot contrôlé</td><td style="' + CASE + '">' + esc(d.lotLabel || '—') + '</td></tr>'
    + '</table>'
    + '<table style="width:100%;border-collapse:collapse;margin-bottom:10px"><thead><tr>'
    + '<th style="padding:6px 8px;background:#1A2B4A;color:white;font-size:9px;text-align:left;width:38%">Point de contrôle</th>'
    + '<th style="padding:6px 8px;background:#1A2B4A;color:white;font-size:9px;text-align:center;width:22%">Résultat</th>'
    + '<th style="padding:6px 8px;background:#1A2B4A;color:white;font-size:9px;text-align:left">Commentaire</th>'
    + '</tr></thead><tbody>' + lignes + '</tbody></table>'
    + '<div style="padding:7px 10px;background:' + (nbNok > 0 ? '#FAE8E8' : '#E1F2E9') + ';border:1px solid ' + conf + ';border-radius:4px;font-size:10px;color:' + conf + ';font-weight:700;margin-bottom:10px">'
    + 'Bilan : ' + nbOk + ' conforme(s) · ' + nbNok + ' non conforme(s) · ' + nbSo + ' sans objet</div>'
    + (d.observations ? '<div style="padding:7px 10px;background:#F7F5F1;border:1px solid #D8D4CE;border-radius:4px;font-size:10px;margin-bottom:10px;' + TEXTE + '"><strong>Observations :</strong> ' + esc(d.observations) + '</div>' : '')
    + '<table style="width:100%;border-collapse:collapse;page-break-inside:avoid"><tr>'
    + '<td style="width:50%;padding-right:8px;vertical-align:top">'
    + '<div style="font-size:9px;font-weight:700;text-transform:uppercase;color:#6A6460;margin-bottom:4px">Signature</div>'
    + '<div style="border:1px solid #D8D4CE;border-radius:4px;height:80px;background:#FAFAF8;text-align:center;padding:4px">'
    + (d.signature ? '<img src="' + d.signature + '" style="max-width:100%;max-height:72px;">' : '') + '</div>'
    + '<div style="font-size:9px;color:#6A6460;margin-top:3px">' + esc(d.signataire || '') + ' — ' + esc(d.date || '') + '</div>'
    + '</td><td style="width:50%"></td></tr></table>'
    + photosHtml
    + '</body></html>';
}
