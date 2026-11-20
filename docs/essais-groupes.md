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
2. Éditeur Apps Script **de la copie TEST** → **Paramètres du projet** → **Propriétés du script** → ajoute :
   - `ABSENCE_DIRECTION` = **une adresse à toi** (celle que tu lis dans Outlook) ;
   - `ADRESSE_APPLI` = l'adresse de la copie d'essai (je te la donne).
3. Dis-moi « envoi fait ».

## Partie 2 — moi (10 minutes, sans toi)

Installation des lots 8d et 12 sur TEST, essais automatiques (le lot 8d t'envoie **3 mails** d'essai ; le lot 12 aucun), publication de la copie d'essai en **10.5**. Je te dis « à toi ».

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
14. Fais-en une seconde, **motif « École »**.

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

**G. Le Sheet et le Drive de TEST**
27. Onglet ***Absences suivi*** : deux lignes, aucun motif. Onglet *Absences* : « (réservé à la direction) ».
28. Onglet ***Réglages*** : **coche** la case. Sur le téléphone, ferme complètement l'appli et rouvre-la : « Tous les chantiers » en montre plus ; ouvre un chantier qui n'était pas à toi (carnet, notes, récapitulatif s'ouvrent).
29. Attends que la colonne « État » dise « Allumé depuis le … » (10 minutes au plus). Puis **décoche**, ferme et rouvre l'appli : ce chantier a disparu. Dix minutes plus tard : « Éteint depuis le … ».
30. Drive de TEST, dossier du chantier de la note de réunion : le fichier « RÉCAPITULATIF DES NOTES - … » contient ta note (dix minutes après l'envoi).

Dis-moi « essais faits », avec tes remarques et la capture d'Outlook.

## Ensuite

- Le programme du PC pour le récapitulatif (lot 8d, étape C de sa procédure) : 5 minutes, à part.
- La mise en production : `docs/feuille-de-route.md` (branche `lot-5`).
