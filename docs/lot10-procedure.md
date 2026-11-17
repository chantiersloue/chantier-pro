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
- **Pas encore là (lot 10a-2)** : les gros boutons des articles habituels et les propositions pendant la frappe.

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
