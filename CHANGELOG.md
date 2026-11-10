# Journal des modifications — ChantierPro

Chaque lot : **quoi**, **pourquoi**, **comment déployer**. Procédures détaillées dans `docs/lotN-procedure.md`.

## Lot 1 — Retouches après les essais (serveur v5.1, appli 5.1)

**Quoi**
- **R1 — Photos et croquis en grand dans les PDF** (fabrication, quitus, bordereaux, attestation, note de réunion, réception support) : la 1re photo se place sous le contenu de la page 1 et prend toute la place restante ; chaque croquis a une page entière ; les autres photos ont leur page (deux par page quand elles y gardent leur taille). Les petites images sont agrandies, proportions gardées. Quitus, bordereaux, attestation : les signatures passent avant les photos. Croquis dessinés en résolution double. Le serveur vérifie chaque PDF qui contient des photos et le refait une fois s'il a une page de trop (il garde le meilleur des deux). Nouvelle fonction `essaiMiseEnPage` (TEST, sans mail).
- **R2 — Bordereau matériaux** : nouvel onglet **« Matériaux bordereau »** (créé par `verifierConfig`) ; le Type remplit la case **« Matériaux remis »** (modifiable), qui apparaît dans le PDF.
- **R3 — Sablier** : une fiche partie dont la réponse s'est perdue est redemandée en quelques secondes (et dès le retour dans l'appli) ; le sablier disparaît dès que le serveur confirme. Aucun mail en double (numéro unique, y compris pour l'envoi direct de secours).

**Pourquoi** : retours de Franck après les essais 1 à 18 sur la copie TEST.

**Comment déployer** : `docs/lot1-procedure.md`, section « Retouches » (coller `Code.gs` v5.1 sur TEST, `verifierConfig`, `essaiMiseEnPage`, puis fusionner `livraison/lot-1-essai-2`).

**Tests** : `node tests/lot1-retouches.test.js` (27) ; `node tests/pdf-mise-en-page.js` (22 PDF fabriqués par Chrome) ; file d'envoi essayée dans le navigateur avec le faux serveur (réponse perdue, envoi lent, retour dans l'appli).

## Lot 1 — Fondations (serveur v5, appli 5.0) — en test

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

## Lot 0 — Correctif : listes vides sur 4 pages

**Quoi** : `attestation.html`, `reception-support.html`, `absence.html` et `index.html` (Chantiers, Planning, documents d'un chantier) chargent maintenant leurs listes comme les 6 autres pages : d'abord un appel **anonyme** (sans les cookies Google), puis l'ancienne méthode (JSONP) seulement si le premier échoue. Aucun autre changement.

**Pourquoi** : à l'étape C, sur la copie TEST, ces 4 pages restaient vides (essais 7, 8, 9 et 12). Elles n'utilisaient que le JSONP, qui envoie les cookies du compte Google connecté et se comporte différemment selon ce compte (règle 3 du CLAUDE.md).

**Comment déployer** : valider la demande de fusion (pull request) `livraison/lot-0-correctif` sur GitHub, attendre quelques minutes, recharger la page (sur le téléphone : fermer puis rouvrir l'appli), puis refaire les essais 7, 8, 9 et 12 de l'étape C. Rien à changer dans Apps Script.

Au passage, les délais d'attente de l'accueil passent à 15 secondes, comme sur les autres pages.

## Lot 0 — Sécurité urgente (Apps Script v4.1) — en test

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
