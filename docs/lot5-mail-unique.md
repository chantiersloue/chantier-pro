# « Un seul mail par fiche » — plan (lot 5b)

> Plan du 17/11/2026, **version 2** : la version 1 (16/11/2026, validée par toi) a été critiquée par un agent indépendant ; ce qui a changé est au chapitre 0. **Le serveur est construit et testé contre le faux Google ; rien n'a été essayé sur le vrai Google, et le mail unique est ÉTEINT tant que tu ne l'allumes pas.**
> Ta règle, mot pour mot : *« Il ne doit pas toucher à la protection du lot 0. Les adresses tapées à la main gardent leur mail séparé, avec le texte imposé, leur plafond (2 par fiche, 10 par jour) et la copie cachée au conducteur. Le mail unique ne concerne que les adresses connues du Sheet, en copie cachée. Si ce n'est pas compatible, garde le fonctionnement actuel. »*

## 0. Ce qui a changé depuis la version 1 (après la critique indépendante)

| N° | Version 1 | Version 2 | Pourquoi |
|---|---|---|---|
| 1 | Le faux Google (le programme qui imite Google pendant les tests) comptait « 1 mail = 1 destinataire, +1 s'il y a une copie cachée » | Il compte **chaque adresse réelle** de « À », « Copie » et « Copie cachée » (un « À » vide compte 0) et **refuse un mail à plus de 50 destinataires**, comme le vrai Google. Corrigé **avant** de toucher au serveur | sans ça, les tests du mail unique auraient compté faux et n'auraient rien prouvé |
| 2 | Une fonction `envoyerGroupe_` | Inchangé : `envoyer_`, `differer_` et la boucle des adresses tapées à la main ne sont **pas modifiées** ; les deux tests « photographie » du lot 0 passent **sans avoir été touchés** | ta règle |
| 3 | Un interrupteur écrit dans le code (`MAIL_UNIQUE = true`) | Un **réglage dans les « Propriétés du script »** (la petite liste de réglages du serveur, hors du code) : `MAIL_UNIQUE` = `non`, `cache` ou `conducteur`. **Absent ou inconnu = `non`** : le serveur fait exactement comme aujourd'hui | se change en 30 secondes, **sans recoller le serveur ni refaire un déploiement** ; et le serveur livré est éteint par défaut, parce que l'essai E1 (un mail sans « À ») n'a pas encore été fait sur le vrai Google |
| 4 | Un mail groupé en attente = une ligne groupée dans l'onglet *Mails en attente* ; `Admin.gs` modifié | **Aucune ligne groupée.** Dès que le mail groupé n'est pas possible, la fiche repasse par le chemin d'aujourd'hui (un mail par adresse). `Admin.gs` et l'onglet *Mails en attente* **ne changent pas** | moins de code nouveau sur le chemin le plus sensible ; le renvoi automatique reste celui qui tourne depuis le lot 0 |
| 5 | « Une ligne par adresse » dans la réponse | Précisé : après un mail groupé réussi, chaque adresse est comptée « envoyé » dans la réponse au téléphone ; le Journal fait comme aujourd'hui (rien pour une adresse connue servie) | le poseur lit toujours le bon nombre de personnes servies |
| 6 | Solution B : le conducteur ajouté en « À » (+1 destinataire s'il n'était pas dans la liste) | Doublons, conducteur déjà dans la liste : rien de nouveau (les doublons sont déjà retirés). En mode `conducteur`, le conducteur n'est mis en « À » que s'il est déjà destinataire ; sinon « À » vide. **Personne n'est jamais ajouté** | une fiche ne part pas à quelqu'un que personne n'a choisi |
| 7 | « Pages de l'appli : aucune » | **Faux** : la note de réunion annonçait « N mails partiront » et la fin d'envoi « N mails envoyés ». Les textes parlent maintenant de **destinataires** (vrai dans les deux modes). Donc une petite mise à jour des pages (appli 10.3) | ne pas afficher un nombre de mails faux |
| 8 | « `Purges.gs` à adapter » | **Rien à changer** : la ligne « Mails envoyés de plus de 3 mois » lit déjà « À », « Copie » et « Copie cachée ». Un test le prouve (`tests/lot5-mails.test.js`) | vérifié en lisant le code |
| 9 | « À faire avant le lot 8 » | Branche partie du lot 8 ; mise en service **une semaine après** le lot 8 (chapitre 9) | le lot 8 est prêt avant |

