// ═══════════════════════════════════════════════════════════════════════════════════════════════════════
// LOT 10a-1 — « À COMMANDER » : le petit matériel des poseurs (quincaillerie, visserie, consommables, outillage)
//
// Une demande = UN article, rattaché à AUCUN chantier : « À commander » ou « Outil en panne », quoi, quantité.
// Elle arrive comme une fiche (action « fiche », type « demande ») et suit le chemin des notes de chantier (Api.gs) :
// compte obligatoire, attente dans le téléphone tant qu'on n'est pas connecté, contrôle du téléphone partagé, pas de PDF,
// pas de mail à l'envoi, pas de recherche de photos, renvoi sans doublon (onglet « Envois »).
//
// Onglet « Demandes » : Date · Poseur · Type · Quoi · Quantité · Commandé (case) · Récapitulatif du · Compte · N° de fiche.
//   - « Récapitulatif du » VIDE = la demande n'est pas encore partie dans un mail ;
//   - une ligne se retrouve par son N° de fiche, jamais par sa position (Franck peut trier l'onglet) ;
//   - titres changés : rien n'est lu ni écrit, les téléphones gardent tout et réessaient, Franck reçoit un mail (un par jour).
//
// LE RÉCAPITULATIF (demRecapituler_), lancé par le réveil des 10 minutes à la fin de traiterComptes (Comptes.gs), sous le
// verrou que traiterComptes tient déjà (il n'est ni repris ni rendu ici) et dans son propre try/catch :
//   - du lundi au vendredi, au premier passage après DEMANDES_HEURE_LIMITE (heure de Paris, calculée ici, jamais avec le
//     fuseau du projet) : toutes les lignes au « Récapitulatif du » vide partent dans UN mail à Franck, puis la date est
//     écrite sur ces lignes, puis la marque « passage du jour fait » est posée (propriété DEMANDES_PASSAGE) ;
//   - aucune demande : aucun mail, mais la marque est posée ;
//   - mail en échec (quota épuisé, panne) : la marque n'est PAS posée, nouvel essai au passage suivant, jusqu'à
//     DEMANDES_FIN_ESSAIS ; après, on abandonne pour ce jour (marque posée, lignes laissées vides, propriété
//     DEMANDES_REPORT) : elles partent en tête du récapitulatif suivant, sous « Demandes non envoyées hier ».
// La réponse donnée au téléphone se lit sur cette MARQUE (pas sur l'horloge) : avant le passage du jour, la demande part
// aujourd'hui ; après, dans le récapitulatif suivant, dont le jour est nommé.
//
// LOT 10a-2 — L'ONGLET « ARTICLES » (facultatif) : une colonne, un article par ligne, tenu par Franck. Le serveur donne
// cette liste avec « Mes demandes » (action « demandes »), donc aux comptes connectés seulement ; le téléphone la garde et
// s'en sert pour ses propositions pendant la frappe. Onglet vide, absent, très long ou illisible : tout marche.
//
// Plan : docs/lot10-plan.md. Décisions : D10-… (DECISIONS.md).
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════
const SHEET_DEMANDES = 'Demandes';
const DEM_ENTETES = ['Date', 'Poseur', 'Type', 'Quoi', 'Quantité', 'Commandé', 'Récapitulatif du', 'Compte', 'N° de fiche'];
const COL_DEM = { date: 1, poseur: 2, type: 3, quoi: 4, quantite: 5, commande: 6, recap: 7, compte: 8, fiche: 9 };
// Tout ce qui est du texte reste du texte (« 12/11 » ne devient pas une date, « 0403 » ne perd pas son zéro)
const DEM_COLONNES_TEXTE = [COL_DEM.poseur, COL_DEM.type, COL_DEM.quoi, COL_DEM.quantite, COL_DEM.recap, COL_DEM.compte, COL_DEM.fiche];
const DEM_SORTES = { commander: 'À commander', panne: 'Outil en panne' };   // ce que le téléphone envoie → ce qui est écrit
const DEM_MAX_QUOI = 80, DEM_MAX_QUANTITE = 30;
const DEM_MAX_LISTE = 300;           // « Mes demandes » : lignes rendues au plus
const DEM_NOMS_JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const DEM_PROP_PASSAGE = 'DEMANDES_PASSAGE';   // « aaaa-mm-jj » du dernier jour dont le passage est fait
const DEM_PROP_ENVOI = 'DEMANDES_ENVOI';       // { jour, ms } : le mail de ce jour-là est parti à cet instant (même si les dates n'ont pas pu être écrites)
const DEM_PROP_REPORT = 'DEMANDES_REPORT';    // { jour, ms } : récapitulatif abandonné ce jour-là, à cet instant
// Lot 10a-2 : la liste d'articles que Franck propose à tous (facultative)
const SHEET_ARTICLES = 'Articles';
const ART_TITRE = 'Article';         // titre de la colonne A (posé par l'installation ; la liste marche aussi sans lui)
const ART_MAX = 500;                 // articles donnés au téléphone, au plus (les 500 premiers)
const ART_MAX_LIGNES = 2000;         // lignes lues dans l'onglet, au plus (un onglet très long ne ralentit pas la réponse)

