// ═══════════════════════════════════════════════════════════════════════════════
// PLANNING LOUÉ — LES RÈGLES (lot 11.1)
//
// Ce fichier ne touche à AUCUN service de Google : seulement des calculs sur des textes et des tableaux. Il est recopié
// tel quel en tête des deux programmes du planning (outils/construire-planning.js) :
//   - le programme du planning, attaché au Sheet « Planning Loué » (Planning.gs) ;
//   - le programme de publication, à part, dans le compte de Loué (Publication.gs).
// Tout ce qui est ici est testé sans Google : tests/lot11-regles.test.js.
//
// LA FORME D'UNE SEMAINE (solution « une case par jour », jamais de cases collées : rien ne peut se dérégler) :
//   - un onglet par semaine, nommé « 2026-S48 » ;
//   - un gars de la pose = une ligne (une case par jour), plus une ligne fine « véhicule du jour » ;
//   - un gars de l'atelier = une ligne (une case par jour, jusqu'à 4 tâches l'une sous l'autre) ;
//   - un seul chantier dans la journée = il est seul dans la case ; une journée coupée = les chantiers l'un sous l'autre,
//     chacun précédé de sa part (¼, ½, ¾) : on tape « 901 + 903 », le programme écrit « ½ 901 LES TILLEULS » et
//     « ½ 903 LES LILAS » ;
//   - la colonne H (cachée) dit ce qu'est chaque ligne : c'est elle que lisent les programmes.
// Aucun nom réel, aucun identifiant dans ce fichier : le dépôt est public.
// ═══════════════════════════════════════════════════════════════════════════════
const PL_VERSION = 'Planning Loué 1.0';
const PL_JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi'];
// Les « autres cas » (décision de Franck du 18/11/2026). « Absent » pour toute absence dont le motif ne se dit pas.
const PL_CAS = ['Absent', 'Congés', 'RTT', 'Récupération', 'École', 'Formation', 'Férié', 'Atelier', 'Bureau', 'SAV / divers'];
// Ceux qui ne sont PAS recopiés dans la semaine suivante (une absence d'une semaine n'est pas celle de la suivante)
const PL_CAS_NON_RECOPIES = ['Absent', 'Congés', 'RTT', 'Récupération', 'École', 'Formation', 'Férié'];
// Mots à ne jamais écrire dans le planning (santé) : la case passe en rouge. Un filet, pas une garantie.
const PL_MOTS_A_EVITER = ['arret', 'malade', 'maladie', 'accident', 'accidente', 'hopital', 'hospitalise', 'hospitalisation', 'medecin', 'medical',
  'operation', 'opere', 'chirurgie', 'blesse', 'blessure', 'depression', 'grossesse', 'enceinte', 'covid', 'grippe', 'cancer', 'handicap', 'psy', 'at', 'mp'];
const PL_ONGLETS = { listes: 'LISTES', salaries: 'SALARIÉS', affiche: 'AFFICHE A3', appli: 'APPLI', historique: 'HISTORIQUE', absences: 'ABSENCES' };
// Un onglet de semaine : lignes et colonnes fixes
const PL_S = { ligTitre: 1, ligPublier: 2, ligEntetes: 3, lig1: 4, colVehicule: 1, colNom: 2, colJour1: 3, colMarque: 8, nbCol: 8,
  colCase: 2, colEtat: 3 };   // ligne 2 : A2 = « Publier pour les gars », B2 = la case à cocher, C2 = l'état
// Ce que dit la colonne H de chaque ligne
const PL_M = { titre: 'T', pose: 'P', vehicule: 'V', atelier: 'A' };
const PL_MAX_POSE = 20, PL_MAX_ATELIER = 7;        // au-delà, l'affiche A3 n'est plus lisible
const PL_PARTS = { 1: '¼', 2: '½', 3: '¾' };       // en quarts de journée
const PL_SEPARATEUR_AFFICHE = ' / ';
const PL_RECOPIER_CHANTIERS = true;                // « Créer la semaine suivante » recopie les chantiers de chacun (pas les absences)

