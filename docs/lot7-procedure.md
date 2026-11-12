# Lot 7 — Signalement casse / manquant / à recommander : procédure de déploiement et de test

> Pour Franck. Le lot 7 passe le serveur en **v7.0** et l'appli en **7.0**.
> Tu n'interviens que pour : les envois clasp sur la copie TEST, les essais sur téléphone, le feu vert, la mise en production.
> **Ne passe à l'étape suivante que si la précédente est verte.** Sinon : arrête-toi et envoie-moi une capture.
> Plan : `docs/lot7-plan.md`. Outillage : `docs/guide-outillage.md`.

## Ce que le lot 7 change, en bref

- Une tuile **« Signaler »** dans chaque chantier : casse, manquant ou à recommander, en 30 secondes, avec ou sans photo, même sans réseau.
- Le **conducteur du chantier** reçoit un mail à chaque signalement, avec un PDF (les informations et les photos). Le **chef d'atelier** aussi, seulement si la case « Prévenir l'atelier » est cochée.
- Une tuile **« Signalements »** : le suivi. Conducteurs, admin et atelier voient tout et changent le statut (À traiter / Commandé / Livré / Clos). Chaque poseur voit les siens.
- Un nouvel onglet ***Signalements*** dans le Sheet, créé par la fonction d'installation.
- Ce lot emporte aussi l'outillage du serveur, jamais passé en production : la fonction d'installation unique, l'empreinte du serveur, un `verifierConfig` plus complet.

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
3. Je fais le reste sans toi : installation du lot sur TEST, essais contre le vrai serveur TEST, publication de la copie d'essai.

## Étape B — Tes essais sur téléphone (15 min)

**Avant de commencer, pour qu'aucun mail d'essai ne parte chez quelqu'un d'autre que toi** (la copie TEST garde peut-être de vraies adresses) :

1. **Le chantier.** Fais tous tes essais sur le chantier **« CHANTIER TEST AUTO »**. Je l'ai créé dans la copie TEST pour mes propres essais ; il n'a pas de conducteur, donc ses mails arrivent **à toi**. N'utilise pas un autre chantier : son conducteur recevrait tes essais.
2. **Le chef d'atelier.** Dans le Sheet **« ChantierPro TEST »**, onglet *Contacts*, regarde la ou les lignes dont la colonne **ChefAtelier** vaut `O`. L'adresse (colonne C) doit être **la tienne**. Sinon, remplace-la par la tienne le temps des essais, ou mets `O` sur ta propre ligne et retire-le des autres.

Ouvre la copie d'essai (icône **« Loué ESSAI »**, bandeau rouge ; « À propos » affiche **7.0**). Connecte-toi avec ton compte d'essai Admin (`franck01`).

Dans le suivi, tu verras aussi quelques lignes « ESSAI AUTOMATIQUE » : ce sont mes essais, déjà clos.

| # | Essai | Attendu |
|---|---|---|
| 1 | Ouvre le chantier **CHANTIER TEST AUTO** → **Signaler**. **Mode avion.** Choisis « Casse », « Bloquant », tape un repère, prends **une photo avec l'appareil**, **Envoyer** | « Signalement rangé dans le téléphone », indicateur « ⏳ 1 » ; la fiche se vide, le chantier reste |
| 2 | Coupe le mode avion | Le signalement part tout seul : « ✓ Tout est envoyé ». Tu reçois **un** mail « Signalement — Casse — … » avec un PDF qui contient la photo |
| 3 | Les gros boutons | Lisibles dehors, utilisables d'une main, même avec des gants |
| 4 | Un 2e signalement : « À recommander », commentaire **dicté au micro du clavier**, case **Prévenir l'atelier** cochée, sans photo | Tu reçois **un** mail (le conducteur du chantier et le chef d'atelier, c'est toi les deux fois : une seule adresse, un seul mail) |
| 5 | Retour → tuile **Signalements** | Tes deux signalements, le plus récent en haut, « atelier prévenu » sur le second. Passe le premier à **Commandé** : « ✓ Statut enregistré » ; ton nom apparaît dessous |
| 6 | Dans le Sheet TEST, onglet *Signalements* | Deux lignes, statut « Commandé » sur la première ; la colonne Statut est une liste déroulante |

Dis-moi ce que tu as vu, puis ton feu vert.

## Étape C — Dernier envoi sur TEST avant la production (toi : 2 minutes)

Sur ma demande :
```
node outils\envoyer-test.js --sans-porte
```
La copie TEST exécute alors **le fichier exact** qui ira en production. Refais un signalement (avec réseau, toujours sur CHANTIER TEST AUTO) pour le confirmer.

## Étape D — Production (30 min, au copier-coller pour ce lot)

Le serveur du lot 7 a sa **propre adresse** : l'ancien déploiement (lot 2) continue de servir les téléphones tant que les pages ne sont pas fusionnées. C'est aussi le retour arrière.

