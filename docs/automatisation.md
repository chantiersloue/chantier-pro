# Automatisation : ce que Claude peut faire seul pour les prochains lots

> Pour Franck. Étude faite le 12/11/2026, relue par un agent indépendant. **Rien n'est installé, rien n'a été touché** (ni la copie TEST, ni la production, ni GitHub).
> **État au 12/11/2026 : le lot 2 est en production.** Le lot suivant ne commence pas avant tes réponses aux six décisions de la fin de ce document.
> Ce document est public (dépôt GitHub) : il ne contient aucun identifiant secret.

## Les mots utilisés

| Mot | Sens |
|---|---|
| **Dépôt** | Le dossier du projet sur GitHub (`chantier-pro`) |
| **Branche** | Une copie de travail du dépôt. **`main`** est la branche publiée : ce qui y entre est publié quelques minutes plus tard, et chaque téléphone le prend à sa prochaine ouverture |
| **Pousser** | Envoyer une branche du PC vers GitHub |
| **API** | Une entrée prévue pour qu'un programme (et non une personne) utilise un service |
| **Déploiement** | La version du serveur Apps Script en service, avec son adresse |
| **Connecteur** | Un accès de Claude à un de tes services (Google Sheets, Gmail…), branché dans l'appli Claude |
| **Demande de fusion** (« pull request ») | La page GitHub où l'on valide l'arrivée d'une branche dans `main` |
| **Jeton** | Un fichier ou un code qui remplace ton mot de passe pour un programme. Qui a le jeton a les droits du jeton |
| **Déclencheur** | Un réglage Apps Script qui lance une fonction tout seul (toutes les 10 min, à chaque modification du Sheet…) |
| **▶** | Le bouton « Exécuter » de l'éditeur Apps Script |
| **PowerShell** | La fenêtre de commandes de Windows |
| **Garde-fou** | Une protection contre l'**erreur**. On peut la contourner si on le veut vraiment |
| **Mur** | Une protection **technique** : même en le voulant, le programme ne peut pas passer |

La différence entre garde-fou et mur est le fil de cette étude. Plus je travaille seul, plus elle compte.

**Une réserve vaut pour tout le document.** Quand j'écris « mur », c'est un mur **pour le chemin dont on parle** (le jeton clasp, la porte de service…). Il reste toujours un autre chemin : le navigateur de ton PC. S'il est connecté à Google et à GitHub, les outils qui me permettent de piloter un navigateur pourraient en théorie agir avec tes droits. Je ne le fais pas, et je m'interdis l'éditeur Apps Script (piste 2), mais c'est une règle, donc un garde-fou. Il ne deviendrait un mur que si je travaillais dans une session Windows où tu n'es connecté ni à Google ni à GitHub.

## En bref

Aujourd'hui, un lot te demande environ **2 h 30** : une vingtaine de clics dans Apps Script, 5 fonctions à lancer une par une, des nombres à me recopier, 2 à 4 demandes de fusion à créer et à fusionner, et une vingtaine d'essais à jouer.

Avec les quatre pistes, il te resterait **40 à 60 min par lot** :

| Ce qui te reste | Pourquoi c'est obligatoirement toi |
|---|---|
| Une connexion Google de 30 secondes à chaque envoi du serveur sur TEST (2 à 4 par lot), et un réglage du compte à activer puis désactiver | Seul le propriétaire du compte Google peut autoriser |
| Le serveur en production (copier-coller au lot 7, une commande ensuite) | C'est la production |
| Un clic ▶ dans Apps Script quand Google demande une nouvelle autorisation, et un clic ▶ en production | Même raison |
| 6 à 10 essais sur un vrai téléphone (20 à 25 min) | Mode avion réel, appareil photo, installation sur iPhone, écran de connexion, lisibilité au soleil. L'essai 12 du lot 2 l'a prouvé : un PC ne remplace pas le téléphone |
| Ton feu vert pour la production, puis 3 clics sur GitHub | Décision irréversible : elle reste à toi |
| Remplir les vraies données, voir les gars | Données réelles, personnes réelles |

**Ma recommandation** : les quatre pistes, dans leur version la plus simple, avec **un seul programme à installer (clasp) et aucun jeton GitHub** :

1. **Piste 1** : une fonction d'installation par lot, et sur TEST seulement une « porte de service » qui me laisse lancer les fonctions d'essai.
2. **Piste 3** : la copie d'essai sort du dépôt de production. Je la publie seul, ailleurs. Pour la production, je te prépare un lien qui ouvre la demande de fusion déjà remplie : il te reste 3 clics.
3. **Piste 2** : clasp sur TEST, avec un jeton qui ne reste sur le PC que le temps de l'envoi. Production au copier-coller pour le lot 7.
4. **Piste 4** : je joue les essais contre le vrai serveur TEST, en passant uniquement par la porte de service.

Six décisions t'attendent, regroupées à la fin.

**Ce que cette étude ne promet pas** : aucun essai automatique ne remplace le téléphone. Ils attrapent les erreurs de logique (mauvais message, fiche envoyée deux fois, droit mal vérifié), pas ce qui dépend de l'appareil.

---

## Piste 1 — Une seule fonction d'installation par lot

### Aujourd'hui
Au lot 2, tu lances 5 fonctions une par une, tu ajoutes une propriété à la main et tu me recopies un nombre. Puis tu recommences en production.

### Les solutions comparées

