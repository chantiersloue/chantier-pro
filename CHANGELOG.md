# Journal des modifications — ChantierPro

Chaque lot : **quoi**, **pourquoi**, **comment déployer**. Procédures détaillées dans `docs/lotN-procedure.md`.

## Lot 2 — Comptes, rôles, accueil (avec 9a) — en préparation (rien en production)

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

**Comment déployer** : `docs/lot2-procedure.md` (après la mise en production du lot 1).

**Tests** : `node tests/lot2-comptes.test.js` (36 tests) + tests des lots 0 et 1 ; pages essayées dans le navigateur avec le faux serveur (comptes d'essai), en 375 px.

## Lot 1 — Fondations (serveur v5, appli 5.0) — en préparation

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
