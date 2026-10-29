# Lot 0 — Sécurité urgente : procédure de déploiement et de test

> Pour Franck. Durée totale : environ 1 h 30, en 4 étapes. **Ne passe à l'étape suivante que si la précédente est verte.**
> Les identifiants (dossiers, Sheet) sont dans `_prive/` : `ids-drive.txt` et `ids-test.txt`.

## Ce que le lot 0 change, en bref

| Pour qui | Avant | Après |
|---|---|---|
| Tes destinataires (clients, archis, bureau) | PDF en pièce jointe | **Identique** |
| Les gars, sur les fiches de saisie | Remplir, signer, envoyer | **Identique** |
| Les gars, tuile *Chantiers* | 8 onglets (Accès, Plans, CCTP…) | **Seulement « Plans »** (les autres reviennent avec le carnet, lot 4) |
| Une adresse tapée à la main (pas dans le Sheet) | Recevait n'importe quel mail | Reçoit un mail **au texte imposé** + le PDF ; 2 par fiche, 10 par jour ; le conducteur du chantier (ou toi) en **copie cachée** ; noté dans l'onglet **Journal** |
| Quelqu'un qui connaît l'adresse Apps Script | Pouvait envoyer des mails à n'importe qui au nom de Loué | Ne peut plus (voir ligne au-dessus) |
| Fichiers Drive des dossiers Accès, CCTP, Sécurité, Fiches, Quitus… | Partagés « tous ceux qui ont le lien » | **Accès limité** (Plans et Planning restent partagés) |
| Fin de journée chargée (quota de 100 mails presque atteint) | Mails perdus sans rien dire | Mails **reportés** (onglet « Mails en attente ») et renvoyés toutes les 2 h ; tes mails à toi passent toujours |

⚠️ **À savoir** : une note de réunion envoyée à **plus de 2 adresses qui ne sont pas dans le Sheet** n'en servira que 2. Pour un externe régulier (archi, BET, client), **ajoute-le une fois pour toutes dans l'onglet *Contacts notes*** (colonne A : nom, colonne B : adresse) : il reçoit alors le mail normal, sans limite.

Le relais de mails est fermé. **La liste des contacts reste lisible** par quelqu'un qui connaît l'adresse, jusqu'au lot 2 (connexion) : les pages actuelles en ont besoin.

---

## Étape A — Mettre les pages sur GitHub (sans effet visible)

Les 10 pages lisent désormais l'adresse Apps Script dans **un seul fichier**, `commun/config.js`. En production, rien ne change : même adresse, même comportement (vérifié page par page). Cette étape est nécessaire pour pouvoir tester avec `?env=test`.

**Option 1 (recommandée) : fusion en un clic.** Je prépare sur GitHub une branche `livraison/lot-0` avec seulement ce lot, et une « demande de fusion » (pull request).
1. Ouvre le lien de la demande de fusion que je t'envoie.
2. Clique le bouton vert **Merge pull request**, puis **Confirm merge**.
3. Attends 1 à 2 minutes (GitHub Pages republie le site).

**Option 2 : upload manuel.**
1. Sur github.com, dans le dépôt `chantier-pro`, branche `main` : **Add file → Upload files**.
2. Glisse **le dossier `commun`** (il contient `config.js`) et les 10 pages : `index.html`, `cotes.html`, `fiche-fabrication.html`, `note-reunion.html`, `bordereau-orga.html`, `bordereau-materiaux.html`, `quitus.html`, `attestation.html`, `reception-support.html`, `absence.html`. Ajoute aussi `CLAUDE.md`.
3. En bas : « Commit changes ».

**Vérification A** :
1. Sur ton téléphone, ouvre l'appli comme d'habitude. Ouvre « Chantiers » : la liste s'affiche.
2. Ouvre un chantier : seul l'onglet **Plans** apparaît, et un plan s'ouvre.
3. Envoie **une** fiche réelle simple (un quitus vers toi) : tu reçois le mail comme avant.

---

## Étape B — Préparer la copie TEST (une seule fois)

