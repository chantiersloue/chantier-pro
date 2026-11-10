# Journal des modifications — ChantierPro

Chaque lot : **quoi**, **pourquoi**, **comment déployer**. Procédures détaillées dans `docs/lotN-procedure.md`.

## Lot 2 — Comptes, rôles, accueil (avec 9a) — serveur v6.0.1, appli 6.0.1 — en test (rien en production)

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

**Quoi** : le rangement d'une fiche dans le téléphone a maintenant une limite de 12 s. Au-delà, la fiche part directement si le réseau est là ; sinon un message clair dit quoi faire (garder la page ouverte, fermer les autres onglets de l'appli dans Chrome, toucher Envoyer de nouveau) et le texte reste en brouillon. Une écriture qui finit en retard est défaite : jamais de fiche en double. L'effacement du brouillon après l'envoi n'attend jamais plus de 3 s. Nouveau : un journal des incidents dans « À propos » (rangement bloqué ou lent), à transmettre au bureau.

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
