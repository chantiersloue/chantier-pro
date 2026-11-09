# Lot 1 — Fondations : procédure de déploiement et de test

> Pour Franck. Durée totale : environ 2 h 30 en 5 étapes, réparties sur plusieurs jours si tu veux.
> **Ne passe à l'étape suivante que si la précédente est verte.** Si une ligne n'est pas verte : arrête-toi et envoie-moi une capture, je corrige en priorité.
> Les identifiants (dossiers, Sheet) sont dans `_prive/` : `ids-drive.txt` et `ids-test.txt`.

## Ce que le lot 1 change, en bref

| Pour qui | Avant | Après |
|---|---|---|
| Les gars, à l'envoi | « Envoyé ! » même quand rien n'était parti | La fiche est d'abord **rangée dans le téléphone**, puis envoyée. En haut de l'écran : **« ✓ Tout est envoyé »** ou **« ⏳ 1 fiche en attente »**. Sans réseau, elle part toute seule dès que le réseau revient (même si l'appli a été fermée) |
| Les gars, en cours de saisie | Brouillon sur certaines fiches seulement, sans les photos (« Erreur sauvegarde » sur l'attestation) | **Brouillon automatique sur toutes les fiches**, photos et signatures comprises. Si le téléphone ne peut pas le garder : **bandeau rouge** qui dit quoi faire |
| Les photos | 4 à 6 Mo chacune | Réduites à environ **350 Ko** avant l'envoi (10 par fiche au maximum) |
| Une adresse tapée sans toucher « + Ajouter » | Partait dans le vide, sans message | Un rappel jaune s'affiche ; à l'envoi, l'adresse est **ajoutée toute seule**, ou l'envoi est **bloqué** si elle est incomplète |
| Aperçu, PC | Aperçu différent du PDF reçu | L'aperçu **est** le PDF ; boutons **Imprimer** et **Enregistrer en PDF** |
| Bordereaux | 2 pages | 1 seule page (les anciennes adresses mènent à la nouvelle) |
| Fabrication | — | **Précision libre du délai** (lot 6), dans le PDF, le mail et le Sheet (colonne M) |
| Réception support, absence | Pas de brouillon | Brouillon automatique |
| Après une mise à jour de l'appli | Le téléphone gardait l'ancienne version jusqu'à 10 min | La nouvelle page arrive à l'ouverture suivante ; un bandeau **« Nouvelle version — Mettre à jour »** apparaît sur les pages ouvertes (le brouillon est sauvé avant) |
| iPhone | — | Écran **« Installer l'appli »** (sans installation, l'iPhone peut effacer brouillons et fiches en attente) |
| Accueil | — | Lien **« À propos »** : version, installation, place utilisée, fiches en attente, « Vérifier les mises à jour ». La tuile Chantiers marche aussi sans réseau |
| Ton Drive | 8 sous-dossiers maison, noms `Quitus_<chantier>_<date>.pdf` | Rangement de ton skill `gestion-documentaire` : `05 - CHANTIER/PRISE DE COTES`, `05 - CHANTIER/COMPTE RENDU`, `05 - CHANTIER/OPR - RESERVES - QUITUS`, `05 - CHANTIER/ORGANIGRAMME`, `05 - CHANTIER/BORDEREAUX MATERIAUX`, `07 - ATELIER`, absences dans `ADMINISTRATIF/ABSENCES`. Noms : `QUITUS <CHANTIER> 2026-11-09.pdf` (`_V2` si le nom existe déjà : rien n'est écrasé) |
| Les noms de dossiers | Écrits dans le code | Dans **un seul fichier**, `dossiers.json`, à la racine du Drive de l'appli (créé tout seul) : tu peux y changer un nom, il est pris en compte au bout de 10 min |
| Le dossier Drive de chaque chantier | Cherché « à peu près » par son nom (source d'erreurs) | Retenu dans un nouvel onglet **« Dossiers chantiers »** ; une ressemblance n'est utilisée que si elle est unique, et elle est marquée **« à vérifier »** |
| Tes destinataires | PDF en pièce jointe | **Identique** |

**Ce qui ne change pas** : les colonnes de tes onglets (une colonne ajoutée **à la fin** de *Fabrication*), les destinataires, le partage du dossier *Plans* et du *Planning*, le dossier *Plans* lui-même, les dossiers que tu remplis à la main (Plans, QT/Tableau, CCTP, Sécurité, Accès : ils bougeront au lot 4).

## Les fichiers de la livraison

- **`A-COLLER-DANS-APPS-SCRIPT/Code.gs`** : **tout le serveur** en un seul fichier, à coller tel quel (comme au lot 0). Ne le modifie jamais à la main : je le fabrique à partir du dossier `apps-script/`.
- **Demande de fusion `livraison/lot-1-essai`** (étapes A à C) : ajoute à GitHub le dossier `essai/` (une **copie d'essai** de l'appli, toujours branchée sur la copie TEST) et le fichier `Code.gs` ci-dessus. **Le vrai site n'est pas touché.**
- **Demande de fusion `livraison/lot-1`** (étape D) : les vraies pages du lot 1 ; elle retire le dossier `essai/`.

Pourquoi une copie d'essai ? Les nouvelles pages parlent au serveur v5. Mises en ligne avant la mise à jour du serveur de production, elles casseraient l'appli des gars. La copie d'essai permet de tout tester sans risque.

---

## Étape A — Serveur v5 sur la copie TEST (15 min)

1. Fusionne la demande de fusion **`livraison/lot-1-essai`** que je t'envoie : bouton vert **Merge pull request**, puis **Confirm merge**.
2. Ouvre le Sheet **« ChantierPro TEST »** → menu **Extensions → Apps Script**.
3. **Sauvegarde** : clique sur `Code.gs` à gauche, Ctrl+A, Ctrl+C, et colle dans un fichier texte `_prive/Code-TEST-avant-lot1.gs` sur ton PC.
4. Sur github.com, dans le dépôt `chantier-pro`, ouvre le dossier **`A-COLLER-DANS-APPS-SCRIPT`** puis le fichier **`Code.gs`**. En haut à droite du fichier, clique l'icône **« Copy raw file »** (deux carrés superposés).
5. Retour dans l'éditeur Apps Script : clique dans `Code.gs`, **Ctrl+A**, **Ctrl+V** (tout remplacer), puis l'icône **disquette** (Enregistrer).
   - Il ne doit y avoir qu'un seul fichier `Code.gs` dans la liste de gauche. Si tu en vois d'autres (`Api.gs`…), préviens-moi avant de continuer.
6. Les **Propriétés du script** ne changent pas.
7. En haut, choisis **`verifierConfig`** → ▶ **Exécuter**. Google peut redemander l'autorisation (même procédure qu'au lot 0 : Paramètres avancés → Accéder → Autoriser).
   - Le journal doit afficher **`Loué App API v5.0`**, des ✅, et une ligne **« dossiers.json créé avec les noms par défaut »**.
8. Choisis **`installerDeclencheurs`** → ▶ Exécuter.
9. **Déployer → Gérer les déploiements** → ton déploiement TEST → ✏ **Modifier** → Version : **Nouvelle version** → **Déployer**. L'adresse ne change pas.
10. **Vérification de la version** : ouvre l'adresse TEST (celle que tu m'avais envoyée, qui finit par `/exec`) dans un navigateur → **`Loué App API v5.0 OK`**.
    - Si tu vois encore `v4.1` : la mise à jour n'a pas été prise (règle 2 de CLAUDE.md). Fais **Nouveau déploiement** (comme au lot 0, étape B.7), envoie-moi la nouvelle adresse, je mets à jour `config.js`.
11. **Les pages actuelles marchent avec le serveur v5** (indispensable avant l'étape D) : sur le **vrai site** avec `?env=test` (`https://chantiersloue.github.io/chantier-pro/?env=test`), envoie **un quitus** vers toi → mail reçu. Puis repasse en `?env=prod`.

---

## Étape B — Ouvrir la copie d'essai (5 min)

1. Sur ton téléphone, ouvre **`https://chantiersloue.github.io/chantier-pro/essai/`**.
2. Un bandeau rouge **« COPIE D'ESSAI — données de la copie TEST uniquement »** est en haut de chaque page. Tu ne peux rien envoyer en production depuis cette adresse.
3. Sur **iPhone** : l'écran **« Installer l'appli sur l'iPhone »** s'affiche. Suis-le jusqu'au bout : l'icône s'appelle **« Loué ESSAI »** (elle ouvre la copie d'essai, pas la vraie appli). Sur **Android** : menu ⋮ → **Installer l'application** (ou « Ajouter à l'écran d'accueil »).
4. Ouvre l'appli d'essai depuis son icône : le bandeau rouge est là, l'écran d'installation n'apparaît plus.

---

## Étape C — Tester sur la copie d'essai (1 h 30)

Tous les mails arrivent dans **ta** boîte Gmail (copie TEST anonymisée). Pour chaque ligne : fais l'essai, puis coche.

| # | Fiche | À faire | Résultat attendu | ✔ |
|---|---|---|---|---|
| 1 | Prise de cotes | 2 lignes, un conducteur, Envoyer | « ✓ Tout est envoyé » en haut ; 1 mail, PDF complet | ☐ |
| 2 | Fabrication | 1 bloc divers + 1 bloc porte, commentaire en gras rouge, délai **avec une précision** (« impératif avant la pose ») | 2 mails (atelier + conducteur) ; la précision est dans le PDF, le mail et la colonne M de l'onglet *Fabrication* | ☐ |
| 3 | Note de réunion | 2 destinataires de la liste, 2 photos | mail + PDF avec les photos | ☐ |
| 4 | Bordereau organigramme | 2 signatures, 1 photo | mail + PDF | ☐ |
| 5 | Bordereau matériaux | idem | idem | ☐ |
| 6 | Quitus | 2 signatures, Soldé OUI, 3 photos | mail + PDF | ☐ |
| 7 | **Attestation (retour terrain 1)** | type « Mise en œuvre », **3 photos**, signature ; **ferme la page sans envoyer**, rouvre-la | bandeau « Brouillon retrouvé » → **Restaurer** → tout revient, **photos comprises**. Plus jamais « Erreur sauvegarde ». Puis Envoyer → mail au conducteur | ☐ |
| 8 | Réception support | quelques points OK / NOK, une photo sur un point, signature ; ferme et rouvre avant d'envoyer | brouillon restauré (points et photo) ; mail au conducteur | ☐ |
| 9 | Absence | une demi-journée, signature ; ferme et rouvre avant d'envoyer | brouillon restauré ; mail aux personnes « absenceNotif » | ☐ |
| 10 | **Adresse sans bulle (retour terrain 2)** | quitus : tape ton autre adresse **sans toucher « + Ajouter »**, puis Envoyer | message « Adresse … ajoutée aux destinataires » ; cette adresse reçoit le mail | ☐ |
| 11 | Adresse incomplète | tape `nom@exemple` (sans `.fr`), puis Envoyer | envoi **bloqué**, champ en rouge, message clair | ☐ |
| 12 | **Mode avion** | active le mode avion, remplis et envoie un quitus | « Quitus rangé dans le téléphone » ; en haut **« ⏳ 1 fiche en attente »** | ☐ |
| 13 | Retour du réseau | **ferme l'appli**, coupe le mode avion, rouvre l'appli | la fiche part toute seule ; « ✓ Tout est envoyé » ; mail reçu **une seule fois** | ☐ |
| 14 | Chantiers | tuile Chantiers, ouvre un chantier | liste affichée ; onglet Plans seulement. Refais-le en mode avion : la liste s'affiche quand même | ☐ |
| 15 | À propos | accueil → « À propos de l'appli » | version **5.0**, « installée », place utilisée, « aucune fiche en attente » | ☐ |
| 16 | **PC** | ouvre une fiche sur le PC, remplis, **Aperçu** → **Enregistrer en PDF** | la fenêtre d'impression montre le même document que le PDF reçu par mail (très proche, pas forcément au pixel près) | ☐ |
| 17 | **Mise à jour (retour terrain 3)** | quand je te le dis, je publie une petite modification de la copie d'essai | dans les minutes qui suivent, sur une fiche ouverte : bandeau **« Nouvelle version — Mettre à jour »** ; à l'ouverture suivante, la nouvelle version est là | ☐ |
| 18 | Drive TEST | ouvre le dossier CHANTIERPRO-TEST dans Drive | `dossiers.json` à la racine ; les PDF des essais rangés dans `05 - CHANTIER/…` ou `07 - ATELIER` avec les nouveaux noms ; l'absence dans `ADMINISTRATIF/ABSENCES` ; onglet **« Dossiers chantiers »** rempli dans le Sheet TEST | ☐ |

**Rangement des anciens documents, sur TEST** (dans l'éditeur Apps Script du TEST) :
1. ▶ **`planMigration`**. Rien n'est déplacé : le journal dit combien de documents seraient déplacés.
2. Regarde l'onglet **« Migration (lot 1) »** : une ligne par document, avec l'ancien dossier, le nouveau, et l'action **DÉPLACER** ou **À TRIER À LA MAIN** (fichier pas reconnu : il reste où il est). Pour ne pas déplacer un document, remplace « DÉPLACER » par **« IGNORER »**.
3. Regarde l'onglet **« Dossiers chantiers »** : chaque ligne marquée **« OUI — vérifiez »** doit désigner le bon dossier. Sinon, corrige l'identifiant (colonne C) ou supprime la ligne.
4. ▶ **`executerMigration`**. Relance tant que le journal dit « Il en reste ». Colonne *État* = « déplacé ».
5. Contrôle dans Drive : les documents sont dans les nouveaux dossiers ; les anciens dossiers (Fiches, Quitus…) sont vides mais toujours là. Un lien envoyé avant la migration ouvre toujours le document (c'est le même fichier).
6. **Essai du retour arrière** : ▶ **`annulerMigration`** → les documents reviennent dans leurs anciens dossiers (« remis en place »). Puis refais 1 à 4.

### Sortir du mode test

La copie d'essai est **toujours** en mode test : il suffit de ne plus l'utiliser. Supprime l'icône « Loué ESSAI » quand tout est vert.
Si tu as utilisé le **vrai site** avec `?env=test` (étape A.11), repasse-le en `?env=prod` sur chaque appareil, comme au lot 0.

---

## Étape D — Production (après ton feu vert sur l'étape C, 20 min)

Choisis un moment calme (le soir) : **demande aux gars d'envoyer leurs fiches en cours avant** (leurs brouillons sont repris automatiquement, mais une fiche envoyée est plus sûre).

1. Ouvre le **vrai** Sheet « ChantierPro » → Extensions → Apps Script.
2. **Sauvegarde** : tout le contenu de `Code.gs` dans `_prive/Code-avant-lot1.gs` sur ton PC (c'est le retour arrière).
3. Colle le `Code.gs` de `A-COLLER-DANS-APPS-SCRIPT` (même méthode qu'à l'étape A.4–A.5), enregistre.
4. ▶ `verifierConfig` → que des ✅ et « dossiers.json créé » ; ▶ `installerDeclencheurs`.
5. **Déployer → Gérer les déploiements** → ton déploiement de production → ✏ Modifier → **Nouvelle version** → Déployer.
6. Ouvre l'adresse de production (`URL_PRODUCTION` de `commun/config.js`) → **`Loué App API v5.0 OK`**. Sinon : Nouveau déploiement, envoie-moi l'adresse, et **n'avance pas** tant que je n'ai pas mis `config.js` à jour.
7. Avec les pages **actuelles** (pas encore le lot 1), envoie un quitus réel simple vers toi : mail reçu. Les gars peuvent continuer à travailler normalement.
8. Fusionne la demande de fusion **`livraison/lot-1`** que je t'envoie. Attends 3 minutes.
9. Sur ton téléphone, ouvre la vraie appli : pas de bandeau rouge ; « À propos » affiche la version **5.0**. Envoie un quitus réel vers toi : « ✓ Tout est envoyé » et mail reçu ; le PDF est dans `05 - CHANTIER/OPR - RESERVES - QUITUS` du chantier.
10. Sur **chaque iPhone** des gars : ouvre l'appli dans Safari et suis l'écran « Installer l'appli » (une seule fois). Sur Android, c'est conseillé aussi.

## Étape E — Ranger les anciens documents dans le vrai Drive (20 min)

C'est la seule étape qui touche à tes vrais dossiers. Elle se défait avec `annulerMigration`.
1. ▶ **`planMigration`** (rien n'est déplacé).
2. **Sauvegarde** : dans le Sheet, onglet « Migration (lot 1) » → Fichier → Télécharger → **CSV** → range-le dans `_prive/migration-avant-lot1.csv`. Fais pareil pour l'onglet « Dossiers chantiers ».
3. Vérifie les deux onglets comme sur TEST (lignes « OUI — vérifiez », lignes à IGNORER). En cas de doute, envoie-moi une capture.
4. ▶ **`executerMigration`**, relance tant qu'il en reste.
5. Contrôle sur ton PC (G:\Mon Drive) et sur un téléphone : tuile Chantiers → un chantier → Plans s'ouvre toujours.
6. Les anciens dossiers vides restent en place. Je te donnerai une fonction pour les mettre à la corbeille après ton accord (réversible 30 jours).

---

## Retour arrière (si quelque chose ne va pas)

| Problème | Que faire |
|---|---|
| Les pages du lot 1 posent problème | **Préviens-moi** : je te prépare en quelques minutes une demande de fusion « retour arrière » qui remet les anciennes pages **et** un service worker de secours (`outils/sw-secours.js`) : chaque téléphone supprime ses copies et reprend les anciennes pages. Les brouillons et fiches en attente ne sont pas effacés. Tu n'as qu'à la fusionner. Le serveur v5 accepte les anciennes pages : pas besoin de le toucher. (Le bouton **Revert** de GitHub seul ne suffit pas : il ne remet pas le service worker de secours.) |
| Le serveur v5 pose problème | Recolle `_prive/Code-avant-lot1.gs` dans `Code.gs`, enregistre, **Gérer les déploiements → Nouvelle version**. ⚠ Les pages du lot 1 ne marchent qu'avec le serveur v5 : fais d'abord le retour arrière des pages (ligne au-dessus). |
| Le rangement Drive ne te plaît pas | ▶ `annulerMigration` (relancer tant qu'il en reste) : chaque document revient dans son ancien dossier. Pour les nouveaux documents, change les noms dans `dossiers.json`. |
| Un document est rangé dans le mauvais chantier | Onglet « Dossiers chantiers » : corrige l'identifiant du dossier (colonne C) de la ligne du chantier, puis déplace le document à la main dans Drive. |

## Ce que tu dois faire, en résumé

- [ ] A — coller le serveur sur TEST, vérifier `v5.0`, vérifier les pages actuelles avec `?env=test`.
- [ ] B — ouvrir et installer la copie d'essai.
- [ ] C — les 18 essais + la migration sur TEST (avec son retour arrière).
- [ ] D — serveur de production, puis fusion de `livraison/lot-1`, puis installation sur les iPhone des gars.
- [ ] E — migration du vrai Drive, après sauvegarde CSV.
