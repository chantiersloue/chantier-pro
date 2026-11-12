# Contrat entre l'appli ChantierPro et les skills de Franck (lot 9b)

> **Pour qui ?** Pour Franck, et pour les skills Claude du projet LOUE TRAVAIL (`gestion-documentaire`, `metre-plinthes`, et les skills qui produisent des plans).
> **À quoi ça sert ?** L'appli et les skills manipulent les mêmes chantiers. Ce contrat dit **qui écrit quoi, où, et sous quel nom**, pour que la même information ne soit saisie qu'une fois et que personne n'écrase le travail de l'autre.
> **Ce fichier est public** (le dépôt l'est) : il ne contient aucun identifiant, aucun lien, aucun nom de client ni de chantier réel.
> **Rien n'est déployé par ce lot.** Je ne modifie pas tes skills : les textes à y coller sont au chapitre 8, tu les colles toi-même.

## En deux minutes

| # | Règle | Qui l'applique | Utilisable quand ? |
|---|---|---|---|
| 1 | L'identité d'un chantier (n°, nom, adresse, client, architecte, conducteur) se lit dans l'onglet *Chantiers* du Sheet. La FICHE INFO en garde une copie. | `gestion-documentaire` | **Dès maintenant** |
| 2 | Les intervenants de la FICHE INFO sont recopiés dans l'onglet *Intervenants* du Sheet, dans un seul sens. | `gestion-documentaire` | **Dès maintenant** (l'appli s'en servira au lot 8) |
| 3 | Les plans utiles aux poseurs sont déposés dans le carnet avec un seul script, `depot_carnet.py`. | les skills de plans | **Au lot 4 seulement** (le script n'existe pas encore) |
| 4 | Les fiches produites par l'appli (PDF, photos) sont recopiées de Drive vers MEGA, dans les mêmes dossiers. | `gestion-documentaire` | Dès que le dossier Drive de l'appli est connecté à Claude (chapitre 1) |
| 5 | Le métré des plinthes peut contrôler ses hypothèses avec les cotes relevées sur le chantier (onglet *Prise de Cote*). | `metre-plinthes` | **Dès maintenant** |

Les règles 3 et 4 ont besoin que Claude voie le dossier Drive de l'appli sur ton PC. Ce n'est pas encore fait : voir le chapitre 1.

---

## 1. Par où passent les skills

Un mot de vocabulaire : un **connecteur** est un accès que tu donnes à Claude vers un de tes outils (ici Google Sheets). Un **dossier connecté** est un dossier de ton PC que Claude peut lire et écrire (comme ton dossier MEGA aujourd'hui).

| Ce que le skill veut atteindre | Par où | État |
|---|---|---|
| Le Google Sheet de l'appli | le **connecteur Google Sheets** de Claude | à vérifier une fois par toi (chapitre 9, essai 1) |
| Les dossiers chantier de MEGA | le dossier connecté habituel (`Z:\CHANTIERS\…`) | en place |
| Le Drive de l'appli | le dossier **`G:\Mon Drive\…`** (Google Drive pour ordinateur), à connecter à Claude comme le dossier MEGA | **pas encore connecté** : prévu au lot 4 (décision S1-3). Tu peux le faire plus tôt si tu veux la règle 4 avant le carnet. |

Trois règles générales :

1. **Aucun identifiant dans ce contrat ni dans le dépôt.** L'identifiant du Sheet et le chemin exact du dossier Drive sont notés dans un document **privé** du projet LOUE TRAVAIL, que j'appelle ici `claude/CHANTIERPRO - acces.md`. C'est toi qui le crées (chapitre 9). Les skills y lisent ces deux informations.
2. **Toujours le vrai Sheet, jamais la copie d'essai.** Avant de lire ou d'écrire, le skill vérifie le titre du classeur : s'il contient « TEST », il s'arrête et te le dit. (La copie TEST sert à mes essais ; ses données sont fausses.)
3. **Un skill n'écrit dans le Sheet qu'à un seul endroit : l'onglet *Intervenants*.** Tout le reste est en lecture seule pour lui. Il ne crée, ne renomme et ne supprime aucun onglet, aucune colonne, aucune ligne de titre.

**Si un accès manque** (connecteur absent, dossier non connecté, onglet introuvable, titres de colonnes différents de ceux de ce contrat) : le skill **ne devine rien et n'écrit rien**. Il continue son travail avec la FICHE INFO comme avant, et il te le signale en une ligne dans son compte rendu.

---

## 2. Règle 1 — Lire l'identité du chantier dans l'onglet *Chantiers*

### Pourquoi
Aujourd'hui le nom, l'adresse et le conducteur d'un chantier sont saisis deux fois : dans le Sheet (pour l'appli) et dans la FICHE INFO (pour les skills). Les deux finissent par diverger. Désormais **le Sheet fait foi** pour ces informations ; la FICHE INFO les recopie.

### Les colonnes (ligne 1 = titres ; une ligne par chantier)

| Col. | Titre | Sert à |
|---|---|---|
| A | NOM | **Nom du chantier dans l'appli.** C'est lui qui relie tout dans l'appli (fiches, accès, intervenants). À recopier à l'identique, au caractère près. |
| B | REFERENCE | Lieu du chantier |
| C | STATUT | En préparation / En cours / Terminé |
| D | Conducteur | Nom du conducteur de travaux |
| E | N° | Numéro du chantier : celui du dossier MEGA (`NNN - …`) |
| F | Nom court | Le « nom court » de `gestion-documentaire` (celui des noms de fichiers) |
| G | Adresse | Adresse du chantier |
| H | Client | Maître d'ouvrage |
| I | Architecte | |
| J | Date « Terminé » | |
| K | Chemin MEGA | Dossier du chantier dans MEGA |

### Ce que fait le skill `gestion-documentaire`

1. **Trouver la ligne** : celle dont la colonne **E (N°)** est le numéro du dossier MEGA sur lequel il travaille. Si aucune ligne n'a ce numéro : chercher une ligne dont le **Nom court (F)** est celui de la FICHE INFO.
   - Aucune ligne, ou plusieurs : le skill **ne crée rien dans le Sheet**. Il travaille avec la FICHE INFO et te dit : « ce chantier n'est pas (ou est deux fois) dans l'onglet Chantiers ».
2. **Recopier dans la FICHE INFO** (feuille FICHE), avec la source « Sheet ChantierPro, lu le JJ/MM/AAAA » :

   | Colonne du Sheet | Rubrique de la FICHE INFO |
   |---|---|
   | E — N° | n° chantier |
   | F — Nom court | nom court |
   | A — NOM | une rubrique nouvelle : **« Nom dans l'appli ChantierPro »** |
   | G — Adresse | adresse du chantier (et code postal + ville s'ils y sont) |
   | H — Client | maître d'ouvrage |
   | I — Architecte | architecte |
   | D — Conducteur | conducteur de travaux |
   | C — STATUT | une rubrique nouvelle : « Statut dans l'appli » |

3. **Case vide dans le Sheet** : la FICHE INFO garde sa valeur, et le skill te le dit (« adresse absente du Sheet : à compléter dans l'onglet Chantiers »). Une case vide n'efface jamais une information.
4. **Les deux sont remplis mais différents** : le skill **ne tranche pas en silence**. Il garde la valeur de la FICHE INFO, colore la case en jaune, ajoute une ligne À VÉRIFIER (« Sheet : … / fiche : … »), et te pose la question. Ta réponse se corrige **dans le Sheet** (c'est lui la source) ; à la lecture suivante, la fiche s'aligne.
5. **Tout le reste de la FICHE INFO ne change pas** : lots, intervenants, envois, lien MEGA, points des comptes rendus restent dans la fiche, qui en est la seule source.

Le skill **n'écrit jamais** dans l'onglet *Chantiers* : c'est toi qui le tiens.

---

## 3. Règle 2 — Recopier les intervenants dans l'onglet *Intervenants*

### Pourquoi
Au lot 8, la note de réunion de l'appli proposera les présents et les destinataires d'après cet onglet. La liste des intervenants est déjà tenue par `gestion-documentaire` dans la FICHE INFO (feuille INTERVENANTS) : on la recopie, on ne la ressaisit pas.

**Sens unique** : FICHE INFO → Sheet. L'appli ne modifie jamais cet onglet, et le skill ne relit jamais cet onglet pour corriger la fiche. Si tu corriges un intervenant, fais-le **dans la FICHE INFO** : une correction faite à la main dans l'onglet sera écrasée à la recopie suivante.

### Les colonnes (titres exacts, ligne 1)

| Col. | Titre | Valeur recopiée depuis la feuille INTERVENANTS de la fiche |
|---|---|---|
| A | Chantier | le **NOM de la colonne A de l'onglet *Chantiers***, à l'identique (pas le nom court, pas le n°) |
| B | Nom | INTERLOCUTEUR |
| C | Société | SOCIÉTÉ |
| D | Lot / fonction | RÔLE, puis « — LOT xx » s'il y en a un (exemple : `Plaquiste — LOT 07`) |
| E | Mail | MAIL (une seule adresse ; s'il y en a plusieurs, la première) |
| F | Téléphone | PORTABLE, sinon TÉL. SOCIÉTÉ |
| G | Mis à jour le | la date du jour, `JJ/MM/AAAA` |

### Ce que fait le skill, à chaque fois qu'il crée ou met à jour la FICHE INFO

1. Vérifier que la ligne 1 de l'onglet porte **exactement** les sept titres ci-dessus. Sinon : ne rien écrire, le signaler.
2. Construire la liste à recopier : **une ligne par intervenant qui a un INTERLOCUTEUR ou une SOCIÉTÉ**. Un intervenant sans mail est recopié quand même (il peut être présent à une réunion). Les personnes de Loué ne sont pas recopiées : l'appli les connaît déjà (onglet *Contacts*).
3. Lire tout l'onglet, repérer les lignes dont la colonne A est **ce chantier** (comparaison exacte).
4. **Remplacer le bloc de ce chantier, sans toucher aux autres** :
   - réécrire les lignes existantes de ce chantier, dans l'ordre, avec la nouvelle liste ;
   - si la nouvelle liste est plus longue : ajouter les lignes en trop **à la suite, en bas de l'onglet** ;
   - si elle est plus courte : **vider** (les sept cases) les lignes de ce chantier devenues inutiles. Le skill ne supprime pas de ligne : une ligne entièrement vide est ignorée par l'appli.
5. Relire l'onglet et contrôler : le nombre de lignes de ce chantier est celui de la liste, et **le nombre de lignes des autres chantiers n'a pas changé**. Sinon, te le dire tout de suite.
6. Écrire des **textes simples** : jamais de formule. Une valeur qui commence par `=`, `+`, `-` ou `@` (un numéro de téléphone « +33… ») est précédée d'une apostrophe `'`, pour que Sheets la garde en texte.

### À savoir
- **Confidentialité** : l'onglet contient des mails et des téléphones de personnes extérieures. Le Sheet n'est partagé avec personne d'autre que le compte de Loué : ne le partage pas.
- **Ancien chantier** : un chantier « Terminé » peut rester dans l'onglet. Rien à nettoyer.
- **Une seule conversation à la fois** par chantier (règle déjà en vigueur dans `gestion-documentaire`) : deux recopies en même temps pourraient se marcher dessus.

---

## 4. Règle 3 — Déposer dans le carnet de chantier (applicable au lot 4)

> **Ne colle rien dans tes skills pour cette règle avant le lot 4.** Le script `depot_carnet.py` n'existe pas encore, et ses réglages dépendent d'essais à faire sur ton PC. Ce chapitre fixe ce qui est déjà décidé, pour que le lot 4 n'ait plus qu'à l'appliquer.

### Ce qui est décidé

- **Un seul script pour tous les skills** : `outils/depot_carnet.py` (dans ce dépôt). Aucun skill ne découpe ni ne dépose lui-même.
- **Ce que le poseur voit** : des pages-images (WebP, 200 dpi pour les plans, 150 dpi pour les documents de texte), jamais le PDF, sauf demande explicite « garder le PDF » pour un document (décisions S1-1 et S1-2).
- **Où** : dans le dossier Drive du chantier, sous-dossier donné par la clé `carnet` du fichier `dossiers.json` (chapitre 7). Jamais un chemin écrit en dur.
- **Le PDF d'origine reste dans MEGA**, à sa place habituelle. Le carnet n'est pas une archive.

### Quels documents

Ceux que tu as marqués « utiles aux poseurs » dans `docs/skills.md` :

| Skill | Document | N° de nomenclature |
|---|---|---|
| `reservation-men-int` | réservations men int (détail, repérage) | 105, 106 |
| `reservation-men-ext` | réservations men ext (détail, repérage) | 205, 206 |
| `plans-bal` | plans des boîtes aux lettres | 108 |
| `plans-gaines-techniques` | plans des gaines techniques | 109 |
| `signaletique` | plans de signalétique | celui que tu lui donnes au bordereau |
| `organigramme` | plan des cylindres | celui que tu lui donnes au bordereau |
| `ppsps` | PPSPS | 001 |
| `temps-de-tache` | temps de tâches | 002 |

**À me confirmer au lot 4** : les plans de repérage des portes (104) ne sont pas dans ta liste, alors qu'ils ont servi à l'essai de lisibilité. Faut-il les mettre au carnet ?

Ne vont **jamais** au carnet : tout ce qui porte un prix (devis, demandes de prix, commandes), les documents internes (fiches de fabrication, notes internes, rapports d'incohérences), les brouillons.

### Quand

- **Seulement une version que tu as validée** : au moment où le document part au bordereau, ou quand tu dis « mets-le au carnet ». Jamais automatiquement à chaque version de travail : un poseur ne doit pas poser d'après un brouillon.
- Un nouvel indice **remplace** l'ancien dans le carnet (l'ancien va à la corbeille de Drive ; il reste dans MEGA).

### Comment (forme provisoire de l'appel, figée au lot 4)

```
python depot_carnet.py --chantier "<NOM de la colonne A de l'onglet Chantiers>" --pdf "<chemin du PDF>" --code 105 --indice A --intitule "PLANS DE RESERVATIONS MEN INT"
```

- `--code` : le n° de nomenclature (3 chiffres). Un document jamais émis prend un code du carnet (`C01`, `C02`…), donné par le script.
- `--indice` : la lettre du bordereau. Sans indice, le script prend la lettre suivante.
- Nom dans le carnet : `<CODE> <INDICE> <INTITULÉ>`.
- Le script tient `carnet.json` (la liste que l'appli lit). Aucun skill n'écrit ce fichier à la main.

---

## 5. Règle 4 — Rapatrier les fiches de l'appli de Drive vers MEGA

### Pourquoi
MEGA est l'archive maître. Or les fiches remplies sur les téléphones (prises de cotes, quitus, signalements, comptes rendus, photos…) arrivent dans **Drive**. Tant qu'elles n'ont pas été recopiées dans MEGA, elles n'existent qu'à un endroit.

**Condition** : le dossier Drive de l'appli est connecté à Claude (chapitre 1). Sinon, cette règle ne s'applique pas encore, et le skill le dit.

### Ce que fait `gestion-documentaire`

**Quand** : au début de chaque intervention sur un chantier, et quand tu demandes « rapatrie les fiches de l'appli ».

1. **Trouver le dossier Drive du chantier** : onglet *Dossiers chantiers* du Sheet (colonne A « Chantier » = le nom dans l'appli, colonne B « Dossier Drive » = le nom du dossier sous la racine du Drive de l'appli). Chantier absent de cet onglet : aucune fiche n'a encore été rangée pour lui, rien à faire.
2. **Lire `dossiers.json`** à la racine du Drive de l'appli (chapitre 7) : la partie `documents` donne les sous-dossiers à rapatrier.
3. Pour chaque sous-dossier, **sauf `carnet` et `plans`** (ce sont des copies de documents déjà dans MEGA) : recopier dans MEGA, **au même chemin** sous le dossier du chantier, tout fichier qui n'y est pas déjà.

   | Fiche de l'appli | Sous-dossier (le même dans Drive et dans MEGA) |
   |---|---|
   | Prise de cotes | `05 - CHANTIER/PRISE DE COTES` |
   | Fiche de fabrication | `07 - ATELIER` |
   | Note de réunion | `05 - CHANTIER/COMPTE RENDU` |
   | Quitus, attestation, réception de support | `05 - CHANTIER/OPR - RESERVES - QUITUS` |
   | Bordereau d'organigramme | `05 - CHANTIER/ORGANIGRAMME` |
   | Bordereau de matériaux | `05 - CHANTIER/BORDEREAUX MATERIAUX` |
   | Photos | `05 - CHANTIER/PHOTOS CHANTIER` |
   | Signalements (lot 7) | `05 - CHANTIER/SIGNALEMENTS` |

   Ce tableau est un rappel : **la liste qui fait foi est celle de `dossiers.json`**. Si tu y changes un nom, le skill suit sans être modifié.

4. **Règles de copie** :
   - **copier, jamais déplacer** : rien n'est supprimé ni modifié dans Drive (la purge de Drive est le travail de l'appli, au lot 5, et tu la valides toi-même) ;
   - **jamais écraser** (`cp -n`) : un fichier de même nom déjà présent dans MEGA est laissé tel quel ; s'il n'a pas la même taille, le skill le signale sans y toucher ;
   - **jamais renommer** : ces fichiers sont traités comme des **documents reçus** (règle §0.5 de `gestion-documentaire`). Leur nom et leurs versions (`_V2`…) sont déjà gérés par l'appli. Pas de `0-OLD` pour eux ;
   - **créer le sous-dossier s'il manque dans MEGA** (`SIGNALEMENTS` et `BORDEREAUX MATERIAUX` sont nouveaux) : c'est la seule exception à « ne pas créer de nouveau dossier » ;
   - après chaque copie, vérifier que la taille est la même des deux côtés ;
   - un fichier Drive encore « en ligne seulement » se télécharge à la copie : si la copie échoue (pas de réseau), le signaler et continuer avec les autres.
5. **Tracer** : une ligne par fichier au JOURNAL du registre (action « rapatrié de l'appli »), et dans le compte rendu : « N fiches rapatriées, dont … ».
6. **Écrire le relevé `mega-index.json`** (ci-dessous).

**Ne sont pas rapatriées** : les demandes d'absence (`ADMINISTRATIF/ABSENCES`, hors chantier : elles ne vont dans aucun dossier chantier).

### Le relevé `mega-index.json`

**À quoi il sert** : au lot 5, avant de proposer la purge d'un chantier, l'appli vérifiera que chaque fichier de Drive existe bien dans MEGA. Elle n'a pas accès à MEGA : elle lira ce relevé.

- **Où** : à la racine du dossier Drive du chantier.
- **Écrit par** : `gestion-documentaire`, à la fin de chaque rapatriement. C'est le **seul fichier que le skill réécrit par-dessus** l'ancien (c'est une photographie, pas un document).
- **Contenu** : les fichiers présents **dans MEGA**, pour les sous-dossiers du point 3 seulement.

```json
{
  "version": 1,
  "chantier": "<NOM de la colonne A de l'onglet Chantiers>",
  "numero": "<N° du chantier>",
  "releve_le": "2026-11-13T08:30:00",
  "fichiers": [
    { "chemin": "05 - CHANTIER/OPR - RESERVES - QUITUS/QUITUS EXEMPLE 2026-11-12.pdf", "taille": 184223 }
  ]
}
```

- `chemin` : relatif au dossier du chantier, avec des `/`. `taille` : en octets.
- Aucun chemin complet du PC, aucun lien : seulement des chemins relatifs.
- **Si le relevé est absent ou a plus de 30 jours, l'appli ne proposera pas la purge.** Un relevé manquant ne fait donc jamais rien supprimer.

---

## 6. Règle 5 — Les cotes relevées sur le chantier, pour le métré des plinthes

### Ce que c'est, honnêtement
L'onglet *Prise de Cote* reçoit les **cotes de placards** relevées par les poseurs (fiche « Prise de cotes » de l'appli). Il ne contient **pas** de périmètres de pièces : il ne remplace pas le métré fait sur les plans. Il apporte deux informations mesurées sur place, que les plans ne donnent pas toujours : la **hauteur de plinthe** et le **type de sol**, par logement et par pièce.

### Les colonnes (une ligne par placard relevé)

| Col. | Contenu | Utile au métré ? |
|---|---|---|
| A | Référence de la fiche | pour citer la source |
| B | Chantier (le nom dans l'appli) | **filtre** |
| C | Bâtiment | oui |
| D | Auteur du relevé | pour citer la source |
| E | Date du relevé | pour citer la source |
| F | N° du logement | oui |
| G | Pièce | oui |
| H | Hauteur de façade (mm) | non |
| I | Largeur entre plinthes (mm) | non |
| J | Largeur en haut de façade (mm) | non |
| K | Longueur de l'aménagement (mm) | non |
| L | Profondeur de l'aménagement (mm) | non |
| M | Côté de la penderie | non |
| N | **Hauteur de plinthe (mm)** | **oui** |
| O | **Sol** | **oui** |
| P | Socle | non |
| Q | Commentaires | à lire : une remarque peut concerner les plinthes |
| R | Reçu le (heure du serveur) | non |

### Ce que fait `metre-plinthes`

Sur un chantier **en cours**, pendant sa phase d'analyse (pas au chiffrage, où aucun relevé n'existe) :

1. Lire les lignes dont la colonne B est le nom du chantier dans l'appli (rubrique « Nom dans l'appli ChantierPro » de la FICHE INFO). Aucune ligne : l'écrire en une ligne (« aucune prise de cotes dans l'appli pour ce chantier ») et continuer.
2. S'en servir **comme d'un contrôle, jamais comme d'une donnée de calcul** :
   - hauteur de plinthe relevée ≠ hauteur du CCTP ou du devis → ligne dans l'onglet « A VERIFIER » et question à Franck ;
   - sol relevé dans une pièce ≠ sol prévu au CCTP pour ce type de pièce (ce qui peut changer « plinthe du lot ou non ») → même traitement.
3. **Ne rien appliquer en silence** : la hiérarchie devis > CCTP > plans ne change pas. Un relevé de chantier qui la contredit est un écart à te montrer, pas une correction automatique.
4. Citer la source dans le bilan : « prise de cotes du JJ/MM/AAAA par X, fiche n° … ».
5. **Lecture seule** : le skill n'écrit jamais dans cet onglet.

Les valeurs sont celles tapées sur le téléphone : une case peut être vide ou contenir du texte libre (« 70 », « 7 cm », « sans »). Une valeur illisible est ignorée et signalée, jamais interprétée au hasard.

---

## 7. Les noms de dossiers : un seul endroit, `dossiers.json`

- **Où** : à la racine du Drive de l'appli (donc visible dans `G:\Mon Drive\…` une fois le dossier connecté).
- **Qui le lit** : l'appli (Apps Script), `depot_carnet.py` au lot 4, et `gestion-documentaire` pour la règle 4.
- **Qui le modifie** : toi seul, à la main, si tu renommes un dossier. L'appli le relit au bout de 10 minutes. **Aucun skill ne l'écrit.**

Sa forme :

```json
{
  "version": 1,
  "documents":     { "<type de fiche>": "<sous-dossier dans le dossier du chantier>" },
  "hors_chantier": { "<type de fiche>": "<sous-dossier à la racine du Drive de l'appli>" },
  "intitules":     { "<type de fiche>": "<début du nom des fichiers>" }
}
```

- Séparateur des chemins : `/`.
- Les fichiers de l'appli se nomment `<INTITULÉ> <CHANTIER> <AAAA-MM-JJ>[_Vn].pdf` : la même forme que les documents de `gestion-documentaire`.
- Un skill ne garde **aucun** de ces noms en dur. Si le fichier est illisible ou absent : il ne rapatrie rien et te le dit.

---

## 8. Textes prêts à coller dans tes skills

> Je ne modifie pas tes skills. Colle chaque bloc à l'endroit indiqué, tel quel. Les blocs **A, B et D** se collent maintenant. Le bloc **C** se colle quand le dossier Drive de l'appli est connecté à Claude. Le carnet (règle 3) n'a pas de bloc : il arrivera avec le lot 4.

### Bloc A — dans `gestion-documentaire`, à la fin du § 3 bis (FICHE INFO)

```
### Lien avec l'appli ChantierPro (contrat docs/contrat-skills.md du dépôt chantier-pro, règles 1 et 2)

Accès : connecteur Google Sheets ; identifiant du Sheet dans le doc du projet `claude/CHANTIERPRO - acces.md`.
Avant toute lecture ou écriture : si le titre du classeur contient « TEST », s'arrêter et le dire à Franck.
Si le connecteur, l'onglet ou les titres de colonnes attendus manquent : ne rien deviner, ne rien écrire,
continuer avec la FICHE INFO et le signaler en une ligne.

1. IDENTITÉ — l'onglet « Chantiers » fait foi. Colonnes : A NOM (nom dans l'appli), B REFERENCE, C STATUT,
   D Conducteur, E N°, F Nom court, G Adresse, H Client, I Architecte, J Date « Terminé », K Chemin MEGA.
   - Trouver la ligne par E = n° du dossier MEGA ; à défaut par F = nom court. Aucune ou plusieurs lignes :
     ne rien créer dans le Sheet, le dire à Franck.
   - Recopier dans la feuille FICHE (source « Sheet ChantierPro, lu le JJ/MM/AAAA ») : E → n° chantier,
     F → nom court, G → adresse, H → maître d'ouvrage, I → architecte, D → conducteur de travaux,
     A → rubrique « Nom dans l'appli ChantierPro », C → rubrique « Statut dans l'appli ».
   - Case vide dans le Sheet : garder la valeur de la fiche et le signaler. Valeurs différentes : garder
     la fiche, case jaune + ligne À VÉRIFIER (« Sheet : … / fiche : … ») + question à Franck ; la correction
     se fait dans le Sheet.
   - Ne jamais écrire dans l'onglet « Chantiers ».

2. INTERVENANTS — sens unique FICHE INFO → onglet « Intervenants », à chaque création ou mise à jour de la fiche.
   Titres exacts de la ligne 1 (sinon ne rien écrire) : Chantier | Nom | Société | Lot / fonction | Mail |
   Téléphone | Mis à jour le.
   - Chantier = NOM de la colonne A de « Chantiers », à l'identique. Nom = INTERLOCUTEUR. Société = SOCIÉTÉ.
     Lot / fonction = RÔLE (+ « — LOT xx »). Mail = MAIL (la première adresse). Téléphone = PORTABLE,
     sinon TÉL. SOCIÉTÉ. Mis à jour le = date du jour JJ/MM/AAAA.
   - Une ligne par intervenant ayant un interlocuteur ou une société, même sans mail. Pas les personnes de Loué.
   - Remplacer le bloc de CE chantier seulement : réécrire ses lignes existantes dans l'ordre ; ajouter
     le surplus en bas de l'onglet ; vider (sans les supprimer) ses lignes devenues inutiles.
   - Textes simples, jamais de formule ; une valeur commençant par = + - @ est précédée d'une apostrophe.
   - Relire et contrôler : bon nombre de lignes pour ce chantier, nombre de lignes des autres chantiers inchangé.
   - C'est le SEUL onglet du Sheet où un skill écrit.
```

### Bloc B — dans `gestion-documentaire`, table « 1 bis. Où les compétences métier lisent leurs entrées », une ligne de plus

```
| Identité du chantier (n°, nom court, adresse, client, architecte, conducteur, nom dans l'appli) | onglet « Chantiers » du Sheet ChantierPro (connecteur Sheets), recopié dans la FICHE INFO (§3 bis, lien avec l'appli) | le Sheet fait foi ; divergence → question à Franck |
| Cotes relevées sur le chantier par les poseurs (placards, hauteur de plinthe, sol) | onglet « Prise de Cote » du Sheet ChantierPro, lignes dont la colonne B = nom dans l'appli | lecture seule ; contrôle, jamais donnée de calcul |
```

### Bloc C — dans `gestion-documentaire`, table de routage du § 1 (une ligne de plus) et nouveau § 1 ter

À coller **seulement quand le dossier Drive de l'appli est connecté à Claude**.

Ligne à ajouter à la table de routage :

```
| Fiches produites par l'appli ChantierPro (PDF et photos : prises de cotes, comptes rendus, quitus, attestations, réceptions de support, bordereaux, signalements, fiches de fabrication) | le même sous-dossier que dans le Drive de l'appli (lu dans `dossiers.json`), créé s'il manque — documents reçus : jamais renommés ni versionnés (§1 ter) |
```

Nouveau paragraphe :

```
### 1 ter. Rapatrier les fiches de l'appli ChantierPro (Drive → MEGA) — contrat docs/contrat-skills.md, règle 4

Quand : au début de chaque intervention sur un chantier, et sur demande (« rapatrie les fiches de l'appli »).
Accès : dossier Drive de l'appli connecté (chemin dans `claude/CHANTIERPRO - acces.md`). S'il n'est pas
connecté : ne rien faire et le dire.

1. Dossier Drive du chantier : onglet « Dossiers chantiers » du Sheet (A = nom dans l'appli, B = nom du dossier).
   Chantier absent : rien à rapatrier.
2. Lire `dossiers.json` à la racine du Drive de l'appli : la partie « documents » donne les sous-dossiers.
   Ne garder aucun nom en dur. Fichier absent ou illisible : ne rien rapatrier, le dire.
3. Pour chaque sous-dossier sauf les clés « carnet » et « plans » : copier dans MEGA, au même chemin relatif
   sous le dossier du chantier, les fichiers qui n'y sont pas.
   - copier (`cp -n`), jamais déplacer ; ne rien supprimer ni modifier dans Drive ;
   - jamais écraser : même nom déjà présent → laisser ; taille différente → signaler ;
   - jamais renommer, pas de 0-OLD : ce sont des documents reçus (§0.5) ;
   - créer le sous-dossier s'il manque dans MEGA (seule exception à « pas de nouveau dossier ») ;
   - vérifier la taille après chaque copie ; un échec (fichier en ligne seulement, pas de réseau) est signalé,
     les autres copies continuent.
4. JOURNAL du registre : une ligne par fichier (« rapatrié de l'appli »). Compte rendu : nombre de fiches.
5. Écrire `mega-index.json` à la racine du dossier Drive du chantier (seul fichier réécrit par-dessus) :
   {"version":1,"chantier":"<nom dans l'appli>","numero":"<n°>","releve_le":"<AAAA-MM-JJTHH:MM:SS>",
    "fichiers":[{"chemin":"<chemin relatif avec />","taille":<octets>}]}
   = les fichiers présents DANS MEGA pour ces sous-dossiers. Chemins relatifs seulement.
Ne sont pas rapatriées : les demandes d'absence (hors chantier).
```

### Bloc D — dans `metre-plinthes`, à la fin du § 0.2 (lecture du CCTP)

```
### 0.2 bis Cotes relevées sur le chantier (appli ChantierPro) — contrat docs/contrat-skills.md, règle 5

Seulement sur un chantier en cours. Lire l'onglet « Prise de Cote » du Sheet ChantierPro (connecteur Sheets,
identifiant dans `claude/CHANTIERPRO - acces.md` ; s'arrêter si le titre du classeur contient « TEST »),
lignes dont la colonne B = rubrique « Nom dans l'appli ChantierPro » de la FICHE INFO.
Colonnes utiles : C bâtiment, F n° de logement, G pièce, N hauteur de plinthe (mm), O sol, Q commentaires ;
A référence, D auteur, E date pour citer la source.
- C'est un CONTRÔLE, jamais une donnée de calcul : hauteur de plinthe ou sol relevés différents du CCTP /
  devis → ligne « A VERIFIER » + question à Franck. La hiérarchie devis > CCTP > plans ne change pas.
- Valeur vide ou illisible : ignorée et signalée, jamais interprétée.
- Lecture seule. Aucune ligne pour ce chantier, ou accès impossible : l'écrire en une ligne et continuer.
- Citer la source dans le bilan (« prise de cotes du JJ/MM/AAAA par X, fiche n° … »).
```

---

## 9. Ce que tu dois faire, et comment vérifier

### À faire (15 minutes, quand tu veux)

1. **Créer le document privé** `claude/CHANTIERPRO - acces.md` dans le projet LOUE TRAVAIL, avec deux lignes :
   - l'identifiant du vrai Sheet (la suite de lettres et de chiffres entre `/d/` et `/edit` dans son adresse) ;
   - le chemin du dossier Drive de l'appli sur ton PC (à remplir le jour où tu le connectes).

   Ne mets ces deux informations **nulle part ailleurs**, et surtout pas dans le dépôt GitHub.
2. **Compléter l'onglet *Chantiers*** pour les chantiers en cours : colonnes E (N°) et F (Nom court) au minimum. Sans le N°, le skill ne retrouve pas la ligne.
3. **Coller les blocs A, B et D** dans tes skills (chapitre 8).
4. Plus tard, quand tu connectes le dossier Drive de l'appli à Claude : coller le **bloc C**.

### Vérifier (trois essais, sur un seul chantier en cours)

| # | Essai | Attendu |
|---|---|---|
| 1 | Dans une conversation du projet LOUE TRAVAIL : « lis l'onglet Chantiers du Sheet ChantierPro et dis-moi ce que tu trouves pour le chantier NNN » | Claude cite la ligne (nom, adresse, conducteur). S'il dit qu'il n'a pas le connecteur Google Sheets : active-le dans les réglages de Claude, puis recommence. |
| 2 | « Mets à jour la FICHE INFO du NNN » | Le compte rendu dit ce qui a été recopié du Sheet et liste les divergences. Dans le Sheet, l'onglet *Intervenants* contient les intervenants de ce chantier, **et les lignes des autres chantiers n'ont pas bougé**. |
| 3 | Relance la même demande | Aucune ligne en double dans *Intervenants*. |

Si l'essai 2 abîme l'onglet *Intervenants* : Fichier → Historique des versions du Sheet permet de revenir en arrière. L'appli ne lit pas encore cet onglet (lot 8) : aucun poseur n'est gêné.

---

## 10. Limites et points ouverts (dits franchement)

- **Ce contrat n'a pas encore été essayé avec un vrai skill.** Je n'ai pas accès à tes skills en fonctionnement ni au vrai Sheet. Les trois essais du chapitre 9 sont la vraie validation ; dis-moi ce qui coince et je corrige le contrat.
- **Connecteur Google Sheets** : je suppose qu'il sait lire une plage, écrire une plage et ajouter des lignes. S'il ne sait pas écrire, la règle 2 attendra : l'onglet *Intervenants* pourra être rempli autrement au lot 8 (import d'un fichier déposé dans Drive, par exemple).
- **Règles 3 et 4** : elles dépendent du dossier Drive connecté à Claude, jamais essayé (décision S1-3). La règle 3 dépend en plus du lot 4.
- **`mega-index.json`** : sa forme est fixée ici, mais l'appli ne le lit qu'au lot 5. S'il faut l'ajuster à ce moment-là, le bloc C changera d'une ligne.
- **Plans de repérage des portes (104) au carnet** : question posée au chapitre 4, à trancher au lot 4.
- **Gratuité** : rien de nouveau à payer ni à installer. Connecteur Google Sheets et Google Drive pour ordinateur font partie de ce que tu utilises déjà.
