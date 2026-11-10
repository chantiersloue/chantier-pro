// ═══════════════════════════════════════════════════════════════
// Loué App — Comptes.gs (lot 2) : comptes, mots de passe, jetons de connexion, droits sur les chantiers,
// période de transition. Les fichiers .gs du projet partagent les mêmes constantes et fonctions.
//
// RÈGLE DE SÉCURITÉ : le Sheet n'est partagé qu'avec Franck. Toute personne qui peut le MODIFIER peut aussi ouvrir
// ce script et lire la clé secrète des jetons (Propriétés du script) : elle pourrait se faire passer pour n'importe qui.
//
// Fonctions à lancer dans l'éditeur (choisir la fonction en haut, puis ▶ Exécuter) :
//   genererCle()            une fois : crée la clé secrète des jetons
//   preparerOngletsLot2()   une fois : onglets Utilisateurs, Accès chantiers, Intervenants, colonnes de Chantiers
//   mesurerHachage()        sur TEST : règle le temps de calcul des mots de passe
//   demarrerTransition()    après la fusion des pages du lot 2 : 15 jours où l'appli marche encore sans compte
//   prolongerTransition()   +7 jours ;  finirTransitionMaintenant() : TEST seulement
// ═══════════════════════════════════════════════════════════════

const SHEET_UTILISATEURS = 'Utilisateurs';
const SHEET_ACCES        = 'Accès chantiers';
const SHEET_INTERVENANTS = 'Intervenants';
const SHEET_SANS_COMPTE  = 'Sans compte';

const ROLES = ['Poseur', 'Conducteur', 'Atelier', 'Admin'];
const ROLES_TOUS_CHANTIERS = ['Conducteur', 'Admin'];   // les autres : cases de l'onglet « Accès chantiers »

// Colonnes de l'onglet Utilisateurs (numéros à partir de 1)
const COL_U = { id: 1, nom: 2, role: 3, actif: 4, reinit: 5, provisoire: 6, valable: 7, deconnecter: 8, tous: 9, etat: 10 };
const ENTETES_UTILISATEURS = ['Identifiant', 'Nom', 'Rôle', 'Actif', 'Réinitialiser le mot de passe', 'Mot de passe provisoire',
  'Provisoire valable jusqu’au', 'Déconnecter ses téléphones', 'Tous les chantiers', 'État (rempli par l’appli)'];
const ENTETES_CHANTIERS_9A = ['N°', 'Nom court', 'Adresse', 'Client', 'Architecte', 'Date « Terminé »', 'Chemin MEGA'];
const ENTETES_INTERVENANTS = ['Chantier', 'Nom', 'Société', 'Lot / fonction', 'Mail', 'Téléphone', 'Mis à jour le'];
const STATUTS_CHANTIER = ['En préparation', 'En cours', 'Terminé'];

const DUREE_JETON_JOURS    = 90;    // une connexion tous les 90 jours au plus (prolongée à l'usage)
const PROLONGER_APRES_JOURS = 30;   // un jeton de plus de 30 jours est remplacé par un neuf dans la réponse
const DUREE_PROVISOIRE_H   = 48;    // un mot de passe provisoire sert une fois, pendant 48 h
const ESSAIS_AVANT_BLOCAGE = 5;     // 5 mots de passe faux → identifiant bloqué 15 min
const BLOCAGE_MIN          = 15;
const ECHECS_GLOBAUX_HEURE = 50;    // au-delà, pour toute l'appli : alerte à Franck
const ITERATIONS_DEFAUT    = 2000;  // réglable par la propriété HACHAGE_ITERATIONS (mesurerHachage) ; gardé avec chaque compte
const DUREE_TRANSITION_JOURS = 15;
const MAX_SANS_COMPTE_PAR_JOUR = 200;
const MDP_MIN = 8;
const MDP_EVIDENTS = ['12345678', '123456789', '1234567890', '87654321', '00000000', '11111111', 'azertyui', 'azertyuiop',
  'qwertyui', 'qwertyuiop', 'motdepasse', 'password', 'loueloue', 'menuiserie', 'chantier', 'chantiers'];

const MSG_CONNEXION = 'Appli à mettre à jour ou connexion nécessaire : touchez « Mettre à jour » en haut de l’accueil si le bouton est là, '
  + 'puis connectez-vous. Votre fiche est gardée dans le téléphone.';
const MSG_JETON = 'Session terminée : reconnectez-vous depuis l’accueil. Vos fiches en attente sont gardées.';
const MSG_ERREUR_COMPTES = 'Serveur momentanément indisponible : réessayez dans quelques minutes (les fiches en attente repartent toutes seules)';
const JOURS_FICHES_APRES_DESACTIVATION = 7;   // un compte décoché « Actif » peut encore envoyer les fiches de son téléphone 7 jours

// ── Outils ──
function maintenant_() { return Date.now(); }   // remplacée dans les tests pour simuler le temps qui passe
function normaliserId_(id) { return String(id || '').trim().toLowerCase(); }
function idCompteValide_(id) { return /^[a-z0-9_-]{2,30}$/.test(id); }
function aleatoire_(n) {   // n caractères hexadécimaux aléatoires
  let s = '';
  while (s.length < n) s += Utilities.getUuid().replace(/-/g, '');
  return s.slice(0, n);
}
// Comparaison qui prend toujours le même temps (ne laisse pas deviner un jeton caractère par caractère)
function egaux_(a, b) {
  a = String(a || ''); b = String(b || '');
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}
function texteDate_(ms) { return Utilities.formatDate(new Date(ms), 'Europe/Paris', 'dd/MM/yyyy HH:mm'); }
function codeEnv_() { return propriete_('ENVIRONNEMENT') === 'TEST' ? 't' : 'p'; }

// ── Empreinte d'un mot de passe : HMAC-SHA256 répété n fois avec un sel propre au compte (jamais le mot de passe en clair) ──
function empreinte_(mdp, sel, n) {
  let h = String(sel);
  for (let i = 0; i < n; i++) h = Utilities.base64Encode(Utilities.computeHmacSha256Signature(h, String(mdp)));
  return h;
}
function iterations_() { return Math.max(100, Number(propriete_('HACHAGE_ITERATIONS')) || ITERATIONS_DEFAUT); }
function nouvelleEmpreinte_(mdp) {
  const n = iterations_();
  const sel = aleatoire_(32);
  return { sel: sel, emp: empreinte_(mdp, sel, n), n: n };
}
function verifierEmpreinte_(mdp, e) { return !!(e && e.emp) && egaux_(empreinte_(mdp, e.sel, e.n), e.emp); }