// ── L'heure de Paris, calculée par le code (été comme hiver) ──
// { jour: « aaaa-mm-jj », minutes: depuis minuit, semaine: 1 (lundi) … 7 (dimanche) } de l'instant « ms »
function demHeure_(ms) {
  const m = Utilities.formatDate(new Date(ms), 'Europe/Paris', 'yyyy-MM-dd HH:mm').match(/^(\d{4}-\d{2}-\d{2}) (\d{2}):(\d{2})$/);
  if (!m) throw new Error('heure de Paris illisible');
  return { jour: m[1], minutes: Number(m[2]) * 60 + Number(m[3]), semaine: demSemaine_(m[1]) };
}
// Calculs sur un jour « aaaa-mm-jj » (un simple calendrier : aucun fuseau horaire n'entre ici)
function demDateDuJour_(jour, plus) { const p = String(jour).split('-').map(Number); return new Date(Date.UTC(p[0], p[1] - 1, p[2] + (plus || 0))); }
function demSemaine_(jour) { const n = demDateDuJour_(jour).getUTCDay(); return n === 0 ? 7 : n; }
function demJourPlus_(jour, n) { return demDateDuJour_(jour, n).toISOString().slice(0, 10); }
function demCourt_(jour) { return String(jour).slice(8, 10) + '/' + String(jour).slice(5, 7); }                    // « 23/11 »
function demLong_(jour) { return demCourt_(jour) + '/' + String(jour).slice(0, 4); }                              // « 23/11/2026 »
function demNomJour_(jour) { return DEM_NOMS_JOURS[demDateDuJour_(jour).getUTCDay()] + ' ' + demCourt_(jour); }   // « lundi 23/11 »
function demMinutes_(hhmm) { const p = String(hhmm).split(':'); return Number(p[0]) * 60 + Number(p[1]); }
function demHeureTexte_(hhmm) { const p = String(hhmm).split(':'); return Number(p[0]) + ' h ' + p[1]; }           // « 15 h 45 »
function demEstDate_(v) { return Object.prototype.toString.call(v) === '[object Date]' && !isNaN(v.getTime()); }
function demMs_(v) { return demEstDate_(v) ? v.getTime() : 0; }

// ── Lecture des cellules ──
// Case « Commandé » : une vraie case cochée, ou (colonne refaite à la main, sans case) un « oui », un « x »…
function demCommande_(v) { return v === true || /^(true|vrai|oui|o|x|ok|✓|✔)$/i.test(String(v === undefined || v === null ? '' : v).trim()); }
// « Récapitulatif du » : « jj/mm/aaaa » ('' : pas encore parti). Une date (cellule remise au format date) est relue de même.
function demRecapTexte_(v) {
  if (demEstDate_(v)) return Utilities.formatDate(v, 'Europe/Paris', 'dd/MM/yyyy');
  return String(v === undefined || v === null ? '' : v).trim();
}
function demSorte_(type) { return String(type) === DEM_SORTES.panne ? 'panne' : 'commander'; }

