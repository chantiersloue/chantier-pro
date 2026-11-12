# Outillage : mode d'emploi

> Pour Franck et pour Claude. Ce guide décrit les outils qui servent à préparer, essayer et livrer un lot.
> Le pourquoi est dans `docs/automatisation.md`, le plan de mise en place dans `docs/outillage-plan.md`.
> **État au 12/11/2026** : étapes A et B construites ; étape C (clasp et porte de service) à venir.

## Qui fait quoi

| Geste | Qui |
|---|---|
| Publier la copie d'essai | Claude, seul |
| Préparer la demande de fusion de production (lien pré-rempli) | Claude |
| Cliquer « Create pull request », « Merge pull request », « Confirm merge » | **Franck** |
| Lancer l'installation d'un lot dans Apps Script (1 clic ▶) | **Franck** en production ; sur TEST, Claude à partir de l'étape C |
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

La commande affiche un lien. **Elle ne crée rien et ne fusionne rien.** Elle refuse de donner un lien si la branche n'est pas sur GitHub à l'identique, si elle est en conflit avec `main`, ou si la livraison n'est pas à jour.

Franck ouvre le lien. La demande est déjà remplie, avec :
- le nombre de fichiers modifiés ;
- **Serveur** : « inchangé (rien à faire dans Apps Script) » ou « `Code.gs` MODIFIÉ, à mettre dans Apps Script avant de fusionner », avec l'empreinte du fichier (une suite de 12 caractères : si un seul caractère du fichier change, elle change) ;
- **Pages de l'appli** : modifiées ou non, avec la version qui s'affichera dans « À propos » ;
- la procédure à suivre.

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

## 5. Les tests des outils

```
node tests/outils.test.js
```

```
node tests/installation.test.js
```

Le premier vérifie le lien et la copie d'essai dans un dossier temporaire, sans toucher à GitHub. Le second vérifie le moteur d'installation dans le faux Apps Script des tests (branche `outillage`).

## Où est le code

| Quoi | Où | Dans `main` ? |
|---|---|---|
| Outils du PC (`outils/`, `tests/outils.test.js`) et documents | branche `livraison/outillage` | Oui, dès la première demande de fusion |
| Moteur d'installation (`apps-script/Installation.gs`) et, plus tard, la porte de service | branche `outillage` | **Non, pas avant le lot 7** : tant que la transition du lot 2 est en cours, le serveur de `main` reste exactement celui qui tourne (v6.0.1) |
