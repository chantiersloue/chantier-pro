// ═══════════════════════════════════════════════════════════════════════════════════════════════════════
// LOT 10b — LE POINT DU VENDREDI : un mail par semaine à Franck (et à lui seul), sans pièce jointe
//
//   1. les signalements de la semaine (créés depuis le mail précédent ; depuis 7 jours la première fois) et leur état ;
//   2. le rappel des signalements « Bloquant » restés « À traiter » depuis VENDREDI_RAPPEL_JOURS jours ou plus ;
//   3. le point de santé, avec ce que le serveur sait déjà : mails reportés encore en attente (onglet « Mails en attente »),
//      place du compte (dernier chiffre de l'onglet « Stockage »), fiches arrivées au bureau mais en erreur ou en attente
//      de leurs photos (onglet « Envois »).
// Le mail part TOUJOURS, même s'il n'y a rien à signaler : s'il n'arrive pas un vendredi, quelque chose ne tourne plus.
// Ce fichier ne fait que LIRE les onglets : il n'écrit dans aucun (sauf une ligne au Journal en cas d'abandon).
//
// MÊME MÉCANIQUE QUE LE RÉCAPITULATIF « À COMMANDER » (Demandes.gs) : venPasser_ est lancée par le réveil des 10 minutes,
// à la fin de traiterComptes (Comptes.gs), sous le verrou que traiterComptes tient déjà (ni repris ni rendu ici), dans son
// propre try/catch : les comptes, le récapitulatif des demandes et ce mail ne se gênent pas.
//   - le vendredi (jour et heure de Paris, calculés par demHeure_, jamais avec le fuseau du projet), au premier passage
//     après VENDREDI_HEURE ;
//   - mail en échec (quota épuisé, panne) : nouvel essai à chaque passage jusqu'à VENDREDI_FIN_ESSAIS, puis abandon pour
//     cette semaine, avec une ligne au Journal (pas de mail le samedi) ;
//   - une seule propriété du script, VENDREDI_POINT : { actif, fait: « aaaa-mm-jj » du vendredi réglé (mail parti ou
//     abandonné), envoi: instant du dernier mail PARTI, echec: raison du dernier essai raté }.
// Coût quand il n'y a rien à faire : du samedi au jeudi et le vendredi avant l'heure, RIEN (pas même une lecture de
// mémoire) ; le vendredi après l'heure, une lecture de mémoire par passage ; le Sheet n'est lu que pour fabriquer le mail.
//
// MISE EN SERVICE : le mail ne part pas tant que demarrerPointDuVendredi() n'a pas été lancée (arreterPointDuVendredi()
// l'arrête). essaiPointDuVendredi() fabrique le mail à la demande, sans toucher à la marque de la semaine.
//
// Plan : docs/lot10-plan.md, chapitre 6. Décisions : D10-43 et suivantes (DECISIONS.md).
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════
const VEN_PROP = 'VENDREDI_POINT';
const VEN_MAX_LIGNES = 60;          // lignes de signalements écrites dans le mail, au plus (le reste est compté)
const VEN_MAX_ENVOIS = 3000;        // dernières lignes de l'onglet « Envois » lues, au plus
const VEN_JOURS_ENVOIS = 30;        // une fiche « en erreur » ou « en attente de photos » est citée pendant 30 jours
const VEN_MAX_FICHES = 8;           // fiches citées une par une dans le point de santé, au plus
const VEN_JOUR_MS = 24 * 3600 * 1000;

// ── La marque de la semaine (une seule propriété) ──
function venEtat_() {
  let e = null;
  try { e = JSON.parse(PropertiesService.getScriptProperties().getProperty(VEN_PROP) || 'null'); } catch (err) {}
  return e && typeof e === 'object' && !Array.isArray(e) ? e : {};
}
function venEcrire_(e) { PropertiesService.getScriptProperties().setProperty(VEN_PROP, JSON.stringify(e)); }