// ── Onglet ──
function demFormats_(sh) {
  noteFormats_(sh, DEM_COLONNES_TEXTE);
  try { sh.getRange(2, COL_DEM.date, Math.max(1, sh.getMaxRows() - 1), 1).setNumberFormat('dd/MM/yyyy HH:mm'); } catch (e) {}
}
// Titres changés (colonne déplacée, titre renommé) : le serveur ne devine rien. Rien n'est lu ni écrit, les téléphones
// gardent leurs demandes et réessaient, et Franck est prévenu par mail (une fois par jour au plus).
function demOngletVerifie_(sh) {
  if (noteTitresBons_(sh, DEM_ENTETES)) return sh;
  let fonction = 'installerLot10Production';
  try { if (environnementReel_().env === 'TEST') fonction = 'installerLot10Test'; } catch (e) {}
  alerte_('Les demandes « À commander » des poseurs sont bloquées : la ligne de titres de l’onglet « ' + SHEET_DEMANDES + ' » n’est plus celle attendue ('
    + DEM_ENTETES.join(' | ') + '). Remets ces titres, dans cet ordre ; ou renomme l’onglet, puis lance ' + fonction + ' (un onglet neuf sera créé). '
    + 'Rien n’est perdu : les demandes attendent dans les téléphones et repartent une fois les titres remis (si un téléphone affiche « à vérifier », le poseur touche « Réessayer »). Tant que ce n’est pas réparé, le récapitulatif de '
    + demHeureTexte_(DEMANDES_HEURE_LIMITE) + ' ne part pas.', 'demandes');
  throw Object.assign(new Error('L’onglet des demandes n’est pas à jour sur le serveur (titres changés, ou installation du lot 10 à faire) : le bureau est prévenu.'), { occupe: true });
}
// Pour ÉCRIRE : l'onglet est créé s'il manque, vérifié dans tous les cas
function demFeuille_() {
  const existait = !!SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_DEMANDES);
  const sh = feuille_(SHEET_DEMANDES, DEM_ENTETES);
  if (!existait) demFormats_(sh);
  return demOngletVerifie_(sh);
}
// Pour LIRE : jamais créé (null s'il n'existe pas encore), vérifié s'il existe
function demFeuilleLue_() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_DEMANDES);
  return sh ? demOngletVerifie_(sh) : null;
}
// Les lignes de l'onglet (sans les titres) qui portent un N° de fiche : [{ r: valeurs, ligne: numéro dans l'onglet }]
function demLignes_(sh) {
  const derniere = sh ? sh.getLastRow() : 0;
  const valeurs = derniere > 1 ? sh.getRange(2, 1, derniere - 1, DEM_ENTETES.length).getValues() : [];
  return valeurs.map((r, i) => ({ r: r, ligne: i + 2 })).filter(x => String(x.r[COL_DEM.fiche - 1] || '') !== '');
}
// Ligne d'une demande d'après son N° de fiche, ou 0
function demChercher_(sh, idFiche) {
  const derniere = sh ? sh.getLastRow() : 0;
  if (derniere < 2) return 0;
  const ids = sh.getRange(2, COL_DEM.fiche, derniere - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) if (String(ids[i][0]) === String(idFiche)) return i + 2;
  return 0;
}
// Demandes de ce compte arrivées AUJOURD'HUI (jour de Paris), sans compter la fiche « sauf » (un renvoi de la même)
function demNombreDuJour_(sh, idCompte, sauf) {
  const maintenant = maintenant_(), aujourdhui = demHeure_(maintenant).jour;
  return demLignes_(sh).filter(x => {
    const r = x.r, t = demMs_(r[COL_DEM.date - 1]);
    if (String(r[COL_DEM.compte - 1]) !== idCompte || String(r[COL_DEM.fiche - 1]) === String(sauf || '')) return false;
    return t > maintenant - 36 * 3600 * 1000 && demHeure_(t).jour === aujourdhui;
  }).length;
}

// ── Quand part le prochain récapitulatif ? (lu sur la MARQUE du jour, pas sur l'horloge) ──
// { aujourdhui: vrai/faux, jour: « lundi 23/11 », texte: la phrase affichée par le téléphone }
function demProchain_() {
  const t = demHeure_(maintenant_());
  const fait = propriete_(DEM_PROP_PASSAGE) === t.jour;
  // Jour ouvré, passage du jour pas encore fait, et encore temps de l'envoyer : elle part aujourd'hui
  if (t.semaine <= 5 && !fait && t.minutes < demMinutes_(DEMANDES_FIN_ESSAIS)) {
    return { aujourdhui: true, jour: demNomJour_(t.jour),
      texte: '✓ Elle part dans le récapitulatif d’aujourd’hui (vers ' + demHeureTexte_(DEMANDES_HEURE_LIMITE) + ').' };
  }
  let suivant = demJourPlus_(t.jour, 1);
  while (demSemaine_(suivant) > 5) suivant = demJourPlus_(suivant, 1);   // samedi, dimanche : lundi
  const nom = demNomJour_(suivant);
  return { aujourdhui: false, jour: nom,
    texte: fait ? '✓ Le récapitulatif d’aujourd’hui est déjà parti : elle sera dans celui de ' + nom + '.'
                : '✓ Elle sera dans le récapitulatif de ' + nom + '.' };
}
// Où en est une demande déjà écrite (renvoi par le téléphone après une réponse perdue)
function demEtatLigne_(r) {
  const recap = demRecapTexte_(r[COL_DEM.recap - 1]);
  if (!recap) return demProchain_();
  return { aujourdhui: false, jour: '', texte: '✓ Demande déjà reçue : elle est dans le récapitulatif du ' + recap.slice(0, 5) + '.' };
}
// Appelée par Api.gs pour une fiche « demande » déjà traitée (réponse « déjà reçue ») : jamais d'erreur
function demEtatFiche_(idFiche) {
  try {
    const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_DEMANDES);
    if (!sh || !noteTitresBons_(sh, DEM_ENTETES)) return null;
    const ligne = demChercher_(sh, idFiche);
    return ligne ? demEtatLigne_(sh.getRange(ligne, 1, 1, DEM_ENTETES.length).getValues()[0]) : null;
  } catch (e) { return null; }
}

