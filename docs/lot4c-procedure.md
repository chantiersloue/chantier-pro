# Lot 4c — Le programme du PC : recopie automatique des fiches de l'appli, dépôt automatique au carnet — procédure

> Plan : `docs/lot4c-plan.md` (version 2, chapitres 10 et 11), avec deux décisions de Franck du 14/11/2026 : **la recopie des fiches est automatique**, et **MEGA n'est que la sauvegarde** des dossiers de chantier du PC. Contrat avec les skills : `docs/contrat-skills.md` (version 5).
> **Statut : construit et testé sur de faux dossiers ; jamais lancé sur de vraies données ; aucune tâche planifiée n'a été créée, par personne.** Rien n'est à déployer sur le serveur ni sur GitHub Pages : ce lot ne touche ni au serveur, ni aux pages de l'appli.

## Ce que le lot change, en bref

Tes skills travaillent dans les **dossiers de chantier de ton PC** (que MEGA synchronise : c'est ta sauvegarde). L'appli, elle, range ses fiches dans son **Drive**. Un programme sur ton PC fait le pont entre les deux :

1. **Les nouvelles fiches de l'appli arrivent toutes seules dans le bon dossier de chantier du PC.** Windows lance le programme toutes les heures et à l'ouverture de ta session, sans fenêtre et sans question. Les prises de cotes, quitus, notes, signalements, photos… sont recopiés au même endroit que dans l'appli (`05 - CHANTIER/PRISE DE COTES`, etc.). **Copie seulement : rien n'est jamais supprimé, déplacé, renommé ni écrasé.**
2. **Une fiche n'est copiée qu'une fois.** Si tu la déplaces, la renommes ou la supprimes dans le dossier du PC, elle ne revient pas : ton choix est respecté.
3. **Ce qui demande ton attention est écrit dans un fichier texte**, `CHANTIERPRO - A VOIR.txt`, dans le dossier qui contient tes dossiers de chantier. Il dit « Rien à signaler » quand tout va bien.
4. **Le carnet des poseurs se remplit tout seul** (ta décision du 16/11/2026), au même passage, sans aucune question :
   - tout PDF d'un **bordereau** (`08 - DOCUMENTS ENVOYES AVEC BORDEREAU/BORDEREAU n`) qui est un document du carnet y part, sans délai ;
   - tout PDF que tu glisses dans un dossier **`À METTRE AU CARNET`**, à la racine d'un dossier de chantier, y part aussi.
   Ce qui a été déposé, et ce qui n'a pas pu l'être, est écrit dans `CHANTIERPRO - A VOIR.txt`.

Le bon dossier de chantier est trouvé **par le numéro du chantier**, en tête du nom des dossiers (`403 - …`, `403-…`, `403 …`). Le programme ne devine jamais : s'il n'y a aucun dossier pour ce numéro, ou plusieurs, il ne copie rien pour ce chantier et l'écrit dans « A VOIR ». Un dossier du Drive qui n'est pas un dossier de chantier de l'appli (par exemple « 2024 - archives ») est laissé de côté.

Petit lexique : le **Planificateur de tâches** est l'outil de Windows qui lance un programme à heure fixe (il est déjà sur ton PC) ; une **tâche planifiée** est une ligne de cet outil ; un **fichier JSON** est un petit fichier de réglages en texte, avec des accolades et des guillemets.

## La mise en place, une seule fois

**L'ordre est décidé (toi, le 16/11/2026)** : d'abord coller les lignes dans `gestion-documentaire` et vérifier l'état documentaire sur **un** chantier (étapes 3 et 4) ; **ensuite seulement** installer la tâche automatique (étape 6).

| # | Étape | Durée |
|---|---|---|
| 1 | Créer le fichier de réglages `_prive\depot.json` | 5 min |
| 2 | Regarder ce que le programme ferait (« Voir seulement ») | 5 min |
| 3 | Valider et coller les lignes dans `gestion-documentaire` (avec Claude, projet LOUE TRAVAIL) | 20 à 30 min |
| 4 | Un premier passage à la main **sur un seul chantier**, puis les deux essais avec ton skill | 20 min |
| 5 | Les anciens numéros de documents (avec moi) — **avant** la tâche, parce que le carnet se remplit tout seul | 10 min |
| 6 | Double-clic sur `outils\installer-tache.bat` | 5 min |
| 7 | Créer le dossier `À METTRE AU CARNET` dans un chantier, quand tu en as besoin | 1 min |

Le programme ajoute **un** fichier à la racine de chaque dossier de chantier, `CHANTIERPRO - fiches rapatriees.json` (la liste des fiches venues de l'appli, que ton skill lit), et **un** fichier à côté de tes dossiers de chantier, `CHANTIERPRO - A VOIR.txt`. **Décidé par toi le 16/11/2026 : ces deux noms sont gardés.**

### Étape 1 — Créer `_prive\depot.json` (5 min)

Le dossier `_prive` n'est jamais envoyé sur GitHub : c'est le bon endroit pour les chemins de ton PC.

1. Ouvre le Bloc-notes de Windows.
2. Copie ce texte, **en remplaçant les deux chemins d'exemple par les tiens** :

   ```json
   {
     "racine": "D:/EXEMPLE/Mon Drive/DOSSIER DE L'APPLI",
     "chantiers_pc": "D:/EXEMPLE/CHANTIERS",
     "anciens_codes": {}
   }
   ```

   - `racine` : le dossier racine du Drive de l'appli sur ton PC (celui qui contient `dossiers.json` et les dossiers des chantiers), dans Google Drive pour ordinateur.
   - `chantiers_pc` : le dossier de ton PC qui contient tous tes dossiers de chantier (ceux qui s'appellent `NNN - NOM…`).
   - Écris les chemins avec des barres obliques `/` (pas `\`), entre guillemets droits `"`.
3. Enregistre sous `depot.json`, dans le dossier `_prive` du dépôt `chantier-pro` (Type : « Tous les fichiers », Encodage : « UTF-8 »).

Si le fichier existe déjà (lot 4a), ouvre-le et ajoute la ligne `chantiers_pc`.

### Étape 2 — « Voir seulement » (5 min)

Double-clique sur `outils\appli-pc.bat`, tape `2` puis Entrée. À la question « Numéro d'un seul chantier », appuie seulement sur Entrée (tous les chantiers). **Rien n'est écrit.** Tu lis :

- **« Chantiers reconnus »** : chaque chantier, avec son dossier du Drive et son dossier du PC. Vérifie que chaque ligne relie bien les deux bons dossiers.
- **« À voir »** : par exemple un dossier de l'appli qui n'a pas de numéro en tête de son nom, ou un numéro qui n'a pas de dossier sur le PC.
- sous « RECOPIE DES FICHES », pour chaque chantier, le nombre de fichiers « à copier » ;
- sous « CARNET : ce qui partirait tout seul », **chaque document qui serait déposé au carnet**, avec le chantier, le bordereau d'où il vient et le nom qu'il aura. Lis cette liste avec soin : après l'étape 6, plus personne ne confirme. En dessous, la liste des PDF des bordereaux qui ne partent pas (devis, dossiers techniques : c'est normal).

Si tu lis « REFUS », le message dit quel chemin est faux. (La première ligne du menu, « Le passage automatique… n'a encore jamais tourné… Il se met en place à l'étape 6 de la procédure, APRÈS les essais », est normale à ce stade : ne lance pas `installer-tache.bat` maintenant.)

**Un dossier de l'appli n'a pas de numéro en tête de son nom ?** Deux solutions : le renommer dans Drive (`NNN - NOM`), ou le relier à la main : choix `4` du menu (« Associer les chantiers »). Le programme affiche les dossiers du Drive encore libres ; tu tapes le numéro de la ligne, puis le nom du chantier dans l'appli. C'est noté dans `_prive\depot.json`. Attention : cette correspondance ne peut pas contredire un numéro. Si le dossier du Drive commence par `403` et que tu le relies au chantier 404, le programme ne copie rien pour lui et te le dit.

### Étape 3 — Les lignes à coller dans `gestion-documentaire` (20 à 30 min, avec Claude)

**À faire avant la première recopie.** Sans ces lignes, ton skill pourrait prendre les fiches de l'appli arrivées dans un dossier de chantier pour ses propres documents (les archiver, les compter comme des versions, les lire comme des comptes rendus).

1. **Garde d'abord une copie** du skill `gestion-documentaire` et du document du projet qui contient ses scripts (pour le retour arrière).
2. Ouvre une conversation du projet LOUE TRAVAIL.
3. Donne à Claude le chapitre 8 de `docs/contrat-skills.md` (blocs C et B ; le bloc A est facultatif) et demande-lui de te proposer le skill modifié, **paragraphe par paragraphe**, sans rien changer d'autre.
4. Relis et valide. Puis demande à Claude de te remettre **le skill complet modifié**, et mets-le à la place de l'ancien comme tu le fais d'habitude pour mettre à jour un skill. Je ne vois pas ton écran de Claude : si tu ne sais plus où cela se passe, demande-lui dans la même conversation « comment je remplace ce skill par la nouvelle version ? ».
5. Fais modifier de la même façon les scripts `gestiondoc.py` et `veille_cr.py` (bloc C.11 : ce qu'ils doivent apprendre y est décrit en clair), et mets à jour le document du projet qui les contient.

### Étape 4 — Un premier passage sur UN SEUL chantier, puis les essais avec ton skill (20 min)

Arrête-toi au premier essai qui ne donne pas le résultat attendu, et montre-moi l'écran.

| # | Essai | Comment | Attendu |
|---|---|---|---|
| A | **Sur la copie TEST et un faux dossier de chantiers** (avec moi, facultatif mais conseillé) | Je te donne un `depot.json` d'essai : la racine est le dossier `CHANTIERPRO-TEST`, « chantiers_pc » est un dossier vide créé pour l'essai. `appli-pc`, choix `1` | Les fiches du Drive TEST sont copiées dans le faux dossier ; dans le Drive TEST, seuls `releve-pc.json` (et le carnet, si tu as déposé un plan) ont changé |
| B | **Premier passage réel, sur un seul chantier** | Remets ton vrai `depot.json`. Choisis un chantier en cours qui a des fiches dans l'appli. D'abord `appli-pc`, choix `2`, avec **son numéro** : regarde ce qui serait copié **et ce qui partirait au carnet**. Puis choix `1` avec le même numéro. Aucune question n'est posée | L'écran dit « UN SEUL CHANTIER : le n° NNN ». Le bilan donne le nombre de fichiers copiés, les lignes « DÉPOSÉ AU CARNET » (les plans des bordereaux de ce chantier : ouvre l'appli, ils y sont quelques minutes après) et les points « à voir » de ce chantier. Dans son dossier : les fiches sont à leur place, et `CHANTIERPRO - fiches rapatriees.json` est à la racine. **Aucun autre dossier de chantier n'a été touché**, et « A VOIR » n'est pas écrit. Attends que MEGA ait fini de synchroniser |
| C | **État documentaire** (essai obligatoire) | Conversation LOUE TRAVAIL : « fais-moi l'état documentaire du NNN » (le chantier de l'essai B) | **Aucune fiche de l'appli** en « plusieurs versions actives », « même document à plusieurs endroits » ou « hors de son dossier ». Aucune n'a été déplacée ni renommée |
| D | **Veille des comptes rendus** (essai obligatoire) | Même chantier (il faut au moins une note de réunion de l'appli dans `05 - CHANTIER/COMPTE RENDU`) : demande la veille des CR | Aucune note de l'appli n'est comptée comme un compte rendu ; les CR de la maîtrise d'œuvre sont lus comme avant |

Si l'essai C ou D échoue : n'installe pas la tâche (étape 6). Un seul dossier de chantier a reçu des fichiers, et ils sont tous listés dans son `CHANTIERPRO - fiches rapatriees.json` (voir « Retour arrière »).

### Étape 5 — Les anciens numéros de documents (10 min, avec moi) — avant d'installer la tâche

**Pourquoi avant** : le carnet se remplit tout seul. Sur un chantier commencé avec l'ancienne numérotation, un ancien numéro peut être aussi un numéro d'aujourd'hui avec un autre sens ; sans la table de ce chantier, un ancien document pourrait partir au carnet sous un mauvais nom. Cette étape ne concerne que le carnet. Depuis ta décision de numérotation par métier, le PPSPS porte le n° 001, les réservations 105 et 106, etc. Les bordereaux plus anciens portent d'autres numéros. Le programme a besoin d'une table « ancien numéro → numéro actuel » pour les reconnaître.

- **Table générale** (`anciens_codes`) : seulement pour un ancien numéro qui n'existe **pas** dans la numérotation actuelle (par exemple un numéro suivi d'une lettre).
- **Table d'un chantier** : pour un chantier commencé avec l'ancienne numérotation, la table se met **dans la ligne de ce chantier**. Elle l'emporte sur la table générale. C'est indispensable, parce que certains anciens numéros existent toujours aujourd'hui avec un autre sens.

Exemple de forme (les numéros `041`, `042A`, `044` sont **inventés** : on mettra les tiens ensemble, d'après ta note de numérotation) :

```json
"chantiers": {
  "900": { "chantier": "EXEMPLE", "dossier_drive": "900 - EXEMPLE",
           "anciens_codes": { "042A": "105", "044": "103", "041": "102" } }
},
"anciens_codes": { "042A": "105" }
```

Un numéro converti vers un numéro qui n'est pas au carnet (ici `041` → `102`) est simplement laissé de côté, sans message. Tu peux aussi ajouter `"hors_carnet": ["101", "102"]` (une liste de numéros actuels qui ne vont pas au carnet) pour que le programme ne les signale plus comme « non reconnus ».

**Vérifier** : `appli-pc`, choix `2`. Sous « CARNET », chaque document qui partirait est bien un plan pour les poseurs, sous le bon numéro ; et la liste « PDF des bordereaux qui ne partent PAS au carnet » ne contient aucun plan pour les poseurs (sinon, son ancien numéro manque dans la table).

### Étape 6 — Installer le passage automatique : fiches et carnet (5 min)

**Ce que je n'ai pas pu essayer** : la création de cette tâche. Le programme la décrit à Windows dans un petit fichier (une seule tâche, deux déclenchements : toutes les heures, et à l'ouverture de **ta** session, désignée par son identifiant Windows ; sans droits d'administrateur ; elle tourne aussi sur batterie). Cette description est vérifiée par des tests, mais Windows ne l'a encore jamais reçue. Si Windows la refuse, la fenêtre te le dit et rien n'est cassé : montre-moi le message.

1. Double-clique sur **`outils\installer-tache.bat`**. Aucun droit d'administrateur n'est demandé. **À partir de là, les plans des bordereaux de tous tes chantiers partent au carnet tout seuls** : fais d'abord le choix `2` (« Voir seulement », tous les chantiers) et lis la liste.
2. La fenêtre dit « Tâche créée : « ChantierPro - recopie des fiches » ».
3. **Vérifier** : menu Démarrer, tape « Planificateur de tâches », ouvre-le, clique à gauche sur « Bibliothèque du Planificateur de tâches ». La ligne « ChantierPro - recopie des fiches » y est, avec l'heure de sa « Prochaine exécution ». Pour l'essayer tout de suite : clic droit sur la ligne, « Exécuter ». Aucune fenêtre ne s'ouvre, c'est normal. Une minute après : `appli-pc`, choix `3`. La première ligne dit « Dernier passage automatique réussi : le … » avec l'heure de maintenant, puis le contenu de « A VOIR ».

**Relance `installer-tache.bat`** (même double-clic, la tâche est refaite) :
- après une **mise à jour de Python** (la tâche garde le chemin exact de Python) ;
- après un **déplacement du dépôt** `chantier-pro` sur ton PC.

Si tu l'oublies, la recopie s'arrête sans bruit : c'est pour cela que le menu de `appli-pc` affiche une ligne « ATTENTION » quand le dernier passage réussi date de plus de 3 heures.

### Étape 7 — Le dossier `À METTRE AU CARNET` (1 min, quand tu en as besoin)

Pour mettre au carnet un document qui n'est pas dans un bordereau :

1. Dans le dossier du chantier sur ton PC (à sa racine, à côté de `05 - CHANTIER`), crée un dossier nommé exactement **`À METTRE AU CARNET`** (majuscules ou minuscules, peu importe). Le programme ne le crée jamais lui-même.
2. Glisses-y le PDF, nommé d'une de ces deux façons (exemples inventés, pour un chantier 900) :
   - forme courte : `105-A-PLANS DE RESERVATIONS.pdf` — numéro de document, indice, intitulé ; le chantier est celui du dossier ;
   - forme complète, celle des bordereaux : `900-10-105-A-PLANS DE RESERVATIONS.pdf` — le numéro du chantier doit être celui du dossier.
3. C'est tout. Au passage suivant (une heure au plus, ou tout de suite avec `appli-pc`, choix `1`), le document est au carnet, et la ligne est dans « A VOIR ». **Le PDF reste dans le dossier** : le programme ne supprime et ne déplace rien ; tu peux le laisser ou le ranger toi-même.

Les numéros de documents acceptés : 001, 002, 103 à 109, 151, 152, 205, 206. Un autre nom, un autre numéro : rien n'est déposé, et « A VOIR » te dit pourquoi.

## Ce qui se passe ensuite, sans toi

- **Toutes les heures** (et à l'ouverture de ta session), Windows lance le programme, sans fenêtre. S'il n'y a rien de nouveau, il n'écrit rien dans tes dossiers. Sinon il recopie les nouvelles fiches dans le bon dossier de chantier, **puis dépose au carnet** les PDF des bordereaux et de `À METTRE AU CARNET` qui n'y sont pas encore.
- **Où lire ce qui a été déposé** : dans `CHANTIERPRO - A VOIR.txt`, la section « Déposé au carnet ces sept derniers jours » (chantier, document, indice, nombre de pages, d'où il vient) ; et dans `_prive\appli-pc\auto.txt`, une ligne « DÉPOSÉ AU CARNET » par document.
- Un PDF qui vient d'arriver attend deux minutes sans bouger avant d'être déposé (le temps qu'il finisse de s'écrire). Un gros dépôt qui ne tient pas dans le passage reprend, page par page, au passage suivant.
- `CHANTIERPRO - A VOIR.txt` n'est réécrit que **si sa liste change**, et au moins une fois par jour. Sa date (« Mis à jour le … ») n'est donc pas l'heure du dernier passage : pour celle-là, `appli-pc`, choix `3`.
- Il garde une ligne par passage dans `_prive\appli-pc\auto.txt` (le détail seulement quand il a copié quelque chose). Ce journal ne grossit pas sans fin : au-delà d'une certaine taille, l'ancien est mis de côté (`auto-ancien.txt`) et un nouveau commence.
- Si un double-clic sur `appli-pc` est en cours au même moment, le passage automatique laisse sa place, l'écrit dans « A VOIR », et reviendra à l'heure suivante. **Ne laisse pas une fenêtre `appli-pc` ouverte sur une question** : tant qu'elle attend, la recopie automatique attend aussi (au bout de deux heures, elle reprend la main toute seule).
- Un passage manqué parce que le PC était éteint est rattrapé au rallumage.

### Les limites, dites clairement

- **La tâche ne tourne que si le PC est allumé et ta session ouverte.** PC éteint ou session fermée : les fiches attendent dans le Drive, et arrivent au premier passage suivant.
- **Google Drive pour ordinateur doit être démarré.** S'il ne l'est pas, rien n'est copié et « A VOIR » le dit, sans effacer les autres points ; le passage suivant réessaie. À l'ouverture de session, il peut arriver que la tâche parte avant que Drive soit prêt : c'est le même cas, rattrapé une heure après.
- **Une fiche arrive dans le dossier du PC au plus tard une heure après son arrivée dans le Drive** (pas à la seconde).
- **Une fiche nouvelle qui porte le nom d'une ancienne** (l'ancienne ayant été supprimée du Drive) est reconnue à sa taille : elle est copiée si la place est libre dans le dossier du PC ; sinon « A VOIR » le dit, tant que cela dure.
- **Une fiche supprimée ou déplacée par toi dans le dossier du PC ne revient pas.** « A VOIR » te le signale pendant sept jours (« fiche de l'appli absente du dossier du PC : déplacée ou supprimée ? »). Si c'était une erreur, recopie-la toi-même depuis le Drive.
- **Un chantier tout neuf**, sans aucune fiche ni carnet dans le Drive, n'est reconnu qu'à sa première fiche. Pour y déposer un plan avant : choix `4` du menu.
- Un passage est arrêté par Windows au bout d'**une heure** (une première recopie de milliers de photos peut donc se faire en plusieurs passages ; rien n'est abîmé, et ce qui est déjà copié est noté toutes les 25 copies : la suite reprend là où elle en était).
- **MEGA** synchronise ensuite le dossier comme d'habitude : le programme ne s'en occupe pas. Avant une purge du Drive (lot 5), il faudra vérifier que MEGA a fini de synchroniser ; et le relevé `releve-pc.json` devra avoir moins de 48 heures (la tâche le refait chaque jour).
- Un fichier du Drive « en ligne seulement » se télécharge pendant la copie ; si cela échoue, il est signalé et repris au passage suivant.

## Au quotidien

- **Rien à faire pour les fiches.** Jette un œil à `CHANTIERPRO - A VOIR.txt` de temps en temps (ou `appli-pc`, choix `3`).
- **Rien à faire non plus pour le carnet** : un plan mis dans un bordereau part au carnet dans l'heure. **Attention** : il part dès qu'il est dans le dossier `BORDEREAU n`, même si tu n'as pas encore envoyé le mail. Pour aller plus vite qu'une heure : `appli-pc`, choix `1`.
- **Un document hors bordereau** : glisse-le dans `À METTRE AU CARNET` (étape 7).
- **Un plan refait après son dépôt au carnet** : rien n'est jamais écrasé au carnet. Le plan refait part sous l'**indice suivant**, dans un nouveau bordereau (décidé par toi le 16/11/2026). Cas à connaître : un bordereau préparé, parti au carnet, puis corrigé **avant** l'envoi du mail : le document corrigé devra lui aussi prendre l'indice suivant (« A VOIR » te le dit).
- **Un document déposé par erreur** : `appli-pc`, choix `5` (« Retirer un document du carnet »). Il n'est plus montré aux poseurs ; aucun fichier n'est supprimé ; il n'est pas redéposé, même si son PDF reste dans le bordereau. Son indice reste pris.
- `outils\deposer.bat` (lot 4a) reste là, par exemple pour un PDF de plus de 200 Mo.

## Ce que dit « A VOIR », et quoi faire

| Ligne | Ce que ça veut dire | Quoi faire |
|---|---|---|
| « Rien à signaler. » | Tout va bien | Rien |
| « aucun dossier de chantier du PC ne commence par le numéro NNN » | L'appli a un chantier NNN, mais pas ton PC | Créer le dossier du chantier, ou corriger son numéro. Rien n'est copié en attendant |
| « plusieurs dossiers de chantier du PC commencent par le numéro NNN » | Le programme ne peut pas choisir | Renommer l'un des deux, ou les fusionner |
| « pas de numéro de chantier en tête de son nom » | Un dossier de l'appli sans numéro | Le renommer dans Drive (`NNN - NOM`), ou choix `4` du menu |
| « son nom commence par le numéro NNN, mais _prive/depot.json le relie au chantier n° MMM » | La correspondance écrite à la main contredit le nom du dossier | Corriger `_prive\depot.json` (ou le nom du dossier). Rien n'est copié en attendant |
| « déjà dans le dossier du PC sous le même nom, mais PAS de la même taille » (ou « PAS le même contenu ») | Deux fichiers différents portent le même nom | Rien n'est touché. Ouvre les deux et garde le bon |
| « fiche de l'appli absente du dossier du PC : déplacée ou supprimée ? » | Une fiche déjà copiée n'est plus à sa place | Rien si c'est voulu (la ligne disparaît au bout de sept jours). Sinon, recopie-la depuis le Drive |
| « hors des dossiers de fiches » | Un fichier du Drive qui n'est pas dans un dossier connu | Il ne sera pas recopié tant qu'il n'est pas rangé dans le Drive |
| « raccourci Google » | Un fichier `.gdoc`, `.gsheet`… : un simple lien, pas le document | Rien : il ne contient rien à archiver |
| « doublon fabriqué par Drive » | Un `nom (1).pdf` à côté de `nom.pdf` | Regarder dans Drive lequel garder |
| « copie impossible, à réessayer au prochain passage » | Un fichier n'a pas pu être lu | Rien : le passage suivant réessaie. Si la ligne revient toujours, montre-la-moi |
| « PASSAGE NON FAIT : la recopie des fiches n'a pas pu se faire… Google Drive pour ordinateur… » | Drive pour ordinateur n'était pas démarré | Le démarrer ; le passage suivant fera le travail |
| « PASSAGE NON FAIT : la recopie automatique a trouvé le programme déjà occupé » | Une fenêtre `appli-pc` était ouverte | La fermer, ou répondre à sa question |
| « nom non reconnu, pas déposé » | Un PDF de `À METTRE AU CARNET` dont le nom n'a aucune des deux formes | Le renommer (étape 7) |
| « n'est pas un document du carnet » | Un PDF de `À METTRE AU CARNET` dont le numéro n'est pas dans la liste | Vérifier le numéro ; un ancien numéro se déclare dans la table (étape 5) |
| « porte le n° de chantier NNN, pas MMM » | Un PDF rangé dans le dossier d'un autre chantier | Le mettre dans le bon dossier. Rien n'est déposé en attendant |
| « déjà au carnet sous cet indice, avec un AUTRE contenu… prends l'indice suivant » | Le PDF a été refait après son dépôt | Le renvoyer sous l'indice suivant |
| « existe en plusieurs exemplaires de contenus DIFFÉRENTS » | Le même document, deux fichiers différents (`À METTRE AU CARNET` et un bordereau) | Garder le bon ; rien n'est déposé en attendant |
| « fichier encore en cours d'écriture » | Le PDF bougeait encore | Rien : il part au passage suivant |
| « ce n'est pas un PDF lisible » / « plus que 200 Mo » | Fichier abîmé, ou trop gros | Refaire le PDF ; pour un très gros fichier, `outils\deposer.bat` |
| « Le dépôt au carnet ne peut pas se faire sur ce PC : un module de Python manque » | Après une mise à jour de Python, par exemple | Montre-moi la ligne : une commande à lancer une fois. La recopie des fiches continue |
| « N fichier(s) dans _À CLASSER » | Des fiches d'un chantier que l'appli ne connaît pas | Les ranger dans le Drive (comme avant ce lot) |

Dans le menu de `appli-pc`, une ligne **« ATTENTION : la recopie automatique des fiches n'a pas tourné depuis… »** veut dire qu'aucun passage n'a réussi depuis plus de 3 heures. Si le PC n'était pas éteint : relance `outils\installer-tache.bat`, et si la ligne revient, montre-moi `_prive\appli-pc\auto.txt`.

À l'écran (double-clic), deux autres messages : `REFUS : …` (rien n'a été écrit : un chemin faux, Drive arrêté, un numéro de chantier inconnu) et « Un autre traitement est déjà en cours » (un passage automatique tourne : réessaie dans une minute).

## Retour arrière

- **Arrêter la recopie automatique** : double-clic sur `outils\retirer-tache.bat`. La tâche est supprimée ; aucun fichier n'est touché. (Ou, dans le Planificateur de tâches : clic droit sur la ligne, « Désactiver » ou « Supprimer ».)
- **Le programme ne supprime rien et n'écrase rien** : une fois la tâche retirée, il ne se passe plus rien.
- **Dans les dossiers de chantier du PC** : les fichiers qu'il a copiés sont tous listés dans `CHANTIERPRO - fiches rapatriees.json`, à la racine de chaque dossier de chantier. Si tu veux les retirer, c'est toi qui les supprimes, d'après cette liste (les originaux sont toujours dans le Drive de l'appli). Garde cette liste tant que tu comptes relancer le programme : c'est elle qui lui évite de recopier ce que tu as supprimé. Tu peux supprimer `CHANTIERPRO - A VOIR.txt` : il sera refait.
- **Dans le Drive** : il n'a écrit que `releve-pc.json` (à la racine du dossier de chaque chantier ; tu peux le supprimer, il sera refait) et les documents du carnet (à retirer par le choix `5` : la liste de ce qu'il a déposé est dans « A VOIR » pendant sept jours, et dans `_prive\appli-pc\auto.txt`).
- **Dans le skill** : remets la copie de `gestion-documentaire` et de ses scripts gardée à l'étape 3.
- **Sur le PC** : `_prive\carnet-memoire.json` retient ce qui t'a déjà été signalé pour le carnet ; supprime-le pour que tout soit signalé de nouveau.

## Ce que je n'ai pas pu vérifier

- Le programme n'a tourné que sur de faux dossiers (73 tests automatiques : `python -m unittest tests/test_appli_pc.py`). Ni le vrai Drive, ni tes vrais dossiers de chantier, ni la copie TEST.
- **La création réelle de la tâche planifiée n'a été essayée par personne.** `installer-tache.bat` et `retirer-tache.bat` n'ont jamais été lancés. Les tests vérifient seulement que la description donnée à Windows est bien formée et porte les bonnes valeurs. À voir à l'étape 6 : que Windows l'accepte sans droits d'administrateur, avec son déclenchement à l'ouverture de ta session.
- Le lancement sans fenêtre (`pythonw.exe`) par le Planificateur de tâches.
- **Le dépôt automatique sur de vrais bordereaux** : la forme réelle de tous tes noms de fichiers, les anciens numéros, la durée d'un dépôt de grands plans dans un passage, et le délai de deux minutes sur un dossier que MEGA ou Drive est en train de synchroniser.
- Le double-clic sur `appli-pc.bat` dans une vraie fenêtre Windows au-delà de son menu (accents, saisie).
- Les lignes du chapitre 8 du contrat avec le vrai skill : essais C et D.
- La durée d'un passage sur un gros dossier de photos, et, la toute première fois, la comparaison du contenu des fichiers déjà présents des deux côtés (elle fait télécharger ces fichiers-là par Drive, une seule fois).