// ── Petits outils d'écriture ──
function venEstDate_(v) { return Object.prototype.toString.call(v) === '[object Date]' && !isNaN(v.getTime()); }
function venMs_(v) { return venEstDate_(v) ? v.getTime() : 0; }
// « 18/11 à 9 h 12 » (heure de Paris)
function venQuand_(ms) {
  const m = Utilities.formatDate(new Date(ms), 'Europe/Paris', 'dd/MM HH:mm').match(/^(\d{2}\/\d{2}) (\d{2}):(\d{2})$/);
  return m ? m[1] + ' à ' + Number(m[2]) + ' h ' + m[3] : '';
}
function venJourCourt_(ms) { return Utilities.formatDate(new Date(ms), 'Europe/Paris', 'dd/MM'); }
function venPluriel_(n, un, plusieurs) { return n + ' ' + (n > 1 ? plusieurs : un); }
function venTexte_(v) { return String(v === undefined || v === null ? '' : v).replace(/\s+/g, ' ').trim(); }

// ── 1 et 2. Les signalements (lecture seule de l'onglet « Signalements ») ──
// → { semaine: [{ chantier, type, urgence, auteur, statut, recu }], rappels: [{ …, jours }] }
// Lève une erreur (texte court) si l'onglet est absent, si ses titres ont changé, ou s'il est illisible.
function venSignalements_(depuis, maintenant) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_SIGNALEMENTS);
  if (!sh) throw new Error('onglet « ' + SHEET_SIGNALEMENTS + ' » absent');
  // Titres changés ou colonnes déplacées : on ne devine rien (un état lu dans la mauvaise colonne serait un mail faux)
  if (!noteTitresBons_(sh, SIG_ENTETES)) throw new Error('les titres de l’onglet « ' + SHEET_SIGNALEMENTS + ' » ont changé');
  const derniere = sh.getLastRow();
  const lignes = derniere > 1 ? sh.getRange(2, 1, derniere - 1, SIG_ENTETES.length).getValues() : [];
  const limiteRappel = maintenant - VENDREDI_RAPPEL_JOURS * VEN_JOUR_MS;
  const semaine = [], rappels = [];
  lignes.forEach(r => {
    if (String(r[COL_S.id - 1] || '') === '') return;
    const recu = venMs_(r[COL_S.recu - 1]);
    if (!recu) return;   // sans date de réception lisible, impossible de dire de quelle semaine il est
    const s = { chantier: venTexte_(r[COL_S.chantier - 1]), type: venTexte_(r[COL_S.type - 1]), urgence: venTexte_(r[COL_S.urgence - 1]),
      auteur: venTexte_(r[COL_S.auteur - 1]), statut: statutLu_(r[COL_S.statut - 1]), recu: recu };
    if (recu > depuis && recu <= maintenant) semaine.push(s);
    if (s.urgence === SIG_URGENCES[0] && s.statut === SIG_STATUTS[0] && recu <= limiteRappel) {
      rappels.push(Object.assign({ jours: Math.floor((maintenant - recu) / VEN_JOUR_MS) }, s));
    }
  });
  semaine.sort((a, b) => a.chantier.localeCompare(b.chantier) || (a.recu - b.recu));
  rappels.sort((a, b) => a.recu - b.recu);   // le plus ancien d'abord
  return { semaine: semaine, rappels: rappels };
}