// ── Textes ──
function plTexte_(v) { return v === null || v === undefined ? '' : String(v).replace(/\r/g, '').replace(/[ \t ]+/g, ' ').trim(); }
// Pour comparer : sans majuscules ni accents
function plNorm_(v) { return plTexte_(v).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
function plDeux_(n) { return (n < 10 ? '0' : '') + n; }
// Empreinte courte d'un texte (pour savoir si une semaine a changé depuis sa publication)
function plEmpreinte_(t) {
  let h = 5381;
  const s = String(t);
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return h.toString(36) + '-' + s.length.toString(36);
}

// ── Dates : un jour s'écrit « AAAA-MM-JJ » (comparable comme un texte, aucun piège de fuseau horaire) ──
function plEstIso_(t) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(t))) return false;
  const p = String(t).split('-').map(Number), d = new Date(Date.UTC(p[0], p[1] - 1, p[2]));
  return d.getUTCFullYear() === p[0] && d.getUTCMonth() === p[1] - 1 && d.getUTCDate() === p[2];
}
function plDate_(iso) { const p = iso.split('-').map(Number); return new Date(Date.UTC(p[0], p[1] - 1, p[2])); }
function plIso_(d) { return d.getUTCFullYear() + '-' + plDeux_(d.getUTCMonth() + 1) + '-' + plDeux_(d.getUTCDate()); }
function plDecaler_(iso, jours) { const d = plDate_(iso); d.setUTCDate(d.getUTCDate() + jours); return plIso_(d); }
// Le lundi de la semaine d'un jour
function plLundi_(iso) { const j = (plDate_(iso).getUTCDay() + 6) % 7; return plDecaler_(iso, -j); }
// Numéro de semaine (norme ISO 8601, celle des calendriers français) : { annee, semaine }. L'année est celle du JEUDI.
function plSemaine_(iso) {
  const jeudi = plDecaler_(plLundi_(iso), 3), annee = Number(jeudi.slice(0, 4));
  const premierLundi = plLundi_(annee + '-01-04');   // le 4 janvier est toujours dans la semaine 1
  return { annee: annee, semaine: 1 + Math.round((plDate_(plLundi_(iso)) - plDate_(premierLundi)) / (7 * 86400000)) };
}
// « 2026-S48 »
function plNomOnglet_(lundi) { const s = plSemaine_(lundi); return s.annee + '-S' + plDeux_(s.semaine); }
// Le lundi d'un onglet « 2026-S48 » ; '' si le nom n'est pas celui d'une semaine qui existe (2025 n'a pas de semaine 53)
function plLundiDeNom_(nom) {
  const m = /^(\d{4})-S(\d{2})$/.exec(plTexte_(nom));
  if (!m) return '';
  const annee = Number(m[1]), sem = Number(m[2]);
  if (sem < 1 || sem > 53) return '';
  const lundi = plDecaler_(plLundi_(annee + '-01-04'), (sem - 1) * 7), s = plSemaine_(lundi);
  return s.annee === annee && s.semaine === sem ? lundi : '';
}
function plJjmm_(iso) { return iso.slice(8, 10) + '/' + iso.slice(5, 7); }
// « Semaine 48 — du 23 au 27/11/2026 » ; à cheval sur deux mois ou deux années, tout est écrit
function plTitre_(lundi) {
  const v = plDecaler_(lundi, 4), s = plSemaine_(lundi);
  const debut = lundi.slice(0, 4) !== v.slice(0, 4) ? plJjmm_(lundi) + '/' + lundi.slice(0, 4)
    : lundi.slice(5, 7) !== v.slice(5, 7) ? plJjmm_(lundi) : lundi.slice(8, 10);
  return 'Semaine ' + s.semaine + ' — du ' + debut + ' au ' + plJjmm_(v) + '/' + v.slice(0, 4);
}
// Nom du PDF publié : « Planning S48 du 23 au 27-11 » (pas de « / » dans un nom de fichier)
function plNomFichier_(lundi) {
  const v = plDecaler_(lundi, 4), s = plSemaine_(lundi), jm = iso => iso.slice(8, 10) + '-' + iso.slice(5, 7);
  return 'Planning S' + plDeux_(s.semaine) + ' du ' + (lundi.slice(5, 7) !== v.slice(5, 7) ? jm(lundi) : lundi.slice(8, 10)) + ' au ' + jm(v);
}
function plEntetes_(lundi) {
  return ['Véhicule', 'Nom'].concat(PL_JOURS.map((j, i) => j + ' ' + plJjmm_(plDecaler_(lundi, i))));
}