| | **A. Une fonction par lot, lancée par toi (recommandé)** | **B. La même, depuis un menu du Sheet** | **C. La même, lancée par moi par l'API de Google** |
|---|---|---|---|
| Ce que tu fais | 1 clic ▶, puis lire un bilan de 10 lignes | 1 clic dans un menu « ChantierPro » | Rien |
| Fonctionne ? | Oui | Oui sur PC ; pas de menu dans l'appli Sheets du téléphone | **Non** |
| Risque | Aucun nouveau | Menu visible par toute personne qui ouvre le Sheet | — |

**Pourquoi C est écartée** : Google écrit que son API d'exécution **ne peut pas créer de déclencheurs**, et presque chaque lot en installe. Elle demande en plus un projet « Google Cloud » à part (un outil de plus), dont le jeton expire tous les 7 jours en mode « test ».

### Ce que fera la fonction d'installation
- **Deux noms, un par environnement** : `installerLot7Test` et `installerLot7Production`. Chacune refuse de tourner dans le mauvais environnement. La première ligne du bilan affiche en clair l'environnement et le nom du Sheet.
- Elle enchaîne les étapes dans l'ordre et **s'arrête à la première erreur** (❌).
- Elle peut être **relancée sans danger** : une étape déjà faite est sautée.
- Elle règle elle-même les propriétés calculées (au lot 2, c'était `HACHAGE_ITERATIONS`) : plus rien à recopier.
- Elle reste sous la limite de 6 minutes. Une étape longue ou risquée (migration de données) reste une fonction à part, avec sa sauvegarde.
- **Le bilan** : sur TEST, je le lis moi-même (par la porte de service, ci-dessous). En production, **je ne lis jamais le vrai Sheet** : tu lis le bilan dans l'éditeur, et tu m'envoies une capture seulement s'il y a un ❌.

### Sur TEST seulement : une « porte de service »
Pour jouer les essais seul (piste 4), il me faut, sur TEST : lancer l'installation, lancer `traiterComptes` ou `finirTransitionMaintenant`, lire le résultat (dernières lignes de l'onglet *Envois*, état d'un compte d'essai, présence d'un PDF dans le dossier TEST), cocher une case d'un compte d'essai, ouvrir une session d'essai.

Je propose une action du serveur, `outilTest`, qui fait **uniquement** ces gestes-là.

| | **A. La porte n'existe que dans le serveur TEST (recommandé)** | **B. Même code partout, porte fermée par un réglage** |
|---|---|---|
| Comment | Un fichier à part, `OutilsTest.gs`, ajouté **seulement** au serveur envoyé sur TEST | Le code est aussi en production ; il se ferme si `ENVIRONNEMENT` ≠ `TEST` |
| En production | **Le code de la porte n'y est pas**, à condition que le bon fichier parte : la construction le vérifie (ci-dessous) | Un garde-fou : une propriété mal réglée ouvrirait la porte |
| Inconvénient | Le serveur TEST n'est plus **exactement** le fichier de production : un fichier en plus, et une ligne d'accroche inoffensive dans le code commun. C'est une entorse à la règle 1 de `PLAN.md`, que tu dois accepter (décision n° 1) | Aucune entorse, mais un outil d'administration à distance dans le code de production |

**Pour que la solution A tienne vraiment**, la fabrication suit ces règles :
- `OutilsTest.gs` est rangé hors du dossier `apps-script/` (qui, lui, part entier en production) ;
- le serveur TEST « avec porte » n'est **jamais écrit dans le dépôt** : la commande d'envoi l'assemble directement dans le dossier clasp. Il n'y a donc toujours qu'**un seul** `Code.gs` à coller, celui de production, et tu ne peux pas te tromper de fichier ;
- `outils/construire.js` refuse de fabriquer un `Code.gs` de production qui contiendrait la porte, et un test automatique le contrôle ;
- `verifierConfig` et l'installation de production affichent ❌ si la porte est présente hors de TEST ;
- **le dernier envoi sur TEST avant ton feu vert est le fichier de production exact, sans porte.** Tes essais sur téléphone se font sur ce fichier-là : ce qui part en production a donc tourné chez Google avant.

Dans les deux cas (A ou B), les règles de la porte elle-même sont :
- une **liste fermée** de gestes, écrite en toutes lettres dans le code (jamais « lance la fonction dont voici le nom ») ;
- une **clé** de 32 caractères au moins (`CLE_OUTILS_TEST`), rangée dans les Propriétés du script TEST et dans `_prive/ids-test.txt` ; clé absente ou trop courte = refus ; elle voyage dans le corps de l'appel, jamais dans l'adresse ;
- refus si le Sheet ne s'appelle pas « … TEST … » ;
- les gestes n'agissent que sur des données d'essai (comptes `auto…`, chantier « CHANTIER TEST AUTO ») ;
- **la session d'essai** : la porte fabrique une session courte (1 h) pour un compte `auto…`, que mon script de test pose dans le navigateur piloté. Aucun mot de passe n'existe ni ne circule. C'est une façon de sauter l'écran de connexion sur TEST : elle fait partie de la décision n° 1. Si tu la refuses, je ne peux jouer que les parcours « sans compte » et les vérifications côté serveur ;
- `verifierConfig` affiche un ❌ si la production contient la clé ou `ENVIRONNEMENT = TEST` ;
- un test automatique vérifie « production + bonne clé = refusé ».

**À savoir** : l'adresse du serveur TEST est publique (elle est dans `commun/config.js`). N'importe qui peut donc frapper à cette porte ; seule la clé l'ouvre. Ce qu'un intrus obtiendrait avec la clé : agir sur des données d'essai de la copie TEST. Rien en production.

**Un point à essayer avant de construire** : la documentation de Google ne dit pas noir sur blanc qu'un appel de l'appli peut créer ou retirer des déclencheurs. C'est très probable, pas certain. Un essai de 5 minutes sur TEST le dira. Si c'est non, l'installation sur TEST restera 1 clic ▶ pour toi, et le reste de la porte marche quand même.

### Bilan de la piste 1

| | |
|---|---|
| Tu n'auras plus à faire | 4 lancements sur 5, les propriétés à ajouter, les nombres à recopier, les captures du journal ; avec la porte : plus aucun lancement sur TEST |
| Ce qui reste à toi | 1 clic ▶ en production à chaque lot ; 1 clic ▶ sur TEST quand Google demande une nouvelle autorisation (je te préviens à l'avance) |
| Risques | Fonction d'installation : très faibles (arrêt à la première erreur, bilan ligne par ligne). Porte de service : une clé à garder secrète ; une entorse à « même code » (solution A) |
| Gratuit ? | Oui, rien de nouveau |
| À installer une fois | La propriété `CLE_OUTILS_TEST` sur TEST (2 min) |

---

## Piste 2 — clasp : envoyer et déployer le serveur depuis le PC

> **clasp** est le petit programme gratuit de Google qui envoie le code du serveur dans Apps Script depuis le PC. Le détail (installation, commandes, règles) est dans `docs/clasp.md`. Je ne répète ici que ce qui change.

### Le point de sécurité qui commande tout
`clasp login` pose un jeton sur le PC. **Ce jeton ouvre tous les projets Apps Script du compte Google, production comprise.** Google ne permet pas de le limiter à un projet.

Dans `docs/clasp.md`, c'est toi qui tapais les commandes : le jeton restait 2 minutes sur le PC. Si c'est moi qui les lance pendant une séance de travail autonome de plusieurs heures, le jeton reste là tout ce temps, à portée de n'importe quelle commande que je lance, et je lis pendant ce temps des pages et des fichiers dont je ne maîtrise pas le contenu. **Les vérifications que j'écris sont des garde-fous, pas un mur** : elles m'empêchent de me tromper de projet, pas d'envoyer en production si je le décidais. Je ne le ferai pas ; mais tu n'as pas à me croire sur parole, d'où le choix ci-dessous.

### Trois façons de tenir le jeton

| | **A. Jeton le temps d'un envoi (recommandé)** | **B. Jeton toute la séance** | **C. Copie TEST dans un second compte Google** |
|---|---|---|---|
| Ton geste | `clasp login` (30 s) **à chaque envoi** sur TEST : 2 à 4 fois par lot | `clasp login` une fois par séance | Une connexion, une seule fois, sur le second compte |
| Présence du jeton | 2 minutes : la commande d'envoi finit elle-même par `clasp logout` | Plusieurs heures | Permanente, mais ce jeton **n'ouvre pas la production** |
| Protection de la production | Garde-fous, exposition très courte | Garde-fous, exposition longue | **Mur** |
| Inconvénients | Je dois t'attendre pour chaque envoi : je regroupe donc les corrections | Le risque décrit plus haut | Un compte Google de plus à garder ; migration de TEST (1 h, une fois) ; risque de te tromper de compte dans le navigateur ; TEST et production ne partagent plus les mêmes quotas (c'est aussi un avantage) |

**Mon avis** : A pour commencer. Si attendre ta connexion ralentit trop le travail, passe à **C, pas à B**.

### Sur la copie TEST : ce que je ferai
Une seule commande, `node outils/envoyer-test.js` (à écrire), lancée juste après ton `clasp login` :
1. vérifie que le projet visé est bien celui de TEST (identifiant comparé à `_prive/ids-test.txt`) ; sinon elle refuse ;
2. sauvegarde le serveur en ligne dans `_prive/`, avec la date et l'heure ;
3. contrôle la liste des fichiers qui vont partir ;
4. envoie (`clasp push`, jamais `--force`) ;
5. met à jour le déploiement TEST (même adresse) ;
6. ouvre l'adresse TEST et vérifie que c'est bien **ce fichier-là** qui répond (règle 2 de CLAUDE.md). Le numéro de version ne suffit pas, puisqu'il ne change pas entre deux envois d'un même lot : le serveur renverra aussi l'empreinte de son code (une suite de caractères calculée à partir du fichier), comparée à celle du fichier envoyé. Si elle ne correspond pas : nouveau déploiement TEST, et je republie la copie d'essai avec la nouvelle adresse, sans toi ;
7. efface le jeton (`clasp logout`) et vérifie qu'il n'est plus là, **même si une étape a échoué**.

Deux précisions :
- Sur TEST, le serveur envoyé vient de ma branche de travail, pas de `main`. `docs/clasp.md` l'interdisait ; je propose de l'autoriser **pour TEST seulement**.
- Au début de chaque séance, je vérifie qu'aucun jeton n'est resté sur le PC (séance précédente interrompue). S'il y en a un, je l'efface et je te le dis.

### Sur la production
- **Lot 7** : copier-coller, comme aujourd'hui. clasp fait d'abord ses preuves sur TEST.
- **Ensuite**, si tu le décides après le lot 7 (décision n° 3) : une commande `node outils/envoyer-production.js`, **que tu lances toi-même** dans ta fenêtre PowerShell, après ton `clasp login`.

Ce que fait cette commande pour que tu saches ce qui part :
1. elle refuse si le dossier contient des modifications non enregistrées, ou si la version n'est pas exactement celle de la demande de fusion que tu as sous les yeux ;
2. elle affiche le projet visé, la version du serveur et l'**empreinte** du fichier (une suite de caractères calculée à partir du fichier : si un seul caractère change, l'empreinte change). La même empreinte est écrite dans la demande de fusion : tu compares les 6 premiers caractères ;
3. elle te demande de taper le mot `PRODUCTION` ;
4. elle sauvegarde, envoie, crée le nouveau déploiement, vérifie la version, affiche la nouvelle adresse, puis efface le jeton.

