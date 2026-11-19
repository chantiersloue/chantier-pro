// ═══════════════════════════════════════════════════════════════════════════════
// PLANNING LOUÉ — LE PROGRAMME DU PLANNING (lot 11.1a et 11.1b)
//
// Il est ATTACHÉ au Google Sheets « Planning Loué » (Extensions → Apps Script) et NE TOUCHE QUE CE SHEET : aucun autre
// fichier, aucun mail, aucun accès à l'appli. Toute personne qui peut modifier le Sheet peut modifier ce programme
// (règle de Google) : c'est pour cela qu'il n'a aucun droit ailleurs. Ce qui sort du Sheet (le PDF des gars, la liste des
// chantiers) est fait par un AUTRE programme, celui de publication (Publication.gs), que seul le compte de Loué peut modifier.
//
// Ce qu'il fait : le menu « Planning Loué » ; la saisie complétée (« 901 » → « 901 LES TILLEULS », « 901 + 903 » → deux
// demi-journées) ; les couleurs par véhicule ; « Créer la semaine suivante » ; « Ajouter / Retirer un gars » ; « Vérifier la
// semaine » ; « Préparer l'affiche A3 ». Il ne refuse jamais une saisie.
// Les règles (calculs) sont dans Regles.gs, testées sans Google.
// ═══════════════════════════════════════════════════════════════════════════════

// ── Le menu ──
function onOpen() {
  SpreadsheetApp.getUi().createMenu('Planning Loué')
    .addItem('Créer la semaine suivante', 'menuSemaineSuivante')
    .addItem('Ajouter un gars…', 'menuAjouterGars')
    .addItem('Retirer un gars…', 'menuRetirerGars')
    .addSeparator()
    .addItem('Vérifier la semaine', 'menuVerifier')
    .addItem('Préparer l’affiche A3', 'menuAffiche')
    .addSeparator()
    .addItem('Installer le planning (une seule fois)', 'menuInstaller')
    .addItem('À propos', 'menuAPropos')
    .addToUi();
}

// ── À chaque saisie dans une semaine : compléter, colorer. Ne lève jamais d'erreur, ne refuse jamais rien. ──
function onEdit(e) {
  try {
    if (!e || !e.range) return;
    const sh = e.range.getSheet();
    if (!plLundiDeNom_(sh.getName())) return;
    plgSurEdition_(e.source || SpreadsheetApp.getActiveSpreadsheet(), sh, e.range);
  } catch (err) { console.error('onEdit :', err && err.message); }
}
function plgSurEdition_(ss, sh, plage) {
  const l1 = plage.getRow(), c1 = plage.getColumn(), l2 = l1 + plage.getNumRows() - 1, c2 = c1 + plage.getNumColumns() - 1;
  if (l2 < PL_S.lig1 || c1 > PL_S.colJour1 + 4) return 'hors du tableau';
  const listes = plgListes_(ss);
  const nb = sh.getLastRow();
  if (nb < PL_S.lig1) return 'vide';
  const valeurs = sh.getRange(1, 1, nb, PL_S.nbCol).getValues();
  // 1. Les cases de POSE modifiées sont complétées (un gros collage n'est pas traité ici : « Vérifier la semaine » le rattrape)
  if ((l2 - l1 + 1) * (c2 - c1 + 1) <= 300) {
    for (let l = Math.max(l1, PL_S.lig1); l <= Math.min(l2, nb); l++) {
      if (plTexte_(valeurs[l - 1][PL_S.colMarque - 1]) !== PL_M.pose) continue;
      for (let c = Math.max(c1, PL_S.colJour1); c <= Math.min(c2, PL_S.colJour1 + 4); c++) {
        const avant = valeurs[l - 1][c - 1], propre = plCompleter_(avant, listes.index);
        if (propre !== String(avant === null || avant === undefined ? '' : avant)) { sh.getRange(l, c).setNumberFormat('@').setValue(propre); valeurs[l - 1][c - 1] = propre; }
      }
    }
  }
  // 2. Les couleurs de tout le tableau (véhicule du jour, mots à éviter en rouge)
  plgColorer_(sh, valeurs, listes);
  return 'fait';
}
function plgColorer_(sh, valeurs, listes) {
  const st = plStyles_(valeurs, listes.vehicules, listes.index);
  if (!st.fonds.length) return;
  sh.getRange(PL_S.lig1, 1, st.fonds.length, 7).setBackgrounds(st.fonds).setFontColors(st.textes);
}

