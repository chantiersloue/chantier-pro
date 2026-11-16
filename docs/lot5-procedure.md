# Lot 5 — Suivi du stockage et purge : procédure de déploiement, d'essai et d'utilisation

> Pour Franck. Le lot 5 passe le serveur en **v10.0**. **Aucune page de l'appli ne change** : tout se passe dans le Sheet.
> **État : construit et testé contre le faux serveur seulement.** Rien n'a encore tourné chez Google, ni sur la copie TEST, ni en production.
> **Ne passe à l'étape suivante que si la précédente est verte.** Sinon : arrête-toi et envoie-moi une capture.
> Plan : `docs/lot5-plan.md`. Outillage : `docs/guide-outillage.md`. Colonnes des onglets : `docs/structure-sheet.md`.

## Ce que le lot 5 change, en bref

- Le compte Google gratuit a **15 Go pour Drive, Gmail et Photos ensemble**. S'il est plein, plus aucun fichier ne se crée dans Drive et **plus aucun mail ne part ni n'arrive** (les fiches resteraient dans les téléphones, sans être perdues).
- Un onglet ***Stockage*** : où en est la place, ce que pèse chaque chantier, et **combien de chantiers en cours tiennent encore** avant l'alerte (ton objectif : 35 à 40 chantiers en cours en même temps). Rempli chaque nuit.
- Des **mails d'alerte** à **80 %** (il est temps de purger) et à **95 %** (urgent).
- Un onglet ***Purges*** : ce qui **peut** être mis à la corbeille de Drive, avec une case à cocher. **Rien ne part sans ta case.**
- Un onglet technique ***Purges détail*** : la liste exacte de ce que chaque purge a mis à la corbeille.
- La colonne **Date « Terminé »** de l'onglet *Chantiers* se remplit toute seule quand tu passes un chantier à « Terminé » (et s'efface si tu changes d'avis).

### Les quatre règles de sécurité

1. **Jamais de suppression définitive par l'appli.** Elle met à la **corbeille de Drive**, qui garde les fichiers 30 jours. Pendant 25 jours, la case « Annuler » remet tout en place.
2. **Jamais sans ta case cochée**, et tout est revérifié au moment où la case est traitée.
3. **Une fiche ne part à la corbeille que si elle est dans le dossier du chantier sur le PC** : l'appli la compare, une par une (même nom, même taille), au relevé `releve-pc.json` écrit par le programme du PC. MEGA, lui, sauvegarde ce dossier du PC : l'appli ne parle pas à MEGA.
4. **Le carnet, lui, part sans comparaison avec le PC.** Les images du carnet (anciens indices, ou carnet d'un chantier terminé) sont fabriquées à partir des PDF du dossier du chantier sur le PC : l'appli ne vérifie pas que ces PDF y sont encore. Si tu as un doute sur un plan, regarde dans le dossier du chantier avant de cocher. Un dossier du carnet modifié depuis moins de 24 heures (dépôt en cours) n'est jamais touché.

Quelques mots utilisés plus bas :
- **déclencheur** : un réveil qui lance une fonction du serveur tout seul (la nuit, toutes les 30 minutes…) ;
- **relevé** : le fichier `releve-pc.json` que la recopie automatique du PC (toutes les heures) pose dans le dossier Drive du chantier ; il liste les fiches présentes dans le dossier du chantier sur le PC, et il est refait au moins une fois par jour ;
- **ancien indice** : une ancienne version d'un plan du carnet (indice A quand l'indice B est déposé). L'appli ne la montre plus.

## Étape A — Copie TEST (toi : 2 minutes par envoi)

1. Si tu l'avais désactivée : réactive **« API Google Apps Script »** sur `script.google.com/home/usersettings`.
2. Quand je te le demande, dans PowerShell :
   ```
   cd $HOME\Documents\GitHub\chantier-pro
   ```
   ```
   node outils\envoyer-test.js --avec-porte
   ```
   Page Google → compte de Loué → **Autoriser**. Attends `✅ Envoi réussi`, puis dis-moi « envoi fait ».