// Mot de passe provisoire : 8 minuscules et chiffres faciles à lire et à taper avec des gants (ni 0/o, ni 1/l/i)
const ALPHABET_PROVISOIRE = 'abcdefghjkmnpqrstuvwxyz23456789';
function motDePasseProvisoire_() {
  const hex = aleatoire_(16);
  let s = '';
  for (let i = 0; i < 8; i++) s += ALPHABET_PROVISOIRE.charAt(parseInt(hex.substr(i * 2, 2), 16) % ALPHABET_PROVISOIRE.length);
  return s;
}

// Règles d'un mot de passe choisi : renvoie '' s'il convient, sinon la raison (affichée telle quelle)
function refusMotDePasse_(mdp, id) {
  const m = String(mdp || '');
  const ident = normaliserId_(id);
  if (m.length < MDP_MIN) return 'Le mot de passe doit faire au moins ' + MDP_MIN + ' caractères.';
  if (m.length > 100) return 'Mot de passe trop long (100 caractères au plus).';
  const bas = m.toLowerCase();
  if (ident && (bas === ident || (ident.length >= 4 && bas.indexOf(ident) > -1))) return 'Le mot de passe ne doit pas contenir votre identifiant.';
  if (/^(.)\1+$/.test(m) || MDP_EVIDENTS.indexOf(bas) > -1) return 'Mot de passe trop facile à deviner : choisissez-en un autre.';
  return '';
}

// ── Données techniques d'un compte (Propriétés du script, jamais dans le Sheet) ──
// emp, sel, n : mot de passe choisi ; prov : { emp, sel, n, exp } mot de passe provisoire en cours ;
// ver : version de session (augmente à chaque « Déconnecter » / « Réinitialiser » / changement de mot de passe)
// Une erreur de LECTURE remonte (le serveur répond alors « ERREUR » : personne n'est déconnecté pour une panne)
function lireCompte_(id) {
  const brut = PropertiesService.getScriptProperties().getProperty('COMPTE_' + id);
  if (!brut) return { ver: 1 };
  try { return JSON.parse(brut); } catch (e) { return { ver: 1 }; }
}
function ecrireCompte_(id, c) { PropertiesService.getScriptProperties().setProperty('COMPTE_' + id, JSON.stringify(c)); }

// ── Clé secrète des jetons ──
// À lancer UNE fois (sur TEST, puis sur la production) : la clé est écrite directement dans les Propriétés du script.
function genererCle() {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('CLE_JETON')) {
    const m = 'La clé existe déjà : rien n’est changé.';
    Logger.log(m); return m;
  }
  props.setProperty('CLE_JETON', aleatoire_(96));
  const m = '✅ Clé secrète créée et rangée dans les Propriétés du script (ne la copiez nulle part).';
  Logger.log(m); return m;
}
// Cas grave uniquement (clé divulguée) : TOUS les téléphones devront se reconnecter.
// Garde-fou : refuse si la propriété CONFIRMER_CHANGER_CLE ne vaut pas OUI (à poser à la main juste avant).
function changerCle() {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('CONFIRMER_CHANGER_CLE') !== 'OUI') {
    const m = 'Refusé : changer la clé déconnecte TOUS les téléphones. Si c’est vraiment voulu, ajoutez la propriété '
      + 'CONFIRMER_CHANGER_CLE = OUI (Paramètres du projet → Propriétés du script), puis relancez changerCle().';
    Logger.log(m); return m;
  }
  props.setProperty('CLE_JETON', aleatoire_(96));
  props.deleteProperty('CONFIRMER_CHANGER_CLE');
  const m = '✅ Nouvelle clé : tous les téléphones devront se reconnecter.';
  Logger.log(m); return m;
}
function cleJeton_() {
  const k = propriete_('CLE_JETON');
  if (!k) throw new Error('Clé secrète absente : lancer genererCle() dans l’éditeur Apps Script');
  return k;
}

// ── Jeton : « identifiant.environnement.version.expiration.signature » ──
function signer_(texte) { return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(texte, cleJeton_())).replace(/=+$/, ''); }
function fabriquerJeton_(id, ver) {
  const corps = id + '.' + codeEnv_() + '.' + ver + '.' + (maintenant_() + DUREE_JETON_JOURS * 24 * 3600 * 1000);
  return corps + '.' + signer_(corps);
}
// { id, ver, exp } si la signature est bonne, l'environnement le bon et le jeton pas expiré ; sinon null.
// cleJeton_() peut lever une erreur (clé absente) : c'est voulu (réponse « ERREUR », pas « session terminée »)
function lireJeton_(jeton) {
  const m = String(jeton || '').match(/^([a-z0-9_-]{2,30})\.([pt])\.(\d{1,9})\.(\d{10,16})\.([A-Za-z0-9_-]{20,})$/);
  if (!m) return null;
  if (!egaux_(signer_(m[1] + '.' + m[2] + '.' + m[3] + '.' + m[4]), m[5])) return null;
  if (m[2] !== codeEnv_()) return null;
  if (Number(m[4]) < maintenant_()) return null;
  return { id: m[1], ver: Number(m[3]), exp: Number(m[4]) };
}

// ── Onglet Utilisateurs, lu une fois par requête ──
let UTILISATEURS_ = null;
function utilisateurs_() {
  if (UTILISATEURS_) return UTILISATEURS_;
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_UTILISATEURS);
  if (!sh) throw new Error('Onglet « ' + SHEET_UTILISATEURS + ' » absent : lancer preparerOngletsLot2()');
  const lignes = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, COL_U.etat).getValues() : [];
  const parId = {}, vus = {}, doublons = {};
  lignes.forEach((r, i) => {
    const id = normaliserId_(r[COL_U.id - 1]);
    if (!id) return;
    if (vus[id]) doublons[id] = true;
    vus[id] = true;
    parId[id] = { ligne: i + 2, id: id, brut: String(r[COL_U.id - 1]), nom: String(r[COL_U.nom - 1] || '').trim(),
      role: String(r[COL_U.role - 1] || '').trim(), actif: r[COL_U.actif - 1] === true,
      tousCoche: r[COL_U.tous - 1] === true, valeurs: r };
  });
  UTILISATEURS_ = { sh: sh, lignes: lignes, parId: parId, doublons: doublons };
  return UTILISATEURS_;
}
function compteUtilisable_(u, id) {
  const l = u.parId[id];
  return !!l && !u.doublons[id] && l.actif && ROLES.indexOf(l.role) > -1 && idCompteValide_(id);
}
function profil_(ligne) {
  return { id: ligne.id, nom: ligne.nom, role: ligne.role,
    tous: ROLES_TOUS_CHANTIERS.indexOf(ligne.role) > -1 || ligne.tousCoche,
    conducteur: ROLES_TOUS_CHANTIERS.indexOf(ligne.role) > -1 };
}
function ecrireEtat_(ligne, texte) {
  try { utilisateurs_().sh.getRange(ligne, COL_U.etat).setValue(cellule_(texte)); } catch (e) { console.error('ecrireEtat_ :', e.message); }
}