## 1. Le but

Aujourd'hui, une fiche envoyée à 4 adresses connues du Sheet donne **4 mails**, donc 4 copies du PDF gardées dans « Messages envoyés » de Gmail. Gmail partage les 15 Go du compte avec Drive.

Avec le mail unique : **1 mail**, avec les 4 adresses en **copie cachée** (aucun destinataire ne voit les autres). Une seule copie du PDF dans Gmail.

**Ce que ça rapporte** : la place prise par les mails de fiches est divisée par le nombre moyen de destinataires. **Le gain n'est pas chiffré** : je ne connais pas la place réelle de Gmail sur ton compte. **Avant la mise en service, regarde la ligne Gmail de l'onglet *Stockage*** : si Gmail ne pèse presque rien, ce lot peut attendre. Et la ligne « Mails envoyés de plus de 3 mois » de l'onglet *Purges* (lot 5) **borne déjà** cette place : les mails de fiches ne restent pas plus de 3 mois si tu coches la case. Le mail unique ne fait donc gagner que sur les 3 derniers mois.

**Ce que ça ne rapporte pas** : le quota. Google compte les **destinataires**, pas les mails : 4 copies cachées comptent pour 4, comme aujourd'hui.

## 2. Ce qui ne change pas (la protection du lot 0)

