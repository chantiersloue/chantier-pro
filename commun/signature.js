// ═══════════════════════════════════════════════════════════════
// Loué App — zones de signature
// - au doigt, au stylet ou à la souris (« pointer events ») ;
// - net sur les écrans haute densité ;
// - le tracé est gardé en mémoire : il survit à la rotation de l'écran, à l'ouverture du clavier,
//   et il est sauvé dans le brouillon ;
// - « signature vide » détectée.
// Image exportée : PNG 600 × 300 (affichée sur 80 px de haut dans les PDF).
// ═══════════════════════════════════════════════════════════════
(function () {
  'use strict';
  var LOUE = window.LOUE = window.LOUE || {};
  var LARGEUR = 300, HAUTEUR = 150;   // repère logique du tracé (identique aux anciennes signatures)

  LOUE.signature = function (canvas) {
    var traits = [];       // [[{x,y}, …], …] dans le repère 300 × 150
    var courant = null;
    var ctx = canvas.getContext('2d');

    function dimensionner() {
      var r = canvas.getBoundingClientRect();
      var dpr = window.devicePixelRatio || 1;
      var w = Math.max(1, Math.round((r.width || LARGEUR) * dpr));
      var h = Math.max(1, Math.round((r.height || HAUTEUR) * dpr));
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      dessiner();
    }
    function dessinerSur(c2, w, h, epaisseur) {
      c2.clearRect(0, 0, w, h);
      c2.strokeStyle = '#141210'; c2.lineCap = 'round'; c2.lineJoin = 'round';
      c2.lineWidth = epaisseur;
      var sx = w / LARGEUR, sy = h / HAUTEUR;
      traits.forEach(function (t) {
        if (!t.length) return;
        c2.beginPath(); c2.moveTo(t[0].x * sx, t[0].y * sy);
        if (t.length === 1) c2.lineTo(t[0].x * sx + 0.1, t[0].y * sy);
        for (var i = 1; i < t.length; i++) c2.lineTo(t[i].x * sx, t[i].y * sy);
        c2.stroke();
      });
    }
    function dessiner() { dessinerSur(ctx, canvas.width, canvas.height, 2.5 * canvas.width / LARGEUR); }

    function point(ev) {
      var r = canvas.getBoundingClientRect();
      return { x: Math.round((ev.clientX - r.left) / r.width * LARGEUR * 10) / 10,
               y: Math.round((ev.clientY - r.top) / r.height * HAUTEUR * 10) / 10 };
    }
    canvas.style.touchAction = 'none';   // le doigt dessine au lieu de faire défiler la page
    canvas.addEventListener('pointerdown', function (ev) {
      ev.preventDefault();
      try { canvas.setPointerCapture(ev.pointerId); } catch (e) {}
      courant = [point(ev)]; traits.push(courant); dessiner();
    });
    canvas.addEventListener('pointermove', function (ev) {
      if (!courant) return;
      ev.preventDefault();
      courant.push(point(ev)); dessiner();
    });
    function fin() {
      if (!courant) return;
      courant = null;
      canvas.dispatchEvent(new Event('change', { bubbles: true }));   // déclenche la sauvegarde du brouillon
    }
    canvas.addEventListener('pointerup', fin);
    canvas.addEventListener('pointercancel', fin);
    window.addEventListener('resize', dimensionner);
    if (window.ResizeObserver) new ResizeObserver(dimensionner).observe(canvas);
    dimensionner();

    return {
      effacer: function () { traits = []; dessiner(); canvas.dispatchEvent(new Event('change', { bubbles: true })); },
      annuler: function () { traits.pop(); dessiner(); canvas.dispatchEvent(new Event('change', { bubbles: true })); },
      // Vide si aucun trait, ou un simple point / gribouillis minuscule
      estVide: function () {
        var n = 0; traits.forEach(function (t) { n += t.length; });
        return n < 8;
      },
      versDataUrl: function () {
        if (this.estVide()) return '';
        var c = document.createElement('canvas'); c.width = LARGEUR * 2; c.height = HAUTEUR * 2;
        dessinerSur(c.getContext('2d'), c.width, c.height, 5);
        return c.toDataURL('image/png');
      },
      // Pour le brouillon
      lireTraits: function () { return JSON.parse(JSON.stringify(traits)); },
      ecrireTraits: function (t) { traits = Array.isArray(t) ? t : []; dessiner(); },
    };
  };
})();