// ── Qui fait la requête ? ──
// Renvoie { compte } (profil + jetonNeuf éventuel), { sans: true } (pas de jeton, transition ouverte) ou { refus: réponse }
// Codes : JETON_INVALIDE (la page efface le jeton), CONNEXION_REQUISE, COMPTE_REFUSE (jeton gardé),
// COMPTES_INDISPONIBLES (problème du serveur : jeton gardé, la page réessaie comme après une coupure de réseau)
const REFUS_INDISPONIBLE = { ok: false, code: 'COMPTES_INDISPONIBLES', message: MSG_ERREUR_COMPTES };
function identifier_(corps) {
  const jeton = corps && corps.jeton;
  let ouverte = false;
  try { ouverte = transitionOuverte_(); } catch (e) { return { refus: REFUS_INDISPONIBLE }; }
  if (!jeton) return ouverte ? { sans: true } : { refus: { ok: false, code: 'CONNEXION_REQUISE', message: MSG_CONNEXION } };
  try {
    // Jeton faux, expiré ou révoqué (« Déconnecter », « Réinitialiser », nouveau mot de passe) : la page l'efface.
    // Pendant la transition, la requête passe quand même « sans compte » (comme une page qui n'a pas de jeton).
    const invalide = () => ouverte ? { sans: true, jetonInvalide: true }
      : { refus: { ok: false, code: 'JETON_INVALIDE', message: MSG_JETON } };
    const lu = lireJeton_(jeton);
    if (!lu) return invalide();
    const u = utilisateurs_();
    if (!u.parId[lu.id]) return invalide();                               // ligne supprimée
    const c = lireCompte_(lu.id);
    if (Number(c.ver || 1) !== lu.ver) return invalide();
    // Ligne en double, décochée « Actif », rôle mal tapé : refus, mais le jeton est GARDÉ (une faute de saisie dans le
    // Sheet, une fois corrigée, ne doit pas obliger à réinitialiser la personne). Pour révoquer : « Déconnecter ».
    // Les fiches et photos d'un compte refusé sont quand même acceptées (« désactive ») : la dernière fiche d'un gars
    // qui part ne reste pas bloquée dans son téléphone, et envoyer une fiche ne révèle rien.
    const ligneU = u.parId[lu.id];
    const recent = !c.inactifDepuis || maintenant_() - c.inactifDepuis < JOURS_FICHES_APRES_DESACTIVATION * 24 * 3600 * 1000;
    if (!compteUtilisable_(u, lu.id)) return { desactive: !ligneU.actif && !recent ? '' : lu.id, refus: { ok: false, code: 'COMPTE_REFUSE',
      message: 'Compte refusé pour l’instant (désactivé ou mal rempli dans le Sheet) : voyez avec le bureau. Vos fiches sont gardées.' } };
    const compte = profil_(u.parId[lu.id]);
    if (lu.exp - maintenant_() < (DUREE_JETON_JOURS - PROLONGER_APRES_JOURS) * 24 * 3600 * 1000) compte.jetonNeuf = fabriquerJeton_(lu.id, lu.ver);
    return { compte: compte };
  } catch (err) {
    // Onglet illisible, clé absente, Propriétés indisponibles : problème du SERVEUR, le téléphone garde son jeton.
    // Pendant la transition, une fiche passe quand même « sans compte ».
    console.error('identifier_ :', err.message);
    return { refus: REFUS_INDISPONIBLE, sansPossible: ouverte };
  }
}
// Ajoute le jeton neuf (prolongation) à une réponse
function avecJeton_(rep, compte) {
  if (compte && compte.jetonNeuf) rep.jeton = compte.jetonNeuf;
  return rep;
}

// ── Essais ratés : cache du script (pas de quota journalier ; une perte du cache remet seulement un compteur à zéro) ──
function cacheScript_() { return CacheService.getScriptCache(); }
function minutesBlocage_(id) {
  const jusqua = Number(cacheScript_().get('BLOQUE_' + id) || 0);
  return jusqua > maintenant_() ? Math.ceil((jusqua - maintenant_()) / 60000) : 0;
}
function noterEchec_(id) {
  const cache = cacheScript_();
  const heure = 'ECHECS_H_' + Math.floor(maintenant_() / 3600000);
  const globaux = Number(cache.get(heure) || 0) + 1;
  cache.put(heure, String(globaux), 3700);
  if (globaux > ECHECS_GLOBAUX_HEURE) {
    alerte_('Plus de ' + ECHECS_GLOBAUX_HEURE + ' connexions ratées en une heure sur Loué App (dernier identifiant essayé : « '
      + String(id).slice(0, 30) + ' »). Si personne de l’équipe n’est en train de se tromper, quelqu’un essaie de deviner des mots de passe : '
      + 'les identifiants visés se bloquent 15 min à chaque série de 5 essais. Les téléphones déjà connectés ne sont pas touchés.', 'connexions');
  }
  if (!idCompteValide_(id)) return;
  const n = Number(cache.get('ECHECS_' + id) || 0) + 1;
  if (n >= ESSAIS_AVANT_BLOCAGE) {
    cache.put('BLOQUE_' + id, String(maintenant_() + BLOCAGE_MIN * 60000), BLOCAGE_MIN * 60 + 60);
    cache.remove('ECHECS_' + id);
    // État écrit tout de suite dans le Sheet (sinon au passage suivant de traiterComptes, jusqu'à 10 min) ;
    // seulement pour un compte qui existe (un identifiant inventé n'écrit rien). traiterComptes l'effacera au déblocage.
    try {
      const l = utilisateurs_().parId[id];
      if (l) ecrireEtat_(l.ligne, 'bloqué ' + BLOCAGE_MIN + ' min (5 essais ratés) — « Réinitialiser » débloque');
    } catch (e) { console.error('noterEchec_ :', e.message); }
  } else {
    cache.put('ECHECS_' + id, String(n), BLOCAGE_MIN * 60);
  }
}
function effacerEchecs_(id) { const c = cacheScript_(); c.remove('ECHECS_' + id); c.remove('BLOQUE_' + id); }

// ── Connexion ──
const MSG_FAUX = 'Identifiant ou mot de passe incorrect.';
function refusConnexion_(message, code) { return { ok: false, code: code || 'REFUS', message: message }; }

