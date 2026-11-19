// ═══════════════════════════════════════════════════════════════════════════════════════════════════════
// LOT 12a — RÉGLAGES : « Tous les comptes ouvrent tous les chantiers »
//
// Décision de Franck (19/11/2026) : tout gars qui a un compte peut ouvrir tous les chantiers (carnet, documents, notes,
// récapitulatif, fiches). Sans compte : rien, comme avant. C'est un RÉGLAGE allumé / éteint, pour pouvoir revenir en arrière.
//   - le réglage est UNE CASE À COCHER de l'onglet « Réglages » (posé par installerLot12Test / installerLot12Production) ;
//   - il est LIVRÉ ÉTEINT : sans onglet, sans la ligne, ou case décochée, tout se passe exactement comme avant ce lot ;
//   - il est lu à chaque requête : cocher ou décocher agit tout de suite, sans rien redéployer ;
//   - tout ce qui n'est pas « une seule ligne à ce nom, case cochée » vaut ÉTEINT (un texte « oui », deux lignes, un
//     onglet illisible) : dans le doute, l'appli reste fermée ;
//   - il n'est lu qu'à DEUX endroits : chantiersVisibles_ et peutLireChantier_ (Comptes.gs). Toutes les lectures par
//     chantier (documents, notes, carnet, récapitulatif) passent par ces deux fonctions ;
//   - les cases de l'onglet « Accès chantiers » sont GARDÉES : éteindre le réglage leur rend leur effet, telles quelles.
// Ce que le réglage ne change pas : conducteurs et admin (tout, comme avant), comptes inactifs et sans compte (rien),
// signalements (droits par rôle, pas par chantier).
// Plan : docs/lot12-plan.md. Décisions : D12-… (DECISIONS.md).
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════
const SHEET_REGLAGES = 'Réglages';
const REGLAGES_ENTETES = ['Réglage', 'Allumé', 'État (écrit par l’appli)'];
const REGLAGE_TOUS = 'Tous les comptes ouvrent tous les chantiers';
const REGLAGE_PROP_VU = 'REGLAGE_TOUS_VU';     // ce que le dernier passage a vu : « 1|<heure> » ou « 0|<heure> »
const ACCES_TITRE_REMARQUE = 'Remarque (appli)';
const ACCES_SANS_EFFET = ACCES_TITRE_REMARQUE + ' — CASES SANS EFFET : le réglage « ' + REGLAGE_TOUS + ' » est allumé (onglet ' + SHEET_REGLAGES + ')';

let REGLAGE_TOUS_LU_ = null;   // lu une fois par requête (remis à zéro par routerV5_ et par traiterComptes)

// La ligne du réglage dans l'onglet : { sh, ligne (numéro), coche (vrai seulement si la case est cochée) }, ou null
function reglageLigne_() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_REGLAGES);
  if (!sh || sh.getLastRow() < 2) return null;
  const lignes = sh.getRange(2, 1, Math.min(50, sh.getLastRow() - 1), 2).getValues();
  const trouvees = [];
  lignes.forEach((r, i) => { if (String(r[0]).trim() === REGLAGE_TOUS) trouvees.push({ sh: sh, ligne: i + 2, coche: r[1] === true }); });
  return trouvees.length === 1 ? trouvees[0] : null;
}
// Vrai si le réglage est allumé. Ne lève jamais d'erreur : illisible = éteint.
function tousChantiersOuverts_() {
  if (REGLAGE_TOUS_LU_ !== null) return REGLAGE_TOUS_LU_;
  let allume = false;
  try { const l = reglageLigne_(); allume = !!l && l.coche === true; }
  catch (e) { console.error('tousChantiersOuverts_ :', e.message); }
  REGLAGE_TOUS_LU_ = allume;
  return allume;
}

// ── Le passage de 10 minutes écrit ce que l'appli a compris, pour que Franck le voie (appelé par traiterComptes, sous son verrou) ──
function reglagesEtat_() {
  try {
    REGLAGE_TOUS_LU_ = null;
    const l = reglageLigne_();
    if (!l) return;
    const allume = l.coche === true;
    const props = PropertiesService.getScriptProperties();
    const vu = String(props.getProperty(REGLAGE_PROP_VU) || '').split('|');
    if (vu[0] === (allume ? '1' : '0')) return;                       // rien n'a changé : rien n'est écrit
    const quand = maintenant_();
    props.setProperty(REGLAGE_PROP_VU, (allume ? '1' : '0') + '|' + quand);
    l.sh.getRange(l.ligne, 3).setValue(allume
      ? 'Allumé depuis le ' + texteDate_(quand) + ' : tout compte actif ouvre tous les chantiers'
      : (vu[0] === '1' ? 'Éteint depuis le ' + texteDate_(quand) : 'Éteint') + ' : chacun voit les chantiers cochés dans « ' + SHEET_ACCES + ' »');
    // Dans l'onglet des cases : dire qu'elles sont sans effet, pour que Franck ne coche pas pour rien
    const acces = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_ACCES);
    if (acces && acces.getLastColumn() >= 2) acces.getRange(1, 2).setValue(allume ? ACCES_SANS_EFFET : ACCES_TITRE_REMARQUE);
  } catch (e) { console.error('reglagesEtat_ :', e.message); }
}

// ── Installation du lot 12 (une fonction par environnement ; relançable sans danger) ──
function etapesLot12_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return [{
    nom: 'Onglet « ' + SHEET_REGLAGES + ' » et sa ligne « ' + REGLAGE_TOUS + ' » (case décochée)',
    fait: () => !!reglageLigne_(),
    action: () => {
      const existait = !!ss.getSheetByName(SHEET_REGLAGES);
      const sh = feuille_(SHEET_REGLAGES, REGLAGES_ENTETES);
      // Jamais deux lignes du même réglage : une ligne en double vaut « éteint », elle est signalée, pas corrigée
      if (sh.getLastRow() >= 2 && sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues().some(r => String(r[0]).trim() === REGLAGE_TOUS)) {
        throw new Error('l’onglet « ' + SHEET_REGLAGES + ' » contient plusieurs lignes « ' + REGLAGE_TOUS + ' » : n’en garder qu’une');
      }
      const ligne = sh.getLastRow() + 1;
      sh.getRange(ligne, 1).setValue(REGLAGE_TOUS);
      sh.getRange(ligne, 2).insertCheckboxes();
      sh.getRange(ligne, 3).setValue('Éteint');
      try { sh.setColumnWidth(1, 380); sh.setColumnWidth(3, 520); } catch (e) {}
      return existait ? 'ligne ajoutée (éteinte)' : 'onglet créé, réglage éteint';
    } }];
}
function installerLot12_(attendu) { return installer_('Lot 12', attendu, etapesLot12_()).texte; }
function installerLot12Test() { return installerLot12_('TEST'); }
function installerLot12Production() { return installerLot12_('PRODUCTION'); }
