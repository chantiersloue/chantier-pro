// ═══════════════════════════════════════════════════════════════════════════════════════════════════════
// LOT 8 — COMPTES RENDUS : l'onglet « Comptes rendus » (une ligne par note de réunion) et les POINTS suivis
//
// Un compte rendu se désigne par sa DATE DE RÉUNION (« compte rendu du 06/11/2026 ») : il n'a pas de numéro
// (décision de Franck du 16/11/2026).
//   - la ligne est écrite EN UNE FOIS, à la réception de la note, sous verrou ;
//   - une note renvoyée par le téléphone (réponse perdue, PDF raté au premier essai) n'est jamais notée deux fois :
//     la ligne est cherchée par le numéro de fiche créé par le téléphone ;
//   - l'ordre des comptes rendus d'un chantier est l'ordre d'ARRIVÉE au serveur (colonne « Reçu le ») ;
//   - rattachement au chantier : par son N° (onglet Chantiers, colonne E) quand il est rempli, sinon par son nom
//     (minuscules, espaces retirés). Un chantier renommé garde donc sa suite s'il a un N° ;
//   - onglet aux titres changés ou illisible : rien n'y est lu ni écrit, la note part quand même (PDF et mails normaux),
//     Franck est prévenu une fois par jour. Un onglet de suivi ne bloque jamais l'envoi d'une note.
//
// LES POINTS (lot 8c). Une note est faite de points, ouverts ou clos. Les points ouverts d'un chantier sont gardés dans la
// ligne du DERNIER compte rendu arrivé (colonnes « Données de l'appli »). Le téléphone n'envoie pas « l'état des points »
// mais CE QUE LA PERSONNE A FAIT, point par point : « rien », « complete », « clos », « rouvert », « nouveau ». Le serveur
// prend la liste de la dernière ligne du chantier, applique les gestes, écrit la nouvelle liste dans la nouvelle ligne.
// Une liste périmée dans un téléphone ne peut donc rien défaire : elle ne porte aucun geste sur ce qu'elle ignore.
//   - « le compte rendu d'où venait la liste » est désigné par son NUMÉRO DE FICHE (champ « base » de la note) ;
//   - gestes sur des points existants : seulement avec un compte qui a accès au chantier ; sinon seuls les nouveaux points
//     sont pris. Une note n'est JAMAIS refusée ;
//   - un point clos reste « rouvrable » pendant les 3 comptes rendus suivants du chantier.
// Plan : docs/lot8-plan.md. Décisions : D8-… (DECISIONS.md).
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════
const SHEET_CR = 'Comptes rendus';
const CR_ENTETES_8B = ['Numéro de fiche', 'Chantier', 'N° du chantier', 'Date de la réunion', 'Objet',
  'Rédigé par', 'Compte qui a envoyé', 'Nom du PDF', 'Reçu le', 'Remarque de l’appli'];
const CR_ENTETES = CR_ENTETES_8B.concat(['Points ouverts après cette note', 'Points clos par cette note',
  'Données de l’appli (ne pas modifier)', 'Données de l’appli (suite)']);
const COL_CR = { fiche: 1, chantier: 2, numChantier: 3, date: 4, objet: 5, auteur: 6, compte: 7, pdf: 8, recu: 9, remarque: 10,
  ouverts: 11, clos: 12, donnees: 13, suite: 14 };
// Tout ce qui est du texte saisi reste du texte (une date « 12/11 » ou un numéro « 0403 » ne sont pas transformés)
const CR_COLONNES_TEXTE = [COL_CR.fiche, COL_CR.chantier, COL_CR.numChantier, COL_CR.date, COL_CR.objet, COL_CR.auteur, COL_CR.compte, COL_CR.pdf,
  COL_CR.remarque, COL_CR.ouverts, COL_CR.clos, COL_CR.donnees, COL_CR.suite];
const CR_GESTES = ['rien', 'complete', 'clos', 'rouvert', 'nouveau'];
const CR_MAX_TEXTE = 2000;        // caractères par point
const CR_MAX_NOUVEAUX = 40;       // nouveaux points suivis par note
const CR_MAX_GESTES = 400;        // gestes lus par note (points repris + nouveaux)
const CR_CLOS_GARDES = 3;         // un point clos reste rouvrable pendant ce nombre de comptes rendus
const CR_MAX_CELLULE = 45000;     // caractères par cellule (Google en accepte 50 000)
const CR_MAX_FERMES = 300;        // identifiants des points clos depuis longtemps, gardés pour ne pas les rouvrir par erreur
const CR_REFUS_LECTURE = 'Ce chantier ne fait pas partie de vos chantiers : voyez avec le bureau.';

