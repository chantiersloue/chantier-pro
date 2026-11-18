# Lot 10a-1 — « À commander » : procédure de déploiement et de test

> Pour Franck. **Une seule livraison** : le **serveur v11.2** (le programme chez Google) et les **pages, appli 10.3**.
> Elle contient le lot 8 (elle part de la branche `lot-8`) : **le lot 8 doit être en production avant** (ton ordre : lot 8, puis 10a-1 et 10a-2, puis 10b, puis le mail unique).
> **État au 17/11/2026 : construit et testé contre le faux serveur seulement** (un faux Google qui tourne sur mon ordinateur) et dans un vrai Chrome. Rien n'a touché la copie TEST ni la production. **Aucun mail n'est parti.**
> **Ne passe à l'étape suivante que si la précédente est verte.** Sinon : arrête-toi et envoie-moi une capture.

## Ce qui change, en clair

**Pour le poseur**
- Sur l'accueil, sous « Hors chantier », une tuile **« À commander »** (aucun chantier à choisir).
- Deux gros boutons : **À commander** (choisi d'avance) ou **Outil en panne**. Deux champs : **Quoi ?** et **Quantité** (pour un outil en panne, le second champ s'appelle « Précision (facultatif) »). Bouton **Demander**.
- **Une demande = un article.** Elle part tout de suite, la page est prête pour le suivant.
- Son nom n'est jamais tapé : c'est celui de son compte. **Il faut donc être connecté** ; une demande écrite sans être connecté attend dans le téléphone et part après la connexion.
- La page répond : « ✓ Elle part dans le récapitulatif d'aujourd'hui (vers 15 h 45). », ou « ✓ Le récapitulatif d'aujourd'hui est déjà parti : elle sera dans celui de lundi 23/11. », ou, sans réseau, « ⏳ En attente : elle partira au retour du réseau, dans le récapitulatif qui suivra. »
- En dessous, **« Mes demandes »** (les siennes seulement, 90 jours) : « ⏳ en attente d'envoi », « partira dans le prochain récapitulatif », « récapitulatif du 17/11 », « ✓ Commandé ». Elles restent lisibles sans réseau.

**Pour toi, au bureau**
- **Un mail par jour, du lundi au vendredi, vers 15 h 45** (entre 15 h 45 et 15 h 55 en général), objet « À commander — mardi 17/11 (3 demandes) » : d'abord « À COMMANDER », puis « OUTIL EN PANNE », une ligne par demande (poseur, quoi, quantité). **Aucun mail s'il n'y a aucune demande.**
- Un nouvel onglet ***Demandes*** dans le Sheet : une ligne par demande, avec une case **« Commandé »**. Tu la coches : le poseur voit « ✓ Commandé ». Tu la décoches : la mention disparaît. Détail : `docs/structure-sheet.md`.
- Une case cochée **avant** le mail (tu as déjà commandé par téléphone) : la ligne reste dans le mail, avec « (déjà commandé) ».

**À savoir**
- **L'heure qui compte est celle où la demande arrive au bureau**, pas celle du téléphone. Une demande écrite sans réseau à 14 h et arrivée à 16 h part dans le mail du lendemain ; « Mes demandes » dit toujours le vrai.
- **Si le mail ne peut pas partir** (quota de mails du jour épuisé, panne de Google) : nouvel essai toutes les 10 minutes **jusqu'à 17 h 30**. Après, c'est trop tard pour commander : les demandes partent le jour ouvré suivant, **en tête du mail**, sous le titre « DEMANDES NON ENVOYÉES HIER » (ou « DU 20/11 » après un week-end).
- Ce mail est pris sur ta **réserve de 20 mails** : il part même quand les mails des fiches sont reportés.
- **30 demandes par compte et par jour** au plus. « Quoi ? » : 80 caractères ; « Quantité » : 30.
- **Ne change pas la ligne de titres de l'onglet *Demandes*, et ne déplace pas ses colonnes.** Si tu le fais, le serveur ne devine rien : il n'écrit plus dans l'onglet, **les demandes attendent dans les téléphones** (« ⏳ en attente d'envoi »), le mail de 15 h 45 ne part pas, et tu reçois un mail d'alerte (un par jour au plus). Remets les titres : tout repart tout seul, rien n'est perdu.
- Tu peux **trier** l'onglet et **supprimer** une ligne (une demande faite par erreur) : l'appli retrouve une demande par son numéro de fiche.
- Jour férié : le mail part quand même s'il y a des demandes.
- **Les gros boutons des articles habituels et les propositions pendant la frappe** : c'est le lot 10a-2, une livraison à part, **après** celle-ci (dernière partie de ce document).