// ── Contrôle AVANT tout traitement : null si tout va bien, sinon { code, message } ──
// DONNEES_INVALIDES = refus définitif (la demande reste dans le téléphone, marquée « à vérifier ») ;
// CONNEXION_REQUISE = elle attend dans le téléphone que la personne se connecte (jamais de demande sans nom).
// Peut lever une erreur « occupé » (onglet aux titres changés) : le téléphone garde la demande et réessaie.
function refusDemande_(d, compte, idFiche) {
  d = d || {};
  const refus = m => ({ code: 'DONNEES_INVALIDES', message: m });
  const CONTROLE = /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/;
  if (!compte || !compte.id) return { code: 'CONNEXION_REQUISE', message: 'Connectez-vous depuis l’accueil : c’est gardé dans le téléphone et partira ensuite.' };
  if (!Object.prototype.hasOwnProperty.call(DEM_SORTES, d.sorte)) return refus('Choix manquant : « À commander » ou « Outil en panne »');
  if (typeof d.quoi !== 'string') return refus('« Quoi ? » manquant');
  if (d.quantite !== undefined && d.quantite !== null && typeof d.quantite !== 'string') return refus('Quantité invalide');
  const quoi = noteLigne_(d.quoi), quantite = noteLigne_(d.quantite || '');
  if (!quoi) return refus('« Quoi ? » est vide : écris ce qu’il faut');
  if (quoi.length > DEM_MAX_QUOI) return refus('« Quoi ? » trop long (' + DEM_MAX_QUOI + ' caractères au plus)');
  if (quantite.length > DEM_MAX_QUANTITE) return refus('Quantité trop longue (' + DEM_MAX_QUANTITE + ' caractères au plus)');
  if (CONTROLE.test(quoi) || CONTROLE.test(quantite)) return refus('Texte invalide');
  const sh = demFeuilleLue_();
  if (sh && demNombreDuJour_(sh, compte.id, idFiche) >= DEMANDES_MAX_PAR_JOUR) {
    return refus(DEMANDES_MAX_PAR_JOUR + ' demandes par jour au plus : pour le reste, appelle le bureau (ou touche « Réessayer » demain)');
  }
  return null;
}

// ── Réception d'une demande (appelée par traiterFiche_) ──
// contexte : { id (numéro de la fiche), compte (profil vérifié par le jeton) }. Rend { recap } : quand elle partira.
function traiterDemande(data, brut, contexte) {
  if (!contexte || !contexte.id) throw new Error('Demande refusée : numéro de fiche absent (page trop ancienne)');
  const compte = contexte.compte;
  const verrou = LockService.getScriptLock();
  if (!verrou.tryLock(15000)) throw noteOccupe_();
  try {
    const sh = demFeuille_();
    const deja = demChercher_(sh, contexte.id);   // déjà écrite (nouvel essai après une coupure) : rien à refaire, la case n'est pas touchée
    if (deja) return { recap: demEtatLigne_(sh.getRange(deja, 1, 1, DEM_ENTETES.length).getValues()[0]) };
    const refus = refusDemande_(brut, compte, contexte.id);   // recontrôlé sous verrou (deux demandes au même instant)
    if (refus) throw noteRefus_(refus.message);
    const ligne = [];
    for (let c = 1; c <= DEM_ENTETES.length; c++) ligne.push('');
    ligne[COL_DEM.date - 1] = new Date(maintenant_());
    ligne[COL_DEM.poseur - 1] = compte.nom || compte.id;
    ligne[COL_DEM.type - 1] = DEM_SORTES[brut.sorte];
    ligne[COL_DEM.quoi - 1] = noteLigne_(brut.quoi);
    ligne[COL_DEM.quantite - 1] = noteLigne_(brut.quantite || '');
    ligne[COL_DEM.compte - 1] = compte.id;
    ligne[COL_DEM.fiche - 1] = contexte.id;
    const numero = noteAjouterLigne_(sh, ligne, DEM_COLONNES_TEXTE);   // textes passés par cellule_ (jamais une formule)
    // La case « Commandé », posée sur CETTE ligne seulement. Si elle ne peut pas l'être, la demande est notée quand même
    // (la lecture accepte une cellule sans case).
    try { sh.getRange(numero, COL_DEM.commande).insertCheckboxes(); } catch (e) { console.error('case Commandé :', e.message); }
    // L'écriture est POUSSÉE dans le Sheet avant de rendre le verrou : sans cela, la demande suivante (un autre téléphone,
    // au même instant) pourrait lire « dernière ligne » avant que celle-ci y soit, et s'écrire par-dessus.
    SpreadsheetApp.flush();
    // La demande est notée : si le calcul du prochain récapitulatif échoue, elle n'est pas refusée pour autant
    let recap = null;
    try { recap = demProchain_(); } catch (e) { console.error('prochain récapitulatif :', e.message); }
    return { recap: recap };
  } finally { verrou.releaseLock(); }
}

