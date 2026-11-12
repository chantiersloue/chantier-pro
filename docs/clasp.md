# clasp : envoyer le serveur sur la copie TEST sans copier-coller

> Pour Franck. Étude faite le 10/11/2026, **rien n'est installé et aucun compte n'est connecté**.
> À mettre en place **après la fin des essais du lot 2**, quand tu me le diras.
> Ce document est public (dépôt GitHub) : il ne contient aucun identifiant secret. Les identifiants iront dans `_prive/`.

## En bref

- **clasp** est un petit programme de Google, gratuit et libre, qui envoie le code du serveur dans le projet Apps Script depuis le PC, en quelques commandes, au lieu du copier-coller dans l'éditeur.
- **Ma recommandation** : l'utiliser **pour la copie TEST seulement** au début, et garder le copier-coller pour la production, au moins jusqu'à ce qu'il ait servi sans souci pendant un lot entier.
- **Le prix à payer** : un **jeton de connexion** reste sur le PC, dans ton dossier personnel Windows. Il permet de modifier **tous** les projets Apps Script du compte Google, **production comprise**. Il doit donc être protégé (section « Sécurité ») et effacé à la fin de chaque séance (`clasp logout`).
- **Ce qui ne change pas** : on lance toujours les fonctions (`verifierConfig`…) dans l'éditeur Apps Script, et on vérifie toujours la version affichée par l'adresse du serveur.

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
| Ce que tu fais | Copy raw file → Ctrl+A, Ctrl+V dans l'éditeur → disquette → Gérer les déploiements → Nouvelle version | Télécharger le fichier, puis quelques commandes dans PowerShell (contrôle, `clasp push`, `clasp update-deployment …`) | Rien : chaque fusion sur GitHub envoie le serveur sur TEST |
| Installation | Aucune | clasp sur le PC (une fois), activer l'API Apps Script, `clasp login` | clasp + le jeton enregistré comme « secret » dans GitHub |
| Où est le jeton ? | Nulle part | Sur le PC (`.clasprc.json`), effacé à chaque fin de séance | **Dans GitHub**, en permanence, sur un dépôt **public** |
| Risques | Coller dans le mauvais projet ; collage incomplet (rare, visible) | Jeton volé si le PC l'est ; envoi vers le mauvais projet (protégé par une vérification de l'identifiant à chaque séance) | Un jeton qui peut toucher la **production** stocké chez un tiers ; une erreur de configuration et tout part tout seul ; difficile à comprendre et à réparer pour un débutant |
| Temps par livraison | 2 à 3 min | 2 min | 0 min |
| Coût | 0 € | 0 € | 0 € (minutes GitHub gratuites pour un dépôt public) |
| Verdict | Simple et sûr, mais manuel | **Bon compromis** : plus fiable que le collage (contrôles avant envoi), jeton sous ton contrôle | **Écarté** : trop de risque pour le gain (contraire à « limiter les outils », jeton puissant hors du PC) |

Autre option regardée et écartée : les extensions Chrome qui relient GitHub et Apps Script. Ce ne sont pas des outils Google, et elles demandent un accès à ton compte GitHub **et** à ton compte Google.

**Recommandation : B, pour la copie TEST seulement.** C'est là que les envois sont les plus fréquents (un lot = souvent plusieurs corrections). Pour la production, garde le copier-coller : une ou deux fois par lot, et l'étape la plus sensible. On en reparlera après un lot complet sans souci.

## Sécurité : les règles