// Vérifie identifiant + mot de passe (choisi ou provisoire). Renvoie { ligne, compte, provisoire } ou { refus }
function verifierIdentite_(identifiant, mdp) {
  const id = normaliserId_(identifiant);
  mdp = String(mdp || '');
  if (!idCompteValide_(id) || !mdp || mdp.length > 200) { noterEchec_(id); return { refus: refusConnexion_(MSG_FAUX) }; }
  let u, c;
  try { u = utilisateurs_(); cleJeton_(); c = u.parId[id] ? lireCompte_(id) : null; }
  catch (err) { console.error('verifierIdentite_ :', err.message); return { refus: { ok: false, code: 'COMPTES_INDISPONIBLES', message: 'Serveur indisponible : réessayez dans quelques minutes.' } }; }
  const ligne = u.parId[id];
  // Blocage d'abord, pour TOUT essai (provisoire compris) ; un essai pendant le blocage compte dans l'alerte globale.
  // « Réinitialiser » débloque.
  const bloque = minutesBlocage_(id);
  if (bloque) {
    noterEchec_('');
    return { refus: refusConnexion_('Trop d’essais : identifiant bloqué encore ' + bloque + ' min. '
      + 'Le bureau peut le débloquer tout de suite (case « Réinitialiser le mot de passe »).', 'BLOQUE') };
  }
  // Toujours deux calculs d'empreinte (provisoire et mot de passe, ou calculs factices) : le temps de réponse ne dit rien
  const n = iterations_();
  const provBon = c && c.prov ? verifierEmpreinte_(mdp, c.prov) : (empreinte_(mdp, 'calcul-factice-1', n), false);
  const empBon = c && c.emp ? verifierEmpreinte_(mdp, c) : (empreinte_(mdp, 'calcul-factice-2', n), false);
  const provOk = provBon && c.prov.exp > maintenant_();
  if (provBon && !provOk) return { refus: refusConnexion_('Mot de passe provisoire expiré (48 h) : demandez-en un autre au bureau.', 'PROVISOIRE_EXPIRE') };
  const bon = provOk || empBon;
  if (!bon) { noterEchec_(id); return { refus: refusConnexion_(MSG_FAUX) }; }
  // Bon mot de passe : on peut dire pourquoi ça bloque encore
  if (u.doublons[id]) return { refus: refusConnexion_('Cet identifiant est en double dans le Sheet : prévenez le bureau.') };
  if (!ligne.actif) return { refus: refusConnexion_('Compte désactivé : voyez avec le bureau.') };
  if (ROLES.indexOf(ligne.role) < 0) return { refus: refusConnexion_('Rôle du compte non rempli dans le Sheet : prévenez le bureau.') };
  effacerEchecs_(id);
  return { ligne: ligne, compte: c, provisoire: provOk };
}

function connexion_(corps) {
  const v = verifierIdentite_(corps.identifiant, corps.motDePasse);
  if (v.refus) return v.refus;
  if (v.provisoire) return { ok: false, code: 'NOUVEAU_MDP', message: 'Choisissez votre mot de passe (8 caractères au moins).' };
  noterPremiereConnexion_();
  ecrireEtat_(v.ligne.ligne, 'connecté le ' + texteDate_(maintenant_()));
  return { ok: true, code: 'CONNECTE', message: 'Connecté', data: { jeton: fabriquerJeton_(v.ligne.id, Number(v.compte.ver || 1)), profil: profil_(v.ligne) } };
}

// Changer de mot de passe (premier choix après un provisoire, ou changement volontaire)
function motDePasse_(corps) {
  const v = verifierIdentite_(corps.identifiant, corps.ancien);
  if (v.refus) return v.refus;
  const nouveau = String(corps.nouveau || '');
  const raison = refusMotDePasse_(nouveau, v.ligne.id) || (nouveau === String(corps.ancien) ? 'Choisissez un mot de passe différent de l’ancien.' : '');
  if (raison) return { ok: false, code: 'MDP_REFUSE', message: raison };
  const verrou = LockService.getScriptLock();   // court : deux téléphones qui changent le même mot de passe en même temps
  if (!verrou.tryLock(10000)) return { ok: false, code: 'COMPTES_INDISPONIBLES', message: 'Serveur occupé : réessayez dans une minute.' };
  let c;
  try {
    c = lireCompte_(v.ligne.id);
    const e = nouvelleEmpreinte_(nouveau);
    c.emp = e.emp; c.sel = e.sel; c.n = e.n;
    delete c.prov;
    c.ver = Number(c.ver || 1) + 1;           // les autres téléphones de la personne devront se reconnecter
    ecrireCompte_(v.ligne.id, c);
  } finally { verrou.releaseLock(); }
  try {
    utilisateurs_().sh.getRange(v.ligne.ligne, COL_U.provisoire, 1, 2).setValues([['', '']]);
  } catch (e) { console.error('motDePasse_ :', e.message); }
  noterPremiereConnexion_();
  ecrireEtat_(v.ligne.ligne, 'mot de passe choisi le ' + texteDate_(maintenant_()));
  return { ok: true, code: 'CONNECTE', message: 'Mot de passe enregistré', data: { jeton: fabriquerJeton_(v.ligne.id, c.ver), profil: profil_(v.ligne) } };
}

// ── Chantiers visibles par un compte ──
function lignesChantiers_() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_CHANTIERS);
  if (!sh || sh.getLastRow() < 2) return [];
  const larg = Math.max(4, Math.min(11, sh.getLastColumn ? sh.getLastColumn() : 4));
  return sh.getRange(2, 1, sh.getLastRow() - 1, larg).getValues().filter(r => String(r[0] || '').trim());
}
// Noms des chantiers cochés pour un identifiant dans « Accès chantiers » (en minuscules)
function chantiersCoches_(id) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_ACCES);
  if (!sh || sh.getLastRow() < 2) return {};
  const larg = sh.getLastColumn();
  const entetes = sh.getRange(1, 1, 1, larg).getValues()[0].map(normaliserId_);
  const col = entetes.indexOf(id);
  if (col < 2) return {};
  const res = {};
  sh.getRange(2, 1, sh.getLastRow() - 1, larg).getValues().forEach(r => { if (r[col] === true) res[cleChantier_(r[0])] = true; });
  return res;
}
function chantierObjet_(r) {
  return { nom: String(r[0] || '').trim(), reference: String(r[1] || ''), statut: String(r[2] || ''), conducteur: String(r[3] || ''),
    numero: String(r[4] || ''), nomCourt: String(r[5] || ''), adresse: String(r[6] || '') };
}
function chantiersVisibles_(compte) {
  const lignes = lignesChantiers_();
  if (compte.tous) {
    const moi = String(compte.nom || '').trim().toLowerCase();
    return lignes.map(r => Object.assign(chantierObjet_(r), {
      mien: compte.conducteur ? String(r[3] || '').trim().toLowerCase() === moi : String(r[2] || '').trim() !== 'Terminé' }));
  }
  const coches = chantiersCoches_(compte.id);
  return lignes.filter(r => coches[cleChantier_(r[0])] && String(r[2] || '').trim() !== 'Terminé')
    .map(r => Object.assign(chantierObjet_(r), { mien: true }));
}
function peutLireChantier_(compte, nom) {
  if (compte.tous) return true;
  return !!chantiersCoches_(compte.id)[cleChantier_(nom)];
}