// ── Petits outils ──
function crOccupe_(message) { return Object.assign(new Error(message || 'Serveur occupé, nouvel essai automatique'), { occupe: true }); }
// Texte d'une ligne : ni retour à la ligne, ni caractère invisible
function crLigne_(v, max) {
  return typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]+/g, ' ').replace(/ {2,}/g, ' ').trim().slice(0, max) : '';
}
// Texte d'un point : les retours à la ligne sont gardés, les caractères invisibles retirés, 2 000 caractères au plus
function crTexte_(v) {
  if (typeof v !== 'string') return '';
  return v.replace(/\r\n?|[\u2028\u2029]/g, '\n').replace(/[\u0000-\u0009\u000b-\u001f\u007f-\u009f]+/g, ' ').replace(/[ ]{2,}/g, ' ')
    .replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, CR_MAX_TEXTE).trim();
}
// Clé d'un nom de chantier : minuscules, espaces retirés
function crCleNom_(nom) { return String(nom || '').toLowerCase().replace(/\s+/g, ''); }
function crCleNumero_(n) { return String(n === undefined || n === null ? '' : n).trim().toLowerCase().replace(/\s+/g, ''); }
// Date « jj/mm/aaaa » → nombre comparable (aaaammjj), 0 si illisible
function crJour_(texte) {
  const m = String(texte || '').match(/^\s*(\d{1,2})\/(\d{1,2})\/(\d{4})\s*$/);
  return m ? Number(m[3]) * 10000 + Number(m[2]) * 100 + Number(m[1]) : 0;
}
// Heure (millisecondes) d'une cellule de date, 0 si ce n'en est pas une
function crMs_(v) { return Object.prototype.toString.call(v) === '[object Date]' && !isNaN(v.getTime()) ? v.getTime() : 0; }
// Identifiant d'un point : créé une fois par le téléphone, le même d'une note à l'autre
function crIdPoint_(v) { const s = typeof v === 'string' ? v : ''; return /^[A-Za-z0-9-]{6,40}$/.test(s) ? s : ''; }
function crNouvelId_() { return 'pt-srv-' + Utilities.getUuid().replace(/-/g, '').slice(0, 16); }

