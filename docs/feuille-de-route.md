# Feuille de route — jeudi 19/11/2026

> Tes actions, dans l'ordre, avec le temps estimé. Cette nuit, rien n'a été fait sur la copie TEST ni en production, et aucun mail n'est parti. Ton dossier principal est resté sur la branche `lot-5`.

## Aujourd'hui, dans l'ordre

| # | Qui | Quoi | Temps |
|---|---|---|---|
| 1 | toi, téléphone | sur la copie d'essai (icône « Loué ESSAI », **encore l'ancienne version**) : commence une note de réunion sans l'envoyer, et mets une note **en attente** (mode avion, Envoyer). Dis-moi « prêt » | 5 min |
| 2 | moi | je publie la copie d'essai avec les pages du lot 8 | 10 min, sans toi |
| 3 | toi, téléphone | **les 13 essais du lot 8** : étape B de `docs/lot8-procedure.md` (branche `lot-8`) | 20 min |
| 4 | moi, puis toi | je te confirme « dossier prêt, branche lot-5c, serveur v10.1 » ; tu lances `node outils\envoyer-test.js --avec-porte` **depuis le dossier `chantier-pro-lot5c`** (le serveur du lot 8 est alors remplacé sur TEST : c'est voulu) | 2 min |
| 5 | moi | je publie la copie d'essai avec les pages du 5c ; je vérifie que les fichiers du planning de TEST sont redevenus privés ; j'essaie un PDF de 4,9 Mo | 20 min, sans toi |
| 6 | toi | **tes essais du 5c** : étape B de `docs/lot5c-procedure.md` (branche `lot-5c`), sur Android **et** iPhone | 10 min |
| 7 | toi | production du 5c (étape C) : `--sans-porte`, coller `Code.gs` v10.1, `fermerPartagesPlanning`, nouveau déploiement, me donner l'adresse, fusion, **archiver les anciens déploiements** (Lot 3, Lot 4, Lot 7) | 30 min |
| 8 | moi | je reporte le 5c dans `lot-8`, puis `lot-10a1`, `lot-10a2`, `lot-10b`, `lot-5b` ; je relance les séries de tests ; je te confirme le dossier du lot 8 | sans toi |
| 9 | toi, demain | production du lot 8 (étapes C et D de `docs/lot8-procedure.md`) | 30 min |

Avant l'étape 7 : chaque poseur qui lit le planning doit avoir un compte (sans compte, il ne le verra plus).

## Où en est chaque lot

| Lot | Branche | État au 19/11 |
|---|---|---|
| **5** (stockage, purges) | `main` | **en production** depuis le 17/11 |
| **4c** (programme du PC) | `lot-5` (ton dossier) | **en service depuis le 18/11** |
| **4d** retouches du programme du PC | `lot-5` (ton dossier) | **en service depuis le 18/11 à 21 h 18** ; premier passage automatique réussi à 21 h 39 : 46 points → **1 point et 7 lignes « pour information »** |
| **4e** images du carnet un peu plus compressées | `lot-4e` (dossier `chantier-pro-lot4e`) | construit, 33 + 83 tests verts ; **attend ton essai sur la copie TEST** (partie 2) |
| **5c** planning lisible par les seuls comptes, serveur v10.1, appli 9.1 | `lot-5c` | construit, relu, corrigé, 19 séries vertes. **Sur TEST aujourd'hui, puis en production avant le lot 8** |
| **8** note de réunion en points, serveur v11.1, appli 10.2 | `lot-8` | sur la copie TEST depuis le 18/11 (empreinte 313ebbda57) ; installé ; essais réels faits : 18 sur 19, **et le 19e est levé** (tu as bien reçu exactement 3 mails : l'écart du compteur venait de la production). Restent tes 13 essais |
| **10a-1**, **10a-2**, **10b** | `lot-10a1` → `lot-10a2` → `lot-10b` | construits et testés ; 10a-1 relu. Sur TEST après le lot 8 en production |
| **Mail unique** (lot 5b) | `lot-5b` | construit, **pas encore relu** ; livré éteint ; passe en dernier |
| **11** planning, heures, atelier | — | accord donné ; tes retours du 18/11 au soir sont dans l'étude (`_prive\etudes\lot11-etude.md`, chapitre 0 ter) et dans le plan `docs/lot11-1-plan.md` (**version 3, critiquée par un agent indépendant**). **Maquette Google Sheets avec son programme** prête à installer : partie 3 |

**Ordre de mise en production** : 5c → lot 8 → 10a-1 → 10a-2 → 10b → mail unique, une à la fois, un jour d'écart au moins. Chaque branche contient les précédentes ; le 5c, parti de la production, est reporté dans les autres après sa mise en production.

## 2. Le programme du PC : les retouches sont en service, reste l'essai des images (lot 4e)

**Lot 4d : fait le 18/11 au soir**, sur ton « vas-y ». Ta branche `lot-5` a avancé sans changer ; la tâche automatique n'a pas été touchée. Le passage de 21 h 39 a tourné avec la nouvelle version et a réussi : `CHANTIERPRO - A VOIR.txt` ne compte plus qu'**1 point**, suivi de 7 lignes « pour information ». Si quelque chose te gêne dans ce fichier, dis-le-moi : le retour arrière prend 2 minutes et ne touche aucune donnée.

**Lot 4e : images du carnet un peu plus compressées** (ton accord du 18/11). Construit sur la branche `lot-4e`, pas dans ton dossier principal. Avant de le mettre en service, **un essai de 10 minutes sur la copie TEST** (`docs/lot4e-procedure.md`, branche `lot-4e`) :
1. **Toi** : copie le PDF d'un plan chargé (beaucoup de cotes) dans un dossier à part, donne-moi son chemin et dis « essai qualité ».
2. **Moi** : je le dépose deux fois dans le carnet du chantier d'essai de la copie TEST, une fois avec l'ancien réglage, une fois avec le nouveau, et je te donne les deux poids.
3. **Toi**, sur le téléphone (« Loué ESSAI ») : zoome au maximum sur la même petite cote dans les deux documents, dehors si possible. Pas de différence : on met en service, comme pour le lot 4d.

**Purge des anciens indices, une fois par mois** : la case existe déjà (onglet *Purges*). Son essai sur la copie TEST reste à faire avant de la cocher en production (partie 4). Pour le rappel mensuel, je propose une ligne dans le mail du vendredi (lot 10b), le premier vendredi du mois : à décider quand le 10b sera en production.

## 3. Le lot 11 (planning, atelier) : quand tu as 30 minutes

Rien n'est construit ; tout est avec de faux noms, sans lien avec l'appli.

1. **Installer la maquette Google Sheets** : `_prive\planning\maquette\google-sheets\PROCEDURE.md` (créer un Sheet vide, coller `Code-maquette.gs`, lancer `installerMaquette`, autoriser). 10 minutes. Le programme ne peut toucher que ce fichier-là.
   **À savoir** : il a passé 42 essais contre un faux Google écrit pour l'occasion, mais **il n'a jamais tourné chez le vrai Google**. Si un message d'erreur apparaît, copie-le-moi : je corrige.
2. **Faire ses essais** (fin de la procédure), surtout : les propositions pendant la frappe ; maltraiter les cases collées ; **l'affiche A3** (cocher « Préparer l'affiche A3 », ouvrir le lien, imprimer en A3 paysage, mesurer une majuscule) ; l'atelier (fabrication → commandes en attente → commandes → reçu).
3. **Répondre aux 11 points** du chapitre 12 de `docs/lot11-1-plan.md` (version 3, corrigée après une critique indépendante).

Trois choses que la critique a changées, à connaître avant de lire le plan :
- **Aucune méthode officielle de Google n'exporte un onglet en PDF A3.** Le lien utilisé par tout le monde marche aujourd'hui, sans garantie. Repli sûr : Fichier → Imprimer.
- **« Publier »** : tu coches, et le PDF est dans l'appli dans les 10 minutes, sans fenêtre de confirmation. C'est le prix à payer pour que personne ne puisse, depuis un compte personnel, agir avec les droits du compte de Loué.
- **L'affiche tient sur une seule A3 en paysage** (ta demande du 18/11 au soir) : un onglet d'impression à part, une ligne par gars, ton planning de travail inchangé. Texte d'environ 16 points pour 12 poseurs et 4 gars d'atelier, 12 points dans le pire cas (20 + 7). Deux aperçus PDF sont dans le dossier de la maquette ; ces tailles restent à mesurer sur une vraie impression sortie de Google.

La première maquette (Excel) est rangée dans `_prive\planning\maquette\ancienne maquette Excel (dépassée)\`.

## 4. Essais qui restent à faire sur la copie TEST

- « Mails envoyés de plus de 3 mois » et « Anciens indices du carnet » : ne coche pas ces lignes en production avant.
- **iPhone** : `docs/essais-iphone.md`, 12 essais, avant la remise de l'appli aux poseurs.
- Les 3 PDF « COMPTE RENDU CHANTIER TEST AUTO » des essais du lot 8 sont restés dans le Drive de TEST : regarde le tableau des points dans l'un d'eux, puis supprime-les.

## 5. Rappels (aucun n'est urgent)

- Au **prochain bordereau du 403** (plans BAL, n° 108) : refaire le **choix 6** du menu de `appli-pc` et **ajouter 108 → 108** à sa table.
- `listerPartagesPlans` en production (lecture seule), puis le ménage des partages dans Drive : c'est toi qui les retires.
- Lot 2 : `demarrerTransition` n'a pas été lancé en production.
- Copie TEST : supprimer les quatre onglets « … (ancienne version …) » ; CHANTIER TEST AUTO est resté à « Terminé ».
