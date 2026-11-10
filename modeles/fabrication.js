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
    + (d.zone ? 8.8 + 2.9 * (mep_lignes(d.zone, 80, 10) - 1) : 0)
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
    String(commentaires).split(/<br\s*\/?>|<\/div>|<\/p>/i).forEach(function (ligne) {
      var tailles = [10];   // taille de police la plus grande de la ligne (px), « agrandi » = 1,4 em
      (ligne.match(/font-size:\s*[\d.]+(em|px|%)/gi) || []).forEach(function (t) {
        var n = parseFloat(t.replace(/font-size:\s*/i, ''));
        tailles.push(/em/i.test(t) ? n * 10 : /%/.test(t) ? n / 10 : n);
      });
      var px = Math.min(40, Math.max.apply(null, tailles));
      var texte = mep_texteBrut(ligne);
      if (!texte && !/<span|<b|<i|<u/i.test(ligne)) return;
      estime += mep_lignes(texte, 260, px) * px * 1.5 * MEP_PX_MM;
    });
  }
  var zone = mep_zone(d, 297, 210, 10);
  var photosSection = mep_photos(d.photosBase64, { largeur: zone.largeur, hauteur: zone.hauteur, reste: mep_reste(zone, estime), estime: estime, esc: esc });

  return '<html><head><meta charset="utf-8"><style>@page{size:landscape;margin:1cm}body{font-family:Arial,sans-serif;font-size:10px;margin:0}*{box-sizing:border-box}</style></head><body>'
    + enTete + blocsHtml + commentaireSection + photosSection
    + '</body></html>';
}
