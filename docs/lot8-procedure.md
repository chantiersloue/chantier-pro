# Lot 8 — Note de réunion : procédure de déploiement et de test

> Pour Franck. **Une seule livraison** :
> - l'annotation des photos qu'on peut rouvrir (8a) ;
> - l'onglet *Comptes rendus* et le compteur de mails (8b, **sans numéro ni présents** : tes réponses du 16/11/2026).
>
> **Les points (8c) sont retirés** (ta décision du 19/11/2026) : la note redevient un texte libre, des photos, un PDF par réunion. Le récapitulatif des notes par chantier que tu as demandé le même jour est un petit lot à part, le **8d** (`docs/lot8d-plan.md`).
>
> Elle se compose du **serveur v11.0** (le programme chez Google) et des **pages, appli 10.1**. Les numéros v11.1 et 10.2 étaient ceux des points : ils ne sortiront pas.
> **État au 19/11/2026** : les pages et le serveur sont ceux d'avant les points, relus par un agent indépendant le 16/11 ; toutes les séries de tests ont été relancées le 19/11 contre le faux serveur. Le serveur v11.0 doit être renvoyé sur la copie TEST (étape A).
> **Ne passe à l'étape suivante que si la précédente est verte.** Sinon : arrête-toi et envoie-moi une capture.

## Ce qui change, en clair

**Pour celui qui écrit la note**
- La note reste comme avant : chantier, date, objet, « Notes et commentaires » en texte libre (le micro du clavier marche), photos, destinataires. **Un PDF par réunion**, rangé dans le dossier du chantier.
- **Une photo annotée se rouvre** : ses traits reviennent un par un. La gomme efface un trait (pas la photo), « ↶ » annule le dernier trait, même un ancien. Tous les traits retirés : la photo redevient la photo d'origine.
- Un seul trait à la fois : un second doigt ou la paume posés pendant un tracé sont ignorés.
- Le brouillon automatique garde la photo, la photo d'origine et les traits.
- Une photo annotée **avant** la mise à jour garde ses anciens traits pour de bon. La page le dit.
- Sous les destinataires, la page annonce **combien de mails partiront**, et refuse une 11e adresse de la liste (quota de 100 mails par jour).
- Message de fin : « ✓ Compte rendu du 06/11/2026 envoyé — 3 mails envoyés ». Pas de numéro, pas de présents.

