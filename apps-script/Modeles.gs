// ═══════════════════════════════════════════════════════════════
// FICHIER GÉNÉRÉ AUTOMATIQUEMENT — NE PAS MODIFIER À LA MAIN
// Copie des modèles de PDF du dossier modeles/ (node outils/construire.js).
// Pour changer un PDF : modifier modeles/<document>.js, relancer la commande, recoller ce fichier.
// ═══════════════════════════════════════════════════════════════

// ── modeles/absence.js ──
// ═══════════════════════════════════════════════════════════════
// MODÈLE UNIQUE du PDF « Demande d'absence »
// Utilisé tel quel par la page (aperçu, impression sur PC) ET par le serveur (PDF envoyé par mail) :
// apps-script/Modeles.gs est une COPIE générée par « node outils/construire.js » — ne jamais la modifier à la main.
// Règles : tableaux et styles en ligne seulement (le convertisseur PDF de Google ne connaît ni flex ni grid),
// pas de backticks imbriqués, tout texte saisi passe par esc().
// d : données de la fiche (textes bruts ; images déjà contrôlées) ; esc : fonction d'échappement
// ═══════════════════════════════════════════════════════════════
function modele_absence(d, esc) {
  var CASE = 'padding:7px 10px;border:1px solid #D8D4CE;';
  var ETIQ = CASE + 'font-weight:700;background:#FAFAF8;font-size:9px;color:#6A6460;text-transform:uppercase;width:38%';
  var TEXTE = 'white-space:pre-wrap;word-break:break-word;overflow-wrap:break-word;';
  var depot = d.dateDepot || '';
  function ligne(titre, valeur, gras) {
    return '<tr><td style="' + ETIQ + '">' + titre + '</td><td style="' + CASE + 'font-size:12px;' + TEXTE + (gras ? 'font-weight:700' : '') + '">'
      + esc(valeur || '—') + '</td></tr>';
  }
  // Case à cocher dessinée par un tableau (le convertisseur PDF ne connaît pas flex)
  function caseACocher(texte) {
    return '<td style="width:16px;height:16px;border:1.5px solid #333333"></td><td style="padding:0 24px 0 8px;font-size:12px">' + texte + '</td>';
  }
  function zoneSignature(titre, contenu, legende, hauteur) {
    return '<td style="width:50%;padding-right:8px;vertical-align:top">'
      + '<div style="font-size:9px;font-weight:700;text-transform:uppercase;color:#6A6460;margin-bottom:4px">' + titre + '</div>'
      + '<div style="border:1px solid #D8D4CE;border-radius:4px;height:' + hauteur + 'px;background:#FAFAF8;text-align:center;padding:4px">' + contenu + '</div>'
      + '<div style="font-size:9px;color:#6A6460;margin-top:3px">' + legende + '</div></td><td style="width:50%"></td>';
  }
  var signature = d.signature ? '<img src="' + d.signature + '" style="max-width:100%;max-height:72px;">' : '';

  return '<html><head><meta charset="utf-8"><style>@page{size:A4;margin:1.5cm}body{font-family:Arial,sans-serif;font-size:10px;margin:0}*{box-sizing:border-box}</style></head><body>'
    + '<table style="width:100%;border-collapse:collapse;margin-bottom:16px;border-bottom:3px solid #B87A00"><tr>'
    + '<td style="vertical-align:middle;width:45%;padding-bottom:10px"><div style="font-weight:800;font-size:16px;color:#1A2B4A">Loué Menuiserie</div>'
    + '<div style="font-size:9px;color:#6A6460">Menuiserie · Charpente · Agencement</div></td>'
    + '<td style="text-align:center;vertical-align:middle;padding-bottom:10px"><div style="font-weight:800;font-size:14px;color:#B87A00">DEMANDE D’ABSENCE</div>'
    + '<div style="font-size:10px;color:#6A6460;margin-top:3px">Déposée le ' + esc(depot || '—') + '</div></td>'
    + '</tr></table>'
    + '<table style="width:100%;border-collapse:collapse;margin-bottom:12px">'
    + ligne('Demandeur', d.nom, true)
    + ligne('Date d’absence', d.dateAbsence)
    + ligne('Durée', d.duree)
    + ligne('Imputation', d.imputation)
    + ligne('Motif', d.motif)
    + (d.precisions ? ligne('Précisions', d.precisions) : '')
    + '</table>'
    + '<div style="padding:8px 12px;background:#FFF3CC;border:1px solid #B87A00;border-radius:4px;font-size:10px;color:#8A5B00;margin-bottom:14px">'
    + 'Les absences seront prises sur votre compteur selon l’imputation choisie.<br>'
    + 'Acceptation selon l’accord de la Direction (voir coupon réponse ci-dessous).</div>'
    + '<table style="width:100%;border-collapse:collapse;margin-bottom:16px;page-break-inside:avoid"><tr>'
    + zoneSignature('Signature du demandeur', signature, 'Fait le ' + esc(depot || '—') + ' à St Mathurin', 80)
    + '</tr></table>'
    + '<div style="border-top:2px dashed #D8D4CE;margin-bottom:14px"></div>'
    + '<div style="page-break-inside:avoid">'
    + '<div style="text-align:center;font-weight:800;font-size:13px;color:#1A2B4A;margin-bottom:14px;letter-spacing:.5px">COUPON RÉPONSE DE LA DIRECTION</div>'
    + '<table style="border-collapse:collapse;margin-bottom:12px"><tr>' + caseACocher('Demande acceptée') + caseACocher('Demande refusée') + '</tr></table>'
    + '<div style="font-size:12px;margin-bottom:16px">Motif du refus : ______________________________________________________</div>'
    + '<table style="width:100%;border-collapse:collapse"><tr>'
    + zoneSignature('Signature de la Direction', '', 'Fait le ________________ à St Mathurin', 70)
    + '</tr></table></div>'
    + '</body></html>';
}

