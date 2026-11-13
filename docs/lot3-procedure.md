# Lot 3 — Notes de chantier (la liste des choses à faire) : procédure de déploiement et de test

> Pour Franck. Le lot 3 passe le serveur en **v8.0** et l'appli en **8.0**.
> Version simplifiée du 13/11/2026 (liste « façon Keep »), à ta demande après tes premiers essais.
> **Ne passe à l'étape suivante que si la précédente est verte.** Sinon : arrête-toi et envoie-moi une capture.
> Plan : `docs/lot3-plan.md` (chapitre 14). Outillage : `docs/guide-outillage.md`.

## Ce que le lot 3 change, en bref

- Une tuile **« Notes »** dans chaque chantier : la liste des choses à faire du chantier, partagée par l'équipe.
- **Un élément = une ligne de texte et une case à cocher.** On ajoute en bas de l'écran (en tapant, ou en dictant au micro du clavier). Tout marche sans réseau : ce qu'on ajoute ou coche part tout seul au retour du réseau. **Aucun mail.**
- **Toute personne qui a accès au chantier peut modifier le texte** : il suffit de le toucher.
- **Rien ne se supprime.** Un élément coché descend dans **« Éléments terminés »** (replié, avec leur nombre), d'où on peut le décocher.
- À l'écran : ni auteur, ni date, ni photo. **Le Sheet garde qui a fait quoi et quand** (onglet *Notes historique*), au cas où.
- Un **chiffre rouge** sur l'accueil signale ce que les autres ont ajouté ou modifié depuis ta dernière visite du chantier.
- Pour les conducteurs et l'admin : une tuile **« Notes de chantier »** à l'accueil, avec les listes de tous les chantiers et une recherche.
- Trois nouveaux onglets dans le Sheet, créés par la fonction d'installation : *Notes*, *Notes historique*, *Notes vues*.

## Étape A — Copie TEST (toi : 2 minutes)

1. Si tu l'avais désactivée : réactive **« API Google Apps Script »** sur `script.google.com/home/usersettings`.
2. À ma demande, dans PowerShell :
   ```
   cd $HOME\Documents\GitHub\chantier-pro
   ```
   ```
   node outils\envoyer-test.js --avec-porte
   ```
   Page Google → compte de Loué → **Autoriser**. Attends `✅ Envoi réussi`, puis dis-moi « envoi fait ».