3. Je fais sans toi : l'installation (`installerLot5` : les trois onglets ; **aucun déclencheur** sur la copie TEST hors essais), une première mesure, et la lecture du chiffre de place.
4. **Ensemble, le chiffre de Google.** Ouvre `one.google.com/storage` avec le compte de Loué et dis-moi le total affiché. Je le compare à celui de l'onglet *Stockage*.
   - S'ils sont proches : rien à faire.
   - S'ils diffèrent (Gmail ou Photos non comptés) : on active le **service avancé Drive**, une fois, dans l'éditeur Apps Script du projet TEST : colonne de gauche → **Services** (le « + ») → **Drive API** → **Ajouter**. Puis je relance la mesure : la ligne « D'où vient ce chiffre » doit dire « Service avancé Drive ». Si Google te demande une nouvelle autorisation à ce moment-là, dis-le-moi avant d'accepter.

## Étape B — Tes essais sur la copie TEST (20 min, depuis le téléphone)

Ouvre le Sheet **ChantierPro TEST** dans l'appli Google Sheets du téléphone. Nous aurons préparé ensemble un faux chantier terminé (« CHANTIER TEST AUTO ») : quelques fiches envoyées depuis l'appli d'essai, un petit document au carnet, la date « Terminé » reculée de 2 mois dans l'onglet *Chantiers*, et son relevé `releve-pc.json` (aucun outil d'essai n'écrit ces fichiers dans Drive à ta place : je te guiderai).

| N° | Essai | Ce que tu dois voir |
|---|---|---|
| 1 | Onglet *Stockage*, le haut | La place utilisée en Go et en %, la date de la mesure, « Tout va bien » ; la ligne « D'où vient ce chiffre » |
| 2 | Onglet *Stockage*, le tableau | Une ligne par chantier avec son poids ; les lignes « Dossiers techniques », « Dossiers de la racine rattachés à aucun chantier », « Chantiers sans dossier », « Reste du compte » |
| 3 | Onglet *Purges* | Une ligne « Chantier terminé » pour CHANTIER TEST AUTO, « Possible ? » = oui, avec le nombre de fichiers |
| 4 | Coche **« Mettre à la corbeille »** sur cette ligne. Dis-moi « coché » : je lance le traitement (sur TEST, le déclencheur n'est posé que pendant l'essai) | « État » passe à « Fait » ; les dates « Mis à la corbeille le », « Place libérée le », « Annulation possible jusqu'au » ; **tu reçois un mail** |
| 5 | Dans Drive (dossier CHANTIERPRO-TEST → CHANTIER TEST AUTO) | Les fiches et les photos ne sont plus là ; **les dossiers sont toujours là**, vides ; le fichier `releve-pc.json` est toujours là ; la corbeille de Drive contient les fichiers |
| 6 | Coche **« Annuler »** sur la même ligne, dis-moi « coché » | « État » = « Annulé », le message dit combien de fichiers sont revenus ; dans Drive, tout est de nouveau à sa place |
| 7 | Coche **les deux cases** d'une ligne | Rien n'est fait ; le message le dit ; les deux cases sont décochées |
| 8 | Trie l'onglet *Purges* (par chantier, par poids), puis recoche une case | La bonne ligne est traitée quand même |

Deux choses ne se vérifient que là, sur le vrai Google, et je les regarderai avec toi : **ce que devient le contenu d'un dossier mis à la corbeille** (les anciens indices du carnet partent par dossier entier) et **sa restauration** ; et **la durée d'une mesure complète**.

Quand tout est vert, écris-moi : **« Lot 5 validé sur TEST »**. Je retire alors les déclencheurs d'essai de la copie TEST.

## Étape C — Mise en production (toi : 15 min, au bureau)

**Avant** : télécharge une copie du Sheet de production (Fichier → Télécharger → Microsoft Excel) dans `_prive/` : c'est la sauvegarde.

