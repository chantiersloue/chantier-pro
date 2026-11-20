# Feuille de route — lundi 23/11/2026 (version définitive)

> Tes actions, dans l'ordre, avec le temps estimé. Elles tiennent compte de tes réponses du 20/11.
> **Depuis vendredi : rien sur la copie TEST ni en production, aucun mail.** Ton dossier principal est resté sur la branche `lot-5`, et `_prive\depot.json` n'a pas été touché.
> Tout est construit et testé contre un faux Google et dans Chrome. Rien n'a tourné chez le vrai Google, et rien sur un vrai téléphone.

## 1. En bref

**Trois livraisons sont prêtes, à mettre en production l'une après l'autre**, avec un jour d'écart au moins :

| Ordre | Livraison | Dossier (branche) | Serveur / appli | Ce qu'elle contient |
|---|---|---|---|---|
| 1 | **Groupe A** | `chantier-pro-lot14` (`lot-14`) | v11.4 / 10.5 | lots 8d (récapitulatif des notes), 12 (accueil, étoiles, réglage « tous les chantiers »), 13 (« Mes notes », « Garder pour plus tard »), 14 (absences) ; et le planning (11.1), qui ne touche pas l'appli |
| 2 | **Groupe B** | `chantier-pro-lot10a2` (`lot-10b`) | v11.5 / 10.6 | le groupe A, plus les lots 10a-1 et 10a-2 (« À commander ») et 10b (le point du vendredi) |
| 3 | **Mail unique** | `chantier-pro-lot5b` (`lot-5b`) | v11.6 / 10.7 | les groupes A et B, plus le mail unique (5b) |

Pour chacune : **un envoi sur TEST, une séance d'essais, une mise en production.** Ce qui arrive éteint, tu l'allumes plus tard d'un réglage : tous les chantiers ouverts, les absences par la direction, le mail unique.

## 2. Tes actions, dans l'ordre

