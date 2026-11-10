// ═══════════════════════════════════════════════════════════════
// MODÈLE UNIQUE du PDF « Note de réunion »
// Utilisé tel quel par la page (aperçu, impression sur PC) ET par le serveur (PDF envoyé par mail) :
// apps-script/Modeles.gs est une COPIE générée par « node outils/construire.js » — ne jamais la modifier à la main.
// Règles : tableaux et styles en ligne seulement (le convertisseur PDF de Google ne connaît ni flex ni grid),
// pas de backticks imbriqués, tout texte saisi passe par esc().
// d : données de la fiche (textes bruts ; images déjà contrôlées) ; esc : fonction d'échappement
// ═══════════════════════════════════════════════════════════════
function modele_note(d, esc) {
  var photos = (d.photosBase64 || []).filter(function (p) { return p && p.data; });
  var TEXTE = 'white-space:pre-wrap;word-break:break-word;overflow-wrap:break-word;';
  var ETIQ = 'font-size:7.5px;font-weight:700;text-transform:uppercase;color:#6A6460;margin-bottom:2px';

  function src(p) { return 'data:' + (p.mimeType || p.mime || 'image/jpeg') + ';base64,' + p.data; }
  function legende(p) {
    return p.label ? '<div style="margin-top:4px;font-size:10px;color:#6A6460;' + TEXTE + '">' + esc(p.label) + '</div>' : '';
  }

  // Une seule photo : sous les notes, page 1. Deux ou plus : deux par page, à partir de la page 2.
  var photosHtml = '';
  if (photos.length === 1) {
    var p = photos[0];
    photosHtml = '<div style="margin-top:10px;border:1.5px solid #0D7A6B;border-radius:5px;overflow:hidden;page-break-inside:avoid">'
      + '<div style="background:#E0F5F2;padding:5px 10px;border-bottom:1px solid #0D7A6B;font-size:9px;font-weight:700;color:#0D7A6B;text-transform:uppercase">'
      + 'Photo / Croquis' + (p.label ? ' — <span style="text-transform:none">' + esc(p.label) + '</span>' : '') + '</div>'
      + '<div style="padding:8px;text-align:center"><img src="' + src(p) + '" style="max-width:100%;max-height:130mm;display:block;margin:0 auto;"></div></div>';
  } else {
    for (var i = 0; i < photos.length; i += 2) {
      var p1 = photos[i], p2 = photos[i + 1];
      var cellule2 = p2
        ? '<td style="width:50%;padding-left:8px;text-align:center;vertical-align:top"><img src="' + src(p2) + '" style="max-width:100%;max-height:120mm;display:block;margin:0 auto;border:1px solid #ddd;">' + legende(p2) + '</td>'
        : '<td style="width:50%"></td>';
      photosHtml += '<div style="page-break-before:always;padding:12px 10px">'
        + '<div style="font-size:9px;font-weight:700;color:#0D7A6B;margin-bottom:8px;border-bottom:2px solid #0D7A6B;padding-bottom:4px;text-transform:uppercase">'
        + 'Photos / Croquis ' + (i + 1) + (p2 ? ' &amp; ' + (i + 2) : '') + '</div>'
        + '<table style="width:100%;border-collapse:collapse"><tr>'
        + '<td style="width:50%;padding-right:8px;text-align:center;vertical-align:top"><img src="' + src(p1) + '" style="max-width:100%;max-height:120mm;display:block;margin:0 auto;border:1px solid #ddd;">' + legende(p1) + '</td>'
        + cellule2 + '</tr></table></div>';
    }
  }

  var commentaires = d.commentaires
    ? '<div style="padding:10px 12px;background:#F0F5F4;border:1.5px solid #0D7A6B;border-radius:5px;margin-bottom:10px">'
      + '<div style="font-size:8px;font-weight:700;text-transform:uppercase;color:#0D7A6B;margin-bottom:6px;letter-spacing:.5px">Notes &amp; commentaires</div>'
      + '<div style="font-size:11px;line-height:1.7;' + TEXTE + '">' + esc(d.commentaires) + '</div></div>'
    : '';

  return '<html><head><meta charset="utf-8"><style>@page{size:A4;margin:1.5cm}body{font-family:Arial,sans-serif;font-size:10px;margin:0}*{box-sizing:border-box}</style></head><body>'
    + '<table style="width:100%;border-collapse:collapse;margin-bottom:12px;border-bottom:3px solid #0D7A6B"><tr>'
    + '<td style="width:175px;vertical-align:top;padding-bottom:10px">'
    + '<table style="width:100%;border-collapse:collapse;border:1.5px solid #D8D4CE">'
    + '<tr><td style="padding:5px 8px;border-bottom:1px solid #E1DCD6"><div style="' + ETIQ + '">Date</div>'
    + '<div style="font-size:12px;font-weight:700">' + esc(d.date || '—') + '</div></td></tr>'
    + '<tr><td style="padding:5px 8px;border-bottom:1px solid #E1DCD6"><div style="' + ETIQ + '">Chantier</div>'
    + '<div style="font-size:12px;font-weight:800;color:#1A2B4A;word-break:break-word">' + esc(d.chantier || '—') + '</div></td></tr>'
    + '<tr><td style="padding:5px 8px"><div style="' + ETIQ + '">Rédigé par</div>'
    + '<div style="font-size:11px;font-weight:600">' + esc(d.auteur || '—') + '</div></td></tr>'
    + '</table></td>'
    + '<td style="vertical-align:middle;padding:0 16px 10px;text-align:center">'
    + '<div style="font-weight:800;font-size:15px;color:#1A2B4A">Loué Menuiserie</div>'
    + '<div style="font-size:9px;color:#6A6460;margin-bottom:8px">Menuiserie · Charpente · Agencement</div>'
    + '<div style="font-weight:800;font-size:14px;color:#0D7A6B">NOTE DE RÉUNION</div>'
    + (d.objet ? '<div style="margin-top:5px;font-size:11px;font-weight:600;color:#141210;' + TEXTE + '">' + esc(d.objet) + '</div>' : '')
    + '</td></tr></table>'
    + commentaires
    + photosHtml
    + '</body></html>';
}