1. Récupère la dernière version du dépôt (branche fusionnée par mes soins après ton feu vert).
2. Ouvre `A-COLLER-DANS-APPS-SCRIPT/Code.gs`, sélectionne tout, copie.
3. Éditeur Apps Script de la **production** → fichier `Code.gs` → sélectionne tout → colle → **Enregistrer**.
4. Si l'étape A a montré qu'il fallait le service avancé Drive : **Services** (le « + ») → **Drive API** → **Ajouter**.
5. En haut, choisis la fonction **`installerLot5Production`** → **▶ Exécuter**. Le journal doit finir par `✅ Lot 5 : installation terminée`, puis donner la place du compte. Elle crée les trois onglets et pose les déclencheurs (mesure la nuit vers 2 h et 3 h, traitement des cases toutes les 30 minutes).
6. Choisis **`verifierConfig`** → **▶ Exécuter** : aucune ligne ❌.
7. **Déployer → Nouveau déploiement** → type « Application Web », description **« Lot 5 — production »**, exécuter en tant que **moi**, accès **Tout le monde** → Déployer. Ouvre la nouvelle adresse : elle doit afficher **`Loué App API v10.0 OK`**.
8. Donne-moi la nouvelle adresse : je la mets dans `commun/config.js` (le seul endroit où elle est écrite) et je publie.
9. Pour ne pas attendre la nuit : fonction **`mesurerStockage`** → **▶ Exécuter**. Si le journal dit « À suivre », relance-la jusqu'à « Tour de mesure terminé ».

**Aucun essai de purge en production.** La première vraie purge, c'est toi qui la feras, sur un chantier que tu choisis, après avoir regardé les onglets.

## Lire l'onglet « Stockage »

**En haut** (colonne B) :

| Ligne | Ce que ça dit |
|---|---|
| Stockage du compte Google | L'état en une phrase : « Tout va bien : 41 % (alerte à 80 %) », « Attention : 82 % », « URGENT : 96 % », ou « Mesure en cours : 12 dossier(s) sur 31 » |
| Place utilisée | En Go, sur 15 Go, et en % |
| Mesurée le | La date de ce chiffre |
| D'où vient ce chiffre | « Service avancé Drive » (total du compte, sûr) ou « DriveApp » (à comparer avec one.google.com/storage) |
| Dont Drive / Dont Gmail et Photos / Dont corbeille de Drive | Connus seulement avec le service avancé Drive |
| Dossiers de l'appli | Le poids de tout ce que l'appli range dans Drive, et la date du dernier tour complet |
| Chantiers en cours | Le nombre de chantiers au statut « En cours » dans l'onglet *Chantiers* |
| Poids moyen d'un chantier en cours | Après un tour de mesure complet : la moyenne des chantiers en cours mesurés |
| Place pour d'autres chantiers | « À ce rythme, place pour environ n chantiers en cours de plus avant 80 % ». Calcul prudent : chaque nouveau chantier est compté une fois et demie le poids moyen d'aujourd'hui (un chantier en cours est à mi-parcours, il pèsera plus à sa clôture). Vide si les données manquent |
| À savoir | Le rappel sur Gmail (voir plus bas) |

**Le tableau** : une ligne par chantier — statut, date « Terminé », poids total en Mo, dont carnet, fiches, photos, autres ; nombre de fichiers ; date du dernier dépôt au carnet ; anciens indices (nombre et poids) ; **date de la mesure de cette ligne** ; ce que dit l'onglet *Purges* pour ce chantier.