Soyons clairs : c'est **un bon garde-fou contre l'erreur, pas une preuve**. La commande est écrite par moi, et pendant ces deux minutes le jeton est sur le PC. Avec la solution C, mon travail courant sur TEST ne peut plus toucher la production par clasp ; l'envoi en production, lui, reste un garde-fou dans tous les cas.

Bénéfice : plus de copier-coller, plus d'adresse à m'envoyer (je la lis dans le résultat et je mets `commun/config.js` à jour).

### Ce que ça change pour la sécurité, en résumé

| Point | Aujourd'hui | Avec clasp (solution A) |
|---|---|---|
| Jeton sur le PC | Aucun | 2 minutes par envoi |
| Erreur possible | Coller dans le mauvais projet | Envoyer vers le mauvais projet : bloqué par la vérification de l'identifiant |
| Fiabilité de l'envoi | Collage à la main | Contrôles et sauvegarde automatiques avant chaque envoi |
| Réglage du compte | — | « API Google Apps Script » activée pendant le lot, **à désactiver entre deux lots** (2 gestes de toi par lot) |

Deux règles s'ajoutent à celles de `docs/clasp.md` :
- **je ne pilote jamais l'éditeur Apps Script par le navigateur**, ni sur TEST ni en production. Ce serait possible techniquement si tu es connecté à Google, mais ce serait agir avec tous tes droits, sans aucun contrôle ;
- clasp propose un mode expérimental « pour assistants » (`clasp mcp`) : je ne l'utilise pas.

