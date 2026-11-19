# Lot 12 — Tous les chantiers ouverts à tous les comptes, et le nouvel accueil : procédure de déploiement et de test

> Pour Franck. Plan : `docs/lot12-plan.md` ; tes deux réponses du 19/11/2026 : les chantiers « Terminé » restent **visibles, en bas de la liste, grisés** ; ton accueil est le même écran que celui des gars, et tes chantiers de conducteur arrivent tout seuls dans « Mes chantiers ».
> Une livraison : le **serveur v11.2** (le programme chez Google) et les **pages, appli 10.3**.
> **État au 19/11/2026** : construit, testé contre le faux serveur et dans Chrome. **Rien n'a tourné chez Google.**
> **Ne passe à l'étape suivante que si la précédente est verte.** Sinon : arrête-toi et envoie-moi une capture.

## Ce qui change, en clair

**L'accueil, pour tout le monde**
- **« Mes chantiers »**, en haut : les chantiers que le gars a marqués d'une **étoile ★**, classés **par numéro**. Rien d'autre.
- **« Tous les chantiers (32) »**, en dessous, **replié**. Un appui le déplie : tous les chantiers, par numéro, avec la recherche ; les chantiers **terminés en bas, grisés**.
- **L'étoile est à gauche** de chaque chantier, large pour un doigt ganté. **☆** : le chantier va dans « Mes chantiers ». **★** : il en sort, et un bandeau « Retiré — **Annuler** » reste 6 secondes.
- Toucher le nom du chantier l'ouvre, comme avant.
- **Le premier jour, rien ne disparaît** : les chantiers que le gars avait dans « Mes chantiers » ont déjà leur étoile.
- Les étoiles sont **dans le téléphone** : elles marchent sans réseau. Sur un téléphone neuf, celles mises à la main sont à remettre.
- Ce qui disparaît : le classement « derniers chantiers ouverts d'abord » et le bouton « Voir tous les chantiers ».

**Le réglage (livré éteint)**
- Un nouvel onglet ***Réglages*** dans le Sheet, avec une ligne **« Tous les comptes ouvrent tous les chantiers »** et une **case à cocher**.
- **Case décochée** (c'est l'état à la livraison) : rien ne change, chacun voit les chantiers cochés dans *Accès chantiers*.
- **Case cochée** : tout gars qui a un compte actif voit et ouvre **tous les chantiers** (carnet, documents, notes, récapitulatif, fiches). Sans compte : toujours rien.
- **Ça agit tout de suite**, sans rien redéployer. Dans les 10 minutes, l'appli écrit à côté ce qu'elle a compris (« Allumé depuis le … »), et l'onglet *Accès chantiers* affiche « CASES SANS EFFET » en haut.
- **Revenir en arrière** : décoche. Les cases d'*Accès chantiers* reprennent leur effet, telles que tu les avais laissées.