- Tu peux **trier** le tableau. Ne modifie pas les cellules (Google t'avertit si tu essaies), surtout pas la colonne « Clé ».
- « **Reste du compte** » = place totale − ce qui a été mesuré dans les dossiers de l'appli : c'est Gmail, Photos, la corbeille et les autres fichiers du compte. Il n'est calculé qu'après un tour complet.
- Les documents Google (Sheets, Docs) pèsent 0 : c'est normal, Google ne les compte pas.
- Une mesure complète peut prendre plusieurs nuits s'il y a beaucoup de chantiers : chaque ligne porte sa propre date.

## Lire l'onglet « Purges », cocher, annuler

**À savoir avant tout** : la case « Mettre à la corbeille » n'agit que sur une ligne dont l'état est **« Proposé »**. Sur toute autre ligne, elle est décochée avec le message « attends la prochaine mesure ». Ce que tu lis à l'écran est donc toujours ce qui sera fait.

Une ligne par chose qui **peut** partir à la corbeille :

- **« Anciens indices du carnet »** : les anciennes versions des plans, que l'appli ne montre plus. Les PDF d'origine sont dans le dossier du chantier sur le PC. Possible à tout moment, même sur un chantier en cours.
- **« Chantier terminé »** : les fiches, les photos et le carnet d'un chantier « Terminé » depuis au moins **30 jours**.

| Colonne | Ce que ça dit |
|---|---|
| Possible ? | « oui » ou « non » |
| Pourquoi (ou ce qui manque) | Si c'est non : ce qui manque **et quoi faire** (« 3 fiche(s) absente(s) du relevé : vérifiez que la recopie automatique tourne sur le PC (fichier « CHANTIERPRO - A VOIR.txt »), puis attendez la prochaine mesure ») |
| Mettre à la corbeille | **La case que tu coches** |
| État | Proposé, Impossible, En cours, Fait, Annulé |
| Message | Ce que le serveur a fait la dernière fois sur cette ligne |
| Mis à la corbeille le / Fichiers mis à la corbeille | Remplis après la purge |
| Place libérée le | **30 jours plus tard** (à partir de là pour les premiers fichiers partis) : tant qu'un fichier est dans la corbeille, il compte dans les 15 Go |
| Annuler | La case pour tout remettre en place |
| Annulation possible jusqu'au | 25 jours après les **premières** mises à la corbeille de cette purge (une grosse purge peut durer plusieurs jours : Google, lui, supprime chaque fichier 30 jours après SA mise à la corbeille) |

### Avant de cocher une purge de chantier terminé

1. Onglet ***Dossiers chantiers*** : la ligne du chantier ne doit pas porter « À vérifier ». Si elle le porte, ouvre le dossier dans Drive, vérifie que c'est bien celui du chantier, puis **efface la cellule « À vérifier »**. (L'appli ne prend jamais un dossier « par ressemblance de nom » pour une purge.)
2. **La recopie automatique du PC doit tourner** (elle recopie toutes les heures les fiches de Drive dans les dossiers de chantier du PC, et refait le relevé) : le relevé doit avoir **moins de 7 jours** pour que la purge soit proposée, et **moins de 48 heures** au moment où la case est traitée. Si la ligne dit que le relevé est trop vieux : sur le PC, ouvre le fichier **« CHANTIERPRO - A VOIR.txt »**, qui dit ce qui ne va pas.
3. Sur le PC, **vérifie que MEGA a fini de synchroniser le dossier du chantier** (icône de MEGA : « à jour »). Le relevé prouve que les fiches sont sur le PC, pas que MEGA les a déjà sauvegardées.
4. Attends la mesure de la nuit (ou lance `mesurerStockage`) : la ligne doit dire « Possible ? oui ».

### Cocher

Coche « Mettre à la corbeille ». Dans la demi-heure :
- le serveur **revérifie tout** ; si une condition ne tient plus, rien n'est fait, la case est décochée et la ligne dit pourquoi ;
- sinon : **les fiches et les photos partent une par une** (seulement celles qui viennent d'être comparées au relevé ; une fiche arrivée entre-temps n'est pas touchée) ; **les dossiers restent**, vides ; puis le carnet (le dossier de chaque document, la liste `carnet.json` en dernier) ;
- **ne partent jamais** : le dossier du chantier, le relevé `releve-pc.json`, et tout ce qui est rangé hors des dossiers de l'appli (un dossier « Divers » à toi, par exemple) ;
- **tu reçois un mail** : quoi, combien de fichiers, comment annuler, jusqu'à quand.

Si une fiche arrive plus tard d'un téléphone, elle retrouve son dossier, est rangée normalement, et sera proposée sur une nouvelle ligne après le prochain passage du programme du PC.

### Annuler

Coche « Annuler » sur la ligne, dans les **25 jours**. Dans la demi-heure, tout ce que la ligne avait mis à la corbeille en ressort. Le message dit combien de fichiers sont revenus et, s'il y en a, **combien n'ont pas pu revenir** (corbeille vidée à la main entre-temps) ; ceux-là sont listés dans *Purges détail*, et ils sont dans le dossier du chantier sur le PC.

Entre le 26e et le 30e jour, c'est encore possible **à la main** dans la corbeille de Drive (clic droit → Restaurer), avec la liste de *Purges détail*.

### Ce que la ligne peut te dire d'inhabituel