1. Ouvre le Sheet **« ChantierPro TEST »** → menu **Extensions → Apps Script**.
2. Dans l'éditeur, clique sur `Code.gs` à gauche. Sélectionne tout (Ctrl+A), supprime, puis colle **tout** le contenu de `apps-script/Code.gs` du dépôt. Enregistre (icône disquette).
3. **Propriétés du script** : clique ⚙ **Paramètres du projet** (à gauche), descends jusqu'à « Propriétés du script » → **Ajouter une propriété du script**, et crée :

   | Propriété | Valeur |
   |---|---|
   | `DRIVE_ROOT_ID` | identifiant du dossier **CHANTIERPRO-TEST** (dans `_prive/ids-test.txt`, la partie après `folders/`) |
   | `DRIVE_PLANNING_ID` | crée dans CHANTIERPRO-TEST un dossier **Planning TEST**, ouvre-le, copie la partie de l'adresse après `folders/` |
   | `EMAIL_ADMIN` | ton adresse Gmail |
   | `ENVIRONNEMENT` | `TEST` |

   Clique **Enregistrer les propriétés du script**.
4. Retour à l'éditeur (icône `< >`). En haut, dans la liste des fonctions, choisis **`verifierConfig`** puis **▶ Exécuter**.
   - Google demande une autorisation : **Examiner les autorisations** → ton compte → écran « Google n'a pas validé cette application » → **Paramètres avancés** → **Accéder à … (non sécurisé)** → **Autoriser**. C'est normal : c'est ton propre script.
   - En bas, le « Journal d'exécution » affiche des ✅. Un ❌ = me prévenir avec une capture.
5. Choisis **`anonymiserCopieTest`** → ▶ Exécuter. Le journal dit « N adresse(s) remplacée(s) ». Désormais, tous les mails du TEST arrivent dans **ta** boîte (`tonadresse+contact1@gmail.com`, etc.).
6. Choisis **`installerDeclencheurs`** → ▶ Exécuter (renvoi automatique des mails reportés toutes les 2 h).
7. **Déployer** (bouton bleu en haut à droite) → **Nouveau déploiement** → roue ⚙ → **Application Web** :
   - Description : `lot 0`
   - Exécuter en tant que : **Moi**
   - Qui peut accéder : **Tout le monde**
   - **Déployer**, puis **copie l'URL** (elle finit par `/exec`).
8. **Envoie-moi cette URL.** Je la mets dans `commun/config.js` (ligne `URL_TEST`) et je te redonne le fichier (ou une nouvelle demande de fusion). Tu l'uploades comme à l'étape A.
9. Vérification : ouvre l'URL dans un navigateur → la page affiche **`Loué App API v4.1 OK`**.

---

## Étape C — Tester chaque fiche sur TEST

Sur ton téléphone, ouvre l'appli en ajoutant **`?env=test`** à l'adresse (exemple : `https://chantiersloue.github.io/chantier-pro/?env=test`).
- Un **bandeau rouge « MODE TEST »** apparaît en bas de toutes les pages : tu es sur la copie TEST.
- Pour revenir à la vraie appli : même adresse avec **`?env=prod`** (le bandeau disparaît).

Pour chaque ligne : remplis la fiche **avec une signature et une photo** quand la fiche en a, envoie, puis coche.

