# Journal des modifications — ChantierPro

Chaque lot : **quoi**, **pourquoi**, **comment déployer**. Procédures détaillées dans `docs/lotN-procedure.md`.

## Lot 3 — Notes de chantier : la liste des choses à faire — serveur v8.0, appli 8.0 — serveur en production le 13/11/2026 (déploiement « Lot 3 — production »), pages livrées par la fusion de livraison/lot-3

**Quoi**
- Page **« Notes »** (`notes.html`), ouverte depuis un chantier : la liste des choses à faire du chantier, façon « Keep ». Un élément = une ligne de texte et une case à cocher ; on ajoute en bas de l'écran ; toucher un texte permet de le corriger ; un élément coché descend dans « Éléments terminés », d'où on peut le décocher. Rien ne se supprime. Hors réseau : ajouts et gestes sont gardés dans le téléphone et partent au retour du réseau, dans l'ordre.
- Toute personne qui a accès au chantier lit, ajoute, corrige, coche et décoche. À l'écran : ni auteur, ni date.
- Vue **« Tous chantiers »** pour les conducteurs et l'admin (lecture, recherche, « nouveaux », « avec les terminés », « tout marquer comme lu »).
- Accueil : tuile « Notes » dans chaque chantier, tuile « Notes de chantier » pour les conducteurs, chiffre rouge des éléments nouveaux.
- Serveur : onglets *Notes*, *Notes historique* (une ligne par geste : qui, quoi, quand — le filet de sécurité, invisible dans l'appli) et *Notes vues* ; droits vérifiés par le jeton ; **aucun mail**.
- Installation en une fonction : `installerLot3Test` / `installerLot3Production`.

**Pourquoi** : un pense-bête qui suit le chantier, pas la personne (`PLAN.md`, lot 3). **Simplifié le 13/11/2026 à la demande de Franck**, après ses essais de la première version (notes avec auteur, date, photos, corbeille, historique et export PDF : retirés, code compris). Décisions D3-1 à D3-4 ; plan : `docs/lot3-plan.md`, chapitre 14.

**Comment déployer** : `docs/lot3-procedure.md`.

**Tests** : serveur (`tests/lot3-notes.test.js`), page dans un vrai Chrome en largeur téléphone, hors réseau et en réseau lent (`tests/lot3-page.test.js`), essais réels sur la copie TEST (`tests/reel-lot3.js`) ; toutes les séries existantes repassent. **Pas testé par moi** : un vrai téléphone, en particulier le champ d'ajout avec le clavier ouvert.

## Lot 7 — Signalement casse / manquant / à recommander — serveur v7.0, appli 7.0 — **en production depuis le 13/11/2026** (déploiement « Lot 7 — production »)

**Quoi**
- Page **« Signaler »** (`signaler.html`), ouverte depuis un chantier : type et urgence en gros boutons, repère, commentaire, 0 à 3 photos, case « Prévenir l'atelier ». Brouillon automatique, rangement dans le téléphone, envoi au retour du réseau, comme les autres fiches.
- Page **« Signalements »** (`signalements.html`) : le suivi. Conducteurs, admin et atelier voient tout et changent le statut (À traiter / Commandé / Livré / Clos) ; chaque poseur voit les siens.
- Serveur : onglet *Signalements*, PDF (informations et photos) rangé dans `05 - CHANTIER/SIGNALEMENTS`, mail au conducteur du chantier à chaque fois, au chef d'atelier (Contacts, *ChefAtelier* = O) seulement si la case est cochée ; plafond de quota inchangé (mail reporté si besoin).
- Installation en une fonction : `installerLot7Test` / `installerLot7Production`.
- Ce lot emporte l'outillage du serveur (fonction d'installation unique, empreinte du serveur, `verifierConfig` complété).

**Pourquoi** : rien d'oublié sur le chantier, et un suivi visible par tous (`PLAN.md`, lot 7). Décisions D7-1 à D7-3 ; écart avec le plan général : un PDF au lieu des photos brutes en pièces jointes (D7-2).