// ── modeles/attestation.js ──
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

  var qualite = d.qualite ? ', en qualité de ' + esc(d.qualite) : '';

  // ── Photos (modeles/mise-en-page.js) : la 1re sous la signature, dans toute la place restante de la page 1,
  // les autres en pleine page (deux par page si elles y gardent leur taille). Hauteur du contenu mesurée dans Chrome :
  // 87,9 mm + 4,94 par ligne d'objet ; contrôle DAS 129,9 + 7,2 par point ; référence 3,7 ; chantier long 4,2 par ligne.
  var estime;
  if (type === 'das') {
    estime = 129.9;
    (d.dasPoints || []).forEach(function (p) { estime += 7.17 + 3.5 * (mep_lignes(p && p.label, 120, 10) - 1); });
    estime += 3.5 * (mep_lignes(d.dasLocalisation, 110, 10) + mep_lignes(d.asservissements, 110, 10) - 2);
  } else estime = 87.9 + 4.94 * mep_lignes(d.objet || '—', 168, 11);
  estime += (d.ref ? 3.7 : 0) + 4.2 * (mep_lignes(chantier, 110, 10) - 1)
    + 5 * (mep_lignes('Je soussigné ' + (d.signataire || '') + (d.qualite ? ', en qualité de ' + d.qualite : '') + ', certifie que :', 175, 12) - 1);
  var zone = mep_zone(d, 210, 297, 15);
  var photosHtml = mep_photos(photos, { largeur: zone.largeur, hauteur: zone.hauteur, reste: mep_reste(zone, estime), estime: estime, esc: esc });
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
    + '<table style="width:100%;border-collapse:collapse;margin-top:14px;page-break-inside:avoid"><tr>'
    + '<td style="width:50%;padding-right:8px;vertical-align:top">'
    + '<div style="font-size:9px;font-weight:700;text-transform:uppercase;color:#6A6460;margin-bottom:4px">Signature</div>'
    + '<div style="border:1px solid #D8D4CE;border-radius:4px;height:80px;background:#FAFAF8;text-align:center;padding:4px">'
    + (d.signature ? '<img src="' + d.signature + '" style="max-width:100%;max-height:72px;">' : '') + '</div>'
    + '<div style="font-size:9px;color:#6A6460;margin-top:3px">' + esc(d.signataire || '') + ' — ' + esc(d.date || '') + '</div>'
    + '</td><td style="width:50%"></td></tr></table>'
    + photosHtml
    + '</body></html>';
}

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
  // Matériaux remis (bordereau matériaux, lot 1 R2) : proposés d'après le Type (onglet « Matériaux bordereau »), modifiables
  var liste = !orga && d.listeMateriaux ? String(d.listeMateriaux).replace(/\s+$/, '') : '';
  var listeHtml = liste ? '<br><span style="font-weight:700">Matériaux remis :</span><br><span style="word-break:break-word;white-space:pre-wrap">' + esc(liste) + '</span>' : '';

  // ── Photos (modeles/mise-en-page.js) : la 1re sous les signatures, dans toute la place restante de la page 1,
  // les autres en pleine page (deux par page si elles y gardent leur taille). Hauteur du contenu mesurée dans Chrome :
  // 72,4 mm ; mention de l'organigramme 22,5 ; chaque ligne de commentaire ou de matériau 5,5 ; ligne du preneur ou
  // du type trop longue : 5,5 par ligne en plus ; chantier long dans l'en-tête : 3 par ligne en plus.
  var estime = 72.4 + (orga ? 22.5 : 0) + 5.53 * ((d.commentaires ? mep_lignes(d.commentaires, 168, 11) : 0) + (liste ? 1 + mep_lignes(liste, 168, 11) : 0))
    + 5.53 * (mep_lignes('déclare par la présente avoir remis en main propre à ' + (d.preneur || '—') + ' (' + (d.fonction || '') + ') — ' + (d.entreprise || '') + ' :', 168, 11) - 1)
    + 5.53 * (mep_lignes((d.nombre || '—') + ' × ' + (d.typeDoc || '—'), 168, 11) - 1)
    + 5.53 * (mep_lignes('Je soussigné(e) ' + (d.soussigne || '—') + ', Entreprise Loué Menuiserie,', 168, 11) - 1)
    + 3 * (mep_lignes('Chantier : ' + (d.chantier || '—'), 70, 10) - 1);
  var zone = mep_zone(d, 210, 297, 15);
  var photosHtml = mep_photos(d.photosBase64, { largeur: zone.largeur, hauteur: zone.hauteur, reste: mep_reste(zone, estime), estime: estime, esc: esc });

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
    + '<strong>' + esc(d.nombre || '—') + ' × ' + esc(d.typeDoc || '—') + '</strong>' + listeHtml + commentaires
    + '</div>'
    + '<table style="width:100%;border-collapse:collapse;margin-top:14px;page-break-inside:avoid"><tr>'
    + signature('Signature Entreprise Loué', d.sigLoue) + signature('Signature Preneur', d.sigPreneur)
    + '</tr></table>'
    + mention
    + photosHtml
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

