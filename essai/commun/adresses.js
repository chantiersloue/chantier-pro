// ═══════════════════════════════════════════════════════════════
// Garde-fou des adresses tapées à la main (lot 0)
// Une adresse qui n'est pas dans la liste des contacts du Sheet est une « adresse libre » :
// 2 au maximum par fiche. Le serveur applique la même règle ; ici, on prévient AVANT l'envoi.
// ═══════════════════════════════════════════════════════════════
window.LOUE_MAX_LIBRES = 2;

// Renvoie true (et prévient la personne) si l'adresse doit être refusée.
// val : adresse à ajouter ; deja : adresses déjà choisies ; contacts : listes du Sheet ({email: …})
window.LOUE_refuserAdresseLibre = function (val, deja, contacts) {
  var connues = {};
  (contacts || []).forEach(function (c) {
    String((c && c.email) || '').split(/[,;\s]+/).forEach(function (e) { if (e) connues[e.toLowerCase()] = true; });
  });
  // Liste des contacts pas encore chargée (réseau faible) : on ne peut pas juger, le serveur contrôlera
  if (!Object.keys(connues).length) return false;
  function estLibre(e) { return !connues[String(e || '').trim().toLowerCase()]; }
  if (!estLibre(val)) return false;
  var libres = (deja || []).filter(estLibre).length;
  if (libres < window.LOUE_MAX_LIBRES) return false;
  alert('Pas plus de ' + window.LOUE_MAX_LIBRES + ' adresses tapées à la main par fiche.\n\n'
    + '« ' + val + ' » n’est pas dans la liste des contacts. Demandez au bureau de l’ajouter '
    + '(onglet « Contacts notes ») : elle sera alors acceptée sans limite.');
  return true;
};