// ── Les listes ──
// chantiers = [{ numero, nom, court }] ; rend ce qu'il faut pour compléter une saisie
function plIndex_(chantiers, cas) {
  const parNumero = {}, libelles = [];
  (chantiers || []).forEach(c => {
    const numero = plTexte_(c.numero), nom = plTexte_(c.nom);
    if (!numero || !nom) return;
    const libelle = numero + ' ' + nom;
    // un numéro en double : aucun des deux ne sert à compléter (on ne devine pas)
    const deja = parNumero[plNorm_(numero)];
    if (deja) { deja.double = true; const i = libelles.indexOf(deja.libelle); if (i > -1) libelles.splice(i, 1); return; }
    parNumero[plNorm_(numero)] = { numero: numero, nom: nom, court: plTexte_(c.court), libelle: libelle };
    libelles.push(libelle);
  });
  return { parNumero: parNumero, libelles: libelles, cas: (cas || PL_CAS).slice() };
}
// Le numéro de chantier d'une ligne de texte : son PREMIER MOT, s'il est exactement un numéro connu (« 90 » ≠ « 901 »)
function plNumero_(ligne, index) {
  const mot = plNorm_(ligne).split(' ')[0] || '', c = index.parNumero[mot];
  return c && !c.double ? c.numero : '';
}
// Complète UN morceau : « 901 » → « 901 LES TILLEULS » ; « cong » → « Congés » ; sinon le texte, tel quel
function plCompleterMorceau_(texte, index) {
  const t = plTexte_(texte), n = plNorm_(t);
  if (!t) return '';
  // 1. exactement un numéro de la liste (seul, ou suivi de n'importe quoi : c'est le numéro qui compte)
  const c = index.parNumero[n.split(' ')[0]];
  if (c && !c.double && (n === plNorm_(c.numero) || plNorm_(c.libelle).indexOf(n) === 0)) return c.libelle;
  if (c && !c.double) return t;                                   // « 901 pose des plinthes » : gardé tel quel
  // 2. un « autre cas », écrit en entier ou par son début (3 lettres au moins), sans se soucier des accents
  const cas = index.cas.filter(x => plNorm_(x) === n);
  if (cas.length === 1) return cas[0];
  if (n.length >= 3) { const debut = index.cas.filter(x => plNorm_(x).indexOf(n) === 0); if (debut.length === 1) return debut[0]; }
  // 3. le seul chantier dont « N° NOM » commence par ce qui est tapé (2 caractères au moins)
  if (n.length >= 2) { const debut = index.libelles.filter(l => plNorm_(l).indexOf(n) === 0); if (debut.length === 1) return debut[0]; }
  return t;
}
// La part écrite en tête d'un morceau : « ½ », « 1/2 », « 3/4 »… → nombre de quarts (0 : pas de part écrite)
function plPart_(texte) {
  const t = plTexte_(texte);
  const m = /^(¼|½|¾|1\/4|1\/2|2\/4|3\/4)\s+(.+)$/.exec(t) || /^(¼|½|¾)(.+)$/.exec(t);
  if (!m) return { quarts: 0, texte: t };
  const q = { '¼': 1, '1/4': 1, '½': 2, '1/2': 2, '2/4': 2, '¾': 3, '3/4': 3 }[m[1]];
  return { quarts: q, texte: plTexte_(m[2]) };
}
// Les morceaux d'une case RANGÉE : un par ligne (c'est ainsi que le programme les écrit)
function plMorceaux_(valeur) {
  return String(valeur === null || valeur === undefined ? '' : valeur).replace(/\r/g, '').split('\n').map(plTexte_).filter(Boolean);
}
// Les morceaux d'une SAISIE : en plus des lignes, « + » et « ; » séparent deux chantiers. Avec précaution, pour ne jamais
// abîmer un texte (« 901 R+1 », un chantier « RÉSIDENCE A+B ») :
//   - une ligne qui est, en entier, un chantier ou un cas de la liste n'est jamais coupée ;
//   - « + » sépare s'il est entouré d'espaces (« 901 + 903 ») ; collé (« 901+903 »), seulement si CHAQUE morceau est un numéro connu ;
//   - « ; » sépare toujours.
function plDecouperSaisie_(valeur, index) {
  const connus = {};
  index.libelles.concat(index.cas).forEach(l => { connus[plNorm_(l)] = true; });
  const estNumero = p => { const c = index.parNumero[plNorm_(plPart_(p).texte)]; return !!c && !c.double; };
  const morceaux = [];
  plMorceaux_(valeur).forEach(ligne => {
    if (connus[plNorm_(plPart_(ligne).texte)]) { morceaux.push(ligne); return; }
    let pieces = ligne.split(/\s+\+\s+|\s*;\s*/).map(plTexte_).filter(Boolean);
    if (pieces.length === 1 && ligne.indexOf('+') > -1) {
      const serres = ligne.split('+').map(plTexte_).filter(Boolean);
      if (serres.length > 1 && serres.every(estNumero)) pieces = serres;
    }
    pieces.forEach(p => morceaux.push(p));
  });
  return morceaux;
}
// Ce que contient une case : { morceaux: [{ quarts, texte, numero }], probleme }
function plLireCase_(valeur, index) {
  const morceaux = plMorceaux_(valeur).map(m => { const p = plPart_(m); return { quarts: p.quarts, texte: p.texte, numero: plNumero_(p.texte, index) }; });
  const total = morceaux.reduce((s, m) => s + m.quarts, 0);
  let probleme = '';
  if (morceaux.length > 4) probleme = 'plus de 4 morceaux dans la journée';
  else if (total > 4) probleme = 'les parts dépassent la journée';
  else if (morceaux.length > 1 && morceaux.some(m => !m.quarts)) probleme = 'un morceau n’a pas sa part (¼, ½, ¾)';
  return { morceaux: morceaux, probleme: probleme };
}
// Ce qu'on écrit dans la case à partir de ce qui a été tapé. Ne refuse JAMAIS : au pire, le texte est rendu tel quel.
//   « 901 »            → « 901 LES TILLEULS »                       (un seul chantier : toute la case)
//   « 901 + 903 »      → « ½ 901 LES TILLEULS » / « ½ 903 LES LILAS »
//   « 1/4 901 + 903 »  → « ¼ 901 … » / « ¾ 903 … »                  (les parts manquantes se partagent le reste)
//   3 morceaux → ½ + ¼ + ¼ ; 4 morceaux → ¼ chacun
function plCompleter_(valeur, index) {
  const brut = plDecouperSaisie_(valeur, index);
  if (!brut.length) return '';
  const m = brut.map(x => { const p = plPart_(x); return { quarts: p.quarts, texte: plCompleterMorceau_(p.texte, index) }; }).filter(x => x.texte);
  if (!m.length) return '';
  if (m.length === 1) return (m[0].quarts ? PL_PARTS[m[0].quarts] + ' ' : '') + m[0].texte;
  if (m.length <= 4) {
    const donnes = m.reduce((s, x) => s + x.quarts, 0), sans = m.filter(x => !x.quarts);
    if (sans.length === m.length) {
      ({ 2: [2, 2], 3: [2, 1, 1], 4: [1, 1, 1, 1] })[m.length].forEach((q, i) => { m[i].quarts = q; });
    } else if (sans.length) {
      const reste = 4 - donnes;
      // le reste se partage en parts égales s'il tombe juste ; sinon rien n'est inventé
      if (reste >= sans.length && reste % sans.length === 0) sans.forEach(x => { x.quarts = reste / sans.length; });
    }
  }
  return m.map(x => (x.quarts && PL_PARTS[x.quarts] ? PL_PARTS[x.quarts] + ' ' : '') + x.texte).join('\n');
}
// Un mot à éviter dans une case ? Rend le mot trouvé, ou ''. Une ligne qui est un chantier de la liste n'est pas regardée
// (un chantier peut s'appeler « RÉSIDENCE DE L'HÔPITAL »).
function plMotAEviter_(valeur, index) {
  const libelles = {};
  index.libelles.forEach(l => { libelles[plNorm_(l)] = true; });
  let trouve = '';
  plMorceaux_(valeur).forEach(m => {
    const texte = plPart_(m).texte;
    if (trouve || libelles[plNorm_(texte)]) return;
    const mots = plNorm_(texte).split(/[^a-z0-9]+/).filter(Boolean);
    const mot = mots.filter(x => PL_MOTS_A_EVITER.indexOf(x) > -1)[0];
    if (mot) trouve = mot;
  });
  return trouve;
}

