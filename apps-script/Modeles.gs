// ═══════════════════════════════════════════════════════════════
// FICHIER GÉNÉRÉ AUTOMATIQUEMENT — NE PAS MODIFIER À LA MAIN
// Copie des modèles de PDF du dossier modeles/ (node outils/construire.js).
// Pour changer un PDF : modifier modeles/<document>.js, relancer la commande, recoller ce fichier.
// ═══════════════════════════════════════════════════════════════

// ── modeles/bordereau.js ──
// ═══════════════════════════════════════════════════════════════
// MODÈLE UNIQUE du PDF « Bordereau de remise » (organigramme ou matériaux)
// Utilisé tel quel par la page (aperçu, impression sur PC) ET par le serveur (PDF envoyé par mail) :
// apps-script/Modeles.gs est une COPIE générée par « node outils/construire.js » — ne jamais la modifier à la main.
// Règles : tableaux et styles en ligne seulement, pas de backticks imbriqués, tout texte saisi passe par esc().
// d : données de la fiche (d.type = 'bordereau-orga' ou 'bordereau-materiaux') ; esc : fonction d'échappement
// ═══════════════════════════════════════════════════════════════
function modele_bordereau(d, esc) {
  var orga = d.type === 'bordereau-orga';
  var titre = orga ? 'BORDEREAU DE REMISE — ORGANIGRAMME' : 'BORDEREAU DE REMISE — MATÉRIAUX';
  var photos = (d.photosBase64 || []).filter(function (p) { return p && p.data; });

  function img(p, hauteur) {
    return '<img src="data:' + (p.mimeType || 'image/jpeg') + ';base64,' + p.data + '" style="max-width:100%;max-height:' + hauteur + ';display:block;margin:0 auto;">';
  }
  function legende(p) { return p.label ? '<div style="font-size:9px;margin-top:3px;color:#6A6460">' + esc(p.label) + '</div>' : ''; }
  var photosHtml = '';
  if (photos.length === 1) {
    photosHtml = '<div style="margin-top:10px;border:1px solid #D8D4CE;border-radius:5px;overflow:hidden">'
      + '<div style="background:#FAFAF8;padding:5px 10px;border-bottom:1px solid #D8D4CE;font-size:9px;font-weight:700;color:#7A4200">Photo'
      + (photos[0].label ? ' — ' + esc(photos[0].label) : '') + '</div>'
      + '<div style="padding:8px;text-align:center">' + img(photos[0], '100mm') + '</div></div>';
  } else {
    for (var i = 0; i < photos.length; i += 2) {
      var p2 = photos[i + 1];
      var cellule2 = p2 ? '<td style="width:50%;padding-left:6px;text-align:center">' + img(p2, '110mm') + legende(p2) + '</td>' : '<td></td>';
      photosHtml += '<div style="page-break-before:always;padding:10px">'
        + '<div style="font-size:9px;font-weight:700;color:#7A4200;margin-bottom:6px;border-bottom:2px solid #C8860A;padding-bottom:3px">Photos ' + (i + 1) + (p2 ? ' & ' + (i + 2) : '') + '</div>'
        + '<table style="width:100%;border-collapse:collapse"><tr>'
        + '<td style="width:50%;padding-right:6px;text-align:center">' + img(photos[i], '110mm') + legende(photos[i]) + '</td>' + cellule2
        + '</tr></table></div>';
    }
  }
  function signature(titreSig, src) {
    return '<td style="width:50%;padding:0 4px;vertical-align:top">'
      + '<div style="font-size:9px;font-weight:700;text-transform:uppercase;color:#6A6460;margin-bottom:4px">' + titreSig + '</div>'
      + '<div style="border:1px solid #D8D4CE;border-radius:4px;height:80px;background:#FAFAF8;text-align:center;padding:4px">'
      + (src ? '<img src="' + src + '" style="max-width:100%;max-height:72px;">' : '') + '</div></td>';
  }
  var mention = orga
    ? '<div style="margin-top:12px;padding:10px 12px;background:#FFF0F0;border:1.5px solid #EFC0C0;border-radius:5px;font-size:10px;color:#B32E2E;line-height:1.7">'
      + '<strong>Le preneur est informé qu’en cas de perte d’un passe général, l’ensemble de l’organigramme est à refaire. Les frais sont supportés par le preneur de la clé.</strong><br>'
      + 'En cas de perte d’une clé, un forfait de refabrication de <strong>100 € HT</strong> sera facturé au preneur en plus du prix de la clé ou du cylindre complet.</div>'
    : '';
  var preneur = '<strong>' + esc(d.preneur || '—') + '</strong>' + (d.fonction ? ' (' + esc(d.fonction) + ')' : '') + (d.entreprise ? ' — ' + esc(d.entreprise) : '');
  var commentaires = d.commentaires ? '<br><span style="color:#6A6460;word-break:break-word;white-space:pre-wrap">' + esc(d.commentaires) + '</span>' : '';

  return '<html><head><meta charset="utf-8"><style>@page{size:A4;margin:1.5cm}body{font-family:Arial,sans-serif;font-size:10px;margin:0}*{box-sizing:border-box}</style></head><body>'
    + '<table style="width:100%;border-collapse:collapse;margin-bottom:14px;border-bottom:3px solid #7A4200;padding-bottom:10px"><tr>'
    + '<td style="vertical-align:middle;width:40%"><div style="font-weight:800;font-size:16px;color:#1A2B4A">Loué Menuiserie</div>'
    + '<div style="font-size:9px;color:#6A6460">Menuiserie · Charpente · Agencement</div></td>'
    + '<td style="vertical-align:middle;text-align:center;width:40%"><div style="font-weight:800;font-size:13px;color:#7A4200">' + titre + '</div>'
    + '<div style="font-size:10px;color:#6A6460;margin-top:4px">Chantier : <b>' + esc(d.chantier || '—') + '</b></div>'
    + '<div style="font-size:10px;color:#6A6460">Le ' + esc(d.date || '—') + ' à ' + esc(d.heure || '—') + '</div></td>'
    + '<td style="vertical-align:middle;text-align:right;width:20%"><div style="font-size:9px;color:#6A6460">Rédigé par</div>'
    + '<div style="font-size:10px;font-weight:700">' + esc(d.soussigne || '—') + '</div></td>'
    + '</tr></table>'
    + '<div style="padding:10px 12px;background:#FDF0D6;border:1.5px solid #C8860A;border-radius:5px;margin-bottom:10px;font-size:11px;line-height:1.9">'
    + 'Je soussigné(e) <strong>' + esc(d.soussigne || '—') + '</strong>, Entreprise Loué Menuiserie,<br>'
    + 'déclare par la présente avoir remis en main propre à ' + preneur + ' :<br>'
    + '<strong>' + esc(d.nombre || '—') + ' × ' + esc(d.typeDoc || '—') + '</strong>' + commentaires
    + '</div>'
    + photosHtml
    + '<table style="width:100%;border-collapse:collapse;margin-top:14px;page-break-inside:avoid"><tr>'
    + signature('Signature Entreprise Loué', d.sigLoue) + signature('Signature Preneur', d.sigPreneur)
    + '</tr></table>'
    + mention
    + '</body></html>';
}