// ── modeles/fabrication.js ──
// ═══════════════════════════════════════════════════════════════
// MODÈLE UNIQUE du PDF « Fiche de fabrication »
// Utilisé tel quel par la page (aperçu, impression sur PC) ET par le serveur (PDF envoyé par mail) :
// apps-script/Modeles.gs est une COPIE générée par « node outils/construire.js » — ne jamais la modifier à la main.
// Règles : tableaux et styles en ligne seulement, pas de backticks imbriqués, tout texte saisi passe par esc().
// Seule exception : les commentaires mis en forme (gras, couleur, taille), filtrés par une liste blanche ci-dessous.
// ═══════════════════════════════════════════════════════════════
function modele_fabrication(d, esc) {
  // ── Commentaires : on ne garde que gras, italique, souligné, retours à la ligne, couleur et taille ──
  function nettoyerRiche(html) {
    if (typeof html !== 'string') return '';
    return html.split(/(<[^>]*>)/).map(function (morceau) {
      if (morceau.charAt(0) !== '<') return morceau.replace(/</g, '&lt;').replace(/>/g, '&gt;');
      var m = morceau.match(/^<\s*(\/?)\s*([a-zA-Z]+)([^>]*)>$/);
      if (!m) return '';
      var ferme = m[1] === '/', balise = m[2].toLowerCase(), attributs = m[3];
      if (['b', 'strong', 'i', 'em', 'u', 'div', 'p'].indexOf(balise) > -1) return ferme ? '</' + balise + '>' : '<' + balise + '>';
      if (balise === 'br') return ferme ? '' : '<br>';
      if (balise === 'span' || balise === 'font') {
        if (ferme) return '</span>';
        var styles = [];
        var style = (attributs.match(/style\s*=\s*"([^"]*)"/i) || [])[1] || '';
        style.split(';').forEach(function (decl) {
          var i = decl.indexOf(':');
          if (i < 0) return;
          var prop = decl.slice(0, i).trim().toLowerCase(), val = decl.slice(i + 1).trim();
          if (prop === 'color' && /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\))$/i.test(val)) styles.push('color:' + val);
          if (prop === 'font-weight' && /^(bold|bolder|[1-9]00)$/i.test(val)) styles.push('font-weight:' + val);
          if (prop === 'font-size' && /^\d+(\.\d+)?(em|px|%)$/i.test(val)) styles.push('font-size:' + val);
        });
        var couleur = (attributs.match(/color\s*=\s*"?(#[0-9a-f]{3,8})"?/i) || [])[1];
        if (balise === 'font' && couleur) styles.push('color:' + couleur);
        return styles.length ? '<span style="' + styles.join(';') + '">' : '<span>';
      }
      return '';
    }).join('');
  }
  function v(x) { return esc(x === undefined || x === null || x === '' ? '—' : String(x)); }
  var etiquette = 'font-size:7.5px;font-weight:700;text-transform:uppercase;color:#6A6460;margin-bottom:2px';

  // ── En-tête : cartouche de gauche ──
  var serieCell = d.serie
    ? '<div style="font-size:13px;font-weight:800;color:#1A2B4A">' + esc(d.serie) + '</div>'
    : '<div style="width:90px;height:22px;border:1.5px solid #1A2B4A;border-radius:3px;margin-top:2px"></div>';
  var precision = d.delaiPrecision
    ? '<div style="font-size:9.5px;font-weight:600;color:#7A4200;margin-top:2px;white-space:pre-wrap">' + esc(d.delaiPrecision) + '</div>' : '';
  var gauche = '<tr><td style="padding:5px 8px;border-bottom:1px solid #E1DCD6;border-right:1px solid #E1DCD6;width:50%">'
    + '<div style="' + etiquette + '">N° Série</div>' + serieCell + '</td>'
    + '<td style="padding:5px 8px;border-bottom:1px solid #E1DCD6;width:50%"><div style="' + etiquette + '">Date</div>'
    + '<div style="font-size:11px;font-weight:600">' + v(d.date) + '</div></td></tr>'
    + '<tr><td colspan="2" style="padding:5px 8px;border-bottom:1px solid #E1DCD6"><div style="' + etiquette + '">Chantier</div>'
    + '<div style="font-size:12px;font-weight:800;color:#1A2B4A">' + v(d.chantier) + (d.refChantier ? ' / ' + esc(d.refChantier) : '') + '</div></td></tr>'
    + '<tr><td style="padding:5px 8px;border-right:1px solid #E1DCD6;width:50%;vertical-align:top"><div style="' + etiquette + '">Responsable</div>'
    + '<div style="font-size:11px;font-weight:600">' + v(d.auteur) + '</div></td>'
    + '<td style="padding:5px 8px;width:50%;vertical-align:top"><div style="' + etiquette + '">Délai</div>'
    + '<div style="font-size:11px;font-weight:700;color:#9A5600">' + v(d.delai) + '</div>' + precision + '</td></tr>'
    + (d.zone ? '<tr><td colspan="2" style="padding:5px 8px;border-top:1px solid #E1DCD6"><div style="' + etiquette + '">Zone</div>'
      + '<div style="font-size:10px">' + esc(d.zone) + '</div></td></tr>' : '');

  var tempsRows = '';
  for (var t = 0; t < 6; t++) {
    tempsRows += '<tr><td style="padding:5px;border:1px solid #E1DCD6;min-width:65px;height:20px"></td>'
      + '<td style="padding:5px;border:1px solid #E1DCD6;width:52px;height:20px"></td>'
      + '<td style="padding:5px;border:1px solid #E1DCD6;width:52px;height:20px"></td></tr>';
  }
  var thTemps = 'padding:4px 5px;background:#1A2B4A;color:white;font-size:8px';
  var enTete = '<table style="width:100%;border-collapse:collapse;margin-bottom:10px;border-bottom:3px solid #1A2B4A;padding-bottom:8px"><tr>'
    + '<td style="width:340px;vertical-align:top;padding-right:12px"><table style="width:100%;border-collapse:collapse;border:1.5px solid #D8D4CE">' + gauche + '</table></td>'
    + '<td style="vertical-align:top;padding:0 12px">'
    + '<div style="font-weight:800;font-size:15px;color:#1A2B4A">Loué Menuiserie</div>'
    + '<div style="font-size:9px;color:#6A6460;margin-bottom:6px">Menuiserie · Charpente · Agencement</div>'
    + '<div style="font-weight:800;font-size:13px;color:#1A2B4A">FICHE DE FABRICATION</div>'
    + '<div style="margin-top:6px;font-size:10px;color:#6A6460">Chef d’atelier : <b style="color:#141210">' + v(d.chefAtelier) + '</b>'
    + ' &nbsp;·&nbsp; Conducteur : <b style="color:#141210">' + v(d.conducteur) + '</b></div></td>'
    + '<td style="width:185px;vertical-align:top"><div style="font-size:8px;font-weight:700;text-transform:uppercase;color:#6A6460;margin-bottom:3px">Opérateurs / Temps</div>'
    + '<table style="width:100%;border-collapse:collapse;border:1.5px solid #D8D4CE;font-size:9px"><tr>'
    + '<th style="' + thTemps + ';text-align:left">Opérateur</th><th style="' + thTemps + '">Objectif</th><th style="' + thTemps + '">Réalisé</th></tr>'
    + tempsRows + '</table></td>'
    + '</tr></table>';

  // ── Blocs « Divers » et « Bloc porte » (les blocs photo sont regroupés à la fin) ──
  var LIBELLES_PORTE = { complet: 'Bloc porte complet', vantail: 'Vantail seul', huisserie: 'Huisserie seule' };
  function tableauDivers(b) {
    var c = 'padding:4px 6px;border:1px solid #E1DCD6;font-size:10px';
    var trs = b.rows.map(function (r, i) {
      return '<tr style="background:' + (i % 2 === 0 ? '#F7F5F1' : 'white') + '">'
        + '<td style="' + c + ';font-weight:700">' + v(r.repere) + '</td>'
        + '<td style="' + c + ';text-align:center;font-weight:700">' + v(r.qte) + '</td>'
        + '<td style="' + c + ';text-align:center">' + v(r.long) + '</td>'
        + '<td style="' + c + ';text-align:center">' + v(r.larg) + '</td>'
        + '<td style="' + c + ';text-align:center">' + v(r.haut) + '</td>'
        + '<td style="' + c + ';text-align:center">' + v(r.section) + '</td>'
        + '<td style="' + c + '">' + v(r.materiau) + '</td>'
        + '<td style="' + c + '">' + v(r.finition) + '</td>'
        + '<td style="' + c + '">' + v(r.quincaillerie) + '</td>'
        + '<td style="' + c + ';font-size:9px">' + esc(r.observations || '') + '</td></tr>';
    }).join('');
    function th(fond, texte, attr) { return '<th ' + (attr || '') + ' style="padding:5px 6px;background:' + fond + ';color:white;font-size:9px">' + texte + '</th>'; }
    return '<table style="width:100%;border-collapse:collapse"><thead><tr>'
      + th('#1A2B4A', 'Rep.', 'rowspan="2"') + th('#1A2B4A', 'Qté', 'rowspan="2"') + th('#203A6D', 'DIMENSIONS (mm)', 'colspan="3"')
      + th('#203A6D', 'Section', 'rowspan="2"') + th('#2A5A3A', 'Matériau', 'rowspan="2"') + th('#6B3FA0', 'Finition', 'rowspan="2"')
      + th('#6B3FA0', 'Quincaillerie', 'rowspan="2"') + th('#1A2B4A', 'Observations', 'rowspan="2"')
      + '</tr><tr>' + th('#2A4A8A', 'Long.') + th('#2A4A8A', 'Larg.') + th('#2A4A8A', 'Ép.') + '</tr></thead><tbody>' + trs + '</tbody></table>';
  }
  function tableauPorte(b) {
    var isV = b.porteType === 'vantail' || b.porteType === 'complet';
    var isH = b.porteType === 'huisserie' || b.porteType === 'complet';
    var isHS = b.porteType === 'huisserie';   // huisserie seule : cotes du vantail à recevoir + talon
    var sv = 'padding:4px 5px;background:#2A4A8A;color:white;font-size:8.5px';
    var sh = 'padding:4px 5px;background:#3A7A4A;color:white;font-size:8.5px';
    var sc = 'padding:4px 5px;background:#4A2A7A;color:white;font-size:8.5px';
    var c = 'padding:4px 5px;border:1px solid #E1DCD6;font-size:9.5px';
    var th1 = (isV ? '<th colspan="4" style="padding:5px;background:#203A6D;color:white;font-size:9px">VANTAIL</th>' : '')
      + (isH ? '<th colspan="' + (isHS ? 8 : 5) + '" style="padding:5px;background:#2A5A3A;color:white;font-size:9px">HUISSERIE</th>' : '')
      + '<th colspan="3" style="padding:5px;background:#4A2A7A;color:white;font-size:9px">FERRAGE / SERRURE</th>';
    var th2 = (isV ? '<th style="' + sv + '">Haut.</th><th style="' + sv + '">Larg.</th><th style="' + sv + '">Sens</th><th style="' + sv + '">Nature</th>' : '')
      + (isHS ? '<th style="' + sh + '">Haut. vantail</th><th style="' + sh + '">Larg. vantail</th><th style="' + sh + '">Talon</th>' : '')
      + (isH ? '<th style="' + sh + '">Support</th><th style="' + sh + '">Ép.</th><th style="' + sh + '">Sens</th><th style="' + sh + '">Feuillure</th><th style="' + sh + '">Rainure</th>' : '')
      + '<th style="' + sc + '">Ferrage</th><th style="' + sc + '">QT</th><th style="' + sc + '">Serrure</th>';
    var trs = b.rows.map(function (r, i) {
      var centre = c + ';text-align:center';
      return '<tr style="background:' + (i % 2 === 0 ? '#F7F5F1' : 'white') + '">'
        + '<td style="' + c + ';font-weight:700">' + v(r.repere) + '</td>'
        + '<td style="' + centre + ';font-weight:700">' + v(r.qt || r.qte) + '</td>'
        + (isV ? '<td style="' + centre + '">' + v(r.haut) + '</td><td style="' + centre + '">' + v(r.larg) + '</td><td style="' + c + '">' + v(r.sens) + '</td><td style="' + c + '">' + v(r.nature) + '</td>' : '')
        + (isHS ? '<td style="' + centre + '">' + v(r.hautVantail) + '</td><td style="' + centre + '">' + v(r.largVantail) + '</td><td style="' + centre + '">' + v(r.talon) + '</td>' : '')
        + (isH ? '<td style="' + c + '">' + v(r.support) + '</td><td style="' + centre + '">' + v(r.epSupport) + '</td><td style="' + c + '">' + v(r.sensH || r.sens)
          + '</td><td style="' + c + '">' + v(r.feuillure) + '</td><td style="' + centre + '">' + v(r.rainure) + '</td>' : '')
        + '<td style="' + c + '">' + v(r.ferrageType) + '</td><td style="' + centre + '">' + v(r.ferrageQt) + '</td><td style="' + c + '">' + v(r.serrure) + '</td>'
        + '</tr>';
    }).join('');
    return '<table style="width:100%;border-collapse:collapse"><thead><tr>'
      + '<th rowspan="2" style="padding:5px;background:#7A4200;color:white;font-size:9px;text-align:left">Rep.</th>'
      + '<th rowspan="2" style="padding:5px;background:#7A4200;color:white;font-size:9px">QT</th>'
      + th1 + '</tr><tr>' + th2 + '</tr></thead><tbody>' + trs + '</tbody></table>';
  }
  var blocsHtml = (d.blocs || []).map(function (b) {
    if (b.type === 'photo') return '';
    var porte = b.type === 'porte';
    var label = porte ? (LIBELLES_PORTE[b.porteType] || 'Bloc porte') : 'Divers';
    var clr = porte ? '#7A4200' : '#1A2B4A', clrBg = porte ? '#FDF0D6' : '#EBF1FA';
    var rows = b.rows || [];
    var inner = rows.length ? (porte ? tableauPorte(b) : tableauDivers(b)) : '<div style="padding:8px;color:#999;font-size:10px;font-style:italic">Bloc vide</div>';
    return '<div style="margin-bottom:12px;border:1.5px solid ' + clr + ';border-radius:5px;overflow:hidden;page-break-inside:avoid">'
      + '<div style="background:' + clrBg + ';padding:6px 10px;border-bottom:1px solid ' + clr + '">'
      + '<span style="font-weight:700;font-size:10px;color:' + clr + ';text-transform:uppercase;letter-spacing:.4px">' + label + ' — Bloc ' + esc(b.id) + '</span></div>'
      + '<div>' + inner + '</div></div>';
  }).join('');

  var commentaires = nettoyerRiche(d.commentaires);
  var commentaireSection = commentaires.replace(/<[^>]*>|&nbsp;|\s/g, '')
    ? '<div style="margin-top:10px;padding:8px 10px;background:#F7F5F1;border:1px solid #D8D4CE;border-radius:4px">'
      + '<div style="font-size:8.5px;font-weight:700;text-transform:uppercase;color:#6A6460;margin-bottom:3px">Commentaires</div>'
      + '<div style="font-size:10px;line-height:1.5">' + commentaires + '</div></div>'
    : '';

  // ── Photos et croquis (modeles/mise-en-page.js) : la 1re photo sous les blocs, en page 1, dans toute la place
  // restante ; chaque croquis sur une page entière ; les autres photos en pleine page (ou deux par page) ──
  // Hauteur estimée du contenu de la page 1 (mm), mesurée dans Chrome : en-tête 44 (tableau des temps), ou le cartouche
  // de gauche + 4 s'il est plus haut (31,2 ; chantier : 4,5 par ligne en plus ; zone 8,8 + 2,9 par ligne en plus ;
  // précision du délai 3,5 + 3,1 par ligne en plus) ; bloc 26 (porte 25,7) + 5,3 par ligne en plus ; bloc vide 17,2 ;
  // commentaires 8,2 + 1,5 × la taille de la police par ligne (4 mm en taille normale, 5,6 « agrandi »).
  // Les blocs ne se coupent pas d'une page à l'autre.
  var cartouche = 31.2 + 4.5 * (mep_lignes(String(d.chantier || '—') + (d.refChantier ? ' / ' + d.refChantier : ''), 68, 12) - 1)
    + (d.zone ? 8.8 + 2.9 * (mep_lignes(d.zone, 84, 10) - 1) : 0)
    + (d.delaiPrecision ? 3.5 + 3.1 * (mep_lignes(d.delaiPrecision, 40, 10) - 1) : 0);
  var estime = Math.max(44, cartouche + 4);
  (d.blocs || []).forEach(function (b) {
    if (b.type === 'photo') return;
    var rows = b.rows || [];
    if (!rows.length) { estime += 17.2; return; }
    estime += (b.type === 'porte' ? 25.7 : 26.2) + 5.3 * (rows.length - 1);
    rows.forEach(function (r) {   // texte long dans une case : lignes en plus
      var plusLong = 0;
      Object.keys(r).forEach(function (k) { if (typeof r[k] === 'string' || typeof r[k] === 'number') plusLong = Math.max(plusLong, String(r[k]).length); });
      if (plusLong > 40) estime += 3.4 * Math.ceil((plusLong - 40) / 40);
    });
  });
  if (commentaireSection) {
    estime += 8.2;
    // Le champ éditable du téléphone écrit « Ligne 1<div>Ligne 2</div><div><br></div>… » : chaque <div>/<p> ouvre une
    // ligne, un <br> seul dans un bloc est une ligne vide (comptée : elle prend sa place à l'écran)
    String(commentaires).replace(/<br\s*\/?>\s*(<\/div>|<\/p>)/gi, '$1').replace(/<(div|p)\b[^>]*>/gi, '\n')
      .replace(/<br\s*\/?>/gi, '\n').replace(/<\/(div|p)>/gi, '').replace(/^\n/, '').replace(/\n+$/, '').split('\n').forEach(function (ligne) {
      var tailles = [10];   // taille de police la plus grande de la ligne (px), « agrandi » = 1,4 em
      (ligne.match(/font-size:\s*[\d.]+(em|px|%)/gi) || []).forEach(function (t) {
        var n = parseFloat(t.replace(/font-size:\s*/i, ''));
        tailles.push(/em/i.test(t) ? n * 10 : /%/.test(t) ? n / 10 : n);
      });
      var px = Math.min(40, Math.max.apply(null, tailles));
      estime += mep_lignes(mep_texteBrut(ligne), 260, px) * px * 1.5 * MEP_PX_MM;
    });
  }
  var zone = mep_zone(d, 297, 210, 10);
  var photosSection = mep_photos(d.photosBase64, { largeur: zone.largeur, hauteur: zone.hauteur, reste: mep_reste(zone, estime), estime: estime, esc: esc,
    pagesContenu: mep_pages(zone, estime), croquisParLegende: true });

  return '<html><head><meta charset="utf-8"><style>@page{size:landscape;margin:1cm}body{font-family:Arial,sans-serif;font-size:10px;margin:0}*{box-sizing:border-box}</style></head><body>'
    + enTete + blocsHtml + commentaireSection + photosSection
    + '</body></html>';
}