// ── 3. Le point de santé : trois lectures indépendantes. Chacune rend { texte, alerte: vrai s'il y a quelque chose à regarder } ──
// Mails reportés encore en attente. Onglet absent : aucun mail n'a jamais été reporté.
function venMailsEnAttente_() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_ATTENTE);
  const derniere = sh ? sh.getLastRow() : 0;
  if (derniere < 2) return { texte: 'rien à signaler', alerte: false };
  const lignes = sh.getRange(2, 1, derniere - 1, 11).getValues().filter(r => String(r[10]) === 'en attente');
  if (!lignes.length) return { texte: 'rien à signaler', alerte: false };
  const dates = lignes.map(r => venMs_(r[0])).filter(Boolean);
  return { texte: venPluriel_(lignes.length, 'mail', 'mails') + (dates.length ? ' (le plus ancien : ' + venQuand_(Math.min.apply(null, dates)) + ')' : '')
    + ' — voir l’onglet « ' + SHEET_ATTENTE + ' »', alerte: true };
}
// Place du compte : le dernier chiffre écrit par la mesure de la nuit dans l'onglet « Stockage » (rien n'est remesuré ici)
function venPlace_() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_STOCKAGE);
  if (!sh) return { texte: 'pas encore mesurée (onglet « ' + SHEET_STOCKAGE + ' » absent)', alerte: false };
  const v = sh.getRange(STK_R.place, 1, 2, 2).getValues();   // lignes « Place utilisée » et « Mesurée le », colonnes A et B
  if (String(v[0][0]) !== STK_RESUME[STK_R.place - 1] || String(v[1][0]) !== STK_RESUME[STK_R.date - 1]) throw new Error('les titres de l’onglet « ' + SHEET_STOCKAGE + ' » ont changé');
  const place = venTexte_(v[0][1]);
  if (!place) return { texte: 'pas encore mesurée', alerte: false };
  const date = venEstDate_(v[1][1]) ? Utilities.formatDate(v[1][1], 'Europe/Paris', 'dd/MM/yyyy') : venTexte_(v[1][1]);
  const pourcent = place.match(/\((\d+)\s*%\)/);
  return { texte: place + (date ? ', mesurée le ' + date : ''), alerte: !!pourcent && Number(pourcent[1]) >= STK_SEUIL_ALERTE };
}
// Fiches arrivées au bureau mais pas traitées : statut « erreur » ou « en attente de photos » dans l'onglet « Envois »
// (les deux statuts écrits par recevoirFiche_, Api.gs), reçues depuis VEN_JOURS_ENVOIS jours au plus.
function venFiches_(maintenant) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_ENVOIS);
  const derniere = sh ? sh.getLastRow() : 0;
  if (derniere < 2) return { texte: 'rien à signaler', alerte: false, lignes: [] };
  const n = Math.min(derniere - 1, VEN_MAX_ENVOIS);
  const limite = maintenant - VEN_JOURS_ENVOIS * VEN_JOUR_MS;
  const fiches = sh.getRange(derniere - n + 1, 1, n, 5).getValues()
    .map(r => ({ recu: venMs_(r[1]), type: venTexte_(r[2]), chantier: venTexte_(r[3]), statut: String(r[4]) }))
    .filter(f => (f.statut === 'erreur' || f.statut === 'en attente de photos') && f.recu >= limite)
    .sort((a, b) => a.recu - b.recu);
  if (!fiches.length) return { texte: 'rien à signaler', alerte: false, lignes: [] };
  const erreurs = fiches.filter(f => f.statut === 'erreur').length, photos = fiches.length - erreurs;
  const morceaux = [];
  if (erreurs) morceaux.push(erreurs + ' en erreur');
  if (photos) morceaux.push(photos + ' en attente de ' + (photos > 1 ? 'leurs' : 'ses') + ' photos');
  return { texte: morceaux.join(', ') + ' (la plus ancienne : ' + venQuand_(fiches[0].recu) + ') — voir l’onglet « ' + SHEET_ENVOIS + ' »', alerte: true,
    lignes: fiches.slice(0, VEN_MAX_FICHES).map(f => [LIBELLES_FICHES[f.type] || f.type || 'fiche', f.chantier, f.statut === 'erreur' ? 'en erreur' : 'en attente de ses photos', 'reçue le ' + venQuand_(f.recu)]),
    autres: Math.max(0, fiches.length - VEN_MAX_FICHES) };
}