| Message | Ce qui s'est passé, et quoi faire |
|---|---|
| « Cette ligne avait été mélangée (tri d'une partie des colonnes ?) » | Tu as trié une partie des colonnes sans la colonne « Clé » : la ligne n'affichait plus le bon chantier. Rien n'a été fait. Pour trier, sélectionne **toutes** les colonnes (ou utilise un filtre). Attends la prochaine mesure, puis recoche |
| « Cette ligne existe en double (copier-coller ?) » | Supprime la copie, puis recoche |
| « Temps de purge du jour épuisé (30 minutes par jour) : la suite demain » | Normal sur une grosse purge : le serveur garde du temps pour les fiches. Elle reprend toute seule le lendemain. « Annuler », lui, n'attend jamais |
| « Le dossier d'un autre chantier (« … ») est rangé dans ce dossier » | Un dossier de chantier a été glissé dans celui-ci, dans Drive. Sors-le de là : tant qu'il y est, rien n'est proposé |
| « ⚠ Cette purge a emporté les images d'un document que l'appli montre de nouveau » | Tu as purgé un ancien indice, puis retiré le nouvel indice : l'appli remontre l'ancien, dont les images sont à la corbeille. Le message est écrit **sur la ligne « Fait » à annuler** (et l'onglet *Stockage* donne sa date) : coche « Annuler » sur cette ligne-là, ou redépose le document |
| « Ligne remise en ordre : une purge avait commencé sur cette ligne » | Une purge avait été coupée ; le serveur a retrouvé dans son journal ce qui était parti. La ligne est « Fait » : tu peux annuler normalement |

Si tu coches « Annuler » pendant qu'une grosse purge est « En cours », elle s'arrête là, et ce qui était déjà parti revient.

### Si la place presse avant 30 jours

L'appli ne vide jamais la corbeille. Si tu as besoin de la place tout de suite : ouvre la corbeille de Drive, **sélectionne les fichiers voulus** et supprime-les. **N'utilise pas « Vider la corbeille »** : cela supprimerait aussi les autres purges encore annulables.

## Les mails d'alerte

| Seuil | Mail | Combien |
|---|---|---|
| 80 % | « Place Google : 82 % utilisés » | Un mail quand le seuil est franchi, puis un par mois au plus tant que la place reste au-dessus |
| 95 % | « URGENT — place Google presque pleine » | Toujours envoyé quand le seuil est franchi, puis un rappel par semaine tant que cela dure |

Si la place est déjà au-dessus d'un seuil le jour de l'installation, le mail part à la première mesure. Si un mail ne peut pas partir (panne, quota du jour épuisé), il repart à la mesure suivante.

## La ligne « Mails envoyés de plus de 3 mois »

Chaque fiche envoyée par mail reste aussi, avec son PDF, dans **« Messages envoyés »** de Gmail, qui compte dans les 15 Go. **La purge de Drive ne libère pas cette part.** D'après l'estimation, c'est ce qui remplirait le compte en deux à trois ans.

**Ce que tu verras** : dans l'onglet *Purges*, **une seule ligne** « Mails envoyés de plus de 3 mois », chantier « (tout le compte) », proposée par la mesure de la nuit quand il y a quelque chose à gagner : le nombre de mails (« au plus », c'est une estimation) et leur poids (estimé).

**Quels mails, et seulement ceux-là** (choix prudent, que tu pourras élargir) : les mails des **fiches de chantier** dont le PDF est rangé dans le dossier Drive de leur chantier.
- un mail **envoyé par l'appli** : dans « Messages envoyés », envoyé par ce compte sous le nom « Loué Menuiserie » ;
- son objet est celui d'une **fiche de chantier** : note de réunion, bordereau (organigramme, matériaux), quitus, prise de cotes, fiche de fabrication, réception de support, attestation, signalement ;
- l'objet nomme un **chantier de l'onglet *Chantiers*** dont le dossier Drive est sûr, et **le PDF de la fiche est retrouvé dans ce dossier** (un fichier de la même taille que la pièce jointe) ;
- **avec une pièce jointe**, et de **plus de 90 jours**.

Pour ces mails-là, la phrase de la ligne est vraie : **les PDF de ces fiches sont rangés dans le Drive et recopiés dans le dossier du chantier sur le PC**.

**Ne sont jamais visés** :
- les **demandes d'absence** (leur PDF est rangé hors chantier et n'est pas recopié sur le PC) ;
- une fiche d'un **chantier inconnu** (rangée dans « _À CLASSER ») ou dont le **rangement dans Drive a échoué** : son PDF n'existe peut-être que dans le mail. Dans le doute, le mail reste ;
- les mails d'un chantier **déjà purgé de Drive** : **purge donc les mails avant de purger un chantier terminé** (sinon ses mails restent, sans danger) ;
- un mail reçu, une réponse, un transfert (« TR: », « RE: »), un brouillon ;
- un mail avec une **étoile**, marqué **« Important »**, ou portant **un libellé** ;
- un mail qui est aussi dans la boîte de réception, ou dont ce compte est lui-même destinataire ;
- les mails envoyés aux adresses tapées à la main (objet « Loué Menuiserie — … ») ;
- les mails d'alerte de l'appli (pas de pièce jointe).