### Bilan de la piste 2

| | |
|---|---|
| Tu n'auras plus à faire | Sur TEST : sauvegarde, copier-coller, « Nouvelle version », vérification de l'adresse, à chaque livraison et chaque correctif. En production (plus tard) : copier-coller, déploiement, envoi de l'adresse |
| Ce qui reste à toi | `clasp login` à chaque envoi (autorisation Google) ; activer puis désactiver l'API à chaque lot ; en production : lancer la commande, comparer l'empreinte, taper `PRODUCTION` |
| Risques | Jeton puissant, 2 minutes par envoi ; clasp remplace **tout** le projet à chaque envoi (d'où la sauvegarde automatique) ; `clasp logout` efface le jeton du PC mais ne l'annule pas chez Google (`docs/clasp.md`, règles 2 et 3) |
| Gratuit ? | Oui : logiciel libre de Google, sans abonnement ni seuil. Google précise que ce n'est « pas un produit officiellement pris en charge » |
| À installer une fois | clasp, l'API Apps Script, le dossier `clasp-loue\TEST` : 15 min, guidé (`docs/clasp.md`). Node.js est déjà sur ton PC |

---

## Piste 3 — Les demandes de fusion

### Aujourd'hui
Je pousse les branches, je te donne un lien, tu cliques « Create pull request », « Merge pull request », « Confirm merge ». Pour la copie d'essai **et** pour la production, et à chaque correctif.

**À savoir** : ton PC est connecté à GitHub pour que je puisse pousser les branches. Cette connexion a **tous tes droits** : techniquement, elle permettrait déjà de pousser dans `main`. Seule ma règle de travail l'interdit. Rien de ce qui suit ne change ce fait ; je le dis pour que les protections ci-dessous soient jugées pour ce qu'elles sont.

### Le problème de la copie d'essai
La copie d'essai est un dossier `essai/` **dans `main`**, à côté des pages de production. Me laisser « fusionner seul les demandes de la copie d'essai », ce serait me laisser écrire dans `main` : GitHub ne sait pas autoriser un dossier et pas les autres.

**La solution : sortir la copie d'essai du dépôt de production.** Je la publie alors seul, autant que nécessaire, et **plus rien n'entre dans `main` pendant les essais**.

### Où mettre la copie d'essai

| | **Aujourd'hui : `essai/` dans `main`** | **D1. Un second dépôt dans ton compte** | **D2. Un dépôt dans une « organisation » GitHub gratuite (recommandé)** |
|---|---|---|---|
| Adresse | `chantiersloue.github.io/chantier-pro/essai/` | `chantiersloue.github.io/chantier-pro-essai/` | `<nom-choisi>.github.io/chantier-pro/` |
| Qui publie la copie d'essai | Toi (3 clics à chaque fois) | Moi | Moi |
| `main` de production touché pendant les essais | Oui | Non | Non |
| Mémoire du téléphone partagée avec la vraie appli | Oui | **Oui** (même début d'adresse) | **Non** (autre début d'adresse) |

Explication de la dernière ligne : pour un téléphone, toutes les pages qui commencent par `chantiersloue.github.io` sont **le même site**. Elles partagent la même mémoire : brouillons, file d'envoi, session du lot 2. C'est pour cela que la procédure du lot 2 te demandait d'attendre « ✓ Tout est envoyé » avant l'essai 19. Avec D1, cela reste vrai, et une page d'essai que je publie seul pourrait, en cas de bogue, abîmer la mémoire de la vraie appli sur un téléphone qui a ouvert les deux (le tien). Aujourd'hui ce risque existe déjà, mais chaque publication passe par ton clic.

Une **organisation** GitHub est un second espace rattaché à ton compte : même connexion, même mot de passe, gratuit pour des dépôts publics. Son adresse commence autrement : la copie d'essai devient un site vraiment à part. Les essais y gagnent aussi : la copie d'essai se comporte comme une appli neuve.

**Dans les deux cas** :
- `outils/essai.js` est à adapter (l'adresse de la copie d'essai y est écrite en dur) ; la copie fabriquée est poussée depuis un dossier à part du PC, relié au seul dépôt d'essai, pour ne jamais confondre les deux dépôts ;
- la copie d'essai devient permanente et publique (aujourd'hui elle est retirée à chaque mise en production). Elle est toujours en mode TEST, avec son bandeau rouge ;
- le dossier `essai/` disparaît du dépôt de production : plus de « la livraison retire aussi la copie d'essai », plus de conflits comme celui de la demande n° 6 ;
- GitHub Pages a une limite indicative de 10 publications par heure : sans effet à notre rythme ;
- l'icône « Loué ESSAI » de ton téléphone est à réinstaller une fois.

