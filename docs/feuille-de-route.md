# Feuille de route — mercredi 18/11/2026

> Tes actions, dans l'ordre, avec le temps estimé. Cette nuit, rien n'a été fait sur la copie TEST ni en production, et aucun mail n'est parti. Ton dossier principal est resté sur la branche `lot-5`.

## Où en est chaque lot

| Lot | Branche | État au 18/11 |
|---|---|---|
| **5** (stockage, purges) | `main` | **en production** (pages fusionnées le 17/11) |
| **4c** (programme du PC) + retouche « ignorer » | `lot-5` (ton dossier) | prêt pour tes étapes 3 à 5 aujourd'hui |
| **8** (note de réunion en points), serveur v11.1, appli 10.2 | `lot-8` | construit, relu, corrigé. **À essayer sur la copie TEST** |
| **10a-1** « À commander », serveur v11.2, appli 10.3 | `lot-10a1` (contient le lot 8) | construit, relu une fois (rien de bloquant), corrigé. Testé contre le faux serveur et dans Chrome à 375 px |
| **10a-2** boutons appris, propositions, onglet *Articles*, serveur v11.3, appli 10.4 | `lot-10a2` (contient 10a-1) | construit, testé contre le faux serveur et dans Chrome (25 séries vertes). Pas de relecture indépendante (ta règle) |
| **10b** mail du vendredi, serveur v11.4 | `lot-10b` (contient 10a-2) | construit, testé (26 séries vertes). Pas de relecture indépendante. **Le mail ne part qu'après `demarrerPointDuVendredi()`**, lancé une fois par toi dans l'éditeur (`arreterPointDuVendredi()` pour l'arrêter) |
| **Mail unique** (lot 5b), serveur v11.2, appli 10.3 | `lot-5b` | construit sur l'ancien `lot-8`, **pas encore relu** ; livré éteint. À remettre à la suite du lot 10 |
| **11** planning, heures, atelier | — | étude écrite : `_prive\etudes\lot11-etude.md` (hors du dépôt public) |

## L'ordre de mise en production (le tien)

**lot 8 → 10a-1 → 10a-2 → 10b → mail unique**, une mise en production à la fois, un jour d'écart au moins.

Pourquoi cet ordre évite les conflits dans `Code.gs` : chaque branche part de la précédente (`lot-8` → `lot-10a1` → `lot-10a2` → `lot-10b`), donc chaque `Code.gs` contient tout ce qui a été mis en production avant lui. Le mail unique est parti de l'ancien `lot-8` : **avant sa mise en service, je le remets à jour sur `lot-10b`** et je le fais relire (changement sur l'envoi des mails).

La copie TEST ne porte **qu'un lot à la fois** : on les essaie dans le même ordre.

## 1. Le 4c sur un vrai chantier (45 min, quand tu veux)

Depuis ton dossier principal, comme prévu (`docs/lot4c-procedure.md`, étapes 3 à 5).

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

**Point à régler avec toi avant l'étape 1** : l'envoi part du dossier d'où il est lancé, et tu ne veux pas que je change la branche de ton dossier principal (tu y fais le 4c). Deux possibilités :
- **(recommandé)** tu lances l'envoi depuis le dossier `C:\Users\pavageauf\Documents\GitHub\chantier-pro-lot8`, déjà sur la bonne branche : même commande, autre dossier ;
- ou je bascule ton dossier principal sur `lot-8` une fois ton 4c terminé.

## 3. Les lots 10a-1 et 10a-2 sur la copie TEST (après le lot 8 en production)

Détail dans `docs/lot10-procedure.md` (branche `lot-10a1`).
- Envoi sur TEST, installation (`installerLot10`), tes essais téléphone **dont le clavier ouvert, avec des gants**.
- Attendre **un vrai mail de 15 h 45** sur la copie TEST : il faut y poser les réveils automatiques pendant l'essai (je les retire ensuite : ils partagent les 90 minutes par jour avec la production).
- Production : coller `Code.gs`, `installerLot10Production`, `verifierConfig`, nouveau déploiement, me donner l'adresse, fusion.

## 4. Tes décisions (10 min, quand tu veux)

1. **Lot 8** : d'où lances-tu l'envoi sur TEST ? (partie 2 ; je recommande le dossier `chantier-pro-lot8`)
2. **Lot 10a-1**, trois écarts avec le plan, pris par moi pour la sûreté des données (chapitre 0 de `docs/lot10-plan.md`) :
   - titres de l'onglet *Demandes* changés : rien n'est écrit, les demandes attendent dans les téléphones (après 12 essais, le poseur touche « Réessayer ») ;
   - premier passage du réveil après 17 h 30 : pas de mail ce jour-là, les demandes partent en tête du suivant ;
   - « Précision (facultatif) » : faut-il écrire « facultative » ? (accord grammatical)
3. **Lot 10b**, deux choix pris par moi :
   - le mail du vendredi ne part qu'une fois `demarrerPointDuVendredi()` lancé à la main (pas d'envoi surprise sur la copie TEST, arrêt en un clic) ;
   - `essaiPointDuVendredi()` fabrique le mail à la demande, à toi seul, avec « [ESSAI] » dans l'objet, aussi en production.
4. **Mail unique**, mode `conducteur` (si le « À » vide échoue à l'essai) : le conducteur n'est mis en « À » que s'il est déjà destinataire ; personne n'est jamais ajouté. D'accord ?
5. **Lot 11** : lire l'étude (`_prive\etudes\lot11-etude.md`), répondre à ses 40 questions (dont 36 : scanne-moi le verso de la feuille d'heures, mercredi à vendredi), me donner les documents de son chapitre 11, et d'abord **obtenir l'accord de la direction**.
6. **Planning actuel** : aujourd'hui en production, le serveur met les fichiers du dossier *Planning* en partage « toute personne qui a le lien » ; le PDF du planning est lisible sans compte par quiconque a ce lien. Corriger maintenant (petit lot à part), ou avec le lot 11 ?

## 5. Essais qui restent à faire sur la copie TEST

- « Mails envoyés de plus de 3 mois » (possible à partir d'aujourd'hui) et « Anciens indices du carnet » : ne coche pas ces lignes en production avant.
- **iPhone** : `docs/essais-iphone.md`, 12 essais, avant la remise de l'appli aux poseurs.

## 6. Rappels en attente (aucun n'est urgent)

- `listerPartagesPlans` en production (lecture seule), puis le ménage des partages dans Drive : c'est toi qui les retires.
- Archiver les déploiements « Lot 3 — production » et « Lot 7 — production » (à partir du 20/11), « Lot 4 — production » à partir du 24/11.
- Lot 2 : `demarrerTransition` n'a pas été lancé en production.
- Copie TEST : supprimer les quatre onglets « … (ancienne version …) » ; CHANTIER TEST AUTO est resté à « Terminé ».
