# clasp : envoyer le serveur sur la copie TEST sans copier-coller

> Pour Franck. Étude faite le 10/11/2026, **rien n'est installé et aucun compte n'est connecté**.
> Les essais du lot 2 sont finis et le lot 2 est en production (12/11/2026). clasp reste **à installer quand tu me le diras** : la façon de s'en servir dépend de tes réponses aux décisions de `docs/automatisation.md` (qui précise et, sur deux points, remplace ce document : jeton effacé après chaque envoi, envoi sur TEST depuis la branche de travail).
> Ce document est public (dépôt GitHub) : il ne contient aucun identifiant secret. Les identifiants iront dans `_prive/`.

## En bref

- **clasp** est un petit programme de Google, gratuit et libre, qui envoie le code du serveur dans le projet Apps Script depuis le PC, en quelques commandes, au lieu du copier-coller dans l'éditeur.
- **Ce qui est décidé** (12/11/2026, `docs/automatisation.md`) : clasp **pour la copie TEST seulement** ; la production reste au copier-coller, on en reparle après le lot 7.
- **Comment** : une seule commande, **que tu lances toi-même** : `node outils\envoyer-test.js`. Elle ouvre la connexion Google, vérifie que le projet visé est bien celui de la copie TEST, sauvegarde, envoie, met à jour le déploiement, vérifie en ligne, puis **efface le jeton**.
- **Le prix à payer** : un **jeton de connexion** existe sur le PC pendant ces 2 à 3 minutes. Il permettrait de modifier **tous** les projets Apps Script du compte Google, **production comprise** : c'est pour cela qu'il ne reste jamais plus longtemps, et qu'il n'est jamais dans la séance de travail de Claude.
- **Ce qui ne change pas** : en production, tout se fait à la main comme aujourd'hui.

## Ce que j'ai vérifié (documentation officielle et code source de clasp)

