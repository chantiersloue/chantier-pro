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