- Le chemin des **adresses tapées à la main** : un mail séparé par adresse, objet et texte imposés, 2 par fiche, 10 par jour, copie cachée au conducteur. La fonction `envoyer_`, la fonction `differer_` et la boucle des adresses libres de `distribuer_` **ne sont pas modifiées**.
- Les deux tests « photographie » (`tests/lot0.test.js`) passent **sans avoir été modifiés**.
- Les mails à toi (alertes, mails de purge, demandes d'absence) : inchangés.
- La réserve de 20 destinataires par jour gardée pour toi.
- L'onglet *Mails en attente* et le renvoi automatique toutes les 2 heures (`renvoyerMailsEnAttente`).

## 3. Les choix techniques

**3.1 Comment envoyer le groupe**

| Solution | Retenue ? | Raison |
|---|---|---|
| **Une nouvelle fonction `envoyerGroupe_`**, essayée avant la boucle des adresses connues | **oui** | la fonction protégée `envoyer_` n'est pas touchée ; le nouveau chemin se teste et se coupe à part |
| Ajouter un cas « plusieurs adresses » dans `envoyer_` | non | modifie la fonction que le lot 0 protège |

`envoyerGroupe_` répond « fait » ou « pas fait ». Si « pas fait », `distribuer_` exécute la boucle d'aujourd'hui, telle quelle.

**3.2 Le champ « À » (destinataire visible) : c'est le réglage `MAIL_UNIQUE`**

| Valeur | Ce que fait le serveur | Pour | Contre |
|---|---|---|---|
| `non` (ou rien, ou une valeur inconnue) | comme aujourd'hui : un mail par adresse connue | — | — |
| `cache` (solution A) | « À » vide, toutes les adresses connues en copie cachée | exactement ta consigne ; personne ne voit aucune adresse | à vérifier sur le vrai Google (essais E1 et E2) : Apps Script l'accepte-t-il ? le mail arrive-t-il en boîte de réception ? |
| `conducteur` (solution B) | « À » = le conducteur du chantier **s'il fait déjà partie des destinataires de la fiche**, les autres en copie cachée ; sinon (pas de conducteur connu, ou conducteur pas destinataire) : « À » vide | un mail « normal », jamais suspect ; personne n'est ajouté | l'adresse du conducteur est **visible** des autres. **Demande ton accord** |

La solution C de la version 1 (« À » = l'adresse du compte de l'appli) reste écartée : chaque fiche arriverait aussi dans la boîte de réception du compte, et la purge des mails ne la prendrait plus jamais.

**Je recommande `cache`, si les essais E1 et E2 réussissent ; sinon on en parle pour `conducteur`.**

**3.3 Quand le mail groupé n'est pas possible : retour au chemin d'aujourd'hui, pour cette fiche**

| Cas | Ce qui se passe |
|---|---|
| une seule adresse connue | un mail normal à cette adresse (rien à grouper) |
| plus de 40 adresses connues | un mail par adresse (Google refuse plus de 50 destinataires par mail ; 40 laisse de la marge) |
| quota du jour insuffisant pour tout le groupe, ou qui entamerait ta réserve de 20 | un mail par adresse : les premiers partent, les autres sont reportés ; sous la réserve, **ton** mail part quand même, comme aujourd'hui |
| Google refuse le mail groupé (erreur) | un mail par adresse, tout de suite ; une ligne « repli » dans l'onglet *Journal* le dit |

Les deux autres solutions de la version 1 restent écartées (tout reporter au lendemain ; couper le groupe en deux mails).

**3.4 Le mail en attente** : supprimé de ce plan. Il n'y a jamais de mail groupé en attente (voir 3.3).

**3.5 L'interrupteur** : c'est le réglage `MAIL_UNIQUE` (3.2). Retour arrière : remettre `non`. Effet immédiat, dès la fiche suivante.

## 4. Les endroits touchés

| Où | Changement |
|---|---|
| `tests/gas-harness.js` (le faux Google) | quota compté par adresse réelle ; refus au-delà de 50 destinataires ; refus d'un mail sans aucun destinataire |
| `apps-script/Securite.gs` | `distribuer_` : la ligne des adresses connues essaie d'abord `envoyerGroupe_` ; nouvelles fonctions `modeMailUnique_` (lit le réglage) et `envoyerGroupe_` |
| `apps-script/Config.gs` | version v11.2 ; `MAX_GROUPE_MAIL = 40` ; le réglage `MAIL_UNIQUE` expliqué avec les autres propriétés |
| `apps-script/Admin.gs` | `verifierConfig` affiche la valeur lue de `MAIL_UNIQUE` ; nouvelle fonction `essaiMailUnique` pour les essais E1, E4 et E5 (elle refuse de tourner hors de la copie TEST). Le renvoi des mails en attente n'est **pas** modifié |
| `apps-script/Api.gs` | réponse au téléphone et onglet *Envois* : « envoyé à N destinataire(s) » au lieu de « N mail(s) envoyé(s) » |
| `apps-script/Documents.gs` | un commentaire mis à jour (note de réunion) |
| `apps-script/Purges.gs` | **rien** (un test ajouté) |
| Pages | `note-reunion.html` et sa page de repli : « N destinataires » au lieu de « N mails partiront » ; `commun/ui.js` : « envoyé — N destinataires ». Appli 10.3 |
| Tests | nouvelle série `tests/lot5b-mail-unique.test.js` ; les anciennes séries ne changent que pour les textes et le numéro de version, **jamais pour le nombre de mails attendus** |
| Documents | `CHANGELOG.md`, `DECISIONS.md`, `docs/guide-utilisateur.md`, `docs/lot5b-procedure.md` |

## 5. Risques et parades

| Risque | Parade |
|---|---|
| Une fiche qui n'arrive pas, ou qui arrive deux fois | éteint par défaut ; essais sur la copie TEST avec tes seules adresses ; retour arrière en 30 secondes ; le repli par adresse n'est lancé que si le mail groupé n'est **pas** parti |
| Mail classé en indésirable (`cache`) | essai E2 sur Outlook et Gmail ; sinon `conducteur`, avec ton accord |
| Google refuse un « À » vide | essai E1 ; et même allumé par erreur, chaque fiche repasserait par le chemin d'aujourd'hui (ligne « repli » dans le Journal) |
| Une adresse fausse dans le groupe | essai E5 ; si Google lève une erreur, repli immédiat sur un mail par adresse : seule l'adresse fausse échoue |
| Quota mal compté | compté sur le nombre d'adresses **avant** l'envoi ; essai E4 |
| Un destinataire fait « Répondre à tous » | avec des copies cachées, la réponse ne va qu'à l'expéditeur : aucune fuite d'adresses |
| Lignes en attente écrites avant le changement | lues comme avant (le renvoi n'est pas modifié) : testé |
| La protection du lot 0 abîmée | tests « photographie » inchangés et verts |
| Le mail groupé contient l'adresse du compte de l'appli | la purge des mails ne le prend jamais (« ce compte est lui-même destinataire »), comme aujourd'hui pour le mail envoyé à cette adresse : pas pire qu'avant, testé |

## 6. Essais sur la copie TEST (ce que le faux Google ne peut pas dire) — **à faire avant de passer le réglage à `cache`**

Tous avec **tes adresses seulement** (aucun mail d'essai à quelqu'un d'autre). La marche à suivre est dans `docs/lot5b-procedure.md`.

| N° | Essai | Ce qu'on apprend |
|---|---|---|
| E1 | un mail sans « À », deux copies cachées, envoyé par `GmailApp.sendEmail` (la commande même qu'utilise le serveur) | Apps Script l'accepte-t-il ? Sinon : pas de `cache` |
| E2 | le même mail reçu sur ton Outlook et sur un Gmail | boîte de réception ou indésirables ; ce que le destinataire lit dans « À » |
| E3 | le mail groupé vu dans « Messages envoyés » | une seule copie du PDF ; les copies cachées y sont bien lisibles (la purge des mails en a besoin) |
| E4 | le quota avant et après un mail à 3 copies cachées | Google compte bien 3 |
| E5 | une adresse volontairement fausse dans le groupe | le mail part-il aux autres ? un message d'erreur revient-il ? |

## 7. Tests contre le faux Google (faits)

`tests/lot5b-mail-unique.test.js` : réglage `non`, absent ou inconnu = comportement d'aujourd'hui ; `cache` avec 1, 3, 10, 40, 41 et 60 adresses connues ; adresses connues **et** tapées à la main sur la même fiche ; quota suffisant, juste, insuffisant ; sous la réserve de 20 (toi servi, les autres reportés) ; échec du mail groupé (repli par adresse) ; fiche renvoyée deux fois ; ancienne ligne en attente renvoyée ; `conducteur` avec et sans conducteur connu ; note de réunion du lot 8 en `cache` (10 destinataires + le conducteur, PDF joint une seule fois). Plus un test de la purge des mails (`tests/lot5-mails.test.js`).

## 8. Ce que tu auras à faire

| Quand | Quoi | Durée |
|---|---|---|
| Avant | regarder la place de Gmail dans l'onglet *Stockage* (est-ce que ça vaut le coup ?) | 2 min |
| Essais | envoi sur la copie TEST ; essais E1 à E5 ; regarder tes deux boîtes | 30 min |
| Production | coller le serveur, `verifierConfig`, nouveau déploiement, me donner l'adresse ; le réglage reste `non` | 20 min |
| Allumage | ajouter la propriété `MAIL_UNIQUE` = `cache` ; envoyer une fiche ; vérifier | 5 min |

Pas de changement dans le Sheet. Les pages changent (deux textes) : les téléphones se mettent à jour tout seuls.

## 9. Quand le faire

La branche `lot-5b` part de la branche du lot 8 : elle contient donc le lot 8. **Mise en service une semaine après le lot 8**, pour ne pas avoir deux changements d'envoi en même temps (en cas de souci, on sait lequel est en cause). Tant que le réglage reste à `non`, livrer ce serveur ne change rien à l'envoi des mails.