// ── Actions de l'API réservées aux comptes ──
function moi_(compte) {
  return avecJeton_({ ok: true, code: 'OK', message: 'Bonjour ' + compte.nom, data: {
    profil: { id: compte.id, nom: compte.nom, role: compte.role, tous: compte.tous, conducteur: compte.conducteur },
    chantiers: chantiersVisibles_(compte),
    transitionJusquau: finTransition_() } }, compte);
}
function listes_(compte) {
  const d = donneesListes_();
  d.chantiers = chantiersVisibles_(compte);
  d.partiel = !compte.tous;   // la page demande confirmation pour un chantier hors de la liste
  return avecJeton_({ ok: true, code: 'OK', message: 'Listes', data: d }, compte);
}
function dossiersCompte_(compte, nom) {
  if (nom !== '__PLANNING__' && !peutLireChantier_(compte, nom)) {
    return { ok: false, code: 'INTERDIT', message: 'Ce chantier ne fait pas partie de vos chantiers : voyez avec le bureau.' };
  }
  return avecJeton_({ ok: true, code: 'OK', message: 'Documents', data: { dossiers: lireDossiers_(nom) } }, compte);
}

// ══════════════════════════════════════════════════════════
// PÉRIODE DE TRANSITION : 15 jours où l'ancienne façon d'envoyer (sans compte) reste acceptée
// ══════════════════════════════════════════════════════════
// Première connexion réussie = les pages du lot 2 sont en service (sert au rappel « transition pas démarrée »)
function noterPremiereConnexion_() {
  try {
    const props = PropertiesService.getScriptProperties();
    if (!props.getProperty('PREMIERE_CONNEXION')) props.setProperty('PREMIERE_CONNEXION', String(maintenant_()));
  } catch (e) {}
}
function transitionOublieeDepuis_() {
  const pc = Number(propriete_('PREMIERE_CONNEXION') || 0);
  return !finTransition_() && pc && maintenant_() - pc > 7 * 24 * 3600 * 1000 ? pc : 0;
}
function finTransition_() { const v = Number(propriete_('FIN_TRANSITION') || 0); return v || null; }
// Pas encore commencée (fin non posée) : tout ce qui marchait au lot 1 continue de marcher
function transitionOuverte_() { const fin = finTransition_(); return !fin || maintenant_() < fin; }

function demarrerTransition() {
  const props = PropertiesService.getScriptProperties();
  if (finTransition_()) {
    const m = 'La transition a déjà commencé : fin le ' + texteDate_(finTransition_()) + '. (prolongerTransition() pour ajouter 7 jours.)';
    Logger.log(m); return m;
  }
  props.setProperty('FIN_TRANSITION', String(maintenant_() + DUREE_TRANSITION_JOURS * 24 * 3600 * 1000));
  props.deleteProperty('ALERTE_TRANSITION_FAITE');
  const m = '✅ Transition commencée : sans compte, l’appli marche encore jusqu’au ' + texteDate_(finTransition_())
    + '. Vous recevrez un mail 3 jours avant. Qui utilise encore l’appli sans compte : onglet « ' + SHEET_SANS_COMPTE + ' ».';
  Logger.log(m); return m;
}
function prolongerTransition() {
  const fin = finTransition_();
  if (!fin) { const m = 'La transition n’a pas commencé : rien à prolonger (demarrerTransition()).'; Logger.log(m); return m; }
  PropertiesService.getScriptProperties().setProperty('FIN_TRANSITION', String(Math.max(fin, maintenant_()) + 7 * 24 * 3600 * 1000));
  PropertiesService.getScriptProperties().deleteProperty('ALERTE_TRANSITION_FAITE');
  const m = '✅ Transition prolongée jusqu’au ' + texteDate_(finTransition_()) + '.';
  Logger.log(m); return m;
}
// Copie TEST seulement : pour essayer ce qui se passe après la transition
function finirTransitionMaintenant() {
  if (propriete_('ENVIRONNEMENT') !== 'TEST') {
    const m = 'Refusé : finirTransitionMaintenant() ne sert qu’à la copie TEST (propriété ENVIRONNEMENT = TEST).';
    Logger.log(m); return m;
  }
  PropertiesService.getScriptProperties().setProperty('FIN_TRANSITION', String(maintenant_() - 1000));
  const m = '✅ TEST : transition terminée, les requêtes sans compte sont maintenant refusées.';
  Logger.log(m); return m;
}

// ── Journal « Sans compte » ──
// fiche : une ligne (200 par jour au plus) ; lectures : un compteur par jour dans le cache, recopié par traiterComptes()
const SORTES_LECTURE = ['listes', 'dossiers', 'planning', 'photo'];
function noterSansCompte_(sorte, donnees) {
  try {
    const cache = cacheScript_();
    if (sorte !== 'fiche') {
      const cle = 'SC_' + jour_() + '_' + sorte;
      cache.put(cle, String(Number(cache.get(cle) || 0) + 1), 6 * 3600);
      return;
    }
    const cleF = 'SCF_' + jour_();
    const n = Number(cache.get(cleF) || 0) + 1;
    cache.put(cleF, String(n), 6 * 3600);
    if (n > MAX_SANS_COMPTE_PAR_JOUR) return;
    const d = donnees || {};
    const nomSaisi = [d.auteur, d.redacteur, d.poseur, d.demandeur, d.nomLoue, d.signataireLoue].filter(Boolean).map(String).join(' / ').slice(0, 100);
    feuille_(SHEET_SANS_COMPTE, ['Date', 'Sorte', 'Fiche', 'Chantier', 'Nom saisi dans la fiche', 'Nombre'])
      .appendRow([new Date(maintenant_()), 'fiche', String(d.type || ''), String(d.chantier || ''), nomSaisi, 1].map(cellule_));
  } catch (e) { console.error('noterSansCompte_ :', e.message); }
}
function recopierCompteursSansCompte_() {
  const cache = cacheScript_();
  const jours = [jour_(), Utilities.formatDate(new Date(maintenant_() - 24 * 3600 * 1000), 'Europe/Paris', 'yyyy-MM-dd')];
  let sh = null, valeurs = null;
  jours.forEach(j => SORTES_LECTURE.forEach(sorte => {
    const cle = 'SC_' + j + '_' + sorte;
    const n = Number(cache.get(cle) || 0);
    if (!n) return;
    if (!sh) {
      sh = feuille_(SHEET_SANS_COMPTE, ['Date', 'Sorte', 'Fiche', 'Chantier', 'Nom saisi dans la fiche', 'Nombre']);
      valeurs = sh.getLastRow() > 1 ? sh.getRange(2, 2, sh.getLastRow() - 1, 5).getValues() : [];   // lu une seule fois
    }
    const etiquette = 'lectures ' + sorte + ' du ' + j;
    let i = valeurs.length - 1;
    while (i >= 0 && valeurs[i][0] !== etiquette) i--;
    if (i >= 0) { valeurs[i][4] = Number(valeurs[i][4] || 0) + n; sh.getRange(i + 2, 6).setValue(valeurs[i][4]); }
    else { sh.appendRow([new Date(maintenant_()), etiquette, '', '', '', n]); valeurs.push([etiquette, '', '', '', n]); }
    // Écrit : on retire du cache ce qui vient d'être recopié (ce qui est arrivé entre-temps reste compté)
    cache.put(cle, String(Math.max(0, Number(cache.get(cle) || 0) - n)), 6 * 3600);
  }));
}