// ── Le mail : { sujet, texte, html } ──
// Chaque partie est lue à part : un onglet illisible ou absent ne fait jamais échouer le mail, sa partie dit
// « indisponible » et les autres sont remplies. Tous les textes venus du Sheet sont échappés dans le HTML (esc_).
function venMail_(maintenant, depuis, essai) {
  const jour = demHeure_(maintenant).jour;
  const partie = lecture => { try { return lecture(); } catch (err) { return { indisponible: String(err && err.message ? err.message : err).slice(0, 150) }; } };
  const sig = partie(() => venSignalements_(depuis, maintenant));
  const mails = partie(venMailsEnAttente_), place = partie(venPlace_), fiches = partie(() => venFiches_(maintenant));
  const indispo = p => 'indisponible (' + p.indisponible + ')';

  const texte = [], html = [];
  const cel = 'style="padding:3px 14px 3px 0;vertical-align:top"';
  const titre = t => { texte.push(''); texte.push(t); html.push('<h3 style="font-family:Arial,sans-serif;font-size:15px;color:#1A2B4A;margin:18px 0 6px">' + esc_(t) + '</h3>'); };
  const phrase = t => { texte.push('  ' + t); html.push('<p style="font-family:Arial,sans-serif;font-size:14px;margin:0 0 4px">' + esc_(t) + '</p>'); };
  const tableau = (entetes, lignes) => {
    lignes.forEach(l => texte.push('  ' + l.filter(Boolean).join(' — ')));
    html.push('<table style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:14px"><tr>'
      + entetes.map(e => '<th ' + cel + ' align="left">' + esc_(e) + '</th>').join('') + '</tr>'
      + lignes.map(l => '<tr>' + l.map(c => '<td ' + cel + '>' + esc_(c) + '</td>').join('') + '</tr>').join('') + '</table>');
  };

  // 1. Signalements de la semaine
  const nSemaine = sig.indisponible ? 0 : sig.semaine.length;
  titre('SIGNALEMENTS DE LA SEMAINE (depuis le ' + venQuand_(depuis) + ')' + (sig.indisponible ? '' : ' : ' + nSemaine));
  if (sig.indisponible) phrase(indispo(sig));
  else if (!nSemaine) phrase('rien à signaler');
  else {
    tableau(['Chantier', 'Type', 'Urgence', 'Signalé par', 'État'], sig.semaine.slice(0, VEN_MAX_LIGNES).map(s => [s.chantier, s.type, s.urgence, s.auteur, s.statut]));
    if (nSemaine > VEN_MAX_LIGNES) phrase('… et ' + (nSemaine - VEN_MAX_LIGNES) + ' autre(s) : voir l’onglet « ' + SHEET_SIGNALEMENTS + ' »');
  }
  // 2. Rappel : « Bloquant » restés « À traiter »
  const nRappels = sig.indisponible ? 0 : sig.rappels.length;
  titre('RAPPEL — « ' + SIG_URGENCES[0].toUpperCase() + ' » RESTÉS « ' + SIG_STATUTS[0].toUpperCase() + ' » DEPUIS ' + VENDREDI_RAPPEL_JOURS + ' JOURS OU PLUS' + (sig.indisponible ? '' : ' : ' + nRappels));
  if (sig.indisponible) phrase(indispo(sig));
  else if (!nRappels) phrase('rien à signaler');
  else {
    tableau(['Chantier', 'Type', 'Signalé par', 'Signalé le', 'Depuis'], sig.rappels.slice(0, VEN_MAX_LIGNES).map(s => [s.chantier, s.type, s.auteur, 'le ' + venJourCourt_(s.recu), s.jours + ' jours']));
    if (nRappels > VEN_MAX_LIGNES) phrase('… et ' + (nRappels - VEN_MAX_LIGNES) + ' autre(s) : voir l’onglet « ' + SHEET_SIGNALEMENTS + ' »');
  }
  // 3. Point de santé
  titre('POINT DE SANTÉ');
  const sante = [['Mails reportés encore en attente', mails], ['Place du compte Google', place], ['Fiches arrivées au bureau mais pas traitées', fiches]];
  texte.push.apply(texte, sante.map(l => '  ' + l[0] + ' : ' + (l[1].indisponible ? indispo(l[1]) : l[1].texte)));
  html.push('<table style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:14px">'
    + sante.map(l => '<tr><td ' + cel + '>' + esc_(l[0]) + '</td><td ' + cel + '>' + (l[1].alerte || l[1].indisponible ? '<b>' : '')
      + esc_(l[1].indisponible ? indispo(l[1]) : l[1].texte) + (l[1].alerte || l[1].indisponible ? '</b>' : '') + '</td></tr>').join('') + '</table>');
  if (!fiches.indisponible && fiches.lignes && fiches.lignes.length) {
    tableau(['Fiche', 'Chantier', 'État', 'Reçue'], fiches.lignes);
    if (fiches.autres) phrase('… et ' + fiches.autres + ' autre(s)');
  }

  // L'objet dit l'essentiel : « Point du vendredi 20/11 — 4 signalements, rien d'autre à signaler »
  const aRegarder = sante.some(l => l[1].alerte || l[1].indisponible) || !!sig.indisponible;
  const morceaux = [];
  if (nSemaine) morceaux.push(venPluriel_(nSemaine, 'signalement', 'signalements'));
  if (nRappels) morceaux.push(venPluriel_(nRappels, 'bloquant', 'bloquants') + ' en retard');
  if (aRegarder) morceaux.push('santé à regarder');
  else morceaux.push(morceaux.length ? 'rien d’autre à signaler' : 'rien à signaler');
  const entete = 'Point du vendredi ' + demLong_(jour);
  const pied = 'Ce mail part tous les vendredis vers ' + demHeureTexte_(VENDREDI_HEURE) + ', même quand il n’y a rien à signaler : s’il n’arrive pas, quelque chose ne tourne plus.';
  return { sujet: (essai ? '[ESSAI] ' : '') + 'Point du vendredi ' + demCourt_(jour) + ' — ' + morceaux.join(', '),
    texte: entete + '\n' + texte.join('\n') + '\n\n' + pied + '\n\nLoué App',
    html: '<p style="font-family:Arial,sans-serif;font-size:16px;margin:0"><b>' + esc_(entete) + '</b></p>' + html.join('')
      + '<p style="font-family:Arial,sans-serif;font-size:13px;color:#555;margin-top:18px">' + esc_(pied) + '<br><br>Loué App</p>' };
}

