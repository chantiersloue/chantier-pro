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
- **Demande de fusion `livraison/lot-1-essai-2`** (retouches R1 à R3) : met à jour la copie d'essai et `Code.gs` (v5.1). Le vrai site n'est pas touché.
- **Demande de fusion `livraison/lot-1`** (étape D) : les vraies pages du lot 1, **retouches comprises** ; elle retire le dossier `essai/`.

Pourquoi une copie d'essai ? Les nouvelles pages parlent au serveur v5. Mises en ligne avant la mise à jour du serveur de production, elles casseraient l'appli des gars. La copie d'essai permet de tout tester sans risque.

---

## Retouches après tes essais (R1, R2, R3) — à faire AVANT l'étape D (45 min)

> Tes essais 1 à 16 et 18 sont validés. Tu as demandé 3 retouches. Elles sont prêtes dans la demande de fusion **`livraison/lot-1-essai-2`** (copie d'essai mise à jour, nouveau `Code.gs` **v5.1**).
> **Ordre : colle le nouveau serveur (R-A) juste après la fusion, avant tout essai.** Une page neuve qui parlerait à l'ancien serveur perdrait la liste « Matériaux remis » sans rien dire (sur la copie d'essai, sans gravité). En production (étape D), c'est l'inverse qui est imposé : serveur d'abord, pages ensuite.

