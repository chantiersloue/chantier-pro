# Lot 4a — Carnet de chantier : déposer et lire — procédure

> Plan : `docs/lot4-plan.md`. Mesures de l'étape 4.0 : `docs/lot4-etape0.md`. Serveur v9.0, appli 9.0.
> Rien n'est en production tant que l'étape D n'est pas faite.

## Ce que le lot 4a change, en bref

- Une tuile **« Carnet »** dans chaque chantier : la liste des plans validés, avec leur indice, et une visionneuse (zoom au doigt, rotation, pages, « Signaler ici »).
- Ce qui a été regardé reste dans le téléphone et se relit **sans réseau**. Le téléchargement complet d'un document (« Tout télécharger ») arrive au lot 4b.
- Un programme sur ton PC, **`outils\deposer.bat`**, transforme un PDF en images et le range dans le dossier du chantier. Les skills le lanceront tout seuls au lot 4c ; d'ici là, c'est toi (en production) ou moi (sur la copie TEST) qui le lançons.
- Rien ne change dans le Sheet. Aucun mail. La tuile « Plans » actuelle reste.

## Étape A — Copie TEST (toi : 2 minutes)

```
node outils\envoyer-test.js --avec-porte
```
Dis-moi « Envoi fait ». Je dépose alors de vrais plans d'essai dans le chantier d'essai de la copie TEST avec le vrai programme, je rejoue les mesures, et je publie la copie d'essai de l'appli.

## Étape B — Tes essais sur téléphone (15 minutes, Android **et** un iPhone)

La liste précise te sera donnée avec l'adresse de la copie d'essai. En résumé : ouvrir un plan, zoomer jusqu'à lire une cote, tourner le plan, changer de page, passer en mode avion et rouvrir le même plan, « Signaler ici », et le tout dehors, en plein jour.

## Étape C — Dernier envoi sur TEST avant la production (toi : 2 minutes)

```
node outils\envoyer-test.js --sans-porte
```

## Étape D — Production (30 minutes)

1. Coller `A-COLLER-DANS-APPS-SCRIPT/Code.gs` (v9.0) dans l'éditeur Apps Script de production, enregistrer.
2. Lancer `verifierConfig` : aucun ❌. (Le lot 4a n'ajoute aucun onglet : pas de fonction d'installation.)
3. **Nouveau déploiement** « Lot 4a — production » ; me donner son adresse.
4. Je prépare la livraison des pages et le lien de fusion ; tu fusionnes ; l'appli passe en 9.0.

## Étape E — Premier dépôt réel (toi : 10 minutes)

1. Une seule fois : créer le fichier `_prive\depot.json` avec le chemin de la racine du Drive de l'appli sur ton PC (je te donne le texte exact à ce moment-là ; ce fichier ne part jamais sur GitHub).
2. Double-cliquer sur `outils\deposer.bat` et répondre aux questions : dossier du chantier, PDF (tu peux le glisser dans la fenêtre), code du document (105, 106…), indice, intitulé.
3. Attendre que Google Drive pour ordinateur ait fini d'envoyer les fichiers (quelques minutes), puis ouvrir le carnet du chantier dans l'appli.

Codes acceptés : 001 PPSPS, 002 temps de tâches, 103 tableau de portes, 104 repérage des portes, 105 et 106 réservations intérieures, 107 pose des huisseries, 108 boîtes aux lettres, 109 gaines techniques, 151 organigramme, 152 signalétique, 205 et 206 réservations extérieures.

## À savoir

- **Chaque demande au serveur prend 4 à 6 secondes**, même avec un bon réseau (c'est Google Apps Script). Une page s'affiche donc d'abord en aperçu, puis devient nette ; une zone déjà regardée s'affiche tout de suite.
- **Un nouvel indice** se dépose comme un nouveau document (même code, autre indice) : l'appli ne montre que le dernier. L'ancien reste dans le Drive jusqu'au lot 5.
- **Un document déposé par erreur** : `python outils\depot_carnet.py --dossier "<dossier du chantier>" --retirer 105-A` (il disparaît de l'appli ; aucun fichier n'est supprimé).
- **Contrôler un carnet** : `python outils\depot_carnet.py --dossier "<dossier du chantier>" --verifier`.
- Le programme ne crée jamais le dossier d'un chantier et ne supprime jamais rien. Il refuse un indice déjà déposé.
- Les plans gardés dans un téléphone appartiennent au compte qui les a ouverts ; ils sont effacés si un autre compte s'y connecte ou si l'accès au chantier est retiré. Ils ne prennent jamais la place des fiches : le carnet se limite à 400 Mo, laisse 80 Mo libres et efface ses images les plus anciennes d'abord.

## Retour arrière

- Pages : fusion inverse (la tuile « Carnet » disparaît, rien d'autre ne change) ; je prépare le lien si besoin.
- Serveur : redonner à `commun/config.js` l'adresse du déploiement « Lot 3 — production ».
- Le dossier `CARNET` des chantiers peut rester dans le Drive : sans la tuile, personne ne le voit.
