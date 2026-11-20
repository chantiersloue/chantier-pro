# Essais groupés — lots 8d, 12, 13 et 14 en une seule séance

> Pour Franck. La branche `lot-14` contient les lots **8d** (récapitulatif des notes), **12** (accueil, favoris, réglage « tous les chantiers »), **13** (« Mes notes », « Garder pour plus tard ») et **14** (demande d'absence), plus le planning (lot 11.1, qui ne touche pas l'appli).
> **Un seul envoi sur la copie TEST, une seule séance d'essais** (environ 45 minutes : 5 au PC, 30 au téléphone, 10 au PC), au lieu de quatre.
> Le détail de chaque lot reste dans sa procédure (`docs/lot8d-procedure.md`, `lot12`, `lot13`, `lot14`). **Ne passe à la partie suivante que si la précédente est bonne.** Sinon : arrête-toi et envoie-moi une capture.

## Partie 1 — toi, au PC (5 minutes)

1. Je t'ai confirmé « dossier prêt, branche lot-14, serveur v11.4 ». PowerShell **dans le dossier `chantier-pro-lot14`** :
   ```
   node outils\envoyer-test.js --avec-porte
   ```
   Attends `✅ Envoi réussi`, version **v11.4**.
2. Dis-moi « envoi fait ». **Rien d'autre à faire dans l'éditeur** : les adresses de la direction sont dans le Sheet, et c'est l'installation qui y met la tienne pour les essais.

## Partie 2 — moi (10 minutes, sans toi)

Installation des lots 8d, 12 et 14 sur TEST — celle du lot 14 met **ton adresse** (celle des alertes) dans la ligne « Adresses de la direction » de l'onglet *Réglages* : pour les essais, la direction, c'est toi. Si cette adresse est celle du compte Google de Loué lui-même, je te le dis : il faudra ajouter ton Outlook dans la case, sinon la corbeille de Gmail ne serait pas essayée. Essais automatiques (le lot 8d t'envoie **3 mails** d'essai ; les lots 12 et 14 aucun), publication de la copie d'essai en **10.5**. Je te dis « à toi ».

## Partie 3 — toi, au téléphone (30 minutes)

Copie d'essai (icône « Loué ESSAI »), connecté avec un compte de **poseur** d'essai. Touche **Mettre à jour** : « À propos » doit afficher **10.5**.

**A. L'accueil (lot 12)**
1. « Mes chantiers » montre tes chantiers, chacun avec son étoile ★ ; « Tous les chantiers » est replié.
2. Déplie « Tous les chantiers » : classés par numéro. Touche une **☆** : le chantier monte dans « Mes chantiers ».
3. Touche une **★** : le chantier sort, le bandeau « Annuler » apparaît. Touche **Annuler** : il revient.
4. **Avec des gants** : vise l'étoile, puis le nom. Ni l'un pour l'autre.

**B. Les notes (lot 13)**
5. Ouvre un chantier, **Notes**, ajoute deux notes. Accueil → tuile **Notes** : tes deux notes, avec le chantier et la date.
6. Coche l'une d'elles : elle reste barrée un instant, puis descend dans « Faites (1) ».

**C. Une fiche gardée pour plus tard (lot 13), puis le récapitulatif (lot 8d)**
7. Commence un **quitus** (chantier, deux champs, **une photo**, une signature). Attends 5 secondes : la ligne **« 📝 Garder pour plus tard »** est en haut. Touche-la, confirme : la fiche repart vide, la ligne dit « 📝 Brouillons gardés (1) ».
8. Commence un autre quitus. Touche « 📝 Brouillons gardés » → **Reprendre** le premier : il revient **avec sa photo et sa signature** ; le second est dans la liste.
9. Ferme l'appli en pleine saisie, rouvre le quitus : le bandeau propose **Restaurer / Garder pour plus tard / Repartir à zéro**. Essaie **Garder pour plus tard**.
10. Fais pareil, plus vite, sur une **prise de cotes** (une fiche à lignes) : garder, reprendre.
11. Envoie une **note de réunion** sur un chantier d'essai, avec deux ou trois lignes. Accueil → ce chantier → **Récapitulatif des notes** : ta note est en haut.

**D. La demande d'absence (lot 14)**
12. Tuile **Demande d'absence** : « Mes demandes » est en haut (vide), le champ e-mail a disparu.
13. Fais une demande pour **un seul jour**, dans trois semaines, **motif « Médical »**, précisions « essai ». Envoie : la date (**écrite normalement, « 14/12/2026 »**) et **En attente** s'affichent.
14. Fais-en une seconde, **motif « École »**. (La liste des motifs commence par Congés, RTT, Récupération, École, Formation.)