// ── Le modèle d'une semaine ──
// Lit le tableau de valeurs d'un onglet de semaine (toutes ses lignes, 8 colonnes au moins). Rend null s'il n'est pas lisible.
//   { lundi, publier, etat, pose: [{ nom, vehicule, jours[5], vehiculesJour[5] }], atelier: [{ nom, jours[5] }] }
function plLireSemaine_(valeurs) {
  const v = valeurs || [], cel = (l, c) => plTexte_((v[l - 1] || [])[c - 1]);
  const brut = (l, c) => { const x = (v[l - 1] || [])[c - 1]; return x === null || x === undefined ? '' : String(x).replace(/\r/g, '').trim(); };
  const lundi = cel(PL_S.ligTitre, PL_S.colMarque);
  if (!plEstIso_(lundi) || plLundi_(lundi) !== lundi) return null;
  const s = { lundi: lundi, publier: (v[PL_S.ligPublier - 1] || [])[PL_S.colCase - 1] === true, etat: cel(PL_S.ligPublier, PL_S.colEtat), pose: [], atelier: [] };
  const lignesDe = {};   // nom (sans majuscules ni accents) → numéro de sa ligne dans l'onglet ; 0 si le nom y est deux fois
  const jours = l => PL_JOURS.map((_, i) => brut(l, PL_S.colJour1 + i));
  for (let l = PL_S.lig1; l <= v.length; l++) {
    const marque = cel(l, PL_S.colMarque);
    if (marque === PL_M.pose || marque === PL_M.atelier) { const n = plNorm_(cel(l, PL_S.colNom)); if (n) lignesDe[n] = lignesDe[n] === undefined ? l : 0; }
    if (marque === PL_M.pose) s.pose.push({ nom: cel(l, PL_S.colNom), vehicule: cel(l, PL_S.colVehicule), jours: jours(l), vehiculesJour: ['', '', '', '', ''] });
    else if (marque === PL_M.vehicule && s.pose.length) s.pose[s.pose.length - 1].vehiculesJour = jours(l).map(plTexte_);
    else if (marque === PL_M.atelier) s.atelier.push({ nom: cel(l, PL_S.colNom), jours: jours(l) });
    // Une ligne qui contient quelque chose mais dont le repère (colonne H) manque ou est inconnu : l'onglet n'est PAS lisible.
    // On ne devine pas (une semaine lue à moitié serait publiée à moitié).
    else if (marque !== PL_M.titre && marque !== PL_M.vehicule && (v[l - 1] || []).slice(0, 7).some(x => plTexte_(x) !== '')) return null;
  }
  Object.defineProperty(s, 'lignesDe', { value: lignesDe, enumerable: false });   // à part : n'entre ni dans la grille ni dans l'empreinte
  return s;
}
// Pourquoi un onglet de semaine n'est pas lisible, en clair ('' s'il l'est) : pour le dire à Franck au lieu de « illisible »
function plPourquoiIllisible_(valeurs) {
  const v = valeurs || [], cel = (l, c) => plTexte_((v[l - 1] || [])[c - 1]);
  const lundi = cel(PL_S.ligTitre, PL_S.colMarque);
  if (!plEstIso_(lundi) || plLundi_(lundi) !== lundi) return 'la date de la semaine (colonne H, cachée, ligne 1) a été effacée ou changée';
  const connues = [PL_M.titre, PL_M.pose, PL_M.vehicule, PL_M.atelier];
  let reperes = 0;
  for (let l = PL_S.lig1; l <= v.length; l++) if (connues.indexOf(cel(l, PL_S.colMarque)) > -1) reperes++;
  if (!reperes && v.length >= PL_S.lig1) return 'les repères des lignes (colonne H, cachée) ont été effacés : restaure l’onglet par Fichier → Historique des versions';
  for (let l = PL_S.lig1; l <= v.length; l++) {
    if (connues.indexOf(cel(l, PL_S.colMarque)) > -1) continue;
    const texte = (v[l - 1] || []).slice(0, 7).map(plTexte_).filter(Boolean)[0];
    if (texte) return 'la ligne ' + l + ' (« ' + texte.slice(0, 30) + ' ») n’est pas une ligne du planning : efface-la (une note se met ailleurs ; un gars s’ajoute par le menu « Ajouter un gars »)';
  }
  return '';
}
// Le tableau de valeurs à écrire dans l'onglet, à partir du modèle (l'inverse de plLireSemaine_)
function plGrilleSemaine_(s) {
  const vide = () => ['', '', '', '', '', '', '', ''];
  const lignes = [], ligne = (a, b, jours, marque) => { const l = vide(); l[0] = a; l[1] = b; (jours || []).forEach((x, i) => { l[2 + i] = x; }); l[7] = marque; return l; };
  const titre = vide(); titre[0] = 'PLANNING LOUÉ'; titre[1] = plTitre_(s.lundi); titre[7] = s.lundi; lignes.push(titre);
  const pub = vide(); pub[0] = 'Publier pour les gars'; pub[1] = s.publier === true; pub[2] = s.etat || 'Pas encore publié'; pub[7] = PL_VERSION; lignes.push(pub);
  const ent = plEntetes_(s.lundi).concat(['']); lignes.push(ent);
  lignes.push(ligne('POSE', '', null, PL_M.titre));
  s.pose.forEach(g => {
    lignes.push(ligne(g.vehicule, g.nom, g.jours, PL_M.pose));
    lignes.push(ligne('', 'véhicule du jour', g.vehiculesJour, PL_M.vehicule));
  });
  lignes.push(ligne('ATELIER', '', null, PL_M.titre));
  s.atelier.forEach(g => { lignes.push(ligne('', g.nom, g.jours, PL_M.atelier)); });
  return lignes;
}
// Ordre alphabétique des gars, sans se soucier des accents ni des majuscules
function plTrier_(gars) { return gars.slice().sort((a, b) => plNorm_(a.nom).localeCompare(plNorm_(b.nom))); }   // tri stable : deux noms égaux gardent leur ordre