### Qui crée la demande de fusion de production

| | **Aujourd'hui** | **P1. Lien pré-rempli (recommandé)** | **P2. Je la crée avec l'outil `gh`** |
|---|---|---|---|
| Ce que je fais | Un lien nu | Un lien qui ouvre la demande **avec son titre et une courte description déjà remplis** (contenu, empreinte du serveur, renvoi vers la procédure) | Je crée la demande |
| Tes clics | 3, et le texte à ta charge | **3** : « Create pull request », « Merge pull request », « Confirm merge » | **2** : « Merge pull request », « Confirm merge » |
| À installer | Rien | **Rien** | `gh` + un jeton GitHub limité, à créer, ranger et renouveler chaque année |

P2 te fait gagner **un clic par lot**. En échange : un programme de plus, un jeton de plus sur le PC. Ce jeton pourrait être limité au seul droit « Pull requests » (créer une demande ; fusionner demande un autre droit, « Contents », qu'il n'aurait pas — vérifié dans la documentation de GitHub), mais il permettrait aussi de fermer ou de réécrire tes demandes, et son bon fonctionnement avec `gh` n'est pas garanti par la documentation. **Le gain ne vaut pas l'outil** : je recommande P1. P2 reste possible plus tard.

Ta demande disait « créer toi-même les demandes de fusion » : avec D2, il n'en reste qu'une par lot, et P1 te la présente prête à valider. C'est l'écart assumé avec ta demande ; dis-moi si tu préfères P2 (décision n° 5).