**Comment déployer** : `docs/lot7-procedure.md`.

**Tests** : serveur 31 (`tests/lot7-signalement.test.js`), page dans un vrai Chrome en largeur téléphone 8 (`tests/lot7-page.test.js`), porte de service 48, essais réels sur la copie TEST (`tests/reel-lot7.js`), toutes les séries des lots précédents.

## Outillage — étape C (12/11/2026) — copie TEST seulement, aucun changement pour les téléphones ni pour la production

**Quoi** : 1. `node outils\envoyer-test.js` envoie le serveur sur la copie TEST avec clasp : c'est Franck qui la lance (2 lignes, 1 clic « Autoriser »), elle vérifie que le projet visé est bien celui de TEST, sauvegarde, envoie, contrôle en ligne par l'empreinte du serveur, et efface le jeton Google dans tous les cas. 2. Une « porte de service », présente seulement dans le serveur envoyé sur TEST, permet à Claude de lancer depuis le PC une liste fermée de gestes d'essai (`node outils/porte.js`). 3. Le serveur renvoie son empreinte (`ping`). 4. `verifierConfig` signale par un ❌ tout reste des outils d'essai hors de TEST.

**Pourquoi** : plus de copier-coller sur TEST, et des essais que Claude peut jouer seul contre le vrai serveur TEST (`docs/automatisation.md`, O-3 à O-5).

**Vérifié en vrai le 12/11/2026** : trois envois par clasp réussis (deux avec la porte, le dernier sans), jeton effacé à chaque fois ; après le dernier, la copie TEST exécute le serveur sans outils d'essai (la porte y répond « action inconnue ») ; déclencheur posé puis retiré par la porte ; démonstration complète (contrôle du lot 2, comptes d'essai, session d'essai acceptée puis annulée, lecture de l'onglet *Envois*, déclencheurs posés puis retirés, copie TEST remise en ordre).

**Comment déployer** : rien en production. Le code est sur la branche `outillage` et entrera dans `main` avec le lot 7. Modes d'emploi : `docs/guide-outillage.md`, `docs/clasp.md`. Pas fait (reporté au lot 7, qui en aura besoin) : les gestes qui touchent à Drive, et l'envoi d'une fiche par un navigateur piloté avec une session d'essai.

## Outillage — étapes A et B (12/11/2026) — outils du PC seulement, aucun changement pour les téléphones

**Quoi** : 1. `main` est verrouillée sur GitHub : plus rien n'y entre sans demande de fusion. 2. `node outils/lien-fusion.js` prépare le lien qui ouvre une demande de fusion déjà remplie (serveur changé ou non, pages changées ou non, empreinte du `Code.gs`) : il reste 3 clics à Franck. 3. La copie d'essai sort de ce dépôt : `node outils/publier-essai.js` la fabrique dans un dossier voisin et la publie dans un dépôt à part (organisation GitHub gratuite), à sa propre adresse, toujours en mode TEST. 4. Prêt mais pas encore en service (branche `outillage`) : l'installation d'un lot en une seule fonction Apps Script.

**Pourquoi** : que Claude fasse seul le maximum pour les prochains lots, sans jamais pouvoir publier la production à la place de Franck (`docs/automatisation.md`, décisions O-2 à O-4).

**Comment déployer** : rien à mettre dans Apps Script, rien ne change pour les poseurs. Franck : fusionner la demande `livraison/outillage` (documents et outils) ; créer l'organisation et le dépôt d'essai (`docs/outillage-plan.md`, séance B). Mode d'emploi : `docs/guide-outillage.md`. Reste à faire : étape C (clasp et porte de service sur TEST).

## Lot 2 — Comptes, rôles, accueil (avec 9a) — serveur v6.0.1, appli 6.0.1 — **en production depuis le 12/11/2026**

