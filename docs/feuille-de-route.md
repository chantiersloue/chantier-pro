# Feuille de route — lundi 16/11/2026

> Tes actions, dans l'ordre, avec le temps estimé. Une mise en production par lot, sauf le carnet (4a + 4b + retrait de la tuile « Plans » ensemble). Rien n'a été fait ce week-end sur la production, les vraies données ni la copie TEST.

## Où en est chaque lot

| Lot | État au 16/11 | Peut partir aujourd'hui ? |
|---|---|---|
| **Carnet** (4a + 4b + retrait de la tuile « Plans »), serveur v9.1, appli 9.0 | construit, relu deux fois, poussé sur `lot-4` | **oui** |
| **4c** (programme du PC : dépôt au carnet depuis les bordereaux, recopie automatique des fiches) | construit et relu ; **corrections de la relecture en cours** | pas encore : après seconde relecture |
| **5** (stockage, alerte, purge), serveur v10.0 | construit contre le faux serveur ; **relecture indépendante en cours** | pas encore ; et seulement après le carnet |
| **8a et 8b** (note de réunion : annotation rouvrable, numéro du compte rendu) | **en construction** | non |
| **8c** (points repris d'une note à l'autre) | plan écrit et critiqué ; **attend tes réponses** | non |

## 1. Le carnet — à faire aujourd'hui (environ 1 h 15 de ton temps, en trois fois)

| # | Qui | Quoi | Temps |
|---|---|---|---|
| 1 | toi, au bureau | `node outils\envoyer-test.js --avec-porte` (serveur v9.1), puis me dire « Envoi fait » | 2 min |
| 2 | moi | essais réels sur la copie TEST, essai de la liste des partages, republication de la copie d'essai | 20 min, sans toi |
| 3 | toi, téléphone | essais courts sur https://loue-essai.github.io/chantier-pro/ : la tuile « Plans » a disparu ; le planning s'ouvre ; le carnet s'ouvre, zoome, tourne ; « Tout télécharger » d'un document, puis mode avion | 10 min |
| 4 | toi, au bureau | `node outils\envoyer-test.js --sans-porte` | 2 min |
| 5 | toi, navigateur | production : coller `A-COLLER-DANS-APPS-SCRIPT/Code.gs` (v9.1), lancer `verifierConfig` (aucun ❌), **nouveau déploiement** « Lot 4 — production », me donner son adresse | 20 min |
| 6 | moi, puis toi | je prépare la livraison des pages et le lien de fusion ; tu fusionnes ; l'appli passe en 9.0 | 5 min pour toi |
| 7 | toi, au bureau | premier dépôt réel au carnet : créer `_prive\depot.json` (je te donne le texte), double-clic sur `outils\deposer.bat` | 15 min |
| 8 | toi, navigateur | lancer `listerPartagesPlans` en production (lecture seule) ; regarder l'onglet « Partages Plans » ; **c'est toi qui retires les partages** dans Drive | 10 min + le ménage |

Détail : `docs/lot4a-procedure.md` et `docs/lot4b-procedure.md`.

## 2. Tes décisions (20 minutes, quand tu veux ; elles débloquent la suite)

**Lot 4c**
1. Les noms des deux fichiers ajoutés à tes dossiers de chantier : `CHANTIERPRO - fiches rapatriees.json` (racine de chaque chantier) et `CHANTIERPRO - A VOIR.txt` (racine des chantiers).
2. Un document refait sous le même indice ne peut pas être redéposé au carnet : il faut l'indice suivant. D'accord ?
3. Ordre de mise en place proposé : d'abord coller les lignes dans `gestion-documentaire` et vérifier l'état documentaire sur un chantier, **puis** installer la tâche automatique.

**Lot 5**
4. Purge proposée **30 jours** après « Terminé » (la place est rendue 30 jours plus tard encore).
5. Alerte à **80 %**, seuil critique à 95 %.
6. Le carnet d'un chantier clôturé part en même temps que ses fiches.
7. **Pas de suppression définitive par le serveur** : tout va à la corbeille, annulable 25 jours.
8. Gmail, le poste qui fait déborder le compte : (a) un seul mail par fiche pour tous les destinataires ; (b) une ligne « Mails envoyés de plus de 3 mois » dans l'onglet des purges. Oui ou non pour chacune.