---

## Avant tout envoi : le bon dossier, la bonne branche, un seul lot à la fois

- La commande d'envoi sur la copie TEST envoie le serveur **du dossier d'où elle est lancée**. Ce lot est sur la branche `lot-10a1` (une branche = une version du code tenue à part). **C'est moi qui prépare ton dossier principal sur cette branche avant de te demander l'envoi**, et je te le confirme par écrit (« dossier prêt, branche lot-10a1, serveur v11.2 »). Si je ne te l'ai pas confirmé, ne lance rien.
- **La copie TEST ne porte qu'un lot à la fois** : chaque envoi remplace le serveur du lot précédent.

## Étape A — la copie TEST (toi : 2 minutes)

1. J'ai préparé ton dossier sur la branche `lot-10a1` et je te l'ai confirmé. Ouvre PowerShell **dans ce dossier** et lance :
   ```
   node outils\envoyer-test.js --avec-porte
   ```
   Page Google → compte de Loué → **Autoriser**. Attends `✅ Envoi réussi`. La version affichée doit être **v11.2**. Dis-moi « envoi fait », avec l'empreinte affichée (un code de 10 caractères qui prouve que c'est le bon fichier).
2. Je fais le reste sans toi : installation sur TEST par la porte de service (`installerLot10` : elle crée l'onglet *Demandes*), puis publication de la copie d'essai (icône « Loué ESSAI »).
3. **Si l'installation me répond « un onglet Demandes existe déjà avec d'autres titres »** : dans le Sheet « ChantierPro TEST », clic droit sur l'onglet *Demandes* → **Renommer** → `Demandes ancien`. Dis-le-moi, je relance.

## Étape B — tes essais sur téléphone (15 minutes)

Sur la copie d'essai, connecté avec un compte de poseur d'essai :

1. Accueil → **À commander**. « À commander » est déjà choisi.
2. Écris « Vis 4×40 » et « 2 boîtes », touche **Demander**. Tu lis « ⏳ Demande notée », puis « ✓ Elle part dans le récapitulatif d'aujourd'hui (vers 15 h 45). » (ou « … déjà parti : elle sera dans celui de … » si tu fais l'essai après 15 h 45). La page s'est vidée. La demande est dans « Mes demandes ».
3. Touche **Outil en panne** : le second champ s'appelle « Précision (facultatif) ». Écris « Visseuse à choc », laisse la précision vide, **Demander**.
4. **Avec des gants, le clavier ouvert** (c'est le seul essai que mes tests ne peuvent pas faire) : touche « Quoi ? ». Le champ remonte-t-il en haut de l'écran ? Vois-tu encore « Quantité » et **Demander** au-dessus du clavier ? La touche « Suivant » du clavier passe-t-elle à la quantité, et la touche « Envoyer » fait-elle la demande ? Les deux gros boutons se touchent-ils bien ? Dis-moi ce qui gêne, sur Android **et** sur iPhone si tu peux.
5. **Mode avion.** Écris une demande, **Demander** : « ⏳ En attente : elle partira au retour du réseau… ». Ferme l'appli, rouvre « À commander » : elle est en tête de « Mes demandes », « ⏳ en attente d'envoi », et les anciennes sont toujours là (« Pas de réseau : liste du … gardée dans le téléphone. »).
6. Remets le réseau : elle part toute seule. Dans le Sheet TEST, onglet *Demandes* : **une seule** ligne pour elle.
7. Commence une demande, **ferme l'appli sans toucher Demander**, rouvre : « Brouillon retrouvé » → **Restaurer**. Le texte est revenu.
8. Dans le Sheet TEST, **coche « Commandé »** sur une ligne. Dans le téléphone, rouvre « À commander » : « ✓ Commandé ». Décoche : la mention disparaît.
9. Ouvre **Signaler** dans un chantier : la phrase « Vis, consommables, outil en panne ? Utilise À commander (sur l'accueil). » est en bas.
10. En plein soleil, d'une main : tout se lit-il ?

## Étape C — attendre un mail de 15 h 45 sur la copie TEST

Sur TEST, les « réveils » (les déclencheurs : ce qui lance une fonction tout seul) ne sont posés que pendant les essais, parce que leurs 90 minutes par jour sont partagées avec la production.

1. Un jour ouvré, **avant 15 h 30** : dis-moi « réveils ». Je les pose sur TEST par la porte de service (ils se retirent tout seuls au bout de 2 h ; je les repose si besoin).
2. Fais deux ou trois demandes avant 15 h 45.
3. **Entre 15 h 45 et 16 h**, tu reçois le mail « À commander — … (3 demandes) » à l'adresse du bureau de la copie TEST (la tienne). **Note l'heure exacte de réception** et dis-la-moi : c'est la mesure qui nous manque. Regarde aussi comment le mail s'affiche dans Outlook et sur ton téléphone.
4. Fais une demande **après** le mail : le téléphone doit répondre « … déjà parti : elle sera dans celui de … » avec le bon jour.
5. Dis-moi « mail reçu » : je retire les réveils de TEST.

## Étape D — second envoi sur TEST, sans la porte

Dans le même dossier, toujours sur la branche `lot-10a1` :
```
node outils\envoyer-test.js --sans-porte
```
C'est le fichier qui ira en production. Je revérifie par l'empreinte.

## Étape E — production (toi : 15 minutes)

**Seulement après le lot 8 en production**, et après les étapes B et C vertes.

1. Éditeur Apps Script de production : remplace tout `Code.gs` par `A-COLLER-DANS-APPS-SCRIPT/Code.gs` **de la branche `lot-10a1`** (le dossier que j'ai préparé ; je te donne son empreinte, et la ligne `VERSION_API` doit dire `v11.2`). **Enregistre**.
2. Choisis la fonction **`installerLot10Production`** et clique ▶. Le journal doit finir par `✅ Lot 10 : installation terminée.` Elle crée l'onglet *Demandes* et vérifie que le réveil des 10 minutes est là. On peut la relancer sans danger.
3. Choisis la fonction **`verifierConfig`** et clique ▶. Aucune ligne ne doit commencer par ❌. Tu dois lire `✅ Onglet « Demandes »` et « Récapitulatif « À commander » : du lundi au vendredi… après 15 h 45 ; dernier passage fait : jamais ».
4. **Déployer → Nouveau déploiement** (description « Lot 10a-1 — production »). Copie la nouvelle adresse et donne-la-moi : je la mets dans `commun/config.js`.
5. Ouvre le lien de fusion que je te donne : **Create pull request**, **Merge pull request**, **Confirm merge**.
6. Vérification : dans l'appli, « À propos » affiche **10.3** ; l'adresse du serveur ouverte dans un navigateur affiche `Loué App API v11.2 OK` ; la tuile « À commander » est sur l'accueil.
7. Le premier jour ouvré : fais une demande d'essai avant 15 h 45, attends le mail, puis **supprime la ligne d'essai** dans l'onglet *Demandes*.

**L'ordre compte** : le serveur d'abord (étapes 1 à 4), les pages ensuite (étape 5). Si les pages arrivaient avant le serveur, une demande resterait dans le téléphone, marquée « à vérifier » (l'ancien serveur ne connaît pas ce type de fiche et la refuse) : rien ne serait perdu, il faudrait toucher « Réessayer » dans l'indicateur en haut de l'écran une fois le serveur à jour.

## Retour arrière

1. **Le serveur seul** : dans Apps Script, « Gérer les déploiements », remets l'ancien déploiement en service, et je remets son adresse dans `commun/config.js`. Les autres fiches marchent comme avant. Les demandes « À commander » faites pendant ce temps restent dans les téléphones (« à vérifier ») ; elles repartent avec « Réessayer » quand le lot revient.
2. **Les pages** : une fusion inverse suffit (aucune autre page ne dépend de celle-ci). La tuile disparaît de l'accueil. Les demandes restées dans un téléphone y restent, visibles dans l'indicateur en haut de l'écran.
3. **L'onglet *Demandes*** peut rester : il n'est lu par rien d'autre. Aucune donnée existante n'est modifiée ni migrée par ce lot : **rien à sauvegarder, rien à restaurer**.
4. Pour arrêter seulement le mail de 15 h 45 sans rien défaire : dis-le-moi, c'est un réglage (`DEMANDES_HEURE_LIMITE` dans `apps-script/Config.gs`) et un nouveau déploiement.

## Ce qui n'a pas été vérifié (à faire sur la copie TEST et sur téléphone)

- **Rien n'a tourné chez Google** : ni la réception d'une demande, ni la case à cocher posée par le serveur sur chaque nouvelle ligne, ni le calcul de l'heure de Paris par Google, ni l'envoi du mail.
- **L'heure réelle du mail** (le réveil des 10 minutes n'est pas régulier à la minute) : étape C.
- **L'affichage du mail** dans Outlook et sur ton téléphone : étape C.
- **Le clavier ouvert, avec des gants**, sur Android et sur iPhone : étape B, point 4.
- **Plein soleil, une barre de réseau** : étape B.
- Le temps que le récapitulatif ajoute au réveil des 10 minutes (les 90 minutes par jour) : je le lis dans le journal d'exécution de TEST pendant l'étape C.

---

# Lot 10a-2 — boutons des articles habituels, propositions, onglet *Articles* : procédure

> Pour Franck. **Une livraison à part, après le lot 10a-1** : le **serveur v11.3** et les **pages, appli 10.4**, branche `lot-10a2` (elle contient le 10a-1).
> **État au 18/11/2026 : construit et testé contre le faux serveur seulement** et dans un vrai Chrome. Rien n'a touché la copie TEST ni la production.
> Si tu préfères, les deux lots peuvent partir **en une seule fois** : dans ce cas, fais seulement cette partie-ci (elle contient tout), et lis `v11.3` et `10.4` partout où la première partie dit `v11.2` et `10.3`.

## Ce qui change, en clair

**Pour le poseur**
- En haut de « À commander », **ses articles habituels** : jusqu'à 5 gros boutons, les articles qu'**il** demande le plus, avec la dernière quantité écrite dessous. **Un toucher** remplit « Quoi ? » et la quantité ; il la change s'il veut ; puis **Demander**.
- Tant qu'il n'a rien demandé : pas de boutons. Chacun a les siens, même sur un téléphone partagé.
- **Pendant la frappe** dans « Quoi ? », dès 2 lettres : **3 gros boutons au plus** sous le champ. D'abord ce qu'il a déjà demandé, puis ta liste. Il touche, ou il continue d'écrire : **le texte libre reste toujours possible**. Il n'y a aucune liste à dérouler.
- Tout cela marche **sans réseau** : c'est calculé dans le téléphone.
- Téléphone changé, appli réinstallée : les boutons reviennent tout seuls à la connexion (ils sont refaits à partir de « Mes demandes », 90 jours).

**Pour toi, au bureau**
- Un nouvel onglet ***Articles*** dans le Sheet, **facultatif**, créé vide : **une colonne, un article par ligne**. Ce que tu y écris est proposé à tous les poseurs pendant la frappe. Vide : tout marche quand même.
- 500 articles au plus (les 500 premiers), 80 caractères au plus par article (le reste est coupé). Les doublons sont retirés tout seuls (« Vis 4×40 », « vis 4x40 » : un seul).
- Une modification de l'onglet arrive dans un téléphone **à l'ouverture suivante de la page « À commander »**, avec du réseau.
- Tu peux trier l'onglet, le vider, le supprimer : rien ne casse. La première ligne « Article » est un titre ; laisse-la ou retire-la, peu importe.
- Le mail de 15 h 45 et l'onglet *Demandes* ne changent pas.

## Étape A — la copie TEST (toi : 2 minutes)

1. Je prépare ton dossier sur la branche `lot-10a2` et je te le confirme par écrit (« dossier prêt, branche lot-10a2, serveur v11.3 »). Ouvre PowerShell **dans ce dossier** et lance :
   ```
   node outils\envoyer-test.js --avec-porte
   ```
   Attends `✅ Envoi réussi`. La version affichée doit être **v11.3**. Dis-moi « envoi fait », avec l'empreinte affichée.
2. Je relance l'installation sur TEST par la porte de service (`installerLot10`) : elle crée l'onglet *Articles*, vide, et ne touche pas à l'onglet *Demandes*. Puis je publie la copie d'essai.
3. Dans le Sheet « ChantierPro TEST », onglet *Articles*, écris quatre ou cinq articles sous le titre, un par ligne (par exemple : `Vis 4×40`, `Embout de vissage`, `Cartouches silicone blanc`, `Éclisse alu`).

## Étape B — tes essais sur téléphone (10 minutes, **avec des gants**)

Sur la copie d'essai, connecté avec un compte de poseur d'essai :

1. Ouvre **À commander**. Si ce compte n'a encore rien demandé : aucun bouton en haut. C'est normal.
2. Touche « Quoi ? » et tape `vi`. Sous le champ : « Vis 4×40 » et « Embout de vissage ». Tape `ecl` (sans accent) : « Éclisse alu ». Tape `4x40` (avec la lettre x) : « Vis 4×40 ».
3. Touche une proposition : « Quoi ? » est rempli, le curseur est dans « Quantité ». Écris `2 boîtes`, puis la touche **Envoyer** du clavier (ou le bouton **Demander**).
4. En haut de la page, un gros bouton vert est apparu : **Vis 4×40 — 2 boîtes**. **Touche-le** : les deux champs sont remplis. Change la quantité en `3 boîtes`, **Demander**. Le bouton dit maintenant « 3 boîtes ».
5. Fais quatre ou cinq autres demandes d'articles différents : les boutons s'ajoutent, **5 au plus**, le plus demandé en premier.
6. **Le clavier ouvert, avec des gants** (mes tests ne peuvent pas ouvrir un vrai clavier) :
   - quand tu touches « Quoi ? », le champ remonte-t-il tout en haut de l'écran ?
   - vois-tu les propositions **au-dessus du clavier**, et les touches-tu sans fermer le clavier ?
   - après avoir touché une proposition, vois-tu « Quantité » et **Demander** ?
   - dis-moi ce qui gêne, sur Android **et** sur iPhone si tu peux.
7. **Mode avion.** Rouvre « À commander » : les boutons sont là, les propositions aussi. Touche un bouton, **Demander** : « ⏳ En attente… ». Remets le réseau : elle part toute seule.
8. **Second compte** : déconnecte-toi, connecte un autre compte d'essai sur le même téléphone, ouvre « À commander » : il n'a **pas** les boutons du premier.
9. Touche **Outil en panne** : les boutons disparaissent (ils ne servent qu'à « À commander »). Touche **À commander** : ils reviennent.
10. Touche un bouton, puis **ferme l'appli sans toucher Demander**. Rouvre : « Brouillon retrouvé » → **Restaurer** : l'article et la quantité sont revenus.

## Étape C — second envoi sur TEST, sans la porte

Dans le même dossier, toujours sur la branche `lot-10a2` :
```
node outils\envoyer-test.js --sans-porte
```
C'est le fichier qui ira en production. Je revérifie par l'empreinte.

## Étape D — production (toi : 15 minutes)

**Seulement après le lot 10a-1 en production** (ou en même temps que lui : voir l'encadré du haut), et après l'étape B verte. **Dans cet ordre :**

1. Éditeur Apps Script de production : remplace tout `Code.gs` par `A-COLLER-DANS-APPS-SCRIPT/Code.gs` **de la branche `lot-10a2`** (je te donne son empreinte ; la ligne `VERSION_API` doit dire `v11.3`). **Enregistre**.
2. Choisis la fonction **`installerLot10Production`** et clique ▶ (oui, la même qu'au lot 10a-1 : on peut la relancer sans danger). Tu dois lire `2/3 Onglet « Articles » … : fait — onglet créé, vide` et, à la fin, `✅ Lot 10 : installation terminée.` L'onglet *Demandes* n'est pas touché (« déjà fait »).
3. Choisis la fonction **`verifierConfig`** et clique ▶. Aucune ligne ne doit commencer par ❌. Tu dois lire `✅ Onglet « Articles » : 0 article(s) proposé(s) aux poseurs pendant la frappe`.
4. **Déployer → Nouveau déploiement** (description « Lot 10a-2 — production »). Copie la nouvelle adresse et donne-la-moi : je la mets dans `commun/config.js`.
5. Ouvre le lien de fusion que je te donne : **Create pull request**, **Merge pull request**, **Confirm merge**.
6. Vérification : dans l'appli, « À propos » affiche **10.4** ; l'adresse du serveur ouverte dans un navigateur affiche `Loué App API v11.3 OK`.
7. Quand tu veux : remplis l'onglet *Articles*.

**L'ordre compte peu ici, mais garde-le** : avec les nouvelles pages et l'ancien serveur, tout marche, sauf ta liste *Articles* (les poseurs n'ont que les propositions tirées de leurs propres demandes). Avec le nouveau serveur et les anciennes pages, rien ne change pour les poseurs.

## Retour arrière

1. **Les pages** : une fusion inverse. Les boutons et les propositions disparaissent ; la page du lot 10a-1 revient. Aucune demande n'est touchée.
2. **Le serveur** : l'ancien déploiement (v11.2) remis en service, son adresse dans `commun/config.js`. Les demandes continuent ; la liste *Articles* n'est plus donnée.
3. **L'onglet *Articles*** peut rester ou être supprimé : rien d'autre ne le lit. **Aucune donnée existante n'est modifiée par ce lot : rien à sauvegarder.**

## Ce qui n'a pas été vérifié

- **Rien n'a tourné chez Google** : la création de l'onglet *Articles*, sa lecture « telle qu'affichée » par Google.
- **Le vrai clavier**, sur Android et sur iPhone, avec des gants : étape B, point 6. Dans Chrome, j'ai seulement réduit la hauteur de l'écran à 280 px.
- **Plein soleil** : le vert des boutons se lit-il ?

---

# Lot 10b — le point du vendredi : procédure

> Pour Franck. **Une livraison à part, après le lot 10a-2. Le serveur seul** : **v11.4**, branche `lot-10b` (elle contient les lots 10a-1 et 10a-2). **Aucune page ne change** (l'appli reste **10.4**).
> **État au 18/11/2026 : construit et testé contre le faux serveur seulement.** Rien n'a tourné chez Google. **Aucun mail n'est parti.**

## Ce qui change, en clair

- **Un mail par semaine, à toi seul, le vendredi vers 14 h** (entre 14 h et 14 h 10 en général). **Il part toujours**, même s'il n'y a rien à signaler : s'il n'arrive pas un vendredi, quelque chose ne tourne plus.
- Son objet dit l'essentiel : « Point du vendredi 20/11 — 4 signalements, 1 bloquant en retard, santé à regarder », ou « Point du vendredi 20/11 — rien à signaler ».
- Trois parties :
  1. **Signalements de la semaine** : ceux créés depuis le mail précédent (depuis 7 jours la première fois). Pour chacun : chantier, type, urgence, qui l'a signalé, état (À traiter, Commandé, Livré, Clos).
  2. **Rappel** : une ligne par signalement « Bloquant » resté « À traiter » depuis 7 jours ou plus, même ancien.
  3. **Point de santé** : les mails reportés encore en attente (combien, le plus ancien) ; la place du compte Google (le dernier chiffre de l'onglet *Stockage*, avec sa date) ; les fiches arrivées au bureau mais **en erreur** ou **en attente de leurs photos** depuis 30 jours au plus.
- Une partie vide dit « rien à signaler ». Si un onglet est absent ou illisible, sa partie dit « indisponible » et le reste du mail est rempli.
- **Si le mail ne peut pas partir** (quota de mails épuisé, panne de Google) : nouvel essai toutes les 10 minutes **jusqu'à 18 h**. Après : pas de mail cette semaine (une ligne dans l'onglet *Journal*), **jamais de mail le samedi**. Le vendredi suivant, le mail reprend depuis le dernier mail parti : aucun signalement n'est oublié.
- Ce mail est pris sur ta **réserve de 20 mails**, comme le récapitulatif « À commander ». Il n'a pas de pièce jointe.
- Le vendredi, tu reçois donc **deux** mails de l'appli : le point (vers 14 h) et « À commander » (vers 15 h 45, s'il y a des demandes). Ils ne se gênent pas.
- **Rien n'est modifié dans le Sheet** : le serveur ne fait que lire les onglets *Signalements*, *Mails en attente*, *Stockage* et *Envois*.
- **À savoir** : ne change pas la ligne de titres de l'onglet *Signalements*. Si tu le fais, le mail part quand même, mais sa partie « signalements » dit « indisponible ».
- **Pas dans ce mail** (le serveur ne le sait pas) : les comptes bloqués, les fiches restées dans un téléphone, la dernière connexion de chacun.

## Étape A — la copie TEST (toi : 5 minutes)

1. Je prépare ton dossier sur la branche `lot-10b` et je te le confirme par écrit (« dossier prêt, branche lot-10b, serveur v11.4 »). Ouvre PowerShell **dans ce dossier** et lance :
   ```
   node outils\envoyer-test.js --sans-porte
   ```
   Attends `✅ Envoi réussi`. La version affichée doit être **v11.4**. Dis-moi « envoi fait », avec l'empreinte affichée.
2. Ouvre l'éditeur Apps Script de la copie **TEST**. En haut, choisis la fonction **`essaiPointDuVendredi`** et clique ▶ **Exécuter**.
3. Le journal (en bas) doit commencer par `✅ Essai du point du vendredi (TEST) : mail envoyé à … seulement`, puis montrer le texte du mail.
4. **Lis le mail** (objet « [ESSAI] Point du vendredi … ») dans Outlook **et** sur ton téléphone : les trois parties sont-elles là ? Les tableaux se lisent-ils ? Dis-moi ce qui gêne.
5. Tu peux relancer `essaiPointDuVendredi` autant que tu veux : il ne compte pas pour le vrai mail du vendredi, et il ne modifie rien.

**Facultatif — voir le vrai mail partir tout seul sur TEST.** Un vendredi avant 14 h : lance `demarrerPointDuVendredi` sur TEST et dis-moi « réveils » (je les pose pour l'après-midi, comme pour le lot 10a-1). Vers 14 h, le mail arrive ; note l'heure. Ensuite lance `arreterPointDuVendredi` sur TEST, et je retire les réveils.

## Étape B — production (toi : 10 minutes)

**Après le lot 10a-2 en production**, et après l'étape A verte. **Dans cet ordre :**

1. Éditeur Apps Script de **production** : remplace tout `Code.gs` par `A-COLLER-DANS-APPS-SCRIPT/Code.gs` **de la branche `lot-10b`** (je te donne son empreinte ; la ligne `VERSION_API` doit dire `v11.4`). **Enregistre**.
2. Choisis la fonction **`demarrerPointDuVendredi`** et clique ▶. Tu dois lire `✅ Point du vendredi mis en service : un mail à … , le vendredi, … après 14 h 00`. **Sans cette étape, le mail ne part pas.**
3. Choisis la fonction **`verifierConfig`** et clique ▶. Aucune ligne ne doit commencer par ❌. Tu dois lire `✅ Point du vendredi : en service — … ; dernier mail parti : jamais`.
4. Si tu veux voir le mail avec les vraies données sans attendre vendredi : **`essaiPointDuVendredi`**, ▶. (Un mail « [ESSAI] » à toi seul.)
5. **Déployer → Nouveau déploiement** (description « Lot 10b — production »). Copie la nouvelle adresse et donne-la-moi : je la mets dans `commun/config.js`, puis je te donne le lien de fusion (**Create pull request**, **Merge pull request**, **Confirm merge**).
   - *À savoir* : le mail du vendredi marche dès l'étape 2, même avant ce déploiement (les réveils lancent toujours le dernier code enregistré). Le nouveau déploiement sert à ce que l'adresse du serveur et le fichier collé soient à la même version.
6. Vérification : l'adresse du serveur ouverte dans un navigateur affiche `Loué App API v11.4 OK`.
7. **Le premier vendredi**, vers 14 h 10 : le mail « Point du vendredi … » est-il arrivé ? Dis-moi l'heure.

## Retour arrière

1. **Arrêter le mail** : fonction **`arreterPointDuVendredi`**, ▶. C'est immédiat ; rien d'autre à faire. `demarrerPointDuVendredi` le remet.
2. **Le serveur** : l'ancien `Code.gs` (v11.3) recollé. Le mail s'arrête ; rien d'autre ne change. **Aucune donnée n'est modifiée par ce lot : rien à sauvegarder, rien à restaurer.**
3. Changer l'heure : c'est un réglage (`VENDREDI_HEURE` et `VENDREDI_FIN_ESSAIS` dans `apps-script/Config.gs`) ; dis-le-moi.

## Ce qui n'a pas été vérifié

- **Rien n'a tourné chez Google** : la lecture des vrais onglets, l'heure de Paris calculée par Google, l'envoi du mail.
- **L'affichage du mail** (tableaux) dans Outlook et sur ton téléphone : étape A, point 4.
- **L'heure réelle** du mail le vendredi : étape B, point 7.
- Le temps que ce mail ajoute au réveil des 10 minutes (un seul passage par semaine lit le Sheet) : je le lis dans le journal d'exécution le premier vendredi.