1. Vrai Sheet → Extensions → Apps Script. **Sauvegarde** : clique sur `Code.gs`, Ctrl+A, Ctrl+C, colle dans un fichier `_prive/Code-avant-lot7.gs`.
2. **Gérer les déploiements** : note la description et l'adresse du déploiement actuel (« Lot 2 — production ») dans `_prive/deploiements.txt`.
3. Colle le nouveau `Code.gs` : je te donne le lien du fichier (branche `livraison/lot-7`, dossier `A-COLLER-DANS-APPS-SCRIPT`) → icône **« Copy raw file »** ; dans l'éditeur : Ctrl+A, Ctrl+V, icône disquette. Un seul fichier `Code.gs` à gauche.
4. Vérifie que la propriété **`ENVIRONNEMENT`** n'est **pas** `TEST`, et qu'il n'y a **pas** de propriété `CLE_OUTILS_TEST`.
5. ▶ **`installerLot7Production`**. Lis le bilan :
   - première ligne : `Lot 7 — installation — environnement : PRODUCTION — Sheet « … » — serveur v7.0` ;
   - une ligne ✅ (l'onglet *Signalements*), puis `✅ Lot 7 : installation terminée.` ;
   - deux lignes ℹ : le **nombre** de chantiers « En cours » sans conducteur connu (leurs signalements t'arriveront à toi : complète la colonne D de l'onglet *Chantiers* si tu veux qu'ils aillent au conducteur) et le nombre d'adresses de chefs d'atelier. **Si « Aucun chef d'atelier »** : mets `O` dans la colonne *ChefAtelier* du bon contact, sinon la case « Prévenir l'atelier » ne prévient personne.
   - Une ligne ❌ : arrête-toi et envoie-la-moi.
6. ▶ **`verifierConfig`** : première ligne `Loué App API v7.0`, aucun ❌.
7. **Déployer → Nouveau déploiement** → type « Application Web », description **« Lot 7 — production »**, exécuter en tant que **moi**, accès **Tout le monde** → Déployer. Ouvre la nouvelle adresse : **`Loué App API v7.0 OK`**. **Envoie-moi l'adresse.**
8. Je vérifie que ce serveur est bien celui de la livraison (son empreinte), je mets l'adresse dans les pages, et je te donne le **lien pré-rempli** : **Create pull request**, **Merge pull request**, **Confirm merge**.
9. Trois minutes plus tard, sur ton téléphone (vraie appli) : « À propos » affiche **7.0**. Ouvre un chantier → **Signaler** → envoie un signalement réel vers toi → mail reçu, ligne dans l'onglet *Signalements* du vrai Sheet.
10. Montre la tuile « Signaler » aux gars. À leur dire : **« Bloquant » sans réseau ne part qu'au retour du réseau : dans ce cas, on téléphone.**

## À savoir sur les mails

- Un signalement = **un mail par adresse** : le conducteur du chantier, plus chaque adresse de chef d'atelier si la case est cochée. Avec un chef d'atelier, compte 2 mails par signalement coché ; le compte Google en permet 100 par jour, toutes fiches confondues.
- Si la limite du jour approche, le signalement est quand même enregistré : son mail part plus tard (dans les 2 heures), et le suivi affiche « mail parti en retard ».
- N'écris qu'**une** adresse par chef d'atelier dans *Contacts* : cinq adresses sur la même ligne, c'est cinq mails à chaque fois.

## Retour arrière

| Problème | Que faire |
|---|---|
| Les gars ne peuvent plus travailler après la fusion | Dis-le-moi : je prépare une demande de fusion qui remet **les pages 6.0.1 et l'adresse du lot 2** (son déploiement tourne encore). Rien à faire dans Apps Script |
| Un signalement resté dans un téléphone après ce retour | L'ancien serveur répond « type inconnu » : il reste dans le téléphone, marqué « à vérifier ». Rien n'est perdu |
| Revenir aussi à l'ancien serveur | Recolle `_prive/Code-avant-lot7.gs`, enregistre. L'onglet *Signalements* peut rester : l'ancien serveur l'ignore |
| Sur TEST | Les sauvegardes sont dans `_prive/Code-TEST-avant-…gs` (`docs/clasp.md`, « Retour arrière ») |

## Après la production

- Quand tous les téléphones sont en 7.0 depuis une semaine : dans Apps Script de production, **Gérer les déploiements** → archive « Lot 2 — production ». **N'archive jamais « Lot 7 — production ».**
- Désactive « API Google Apps Script » jusqu'au lot suivant.

## Ce que tu dois faire, en résumé

1. Étape A : un envoi clasp `--avec-porte`, à ma demande.
2. Étape B : vérifier le chef d'atelier de la copie TEST, puis les 6 essais sur téléphone, puis ton feu vert.
3. Étape C : un envoi clasp `--sans-porte`.
4. Étape D : production (points 1 à 7), m'envoyer l'adresse, 3 clics sur mon lien, contrôle, montrer la tuile aux gars.
