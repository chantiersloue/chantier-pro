# Contrat entre l'appli ChantierPro et les skills de Franck (lot 9b)

> **Pour qui ?** Pour Franck, et pour les skills Claude du projet LOUE TRAVAIL (`gestion-documentaire`, `metre-plinthes`, et les skills qui produisent des plans).
> **À quoi ça sert ?** L'appli et les skills travaillent sur les mêmes chantiers. Ce contrat dit **qui écrit quoi, où, et sous quel nom**, pour que personne n'écrase le travail de l'autre.
> **Ce fichier est public** (le dépôt l'est) : aucun identifiant, aucun lien, aucun nom de client ni de chantier réel.
> **Rien n'est déployé par ce lot.** Je ne modifie pas tes skills : les textes à y coller sont au chapitre 8, tu les colles toi-même.
> **Version 3**, après deux relectures indépendantes (ce qu'elles ont fait changer : chapitre 11).

## En deux minutes

Le principe retenu, le plus prudent : **un skill ne modifie jamais le Google Sheet de l'appli.** Il le **lit**. Quand un skill doit donner quelque chose à l'appli, il **dépose un fichier** dans le Drive de l'appli, et c'est l'appli qui le lit avec du code testé.

| # | Règle | Skill | Utilisable quand ? |
|---|---|---|---|
| 1 | L'identité d'un chantier (n°, nom, adresse, client, architecte, conducteur) se lit dans l'onglet *Chantiers* du Sheet. La FICHE INFO en est la copie : tout écart t'est signalé. | `gestion-documentaire` | **Dès maintenant** (lecture seule) |
| 2 | Les intervenants de la FICHE INFO sont déposés dans un fichier `intervenants.json` ; l'appli le recopie elle-même dans l'onglet *Intervenants*. | `gestion-documentaire` | Quand le Drive de l'appli est connecté à Claude **et** que le lot 8 est livré |
| 3 | Les plans utiles aux poseurs sont déposés dans le carnet avec un seul script, `depot_carnet.py`. | les skills de plans | **Au lot 4** |
| 4 | Les fiches produites par l'appli (PDF, photos) sont recopiées de Drive vers MEGA, dans les mêmes dossiers. | `gestion-documentaire` | Quand le Drive de l'appli est connecté à Claude |
| 5 | Le métré des plinthes contrôle ses hypothèses avec les cotes relevées sur le chantier (onglet *Prise de Cote*). | `metre-plinthes` | **Dès maintenant** (lecture seule) |

**Ce que tu peux coller aujourd'hui** : les blocs A et B (règles 1 et 5). Ils ne font que **lire** le Sheet, et ne modifient aucune FICHE INFO existante. Les règles 2, 3 et 4 attendent le lot 4, où le dossier Drive de l'appli sera connecté à Claude et où je te fournirai des **scripts testés** au lieu de consignes en prose.

---

## 1. Par où passent les skills

Vocabulaire : un **connecteur** est un accès que tu donnes à Claude vers un de tes outils (ici Google Sheets). Un **dossier connecté** est un dossier de ton PC que Claude peut lire et écrire (comme ton dossier MEGA aujourd'hui).

| Ce que le skill veut atteindre | Par où | État |
|---|---|---|
| Le Google Sheet de l'appli, **en lecture** | le connecteur Google Sheets de Claude | à vérifier une fois par toi (chapitre 9, essai 1) |
| Les dossiers chantier de MEGA | le dossier connecté habituel (`Z:\CHANTIERS\…`) | en place |
| Le Drive de l'appli | le dossier `G:\Mon Drive\…` (Google Drive pour ordinateur), à connecter à Claude comme le dossier MEGA | **pas connecté** : prévu au lot 4 |

### Quatre règles générales

1. **Aucun identifiant dans ce contrat ni dans le dépôt.** Tu notes dans un document **privé** du projet LOUE TRAVAIL, que j'appelle ici `claude/CHANTIERPRO - acces.md` : l'identifiant du vrai Sheet **et son titre exact** ; plus tard, le chemin **et le nom exact** du dossier racine du Drive de l'appli.
2. **Contrôle « c'est bien le bon classeur ».** Avant toute lecture, le skill compare le titre du classeur ouvert au titre noté dans le document privé. S'ils diffèrent, ou si le titre contient « TEST », il s'arrête et te le dit. (La copie TEST sert à mes essais ; ses données sont fausses.)
3. **Lecture seule sur le Sheet, et sur quatre onglets seulement** : *Chantiers*, *Intervenants*, *Dossiers chantiers*, *Prise de Cote*. Le skill ne lit jamais *Utilisateurs* (il contient les mots de passe provisoires), *Accès chantiers*, *Sans compte*, *Envois*, *Contacts*.
4. **Si un accès manque** (connecteur absent, dossier non connecté, onglet introuvable, colonnes inattendues) : le skill **ne devine rien et n'écrit rien**. Il continue son travail avec la FICHE INFO comme avant, et te le signale en une ligne.

### Ce que ces accès permettent vraiment (à savoir avant de les donner)

- **Le connecteur Google Sheets donne très probablement à Claude l'accès, en lecture et en écriture, à tous les classeurs du compte Google auquel il est relié** (donc au vrai Sheet et à la copie TEST). « Lecture seule » et « quatre onglets » sont des **consignes** écrites dans le skill, pas un verrou technique. C'est une raison de plus pour qu'aucune règle de ce contrat ne demande d'écrire dans le Sheet.
- **Quel compte Google ?** Le Sheet appartient au compte Google de Loué. Le connecteur doit être relié à **ce compte-là**. S'il est relié à un autre de tes comptes, il ne verra pas le Sheet : ne partage pas le Sheet pour contourner, dis-le-moi d'abord.
- **Le dossier Drive à connecter (plus tard) est toute la racine du Drive de l'appli**, parce que `dossiers.json` s'y trouve. Cette racine contient aussi `ADMINISTRATIF/ABSENCES` (les demandes d'absence des salariés). La décision S1-3 ne parlait que du carnet : **c'est un élargissement, à valider par toi au lot 4** (question 2 du chapitre 10).

---

## 2. Règle 1 — L'identité du chantier se lit dans l'onglet *Chantiers*

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
| E | N° | Numéro du chantier : celui du dossier MEGA (`NNN - …`) |
| F | Nom court | Le « nom court » de `gestion-documentaire` |
| G | Adresse | Adresse du chantier, en une seule case |
| H | Client | Maître d'ouvrage |
| I | Architecte | |
| J | Date « Terminé » | |
| K | Chemin MEGA | Dossier du chantier dans MEGA |

### Ce que fait `gestion-documentaire` (il ne fait que lire)

1. **Trouver la ligne** : celle dont la colonne E (N°) est le numéro du dossier MEGA (comparé comme du texte : « 431 » et 431 sont le même numéro). À défaut, celle dont le Nom court (F) est celui de la FICHE INFO. Aucune ligne, ou plusieurs : le skill continue avec la FICHE INFO seule et te dit « ce chantier n'est pas (ou est deux fois) dans l'onglet Chantiers ».
2. **Retenir le « nom dans l'appli »** (colonne A) pour la durée de son travail : les règles 2, 4 et 5 en ont besoin. Il est relu dans le Sheet à chaque intervention, jamais recopié de mémoire.
3. **À la création d'une FICHE INFO** (nouveau chantier) : les valeurs du Sheet sont la **première source** pour le n°, le nom court et l'adresse, avec la source « Sheet ChantierPro, lu le JJ/MM/AAAA ». L'adresse du Sheet tient en une case, la fiche en a deux (« adresse du chantier », « code postal + ville ») : si le découpage n'est pas évident, case jaune et question, jamais au hasard. Client et architecte servent à contrôler les lignes MOA et ARCHI de la feuille INTERVENANTS (ils n'ont pas de rubrique dans la feuille FICHE). Un écart constaté à ce moment-là devient une ligne À VÉRIFIER de la fiche, comme toute autre question de création.
4. **Sur une FICHE INFO qui existe déjà** : le skill **compare et signale dans son compte rendu ; il n'écrit rien, ni dans le Sheet, ni dans la fiche**. Il le fait à trois moments seulement : quand tu demandes l'état documentaire, avant un bordereau, et à la première intervention sur un chantier (pas à chaque fois qu'un fichier est lu).

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
5. **Tout le reste de la FICHE INFO ne change pas** : lots, intervenants, envois, lien MEGA, points des comptes rendus restent dans la fiche, qui en est la seule source.

---

## 3. Règle 2 — Les intervenants : un fichier déposé, que l'appli recopie

### Pourquoi
Au lot 8, la note de réunion de l'appli proposera les présents et les destinataires d'après l'onglet *Intervenants*. Cette liste est déjà tenue par `gestion-documentaire` dans la FICHE INFO : on la transmet, on ne la ressaisit pas.

### Deux solutions comparées

| | A. Le skill écrit dans l'onglet par le connecteur Sheets | **B. Le skill dépose `intervenants.json`, l'appli le recopie (retenue)** |
|---|---|---|
| Qui modifie le vrai Sheet | un skill, en suivant une consigne en prose | l'appli, avec du code testé, sous verrou |
| Risque pour les autres chantiers | réel : un tri de l'onglet, une ligne vide ou un ajout mal placé peut écraser les lignes d'un autre chantier | nul : l'appli remplace le bloc d'un chantier en une opération, retrouvé par son nom |
| Essais avant le vrai Sheet | impossibles (le skill n'a pas le droit de toucher à la copie TEST) | faits sur la copie TEST et dans les tests automatiques |
| Disponible | tout de suite | au lot 8 (et il faut le Drive connecté) |
| Outils en plus | aucun | aucun |

Je retiens **B** : l'onglet *Intervenants* ne sert à rien avant le lot 8, donc rien ne presse, et A fait courir un risque à des données réelles. **C'est un écart avec `PLAN.md`** (qui disait « le skill recopie dans l'onglet ») : il est noté dans `DECISIONS.md` (D9b-1) et **tu peux le refuser** (question 1 du chapitre 10).

### Le fichier

- **Où** : à la racine du dossier Drive du chantier. **Nom** : `intervenants.json`.
- **Écrit par** : `gestion-documentaire`, quand la liste des intervenants de la FICHE INFO a changé (pas à chaque intervention). Le fichier est remplacé en entier.
- **Sens unique** : FICHE INFO → fichier → onglet. Une correction se fait **dans la FICHE INFO**.

```json
{
  "version": 1,
  "chantier": "<NOM de la colonne A de l'onglet Chantiers>",
  "numero": "<N° du chantier>",
  "ecrit_le": "2026-11-13T08:30:00+01:00",
  "intervenants": [
    { "nom": "<INTERLOCUTEUR>", "societe": "<SOCIÉTÉ>", "lot_fonction": "<RÔLE — LOT xx>", "mail": "<une adresse>", "telephone": "<PORTABLE, sinon TÉL. SOCIÉTÉ>" }
  ]
}
```

(Un fichier « JSON » est un simple fichier de texte rangé de façon stricte, que les programmes savent relire sans se tromper.)

- Une entrée par intervenant qui a un interlocuteur ou une société, **même sans mail** (il peut être présent à une réunion). Pas les personnes de Loué : l'appli les connaît déjà.
- `mail` : **une seule** adresse, de la forme `nom@domaine`, sans espace ni retour à la ligne. S'il y en a plusieurs dans la fiche, la première, et le skill te dit lesquelles il a laissées.
- **Liste vide** : le skill n'écrit pas le fichier (une lecture ratée de la fiche ne doit pas vider l'onglet) ; il te le dit.
- Dans son compte rendu, le skill liste les **adresses nouvelles** depuis le fichier précédent : ce sont de futurs destinataires proposés par l'appli, tu dois les avoir vues.

### Ce que fera l'appli (lot 8, pas avant)
Elle lira ce fichier, contrôlera chaque champ, remplacera dans l'onglet *Intervenants* le bloc de ce chantier, et écrira la date dans la colonne « Mis à jour le ». D'ici là, le fichier peut exister : il est ignoré.

**Confidentialité** : ce fichier et l'onglet contiennent des mails et des téléphones de personnes extérieures. Le Sheet n'est partagé avec personne. Dans le Drive de l'appli, seuls le planning et les dossiers `Plans` des chantiers sont partagés « par lien » pour les poseurs : `intervenants.json` se dépose **à la racine du dossier du chantier, jamais dans `Plans`**.

---

## 4. Règle 3 — Le carnet de chantier (lot 4)

> **Rien à coller dans tes skills pour cette règle avant le lot 4.**

### Ce qui est décidé
- **Un seul script pour tous les skills** : `depot_carnet.py`. Aucun skill ne découpe ni ne dépose lui-même.
- **Ce que le poseur voit** : des pages-images (WebP, 200 dpi pour les plans, 150 dpi pour les documents de texte), jamais le PDF, sauf demande « garder le PDF » pour un document (décisions S1-1 et S1-2).
- **Où** : dans le dossier Drive du chantier, sous-dossier donné par la clé `carnet` (chapitre 7). Jamais un chemin écrit en dur.
- **Le PDF d'origine reste dans MEGA.** Le carnet n'est pas une archive.
- Nom dans le carnet : `<N° de nomenclature> <INDICE> <INTITULÉ>`. Le script tient `carnet.json` (la liste que l'appli lit) ; aucun skill ne l'écrit à la main.

### Quels documents
Ceux que tu as marqués « utiles aux poseurs » dans `docs/skills.md` :

| Skill | Document | N° de nomenclature |
|---|---|---|
| `reservation-men-int` | réservations men int (détail, repérage) | 105, 106 |
| `reservation-men-ext` | réservations men ext (détail, repérage) | 205, 206 |
| `plans-bal` | plans des boîtes aux lettres | 108 |
| `plans-gaines-techniques` | plans des gaines techniques | 109 |
| `organigramme` | organigramme | 151 |
| `signaletique` | signalétique | 152 |
| `ppsps` | PPSPS | 001 |
| `temps-de-tache` | temps de tâches | 002 |

Ne vont **jamais** au carnet : tout ce qui porte un prix, les documents internes (fiches de fabrication, notes internes, rapports d'incohérences), les brouillons.

### Ce qui reste ouvert (tranché au lot 4, avec toi)
- **Où tourne le script** : dans l'espace de travail de Claude (qui ne voit pas `G:`) ou sur ton PC (commandes limitées à 3 minutes environ, Python et WebP à vérifier). Les scripts de tes skills sont rangés dans les documents du projet LOUE TRAVAIL, pas dans ce dépôt : `depot_carnet.py` devra y être copié.
- **Quand déposer** et **quels documents en plus** : questions 3 et 4 du chapitre 10.

---

## 5. Règle 4 — Rapatrier les fiches de l'appli de Drive vers MEGA

### Pourquoi
MEGA est l'archive maître. Or les fiches remplies sur les téléphones (prises de cotes, quitus, signalements, notes de réunion, photos…) arrivent dans **Drive**. Tant qu'elles n'ont pas été recopiées dans MEGA, elles n'existent qu'à un endroit.

**Condition** : le dossier Drive de l'appli est connecté à Claude. **Au moment du branchement (lot 4), je te fournirai un script testé** (`rapatrier.py`, comme les autres scripts de tes skills) : une copie de fichiers ne doit pas être rejouée « de tête » à chaque fois. Ce chapitre fixe ce que le script devra faire ; le bloc C du chapitre 8 est donc **provisoire**.

### Quand
- quand tu le demandes (« rapatrie les fiches de l'appli ») ;
- **avant chaque bordereau** ;
- **quand un chantier passe à « Terminé »**, et de nouveau **avant de demander la purge** de Drive (lot 5).

Pas à chaque intervention : `gestion-documentaire` s'applique dès qu'un fichier est lu ou produit, le rapatriement tournerait sans arrêt.

### Ce que fait le skill

1. **Trouver le dossier Drive du chantier** dans l'onglet *Dossiers chantiers* : colonne A « Chantier » (comparée au nom dans l'appli sans tenir compte des majuscules ni des espaces de début et de fin), colonne B « Dossier Drive » (son nom sous la racine).
   - Chantier absent : aucune fiche n'a encore été rangée pour lui, rien à faire.
   - **Plusieurs lignes** pour ce chantier, colonne E « À vérifier » qui commence par « OUI », ou dossier B introuvable sous la racine : le skill **s'arrête** et te le dit (l'appli n'était pas sûre de ce dossier).
2. **Lire `dossiers.json`** (chapitre 7) pour connaître les sous-dossiers. **Une clé absente du fichier prend la valeur du tableau ci-dessous** (c'est aussi ce que fait l'appli).

   | Clé | Fiche de l'appli | Sous-dossier (le même dans Drive et dans MEGA) |
   |---|---|---|
   | `cotes` | Prise de cotes | `05 - CHANTIER/PRISE DE COTES` |
   | `fabrication` | Fiche de fabrication | `07 - ATELIER` |
   | `note` | Note de réunion | `05 - CHANTIER/COMPTE RENDU` |
   | `quitus`, `attestation`, `reception-support` | Quitus, attestation, réception de support | `05 - CHANTIER/OPR - RESERVES - QUITUS` |
   | `bordereau-orga` | Bordereau d'organigramme | `05 - CHANTIER/ORGANIGRAMME` |
   | `bordereau-materiaux` | Bordereau de matériaux | `05 - CHANTIER/BORDEREAUX MATERIAUX` |
   | `photos` | Photos | `05 - CHANTIER/PHOTOS CHANTIER` |
   | `signalement` | Signalements (lot 7) | `05 - CHANTIER/SIGNALEMENTS` |

   Les clés `carnet` et `plans` ne sont **pas** rapatriées : ce sont des copies de documents déjà dans MEGA.
3. **Copier dans MEGA, au même chemin**, tout fichier qui n'y est pas déjà :
   - **copier, jamais déplacer** : rien n'est supprimé ni modifié dans Drive (la purge de Drive est le travail de l'appli, au lot 5, et tu la valides toi-même) ;
   - **jamais écraser** (`cp -n`) : un fichier de même nom déjà dans MEGA est laissé tel quel ; s'il n'a pas la même taille, le skill le signale sans y toucher ;
   - **jamais renommer** ;
   - **créer le sous-dossier s'il manque dans MEGA** (`SIGNALEMENTS` et `BORDEREAUX MATERIAUX` sont nouveaux) : seule exception à « ne pas créer de nouveau dossier » ;
   - vérifier la taille après chaque copie ;
   - par paquets (une commande ne dure pas plus de 3 minutes sur ton PC) ; un fichier Drive « en ligne seulement » (pas encore téléchargé sur le PC) se télécharge à la copie : si cela échoue, le signaler et continuer ;
   - deux fichiers de même nom dans Drive apparaissent sur le PC comme `nom.pdf` et `nom (1).pdf` : les deux sont copiés tels quels, et signalés.
4. **Signaler, sans les copier**, les fichiers du dossier Drive du chantier qui sont **hors** de ces sous-dossiers (un dossier `Divers`, un ancien dossier), ainsi que le contenu du dossier `_À CLASSER` de la racine : ils n'iront pas dans MEGA tant que tu ne les as pas rangés.
5. **Tracer** : **une** ligne par rapatriement au JOURNAL du registre (action « rapatrié de l'appli », nombre de fichiers, dossiers), et le détail dans le compte rendu.
6. **Écrire le relevé `mega-index.json`** (ci-dessous).

**Ne sont pas rapatriées** : les demandes d'absence (`ADMINISTRATIF/ABSENCES`, hors chantier).

### Trois règles du skill à protéger (sinon il abîmerait ces fichiers)
Les fiches de l'appli se nomment `<INTITULÉ> <nom court, sinon nom du chantier> [complément] <AAAA-MM-JJ>[_Vn].pdf` : la même forme que les documents de `gestion-documentaire`. Sans précaution, ses outils les prendraient pour ses propres documents.
- **« Une seule version active »** : deux quitus ou deux signalements ne sont **pas** deux versions du même document, même s'ils ne diffèrent que par la date ou par `_V2` (l'appli ajoute `_V2` à une **autre** fiche du même jour, pas à une nouvelle version). Ces fichiers ne sont jamais candidats « même document », jamais archivés dans `0-OLD`.
- **Comment les reconnaître** : par leur **provenance**, pas par leur nom. Est une fiche de l'appli tout fichier listé dans `mega-index.json` (donc copié par le rapatriement). Les fiches les plus anciennes ont d'autres noms (`Note_…`, `Cotes_…`, `Quitus_…`) : un tri par le début du nom les manquerait.
- **Veille des comptes rendus** : les notes de réunion de l'appli arrivent dans `05 - CHANTIER/COMPTE RENDU`, à côté des CR de la maîtrise d'œuvre. La veille doit les ignorer.
- **« Jamais écraser »** : `mega-index.json` et `intervenants.json` sont les deux seuls fichiers qu'un skill remplace en entier.

Le bloc C contient les lignes à ajouter aux paragraphes concernés. **Les scripts `gestiondoc.py` et `veille_cr.py` devront aussi apprendre cette exception** : je te donnerai la modification avec `rapatrier.py`.

### Le relevé `mega-index.json`

**À quoi il sert** : au lot 5, avant de proposer la purge d'un chantier, l'appli vérifiera que chaque fichier de Drive a bien été copié. Elle n'a pas accès à MEGA : elle lira ce relevé et comparera **le nom et la taille**.

- **Où** : à la racine du dossier Drive du chantier. **Écrit par** : le script de rapatriement, à partir de la liste réelle des fichiers du disque (jamais rédigé de tête).
- **Contenu** : les fichiers présents dans le **dossier MEGA de ton PC** (`Z:`), pour les sous-dossiers du point 2.

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

- `chemin` : relatif au dossier du chantier, avec des `/`. `taille` : en octets (l'unité de poids d'un fichier). `releve_le` : heure de Paris. Aucun chemin complet du PC, aucun lien.
- **Limite à connaître** : le relevé prouve que le fichier est dans le dossier MEGA **du PC**, pas qu'il est monté dans le nuage MEGA. Si la synchronisation de MEGA est arrêtée, il ne le voit pas. Le lot 5 te demandera donc de vérifier l'icône de MEGA avant de cocher une purge.
- **Relevé absent ou de plus de 30 jours : l'appli ne proposera pas la purge.** Un relevé manquant ne fait donc jamais rien supprimer ; il faut seulement relancer un rapatriement avant de purger.

---

## 6. Règle 5 — Les cotes relevées sur le chantier, pour le métré des plinthes

### Ce que c'est, honnêtement
L'onglet *Prise de Cote* reçoit les **cotes de placards** relevées par les poseurs. Il ne contient **pas** de périmètres de pièces : il ne remplace pas le métré fait sur les plans. Il apporte deux informations mesurées sur place : la **hauteur de plinthe** et le **type de sol**, par logement et par pièce. C'est un **contrôle** de plus, d'un intérêt limité pour les plinthes (voir aussi la question 5 du chapitre 10).

### Les colonnes (une ligne par placard relevé)

**Se fier à la position des colonnes, pas aux titres de la ligne 1** : dans le vrai onglet, les titres sont anciens et décalés.

| Col. | Contenu | Utile au métré ? |
|---|---|---|
| A | Référence de la fiche | pour citer la source |
| B | Chantier (le nom dans l'appli) | **filtre** |
| C | Bâtiment | oui |
| D | Auteur du relevé | pour citer la source |
| E | Date du relevé | pour citer la source |
| F | N° du logement | oui |
| G | Pièce | oui |
| H à M | Cotes du placard (hauteur et largeur de façade, largeur entre plinthes, longueur et profondeur de l'aménagement, côté de la penderie) | non |
| N | **Hauteur de plinthe (mm)** | **oui** |
| O | **Sol** | **oui** |
| P | Socle | non |
| Q | Commentaires | à lire : une remarque peut concerner les plinthes |
| R | Reçu le (heure du serveur) | non |

Les lignes les plus anciennes (avant la refonte de l'appli) peuvent ne pas suivre cette disposition : une ligne dont la colonne B n'est pas un nom de chantier connu est ignorée.

### Ce que fait `metre-plinthes`

Sur un chantier **en cours**, pendant sa phase d'analyse (pas au chiffrage : aucun relevé n'existe) :

1. Trouver le nom du chantier dans l'appli : onglet *Chantiers*, ligne dont la colonne E est le n° du chantier, colonne A. Puis lire les lignes de *Prise de Cote* dont la colonne B est ce nom (sans tenir compte des majuscules ni des espaces de début et de fin). Aucune ligne : l'écrire (« aucune prise de cotes dans l'appli pour ce chantier ») et continuer.
2. S'en servir **comme d'un contrôle, jamais comme d'une donnée de calcul** :
   - hauteur de plinthe relevée ≠ hauteur du CCTP ou du devis → ligne « A VERIFIER » et question à Franck ;
   - sol relevé dans une pièce ≠ sol prévu au CCTP pour ce type de pièce → même traitement.
3. **Ne rien appliquer en silence** : la hiérarchie devis > CCTP > plans ne change pas.
4. Citer la source : « prise de cotes du JJ/MM/AAAA par X, fiche n° … ».

Les valeurs sont celles tapées sur le téléphone : une case peut être vide ou contenir du texte libre (« 70 », « 7 cm », « sans »). Une valeur illisible est ignorée et signalée, jamais interprétée au hasard.

---

## 7. Les noms de dossiers : `dossiers.json`

- **Où** : à la racine du Drive de l'appli.
- **Qui le modifie** : toi seul, à la main, si tu renommes un dossier. L'appli le relit au bout de 10 minutes. **Aucun skill ne l'écrit.**
- **Qui le lit** : l'appli, puis `depot_carnet.py` et le script de rapatriement.

```json
{
  "version": 1,
  "documents":     { "<clé>": "<sous-dossier dans le dossier du chantier>" },
  "hors_chantier": { "<clé>": "<sous-dossier à la racine du Drive de l'appli>" },
  "intitules":     { "<clé>": "<début du nom des fichiers>" }
}
```

- Séparateur des chemins : `/`.
- **Le fichier peut être incomplet** : l'appli ne l'écrit qu'une fois, à sa création. Une clé ajoutée par un lot plus récent (par exemple `signalement`, lot 7) n'y figure pas forcément : dans ce cas l'appli, et les scripts, prennent la valeur par défaut (tableau du chapitre 5). **Le fichier l'emporte quand la clé y est ; sinon, la valeur par défaut.**
- Fichier absent ou illisible : le script ne rapatrie rien et te le dit.

---

## 8. Textes prêts à coller dans tes skills

> Je ne modifie pas tes skills. **Aujourd'hui : blocs A et B seulement** (lecture seule). Le bloc C est donné pour information : il sera repris, avec ses scripts, au lot 4.

### Bloc A — dans `gestion-documentaire`

**A.1 — À la fin du § 3 bis (FICHE INFO), ajouter :**

```
### Lien avec l'appli ChantierPro — LECTURE SEULE (contrat docs/contrat-skills.md du dépôt chantier-pro, règle 1)

Accès : connecteur Google Sheets. L'identifiant ET le titre exact du classeur sont dans le doc du projet
`claude/CHANTIERPRO - acces.md`. Avant toute lecture : si le titre du classeur ouvert n'est pas exactement
celui noté, ou s'il contient « TEST », s'arrêter et le dire à Franck.
Ne JAMAIS écrire dans ce classeur. N'y lire que les onglets « Chantiers », « Intervenants »,
« Dossiers chantiers » et « Prise de Cote » (jamais « Utilisateurs », « Accès chantiers », « Sans compte »,
« Envois », « Contacts »).
Connecteur absent, onglet introuvable, colonnes inattendues : ne rien deviner, continuer avec la FICHE INFO
et le signaler en une ligne.

Onglet « Chantiers » (référence pour l'identité — exception voulue à « FICHE INFO source unique », pour
l'identité seulement). Colonnes : A NOM (nom dans l'appli), B REFERENCE, C STATUT, D Conducteur, E N°,
F Nom court, G Adresse, H Client, I Architecte, J Date « Terminé », K Chemin MEGA.
TANT QUE FRANCK N'A PAS TRANCHÉ UN ÉCART, les noms de fichiers, bordereaux et courriers continuent d'utiliser
la FICHE INFO : le Sheet ne sert qu'à comparer.
1. Trouver la ligne par E = n° du dossier MEGA (comparé comme du texte) ; à défaut par F = nom court.
   Aucune ou plusieurs lignes : continuer avec la fiche seule et le dire à Franck.
2. Retenir A (« nom dans l'appli ») pour la durée du travail ; le relire dans le Sheet quand on en a besoin.
3. Création d'une FICHE INFO : n°, nom court et adresse viennent d'abord du Sheet
   (source « Sheet ChantierPro, lu le JJ/MM/AAAA ») ; adresse en une case dans le Sheet, deux rubriques dans
   la fiche : découpage douteux → case jaune, jamais au hasard. H et I servent à contrôler les lignes MOA et
   ARCHI. Un écart vu à la création devient une ligne À VÉRIFIER, comme toute question de création.
4. FICHE INFO existante : COMPARER ET SIGNALER DANS LE COMPTE RENDU DE LA CONVERSATION. Ne rien écrire,
   ni dans le Sheet, ni dans la fiche (pas de ligne À VÉRIFIER ajoutée). Seulement à la première intervention
   sur le chantier, à l'état documentaire et avant un bordereau.
   E ↔ n° chantier ; F ↔ nom court ; G ↔ « adresse du chantier » + « code postal + ville » bout à bout ;
   H ↔ société de la ligne MOA ; I ↔ société de l'une des lignes d'architecte.
   Comparaison sans majuscules, sans accents, espaces et ponctuation réduits.
   - case vide dans le Sheet : pas un écart ; dire à Franck de la compléter dans l'onglet Chantiers ;
   - écart réel : « Sheet : … / fiche : … » + question à Franck. C'est Franck qui corrige à la main celui
     des deux qui a tort ;
   - D (conducteur) ↔ conducteur de travaux, sur le nom de famille : POUR INFORMATION, sans question.
     L'expéditeur des bordereaux (fiche) et le conducteur de l'appli (Sheet) peuvent différer exprès.
```

**A.2 — Dans la table « 1 bis. Où les compétences métier lisent leurs entrées », remplacer la dernière ligne (« Infos du chantier : nom, adresse, lots, intervenants… ») par ces deux lignes :**

```
| Identité du chantier : n°, nom court, adresse, client, architecte, conducteur, nom dans l'appli | onglet « Chantiers » du Sheet ChantierPro (connecteur Sheets, lecture seule — §3 bis, lien avec l'appli) ; la FICHE INFO en est la copie | le Sheet est la référence ; tout écart avec la fiche est signalé à Franck, jamais corrigé en silence |
| Autres infos du chantier : lots, intervenants (société, interlocuteur, tél, mail), Loué, lien MEGA, documents déjà envoyés — **et l'identité elle-même tant qu'un écart avec le Sheet n'est pas tranché par Franck** (noms de fichiers, bordereaux, courriers) | `00 - FICHE INFO <NOM COURT>.xlsx` à la racine (§3 bis) ; ancien emplacement : feuille FICHE CHANTIER du registre | relire à chaque usage (Franck la corrige à la main) ; si elle n'existe pas, la créer d'abord (§3 bis) |
```

### Bloc B — dans `metre-plinthes`, à la fin du § 0.2 (lecture du CCTP)

```
### 0.2 bis Cotes relevées sur le chantier (appli ChantierPro) — contrat docs/contrat-skills.md, règle 5

Seulement sur un chantier en cours. LECTURE SEULE du Sheet ChantierPro par le connecteur Google Sheets :
ne JAMAIS y écrire ; identifiant et titre exact du classeur dans `claude/CHANTIERPRO - acces.md` (titre
différent, ou contenant « TEST » : s'arrêter) ; ne lire que les onglets « Chantiers » et « Prise de Cote ».
1. Nom du chantier dans l'appli : onglet « Chantiers », ligne dont la colonne E = n° du chantier, colonne A.
2. Onglet « Prise de Cote » : lignes dont la colonne B = ce nom (sans majuscules ni espaces de bord).
   Se fier à la POSITION des colonnes, pas aux titres : C bâtiment, F n° de logement, G pièce,
   N hauteur de plinthe (mm), O sol, Q commentaires ; A référence, D auteur, E date pour citer la source.
- C'est un CONTRÔLE, jamais une donnée de calcul : hauteur de plinthe ou sol relevés différents du CCTP /
  devis → ligne « A VERIFIER » + question à Franck. La hiérarchie devis > CCTP > plans ne change pas.
- Valeur vide ou illisible : ignorée et signalée, jamais interprétée.
- Aucune ligne pour ce chantier, ou accès impossible : l'écrire en une ligne et continuer.
- Citer la source dans le bilan (« prise de cotes du JJ/MM/AAAA par X, fiche n° … »).
```

### Bloc C — PROVISOIRE, à ne pas coller avant le lot 4 (dossier Drive connecté, scripts fournis)

Dans `gestion-documentaire` :

**C.1 — § 0, principe 3 (« Ne jamais supprimer, jamais écraser »), ajouter :**

```
   Seule exception : les fichiers `mega-index.json` et `intervenants.json` déposés à la racine du dossier
   Drive d'un chantier de l'appli ChantierPro (§1 ter) sont remplacés en entier à chaque écriture.
```

**C.2 — § 6 (« Ce qu'on ne touche pas »), ajouter :**

```
- **Fiches de l'appli ChantierPro** rapatriées de Drive (§1 ter) : tout fichier listé dans le `mega-index.json`
  du chantier (PDF et photos). On les reconnaît par cette liste, pas par leur nom (les plus anciennes
  s'appellent `Note_…`, `Cotes_…`, `Quitus_…`). Ce sont des documents reçus : jamais renommés, jamais candidats
  « même document » (§4.1), jamais archivés dans 0-OLD, même si deux d'entre eux ne diffèrent que par la date
  ou par `_Vn` (pour l'appli, `_V2` est une AUTRE fiche du même jour, pas une nouvelle version).
```

**C.3 — § 3 ter (veille des comptes rendus), ajouter à « Où sont les CR » :**

```
Les fichiers de `05 - CHANTIER/COMPTE RENDU` listés dans le `mega-index.json` du chantier viennent de l'appli
ChantierPro (notes de réunion internes, notes de chantier) : la veille les ignore.
```

**C.4 — Table de routage du § 1, une ligne de plus, et nouveau § 1 ter :**

```
| Fiches produites par l'appli ChantierPro (PDF et photos) | le même sous-dossier que dans le Drive de l'appli (`dossiers.json`), créé s'il manque — documents reçus (§1 ter, §6) |
```

```
### 1 ter. Appli ChantierPro : rapatrier les fiches (Drive → MEGA) et déposer les intervenants
(contrat docs/contrat-skills.md, règles 2 et 4 — à faire avec les scripts `rapatrier.py` et `intervenants.py`)

Accès : dossier Drive de l'appli connecté (chemin et nom exact de la racine dans `claude/CHANTIERPRO - acces.md` ;
si le nom de la racine diffère, s'arrêter). Pas connecté : ne rien faire et le dire.
Quand rapatrier : sur demande de Franck, avant chaque bordereau, au passage du chantier à « Terminé »
et avant une purge. Pas à chaque intervention.
Journal du registre : action « rapatrié de l'appli », UNE ligne par rapatriement (nombre de fichiers, dossiers).
Le script copie sans déplacer ni écraser, vérifie les tailles, signale les fichiers hors des sous-dossiers connus,
puis écrit `mega-index.json` à la racine du dossier Drive du chantier.
Intervenants : quand la liste de la FICHE INFO a changé, écrire `intervenants.json` à la racine du dossier
Drive du chantier (jamais si la liste est vide) et lister à Franck les adresses nouvelles.
```

---

## 9. Ce que tu dois faire, et comment vérifier

### À faire maintenant (30 minutes environ, quand tu veux)

1. **Créer le document privé** `claude/CHANTIERPRO - acces.md` dans le projet LOUE TRAVAIL, avec :
   - l'identifiant du vrai Sheet (la suite de lettres et de chiffres entre `/d/` et `/edit` dans son adresse) ;
   - le **titre exact** du classeur, tel qu'il s'affiche en haut de la page.

   Ne mets ces informations **nulle part ailleurs**, et surtout pas dans le dépôt GitHub.
2. **Compléter la colonne E (N°)** de l'onglet *Chantiers* pour les chantiers en cours. Sans le N°, le skill ne retrouve pas la ligne. **Attention à la colonne F (Nom court)** : dès qu'elle est remplie, l'appli met ce nom court, à la place du nom du chantier, dans le nom des PDF qu'elle range. C'est voulu, mais sur un chantier déjà commencé les nouveaux PDF ne porteront plus le même nom que les anciens : remplis-la plutôt au démarrage d'un chantier.
3. **Coller les blocs A.1, A.2 et B** dans tes skills.

### Vérifier (sur un seul chantier ; rien n'est écrit dans le Sheet)

Fais ces essais à un moment où aucun poseur n'envoie de fiche (le soir), et de préférence sur un chantier d'essai : une adresse modifiée dans le Sheet est visible tout de suite dans l'appli des poseurs.

| # | Essai | Attendu |
|---|---|---|
| 1 | Dans une conversation du projet LOUE TRAVAIL : « lis l'onglet Chantiers du Sheet ChantierPro et dis-moi ce que tu trouves pour le chantier NNN » | Claude cite la ligne (nom, adresse, conducteur). S'il dit qu'il n'a pas le connecteur Google Sheets : active-le dans les réglages de Claude, relié au **compte Google de Loué**, puis recommence. |
| 2 | « Fais l'état documentaire du NNN » | Le compte rendu dit ce qui a été lu dans le Sheet et liste les écarts avec la FICHE INFO. **Ouvre l'historique des versions du Sheet** (Fichier → Historique des versions) et clique sur la version de l'heure de l'essai : les cases modifiées y sont surlignées. Des lignes ajoutées dans *Envois*, *Prise de Cote* ou *Signalements* viennent de l'appli (une fiche de poseur), pas de Claude. Aucune autre case ne doit avoir changé. |
| 3 | Change exprès une lettre de l'adresse dans le Sheet, puis redemande l'état documentaire | L'écart t'est signalé dans la conversation ; ni le Sheet ni la fiche n'ont été modifiés par Claude (la date de modification de la FICHE INFO n'a pas bougé). Remets l'adresse. |

Si l'essai 2 montre une case modifiée par Claude : retire le bloc A, **corrige cette case à la main** d'après l'ancienne valeur montrée par l'historique, et dis-le-moi. **Ne clique jamais sur « Restaurer cette version »** : cela effacerait tout ce que l'appli a écrit depuis (fiches, comptes, signalements).

---

## 10. Cinq questions pour toi (aucune n'est urgente)

1. **Intervenants** : d'accord pour le fichier `intervenants.json` recopié par l'appli (solution B), au lieu d'un skill qui écrit dans le vrai Sheet ? Conséquence : l'onglet *Intervenants* se remplit au lot 8, pas avant.
2. **Dossier Drive à connecter à Claude** (lot 4) : d'accord pour connecter **toute la racine** du Drive de l'appli, y compris le dossier des demandes d'absence ? Sinon il faudra une autre organisation (les dossiers des chantiers sont directement sous cette racine : les connecter un par un, ou déplacer le dossier des absences ailleurs), à étudier au lot 4.
3. **Carnet, quand déposer** : `PLAN.md` disait « automatiquement, à la fin de chaque skill ». Je propose plutôt **seulement une version que tu as validée** (au moment du bordereau, ou sur ta demande), pour qu'un poseur ne pose jamais d'après un brouillon. Ton choix ?
4. **Carnet, quels documents** : faut-il y mettre aussi les plans de repérage des portes (104) et le plan de pose des huisseries (107) ? Ils ne sont pas dans ta liste de `docs/skills.md`.
5. **Cotes de placards** : les vrais clients de l'onglet *Prise de Cote* seraient plutôt tes skills `placards-commande-sogal` et `placards-amenagements`. Veux-tu que j'ajoute une règle pour eux dans un prochain lot ?

---

## 11. Limites, et ce que la relecture a fait changer

### Limites (dites franchement)
- **Ce contrat n'a pas été essayé avec un vrai skill.** Je n'ai accès ni à tes skills en fonctionnement ni au vrai Sheet. Les trois essais du chapitre 9 sont la vraie validation.
- **« Lecture seule » est une consigne, pas un verrou** (chapitre 1). L'essai 2 vérifie qu'elle est respectée.
- **Règles 2, 3 et 4** : elles dépendent du dossier Drive connecté à Claude, jamais essayé, et de scripts qui restent à écrire et à tester (lot 4). Le bloc C n'est qu'une esquisse.
- **`mega-index.json`** ne prouve que la présence sur le PC (chapitre 5).
- **Gratuité** : rien de nouveau à payer ni à installer, tant que le connecteur Google Sheets reste compris dans ton abonnement Claude actuel.

### Ce que la 2e relecture a fait changer (12/11/2026)
- **Plus aucune écriture dans une FICHE INFO existante** : un écart est signalé dans la conversation (la version 2 faisait encore ajouter une ligne À VÉRIFIER, sans commande pour le faire).
- **Tant qu'un écart n'est pas tranché, les skills continuent d'utiliser la FICHE INFO** pour nommer les fichiers (sinon deux « noms courts » auraient donné deux versions actives du même document).
- **Conducteur** : simple information (l'expéditeur des bordereaux et le conducteur de l'appli peuvent différer exprès).
- **Ne jamais « restaurer une version » du vrai Sheet** : la version 2 le conseillait en cas de problème ; cela aurait effacé les fiches reçues depuis.
- **Colonne F (Nom court)** : la remplir change le nom des PDF de l'appli ; c'est dit.
- **Fiches de l'appli reconnues par leur provenance** (le relevé), pas par leur nom, et protégées aussi quand elles ne diffèrent que par `_V2`.
- Portée réelle du connecteur et partages par lien des dossiers `Plans` écrits exactement.

### Ce que la 1re relecture a fait changer (12/11/2026)
- **Plus aucune écriture d'un skill dans le vrai Sheet.** La première version faisait réécrire l'onglet *Intervenants* par un skill, d'après une consigne en prose, sans essai possible avant le vrai Sheet : un tri de l'onglet ou une ligne vide pouvait écraser les lignes d'un autre chantier.
- **Règle 1 ramenée à « lire, comparer, signaler ».** La première version faisait écrire dans la FICHE INFO des rubriques qui n'y existent pas, avec un script qui n'a pas de commande pour cela, et sa règle d'écart ne se résolvait jamais.
- **`dossiers.json` peut être incomplet** : valeurs par défaut pour les clés absentes (sinon les signalements n'auraient jamais été rapatriés).
- **Trois règles du skill protégées** (version unique, veille des CR, « jamais écraser »), que le rapatriement aurait heurtées.
- **Rapatriement** : plus « à chaque intervention » ; dossiers douteux refusés ; fichiers hors rangement signalés ; un script testé au lieu d'une consigne.
- **Contrôle du bon classeur** par son titre exact ; onglets interdits de lecture ; portée réelle des accès écrite noir sur blanc.
- **Numéros de nomenclature** de l'organigramme (151) et de la signalétique (152) corrigés.