// ── Onglet : créé s'il n'existe pas, VÉRIFIÉ avant toute lecture et toute écriture ──
function crTitresBons_(sh) {
  if (sh.getLastColumn() < CR_ENTETES.length) return false;
  const titres = sh.getRange(1, 1, 1, CR_ENTETES.length).getValues()[0];
  return CR_ENTETES.every((t, i) => String(titres[i]) === t);
}
function crFormats_(sh) {
  const lignes = Math.max(1, sh.getMaxRows() - 1);
  CR_COLONNES_TEXTE.forEach(c => sh.getRange(2, c, lignes, 1).setNumberFormat('@'));
}
// Titres changés à la main : rien n'est lu ni écrit, et la fonction rend null (la note partira sans être notée).
// Franck reçoit un mail, une fois par jour, qui nomme la fonction d'installation de CET environnement.
function crFeuille_() {
  const existait = !!SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_CR);
  const sh = feuille_(SHEET_CR, CR_ENTETES);
  if (!existait) crFormats_(sh);
  if (crTitresBons_(sh)) return sh;
  let fonction = 'installerLot8Production';
  try { if (environnementReel_().env === 'TEST') fonction = 'installerLot8Test'; } catch (e) {}
  alerte_('Les notes de réunion ne sont plus notées dans l’onglet « ' + SHEET_CR + ' », et leurs points ne sont plus suivis : sa ligne de titres n’est plus celle attendue ('
    + CR_ENTETES.join(' | ') + '). Remettez ces titres, ou renommez l’onglet puis lancez ' + fonction + '. '
    + 'Les notes sont envoyées normalement (PDF et mails) ; seuls la ligne de l’onglet et le suivi des points manquent.', 'comptesrendus');
  return null;
}
// Le même onglet, pour LIRE seulement : jamais créé, jamais d'alerte. null s'il est absent ou si ses titres ont changé.
function crFeuilleLue_() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_CR);
  return sh && crTitresBons_(sh) ? sh : null;
}
// Les lignes de l'onglet SANS les colonnes des points (elles sont lourdes) : colonnes A à J seulement
function crLignes_(sh) {
  const derniere = sh.getLastRow();
  return derniere > 1 ? sh.getRange(2, 1, derniere - 1, CR_ENTETES_8B.length).getValues() : [];
}
function crIndexDeLaFiche_(lignes, idFiche) {
  for (let i = 0; i < lignes.length; i++) if (String(lignes[i][COL_CR.fiche - 1]) === String(idFiche)) return i;
  return -1;
}
// Ligne d'une note d'après son numéro de fiche (colonne A), ou 0. Jamais par position : Franck peut trier l'onglet.
function crChercher_(sh, idFiche) {
  const derniere = sh.getLastRow();
  if (derniere < 2) return 0;
  const ids = sh.getRange(2, COL_CR.fiche, derniere - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) if (String(ids[i][0]) === String(idFiche)) return i + 2;
  return 0;
}
// Le chantier d'une note, tel que le bureau le connaît : { nom ('' : hors liste), numero (N° du chantier, colonne E) }
function crChantier_(nom) {
  const l = ligneChantier_(nom);
  return { nom: l ? String(l[0]).trim() : '',
    numero: l && l.length > 4 ? String(l[4] === undefined || l[4] === null ? '' : l[4]).trim() : '' };
}
// La dernière ligne ARRIVÉE pour ce chantier (la plus récente en « Reçu le » ; à égalité, la plus basse de l'onglet) :
// son rang dans « lignes », ou -1.
// lignes : les valeurs de l'onglet sans la ligne de titres ; sauf : numéro de fiche à ne pas compter (la note elle-même).
function crDerniereLigne_(lignes, chantier, sauf) {
  const cleNum = crCleNumero_(chantier.numero), cleNom = crCleNom_(chantier.nom);
  let meilleure = -1, quand = -1;
  lignes.forEach((r, i) => {
    if (!String(r[COL_CR.fiche - 1]) || String(r[COL_CR.fiche - 1]) === String(sauf || '')) return;
    const numLigne = crCleNumero_(r[COL_CR.numChantier - 1]);
    // même N° de chantier (quand les deux sont remplis), sinon même nom
    const meme = cleNum && numLigne ? numLigne === cleNum : crCleNom_(r[COL_CR.chantier - 1]) === cleNom;
    if (!meme) return;
    // une note arrivée pendant que le chantier était hors de la liste n'a rien suivi : elle ne sert pas de point de départ
    if (String(r[COL_CR.remarque - 1] || '').indexOf('chantier hors liste') > -1) return;
    const t = crMs_(r[COL_CR.recu - 1]);
    if (t >= quand) { quand = t; meilleure = i; }
  });
  return meilleure;
}