// ── « Mes demandes » : celles du compte, 90 jours, les plus récentes d'abord ──
function demObjet_(r) {
  const recap = demRecapTexte_(r[COL_DEM.recap - 1]), commande = demCommande_(r[COL_DEM.commande - 1]);
  return { id: String(r[COL_DEM.fiche - 1]), date: demMs_(r[COL_DEM.date - 1]), sorte: demSorte_(r[COL_DEM.type - 1]), type: String(r[COL_DEM.type - 1] || ''),
    quoi: String(r[COL_DEM.quoi - 1] || ''), quantite: String(r[COL_DEM.quantite - 1] || ''),
    etat: commande ? 'commande' : (recap ? 'recap' : 'attente'),
    etatTexte: commande ? '✓ Commandé' : (recap ? 'récapitulatif du ' + recap.slice(0, 5) : 'partira dans le prochain récapitulatif') };
}
function listerDemandes_(compte, corps) {
  let sh;
  try { sh = demFeuilleLue_(); }
  catch (err) { if (err && err.occupe) return avecJeton_({ ok: false, code: 'SERVEUR_OCCUPE', message: err.message }, compte); throw err; }
  const maintenant = maintenant_(), limite = maintenant - DEMANDES_JOURS_LISTE * 24 * 3600 * 1000;
  const miennes = demLignes_(sh).map(x => x.r)
    .filter(r => String(r[COL_DEM.compte - 1]) === compte.id && demMs_(r[COL_DEM.date - 1]) >= limite)
    .map((r, i) => ({ r: r, i: i })).sort((a, b) => (demMs_(b.r[COL_DEM.date - 1]) - demMs_(a.r[COL_DEM.date - 1])) || (b.i - a.i)).map(x => x.r);
  const prochain = demProchain_();
  const data = { demandes: miennes.slice(0, DEM_MAX_LISTE).map(demObjet_), plein: miennes.length > DEM_MAX_LISTE,
    prochain: { aujourdhui: prochain.aujourdhui, jour: prochain.jour }, heure: maintenant };
  // Lot 10a-2 : la liste « Articles ». Le téléphone dit quelle liste il garde déjà (corps.articles : son empreinte, '' s'il
  // n'en a pas) ; elle n'est renvoyée que si elle a changé. Une page d'avant le lot 10a-2 ne dit rien : rien de plus pour elle.
  if (corps && typeof corps.articles === 'string') {
    const articles = demArticles_();
    if (articles) {
      data.articlesEmpreinte = articles.empreinte;
      if (articles.empreinte !== corps.articles) data.articles = articles.liste;
    }
  }
  return avecJeton_({ ok: true, code: 'OK', message: miennes.length + ' demande(s)', data: data }, compte);
}

// ── Lot 10a-2 : la liste « Articles » ──
// Deux textes sont « le même article » s'ils ne diffèrent que par les majuscules, les accents, « x » ou « × », les espaces.
// (La même règle que dans le téléphone : commun/commander.js, D.cle.)
function demCleArticle_(t) {
  return String(t).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/×/g, 'x').replace(/œ/g, 'oe').replace(/æ/g, 'ae')
    .replace(/(\d)\s*x\s*(?=\d)/g, '$1x').replace(/\s+/g, ' ').trim();
}
// Empreinte courte de la liste : le téléphone ne la retélécharge que si elle a changé
function demEmpreinte_(liste) {
  const t = liste.join('\n');
  let h = 5381;
  for (let i = 0; i < t.length; i++) h = ((h * 33) ^ t.charCodeAt(i)) >>> 0;
  return liste.length + '-' + h.toString(36);
}
// { liste: [textes], empreinte, trop: vrai si l'onglet a plus d'articles que ce qui est donné } ; onglet absent ou vide :
// liste vide ; onglet illisible : null (le téléphone garde alors la liste qu'il a déjà).
// Un article par ligne, colonne A, lu tel qu'il est AFFICHÉ dans le Sheet (« 4×40 » reste « 4×40 ») ; une seule ligne de
// texte, DEM_MAX_QUOI caractères au plus (le reste est coupé) ; doublons retirés ; une première ligne « Article » est un titre.
function demArticles_() {
  try {
    const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_ARTICLES);
    const derniere = sh ? sh.getLastRow() : 0, lues = Math.min(derniere, ART_MAX_LIGNES);
    const valeurs = lues > 0 ? sh.getRange(1, 1, lues, 1).getDisplayValues() : [];
    const vus = {}, liste = [];
    let trop = derniere > lues;
    for (let i = 0; i < valeurs.length; i++) {
      const texte = noteLigne_(String(valeurs[i][0] === undefined || valeurs[i][0] === null ? '' : valeurs[i][0]))
        .replace(/[\u0000-\u001f\u007f-\u009f]/g, '').slice(0, DEM_MAX_QUOI).trim();
      const cle = demCleArticle_(texte);
      if (!cle || vus[cle]) continue;
      if (i === 0 && /^articles?$/.test(cle)) continue;                                        // la ligne de titre
      if (/^#(REF!|N\/A|NAME\?|VALUE!|DIV\/0!|ERROR!|NUM!|NULL!)$/.test(texte)) continue;   // une formule en erreur n'est pas un article
      if (liste.length >= ART_MAX) { trop = true; break; }
      vus[cle] = true;
      liste.push(texte);
    }
    return { liste: liste, empreinte: demEmpreinte_(liste), trop: trop };
  } catch (err) {
    console.error('onglet « ' + SHEET_ARTICLES + ' » :', err && err.message ? err.message : err);
    return null;
  }
}

