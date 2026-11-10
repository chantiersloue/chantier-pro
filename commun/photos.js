// ═══════════════════════════════════════════════════════════════
// Loué App — compression des photos avant envoi
// 1600 px sur le grand côté, JPEG qualité 0,7 : 200 à 400 Ko au lieu de 4 à 6 Mo.
// Une photo illisible (format inconnu, fichier abîmé) donne un message clair au lieu de bloquer l'envoi.
// ═══════════════════════════════════════════════════════════════
(function () {
  'use strict';
  var LOUE = window.LOUE = window.LOUE || {};
  LOUE.PHOTO_MAX_PX = 1600;
  LOUE.PHOTO_QUALITE = 0.7;
  LOUE.PHOTOS_MAX = 10;

  function decoder(fichier) {
    // createImageBitmap redresse la photo selon le capteur (EXIF) ; sinon, l'élément <img> le fait aussi
    if (window.createImageBitmap) {
      return createImageBitmap(fichier, { imageOrientation: 'from-image' }).catch(function () { return parImage(fichier); });
    }
    return parImage(fichier);
  }
  function parImage(fichier) {
    return new Promise(function (ok, ko) {
      var url = URL.createObjectURL(fichier);
      var img = new Image();
      var minuteur = setTimeout(function () { URL.revokeObjectURL(url); ko(new Error('illisible')); }, 20000);
      img.onload = function () { clearTimeout(minuteur); ok(img); };
      img.onerror = function () { clearTimeout(minuteur); URL.revokeObjectURL(url); ko(new Error('illisible')); };
      img.src = url;
    });
  }

  // Renvoie une promesse de Blob JPEG compressé ; rejette avec un message compréhensible
  LOUE.compresserPhoto = function (fichier, maxPx) {
    maxPx = maxPx || LOUE.PHOTO_MAX_PX;
    return decoder(fichier).then(function (img) {
      var w = img.width || img.naturalWidth, h = img.height || img.naturalHeight;
      if (!w || !h) throw new Error('illisible');
      var r = Math.min(1, maxPx / Math.max(w, h));
      var c = document.createElement('canvas');
      c.width = Math.round(w * r); c.height = Math.round(h * r);
      var ctx = c.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0, c.width, c.height);
      if (img.close) img.close();
      return new Promise(function (ok, ko) {
        c.toBlob(function (b) { b ? ok(b) : ko(new Error('illisible')); }, 'image/jpeg', LOUE.PHOTO_QUALITE);
      });
    }).catch(function (err) {
      // Plan B : plus petit (certains téléphones manquent de mémoire pour les très grandes photos)
      if (maxPx > 1200 && err.message !== 'illisible') return LOUE.compresserPhoto(fichier, 1200);
      throw new Error('Photo « ' + (fichier.name || 'sans nom') + ' » illisible (format non reconnu ou fichier abîmé). '
        + 'Reprenez la photo avec l’appareil du téléphone.');
    });
  };

  // Lit une photo compressée en adresse « data: » (aperçu à l'écran, aperçu PDF)
  LOUE.blobEnDataUrl = function (blob) {
    return new Promise(function (ok, ko) {
      var r = new FileReader();
      r.onload = function () { ok(String(r.result)); };
      r.onerror = function () { ko(r.error); };
      r.readAsDataURL(blob);
    });
  };
})();