// ══════════════════════════════════════════════════════════
// CASES DU SHEET : Réinitialiser, Déconnecter ; onglet « Accès chantiers » ; alerte de fin de transition
// Lancé par le déclencheur « à la modification » (immédiat sur PC) et toutes les 10 min (secours, téléphone)
// ══════════════════════════════════════════════════════════
function surModificationSheet(e) {
  try {
    const r = e && e.range;
    if (!r || r.getSheet().getName() !== SHEET_UTILISATEURS || r.getColumn() > COL_U.tous) return;   // rien à voir : arrêt immédiat
  } catch (err) { return; }
  traiterComptes();
}

function traiterComptes() {
  const verrou = LockService.getScriptLock();   // le même que motDePasse_ : jamais les deux en même temps sur un compte
  if (!verrou.tryLock(20000)) return 'occupé';
  try {
    UTILISATEURS_ = null;
    const u = utilisateurs_();
    const maintenant = maintenant_();
    u.lignes.forEach((r, i) => {
      const ligne = i + 2;
      const id = normaliserId_(r[COL_U.id - 1]);
      if (!id) return;
      const etatAvant = String(r[COL_U.etat - 1] || '');
      let etat = etatAvant;
      // Seules les cases TRAITÉES sont réécrites (jamais toute la ligne : une case cochée par Franck pendant ce passage
      // n'est pas effacée ; elle sera traitée au passage suivant)
      const ecrire = (col, v) => { const p = u.sh.getRange(ligne, col); if (col === COL_U.provisoire || col === COL_U.valable) p.setNumberFormat('@'); p.setValue(v); };
      const actifBrut = r[COL_U.actif - 1];
      if (/^identifiant (invalide|en double)|^« Actif »/.test(etat)) etat = '';   // problème corrigé depuis : message effacé
      if (!idCompteValide_(id)) { etat = 'identifiant invalide : minuscules, chiffres, - ou _ seulement (2 à 30)'; }
      else if (u.doublons[id]) { etat = 'identifiant en double : corrigez l’une des lignes'; }
      else if (actifBrut !== true && actifBrut !== false && String(actifBrut).trim() !== '') {
        etat = '« Actif » n’est pas une case à cocher : sélectionnez la case, puis Insertion → Case à cocher';
      } else {
        // Date de désactivation (les fiches du téléphone sont encore acceptées 7 jours après)
        const cc = lireCompte_(id);
        if (actifBrut !== true && !cc.inactifDepuis) { cc.inactifDepuis = maintenant; ecrireCompte_(id, cc); }
        if (actifBrut === true && cc.inactifDepuis) { delete cc.inactifDepuis; ecrireCompte_(id, cc); }
        const reinit = r[COL_U.reinit - 1] === true, deco = r[COL_U.deconnecter - 1] === true;
        let c = lireCompte_(id);
        const expire = !reinit && c.prov && c.prov.exp <= maintenant;
        let prov = '';
        if (reinit || deco || expire) {
          c = lireCompte_(id);   // relu juste avant d'écrire (un mot de passe vient peut-être d'être choisi)
          if (reinit) {
            prov = motDePasseProvisoire_();
            c.prov = Object.assign(nouvelleEmpreinte_(prov), { exp: maintenant + DUREE_PROVISOIRE_H * 3600 * 1000 });
            delete c.emp; delete c.sel; delete c.n;   // l'ancien mot de passe ne marche plus (téléphone volé, mot de passe divulgué)
            c.ver = Number(c.ver || 1) + 1;
            effacerEchecs_(id);
          } else if (expire && c.prov && c.prov.exp <= maintenant) delete c.prov;
          if (deco) c.ver = Number(c.ver || 1) + 1;
          ecrireCompte_(id, c);
        }
        if (reinit) {
          ecrire(COL_U.provisoire, prov); ecrire(COL_U.valable, texteDate_(c.prov.exp)); ecrire(COL_U.reinit, false);
          etat = 'provisoire créé le ' + texteDate_(maintenant) + ' : à donner à la personne (valable 48 h)';
        } else if (expire) {
          ecrire(COL_U.provisoire, ''); ecrire(COL_U.valable, '');
          etat = c.emp ? 'provisoire expiré (son mot de passe actuel marche toujours)' : 'provisoire expiré : cochez « Réinitialiser » pour en créer un autre';
        }
        if (deco) { ecrire(COL_U.deconnecter, false); etat = 'téléphones déconnectés le ' + texteDate_(maintenant); }
        const bloque = minutesBlocage_(id);
        if (bloque && etat.indexOf('bloqué') < 0) etat = 'bloqué ' + bloque + ' min (5 essais ratés) — « Réinitialiser » débloque';
        else if (!bloque && /^bloqué/.test(etat)) etat = '';
        if (!c.emp && !c.prov && !etat) etat = 'pas encore de mot de passe : cochez « Réinitialiser »';
      }
      if (etat !== etatAvant) u.sh.getRange(ligne, COL_U.etat).setValue(cellule_(etat));
    });
    synchroniserAcces_(u);
    recopierCompteursSansCompte_();
    alerteFinTransition_();
    if (transitionOublieeDepuis_()) alerte_('Les comptes Loué App servent depuis le ' + texteDate_(transitionOublieeDepuis_())
      + ', mais la période de transition n’est pas démarrée : l’appli accepte toujours les envois sans compte. '
      + 'Quand tous les gars sont connectés, lancez demarrerTransition() dans l’éditeur Apps Script (voir docs/lot2-procedure.md).', 'demarrage');
    return 'ok';
  } catch (err) {
    console.error('traiterComptes :', err.message);
    return 'erreur : ' + err.message;
  } finally {
    UTILISATEURS_ = null;
    verrou.releaseLock();
  }
}