Le serveur agit **mail par mail**, jamais par conversation : une réponse reçue dans la même conversation n'est pas touchée.

**Avant de cocher** :
1. Demande-toi si tu as encore besoin de **retrouver ces mails dans Gmail** (à qui la fiche est partie, et quand).
2. Si un mail compte pour toi, **mets-lui une étoile ou un libellé** dans Gmail : il ne partira jamais.
3. Si tu écris toi-même, depuis ce compte, des mails dont l'objet commence par « [Loué App] », dis-le-moi d'abord.

**Quand tu coches** : dans la demi-heure, les mails partent à la **corbeille de Gmail**, par passages (200 mails lus par passage, 30 minutes par jour au plus : une grosse première purge prend plusieurs jours ; la ligne dit « En cours », puis « la suite demain », avec le nombre déjà parti). Tu reçois un mail de compte rendu à la fin. **Gmail vide sa corbeille 30 jours après chaque mise à la corbeille** : la ligne donne la date pour les **premiers** mails partis. Dans *Purges détail* (type « mail ») : l'identifiant, la date et le début de l'objet des mails partis, et rien des autres.

**Annuler** : la case « Annuler », jusqu'à la date écrite sur la ligne (**25 jours après les premières mises à la corbeille**, même si la purge a duré plusieurs jours) : les mails ressortent de la corbeille et retrouvent leur place dans « Messages envoyés ».

**Sur la copie TEST** : elle est dans le même compte Google que la production, et rien ne distingue leurs mails. Sur TEST, la ligne ne vise donc que les mails dont l'objet contient « CHANTIER TEST AUTO » (le chantier d'essai). Pour l'essai, je réduirai l'âge de 90 jours à 1 jour par un réglage qui n'existe que sur TEST.

**Autorisations — à constater, rien n'est acquis** : cette ligne se sert du « service avancé Gmail » d'Apps Script. Je ne peux pas savoir d'ici s'il est activé sur tes deux projets (TEST et production). `verifierConfig` le dit : « ✅ Service avancé Gmail » ou « ➖ … absent ». S'il est absent, la ligne n'est simplement pas proposée ; pour l'activer, une fois : éditeur Apps Script → **Services** (le « + ») → **Gmail API** → **Ajouter**. **Si Google te demande une nouvelle autorisation, ne l'accepte pas sans m'en parler.**

Si tu préfères le faire à la main un jour : dans Gmail, cherche `in:sent has:attachment older_than:3m`, coche, corbeille.

## La date « Terminé », en pratique

- Tu passes un chantier à « Terminé » : la date du jour s'écrit toute seule dans la colonne J (la nuit suivante). Tu peux la corriger à la main : **sur un chantier « Terminé », ta date n'est jamais remplacée**.
- Tu repasses le chantier à un autre statut : **la date est effacée, même si c'est toi qui l'avais tapée**. C'est voulu : le délai de 30 jours repart de zéro à la prochaine clôture.
- « terminé » ou « TERMINÉ » sont compris comme « Terminé ».

## À vérifier sur la copie TEST, avec moi, avant toute production (ce que le faux serveur ne peut pas dire)

