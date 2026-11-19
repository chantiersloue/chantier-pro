// ═══════════════════════════════════════════════════════════════════════════════
// PLANNING LOUÉ — ÉCRIRE L'AFFICHE COMPACTE DANS UN ONGLET (lot 11.1)
//
// Partagé par les deux programmes : « Préparer l'affiche A3 » (programme du planning) et le PDF publié pour les gars
// (programme de publication). Une ligne par gars, le texte le plus gros possible, la case de la couleur du véhicule du jour.
// L'affiche n'est PAS reliée au planning par des formules : elle est refaite à chaque fois.
// ═══════════════════════════════════════════════════════════════════════════════

// sh : un onglet vide (ou à refaire) ; a : ce que rend plAffiche_ ; vehicules : [{ nom, couleur }]
function plEcrireAffiche_(sh, a, vehicules) {
  const m = plMesuresAffiche_(a), nbLignes = a.lignes.length + 1, nbCol = 7;
  sh.clear();
  // 1. Les valeurs : la ligne de titre, puis le tableau
  const titre = [a.titre, '', '', '', '', '', ''];
  sh.getRange(1, 1, nbLignes, nbCol).setNumberFormat('@').setValues([titre].concat(a.lignes));
  // 2. Les couleurs
  const fonds = [], textes = [], gras = [];
  for (let i = 0; i < nbLignes; i++) {
    const sorte = i === 0 ? 'titre' : a.sortes[i - 1], veh = i === 0 ? null : a.vehicules[i - 1];
    const fond = [], texte = [], g = [];
    for (let c = 0; c < nbCol; c++) {
      let f = PL_COULEUR_DEFAUT, t = '#000000', b = 'normal';
      if (sorte === 'titre') { b = 'bold'; }
      else if (sorte === 'entete') { f = PL_COULEUR_ENTETE; b = 'bold'; }
      else if (sorte === 'section') { f = PL_COULEUR_SECTION; t = '#FFFFFF'; b = 'bold'; }
      else if (sorte === 'pose') {
        if (c < 2) { f = plCouleurVehicule_(a.lignes[i - 1][0], vehicules); b = c === 1 ? 'bold' : 'normal'; }
        else f = plCouleurVehicule_(veh ? veh[c - 2] : '', vehicules);
      } else if (sorte === 'atelier' && c === 1) b = 'bold';
      fond.push(f); texte.push(t); g.push(b);
    }
    fonds.push(fond); textes.push(texte); gras.push(g);
  }
  const tout = sh.getRange(1, 1, nbLignes, nbCol);
  tout.setBackgrounds(fonds).setFontColors(textes).setFontWeights(gras)
    .setFontFamily('Arial').setFontSize(m.taille).setVerticalAlignment('middle').setWrap(m.lignesParCase > 1)
    .setBorder(true, true, true, true, true, true, '#666666', null);
  sh.getRange(1, 1, 1, nbCol).setFontSize(Math.min(26, m.taille + 4)).setBorder(false, false, true, false, false, false);
  // 3. Les mesures : tout tient sur la feuille
  m.largeurs.forEach((l, i) => sh.setColumnWidth(i + 1, l));
  sh.setRowHeights(1, nbLignes, m.hauteurLigne);
  sh.setFrozenRows(2);
  return { lignes: nbLignes, colonnes: nbCol, taille: m.taille };
}

// L'adresse qui ouvre le PDF d'UN onglet. ATTENTION : cette adresse d'export n'est décrite sur aucune page officielle de
// Google ; elle marche aujourd'hui, elle peut changer. Repli garanti : Fichier → Imprimer → « Feuille active ».
//   papier : 'A3' ou 'A4' ; toujours en paysage, ajusté à la page, sans quadrillage ni numéro de page
function plAdresseExport_(idClasseur, idOnglet, papier) {
  return 'https://docs.google.com/spreadsheets/d/' + idClasseur + '/export?format=pdf&gid=' + idOnglet
    + '&size=' + (papier === 'A3' ? 'A3' : 'A4') + '&portrait=false&scale=4&gridlines=false&printtitle=false&sheetnames=false'
    + '&pagenum=UNDEFINED&fzr=false&horizontal_alignment=CENTER&vertical_alignment=TOP'
    + '&top_margin=0.3&bottom_margin=0.3&left_margin=0.3&right_margin=0.3';
}