| Retouche | Ce qui change |
|---|---|
| **R1 — Photos et croquis en grand** | Dans le PDF (aperçu et mail), la 1re photo se place **sur la page 1, sous la fiche**, et prend **toute la place restante** (proportions gardées). Chaque **croquis a une page entière** (croquis dessiné dans l'appli, ou photo dont la légende contient « croquis » : dis-moi si ça te va). Les autres photos ont leur page : deux par page seulement si elles y restent presque aussi grandes. Même logique pour le quitus, les bordereaux, l'attestation, la note de réunion et la réception support. ⚠ Quitus, bordereaux et attestation : les **signatures passent avant les photos** (sinon une grande photo les repoussait en page 2) : dis-moi si ça te va. Les croquis sont dessinés en résolution double (plus nets en grand). |
| **R2 — Matériaux par défaut** | Nouvel onglet **« Matériaux bordereau »** dans le Sheet : **une ligne par matériau**, colonne A le **Type**, B le **Matériau**, C la **Quantité**. Dans le bordereau matériaux, le champ Type propose ces types ; en choisir un remplit la case **« Matériaux remis »**, que le poseur peut modifier. Elle apparaît dans le PDF. Si tu ne remplis que la colonne A, c'est simplement ta liste de types (rien ne se remplit). |
| **R3 — Sablier** | Cause : le serveur avait bien reçu la fiche (le mail était parti), mais sa réponse s'était perdue, en général parce que l'appli était passée en arrière-plan pour aller voir le mail. L'appli attendait jusqu'à 5 minutes avant de redemander. Maintenant elle redemande au bout de 15 s, et **tout de suite quand on revient dans l'appli** : le serveur répond « déjà reçue » et le sablier disparaît. **Jamais de 2e mail** : une fiche garde le même numéro à chaque renvoi, et le serveur ne la traite qu'une fois. |

### R-A — Serveur v5.1 sur la copie TEST (15 min)
1. Fusionne la demande de fusion **`livraison/lot-1-essai-2`** (bouton vert **Merge pull request**, puis **Confirm merge**). Garde avant cela une fiche ouverte dans l'appli d'essai de ton téléphone : elle servira à l'essai 17 (R-D).
2. Sheet **« ChantierPro TEST »** → **Extensions → Apps Script**.
3. **Sauvegarde** : `Code.gs` → Ctrl+A, Ctrl+C → colle dans `_prive/Code-TEST-avant-retouches.gs` sur ton PC.
4. Sur github.com : dossier **`A-COLLER-DANS-APPS-SCRIPT`** → **`Code.gs`** → icône **« Copy raw file »**. Dans l'éditeur : Ctrl+A, Ctrl+V, **disquette**.
5. ▶ **`verifierConfig`** : le journal affiche **`Loué App API v5.1`**, des ✅, et **« Onglet « Matériaux bordereau » créé (vide) »**.
6. **Déployer → Gérer les déploiements** → déploiement TEST → ✏ **Modifier** → **Nouvelle version** → **Déployer**.
7. Ouvre l'adresse TEST (qui finit par `/exec`) : **`Loué App API v5.1 OK`**. Si tu vois encore `v5.0` : **Nouveau déploiement**, envoie-moi la nouvelle adresse.

### R-B — Essai de mise en page par Google (5 min, aucun mail)
L'aperçu de l'appli est fabriqué par ton navigateur, le PDF du mail par Google. Ils sont très proches, mais je n'ai pas pu mesurer le moteur de Google moi-même.
1. Dans l'éditeur Apps Script TEST : ▶ **`essaiMiseEnPage`**.
2. **Copie le journal et envoie-le-moi** (3 lignes « fabrication / quitus / bordereau » avec un format en mm et un nombre de pages).
3. Ouvre les 3 PDF **« _ESSAI MISE EN PAGE … »** à la racine du dossier CHANTIERPRO-TEST :
   - fabrication : la photo sous le tableau, le croquis seul sur la page 2 ;
   - quitus : une photo en page 1 sous les signatures, deux photos en page 2.
   Puis mets-les à la corbeille.
4. Une ligne commence par ⚠ : le contrôle automatique a corrigé (la photo est passée sur une page à elle). Ce n'est pas bloquant, mais envoie-moi le journal pour que je règle l'estimation.

### R-C — Remplir l'onglet « Matériaux bordereau » sur TEST (5 min)
Exemple (fictif) : une ligne `KIT POSE FENETRE | VIS INOX 4X40 | 20`, une ligne `KIT POSE FENETRE | MOUSSE | 1`, une ligne `CLES DE CHANTIER` (colonne A seule).

### R-D — Pages : essai 17 et essais des retouches (20 min)
| # | À faire | Résultat attendu | ✔ |
|---|---|---|---|
| 17 | **Mise à jour** : la fiche gardée ouverte à l'étape R-A.1 ; reviens dessus quelques minutes après la fusion | bandeau **« Nouvelle version — Mettre à jour »** ; touche-le : la page se recharge, le brouillon est gardé ; « À propos » affiche **5.1** | ☐ |
| R1-a | Fabrication : 1 bloc de 2 lignes, **1 photo** et **1 croquis**, Aperçu, puis Envoyer | page 1 : la photo sous le tableau, en grand ; page 2 : le croquis en pleine page ; le PDF du mail est pareil | ☐ |
| R1-a2 | Fabrication : photographie un croquis sur papier avec « Photo d'un croquis » et écris **croquis** dans sa légende | ce croquis a sa page entière | ☐ |
| R1-b | Quitus avec **3 photos** et 2 signatures | page 1 : signatures puis une photo en grand ; page 2 : les deux autres | ☐ |
| R1-c | Attestation ou bordereau avec 1 photo | la photo sous les signatures, en grand, sur la page 1 | ☐ |
| R2 | Bordereau **matériaux** : Type « KIT POSE FENETRE » | « Matériaux remis » se remplit (20 × VIS INOX 4X40, 1 × MOUSSE). Modifie une ligne, change de Type : ta modification reste, et un bouton « Remplacer par la liste du type » apparaît. Ferme la page et rouvre-la : brouillon restauré avec la liste. Envoie : la liste est dans le PDF | ☐ |
| R3-a | Avec du réseau, envoie un quitus et passe **tout de suite** dans Gmail ; reviens dans l'appli quand le mail est arrivé | le sablier disparaît dans les secondes qui suivent ton retour, sans rien toucher ; **un seul mail** | ☐ |
| R3-b | Refais les essais **12 et 13** (mode avion, puis retour du réseau) | « ✓ Tout est envoyé » sans toucher Envoyer ; un seul mail | ☐ |

### Si une retouche pose problème (retour arrière)
- **Serveur** : recolle `_prive/Code-TEST-avant-retouches.gs`, enregistre, **Gérer les déploiements → Nouvelle version**. ⚠ La copie d'essai mise à jour attend le serveur v5.1 : préviens-moi, je te prépare le retour arrière de `essai/` (une demande de fusion).
- **Pages** : préviens-moi ; je prépare une demande de fusion qui remet l'ancienne copie d'essai. (Le bouton **Revert** de GitHub marche aussi pour la copie d'essai.)

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
11. **Les pages actuelles marchent avec le serveur v5** (indispensable avant l'étape D) : sur le **vrai site** avec `?env=test` (`https://chantiersloue.github.io/chantier-pro/?env=test`), envoie vers toi **un quitus**, **une attestation avec une photo** et **une fiche de fabrication** → 3 mails reçus, PDF complets. Puis repasse en `?env=prod`.

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
3. Colle le `Code.gs` de `A-COLLER-DANS-APPS-SCRIPT` (même méthode qu'à l'étape A.4–A.5 ; c'est la version **v5.1**, retouches comprises), enregistre.
4. ▶ `verifierConfig` → que des ✅, « dossiers.json créé » et « Onglet « Matériaux bordereau » créé » ; ▶ `installerDeclencheurs`. Recopie dans ce nouvel onglet les lignes que tu as validées sur TEST (R-C).
5. **Déployer → Gérer les déploiements** → ton déploiement de production → ✏ Modifier → **Nouvelle version** → Déployer.
6. Ouvre l'adresse de production (`URL_PRODUCTION` de `commun/config.js`) → **`Loué App API v5.1 OK`**. Sinon : Nouveau déploiement, envoie-moi l'adresse, et **n'avance pas** tant que je n'ai pas mis `config.js` à jour.
7. Avec les pages **actuelles** (pas encore le lot 1), envoie un quitus réel simple vers toi : mail reçu. Les gars peuvent continuer à travailler normalement.
8. **Dossier Drive de chaque chantier, AVANT les nouvelles pages** : ▶ **`planMigration`** (rien n'est déplacé). Ouvre l'onglet **« Dossiers chantiers »** du vrai Sheet :
   - chaque ligne **« OUI — vérifiez »** doit désigner le bon dossier : ouvre le dossier dans Drive par son identifiant (colonne C) ; si ce n'est pas le bon, remplace l'identifiant ;
   - le journal liste les chantiers **sans dossier retenu**. Si l'un d'eux a déjà un dossier dans Drive sous un autre nom, ajoute une ligne : colonne A le nom du chantier **exactement comme dans l'onglet Chantiers**, colonne C l'identifiant du dossier (ouvre le dossier dans Drive : c'est la fin de l'adresse, après `folders/`). Sinon la tuile Chantiers n'affichera pas ses Plans et le premier document créera un nouveau dossier.
9. Fusionne la demande de fusion **`livraison/lot-1`** que je t'envoie. Attends 3 minutes.
10. Sur ton téléphone, ouvre la vraie appli : pas de bandeau rouge ; « À propos » affiche la version **5.1**. Envoie un quitus réel vers toi : « ✓ Tout est envoyé » et mail reçu ; le PDF est dans `05 - CHANTIER/OPR - RESERVES - QUITUS` du chantier.
11. Sur **chaque iPhone** des gars : ouvre l'appli dans Safari et suis l'écran « Installer l'appli » (une seule fois). Sur Android, c'est conseillé aussi.

## Étape E — Ranger les anciens documents dans le vrai Drive (20 min)

C'est la seule étape qui touche à tes vrais dossiers. Elle se défait avec `annulerMigration`.
Choisis le soir ou un moment où personne n'envoie de fiche : pendant `executerMigration` (jusqu'à 5 min), les fiches continuent d'arriver, mais le Drive est très sollicité.
1. ▶ **`planMigration`** de nouveau (rien n'est déplacé), pour avoir la liste à jour.
2. **Sauvegarde** : onglet « Dossiers chantiers » → Fichier → Télécharger → **CSV** → `_prive/dossiers-chantiers-lot1.csv`.
3. Vérifie les deux onglets comme sur TEST (lignes « OUI — vérifiez », lignes à IGNORER). En cas de doute, envoie-moi une capture.
4. ▶ **`executerMigration`**, relance tant qu'il en reste. Puis **sauvegarde** l'onglet « Migration (lot 1) » en CSV (`_prive/migration-lot1-faite.csv`) : c'est la liste exacte de ce qui a bougé, celle dont `annulerMigration` a besoin. **Ne relance plus `planMigration`** ensuite (elle refuse de toute façon tant que cet onglet contient des documents déplacés).
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
- [ ] C — les 18 essais + la migration sur TEST (avec son retour arrière). *(Fait, sauf l'essai 17.)*
- [ ] Retouches — R-A serveur v5.1 sur TEST, R-B `essaiMiseEnPage` (m'envoyer le journal), R-C onglet « Matériaux bordereau », R-D essai 17 et essais des retouches.
- [ ] D — serveur de production, puis fusion de `livraison/lot-1`, puis installation sur les iPhone des gars.
- [ ] E — migration du vrai Drive, après sauvegarde CSV.
