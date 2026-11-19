# Feuille de route — jeudi 19/11/2026

> Tes actions, dans l'ordre, avec le temps estimé. Cette nuit, rien n'a été fait sur la copie TEST ni en production, et aucun mail n'est parti. Ton dossier principal est resté sur la branche `lot-5`.

## Aujourd'hui, dans l'ordre

| # | Qui | Quoi | Temps |
|---|---|---|---|
| 1 | toi, téléphone | sur la copie d'essai (icône « Loué ESSAI », **encore l'ancienne version**) : commence une note de réunion sans l'envoyer, et mets une note **en attente** (mode avion, Envoyer). Dis-moi « prêt » | **fait** |
| 2 | moi | je publie la copie d'essai avec les pages du lot 8 | **fait à 09 h 27** (appli 10.2, serveur de TEST v11.1 contrôlé) |
| 3 | toi, téléphone | essais 1 et 2 du lot 8 : **faits**. Puis **tu as retiré les points (8c)** : le lot 8 est adapté (09 h 56), voir la partie 0 ci-dessous | — |
| 4 | moi, puis toi | **fait le 19/11** (serveur v10.1 sur TEST, empreinte 41da7e54c5). Je te confirme « dossier prêt, branche lot-5c, serveur v10.1 » ; tu lances `node outils\envoyer-test.js --avec-porte` **depuis le dossier `chantier-pro-lot5c`** (le serveur du lot 8 est alors remplacé sur TEST : c'est voulu) | 2 min |
| 5 | moi | **fait le 19/11** : essai réel `tests/reel-lot5c.js`, 13 vérifications réussies (rien sans compte, aucun lien, fichiers privés, PDF de 4,9 Mo servi en 9 à 14 s depuis le PC, 5,2 Mo refusé) ; copie d'essai publiée en 9.1 | — |
| 6 | toi | tes essais du 5c : **bons (19/11)**, le PDF du planning s'ouvre sur Android et sur iPhone | — |
| 7 | toi | **fait le 19/11** : lot 5c en production (serveur v10.1, empreinte 1e2318f2a4 ; appli 9.1 en ligne ; fusion n° 16). Vérifié en ligne : les 5 anciennes adresses de production répondent « page introuvable » (archivées). **Reste : archiver « Lot 5 — production » le 26/11** ; d'ici là, cet ancien serveur répond encore | — |
| 8 | moi | **fait le 19/11 pour `lot-8`** (5c dedans, 21 séries vertes, poussée ; serveur sans la porte : empreinte ee4d3d8df9) **et pour `lot-10a1`** (5c dedans, points retirés). `lot-10a2`, `lot-10b` et `lot-5b` seront mis à jour à leur tour, juste avant leur passage (l'outil du lien de fusion refuse une branche qui ne contient pas la production) | — |
| 9 | toi, demain (20/11) | **étape C faite le 19/11** : serveur v11.0 sans la porte sur la copie TEST (empreinte ee4d3d8df9 vérifiée en ligne, planning refusé sans compte), ton contrôle sur « Loué ESSAI » 10.1 est bon (planning, note de réunion). **Reste l'étape D** de `docs/lot8-procedure.md` (branche `lot-8`) : coller `Code.gs` du dossier `chantier-pro-lot8`, nouveau déploiement « Lot 8 — production », me donner l'adresse, `installerLot8Production`, fusion | 15 min |

Avant l'étape 7 : chaque poseur qui lit le planning doit avoir un compte (sans compte, il ne le verra plus).

## 0. Lot 8 sans les points : la suite, dans l'ordre

| # | Qui | Quoi |
|---|---|---|
| a | toi, PC | **fait** (serveur v11.0, empreinte 44dbd21a98). Dans le dossier **`chantier-pro-lot8`** : `node outils\envoyer-test.js --avec-porte` (je t'ai confirmé « dossier prêt, branche lot-8, serveur v11.0 »). Dis-moi « envoi fait » avec l'empreinte |
| b | moi | **fait** : installation sur TEST, essais réels (15 vérifications réussies ; lancés deux fois, donc **4 mails** à ton adresse), copie d'essai publiée en 10.1. **À éclaircir** : le compteur de mails de Google a baissé de 4 pour 2 mails, deux fois de suite ; cause non établie, à mesurer à part |
| c | toi, téléphone | **fait le 19/11 : essais 3 à 11 tous bons, lot 8 validé par toi.** « Mettre à jour », vérifier **10.1**, puis les essais 3 à 11 de l'étape B de `docs/lot8-procedure.md` (branche `lot-8`) |
| d | ensuite | les étapes 4 à 9 du tableau ci-dessus (lot 5c sur TEST, puis en production ; lot 8 en production le lendemain) |

## Où en est chaque lot

| Lot | Branche | État au 19/11 |
|---|---|---|
| **5** (stockage, purges) | `main` | **en production** depuis le 17/11 |
| **4c** (programme du PC) | `lot-5` (ton dossier) | **en service depuis le 18/11** |
| **4d** retouches du programme du PC | `lot-5` (ton dossier) | **en service depuis le 18/11 à 21 h 18** ; premier passage automatique réussi à 21 h 39 : 46 points → **1 point et 7 lignes « pour information »** |
| **4e** images du carnet un peu plus compressées | `lot-4e` (dossier `chantier-pro-lot4e`) | construit, 33 + 83 tests verts ; **attend ton essai sur la copie TEST** (partie 2) |
| **5c** planning lisible par les seuls comptes, serveur v10.1, appli 9.1 | `lot-5c` (fusionnée dans `main`) | **en production depuis le 19/11**. À faire le 26/11 : archiver « Lot 5 — production » |
| **8** note de réunion (onglet « Comptes rendus », compteur de mails, photos annotées qu'on rouvre), **sans les points**, serveur v11.0, appli 10.1 | `lot-8` (dossier `chantier-pro-lot8`) | **points (8c) retirés le 19/11 sur ta décision** ; toutes les séries de tests relancées ; essais réels verts sur la copie TEST ; **tes 11 essais sont bons (19/11) : validé**. Reste avant sa production : le lot 5c d'abord, puis le second envoi « sans la porte » (étape C) |
| **8d** récapitulatif des notes de réunion par chantier | — | **plan écrit le 19/11** (`docs/lot8d-plan.md`), rien de construit ; trois points à décider |
| **12** tous les chantiers ouverts à tous les comptes (réglage), nouvel accueil | — | **plan écrit le 19/11** (`docs/lot12-plan.md`), rien de construit ; deux points à décider (son chapitre 9) |
| **10a-1**, **10a-2**, **10b** | `lot-10a1` → `lot-10a2` → `lot-10b` | construits et testés ; 10a-1 relu. Sur TEST après le lot 8 en production |
| **Mail unique** (lot 5b) | `lot-5b` | construit, **pas encore relu** ; livré éteint ; passe en dernier |
| **11** planning, heures, atelier | — | accord donné ; tes retours du 18/11 au soir sont dans l'étude (`_prive\etudes\lot11-etude.md`, chapitre 0 ter) et dans le plan `docs/lot11-1-plan.md` (**version 3, critiquée par un agent indépendant**). **Maquette Google Sheets avec son programme** prête à installer : partie 3 |

**Ordre de mise en production** : 5c → lot 8 → **lot 12** (s'il est validé et construit d'ici là) → 10a-1 → 10a-2 → 10b → mail unique, une à la fois, un jour d'écart au moins. Chaque branche contient les précédentes ; le 5c, parti de la production, est reporté dans les autres après sa mise en production.

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
3. **Répondre aux 12 points** du chapitre 12 de `docs/lot11-1-plan.md` (version 3, corrigée après une critique indépendante).
4. **Tes décisions du 19/11** : tous les chantiers ouverts à tous les comptes, avec un réglage allumé / éteint, et un nouvel accueil (« Mes chantiers » = favoris, « Tous les chantiers » replié) : **lot 12, `docs/lot12-plan.md`**, deux points à trancher (chapitre 9). Le planning n'ajoute plus que des favoris : **lot 11.1d, chapitre 13 du plan du lot 11.1**, plus rien à trancher. Rien n'est construit.

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

## 6. Tes deux remarques du 19/11 (un petit lot à venir, pas avant le lot 8)

Rien n'est construit ni planifié en détail : ce sont mes premières réponses.

- **« Notes » au lieu de « Notes de chantier », et une tuile « Notes » sur l'accueil** (toutes les notes du gars, tous chantiers confondus, avec le chantier, la date et une case à cocher dans la liste ; les notes faites en bas). **Faisable, y compris hors réseau** : le téléphone garde déjà la dernière liste reçue, et une case cochée sans réseau part toute seule au retour du réseau (c'est la file d'attente des notes d'aujourd'hui). **Ta réponse du 19/11 : « seulement les siennes » = les notes qu'il a écrites lui-même.** Je propose un **lot 13**, après le lot 12 (les deux touchent l'accueil).
- **Un brouillon par chantier** : étudié. Le vrai « un brouillon par chantier » coûte cher : il touche la brique anti-perte et les 9 fiches, et le chantier d'une fiche peut changer en cours de saisie. Je propose plus simple, pour beaucoup moins de travail (à chiffrer dans le plan) : un troisième bouton **« Garder pour plus tard »** à côté de « Restaurer » et « Repartir à zéro », et une petite liste « Brouillons gardés » (chantier et date) pour reprendre celui qu'on veut. Le rangement existe déjà (5 brouillons mis de côté, 30 jours) : la protection anti-perte n'est pas touchée. Un petit lot, à placer après le lot 13.

## État au 19/11/2026 au soir (travail en autonomie interrompu par la limite d'utilisation)

| Lot | Branche | État |
|---|---|---|
| **8** | `lot-8` | serveur v11.0 en production (adresse dans `commun/config.js`) ; **il te reste la fusion** (lien donné dans la conversation) |
| **8d** récapitulatif des notes | `lot-8d` (dossier `chantier-pro-lot8d`) | **construit, testé, relu par un agent indépendant, corrigé, poussé**. Procédure : `docs/lot8d-procedure.md` de la branche. Rien n'a tourné chez Google |
| **12** accès ouverts, nouvel accueil, favoris du planning | `lot-12` (dossier `chantier-pro-lot12`) | **construit, testé (27 séries vertes), poussé**. **La relecture indépendante a été lancée puis arrêtée (limite atteinte) : elle est à refaire** avant tout envoi sur TEST. Procédure : `docs/lot12-procedure.md` de la branche |
| **13** tuile « Notes », « Garder pour plus tard » | `lot-13` (dossier `chantier-pro-lot13`) | branche créée, **rien d'écrit** (ni plan, ni code) |
| 10a-2, 10b, mail unique (5b) | — | **pas remis à jour** ; relecture du mail unique pas faite |
| **11.1** Sheet « Planning Loué » | — | **pas commencé** |
| **14** absence reliée au planning | — | **pas commencé** (ta demande du 19/11 est notée) |

Ordre de production prévu : 8 (fusion) → 8d → 12 → 13 → 10a-1 → 10a-2 → 10b → mail unique.
