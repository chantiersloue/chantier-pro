# « Un seul mail par fiche » — plan (lot 5b)

> Plan du 16/11/2026, **version 1, pas encore critiquée par un agent indépendant. Rien n'est construit.**
> Remplace la note du 16/11 (« note avant de coder »). Ta règle, mot pour mot : *« Il ne doit pas toucher à la protection du lot 0. Les adresses tapées à la main gardent leur mail séparé, avec le texte imposé, leur plafond (2 par fiche, 10 par jour) et la copie cachée au conducteur. Le mail unique ne concerne que les adresses connues du Sheet, en copie cachée. Si ce n'est pas compatible, garde le fonctionnement actuel. »*

## 1. Le but

Aujourd'hui, une fiche envoyée à 4 adresses connues du Sheet donne **4 mails**, donc 4 copies du PDF gardées dans « Messages envoyés » de Gmail. Gmail partage les 15 Go du compte avec Drive : c'est le poste qui grossit le plus vite.

Demain : **1 mail**, avec les 4 adresses en **copie cachée** (aucun destinataire ne voit les autres). Une seule copie du PDF dans Gmail.

**Ce que ça rapporte** : la place prise par les mails est divisée par le nombre moyen de destinataires (environ 3). **Ce que ça ne rapporte pas** : le quota. Google compte les **destinataires**, pas les mails : 4 copies cachées comptent pour 4, comme aujourd'hui.

## 2. Ce qui ne change pas (la protection du lot 0)

- Le chemin des **adresses tapées à la main** : un mail séparé par adresse, objet et texte imposés, 2 par fiche, 10 par jour, copie cachée au conducteur. La fonction `envoyer_` et la boucle des adresses libres de `distribuer_` **ne sont pas modifiées**.
- Le test « photographie du chemin des adresses tapées à la main » (`tests/lot0.test.js`) doit passer **sans être modifié**. S'il faut le toucher, on arrête : c'est ta clause « si ce n'est pas compatible ».
- Les mails à toi (alertes, mails de purge, demandes d'absence) : inchangés.
- La réserve de 20 destinataires par jour gardée pour toi.

## 3. Les choix techniques

**3.1 Comment envoyer le groupe**

| Solution | Retenue ? | Raison |
|---|---|---|
| **Une nouvelle fonction `envoyerGroupe_`**, appelée à la place de la boucle des adresses connues | **oui** | la fonction protégée `envoyer_` n'est pas touchée ; le nouveau chemin se teste et se coupe à part |
| Ajouter un cas « plusieurs adresses » dans `envoyer_` | non | modifie la fonction que le lot 0 protège |

**3.2 Le champ « À » (destinataire visible)**

Un mail a normalement un destinataire visible. Trois possibilités :

| Solution | Pour | Contre |
|---|---|---|
| **A. « À » vide**, copies cachées seulement (le destinataire lit « destinataires non divulgués ») | exactement ta consigne ; personne ne voit aucune adresse ; aucun destinataire en plus | à vérifier sur le vrai Google : Apps Script l'accepte-t-il ? certaines messageries classent-elles ces mails en indésirables ? |
| **B. « À » = le conducteur du chantier** (toi en repli) | un mail « normal », jamais suspect | l'adresse du conducteur est visible des autres ; +1 destinataire quand il n'était pas dans la liste |
| C. « À » = l'adresse du compte de l'appli | simple | chaque fiche arriverait aussi dans la boîte de réception du compte : la ligne « Mails envoyés de plus de 3 mois » ne la prendrait plus jamais. **Écartée** |

**Je recommande A, si l'essai E1 (chapitre 6) réussit ; sinon B.** C'est le seul point où ta décision peut être demandée, et seulement si A échoue.

**3.3 Quand le quota du jour ne suffit pas pour tout le groupe**

| Solution | Retenue ? | Raison |
|---|---|---|
| **Revenir, pour cette fiche, au fonctionnement d'aujourd'hui** (un mail par adresse : les premiers partent, les autres sont reportés) | **oui** | cas rare ; code déjà en service et déjà testé ; personne n'attend à cause des autres |
| Tout reporter au lendemain | non | 4 personnes attendent alors qu'il restait 3 envois |
| Couper le groupe en deux mails | non | le cas le plus compliqué, pour un gain nul |

**3.4 Le mail en attente** (onglet *Mails en attente*)

| Solution | Retenue ? | Raison |
|---|---|---|
| **Une ligne par mail groupé**, toutes les adresses dans la colonne « Copie cachée » | **oui** | le renvoi automatique sait déjà lire cette colonne ; les lignes déjà en attente (une adresse) restent valables : rien à migrer |
| Une ligne par adresse, comme aujourd'hui | non | le renvoi redonnerait un mail par adresse |

**3.5 L'interrupteur**

Une constante `MAIL_UNIQUE = true` dans `Config.gs`. À `false`, le serveur reprend exactement le chemin d'aujourd'hui. C'est le retour arrière : une ligne à changer, sans toucher aux pages.

## 4. Les endroits touchés

| Où | Changement |
|---|---|
| `apps-script/Securite.gs` | `distribuer_` : une ligne remplacée (la boucle des adresses connues appelle `envoyerGroupe_`) ; nouvelle fonction `envoyerGroupe_` (quota du groupe, envoi, journal, report) |
| `apps-script/Admin.gs` | `renvoyerMailsEnAttente` : compter **tous** les destinataires d'une ligne (aujourd'hui : 1 + la copie cachée), pour ne pas dépasser le quota |
| `apps-script/Config.gs` | la constante `MAIL_UNIQUE` |
| Journal et réponse au téléphone | **une ligne par adresse**, comme aujourd'hui : le poseur doit lire « envoyé à 4 personnes », pas « à 1 » |
| `apps-script/Purges.gs` | la ligne « Mails envoyés de plus de 3 mois » reconnaît un mail d'après ses destinataires : à adapter aux copies cachées (essai E3) |
| Pages de l'appli | **aucune** |
| Tests | séries des lots 0, 1, 2 et 7 : les attentes « un mail par adresse connue » deviennent « un mail, N copies cachées » ; le test « photographie » du lot 0 reste tel quel |
| Documents | `CHANGELOG.md`, `docs/guide-utilisateur.md` (une phrase : « les destinataires ne se voient pas entre eux »), `docs/structure-sheet.md` (onglet *Mails en attente*) |

