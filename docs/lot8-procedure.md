# Lot 8 — Note de réunion en points : procédure de déploiement et de test

> Pour Franck. **Une seule livraison**, qui réunit tout le lot 8 :
> - l'annotation des photos qu'on peut rouvrir (8a) ;
> - l'onglet *Comptes rendus* et le compteur de mails (8b, **sans numéro ni présents** : tes réponses du 16/11/2026) ;
> - la note **en points**, avec la reprise des points ouverts d'une réunion à l'autre (8c).
>
> Elle se compose du **serveur v11.1** (le programme chez Google) et des **pages, appli 10.2**.
> **État au 16/11/2026 : construit et testé contre le faux serveur seulement** (un faux Google qui tourne sur mon ordinateur). Rien n'a touché la copie TEST ni la production. Aucun mail n'est parti.
> **Ne passe à l'étape suivante que si la précédente est verte.** Sinon : arrête-toi et envoie-moi une capture.

## Ce qui change, en clair

**Pour celui qui écrit la note**
- Une note est faite de **points**. Un point = un sujet de la réunion : un texte, des photos si besoin.
- Un point est **ouvert** ou **clos**. Les points restés ouverts **reviennent tout seuls** dans la prochaine note du même chantier, avec la mention « repris du compte rendu du 06/11 · ouvert depuis le 23/10 ».
- Sur un point repris, trois gestes : **Clore** (c'est réglé), **Compléter** (on modifie son texte), ou ne rien faire (il reste ouvert).
- Un point clos par erreur se **rouvre** : tout de suite (bouton « Rouvrir »), ou plus tard dans « Clos récemment », pendant les **3 comptes rendus suivants** du chantier.
- « **+ Nouveau point** » est toujours visible en bas de l'écran. Case « Réglé pendant la réunion » pour un point ouvert et clos le même jour.
- Le champ de texte libre est gardé : il s'appelle « Remarques générales (facultatif) ». Une note sans aucun point reste possible.
- **Plus de numéro de compte rendu, plus de présents.** Un compte rendu se désigne par sa **date de réunion** : « ✓ Compte rendu du 06/11/2026 envoyé — 3 mails envoyés ».
- **Sans réseau** : la page montre les points gardés dans le téléphone, avec leur date. On peut écrire deux notes de suite sans réseau : la seconde reprend les points de la première, et elles partent dans l'ordre.

**Pour toi, au bureau**
- Un nouvel onglet ***Comptes rendus*** dans le Sheet : une ligne par note, avec les points ouverts après la note et les points clos par elle. Détail : `docs/structure-sheet.md`.
- Dans le PDF : un tableau des points (numéro, texte, « OUVERT » ou « CLOS »), puis les remarques, puis les photos (la légende d'une photo de point commence par « Point 3 — »).
- Sous les destinataires, la page annonce combien de mails partiront, et refuse une 11e adresse de la liste.

**À savoir**
- **Qui peut quoi.** Tout le monde peut toujours écrire et envoyer une note. Pour **voir** les points ouverts d'un chantier et pour **clore, compléter ou rouvrir**, il faut un compte qui a accès à ce chantier (conducteur, ou poseur dont la case du chantier est cochée). Sinon la note part quand même, et **seuls ses nouveaux points sont pris**.
- **Deux personnes écrivent une note du même chantier sans se voir** (ou un téléphone reste trois jours sans réseau) : aucune note n'est refusée. Le téléphone n'envoie que **ce que la personne a fait** ; il ne peut donc pas rouvrir un point clos entre-temps ni remplacer un texte complété. Si un compte rendu est arrivé entre-temps, c'est écrit en tête du PDF : « Rédigé sans connaître le compte rendu du 07/11/2026 », dans le message du téléphone et dans la colonne « Remarque » de l'onglet.
- **L'ordre des comptes rendus d'un chantier est l'ordre d'arrivée au bureau** (colonne « Reçu le »), pas la date de la réunion.
- **L'aperçu et le PDF peuvent différer sur un détail** : cette ligne « Rédigé sans connaître… » et l'état d'un point clos entre-temps sont écrits par le bureau à la réception ; l'aperçu ne peut pas les deviner.
- **Les photos ne sont pas reprises** d'une note à l'autre : elles restent dans le PDF de leur note.
- **Chantier tapé à la main et absent de la liste** : la note part, ses points sont imprimés, mais ils ne sont pas suivis d'une note à l'autre.
- **Chantier renommé** dans l'onglet *Chantiers* : ses points ouverts suivent **s'il a un N° (colonne E)**. Sans N°, ils restent sous l'ancien nom. Remplis donc la colonne E avant de renommer un chantier.
- **Ne modifie ni la ligne de titres ni les deux colonnes « Données de l'appli »** de l'onglet *Comptes rendus*. Si les titres changent, les notes partent quand même (PDF et mails normaux), mais ne sont plus notées et leurs points ne sont plus suivis ; tu reçois un mail (un par jour au plus). Remets les titres : tout reprend.
- Tu peux **trier** l'onglet : l'appli retrouve une note par son numéro de fiche, et la dernière note d'un chantier par la colonne « Reçu le ».
- **Téléphone prêté** : une note écrite sous un compte et envoyée après qu'un autre compte s'est connecté sur le même téléphone part quand même ; si ce second compte n'a pas accès au chantier, les « clore » et « compléter » ne sont pas pris (c'est écrit dans le PDF et dans la colonne « Remarque »).
- **Deux personnes complètent le même point** : le texte du dernier arrivé remplace l'autre (la colonne « Remarque » le signale).
- Limites : 40 nouveaux points par note, 2 000 caractères par point, 10 photos par note (tous points confondus). Un chantier qui dépasse une centaine de longs points ouverts : tu reçois un mail (« points d'un chantier à regarder »), rien n'est refusé.

---

## Avant tout envoi : le bon dossier, la bonne branche, un seul lot à la fois

- La commande d'envoi sur la copie TEST envoie le serveur **du dossier d'où elle est lancée**. Le lot 8 est sur la branche `lot-8` (une branche = une version du code tenue à part). **C'est moi qui prépare ton dossier principal de l'appli sur cette branche avant de te demander l'envoi**, et je te le confirme par écrit (« dossier prêt, branche lot-8, serveur v11.1 »). Si je ne te l'ai pas confirmé, ne lance rien : c'est le serveur d'un autre lot qui partirait.
- Pareil pour la production : le fichier à coller est `A-COLLER-DANS-APPS-SCRIPT/Code.gs` **de la branche `lot-8`**. Il doit contenir `VERSION_API = 'v11.1'`, et je te donne son empreinte (un code de 10 caractères qui prouve que c'est le bon fichier).
- **La copie TEST ne porte qu'un lot à la fois** : chaque envoi remplace le serveur du lot précédent. On décide ensemble de l'ordre des essais.
- La branche `lot-8` **contient déjà le lot 5** (serveur v10.0, en production) : rien du lot 5 n'est perdu en déployant le lot 8.

## Étape A — la copie TEST (toi : 2 minutes)

1. J'ai préparé ton dossier principal sur la branche `lot-8` et je te l'ai confirmé. Tu ouvres PowerShell **dans ce dossier**, comme pour les lots précédents, et tu lances :
   ```
   node outils\envoyer-test.js --avec-porte
   ```
   Page Google → compte de Loué → **Autoriser**. Attends `✅ Envoi réussi`. La commande affiche la version : ce doit être **v11.1**. Dis-moi « envoi fait », avec l'empreinte affichée.
2. Je fais le reste sans toi : installation sur TEST par la porte de service (`installerLot8`), essais contre le vrai serveur TEST (`tests/reel-lot8.js` : deux notes envoyées au même instant, gestes sur les points, note renvoyée ; **3 mails, tous à ton adresse**), publication de la copie d'essai. **Pas de production avant que cet essai soit vert** : c'est le seul qui éprouve le vrai verrou de Google.
3. **Si l'installation me répond « un onglet Comptes rendus existe déjà avec d'autres titres »** (reste d'un ancien essai sur la copie TEST) : dans le Sheet « ChantierPro TEST », clic droit sur l'onglet *Comptes rendus* → **Renommer** → `Comptes rendus ancien`. Dis-le-moi, je relance l'installation.

## Étape B — tes essais sur téléphone (20 min)

**Avant que je publie la copie d'essai** (icône « Loué ESSAI ») : commence une note de réunion sur cette copie (un texte, une photo), **ne l'envoie pas**. Mets aussi une note **en attente** : mode avion, remplis une note, touche Envoyer, laisse le mode avion. Dis-moi « prêt ». Je publie, puis :

1. Remets le réseau : la note en attente part. Message : « ✓ Compte rendu du … envoyé ».
2. Rouvre la note de réunion : ton **brouillon d'avant la mise à jour** est proposé et revient entier (le texte est dans « Remarques générales »).
3. Choisis un chantier. Sous « Points ouverts », tu lis « Premier compte rendu de ce chantier : aucun point à reprendre. »
4. Touche **+ Nouveau point** trois fois : écris trois points (essaie le **micro du clavier** pour dicter). Coche « Réglé pendant la réunion » sur l'un. Prends une **photo** dans un point, et dessine dessus.
5. Touche **Aperçu** : le tableau des points, « OUVERT » / « CLOS ».
6. **Envoie.** Dans le mail : le PDF porte le tableau des points et la photo avec « Point 1 — ».
7. La page s'est vidée, et les deux points ouverts **sont revenus** sous « Points ouverts (2) ». Le point réglé est dans « Clos récemment ».
8. **Clore** un point (il passe en gris, « Clos ✓ »), puis **Rouvrir** (tu t'es ravisé), puis **Clore** de nouveau. Touche l'autre point : il s'ouvre ; **Compléter**, ajoute une phrase. Dans « Clos récemment », **Rouvrir** le point réglé.
9. **Ferme l'appli** sans envoyer. Rouvre la note : « Brouillon retrouvé » → **Restaurer**. Tes gestes sont là. Envoie : le PDF dit « clos », « complété », « rouvert ».
10. **Mode avion.** Rouvre la note : « Pas de réseau : points du …, gardés dans le téléphone. » Clos un point, ajoute un nouveau point, envoie. Sans remettre le réseau, écris une **seconde** note : le point de la première y est déjà (« note du … (en attente d'envoi) »). Envoie-la aussi.
11. Remets le réseau : les deux notes partent, dans l'ordre. Ouvre l'onglet *Comptes rendus* de la copie TEST : une ligne par note, colonnes « Points ouverts après cette note » et « Points clos par cette note » remplies.
12. Avec un **compte de poseur** dont la case du chantier n'est **pas** cochée : la page dit que les points de ce chantier ne sont pas affichés ; un nouveau point part quand même.
13. Avec des **gants**, en plein soleil, d'une main : « Clore », « + Nouveau point » et les cartes se touchent-ils bien ?

## Étape C — second envoi sur TEST, sans la porte

Dans le même dossier, toujours sur la branche `lot-8` :
```
node outils\envoyer-test.js --sans-porte
```
C'est le fichier qui ira en production. Je revérifie par l'empreinte.

## Étape D — production (toi : 10 minutes)

1. Éditeur Apps Script de production : remplace tout `Code.gs` par `A-COLLER-DANS-APPS-SCRIPT/Code.gs` **de la branche `lot-8`** (le dossier que j'ai préparé ; je te donne son empreinte, et la ligne `VERSION_API` doit dire `v11.1`). **Enregistre**.
2. **Déployer → Nouveau déploiement** (description « Lot 8 — production »). Copie la nouvelle adresse et donne-la-moi : je la mets dans `commun/config.js`.
3. Dans l'éditeur, choisis la fonction **`installerLot8Production`** et clique ▶. Le journal doit finir par `✅ Lot 8 : installation terminée.` Elle crée l'onglet *Comptes rendus* avec ses 14 colonnes ; on peut la relancer sans danger.
4. Ouvre le lien de fusion que je te donne : **Create pull request**, **Merge pull request**, **Confirm merge**.
5. Vérification : dans l'appli, « À propos » affiche **10.2** ; l'adresse du serveur ouverte dans un navigateur affiche `Loué App API v11.1 OK`.

**L'ordre compte peu** : la nouvelle page marche avec l'ancien serveur (la note part ; les points sont écrits en clair en tête du texte dans le PDF, les photos y sont ; rien n'est suivi d'une note à l'autre tant que le serveur n'est pas à jour), et l'ancienne page marche avec le nouveau serveur (ses notes sont notées dans l'onglet, les points ouverts du chantier ne bougent pas).

## Retour arrière

1. **D'abord le serveur seul.** Dans Apps Script, « Gérer les déploiements », remets l'ancien déploiement en service (son adresse n'a pas changé), et je remets cette adresse dans `commun/config.js`. La page 10.2 marche avec l'ancien serveur ; les brouillons ne sont pas touchés. Les notes envoyées pendant ce temps portent leurs points en clair dans le PDF.
2. **Si la page doit reculer aussi : la « page de repli », jamais une simple fusion inverse.** L'ancienne page (9.0) ne connaît pas les points : elle les ferait disparaître d'un brouillon en cours, sans message. La page de repli est prête dans le dépôt (`outils/repli-lot8/note-reunion.html`) et essayée : c'est la note de réunion d'avant les points, qui **recopie en plus les points d'un brouillon dans « Notes et commentaires »** ; ses photos reviennent toutes. **C'est moi qui la publie** (je la copie à la place de `note-reunion.html`, je refais la livraison, je te donne le lien de fusion) : demande-le-moi.
3. Ce qui est perdu avec la page de repli : seulement le fait qu'un point repris était « clos » ou « rouvert » dans un brouillon (la page l'écrit : « 1 point repris était clos ou rouvert dans ce brouillon : à refaire dans une prochaine note »).
4. L'onglet *Comptes rendus* peut rester. Les points ouverts restent dans ses lignes : si le lot 8 revient plus tard, ils reviennent avec lui. Aucune donnée existante n'est migrée : rien à sauvegarder ni à restaurer.

## Ce qui n'a pas été vérifié (à faire sur la copie TEST et sur téléphone)

- **Le vrai verrou de Google** (deux notes au même instant) : `tests/reel-lot8.js`, que je lance après ton envoi de l'étape A.
- **La hauteur réelle du tableau des points dans le PDF fabriqué par Google** : mesurée dans Chrome seulement. À regarder dans le premier PDF reçu (la photo de la page 1 ne doit pas déborder).
- **Gants, plein soleil, une barre de réseau, dictée du clavier sur Android et sur iPhone, réception des vrais mails** : ton étape B.
- **Ton propre brouillon en cours au moment de la mise à jour** : étape B, point 2.