// ── Le récapitulatif ──
// Le mail : { sujet, texte, html }. lignes : [{ r }] au « Récapitulatif du » vide ; report : { jour, ms } ou null.
function demMail_(lignes, jour, report) {
  const anciennes = report ? lignes.filter(x => demMs_(x.r[COL_DEM.date - 1]) <= report.ms) : [];
  const duJour = lignes.filter(x => anciennes.indexOf(x) < 0);
  const parPoseur = l => l.slice().sort((a, b) => String(a.r[COL_DEM.poseur - 1]).localeCompare(String(b.r[COL_DEM.poseur - 1]))
    || (demMs_(a.r[COL_DEM.date - 1]) - demMs_(b.r[COL_DEM.date - 1])) || (a.ligne - b.ligne));
  const champs = x => [String(x.r[COL_DEM.poseur - 1] || ''), String(x.r[COL_DEM.quoi - 1] || ''),
    String(x.r[COL_DEM.quantite - 1] || '') + (demCommande_(x.r[COL_DEM.commande - 1]) ? (x.r[COL_DEM.quantite - 1] ? ' ' : '') + '(déjà commandé)' : '')];
  const texte = [], html = [];
  const cellule = 'style="padding:3px 14px 3px 0;vertical-align:top"';
  const partie = (titre, l, retrait) => {
    if (!l.length) return;
    texte.push(retrait + titre);
    html.push('<tr><td colspan="3" style="padding:10px 0 3px"><b>' + esc_(titre) + '</b></td></tr>');
    parPoseur(l).forEach(x => {
      const c = champs(x);
      texte.push(retrait + '  ' + c.filter(Boolean).join(' — '));
      html.push('<tr><td ' + cellule + '>' + esc_(c[0]) + '</td><td ' + cellule + '>' + esc_(c[1]) + '</td><td ' + cellule + '>' + esc_(c[2]) + '</td></tr>');
    });
  };
  const deuxParties = (l, retrait) => {
    partie('À COMMANDER', l.filter(x => demSorte_(x.r[COL_DEM.type - 1]) === 'commander'), retrait);
    partie('OUTIL EN PANNE', l.filter(x => demSorte_(x.r[COL_DEM.type - 1]) === 'panne'), retrait);
  };
  if (anciennes.length) {
    const titre = 'DEMANDES NON ENVOYÉES ' + (report.jour === demJourPlus_(jour, -1) ? 'HIER' : 'DU ' + demCourt_(report.jour));
    texte.push(titre);
    html.push('<tr><td colspan="3" style="padding:10px 0 0;color:#B32E2E"><b>' + esc_(titre) + '</b></td></tr>');
    deuxParties(anciennes, '  ');
    if (duJour.length) { texte.push(''); texte.push('DEMANDES DU JOUR'); html.push('<tr><td colspan="3" style="padding:14px 0 0;color:#1A2B4A"><b>DEMANDES DU JOUR</b></td></tr>'); }
    deuxParties(duJour, duJour.length ? '  ' : '');
  } else deuxParties(duJour, '');
  const n = lignes.length;
  const pied = 'Quand c’est commandé : coche la case « Commandé » de l’onglet « ' + SHEET_DEMANDES + ' » du Sheet. Le poseur voit alors « ✓ Commandé » dans son téléphone.';
  return { sujet: 'À commander — ' + demNomJour_(jour) + ' (' + n + (n > 1 ? ' demandes' : ' demande') + ')',
    texte: texte.join('\n') + '\n\n' + pied + '\n\nLoué App',
    html: '<table style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:14px">' + html.join('') + '</table>'
      + '<p style="font-family:Arial,sans-serif;font-size:13px;color:#555">' + esc_(pied) + '<br><br>Loué App</p>' };
}
// Écrit la date du récapitulatif sur les demandes parties. Les lignes sont RETROUVÉES par leur N° de fiche juste avant
// l'écriture (l'onglet a pu être trié pendant l'envoi du mail), et seules les cellules encore vides sont écrites.
function demMarquer_(sh, fiches, date) {
  const voulues = {};
  fiches.forEach(f => { voulues[f] = true; });
  demLignes_(sh).forEach(x => {
    if (!voulues[String(x.r[COL_DEM.fiche - 1])] || demRecapTexte_(x.r[COL_DEM.recap - 1])) return;
    sh.getRange(x.ligne, COL_DEM.recap).setNumberFormat('@').setValue(date);
  });
}
// À APPELER SOUS LE VERROU DU SCRIPT (traiterComptes le tient déjà). Rend un mot qui dit ce qui s'est passé.
function demRecapituler_() {
  const maintenant = maintenant_(), t = demHeure_(maintenant);
  if (t.semaine > 5) return 'week-end';
  if (t.minutes < demMinutes_(DEMANDES_HEURE_LIMITE)) return 'avant l’heure';
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty(DEM_PROP_PASSAGE) === t.jour) return 'déjà fait';
  const tropTard = t.minutes >= demMinutes_(DEMANDES_FIN_ESSAIS);
  let sh = null, lignes = [], illisible = '';
  try { sh = demFeuilleLue_(); lignes = demLignes_(sh).filter(x => !demRecapTexte_(x.r[COL_DEM.recap - 1])); }
  catch (err) { illisible = String(err && err.message ? err.message : err); }
  // Trop tard pour commander aujourd'hui : on abandonne pour ce jour. Les lignes restent vides : elles partiront en tête
  // du récapitulatif suivant (« Demandes non envoyées hier »).
  const abandonner = pourquoi => {
    props.setProperty(DEM_PROP_REPORT, JSON.stringify({ jour: t.jour, ms: maintenant }));
    props.setProperty(DEM_PROP_PASSAGE, t.jour);
    journal_({ fiche: 'récapitulatif « À commander »' }, emailAdmin_(), 'reporté', 'pas parti avant ' + demHeureTexte_(DEMANDES_FIN_ESSAIS)
      + ' (' + pourquoi + ') : ses demandes seront en tête du récapitulatif suivant');
    return 'abandonné';
  };
  if (illisible) return tropTard ? abandonner('onglet « ' + SHEET_DEMANDES + ' » illisible') : 'onglet illisible';
  // Le mail d'aujourd'hui est DÉJÀ parti, mais la date n'a pas pu être écrite sur ses lignes (panne entre les deux) :
  // on refait seulement l'écriture, sans renvoyer de mail. Seules les demandes arrivées avant l'envoi sont datées ;
  // celles arrivées depuis partiront dans le récapitulatif suivant.
  let envoi = null;
  try { envoi = JSON.parse(props.getProperty(DEM_PROP_ENVOI) || 'null'); } catch (e) {}
  if (envoi && envoi.jour === t.jour && Number(envoi.ms) > 0) {
    const parties = lignes.filter(x => demMs_(x.r[COL_DEM.date - 1]) <= Number(envoi.ms));
    demMarquer_(sh, parties.map(x => String(x.r[COL_DEM.fiche - 1])), demLong_(t.jour));
    SpreadsheetApp.flush();
    props.deleteProperty(DEM_PROP_REPORT);
    props.setProperty(DEM_PROP_PASSAGE, t.jour);
    return 'dates écrites (' + parties.length + '), mail déjà parti';
  }
  if (!lignes.length) {   // aucune demande : aucun mail, mais le passage du jour est fait
    props.deleteProperty(DEM_PROP_REPORT);
    props.setProperty(DEM_PROP_PASSAGE, t.jour);
    return 'rien';
  }
  if (tropTard) return abandonner(lignes.length + ' demande(s) en attente');
  let report = null;
  try { report = JSON.parse(props.getProperty(DEM_PROP_REPORT) || 'null'); } catch (e) {}
  if (!report || typeof report.jour !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(report.jour) || !(Number(report.ms) > 0)) report = null;
  const mail = demMail_(lignes, t.jour, report);
  const echec = mailBureau_(mail.sujet, mail.texte, mail.html);
  if (echec) return 'mail non parti (' + echec + ')';   // la marque n'est PAS posée : nouvel essai au passage suivant
  // Le mail est parti. On le note tout de suite (une panne pendant l'écriture des dates ne le fera pas repartir : le passage
  // suivant ne refera que l'écriture), puis la date sur les lignes, POUSSÉE dans le Sheet, et enfin la marque du jour.
  props.setProperty(DEM_PROP_ENVOI, JSON.stringify({ jour: t.jour, ms: maintenant }));
  demMarquer_(sh, lignes.map(x => String(x.r[COL_DEM.fiche - 1])), demLong_(t.jour));
  SpreadsheetApp.flush();
  props.deleteProperty(DEM_PROP_REPORT);
  props.setProperty(DEM_PROP_PASSAGE, t.jour);
  return 'envoyé (' + lignes.length + ')';
}