// ── Lire les listes (onglet LISTES) ──
function plgListes_(ss) {
  const sh = ss.getSheetByName(PL_ONGLETS.listes);
  if (!sh) throw new Error('l’onglet « ' + PL_ONGLETS.listes + ' » est absent : menu Planning Loué → Installer le planning');
  const n = Math.min(PL_L.max, Math.max(0, sh.getLastRow() - PL_L.lig1 + 1));
  const v = n ? sh.getRange(PL_L.lig1, 1, n, PL_L.nbCol).getValues() : [];
  const chantiers = v.map(r => ({ numero: plTexte_(r[PL_L.colNumero - 1]), nom: plTexte_(r[PL_L.colNom - 1]), court: plTexte_(r[PL_L.colCourt - 1]) })).filter(c => c.numero);
  const vehicules = v.map(r => ({ nom: plTexte_(r[PL_L.colVehicule - 1]), couleur: plTexte_(r[PL_L.colCouleur - 1]) })).filter(x => x.nom);
  const casLus = v.map(r => plTexte_(r[PL_L.colCas - 1])).filter(Boolean);
  const cas = casLus.length ? casLus : PL_CAS;
  return { chantiers: chantiers, vehicules: vehicules, cas: cas, index: plIndex_(chantiers, cas) };
}
// Refaire la liste de saisie (colonne D) d'après les chantiers et les autres cas
function plgRefaireChoix_(ss, listes) {
  const sh = ss.getSheetByName(PL_ONGLETS.listes), choix = plChoix_(listes.index).slice(0, PL_L.max);
  sh.getRange(PL_L.lig1, PL_L.colChoix, PL_L.max, 1).clearContent();
  if (choix.length) sh.getRange(PL_L.lig1, PL_L.colChoix, choix.length, 1).setNumberFormat('@').setValues(choix.map(c => [c]));
}