// Onglet « Accès chantiers » : une ligne par chantier, une colonne par poseur / atelier ; ajouts seulement
function synchroniserAcces_(u) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_ACCES);
  if (!sh) {
    sh = feuille_(SHEET_ACCES, ['Chantier', 'Remarque (appli)']);
    try { sh.setFrozenColumns(2); } catch (e) {}
  }
  let larg = Math.max(2, sh.getLastColumn());
  const entetes = sh.getRange(1, 1, 1, larg).getValues()[0].map(normaliserId_);
  // Colonnes manquantes : poseurs / atelier actifs, sans la case « Tous les chantiers »
  const besoin = Object.keys(u.parId).filter(id => {
    const l = u.parId[id];
    return compteUtilisable_(u, id) && ROLES_TOUS_CHANTIERS.indexOf(l.role) < 0 && !l.tousCoche;
  }).filter(id => entetes.indexOf(id) < 0);
  const nbLignes = Math.max(0, sh.getLastRow() - 1);
  besoin.forEach(id => {
    larg++;
    if (sh.getMaxColumns && sh.getMaxColumns() < larg) sh.insertColumnsAfter(sh.getMaxColumns(), larg - sh.getMaxColumns());
    sh.getRange(1, larg).setValue(id).setFontWeight('bold');
    if (nbLignes) sh.getRange(2, larg, nbLignes, 1).insertCheckboxes();
  });
  // Lignes : chantiers manquants ajoutés, lignes orphelines signalées
  const chantiers = lignesChantiers_().map(r => String(r[0]).trim());
  const connus = {};
  chantiers.forEach(n => { connus[cleChantier_(n)] = true; });
  const presents = {};
  if (nbLignes) {
    const lignes = sh.getRange(2, 1, nbLignes, 2).getValues();
    lignes.forEach((r, i) => {
      const cle = cleChantier_(r[0]);
      if (!cle) return;
      presents[cle] = true;
      const remarque = connus[cle] ? '' : 'chantier absent de l’onglet Chantiers (renommé ?)';
      if (String(r[1]) !== remarque) sh.getRange(i + 2, 2).setValue(remarque);
    });
  }
  chantiers.filter(n => !presents[cleChantier_(n)]).forEach(n => {
    sh.appendRow([cellule_(n), '']);
    if (larg > 2) sh.getRange(sh.getLastRow(), 3, 1, larg - 2).insertCheckboxes();
  });
}

function alerteFinTransition_() {
  const fin = finTransition_();
  const props = PropertiesService.getScriptProperties();
  if (!fin || maintenant_() < fin - 3 * 24 * 3600 * 1000 || maintenant_() > fin || props.getProperty('ALERTE_TRANSITION_FAITE')) return;
  props.setProperty('ALERTE_TRANSITION_FAITE', '1');
  alerte_('La période de transition de Loué App se termine le ' + texteDate_(fin) + '. Ensuite, une fiche envoyée sans compte sera refusée '
    + '(elle reste gardée dans le téléphone). Utilisations sans compte des 3 derniers jours (au moins) : ' + resumeSansCompte_(3) + '. '
    + 'Détail dans l’onglet « ' + SHEET_SANS_COMPTE + ' ». Pour ajouter 7 jours : prolongerTransition() dans l’éditeur Apps Script.', 'transition');
}
function resumeSansCompte_(jours) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_SANS_COMPTE);
  if (!sh || sh.getLastRow() < 2) return 'aucune';
  const limite = maintenant_() - jours * 24 * 3600 * 1000;
  let fiches = 0, lectures = 0;
  sh.getRange(2, 1, sh.getLastRow() - 1, 6).getValues().forEach(r => {
    if (!(r[0] instanceof Date) || r[0].getTime() < limite) return;
    if (r[1] === 'fiche') fiches++; else lectures += Number(r[5] || 0);
  });
  return fiches + ' fiche(s), ' + lectures + ' lecture(s)';
}