// ── modeles/cotes.js ──
// ═══════════════════════════════════════════════════════════════
// MODÈLE UNIQUE du PDF « Prise de cotes — façades et placards »
// Utilisé tel quel par la page (aperçu, impression sur PC) ET par le serveur (PDF envoyé par mail) :
// apps-script/Modeles.gs est une COPIE générée par « node outils/construire.js » — ne jamais la modifier à la main.
// Règles : tableaux et styles en ligne seulement, pas de backticks imbriqués, tout texte saisi passe par esc().
// ═══════════════════════════════════════════════════════════════
function modele_cotes(d, esc) {
  var socle = d.socle === 'OUI';
  var c = 'padding:5px 4px;border:1px solid #ddd;text-align:center';
  var lignes = (d.lignes || []).map(function (l, i) {
    return '<tr style="background:' + (i % 2 === 0 ? '#F7F5F1' : 'white') + '">'
      + '<td style="padding:5px 4px;border:1px solid #ddd;font-weight:700">' + esc(l.logt || '—') + '</td>'
      + '<td style="padding:5px 4px;border:1px solid #ddd">' + esc(l.piece || '—') + '</td>'
      + '<td style="' + c + ';font-weight:700">' + esc(l.haut || '—') + '</td>'
      + '<td style="' + c + '">' + esc(l.lep || '—') + '</td>'
      + '<td style="' + c + '">' + esc(l.lhf || '—') + '</td>'
      + '<td style="' + c + ';font-weight:700">' + esc(l.long || '—') + '</td>'
      + '<td style="' + c + '">' + esc(l.prof || '—') + '</td>'
      + '<td style="' + c + '">' + esc(l.pend || '—') + '</td>'
      + '<td style="' + c + ';color:#7A4200">' + esc(l.plinthe || '—') + '</td>'
      + '<td style="' + c + ';color:#1454A0;font-weight:600">' + esc(l.sol || '—') + '</td>'
      + (socle ? '<td style="' + c + ';background:#FAE8E8;font-weight:700;color:#B32E2E">OUI</td>' : '')
      + '</tr>';
  }).join('');
  var th = function (titre, sous, gauche) {
    return '<th style="background:#1A2B4A;color:white;padding:5px 4px;font-size:9px;text-align:' + (gauche ? 'left' : 'center') + '">' + titre
      + (sous ? '<br><span style="font-weight:400;font-size:7px">' + sous + '</span>' : '') + '</th>';
  };
  // Rappel des réglages généraux (plinthe générale, type de sol) sous le titre
  var reglages = [];
  if (d.plinthMode === 'gen') reglages.push('Plinthe générale : <b>' + esc(d.plinthGen || '—') + (d.plinthGen && d.plinthGen !== 'Non posée' ? ' mm' : '') + '</b>');
  if (d.plinthMode === 'att') reglages.push('Plinthe : <b>hauteurs variables</b> (voir chaque ligne)');
  if (d.solMode) reglages.push('Hauteur de façade sur : <b>' + esc(d.solMode) + '</b>');
  var batiment = d.batiment && d.batiment !== '—' ? ' &nbsp;|&nbsp; Bâtiment : <b>' + esc(d.batiment) + '</b>' : '';

  return '<html><head><meta charset="utf-8"><style>@page{size:landscape;margin:1cm}body{font-family:Arial,sans-serif;font-size:10px;margin:0}</style></head><body>'
    + '<table style="width:100%;border-collapse:collapse;margin-bottom:10px;border-bottom:3px solid #1A2B4A;padding-bottom:8px"><tr>'
    + '<td style="border:none"><div style="font-weight:800;font-size:14px;color:#1A2B4A">Loué Menuiserie</div><div style="font-size:9px;color:#999">Menuiserie · Charpente · Agencement</div></td>'
    + '<td style="border:none;text-align:center"><div style="font-weight:800;font-size:12px;color:#1A2B4A">PRISE DE COTES — FAÇADES &amp; PLACARDS</div>'
    + '<div style="font-size:10px;color:#666;margin-top:3px">Chantier : <b>' + esc(d.chantier || '—') + '</b>' + batiment
    + ' &nbsp;|&nbsp; Par : <b>' + esc(d.auteur || '—') + '</b> &nbsp;|&nbsp; Date : <b>' + esc(d.date || '—') + '</b></div>'
    + (reglages.length ? '<div style="font-size:10px;color:#666;margin-top:3px">' + reglages.join(' &nbsp;|&nbsp; ') + '</div>' : '')
    + '</td>'
    + '<td style="border:none;text-align:right"><span style="background:' + (socle ? '#B32E2E' : '#2A5A3A') + ';color:white;padding:6px 14px;border-radius:4px;font-weight:700;font-size:13px">'
    + (socle ? 'SOCLE POSÉ' : 'PAS DE SOCLE') + '</span></td>'
    + '</tr></table>'
    + '<table style="width:100%;border-collapse:collapse"><thead><tr>'
    + th('N°', '', true) + th('Pièce', '', true) + th('Hauteur', 'Façade') + th('Larg. entre', 'Plinthes') + th('Larg. haut', 'Façade')
    + th('Longueur', 'Amén.') + th('Prof.', 'Amén.') + th('Côté', 'Penderie') + th('Haut.', 'Plinthe') + th('Sol', '')
    + (socle ? '<th style="background:#B32E2E;color:white;padding:5px 4px;font-size:9px">Socle</th>' : '')
    + '</tr></thead><tbody>' + lignes + '</tbody></table>'
    + (d.commentaires ? '<div style="margin-top:10px;padding:8px;border:1px solid #ccc;white-space:pre-wrap"><b>Commentaires :</b> ' + esc(d.commentaires) + '</div>' : '')
    + '</body></html>';
}

