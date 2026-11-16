# Lot 4c — Les skills et l'appli : dépôt au carnet depuis les bordereaux, rapatriement des fiches — plan

> Commande : `docs/lot4-plan.md` chapitre 8, `docs/contrat-skills.md` (règles 1, 3 et 4), résultat de l'essai A2 (`docs/lot4-etape0.md`), décisions D4-1, D4-10, D4-12.
> **Vocabulaire (précision de Franck, 14/11/2026)** : les skills travaillent sur les dossiers de chantier du PC (`Z:\CHANTIERS\…`) ; MEGA ne fait que synchroniser ces dossiers. Ce plan dit donc « dossier du chantier sur le PC ». **Décision D4-13** : la recopie des fiches est **automatique** (tâche planifiée de Windows) : voir le chapitre 10.
> **Version 2, refaite après critique par un agent indépendant** (ce qu'elle a fait changer : chapitre 9). Ce lot ne touche ni au serveur ni aux pages : il ajoute un programme sur le PC de Franck et quelques lignes à coller dans **un seul** skill (`gestion-documentaire`), que Franck validera avec Claude. Rien n'est lancé sur de vraies données sans lui.

## 1. Le constat

Un skill travaille dans un espace où le dossier du chantier sur le PC est monté, mais pas le Drive de l'appli. Il ne peut donc ni déposer un plan au carnet, ni recopier les fiches du Drive vers le dossier du chantier sur le PC. Le PC de Franck, lui, voit les deux.

**Principe : c'est le programme du PC qui fait tout, et les skills n'écrivent rien pour lui.** Le programme lit ce que les skills produisent déjà.

## 2. Deux solutions comparées

| | **A. Le skill écrit une « demande », le PC la traite** (version 1 de ce plan) | **B. Le PC lit les bordereaux** (retenue) |
|---|---|---|
| Comment le PC sait quoi déposer | un petit fichier écrit par le skill dans un nouveau dossier dans le dossier du chantier sur le PC | il regarde lui-même les PDF **figés dans `08 - DOCUMENTS ENVOYES AVEC BORDEREAU/BORDEREAU n`**, dont le nom porte le n° du chantier, le n° du document et l'indice |
| Nouveau dossier dans le dossier du chantier sur le PC | oui (contraire à la règle « pas de dossier de travail à part ») | **non** |
| Textes à coller dans les skills | un bloc dans chaque skill de plans (9 skills) | **quelques lignes dans `gestion-documentaire` seulement** |
| Risque qu'un fichier forgé fasse publier un mauvais plan, ou dans le mauvais chantier | réel : il faut six contrôles, et le skill choisit le chantier | **quasi nul** : le skill n'écrit rien pour le programme ; le chantier vient du nom du dossier du chantier sur le PC |
| « Version validée seulement » (D4-1) | dépend de ce que le skill décide d'écrire | **par construction** : seul ce qui est dans un bordereau est proposé, et Franck confirme document par document |
| Ce que B ne couvre pas | — | un dépôt hors bordereau (on garde `deposer.bat`) ; un bordereau préparé mais pas envoyé (Franck répond « non » ou « plus tard ») |

**B est retenue** : moins de pièces, moins de risques, rien à maintenir dans neuf skills.

## 3. Le programme (`outils/appli_pc.py`, lancé par `outils\appli-pc.bat`)

Un double-clic, trois temps, tout en français simple :

### 3.1 Les chantiers suivis
Le programme ne devine jamais quel dossier du Drive correspond à quel dossier de chantier du PC. Il lit une **correspondance** tenue dans `_prive/depot.json` (jamais dans le dépôt public) :

```json
{ "racine": "<racine du Drive de l'appli sur le PC>", "chantiers_pc": "<dossier des chantiers sur le PC>",
  "chantiers": { "<n° du chantier>": { "chantier": "<nom dans l'appli>", "dossier_drive": "<nom du dossier dans le Drive>" } },
  "anciens_codes": { "<ancien n° de document>": "<n° actuel>" } }
```

- Le n° du chantier est lu au début du nom du dossier du chantier sur le PC (`NNN - …`).
- Une commande d'aide (`--associer`) liste les dossiers de chantier du PC et Drive sans correspondance et pose la question pour chacun ; elle refuse un dossier Drive technique (nom commençant par `_`, `ADMINISTRATIF`, dossier de planning) ou en double (`nom (1)`).
- `anciens_codes` : la table de passage des anciens numéros de documents aux nouveaux (décision de numérotation du 31/10/2026), à remplir avec Franck ; un document dont le numéro n'est ni actuel ni dans cette table est montré « numéro non reconnu » et n'est pas proposé.

### 3.2 Déposer au carnet
- Le programme parcourt, pour chaque chantier suivi, `08 - DOCUMENTS ENVOYES AVEC BORDEREAU/BORDEREAU n/*.pdf`. Il ne retient que les fichiers nommés `<n° chantier>-<lot>-<n° document>-<indice>-<INTITULÉ>.pdf` dont : le n° de chantier est celui du dossier ; le n° de document (après passage par `anciens_codes`) est dans la liste du carnet ; l'indice n'est **pas déjà au carnet** ; le fichier n'a pas été **écarté** par Franck.
- Pour chacun, il montre : chantier, bordereau, nom, nombre de pages, poids, date du fichier, et le dossier Drive où il ira. Franck répond **o** (déposer), **n** (écarter pour de bon ; noté dans `_prive/carnet-ecartes.json`, avec la taille du fichier : un fichier refait sous le même nom est proposé de nouveau) ou **Entrée** (plus tard).
- Le dépôt appelle `depot_carnet.deposer(...)` (lot 4a, inchangé), sans limite de 3 minutes, avec l'avancement page par page. À la fin : contrôle `verifier`.
- Si le même indice a été refait (même nom, autre contenu) alors qu'il est déjà au carnet : le programme le **signale** (« ce document a changé depuis son dépôt ») et propose de retirer l'ancien puis de déposer le nouveau.
- Menu « Retirer un document du carnet » (aujourd'hui en ligne de commande seulement).

### 3.3 Rapatrier les fiches de l'appli (Drive → dossier du chantier sur le PC)
Pour chaque chantier suivi, comme la règle 4 du contrat :
- sous-dossiers de `dossiers.json` (valeur par défaut si une clé manque ; `carnet` et `plans` exclus) ; **copier, jamais déplacer, jamais écraser, jamais renommer** ; copie sous un nom temporaire puis renommage (un arrêt ne laisse jamais un fichier tronqué sous son nom final) ; taille vérifiée ; sous-dossier créé dans le dossier du chantier sur le PC s'il manque ;
- **signalés sans être copiés** : les fichiers hors de ces sous-dossiers, le contenu de `_À CLASSER`, les raccourcis Google (`.gdoc`, `.gsheet`… : ils ne contiennent rien), un fichier de même nom mais de taille différente déjà dans le dossier du chantier sur le PC, les doublons `nom (1).pdf`, les chemins trop longs ;
- jamais les demandes d'absence (`ADMINISTRATIF`).

Le programme écrit ensuite **deux fichiers distincts** :
1. **dans le dossier du chantier sur le PC**, à la racine du dossier du chantier : `CHANTIERPRO - fiches rapatriees.json` — la liste **cumulée** de ce que le rapatriement a copié (chemin, taille, date de copie). C'est la **seule** source qui dit « ce fichier vient de l'appli » ; les skills la lisent (elle est dans le dossier du chantier sur le PC, donc montée chez eux) ;
2. **dans le Drive**, à la racine du dossier du chantier : `releve-pc.json` — le relevé de **présence** que le lot 5 lira avant toute purge (format du contrat). Le bilan affiché rappelle sa limite : il prouve « même nom, même taille sur le disque du PC », pas que MEGA a fini d'envoyer : **vérifier l'icône de MEGA**.

### 3.4 Garde-fous communs
- Rien n'est jamais supprimé, nulle part. Le programme n'écrit que : les images du carnet et `carnet.json` (Drive), les copies de fiches et la liste de provenance (dossier du chantier sur le PC), `releve-pc.json` (Drive), ses fichiers de `_prive/`.
- Un seul traitement à la fois : verrou dans `_prive/` portant le nom de la machine et le numéro du programme ; un verrou laissé par un programme qui ne tourne plus est repris, avec un message clair. Un seul PC est prévu.
- Racine du Drive sans `dossiers.json`, Drive pour ordinateur arrêté, dossier de chantier du PC absent : refus avant d'écrire quoi que ce soit.
- Noms comparés sans tenir compte de la façon dont les accents sont codés.
- Un bilan à la fin : ce qui a été déposé, copié, signalé, refusé ; et un journal daté dans `_prive/appli-pc/`.

## 4. Ce qui se colle dans `gestion-documentaire` (et nulle part ailleurs)

À valider par Franck avec Claude ; je ne modifie pas ses skills. Le texte exact est mis à jour dans `docs/contrat-skills.md`, chapitre 8.

1. **Identité du chantier (règle 1)** : inchangé, et **facultatif** — il dépend du connecteur Google Sheets, jamais essayé. Le reste du lot n'en dépend plus.
2. **Les fiches venues de l'appli** : « tout fichier listé dans `CHANTIERPRO - fiches rapatriees.json` (racine du chantier) est une fiche de l'appli : ni version, ni registre, ni archivage `0-OLD`, ni veille des comptes rendus ; ce fichier lui-même n'est pas un document ». Ajouts aux paragraphes concernés du skill (arborescence, « ce qu'on ne touche pas », état documentaire, migration) et aux docs de ses scripts (`gestiondoc.py`, `veille_cr.py`) : décrits en clair, appliqués par Franck avec Claude dans le projet LOUE TRAVAIL.
3. **Après l'envoi d'un bordereau** : « rappeler à Franck de double-cliquer sur *appli-pc* si un document du bordereau va au carnet ».
4. **Un skill n'écrit jamais dans le Drive de l'appli**, et le Drive n'a plus besoin d'être connecté aux skills (le contrat est corrigé partout où il disait le contraire ; remplace la partie « racine connectée » de D4-1).

## 5. Tests prévus (aucune donnée réelle)

- `unittest`, dossiers temporaires (un faux dossier de chantiers avec des bordereaux, un faux Drive) : correspondance (n° lu, dossier technique ou en double refusé) ; candidats au carnet (nom conforme, autre chantier, n° inconnu, ancien n°, déjà au carnet, écarté, refait) ; dépôt de bout en bout avec un PDF fabriqué ; rapatriement (copie, déjà présent, taille différente, hors sous-dossiers, `_À CLASSER`, raccourcis Google, doublons, `carnet` et `plans` exclus, arrêt en cours de copie, **rien de modifié dans le faux Drive à part `releve-pc.json`**, rien de supprimé nulle part) ; les deux fichiers conformes ; verrou repris ; refus avant écriture.
- Le `.bat` : sur le modèle de `deposer.bat` ; l'essai réel au double-clic est pour Franck.
- **Sur la copie TEST et un faux dossier de chantier du PC** (avec Franck) : un dépôt depuis un faux bordereau, un rapatriement.
- **Avec un vrai skill, sur un vrai chantier** (avec Franck) : après un rapatriement, « fais-moi l'état documentaire » et la veille des comptes rendus — aucune fiche de l'appli ne doit apparaître en « plusieurs versions », aucune note de l'appli comptée comme compte rendu.

## 6. Ce que Franck aura à faire

1. Trancher : le nom du fichier `CHANTIERPRO - fiches rapatriees.json` à la racine des chantiers dans le dossier du chantier sur le PC (seul ajout à l'archive maître).
2. Remplir la correspondance des chantiers (`--associer`, 5 minutes) et la table des anciens numéros de documents (avec moi).
3. Valider et coller les lignes dans `gestion-documentaire`, avec Claude (20 à 30 minutes).
4. Les essais du §5 (30 minutes).

## 7. Risques

| Risque | Parade |
|---|---|
| Plan publié dans le mauvais chantier | le chantier vient du n° du dossier du chantier sur le PC et d'une correspondance tenue par Franck ; le n° du chantier est recoupé avec le nom du PDF ; le dossier Drive est montré avant confirmation |
| Document non validé publié | seuls les PDF d'un bordereau sont proposés ; confirmation document par document |
| Bordereau refait après dépôt | signalé (« a changé depuis son dépôt »), retrait puis nouveau dépôt proposés |
| Le rapatriement abîme ou perd une fiche | copie seule, nom temporaire, jamais d'écrasement, taille vérifiée, tests |
| Les outils de `gestion-documentaire` prennent les fiches rapatriées pour ses documents | liste de provenance dans le dossier du chantier sur le PC, exception écrite dans le skill et ses scripts, **essai réel obligatoire** (§5) |
| Le relevé `releve-pc.json` fait croire à tort que tout est dans le dossier du chantier sur le PC | limite rappelée à l'écran ; le lot 5 demandera de vérifier l'icône MEGA avant toute purge |
| Programme arrêté en route | reprise du dépôt page par page (lot 4a) ; copies sous nom temporaire ; verrou repris |

## 8. Écarts assumés avec la commande

- « Un plan validé part au carnet tout seul » devient « **un double-clic**, et une confirmation par document » : un skill ne peut pas écrire dans le Drive, et publier un plan aux poseurs sans que Franck le voie n'est pas souhaitable.
- Le rapatriement n'est plus lancé par le skill « avant chaque bordereau » : il est fait à chaque double-clic, pour tous les chantiers suivis.
- Le skill ne tient plus de ligne de JOURNAL pour chaque rapatriement ; la liste de provenance en tient lieu.

## 9. Ce que la critique indépendante a fait changer (14/11/2026)

- **Plus de « demandes » écrites par les skills** : le programme lit les bordereaux. Disparaissent : le nouveau dossier dans le dossier du chantier sur le PC, le bloc dans neuf skills, le risque de demande forgée, la dépendance au connecteur Sheets.
- **Le chantier n'est plus choisi par le skill** : correspondance tenue par Franck, recoupée avec le n° du dossier du chantier sur le PC et le nom du PDF.
- **Deux fichiers distincts** : la provenance (dans le dossier du chantier sur le PC, lisible par les skills) et le relevé de présence (dans Drive, pour la purge). La version 1 confondait les deux, et les skills n'auraient pas pu lire le relevé.
- Rapatriement : nom temporaire, raccourcis Google et `_À CLASSER` signalés, chemins copiés listés.
- Essai réel obligatoire de l'état documentaire et de la veille après un rapatriement.
- Verrou repris s'il est orphelin ; confirmation document par document ; « écarté » mémorisé ; retrait d'un document accessible depuis le menu.

## 10. Décisions de Franck du 14/11/2026 (D4-13) : recopie automatique des fiches

- **Aucune manipulation au quotidien pour les fiches** : une tâche du Planificateur de tâches de Windows (déjà présent, rien à installer) lance la recopie **toutes les heures et à l'ouverture de session**. Vérifié sur le PC de Franck le 14/11/2026 : une tâche se crée **sans droits d'administrateur**.
- **Copie seulement** : jamais de suppression ni d'écrasement (règles du §3.3 inchangées).
- **Le bon dossier est trouvé tout seul** par le numéro du chantier en tête du nom de dossier. Aucun dossier ou plusieurs pour ce numéro, dossier du Drive sans numéro reconnaissable : rien n'est deviné, rien n'est copié pour ce chantier, et c'est **signalé** dans un fichier `CHANTIERPRO - A VOIR.txt` à la racine des dossiers de chantier du PC.
- Le relevé de présence écrit dans le Drive s'appelle `releve-pc.json`.
- Mise en place, une seule fois : `_prive/depot.json`, puis un double-clic sur `outils\installer-tache.bat` (`outilsetirer-tache.bat` pour revenir en arrière).
- Le dépôt au carnet reste un double-clic avec confirmation (un plan publié aux poseurs doit être vu par Franck).
- Solution de repli écartée parce que l'automatique est possible : la recopie seulement à la clôture du chantier, avec le lot 5.
- Limites : la tâche ne tourne que PC allumé et session ouverte ; Google Drive pour ordinateur doit tourner ; une fiche arrive dans le dossier du PC au plus tard une heure après son arrivée dans le Drive.