## 5. Risques et parades

| Risque | Parade |
|---|---|
| Une fiche qui n'arrive pas, ou qui arrive deux fois | interrupteur ; essais sur la copie TEST avec tes seules adresses ; relecture indépendante (changement sur l'envoi des mails : relecture obligatoire) |
| Mail classé en indésirable (solution A) | essai E2 sur Outlook et Gmail ; sinon solution B |
| Une adresse fausse fait échouer tout le groupe | à l'échec du mail groupé, repli immédiat sur un mail par adresse pour cette fiche : seule l'adresse fausse échoue |
| Quota mal compté | compté sur le nombre d'adresses avant l'envoi ; essai E4 |
| Un destinataire fait « Répondre à tous » | avec des copies cachées, la réponse ne va qu'à l'expéditeur : aucun risque de fuite d'adresses |
| Lignes en attente écrites par l'ancien serveur | restent lisibles (une adresse, pas de copie cachée) : testé |
| La protection du lot 0 abîmée | test « photographie » inchangé ; s'il casse, on arrête |

## 6. Essais sur la copie TEST (ce que le faux serveur ne peut pas dire)

Tous avec **tes adresses seulement** (aucun mail d'essai à quelqu'un d'autre).

| N° | Essai | Ce qu'on apprend |
|---|---|---|
| E1 | un mail sans « À », deux copies cachées | Apps Script l'accepte-t-il ? Sinon : solution B |
| E2 | le même mail reçu sur ton Outlook et sur un Gmail | boîte de réception ou indésirables ; ce que le destinataire lit dans « À » |
| E3 | le mail groupé vu dans « Messages envoyés » | une seule copie du PDF ; les en-têtes que la ligne « Mails de plus de 3 mois » doit lire |
| E4 | le quota avant et après un mail à 3 copies cachées | Google compte bien 3 |
| E5 | une adresse volontairement fausse dans le groupe | le mail part-il aux autres ? un message d'erreur revient-il ? |

## 7. Tests contre le faux serveur

Un mail pour 1, 3 et 10 adresses connues ; adresses connues **et** tapées à la main sur la même fiche (1 mail groupé + les mails séparés, inchangés) ; quota suffisant, juste, insuffisant (repli) ; sous la réserve de 20 ; mail groupé reporté puis renvoyé ; ancienne ligne en attente renvoyée ; fiche renvoyée deux fois (aucun second mail) ; interrupteur à `false` (les anciennes séries passent telles quelles) ; échec de l'envoi groupé (repli par adresse).

## 8. Ce que tu auras à faire

| Quand | Quoi | Durée |
|---|---|---|
| Avant | dire « d'accord » sur ce plan (ou tes remarques) | 5 min |
| Essais | un envoi sur la copie TEST ; regarder tes deux boîtes (E2) | 15 min |
| Production | coller le serveur, `verifierConfig`, nouveau déploiement, me donner l'adresse | 20 min |

Pas de changement dans le Sheet, pas d'installation, pas de page à mettre à jour sur les téléphones.

## 9. Quand le faire

Après la mise en service du lot 5 et **avant** le lot 8 de préférence : le lot 8 touche aussi l'envoi de la note de réunion, et deux changements d'envoi en même temps seraient difficiles à démêler en cas de souci. Durée estimée : une soirée de construction, une relecture, 15 minutes d'essais avec toi.