| # | Fiche | À faire | Résultat attendu (dans ta boîte Gmail) | ✔ |
|---|---|---|---|---|
| 1 | Prise de cotes | 2 lignes, un conducteur | 1 mail « Prise de cotes », PDF identique à avant | ☐ |
| 2 | Fabrication | 1 bloc divers + 1 bloc porte, commentaire en **gras rouge** | 2 mails (atelier + conducteur), PDF avec la mise en forme | ☐ |
| 3 | Note de réunion | 2 destinataires de la liste + 1 photo | 1 mail par destinataire, PDF avec photo | ☐ |
| 4 | Bordereau orga | 2 signatures, 1 photo | mail + PDF rangé dans le dossier **Bordereaux** du chantier TEST | ☐ |
| 5 | Bordereau matériaux | idem | idem | ☐ |
| 6 | Quitus | 2 signatures, Soldé OUI | mail + PDF | ☐ |
| 7 | Attestation | type « Mise en œuvre », 1 photo, signature | mail au conducteur du chantier | ☐ |
| 8 | Réception support | quelques points OK / NOK, signature | mail au conducteur | ☐ |
| 9 | Absence | une demi-journée, signature | mail aux personnes « absenceNotif » | ☐ |
| 10 | **Adresse libre** | un quitus avec, en plus, **une adresse tapée à la main** (ton autre adresse, ou celle d'un proche prévenu) | cette adresse reçoit « Loué Menuiserie — Quitus — <chantier> » au **texte imposé** + PDF ; **toi** (ou le conducteur TEST) en copie cachée ; une ligne « envoyé » dans l'onglet **Journal** du Sheet TEST | ☐ |
| 11 | **3 adresses libres** | une note avec **3** adresses tapées à la main | 2 reçoivent, la 3ᵉ est « refusé » dans le *Journal* ; tu reçois **un** mail « Envoi refusé — voir l'onglet Journal » | ☐ |
| 12 | Chantiers | ouvre un chantier TEST dans la tuile Chantiers | seul « Plans » s'affiche | ☐ |

**Le test « pirate »** (ligne 11) prouve que le relais est fermé : quelqu'un d'autre ne pourrait pas faire mieux que ces 2 adresses, au texte imposé, avec toi en copie.

Ensuite, partages sur TEST (dans l'éditeur Apps Script du TEST) :
1. **`listerPartages`** → ▶. Si le journal dit « À suivre », relance jusqu'à « Liste terminée ».
2. Regarde l'onglet **« Partages (lot 0) »** du Sheet TEST : colonne *Décision* = « garder » pour Plans et Planning, « à retirer » pour le reste.
3. **`retirerPartages`** → ▶. Colonne *État* = « retiré le … ».
4. Contrôle : copie l'adresse d'un fichier « retiré » et ouvre-la dans une **fenêtre de navigation privée** → « Accès refusé ». Un fichier de *Plans* s'ouvre toujours.
5. Essai du retour arrière : **`remettrePartages`** → ▶, vérifie que le fichier s'ouvre à nouveau, puis relance **`retirerPartages`**.

**Si une ligne n'est pas verte : arrête-toi et envoie-moi une capture.** Je corrige en priorité.

---

## Étape D — Production (après ton feu vert sur l'étape C)

1. Ouvre le **vrai** Sheet « ChantierPro » → Extensions → Apps Script.
2. **Sauvegarde** : sélectionne tout le contenu de `Code.gs`, copie-le dans un fichier texte `_prive/Code-avant-lot0.gs` sur ton PC (retour arrière possible).
3. Colle le nouveau `Code.gs` (tout remplacer), enregistre.
4. Propriétés du script (⚙) : `DRIVE_ROOT_ID` et `DRIVE_PLANNING_ID` = valeurs de **production** de `_prive/ids-drive.txt`, `EMAIL_ADMIN` = ton adresse. **Ne mets pas** `ENVIRONNEMENT`.
5. ▶ `verifierConfig` (autoriser comme à l'étape B) → que des ✅ sauf « Déclencheur » ; ▶ `installerDeclencheurs` ; ▶ `verifierConfig` → tout ✅.
6. **Déployer → Gérer les déploiements** → ton déploiement actuel → ✏ **Modifier** → Version : **Nouvelle version** → **Déployer**. L'adresse ne change pas.
7. **Vérifie la version** : ouvre l'adresse de production (celle de `commun/config.js`, `URL_PRODUCTION`) dans un navigateur → **`Loué App API v4.1 OK`**. Si tu vois encore « v4 OK » : la mise à jour n'a pas été prise (règle 2 de CLAUDE.md). Fais alors **Nouveau déploiement**, envoie-moi la nouvelle adresse, je mets à jour `config.js`.
8. Envoie une fiche réelle simple vers toi : mail reçu.
9. **Partages réels** (c'est l'étape irréversible-mais-réparable) :
   1. ▶ `listerPartages` (relancer jusqu'à « Liste terminée ») ;
   2. **Sauvegarde** : dans le Sheet, onglet « Partages (lot 0) » → Fichier → Télécharger → **CSV** → range le fichier dans `_prive/partages-avant-lot0.csv` ;
   3. relis la colonne *Décision* (rien d'important marqué « à retirer » par erreur ?) ;
   4. ▶ `retirerPartages` (relancer si « restant(s) ») ;
   5. contrôle en navigation privée comme sur TEST.
   En cas de problème : ▶ `remettrePartages` remet tout comme avant.

**Retour arrière complet** : recolle `_prive/Code-avant-lot0.gs`, Nouvelle version, et `remettrePartages` si besoin. Les pages de l'étape A n'ont pas besoin d'être retirées (elles marchent avec l'ancien et le nouveau serveur).

---

## Après le lot 0 : où regarder

| Onglet du Sheet | À quoi il sert |
|---|---|
| **Journal** | chaque envoi vers une adresse tapée à la main, chaque refus, chaque mail reporté |
| **Mails en attente** | les mails reportés (quota) : statut « envoyé » ou « abandonné » après 12 essais |
| **Partages (lot 0)** | ce qui était partagé avant le lot 0, et ce qui a été retiré |

**Réglages** (en haut de `Code.gs`, si tu veux les changer un jour) : `MAX_LIBRES_PAR_FICHE` (2), `MAX_LIBRES_PAR_JOUR` (10), `RESERVE_ADMIN` (20).
