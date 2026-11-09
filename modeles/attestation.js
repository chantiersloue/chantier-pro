// ═══════════════════════════════════════════════════════════════
// MODÈLE UNIQUE du PDF « Attestation » (mise en œuvre, levée d'observations, contrôle DAS, autre)
// Utilisé tel quel par la page (aperçu, impression sur PC) ET par le serveur (PDF envoyé par mail) :
// apps-script/Modeles.gs est une COPIE générée par « node outils/construire.js » — ne jamais la modifier à la main.
// Règles : tableaux et styles en ligne seulement (le convertisseur PDF de Google ne connaît ni flex ni grid),
// pas de backticks imbriqués, tout texte saisi passe par esc().
// d : données de la fiche (textes bruts ; images déjà contrôlées) ; esc : fonction d'échappement
// d.qualite (fonction du signataire) : calculée par la page pour l'aperçu, par le serveur pour le PDF envoyé.
// ═══════════════════════════════════════════════════════════════
function modele_attestation(d, esc) {
  var type = d.typeAttest || '';
  var titres = {
    'mise-oeuvre': 'Attestation de mise en œuvre',
    'levee-obs': 'Attestation de levée d’observations',
    'das': 'Attestation de contrôle — Bloc porte DAS',
  };
  var titre = titres[type] || d.typeLabel || 'Attestation';
  var couleur = { 'mise-oeuvre': '#1A6B3B', 'levee-obs': '#B32E2E', 'das': '#1A2B4A', 'autre': '#6B3FA0' }[type] || '#6B3FA0';
  var chantier = (d.chantier || '—') + (d.precision ? ' — ' + d.precision : '');
  var photos = (d.photos || []).filter(function (p) { return p && p.data; });
  var CASE = 'padding:6px 8px;border:1px solid #D8D4CE;';
  var ETIQ = CASE + 'background:#FAFAF8;font-size:9px;font-weight:700;text-transform:uppercase;color:#6A6460;width:35%';

  function ligne(etiquette, valeur, gras) {
    return '<tr><td style="' + ETIQ + '">' + etiquette + '</td><td style="' + CASE + (gras ? 'font-weight:700;' : '') + '">' + esc(valeur || '—') + '</td></tr>';
  }

  // ── Corps : points de contrôle DAS, ou objet de l'attestation ──
  var corps = '';
  if (type === 'das') {
    var points = d.dasPoints || [];
    var nb = function (s) { return points.filter(function (p) { return p && p.state === s; }).length; };
    var lignes = points.map(function (p, i) {
      var s = p.state;
      var cl = s === 'ok' ? '#196B3B' : s === 'nc' ? '#B32E2E' : s === 'so' ? '#888888' : '#999999';
      var lb = s === 'ok' ? '✓ OK' : s === 'nc' ? '✗ N.C.' : s === 'so' ? '— S.O.' : '—';
      return '<tr style="background:' + (i % 2 === 0 ? 'white' : '#FAFAF8') + '">'
        + '<td style="' + CASE + 'font-size:10px">' + esc(p.label || '') + '</td>'
        + '<td style="' + CASE + 'font-size:10px;font-weight:700;color:' + cl + ';text-align:center;width:25%">' + lb + '</td></tr>';
    }).join('');
    var nc = nb('nc');
    corps = '<table style="width:100%;border-collapse:collapse;margin-bottom:10px">'
      + ligne('N° Bloc porte', d.dasNumero, true) + ligne('Étage / Niveau', d.dasEtage)
      + ligne('Localisation', d.dasLocalisation) + ligne('Asservissement(s)', d.asservissements)
      + '</table>'
      + '<table style="width:100%;border-collapse:collapse;margin-bottom:10px"><thead><tr>'
      + '<th style="padding:6px 8px;background:#1A2B4A;color:white;font-size:9px;text-align:left">Point de contrôle</th>'
      + '<th style="padding:6px 8px;background:#1A2B4A;color:white;font-size:9px;text-align:center;width:25%">Résultat</th>'
      + '</tr></thead><tbody>' + lignes + '</tbody></table>'
      + '<div style="padding:7px 10px;background:' + (nc ? '#FAE8E8' : '#E1F2E9') + ';border:1px solid ' + (nc ? '#B32E2E' : '#196B3B')
      + ';border-radius:4px;font-size:10px;font-weight:700;color:' + (nc ? '#B32E2E' : '#196B3B') + ';margin-bottom:10px">'
      + 'Bilan : ' + nb('ok') + ' conforme(s) · ' + nc + ' non conforme(s) · ' + nb('so') + ' sans objet</div>';
  } else {
    corps = '<div style="padding:10px 12px;background:#F7F5F1;border:1px solid #D8D4CE;border-radius:4px;margin-bottom:12px">'
      + '<div style="font-size:8px;font-weight:700;text-transform:uppercase;color:#6A6460;margin-bottom:4px">Objet</div>'
      + '<div style="font-size:11px;line-height:1.7;white-space:pre-wrap;word-break:break-word;overflow-wrap:break-word">' + esc(d.objet || '—') + '</div></div>';
  }

  // ── Photos : toutes, deux par ligne (avant la refonte, le PDF envoyé n'en gardait que deux) ──
  var photosHtml = '';
  if (photos.length) {
    var haut = photos.length === 1 ? '90mm' : '68mm';
    var img = function (p) {
      return '<img src="data:' + (p.mimeType || p.mime || 'image/jpeg') + ';base64,' + p.data + '" style="max-width:100%;max-height:' + haut + ';border:1px solid #ddd;">';
    };
    var rangs = '';
    for (var i = 0; i < photos.length; i += 2) {
      var deux = photos[i + 1];
      rangs += '<table style="width:100%;border-collapse:collapse;page-break-inside:avoid"><tr>'
        + '<td style="width:' + (photos.length === 1 ? '100%' : '50%') + ';padding:4px;text-align:center;vertical-align:top">' + img(photos[i]) + '</td>'
        + (photos.length === 1 ? '' : '<td style="width:50%;padding:4px;text-align:center;vertical-align:top">' + (deux ? img(deux) : '') + '</td>')
        + '</tr></table>';
    }
    photosHtml = '<div style="margin-top:10px">'
      + '<div style="font-size:9px;font-weight:700;text-transform:uppercase;color:#6A6460;margin-bottom:6px;border-bottom:2px solid ' + couleur + ';padding-bottom:3px">Photo' + (photos.length > 1 ? 's' : '') + '</div>'
      + rangs + '</div>';
  }

  var qualite = d.qualite ? ', en qualité de ' + esc(d.qualite) : '';
  return '<html><head><meta charset="utf-8"><style>@page{size:A4;margin:1.5cm}body{font-family:Arial,sans-serif;font-size:10px;margin:0;color:#1A1A1A}*{box-sizing:border-box}</style></head><body>'
    + '<div style="border-bottom:3px solid ' + couleur + ';padding-bottom:10px;margin-bottom:14px">'
    + '<table style="width:100%;border-collapse:collapse"><tr>'
    + '<td style="vertical-align:top"><div style="font-weight:800;font-size:16px;color:#1A2B4A">Loué Menuiserie</div>'
    + '<div style="font-size:9px;color:#6A6460">Menuiserie · Charpente · Agencement</div></td>'
    + '<td style="text-align:right;vertical-align:top;white-space:nowrap">'
    + '<div style="font-size:8px;font-weight:700;text-transform:uppercase;color:#6A6460;letter-spacing:.4px">Date</div>'
    + '<div style="font-size:17px;font-weight:800;color:#1A1A1A">' + esc(d.date || '—') + '</div>'
    + (d.ref ? '<div style="font-size:9px;color:#6A6460;margin-top:4px">Réf : ' + esc(d.ref) + '</div>' : '')
    + '</td></tr></table>'
    + '<div style="text-align:center;font-weight:900;font-size:22px;color:' + couleur + ';letter-spacing:.5px;line-height:1.15;margin-top:12px">' + esc(titre.toUpperCase()) + '</div>'
    + '</div>'
    + '<table style="width:100%;border-collapse:collapse;margin-bottom:12px">'
    + ligne('Chantier', chantier, true)
    + '</table>'
    + '<div style="margin:0 0 12px;font-size:12px;line-height:1.55">Je soussigné <strong>' + esc(d.signataire || '—') + '</strong>' + qualite + ', certifie que&nbsp;:</div>'
    + corps
    + photosHtml
    + '<table style="width:100%;border-collapse:collapse;margin-top:14px;page-break-inside:avoid"><tr>'
    + '<td style="width:50%;padding-right:8px;vertical-align:top">'
    + '<div style="font-size:9px;font-weight:700;text-transform:uppercase;color:#6A6460;margin-bottom:4px">Signature</div>'
    + '<div style="border:1px solid #D8D4CE;border-radius:4px;height:80px;background:#FAFAF8;text-align:center;padding:4px">'
    + (d.signature ? '<img src="' + d.signature + '" style="max-width:100%;max-height:72px;">' : '') + '</div>'
    + '<div style="font-size:9px;color:#6A6460;margin-top:3px">' + esc(d.signataire || '') + ' — ' + esc(d.date || '') + '</div>'
    + '</td><td style="width:50%"></td></tr></table>'
    + '</body></html>';
}