// ── modeles/quitus.js ──
// ═══════════════════════════════════════════════════════════════
// MODÈLE UNIQUE du PDF « Quitus »
// Utilisé tel quel par la page (aperçu, impression sur PC) ET par le serveur (PDF envoyé par mail) :
// apps-script/Modeles.gs est une COPIE générée par « node outils/construire.js » — ne jamais la modifier à la main.
// Règles : tableaux et styles en ligne seulement (le convertisseur PDF de Google ne connaît ni flex ni grid),
// pas de backticks imbriqués, tout texte saisi passe par esc().
// d : données de la fiche (textes bruts ; images déjà contrôlées) ; esc : fonction d'échappement
// ═══════════════════════════════════════════════════════════════
function modele_quitus(d, esc) {
  var chantier = (d.chantier || '—') + (d.precision ? ' — ' + d.precision : '');
  var solde = d.solde || '—';
  var couleur = solde === 'OUI' ? '#196B3B' : solde === 'NON' ? '#B32E2E' : '#6A6460';
  var fond = solde === 'OUI' ? '#E1F2E9' : solde === 'NON' ? '#FAE8E8' : '#F2F0EC';
  var photos = (d.photosBase64 || []).filter(function (p) { return p && p.data; });

  function img(p, hauteur) {
    return '<img src="data:' + (p.mimeType || 'image/jpeg') + ';base64,' + p.data + '" style="max-width:100%;max-height:' + hauteur + ';display:block;margin:0 auto;">'
      + (p.label ? '<div style="font-size:9px;color:#6A6460;margin-top:3px">' + esc(p.label) + '</div>' : '');
  }
  var photosHtml = '';
  if (photos.length === 1) {
    photosHtml = '<div style="margin-top:10px;border:1px solid #D8D4CE;border-radius:5px;overflow:hidden">'
      + '<div style="background:#E1F2E9;padding:5px 10px;border-bottom:1px solid #196B3B;font-size:9px;font-weight:700;color:#196B3B">Photo</div>'
      + '<div style="padding:8px;text-align:center">' + img(photos[0], '100mm') + '</div></div>';
  } else {
    for (var i = 0; i < photos.length; i += 2) {
      var deuxieme = photos[i + 1]
        ? '<td style="width:50%;padding-left:6px;text-align:center">' + img(photos[i + 1], '110mm') + '</td>' : '<td></td>';
      photosHtml += '<div style="page-break-before:always;padding:10px"><table style="width:100%;border-collapse:collapse"><tr>'
        + '<td style="width:50%;padding-right:6px;text-align:center">' + img(photos[i], '110mm') + '</td>' + deuxieme
        + '</tr></table></div>';
    }
  }
  function signature(titre, src) {
    return '<td style="width:50%;padding:0 4px;vertical-align:top">'
      + '<div style="font-size:9px;font-weight:700;text-transform:uppercase;color:#6A6460;margin-bottom:4px">' + titre + '</div>'
      + '<div style="border:1px solid #D8D4CE;border-radius:4px;height:80px;background:#FAFAF8;text-align:center;padding:4px">'
      + (src ? '<img src="' + src + '" style="max-width:100%;max-height:72px;">' : '') + '</div></td>';
  }
  var description = d.description
    ? '<div style="padding:10px 12px;background:#F7F5F1;border:1px solid #D8D4CE;border-radius:5px;margin-bottom:10px">'
      + '<div style="font-size:8px;font-weight:700;text-transform:uppercase;color:#6A6460;margin-bottom:5px">Description de l’intervention</div>'
      + '<div style="font-size:11px;line-height:1.7;white-space:pre-wrap;word-break:break-word;overflow-wrap:break-word">' + esc(d.description) + '</div></div>'
    : '';

  return '<html><head><meta charset="utf-8"><style>@page{size:A4;margin:1.5cm}body{font-family:Arial,sans-serif;font-size:10px;margin:0}*{box-sizing:border-box}</style></head><body>'
    + '<table style="width:100%;border-collapse:collapse;margin-bottom:14px;border-bottom:3px solid #196B3B;padding-bottom:10px"><tr>'
    + '<td style="vertical-align:middle;width:40%"><div style="font-weight:800;font-size:16px;color:#1A2B4A">Loué Menuiserie</div>'
    + '<div style="font-size:9px;color:#6A6460">Menuiserie · Charpente · Agencement</div></td>'
    + '<td style="vertical-align:middle;text-align:center;width:40%"><div style="font-weight:800;font-size:15px;color:#196B3B">QUITUS</div>'
    + '<div style="font-size:11px;color:#6A6460;margin-top:4px">Chantier : <b>' + esc(chantier) + '</b></div>'
    + '<div style="font-size:11px;color:#6A6460">Le ' + esc(d.date || '—') + ' à ' + esc(d.heure || '—') + '</div></td>'
    + '<td style="vertical-align:middle;text-align:right;width:20%"><div style="font-size:9px;color:#6A6460">Client</div>'
    + '<div style="font-size:10px;font-weight:700">' + esc(d.intervenant || '—') + '</div></td>'
    + '</tr></table>'
    + '<div style="padding:10px 12px;background:#E1F2E9;border:1.5px solid #196B3B;border-radius:5px;margin-bottom:10px;font-size:11px"><strong>Client :</strong> ' + esc(d.intervenant || '—') + '</div>'
    + description
    + '<table style="border-collapse:collapse;margin-bottom:12px"><tr><td style="padding:8px 14px;background:' + fond + ';border:1.5px solid ' + couleur + ';border-radius:8px">'
    + '<span style="font-size:11px;font-weight:700;color:' + couleur + '">SOLDÉ : ' + esc(solde) + '</span></td></tr></table>'
    + photosHtml
    + '<table style="width:100%;border-collapse:collapse;margin-top:14px;page-break-inside:avoid"><tr>'
    + signature('Signature Entreprise Loué', d.sigLoue) + signature('Signature Client', d.sigIntervenant)
    + '</tr></table>'
    + '</body></html>';
}