// ── modeles/mise-en-page.js ──
// ═══════════════════════════════════════════════════════════════
// MISE EN PAGE COMMUNE des photos et croquis dans les PDF (retouche R1 du lot 1)
// Utilisée par tous les modèles de modeles/ : par la page (aperçu, impression sur PC) ET par le serveur
// (apps-script/Modeles.gs en est une COPIE générée par « node outils/construire.js »).
// Le PDF du serveur est fabriqué sans JavaScript : tout est calculé ici, en millimètres.
// Règles :
//  1. la première photo se place sous le contenu de la page 1 et prend toute la place restante
//     (s'il reste trop peu de place, elle part sur une page à elle) ;
//  2. un croquis (image PNG dessinée dans l'appli) a toujours une page entière ;
//  3. les autres photos : une par page, ou deux si elles y gardent presque leur taille (90 % de leurs côtés).
// Les tailles sont calculées à partir de la taille réelle de l'image (lue dans ses premiers octets) :
// une petite image est AGRANDIE (max-width / max-height ne le font jamais).
// ═══════════════════════════════════════════════════════════════
var MEP_PX_MM = 25.4 / 96;          // 1 pixel CSS = 0,2646 mm
var MEP_LEGENDE_MM = 6;             // place d'une légende sous la photo
var MEP_ECART_MM = 4;               // espace entre deux photos d'une même page
var MEP_MIN_PAGE1_MM = 60;          // en dessous, la première photo ne reste pas en page 1
var MEP_PAIRE = 0.8;                // deux photos par page seulement si chacune garde 80 % de sa surface seule (90 % de ses côtés)
var MEP_MARGE_PAGE_MM = 8;          // place gardée libre sur une page de photos (moteur PDF de Google pas mesuré)

