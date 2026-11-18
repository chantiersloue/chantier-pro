# Lot 5c — Le planning lisible par les seuls comptes : procédure

> Pour Franck. **Une livraison** : le **serveur v10.1** et les **pages, appli 9.1**. Branche `lot-5c`, partie de la production (lot 5).
> **État au 18/11/2026 : construit et testé contre le faux serveur et dans un vrai Chrome seulement.** Rien n'a touché la copie TEST ni la production. Aucun mail.
> Plan : `docs/lot5c-plan.md`. **Ne passe à l'étape suivante que si la précédente est verte.**

## Ce qui change, en clair

- **Plus aucun fichier du planning n'est partagé par lien.** Le serveur remet en privé les fichiers du dossier *Planning* (et le dossier lui-même) à la première ouverture du planning après la mise en production. Tu n'as rien à faire dans Drive.
- Le téléphone ne reçoit plus de lien Google Drive : il demande le document au serveur, **avec son compte**.
- **Toucher un document** : « ⏳ Téléchargement… », puis « ✓ Prêt : touchez pour ouvrir le PDF ». **Second toucher** : le PDF s'ouvre avec le lecteur du téléphone. (Un téléphone refuse d'ouvrir un document qui n'arrive pas tout de suite après le toucher : d'où les deux touchers.)
- La liste affiche aussi le poids du document (« 240 Ko »).
- **Sans compte, le planning n'est plus visible**, même pendant la période sans compte : « Connectez-vous pour voir le planning ». Les poseurs qui n'ont pas encore de compte doivent en avoir un avant la mise en production.
- Un document de plus de **5 Mo** est refusé avec un message (« voyez avec le bureau »). Un fichier Google (Sheets, Docs) part en PDF ; un raccourci Drive n'est plus listé.
- Sur **iPhone** (appli installée), le second toucher ouvre le menu « Partager » du téléphone, qui montre le PDF.
- Si un partage ne peut pas être retiré par le serveur, tu reçois un mail « Planning encore lisible par lien ».
- **Les anciens déploiements doivent être archivés.** Chaque ancien déploiement de production (« Lot 3 », « Lot 4 », « Lot 7 — production »…) fait encore tourner l'ancien serveur, à une adresse qui figure dans l'historique public du dépôt. Tant qu'il tourne, n'importe qui peut lui demander le planning sans compte, et il remet les fichiers en partage par lien. **Le planning n'est protégé qu'une fois tous les anciens déploiements archivés.**
- Tu continues de déposer tes PDF dans le dossier *Planning* du Drive, comme avant.

## Étape A — la copie TEST (après les essais du lot 8)

La copie TEST ne porte qu'un lot à la fois : attends que les essais du lot 8 soient finis.

1. Je te confirme par écrit « dossier prêt, branche lot-5c, serveur v10.1 ».
2. PowerShell **dans le dossier `C:\Users\pavageauf\Documents\GitHub\chantier-pro-lot5c`** :
   ```
   node outils\envoyer-test.js --avec-porte
   ```
   La version affichée doit être **v10.1**. Dis-moi « envoi fait ».
3. Je publie la copie d'essai et je vérifie par la porte de service que les fichiers du planning de TEST sont redevenus privés.

## Étape B — tes essais (10 min)

Sur la copie d'essai (icône « Loué ESSAI »), **connecté** :
1. Accueil → **Planning** : la liste s'affiche, avec la date et le poids.
2. Touche un PDF : « ⏳ Téléchargement… », puis « ✓ Prêt ». Touche encore : **le PDF s'ouvre**. À faire sur **Android** et sur **iPhone** (c'est le point à vérifier : chaque téléphone ouvre le PDF à sa façon).
3. Reviens dans l'appli (bouton retour, ou balayage) : tu es toujours sur le planning.
4. **Déconnecte-toi** : le planning dit « Connectez-vous pour voir le planning ».
5. Sur ton PC, dans Drive (copie TEST), clic droit → **Partager**, sur un PDF du dossier *Planning*, **sur le dossier *Planning* lui-même et sur le dossier au-dessus** : « **Accès limité** » partout.
6. Copie l'ancien lien d'un PDF du planning (s'il t'en reste un dans un mail ou un message) et ouvre-le dans une fenêtre de navigation privée : Google doit **refuser l'accès**.