// ── Contrôles du lot 10, ajoutés à verifierConfig() ──
function verifierDemandes_() {
  const lignes = [];
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_DEMANDES);
  const bon = !!sh && noteTitresBons_(sh, DEM_ENTETES);
  lignes.push((bon ? '✅ ' : '❌ ') + 'Onglet « ' + SHEET_DEMANDES + ' » (sinon lancer installerLot10Test ou installerLot10Production)');
  let attente = '';
  try { if (bon) attente = ' ; demandes en attente du prochain : ' + demLignes_(sh).filter(x => !demRecapTexte_(x.r[COL_DEM.recap - 1])).length; } catch (e) {}
  const passage = propriete_(DEM_PROP_PASSAGE);
  lignes.push('Récapitulatif « À commander » : du lundi au vendredi, au premier passage du réveil des 10 minutes (traiterComptes) après '
    + demHeureTexte_(DEMANDES_HEURE_LIMITE) + ' ; dernier passage fait : ' + (/^\d{4}-\d{2}-\d{2}$/.test(passage) ? demLong_(passage) : 'jamais') + attente);
  let report = null;
  try { report = JSON.parse(propriete_(DEM_PROP_REPORT) || 'null'); } catch (e) {}
  if (report && /^\d{4}-\d{2}-\d{2}$/.test(String(report.jour))) lignes.push('⚠ Le récapitulatif du ' + demLong_(report.jour) + ' n’a pas pu partir : ses demandes seront en tête du suivant');
  // Lot 10a-2 : la liste « Articles » (facultative : son absence n'est pas une erreur)
  if (!SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_ARTICLES)) {
    lignes.push('➖ Onglet « ' + SHEET_ARTICLES + ' » : absent (facultatif ; installerLot10Test ou installerLot10Production le crée, vide)');
  } else {
    const articles = demArticles_();
    lignes.push(!articles ? '❌ Onglet « ' + SHEET_ARTICLES + ' » : illisible (les téléphones gardent la liste qu’ils ont déjà)'
      : '✅ Onglet « ' + SHEET_ARTICLES + ' » : ' + articles.liste.length + ' article(s) proposé(s) aux poseurs pendant la frappe'
        + (articles.trop ? ' — ⚠ liste trop longue : seuls les ' + ART_MAX + ' premiers articles (lus dans les ' + ART_MAX_LIGNES + ' premières lignes) sont proposés' : ''));
  }
  return lignes.join('\n');
}