// ── Écrire une semaine dans son onglet (valeurs, puis présentation). L'onglet est entièrement refait. ──
function plgEcrireSemaine_(ss, sh, s, listes) {
  const grille = plGrilleSemaine_(s), nb = grille.length;
  const ancien = sh.getLastRow();
  if (sh.getMaxRows() < nb + 5) sh.insertRowsAfter(sh.getMaxRows(), nb + 5 - sh.getMaxRows());
  if (ancien > nb) sh.getRange(nb + 1, 1, ancien - nb, PL_S.nbCol).clearContent().clearDataValidations().setBackground(PL_COULEUR_DEFAUT);
  const tout = sh.getRange(1, 1, nb, PL_S.nbCol);
  // Format « texte brut » sur les lignes des gars : « 901 » reste « 901 », « 1/4 » ne devient pas une date
  sh.getRange(PL_S.ligEntetes, 1, nb - PL_S.ligEntetes + 1, PL_S.nbCol).setNumberFormat('@');
  tout.clearDataValidations().setValues(grille);
  // La case « Publier » (une vraie case à cocher) et l'état
  sh.getRange(PL_S.ligPublier, PL_S.colCase).insertCheckboxes().setValue(s.publier === true);
  // Présentation
  tout.setFontFamily('Arial').setFontSize(10).setVerticalAlignment('middle').setWrap(true).setFontWeight('normal');
  sh.getRange(PL_S.ligTitre, 1, 1, 7).setFontSize(14).setFontWeight('bold');
  sh.getRange(PL_S.ligEntetes, 1, 1, 7).setFontWeight('bold').setBackground(PL_COULEUR_ENTETE).setHorizontalAlignment('center');
  const listeChoix = ss.getSheetByName(PL_ONGLETS.listes).getRange(PL_L.lig1, PL_L.colChoix, PL_L.max, 1);
  const listeVehicules = ss.getSheetByName(PL_ONGLETS.listes).getRange(PL_L.lig1, PL_L.colVehicule, 60, 1);
  // Listes de choix réglées sur « afficher un avertissement » : la saisie libre est TOUJOURS acceptée
  const regleChoix = SpreadsheetApp.newDataValidation().requireValueInRange(listeChoix, true).setAllowInvalid(true).build();
  const regleVehicule = SpreadsheetApp.newDataValidation().requireValueInRange(listeVehicules, true).setAllowInvalid(true).build();
  for (let l = PL_S.lig1; l <= nb; l++) {
    const marque = grille[l - 1][PL_S.colMarque - 1];
    if (marque === PL_M.pose) {
      sh.setRowHeight(l, 46);
      sh.getRange(l, PL_S.colJour1, 1, 5).setDataValidation(regleChoix).setFontSize(11).setFontWeight('bold').setHorizontalAlignment('center');
      sh.getRange(l, PL_S.colVehicule).setDataValidation(regleVehicule);
      sh.getRange(l, PL_S.colNom).setFontWeight('bold');
    } else if (marque === PL_M.vehicule) {
      sh.setRowHeight(l, 20);
      sh.getRange(l, 1, 1, 7).setFontSize(8).setFontStyle('italic');
      sh.getRange(l, PL_S.colJour1, 1, 5).setDataValidation(regleVehicule).setHorizontalAlignment('center');
    } else if (marque === PL_M.atelier) {
      sh.setRowHeight(l, 62);
      sh.getRange(l, PL_S.colNom).setFontWeight('bold');
    } else if (marque === PL_M.titre) {
      sh.setRowHeight(l, 24);
      sh.getRange(l, 1, 1, 7).setFontWeight('bold');
    }
  }
  sh.setColumnWidth(1, 110); sh.setColumnWidth(2, 130);
  for (let c = PL_S.colJour1; c < PL_S.colJour1 + 5; c++) sh.setColumnWidth(c, 190);
  sh.hideColumns(PL_S.colMarque);
  sh.setFrozenRows(PL_S.ligEntetes); sh.setFrozenColumns(2);
  plgColorer_(sh, grille, listes);
}
// Lire la semaine d'un onglet ; lève une erreur claire s'il n'est pas lisible
function plgLireSemaine_(sh) {
  const nb = sh.getLastRow();
  const s = nb >= PL_S.lig1 ? plLireSemaine_(sh.getRange(1, 1, nb, PL_S.nbCol).getValues()) : null;
  if (!s) throw new Error('l’onglet « ' + sh.getName() + ' » n’est pas lisible (la colonne H, cachée, a été effacée ?). Restaure-le par Fichier → Historique des versions.');
  if (plNomOnglet_(s.lundi) !== sh.getName()) throw new Error('l’onglet « ' + sh.getName() + ' » ne porte pas le nom de sa semaine (' + plNomOnglet_(s.lundi) + ').');
  return s;
}
// La semaine sur laquelle on travaille : l'onglet actif si c'est une semaine, sinon la plus récente
function plgSemaineActive_(ss) {
  const actif = ss.getActiveSheet();
  if (actif && plLundiDeNom_(actif.getName())) return actif;
  const semaines = plgOngletsSemaine_(ss);
  if (!semaines.length) throw new Error('aucune semaine dans ce classeur : menu Planning Loué → Installer le planning');
  return semaines[semaines.length - 1].sh;
}
// Les onglets de semaine, du plus ancien au plus récent : [{ sh, lundi }]
function plgOngletsSemaine_(ss) {
  return ss.getSheets().map(sh => ({ sh: sh, lundi: plLundiDeNom_(sh.getName()) })).filter(x => x.lundi).sort((a, b) => (a.lundi < b.lundi ? -1 : 1));
}