// ── Le passage du réveil des 10 minutes. À APPELER SOUS LE VERROU DU SCRIPT (traiterComptes le tient déjà). ──
// Rend un mot qui dit ce qui s'est passé.
function venPasser_() {
  const maintenant = maintenant_(), t = demHeure_(maintenant);
  if (t.semaine !== 5) return 'pas vendredi';
  if (t.minutes < demMinutes_(VENDREDI_HEURE)) return 'avant l’heure';
  const e = venEtat_();   // la seule lecture de mémoire ; le Sheet n'est pas encore lu
  if (!e.actif) return 'pas en service';
  if (e.fait === t.jour) return 'déjà fait';
  // Trop tard (mail en échec tout l'après-midi, ou réveil en panne) : abandon pour cette semaine, pas de mail le samedi
  if (t.minutes >= demMinutes_(VENDREDI_FIN_ESSAIS)) {
    const raison = e.echec ? ' (' + e.echec + ')' : '';
    e.fait = t.jour; delete e.echec;
    venEcrire_(e);
    journal_({ fiche: 'point du vendredi' }, emailAdmin_(), 'abandonné', 'pas parti avant ' + demHeureTexte_(VENDREDI_FIN_ESSAIS) + raison + ' : pas de point cette semaine');
    return 'abandonné';
  }
  // Signalements « de la semaine » : depuis le dernier mail PARTI (une semaine abandonnée n'en fait perdre aucun) ;
  // la première fois, ou si cette date est illisible ou dans le futur : depuis 7 jours
  const depuis = Number(e.envoi) > 0 && Number(e.envoi) < maintenant ? Number(e.envoi) : maintenant - 7 * VEN_JOUR_MS;
  const mail = venMail_(maintenant, depuis, false);
  const echec = mailBureau_(mail.sujet, mail.texte, mail.html);
  if (echec) {   // la marque n'est PAS posée : nouvel essai au passage suivant
    if (e.echec !== echec) { e.echec = echec; venEcrire_(e); }
    return 'mail non parti (' + echec + ')';
  }
  e.fait = t.jour; e.envoi = maintenant; delete e.echec;
  venEcrire_(e);
  return 'envoyé';
}

