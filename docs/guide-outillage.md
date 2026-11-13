# Outillage : mode d'emploi

> Pour Franck et pour Claude. Ce guide décrit les outils qui servent à préparer, essayer et livrer un lot.
> Le pourquoi est dans `docs/automatisation.md`, le plan de mise en place dans `docs/outillage-plan.md`.
> **État au 12/11/2026** : étapes A, B et C en place et vérifiées en vrai (lien pré-rempli et verrouillage de `main` ; copie d'essai sur le téléphone de Franck ; envois sur TEST par clasp ; porte de service et sa démonstration). Les outils du serveur (étape C) sont sur la branche `outillage` : ils entreront dans `main` avec le lot 7.

## Qui fait quoi

| Geste | Qui |
|---|---|
| Publier la copie d'essai | Claude, seul |
| Préparer la demande de fusion de production (lien pré-rempli) | Claude |
| Cliquer « Create pull request », « Merge pull request », « Confirm merge » | **Franck** |
| Envoyer le serveur sur la copie TEST | **Franck** lance la commande (2 lignes, 1 clic « Autoriser ») ; elle fait tout le reste |
| Lancer l'installation d'un lot dans Apps Script | **Franck** en production (1 clic ▶) ; sur TEST, Claude par la porte de service |
| Jouer les essais sur la copie TEST | Claude, par la porte de service ; Franck garde les essais sur téléphone |
| Tout réglage des comptes GitHub et Google | **Franck** |

## 1. `main` est verrouillée

Depuis le 12/11/2026, rien n'entre dans `main` sans demande de fusion, pour Franck comme pour Claude.

- Déposer un fichier directement sur `main` depuis le site de GitHub n'est plus possible : GitHub propose de créer une demande de fusion à la place.
- Le réglage est dans le dépôt : **Settings** → **Branches** → règle `main`. Cases cochées : « Require a pull request before merging » (avec « Require approvals » **décochée**) et « Do not allow bypassing the above settings ».
- Si le bouton « Merge » est grisé un jour : vérifier d'abord que « Require approvals » est bien décochée.
- En cas d'urgence absolue (appli cassée, demande de fusion impossible) : supprimer la règle (même écran, **Delete**), réparer, puis la recréer.

## 2. Le lien pré-rempli de demande de fusion

Claude prépare la branche, la pousse, puis lance :

```
node outils/lien-fusion.js livraison/lot-7 --titre "Lot 7 — production" --texte "Ce que contient la livraison" --procedure docs/lot7-procedure.md
```

La commande affiche un lien. **Elle ne crée rien et ne fusionne rien.** Elle refuse de donner un lien si la branche n'est pas sur GitHub à l'identique, si elle ne contient pas le dernier état de `main` (aucun conflit possible ensuite), ou si la livraison n'est pas à jour.

Franck ouvre le lien. La demande est déjà remplie, avec :
- le nombre de fichiers modifiés ;
- **Serveur** : « inchangé (rien à faire dans Apps Script) » ou « `Code.gs` MODIFIÉ, à mettre dans Apps Script avant de fusionner », avec l'empreinte du fichier (une suite de 12 caractères : si un seul caractère du fichier change, elle change) ;
- **Pages de l'appli** : modifiées ou non, avec la version qui s'affichera dans « À propos » ;
- la procédure à suivre.

L'empreinte sert de repère : la même sera affichée par la commande d'envoi du serveur (étape C), ce qui permettra de vérifier que le serveur en ligne est bien celui de la demande. Tant que l'étape C n'est pas en place, il n'y a rien à comparer à la main.

Il clique **Create pull request**, **Merge pull request**, **Confirm merge**.

## 3. La copie d'essai

La copie d'essai n'est plus dans ce dépôt. Elle vit dans un dépôt à part, dans une organisation GitHub gratuite, à sa propre adresse (réglée dans `outils/essai-cible.json`). Pour un téléphone, c'est **un autre site** que la vraie appli : sa mémoire (brouillons, fiches en attente, session) est séparée.

- Elle est **toujours en mode TEST** (bandeau rouge « COPIE D'ESSAI ») : elle ne peut écrire que dans la copie TEST du Sheet et du Drive.
- Elle est publique et permanente, mais les moteurs de recherche ont l'instruction de ne pas la référencer.
- Sur le téléphone, son icône s'appelle « Loué ESSAI ».

Pour la publier, Claude lance :

```
node outils/publier-essai.js
```

La commande fabrique la copie dans le dossier voisin `..\chantier-pro-essai\`, l'enregistre, la pousse, attend que GitHub la publie (1 à 3 min) et vérifie la version en ligne. Elle refuse de travailler si ce dossier n'est pas relié au dépôt d'essai : **la copie d'essai ne peut pas partir dans le dépôt de production.**

La toute première fois : `node outils/publier-essai.js --preparer` (copie le dépôt d'essai dans le dossier voisin).

**Ne rien modifier à la main dans le dépôt d'essai** : tout est remplacé à la publication suivante.

## 4. L'installation d'un lot en une fonction

> Le code est prêt (branche `outillage`) mais **pas encore dans le serveur en service** : il arrivera sur TEST à l'étape C, et en production avec le lot 7.

À partir du lot 7, chaque lot a deux fonctions dans Apps Script :

| Fonction | Où la lancer |
|---|---|
| `installerLot7Test` | Projet de la copie TEST |
| `installerLot7Production` | Projet de production |

Chacune refuse de tourner dans le mauvais projet.

**Comment lire le bilan** (dans le journal de l'éditeur, et dans l'onglet *Installation* du Sheet) :

| Signe | Sens |
|---|---|
| ✅ … : fait | L'étape vient d'être faite |
| ✅ … : déjà fait | Elle l'était déjà : rien n'a été touché |
| ➖ … : non concerné | Étape réservée à l'autre environnement |
| ❌ … | Erreur. La ligne ⛔ qui suit dit que les étapes suivantes n'ont **pas** été lancées |
| ⬜ … : à faire | (contrôle seul) l'étape n'est pas en place |

- **On peut relancer la fonction sans danger** : une étape déjà faite n'est jamais rejouée, aucun réglage fait à la main n'est écrasé.
- En cas de ❌ : envoyer le bilan à Claude, ne rien lancer d'autre.
- `controlerInstallationLot2` vérifie que le lot 2 est bien en place. Elle ne modifie rien : elle écrit seulement son bilan.
- L'onglet *Installation* garde les 50 dernières lignes. On peut le supprimer sans risque : il est recréé à l'installation suivante.

## 5. Envoyer le serveur sur la copie TEST

C'est Franck qui lance la commande, quand Claude le demande (détail et sécurité : `docs/clasp.md`) :

```
cd $HOME\Documents\GitHub\chantier-pro
```

```
node outils\envoyer-test.js --avec-porte
```

- `--avec-porte` : pendant les essais (le serveur contient les outils d'essai de Claude) ; `--sans-porte` : avant le feu vert (le fichier qui partira en production).
- Une page Google s'ouvre : compte de Loué, **Autoriser**. La commande affiche 6 étapes et finit par `✅ Envoi réussi` ou `❌ …`.
- Elle n'envoie que vers le projet de la copie TEST, sauvegarde l'ancien serveur dans `_prive/`, vérifie en ligne par l'empreinte, et efface le jeton Google dans tous les cas.
- Avant un envoi `--sans-porte`, elle fait d'abord ranger la copie TEST (déclencheurs d'essai retirés, sessions d'essai fermées, période sans compte remise comme avant). Si elle n'y arrive pas, elle s'arrête : il suffit de relancer.

## 6. La porte de service de la copie TEST

Pendant les essais, le serveur de la copie TEST contient des **outils d'essai** que Claude appelle depuis le PC avec `node outils/porte.js <geste>`. Ils n'existent pas dans le serveur de production (l'outil de construction le refuse, et `verifierConfig` le signalerait).

| Geste | Ce qu'il fait |
|---|---|
| `etat` | Version, empreinte, déclencheurs en place, période sans compte, mails encore possibles |
| `lireEnvois`, `lireBilan` | Les dernières lignes des onglets *Envois* (numéro, date, type, statut) et *Installation* |
| `controlerLot2` | Vérifie que le lot 2 est en place, sans rien modifier |
| `poserDeclencheurs`, `retirerDeclencheurs` | Les déclencheurs de l'appli, le temps d'un essai (retirés tout seuls au bout de 2 h) |
| `traiterComptes`, `finirTransition`, `prolongerTransition`, `retablirTransition` | Les fonctions d'essai du lot 2 ; la période sans compte d'origine est mémorisée et remise |
| `preparerComptes`, `session`, `fermerSessions`, `cocher`, `lireCompte` | Quatre comptes d'essai (`auto-poseur`, `auto-conducteur`, `auto-admin`, `auto-atelier`), activés seulement pendant un essai |
| `installerLot3`, `accesChantier` | Lot 3 : installer les onglets des notes sur TEST ; cocher ou décocher l'accès d'un compte d'essai au chantier d'essai (aucun autre compte, aucun autre chantier) |
| `rangerAnciennesNotes`, `purgerNotesEssai` | Lot 3 : renommer (sans rien effacer) les onglets des notes laissés par la première version ; retirer les lignes écrites par les essais automatiques (numéros « fiche-auto-… »), et elles seules |
| *(à savoir)* | **Juste après un envoi clasp, Google peut servir l'ancien serveur pendant une minute environ** (constaté le 13/11/2026 : une installation jouée trop tôt a été exécutée par l'ancien code). Les scripts d'essais réels attendent que la bonne empreinte réponde 6 fois de suite avant d'écrire |
| `titresNotes` | Lecture seule : la ligne de titres des onglets des notes telle que Sheets la renvoie (pour comprendre un « titres changés ») |
| `dossierChantierEssai` | Lecture seule : où le serveur range les documents du chantier d'essai (onglet *Dossiers chantiers*, dossiers en double, PDF présents). Refuse si la racine du Drive ne s'appelle pas « … TEST … » |
| `installerLot7`, `lireSignalements`, `destinatairesEssai` | Lot 7 : installer le lot sur TEST, lire l'onglet *Signalements* (sans chantier ni texte saisi), savoir à qui partiraient les mails d'un essai (sans donner d'adresse) |
| `preparerChantier` | Une ligne « CHANTIER TEST AUTO » dans l'onglet *Chantiers* de TEST |

Ce que tu verras dans le Sheet « ChantierPro TEST » : quatre lignes `auto-…` dans *Utilisateurs* (décochées hors essai), un onglet *Installation*, et peut-être une colonne `auto-poseur` dans *Accès chantiers*. Tu peux les laisser : ils servent aux essais suivants.

La clé de la porte est dans `_prive/cle-outils-test.txt` et dans la propriété `CLE_OUTILS_TEST` du projet TEST. Si elle fuit, elle ne donne accès qu'aux gestes ci-dessus, sur la copie TEST. Pour la changer : supprimer le fichier, relancer `node outils/porte.js --creer-cle`, recopier la nouvelle valeur dans la propriété.

## 7. Les tests des outils

```
node tests/outils.test.js
```

```
node tests/installation.test.js
```

```
node tests/porte.test.js
```

Le premier vérifie le lien et la copie d'essai dans un dossier temporaire, sans toucher à GitHub. Les deux autres (branche `outillage`) vérifient le moteur d'installation, la porte de service et la commande d'envoi, avec un faux Apps Script et un faux clasp : aucun appel à Google.

## 8. Le programme du PC : carnet et recopie des fiches (lot 4c)

**La recopie des fiches de l'appli vers les dossiers de chantier du PC est automatique** : une tâche du Planificateur de tâches de Windows lance `outils/appli_pc.py --rapatrier --auto` toutes les heures et à l'ouverture de session, sans fenêtre. Ce qui demande l'attention de Franck est écrit dans `CHANTIERPRO - A VOIR.txt`, à côté des dossiers de chantier.

| Fichier (double-clic) | Ce que ça fait |
|---|---|
| `outils\installer-tache.bat` | Met la recopie automatique en place, une fois, sans droits d'administrateur |
| `outils\retirer-tache.bat` | L'arrête (aucun fichier n'est touché) |
| `outils\appli-pc.bat` | Le menu : 1 tout traiter (carnet depuis les bordereaux, puis recopie des fiches) ; 2 voir seulement, sans rien écrire ; 3 lire « A VOIR » ; 4 associer un dossier du Drive à un dossier de chantier quand le numéro ne suffit pas ; 5 retirer un document du carnet |

Ses réglages sont dans `_prive\depot.json` (jamais sur GitHub). Il ne supprime, ne déplace et n'écrase jamais rien. Mode d'emploi complet, limites et retour arrière : `docs/lot4c-procedure.md`. Ses tests, sur de faux dossiers, sans créer de tâche planifiée :

```
python -m unittest tests/test_appli_pc.py
```

```
python -m unittest tests/test_depot_carnet.py
```

## Où est le code

| Quoi | Où | Dans `main` ? |
|---|---|---|
| Outils du PC (`outils/`, `tests/outils.test.js`) et documents | branche `livraison/outillage` | Oui, dès la première demande de fusion |
| Moteur d'installation (`apps-script/Installation.gs`), porte de service (`apps-script-test/`), commande d'envoi (`outils/envoyer-test.js`, `outils/porte.js`) | branche `outillage` | **Non, pas avant le lot 7** : tant que la transition du lot 2 est en cours, le serveur de `main` reste exactement celui qui tourne (v6.0.1) |
