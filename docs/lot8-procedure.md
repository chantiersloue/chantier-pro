# Lot 8 — Note de réunion : procédure de déploiement et de test (8a et 8b)

> Pour Franck. Deux livraisons, qui se déploient **l'une après l'autre** :
> - **8a** — annotation des photos qu'on peut rouvrir : **pages seules** (appli **10.0**), rien à faire dans Apps Script ;
> - **8b** — numéro du compte rendu et présents : **serveur v11.0 + pages** (appli **10.1**).
>
> La partie 8c (points ouverts / clos, reprise d'une note à l'autre) **n'est pas construite** : elle attend tes réponses au chapitre 11 de `docs/lot8-plan.md`.
> **État au 16/11/2026 : construit et testé contre le faux serveur seulement.** Rien n'a touché la copie TEST ni la production.
> **Ne passe à l'étape suivante que si la précédente est verte.** Sinon : arrête-toi et envoie-moi une capture.

## Avant tout envoi : le bon dossier, la bonne branche, un seul lot à la fois

- La commande d'envoi sur la copie TEST envoie le serveur **du dossier d'où elle est lancée**. Le lot 8 est sur la branche `lot-8`. **C'est moi qui prépare ton dossier principal de l'appli sur cette branche avant de te demander l'envoi**, et je te le confirme par écrit (« dossier prêt, branche lot-8, serveur v11.0 »). Si je ne te l'ai pas confirmé, ne lance rien : c'est le serveur d'un autre lot qui partirait.
- Pareil pour la production : le fichier à coller est `A-COLLER-DANS-APPS-SCRIPT/Code.gs` **de la branche `lot-8`**, dans ce même dossier préparé. Sa première ligne utile doit porter `VERSION_API = 'v11.0'`, et je te donne son empreinte.
- **La copie TEST ne porte qu'un lot à la fois.** Elle sert aussi aux lots 4c et 5 : chaque envoi remplace le serveur du lot précédent. On décide ensemble de l'ordre des essais, et on ne commence pas ceux d'un lot tant que ceux de l'autre ne sont pas finis.
- Deux envois au même instant (le vrai verrou de Google) seront essayés sur TEST par `tests/reel-lot8.js`, que je lance après ton envoi. **Pas de production du 8b avant que cet essai soit vert.**

## Ce que 8a change

- Dans la note de réunion, tu peux **rouvrir une photo déjà annotée** : ses traits reviennent un par un. La gomme efface un trait (pas la photo), « ↶ » annule le dernier trait, même un ancien.
- Tous les traits retirés : la photo redevient la photo d'origine.
- Un seul trait à la fois : un second doigt ou la paume posés pendant un tracé sont ignorés.
- Le brouillon automatique garde la photo, la photo d'origine et les traits.
- Une photo annotée **avant** la mise à jour garde ses anciens traits pour de bon. La page le dit : « Les anciens traits de cette photo ne s'effacent plus. »
- Une photo annotée pèse le double dans le brouillon (la photo d'origine + l'image finale). Ce qui part au bureau ne change pas.

## Ce que 8b change