### Une protection à ajouter : `main` verrouillée
Réglage gratuit de GitHub pour un dépôt public : « toute modification de `main` passe par une demande de fusion », appliqué aussi à l'administrateur.
- Effet : plus personne, ni toi ni moi, ne peut pousser dans `main` **par erreur**. C'est utile au moment où je commence à pousser seul dans un autre dépôt.
- Ton bouton « Merge » marche toujours, **à condition de laisser décochée la case « Require approvals »** (sinon, plus personne ne peut fusionner : on n'approuve pas sa propre demande).
- Ce que ce n'est pas : un mur contre un programme qui utiliserait la connexion GitHub de ton PC pour fusionner à ta place. C'est un garde-fou.

**Le mur existe, si tu le veux un jour** : un second compte GitHub pour moi, invité sur le dépôt, avec approbation obligatoire par toi. Plus lourd (un compte de plus, et ta propre connexion à GitHub à retirer du PC de travail : celle de Git **et** celle du navigateur). Je ne le recommande pas aujourd'hui.

**Solutions écartées** : me donner le droit de fusionner dans `main` avec un contrôle des fichiers touchés (garde-fou fragile sur la production) ; le connecteur GitHub de Claude (droits larges sur tout ton compte) ; l'envoi automatique par GitHub Actions (écarté dans `docs/clasp.md`).

### Bilan de la piste 3

| | |
|---|---|
| Tu n'auras plus à faire | Créer et fusionner les demandes de la copie d'essai et de ses correctifs (les deux tiers des demandes) ; rédiger quoi que ce soit ; gérer les conflits liés à `essai/` |
| Ce qui reste à toi | Les 3 clics de la demande de production, une fois par lot et une fois par correctif de production |
| Risques | Je publie la copie d'essai sans ton clic (sans effet sur la production avec D2) ; la connexion GitHub du PC garde tous tes droits, comme aujourd'hui ; une copie d'essai publique en permanence |
| Gratuit ? | Oui : dépôt public, organisation, GitHub Pages et protection de branche sont gratuits |
| À installer une fois | Verrouiller `main` (3 min) ; créer l'organisation, le dépôt d'essai et activer GitHub Pages (10 min) ; réinstaller l'icône « Loué ESSAI » (2 min). Aucun programme |

---

## Piste 4 — Je joue moi-même les essais contre le vrai serveur TEST

### Aujourd'hui
Mes tests tournent contre un **faux serveur** sur le PC. Ils vérifient les pages, pas le vrai serveur Google. C'est toi qui joues la procédure (21 essais au lot 2, 1 h) contre la copie TEST.

### Ce que je ferai
Un test par lot, `tests/reel-lotN.test.js`, qui joue la procédure contre **le vrai serveur TEST** : dans un vrai Chrome piloté depuis le PC, en largeur téléphone puis en largeur PC. Pour chaque essai : l'action, l'attendu, l'obtenu, une capture d'écran en cas d'échec. Le compte rendu sépare toujours « vérifié par moi » et « à vérifier sur téléphone ».

**Tout ce que le test lit ou modifie sur TEST passe par la porte de service de la piste 1**, et par rien d'autre :

| Besoin | Par la porte de service |
|---|---|
| Vérifier qu'une fiche est arrivée, une seule fois | Lire les dernières lignes de l'onglet *Envois* |
| Vérifier que le PDF est rangé au bon endroit | Demander si le fichier existe dans le dossier TEST |
| Vérifier qu'un mail est parti | Lire la colonne d'état du mail (sa **réception** reste sur ta liste) |
| Se connecter avec un compte d'essai | Demander une session d'essai pour un compte `auto…` : **aucun mot de passe n'est tapé ni transmis** |
| Cocher une case d'un compte d'essai, puis faire réagir le serveur | Cocher, puis lancer `traiterComptes` |
| Installer et retirer les déclencheurs de TEST | Au début et à la fin de la série |

**Pourquoi pas les connecteurs Google de Claude** (Sheets, Drive, Gmail), qui sont déjà dans l'appli ? Parce qu'ils voient **tout le compte**, vrai Sheet et vrais mails compris, et qu'aucun programme ne peut m'y limiter à TEST : ce serait seulement ma discipline. La porte de service, elle, n'existe que sur TEST. C'est aussi trois outils de moins.

### Ce qui restera pour toi

| Essai | Pourquoi je ne peux pas le faire |
|---|---|
| Mode avion réel, puis retour du réseau (une fiche avec photo) | Le vrai comportement d'Android et d'iOS : c'est exactement l'essai 12 du lot 2 |
| Photo prise avec l'appareil photo | Poids et orientation réels |
| L'appli installée, sur iPhone **et** sur Android | La mémoire de l'appli installée est à part sur iPhone |
| Les écrans de connexion (mauvais mot de passe, provisoire, blocage) quand le lot y touche | Mes règles m'interdisent de taper un mot de passe, même d'essai, dans une page qui parle à un serveur sur Internet. Je les teste contre le faux serveur ; le vrai serveur, c'est toi |
| Un mail reçu, lu sur ton téléphone | Je ne lis pas ta boîte |
| Une case cochée depuis l'appli Google Sheets du téléphone (quand le lot s'en sert) | Le déclencheur ne réagit qu'à une modification faite par une personne dans le Sheet, pas par un programme |
| Lisibilité : plein soleil, gants, une main | Aucun outil ne le mesure |
| Dictée, signature ou annotation au doigt (quand le lot s'en sert) | Matériel du téléphone |

Soit **6 à 10 essais selon le lot, 20 à 25 min**, au lieu d'une vingtaine en 1 h.

### Les limites
1. **Sans la porte de service, cette piste ne vaut presque rien** : je ne pourrais ni vérifier ce que le serveur a fait, ni me connecter.
2. **Un essai automatique qui passe ne prouve pas que le téléphone passera.** Le défaut de l'essai 12 n'aurait pas été vu par cette piste.
3. **La porte lance le serveur déployé**, pas le dernier code enregistré : l'ordre est toujours envoi → mise à jour du déploiement → essais.

### Les risques et leurs parades

| Risque | Parade |
|---|---|
| **Quota de mails** : TEST et production partagent les 100 destinataires par jour. Une série envoie 10 à 20 mails | Deux séries complètes par jour au plus ; la série lit d'abord les mails encore possibles et refuse de démarrer sous 40 |
| **Quota de déclencheurs** (90 min par jour, partagées) | Déclencheurs TEST installés au début de la série. Je les laisse en place tant que tu as un essai téléphone qui en a besoin, et je les retire après ton feu vert |
| **Données d'essai qui s'accumulent** | Tout est marqué « AUTO » ; nettoyage en fin de série, à la corbeille (elle compte encore 30 jours dans les 15 Go : volumes très faibles) |
| **Clé de la porte divulguée** | Elle n'ouvre que des gestes sur des données d'essai de TEST ; on la change en 2 minutes |
| **Faux sentiment de sécurité** | Le compte rendu liste toujours ce qui n'a **pas** été vérifié |

### Bilan de la piste 4

| | |
|---|---|
| Tu n'auras plus à faire | Environ la moitié à deux tiers des essais de chaque procédure ; me recopier les durées et les nombres lus dans le Sheet ou l'éditeur |
| Ce qui reste à toi | Les 6 à 10 essais de la liste ci-dessus ; le feu vert |
| Risques | Quotas partagés avec la production ; clé de la porte ; faux sentiment de sécurité |
| Gratuit ? | Oui : l'outil qui pilote Chrome est déjà sur ton PC |
| À installer une fois | Rien de plus que la piste 1 |

---

## Ce qui reste obligatoirement à toi, quelle que soit la piste

1. **Les autorisations Google** : `clasp login`, l'écran « Autoriser » quand un lot demande un nouveau droit, tout réglage du compte.
2. **Le vrai téléphone** : les essais de la liste courte, et l'installation sur les téléphones des gars.
3. **Le feu vert de production** et les clics qui publient.
4. **Les vraies données** : remplir le vrai Sheet, cocher une purge, vider une corbeille. Je ne lis ni ne modifie le vrai Sheet.
5. **Les personnes** : distribuer les mots de passe, expliquer une nouveauté, envoyer un mail.
6. **Les dépenses** : il n'y en a aucune dans cette étude.

## Ce que tu installes, une seule fois (environ 35 min, guidé en direct)

| # | Quoi | Durée | Piste |
|---|---|---|---|
| 1 | Verrouiller `main` sur GitHub (case « Require approvals » décochée) | 3 min | 3 |
| 2 | Créer l'organisation GitHub gratuite, le dépôt d'essai, activer GitHub Pages | 10 min | 3 |
| 3 | Réinstaller l'icône « Loué ESSAI » sur ton téléphone | 2 min | 3 |
| 4 | clasp : installation, API Apps Script, dossier `clasp-loue\TEST` (`docs/clasp.md`) | 15 min | 2 |
| 5 | La propriété `CLE_OUTILS_TEST` sur TEST | 2 min | 1 et 4 |

L'ordre compte : `main` est verrouillée **avant** que je pousse seul où que ce soit.

De mon côté, avant de compter dessus : adapter `outils/essai.js` et `outils/construire.js`, écrire `envoyer-test.js` et la porte de service, mettre `docs/clasp.md` à jour (il dit encore « jeton effacé en fin de séance » et « jamais une autre branche que `main` »), et faire les essais listés à la fin (« Non vérifié »).

Un seul programme à installer (clasp). Aucun abonnement, aucun essai gratuit limité dans le temps. Une échéance : les vieilles versions Apps Script à nettoyer environ une fois par an (`docs/clasp.md`).

## Ordre de mise en place proposé

Rappel : d'après `PLAN.md`, le lot 7 (signalement) vient **avant** le lot 3 (notes).

| Quand | Quoi |
|---|---|
| Maintenant (lot 2 en production depuis le 12/11/2026) | Tes six décisions |
| Ensuite | Séance d'installation (35 min) ; je construis les outils et je fais les essais de faisabilité |
| Lot 7 | Pistes 1, 3 et 4 complètes ; clasp sur TEST seulement ; production au copier-coller |
| Lot 3 et suivants | Si le lot 7 s'est bien passé et si tu le décides : clasp aussi en production |

## Lot par lot : ce qu'il te restera à faire

### D'abord, la fin du lot 2 (à la main, hors de cette étude)
Le serveur et les pages sont en production depuis le 12/11/2026. Il te reste, dans `docs/lot2-procedure.md` (D.8 à D.10) : installation de l'appli sur les téléphones des gars et distribution des mots de passe, `demarrerTransition` quand tout le monde est connecté, puis archivage des anciens déploiements à la fin de la transition.

### Pour chaque lot suivant, le tronc commun

| Étape | Toi | Durée |
|---|---|---|
| Début du lot | Activer « API Google Apps Script » dans les réglages du compte | 1 min |
| Chaque envoi du serveur sur TEST (2 à 4 par lot) | `clasp login` quand je te le demande | 30 s chacun |
| Installation sur TEST | Rien. Si Google demande une nouvelle autorisation : 1 clic ▶ `installerLotNTest` | 0 à 2 min |
| Essais automatiques | Lire mon compte rendu | 5 min |
| Essais sur téléphone | La liste courte du lot | 20 à 25 min |
| Feu vert | « Bon pour la production » | — |
| Serveur de production | Lot 7, comme au lot 2 : sauvegarde, copier-coller, nouveau déploiement, **m'envoyer la nouvelle adresse et attendre mon lien** (10 min). Ensuite : `clasp login`, 1 commande, l'empreinte, le mot `PRODUCTION` (2 min) | 2 à 10 min |
| Installation en production | 1 clic ▶ `installerLotNProduction`, lire le bilan | 2 min |
| Publication | Mon lien, puis 3 clics | 1 min |
| Contrôle | « À propos » affiche la nouvelle version ; une vraie fiche envoyée vers toi | 3 min |
| Fin du lot | Désactiver « API Google Apps Script » | 1 min |

Total du tronc commun : **35 à 50 min** (le haut de la fourchette au lot 7, avec le copier-coller). Avec ce que chaque lot ajoute (tableau suivant) : **40 à 60 min**.

En cas de retour arrière en production : c'est toi qui lances les fonctions dans l'éditeur (`retirerDeclencheurs`…), comme aujourd'hui. Chaque procédure le décrira.

### Ce que chaque lot ajoute
D'après `PLAN.md` ; à préciser dans chaque procédure. « Autorisation » = le lot demandera probablement un écran d'autorisation Google (1 clic ▶ sur TEST en plus).

| Lot | Essais sur téléphone propres au lot | Ce qui reste à toi en plus |
|---|---|---|
| **7 — Signalement** | Un signalement avec photo de l'appareil, en mode avion, parti au retour du réseau ; les gros boutons avec des gants ; le mail reçu par le conducteur, et par l'atelier seulement si la case est cochée | Vérifier dans le vrai Sheet les adresses du conducteur et de l'atelier ; montrer la tuile « Signaler » aux gars |
| **3 — Notes de chantier** | Une note dictée au micro ; une note avec photo en mode avion (la même note modifiée par deux personnes : je la joue sur PC avec deux fenêtres) | Rien de plus |
| **9b — Contrat avec les skills** | Aucun | Coller dans tes skills le texte que je fournis (je ne modifie pas tes skills). Aucun déploiement |
| **4a — Carnet : dépôt** | Aucun | Vérifier que « Google Drive pour ordinateur » tourne sur ton PC ; lancer un skill sur un vrai chantier et regarder le dossier CARNET |
| **4b — Carnet : lecture** | Un grand plan zoomé en plein soleil ; « Tout télécharger » puis lecture en mode avion, sur iPhone **et** Android ; le téléchargement automatique en Wi-Fi sur Android ; le message « plus disponible hors réseau » sur iPhone ; la place libre affichée | Rien de plus (le test de charge à 5 téléphones, je le fais depuis le PC). Nouvel onglet dans le Sheet : installation par la fonction du lot |
| **5 — Stockage** | Aucun | **Autorisation probable** (déclencheur de nuit, qui compte dans les 90 min par jour). Comparer l'espace affiché avec celui de la page Google ; **cocher toi-même** « Purger » et « Vider la corbeille » (suppression définitive : toujours toi) ; fixer la règle de purge |
| **8 — Note de réunion** | Une photo annotée au doigt ; une note dictée ; la reprise des points ouverts lue sur le téléphone | Mettre à jour l'onglet *Intervenants* par ton skill |
| **10 — Idées** | Selon l'idée (QR code : l'imprimer et le scanner) | Choisir les idées à faire |