## Étape C — production (20 min)

1. Dans le même dossier : `node outils\envoyer-test.js --sans-porte` (c'est le fichier qui ira en production ; je vérifie l'empreinte).
2. Éditeur Apps Script de production : remplace tout `Code.gs` par `A-COLLER-DANS-APPS-SCRIPT/Code.gs` **de la branche `lot-5c`** (la ligne `VERSION_API` dit `v10.1`). **Enregistre.**
3. **Déployer → Nouveau déploiement** (« Lot 5c — production »). Donne-moi l'adresse : je la mets dans `commun/config.js` et je te donne le lien de fusion.
4. Dans l'éditeur, choisis la fonction **`fermerPartagesPlanning`** et clique ▶ : le journal doit dire « ✅ Planning : … aucun partagé par lien ». Sinon, retire à la main dans Drive ce qu'il cite.
5. Fusionne. Vérifie « À propos » : **9.1**. Ouvre le planning sur ton téléphone, puis dans Drive, un PDF du planning : « Accès limité ».
6. **Archive les anciens déploiements** (Apps Script → Déployer → **Gérer les déploiements** → choisir le déploiement → **Archiver**) :
   - tout de suite : « Lot 3 — production », « Lot 4 — production », « Lot 7 — production », et tout déploiement plus ancien encore actif ;
   - **une semaine après la fusion** (le temps que tous les téléphones aient pris la mise à jour) : « Lot 5 — production ».
   Ne garde actif **que** « Lot 5c — production ». Sur la copie TEST, archive aussi les anciens déploiements de test (garde seulement celui dont l'adresse est dans `commun/config.js`, ligne `URL_TEST`).
   **Les anciens déploiements doivent être archivés.** Chaque ancien déploiement de production (« Lot 3 », « Lot 4 », « Lot 7 — production »…) fait encore tourner l'ancien serveur, à une adresse qui figure dans l'historique public du dépôt. Tant qu'il tourne, n'importe qui peut lui demander le planning sans compte, et il remet les fichiers en partage par lien. **Le planning n'est protégé qu'une fois tous les anciens déploiements archivés.**

**L'ordre compte** : le serveur d'abord, les pages ensuite. La nouvelle page sait lire l'ancien serveur (elle ouvre son lien comme avant) ; l'ancienne page, avec le nouveau serveur, ne trouve plus de lien et propose la mise à jour.

## Retour arrière

Tant que « Lot 5 — production » n'est pas archivé : je remets son adresse dans `commun/config.js` et je te donne le lien de fusion. Après son archivage : nouveau déploiement de l'ancien `Code.gs` (sauvegardé dans `_prive`). **Attention** : l'ancien serveur remettra les fichiers du planning en partage par lien à la première ouverture.

## Après la mise en production

Je reporte ce lot dans les branches `lot-8`, `lot-10a1`, `lot-10a2`, `lot-10b` et `lot-5b`, pour qu'aucune mise en production suivante ne remette l'ancien comportement.

## Ce qui n'a pas été vérifié

- L'ouverture du PDF reçu sur un vrai Android et un vrai iPhone (appli installée sur l'écran d'accueil) : étape B, point 2.
- La remise en privé sur le vrai Drive, en particulier si le **dossier** *Planning* est partagé par lien : étape A, point 3, et étape B, point 5.
- Le temps de téléchargement d'un planning de 4 à 5 Mo avec une barre de réseau, et la réponse du vrai serveur pour un fichier de cette taille : je l'essaierai sur la copie TEST avec un PDF de 4,9 Mo.
- Le menu « Partager » de l'iPhone pour un PDF, et l'ouverture d'un PDF reçu sur Android (il peut être enregistré dans « Téléchargements » au lieu d'être affiché).
