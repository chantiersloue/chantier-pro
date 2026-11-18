# Feuille de route — mercredi 18/11/2026

> Tes actions, dans l'ordre, avec le temps estimé. Cette nuit, rien n'a été fait sur la copie TEST ni en production, et aucun mail n'est parti. Ton dossier principal est resté sur la branche `lot-5`.

## Où en est chaque lot

| Lot | Branche | État au 18/11 |
|---|---|---|
| **5** (stockage, purges) | `main` | **en production** (pages fusionnées le 17/11) |
| **4c** (programme du PC) + retouche « ignorer » | `lot-5` (ton dossier) | **en service depuis le 18/11** : premier chantier (403) recopié, tâche automatique installée, passage de 17 h 42 réussi |
| **5c** planning lisible par les seuls comptes, serveur v10.1, appli 9.1 | `lot-5c` (part de la production) | **nouveau (18/11)**, construit et testé, en relecture indépendante. **À mettre en production avant le lot 8** |
| **8** (note de réunion en points), serveur v11.1, appli 10.2 | `lot-8` | construit, relu, corrigé. **À essayer sur la copie TEST** |
| **10a-1** « À commander », serveur v11.2, appli 10.3 | `lot-10a1` (contient le lot 8) | construit, relu une fois (rien de bloquant), corrigé ; « Précision (facultative) ». Testé contre le faux serveur et dans Chrome à 375 px |
| **10a-2** boutons appris, propositions, onglet *Articles*, serveur v11.3, appli 10.4 | `lot-10a2` (contient 10a-1) | construit, testé contre le faux serveur et dans Chrome (25 séries vertes). Pas de relecture indépendante (ta règle) |
| **10b** mail du vendredi, serveur v11.4 | `lot-10b` (contient 10a-2) | construit, testé (26 séries vertes). Pas de relecture indépendante. **Le mail ne part qu'après `demarrerPointDuVendredi()`**, lancé une fois par toi dans l'éditeur (`arreterPointDuVendredi()` pour l'arrêter) |
| **Mail unique** (lot 5b), serveur v11.2, appli 10.3 | `lot-5b` | construit sur l'ancien `lot-8`, **pas encore relu** ; livré éteint. À remettre à la suite du lot 10 |
| **11** planning, heures, atelier | — | étude écrite : `_prive\etudes\lot11-etude.md` (hors du dépôt public) |

## L'ordre de mise en production (le tien)

**5c → lot 8 → 10a-1 → 10a-2 → 10b → mail unique**, une mise en production à la fois, un jour d'écart au moins.

Le 5c part de la production : une fois en production, **je le reporte dans `lot-8`, `lot-10a1`, `lot-10a2`, `lot-10b` et `lot-5b`** avant leurs propres mises en production, pour qu'aucune ne remette l'ancien partage par lien.

Pourquoi cet ordre évite les conflits dans `Code.gs` : chaque branche part de la précédente (`lot-8` → `lot-10a1` → `lot-10a2` → `lot-10b`), donc chaque `Code.gs` contient tout ce qui a été mis en production avant lui. Le mail unique est parti de l'ancien `lot-8` : **avant sa mise en service, je le remets à jour sur `lot-10b`** et je le fais relire (changement sur l'envoi des mails).

La copie TEST ne porte **qu'un lot à la fois** : on les essaie dans le même ordre.

## 1. Le 4c — en service depuis le 18/11

Fait le 18/11 : essais 6 et 7 sur le 403, premier passage (13 fiches), numérotation déclarée (ancienne : 009 → 152), plan de signalétique au carnet, tâche automatique installée, passage automatique de 17 h 42 réussi. `ignorer` : 345, TEST CHANTIER, essai, 000, 100.

**À faire, pour toi** : au **prochain bordereau du 403** (plans BAL, n° 108), refaire le **choix 6** du menu de `appli-pc` et **ajouter 108 → 108** à sa table.

## 2. Lot 8 et lot 5c : l'ordre des essais et des mises en production

Le 5c doit passer en production **avant** le lot 8, mais le lot 8 est déjà sur la copie TEST (envoi du 18/11, v11.1, empreinte 313ebbda57 ; installation et essais réels faits : 18 sur 19, voir plus bas). La copie TEST ne porte qu'un lot à la fois. D'où cet ordre, qui ne refait aucun envoi pour rien :