| # | Quoi | Où | Temps |
|---|---|---|---|
| 1 | **Fusionner le lot 8** avec le lien que je t'ai donné, si ce n'est pas fait. Après : « À propos » affiche **10.1** | navigateur | 5 min |
| 2 | **Groupe A sur TEST** : PowerShell dans `chantier-pro-lot14`, `node outils\envoyer-test.js --avec-porte`. Attends `✅ Envoi réussi`, version **v11.4**, empreinte **71379cf9cd** (elle a changé depuis vendredi : celle-ci est la bonne). Dis-moi « envoi fait » | PC | 5 min |
| 3 | Moi : installation des lots 8d, 12 et 14 sur TEST, essais automatiques (**3 mails d'essai** pour toi), copie d'essai en 10.5. Je te dis « à toi » | — | 10 min |
| 4 | **La séance du groupe A** : `docs/essais-groupes.md` (branche `lot-14`), parties 3 et 4. Avec des gants pour l'accueil et les brouillons, Outlook pour les boutons du mail d'absence. Dis-moi « essais faits », avec une capture d'Outlook | téléphone, puis PC | 45 min |
| 5 | **Groupe A en production** : partie « Production » de `docs/essais-groupes.md`. Un envoi sans la porte (empreinte **498ea5c52f**), un collage, trois fonctions (`installerLot8dProduction`, `installerLot12Production`, `installerLot14Production`), un nouveau déploiement « Groupe A — production ». Tu me donnes l'adresse, je te donne le lien de fusion | éditeur Apps Script | 20 min |
| 6 | Le programme du PC pour le récapitulatif des notes : étape C de `docs/lot8d-procedure.md` | PC | 5 min |
| 7 | **Groupe B**, un jour après au moins : `docs/essais-groupe-b.md` (dossier `chantier-pro-lot10a2`). Envoi sur TEST avec la porte (empreinte **acacd2244d**), séance, production (empreinte **e1a9a30e56** ; `installerLot10Production`, `demarrerPointDuVendredi`) | PC, téléphone | 40 min |
| 8 | **Mail unique**, un jour après au moins : `docs/lot5b-procedure.md` (dossier `chantier-pro-lot5b`). Ses cinq essais se font dans l'éditeur de TEST, avec tes deux adresses. Envoi avec la porte (empreinte **962f1c54ca**), puis production sans la porte (empreinte **414cd90829**). Il arrive éteint | PC | 30 min |
| 9 | **Planning (11.1)** : quand tu as 30 minutes, l'étape 0 de `docs/lot11-procedure.md` (branche `lot-14`) : les essais que seul Google peut trancher, sur un Sheet d'essai | PC | 30 min |

**Quand tu le décides, après la production** (5 minutes chacun) :
- **Absences par la direction** : dans le Sheet de production, onglet *Réglages*, ligne « Adresses de la direction », écris les vraies adresses en colonne B (1 à 3, séparées par une virgule). Préviens la direction et les gars avant (`docs/lot14-procedure.md`, étape E). Tant que la case est vide, les demandes partent comme aujourd'hui, et tu reçois une alerte les jours où une absence arrive.
- **Tous les chantiers ouverts à tous les comptes** : la case de la ligne « Tous les comptes ouvrent tous les chantiers », même onglet.
- **Le mail unique** : la propriété `MAIL_UNIQUE` (`docs/lot5b-procedure.md`, étape D), après ses essais.

**Archivage des anciens déploiements** : « Lot 5 — production » le **26/11** ; ensuite, chaque fois **une semaine après** la fusion qui l'a remplacé. Les liens des mails d'absence valent 7 jours.

## 3. Tes réponses du 20/11 : ce qui est fait

| Ta réponse | Ce que j'ai fait |
|---|---|
| Adresses de la direction réglables dans le Sheet, 1 à 3, pas dans le code ; case vide = la demande part comme aujourd'hui, avec une alerte | Ligne « Adresses de la direction » de l'onglet *Réglages*, posée par `installerLot14Production` **case vide**. La colonne C dit ce que l'appli a compris. Une alerte par jour au plus, sans aucun détail de la demande |
| Sur TEST : mon adresse | L'installation de TEST met ton adresse, celle des alertes. **Si c'est celle du compte Google de Loué lui-même**, je te le dirai : il faudra ajouter ton Outlook dans la case, sinon la corbeille ne serait pas essayée |
| Lien 7 jours, une seule réponse ; PDF pas rangé dans Drive, motif pas dans le Sheet | inchangé |
| Congés, École, Formation, plus RTT et Récupération ; le reste « Absent » | Fait (page, appli, planning). **J'ai ajouté une règle, dis-moi si elle te va** : une demande dont le motif ne dit rien et dont les heures sont prises sur le « repos compensateur » s'affiche « Récupération » (comme « congés payés » → « Congés »). Un motif de santé donne toujours « Absent », quoi qu'il soit coché |
| Le mail de la direction à la corbeille de Gmail | Fait. Le programme jette **exactement le message qu'il vient d'envoyer** (Gmail le lui rend à l'envoi) : jamais un mail reçu ni un autre mail. Si la direction est l'adresse du compte lui-même, le mail est gardé (le jeter le supprimerait de sa boîte). Google vide la corbeille au bout de 30 jours |
| Regroupement : groupe A, puis B, puis mail unique | Les trois livraisons sont refaites dans cet ordre, chacune contient la précédente |
| Le reste (8d, 12, 13 et le planning) : OK | — |

## 4. Ce que les relectures indépendantes ont trouvé (un tour chacune)

- **Lots 11.1 et 14, première version** : rien de bloquant ; cinq points importants corrigés. Une date d'un seul jour aurait été illisible. Un mail à la direction pouvait partir deux fois. Une absence pouvait s'inscrire sur la ligne d'un autre gars. « 901 R+1 » était coupé en deux.
- **Changements du 20/11** (tes réponses) : rien de bloquant ; cinq points importants corrigés :
  - la première façon de retrouver le mail à jeter (une recherche dans Gmail) pouvait jeter **une réponse de la direction** : remplacée par le message rendu à l'envoi ;
  - un mail pouvait rester dans « Messages envoyés » sans que personne ne le sache ;
  - une panne durable de Gmail ne te prévenait jamais ;
  - des motifs de santé (« Accidenté du travail », « Hospitalisé ») pouvaient donner « Congés » ;
  - l'essai sur TEST risquait de ne pas essayer la corbeille.
- Les relectures d'avant (8d, 12, 13, mail unique) : corrigées la semaine dernière.

## 5. À savoir

- **Le compteur de mails de Google** a baissé de 4 pour 2 mails pendant les essais du lot 8 : pas encore expliqué. À mesurer à part avant d'allumer le mail unique (son essai E4 le fait).
- **Une adresse de direction mal tapée mais bien formée** fait partir le mail sans erreur : vérifie-les bien en les écrivant.
- **Jamais vérifié, pour tous ces lots** : un vrai téléphone, le vrai Google, Outlook (les boutons du mail d'absence), une vraie impression A3.

## 6. Ce qui reste d'avant (rien n'est urgent)

- **Lot 4e** (images du carnet un peu plus compressées) : copie le PDF d'un plan chargé dans un dossier à part, donne-moi son chemin et dis « essai qualité » ; je le dépose deux fois sur la copie TEST, tu compares au zoom maximum sur le téléphone (`docs/lot4e-procedure.md`, branche `lot-4e`).
- **Essais sur la copie TEST avant de cocher en production** : « Mails envoyés de plus de 3 mois » et « Anciens indices du carnet » (onglet *Purges*).
- **iPhone** : `docs/essais-iphone.md`, 12 essais, avant la remise de l'appli aux poseurs.
- Les 3 PDF « COMPTE RENDU CHANTIER TEST AUTO » et les mails d'essai du lot 8 dans le compte de TEST : à supprimer quand tu veux.
- Au prochain bordereau des plans BAL (n° 108) : refaire le choix 6 du menu de `appli-pc` et ajouter 108 → 108 à sa table.
- `listerPartagesPlans` en production (lecture seule), puis le ménage des partages dans Drive.
- Lot 2 : `demarrerTransition` n'a pas été lancé en production.
- Copie TEST : supprimer les quatre onglets « … (ancienne version …) » ; CHANTIER TEST AUTO est resté à « Terminé ».
- **Planning, avant de commencer** : un numéro pour chaque chantier en cours (colonne E de l'onglet *Chantiers*) ; la note d'information aux salariés, avec la direction ; quel compte Google ouvre le Sheet au bureau ; qui lit la boîte du compte de Loué. L'atelier (lot 11.3) et la feuille d'heures ne sont pas construits.
- Les branches `lot-8d`, `lot-12`, `lot-13`, `lot-11`, `lot-10a1` et `lot-10a2` ne servent plus à livrer : elles sont toutes contenues dans les trois livraisons. Je ne les supprime pas.