3. Je fais le reste sans toi : rangement des onglets de la première version (renommés, rien n'est effacé), installation, essais contre le vrai serveur TEST, publication de la copie d'essai.

## Étape B — Tes essais sur téléphone (10 min)

Chantier **« CHANTIER TEST AUTO »** de la copie TEST. Ouvre la copie d'essai (icône **« Loué ESSAI »**, bandeau rouge ; « À propos » affiche **8.0**), connecte-toi avec ton compte d'essai Admin, ouvre le chantier → **Notes**.

Si la page affiche encore l'ancienne version (boutons « Modifier », « Supprimer », photos) : ferme complètement l'appli et rouvre-la.

| # | Essai | Attendu |
|---|---|---|
| 1 | **Mode avion.** Dicte un élément au micro du clavier, touche **Ajouter**. Ajoutes-en deux autres | Ils apparaissent tout de suite, dans l'ordre, avec « ⏳ » ; le champ se vide |
| 2 | Toujours en mode avion : touche le texte d'un élément, corrige-le, **OK**. Coche la case d'un autre | Le texte est corrigé. L'élément coché reste en place, barré, 3 secondes, puis descend dans **« Éléments terminés (1) »** |
| 3 | Commence à taper un élément, ferme l'appli sans l'ajouter, rouvre au même endroit | Ton texte est revenu dans le champ |
| 4 | Coupe le mode avion | Les « ⏳ » disparaissent tout seuls. **Aucun mail** |
| 5 | **Le champ d'ajout avec le clavier ouvert**, surtout sur iPhone | Le champ et le bouton « Ajouter » restent visibles au-dessus du clavier. C'est le point que je ne peux tester nulle part : dis-moi ce que tu vois |
| 6 | Ouvre **« Éléments terminés »**, décoche l'élément | Il revient dans la liste |
| 7 | Avec un second téléphone, ou un compte d'essai Poseur dont le chantier est coché (facultatif) | Il voit ta liste, avec « ● nouveau » sur tes éléments ; il peut cocher **et corriger** tes éléments |
| 8 | Accueil → tuile **Notes de chantier** | Les listes de tous les chantiers ; « Chercher » réduit la liste ; **Tout marquer comme lu** remet le chiffre rouge à zéro |
| 9 | Dans le Sheet TEST | Onglet *Notes* : une ligne par élément (10 colonnes). Onglet *Notes historique* : une ligne par geste, avec ton nom et l'heure |

Dis-moi ce que tu as vu, puis ton feu vert.

## Étape C — Dernier envoi sur TEST avant la production (toi : 2 minutes)

Sur ma demande :
```
node outils\envoyer-test.js --sans-porte
```
La copie TEST exécute alors le fichier exact qui ira en production. Ajoute un élément (avec réseau) pour le confirmer.

## Étape D — Production (30 min)

Le serveur du lot 3 a sa **propre adresse** : le déploiement du lot 7 continue de servir les téléphones tant que les pages ne sont pas fusionnées. C'est aussi le retour arrière.

1. Vrai Sheet → Extensions → Apps Script. **Sauvegarde** : `Code.gs`, Ctrl+A, Ctrl+C, colle dans un fichier `_prive/Code-avant-lot3.gs`.
2. **Gérer les déploiements** : note la description et l'adresse du déploiement actuel (« Lot 7 — production ») dans `_prive/deploiements.txt`.
3. Colle le nouveau `Code.gs` (je te donne le lien du fichier, branche `livraison/lot-3`) : Ctrl+A, Ctrl+V, disquette.
4. Vérifie que la propriété `ENVIRONNEMENT` n'est **pas** `TEST`, et qu'il n'y a **pas** de propriété `CLE_OUTILS_TEST`.
5. ▶ **`installerLot3Production`**. Le bilan doit montrer `environnement : PRODUCTION`, `serveur v8.0`, trois lignes ✅ (les onglets *Notes*, *Notes historique*, *Notes vues*), puis `✅ Lot 3 : installation terminée.`. Une ligne ❌ : arrête-toi et envoie-la-moi.
6. ▶ **`verifierConfig`** : première ligne `Loué App API v8.0`, aucun ❌.
7. **Déployer → Nouveau déploiement** → « Application Web », description **« Lot 3 — production »**, exécuter en tant que **moi**, accès **Tout le monde** → Déployer. Ouvre la nouvelle adresse : **`Loué App API v8.0 OK`**. **Envoie-moi l'adresse.**
8. Je vérifie l'empreinte du serveur, je mets l'adresse dans les pages et je te donne le **lien pré-rempli** : **Create pull request**, **Merge pull request**, **Confirm merge**.
9. Trois minutes plus tard, sur ton téléphone (vraie appli) : « À propos » affiche **8.0**. Ouvre un chantier → **Notes** → ajoute un élément → il apparaît, une ligne dans l'onglet *Notes* du vrai Sheet.
10. Montre la tuile « Notes » aux gars.

## À savoir

- **Qui voit quoi** : toute personne qui a accès au chantier (case cochée dans *Accès chantiers*, ou conducteur / admin) lit la liste, ajoute, corrige, coche et décoche. Un compte Atelier aussi, pour les chantiers cochés pour lui.
- **Rien ne se supprime dans l'appli.** Pour retirer un élément écrit par erreur : coche-le. Pour le faire disparaître pour de bon, supprime sa ligne dans l'onglet *Notes* du Sheet (toi seul).
- **Qui a écrit ou coché quoi ?** Onglet *Notes historique* : une ligne par geste (création, modification avec l'ancien et le nouveau texte, coché, décoché), avec le nom et l'heure. Si deux personnes ont corrigé le même élément en même temps, la dernière reçue a gagné, et l'historique le dit (« modification en même temps »).
- **Compte désactivé** : ce qu'il avait ajouté sans réseau ne part plus (cela reste dans son téléphone). C'est différent des fiches, acceptées pendant 7 jours.
- **Téléphone partagé** : ce que Paul a ajouté et qui n'est pas encore parti ne part jamais sous le nom de Pierre ; cela attend que Paul se reconnecte sur ce téléphone.
- **Tu renommes un chantier dans le Sheet** : remplace aussi son nom dans la colonne B de l'onglet *Notes* (Édition → Rechercher et remplacer, « Rechercher dans cette feuille »), sinon sa liste reste sous l'ancien nom.
- Tu peux trier et filtrer les trois onglets, **sans toucher à la ligne de titres** : si un titre est changé ou déplacé, les listes se bloquent sur tous les téléphones (rien n'est perdu, ils gardent tout) et tu reçois un mail « Listes Notes bloquées ». Remets le titre ; un élément resté plus de 8 heures en attente passe « à vérifier » dans le téléphone : il repart avec « Réessayer ».
- Quand tu renommes un chantier, remplace aussi son nom dans la colonne B de l'onglet *Notes vues*, sinon toute sa liste redevient « nouvelle » pour tout le monde.
- Une ligne supprimée à la main dans l'onglet *Notes* reste affichée sur les téléphones jusqu'à leur prochaine relecture de la liste.
- Ne modifie rien d'autre à la main.

## Retour arrière

| Problème | Que faire |
|---|---|
| Les gars ne peuvent plus travailler après la fusion | Dis-le-moi : je prépare une demande de fusion qui remet **les pages 7.0 et l'adresse du lot 7** (son déploiement tourne encore). Rien à faire dans Apps Script |
| Un élément resté dans un téléphone après ce retour | L'ancien serveur répond « type inconnu » : l'élément reste dans le téléphone, marqué « à vérifier ». Rien n'est perdu ; il repartira avec « Réessayer » quand le lot 3 sera remis |
| Revenir aussi à l'ancien serveur | Recolle `_prive/Code-avant-lot3.gs`, enregistre. Les trois onglets peuvent rester : l'ancien serveur les ignore |

## Après la production

- Quand tous les téléphones sont en 8.0 depuis une semaine : **Gérer les déploiements** → archive « Lot 7 — production ». **N'archive jamais « Lot 3 — production ».**
- Désactive « API Google Apps Script » jusqu'au lot suivant.
- Sur la copie TEST, tu peux supprimer les onglets « Notes (ancienne version …) » et « Notes historique (ancienne version …) » : ce sont ceux de la première version.
