// ═══════════════════════════════════════════════════════════════
// MODÈLE UNIQUE du PDF « Note de réunion »
// Utilisé tel quel par la page (aperçu, impression sur PC) ET par le serveur (PDF envoyé par mail) :
// apps-script/Modeles.gs est une COPIE générée par « node outils/construire.js » — ne jamais la modifier à la main.
// Règles : tableaux et styles en ligne seulement (le convertisseur PDF de Google ne connaît ni flex ni grid),
// pas de backticks imbriqués, tout texte saisi passe par esc().
// d : données de la fiche (textes bruts ; images déjà contrôlées) ; esc : fonction d'échappement
// Lot 8c : d.points = [{ t: texte, etat: 'ouvert' | 'clos', mention: « ouvert depuis le 23/10/2026 », … }], dans l'ordre de
// la note (écrit par le serveur pour le PDF, par la page pour l'aperçu) ; d.remarqueCR = ligne en tête
// (« Rédigé sans connaître le compte rendu du 07/11/2026 »). Une note sans point s'imprime comme avant le lot 8.
// ═══════════════════════════════════════════════════════════════
function modele_note(d, esc) {
  var TEXTE = 'white-space:pre-wrap;word-break:break-word;overflow-wrap:break-word;';
  var ETIQ = 'font-size:7.5px;font-weight:700;text-transform:uppercase;color:#6A6460;margin-bottom:2px';
  var texteDe = function (v) { return typeof v === 'string' ? v : ''; };

  // ── Points de la note ──
  var points = (Object.prototype.toString.call(d.points) === '[object Array]' ? d.points : [])
    .filter(function (p) { return p && texteDe(p.t); });
  var hauteurPoints = 0;
  var lignesPoints = points.map(function (p, i) {
    var clos = p.etat === 'clos', mention = texteDe(p.mention);
    // hauteur estimée (mm), mesurée dans Chrome : 4,94 par ligne de texte, 2,65 par ligne de mention, 2,9 de marges (arrondis au-dessus)
    hauteurPoints += 4.94 * mep_lignes(p.t, 148, 11) + (mention ? 2.7 * mep_lignes(mention, 148, 8) : 0) + 3.2;
    return '<tr>'
      + '<td style="width:26px;padding:5px 6px;border-bottom:1px solid #E1DCD6;vertical-align:top;font-size:11px;font-weight:700;color:#1A2B4A">' + (i + 1) + '</td>'
      + '<td style="padding:5px 6px;border-bottom:1px solid #E1DCD6;vertical-align:top">'
      + '<div style="font-size:11px;line-height:1.7;' + (clos ? 'color:#6A6460;' : '') + TEXTE + '">' + esc(p.t) + '</div>'
      + (mention ? '<div style="font-size:8px;color:#6A6460;margin-top:1px;' + TEXTE + '">' + esc(mention) + '</div>' : '')
      + '</td>'
      + '<td style="width:58px;padding:5px 6px;border-bottom:1px solid #E1DCD6;vertical-align:top;text-align:center;font-size:8.5px;font-weight:700;color:'
      + (clos ? '#196B3B' : '#B45309') + '">' + (clos ? 'CLOS' : 'OUVERT') + '</td>'
      + '</tr>';
  }).join('');
  var nbOuverts = points.filter(function (p) { return p.etat !== 'clos'; }).length;
  var blocPoints = points.length
    ? '<div style="font-size:8px;font-weight:700;text-transform:uppercase;color:#0D7A6B;margin-bottom:3px;letter-spacing:.5px">Points (' + points.length + ') — '
      + nbOuverts + (nbOuverts > 1 ? ' ouverts' : ' ouvert') + ', ' + (points.length - nbOuverts) + ' clos' + '</div>'
      + '<table style="width:100%;border-collapse:collapse;border:1.5px solid #D8D4CE;margin-bottom:10px">' + lignesPoints + '</table>'
    : '';
  var remarque = texteDe(d.remarqueCR)
    ? '<div style="padding:5px 10px;border:1px solid #B45309;border-radius:4px;margin-bottom:8px;font-size:9.5px;color:#B45309;' + TEXTE + '">' + esc(d.remarqueCR) + '</div>'
    : '';

  var commentaires = d.commentaires
    ? '<div style="padding:10px 12px;background:#F0F5F4;border:1.5px solid #0D7A6B;border-radius:5px;margin-bottom:10px">'
      + '<div style="font-size:8px;font-weight:700;text-transform:uppercase;color:#0D7A6B;margin-bottom:6px;letter-spacing:.5px">'
      + (points.length ? 'Remarques générales' : 'Notes &amp; commentaires') + '</div>'
      + '<div style="font-size:11px;line-height:1.7;' + TEXTE + '">' + esc(d.commentaires) + '</div></div>'
    : '';

  // ── Photos (modeles/mise-en-page.js) : la 1re sous les notes si elles tiennent sur la page 1, dans toute la place
  // restante ; les autres en pleine page (deux par page si elles y gardent leur taille). Hauteur mesurée dans Chrome :
  // en-tête 36 mm (chantier long : 4,5 par ligne en plus, rédacteur : 3,2 ; objet long : 4,2) ; notes 12,5 + 4,94 par ligne.
  // Points : titre et bordures 6,1 mm mesurés (6,5 comptés) + chaque ligne du tableau ; remarque en tête : 8,2 mm mesurés.
  // Estimation toujours un peu AU-DESSUS du réel (photo de la page 1 un peu plus petite, jamais de débordement) : le moteur
  // PDF de Google n'a pas été mesuré.
  var estime = 36 + Math.max(4.5 * (mep_lignes(d.chantier || '—', 35, 12) - 1) + 3.2 * (mep_lignes(d.auteur || '—', 39, 11) - 1),
    4.2 * (d.objet ? mep_lignes(d.objet, 100, 11) - 1 : 0))
    + (remarque ? 5 + 4.2 * mep_lignes(d.remarqueCR, 170, 9.5) : 0)
    + (points.length ? 6.5 + hauteurPoints : 0)
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
    + remarque
    + blocPoints
    + commentaires
    + photosHtml
    + '</body></html>';
}