**En production (12/11/2026)** : le serveur v6.0.1 tourne sous le déploiement « Lot 2 — production » ; la demande de fusion `livraison/lot-2` (n° 10) est fusionnée : vraies pages 6.0.1, copie d'essai `essai/` retirée. Vérifié par Franck : « À propos » affiche 6.0.1, connexion avec son compte, quitus réel envoyé et reçu. L'ancien déploiement (lot 1) reste en service comme retour arrière jusqu'à la fin de la transition ; d'ici là, les gars sans compte touchent « Continuer sans compte » et l'appli marche comme avant.

**Reste à la charge de Franck** : 1. le jour où il voit les poseurs, installer l'appli sur chaque téléphone (iPhone surtout : c'est aussi l'étape D.11 du lot 1) et remettre à chacun son mot de passe provisoire ; 2. quand tout le monde est connecté et en 6.0.1, lancer `demarrerTransition` ; 3. à la fin de la transition, archiver les anciens déploiements (jamais « Lot 2 — production »). Détail : `docs/lot2-procedure.md`, étape D, points 8 à 10.

**Lot suivant** : pas commencé. Franck répond d'abord aux six décisions de `docs/automatisation.md`.

**Correctif 6.0.1 (après les essais sur TEST)** : essai 12, le bouton ne reste plus bloqué sur « Rangement dans le téléphone… » (même correctif que la 5.1.1 de production) ; essai 14, la colonne État dit « bloqué » dès le 5e essai raté ; journal des incidents dans « À propos » ; nouveau test `node tests/hors-ligne.test.js` (vrai Chrome hors-ligne, avec un autre onglet qui occupe la mémoire du téléphone). Procédure : `docs/lot2-procedure.md`, section « Correctif après tes essais ».

**Quoi**
- **Comptes** : identifiant + mot de passe (connexion une fois tous les 90 jours). Onglet *Utilisateurs* : rôle, case « Réinitialiser » (mot de passe provisoire de 48 h, déblocage, déconnexion), case « Déconnecter ses téléphones », case « Tous les chantiers ». Empreintes des mots de passe dans les Propriétés du script, jamais dans le Sheet. 5 erreurs = 15 min de blocage ; alerte à Franck au-delà de 50 échecs par heure.
- **Droits vérifiés par le serveur** : un poseur ne lit que **ses** chantiers (onglet *Accès chantiers*) et leurs plans ; conducteurs et admin voient tout. Une fiche reste possible pour n'importe quel chantier (auteur noté dans *Envois*).
- **Accueil** : Connexion → Mes chantiers (recherche, derniers ouverts) → fiches du chantier **pré-remplies** + Plans ; Planning, Absence, « Fiche sans chantier choisi » ; « Remplir une fiche sans être connecté » toujours proposé ; À propos : compte, se déconnecter, changer de mot de passe.
- **File d'envoi** : une fiche sans compte ou avec une session terminée attend la connexion (jamais « à vérifier ») et repart dès la connexion. Une panne du serveur ne déconnecte personne.
- **Brouillon** : un chantier pré-rempli ne crée pas de faux brouillon ; le bandeau « Brouillon retrouvé » affiche le chantier du brouillon.
- **Période de transition** de 15 jours, lancée par Franck (`demarrerTransition`) : l'appli marche encore sans compte (onglet *Sans compte*), puis plus rien n'est lisible sans compte. Mail 3 jours avant la fin.
- **9a** : colonnes E à K de *Chantiers* (N°, nom court, adresse, client, architecte, date « Terminé », chemin MEGA) ; nom court dans le nom des PDF ; onglet *Intervenants* créé.
- **Chantier inconnu** : plus de dossier Drive créé par une faute de frappe : le PDF va dans `_À CLASSER` et Franck est prévenu.

**Pourquoi** : chaque gars voit ses chantiers et rien d'autre, et la liste des contacts n'est plus lisible par quiconque connaît l'adresse du serveur.