// ── Outils des commandes ──
// Une commande du menu : sous verrou (deux personnes en même temps ne se marchent pas dessus), erreur dite en clair
function plgCommande_(nom, fonction) {
  const ui = SpreadsheetApp.getUi();
  const verrou = LockService.getDocumentLock();
  if (!verrou.tryLock(10000)) { ui.alert(nom, 'Quelqu’un d’autre lance une commande en ce moment. Réessaie dans une minute.', ui.ButtonSet.OK); return null; }
  try { return fonction(SpreadsheetApp.getActiveSpreadsheet(), ui); }
  catch (err) { ui.alert(nom, 'Pas fait : ' + (err && err.message ? err.message : err), ui.ButtonSet.OK); return null; }
  finally { verrou.releaseLock(); }
}
function plgAujourdhui_() { return Utilities.formatDate(new Date(), 'Europe/Paris', 'yyyy-MM-dd'); }

// ── Créer la semaine suivante ──
function menuSemaineSuivante() {
  return plgCommande_('Créer la semaine suivante', (ss, ui) => {
    const r = plgCreerSuivante_(ss);
    ui.alert('Créer la semaine suivante', r.message, ui.ButtonSet.OK);
    return r;
  });
}
function plgCreerSuivante_(ss) {
  const depuis = plgSemaineActive_(ss), s = plgLireSemaine_(depuis), listes = plgListes_(ss);
  const suivante = plSemaineSuivante_(s, listes.index), nom = plNomOnglet_(suivante.lundi);
  const deja = ss.getSheetByName(nom);
  if (deja) { ss.setActiveSheet(deja); return { ok: false, message: 'La semaine ' + nom + ' existe déjà : je te l’ai ouverte. Rien n’a été modifié.' }; }
  const sh = ss.insertSheet(nom, depuis.getIndex());
  plgEcrireSemaine_(ss, sh, suivante, listes);
  ss.setActiveSheet(sh);
  return { ok: true, nom: nom, message: 'La semaine ' + nom + ' (' + plTitre_(suivante.lundi) + ') est créée, avec les mêmes gars, les mêmes véhicules et les chantiers de chacun. '
    + 'Les absences, congés, école, formation et fériés n’ont pas été recopiés : à ressaisir.' };
}

