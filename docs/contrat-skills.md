# Contrat entre l'appli ChantierPro et les skills de Franck (lots 9b et 4c)

> **Pour qui ?** Pour Franck, et pour les skills Claude du projet LOUE TRAVAIL (`gestion-documentaire` et les skills qui produisent des plans).
> **À quoi ça sert ?** L'appli et les skills travaillent sur les mêmes chantiers. Ce contrat dit **qui écrit quoi, où, et sous quel nom**, pour que personne n'écrase le travail de l'autre.
> **Ce fichier est public** (le dépôt l'est) : aucun identifiant, aucun lien, aucun chemin du PC, aucun nom de client ni de chantier réel.
> **Vocabulaire** : les skills travaillent sur les **dossiers de chantier de ton PC**. MEGA ne fait que les synchroniser (sauvegarde, accès à distance) : ni l'appli ni les skills n'échangent avec MEGA.
> **Je ne modifie pas tes skills** : les textes à coller sont au chapitre 8, dans **un seul** skill (`gestion-documentaire`), et tu les valides avec Claude.
> **Version 5** (13/11/2026, lot 4c) : **c'est le programme du PC qui dépose au carnet, et qui recopie tout seul les fiches de l'appli dans les dossiers de chantier du PC** (toutes les heures) ; un skill n'écrit plus rien pour l'appli, et le Drive de l'appli n'a plus à être relié à Claude. Plan : `docs/lot4c-plan.md` ; marche à suivre : `docs/lot4c-procedure.md`.
> Historique : version 4 (13/11/2026) — règles 2 et 5 abandonnées, rien à coller avant le lot 4 ; versions 1 à 3 (12/11/2026) — trois relectures indépendantes (chapitre 11).

## En deux minutes

Deux principes, les plus prudents :
- **un skill ne modifie jamais le Google Sheet de l'appli** : au plus, il le lit ;
- **un skill n'écrit jamais dans le Drive de l'appli**, et n'a pas besoin de le voir. Tout ce qui passe entre les dossiers de chantier du PC et le Drive de l'appli est fait par **un programme sur le PC de Franck** (`outils/appli_pc.py`) : il lit ce que les skills produisent déjà dans les dossiers de chantier.

| # | Règle | Qui le fait | Utilisable quand ? |
|---|---|---|---|
| 1 | L'identité d'un chantier (n°, nom, adresse, client, architecte) est **contrôlée** d'après l'onglet *Chantiers* du Sheet : tout écart avec la FICHE INFO t'est signalé. Les skills continuent de travailler avec la FICHE INFO. **Facultative.** | `gestion-documentaire` (lecture seule) | Si le connecteur Google Sheets marche (jamais essayé) ; rien d'autre n'en dépend |
| 3 | Les plans utiles aux poseurs vont au carnet **depuis les bordereaux** : le programme du PC lit les PDF du dossier `08`, te montre chaque document, et le met au carnet si tu réponds « o ». | le programme du PC (double-clic sur `outils\appli-pc.bat`) ; le skill rappelle seulement le double-clic | Dès que `_prive/depot.json` est rempli (`docs/lot4c-procedure.md`) |
| 4 | Les fiches produites par l'appli (PDF, photos) sont recopiées **toutes seules** du Drive vers le dossier du chantier sur le PC, dans les mêmes sous-dossiers, et listées dans ce dossier pour que les skills les reconnaissent. | le programme du PC, lancé toutes les heures par Windows ; le skill lit la liste | Dès que la tâche planifiée est installée (`docs/lot4c-procedure.md`) |

Les règles 2 et 5 sont abandonnées (chapitres 3 et 6).

---

## 1. Par où passent les skills, par où passe le programme du PC

Vocabulaire : un **connecteur** est un accès que tu donnes à Claude vers un de tes outils (ici Google Sheets). Un **dossier relié à Claude** est un dossier de ton PC que Claude peut lire et écrire (comme ton dossier des chantiers aujourd'hui).

| Ce qu'il faut atteindre | Qui | Par où | État |
|---|---|---|---|
| Les dossiers de chantier du PC | les skills | le dossier des chantiers habituel, déjà relié à Claude | en place |
| Le Google Sheet de l'appli, **en lecture**, onglet *Chantiers* seulement (règle 1, facultative) | `gestion-documentaire` | le connecteur Google Sheets de Claude | à vérifier une fois par toi (chapitre 9, essai 1) |
| Le Drive de l'appli | **le programme du PC, et lui seul** | le dossier de Google Drive pour ordinateur, sur ton PC | en place ; **ce dossier n'est pas relié à Claude et n'a pas à l'être** |

L'essai A2 (`docs/lot4-etape0.md`) l'a montré : l'espace de travail d'un skill voit le dossier du chantier sur le PC, pas le Drive de l'appli. Le PC, lui, voit les deux. D'où le partage : **les skills travaillent dans les dossiers de chantier ; le programme du PC fait le pont.**

### Cinq règles générales

1. **Aucun identifiant dans ce contrat ni dans le dépôt.** Si tu utilises la règle 1, tu notes dans un document **privé** du projet LOUE TRAVAIL, que j'appelle ici `claude/CHANTIERPRO - acces.md`, l'identifiant du vrai Sheet **et son titre exact**. Les chemins du Drive et du dossier des chantiers sur ton PC sont dans `_prive/depot.json`, jamais dans le dépôt.
2. **Contrôle « c'est bien le bon classeur ».** Avant toute lecture, le skill compare le titre du classeur ouvert au titre noté dans le document privé. S'ils diffèrent, ou si le titre contient « TEST », il s'arrête et te le dit. (La copie TEST sert à mes essais ; ses données sont fausses.)
3. **Lecture seule sur le Sheet, et sur un seul onglet** : *Chantiers*. Le skill ne lit aucun autre onglet, et surtout pas *Utilisateurs* (il contient les mots de passe provisoires).
4. **Un skill n'écrit jamais dans le Drive de l'appli** : ni plan, ni image, ni liste, ni relevé. Si un jour ce Drive se trouvait relié à une conversation, la consigne reste la même : ne rien y écrire, ne rien y ranger, ne pas y appliquer les règles de `gestion-documentaire`.
5. **Si un accès manque** (connecteur absent, onglet introuvable, colonnes inattendues) : le skill **ne devine rien et n'écrit rien**. Il continue son travail avec la FICHE INFO comme avant, et te le signale en une ligne.

### Ce que le connecteur Google Sheets permet vraiment (à savoir avant de le donner)

- **Il donne très probablement à Claude l'accès, en lecture et en écriture, à tous les classeurs du compte Google auquel il est relié** (donc au vrai Sheet et à la copie TEST). « Lecture seule » et « un seul onglet » sont des **consignes** écrites dans le skill, pas un verrou technique. C'est une raison de plus pour qu'aucune règle de ce contrat ne demande d'écrire dans le Sheet — et pour laisser la règle 1 de côté si tu n'en as pas besoin.
- **Quel compte Google ?** Le Sheet appartient au compte Google de Loué. Le connecteur doit être relié à **ce compte-là**. S'il est relié à un autre de tes comptes, il ne verra pas le Sheet : ne partage pas le Sheet pour contourner, dis-le-moi d'abord.
- **Aucun dossier du Drive n'est à relier à Claude.** La version 4 prévoyait de lui donner toute la racine du Drive de l'appli (qui contient aussi les demandes d'absence des salariés) : ce n'est plus nécessaire, et c'est mieux ainsi.

---

## 2. Règle 1 — L'identité du chantier se lit dans l'onglet *Chantiers*

> **Règle facultative.** Elle dépend du connecteur Google Sheets, jamais essayé. Les règles 3 et 4 n'en dépendent plus : tu peux ne jamais la mettre en place.

### Pourquoi
Le nom, l'adresse et le conducteur d'un chantier sont saisis deux fois : dans le Sheet (pour l'appli) et dans la FICHE INFO (pour les skills). Les deux finissent par diverger. Désormais **le Sheet est la référence** ; le skill te montre tout écart, et **c'est toi qui corriges**.

C'est une exception voulue à la règle « la FICHE INFO est la source unique » de `gestion-documentaire`, et elle ne vaut que pour l'identité. **Tant que tu n'as pas tranché un écart, rien ne change dans le travail des skills : les noms de fichiers, les bordereaux et les courriers continuent d'utiliser la FICHE INFO.** Le Sheet ne sert qu'à comparer.

### Les colonnes (ligne 1 = titres ; une ligne par chantier)

| Col. | Titre | Sert à |
|---|---|---|
| A | NOM | **Nom du chantier dans l'appli** : c'est lui qui relie tout dans l'appli (fiches, accès, intervenants) |
| B | REFERENCE | Lieu du chantier |
| C | STATUT | En préparation / En cours / Terminé |
| D | Conducteur | Nom du conducteur, écrit comme dans l'onglet *Contacts* |
| E | N° | Numéro du chantier : celui du dossier du chantier sur le PC (`NNN - …`) |
| F | Nom court | Le « nom court » de `gestion-documentaire` |
| G | Adresse | Adresse du chantier, en une seule case |
| H | Client | Maître d'ouvrage |
| I | Architecte | |
| J | Date « Terminé » | |
| K | Chemin MEGA (titre de la colonne) | Dossier du chantier |

### Ce que fait `gestion-documentaire` (il ne fait que lire)

1. **Trouver la ligne** : celle dont la colonne E (N°) est le numéro du dossier du chantier sur le PC (comparé comme du texte : « 123 » et 123 sont le même numéro). À défaut, celle dont le Nom court (F) est celui de la FICHE INFO. Aucune ligne, ou plusieurs : le skill continue avec la FICHE INFO seule et te dit « ce chantier n'est pas (ou est deux fois) dans l'onglet Chantiers ».
2. **Citer le « nom dans l'appli »** (colonne A) dans son compte rendu, pour information. Plus rien n'en dépend côté skills : le carnet et le rapatriement sont l'affaire du programme du PC, qui tient sa propre correspondance (chapitre 4).
3. **À la création d'une FICHE INFO** (nouveau chantier) : les valeurs du Sheet sont la **première source** pour le n°, le nom court et l'adresse, avec la source « Sheet ChantierPro, lu le JJ/MM/AAAA ». L'adresse du Sheet tient en une case, la fiche en a deux (« adresse du chantier », « code postal + ville ») : si le découpage n'est pas évident, case jaune et question, jamais au hasard. Client et architecte servent à contrôler les lignes MOA et ARCHI de la feuille INTERVENANTS (ils n'ont pas de rubrique dans la feuille FICHE). Un écart constaté à ce moment-là devient une ligne À VÉRIFIER de la fiche, comme toute autre question de création. Sur un chantier ancien qui n'avait pas encore de fiche : si le registre utilise déjà un nom court différent de la colonne F, c'est celui du registre qui est gardé, et l'écart est signalé.
4. **Sur une FICHE INFO qui existe déjà** : le skill **compare et signale dans son compte rendu ; il n'écrit rien, ni dans le Sheet, ni dans la fiche**. Il le fait à trois moments seulement : quand tu demandes l'état documentaire, avant un bordereau, et à la première intervention sur ce chantier dans une conversation (pas à chaque fois qu'un fichier est lu).

   | Sheet | Comparé à, dans la FICHE INFO | Comment |
   |---|---|---|
   | E — N° | n° chantier | égalité |
   | F — Nom court | nom court | sans tenir compte des majuscules, des accents ni des espaces en trop |
   | G — Adresse | « adresse du chantier » + « code postal + ville », mis bout à bout | idem ; un écart de ponctuation n'est pas un écart |
   | H — Client | société de la ligne MOA (feuille INTERVENANTS) | idem |
   | I — Architecte | société de l'une des lignes d'architecte (ARCHI, ARCHI 2…) | idem |
   | D — Conducteur | conducteur de travaux | sur le **nom de famille** ; **pour information seulement** |

   - **Case vide dans le Sheet** : pas un écart. Le skill te dit « adresse absente du Sheet : à compléter dans l'onglet Chantiers ». Une case vide n'efface jamais rien.
   - **Écart réel** : il est écrit **dans le compte rendu de la conversation** (« Sheet : … / fiche : … »), et la question t'est posée. **Tu corriges à la main celui des deux qui a tort** : le Sheet si la fiche a raison, la fiche si le Sheet a raison. À la comparaison suivante, l'écart a disparu. Le skill ne touche pas à la fiche : tu la corriges déjà à la main, et son script n'a pas de commande pour y écrire cela.
   - **Conducteur** : la fiche porte l'expéditeur des bordereaux, le Sheet porte le conducteur qui voit le chantier dans « Mes chantiers » de l'appli. Ils peuvent être différents **exprès** : le skill le mentionne une fois, sans poser de question, et ne remplace jamais rien.
5. **Tout le reste de la FICHE INFO ne change pas** : lots, sociétés et interlocuteurs, envois, lien MEGA, points des comptes rendus restent dans la fiche, qui en est la seule source.

---

## 3. Règle 2 — abandonnée (13/11/2026)

La règle 2 prévoyait de transmettre à l'appli la liste des intervenants de la FICHE INFO, par un fichier. **Franck l'a abandonnée le 13/11/2026** : la note de réunion de l'appli est avant tout interne, et ses intervenants seront ajoutés à la main si nécessaire. Aucun skill ne transmet rien à ce sujet ; l'onglet *Intervenants* du Sheet n'est rempli par personne pour l'instant (décision D9b-5).

---

## 4. Règle 3 — Le carnet de chantier : c'est le programme du PC qui s'en charge

### Le principe
Un skill ne met rien au carnet et n'écrit aucune « demande ». **Le programme du PC lit les bordereaux** : les PDF figés dans `08 - DOCUMENTS ENVOYES AVEC BORDEREAU/BORDEREAU n` de chaque chantier suivi. Leur nom porte déjà tout ce qu'il faut (nomenclature de Franck) :

`<N° chantier>-<lot>-<N° de document>-<indice>-<INTITULÉ>.pdf`

Ainsi, **seule une version validée** (mise dans un bordereau) peut aller au carnet, et **tu confirmes document par document**.

### Ce que fait le programme (`outils\appli-pc.bat`, choix 1)
1. Pour chaque chantier suivi, il ne retient que les PDF dont : le n° de chantier est celui du dossier du chantier ; le n° de document — après passage par la table des anciens numéros — est dans la liste ci-dessous ; l'indice n'est pas déjà au carnet ; tu ne l'as pas écarté.
2. Pour chacun, il te montre le chantier, le bordereau, le nom, le nombre de pages, le poids, la date, et le dossier du Drive où il ira. Tu réponds **o** (le mettre au carnet), **n** (l'écarter pour de bon ; un fichier refait sous le même nom sera proposé de nouveau) ou **Entrée** (plus tard).
3. Le travail est fait par `depot_carnet.py` (lot 4a, inchangé), sans limite de temps, page par page ; à la fin, le carnet est contrôlé.
4. Il signale sans rien faire : un PDF qui porte le n° d'un autre chantier ; un numéro de document non reconnu ; un document **qui a changé depuis qu'il est au carnet** (même indice, autre fichier) ; un même document présent dans plusieurs bordereaux (le plus récent est gardé).

### Ce qui est décidé (inchangé depuis le lot 4a)
- **Ce que le poseur voit** : des pages-images (WebP, 200 dpi pour les plans, 150 dpi pour les documents de texte), jamais le PDF (décisions S1-1 et S1-2).
- **Où** : dans le dossier Drive du chantier, sous-dossier donné par la clé `carnet` (chapitre 7). Jamais un chemin écrit en dur.
- **Le PDF d'origine reste dans le dossier du chantier sur le PC.** Le carnet n'est pas une archive.
- Nom dans le carnet : `<N° de document> <INDICE> <INTITULÉ>`. Le programme tient `carnet.json` (la liste que l'appli lit) ; personne ne l'écrit à la main.
- Un document du carnet n'est jamais écrasé : un document refait part sous l'**indice suivant** (nouveau bordereau). Le choix 5 du menu retire un document de la vue des poseurs (aucun fichier n'est supprimé), mais ne libère pas son indice.

### Quels documents

| Skill | Document | N° de document |
|---|---|---|
| `reservation-men-int` | réservations men int (détail, repérage) | 105, 106 |
| `reservation-men-ext` | réservations men ext (détail, repérage) | 205, 206 |
| `plans-bal` | plans des boîtes aux lettres | 108 |
| `plans-gaines-techniques` | plans des gaines techniques | 109 |
| `organigramme` | organigramme | 151 |
| `signaletique` | signalétique | 152 |
| `ppsps` | PPSPS | 001 |
| `temps-de-tache` | temps de tâches | 002 |
| `reperage-menuiseries` | tableau de portes (PDF, sans prix) | 103 |
| `reperage-menuiseries` | plans de repérage des portes | 104 |
| `reservation-men-int` | plan de pose des huisseries | 107 |

Ne vont **jamais** au carnet : tout ce qui porte un prix, les documents internes (fiches de fabrication, notes internes, rapports d'incohérences), les brouillons. Tout autre numéro est refusé par le programme.

### Quel dossier du Drive pour quel chantier, et les anciens numéros
- Le dossier du chantier dans le Drive de l'appli et le dossier du chantier sur le PC sont reliés **tout seuls par le numéro du chantier**, lu en tête de leur nom (`NNN - …`, `NNN-…` ou `NNN …`). Le programme **ne devine jamais** : aucun dossier du PC pour ce numéro, ou plusieurs, ou un dossier du Drive sans numéro — il ne fait rien pour ce chantier et le signale. Quand le numéro ne suffit pas (un dossier du Drive sans numéro), tu peux relier les deux à la main dans `_prive/depot.json` (commande « Associer les chantiers » du menu) : cette correspondance passe avant le numéro lu dans le nom. Le numéro est en plus recoupé avec le nom de chaque PDF.
- **Anciens numéros de documents** (d'avant la numérotation par métier) : la table `anciens_codes` de `_prive/depot.json` les convertit. Un numéro qui n'est ni un document du carnet, ni dans cette table, est montré « numéro non reconnu » et n'est pas proposé. **Attention** : certains anciens numéros sont aussi des numéros d'aujourd'hui, avec un autre sens. Pour un chantier commencé avec l'ancienne numérotation, mets la table **dans la ligne de ce chantier** (elle l'emporte sur la table générale) : voir `docs/lot4c-procedure.md`.

### Ce que les skills ont à faire
Rien, sauf **un rappel** : après la préparation d'un bordereau qui contient un document de la liste ci-dessus, `gestion-documentaire` te rappelle de double-cliquer sur `appli-pc` une fois le bordereau envoyé (chapitre 8, bloc B). Les neuf skills de plans ne changent pas.

### Ce que cette règle ne couvre pas
- Un document **hors bordereau** : `outils\deposer.bat` (lot 4a) reste là pour cela.
- Un bordereau **préparé mais pas encore envoyé** : ses PDF sont proposés aussi. Réponds **Entrée** (plus tard) tant que le mail n'est pas parti.

---

## 5. Règle 4 — Les fiches de l'appli sont recopiées toutes seules dans les dossiers de chantier du PC

### Pourquoi
Les dossiers de chantier de ton PC, que MEGA sauvegarde, sont l'archive maître. Or les fiches remplies sur les téléphones (prises de cotes, quitus, signalements, notes de réunion, photos…) arrivent dans **Drive**. Tant qu'elles n'ont pas été recopiées dans le dossier du chantier, elles n'existent qu'à un endroit.

### Quand : tout seul, sans manipulation
- **Toutes les heures, et à l'ouverture de ta session Windows**, par une tâche du Planificateur de tâches de Windows (déjà présent sur le PC, rien à installer). Elle lance le programme sans fenêtre et sans question. Tu l'installes **une seule fois** (`outils\installer-tache.bat`, sans droits d'administrateur).
- **À la demande** aussi : le double-clic sur `outils\appli-pc.bat` (choix 1) fait la même recopie, avec la même fonction.
- Une fiche arrive donc dans le dossier du chantier **au plus tard une heure** après son arrivée dans le Drive, **si le PC est allumé, ta session ouverte et Google Drive pour ordinateur démarré**.
- Le skill ne lance rien et ne tient plus de ligne de JOURNAL pour cela.

### « Me le signaler » : le fichier `CHANTIERPRO - A VOIR.txt`
À la racine du dossier qui contient tes dossiers de chantier, le programme réécrit à chaque passage un petit fichier texte : la date du passage, puis la liste de ce qui demande ton attention — ou « Rien à signaler ». Y figurent : un chantier sans dossier sur le PC ou avec plusieurs, un dossier du Drive sans numéro, un fichier de même nom mais de taille différente, les fichiers hors des sous-dossiers de fiches, les raccourcis Google, les doublons, une copie qui a échoué, Google Drive pour ordinateur arrêté. Le menu de `appli-pc.bat` l'affiche (choix 3). **Ce fichier n'est pas un document** : les skills ne le rangent pas, ne le renomment pas, ne le portent pas au registre (chapitre 8, bloc C).

### Ce que fait le programme

1. **Trouver les deux dossiers du chantier** par le numéro en tête de leur nom, ou par la correspondance de `_prive/depot.json` quand elle existe (chapitre 4). Aucun dossier sur le PC, plusieurs, dossier technique ou en double : rien n'est copié pour ce chantier, et c'est écrit dans « A VOIR ».
2. **Lire `dossiers.json`** (chapitre 7) pour connaître les sous-dossiers. **Une clé absente du fichier prend la valeur du tableau ci-dessous** (c'est aussi ce que fait l'appli).

   | Clé | Fiche de l'appli | Sous-dossier (le même dans Drive et dans le dossier du chantier sur le PC) |
   |---|---|---|
   | `cotes` | Prise de cotes | `05 - CHANTIER/PRISE DE COTES` |
   | `fabrication` | Fiche de fabrication | `07 - ATELIER` |
   | `note` | Note de réunion | `05 - CHANTIER/COMPTE RENDU` |
   | `quitus`, `attestation`, `reception-support` | Quitus, attestation, réception de support | `05 - CHANTIER/OPR - RESERVES - QUITUS` |
   | `bordereau-orga` | Bordereau d'organigramme | `05 - CHANTIER/ORGANIGRAMME` |
   | `bordereau-materiaux` | Bordereau de matériaux | `05 - CHANTIER/BORDEREAUX MATERIAUX` |
   | `photos` | Photos | `05 - CHANTIER/PHOTOS CHANTIER` |
   | `signalement` | Signalements (lot 7) | `05 - CHANTIER/SIGNALEMENTS` |

   Les clés `carnet` et `plans` ne sont **pas** rapatriées : ce sont des copies de documents déjà dans le dossier du chantier.
3. **Copier dans le dossier du chantier sur le PC, au même chemin**, tout fichier qui n'y est pas déjà :
   - **copier, jamais déplacer** : rien n'est supprimé ni modifié dans Drive (la purge de Drive est le travail de l'appli, au lot 5, et tu la valides toi-même) ;
   - **jamais écraser** : un fichier de même nom et de même taille déjà dans le dossier du chantier est « déjà présent » ; s'il n'a pas la même taille, il est signalé et rien n'est touché ;
   - **jamais renommer** ;
   - **créer le sous-dossier s'il manque dans le dossier du chantier** (`SIGNALEMENTS` et `BORDEREAUX MATERIAUX` sont nouveaux) : seule exception à « ne pas créer de nouveau dossier » ;
   - la copie se fait **sous un nom temporaire** (`….partiel`), puis elle prend son vrai nom seulement si sa taille est bonne : un arrêt en route ne laisse jamais un fichier tronqué sous son nom final ;
   - un fichier Drive « en ligne seulement » se télécharge à la copie : si cela échoue, il est signalé et le programme continue.
4. **Signaler, sans les copier** (dans « A VOIR ») : les fichiers du dossier Drive du chantier qui sont **hors** de ces sous-dossiers (un dossier `Divers`, un ancien dossier) ; le contenu du dossier `_À CLASSER` de la racine ; les raccourcis Google (`.gdoc`, `.gsheet`… : ils ne contiennent pas le document) ; les doublons fabriqués par Drive (`nom (1).pdf`) ; les chemins trop longs ; les fichiers illisibles.
5. **Écrire deux fichiers distincts** (ci-dessous) : la liste de provenance, dans le dossier du chantier sur le PC ; le relevé de présence, dans Drive.

**Ne sont jamais rapatriées** : les demandes d'absence (`ADMINISTRATIF/ABSENCES`, hors chantier).

### La liste de provenance : `CHANTIERPRO - fiches rapatriees.json` (dans le dossier du chantier sur le PC)

- **Où** : à la **racine du dossier du chantier sur le PC** (avec « A VOIR », c'est le seul ajout à tes dossiers). Les skills la voient, puisqu'ils travaillent dans ce dossier.
- **À quoi elle sert** : c'est la **seule** source qui dit « ce fichier vient de l'appli ». Les skills s'en servent pour ne pas prendre ces fichiers pour leurs propres documents.
- **Écrite par** : le programme du PC, et lui seul. **Cumulative** : une entrée n'est jamais retirée, même si le fichier a été déplacé ensuite ; jamais deux fois le même chemin.

```json
{
  "version": 1,
  "chantier": "<nom du chantier dans l'appli>",
  "numero": "<N° du chantier>",
  "fichiers": [
    { "chemin": "05 - CHANTIER/OPR - RESERVES - QUITUS/QUITUS EXEMPLE 2026-11-12.pdf", "taille": 184223, "copie_le": "2026-11-13T08:30:00+01:00" }
  ]
}
```

- `chemin` : relatif au dossier du chantier, avec des `/`. `taille` : en octets (l'unité de poids d'un fichier). `copie_le` : heure de Paris.
- Un fichier trouvé « déjà présent » dans le dossier du chantier (même nom, même taille qu'une fiche du Drive, dans un sous-dossier de fiches) et absent de la liste y est ajouté : il vient de l'appli, même s'il a été copié avant ce programme.

### Trois règles du skill à protéger (sinon il abîmerait ces fichiers)
Les fiches de l'appli se nomment `<INTITULÉ> <nom court, sinon nom du chantier> [complément] <AAAA-MM-JJ>[_Vn].pdf` : la même forme que les documents de `gestion-documentaire`. Sans précaution, ses outils les prendraient pour ses propres documents.
- **« Une seule version active »** : deux quitus ou deux signalements ne sont **pas** deux versions du même document, même s'ils ne diffèrent que par la date ou par `_V2` (l'appli ajoute `_V2` à une **autre** fiche du même jour, pas à une nouvelle version). Ces fichiers ne sont jamais candidats « même document », jamais archivés dans `0-OLD`.
- **Comment les reconnaître** : par leur **provenance**, pas par leur nom. Est une fiche de l'appli tout fichier listé dans `CHANTIERPRO - fiches rapatriees.json`. Les fiches les plus anciennes ont d'autres noms (`Note_…`, `Cotes_…`, `Quitus_…`) : un tri par le début du nom les manquerait.
- **Veille des comptes rendus** : les notes de réunion de l'appli arrivent dans `05 - CHANTIER/COMPTE RENDU`, à côté des CR de la maîtrise d'œuvre. La veille doit les ignorer.

Le bloc C du chapitre 8 contient les lignes à ajouter aux paragraphes concernés, et la description des modifications des scripts `gestiondoc.py` et `veille_cr.py`.

### Le relevé `releve-pc.json` (dans Drive)

**À quoi il sert** : au lot 5, avant de proposer la purge d'un chantier, l'appli vérifiera que chaque fichier de Drive a bien été copié. Elle n'a pas accès aux dossiers de ton PC : elle lira ce relevé et comparera **le nom et la taille**.

- **Où** : à la racine du dossier Drive du chantier. **Écrit par** : le programme du PC, à partir de la liste réelle des fichiers du disque, refait en entier quand son contenu change, et au moins une fois par jour. Avec « A VOIR », c'est le **seul** fichier que le programme remplace, et le seul qu'il écrit dans le Drive hors du carnet. **Les skills ne le voient pas et ne l'écrivent pas.**
- **Contenu** : les fichiers présents dans le **dossier du chantier sur ton PC**, pour les sous-dossiers du point 2 (tous, pas seulement ceux qui viennent de l'appli).

```json
{
  "version": 1,
  "chantier": "<NOM de la colonne A de l'onglet Chantiers>",
  "numero": "<N° du chantier>",
  "releve_le": "2026-11-13T08:30:00+01:00",
  "fichiers": [
    { "chemin": "05 - CHANTIER/OPR - RESERVES - QUITUS/QUITUS EXEMPLE 2026-11-12.pdf", "taille": 184223 }
  ]
}
```

- `chemin` : relatif au dossier du chantier, avec des `/`. `taille` : en octets. `releve_le` : heure de Paris. Aucun chemin complet du PC, aucun lien.
- **Limite à connaître** : le relevé prouve que le fichier est dans le dossier du chantier **sur le PC**, pas que MEGA (la sauvegarde) a fini de le synchroniser. Si la synchronisation de MEGA est arrêtée, il ne le voit pas. Le lot 5 te demandera donc de vérifier que MEGA a fini de synchroniser avant de cocher une purge.
- **Relevé absent ou de plus de 30 jours : l'appli ne proposera pas la purge.** Un relevé manquant ne fait donc jamais rien supprimer ; il faut seulement que la recopie automatique tourne (ou relancer le programme) avant de purger.

---

## 6. Règle 5 — abandonnée (13/11/2026)

La règle 5 prévoyait que le skill `metre-plinthes` contrôle ses hypothèses avec les cotes de placards relevées sur le chantier (onglet *Prise de Cote*). **Franck l'a abandonnée le 13/11/2026** : l'intérêt pour le métré des plinthes était trop mince. Aucun skill ne lit cet onglet ; rien n'est à coller dans `metre-plinthes` (décision D9b-4).

---

## 7. Les noms de dossiers : `dossiers.json`

- **Où** : à la racine du Drive de l'appli.
- **Qui le modifie** : toi seul, à la main, si tu renommes un dossier. L'appli le relit au bout de 10 minutes. **Aucun skill ne l'écrit.**
- **Qui le lit** : l'appli, et le programme du PC (`depot_carnet.py`, `appli_pc.py`). Les skills n'en ont pas besoin.

```json
{
  "version": 1,
  "documents":     { "<clé>": "<sous-dossier dans le dossier du chantier>" },
  "hors_chantier": { "<clé>": "<sous-dossier à la racine du Drive de l'appli>" },
  "intitules":     { "<clé>": "<début du nom des fichiers>" }
}
```

- Séparateur des chemins : `/`.
- **Le fichier peut être incomplet** : l'appli ne l'écrit qu'une fois, à sa création. Une clé ajoutée par un lot plus récent (par exemple `signalement`, lot 7) n'y figure pas forcément : dans ce cas l'appli, et le programme du PC, prennent la valeur par défaut (tableau du chapitre 5). **Le fichier l'emporte quand la clé y est ; sinon, la valeur par défaut.**
- Fichier absent ou illisible : le programme du PC refuse de travailler (ce n'est pas la racine du Drive de l'appli, ou Drive pour ordinateur n'a pas fini de démarrer) et te le dit.

---

## 8. Textes prêts à coller dans `gestion-documentaire` (et nulle part ailleurs)

> Je ne modifie pas tes skills. Ces blocs sont à **valider avec Claude, dans le projet LOUE TRAVAIL**, puis à coller par toi. Les numéros de paragraphes (§) sont ceux de ton skill `gestion-documentaire` tel qu'il est aujourd'hui.
> **Dans l'ordre d'utilité** : le bloc C (indispensable **avant d'installer la recopie automatique**), le bloc B (une ligne), le bloc A (facultatif).
> Aucun autre skill n'a de texte à recevoir : les skills de plans ne changent pas.

### Bloc C — Les fiches venues de l'appli (indispensable)

**C.1 — § 1, dans le dessin de l'arborescence, sous la ligne du registre (racine), ajouter :**

```
CHANTIERPRO - fiches rapatriees.json     (racine) liste des fiches venues de l'appli ChantierPro, tenue par le programme
                                         du PC de Franck — Claude la lit, ne l'écrit jamais — §1 ter
(et, à côté des dossiers de chantier : CHANTIERPRO - A VOIR.txt, écrit par ce même programme pour Franck — ne pas y toucher)
```

**C.2 — § 1, table de routage, une ligne de plus :**

```
| Fiches produites par l'appli ChantierPro (PDF et photos : prises de cotes, quitus, attestations, réceptions de support, notes de réunion, signalements, bordereaux, photos) | elles arrivent toutes seules dans le dossier du chantier, copiées toutes les heures par le programme du PC de Franck dans le même sous-dossier que dans l'appli (`05 - CHANTIER/PRISE DE COTES`, `…/COMPTE RENDU`, `…/OPR - RESERVES - QUITUS`, `…/ORGANIGRAMME`, `…/BORDEREAUX MATERIAUX`, `…/PHOTOS CHANTIER`, `…/SIGNALEMENTS`, `07 - ATELIER`) — Claude ne les range pas, ne les renomme pas, ne les versionne pas (§1 ter, §6) |
```

**C.3 — Après le § 1 bis, nouveau paragraphe :**

```
### 1 ter. Appli ChantierPro : les fiches rapatriées, le carnet (contrat docs/contrat-skills.md du dépôt chantier-pro)

L'appli ChantierPro (téléphones des poseurs) range ses fiches dans un Drive que Claude ne voit pas. Un programme
du PC de Franck les recopie tout seul, toutes les heures, dans le dossier du chantier, et tient à sa racine la liste
`CHANTIERPRO - fiches rapatriees.json` : {"fichiers": [{"chemin": "<chemin relatif au chantier, avec des />",
"taille": <octets>, "copie_le": "<date>"}]}.

RÈGLE : tout fichier dont le chemin est dans cette liste est une FICHE DE L'APPLI. C'est un document reçu :
ni version, ni ligne au registre, ni renommage, ni archivage dans 0-OLD, ni veille des comptes rendus,
ni « même document » — même si deux fiches ne diffèrent que par la date ou par `_Vn` (pour l'appli, `_V2` est
une AUTRE fiche du même jour, pas une nouvelle version). On les reconnaît par cette liste, jamais par leur nom
(les plus anciennes s'appellent `Note_…`, `Cotes_…`, `Quitus_…`).
Comparer les chemins sans tenir compte des majuscules ni de la façon dont les accents sont codés.
La liste elle-même n'est pas un document : jamais déplacée, renommée, modifiée, ni portée au registre.
De même `CHANTIERPRO - A VOIR.txt`, à côté des dossiers de chantier : c'est le pense-bête que ce programme écrit
pour Franck ; ne pas y toucher.
Liste absente : aucune fiche de l'appli n'a encore été recopiée pour ce chantier, rien de particulier à faire.
Liste illisible : ne rien deviner, le dire à Franck.

Un skill N'ÉCRIT JAMAIS dans le Drive de l'appli ChantierPro, et n'a pas besoin de le voir : ni plan, ni image,
ni liste. Mettre un plan au carnet des poseurs et recopier les fiches dans le dossier du chantier, c'est le travail
du programme du PC. Si Franck demande « mets ce plan au carnet » ou « récupère les fiches de l'appli » :
lui rappeler de double-cliquer sur « appli-pc » (dossier outils du dépôt chantier-pro), ne rien tenter d'autre.
```

**C.4 — § 3 (registre), à la fin du dernier alinéa (« … le disque a raison et je corrige le registre »), ajouter :**

```
Les fiches de l'appli ChantierPro (§1 ter) n'ont pas de ligne au REGISTRE : leur présence sur le disque sans ligne
n'est pas un écart, et leur arrivée ne donne lieu à aucune ligne de JOURNAL.
```

**C.5 — § 3 ter (veille des comptes rendus), à la fin de « Où sont les CR », ajouter :**

```
Les fichiers de `05 - CHANTIER/COMPTE RENDU` listés dans `CHANTIERPRO - fiches rapatriees.json` (§1 ter) viennent
de l'appli ChantierPro (notes de réunion internes) : la veille ne les lit pas et ne les compte pas comme CR.
Stager aussi cette liste avec les CR (étape 1), pour que `veille_cr.py` puisse les écarter.
```

**C.6 — § 4.1 (« Même document »), à la fin du premier alinéa, ajouter :**

```
Exception : une fiche de l'appli ChantierPro (§1 ter) n'est jamais « le même document » qu'un autre fichier,
ni candidat proche ; `gestiondoc.py scan` les écarte d'après la liste de provenance.
```

**C.7 — § 5 (créer une nouvelle version), à la fin de l'étape 5 (archiver), ajouter :**

```
   Jamais une fiche de l'appli ChantierPro (§1 ter) : `gestiondoc.py archiver` refuse de la déplacer.
```

**C.8 — § 6 (« Ce qu'on ne touche pas »), deux ajouts :**

```
- **Fiches de l'appli ChantierPro** (§1 ter) : tout fichier listé dans `CHANTIERPRO - fiches rapatriees.json`
  (PDF et photos). Documents reçus : jamais renommés, jamais déplacés, jamais candidats « même document » (§4.1),
  jamais archivés dans 0-OLD.
```

et, dans la ligne « Fichiers techniques / temporaires », ajouter à la liste : `CHANTIERPRO - fiches rapatriees.json`, `CHANTIERPRO - A VOIR.txt` et `*.partiel` (copie en cours du programme du PC).

**C.9 — § 9 (état documentaire), après la liste des neuf contrôles, ajouter :**

```
Les fiches de l'appli ChantierPro (§1 ter) sont hors de ces contrôles : jamais signalées « plusieurs versions
actives » (1), « même document à plusieurs endroits » (2), « hors de leur dossier cible » (3), ni en écart
registre ↔ disque (7). L'état documentaire donne seulement leur nombre, par sous-dossier.
```

**C.10 — § 11 (migration d'un ancien dossier de travail), à la fin de l'étape 2, ajouter :**

```
   - une fiche de l'appli ChantierPro (§1 ter) n'est jamais déplacée, ni listée comme doublon à supprimer.
```

**C.11 — § 12 (scripts) : deux scripts à modifier, à faire avec Claude dans le projet LOUE TRAVAIL.** Je ne les vois pas en fonctionnement : voici, en clair, ce qu'ils doivent apprendre. Une fois modifiés, mets à jour le document du projet qui les contient, le jour même (ta règle du § 12).

- **Dans les deux scripts, une même petite fonction** « fiches de l'appli » : elle reçoit le dossier du chantier, lit `CHANTIERPRO - fiches rapatriees.json` à sa racine et rend l'ensemble des chemins listés, mis sous une forme comparable (séparateur `/`, minuscules, accents codés d'une seule façon). Fichier absent : ensemble vide, sans message. Fichier illisible : ensemble vide **et un avertissement affiché** (« liste de provenance illisible : les fiches de l'appli ne sont pas reconnues »).
- **`gestiondoc.py`** :
  - `scan` : un fichier dont le chemin (relatif au chantier) est dans cet ensemble n'entre ni dans les candidats « même document », ni dans les candidats proches, ni dans le choix de la version active, ni dans le nom proposé pour la nouvelle version. Le compte rendu du scan donne seulement leur nombre (« n fiche(s) de l'appli ignorée(s) »).
  - `archiver` : refuse de déplacer un tel fichier (il sort du plan d'archivage, avec la mention « fiche de l'appli »).
  - `registre` : n'ajoute pas de ligne pour un tel fichier, et ne le compte pas comme écart registre ↔ disque.
  - partout : `CHANTIERPRO - fiches rapatriees.json`, `CHANTIERPRO - A VOIR.txt` et les fichiers `*.partiel` rejoignent la liste des fichiers techniques ignorés.
- **`veille_cr.py`** :
  - `maj` : avant de lire le dossier `05 - CHANTIER/COMPTE RENDU`, appeler la fonction ; un fichier listé n'est pas lu, ne donne aucun point, et n'apparaît pas dans la feuille CR LUS comme un CR (une seule ligne de résumé : « n note(s) de l'appli ignorée(s) »). Il ne compte pas non plus dans les anomalies « n° manquant » ou « doublon ».
  - comme la veille tourne sur des fichiers stagés, la liste de provenance doit être stagée avec eux (bloc C.5) ; si elle n'est pas là, le script le dit (« liste de provenance absente du dossier stagé ») au lieu de l'ignorer en silence.
- **Essai obligatoire après modification** : chapitre 9, essais 6 et 7.

### Bloc B — Le rappel après un bordereau (une ligne)

**B.1 — § 7.1, étape 9 (compte rendu), à la fin, ajouter :**

```
   Si le bordereau contient un document qui va au carnet des poseurs (n° 001, 002, 103 à 109, 151, 152, 205, 206 ;
   ou leur ancien numéro) : rappeler à Franck, une fois le mail envoyé, de double-cliquer sur « appli-pc »
   (dossier outils du dépôt chantier-pro) pour le mettre au carnet. Claude ne le fait jamais lui-même (§1 ter).
```

### Bloc A — L'identité du chantier (facultatif : seulement si le connecteur Google Sheets marche)

> Rien d'autre n'en dépend. À ne coller qu'après l'essai 1 du chapitre 9.

**A.1 — À la fin du § 3 bis (FICHE INFO), ajouter :**

```
### Lien avec l'appli ChantierPro — LECTURE SEULE (contrat docs/contrat-skills.md du dépôt chantier-pro, règle 1)

Accès : connecteur Google Sheets. L'identifiant ET le titre exact du classeur sont dans le doc du projet
`claude/CHANTIERPRO - acces.md`. Avant toute lecture : si le titre du classeur ouvert n'est pas exactement
celui noté, ou s'il contient « TEST », s'arrêter et le dire à Franck.
Ne JAMAIS écrire dans ce classeur. N'y lire que l'onglet « Chantiers », aucun autre (surtout pas
« Utilisateurs »).
Connecteur absent, onglet introuvable, colonnes inattendues : ne rien deviner, continuer avec la FICHE INFO
et le signaler en une ligne.

Onglet « Chantiers » (référence pour l'identité — exception voulue à « FICHE INFO source unique », pour
l'identité seulement). Colonnes : A NOM (nom dans l'appli), B REFERENCE, C STATUT, D Conducteur, E N°,
F Nom court, G Adresse, H Client, I Architecte, J Date « Terminé », K Chemin MEGA.
TANT QUE FRANCK N'A PAS TRANCHÉ UN ÉCART, les noms de fichiers, bordereaux et courriers continuent d'utiliser
la FICHE INFO : le Sheet ne sert qu'à comparer.
1. Trouver la ligne par E = n° du dossier du chantier (comparé comme du texte) ; à défaut par F = nom court.
   Aucune ou plusieurs lignes : continuer avec la fiche seule et le dire à Franck.
2. Citer A (« nom dans l'appli ») dans le compte rendu, pour information ; plus rien n'en dépend.
3. Création d'une FICHE INFO : n°, nom court et adresse viennent d'abord du Sheet
   (source « Sheet ChantierPro, lu le JJ/MM/AAAA ») ; adresse en une case dans le Sheet, deux rubriques dans
   la fiche : découpage douteux → case jaune, jamais au hasard. H et I servent à contrôler les lignes MOA et
   ARCHI. Un écart vu à la création devient une ligne À VÉRIFIER, comme toute question de création.
   Nom court déjà utilisé au registre et différent de F : garder celui du registre, signaler l'écart.
4. FICHE INFO existante : COMPARER ET SIGNALER DANS LE COMPTE RENDU DE LA CONVERSATION. Ne rien écrire,
   ni dans le Sheet, ni dans la fiche (pas de ligne À VÉRIFIER ajoutée). Seulement à la première intervention
   sur ce chantier dans la conversation, à l'état documentaire et avant un bordereau.
   E ↔ n° chantier ; F ↔ nom court ; G ↔ « adresse du chantier » + « code postal + ville » bout à bout ;
   H ↔ société de la ligne MOA ; I ↔ société de l'une des lignes d'architecte.
   Comparaison sans majuscules, sans accents, espaces et ponctuation réduits.
   - case vide dans le Sheet : pas un écart ; dire à Franck de la compléter dans l'onglet Chantiers ;
   - écart réel : « Sheet : … / fiche : … » + question à Franck. C'est Franck qui corrige à la main celui
     des deux qui a tort ;
   - D (conducteur) ↔ conducteur de travaux, sur le nom de famille : POUR INFORMATION, sans question.
     L'expéditeur des bordereaux (fiche) et le conducteur de l'appli (Sheet) peuvent différer exprès.
```

**A.2 — Dans la table « 1 bis. Où les compétences métier lisent leurs entrées », remplacer la dernière ligne (celle qui commence par « Infos du chantier ») par ces deux lignes. Les compétences continuent de lire l'identité dans la FICHE INFO :**

```
| Nom du chantier dans l'appli ChantierPro (colonne A), et contrôle de l'identité (§3 bis, lien avec l'appli) | onglet « Chantiers » du Sheet ChantierPro (connecteur Sheets, lecture seule) | ligne retrouvée par le n° ; tout écart avec la fiche est signalé à Franck, jamais corrigé en silence |
| Infos du chantier : **identité (n°, nom court, adresse, conducteur de travaux) toujours lue ici** — le Sheet ne sert qu'à la contrôler et à créer une fiche —, lots, intervenants (société, interlocuteur, tél, mail), Loué, lien MEGA, documents déjà envoyés | `00 - FICHE INFO <NOM COURT>.xlsx` à la racine (§3 bis) ; ancien emplacement : feuille FICHE CHANTIER du registre | relire à chaque usage (Franck la corrige à la main) ; si elle n'existe pas, la créer d'abord (§3 bis) |
```

---

## 9. Ce que tu dois faire, et comment vérifier

**La marche à suivre complète, pas à pas, est dans `docs/lot4c-procedure.md`.** En résumé :

1. Remplir `_prive/depot.json` (les deux chemins), et regarder ce que le programme ferait (« Voir seulement »).
2. Valider avec Claude, puis coller, les blocs C et B du chapitre 8 dans `gestion-documentaire`, et faire modifier `gestiondoc.py` et `veille_cr.py` (bloc C.11). **À faire avant d'installer la recopie automatique.**
3. Double-cliquer une fois sur `outils\installer-tache.bat` : la recopie des fiches se fait ensuite toute seule.
4. Les essais ci-dessous.
5. Seulement si tu veux la règle 1 : créer le document privé `claude/CHANTIERPRO - acces.md` (identifiant du vrai Sheet — la suite de lettres et de chiffres entre `/d/` et `/edit` dans son adresse — et son **titre exact**), compléter la colonne E (N°) de l'onglet *Chantiers*, coller le bloc A. **Attention à la colonne F (Nom court)** : dès qu'elle est remplie, l'appli met ce nom court, à la place du nom du chantier, dans le nom des PDF qu'elle range ; remplis-la plutôt au démarrage d'un chantier.

### Les essais

| # | Essai | Attendu |
|---|---|---|
| 4 | **Programme, sur la copie TEST et un faux dossier de chantiers** (avec moi) : un faux bordereau, une recopie des fiches | Le plan apparaît dans le carnet de l'appli de test ; les fiches sont copiées dans le faux dossier de chantier ; rien n'a changé dans le Drive TEST à part le carnet et `releve-pc.json` |
| 5 | **Programme, « Voir seulement » (choix 2) sur les vrais dossiers** | Chaque chantier est relié au bon dossier ; les documents proposés sont bien ceux des bordereaux ; rien n'est écrit |
| 6 | **Avec le vrai skill, sur un vrai chantier, après une première recopie des fiches** : « fais-moi l'état documentaire du NNN » | **Aucune fiche de l'appli** n'apparaît en « plusieurs versions actives », « même document à plusieurs endroits » ou « hors de son dossier » ; aucune n'a été déplacée ni renommée ; le registre n'a pas de ligne pour elles |
| 7 | **Veille des comptes rendus** sur ce même chantier (il faut au moins une note de réunion de l'appli dans `05 - CHANTIER/COMPTE RENDU`) | Aucune note de l'appli n'est comptée comme compte rendu ; les CR de la maîtrise d'œuvre sont lus comme avant |
| 8 | Après la préparation d'un bordereau qui contient un plan de réservations | Le compte rendu du skill rappelle le double-clic sur `appli-pc` |

Si l'essai 6 ou 7 échoue (une fiche de l'appli traitée comme un document du skill) : **retire la tâche planifiée** (`outils\retirer-tache.bat`), garde le compte rendu de Claude et montre-le-moi. Rien n'est perdu : le programme ne supprime rien, et les fichiers qu'il a copiés sont listés dans `CHANTIERPRO - fiches rapatriees.json`.

### Les essais de la règle 1 (facultative ; rien n'est écrit dans le Sheet)

Sur un vrai chantier en cours (il faut sa FICHE INFO), de préférence le soir.

| # | Essai | Attendu |
|---|---|---|
| 1 | Dans une conversation du projet LOUE TRAVAIL : « lis l'onglet Chantiers du Sheet ChantierPro et dis-moi ce que tu trouves pour le chantier NNN » | Claude cite la ligne (nom, adresse, conducteur). S'il dit qu'il n'a pas le connecteur Google Sheets : active-le dans les réglages de Claude, relié au **compte Google de Loué**, puis recommence. |
| 2 | « Fais l'état documentaire du NNN » | Le compte rendu dit ce qui a été lu dans le Sheet et liste les écarts avec la FICHE INFO. **Ouvre l'historique des versions du Sheet** (Fichier → Historique des versions) et clique sur la version de l'heure de l'essai : les cases modifiées y sont surlignées. **Regarde seulement l'onglet *Chantiers*** : rien ne doit y avoir changé. Tout changement dans un autre onglet vient de l'appli elle-même (une fiche, un poseur qui ouvre l'appli) : n'y touche pas. |
| 3 | Change exprès une lettre du **Client** (colonne H : les poseurs ne la voient pas), puis redemande l'état documentaire | L'écart t'est signalé dans la conversation ; ni le Sheet ni la fiche n'ont été modifiés par Claude (la date de modification de la FICHE INFO n'a pas bougé). Remets la bonne valeur. |

Si une case de *Chantiers* a changé sans toi : retire le bloc A, remets à la main la valeur d'avant dans cette case (l'historique la montre), **ne corrige rien dans les autres onglets**, et dis-le-moi. **Ne clique jamais sur « Restaurer cette version »** : cela effacerait tout ce que l'appli a écrit depuis (fiches, comptes, signalements).

---

## 10. Les questions posées, et les décisions

| Question | Décision |
|---|---|
| Règle 2 : par un fichier, ou par une écriture dans le Sheet ? | **Ni l'un ni l'autre** (13/11/2026) : la note de réunion est interne, ses participants seront ajoutés à la main si nécessaire. Règle 2 abandonnée |
| Quel dossier du Drive donner à Claude ? | **Aucun** (lot 4c). La réponse du 13/11/2026 (« toute la racine ») est remplacée : un skill ne peut de toute façon pas y travailler (essai A2), et le programme du PC fait le pont |
| Carnet : quand y mettre un document ? | **Seulement une version validée** : ce qui est dans un bordereau, et après ta confirmation document par document. Écart assumé avec le plan d'origine, qui disait « automatiquement » |
| Carnet : quels documents en plus de ta liste ? | **Tableau de portes (103), repérage des portes (104), pose des huisseries (107)** |
| Où tourne le programme du carnet ? | **Sur ton PC**, lancé par toi (double-clic sur `outils\appli-pc.bat`) |
| Comment le programme sait-il quels documents prendre ? | **Il lit les bordereaux** (lot 4c, après critique indépendante). Écartée : une « demande » écrite par chaque skill (un dossier de plus dans chaque chantier, un bloc dans neuf skills, le risque d'une demande fausse) |
| Qui recopie les fiches, et quand ? | **Le programme du PC, tout seul** : une tâche du Planificateur de tâches de Windows le lance toutes les heures et à l'ouverture de session (décision de Franck) ; le double-clic reste possible. Copie seulement : jamais de suppression ni d'écrasement. Le skill ne lance rien |
| Comment le programme trouve-t-il le dossier du chantier ? | **Par le numéro en tête du nom des dossiers** ; rien n'est deviné (aucun dossier ou plusieurs : rien n'est copié, c'est signalé). Une correspondance écrite à la main reste possible pour les cas que le numéro ne règle pas |
| Comment Franck est-il prévenu ? | Par le fichier `CHANTIERPRO - A VOIR.txt`, réécrit à chaque passage, à côté de ses dossiers de chantier |
| Comment les skills reconnaissent-ils une fiche de l'appli ? | Par la **liste de provenance dans le dossier du chantier** (`CHANTIERPRO - fiches rapatriees.json`). Le relevé `releve-pc.json` (appelé « mega-index.json » jusqu'à la version 4), lui, reste dans Drive et ne sert qu'à la purge (lot 5) |
| MEGA est-il un outil du contrat ? | **Non** (décision de Franck) : MEGA synchronise les dossiers de chantier du PC (sauvegarde, accès à distance). L'appli et les skills ne connaissent que ces dossiers |

**Reste à trancher par toi** : le nom exact du fichier `CHANTIERPRO - fiches rapatriees.json` (c'est le seul fichier ajouté à la racine de chaque dossier de chantier). Si tu veux un autre nom, dis-le **avant d'installer la recopie automatique** : il est écrit à un seul endroit du programme, et dans les blocs du chapitre 8.

---

## 11. Limites, et ce que les relectures ont fait changer

### Limites (dites franchement)
- **Les textes du chapitre 8 n'ont pas été essayés avec le vrai skill.** Je ne vois pas tes skills en fonctionnement. Les essais 6 et 7 du chapitre 9 sont la vraie validation, et ils sont **obligatoires**.
- **Le programme du PC n'a tourné que sur de faux dossiers** (tests automatiques). Son premier lancement sur tes vrais dossiers se fait avec « Voir seulement ».
- **La protection des fiches de l'appli tient à des consignes** écrites dans le skill et à deux scripts modifiés : tant que le bloc C n'est pas collé et que les scripts ne sont pas modifiés, la recopie amène dans les dossiers de chantier des fichiers que `gestion-documentaire` pourrait prendre pour les siens. C'est pourquoi le bloc C se colle **avant** d'installer la tâche planifiée.
- **`releve-pc.json`** ne prouve que la présence sur le PC (chapitre 5).
- **La recopie automatique ne tourne que PC allumé, session ouverte, Google Drive pour ordinateur démarré** ; sur un portable, Windows ne lance pas la tâche quand il est sur batterie. Elle n'a jamais tourné sur le vrai PC : la tâche planifiée elle-même n'a pas été créée par moi.
- **Un bordereau préparé mais pas envoyé** est proposé comme les autres : c'est toi qui réponds « plus tard ».
- **Anciens numéros de documents** : la table est à remplir avec toi, chantier par chantier pour les chantiers anciens (chapitre 4).
- **Règle 1** : jamais essayée ; « lecture seule » y est une consigne, pas un verrou (chapitre 1).
- **Un seul PC** est prévu pour le programme.
- **Gratuité** : rien de nouveau à payer ni à installer.

### Ce que le lot 4c a fait changer (version 5, 13/11/2026)
- **Plus de « demandes » écrites par les skills** : le programme du PC lit les bordereaux. Le chantier n'est plus choisi par un skill : le dossier est trouvé par le numéro du chantier, recoupé avec le nom du PDF.
- **Le Drive de l'appli n'est plus à relier à Claude** ; un skill n'y écrit jamais (remplace la partie « racine » de la décision D4-1).
- **La recopie des fiches est faite par le programme du PC, tout seul** (tâche planifiée de Windows, toutes les heures), plus par un script lancé par le skill : le script séparé annoncé dans la version 4 n'a pas été écrit. Ce qui demande l'attention de Franck est écrit dans `CHANTIERPRO - A VOIR.txt`.
- **Vocabulaire** : « dossier du chantier sur le PC » remplace « MEGA » partout où l'on parlait des dossiers ; MEGA n'est que leur sauvegarde. Le relevé s'appelle `releve-pc.json` (il s'appelait « mega-index.json »).
- **Deux fichiers distincts** : la provenance (dans le dossier du chantier, lisible par les skills) et le relevé de présence (dans Drive, pour la purge). La version 4 faisait reconnaître les fiches par le relevé, que les skills n'auraient pas pu lire.
- **Les doublons `nom (1).pdf` et les raccourcis Google sont signalés, plus copiés.**
- **La règle 1 devient facultative**, et ne lit plus que l'onglet *Chantiers*.
- **Les textes à coller ne concernent plus qu'un seul skill** (`gestion-documentaire`), au lieu de neuf.

### Décisions de Franck au début du lot 4 (13/11/2026)
- **Règle 2 abandonnée** : chapitre 3 retiré, plus de fichier transmis à l'appli, l'onglet *Intervenants* sort de la liste des onglets lisibles par les skills.
- Les questions ouvertes de la version 4 sont tranchées (chapitre 10).

### Décisions de Franck (13/11/2026)
- **Rien ne se colle dans les skills avant le lot 4** : tout est fait en une seule fois, et validé avec Claude.
- **Règle 5 abandonnée** (cotes de placards pour le métré des plinthes) : chapitre 6 et son bloc retirés ; l'onglet *Prise de Cote* sort de la liste des onglets que les skills peuvent lire.

### Ce que la 3e relecture a fait changer (12/11/2026)
- **Les compétences lisent toujours l'identité dans la FICHE INFO** ; le Sheet la contrôle (la version précédente laissait croire qu'elles pouvaient prendre le nom court ou le conducteur du Sheet).
- **Essai 2** : ne regarder que l'onglet *Chantiers* (l'appli écrit seule dans les autres : il ne faut surtout pas les « corriger »). Essai 3 sur la colonne Client, invisible des poseurs.

### Ce que la 2e relecture a fait changer (12/11/2026)
- **Plus aucune écriture dans une FICHE INFO existante** : un écart est signalé dans la conversation (la version 2 faisait encore ajouter une ligne À VÉRIFIER, sans commande pour le faire).
- **Tant qu'un écart n'est pas tranché, les skills continuent d'utiliser la FICHE INFO** pour nommer les fichiers (sinon deux « noms courts » auraient donné deux versions actives du même document).
- **Conducteur** : simple information (l'expéditeur des bordereaux et le conducteur de l'appli peuvent différer exprès).
- **Ne jamais « restaurer une version » du vrai Sheet** : la version 2 le conseillait en cas de problème ; cela aurait effacé les fiches reçues depuis.
- **Colonne F (Nom court)** : la remplir change le nom des PDF de l'appli ; c'est dit.
- **Fiches de l'appli reconnues par leur provenance**, pas par leur nom, et protégées aussi quand elles ne diffèrent que par `_V2` (depuis la version 5 : par la liste de provenance dans le dossier du chantier).

### Ce que la 1re relecture a fait changer (12/11/2026)
- **Plus aucune écriture d'un skill dans le vrai Sheet.** La première version faisait réécrire un onglet du Sheet par un skill, d'après une consigne en prose, sans essai possible avant le vrai Sheet : un tri de l'onglet ou une ligne vide pouvait écraser les lignes d'un autre chantier.
- **Règle 1 ramenée à « lire, comparer, signaler ».** La première version faisait écrire dans la FICHE INFO des rubriques qui n'y existent pas, avec un script qui n'a pas de commande pour cela, et sa règle d'écart ne se résolvait jamais.
- **`dossiers.json` peut être incomplet** : valeurs par défaut pour les clés absentes (sinon les signalements n'auraient jamais été rapatriés).
- **Trois règles du skill protégées** (version unique, veille des CR, « jamais écraser »), que le rapatriement aurait heurtées.
- **Rapatriement** : plus « à chaque intervention » ; dossiers douteux refusés ; fichiers hors rangement signalés ; un programme testé au lieu d'une consigne.
- **Contrôle du bon classeur** par son titre exact ; onglets interdits de lecture ; portée réelle des accès écrite noir sur blanc.
- **Numéros de document** de l'organigramme (151) et de la signalétique (152) corrigés.
