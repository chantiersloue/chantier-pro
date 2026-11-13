# Lot 4a — Carnet de chantier : déposer et lire — procédure

> Plan : `docs/lot4-plan.md`. Mesures de l'étape 4.0 : `docs/lot4-etape0.md`. Serveur v9.1 (v9.0 jusqu’au retrait de la tuile « Plans »), appli 9.0.
> Rien n'est en production tant que l'étape D n'est pas faite.

## Ce que le lot 4a change, en bref

- Une tuile **« Carnet »** dans chaque chantier : la liste des plans validés, avec leur indice, et une visionneuse (zoom au doigt, rotation, pages, « Signaler ici »).
- Ce qui a été regardé reste dans le téléphone et se relit **sans réseau**. Le téléchargement complet d'un document (« Tout télécharger ») arrive au lot 4b.
- Un programme sur ton PC, **`outils\deposer.bat`**, transforme un PDF en images et le range dans le dossier du chantier. Les skills le lanceront tout seuls au lot 4c ; d'ici là, c'est toi (en production) ou moi (sur la copie TEST) qui le lançons.
- Rien ne change dans le Sheet. Aucun mail. La tuile « Plans » est retirée en même temps (décision de Franck du 13/11/2026 : `docs/lot4b-procedure.md`).

## Étape A — Copie TEST (toi : 2 minutes)

```
node outils\envoyer-test.js --avec-porte
```
Dis-moi « Envoi fait ». Je dépose alors de vrais plans d'essai dans le chantier d'essai de la copie TEST avec le vrai programme, je rejoue les mesures, et je publie la copie d'essai de l'appli.

## Étape B — Tes essais sur téléphone (15 minutes, Android **et** un iPhone)

Adresse : https://loue-essai.github.io/chantier-pro/ (elle affiche le bandeau rouge « MODE TEST »). Deux documents d'essai sont dans le carnet de **CHANTIER TEST 1** : « PLANS DE RESERVATIONS MEN INT » (2 pages A3) et « PLANS DE REPERAGE DES PORTES » (3 grands plans).

1. **Ouvrir** : accueil → CHANTIER TEST 1 → tuile **Carnet** → « PLANS DE REPERAGE DES PORTES ». La page arrive un peu floue, puis nette.
2. **Zoomer avec deux doigts** jusqu'à lire une cote et un numéro de porte. Est-ce net ? Le plan suit-il bien les doigts ?
3. **Déplacer** avec un doigt, **deux tapes rapides** pour grossir, boutons **+** et **−**.
4. **Tourner** : bouton ⟳ (quatre appuis = retour à l'endroit). Le plan reste-t-il sur ce que tu regardais ?
5. **Pages** : › et ‹ ; « ‹ Liste » pour revenir. Le document doit être marqué « ✓ déjà ouvert ».
6. **Mode avion** : rouvre le même plan, au même endroit : il doit s'afficher tout de suite. Va sur une zone jamais regardée : un message doit dire qu'elle n'est pas encore gardée.
7. **« ⚠ Signaler ici »** (réseau rétabli) : le signalement s'ouvre avec le chantier et le plan déjà notés. N'envoie rien, reviens en arrière.
8. **Dehors, en plein jour, avec des gants** si tu en as : les boutons se touchent-ils bien ? L'écran se lit-il ?
9. **Sur un iPhone** : refaire 1, 2, 4 et 6.
10. **Sur le PC** : ouvrir le même plan, zoomer à la molette.

## Ce que j'ai vérifié avant de te passer la main (13/11/2026)

- **Essais réels sur la copie TEST** (`node tests/reel-lot4.js`) : 11 vérifications réussies ; **124 images** servies par le vrai serveur, identiques à l'octet près aux fichiers écrits par le programme dans le Drive ; droits ; 15 téléphones en même temps sans erreur ; aucun mail.
- **La vraie page en « 3G lente »** contre la copie TEST (`node tests/reel-lot4-page.js`, réseau bridé à 50 Ko/s) : liste en 3,9 s (objectif 8) ; aperçu d'un grand plan en 8,6 s (objectif 10), net 10 s plus tard ; zoom au plus fin en 11,3 s (objectif 15) ; la même zone une seconde fois : immédiat.
- Google Drive pour ordinateur a envoyé les 20 Mo de plans en moins de deux minutes.

## Étape C — Dernier envoi sur TEST avant la production (toi : 2 minutes)

```
node outils\envoyer-test.js --sans-porte
```

## Étape D — Production (30 minutes)

1. Coller `A-COLLER-DANS-APPS-SCRIPT/Code.gs` (v9.1) dans l'éditeur Apps Script de production, enregistrer.
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