**Lot 8** (chapitre 11 de `docs/lot8-plan.md`, branche `lot-8`)
9. Les huit questions du plan, dont : numéro donné dans l'ordre d'arrivée au serveur ; note sans compte numérotée ou non ; nombre d'adresses tapées à la main ; bouton « Reprendre les destinataires de la note précédente » (je recommande non).

**Divers**
10. Un nom de chantier réel figurait dans deux fichiers de test du dépôt public depuis le lot 1. Je l'ai remplacé, mais il reste dans l'historique de GitHub. L'effacer demande de réécrire l'historique (opération lourde) : le veux-tu ?
11. Le compte Google « Loué Essais » ne sert plus à rien dans le projet : tu peux le supprimer ou le garder.

## 3. Le lot 4c — quand ses corrections seront relues (1 h 30, en une ou deux fois)

| # | Qui | Quoi | Temps |
|---|---|---|---|
| 1 | toi | compléter `_prive\depot.json` (dossier des chantiers sur le PC) | 5 min |
| 2 | toi et moi | table de passage des anciens numéros de documents aux nouveaux | 15 min |
| 3 | toi, avec Claude dans LOUE TRAVAIL | valider et coller les lignes dans `gestion-documentaire` (texte : `docs/contrat-skills.md`, chapitre 8) | 30 min |
| 4 | toi | premier essai **sur un seul chantier** : dépôt d'un document d'un bordereau, recopie des fiches | 15 min |
| 5 | toi, avec Claude dans LOUE TRAVAIL | « fais-moi l'état documentaire » et la veille des comptes rendus sur ce chantier : aucune fiche de l'appli ne doit apparaître comme un document à toi | 15 min |
| 6 | toi | double-clic sur `outils\installer-tache.bat` ; vérifier dans le Planificateur de tâches ; lire `CHANTIERPRO - A VOIR.txt` | 5 min |

Ensuite, plus rien à faire au quotidien pour les fiches. Détail : `docs/lot4c-procedure.md`.

## 4. Le lot 5 — après le carnet en production, et après sa relecture (1 h 30)

| # | Qui | Quoi | Temps |
|---|---|---|---|
| 1 | toi, au bureau | envoi `--avec-porte` du serveur v10.0 (branche `lot-5`) | 2 min |
| 2 | moi, avec toi 10 min | mesure sur la copie TEST ; on compare ensemble le chiffre à celui de one.google.com/storage | 30 min, dont 10 avec toi |
| 3 | moi | purge d'essai d'un faux chantier clôturé de la copie TEST, puis annulation | 20 min, sans toi |
| 4 | toi, téléphone | regarder les onglets *Stockage* et *Purges*, cocher une case, annuler | 15 min |
| 5 | toi | envoi `--sans-porte`, production (coller v10.0, `installerLot5Production`, nouveau déploiement) | 30 min |

**Aucune purge réelle n'est faite par moi** : la première sera la tienne, sur un chantier que tu choisis. Détail : `docs/lot5-procedure.md` (branche `lot-5`).

## 5. Le lot 8 — plus tard dans la semaine

- 8a (annotation des photos) : pages seules, pas d'envoi clasp ; tes essais sur téléphone (10 min), fusion.
- 8b (numéro du compte rendu, présents) : un envoi, tes essais (10 min), production (30 min).
- 8c : après tes réponses aux questions.

## 6. Rappels en attente (aucun n'est urgent)

- Lot 2 : `demarrerTransition` n'a pas été lancé en production.
- Archiver les déploiements « Lot 7 — production » (depuis le 20/11) et « Lot 3 — production » (une semaine après la production du carnet).
- Copie TEST : supprimer les quatre onglets « … (ancienne version …) ».
- Essai sur **iPhone** (carnet 4a et 4b) avant la remise de l'appli aux poseurs.
- `CLAUDE.md` : la liste des pages est périmée (signalements, notes, carnet) ; je te proposerai le texte.
