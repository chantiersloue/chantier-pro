// Fiches types pour tests/pdf-mise-en-page.js (textes fictifs)
'use strict';
module.exports = function (cas, x) {
  const { PAYSAGE, PORTRAIT, CROQUIS, PAYSAGE_A4, DEBOUT_A4 } = x;
  const page1 = p => Object.assign({ page1Attendue: true }, p);

  // ── Fiche de fabrication (A4 couché) ──
  const ligneDivers = i => ({ repere: 'R' + i, qte: 2, long: 2040, larg: 830, haut: 40, section: '40x40', materiau: 'Médium', finition: 'BLANC', quincaillerie: 'Paumelles', observations: 'Chant 1 côté' });
  const lignePorte = i => ({ repere: 'P' + i, qt: 1, haut: 2040, larg: 830, sens: 'Gauche', nature: 'Âme pleine', support: 'Cloison 72', epSupport: 72,
    feuillure: 'Oui', rainure: 'Non', ferrageType: 'Paumelles', ferrageQt: 3, serrure: 'Bec de cane' });
  const fab = (blocs, photos, extra) => Object.assign({ chantier: 'CHANTIER TEST 1', date: '10/11/2026', auteur: 'Poseur Essai', chefAtelier: 'Atelier Essai',
    conducteur: 'Conducteur Essai', delai: 'Pour le 20/11/2026', delaiPrecision: '', zone: 'R+1', commentaires: '', blocs, photosBase64: photos }, extra || {});
  const divers = (id, n) => ({ id, type: 'divers', rows: Array.from({ length: n }, (_, i) => ligneDivers(i + 1)) });
  const porte = (id, n) => ({ id, type: 'porte', porteType: 'complet', rows: Array.from({ length: n }, (_, i) => lignePorte(i + 1)) });

  cas('fabrication — 1 bloc de 2 lignes + 1 photo', 'modele_fabrication', fab([divers(1, 2)], [PAYSAGE()]), page1(PAYSAGE_A4));
  cas('fabrication — 1 bloc + commentaire + 1 photo en hauteur', 'modele_fabrication',
    fab([divers(1, 2)], [PORTRAIT()], { commentaires: '<b>Attention</b> : chants à plaquer<br>Livrer avant la pose' }), page1(PAYSAGE_A4));
  cas('fabrication — 1 croquis seul (page entière)', 'modele_fabrication', fab([divers(1, 2)], [CROQUIS()]), PAYSAGE_A4);
  cas('fabrication — 1 photo + 1 croquis', 'modele_fabrication', fab([divers(1, 2)], [CROQUIS(), PAYSAGE()]), page1(PAYSAGE_A4));
  cas('fabrication — 4 photos (2 en hauteur côte à côte)', 'modele_fabrication', fab([divers(1, 2)], [PAYSAGE(), PORTRAIT(), PORTRAIT(), PAYSAGE()]), page1(PAYSAGE_A4));
  cas('fabrication — tableau long (photo en page 2)', 'modele_fabrication', fab([divers(1, 9), porte(2, 6)], [PAYSAGE()]), PAYSAGE_A4);

  // ── Quitus (A4 debout) ──
  const quitus = (photos, extra) => Object.assign({ chantier: 'CHANTIER TEST 1', precision: 'Bât. A', date: '10/11/2026', heure: '14h05', intervenant: 'Client Essai',
    description: 'Pose de 3 portes intérieures et réglages.', solde: 'OUI', sigLoue: '', sigIntervenant: '', photosBase64: photos }, extra || {});
  cas('quitus — 1 photo', 'modele_quitus', quitus([PAYSAGE()]), page1(DEBOUT_A4));
  cas('quitus — 3 photos (2 en largeur par page)', 'modele_quitus', quitus([PAYSAGE(), PAYSAGE(), PAYSAGE()]), page1(DEBOUT_A4));
  cas('quitus — description longue + 1 photo en hauteur', 'modele_quitus',
    quitus([PORTRAIT()], { description: Array(12).fill('Réglage des portes, remplacement d’une poignée, reprise des jeux.').join('\n') }), page1(DEBOUT_A4));

  // ── Bordereaux (A4 debout) ──
  const bord = (type, photos, extra) => Object.assign({ type, chantier: 'CHANTIER TEST 1', date: '10/11/2026', heure: '09h12', soussigne: 'Poseur Essai',
    preneur: 'Preneur Essai', fonction: 'OPC', entreprise: 'Entreprise Essai', typeDoc: 'Kit de pose', nombre: '2', commentaires: '', sigLoue: '', sigPreneur: '', photosBase64: photos }, extra || {});
  cas('bordereau organigramme — 1 photo', 'modele_bordereau', bord('bordereau-orga', [PAYSAGE()]), page1(DEBOUT_A4));
  cas('bordereau matériaux — liste + 2 photos', 'modele_bordereau',
    bord('bordereau-materiaux', [PAYSAGE(), PORTRAIT()], { listeMateriaux: '2 × Vis inox 4x40\n1 × Cartouche de mousse\n4 × Cales' }), page1(DEBOUT_A4));

  // ── Attestation (A4 debout) ──
  const att = (photos, extra) => Object.assign({ typeAttest: 'mise-oeuvre', chantier: 'CHANTIER TEST 1', date: '10/11/2026', ref: 'CR 12', signataire: 'Poseur Essai',
    qualite: 'Chef d’équipe', objet: 'Pose des blocs portes coupe-feu du R+1.', photos, signature: '' }, extra || {});
  cas('attestation — 1 photo', 'modele_attestation', att([PAYSAGE()]), page1(DEBOUT_A4));
  cas('attestation DAS — 10 points + 2 photos', 'modele_attestation', att([PORTRAIT(), PAYSAGE()], { typeAttest: 'das', dasNumero: 'BP 12', dasEtage: 'R+1',
    dasLocalisation: 'Palier', asservissements: 'Ventouse', dasPoints: Array.from({ length: 10 }, (_, i) => ({ label: 'Point de contrôle n° ' + (i + 1), state: i === 3 ? 'nc' : 'ok' })) }), DEBOUT_A4);

  // ── Note de réunion (A4 debout) ──
  const note = (photos, extra) => Object.assign({ chantier: 'CHANTIER TEST 1', date: '10/11/2026', auteur: 'Conducteur Essai', objet: 'Réunion de chantier n° 4',
    commentaires: 'Points vus :\n- planning des portes\n- livraison des huisseries', photosBase64: photos }, extra || {});
  cas('note — 1 photo', 'modele_note', note([PAYSAGE()]), page1(DEBOUT_A4));
  cas('note — texte de 2 pages + 2 photos', 'modele_note', note([PAYSAGE(), PAYSAGE()], { commentaires: Array(80).fill('Point de suivi du chantier, à reprendre la semaine prochaine.').join('\n') }), Object.assign({ pagesContenu: 2 }, DEBOUT_A4));

  // ── Réception support (A4 debout) : une page par point ──
  const rec = points => ({ chantier: 'CHANTIER TEST 1', lotLabel: 'Menuiserie intérieure', date: '10/11/2026', signataire: 'Poseur Essai', signature: '', observations: '', points });
  cas('réception — 2 points avec photos', 'modele_reception', rec([
    { label: 'Planéité des cloisons', state: 'nok', comment: 'Bosse au R+1', photos: [PAYSAGE()] },
    { label: 'Réservations', state: 'ok', comment: '', photos: [PAYSAGE(), PAYSAGE(), PORTRAIT()] },
    { label: 'Sol fini', state: 'so', comment: '', photos: [] }]), DEBOUT_A4);

  // ── Cas difficiles trouvés par la relecture (textes longs dans les en-têtes, commentaire agrandi) ──
  const c41 = '403-OPALE / STEEN RAIMONDEAU — ST GILLES X';
  cas('fabrication — chantier long + réf. + précision du délai', 'modele_fabrication',
    fab([divers(1, 2)], [PAYSAGE()], { chantier: c41, refChantier: 'BAT A R+2', delaiPrecision: 'impératif avant la pose' }), page1(PAYSAGE_A4));
  cas('fabrication — chantier, zone et précision sur plusieurs lignes', 'modele_fabrication',
    fab([divers(1, 2)], [PAYSAGE()], { chantier: c41 + ' ' + c41, refChantier: 'BAT A', zone: 'R+1 bâtiment A logements 101 à 115 et circulations communes',
      delaiPrecision: 'ligne 1\nligne 2\nligne 3' }), page1(PAYSAGE_A4));
  cas('fabrication — commentaire agrandi', 'modele_fabrication', fab([divers(1, 2)], [PAYSAGE()],
    { commentaires: '<span style="font-size:1.4em">Attention</span><br><span style="font-size:1.4em">Chants plaqués</span><br>Livrer avant la pose' }), page1(PAYSAGE_A4));
  cas('note — chantier et rédacteur longs', 'modele_note', note([PAYSAGE()], { chantier: '403-OPALE / STEEN RAIMONDEAU — ST GILLES X DE VIE', auteur: 'Jean-Christophe De La Fontaine-Martin' }), page1(DEBOUT_A4));
  cas('bordereau — preneur, entreprise et type longs', 'modele_bordereau', bord('bordereau-materiaux', [PAYSAGE()], { preneur: 'Jean-Christophe Martin',
    fonction: 'Conducteur de travaux', entreprise: 'Entreprise Générale de Bâtiment du Littoral', chantier: '403-OPALE / STEEN RAIMONDEAU — ST GILLES X DE VIE',
    typeDoc: 'Kit de pose complet pour menuiseries extérieures en aluminium avec accessoires', listeMateriaux: '20 × Vis\n1 × Mousse' }), page1(DEBOUT_A4));
  cas('fabrication — 3 croquis seuls (une page chacun)', 'modele_fabrication', fab([], [CROQUIS(), CROQUIS(), CROQUIS()]), PAYSAGE_A4);
};
