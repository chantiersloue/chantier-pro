# Lot 8d — Le récapitulatif des notes de réunion par chantier : procédure de déploiement et de test

> Pour Franck. Plan : `docs/lot8d-plan.md` ; tes trois réponses du 19/11/2026 : le programme du PC remplace ce fichier-là, et lui seul ; une page légère dans l'appli ; le 8d passe avant le lot 12.
> Une livraison en trois morceaux : le **serveur v11.1** (le programme chez Google), les **pages, appli 10.2**, et le **programme du PC** (`outils/appli_pc.py`).
> **État au 19/11/2026** : construit et testé contre le faux serveur et dans Chrome seulement. **Rien n'a encore tourné chez Google** : c'est l'étape A.
> **Ne passe à l'étape suivante que si la précédente est verte.** Sinon : arrête-toi et envoie-moi une capture.

## Ce qui change, en clair

**Pour les gars**
- Sur l'écran d'un chantier, une nouvelle ligne **« Récapitulatif des notes »**. Elle ouvre toutes les notes de réunion du chantier, à la suite : la date, l'objet, qui l'a rédigée, le texte. La plus récente en haut. Pas de photos (elles sont dans le PDF de chaque note).
- La page marche **sans réseau** : elle montre la dernière liste reçue, avec sa date.
- Rien ne change dans la note de réunion elle-même.

**Pour toi, au bureau**
- Dans le dossier `05 - CHANTIER/COMPTE RENDU` de chaque chantier, un fichier **« RÉCAPITULATIF DES NOTES - <chantier>.pdf »**. Il est **refait tout seul** dans les 10 minutes qui suivent chaque nouvelle note.
- L'onglet *Comptes rendus* gagne une colonne **K « Texte de la note »**.
- Ton programme du PC **remplace** ce fichier dans le dossier du chantier quand le Drive en a une version plus récente. C'est le **seul** fichier qu'il remplace.

**À savoir**
- **Le fichier a jusqu'à 10 minutes de retard** sur la dernière note. La page de l'appli, elle, est à jour tout de suite.
- **Les notes reçues avant ce lot** n'ont pas leur texte dans l'onglet : elles figurent avec leur date et la mention « Texte dans le PDF de la note ».
- **N'annote pas le récapitulatif sur ton PC** : un fichier que tu as modifié n'est jamais remplacé, et « A VOIR » te le signalera (« taille différente »). Si tu veux le garder annoté, renomme-le.
- **Ne mets pas d'autre fichier dont le nom commence par « RÉCAPITULATIF DES NOTES - »** et finit par `.pdf` dans le dossier `COMPTE RENDU` du Drive : l'appli le prendrait pour un ancien récapitulatif et le mettrait à la corbeille de Drive (il y reste 30 jours).
- **Chantier renommé** : le récapitulatif suit le chantier s'il a un numéro (colonne E). Le fichier à l'ancien nom part à la corbeille de Drive ; sur ton PC, l'ancien reste (le programme ne supprime jamais rien) : tu peux le jeter.
- **Chantier tapé à la main, absent de la liste** : la note part, mais n'entre dans aucun récapitulatif.
- **Tant que l'installation n'est pas faite** (étape D, point 3), le nouveau serveur se comporte exactement comme celui du lot 8.
- Coût : un petit PDF refait par note (quelques secondes sur les 90 minutes par jour du compte gratuit), aucun mail en plus.

---

## Étape A — la copie TEST (toi : 2 minutes)

1. Je t'ai confirmé « dossier prêt, branche lot-8d, serveur v11.1 ». Tu ouvres PowerShell **dans le dossier `chantier-pro-lot8d`** et tu lances :
   ```
   node outils\envoyer-test.js --avec-porte
   ```
   Attends `✅ Envoi réussi`, version **v11.1**. Dis-moi « envoi fait ».
2. Je fais le reste sans toi : installation sur TEST (`installerLot8d`), essai réel `tests/reel-lot8d.js` (**3 mails, tous à ton adresse**), publication de la copie d'essai en **10.2**. Cet essai est le seul qui prouve que le vrai Google fabrique le fichier, le remplace, et garde le texte tel qu'il a été tapé.
3. Tu regardes dans le Drive de TEST, dossier du chantier d'essai, `05 - CHANTIER/COMPTE RENDU` : le fichier « RÉCAPITULATIF DES NOTES - CHANTIER TEST AUTO.pdf ». Dis-moi si la présentation te va.