Si un lot comporte une migration de données réelles (aucune n'est prévue à ce jour dans `PLAN.md` pour ces lots), elle reste une étape à part, lancée par toi, avec sauvegarde et retour arrière.

## Ce que tu dois décider

| # | Décision | Ma recommandation |
|---|---|---|
| 1 | La porte de service sur TEST, dans un fichier absent de la production (entorse à « même code »), avec sa session d'essai ? | **Oui.** Sans elle, la piste 4 ne vaut presque rien |
| 2 | Le jeton clasp : le temps d'un envoi (A), toute la séance (B), ou TEST dans un second compte Google (C) ? | **A** pour commencer ; **C** si les connexions te pèsent ; jamais B |
| 3 | clasp en production après le lot 7 ? | **À décider après le lot 7** |
| 4 | La copie d'essai hors du dépôt de production : organisation gratuite (D2) ou second dépôt du compte (D1) ? | **D2** |
| 5 | Demande de fusion de production : lien pré-rempli (P1, rien à installer) ou outil `gh` avec jeton (P2, un clic de moins) ? | **P1** |
| 6 | Verrouiller `main` ? | **Oui** |

## Sources vérifiées le 12/11/2026

- clasp (commandes, connexion, déploiements) : [github.com/google/clasp](https://github.com/google/clasp)
- Lancer une fonction par l'API Apps Script : projet Cloud commun, « ne peut pas créer de déclencheurs » : [developers.google.com/apps-script/api/how-tos/execute](https://developers.google.com/apps-script/api/how-tos/execute)
- Jeton expirant en 7 jours pour un projet Cloud en mode « test » : [developers.google.com/identity/protocols/oauth2](https://developers.google.com/identity/protocols/oauth2)
- Déclencheurs : une modification faite par un programme ne les lance pas : [developers.google.com/apps-script/guides/triggers/installable](https://developers.google.com/apps-script/guides/triggers/installable)
- Quotas Apps Script (100 destinataires, 90 min, 6 min, 30 exécutions) : [developers.google.com/apps-script/guides/services/quotas](https://developers.google.com/apps-script/guides/services/quotas)
- Droits d'un jeton GitHub limité (créer : « Pull requests » ; fusionner : « Contents ») : [docs.github.com — permissions des jetons](https://docs.github.com/en/rest/authentication/permissions-required-for-fine-grained-personal-access-tokens)
- `gh` et les jetons limités : [cli.github.com/manual/gh_auth_login](https://cli.github.com/manual/gh_auth_login)
- Verrouillage de `main` (demande de fusion obligatoire, sans approbation, appliquée à l'administrateur) : [docs.github.com — règle de protection de branche](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/managing-a-branch-protection-rule)
- Offre gratuite de GitHub (dépôts publics) : [docs.github.com — offres](https://docs.github.com/en/get-started/learning-about-github/githubs-plans)
- GitHub Pages pour un compte ou une organisation gratuits (dépôt public, adresse `<nom>.github.io/<dépôt>`) : [docs.github.com — créer un site](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site) ; limite indicative de 10 publications par heure : [docs.github.com — limites](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)
- Lien qui pré-remplit une demande de fusion (`quick_pull`, `title`, `body`) : [docs.github.com — paramètres d'adresse](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/using-query-parameters-to-create-a-pull-request)
- Le reste (clasp, versions, sécurité du jeton) : sources de `docs/clasp.md`.

## Non vérifié par un essai réel

Rien n'a été installé : ces points reposent sur la documentation ou sur mon expérience, et seront essayés pendant ou juste après la séance d'installation, **avant** de compter dessus.

1. ~~Un appel de l'appli peut-il créer et retirer des déclencheurs sur TEST (porte de service) ?~~ **Oui, essayé le 12/11/2026** sur la copie TEST : déclencheur posé puis retiré.
2. ~~La copie d'essai marche-t-elle à l'identique à une autre adresse ?~~ **Oui pour les pages et les appels au serveur TEST** (contrôlé dans un navigateur le 12/11/2026 à `loue-essai.github.io/chantier-pro/`). Reste à confirmer par Franck : installation sur le téléphone et envoi d'une fiche.
3. ~~Le lien pré-rempli de demande de fusion ; le premier envoi vers le dépôt de l'organisation.~~ **Oui, les deux**, le 12/11/2026 (demande de fusion n° 11, accents compris ; copie d'essai publiée).
4. ~~Le verrouillage de `main` se règle-t-il comme décrit, et le bouton « Merge » marche-t-il ensuite ?~~ **Oui**, le 12/11/2026.
5. Les durées annoncées sont des estimations tirées de la procédure du lot 2.
