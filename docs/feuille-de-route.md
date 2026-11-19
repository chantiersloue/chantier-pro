# Feuille de route — mardi 17/11/2026

> Tes actions, dans l'ordre, avec le temps estimé. Une mise en production par lot. Cette nuit, rien n'a été fait sur la production, les vraies données ni la copie TEST ; aucun mail n'est parti.

## Où en est chaque lot

| Lot | État au 17/11 | Aujourd'hui |
|---|---|---|
| **Carnet** (4a + 4b), appli 9.0 | en production | rien |
| **5** (stockage, purges), serveur v10.0 | serveur en production (ton déploiement « Lot 5 — production ») ; **les pages attendent son adresse** | finir : partie 1 |
| **4c** (programme du PC) | relu, réuni à `lot-5`, essayé sur la copie TEST (fiches seules) | premier vrai chantier : partie 2 |
| **8** (note de réunion en points : 8a + 8b sans numéro ni présents + 8c), serveur v11.1, appli 10.2 | construit sur `lot-8`, testé contre le faux serveur, relu une fois. **Jamais essayé chez Google** | essais sur la copie TEST : partie 3 |
| **Mail unique** (lot 5b) | plan écrit, rien de construit | ta décision : partie 4 |
| **10** (idées) | 8 idées classées, rien de construit | ta décision : partie 4 |

## 1. Finir le lot 5 (25 min pour toi)

| # | Qui | Quoi | Temps |
|---|---|---|---|
| 1 | toi | me donner l'adresse du déploiement « Lot 5 — production » | 1 min |
| 2 | moi | l'écrire dans `commun/config.js`, refaire la livraison, te donner le lien de fusion | 10 min, sans toi |
| 3 | toi | ouvrir le lien : **Create pull request**, **Merge pull request**, **Confirm merge** | 3 min |
| 4 | toi, éditeur Apps Script de production | vérifier que le service **Drive API** est dans « Services » (sans lui, le total de la place est faux) ; lancer `installerLot5Production` puis `verifierConfig` : aucun ❌ | 10 min |
| 5 | toi | lancer `mesurerStockage` ; ouvrir l'onglet *Stockage* ; comparer le total à one.google.com/storage | 5 min |
| 6 | toi, téléphone | l'onglet *Stockage* se lit ; l'appli marche comme avant | 5 min |

**Dans l'onglet *Purges*, ne coche pas encore** les lignes « Mails envoyés de plus de 3 mois » et « Anciens indices du carnet » : elles n'ont pas été essayées sur le vrai Google (voir partie 5). La purge « Chantier terminé » est essayée : la première vraie sera la tienne, sur un chantier que tu choisis.

Détail : `docs/lot5-procedure.md`.

## 2. Le 4c sur un vrai chantier (45 min, quand tu veux dans la journée)

| # | Qui | Quoi | Temps |
|---|---|---|---|
| 1 | toi | créer ton fichier de réglages (je te donne le texte) : dossier des chantiers sur le PC, un seul chantier pour commencer | 10 min |
| 2 | toi | « Voir seulement » : la liste de ce qui serait recopié et déposé, sans rien faire | 5 min |
| 3 | toi | premier passage réel sur ce chantier : les fiches arrivent dans son dossier sur le PC | 15 min |
| 4 | toi, avec Claude dans LOUE TRAVAIL | « fais-moi l'état documentaire » : aucune fiche de l'appli ne doit apparaître comme un document à toi | 15 min |

La tâche automatique (`installer-tache.bat`) : seulement après un passage réussi. Détail : `docs/lot4c-procedure.md`.

## 3. Le lot 8 sur la copie TEST (30 min pour toi, en deux fois)

À faire **après** la partie 1 : la copie TEST ne porte qu'un lot à la fois.

| # | Qui | Quoi | Temps |
|---|---|---|---|
| 1 | moi | préparer ton dossier principal sur la branche `lot-8` et te le confirmer par écrit | 5 min |
| 2 | toi, au bureau | `node outils\envoyer-test.js --avec-porte` ; la version affichée doit être **v11.1** ; me dire « envoi fait » | 2 min |
| 3 | moi | installation sur TEST, essais contre le vrai serveur TEST (deux notes au même instant ; **3 mails, tous à ton adresse**) | 30 min, sans toi |
| 4 | toi, téléphone | avant ma publication : un brouillon de note et une note en attente (mode avion), puis « prêt » ; ensuite les 13 essais de l'étape B | 20 min |
| 5 | toi | me dire ce qui gêne à l'écran (gants, soleil, texte coupé) | 5 min |

**Pas de production du lot 8 aujourd'hui** : elle vient après tes essais, un autre jour que celle du lot 5. Détail : `docs/lot8-procedure.md` (branche `lot-8`).

## 4. Tes décisions (15 min, quand tu veux)

1. **Mail unique** (`docs/lot5-mail-unique.md`) : d'accord sur le plan ? Si oui, je le fais critiquer puis je le construis. Je recommande de le mettre en service **après** le lot 8, à une semaine d'écart : deux changements d'envoi en même temps seraient difficiles à démêler.
2. **Lot 10** (`docs/lot10-idees.md`) : quelles idées retiens-tu ? Je recommande la 1 (QR code par chantier) et la 2 (rappel des signalements bloquants non traités).
3. **Lot 8** : les choix que j'ai pris seul sont dans `DECISIONS.md` (D8-21 à D8-46, branche `lot-8`). Les trois qui te concernent :
   - l'ordre des comptes rendus d'un chantier est l'ordre d'arrivée au bureau, pas la date de la réunion ;
   - un point clos peut être rouvert pendant les 3 comptes rendus suivants ;
   - sans accès au chantier, on peut ajouter des points, pas clore ni compléter ceux des autres.

## 5. Essais qui restent à faire sur la copie TEST

- **« Mails envoyés de plus de 3 mois »** : possible à partir de mercredi 18/11 (il faut un mail d'essai assez ancien).
- **« Anciens indices du carnet »** (un dossier entier à la corbeille, puis annulation).
- **iPhone** : `docs/essais-iphone.md`, 12 essais, 20 minutes, avant la remise de l'appli aux poseurs. Le guide à leur donner : `docs/guide-poseurs.md`.

## 6. Rappels en attente (aucun n'est urgent)

- `listerPartagesPlans` en production (lecture seule), puis le ménage des partages dans Drive : c'est toi qui les retires.
- Archiver les déploiements « Lot 3 — production » et « Lot 7 — production » (à partir du 20/11) ; plus tard « Lot 4 — production », une semaine après les pages du lot 5.
- Lot 2 : `demarrerTransition` n'a pas été lancé en production.
- Copie TEST : supprimer les quatre onglets « … (ancienne version …) » ; le chantier d'essai CHANTIER TEST AUTO est resté à « Terminé ».
- L'origine des 2 mails reçus en double : pas encore trouvée.
