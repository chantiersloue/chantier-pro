# Lot 8d — Le récapitulatif des notes de réunion par chantier — PLAN COURT

> **Construit le 19/11/2026** après tes trois réponses du même jour (chapitre 7) : **1 oui** (le programme du PC remplace ce fichier-là, et lui seul), **2 oui** (une page légère), **3 le 8d avant le lot 12**. Procédure : `docs/lot8d-procedure.md` ; décisions prises pendant la construction : D8d-… dans `DECISIONS.md`.
> Plan du 19/11/2026, sur ta demande du jour. Pas encore critiqué par un agent indépendant : il le sera une fois, après tes réponses au chapitre 7.
> Il vient après le lot 8 (note de réunion sans les points), qui part en production tel qu'il a été relu.

## 1. Ta demande

Un **récapitulatif des notes par chantier**, mis à jour tout seul à chaque nouvelle note : **la date de la réunion et le texte, sans les photos, la plus récente en haut**. Rangé dans le dossier du chantier (`05 - CHANTIER/COMPTE RENDU`), et consultable dans l'appli depuis le chantier. Ton programme du PC ne remplace jamais un fichier déjà copié : il faut prévoir ce cas.

## 2. Comment ça marche

1. À la réception d'une note, le serveur garde son **texte** dans l'onglet *Comptes rendus* (une colonne de plus, « Texte de la note »). Aujourd'hui, l'onglet ne garde que la date, l'objet et le nom du PDF.
2. Dans les 10 minutes, il refait le fichier **« RÉCAPITULATIF DES NOTES - <chantier>.pdf »** dans le dossier `05 - CHANTIER/COMPTE RENDU` du chantier : un titre, puis pour chaque note sa date, son objet, son auteur et son texte, la plus récente en haut. L'ancien fichier part à la corbeille de Drive.
3. Dans l'appli, depuis le chantier, une ligne **« Récapitulatif des notes »** ouvre une page qui montre la même chose.

Le récapitulatif est refait **après** l'envoi de la note, par le passage de 10 minutes qui existe déjà : l'envoi d'une note n'est ni ralenti ni bloqué s'il échoue, et il est retenté au passage suivant.

## 3. Trois choix comparés

**Ton programme du PC et le fichier qui change**

| Solution | Pour | Contre |
|---|---|---|
| **A. Un seul fichier, au nom fixe ; ton programme du PC a le droit de le remplacer, lui et lui seul** (retenue) | un seul récapitulatif dans le dossier du PC et dans MEGA, toujours à jour | une retouche du programme du PC : il reconnaît ce fichier à son nom exact, et seulement dans le dossier `COMPTE RENDU` ; tout autre fichier garde la règle « jamais remplacé » |
| B. Un fichier daté à chaque note (« … au 19-11-2026 ») | rien à changer dans le programme du PC | un fichier de plus par réunion dans ton dossier et dans MEGA, à trier à la main |
| C. Le programme du PC ignore le récapitulatif | rien à changer non plus | il n'est jamais sur ton PC ni dans MEGA, alors que MEGA est l'archive maître |

Avec A, rien n'est perdu quand le fichier est remplacé : chaque note garde son propre PDF, et le nouveau récapitulatif contient tout l'ancien.

**Dans l'appli : une page, ou le PDF**

| Solution | Pour | Contre |
|---|---|---|
| **A. Une page de l'appli qui affiche les dates et les textes** (retenue) | légère, lisible sur un téléphone, gardée dans le téléphone pour le hors réseau | une page de plus |
| B. Ouvrir le PDF | une seule présentation | lourd à télécharger avec une barre de réseau, petit à lire sur un téléphone |

**Quand refaire le fichier**

| Solution | Pour | Contre |
|---|---|---|
| **A. Dans les 10 minutes, par le passage qui existe déjà** (retenue) | la note part aussi vite qu'aujourd'hui ; un échec est retenté | le fichier a jusqu'à 10 minutes de retard (la page de l'appli, elle, est à jour tout de suite) |
| B. Pendant l'envoi de la note | à jour à la seconde | 2 à 4 secondes de plus pour le gars qui envoie, et un PDF raté de plus à gérer |

## 4. Les règles de détail

- **Qui le voit dans l'appli** : tout compte qui a accès au chantier (avec le réglage du lot 12 allumé : tous les comptes). Sans compte : rien.
- **Chantier tapé à la main, absent de la liste** : la note n'entre dans aucun récapitulatif (elle n'a pas de dossier de chantier connu).
- **Les notes reçues avant ce lot** n'ont pas leur texte dans l'onglet : elles apparaissent avec leur date et la mention « texte dans le PDF de la note ».
- **Chantier renommé** : le récapitulatif suit le chantier par son numéro (colonne E), comme l'onglet.
- **Le texte reste du texte** : une formule tapée dans une note n'est jamais exécutée dans le Sheet (protection déjà en place).
- **Taille** : le texte d'une note est coupé à 20 000 caractères dans l'onglet (il reste entier dans son PDF) ; le récapitulatif le dit quand c'est le cas.

## 5. Les endroits touchés (la règle des quatre endroits)

| Où | Quoi |
|---|---|
| Onglet *Comptes rendus* | une colonne « Texte de la note », ajoutée par une fonction d'installation |
| Serveur | garder le texte ; refaire le PDF du récapitulatif ; une lecture « récapitulatif » pour la page |
| Modèle de PDF | un nouveau modèle, simple : dates et textes |
| Appli | une page « Récapitulatif des notes », ouverte depuis le chantier |
| Programme du PC (`outils/appli_pc.py`) | le droit de remplacer ce fichier-là, avec ses tests |
| Documents | procédure, guide des poseurs, structure du Sheet, journal |

Coût sur les quotas : un PDF de plus par note de réunion (quelques secondes sur les 90 minutes par jour), aucun mail en plus. Sur les 15 Go : un petit fichier de texte par chantier ; l'ancien reste 30 jours dans la corbeille de Drive, comme tout fichier remplacé.

## 6. Tests et place dans l'ordre

Tests sans Google (règles du récapitulatif, ordre, note renvoyée deux fois, texte très long), tests du programme du PC (le récapitulatif est remplacé, un autre fichier du même dossier ne l'est jamais), essais sur la copie TEST, la page à 375 px et hors réseau. Relecture par un agent indépendant : oui (serveur et données).

**Place** : juste après le lot 8. L'ordre deviendrait **5c → lot 8 → 8d → lot 12 → 10a-1 → 10a-2 → 10b → mail unique**. Chaque lot glissé avant les lots 10 les retarde d'un jour au moins : dis-moi si tu préfères le 8d ou le 12 en premier.

## 7. Ce qu'il te reste à décider

1. **Ton programme du PC remplace ce fichier-là, et lui seul** (solution A) : d'accord ?
2. **Dans l'appli, une page légère** plutôt que le PDF : d'accord ?
3. **L'ordre** : 8d avant le lot 12, ou après ?
