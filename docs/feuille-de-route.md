# Feuille de route — mercredi 18/11/2026

> Tes actions, dans l'ordre, avec le temps estimé. Cette nuit, rien n'a été fait sur la copie TEST ni en production, et aucun mail n'est parti. Ton dossier principal est resté sur la branche `lot-5`.

## Où en est chaque lot

| Lot | Branche | État au 18/11 |
|---|---|---|
| **5** (stockage, purges) | `main` | **en production** (pages fusionnées le 17/11) |
| **4c** (programme du PC) + retouche « ignorer » | `lot-5` (ton dossier) | prêt pour tes étapes 3 à 5 aujourd'hui |
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

## 1. Le 4c sur un vrai chantier (45 min, quand tu veux)

Depuis ton dossier principal, comme prévu (`docs/lot4c-procedure.md`, étapes 3 à 5). La ligne `"ignorer"` est déjà dans ton `depot.json`.

- **Nouveau** : pour que le 345, « TEST CHANTIER » et « essai » ne reviennent plus dans « A VOIR », ajoute dans `_prive\depot.json` la ligne :
  ```
  "ignorer": ["345", "TEST CHANTIER", "essai"],
  ```
  Attention à la virgule en fin de ligne, sauf si c'est la dernière avant `}`. Le mode d'emploi est dans la procédure (paragraphe « Un dossier du Drive à laisser de côté »).
- Un chantier ignoré n'a plus de relevé du PC : la purge « Chantier terminé » ne lui sera donc pas proposée.

## 2. Le lot 8 sur la copie TEST (30 min pour toi, en deux fois)

| # | Qui | Quoi | Temps |
|---|---|---|---|
| 1 | moi | préparer le dossier pour l'envoi et te le **confirmer par écrit** (« dossier prêt, branche lot-8, serveur v11.1 ») | 5 min |
| 2 | toi | **seulement après ma confirmation** : `node outils\envoyer-test.js --avec-porte` ; version affichée **v11.1** ; me dire « envoi fait » | 2 min |
| 3 | moi | installation sur TEST, essais réels (deux notes au même instant ; **3 mails, tous à ton adresse**) | 30 min, sans toi |
| 4 | toi, téléphone | les 13 essais de l'étape B de `docs/lot8-procedure.md` | 20 min |

Envoi depuis le dossier `C:\Users\pavageauf\Documents\GitHub\chantier-pro-lot8` (ta décision du 18/11) : **dossier prêt, confirmé le 18/11**.

## 2 bis. Le lot 5c sur la copie TEST, puis en production (30 min pour toi)

Après tes essais du lot 8 sur la copie TEST (elle ne porte qu'un lot à la fois). Détail : `docs/lot5c-procedure.md` (branche `lot-5c`).
- Envoi `--avec-porte` depuis le dossier `chantier-pro-lot5c`, **après ma confirmation écrite** ;
- tes essais : ouvrir un planning sur **Android et iPhone** (deux touchers) ; déconnecté, il ne s'affiche plus ; dans Drive, « Accès limité » ;
- production : `--sans-porte`, coller `Code.gs` (v10.1), nouveau déploiement, me donner l'adresse, fusion ;
- avant la production : que chaque poseur qui lit le planning ait un compte (sans compte, il ne le voit plus).

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
