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
  return { largeur: l - 2 * marge, hauteur: h - 2 * marge - enPlus, sansPage1: !!(d && d._mepSansPage1) };
}
// Nombre de pages estimé d'un contenu (contrôle du serveur)
function mep_pages(zone, estime) { return Math.max(1, Math.ceil((estime || 0) / zone.hauteur)); }
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