// ── Les points gardés dans une ligne (« Données de l'appli ») ──
// { o: points OUVERTS [{ i: identifiant, t: texte, d: date de la réunion qui l'a ouvert }],
//   c: points CLOS récemment [{ i, t, d, k: date de la réunion qui l'a clos, n: comptes rendus arrivés depuis }],
//   f: identifiants des points clos depuis plus longtemps,
//   b: numéro de fiche de la ligne d'où venait cette liste (sert à refaire le même PDF si la note est renvoyée) }
function crEtatVide_() { return { o: [], c: [], f: [], b: '' }; }
// Les points gardés dans UNE ligne (rang dans crLignes_ ; -1 : aucune ligne) : deux cellules lues, pas tout l'onglet
function crEtatLu_(sh, index) {
  if (index < 0) return crEtatVide_();
  const v = sh.getRange(index + 2, COL_CR.donnees, 1, 2).getValues()[0];
  return crEtatDuTexte_(String(v[0] || '') + String(v[1] || '').replace(/^~/, ''));
}
function crEtatDuTexte_(texte) {
  const vide = crEtatVide_();
  if (!texte) return vide;
  try {
    const e = JSON.parse(texte);
    const point = p => p && crIdPoint_(p.i) && typeof p.t === 'string';
    return { o: (Array.isArray(e.o) ? e.o : []).filter(point).map(p => ({ i: p.i, t: p.t, d: String(p.d || '') })),
      c: (Array.isArray(e.c) ? e.c : []).filter(point).map(p => ({ i: p.i, t: p.t, d: String(p.d || ''), k: String(p.k || ''), n: Number(p.n) > 0 ? Number(p.n) : 0 })),
      f: (Array.isArray(e.f) ? e.f : []).filter(crIdPoint_), b: typeof e.b === 'string' ? e.b : '' };
  } catch (err) { return Object.assign(vide, { illisible: true }); }
}
// Les gestes d'une note, nettoyés (jamais un refus : la note part toujours)
function crGestes_(points) {
  const brut = points && typeof points === 'object' && Array.isArray(points.gestes) ? points.gestes : [];
  const vus = {}, liste = [];
  brut.slice(0, CR_MAX_GESTES).forEach(x => {
    if (!x || typeof x !== 'object' || CR_GESTES.indexOf(x.g) < 0) return;
    const t = crTexte_(x.t);
    let id = crIdPoint_(x.id);
    if (!id) { if (!t) return; id = crNouvelId_(); }   // identifiant illisible : le texte devient un nouveau point
    if (vus[id]) return;
    vus[id] = true;
    liste.push({ id: id, g: x.g, t: t, m: x.m === true, regle: x.regle === true });
  });
  return liste;
}
// Les points d'une note qui n'est PAS suivie (chantier hors liste, onglet illisible, page sans numéro de fiche) : imprimés tels quels
function crRenduSeul_(gestes) {
  return gestes.filter(g => g.t).map(g => ({ t: g.t, etat: g.g === 'clos' || (g.g === 'nouveau' && g.regle) ? 'clos' : 'ouvert',
    mention: g.g === 'nouveau' ? 'nouveau point' : '' }));
}
// LE CŒUR : applique les gestes d'une note à la liste du chantier. Ne lit ni n'écrit rien (fonction « pure »).
//   avant  : la liste de la dernière ligne du chantier ;
//   gestes : ceux de la note (crGestes_) ;
//   ctx    : { date (réunion de cette note), acces (le compte a-t-il accès au chantier ?) }.
// Rend { etat (la nouvelle liste), rendu (ce que le PDF imprime, dans l'ordre de la note), closIci, remarques }.
function crAppliquer_(avant, gestes, ctx) {
  const ouverts = avant.o.map(p => ({ i: p.i, t: p.t, d: p.d }));
  const clos = avant.c.map(p => ({ i: p.i, t: p.t, d: p.d, k: p.k, n: p.n }));
  let fermes = avant.f.slice();
  const rendu = [], closIci = [], remarques = [];
  const noter = r => { if (remarques.indexOf(r) < 0) remarques.push(r); };
  const depuis = d => d ? 'ouvert depuis le ' + d : 'point ouvert';
  let nouveaux = 0;
  gestes.forEach(g => {
    let id = g.id;
    let io = ouverts.findIndex(p => p.i === id), ic = clos.findIndex(p => p.i === id), ifm = fermes.indexOf(id);
    let connu = io > -1 || ic > -1 || ifm > -1;
    // « nouveau » sous un identifiant déjà pris (téléphone trompé, identifiant forgé) : le point est créé sous un autre
    if (g.g === 'nouveau' && connu) { id = crNouvelId_(); io = ic = ifm = -1; connu = false; }
    if (!connu) {
      // Nouveau point. Un geste sur un identifiant INCONNU (point d'une note précédente jamais arrivée, identifiant d'un
      // autre chantier) devient aussi un nouveau point, avec son texte : rien n'est perdu.
      if (!g.t) return;
      const regle = g.g === 'clos' || (g.g === 'nouveau' && g.regle);
      if (nouveaux >= CR_MAX_NOUVEAUX) {
        rendu.push({ t: g.t, etat: regle ? 'clos' : 'ouvert', mention: 'point non suivi (plus de ' + CR_MAX_NOUVEAUX + ' nouveaux points dans cette note)' });
        noter('plus de ' + CR_MAX_NOUVEAUX + ' nouveaux points : les suivants sont dans le PDF mais ne sont pas suivis');
        return;
      }
      nouveaux++;
      const origine = g.g === 'nouveau' ? 'nouveau point' : 'nouveau point (repris d’une note que le bureau n’a pas reçue)';
      if (regle) {
        clos.push({ i: id, t: g.t, d: ctx.date, k: ctx.date, n: -1 });
        closIci.push(g.t);
        rendu.push({ t: g.t, etat: 'clos', mention: g.g === 'nouveau' ? 'nouveau point, réglé pendant la réunion' : origine + ', clos' });
      } else {
        ouverts.push({ i: id, t: g.t, d: ctx.date });
        rendu.push({ t: g.t, etat: 'ouvert', mention: origine });
      }
      return;
    }
    // Point existant : il faut un compte qui a accès au chantier
    if (!ctx.acces) {
      if (!g.t) return;
      // imprimé tel que le téléphone l'a envoyé (une ligne par geste : les numéros « Point 3 — » des photos restent justes), sans rien changer au bureau
      rendu.push({ t: g.t, etat: 'ouvert', mention: (g.g === 'rien' ? 'point repris, non vérifié' : 'geste non pris en compte') + ' : ce compte n’a pas accès aux points de ce chantier' });
      if (g.g !== 'rien') noter('gestes sur des points existants ignorés (pas d’accès au chantier)');
      return;
    }
    const texteNeuf = !!g.t && (g.g === 'complete' || g.m);
    if (io > -1) {
      const p = ouverts[io];
      if (g.g === 'clos') {
        if (texteNeuf) p.t = g.t;
        ouverts.splice(io, 1);
        clos.push({ i: p.i, t: p.t, d: p.d, k: ctx.date, n: -1 });
        closIci.push(p.t);
        rendu.push({ t: p.t, etat: 'clos', mention: 'clos · ' + depuis(p.d) });
      } else {
        // « rien », « complete », ou « rouvert » sur un point déjà rouvert par quelqu'un d'autre
        const change = texteNeuf && g.t !== p.t;
        if (change) p.t = g.t;
        rendu.push({ t: p.t, etat: 'ouvert', mention: (change ? 'complété · ' : '') + depuis(p.d) });
      }
      return;
    }
    if (ic > -1) {
      const p = clos[ic];
      if (g.g === 'rouvert') {
        if (texteNeuf) p.t = g.t;
        clos.splice(ic, 1);
        ouverts.push({ i: p.i, t: p.t, d: p.d });
        rendu.push({ t: p.t, etat: 'ouvert', mention: 'rouvert (clos par le compte rendu du ' + p.k + ') · ' + depuis(p.d) });
      } else if (g.g === 'complete' && g.t && g.t !== p.t) {
        // complété par quelqu'un qui ne savait pas le point clos : le texte reste dans CE compte rendu, le point reste clos
        rendu.push({ t: g.t, etat: 'clos', mention: 'déjà clos par le compte rendu du ' + p.k + ' : ce texte n’est gardé que dans ce compte rendu' });
        noter('un point complété était déjà clos (compte rendu du ' + p.k + ')');
      } else {
        rendu.push({ t: p.t, etat: 'clos', mention: 'déjà clos par le compte rendu du ' + p.k });
      }
      return;
    }
    // Clos depuis plus de 3 comptes rendus : seul « rouvert » le rouvre
    if (g.g === 'rouvert' && g.t) {
      fermes.splice(ifm, 1);
      ouverts.push({ i: id, t: g.t, d: ctx.date });
      rendu.push({ t: g.t, etat: 'ouvert', mention: 'rouvert (clos par un compte rendu précédent)' });
    } else if (g.g === 'complete' && g.t) {
      rendu.push({ t: g.t, etat: 'clos', mention: 'déjà clos par un compte rendu précédent : ce texte n’est gardé que dans ce compte rendu' });
      noter('un point complété était déjà clos');
    } else if (g.t) {
      rendu.push({ t: g.t, etat: 'clos', mention: 'déjà clos par un compte rendu précédent' });
    }
  });
  // Les points clos AVANT cette note vieillissent d'un compte rendu ; au-delà de 3, il ne reste que leur identifiant
  const gardes = [];
  clos.forEach(p => {
    if (p.n < 0) { p.n = 0; gardes.push(p); return; }
    p.n++;
    if (p.n >= CR_CLOS_GARDES) fermes.push(p.i); else gardes.push(p);
  });
  if (fermes.length > CR_MAX_FERMES) fermes = fermes.slice(fermes.length - CR_MAX_FERMES);
  return { etat: { o: ouverts, c: gardes, f: fermes, b: '' }, rendu: rendu, closIci: closIci, remarques: remarques };
}
// La liste d'un chantier → les deux cellules « Données de l'appli ». Trop longue pour deux cellules : les textes gardés
// pour la suite sont raccourcis (chaque PDF garde le texte complet), jamais un refus.
function crDecouper_(etat) {
  let json = JSON.stringify(etat), raccourci = false;
  const max = 2 * CR_MAX_CELLULE;
  [1000, 500, 250, 120].forEach(limite => {
    if (json.length <= max) return;
    raccourci = true;
    etat.o.concat(etat.c).forEach(p => { if (p.t.length > limite) p.t = p.t.slice(0, limite - 1) + '…'; });
    json = JSON.stringify(etat);
  });
  if (json.length > max) { etat.f = []; json = JSON.stringify(etat); }
  while (json.length > max && etat.c.length) { etat.c.shift(); json = JSON.stringify(etat); }
  while (json.length > max && etat.o.length > 1) { etat.o.shift(); json = JSON.stringify(etat); }   // jamais vu : plus de 700 points ouverts
  return { donnees: json.slice(0, CR_MAX_CELLULE), suite: json.length > CR_MAX_CELLULE ? '~' + json.slice(CR_MAX_CELLULE) : '', raccourci: raccourci };
}
// Une liste de textes dans une cellule lisible par Franck : un point par ligne
function crCelluleLisible_(textes) {
  const t = textes.map(x => '• ' + String(x).replace(/\n+/g, ' / ')).join('\n');
  return t.length > CR_MAX_CELLULE ? t.slice(0, CR_MAX_CELLULE - 30) + '\n… (la suite est dans le PDF)' : t;
}
// Ce que la page reçoit pour un chantier : la liste telle qu'elle est après la ligne r
function crListePourLaPage_(r, etat) {
  return { base: r ? String(r[COL_CR.fiche - 1]) : '', date: r ? String(r[COL_CR.date - 1] || '') : '',
    ouverts: etat.o.map(p => ({ id: p.i, t: p.t, d: p.d })),
    clos: etat.c.map(p => ({ id: p.i, t: p.t, d: p.d, k: p.k })) };
}