1. **Le jeton (`.clasprc.json`) ne quitte jamais ton dossier personnel Windows** (`C:\Users\<toi>\`). Vérifie que ce dossier n'est **pas** synchronisé par MEGA ni par Google Drive (`G:\`). Ta session Windows doit avoir un mot de passe et se verrouiller (Windows + L quand tu quittes le PC).
2. **Fin de séance = `clasp logout`** : le jeton est effacé du PC. Attention, cela ne le désactive pas chez Google : une copie faite avant (sauvegarde, vol) resterait valable jusqu'à la règle 3. La séance suivante, `clasp login` (une fenêtre Google, 30 secondes).
3. **Si le PC est perdu ou volé** (ou au moindre doute) : sur [myaccount.google.com/connections](https://myaccount.google.com/connections) (compte de Loué) → retire l'accès de clasp (le nom affiché peut varier : cherche « clasp » ou « Apps Script »). Le jeton ne marche alors plus nulle part.
4. **Le dossier de travail clasp est HORS du dépôt GitHub** et hors de MEGA et Google Drive : `C:\Users\<toi>\clasp-loue\TEST\`. Il contient l'identifiant du script TEST (`.clasp.json`) : rien de tout cela ne va sur GitHub. Par sécurité, le `.gitignore` du dépôt refuse aussi ces fichiers (`.clasp.json`, `.clasprc.json`, `creds*.json`) s'ils y arrivaient par erreur.
5. **Un seul dossier, le TEST**, et **son identifiant est vérifié au début de chaque séance** (étape 2 de l'envoi) : le jeton ouvre aussi la production, le nom du dossier ne suffit pas. Ne crée pas de dossier clasp pour la production tant qu'on n'en a pas décidé ensemble.
6. **Jamais `clasp push --force`** (il écrase le manifeste sans rien demander), et jamais `clasp push` lancé dans un autre dossier que `clasp-loue\TEST`.
7. **Désactive l'API Apps Script** sur [script.google.com/home/usersettings](https://script.google.com/home/usersettings) entre deux périodes d'essais (un clic). Aucune application ne peut alors toucher tes scripts, même avec un jeton.

## Installation pas à pas (une seule fois, 15 min)

> **Pas maintenant** : après les essais du lot 2, quand tu me dis « on installe clasp ». Je peux te guider en direct ce jour-là.
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
6. **Trouver l'identifiant du script TEST** : Sheet « ChantierPro TEST » → Extensions → Apps Script → ⚙ **Paramètres du projet** → **ID du script** → Copier. Note-le dans `_prive/ids-test.txt` (ligne « ID du script TEST »).
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
   Il y a une ligne `@HEAD` (à ignorer) et une ou plusieurs lignes avec un identifiant : **celui de `URL_TEST` doit y être**. Note-le dans `_prive/ids-test.txt` (ligne « ID du déploiement TEST »). S'il n'y est pas : arrête-toi et préviens-moi.
10. **Fin de séance** :
    ```
    clasp logout
    ```
    (Et, si tu veux, désactive l'API : règle 7.)

## À chaque nouveau serveur sur TEST (au lieu des étapes « colle le Code.gs » et « Nouvelle version »)

1. **Préparer le fichier** : après la fusion sur GitHub, sur github.com, branche **`main`**, ouvre `A-COLLER-DANS-APPS-SCRIPT/Code.gs` → icône **« Download raw file »**. Le fichier arrive dans ton dossier **Téléchargements**. Vérifie qu'il s'appelle bien **`Code.gs`** (et pas `Code (1).gs` : sinon, supprime les anciens `Code…gs` des Téléchargements et recommence).
2. **Ouvrir la séance et vérifier qu'on vise bien TEST** :
   ```
   cd $HOME\clasp-loue\TEST
   clasp login
   type .clasp.json
   ```
   Compare le `scriptId` affiché avec la ligne « ID du script TEST » de `_prive/ids-test.txt`. **S'ils ne sont pas identiques : arrête-toi**, `clasp logout`, et préviens-moi.
3. **Sauvegarde** de la version en ligne (c'est le retour arrière), avec la date **et l'heure** (deux envois le même jour ne s'écrasent pas) :
   ```
   clasp pull
   copy Code.js "$HOME\Documents\GitHub\chantier-pro\_prive\Code-TEST-avant-$(Get-Date -Format yyyyMMdd-HHmm).gs"
   ```
4. **Mettre le nouveau serveur à la place** :
   ```
   copy $HOME\Downloads\Code.gs Code.js
   ```
5. **Contrôler ce qui va partir** :
   ```
   clasp show-file-status
   ```
   Doit lister **exactement** `appsscript.json` et `Code.js`. Autre chose (un `Code.gs` en plus, par exemple) : arrête-toi et préviens-moi.
6. **Envoyer** :
   ```
   clasp push
   ```
   Si clasp demande « Manifest file has been updated. Do you want to push and overwrite? » : réponds **`n`**, **arrête-toi** et préviens-moi (le manifeste ne devait pas avoir changé ; répondre `n` annule tout l'envoi, rien n'est modifié en ligne).
7. Dans l'éditeur Apps Script (recharge la page) : il n'y a qu'un fichier **`Code.gs`** à gauche. Lance les fonctions demandées par la procédure du lot (`verifierConfig`, etc.), **comme aujourd'hui**.
8. **Mettre à jour le déploiement TEST** (même adresse ; tirets simples dans la description) :
   ```
   clasp update-deployment ID_DU_DEPLOIEMENT_TEST --description "Lot 2 - v6.0"
   ```
9. **Vérifier** : ouvre l'adresse TEST → elle doit afficher la nouvelle version (« Loué App API v6.0 OK »). Sinon : règle 2 de CLAUDE.md, préviens-moi.
10. **Fin de séance** :
    ```
    clasp logout
    ```

**Retour arrière** (même séance, ou une autre en refaisant l'étape 2) : recopie la sauvegarde voulue à la place de `Code.js` (regarde les noms dans `_prive/` : date puis heure), par exemple :
```
copy "$HOME\Documents\GitHub\chantier-pro\_prive\Code-TEST-avant-20261120-0930.gs" Code.js
```
puis refais les étapes 5, 6, 8 et 9. Pense aussi aux déclencheurs, comme dans la procédure du lot concerné (`retirerDeclencheurs` **avant** de revenir à un serveur plus ancien).

**Une fois par an environ** : Apps Script garde 200 versions au plus. Dans l'éditeur, **Historique du projet** → **suppression groupée** des vieilles versions (celles d'un déploiement actif ne sont pas proposées).

## À ne jamais faire

- Lancer `clasp clone-script` avec l'identifiant du **script de production** (tant que nous n'avons pas décidé ensemble de l'utiliser en production).
- `clasp push --force`, ou répondre « oui » à la question sur le manifeste.
- Lancer clasp depuis le dossier du dépôt GitHub, ou copier `.clasp.json` / `.clasprc.json` dans le dépôt, MEGA ou Google Drive.
- Prendre le `Code.gs` d'une autre branche que **`main`** (les autres branches contiennent des lots pas encore validés).
- Envoyer le manifeste du dépôt (`apps-script/appscript.json`) : il n'est pas utilisé. Son nom a d'ailleurs une faute (il manque un « s »), clasp l'ignorerait. Le bon manifeste est celui du projet, récupéré par `clasp clone-script`.

## Ce que je ferai, quand tu me le diras

- Ajouter dans chaque procédure de lot une variante « avec clasp » à côté du copier-coller.
- Te guider en direct pour l'installation (15 min), puis faire le premier envoi sur TEST ensemble.
- Rien en production sans une nouvelle décision de ta part.
