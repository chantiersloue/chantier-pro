# Lot 13 — La tuile « Notes » et « Garder pour plus tard » : procédure de déploiement et de test

> Pour Franck. Plan : `docs/lot13-plan.md`.
> Une livraison : le **serveur v11.3** (une petite retouche : la lecture « mes notes ») et les **pages, appli 10.4**.
> **État au 20/11/2026** : construit, testé contre le faux serveur et dans Chrome. **Rien n'a tourné chez Google**, et aucun vrai téléphone.
> **Ne passe à l'étape suivante que si la précédente est verte.** Sinon : arrête-toi et envoie-moi une capture.

## Ce qui change, en clair

**Les notes**
- « Notes de chantier » s'appelle **« Notes »** partout.
- Sur l'accueil, la tuile **« Notes »** est là pour **tout le monde**. Elle ouvre **« Mes notes »** : les notes que le gars a **écrites lui-même**, tous chantiers confondus, la plus récente en haut, avec le chantier et la date.
- **Une grande case à cocher** par note. Cochée : la note reste barrée trois secondes (un nouvel appui annule), puis descend dans **« Faites »**, en bas. On peut l'y décocher.
- Le nom du chantier, sous la note, ouvre la liste de ce chantier (pour modifier ou ajouter).
- **Sans réseau** : la dernière liste s'affiche ; une case cochée attend dans le téléphone (⏳) et part toute seule.
- **Toi et les conducteurs** : la même page, avec en bas le bouton **« Les notes de tous les chantiers »** (la vue d'avant, inchangée). Le chiffre rouge de la tuile reste pour vous.

**Le brouillon**
- Quand on rouvre une fiche qui a un brouillon, le bandeau propose maintenant **Restaurer**, **Garder pour plus tard** ou **Repartir à zéro**.
- En haut de chaque fiche, une ligne **« 📝 Garder pour plus tard »** apparaît dès que la fiche contient quelque chose. Un appui (et une confirmation) : la fiche est rangée, et repart vide.
- Dès qu'il y a des brouillons gardés, la ligne devient **« 📝 Brouillons gardés (2) »** : elle ouvre la liste (chantier, date, date limite), avec **Reprendre** et **Effacer**.
- **Reprendre** alors qu'une fiche est en cours : la fiche en cours est gardée à son tour. **Rien n'est jamais écrasé.**

**À savoir**
- **Une liste par sorte de fiche** : les brouillons gardés d'un quitus se retrouvent dans le quitus, pas dans la note de réunion.
- **5 brouillons gardés au plus par sorte de fiche, pendant 30 jours.** Au sixième, la page refuse et le dit ; elle n'efface rien. Passé 30 jours, un brouillon gardé disparaît (la liste affiche la date limite).
- Un brouillon **gardé exprès** n'est plus proposé à chaque ouverture : il attend dans la liste. Un brouillon mis de côté **tout seul** (bandeau resté sans réponse) est reproposé, comme aujourd'hui.
- « Mes notes » ne montre que les notes des chantiers que le gars peut encore ouvrir, et pas celles d'un chantier « Terminé ».
- On n'ajoute pas de note depuis « Mes notes » : une note appartient à un chantier.

---

## Étape A — la copie TEST (toi : 2 minutes)

1. Je t'ai confirmé « dossier prêt, branche lot-13, serveur v11.3 ». Tu ouvres PowerShell **dans le dossier `chantier-pro-lot13`** et tu lances :
   ```
   node outils\envoyer-test.js --avec-porte
   ```
   Attends `✅ Envoi réussi`, version **v11.3**. Dis-moi « envoi fait ».
2. Je vérifie le serveur et je publie la copie d'essai en **10.4**. Rien à installer dans le Sheet pour ce lot.

## Étape B — tes essais sur téléphone (10 minutes)

Sur la copie d'essai (icône « Loué ESSAI »), connecté. Touche **Mettre à jour** : « À propos » doit afficher **10.4**.

**Les notes**
1. Ouvre un chantier, **Notes**, ajoute deux notes. Reviens à l'accueil : tuile **Notes** → tes deux notes sont là, avec le chantier et la date.
2. Coche l'une d'elles : elle reste barrée un instant, puis descend dans « Faites (1) ».
3. **Mode avion** : ferme l'appli, rouvre-la, tuile **Notes** : la liste s'affiche. Coche l'autre note : ⏳. Coupe le mode avion : le ⏳ disparaît.
4. Ouvre la liste du chantier : les deux notes y sont cochées.

**Le brouillon** (sur la fiche que tu veux, par exemple le quitus)
5. Commence une fiche (chantier, deux champs, **une photo**). Attends 5 secondes : la ligne **« 📝 Garder pour plus tard »** est en haut. Touche-la, confirme : la fiche repart vide, la ligne dit « 📝 Brouillons gardés (1) ».
6. Commence une autre fiche. Touche « 📝 Brouillons gardés » → **Reprendre** la première : elle revient **avec sa photo** ; la seconde est dans la liste.
7. Ferme l'appli en pleine saisie, rouvre la fiche : le bandeau propose **Restaurer / Garder pour plus tard / Repartir à zéro**. Essaie **Garder pour plus tard**.
8. Envoie une fiche reprise : après l'envoi, elle n'est plus dans les brouillons gardés.

## Étape C — production (toi : 10 minutes)

1. Dans le dossier `chantier-pro-lot13` : `node outils\envoyer-test.js --sans-porte` (je vérifie l'empreinte).
2. Éditeur Apps Script de production : remplace tout `Code.gs` par `A-COLLER-DANS-APPS-SCRIPT/Code.gs` **du dossier `chantier-pro-lot13`** (la ligne `VERSION_API` dit `v11.3`). **Enregistre.** **Déployer → Nouveau déploiement** (« Lot 13 — production »). Donne-moi l'adresse.
3. Je mets l'adresse dans `commun/config.js` et je te donne le lien de fusion. Après la fusion : « À propos » affiche **10.4**.
4. **Anciens déploiements** : le précédent, à archiver une semaine après cette fusion.

**L'ordre compte peu** : la nouvelle page « Mes notes » avec l'ancien serveur dit « le serveur n'est pas encore à jour » ou « réservée aux conducteurs » (elle marchera dès le nouveau serveur) ; le brouillon ne dépend pas du serveur.

## Retour arrière

Je remets l'adresse du serveur précédent et les pages d'avant par une fusion. Les brouillons gardés restent dans les téléphones : la page d'avant les traite comme des brouillons « mis de côté » (elle les repropose à l'ouverture), rien n'est perdu.

## Ce qui n'a pas été vérifié

- Rien chez Google (la lecture « mes notes » sur le vrai Sheet).
- « Garder pour plus tard » n'a été essayé que sur la **note de réunion**, dans Chrome. La brique est la même pour les neuf fiches, mais une fiche avec des **signatures** ou un tableau de lignes (cotes, fabrication) n'a pas été essayée : c'est l'essai 5 à 7, à faire sur deux fiches différentes.
- Un téléphone à la mémoire pleine : la page doit refuser de garder et le dire (testé seulement par lecture du programme).
- Les cases à cocher de « Mes notes » avec des gants.