// La semaine SUIVANTE, à partir d'une semaine : mêmes gars, mêmes véhicules de la semaine ; les chantiers de chacun sont
// recopiés (on ne change que ce qui bouge), SAUF les absences, congés, école, formation et fériés ; le véhicule du jour
// (une exception) n'est pas recopié. La case « Publier » repart décochée.
function plSemaineSuivante_(s, index) {
  const garder = valeur => {
    if (!PL_RECOPIER_CHANTIERS) return '';
    const lus = plLireCase_(valeur, index).morceaux;
    const interdits = PL_CAS_NON_RECOPIES.map(plNorm_);
    if (lus.some(m => interdits.indexOf(plNorm_(m.texte)) > -1)) return '';   // la journée entière est vidée : à ressaisir
    return plTexte_(valeur) ? String(valeur).replace(/\r/g, '').trim() : '';
  };
  return { lundi: plDecaler_(s.lundi, 7), publier: false, etat: '',
    pose: s.pose.map(g => ({ nom: g.nom, vehicule: g.vehicule, jours: g.jours.map(garder), vehiculesJour: ['', '', '', '', ''] })),
    atelier: s.atelier.map(g => ({ nom: g.nom, jours: g.jours.map(garder) })) };
}
// Ajouter un gars (équipe : 'pose' ou 'atelier'), à sa place dans l'ordre alphabétique. Rend { ok, message, semaine }.
function plAjouterGars_(s, nom, equipe, vehicule) {
  const n = plTexte_(nom);
  if (!n) return { ok: false, message: 'Écris d’abord le nom du gars (prénom et initiale du nom).' };
  if (s.pose.concat(s.atelier).some(g => plNorm_(g.nom) === plNorm_(n))) return { ok: false, message: '« ' + n + ' » est déjà dans cette semaine.' };
  if (equipe === 'atelier') {
    if (s.atelier.length >= PL_MAX_ATELIER) return { ok: false, message: 'Déjà ' + PL_MAX_ATELIER + ' gars à l’atelier : l’affiche A3 ne serait plus lisible.' };
    s.atelier = plTrier_(s.atelier.concat([{ nom: n, jours: ['', '', '', '', ''] }]));
  } else {
    if (s.pose.length >= PL_MAX_POSE) return { ok: false, message: 'Déjà ' + PL_MAX_POSE + ' gars à la pose : l’affiche A3 ne serait plus lisible.' };
    s.pose = plTrier_(s.pose.concat([{ nom: n, vehicule: plTexte_(vehicule), jours: ['', '', '', '', ''], vehiculesJour: ['', '', '', '', ''] }]));
  }
  return { ok: true, message: '« ' + n + ' » est ajouté (' + (equipe === 'atelier' ? 'atelier' : 'pose') + ').', semaine: s };
}
// Retirer un gars. Rend { ok, message, semaine, avaitDesSaisies }.
function plRetirerGars_(s, nom) {
  const n = plNorm_(nom), dans = l => l.filter(g => plNorm_(g.nom) === n);
  const trouves = dans(s.pose).concat(dans(s.atelier));
  if (!trouves.length) return { ok: false, message: '« ' + plTexte_(nom) + ' » n’est pas dans cette semaine.' };
  const saisies = trouves.some(g => g.jours.some(j => plTexte_(j)));
  s.pose = s.pose.filter(g => plNorm_(g.nom) !== n);
  s.atelier = s.atelier.filter(g => plNorm_(g.nom) !== n);
  return { ok: true, message: '« ' + plTexte_(nom) + ' » est retiré de cette semaine.', semaine: s, avaitDesSaisies: saisies };
}
// Ce que « Vérifier la semaine » trouve : la semaine remise d'aplomb (saisies complétées, gars triés), et la liste des remarques
function plVerifier_(s, index) {
  const remarques = [], noms = {};
  const voir = (g, equipe) => {
    const cle = plNorm_(g.nom);
    if (!cle) remarques.push('Une ligne ' + equipe + ' n’a pas de nom.');
    else if (noms[cle]) remarques.push('« ' + g.nom + ' » est écrit deux fois.');
    noms[cle] = true;
    g.jours = g.jours.map((valeur, i) => {
      const propre = equipe === 'atelier' ? plMorceaux_(valeur).join('\n') : plCompleter_(valeur, index);
      const ou = (g.nom || '?') + ', ' + PL_JOURS[i].toLowerCase();
      const mot = plMotAEviter_(propre, index);
      if (mot) remarques.push(ou + ' : le mot « ' + mot + ' » ne doit pas être écrit dans le planning (écris « Absent »).');
      if (equipe === 'atelier') { if (plMorceaux_(propre).length > 4) remarques.push(ou + ' : plus de 4 tâches dans la journée.'); return propre; }
      const lu = plLireCase_(propre, index);
      if (lu.probleme) remarques.push(ou + ' : ' + lu.probleme + '.');
      lu.morceaux.forEach(m => { if (!m.numero && index.cas.map(plNorm_).indexOf(plNorm_(m.texte)) < 0) remarques.push(ou + ' : « ' + m.texte + ' » n’est pas dans la liste (accepté tel quel).'); });
      return propre;
    });
  };
  s.pose.forEach(g => voir(g, 'pose'));
  s.atelier.forEach(g => voir(g, 'atelier'));
  s.pose = plTrier_(s.pose); s.atelier = plTrier_(s.atelier);
  return { semaine: s, remarques: remarques };
}