**Comment déployer** : `docs/lot2-procedure.md` (étapes A à D : serveur TEST, comptes d'essai, essais sur la copie d'essai `livraison/lot-2-essai`, production avec un **nouveau déploiement**).

**Mise à jour avec le lot 1 en production (10/11/2026)** : retouches du lot 1 reprises ; versions 6.0 ; `node outils/construire.js --verifier` refuse désormais un marqueur de conflit oublié ou un script illisible (un service worker cassé avait échappé au contrôle sur la branche du lot 2, jamais en production) ; envoi direct (téléphone qui ne peut pas garder la fiche) : connexion dans la page, sans la quitter ; listes de secours la 1re fois sans réseau ; fiches restées « à vérifier » sur l'appli 5.1 reprises par la 6.0.

**Tests** : `node tests/lot2-comptes.test.js` (44 tests) + tests des lots 0 et 1 ; pages essayées dans le navigateur avec le faux serveur (comptes d'essai), en 375 px.

## Lot 1 — Correctif 5.1.1 : bouton bloqué sur « Rangement dans le téléphone… » — prêt pour la production

**Quoi** : la fiche et ses photos sont rangées dans le téléphone en une seule opération, annulée net au bout de 12 s si la mémoire est bloquée (rien n'est écrit en retard). La fiche part alors directement si le réseau est là ; sinon un message qui **reste à l'écran** dit quoi faire (garder la page ouverte, fermer les autres fenêtres de l'appli et ses onglets dans Chrome, toucher Envoyer de nouveau sans rien changer) et le texte reste en brouillon. Le 2e appui garde le même numéro de fiche : pas de 2e mail. Le brouillon d'une fiche rangée n'est plus jamais reproposé, même si son effacement tarde. La sauvegarde automatique du brouillon a aussi une limite (8 s, puis bandeau rouge). Nouveau : un journal des incidents dans « À propos » (30 jours : rangement bloqué ou lent, sauvegarde bloquée, file occupée), à transmettre au bureau.

**Pourquoi** : essai 12 du lot 2 (Motorola, appli installée, mode avion) : le bouton restait bloqué plus de 2 min sans message. Reproduit sur PC quand un AUTRE onglet de l'appli garde la mémoire du téléphone occupée (Android fige les onglets en arrière-plan) : la page attendait sans limite. Même défaut dans l'appli 5.1 en production (même code de rangement).

**Comment déployer** : fusionner la demande `livraison/lot-1-correctif-file`. Rien à changer dans Apps Script. « À propos » affiche ensuite **5.1.1**.

## Lot 1 — Retouches après les essais (serveur v5.1, appli 5.1) — en production depuis le 10/11/2026

**Quoi**
- **R1 — Photos et croquis en grand dans les PDF** (fabrication, quitus, bordereaux, attestation, note de réunion, réception support) : la 1re photo se place sous le contenu de la page 1 et prend toute la place restante ; chaque croquis a une page entière ; les autres photos ont leur page (deux par page quand elles y gardent leur taille). Les petites images sont agrandies, proportions gardées. Quitus, bordereaux, attestation : les signatures passent avant les photos. Croquis dessinés en résolution double. Le serveur vérifie chaque PDF qui contient des photos et le refait une fois s'il a une page de trop (il garde le meilleur des deux). Nouvelle fonction `essaiMiseEnPage` (TEST, sans mail).
- **R2 — Bordereau matériaux** : nouvel onglet **« Matériaux bordereau »** (créé par `verifierConfig`) ; le Type remplit la case **« Matériaux remis »** (modifiable), qui apparaît dans le PDF.
- **R3 — Sablier** : une fiche partie dont la réponse s'est perdue est redemandée en quelques secondes (et dès le retour dans l'appli) ; le sablier disparaît dès que le serveur confirme. Aucun mail en double (numéro unique, y compris pour l'envoi direct de secours).

**Pourquoi** : retours de Franck après les essais 1 à 18 sur la copie TEST.

**Comment déployer** : `docs/lot1-procedure.md`, section « Retouches » (coller `Code.gs` v5.1 sur TEST, `verifierConfig`, `essaiMiseEnPage`, puis fusionner `livraison/lot-1-essai-2`).

**Tests** : `node tests/lot1-retouches.test.js` (29) ; `node tests/pdf-mise-en-page.js` (23 PDF fabriqués par Chrome) ; file d'envoi essayée dans le navigateur avec le faux serveur (réponse perdue, envoi lent, retour dans l'appli).

## Lot 1 — Fondations (serveur v5, appli 5.0) — en production depuis le 10/11/2026 (avec les retouches, v5.1)

**État au 10/11/2026** : serveur v5.1 collé et déployé en production ; pages fusionnées (demande de fusion #6) ; appli 5.1 essayée sur le téléphone de Franck ; anciens documents du vrai Drive rangés (étape E). **Reste** : l'installation de l'appli sur les iPhone des poseurs (étape D.11), faite le jour où Franck les voit (en même temps que la distribution des mots de passe du lot 2). La copie d'essai `essai/` a été retirée du site.

**Quoi**
- **Envoi sûr** : chaque fiche est rangée dans le téléphone (IndexedDB) puis envoyée ; elle n'est retirée que quand le serveur répond « enregistrée ». Renvoi automatique au retour du réseau, à l'ouverture, au retour dans l'appli. Numéro unique par fiche : jamais de double envoi. Indicateur permanent « ✓ Tout est envoyé » / « ⏳ N en attente ».
- **Serveur v5** : réponses lisibles (`{ok, code, message}`), photos envoyées une par une, onglet *Envois*, verrou, erreurs claires ; l'ancien format reste accepté.
- **Briques communes** (`commun/`) : configuration, appels serveur, messages, photos compressées (1600 px, environ 350 Ko), signatures, brouillon automatique complet (photos dans IndexedDB, bandeau rouge s'il ne peut pas être gardé), destinataires, mode hors-ligne.
- **Un seul modèle par document** (`modeles/`) : l'aperçu, l'impression et le PDF du mail viennent du même modèle. Boutons Imprimer / Enregistrer en PDF.
- **Toutes les pages migrées** : prise de cotes, fabrication (+ **lot 6** : précision libre du délai, colonne M de *Fabrication*), note de réunion, bordereaux (une seule page), quitus, attestation, réception support, absence, accueil. Bugs de l'audit corrigés page par page (liste dans `DECISIONS.md`).
- **Retours terrain** : brouillon de l'attestation avec photos (« Erreur sauvegarde ») ; adresse tapée sans bulle ajoutée à l'envoi ou envoi bloqué ; nouvelle version reçue tout de suite après une fusion.
- **iPhone** : écran « Installer l'appli » ; avertissement sur les fiches tant qu'elle n'est pas installée. **À propos** : version, installation, place utilisée, fiches en attente, mises à jour.
- **Rangement Drive (1.5)** : noms des dossiers dans `dossiers.json` ; dossiers du skill `gestion-documentaire` (`05 - CHANTIER/…`, `07 - ATELIER`, `ADMINISTRATIF/ABSENCES`) ; nommage `<INTITULÉ> <CHANTIER> <AAAA-MM-JJ>[_Vn]` ; onglet *Dossiers chantiers* ; `planMigration` / `executerMigration` / `annulerMigration`.
- **Livraison** : serveur complet en un seul fichier `A-COLLER-DANS-APPS-SCRIPT/Code.gs` ; copie d'essai `essai/` (`node outils/essai.js`), toujours en mode TEST.

**Pourquoi** : zéro fiche perdue avec un réseau faible, un PDF identique à l'aperçu, un code commun maintenable, et le rangement Drive aligné sur MEGA.

**Comment déployer** : `docs/lot1-procedure.md` (étapes A à E : serveur TEST, copie d'essai, essais, production, migration Drive).

**Tests** : `node tests/lot0.test.js`, `node tests/lot1-api.test.js`, `node tests/lot1-dossiers.test.js` (services Google simulés) ; chaque page essayée dans le navigateur avec le faux serveur (`tests/faux-serveur.js`) en 375 px et sur PC, hors-ligne et réseau lent.

## Lot 0 — Correctif : listes vides sur 4 pages — en production

**Quoi** : `attestation.html`, `reception-support.html`, `absence.html` et `index.html` (Chantiers, Planning, documents d'un chantier) chargent maintenant leurs listes comme les 6 autres pages : d'abord un appel **anonyme** (sans les cookies Google), puis l'ancienne méthode (JSONP) seulement si le premier échoue. Aucun autre changement.

**Pourquoi** : à l'étape C, sur la copie TEST, ces 4 pages restaient vides (essais 7, 8, 9 et 12). Elles n'utilisaient que le JSONP, qui envoie les cookies du compte Google connecté et se comporte différemment selon ce compte (règle 3 du CLAUDE.md).

**Comment déployer** : valider la demande de fusion (pull request) `livraison/lot-0-correctif` sur GitHub, attendre quelques minutes, recharger la page (sur le téléphone : fermer puis rouvrir l'appli), puis refaire les essais 7, 8, 9 et 12 de l'étape C. Rien à changer dans Apps Script.

Au passage, les délais d'attente de l'accueil passent à 15 secondes, comme sur les autres pages.

## Lot 0 — Sécurité urgente (Apps Script v4.1) — en production (remplacé par le serveur v5.1 du lot 1)

**Quoi**
- Mails : une adresse du Sheet (*Contacts*, *Contacts notes*) reçoit le mail habituel. Une adresse tapée à la main reçoit un mail **au texte imposé** + le PDF, 2 par fiche et 10 par jour au maximum, avec le conducteur du chantier (ou Franck) en copie cachée. Chaque envoi ou refus est noté dans l'onglet **Journal**.
- Quota : en dessous de 20 mails restants dans la journée, seuls les mails de Franck partent. Les autres vont dans **Mails en attente** et repartent toutes les 2 h.
- Partages : plus aucun partage public automatique, sauf le dossier *Plans* et le *Planning*. Fonctions `listerPartages` / `retirerPartages` / `remettrePartages`.
- Tuile *Chantiers* : seul l'onglet *Plans* est affiché.
- Textes saisis rendus inoffensifs dans les PDF et les mails ; formules neutralisées dans le Sheet ; signatures et photos contrôlées.
- Identifiants Drive retirés du code (Propriétés du script) et de CLAUDE.md.
- **Adresse Apps Script écrite à un seul endroit** : `commun/config.js`, avec un mode test `?env=test` (bandeau rouge).
- Bugs corrigés au passage :
  - destinataire de secours vide (le mail ne partait pas) ;
  - fiche de fabrication qui échouait entièrement si un mail échouait ;
  - bordereaux rangés dans « Quitus » (maintenant « Bordereaux ») ;
  - type de fiche inconnu traité comme une prise de cotes ;
  - tri des documents par date faux d'un mois sur l'autre.
- Outils : `verifierConfig`, `installerDeclencheurs`, `anonymiserCopieTest` (copie TEST uniquement).

**Pourquoi** : n'importe qui connaissant l'adresse Apps Script (publique) pouvait envoyer des mails au nom de Loué et vider le quota. Par ailleurs, l'ouverture d'un chantier dans l'appli partageait publiquement tous ses fichiers.

**Comment déployer** : `docs/lot0-procedure.md` (étapes A à D).

**Tests** : `node tests/lot0.test.js` (30 tests, services Google simulés) ; les 10 pages chargées sans erreur en mode test et en mode production.