// ── Noter la note dans l'onglet et appliquer ses gestes (à appeler AVANT de fabriquer le PDF) ──
// idFiche : numéro de fiche créé par le téléphone ; brut : données de la note ; qui : texte « compte qui a envoyé » ;
// compte : le compte vérifié par le serveur (null : sans compte).
// Rend { rendu (les points à imprimer), remarque (ligne en tête du PDF), liste (pour le téléphone, si le compte a le droit
// de lire), nonSuivi ('' | 'onglet' | 'chantier'), dejaLa }. Lève « occupé » si le verrou n'est pas disponible (passager :
// le téléphone réessaie). Onglet illisible : pas d'erreur, la note part sans être notée.
function crEnregistrer_(idFiche, brut, qui, compte) {
  const avecPoints = !!(brut.points && typeof brut.points === 'object');
  const gestes = crGestes_(brut.points);
  const base = avecPoints && typeof brut.points.base === 'string' ? brut.points.base.slice(0, 64) : '';
  const verrou = LockService.getScriptLock();
  if (!verrou.tryLock(15000)) throw crOccupe_();
  try {
    let sh = null;
    try { sh = crFeuille_(); } catch (e) { console.error('crEnregistrer_ :', e.message); }
    if (!sh) return { rendu: crRenduSeul_(gestes), remarque: '', liste: null, nonSuivi: 'onglet', dejaLa: false };
    const chantier = crChantier_(brut.chantier);
    // Chantier hors liste : la note est notée, ses points sont imprimés, mais rien n'est suivi (aucun droit vérifiable)
    const acces = !!(chantier.nom && compte && compte.id && compte.role && peutLireChantier_(compte, chantier.nom));
    const lignes = crLignes_(sh);
    const iMoi = crIndexDeLaFiche_(lignes, idFiche), maLigne = iMoi > -1 ? lignes[iMoi] : null;
    // Note renvoyée par le téléphone : sa ligne existe déjà. Rien n'est écrit ; le même PDF est refait en rejouant ses
    // gestes sur la liste d'où elle était partie (notée dans sa ligne).
    if (maLigne) {
      const moi = crEtatLu_(sh, iMoi);
      const rejoue = chantier.nom ? crAppliquer_(crEtatLu_(sh, moi.b ? crIndexDeLaFiche_(lignes, moi.b) : -1), gestes, { date: crLigne_(brut.date, 20), acces: acces }) : { rendu: crRenduSeul_(gestes) };
      const rem = String(maLigne[COL_CR.remarque - 1] || '').split(' ; ').filter(x => /^Rédigé sans connaître/.test(x))[0] || '';
      return { rendu: rejoue.rendu, remarque: rem, liste: acces ? crListePourLaPage_(maLigne, moi) : null, nonSuivi: chantier.nom || !gestes.length ? '' : 'chantier', dejaLa: true };
    }
    const remarques = [];
    let resultat = { etat: crEtatVide_(), rendu: crRenduSeul_(gestes), closIci: [], remarques: [] };
    if (!chantier.nom) {
      remarques.push(gestes.length ? 'chantier hors liste : points non suivis' : 'chantier hors liste');
    } else {
      const iAvant = crDerniereLigne_(lignes, chantier, idFiche), avant = iAvant > -1 ? lignes[iAvant] : null;
      const dateAvant = avant ? String(avant[COL_CR.date - 1] || '') : '';
      // L'ordre est celui de l'arrivée : une note restée sans réseau peut porter une date plus ancienne que la précédente
      if (crJour_(brut.date) && crJour_(dateAvant) && crJour_(brut.date) < crJour_(dateAvant)) remarques.push('reçu après le compte rendu du ' + dateAvant);
      // La page (lot 8c) dit d'où venait sa liste. Si un autre compte rendu est arrivé entre-temps, c'est écrit.
      if (avecPoints && avant && base !== String(avant[COL_CR.fiche - 1])) remarques.push('Rédigé sans connaître le compte rendu du ' + dateAvant);
      const etatAvant = crEtatLu_(sh, iAvant);
      if (etatAvant.illisible) {
        remarques.push('données du compte rendu précédent illisibles : ses points ouverts ne sont repris que s’ils sont dans cette note');
        alerte_('Dans l’onglet « ' + SHEET_CR + ' », la cellule « Données de l’appli » de la note « ' + String(avant[COL_CR.fiche - 1]) + ' » n’est plus lisible (modifiée à la main ?). '
          + 'Les points ouverts de ce chantier ne reviennent que s’ils étaient affichés dans le téléphone qui a écrit la note suivante.', 'pointscr');
      }
      resultat = crAppliquer_(etatAvant, gestes, { date: crLigne_(brut.date, 20), acces: acces });
      resultat.etat.b = avant ? String(avant[COL_CR.fiche - 1]) : '';
      resultat.remarques.forEach(x => remarques.push(x));
    }
    const cellules = chantier.nom ? crDecouper_(resultat.etat) : { donnees: '', suite: '', raccourci: false };
    if (cellules.suite || cellules.raccourci) {
      if (cellules.raccourci) remarques.push('beaucoup de points ouverts : les textes gardés pour la suite sont raccourcis (les PDF gardent le texte complet)');
      alerte_('Le chantier « ' + chantier.nom + ' » a beaucoup de points ouverts dans ses comptes rendus (' + resultat.etat.o.length + '). '
        + (cellules.raccourci ? 'Les textes gardés pour la note suivante sont raccourcis ; chaque PDF garde le texte complet. ' : 'Tout est encore gardé en entier. ')
        + 'Pensez à clore les points réglés.', 'pointscr');
    }
    const ligne = [];
    for (let c = 0; c < CR_ENTETES.length; c++) ligne.push('');
    ligne[COL_CR.fiche - 1] = String(idFiche);
    ligne[COL_CR.chantier - 1] = chantier.nom || crLigne_(brut.chantier, 150);
    ligne[COL_CR.numChantier - 1] = chantier.numero;
    ligne[COL_CR.date - 1] = crLigne_(brut.date, 20);
    ligne[COL_CR.objet - 1] = crLigne_(brut.objet, 300);
    ligne[COL_CR.auteur - 1] = crLigne_(brut.auteur, 150);
    ligne[COL_CR.compte - 1] = String(qui || 'sans compte');
    ligne[COL_CR.recu - 1] = new Date();
    ligne[COL_CR.remarque - 1] = remarques.join(' ; ');
    ligne[COL_CR.ouverts - 1] = crCelluleLisible_(resultat.etat.o.map(p => p.t));
    ligne[COL_CR.clos - 1] = crCelluleLisible_(resultat.closIci);
    ligne[COL_CR.donnees - 1] = cellules.donnees;
    ligne[COL_CR.suite - 1] = cellules.suite;
    // La ligne entière en une écriture (colonnes de texte en « texte brut » avant d'écrire)
    noteAjouterLigne_(sh, ligne, CR_COLONNES_TEXTE);
    // Écriture poussée dans le Sheet AVANT de rendre le verrou : la note suivante du même chantier doit lire cette ligne
    // (sans cela, Google peut la garder en attente jusqu'à la fin de la fabrication du PDF)
    SpreadsheetApp.flush();
    return { rendu: resultat.rendu, remarque: remarques.filter(x => /^Rédigé sans connaître/.test(x))[0] || '',
      liste: acces ? crListePourLaPage_(ligne, resultat.etat) : null, nonSuivi: chantier.nom || !gestes.length ? '' : 'chantier', dejaLa: false };
  } finally { verrou.releaseLock(); }
}
// Nom du PDF rangé dans Drive, noté après le rangement (la ligne est retrouvée par le numéro de fiche).
// Un échec ici ne fait jamais échouer la note : le PDF est rangé et les mails partent.
function crNoterPdf_(idFiche, nom) {
  try {
    const sh = crFeuilleLue_();
    if (!sh) return;
    const ligne = crChercher_(sh, idFiche);
    if (ligne) sh.getRange(ligne, COL_CR.pdf).setValue(cellule_(String(nom || '')));
  } catch (e) { console.error('crNoterPdf_ :', e.message); }
}