// ── Ajouter / retirer un gars : dans la semaine ouverte ET dans les semaines suivantes déjà créées ──
function menuAjouterGars() {
  return plgCommande_('Ajouter un gars', (ss, ui) => {
    const rep = ui.prompt('Ajouter un gars', 'Son prénom et l’initiale de son nom (exemple : Kévin L.) :', ui.ButtonSet.OK_CANCEL);
    if (rep.getSelectedButton() !== ui.Button.OK) return null;
    const equipe = ui.alert('Ajouter un gars', '« ' + plTexte_(rep.getResponseText()) + ' » : est-il à la POSE ?\n\nOui = pose. Non = atelier.', ui.ButtonSet.YES_NO_CANCEL);
    if (equipe !== ui.Button.YES && equipe !== ui.Button.NO) return null;
    const r = plgAjouter_(ss, rep.getResponseText(), equipe === ui.Button.NO ? 'atelier' : 'pose');
    ui.alert('Ajouter un gars', r.message, ui.ButtonSet.OK);
    return r;
  });
}
function plgAjouter_(ss, nom, equipe) {
  const depuis = plgSemaineActive_(ss), lundi = plLundiDeNom_(depuis.getName()), listes = plgListes_(ss);
  const vehicule = plgVehiculeHabituel_(ss, nom);
  let faites = 0, premier = null;
  plgOngletsSemaine_(ss).filter(x => x.lundi >= lundi).forEach(x => {
    const r = plAjouterGars_(plgLireSemaine_(x.sh), nom, equipe, vehicule);
    if (!premier) premier = r;
    if (r.ok) { plgEcrireSemaine_(ss, x.sh, r.semaine, listes); faites++; }
  });
  if (!faites) return { ok: false, message: premier ? premier.message : 'Rien à faire.' };
  plgNoterSalarie_(ss, nom, equipe, vehicule);
  return { ok: true, semaines: faites, message: premier.ok ? premier.message + (faites > 1 ? ' Fait aussi dans les ' + (faites - 1) + ' semaine(s) suivante(s).' : '')
    : 'Il y était déjà dans cette semaine ; ajouté dans ' + faites + ' semaine(s) suivante(s).' };
}
function menuRetirerGars() {
  return plgCommande_('Retirer un gars', (ss, ui) => {
    const rep = ui.prompt('Retirer un gars', 'Son nom, écrit comme dans le planning (exemple : Kévin L.) :', ui.ButtonSet.OK_CANCEL);
    if (rep.getSelectedButton() !== ui.Button.OK) return null;
    const nom = rep.getResponseText();
    const essai = plgRetirer_(ss, nom, true);
    if (!essai.ok) { ui.alert('Retirer un gars', essai.message, ui.ButtonSet.OK); return essai; }
    const texte = '« ' + plTexte_(nom) + ' » sera retiré de ' + essai.semaines + ' semaine(s) (celle-ci et les suivantes).'
      + (essai.avaitDesSaisies ? '\n\n⚠ Ce qui est écrit sur ses lignes sera effacé.' : '') + '\n\nLes semaines passées ne changent pas. Continuer ?';
    if (ui.alert('Retirer un gars', texte, ui.ButtonSet.YES_NO) !== ui.Button.YES) return null;
    const r = plgRetirer_(ss, nom, false);
    ui.alert('Retirer un gars', r.message, ui.ButtonSet.OK);
    return r;
  });
}
// aBlanc : ne rien écrire, dire seulement ce qui serait fait
function plgRetirer_(ss, nom, aBlanc) {
  const depuis = plgSemaineActive_(ss), lundi = plLundiDeNom_(depuis.getName()), listes = plgListes_(ss);
  let faites = 0, saisies = false;
  plgOngletsSemaine_(ss).filter(x => x.lundi >= lundi).forEach(x => {
    const r = plRetirerGars_(plgLireSemaine_(x.sh), nom);
    if (!r.ok) return;
    faites++; saisies = saisies || r.avaitDesSaisies;
    if (!aBlanc) plgEcrireSemaine_(ss, x.sh, r.semaine, listes);
  });
  if (!faites) return { ok: false, message: '« ' + plTexte_(nom) + ' » n’est ni dans cette semaine ni dans les suivantes. Vérifie l’orthographe.' };
  return { ok: true, semaines: faites, avaitDesSaisies: saisies, message: '« ' + plTexte_(nom) + ' » est retiré de ' + faites + ' semaine(s).' };
}
// Le véhicule habituel d'un gars, lu dans SALARIÉS ('' s'il n'y est pas)
function plgVehiculeHabituel_(ss, nom) {
  const sh = ss.getSheetByName(PL_ONGLETS.salaries);
  if (!sh || sh.getLastRow() < 2) return '';
  const l = sh.getRange(2, 1, sh.getLastRow() - 1, 3).getValues().filter(r => plNorm_(r[0]) === plNorm_(nom))[0];
  return l ? plTexte_(l[2]) : '';
}
// Un nouveau gars est noté dans SALARIÉS (sans compte de l'appli : cette colonne est réservée à Franck)
function plgNoterSalarie_(ss, nom, equipe, vehicule) {
  const sh = ss.getSheetByName(PL_ONGLETS.salaries);
  if (!sh) return;
  const n = sh.getLastRow();
  const deja = n >= 2 && sh.getRange(2, 1, n - 1, 1).getValues().some(r => plNorm_(r[0]) === plNorm_(nom));
  if (deja) return;
  sh.getRange(Math.max(2, n + 1), 1, 1, 3).setNumberFormat('@').setValues([[plTexte_(nom), equipe === 'atelier' ? 'Atelier' : 'Pose', plTexte_(vehicule)]]);
}