// ══════════════════════════════════════════════════════════
// MISE EN PLACE (une fois) : onglets et colonnes du lot 2
// ══════════════════════════════════════════════════════════
function preparerOngletsLot2() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const lignes = [];
  // Utilisateurs
  const regle = l => SpreadsheetApp.newDataValidation().requireValueInList(l).setAllowInvalid(true).build();
  let sh = ss.getSheetByName(SHEET_UTILISATEURS);
  if (!sh) {
    sh = feuille_(SHEET_UTILISATEURS, ENTETES_UTILISATEURS);
    try { sh.setFrozenColumns(1); } catch (e) {}
    // Listes et cases sur 200 lignes, SEULEMENT à la création : dans Sheets, insertCheckboxes() remet chaque case à FAUX,
    // relancer la fonction décocherait les comptes
    const n = Math.min(199, sh.getMaxRows() - 1);
    sh.getRange(2, COL_U.role, n, 1).setDataValidation(regle(ROLES));
    const contacts = ss.getSheetByName(SHEET_CONTACTS);
    if (contacts && contacts.getMaxRows() > 1) sh.getRange(2, COL_U.nom, n, 1).setDataValidation(SpreadsheetApp.newDataValidation()
      .requireValueInRange(contacts.getRange(2, 1, contacts.getMaxRows() - 1, 1), true).setAllowInvalid(true).build());
    [COL_U.actif, COL_U.reinit, COL_U.deconnecter, COL_U.tous].forEach(c => sh.getRange(2, c, n, 1).insertCheckboxes());
    sh.getRange(2, COL_U.provisoire, n, 2).setNumberFormat('@');
    lignes.push('✅ Onglet « ' + SHEET_UTILISATEURS + ' » créé (cases et listes sur 200 lignes)');
  } else {
    lignes.push('Onglet « ' + SHEET_UTILISATEURS + ' » déjà présent (non modifié)');
    const remplies = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, COL_U.tous).getValues().filter(l => String(l[0]).trim()) : [];
    const sansCase = [COL_U.actif, COL_U.reinit, COL_U.deconnecter, COL_U.tous].filter(c => remplies.some(l => l[c - 1] !== true && l[c - 1] !== false));
    if (sansCase.length) lignes.push('❌ Colonne(s) ' + sansCase.map(c => String.fromCharCode(64 + c)).join(', ')
      + ' sans cases à cocher sur certaines lignes : sélectionnez ces cellules, puis Insertion → Case à cocher.');
  }
  // Accès chantiers
  if (!ss.getSheetByName(SHEET_ACCES)) {
    const a = feuille_(SHEET_ACCES, ['Chantier', 'Remarque (appli)']);
    try { a.setFrozenColumns(2); } catch (e) {}
    lignes.push('✅ Onglet « ' + SHEET_ACCES + ' » créé (rempli automatiquement dans les 10 min)');
  }
  // Intervenants (9a)
  if (!ss.getSheetByName(SHEET_INTERVENANTS)) { feuille_(SHEET_INTERVENANTS, ENTETES_INTERVENANTS); lignes.push('✅ Onglet « ' + SHEET_INTERVENANTS + ' » créé'); }
  // Chantiers : colonnes E à K, seulement si elles sont vides
  const ch = ss.getSheetByName(SHEET_CHANTIERS);
  if (ch) {
    const titres = ch.getRange(1, 5, 1, ENTETES_CHANTIERS_9A.length).getValues()[0];
    const occupees = titres.map((v, i) => String(v).trim() && String(v).trim() !== ENTETES_CHANTIERS_9A[i] ? String.fromCharCode(69 + i) + '1 (« ' + v + ' »)' : '').filter(Boolean);
    if (occupees.length) lignes.push('❌ Onglet Chantiers : cases déjà utilisées, rien n’est écrit : ' + occupees.join(', ') + '. Dites-le à Claude.');
    else {
      ch.getRange(1, 5, 1, ENTETES_CHANTIERS_9A.length).setValues([ENTETES_CHANTIERS_9A]).setFontWeight('bold');
      lignes.push('✅ Onglet Chantiers : colonnes E à K (' + ENTETES_CHANTIERS_9A.join(', ') + ')');
    }
    const statuts = {};
    if (ch.getLastRow() > 1) ch.getRange(2, 3, ch.getLastRow() - 1, 1).getValues().forEach(r => { const s = String(r[0]).trim(); if (s) statuts[s] = (statuts[s] || 0) + 1; });
    const autres = Object.keys(statuts).filter(s => STATUTS_CHANTIER.indexOf(s) < 0);
    ch.getRange(2, 3, Math.max(1, Math.min(ch.getLastRow() + 200, ch.getMaxRows() - 1)), 1).setDataValidation(regle(STATUTS_CHANTIER));
    lignes.push('Statuts : liste « ' + STATUTS_CHANTIER.join(' / ') + ' » (avertissement seulement).'
      + (autres.length ? ' Valeurs actuelles hors liste, à corriger à la main : ' + autres.join(', ') + '.' : ''));
  }
  // Envois : colonne « Auteur (compte) »
  const env = ss.getSheetByName(SHEET_ENVOIS);
  if (env && !String(env.getRange(1, 7).getValue()).trim()) { env.getRange(1, 7).setValue('Auteur (compte)'); lignes.push('✅ Envois : colonne G « Auteur (compte) »'); }
  lignes.push(propriete_('CLE_JETON') ? '✅ Clé des jetons présente' : '❌ Clé des jetons absente : lancer genererCle()');
  const m = lignes.join('\n');
  Logger.log(m); return m;
}

// Contrôles du lot 2, ajoutés à verifierConfig()
function verifierComptes_() {
  const lignes = [];
  const ok = (cond, texte) => lignes.push((cond ? '✅ ' : '❌ ') + texte);
  ok(!!propriete_('CLE_JETON'), 'Clé des jetons (sinon lancer genererCle)');
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  [SHEET_UTILISATEURS, SHEET_ACCES].forEach(n => ok(!!ss.getSheetByName(n), 'Onglet « ' + n + ' » (sinon lancer preparerOngletsLot2)'));
  try {
    const u = utilisateurs_();
    const n = Object.keys(u.parId).filter(id => compteUtilisable_(u, id)).length;
    lignes.push('Comptes actifs : ' + n + (Object.keys(u.doublons).length ? ' — ❌ en double : ' + Object.keys(u.doublons).join(', ') : ''));
  } catch (e) {}
  try {
    const moi = [emailAdmin_(), Session.getEffectiveUser().getEmail()].concat(ss.getOwner ? [ss.getOwner() && ss.getOwner().getEmail()] : [])
      .map(e => String(e || '').toLowerCase());
    const autres = ss.getEditors().map(x => String(x.getEmail()).toLowerCase()).filter(e => e && moi.indexOf(e) < 0);
    ok(!autres.length, autres.length ? 'Le Sheet peut être modifié par d’autres comptes (' + autres.join(', ')
      + ') : ils peuvent lire la clé secrète. Retirez-les du partage.' : 'Sheet modifiable par Franck seul');
  } catch (e) { lignes.push('Partage du Sheet : non vérifiable (' + e.message + ')'); }
  const fin = finTransition_();
  lignes.push(!fin ? (transitionOublieeDepuis_() ? '❌ ' : '') + 'Transition : pas commencée (tout marche encore sans compte ; demarrerTransition() quand tous les gars sont connectés)'
    : (maintenant_() < fin ? 'Transition : sans compte accepté jusqu’au ' + texteDate_(fin) : 'Transition terminée le ' + texteDate_(fin) + ' : sans compte refusé'));
  try {
    const recent = resumeSansCompte_(2);
    if (recent !== 'aucune' && recent !== '0 fiche(s), 0 lecture(s)') lignes.push('⚠ Utilisation sans compte dans les dernières 48 h : ' + recent + ' (onglet « ' + SHEET_SANS_COMPTE + ' »)');
  } catch (e) {}
  lignes.push('Hachage : ' + iterations_() + ' itérations (mesurerHachage pour régler)');
  return lignes.join('\n');
}

// Mesure du temps de hachage (à lancer sur TEST) : conseille un nombre d'itérations pour ≈ 0,3 s
function mesurerHachage() {
  const essai = 1000;
  const debut = Date.now();
  empreinte_('mesure-du-temps', 'sel-de-mesure', essai);
  const ms = Math.max(1, Date.now() - debut);
  const conseil = Math.max(200, Math.round(essai * 300 / ms / 100) * 100);
  const m = essai + ' itérations : ' + ms + ' ms. Conseil pour ≈ 0,3 s : HACHAGE_ITERATIONS = ' + conseil
    + ' (Paramètres du projet → Propriétés du script). Les comptes existants gardent leur réglage.';
  Logger.log(m); return m;
}