**Ce que le réglage ne change pas**
- Toi, les conducteurs, l'admin : tout, comme avant.
- Un compte désactivé, ou pas de compte : rien, comme avant.
- Les signalements : chacun voit les siens ; conducteurs, admin et atelier voient tout (c'est une règle par rôle, pas par chantier).
- Les fiches ne proposent pas un chantier « Terminé » à un poseur (s'il en tape un, la page lui demande de confirmer).
- Les plans du carnet ne se téléchargent toujours tout seuls, en Wi-Fi, que pour le chantier ouvert à l'écran.

**À savoir**
- **Une case cochée dans *Accès chantiers* met encore le chantier dans « Mes chantiers » du gars**, une fois, même réglage allumé : c'est ta façon de lui pousser un chantier.
- **Un chantier « Terminé » sort de « Mes chantiers »** ; on le retrouve en bas de « Tous les chantiers ». Son carnet est purgé 30 jours après, comme aujourd'hui.
- **Ce que tu acceptes en allumant** : un téléphone perdu ou un mot de passe prêté donne accès à tous les chantiers en cours, plus seulement à ceux du gars. La parade existe : décocher « Actif » et cocher « Déconnecter ses téléphones » dans *Utilisateurs*, le jour même.
- **N'écris rien d'autre que la case** dans la colonne « Allumé ». Un texte (« oui »), deux lignes du même réglage, ou la ligne renommée valent **éteint** : dans le doute, l'appli reste fermée.

**Les chantiers du planning (prêt, mais éteint)**
- Le serveur sait déjà lire le futur Sheet « Planning Loué » (lot 11.1) et mettre en favoris les chantiers où un gars est planifié : nouvelle série, retour après une coupure, plafond de 4 par gars et par semaine avec un mail à toi seul.
- **Rien de cela ne tourne** tant que la propriété `PLANNING_SHEET_ID` n'existe pas dans le projet Apps Script. Elle sera posée à la mise en service du planning.

---

## Étape A — la copie TEST (toi : 2 minutes)

1. Je t'ai confirmé « dossier prêt, branche lot-12, serveur v11.2 ». Tu ouvres PowerShell **dans le dossier `chantier-pro-lot12`** et tu lances :
   ```
   node outils\envoyer-test.js --avec-porte
   ```
   Attends `✅ Envoi réussi`, version **v11.2**. Dis-moi « envoi fait ».
2. Je fais le reste sans toi : installation sur TEST (`installerLot12`), essai réel `tests/reel-lot12.js` (**aucun mail**) : réglage éteint puis allumé puis éteint, avec un compte d'essai de poseur ; publication de la copie d'essai en **10.3**.

## Étape B — tes essais sur téléphone (10 minutes)

Sur la copie d'essai (icône « Loué ESSAI »), connecté avec un compte de **poseur** d'essai. Touche **Mettre à jour** : « À propos » doit afficher **10.3**.

1. **Accueil** : « Mes chantiers » montre les chantiers d'avant, chacun avec son étoile ★. « Tous les chantiers » est replié.
2. Déplie « Tous les chantiers » : classés par numéro. Touche une **☆** : le chantier monte dans « Mes chantiers ».
3. Touche une **★** dans « Mes chantiers » : le chantier en sort, le bandeau « Annuler » apparaît. Touche **Annuler** : il revient.
4. **Avec des gants** : vise l'étoile, puis le nom. Tu ne dois ni ouvrir le chantier en voulant l'étoile, ni l'inverse.
5. **Mode avion**, ferme l'appli, rouvre-la : tes étoiles sont là ; mets-en une, retire-en une.
6. Dans le Sheet de TEST, onglet *Réglages* : **coche** la case. Sur le téléphone, tire l'accueil (ou rouvre l'appli) : « Tous les chantiers » en montre plus. Ouvre un chantier qui n'était pas à toi : carnet, notes, récapitulatif s'ouvrent.
7. **Décoche** la case : ce chantier disparaît de la liste, et son carnet répond « pas dans votre liste ».
8. Attends 10 minutes : la colonne « État » de l'onglet *Réglages* dit « Éteint depuis le … ».

## Étape C — production (toi : 15 minutes)

1. Dans le dossier `chantier-pro-lot12` : `node outils\envoyer-test.js --sans-porte` (c'est le fichier qui ira en production ; je vérifie son empreinte).
2. Éditeur Apps Script de production : remplace tout `Code.gs` par `A-COLLER-DANS-APPS-SCRIPT/Code.gs` **du dossier `chantier-pro-lot12`** (la ligne `VERSION_API` dit `v11.2`). **Enregistre.** **Déployer → Nouveau déploiement** (« Lot 12 — production »). Donne-moi l'adresse.
3. Dans l'éditeur, choisis la fonction **`installerLot12Production`** et clique ▶. Le journal doit finir par `✅ Lot 12 : installation terminée.` Elle crée l'onglet *Réglages*, **case décochée** ; on peut la relancer sans danger.
4. Je mets l'adresse dans `commun/config.js` et je te donne le lien de fusion. Après la fusion : « À propos » affiche **10.3**, et l'accueil a ses étoiles.
5. **Le jour où tu veux ouvrir tous les chantiers** : coche la case de l'onglet *Réglages*. Préviens les gars : « Tous les chantiers » en montre plus.
6. **Anciens déploiements** : le précédent, à archiver une semaine après cette fusion.

**L'ordre compte peu** : la nouvelle page marche avec l'ancien serveur (les étoiles sont dans le téléphone), et l'ancienne page marche avec le nouveau serveur.

## Retour arrière

- **Le réglage** : décoche la case. Effet immédiat, rien d'autre à faire.
- **L'accueil** : je remets l'adresse du serveur précédent et les pages d'avant par une fusion. Les étoiles restent dans les téléphones, sans effet.

## Ce qui n'a pas été vérifié

- Le vrai Google : la case à cocher lue par le serveur, l'état écrit dans l'onglet (étape A).
- Les étoiles avec des gants et en plein soleil sur un vrai téléphone (étape B).
- La lecture du planning : il n'existe pas encore chez Google. Elle est testée contre un faux planning seulement ; l'autorisation de Google pour ouvrir un second Sheet est à vérifier sur la copie TEST à la mise en service du planning (elle ne devrait rien demander de plus).
- Le temps pris par la lecture du planning sur les 90 minutes par jour du compte : à mesurer à ce moment-là.