// Largeur et hauteur (pixels) d'une image en base64, lues dans ses premiers octets ; null si inconnues
function mep_taille(p) {
  if (p && p.mepTaille !== undefined) return p.mepTaille;   // déjà lue (une photo est mesurée plusieurs fois)
  var t = mep_lireTaille(p);
  try { if (p) p.mepTaille = t; } catch (e) {}
  return t;
}
function mep_lireTaille(p) {
  var b64 = p && typeof p.data === 'string' ? p.data.replace(/\s/g, '') : '';
  if (!b64) return null;
  var ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  // Décode seulement le début (un JPEG produit par l'appli a sa taille dans les 1 000 premiers octets)
  function octets(n) {
    var sortie = [], tampon = 0, bits = 0, fin = Math.min(b64.length, Math.ceil(n / 3) * 4);
    for (var i = 0; i < fin; i++) {
      var c = b64.charAt(i);
      if (c === '=') break;
      var v = ALPHA.indexOf(c);
      if (v < 0) return sortie;
      tampon = (tampon << 6) | v; bits += 6;
      if (bits >= 8) { bits -= 8; sortie.push((tampon >> bits) & 255); }
    }
    return sortie;
  }
  var o = octets(24);
  if (o.length >= 24 && o[0] === 0x89 && o[1] === 0x50 && o[2] === 0x4E && o[3] === 0x47) {   // PNG : bloc IHDR
    var w = ((o[16] << 24) | (o[17] << 16) | (o[18] << 8) | o[19]) >>> 0;
    var h = ((o[20] << 24) | (o[21] << 16) | (o[22] << 8) | o[23]) >>> 0;
    return w && h ? { w: w, h: h } : null;
  }
  if (o.length >= 4 && o[0] === 0xFF && o[1] === 0xD8) {                                       // JPEG : marqueur SOF
    o = octets(65536);
    var i = 2;
    while (i + 9 < o.length) {
      if (o[i] !== 0xFF) { i++; continue; }
      var m = o[i + 1];
      if (m === 0xFF) { i++; continue; }
      if (m === 0xD8 || m === 0x01 || (m >= 0xD0 && m <= 0xD7)) { i += 2; continue; }
      var long = (o[i + 2] << 8) | o[i + 3];
      if (m >= 0xC0 && m <= 0xCF && m !== 0xC4 && m !== 0xC8 && m !== 0xCC) {
        var hj = (o[i + 5] << 8) | o[i + 6], wj = (o[i + 7] << 8) | o[i + 8];
        return wj && hj ? { w: wj, h: hj } : null;
      }
      if (m === 0xDA || long < 2) return null;   // début de l'image sans taille trouvée
      i += 2 + long;
    }
  }
  return null;
}