// ── Vérifier la semaine : remettre d'aplomb, et dire ce qui est à regarder. Ne bloque jamais la saisie. ──
function menuVerifier() {
  return plgCommande_('Vérifier la semaine', (ss, ui) => {
    const r = plgVerifier_(ss);
    const texte = r.remarques.length
      ? r.remarques.slice(0, 25).join('\n') + (r.remarques.length > 25 ? '\n… et ' + (r.remarques.length - 25) + ' autre(s).' : '')
      : 'Rien à signaler.';
    ui.alert('Vérifier la semaine ' + r.nom, 'La semaine a été remise d’aplomb (saisies complétées, couleurs, ordre alphabétique).\n\n' + texte, ui.ButtonSet.OK);
    return r;
  });
}
function plgVerifier_(ss) {
  const sh = plgSemaineActive_(ss), listes = plgListes_(ss);
  plgRefaireChoix_(ss, listes);
  const r = plVerifier_(plgLireSemaine_(sh), listes.index);
  plgEcrireSemaine_(ss, sh, r.semaine, listes);
  const v = listes.vehicules.map(x => plNorm_(x.nom));
  r.semaine.pose.forEach(g => { if (plTexte_(g.vehicule) && v.indexOf(plNorm_(g.vehicule)) < 0) r.remarques.push(g.nom + ' : le véhicule « ' + g.vehicule + ' » n’est pas dans la liste (pas de couleur).'); });
  return { nom: sh.getName(), remarques: r.remarques };
}

// ── Préparer l'affiche A3 : un onglet d'impression à part, refait à chaque fois ──
function menuAffiche() {
  return plgCommande_('Préparer l’affiche A3', (ss, ui) => {
    const r = plgAffiche_(ss);
    ui.alert('Affiche A3 de la semaine ' + r.nom, 'L’onglet « ' + PL_ONGLETS.affiche + ' » est prêt (texte en ' + r.taille + ' points).\n\n'
      + 'Pour l’imprimer : clique sur le lien « Ouvrir le PDF de l’affiche », en haut à droite de cet onglet, puis imprime en A3.\n'
      + 'Si le lien ne marche pas : Fichier → Imprimer → « Feuille active », papier A3, paysage, « Ajuster à la page ».\n\n'
      + 'À refaire après chaque changement du planning.', ui.ButtonSet.OK);
    return r;
  });
}
function plgAffiche_(ss) {
  const depuis = plgSemaineActive_(ss), listes = plgListes_(ss);
  const a = plAffiche_(plgLireSemaine_(depuis), listes.index);
  let sh = ss.getSheetByName(PL_ONGLETS.affiche);
  if (!sh) sh = ss.insertSheet(PL_ONGLETS.affiche, ss.getSheets().length);
  const ecrit = plEcrireAffiche_(sh, a, listes.vehicules);
  // Le lien est écrit HORS de la zone imprimée (colonne I), avec la semaine préparée et l'heure
  const adresse = plAdresseExport_(ss.getId(), sh.getSheetId(), 'A3');
  sh.getRange(1, 9).setFormula('=HYPERLINK("' + adresse + '&range=A1:G' + ecrit.lignes + '";"Ouvrir le PDF de l’affiche")');
  sh.getRange(2, 9).setValue('Semaine ' + depuis.getName() + ', préparée le ' + Utilities.formatDate(new Date(), 'Europe/Paris', 'dd/MM') + ' à ' + Utilities.formatDate(new Date(), 'Europe/Paris', 'HH:mm'));
  sh.setColumnWidth(9, 260);
  ss.setActiveSheet(sh);
  return { nom: depuis.getName(), taille: ecrit.taille, lignes: ecrit.lignes };
}