**Pour toi, au bureau**
- Un nouvel onglet ***Comptes rendus*** dans le Sheet : une ligne par note reçue (chantier, date de la réunion, objet, qui l'a rédigée, nom du PDF, heure de réception). Détail : `docs/structure-sheet.md`.

**À savoir**
- **Chantier tapé à la main et absent de la liste** : la note part, et sa ligne porte la remarque « chantier hors liste ».
- **Ne modifie pas la ligne de titres** de l'onglet *Comptes rendus*. Si elle change, les notes partent quand même (PDF et mails normaux), mais ne sont plus notées dans l'onglet ; tu reçois un mail (un par jour au plus). Remets les titres : tout reprend.
- Tu peux **trier** l'onglet : l'appli retrouve une note par son numéro de fiche.
- Le plafond de 10 adresses est tenu par la page seule : il peut être dépassé si les listes ne sont pas chargées (pas de réseau) ou par une note déjà en attente.
- Une photo annotée pèse le double dans le brouillon (la photo d'origine + l'image finale). Ce qui part au bureau ne change pas.

---

## Avant tout envoi : le bon dossier, la bonne branche, un seul lot à la fois

- La commande d'envoi sur la copie TEST envoie le serveur **du dossier d'où elle est lancée**. Le lot 8 est dans le dossier **`chantier-pro-lot8`** (branche `lot-8`). Je te le confirme par écrit avant chaque envoi (« dossier prêt, branche lot-8, serveur v11.0 »). Si je ne te l'ai pas confirmé, ne lance rien.
- Pareil pour la production : le fichier à coller est `A-COLLER-DANS-APPS-SCRIPT/Code.gs` **de ce dossier**. Il doit contenir `VERSION_API = 'v11.0'`, et je te donne son empreinte (un code de 10 caractères qui prouve que c'est le bon fichier).
- **La copie TEST ne porte qu'un lot à la fois** : chaque envoi remplace le serveur du lot précédent.
- La branche `lot-8` **contient déjà le lot 5** (serveur v10.0, en production) : rien du lot 5 n'est perdu en déployant le lot 8.

## Étape A — la copie TEST (toi : 2 minutes)

1. Je t'ai confirmé « dossier prêt, branche lot-8, serveur v11.0 ». Tu ouvres PowerShell **dans le dossier `chantier-pro-lot8`** et tu lances :
   ```
   node outils\envoyer-test.js --avec-porte
   ```
   Page Google → compte de Loué → **Autoriser**. Attends `✅ Envoi réussi`. La commande affiche la version : ce doit être **v11.0**. Dis-moi « envoi fait », avec l'empreinte affichée.
2. Je fais le reste sans toi : installation sur TEST par la porte de service (`installerLot8`), essais contre le vrai serveur TEST (`tests/reel-lot8.js` : deux notes envoyées au même instant, note renvoyée ; **2 mails, tous à ton adresse**), publication de la copie d'essai. **Pas de production avant que cet essai soit vert** : c'est le seul qui éprouve le vrai verrou de Google.
3. L'onglet *Comptes rendus* de la copie TEST a gardé les quatre colonnes des points (K à N). Elles ne gênent pas le serveur v11.0, qui ne lit que les dix premières. Si l'installation les refusait quand même : clic droit sur l'onglet → **Renommer** → `Comptes rendus ancien`, et dis-le-moi.

## Étape B — tes essais sur téléphone (15 min)

Sur la copie d'essai (icône « Loué ESSAI »). Les essais 1 et 2 sont **faits** (19/11 : la note en attente est partie, le brouillon d'avant la mise à jour est revenu).

1. *Fait.* La note mise en attente avant la mise à jour part au retour du réseau.
2. *Fait.* Le brouillon d'avant la mise à jour est proposé et revient entier. **À refaire en une minute après la nouvelle publication** : touche « Mettre à jour », vérifie que « À propos de l'appli » affiche **10.1** ; si un brouillon est proposé dans la note de réunion, **Restaurer** : ton texte est dans « Notes et commentaires ».
3. Écris une note : chantier, quelques phrases (essaie le **micro du clavier**), une **photo**. Touche la photo, trace deux traits et une flèche, **Valider**.
4. Touche de nouveau la photo : les traits sont là. Passe la **gomme** sur un trait : il s'efface, la photo dessous est intacte. **Valider**. Rouvre, touche **↶** jusqu'à ce qu'il n'y ait plus de trait, **Valider** : la photo n'est plus marquée « (annotée) ». Annote-la de nouveau.
5. **Destinataires** : ajoute deux adresses. Sous la liste, tu lis combien de mails vont partir.
6. Touche **Aperçu** : ton texte et ta photo avec ses traits. Ni numéro, ni présents, ni tableau de points.
7. **Envoie.** Message : « ✓ Compte rendu du … envoyé — … mails envoyés ». Dans le mail : le PDF porte le texte et la photo annotée.
8. Recommence une note, annote une photo, puis **ferme l'appli** sans envoyer. Rouvre la note : « Brouillon retrouvé » → **Restaurer**. La photo est là avec ses traits, et ils s'effacent encore.
9. **Mode avion.** Envoie cette note, puis écris-en une **seconde** et envoie-la aussi. Remets le réseau : les deux partent.
10. Ouvre l'onglet *Comptes rendus* de la copie TEST : **une ligne par note** envoyée, avec la date de la réunion et le nom du PDF.
11. Avec des **gants**, en plein soleil, d'une main : les boutons de l'annotation et « Envoyer » se touchent-ils bien ?

## Étape C — second envoi sur TEST, sans la porte

Dans le même dossier `chantier-pro-lot8` :
```
node outils\envoyer-test.js --sans-porte
```
C'est le fichier qui ira en production. Je revérifie par l'empreinte.

## Étape D — production (toi : 10 minutes)

1. Éditeur Apps Script de production : remplace tout `Code.gs` par `A-COLLER-DANS-APPS-SCRIPT/Code.gs` **du dossier `chantier-pro-lot8`** (je te donne son empreinte, et la ligne `VERSION_API` doit dire `v11.0`). **Enregistre**.
2. **Déployer → Nouveau déploiement** (description « Lot 8 — production »). Copie la nouvelle adresse et donne-la-moi : je la mets dans `commun/config.js`.
3. Dans l'éditeur, choisis la fonction **`installerLot8Production`** et clique ▶. Le journal doit finir par `✅ Lot 8 : installation terminée.` Elle crée l'onglet *Comptes rendus* avec ses 10 colonnes ; on peut la relancer sans danger.
4. Ouvre le lien de fusion que je te donne : **Create pull request**, **Merge pull request**, **Confirm merge**.
5. Vérification : dans l'appli, « À propos » affiche **10.1** ; l'adresse du serveur ouverte dans un navigateur affiche `Loué App API v11.0 OK`.

**L'ordre compte peu** : la nouvelle page marche avec l'ancien serveur (la note part, elle n'est simplement pas notée dans l'onglet), et l'ancienne page marche avec le nouveau serveur (ses notes sont notées dans l'onglet).

## Retour arrière

1. **D'abord le serveur seul.** Dans Apps Script, « Gérer les déploiements », remets l'ancien déploiement en service (son adresse n'a pas changé), et je remets cette adresse dans `commun/config.js`. La page 10.1 marche avec l'ancien serveur ; les brouillons ne sont pas touchés.
2. **Si la page doit reculer aussi** : une fusion inverse (je la prépare, tu la valides). L'ancienne page (9.0) relit les brouillons de la page 10.1 : le texte et les photos reviennent, avec leurs traits dans l'image ; seuls les traits ne se modifient plus.
3. L'onglet *Comptes rendus* peut rester. Aucune donnée existante n'est migrée : rien à sauvegarder ni à restaurer.

## Ce qui n'a pas été vérifié (à faire sur la copie TEST et sur téléphone)

- **Le vrai verrou de Google** (deux notes au même instant) avec le serveur v11.0 : `tests/reel-lot8.js`, que je lance après ton envoi de l'étape A. Les essais réels du 18/11 ont tourné avec le serveur des points (v11.1) : ils sont à refaire.
- **Gants, plein soleil, une barre de réseau, dictée du clavier sur Android et sur iPhone, réception des vrais mails** : ton étape B.
- **Un brouillon commencé sous la page des points (10.2)**, qui n'a existé que sur ta copie d'essai : son texte revient sous la page 10.1 (même champ) ; des points qu'il aurait contenus, avec leurs photos, seraient perdus. En production, ce cas n'existe pas.