// ── L'affiche compacte (une ligne par gars) : l'onglet « AFFICHE A3 », et le PDF publié pour les gars ──
// Le texte court d'une case : « 901 Tilleuls » ; journée coupée : « ½ 901 Tilleuls / ½ 903 Lilas »
function plTexteAffiche_(valeur, index) {
  return plLireCase_(valeur, index).morceaux.map(m => {
    const c = m.numero ? index.parNumero[plNorm_(m.numero)] : null;
    const texte = c && plNorm_(m.texte) === plNorm_(c.libelle) ? c.numero + ' ' + (c.court || c.nom) : m.texte;
    return (m.quarts && PL_PARTS[m.quarts] ? PL_PARTS[m.quarts] + ' ' : '') + texte;
  }).join(PL_SEPARATEUR_AFFICHE);
}
// Marque courte d'un véhicule : « Plateau 2 » → « Pla. » (4 lettres au plus)
function plMarqueVehicule_(v) { const t = plTexte_(v); return t.length <= 4 ? t : t.slice(0, 3) + '.'; }
// Le tableau de l'affiche : { titre, lignes: [[véhicule, nom, lundi…vendredi]], sortes: ['entete'|'section'|'pose'|'atelier'],
//   vehicules: [[véhicule du jour ×5] par ligne] (pour les couleurs), plusLong: longueur du plus long texte d'une case }
function plAffiche_(s, index) {
  const lignes = [plEntetes_(s.lundi)], sortes = ['entete'], vehicules = [null];
  let plusLong = 0;
  const pousser = (l, sorte, veh) => { lignes.push(l); sortes.push(sorte); vehicules.push(veh || null); l.slice(2).forEach(t => { plusLong = Math.max(plusLong, String(t).length); }); };
  if (s.pose.length) pousser(['POSE', '', '', '', '', '', ''], 'section');
  s.pose.forEach(g => {
    const duJour = g.vehiculesJour.map(v => plTexte_(v) || g.vehicule);
    pousser([g.vehicule, g.nom].concat(g.jours.map((j, i) => {
      const t = plTexteAffiche_(j, index);
      return t && plNorm_(duJour[i]) !== plNorm_(g.vehicule) ? t + ' [' + plMarqueVehicule_(duJour[i]) + ']' : t;
    })), 'pose', duJour);
  });
  if (s.atelier.length) pousser(['ATELIER', '', '', '', '', '', ''], 'section');
  s.atelier.forEach(g => pousser(['', g.nom].concat(g.jours.map(j => plMorceaux_(j).join(PL_SEPARATEUR_AFFICHE))), 'atelier'));
  return { titre: 'PLANNING LOUÉ — ' + plTitre_(s.lundi), lignes: lignes, sortes: sortes, vehicules: vehicules, plusLong: plusLong };
}
// Taille du texte et mesures de l'affiche sur une A3 en paysage (420 × 297 mm, marges de 8 mm) : le plus gros possible.
// Estimation (largeur moyenne d'une lettre = 0,5 × la taille) : à mesurer sur une vraie impression.
function plMesuresAffiche_(a) {
  const largeurUtile = 404, hauteurUtile = 281, mmParPoint = 0.3528;
  const nb = a.lignes.length + 1;                               // + la ligne de titre
  const colVehicule = 30, colNom = 38, colJour = (largeurUtile - colVehicule - colNom) / 5;
  const parHauteur = (hauteurUtile / nb) / (1.45 * mmParPoint);                          // une ligne de texte par gars
  const parLargeur = (colJour - 3) / (Math.max(8, a.plusLong) * 0.5 * mmParPoint);        // le plus long texte tient sur la ligne
  // sous 9 points, on préfère écrire sur deux lignes dans la case plutôt que de réduire encore
  let taille = Math.floor(Math.min(parHauteur, parLargeur, 24));
  let lignesParCase = 1;
  if (taille < 11) { taille = Math.floor(Math.min((hauteurUtile / nb) / (2 * 1.3 * mmParPoint), (colJour - 3) / (Math.max(8, a.plusLong / 2) * 0.5 * mmParPoint), 24)); lignesParCase = 2; }
  taille = Math.max(7, taille);
  const px = mm => Math.round(mm * 3.7795);                      // 96 points par pouce : ce que comptent les largeurs de Google Sheets
  return { taille: taille, lignesParCase: lignesParCase, hauteurLigne: px(hauteurUtile / nb), largeurs: [px(colVehicule), px(colNom)].concat(PL_JOURS.map(() => px(colJour))) };
}