- Chaque note de réunion d'un chantier de la liste reçoit un numéro : **« Compte rendu n° 7 »**. C'est le **serveur** qui le donne, **à la réception**. Deux téléphones ne peuvent donc pas avoir le même.
- Le numéro est dans le **PDF**, dans le **nom du fichier** rangé dans Drive (`COMPTE RENDU <chantier> CR 7 <date>.pdf`), dans l'**objet du mail** (« Note de réunion — CR n° 7 — … ») et dans le message de fin d'envoi : « ✓ Compte rendu n° 7 envoyé — 3 mails envoyés ».
- **Sans réseau**, la page dit que le numéro sera donné au retour du réseau. Le numéro suit donc **l'ordre d'arrivée au bureau**, pas la date de la réunion (une note restée deux jours sans réseau peut porter un numéro plus grand qu'une note plus récente ; l'onglet le note dans « Remarque de l'appli »).
- **Présents** : une liste de noms, facultative, tapée à la main (les noms de l'onglet *Contacts* sont proposés). Elle est dans le PDF et dans l'onglet.
- **Destinataires** : la page annonce combien de mails partiront, et refuse une 11e adresse de la liste (quota de 100 mails par jour). **Ce plafond de 10 est tenu par la page seule** : le serveur, lui, sert toujours toutes les adresses connues qu'il reçoit (comme avant). Il peut donc être dépassé si les listes ne sont pas chargées (pas de réseau) ou par une note déjà en attente. C'est ta question 6 du plan : dis-moi si tu veux aussi un plafond sur le serveur.
- Un nouvel onglet ***Comptes rendus*** dans le Sheet (une ligne par note). Détail des colonnes : `docs/structure-sheet.md`.

**À savoir**
- Chantier **tapé à la main et absent de la liste** : la note part, **sans numéro**. La page le dit avant l'envoi.
- Pour une **adresse tapée à la main**, l'objet du mail et le nom de la pièce jointe restent ceux imposés par le lot 0, sans numéro. Le numéro est dans le PDF.
- **Chantier renommé** dans l'onglet *Chantiers* : sa série de numéros continue **s'il a un N° (colonne E)**. Sans N°, elle repart à 1. Remplis donc la colonne E avant de renommer un chantier.
- **Ne modifie pas la ligne de titres** de l'onglet *Comptes rendus*. Si elle change, les notes **partent quand même** (PDF et mails normaux), mais **sans numéro** et sans ligne dans l'onglet ; le téléphone affiche « Envoyée sans numéro : le bureau est prévenu », et tu reçois un mail « Notes de réunion sans numéro » (un par jour au plus). Remets les titres : la numérotation reprend à la suite du dernier numéro noté. Les notes parties entre-temps restent sans numéro.
- Un numéro peut manquer dans la série (rare) : numéro donné, PDF en échec, et téléphone qui ne réessaie jamais. La ligne est dans l'onglet, sans nom de PDF.

---

## 8a — Étape A : la copie d'essai (rien à faire pour toi)

Je publie la copie d'essai (`node outils/publier-essai.js`). Le serveur n'est pas concerné.

## 8a — Étape B : tes essais sur téléphone (10 min)

Sur la copie d'essai (icône « Loué ESSAI »), tuile **Note de réunion** :

1. Prends une photo. Touche-la, trace deux traits et une flèche, **Valider**.
2. Touche de nouveau la photo : les traits sont là. Passe la **gomme** sur un trait : il s'efface, la photo dessous est intacte. **Valider**.
3. Rouvre, touche **↶** jusqu'à ce qu'il n'y ait plus de trait, **Valider** : la photo n'est plus marquée « (annotée) ».
4. Annote encore, puis **ferme l'appli** sans envoyer. Rouvre la note : « Brouillon retrouvé » → **Restaurer**. La photo est là avec ses traits, et ils s'effacent encore.
5. **Si tu avais un brouillon en cours avant la mise à jour** : vérifie qu'il est proposé et qu'il revient entier.
6. Avec des **gants**, en plein soleil : les boutons de l'annotation se touchent-ils bien ?
7. Envoie la note (elle part sur la copie TEST) : le PDF reçu montre la photo avec ses traits.

## 8a — Étape C : production

Tu me donnes le feu vert. Je prépare le lien de fusion ; tu cliques **Create pull request**, **Merge pull request**, **Confirm merge**. Rien d'autre.
Vérification : dans l'appli, « À propos » affiche **10.0**.

**Retour arrière 8a** (tant que 8b n'est pas en production) : une fusion inverse (je la prépare, tu la valides). L'ancienne page (9.0) relit les brouillons de la page 10.0 : le texte et les photos reviennent, avec leurs traits dans l'image ; seuls les traits ne se modifient plus. **Une fois 8b en production, 8a ne se retire plus seul** : voir « Retour arrière 8b ».

---

## 8b — Étape A : la copie TEST (toi : 2 minutes par envoi)

1. J'ai préparé ton dossier principal sur la branche `lot-8` et je te l'ai confirmé (voir « Avant tout envoi »). Tu ouvres PowerShell **dans ce dossier**, comme pour les lots précédents, et tu lances :
   ```
   node outils\envoyer-test.js --avec-porte
   ```
   Page Google → compte de Loué → **Autoriser**. Attends `✅ Envoi réussi`. La commande affiche la version : ce doit être **v11.0**. Dis-moi « envoi fait », avec l'empreinte affichée.
2. Je fais le reste sans toi : installation sur TEST par la porte de service (`installerLot8`), essais contre le vrai serveur TEST (`tests/reel-lot8.js` : deux envois au même instant, note renvoyée ; 2 mails, tous à ton adresse), publication de la copie d'essai.

## 8b — Étape B : tes essais sur téléphone (15 min)

**Avant que je publie la copie d'essai** : commence une note sur la copie d'essai (un texte, une photo), **ne l'envoie pas**. Mets aussi une note **en attente** : coupe le réseau (mode avion), remplis une note, touche Envoyer, laisse le mode avion. Dis-moi « prêt ». Je publie, puis :

1. Remets le réseau : la note en attente part, et le message donne son numéro (« ✓ Compte rendu n° … envoyé »).
2. Rouvre la note de réunion : ton brouillon d'avant la mise à jour est proposé et revient entier.
3. Sous le chantier, tu lis : « Le numéro du compte rendu est donné à l'envoi. »
4. **Présents** : ajoute trois noms, retires-en un. Tape un quatrième nom **sans** toucher « + Ajouter ».
5. Touche **Aperçu** : « Compte rendu n° — donné à l'envoi », et les présents.
6. Envoie. Le message donne le numéro. Dans le mail : l'objet porte « CR n° … », le PDF porte le numéro et les quatre présents.
7. Envoie une deuxième note sur le même chantier : numéro suivant.
8. En **mode avion** : envoie une note. La page dit que le numéro sera donné au retour du réseau. Remets le réseau : le numéro s'affiche.
9. Ouvre l'onglet *Comptes rendus* de la copie TEST : une ligne par note, les numéros se suivent.

## 8b — Étape C : second envoi sur TEST, sans la porte

Dans le même dossier, toujours sur la branche `lot-8` :
```
node outils\envoyer-test.js --sans-porte
```
C'est le fichier qui ira en production. Je revérifie par l'empreinte.

## 8b — Étape D : production (toi : 10 minutes)

1. Éditeur Apps Script de production : remplace tout `Code.gs` par `A-COLLER-DANS-APPS-SCRIPT/Code.gs` **de la branche `lot-8`** (le dossier que j'ai préparé ; je te donne son empreinte, et la ligne `VERSION_API` doit dire `v11.0`). **Enregistre**.
2. **Déployer → Nouveau déploiement** (description « Lot 8b — production »). Copie la nouvelle adresse et donne-la-moi : je la mets dans `commun/config.js`.
3. Dans l'éditeur, choisis la fonction **`installerLot8Production`** et clique ▶. Le journal doit finir par `✅ Lot 8 : installation terminée.` (elle crée l'onglet *Comptes rendus* ; on peut la relancer sans danger).
4. Ouvre le lien de fusion que je te donne : **Create pull request**, **Merge pull request**, **Confirm merge**.
5. Vérification : « À propos » affiche **10.1** ; l'adresse du serveur ouverte dans un navigateur affiche `Loué App API v11.0 OK`.

**L'ordre compte peu** : la nouvelle page marche avec l'ancien serveur (la note part, les présents sont en tête du texte dans le PDF, le message dit « Numéro non reçu »), et l'ancienne page marche avec le nouveau serveur (ses notes sont numérotées).

## Retour arrière 8b

1. **D'abord le serveur seul** : dans Apps Script, « Gérer les déploiements », remets l'ancien déploiement en service (son adresse n'a pas changé), et je remets cette adresse dans `commun/config.js`. La page 10.1 marche avec l'ancien serveur ; les brouillons ne sont pas touchés.
2. **Si la page doit reculer aussi** : fusion inverse vers la page **10.0**, pas plus loin. Elle relit les brouillons de la page 10.1 : les présents déjà ajoutés sont versés en tête de « Notes et commentaires », le texte et les photos reviennent avec leurs traits (vérifié par `tests/lot8-page.test.js`). Seul un nom resté dans le champ « Nom » sans « + Ajouter » est perdu.
3. **Ne recule pas jusqu'à la page 9.0 (celle d'avant 8a) une fois 8b en service.** Elle relit le texte et les photos d'un brouillon 10.1, mais **les présents sont perdus sans message**, et les traits ne se modifient plus (vérifié aussi par le test). Si cela devenait nécessaire, je te préviens d'abord et on demande aux gars d'envoyer leurs notes en cours.
4. Les notes déjà numérotées gardent leur numéro. L'onglet *Comptes rendus* peut rester. Aucune donnée existante n'est migrée : rien à sauvegarder ni à restaurer.

## Numéros de version

Le lot 5, construit ailleurs, prévoit le serveur v10.0. Si le lot 8b sort avant lui, le serveur passera de v9.1 à v11.0. À trancher au moment de la fusion : celui qui sort en second est renuméroté.