// ── Lecture (action « compteRendu ») : les points ouverts du chantier affiché, pour la page de la note de réunion ──
// Réservée aux comptes qui ont accès au chantier. « Chantier inconnu » et « chantier interdit » : la même réponse.
function crLire_(compte, corps) {
  const demande = typeof corps.chantier === 'string' ? corps.chantier.trim().slice(0, 150) : '';
  const chantier = demande ? crChantier_(demande) : { nom: '', numero: '' };
  if (!chantier.nom || !compte || !compte.id || !peutLireChantier_(compte, chantier.nom)) return avecJeton_({ ok: false, code: 'INTERDIT', message: CR_REFUS_LECTURE }, compte);
  const existe = !!SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_CR);
  const sh = crFeuilleLue_();
  // Onglet aux titres changés : la page le dit (« points indisponibles ») ; onglet pas encore créé : aucun compte rendu
  if (existe && !sh) return avecJeton_({ ok: false, code: 'INDISPONIBLE', message: 'Les points des comptes rendus sont indisponibles pour l’instant : le bureau est prévenu.' }, compte);
  const lignes = sh ? crLignes_(sh) : [], iDerniere = sh ? crDerniereLigne_(lignes, chantier, '') : -1;
  const derniere = iDerniere > -1 ? lignes[iDerniere] : null;
  const etat = sh ? crEtatLu_(sh, iDerniere) : crEtatVide_();
  let reste = null;
  try { reste = MailApp.getRemainingDailyQuota(); } catch (e) {}
  const liste = crListePourLaPage_(derniere, etat);
  return avecJeton_({ ok: true, code: 'OK', message: liste.ouverts.length + ' point(s) ouvert(s)',
    data: Object.assign(liste, { chantier: chantier.nom, mailsRestants: reste, heure: Date.now() }) }, compte);
}