## Étape B — tes essais sur téléphone (5 minutes)

Sur la copie d'essai (icône « Loué ESSAI »), connecté. Touche **Mettre à jour** : « À propos » doit afficher **10.2**.

1. Envoie une note de réunion sur un chantier d'essai, avec deux ou trois lignes de texte.
2. Reviens à l'accueil, ouvre ce chantier, touche **Récapitulatif des notes** : ta note est en haut, avec sa date et son texte.
3. Passe en **mode avion**, ferme l'appli, rouvre-la, rouvre le récapitulatif : la liste s'affiche, avec « Pas de réseau : liste gardée dans le téléphone le … ».
4. Dix minutes après ta note, dans le Drive de TEST : le fichier du chantier contient ta note.

## Étape C — le programme du PC (5 minutes)

Le programme qui tourne toutes les heures est celui de ton dossier principal. Je te dirai quand le mettre à jour (après la fusion). Pour l'essayer avant, sur le chantier d'essai, dans le dossier `chantier-pro-lot8d` :
```
outils\appli-pc.bat
```
Choisis la recopie des fiches en **simulation** : la ligne « à remplacer : … RÉCAPITULATIF DES NOTES … » ne doit apparaître que pour ce fichier-là.

## Étape D — production (toi : 15 minutes)

1. Dans le dossier `chantier-pro-lot8d` : `node outils\envoyer-test.js --sans-porte` (c'est le fichier qui ira en production ; je vérifie son empreinte).
2. Éditeur Apps Script de production : remplace tout `Code.gs` par `A-COLLER-DANS-APPS-SCRIPT/Code.gs` **du dossier `chantier-pro-lot8d`** (la ligne `VERSION_API` dit `v11.1`). **Enregistre.** **Déployer → Nouveau déploiement** (« Lot 8d — production »). Donne-moi l'adresse.
3. Dans l'éditeur, choisis la fonction **`installerLot8dProduction`** et clique ▶. Le journal doit finir par `✅ Lot 8d : installation terminée.` Elle pose la colonne K ; on peut la relancer sans danger. **C'est elle qui met le récapitulatif en marche.**
4. Je mets l'adresse dans `commun/config.js` et je te donne le lien de fusion. Après la fusion : « À propos » affiche **10.2**.
5. **Le programme du PC** : je mets à jour ton dossier principal (une seule commande, que je te donne) ; la tâche automatique prend le nouveau programme au passage suivant.
6. **Anciens déploiements** : « Lot 8 — production » à archiver une semaine après cette fusion.

**L'ordre compte peu** : la nouvelle page avec l'ancien serveur dit « le serveur n'est pas encore à jour » ; l'ancienne page avec le nouveau serveur marche comme avant.

## Retour arrière

- **Arrêter le récapitulatif sans rien redéployer** : dans l'onglet *Comptes rendus*, change le titre de la colonne K (par exemple « Texte de la note (arrêté) »). Le serveur ne garde plus de texte et ne refait plus de fichier ; les notes partent comme avant. Remets le titre exact pour reprendre.
- **Revenir au serveur du lot 8** : je remets son adresse dans `commun/config.js` (tant que « Lot 8 — production » n'est pas archivé).
- Les fichiers déjà faits restent dans les dossiers ; rien n'est supprimé.

## Ce qui n'a pas été vérifié

- Le vrai Google : fabrication du PDF, remplacement du fichier, texte gardé tel quel par le vrai Sheet (étape A).
- La présentation du PDF du récapitulatif, jamais vue ailleurs que dans le faux Google (étape A, point 3).
- La page sur un vrai téléphone, en plein soleil, avec des gants (étape B).
- Le remplacement du fichier sur ton PC pendant que MEGA le synchronise : si MEGA tient le fichier, le programme note une erreur et réessaie à l'heure suivante.
- Un chantier avec plus de 300 notes de réunion : seules les 300 plus récentes sont reprises.