// ── Installer le planning (une seule fois) : crée ce qui manque, ne remplace JAMAIS un onglet qui existe ──
function menuInstaller() {
  return plgCommande_('Installer le planning', (ss, ui) => {
    const r = plgInstaller_(ss);
    ui.alert('Installer le planning', r.join('\n'), ui.ButtonSet.OK);
    return r;
  });
}
function plgInstaller_(ss) {
  const faits = [];
  let li = ss.getSheetByName(PL_ONGLETS.listes);
  if (!li) {
    li = ss.insertSheet(PL_ONGLETS.listes, ss.getSheets().length);
    li.getRange(1, 1, 1, PL_L.nbCol).setValues([PL_L_TITRES]).setFontWeight('bold');
    li.getRange(PL_L.lig1, PL_L.colCas, PL_CAS.length, 1).setValues(PL_CAS.map(c => [c]));
    li.getRange(PL_L.lig1, PL_L.colLibelle).setValue('Mettre à jour maintenant');
    li.getRange(PL_L.lig1, PL_L.colEtat).insertCheckboxes();
    li.getRange(PL_L.lig1, PL_L.colNumero, PL_L.max, 4).setNumberFormat('@');
    li.setFrozenRows(1);
    faits.push('✅ Onglet ' + PL_ONGLETS.listes + ' créé (à remplir : véhicules et couleurs ; la liste des chantiers arrivera toute seule de l’appli).');
  } else faits.push('• Onglet ' + PL_ONGLETS.listes + ' : il existait déjà, pas touché.');
  let sal = ss.getSheetByName(PL_ONGLETS.salaries);
  if (!sal) {
    sal = ss.insertSheet(PL_ONGLETS.salaries, ss.getSheets().length);
    sal.getRange(1, 1, 1, PL_SAL_TITRES.length).setValues([PL_SAL_TITRES]).setFontWeight('bold');
    sal.getRange(2, 1, 200, 4).setNumberFormat('@');
    sal.setFrozenRows(1);
    // La colonne « Compte de l'appli » : seule la personne qui installe (Franck) et le propriétaire du Sheet peuvent la modifier
    try {
      const p = sal.getRange(1, 4, sal.getMaxRows(), 1).protect().setDescription('Compte de l’appli : réservé à Franck');
      p.removeEditors(p.getEditors());
      if (p.canDomainEdit()) p.setDomainEdit(false);
      faits.push('✅ Onglet ' + PL_ONGLETS.salaries + ' créé ; la colonne « Compte de l’appli » est verrouillée (toi et le propriétaire du Sheet).');
    } catch (err) { faits.push('⚠ Onglet ' + PL_ONGLETS.salaries + ' créé, mais la colonne « Compte de l’appli » n’a pas pu être verrouillée (' + err.message + ') : à faire à la main (Données → Protéger des feuilles et des plages).'); }
  } else faits.push('• Onglet ' + PL_ONGLETS.salaries + ' : il existait déjà, pas touché.');
  if (!plgOngletsSemaine_(ss).length) {
    const lundi = plLundi_(plgAujourdhui_()), nom = plNomOnglet_(lundi);
    const sh = ss.insertSheet(nom, 0);
    plgEcrireSemaine_(ss, sh, { lundi: lundi, publier: false, etat: '', pose: [], atelier: [] }, plgListes_(ss));
    ss.setActiveSheet(sh);
    faits.push('✅ Première semaine créée : ' + nom + ' (vide). Ajoute les gars par le menu « Ajouter un gars… ».');
  } else faits.push('• Il y a déjà des semaines : aucune n’a été créée.');
  return faits;
}
function menuAPropos() {
  const ui = SpreadsheetApp.getUi();
  ui.alert('Planning Loué', PL_VERSION + '\n\nCe programme ne touche que ce Sheet. Le PDF des gars et la liste des chantiers sont faits par le programme de publication, '
    + 'dans le compte de Loué.\n\nMode d’emploi : docs/guide-planning.md.', ui.ButtonSet.OK);
}