// ── Ce que lit l'appli (onglet « APPLI ») : les semaines publiées et qui y est planifié sur quel chantier ──
// semaines = [{ semaine (modèle), publieLe (texte) }] ; comptes = { nom normalisé : identifiant du compte de l'appli }
// Rend les lignes à écrire sous la ligne de titres : ['SEMAINE', lundi, '', '', publié le] puis ['PLANIFIE', lundi, compte, numéro, publié le]
// Seule la POSE compte ; un compte donné à deux gars est ignoré (on ne devine pas) ; un numéro ne sort qu'une fois par gars et par semaine.
function plLignesAppli_(semaines, comptes, index) {
  const lignes = [];
  semaines.slice().sort((a, b) => (a.semaine.lundi < b.semaine.lundi ? -1 : 1)).forEach(x => {
    const s = x.semaine;
    lignes.push(['SEMAINE', s.lundi, '', '', x.publieLe || '']);
    s.pose.forEach(g => {
      const compte = plTexte_(comptes[plNorm_(g.nom)]);
      if (!compte) return;
      const vus = {};
      g.jours.forEach(j => plLireCase_(j, index).morceaux.forEach(m => {
        if (!m.numero || vus[m.numero]) return;
        vus[m.numero] = true;
        lignes.push(['PLANIFIE', s.lundi, compte, m.numero, x.publieLe || '']);
      }));
    });
  });
  return lignes;
}
// Les comptes de l'appli lus dans l'onglet SALARIÉS (lignes [nom, équipe, véhicule, compte]) : { nom normalisé : compte }.
// Un compte écrit sur deux lignes, ou deux lignes du même nom : ignorés tous les deux, et listés dans « problemes ».
function plComptes_(lignesSalaries) {
  const parNom = {}, parCompte = {}, problemes = [];
  (lignesSalaries || []).forEach(l => {
    const nom = plNorm_(l[0]), compte = plTexte_(l[3]);
    if (!nom || !compte) return;
    if (parNom[nom] !== undefined) { parNom[nom] = ''; problemes.push('« ' + plTexte_(l[0]) + ' » est écrit deux fois dans SALARIÉS'); return; }
    if (parCompte[compte.toLowerCase()]) { parNom[parCompte[compte.toLowerCase()]] = ''; parNom[nom] = ''; problemes.push('le compte « ' + compte + ' » est donné à deux gars'); return; }
    parNom[nom] = compte; parCompte[compte.toLowerCase()] = nom;
  });
  return { comptes: parNom, problemes: problemes };
}
// Le texte d'une semaine qui compte pour « a-t-elle changé depuis sa publication ? » (tout sauf la case et l'état)
function plContenu_(s) {
  return JSON.stringify([s.lundi, s.pose.map(g => [g.nom, g.vehicule, g.jours, g.vehiculesJour]), s.atelier.map(g => [g.nom, g.jours])]);
}
// Les lignes d'une semaine pour l'onglet HISTORIQUE : [lundi, équipe, nom, lundi…vendredi]
function plLignesHistorique_(s) {
  return s.pose.map(g => [s.lundi, 'Pose', g.nom].concat(g.jours.map(j => plMorceaux_(j).join(PL_SEPARATEUR_AFFICHE))))
    .concat(s.atelier.map(g => [s.lundi, 'Atelier', g.nom].concat(g.jours.map(j => plMorceaux_(j).join(PL_SEPARATEUR_AFFICHE)))));
}
// La liste des chantiers de l'appli → la liste du planning. lignes = celles de l'onglet Chantiers de l'appli (sans les titres) :
// colonne A = nom, C = statut, E = numéro, F = nom court. Seuls les chantiers NON « Terminé » qui ont un numéro ; triés par numéro.
// anciens = [{ numero, court }] : un « nom court » tapé à la main dans le planning est gardé (retrouvé par le numéro) ;
// à défaut, c'est le nom court de l'appli (colonne F) qui sert.
function plListeChantiers_(lignes, anciens) {
  const courts = {};
  (anciens || []).forEach(a => { if (plTexte_(a.numero) && plTexte_(a.court)) courts[plNorm_(a.numero)] = plTexte_(a.court); });
  const liste = [], vus = {};
  (lignes || []).forEach(r => {
    const nom = plTexte_(r[0]), statut = plTexte_(r[2]), numero = plTexte_(r[4]);
    if (!nom || !numero || statut === 'Terminé' || vus[plNorm_(numero)]) return;
    vus[plNorm_(numero)] = true;
    liste.push({ numero: numero, nom: nom, court: courts[plNorm_(numero)] || plTexte_(r[5]) });
  });
  const cle = c => { const n = parseFloat(c.numero.replace(',', '.')); return isNaN(n) ? Infinity : n; };
  return liste.sort((a, b) => cle(a) - cle(b) || a.numero.localeCompare(b.numero));
}

// ── L'onglet LISTES : lignes et colonnes fixes ──
//   A, B, C : les chantiers (N°, nom, nom court pour l'affiche) — A et B recopiés chaque nuit depuis l'appli, C tapé à la main
//   D       : la liste de saisie (« N° NOM » puis les autres cas), refaite par le programme
//   F, G    : les véhicules et leur couleur (code « #RRGGBB », pastel)
//   I       : les autres cas ; K : les tâches de l'atelier
//   M, N    : M1 « Liste des chantiers », N1 = son état (« à jour du … ») ; M2 « Mettre à jour maintenant », N2 = case à cocher
const PL_L = { lig1: 2, colNumero: 1, colNom: 2, colCourt: 3, colChoix: 4, colVehicule: 6, colCouleur: 7, colCas: 9, colTache: 11,
  colLibelle: 13, colEtat: 14, nbCol: 14, max: 600 };
const PL_L_TITRES = ['N°', 'Chantier', 'Nom court (affiche)', 'Liste de saisie (ne pas modifier)', '', 'Véhicule', 'Couleur (#RRGGBB)', '',
  'Autres cas', '', 'Tâches de l’atelier', '', 'Liste des chantiers', 'jamais mise à jour'];
// L'onglet SALARIÉS : A nom (prénom + initiale), B équipe (Pose / Atelier), C véhicule habituel, D compte de l'appli (verrouillée)
const PL_SAL_TITRES = ['Nom (prénom et initiale)', 'Équipe (Pose ou Atelier)', 'Véhicule habituel', 'Compte de l’appli (réservé à Franck)'];
const PL_COULEUR_DEFAUT = '#FFFFFF', PL_COULEUR_SECTION = '#1A4A8A', PL_COULEUR_ENTETE = '#E8EEF7', PL_COULEUR_FINE = '#F3F3F3', PL_ROUGE = '#CC0000';

