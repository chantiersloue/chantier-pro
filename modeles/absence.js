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