| # | Quand | Qui | Quoi |
|---|---|---|---|
| 1 | 19/11 matin | toi, téléphone | sur la copie d'essai (icône « Loué ESSAI », **encore l'ancienne version**) : commence une note de réunion sans l'envoyer, et mets une note **en attente** (mode avion, Envoyer). Dis-moi « prêt » |
| 2 | aussitôt | moi | je publie la copie d'essai avec les pages du lot 8 |
| 3 | 19/11 | toi, téléphone | les 13 essais de l'étape B de `docs/lot8-procedure.md` (20 min) |
| 4 | 19/11, après tes essais | moi, puis toi | je te confirme « dossier prêt, branche lot-5c, serveur v10.1 » ; tu lances `node outils\envoyer-test.js --avec-porte` **depuis le dossier `chantier-pro-lot5c`** (le serveur du lot 8 est alors remplacé sur TEST : c'est voulu) |
| 5 | aussitôt | moi | je publie la copie d'essai avec les pages du 5c ; je vérifie que les fichiers du planning de TEST sont redevenus privés |
| 6 | 19/11 | toi | tes essais du 5c (étape B de `docs/lot5c-procedure.md`, 10 min : Android **et** iPhone) |
| 7 | 19/11 ou 20/11 | toi | production du 5c (étape C) : `--sans-porte`, coller `Code.gs` v10.1, `fermerPartagesPlanning`, nouveau déploiement, me donner l'adresse, fusion, **archiver les anciens déploiements** |
| 8 | aussitôt | moi | je reporte le 5c dans `lot-8` (puis `lot-10a1`, `lot-10a2`, `lot-10b`, `lot-5b`), je relance les séries de tests, je te confirme le dossier |
| 9 | le lendemain | toi | production du lot 8 (étape C puis D de `docs/lot8-procedure.md`) : `--sans-porte` depuis `chantier-pro-lot8`, coller `Code.gs`, `installerLot8Production`, nouveau déploiement, fusion |

Les essais réels du lot 8 ne sont pas à refaire après le report du 5c : le 5c ne touche que la lecture du planning.

**Essais réels du lot 8 (18/11, faits sans toi)** : 18 vérifications sur 19. Le vrai verrou de Google marche (deux notes au même instant : aucune n'écrase l'autre) ; renvoi sans doublon ; gestes appliqués une fois ; onglet *Comptes rendus* propre à la fin. **Le seul écart** : le compteur de mails du compte a baissé de 6 au lieu de 3. Chaque note n'a qu'un destinataire (toi) ; le compteur est partagé avec la production, qui a pu envoyer des fiches pendant ces 2 minutes (vers 18 h). **Vérifie** : tu dois avoir reçu **exactement 3 mails** « compte rendu » du CHANTIER TEST AUTO le 18/11 vers 18 h. Dans un de leurs PDF, regarde le tableau des points (hauteur, rien ne déborde), puis supprime les 3 PDF du Drive de TEST.

## 3. Les lots 10a-1 et 10a-2 sur la copie TEST (après le lot 8 en production)

Détail dans `docs/lot10-procedure.md` (branche `lot-10a1`).
- Envoi sur TEST, installation (`installerLot10`), tes essais téléphone **dont le clavier ouvert, avec des gants**.
- Attendre **un vrai mail de 15 h 45** sur la copie TEST : il faut y poser les réveils automatiques pendant l'essai (je les retire ensuite : ils partagent les 90 minutes par jour avec la production).
- Production : coller `Code.gs`, `installerLot10Production`, `verifierConfig`, nouveau déploiement, me donner l'adresse, fusion.

## 4. Tes décisions

Toutes prises le 18/11 : lot 8 envoyé depuis `chantier-pro-lot8` ; les trois écarts du 10a-1 et « Précision (facultative) » ; les deux choix du 10b ; mode `conducteur` du mail unique ; planning corrigé tout de suite (lot 5c). Il reste :

1. **Lot 11**, quand tu veux : lire l'étude (`_prive\etudes\lot11-etude.md`), répondre à ses 40 questions (dont la 36 : scanne-moi le **verso** de la feuille d'heures, mercredi à vendredi), me donner les documents de son chapitre 11, et d'abord **obtenir l'accord de la direction**.

## 5. Essais qui restent à faire sur la copie TEST

- « Mails envoyés de plus de 3 mois » (possible à partir d'aujourd'hui) et « Anciens indices du carnet » : ne coche pas ces lignes en production avant.
- **iPhone** : `docs/essais-iphone.md`, 12 essais, avant la remise de l'appli aux poseurs.

## 6. Rappels en attente (aucun n'est urgent)

- `listerPartagesPlans` en production (lecture seule), puis le ménage des partages dans Drive : c'est toi qui les retires.
- Archiver les déploiements « Lot 3 — production » et « Lot 7 — production » (à partir du 20/11), « Lot 4 — production » à partir du 24/11.
- Lot 2 : `demarrerTransition` n'a pas été lancé en production.
- Copie TEST : supprimer les quatre onglets « … (ancienne version …) » ; CHANTIER TEST AUTO est resté à « Terminé ».