| Question | Réponse | Source |
|---|---|---|
| Gratuit ? | **Oui.** Logiciel libre (licence Apache-2.0), installé avec npm, sans abonnement. L'API Apps Script qu'il utilise est gratuite. Version actuelle : **3.4.1**. Google précise que ce n'est « pas un produit officiellement pris en charge » : c'est un outil de Google, mais sans assistance | [github.com/google/clasp](https://github.com/google/clasp), registre npm (`@google/clasp`) |
| Ce qu'il faut sur le PC | **Node.js 22 ou plus récent** (README de la version 3). **Ton PC a déjà Node.js 24** : rien à installer de ce côté | README, [guide clasp de Google](https://developers.google.com/apps-script/guides/clasp) |
| Réglage du compte Google | Activer **« API Google Apps Script »** sur [script.google.com/home/usersettings](https://script.google.com/home/usersettings) (connecté avec le compte de Loué). Google prévient : une fois l'API activée, **toute application que tu autorises** peut créer et modifier tes scripts. N'autorise que clasp | [Activer l'API Apps Script](https://developers.google.com/apps-script/api/how-tos/enable) |
| Ce qui est stocké sur le PC | `clasp login` crée **`C:\Users\<toi>\.clasprc.json`** : un **jeton de rafraîchissement** (« refresh token ») qui donne accès à tes projets. Google conseille de le traiter comme un mot de passe et de ne jamais le mettre dans un dépôt. Droits demandés : créer et modifier les projets Apps Script et leurs déploiements, lire les noms des fichiers Drive, lire les journaux, et un droit large sur Google Cloud (`cloud-platform`) | Guide clasp, code source de clasp (`src/commands/login.ts`) |
| Le fichier du projet | `clasp clone-script` crée **`.clasp.json`** avec l'**identifiant du script** (scriptId). Pas un mot de passe, mais un identifiant : il reste hors du dépôt (règle de CLAUDE.md) | Guide clasp, README |
| Nom des fichiers | Sur le PC, clasp écrit le code du serveur sous le nom **`Code.js`** (et pas `Code.gs`) : c'est le même fichier, Apps Script le renomme lui-même | Code source de clasp (`src/core/files.ts`) |
| Que fait `clasp push` ? | Il **remplace tout le contenu** du projet en ligne par les fichiers du dossier (code **et** manifeste `appsscript.json`). Pas d'envoi fichier par fichier : ce qui n'est pas dans le dossier disparaît du projet. Si le manifeste a changé, clasp demande la permission ; répondre « non » **annule tout l'envoi** | README (« always replaces the whole content »), code source (`push.ts`) |
| Mettre à jour un déploiement garde-t-il l'adresse ? | **Oui.** Google : modifier un déploiement pour le faire pointer sur une nouvelle version « met à jour l'application pour tous les utilisateurs en gardant la même URL ». Avec clasp : `clasp update-deployment <identifiant du déploiement>` (crée une version et l'y met). C'est ce que tu fais aujourd'hui avec « Gérer les déploiements → Modifier → Nouvelle version » | [Déploiements (Google)](https://developers.google.com/apps-script/concepts/deployments), README |
| Limites | **200 versions au plus** par projet : chaque mise à jour de déploiement en crée une. Les anciennes se suppriment dans l'éditeur (Historique du projet → suppression groupée), sauf celles utilisées par un déploiement actif | [Versions (Google)](https://developers.google.com/apps-script/guides/versions) |
| Quotas | Quelques envois par jour sont négligeables. Je n'ai pas trouvé de chiffre officiel pour la limite de l'API d'envoi : à surveiller seulement en cas de message « quota » | [Quotas Apps Script](https://developers.google.com/apps-script/guides/services/quotas) |

**La règle 2 de CLAUDE.md reste vraie avec clasp** : une mise à jour de déploiement peut ne pas être prise en compte. On vérifie donc toujours la version affichée par l'adresse du serveur (« Loué App API v6.0 OK »), comme aujourd'hui.

## Les trois façons de faire

| | **A. Copier-coller (aujourd'hui)** | **B. clasp depuis le PC (recommandé, TEST)** | **C. Envoi automatique par GitHub (GitHub Actions + clasp)** |
|---|---|---|---|
| Ce que tu fais | Copy raw file → Ctrl+A, Ctrl+V dans l'éditeur → disquette → Gérer les déploiements → Nouvelle version | Une commande dans PowerShell (`node outilsenvoyer-test.js`) et un clic « Autoriser » | Rien : chaque fusion sur GitHub envoie le serveur sur TEST |
| Installation | Aucune | clasp sur le PC (une fois), activer l'API Apps Script, `clasp login` | clasp + le jeton enregistré comme « secret » dans GitHub |
| Où est le jeton ? | Nulle part | Sur le PC (`.clasprc.json`), effacé après chaque envoi | **Dans GitHub**, en permanence, sur un dépôt **public** |
| Risques | Coller dans le mauvais projet ; collage incomplet (rare, visible) | Jeton volé si le PC l'est ; envoi vers le mauvais projet (protégé par une vérification de l'identifiant à chaque séance) | Un jeton qui peut toucher la **production** stocké chez un tiers ; une erreur de configuration et tout part tout seul ; difficile à comprendre et à réparer pour un débutant |
| Temps par livraison | 2 à 3 min | 2 min | 0 min |
| Coût | 0 € | 0 € | 0 € (minutes GitHub gratuites pour un dépôt public) |
| Verdict | Simple et sûr, mais manuel | **Bon compromis** : plus fiable que le collage (contrôles avant envoi), jeton sous ton contrôle | **Écarté** : trop de risque pour le gain (contraire à « limiter les outils », jeton puissant hors du PC) |

Autre option regardée et écartée : les extensions Chrome qui relient GitHub et Apps Script. Ce ne sont pas des outils Google, et elles demandent un accès à ton compte GitHub **et** à ton compte Google.

**Recommandation : B, pour la copie TEST seulement.** C'est là que les envois sont les plus fréquents (un lot = souvent plusieurs corrections). Pour la production, garde le copier-coller : une ou deux fois par lot, et l'étape la plus sensible. On en reparlera après un lot complet sans souci.

## Sécurité : les règles

1. **Le jeton (`.clasprc.json`) ne quitte jamais ton dossier personnel Windows** (`C:\Users\<toi>\`). Vérifie que ce dossier n'est **pas** synchronisé par MEGA ni par Google Drive (`G:\`). Ta session Windows doit avoir un mot de passe et se verrouiller (Windows + L quand tu quittes le PC).
2. **Le jeton ne vit que le temps d'un envoi** : la commande `envoyer-test.js` l'efface à la fin, même en cas d'échec (`clasp logout`, puis suppression du fichier s'il est encore là). Attention, l'effacer du PC ne le désactive pas chez Google : une copie faite avant (sauvegarde, vol) resterait valable jusqu'à la règle 3. Si la commande se fige plus de 5 minutes : ferme la fenêtre, rouvre PowerShell, tape `clasp logout`, et préviens Claude.
3. **Si le PC est perdu ou volé** (ou au moindre doute) : sur [myaccount.google.com/connections](https://myaccount.google.com/connections) (compte de Loué) → retire l'accès de clasp (le nom affiché peut varier : cherche « clasp » ou « Apps Script »). Le jeton ne marche alors plus nulle part.
4. **Le dossier de travail clasp est HORS du dépôt GitHub** et hors de MEGA et Google Drive : `C:\Users\<toi>\clasp-loue\TEST\`. Il contient l'identifiant du script TEST (`.clasp.json`) : rien de tout cela ne va sur GitHub. Par sécurité, le `.gitignore` du dépôt refuse aussi ces fichiers (`.clasp.json`, `.clasprc.json`, `creds*.json`) s'ils y arrivaient par erreur.
5. **Un seul dossier, le TEST**, et **le projet visé est vérifié à chaque envoi**, de deux façons : il doit contenir le déploiement dont l'adresse est celle de la copie TEST, et son identifiant doit être celui mémorisé au premier envoi (`_prive/script-test-id.txt`). Le jeton ouvre aussi la production : le nom du dossier ne suffit pas. Ne crée pas de dossier clasp pour la production tant qu'on n'en a pas décidé ensemble.
6. **Jamais `clasp push --force`** (il écrase le manifeste sans rien demander), et jamais `clasp push` lancé dans un autre dossier que `clasp-loue\TEST`.
7. **Désactive l'API Apps Script** sur [script.google.com/home/usersettings](https://script.google.com/home/usersettings) entre deux lots (un clic), **pas entre deux envois d'un même lot** : sans elle, la commande d'envoi échoue. Aucune application ne peut alors toucher tes scripts, même avec un jeton.

## Installation pas à pas (une seule fois, 15 min)

> **Pas avant ton accord** : quand tu me dis « on installe clasp ». Je peux te guider en direct ce jour-là.
> Toutes les commandes se tapent dans **PowerShell** (touche Windows, tape « PowerShell », Entrée ; **pas** en administrateur). Copie-colle chaque ligne, puis Entrée. Si une commande affiche une erreur en rouge : **arrête-toi** et envoie-moi une capture.

1. **Vérifier Node.js** :
   ```
   node --version
   ```
   Doit afficher `v22` ou plus (ton PC : `v24`).
2. **Installer clasp** (version fixée, pour que la procédure reste juste) :
   ```
   npm install -g @google/clasp@3.4.1
   ```
   Puis :
   ```
   clasp --version
   ```
   doit afficher `3.4.1`. Si PowerShell répond que `clasp` n'est pas reconnu : ferme PowerShell, rouvre-le et réessaie ; sinon tape `clasp.cmd --version` (et utilise `clasp.cmd` à la place de `clasp` dans toutes les commandes).
3. **Activer l'API** : dans le navigateur, **connecté avec le compte Google de Loué** (celui qui possède le Sheet TEST), ouvre [script.google.com/home/usersettings](https://script.google.com/home/usersettings) → **API Google Apps Script** → **Activé**.
4. **Créer le dossier de travail**, hors du dépôt, de MEGA et de Google Drive :
   ```
   mkdir $HOME\clasp-loue\TEST
   cd $HOME\clasp-loue\TEST
   ```
5. **Se connecter** :
   ```
   clasp login
   ```
   Une page Google s'ouvre. Choisis **le compte de Loué**, lis la liste des autorisations, puis **Autoriser**. PowerShell affiche un message de réussite (« Authorization successful » ou proche). Le jeton est maintenant dans `C:\Users\<toi>\.clasprc.json`.
6. **Trouver l'identifiant du script TEST** : Sheet **« ChantierPro TEST »** (vérifie le nom : pas le vrai Sheet) → Extensions → Apps Script → ⚙ **Paramètres du projet** → **ID du script** → Copier. Tu n'as pas à le noter : la commande d'envoi le mémorisera elle-même au premier envoi, après avoir vérifié que c'est bien le projet de la copie TEST.
7. **Relier le dossier au script TEST** (remplace `ID_DU_SCRIPT` par l'identifiant copié) :
   ```
   clasp clone-script ID_DU_SCRIPT
   ```
   Le dossier contient maintenant **`Code.js`** (le serveur actuel, c'est normal qu'il s'appelle `.js` ici), **`appsscript.json`** (le vrai manifeste du projet TEST : c'est lui qu'on garde) et **`.clasp.json`**.
8. **Contrôler le manifeste** :
   ```
   type appsscript.json
   ```
   Il doit contenir un bloc `"webapp"` avec `"access": "ANYONE_ANONYMOUS"` et `"executeAs": "USER_DEPLOYING"` (c'est ce qui permet aux téléphones d'appeler le serveur sans compte Google). **S'il manque : arrête-toi et préviens-moi**, ne fais aucun envoi.
9. **Vérifier l'identifiant du déploiement TEST** : il est déjà public, dans `commun/config.js` du dépôt (ligne `URL_TEST`) : c'est la suite entre `/s/` et `/exec` (elle commence par `AKfycb…`). Vérifie qu'elle apparaît bien dans la liste :
   ```
   clasp list-deployments
   ```
   Il y a une ligne `@HEAD` (à ignorer) et une ou plusieurs lignes avec un identifiant : **celui de `URL_TEST` doit y être**. S'il n'y est pas : arrête-toi et préviens-moi (le dossier serait relié à un autre projet que la copie TEST). Tu n'as rien à noter : la commande d'envoi refait ce contrôle à chaque fois.
10. **Effacer le jeton** :
    ```
    clasp logout
    ```
    **Laisse l'API activée** jusqu'à la fin des envois du lot en cours (règle 7).

## À chaque nouveau serveur sur TEST : une seule commande

C'est **toi qui la lances**, quand Claude te le demande. Claude te donne les deux lignes à copier dans **PowerShell** (pas en administrateur). Elles ressemblent à ceci :

```
cd $HOME\Documents\GitHub\chantier-pro
```

```
node outils\envoyer-test.js --avec-porte
```

(`--avec-porte` pendant les essais : le serveur contient alors les outils d'essai de Claude. `--sans-porte` avant ton feu vert : c'est le fichier de production exact.)

Ce qui se passe :

1. Une page Google s'ouvre : choisis **le compte de Loué**, puis **Autoriser**.
2. La commande affiche ses 6 étapes, une ligne chacune :
   - elle vérifie que le projet relié est bien celui de la copie TEST (sinon elle s'arrête sans rien envoyer) ;
   - elle sauvegarde le serveur en ligne dans `_prive/Code-TEST-avant-<date>-<heure>.gs` ;
   - elle envoie le nouveau serveur et met à jour le déploiement TEST (même adresse) ;
   - elle vérifie en ligne que l'adresse TEST exécute bien ce fichier-là, grâce à son **empreinte** (une suite de 10 caractères calculée sur le code : si un seul caractère change, elle change).
3. Elle efface le jeton et finit par **`✅ Envoi réussi`** ou **`❌ …`**. Moins de 3 minutes en tout.
4. Dis à Claude « envoi fait ». Si tu vois ❌ : copie-colle-lui le texte affiché, ne relance rien.

Son compte rendu est aussi écrit dans `_prive/envois/` (Claude le lit là).

**Ce que la commande refuse de faire** : envoyer vers un autre projet que la copie TEST ; envoyer si le dossier clasp contient autre chose que `appsscript.json` et `Code.js` ; modifier le manifeste (le fichier de réglages du projet) ; envoyer avec `--force` ; partir d'un dépôt qui a des modifications non enregistrées.

**Retour arrière** : les sauvegardes sont dans `_prive/` (date puis heure dans le nom). Le plus simple reste le copier-coller : ouvre la sauvegarde voulue, copie tout, colle dans `Code.gs` de l'éditeur Apps Script de la copie TEST, enregistre, puis **Gérer les déploiements → Modifier → Nouvelle version**. Pense aux déclencheurs, comme dans la procédure du lot concerné (`retirerDeclencheurs` **avant** de revenir à un serveur plus ancien).

**Une fois par an environ** : Apps Script garde 200 versions au plus. Dans l'éditeur, **Historique du projet** → **suppression groupée** des vieilles versions (celles d'un déploiement actif ne sont pas proposées).

## À ne jamais faire

- Lancer `clasp clone-script` avec l'identifiant du **script de production**.
- Taper toi-même `clasp push` : passe toujours par `node outils\envoyer-test.js`, qui fait les contrôles avant.
- `clasp push --force`, ou répondre « oui » à une question sur le manifeste.
- Lancer clasp depuis le dossier du dépôt GitHub, ou copier `.clasp.json` / `.clasprc.json` dans le dépôt, MEGA ou Google Drive.
- Mettre la propriété `CLE_OUTILS_TEST` dans le projet Apps Script de production.
- Coller en production un serveur pris ailleurs que dans `A-COLLER-DANS-APPS-SCRIPT/Code.gs` de la branche `main`. (Sur la copie TEST, la commande d'envoi part de la branche de travail de Claude : c'est voulu, et réservé à TEST.)
- Envoyer le manifeste du dépôt (`apps-script/appscript.json`) : il n'est pas utilisé. Le bon manifeste est celui du projet, récupéré par `clasp clone-script`.

## Désinstaller

`npm uninstall -g @google/clasp` ; désactiver « API Google Apps Script » ; retirer l'accès de clasp sur [myaccount.google.com/connections](https://myaccount.google.com/connections) ; supprimer le dossier `clasp-loue` ; supprimer la propriété `CLE_OUTILS_TEST` du projet TEST.