1. **`verifierConfig`** : la ligne « Service avancé Gmail » dit-elle « présent » ? Une autorisation est-elle demandée ? **Ne l'accepte pas sans m'en parler.**
2. **Les en-têtes que Gmail nous rend** : « Loué Menuiserie » et « [Loué App] » contiennent un « é ». S'ils reviennent encodés (`=?UTF-8?…`), aucun mail ne passera jamais la règle : sans danger, mais la ligne ne servirait à rien, et il faudra que je décode.
3. **La recherche** : `subject:"[Loué App]"`, `before:AAAA/MM/JJ` (jour entier, dans le fuseau de Google), `-bcc:`. On compare le nombre proposé par la ligne à une recherche faite à la main dans Gmail.
4. **L'essai des mails prend trois jours** : avec le réglage de TEST à 1 jour, il faut des mails « CHANTIER TEST AUTO » vieux d'au moins deux jours pleins. On envoie les fiches d'essai le premier jour, on coche le troisième.
5. **Cocher, puis regarder dans Gmail** : seuls ces mails sont à la corbeille ; une réponse reçue dans la même conversation n'a pas bougé ; un mail avec une étoile ou un libellé non plus ; Gmail ne pose-t-il pas tout seul « Important » sur les mails envoyés (alors aucun ne partirait) ; la taille de la pièce jointe rendue par Gmail est-elle bien celle du PDF rangé dans Drive (sinon aucun ne partirait). Puis **« Annuler »** : ils reviennent dans « Messages envoyés », avec leurs libellés.
6. **Un mail envoyé à une autre adresse qui arrive dans la même boîte** (alias, transfert automatique), puis archivé : un seul message, sans « boîte de réception » ; la règle ne peut pas le reconnaître. À regarder dans la vraie boîte.
7. **Les durées** : les secondes par mail (lecture, corbeille) et par fichier de Drive, pour régler « 200 mails par passage » et « 30 minutes par jour ».
8. **Refaire à la main sur TEST** : trier une plage sans la colonne « Clé » puis cocher (la ligne doit refuser et se remettre en ordre) ; copier-coller une ligne puis cocher la copie (elle doit se décocher et le dire) ; et les points de Drive :
   - le **chiffre de place**, comparé à celui de one.google.com/storage, avec et sans le service avancé Drive (et si l'activer demande une autorisation) ;
   - la **durée d'un tour de mesure** complet ;
   - un **dossier mis à la corbeille** : son contenu est-il vu « à la corbeille », « Annuler » le fait-il revenir en entier, un téléphone relit-il le carnet après l'annulation ;
   - **un seul `releve-pc.json`** (et un seul `carnet.json`) hors corbeille après plusieurs réécritures par le PC (sinon « deux relevés » bloque tout : sans danger) ;
   - les **noms que Drive pour ordinateur modifie** (« : », « ? », doublons « (1) ») : ces fiches resteraient « absentes du relevé » pour toujours ;
   - le Sheet TEST étant une copie, son onglet *Dossiers chantiers* porte des **identifiants de production** : la mesure de TEST les lira (lecture seule), la purge les refuse.

## Retour arrière

**Ne reviens pas en arrière tant qu'une ligne de l'onglet *Purges* est « En cours » ou « Annulation en cours »** : attends qu'elle soit « Fait » ou « Annulé » (une demi-heure au plus, ou le lendemain si elle dit « la suite demain »).

1. Éditeur Apps Script de la production → fonction **`retirerDeclencheurs`** → **▶ Exécuter** (retire tous les déclencheurs de l'appli).
2. Recolle le serveur **v9.1** (le `Code.gs` de la livraison précédente), puis lance **`installerDeclencheurs`** : il repose les trois déclencheurs d'avant (mails en attente, comptes, modification du Sheet).
3. **Déployer → Nouveau déploiement**, et donne-moi la nouvelle adresse.
4. Les onglets *Stockage*, *Purges* et *Purges détail* peuvent rester : plus rien ne les lit.
5. Une purge déjà faite reste annulable **à la main** dans la corbeille de Drive pendant 30 jours ; ses fichiers sont listés dans *Purges détail*.

## Ce que tu as tranché le 16/11/2026, et ce qui reste

Tranché :
1. **Pas de suppression définitive par le serveur** : il ne fait que mettre à la corbeille.
2. **30 jours** entre le passage à « Terminé » et la purge.
3. **Alerte à 80 %**, seuil critique à **95 %**.
4. **Le carnet d'un chantier clôturé part avec ses fiches.**
5. **Les anciens indices** sont proposés même sur un chantier en cours.
6. **La ligne « Mails envoyés de plus de 3 mois »** : construite (voir plus haut).

Reste à décider :
7. **Un seul mail par fiche** pour les adresses connues du Sheet : tu l'as validé, avec ta règle (rien ne change pour les adresses tapées à la main). **Je ne l'ai pas codé dans ce lot** : c'est le chemin de toutes les fiches, et une question reste ouverte (qui est le destinataire visible ?). Tout est dans `docs/lot5-mail-unique.md` : deux solutions comparées, ma recommandation, et ce que je te demande.
