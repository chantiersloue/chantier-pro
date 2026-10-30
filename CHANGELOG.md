# Journal des modifications — ChantierPro

Chaque lot : **quoi**, **pourquoi**, **comment déployer**. Procédures détaillées dans `docs/lotN-procedure.md`.

## Lot 0 — Correctif : listes vides sur 4 pages

**Quoi** : `attestation.html`, `reception-support.html`, `absence.html` et `index.html` (Chantiers, Planning, documents d'un chantier) chargent maintenant leurs listes comme les 6 autres pages : d'abord un appel **anonyme** (sans les cookies Google), puis l'ancienne méthode (JSONP) seulement si le premier échoue. Aucun autre changement.

**Pourquoi** : à l'étape C, sur la copie TEST, ces 4 pages restaient vides (essais 7, 8, 9 et 12). Elles n'utilisaient que le JSONP, qui envoie les cookies du compte Google connecté et se comporte différemment selon ce compte (règle 3 du CLAUDE.md).

**Comment déployer** : fusionner la demande de fusion `livraison/lot-0-correctif` sur GitHub, attendre 2 à 3 minutes, puis refaire les essais 7, 8, 9 et 12 de l'étape C. Rien à changer dans Apps Script.

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