// Croquis = image PNG (croquis dessiné dans l'appli ; les photos sont toujours en JPEG) ou photo dont la légende
// contient « croquis » (photo d'un croquis sur papier)
// (la légende ne compte que pour la fiche de fabrication : option croquisParLegende de mep_photos)
function mep_estCroquis(p, parLegende) {
  return !!(p && (p.croquis === true || /png/i.test(p.mimeType || p.mime || '') || (parLegende && /croquis/i.test(p.label || ''))));
}

// Taille (mm) d'une image qui tient dans une boîte l * h en gardant ses proportions ; null si taille inconnue
function mep_ajuster(p, l, h) {
  var t = mep_taille(p);
  if (!t) return null;
  var r = Math.min(l / t.w, h / t.h);
  return { l: Math.floor(t.w * r * 10) / 10, h: Math.floor(t.h * r * 10) / 10 };
}

// Balise <img> d'une photo qui tient dans une boîte l * h (mm), avec sa légende.
// Seule la LARGEUR est imposée (hauteur automatique) : les proportions sont toujours gardées, et
// max-width:100% évite tout débordement dans l'aperçu d'un petit écran.
function mep_image(p, l, h, esc) {
  var src = 'data:' + (p.mimeType || p.mime || 'image/jpeg') + ';base64,' + p.data;
  var t = mep_ajuster(p, l, h);
  var style = t ? 'width:' + t.l + 'mm;max-width:100%;height:auto'
                : 'max-width:100%;max-height:' + Math.floor(h) + 'mm;width:auto;height:auto';
  return '<img src="' + src + '" style="' + style + ';display:block;margin:0 auto;border:1px solid #ddd">'
    + (p.label ? '<div style="font-size:9px;color:#666;margin-top:2px;text-align:center">' + esc(p.label) + '</div>' : '');
}

// Surface (mm²) qu'occupe une photo dans une boîte : sert à décider si deux photos partagent une page
function mep_surface(p, l, h) {
  var t = mep_ajuster(p, l, h);
  return t ? t.l * t.h : 0;
}

// Tout le bloc « photos » d'un document.
// photos : [{ data, mimeType, label, croquis? }] ; o : {
//   largeur, hauteur : zone utile d'une page (mm, sans les marges),
//   reste            : place libre (mm) sous le contenu de la page 1 (0 ou moins = la page 1 est pleine),
//   estime           : hauteur estimée du contenu de la page 1 (mm), notée dans le document (contrôles),
//   esc              : fonction d'échappement,
//   titre(i, n)      : (facultatif) titre affiché en haut de chaque page de photos,
//   page1Titre       : (facultatif) titre au-dessus de la photo de la page 1,
//   pagesContenu     : (facultatif) nombre de pages estimé du contenu (contrôle du serveur), 1 par défaut,
//   croquisParLegende: (facultatif) une photo dont la légende contient « croquis » est un croquis }
function mep_photos(photos, o) {
  photos = (photos || []).filter(function (p) { return p && p.data; });
  if (!photos.length) return '';
  var esc = o.esc, L = o.largeur, H = o.hauteur;
  var titreH = o.titre ? 9 : 0;                         // hauteur du titre d'une page de photos
  // Repère invisible pour le contrôle du serveur : nombre de pages du contenu avant les photos
  var html = '<div data-mep-contenu="' + Math.max(1, Math.round(o.pagesContenu || 1)) + '" style="display:none"></div>';
  var reste = photos.slice();
  var croquis = function (p) { return mep_estCroquis(p, o.croquisParLegende); };

  // 1. Première photo (pas un croquis) sous le contenu de la page 1
  var place = (o.reste || 0) - (o.page1Titre ? 9 : 0) - 3;
  var premiere = -1;
  for (var i = 0; i < reste.length; i++) if (!croquis(reste[i])) { premiere = i; break; }
  if (premiere > -1 && place >= MEP_MIN_PAGE1_MM) {
    var p0 = reste.splice(premiere, 1)[0];
    var h0 = place - (p0.label ? MEP_LEGENDE_MM : 0);
    html += '<div data-mep="page1" data-estime="' + Math.round(o.estime || 0) + '" style="margin-top:3mm;page-break-inside:avoid">' + (o.page1Titre || '') + mep_image(p0, L, h0, esc) + '</div>';
  }

  // 2 et 3. Pages de photos : croquis seul, photos par une ou par deux
  var hPage = H - titreH - MEP_MARGE_PAGE_MM;
  var pages = [];
  while (reste.length) {
    var a = reste.shift();
    var hA = hPage - (a.label ? MEP_LEGENDE_MM : 0);
    if (!croquis(a) && reste.length && !croquis(reste[0])) {
      var b = reste[0];
      // Deux photos : l'une sous l'autre (page debout) ou côte à côte (page couchée)
      var debout = H >= L;
      var lD = debout ? L : (L - MEP_ECART_MM) / 2;
      var hD = debout ? (hPage - MEP_ECART_MM) / 2 : hPage;
      var hDa = hD - (a.label ? MEP_LEGENDE_MM : 0), hDb = hD - (b.label ? MEP_LEGENDE_MM : 0);
      var seuleA = mep_surface(a, L, hA), seuleB = mep_surface(b, L, hPage - (b.label ? MEP_LEGENDE_MM : 0));
      if (seuleA && seuleB && mep_surface(a, lD, hDa) >= MEP_PAIRE * seuleA && mep_surface(b, lD, hDb) >= MEP_PAIRE * seuleB) {
        reste.shift();
        pages.push(debout
          ? mep_image(a, lD, hDa, esc) + '<div style="height:' + MEP_ECART_MM + 'mm"></div>' + mep_image(b, lD, hDb, esc)
          : '<table style="width:100%;border-collapse:collapse"><tr>'
            + '<td style="width:50%;vertical-align:top;text-align:center;padding:0">' + mep_image(a, lD, hDa, esc) + '</td>'
            + '<td style="width:50%;vertical-align:top;text-align:center;padding:0">' + mep_image(b, lD, hDb, esc) + '</td></tr></table>');
        continue;
      }
    }
    pages.push(mep_image(a, L, hA, esc));
  }
  pages.forEach(function (contenu, n) {
    html += '<div data-mep="photos" style="page-break-before:always;page-break-inside:avoid">'
      + (o.titre ? o.titre(n, pages.length) : '') + contenu + '</div>';
  });
  return html;
}