// ── Mise en service et arrêt (à lancer dans l'éditeur : choisir la fonction, puis ▶ Exécuter) ──
function demarrerPointDuVendredi() {
  const e = venEtat_();
  const deja = !!e.actif;
  e.actif = true;
  venEcrire_(e);
  const reveil = ScriptApp.getProjectTriggers().some(d => d.getHandlerFunction() === 'traiterComptes');
  const m = (deja ? 'Le point du vendredi était déjà en service' : '✅ Point du vendredi mis en service') + ' : un mail à ' + emailAdmin_() + ', le vendredi, au premier passage du réveil des 10 minutes après '
    + demHeureTexte_(VENDREDI_HEURE) + ' (heure de Paris), même s’il n’y a rien à signaler. Pour l’arrêter : arreterPointDuVendredi.'
    + (reveil ? '' : '\n⚠ Le réveil des 10 minutes (traiterComptes) n’est pas posé ici : sans lui, le mail ne partira pas (installerDeclencheurs ; sur la copie TEST, seulement le temps d’un essai).');
  Logger.log(m); return m;
}
function arreterPointDuVendredi() {
  const e = venEtat_();
  e.actif = false;
  venEcrire_(e);
  const m = '✅ Point du vendredi arrêté : plus aucun mail le vendredi. Pour le remettre : demarrerPointDuVendredi.';
  Logger.log(m); return m;
}

// ── Essai à la demande (éditeur : choisir essaiPointDuVendredi, puis ▶) ──
// Fabrique le mail tel qu'il partirait MAINTENANT et l'envoie à Franck seul (l'adresse du bureau), avec « [ESSAI] » dans
// l'objet. Ne touche pas à la marque de la semaine : le vrai mail du vendredi part quand même, avec les mêmes signalements.
// Marche sur la copie TEST comme en production (aucune donnée n'est modifiée) ; refusé si l'environnement est incohérent.
function essaiPointDuVendredi() {
  const ou = environnementReel_();
  if (ou.env === 'INCOHERENT') {
    const refus = '❌ Refusé : la propriété ENVIRONNEMENT et le nom du Sheet « ' + ou.sheet + ' » ne disent pas la même chose. Rien n’a été envoyé.';
    Logger.log(refus); return refus;
  }
  const maintenant = maintenant_(), e = venEtat_();
  const depuis = Number(e.envoi) > 0 && Number(e.envoi) < maintenant ? Number(e.envoi) : maintenant - 7 * VEN_JOUR_MS;
  const mail = venMail_(maintenant, depuis, true);
  const echec = mailBureau_(mail.sujet, mail.texte, mail.html);
  const m = (echec ? '❌ Essai du point du vendredi : le mail n’est pas parti (' + echec + ').'
    : '✅ Essai du point du vendredi (' + ou.env + ') : mail envoyé à ' + emailAdmin_() + ' seulement, objet « ' + mail.sujet + ' ». Le vrai mail du vendredi n’est pas touché.')
    + '\n\n' + mail.texte;
  Logger.log(m);
  journal_({ fiche: 'point du vendredi' }, emailAdmin_(), echec ? 'essai raté' : 'essai', echec || 'mail d’essai envoyé à la demande (essaiPointDuVendredi)');
  return m;
}

// ── Contrôles du lot 10b, ajoutés à verifierConfig() ──
function verifierVendredi_() {
  const e = venEtat_(), lignes = [];
  lignes.push((e.actif ? '✅ ' : '⚠ ') + 'Point du vendredi : ' + (e.actif ? 'en service' : 'PAS en service (lancer demarrerPointDuVendredi)') + ' — le vendredi, au premier passage du réveil des 10 minutes (traiterComptes) après '
    + demHeureTexte_(VENDREDI_HEURE) + ' ; dernier mail parti : ' + (Number(e.envoi) > 0 ? venQuand_(Number(e.envoi)) : 'jamais'));
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(e.fait || '')) && !(Number(e.envoi) > 0 && demHeure_(Number(e.envoi)).jour === e.fait)) {
    lignes.push('⚠ Le point du vendredi ' + demLong_(e.fait) + ' n’a pas pu partir (abandonné à ' + demHeureTexte_(VENDREDI_FIN_ESSAIS) + ' : voir l’onglet Journal)');
  }
  if (e.echec) lignes.push('⚠ Dernier essai raté du point du vendredi : ' + e.echec);
  return lignes.join('\n');
}