// La liste de saisie (colonne D de LISTES) : tous les « N° NOM », puis les autres cas
function plChoix_(index) { return index.libelles.concat(index.cas); }
function plCouleurVehicule_(nom, vehicules) {
  const n = plNorm_(nom), v = (vehicules || []).filter(x => plNorm_(x.nom) === n)[0];
  return v && /^#[0-9a-fA-F]{6}$/.test(plTexte_(v.couleur)) ? plTexte_(v.couleur).toUpperCase() : PL_COULEUR_DEFAUT;
}
// Couleurs d'un onglet de semaine, pour ses lignes à partir de la ligne 4 et ses 7 colonnes visibles :
//   { fonds: [[…7]], textes: [[…7]] } — une case de pose prend la couleur du véhicule DU JOUR (ou, à défaut, de la semaine) ;
//   une case qui contient un mot à éviter est écrite en rouge.
function plStyles_(valeurs, vehicules, index) {
  const v = valeurs || [], fonds = [], textes = [];
  for (let l = PL_S.lig1; l <= v.length; l++) {
    const r = v[l - 1] || [], marque = plTexte_(r[PL_S.colMarque - 1]);
    const fond = [], texte = [];
    for (let c = 1; c <= 7; c++) { fond.push(PL_COULEUR_DEFAUT); texte.push('#000000'); }
    if (marque === PL_M.titre) { for (let c = 0; c < 7; c++) { fond[c] = PL_COULEUR_SECTION; texte[c] = '#FFFFFF'; } }
    else if (marque === PL_M.vehicule) { for (let c = 0; c < 7; c++) { fond[c] = PL_COULEUR_FINE; texte[c] = '#666666'; } }
    else if (marque === PL_M.pose) {
      const semaine = plTexte_(r[PL_S.colVehicule - 1]), suivante = v[l] || [];
      const aFine = plTexte_(suivante[PL_S.colMarque - 1]) === PL_M.vehicule;
      fond[0] = plCouleurVehicule_(semaine, vehicules); fond[1] = fond[0];
      for (let j = 0; j < 5; j++) {
        const duJour = aFine ? plTexte_(suivante[PL_S.colJour1 - 1 + j]) : '';
        fond[2 + j] = plCouleurVehicule_(duJour || semaine, vehicules);
        if (plMotAEviter_(r[PL_S.colJour1 - 1 + j], index)) texte[2 + j] = PL_ROUGE;
      }
    } else if (marque === PL_M.atelier) {
      for (let j = 0; j < 5; j++) if (plMotAEviter_(r[PL_S.colJour1 - 1 + j], index)) texte[2 + j] = PL_ROUGE;
    }
    fonds.push(fond); textes.push(texte);
  }
  return { fonds: fonds, textes: textes };
}
// Une date et une heure écrites pour Franck : « 20/11 à 16 h 10 » (d = objet Date, fuseau de Paris géré par l'appelant)
function plQuand_(jj, mm, hh, mi) { return plDeux_(jj) + '/' + plDeux_(mm) + ' à ' + hh + ' h ' + plDeux_(mi); }

// ── Lot 14 : une absence acceptée par la direction, inscrite dans une case ──
// Les jours ouvrés (lundi à vendredi) d'une absence, du … au … compris
function plJoursAbsence_(du, au) {
  const jours = [];
  if (!plEstIso_(du) || !plEstIso_(au) || au < du) return jours;
  for (let j = du, n = 0; j <= au && n < 400; j = plDecaler_(j, 1), n++) { const rang = (plDate_(j).getUTCDay() + 6) % 7; if (rang < 5) jours.push(j); }
  return jours;
}
// Ce que devient une case quand une absence s'y inscrit. duree : « Matin », « Après-midi », sinon la journée entière.
//   journée entière : la case devient l'appellation (« Congés ») ; ce qui y était écrit est rendu dans « avant » ;
//   demi-journée    : « ½ Congés » est ajouté, avant (matin) ou après (après-midi) ce qui est déjà écrit ; un chantier seul devient « ½ … ».
// Rend { valeur, change, avant }. Ne change rien si l'absence y est déjà.
function plAvecAbsence_(valeur, duree, libelle) {
  const d = plNorm_(duree), matin = d === 'matin', demi = matin || d === 'apres-midi' || d === 'apres midi';
  const lignes = plMorceaux_(valeur), avant = lignes.join(PL_SEPARATEUR_AFFICHE);
  const est = (l, t) => plNorm_(plPart_(l).texte) === plNorm_(t), quarts = l => plPart_(l).quarts;
  const rien = () => ({ valeur: lignes.join('\n'), change: false, avant: '' });
  // Un jour férié reste un jour férié
  if (lignes.length === 1 && est(lignes[0], 'Férié')) return rien();
  const rang = lignes.findIndex(l => est(l, libelle));
  if (!demi) {
    if (lignes.length === 1 && rang === 0 && !quarts(lignes[0])) return rien();          // déjà inscrite
    return { valeur: libelle, change: true, avant: avant };
  }
  const part = PL_PARTS[2] + ' ' + libelle;
  if (rang > -1) {
    if (lignes.length === 1 && !quarts(lignes[0])) return rien();                         // déjà absent toute la journée
    if (lignes.length > 1 && rang === (matin ? 0 : lignes.length - 1)) return rien();     // cette demi-journée y est déjà
    // l'AUTRE demi-journée y était déjà (deux demandes pour le même jour) : la journée entière devient l'absence
    return { valeur: libelle, change: true, avant: lignes.filter((l, i) => i !== rang).join(PL_SEPARATEUR_AFFICHE) };
  }
  if (!lignes.length) return { valeur: part, change: true, avant: '' };
  if (lignes.length === 1 && !quarts(lignes[0])) {                                        // un chantier seul : il garde l'autre demi-journée
    const autre = PL_PARTS[2] + ' ' + lignes[0];
    return { valeur: (matin ? [part, autre] : [autre, part]).join('\n'), change: true, avant: '' };
  }
  if (lignes.length === 2 && quarts(lignes[0]) === 2 && quarts(lignes[1]) === 2) {         // journée déjà coupée en deux : l'absence REMPLACE sa moitié
    return { valeur: (matin ? [part, lignes[1]] : [lignes[0], part]).join('\n'), change: true, avant: matin ? lignes[0] : lignes[1] };
  }
  // autre découpage (quarts, part seule…) : ajoutée ; « Vérifier la semaine » dira si les parts dépassent la journée
  return { valeur: (matin ? [part].concat(lignes) : lignes.concat([part])).join('\n'), change: true, avant: '' };
}