// Nombre de lignes d'un texte dans une largeur (mm) pour une taille de police (px) — estimation prudente (Arial)
function mep_lignes(texte, largeurMm, policePx) {
  var parLigne = Math.max(1, Math.floor(largeurMm / (policePx * MEP_PX_MM * 0.56)));
  return String(texte === undefined || texte === null ? '' : texte).split('\n').reduce(function (n, l) {
    return n + Math.max(1, Math.ceil(l.length / parLigne));
  }, 0);
}
// Hauteur (mm) d'un texte : lignes × police × interligne
function mep_hauteurTexte(texte, largeurMm, policePx, interligne) {
  return mep_lignes(texte, largeurMm, policePx) * policePx * (interligne || 1.2) * MEP_PX_MM;
}

// Zone utile d'une page (mm) : format prévu par le modèle, ou format réel du PDF mesuré par le serveur
// (d._mepFormat = { l, h } en mm) quand le premier PDF a débordé ; d._mepSansPage1 : photo de la page 1 interdite.
function mep_zone(d, l, h, marge) {
  var f = d && d._mepFormat;
  var paysage = l > h;
  if (f && f.l > 50 && f.h > 50) { l = paysage ? Math.max(f.l, f.h) : Math.min(f.l, f.h); h = paysage ? Math.min(f.l, f.h) : Math.max(f.l, f.h); }
  // d._mepMargeEnPlus : le serveur a trouvé une page de trop → pages de photos un peu moins hautes
  var enPlus = d && d._mepMargeEnPlus > 0 ? Math.min(40, Number(d._mepMargeEnPlus)) : 0;
  // hauteurContenu : sans la marge en plus (sert seulement à compter les pages du contenu)
  return { largeur: l - 2 * marge, hauteur: h - 2 * marge - enPlus, hauteurContenu: h - 2 * marge, sansPage1: !!(d && d._mepSansPage1) };
}
// Nombre de pages estimé d'un contenu (contrôle du serveur)
function mep_pages(zone, estime) { return Math.max(1, Math.ceil((estime || 0) / (zone.hauteurContenu || zone.hauteur))); }
// Place libre sous un contenu estimé (marge de sécurité de 6 mm), 0 si le contenu ne tient pas sur la page 1
function mep_reste(zone, estime) {
  if (zone.sansPage1) return 0;
  var reste = zone.hauteur - estime - 6;
  return reste > 0 ? reste : 0;
}
// Texte d'un champ mis en forme (commentaires de la fabrication) : retours à la ligne gardés, balises retirées
function mep_texteBrut(html) {
  return String(html || '').replace(/<br\s*\/?>|<\/(div|p)>/gi, '\n').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ')
    .replace(/&[a-z]+;|&#\d+;/gi, 'x').replace(/\n+$/, '');
}

// ── modeles/note.js ──
// ═══════════════════════════════════════════════════════════════
// MODÈLE UNIQUE du PDF « Note de réunion »
// Utilisé tel quel par la page (aperçu, impression sur PC) ET par le serveur (PDF envoyé par mail) :
// apps-script/Modeles.gs est une COPIE générée par « node outils/construire.js » — ne jamais la modifier à la main.
// Règles : tableaux et styles en ligne seulement (le convertisseur PDF de Google ne connaît ni flex ni grid),
// pas de backticks imbriqués, tout texte saisi passe par esc().
// d : données de la fiche (textes bruts ; images déjà contrôlées) ; esc : fonction d'échappement
// ═══════════════════════════════════════════════════════════════
function modele_note(d, esc) {
  var TEXTE = 'white-space:pre-wrap;word-break:break-word;overflow-wrap:break-word;';
  var ETIQ = 'font-size:7.5px;font-weight:700;text-transform:uppercase;color:#6A6460;margin-bottom:2px';


  var commentaires = d.commentaires
    ? '<div style="padding:10px 12px;background:#F0F5F4;border:1.5px solid #0D7A6B;border-radius:5px;margin-bottom:10px">'
      + '<div style="font-size:8px;font-weight:700;text-transform:uppercase;color:#0D7A6B;margin-bottom:6px;letter-spacing:.5px">Notes &amp; commentaires</div>'
      + '<div style="font-size:11px;line-height:1.7;' + TEXTE + '">' + esc(d.commentaires) + '</div></div>'
    : '';

  // ── Photos (modeles/mise-en-page.js) : la 1re sous les notes si elles tiennent sur la page 1, dans toute la place
  // restante ; les autres en pleine page (deux par page si elles y gardent leur taille). Hauteur mesurée dans Chrome :
  // en-tête 36 mm (chantier long : 4,5 par ligne en plus, rédacteur : 3,2 ; objet long : 4,2) ; notes 12,5 + 4,94 par ligne.
  var estime = 36 + Math.max(4.5 * (mep_lignes(d.chantier || '—', 35, 12) - 1) + 3.2 * (mep_lignes(d.auteur || '—', 39, 11) - 1),
    4.2 * (d.objet ? mep_lignes(d.objet, 100, 11) - 1 : 0))
    + (d.commentaires ? 12.5 + 4.94 * mep_lignes(d.commentaires, 168, 11) : 0);
  var zone = mep_zone(d, 210, 297, 15);
  var photosHtml = mep_photos(d.photosBase64, { largeur: zone.largeur, hauteur: zone.hauteur, reste: mep_reste(zone, estime), estime: estime, esc: esc,
    pagesContenu: mep_pages(zone, estime) });

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

  // ── Photos (modeles/mise-en-page.js) : la 1re sous les signatures, dans toute la place restante de la page 1,
  // les autres en pleine page (deux par page si elles y gardent leur taille). Hauteur du contenu mesurée dans Chrome :
  // 66,4 mm sans description ; description 12,2 + 5 mm par ligne ; chantier long : 4,2 mm par ligne en plus.
  var estime = 66.4 + (d.description ? 12.2 + 4.95 * mep_lignes(d.description, 168, 11) : 0)
    + 4.2 * (mep_lignes(chantier, 70, 11) - 1);
  var zone = mep_zone(d, 210, 297, 15);
  var photosHtml = mep_photos(d.photosBase64, { largeur: zone.largeur, hauteur: zone.hauteur, reste: mep_reste(zone, estime), estime: estime, esc: esc });

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
    + '<table style="width:100%;border-collapse:collapse;margin-top:14px;page-break-inside:avoid"><tr>'
    + signature('Signature Entreprise Loué', d.sigLoue) + signature('Signature Client', d.sigIntervenant)
    + '</tr></table>'
    + photosHtml
    + '</body></html>';
}

// ── modeles/reception.js ──
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

  // Photos de chaque point (modeles/mise-en-page.js) : pages à part, titre du point en haut de chaque page,
  // chaque photo en pleine page (deux par page si elles y gardent leur taille)
  var zone = mep_zone(d, 210, 297, 15);
  // Pages du contenu (contrôle du serveur) : estimation basse (en-tête et signature 60 mm, 7 mm par point)
  var pagesContenu = mep_pages(zone, 60 + 7 * points.length);
  var photosHtml = points.map(function (p, n) {
    var titre = function (n, total) {
      return '<div style="font-weight:700;font-size:11px;color:#0D7A6B;border-bottom:2px solid #0D7A6B;padding-bottom:4px;margin-bottom:2mm;height:7mm;overflow:hidden">'
        + 'Photos — ' + esc(p.label || '') + (total > 1 ? ' (' + (n + 1) + '/' + total + ')' : '') + '</div>';
    };
    return mep_photos(p.photos, { largeur: zone.largeur, hauteur: zone.hauteur, reste: 0, esc: esc, titre: titre, pagesContenu: pagesContenu });
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

// ── modeles/signalement.js ──
// ═══════════════════════════════════════════════════════════════
// MODÈLE du PDF « Signalement » (casse / manquant / à recommander) — lot 7
// Utilisé par le serveur (PDF joint au mail et rangé dans le dossier du chantier) :
// apps-script/Modeles.gs est une COPIE générée par « node outils/construire.js » — ne jamais la modifier à la main.
// Règles : tableaux et styles en ligne seulement (le convertisseur PDF de Google ne connaît ni flex ni grid),
// pas de backticks imbriqués, tout texte saisi passe par esc().
// d : données du signalement (textes bruts ; images déjà contrôlées), plus d.auteur (nom donné par le serveur) ;
// esc : fonction d'échappement
// ═══════════════════════════════════════════════════════════════
function modele_signalement(d, esc) {
  var urgent = d.urgence === 'Bloquant';
  var couleur = urgent ? '#B32E2E' : '#1A2B4A';
  var fond = urgent ? '#FAE8E8' : '#E8EDF5';
  function bloc(titre, texte) {
    if (!texte) return '';
    return '<div style="padding:10px 12px;background:#F7F5F1;border:1px solid #D8D4CE;border-radius:5px;margin-bottom:10px">'
      + '<div style="font-size:8px;font-weight:700;text-transform:uppercase;color:#6A6460;margin-bottom:5px">' + titre + '</div>'
      + '<div style="font-size:11px;line-height:1.7;white-space:pre-wrap;word-break:break-word;overflow-wrap:break-word">' + esc(texte) + '</div></div>';
  }
  // ── Photos (modeles/mise-en-page.js) : la 1re dans la place restante de la page 1, les autres en pleine page.
  // Hauteur du contenu estimée comme le quitus : en-tête et bandeaux 62 mm ; chaque bloc de texte 12,2 mm + 5 mm par ligne.
  var estime = 62
    + (d.repere ? 12.2 + 4.95 * mep_lignes(d.repere, 168, 11) : 0)
    + (d.commentaire ? 12.2 + 4.95 * mep_lignes(d.commentaire, 168, 11) : 0)
    + 4.2 * (mep_lignes(d.chantier || '—', 70, 11) - 1);
  var zone = mep_zone(d, 210, 297, 15);
  var photosHtml = mep_photos(d.photosBase64, { largeur: zone.largeur, hauteur: zone.hauteur, reste: mep_reste(zone, estime), estime: estime, esc: esc });

  return '<html><head><meta charset="utf-8"><style>@page{size:A4;margin:1.5cm}body{font-family:Arial,sans-serif;font-size:10px;margin:0}*{box-sizing:border-box}</style></head><body>'
    + '<table style="width:100%;border-collapse:collapse;margin-bottom:14px;border-bottom:3px solid ' + couleur + ';padding-bottom:10px"><tr>'
    + '<td style="vertical-align:middle;width:40%"><div style="font-weight:800;font-size:16px;color:#1A2B4A">Loué Menuiserie</div>'
    + '<div style="font-size:9px;color:#6A6460">Menuiserie · Charpente · Agencement</div></td>'
    + '<td style="vertical-align:middle;text-align:center;width:40%"><div style="font-weight:800;font-size:15px;color:' + couleur + '">SIGNALEMENT</div>'
    + '<div style="font-size:11px;color:#6A6460;margin-top:4px">Chantier : <b>' + esc(d.chantier || '—') + '</b></div>'
    + '<div style="font-size:11px;color:#6A6460">Le ' + esc(d.date || '—') + ' à ' + esc(d.heure || '—') + '</div></td>'
    + '<td style="vertical-align:middle;text-align:right;width:20%"><div style="font-size:9px;color:#6A6460">Signalé par</div>'
    + '<div style="font-size:10px;font-weight:700">' + esc(d.auteur || '—') + '</div></td>'
    + '</tr></table>'
    + '<table style="width:100%;border-collapse:collapse;margin-bottom:12px"><tr>'
    + '<td style="padding:10px 14px;background:#E8EDF5;border:1.5px solid #1A2B4A;border-radius:8px;width:50%">'
    + '<div style="font-size:8px;font-weight:700;text-transform:uppercase;color:#6A6460">Type</div>'
    + '<div style="font-size:14px;font-weight:800;color:#1A2B4A">' + esc(d.type || '—') + '</div></td>'
    + '<td style="width:8px"></td>'
    + '<td style="padding:10px 14px;background:' + fond + ';border:1.5px solid ' + couleur + ';border-radius:8px;width:50%">'
    + '<div style="font-size:8px;font-weight:700;text-transform:uppercase;color:#6A6460">Urgence</div>'
    + '<div style="font-size:14px;font-weight:800;color:' + couleur + '">' + esc(d.urgence || '—') + '</div></td>'
    + '</tr></table>'
    + bloc('Repère', d.repere)
    + bloc('Commentaire', d.commentaire)
    + '<div style="font-size:10px;color:#6A6460;margin-bottom:6px">Atelier prévenu : <b>' + (d.atelier === true ? 'oui' : 'non') + '</b></div>'
    + photosHtml
    + '</body></html>';
}