// ── Installation du lot 10 (une fonction par environnement ; relançable sans danger) ──
function etapesLot10_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return [{
    nom: 'Onglet « ' + SHEET_DEMANDES + ' »',
    fait: () => { const sh = ss.getSheetByName(SHEET_DEMANDES); return !!sh && noteTitresBons_(sh, DEM_ENTETES); },
    action: () => {
      const sh = ss.getSheetByName(SHEET_DEMANDES);
      if (!sh) { demFormats_(feuille_(SHEET_DEMANDES, DEM_ENTETES)); return 'onglet créé'; }
      // Onglet déjà là : jamais rien réécrire par-dessus des données
      const titres = sh.getRange(1, 1, 1, Math.max(DEM_ENTETES.length, sh.getLastColumn())).getValues()[0];
      if (sh.getLastRow() > 1 || titres.some(t => String(t === undefined || t === null ? '' : t).trim() !== '')) throw new Error('un onglet « ' + SHEET_DEMANDES + ' » existe déjà avec d’autres titres : le renommer, puis relancer');
      sh.getRange(1, 1, 1, DEM_ENTETES.length).setValues([DEM_ENTETES]);
      demFormats_(sh);
      return 'onglet prêt';
    } },
  // Lot 10a-2 : la liste d'articles proposés à tous. Créé VIDE (un titre, rien d'autre) ; s'il existe déjà, il n'est jamais touché.
  { nom: 'Onglet « ' + SHEET_ARTICLES + ' » (facultatif : ta liste d’articles proposés pendant la frappe)',
    fait: () => !!ss.getSheetByName(SHEET_ARTICLES),
    action: () => {
      const sh = feuille_(SHEET_ARTICLES, [ART_TITRE]);
      // colonne au format texte (« 12/11 » ne devient pas une date), assez large pour lire un article
      try { sh.getRange(2, 1, Math.max(1, sh.getMaxRows() - 1), 1).setNumberFormat('@'); sh.setColumnWidth(1, 360); } catch (e) {}
      return 'onglet créé, vide : un article par ligne, dans la colonne A';
    } },
  // Le récapitulatif est lancé par le réveil des 10 minutes. Sur TEST, les réveils ne sont posés que pendant les essais
  // (les 90 minutes par jour sont partagées avec la production).
  { nom: 'Réveil des 10 minutes (traiterComptes), qui lance le récapitulatif', seulement: 'PRODUCTION',
    fait: () => ScriptApp.getProjectTriggers().some(d => d.getHandlerFunction() === 'traiterComptes'),
    action: () => installerDeclencheurs() }];
}
function installerLot10_(attendu) {
  const r = installer_('Lot 10', attendu, etapesLot10_());
  let infos = '';
  if (r.ok) {
    infos = '\nRécapitulatif « À commander » : du lundi au vendredi, au premier passage après ' + demHeureTexte_(DEMANDES_HEURE_LIMITE)
      + ' (heure de Paris), un mail à l’adresse du bureau. Aucun mail s’il n’y a aucune demande.'
      + '\nOnglet « ' + SHEET_ARTICLES + ' » : facultatif. Un article par ligne dans la colonne A (' + ART_MAX + ' au plus, ' + DEM_MAX_QUOI
      + ' caractères au plus) : ils sont proposés aux poseurs pendant la frappe. Vide, tout marche quand même.'
      + (attendu === 'TEST' ? '\nCopie TEST : pour recevoir ce mail, pose les réveils le temps de l’essai (installerDeclencheurs), puis retire-les (retirerDeclencheurs).' : '');
    Logger.log(infos);
  }
  return r.texte + infos;
}
function installerLot10Test() { return installerLot10_('TEST'); }
function installerLot10Production() { return installerLot10_('PRODUCTION'); }