**E. Tout ce qui se fait sans réseau, en une fois**
15. **Mode avion.** Ferme l'appli, rouvre-la.
16. Accueil : tes étoiles sont là ; mets-en une, retire-en une.
17. Tuile **Notes** : la liste s'affiche. Coche l'autre note : ⏳.
18. Le chantier de la note de réunion → **Récapitulatif des notes** : la liste s'affiche, avec « Pas de réseau : liste gardée… ».
19. **Demande d'absence** : tes deux demandes s'affichent encore.
20. Coupe le mode avion : le ⏳ de la note disparaît.

## Partie 4 — toi, au PC (10 minutes)

**F. Outlook : la direction, c'est toi le temps de l'essai**
21. Le mail « [Loué App] Demande d'absence — … » (motif Médical) : **deux vrais boutons, vert et rouge ?** PDF joint ? motif dans le mail ? boîte de réception ? **Envoie-moi une capture.**
22. Clique **✅ Accepter** : la page rappelle la demande (**date écrite normalement ?**) **sans le motif**. **N'appuie pas encore** : sur le téléphone, la demande est toujours « En attente ».
23. Appuie sur **Confirmer** : « ✅ Demande acceptée ». Un second mail arrive, « Absence acceptée » : il dit **« Dans le planning : Absent »**, pas un mot du motif.
24. Dans le premier mail, clique **❌ Refuser** : « Une réponse a déjà été donnée ». Aucun bouton.
25. Dans le mail de la demande « École » : **❌ Refuser**, puis **Confirmer**. Pas de mail « Absence acceptée ».
26. Sur le téléphone, *Demande d'absence* : **Acceptée** et **Refusée**.
27. Gmail **du compte de Loué**, « Messages envoyés » : les deux mails « [Loué App] Demande d'absence — … » **n'y sont plus** ; ils sont dans la **corbeille**. (Si ton adresse est celle du compte de Loué lui-même, ils sont gardés : c'est voulu, voir `docs/lot14-procedure.md`.) Depuis Outlook, **réponds** « Bien reçu » au premier mail : ta réponse, qui arrive dans la boîte du compte de Loué, n'est **pas** jetée.

**G. Le Sheet et le Drive de TEST**
28. Onglet ***Absences suivi*** : deux lignes, aucun motif ; colonne « Copie dans Gmail » : « à la corbeille le … ». Onglet *Absences* : « (réservé à la direction) ».
29. Onglet ***Réglages***, ligne « Adresses de la direction » : colonne C « Allumé : 1 adresse(s) lue(s) ». **Efface ta case B**, attends 10 minutes (« Éteint »), fais une demande d'absence au téléphone : elle part comme aujourd'hui, et tu reçois l'alerte « Demande d'absence partie comme avant ». **Remets ton adresse.**
30. Onglet ***Réglages***, ligne « Tous les comptes ouvrent tous les chantiers » : **coche** la case. Sur le téléphone, ferme complètement l'appli et rouvre-la : « Tous les chantiers » en montre plus ; ouvre un chantier qui n'était pas à toi (carnet, notes, récapitulatif s'ouvrent).
31. Attends que la colonne « État » dise « Allumé depuis le … » (10 minutes au plus). Puis **décoche**, ferme et rouvre l'appli : ce chantier a disparu. Dix minutes plus tard : « Éteint depuis le … ».
32. Drive de TEST, dossier du chantier de la note de réunion : le fichier « RÉCAPITULATIF DES NOTES - … » contient ta note (dix minutes après l'envoi).

Dis-moi « essais faits », avec tes remarques et la capture d'Outlook.

## Production du groupe A (toi : 20 minutes) — après « essais faits » et mon accord

1. Dans `chantier-pro-lot14` : `node outils\envoyer-test.js --sans-porte` (c'est le fichier qui ira en production ; je vérifie son empreinte).
2. Éditeur Apps Script **de production** : remplace tout `Code.gs` par `A-COLLER-DANS-APPS-SCRIPT/Code.gs` **du dossier `chantier-pro-lot14`** (la ligne `VERSION_API` dit `v11.4`). **Enregistre.**
3. Lance, l'une après l'autre (liste en haut → la fonction → ▶) : **`installerLot8dProduction`**, **`installerLot12Production`**, **`installerLot14Production`**. Chacune finit par `✅ … installation terminée.` Elles se relancent sans danger.
4. **Déployer → Nouveau déploiement** (« Groupe A — production »). Donne-moi l'adresse.
5. Je mets l'adresse dans `commun/config.js` et je te donne le lien de fusion. Après la fusion : « À propos » affiche **10.5**.
6. Ce qui arrive **éteint** : « tous les chantiers ouverts » (case de l'onglet *Réglages*) et la réponse de la direction aux absences (case « Adresses de la direction », **vide** : tu y mettras les vraies adresses toi-même). Tant qu'elle est vide, tu reçois une alerte les jours où une absence arrive.
7. **Anciens déploiements** : le précédent, à archiver une semaine après la fusion.

## Ensuite

- Le programme du PC pour le récapitulatif (lot 8d, étape C de sa procédure) : 5 minutes, à part.
- La suite : `docs/feuille-de-route.md` (branche `lot-5`).