// ── Installation du lot 8 (une fonction par environnement ; relançable sans danger) ──
function etapesLot8_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return [{
    nom: 'Onglet « ' + SHEET_CR + ' »',
    fait: () => { const sh = ss.getSheetByName(SHEET_CR); return !!sh && crTitresBons_(sh); },
    action: () => {
      const sh = ss.getSheetByName(SHEET_CR);
      if (!sh) { feuille_(SHEET_CR, CR_ENTETES); crFormats_(ss.getSheetByName(SHEET_CR)); return 'onglet créé'; }
      const titres = sh.getRange(1, 1, 1, Math.max(CR_ENTETES.length, sh.getLastColumn())).getValues()[0];
      // Onglet du lot 8b (10 colonnes), colonnes suivantes libres : les 4 colonnes des points sont ajoutées, rien n'est effacé
      const debut8b = CR_ENTETES_8B.every((t, i) => String(titres[i]) === t);
      const suiteLibre = titres.slice(CR_ENTETES_8B.length).every(t => String(t === undefined || t === null ? '' : t).trim() === '');
      if (debut8b && suiteLibre) {
        if (sh.getMaxColumns() < CR_ENTETES.length) sh.insertColumnsAfter(sh.getMaxColumns(), CR_ENTETES.length - sh.getMaxColumns());
        sh.getRange(1, 1, 1, CR_ENTETES.length).setValues([CR_ENTETES]);
        sh.getRange(1, 1, 1, CR_ENTETES.length).setFontWeight('bold').setBackground('#1A2B4A').setFontColor('white');
        crFormats_(sh);
        return 'colonnes des points ajoutées';
      }
      // Onglet déjà là : jamais rien réécrire par-dessus des données (un onglet d'un essai précédent, avec d'autres
      // titres, se renomme à la main : l'installation en crée alors un neuf)
      if (sh.getLastRow() > 1 || titres.some(t => String(t === undefined || t === null ? '' : t).trim() !== '')) throw new Error('un onglet « ' + SHEET_CR + ' » existe déjà avec d’autres titres : le renommer, puis relancer');
      sh.getRange(1, 1, 1, CR_ENTETES.length).setValues([CR_ENTETES]);
      crFormats_(sh);
      return 'onglet prêt';
    } }];
}
function installerLot8_(attendu) { return installer_('Lot 8', attendu, etapesLot8_()).texte; }
function installerLot8Test() { return installerLot8_('TEST'); }
function installerLot8Production() { return installerLot8_('PRODUCTION'); }
