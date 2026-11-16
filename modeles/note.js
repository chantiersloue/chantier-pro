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


  // Lot 8b — numéro du compte rendu : donné par le serveur à la réception (« 7 ») ; dans l'aperçu de la page, le texte
  // « — donné à l'envoi » ; vide pour un chantier hors liste. Présents : noms saisis à la main, facultatifs.
  var numero = d.numeroCR === undefined || d.numeroCR === null ? '' : String(d.numeroCR);
  var listePresents = (Object.prototype.toString.call(d.presents) === '[object Array]' ? d.presents : [])
    .map(function (n) { return String(n === undefined || n === null ? '' : n).replace(/\s+/g, ' ').replace(/^ | $/g, ''); })
    .filter(function (n) { return n; });
  var textePresents = listePresents.join(', ');
  var presents = textePresents
    ? '<div style="padding:8px 12px;border:1.5px solid #D8D4CE;border-radius:5px;margin-bottom:10px">'
      + '<div style="font-size:8px;font-weight:700;text-transform:uppercase;color:#6A6460;margin-bottom:4px;letter-spacing:.5px">Présents (' + listePresents.length + ')</div>'
      + '<div style="font-size:11px;line-height:1.7;' + TEXTE + '">' + esc(textePresents) + '</div></div>'
    : '';

  var commentaires = d.commentaires
    ? '<div style="padding:10px 12px;background:#F0F5F4;border:1.5px solid #0D7A6B;border-radius:5px;margin-bottom:10px">'
      + '<div style="font-size:8px;font-weight:700;text-transform:uppercase;color:#0D7A6B;margin-bottom:6px;letter-spacing:.5px">Notes &amp; commentaires</div>'
      + '<div style="font-size:11px;line-height:1.7;' + TEXTE + '">' + esc(d.commentaires) + '</div></div>'
    : '';

  // ── Photos (modeles/mise-en-page.js) : la 1re sous les notes si elles tiennent sur la page 1, dans toute la place
  // restante ; les autres en pleine page (deux par page si elles y gardent leur taille). Hauteur mesurée dans Chrome :
  // en-tête 36 mm (chantier long : 4,5 par ligne en plus, rédacteur : 3,2 ; objet long : 4,2) ; notes 12,5 + 4,94 par ligne.
  var estime = 36 + Math.max(4.5 * (mep_lignes(d.chantier || '—', 35, 12) - 1) + 3.2 * (mep_lignes(d.auteur || '—', 39, 11) - 1),
    4.2 * ((d.objet ? mep_lignes(d.objet, 100, 11) - 1 : 0) + (numero ? 1 : 0)))
    // Présents : 15,8 mm mesurés dans Chrome pour une ligne (11 + 4,94). Numéro : compté comme une ligne de plus dans
    // la colonne du milieu ; mesuré, il ne coûte rien tant que l'objet tient sur une ligne : estimation volontairement
    // prudente (photo de la page 1 un peu plus petite, jamais de débordement), le moteur PDF de Google n'étant pas mesuré.
    + (textePresents ? 11 + 4.94 * mep_lignes(textePresents, 168, 11) : 0)
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
    + (numero ? '<div style="margin-top:3px;font-size:11px;font-weight:700;color:#1A2B4A">Compte rendu n° ' + esc(numero) + '</div>' : '')
    + (d.objet ? '<div style="margin-top:5px;font-size:11px;font-weight:600;color:#141210;' + TEXTE + '">' + esc(d.objet) + '</div>' : '')
    + '</td></tr></table>'
    + presents
    + commentaires
    + photosHtml
    + '</body></html>';
}
