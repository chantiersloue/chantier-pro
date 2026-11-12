# Outillage : plan de mise en place

> Pour Franck. Plan du 12/11/2026, d'après tes six réponses à `docs/automatisation.md`, corrigé après la critique d'un agent indépendant.
> **Rien n'est encore construit ni installé.** Le lot 7 ne commence pas avant que cet outillage soit en place et vérifié.
> Ce document est public : il ne contient aucun identifiant secret. Les mots techniques sont expliqués au début de `docs/automatisation.md`.

## La commande (tes six décisions)

| # | Décision | Ta réponse |
|---|---|---|
| 1 | Porte de service sur TEST, absente de la production, avec la session d'essai | Oui |
| 2 | Jeton clasp | Solution A : le temps d'un envoi |
| 3 | clasp en production | On décide après le lot 7 |
| 4 | Copie d'essai hors du dépôt de production | Oui, dans une organisation GitHub gratuite |
| 5 | Demande de fusion de production | Lien pré-rempli |
| 6 | Verrouiller `main` | Oui, sans approbation obligatoire |

Trois étapes, **chacune utilisable seule** : si l'étape B ou C prend du retard, ce qui est fait avant sert déjà.

---

## Ce que tu fais toi-même, dans l'ordre

**Je ne peux faire aucun de ces gestes à ta place** : ce sont des réglages de tes comptes.

| Quand | Quoi | Durée |
|---|---|---|
| **Maintenant, quand tu veux** | Séance A (points 1 à 10) et séance B (points 1 à 13) | 5 min + 15 min |
| **Sur mon signal** | La vérification de A (3 clics) ; l'icône du téléphone (B.14) ; la séance C | 2 min ; 5 min ; 25 min |

### Séance A — Verrouiller `main` (5 min)

**Ce que ça change pour toi** : après ce réglage, plus rien n'entre dans `main` sans demande de fusion. Tu ne pourras donc plus déposer un fichier directement sur `main` depuis le site de GitHub (bouton « Upload files ») : même pour un seul fichier, GitHub te fera créer une demande de fusion. C'est voulu.

1. Ouvre `https://github.com/chantiersloue/chantier-pro` (connecté à ton compte GitHub).
2. Clique **Settings** (dans la barre d'onglets du dépôt ; s'il n'apparaît pas, il est dans le menu « ⋯ »).
3. Dans la colonne de gauche, clique **Branches**.
4. Clique **Add classic branch protection rule**. (Ne clique **pas** sur « Add branch ruleset » : c'est un autre réglage.)
5. Dans **Branch name pattern**, tape : `main`
6. Coche **Require a pull request before merging**.
7. Juste dessous apparaît **Require approvals**, probablement déjà cochée : **décoche-la**. C'est le point important : cochée, plus personne ne pourrait fusionner.
8. Plus bas, coche **Do not allow bypassing the above settings** (elle applique la règle à toi aussi, donc à moi).
9. Ne coche rien d'autre. Clique **Create** tout en bas. GitHub peut redemander ton mot de passe.
10. Envoie-moi **une capture de l'écran** qui s'affiche (la règle `main` enregistrée) et dis-moi « main est verrouillée ».

**Vérification, sur mon signal** : je te donne un lien pré-rempli pour une petite demande de fusion qui ne contient que des documents et des outils. Tu cliques **Create pull request**, **Merge pull request**, **Confirm merge**. Si « Merge » est grisé : envoie-moi une capture, ne force rien.

**Retour arrière** : Settings → Branches → à droite de la règle `main` → **Delete**.

### Séance B — L'organisation et le dépôt d'essai (15 min)

> Une **organisation** GitHub est un second espace rattaché à ton compte : même connexion, gratuit. Les écrans de création peuvent différer un peu de ce qui suit ; l'offre à choisir est toujours **Free** (0 $). Ton adresse mail GitHub doit être vérifiée (c'est le cas si tu reçois les mails de GitHub).

1. Sur github.com, clique ta photo en haut à droite → **Settings**.
2. Colonne de gauche, section **Access** → **Organizations** → bouton **New organization**.
3. Choisis l'offre **Free** (« Create a free organization »).
4. Remplis :
   - **Organization name** : un nom court, sans espace ni accent, par exemple `loue-essai`. Si le nom est pris, GitHub te le dit : essaie `louemenuiserie-essai`. **Ce nom sera dans l'adresse de la copie d'essai.**
   - **Contact email** : ton adresse.
   - **This organization belongs to** : **My personal account**.
5. GitHub peut te demander de résoudre un petit casse-tête (« Verify your account ») : c'est à toi de le faire. Coche la case d'acceptation des conditions d'utilisation, puis **Next**.
6. À l'écran qui propose d'inviter des membres : **Skip this step**. S'il y a un questionnaire : passe-le.
7. **Autoriser la connexion de ton PC à pousser dans cette organisation** (sinon mon premier envoi sera refusé) : sur la page de l'organisation → **Settings** → colonne de gauche, section **Third-party Access** → **OAuth app policy** → **Remove restrictions** → **Yes, remove application restrictions**. Sans risque ici : l'organisation ne contiendra qu'un dépôt public.
8. Reviens à la page de l'organisation. Clique **Create a new repository** (ou **Repositories** → **New repository**).
9. Remplis :
   - **Owner** : vérifie que c'est bien **l'organisation** (et pas `chantiersloue`) ;
   - **Repository name** : `chantier-pro`
   - **Public** (obligatoire pour que la publication soit gratuite) ;
   - coche **Add a README file**.
10. Clique **Create repository**.
11. Dans ce nouveau dépôt : **Settings** → colonne de gauche **Pages**.
12. Sous **Build and deployment** → **Source** : choisis **Deploy from a branch**. Dessous, le menu affiche « None » : choisis **main**, dossier **/ (root)**. Clique **Save**.
13. Dis-moi **le nom de l'organisation**.
14. **Sur mon signal** (copie d'essai publiée) : dans l'ancienne copie d'essai, vérifie que l'indicateur dit « ✓ Tout est envoyé » ; supprime l'ancienne icône « Loué ESSAI » ; ouvre la nouvelle adresse que je te donne, installe la nouvelle icône, et connecte-toi avec le compte d'essai `poseur01` (c'est un nouveau site pour le téléphone : il ne connaît pas ta session). Si la connexion est refusée, dis-le-moi.

**Retour arrière** : supprimer le dépôt (son **Settings** → tout en bas, **Delete this repository**) ou l'organisation. L'ancienne façon (dossier `essai/` dans `main`) reste dans l'historique : je peux la remettre.

### Séance C — clasp et la clé de la porte de service (25 min, sur mon signal)

**Attends mon signal** : je dois d'abord corriger `docs/clasp.md`, qui dit encore deux choses dépassées, et écrire la commande d'envoi.

**C.1 — Installer clasp (15 min).** Je te guiderai en direct avec `docs/clasp.md` mis à jour : installer clasp, activer « API Google Apps Script », créer le dossier `clasp-loue\TEST`, le relier au script **TEST**, contrôler le manifeste (le fichier de réglages du projet) et l'identifiant du déploiement TEST, effacer le jeton. Tu laisses l'API **activée** jusqu'à la fin de la séance C ; je te dirai quand la désactiver.

**C.2 — La clé de la porte de service (3 min).** Je la fabrique par une commande qui l'écrit dans ton fichier `_prive/cle-outils-test.txt` sans l'afficher : elle n'apparaît ni dans notre conversation ni sur GitHub.
1. Ouvre `_prive/cle-outils-test.txt`, sélectionne tout (Ctrl+A) et copie (Ctrl+C).
2. Sheet **« ChantierPro TEST »** → Extensions → Apps Script → ⚙ **Paramètres du projet** → **Propriétés du script** → **Modifier les propriétés du script** → **Ajouter une propriété**.
3. Nom : `CLE_OUTILS_TEST` ; valeur : la clé copiée → **Enregistrer**.
4. Vérifie que tu es bien dans le projet **TEST** (la propriété `ENVIRONNEMENT` y vaut `TEST`). **Ne mets jamais cette clé dans le projet de production.**

**C.3 — Les envois sur TEST (2 min chacun, 3 ou 4 fois pour cette étape).** C'est **toi qui lances la commande** : ainsi, le jeton de Google n'est jamais dans ma séance de travail.
1. Je te donne une ligne à copier dans PowerShell (du type `node outils\envoyer-test.js`, précédée du déplacement dans le bon dossier).
2. Une page Google s'ouvre : choisis le compte de Loué, **Autoriser**.
3. La commande fait tout le reste (vérification du projet TEST, sauvegarde, envoi, mise à jour du déploiement, contrôle, **effacement du jeton**) et finit par `✅ Envoi réussi` ou `❌ …`. Elle dure moins de 3 minutes.
4. Dis-moi « envoi fait » (je lis son compte rendu dans `_prive/envois/`). Si elle affiche ❌ ou reste figée plus de 5 minutes : ferme la fenêtre, rouvre PowerShell, tape `clasp logout`, et préviens-moi.

**Retour arrière** : `npm uninstall -g @google/clasp` ; désactiver « API Google Apps Script » ; retirer l'accès de clasp sur myaccount.google.com/connections ; supprimer la propriété `CLE_OUTILS_TEST` ; recoller dans le projet TEST le `Code.gs` de `main` (copier-coller, comme aujourd'hui).

---

## Ce que je construis

### Où va le code (règle importante)

Le lot 2 est en pleine transition (mots de passe à distribuer). Si un correctif urgent du lot 2 était nécessaire, il doit partir d'un serveur **identique à celui qui tourne** (v6.0.1). Donc :

- **Dans `main`, avant le lot 7 : seulement les outils du PC (`outils/`, `tests/`) et les documents.** Le serveur et son fichier à coller (`A-COLLER-DANS-APPS-SCRIPT/Code.gs`) n'y bougent pas.
- **Les changements du serveur** (moteur d'installation, accroche de la porte, empreinte) restent sur une branche de travail, `outillage`. Ils vont sur la copie TEST par clasp, et entreront en production **avec le lot 7**, sous son numéro de version.
- Un correctif urgent du lot 2 part de `main`, sans rien de l'outillage serveur.

### Étape A — Verrouillage, lien pré-rempli, installation en une fonction

| Fichier | Rôle |
|---|---|
| `outils/lien-fusion.js` (nouveau) | `node outils/lien-fusion.js <branche>` affiche le lien qui ouvre la demande de fusion pré-remplie : titre, description courte (contenu, empreinte du `Code.gs`, renvoi vers la procédure). **Refuse** si la branche n'est pas sur GitHub à l'identique, si elle ne se fusionne pas sans conflit avec `main`, ou si la livraison n'est pas à jour. Écrit **avant** la vérification de la séance A |
| `apps-script/Installation.gs` (nouveau, branche `outillage`) | Le moteur d'installation (détail ci-dessous) |
| `outils/construire.js`, `tests/gas-harness.js` | `Installation.gs` ajouté au serveur ; le faux Apps Script des tests apprend à retirer un seul déclencheur |
| `tests/outils.test.js` (nouveau) | Tests du lien (adresse bien formée, accents et retours à la ligne, refus) et du moteur d'installation |
| `docs/guide-outillage.md` (nouveau) | Mode d'emploi court de l'outillage |

**Le moteur d'installation.** Une installation est une liste d'étapes. Chaque étape a **deux parties** : une question « est-ce déjà fait ? », qui lit l'état réel (la clé existe-t-elle ? l'onglet existe-t-il ? le déclencheur est-il là ? la propriété est-elle réglée ?), et une action, lancée **seulement** si la réponse est non.
- Une étape déjà faite n'est **jamais** rejouée : rien n'est réécrit, aucun réglage fait à la main n'est écrasé, aucune propriété existante n'est modifiée.
- Arrêt à la première erreur (❌) ; bilan ligne par ligne dans le journal et dans un onglet *Installation* (50 dernières lignes gardées).
- Deux fonctions par lot, `installerLotNTest` et `installerLotNProduction`. Chacune vérifie l'environnement **et** le nom du Sheet (« … TEST … » ou non), et refuse si l'un des deux ne correspond pas.
- Sur TEST, l'installation n'installe pas les déclencheurs en permanence (quota partagé avec la production) : ils sont posés au début d'une série d'essais et retirés à la fin.

**Démonstration sans attendre le lot 7** : une seule fonction, `controlerInstallationLot2`, qui passe les étapes du lot 2 en mode **« contrôle seul »** : elle pose les questions « déjà fait ? », affiche le bilan, et **n'écrit rien** d'autre que ce bilan. Elle ne relance ni `preparerOngletsLot2`, ni `installerDeclencheurs`, ni `mesurerHachage`. Je ne livre **pas** de fonction d'installation du lot 2 pour la production : elle ne servirait à rien et pourrait être lancée par erreur.

**Choix comparés**
- *Lien* : paramètres d'adresse de GitHub (retenu, documenté, rien à installer) contre l'outil `gh` (écarté par ta décision n° 5).
- *Verrouillage* : règle classique (retenue : 4 cases, écran simple) contre les « rulesets », plus récents et plus compliqués à régler.
- *Étapes d'installation* : question « déjà fait ? » avant chaque action (retenu) contre « relancer les fonctions existantes » (écarté : certaines réécrivent des titres de colonnes ou recréent les déclencheurs à chaque appel).

**Utilisable seule** : le lien et le verrouillage servent dès la première demande de fusion. Le moteur est vérifié par les tests, puis en vrai sur TEST à l'étape C.

### Étape B — La copie d'essai dans l'organisation

| Fichier | Rôle |
|---|---|
| `outils/essai-cible.json` (nouveau) | Le nom de l'organisation et du dépôt d'essai (information publique) |
| `outils/essai.js` (modifié) | Fabrique la copie d'essai **dans un dossier voisin, hors du dépôt** (`..\chantier-pro-essai\`), obtenu une fois par une copie du dépôt de l'organisation. Avant de toucher à ce dossier, il **refuse** si ce n'est pas exactement le dossier attendu ou s'il n'est pas relié au dépôt de `essai-cible.json`. Il le vide **sans jamais toucher à son dossier `.git`**. La copie garde le bandeau rouge et le mode TEST forcé, reçoit un `README`, un `.nojekyll` et une ligne qui demande aux moteurs de recherche de ne pas la référencer |
| `outils/publier-essai.js` (nouveau) | Refait les mêmes contrôles, fabrique, enregistre un nouvel état (jamais d'écrasement forcé), pousse, attend la publication et contrôle que l'adresse affiche la bonne version (en contournant le cache de GitHub) |
| `docs/*`, `sw.js` (commentaire) | Les mentions de `essai/` et de l'ancienne adresse sont corrigées |

**Ce que j'ai vérifié dans le code** : rien ne dépend de l'adresse `chantiersloue.github.io` dans les pages ni dans le serveur ; le service worker (la partie de l'appli qui garde les pages dans le téléphone), les icônes et le manifeste utilisent des chemins relatifs ou `/chantier-pro/`, qui reste le même. **Ce qui reste à essayer** : les appels au serveur TEST depuis la nouvelle adresse.

**Vérifications** : page ouverte dans un Chrome piloté, en largeur téléphone et PC (bandeau rouge, version dans « À propos », mode TEST, appli installable, appel au serveur TEST) ; contrôle que la mémoire de la copie d'essai est séparée de celle du vrai site ; puis ton geste B.14 et une fiche d'essai envoyée depuis ton téléphone.

**Utilisable seule** : dès qu'elle est publiée, la copie d'essai sert, même sans clasp (le serveur TEST se met alors à jour par copier-coller, comme aujourd'hui).

### Étape C — clasp et la porte de service

Dans cet ordre, parce que la porte dépend d'un point non vérifié :

0. **`docs/clasp.md` corrigé** avant ta séance C (jeton effacé après chaque envoi ; sur TEST, envoi depuis la branche de travail ; c'est toi qui lances la commande).
1. **`outils/envoyer-test.js`** : la commande que tu lances. Elle vérifie qu'aucun jeton ne traîne, ouvre la connexion Google, vérifie que le projet relié est bien celui de la copie TEST (identifiant que tu colles au premier envoi, mémorisé dans `_prive/script-test-id.txt` ; présence du déploiement TEST ; absence du déploiement de production), sauvegarde le serveur en ligne dans `_prive/`, assemble le serveur en **un seul fichier**, l'envoie, met à jour le déploiement, contrôle l'empreinte, **efface le jeton** (et supprime le fichier du jeton en secours si l'effacement échoue), puis écrit son compte rendu dans `_prive/envois/`. Chaque étape a une durée limite.
   - *L'empreinte* : une suite de caractères calculée sur le code au moment de l'assemblage et écrite dedans. Le serveur la renvoie dans sa réponse de contrôle (`ping`). La commande compare celle du fichier qu'elle vient d'envoyer à celle que le serveur renvoie. Le texte « Loué App API v… OK » de l'adresse ne change pas.
   - *Solutions comparées* : toi qui lances la commande (retenu : le jeton n'entre jamais dans ma séance, durée bornée) contre « tu te connectes, puis je lance » (le jeton reste sur le PC tant que je n'ai pas fini, et si ma séance s'interrompt il y reste).
2. **Essai de faisabilité n° 1** (ton premier envoi) : une porte minimale avec un seul geste, « poser puis retirer un déclencheur ». **Si Google refuse** : la porte est construite sans ce geste, et tu gardes 1 clic ▶ sur TEST pour les déclencheurs.
3. **`apps-script-test/OutilsTest.gs`** (dossier à part, jamais dans le serveur de production) : la porte complète, liste fermée de gestes :
   - lancer : l'installation du lot, `traiterComptes`, `finirTransitionMaintenant`, `prolongerTransition`, poser et retirer les déclencheurs ;
   - lire : les dernières lignes d'*Envois*, l'état d'un compte d'essai, le bilan d'installation, la présence d'un fichier dans le dossier TEST, les mails encore possibles ;
   - écrire, sur **trois comptes d'essai fixes** (`auto-poseur`, `auto-conducteur`, `auto-admin`, créés une fois et réutilisés) : cocher leurs cases, leur ouvrir une session d'essai ;
   - nettoyer : fermer les sessions d'essai (elles sont annulées côté serveur, pas seulement oubliées), mettre à la corbeille les fichiers marqués « AUTO ».
4. **Une ligne d'accroche** dans `apps-script/Api.gs` : « si la porte existe, lui passer l'action `outilTest` ». Sans la porte, l'action répond « inconnue », comme n'importe quelle action qui n'existe pas.
5. **`outils/construire.js`** : refuse de fabriquer un `Code.gs` de production qui contiendrait la porte. Le serveur « avec porte » n'est assemblé que par `envoyer-test.js`, dans le dossier clasp, jamais dans le dépôt.
6. **`verifierConfig`** : ❌ si la porte ou sa clé sont présentes hors de TEST.
7. **`tests/reel.js`** : la bibliothèque des futurs tests réels (appeler la porte, ouvrir une session d'essai dans le Chrome piloté, refuser de démarrer sous 40 mails restants). La clé n'est jamais écrite dans un compte rendu ni une capture.
8. **Un test réel de démonstration** : `controlerInstallationLot2` sur TEST, déclencheurs posés, session d'essai `auto-poseur`, un quitus envoyé depuis la copie d'essai (1 mail), sa ligne lue dans *Envois*, nettoyage, déclencheurs retirés.
9. **Dernier envoi sur TEST** : le serveur **sans porte**, pour vérifier la bascule entre les deux.
10. Fin : tu désactives « API Google Apps Script » ; `PLAN.md` (règle 1 : l'entorse acceptée), `docs/structure-sheet.md` (onglet *Installation*), `DECISIONS.md` et `CHANGELOG.md` à jour.

**Règles de sécurité de la porte**
- Clé de 32 caractères au moins ; clé absente, courte ou fausse = refus ; elle voyage dans le corps de l'appel, jamais dans l'adresse.
- Refus si `ENVIRONNEMENT` ≠ `TEST`, si le Sheet ne s'appelle pas « … TEST … », ou si le dossier Drive racine ne s'appelle pas « … TEST … ».
- Gestes écrits en toutes lettres ; comptes `auto-…` seulement.
- **La session d'essai** ne saute que l'écran de connexion, sur TEST. Vérifié dans le code : un jeton de session fabriqué sur TEST est refusé par la production (clé de signature différente et marque d'environnement différente). Elle dure comme une session normale, mais le nettoyage l'annule côté serveur.

**Tests automatiques** : bonne clé hors de TEST = refusé ; clé absente, courte ou fausse = refusé ; geste inconnu = refusé ; compte qui ne commence pas par `auto-` = refusé ; `Code.gs` de production + action `outilTest` = « action inconnue » ; `envoyer-test.js` refuse un mauvais identifiant de projet ; `essai.js` et `publier-essai.js` refusent un mauvais dossier ou un mauvais dépôt.

---

## Les essais de faisabilité (« Non vérifié » de l'étude) et leur repli

| # | Point | Vérifié quand | Si ça échoue |
|---|---|---|---|
| 1 | La porte peut poser et retirer des déclencheurs | **Réussi le 12/11/2026** (premier envoi par clasp : réussi aussi) | — |
| 2 | La copie d'essai marche à la nouvelle adresse, appels au serveur TEST compris | **Réussi le 12/11/2026** : navigateur, puis téléphone de Franck (icône, connexion, quitus envoyé et reçu) | — |
| 3 | Le lien pré-rempli (accents, retours à la ligne) ; le premier envoi vers l'organisation | **Réussi le 12/11/2026** | — |
| 4 | Le verrouillage de `main` laisse marcher ton bouton « Merge » | **Réussi le 12/11/2026** | — |

## Risques et parades

| Risque | Parade |
|---|---|
| « Require approvals » restée cochée : plus aucune fusion possible | Écrit en gras ; ta capture ; vérifié par la première demande de fusion ; réparable en un clic |
| La copie d'essai poussée dans le dépôt de production | `essai.js` et `publier-essai.js` vérifient le dossier et le dépôt relié ; `main` de production est verrouillée (A avant B) |
| `essai.js` qui efface un mauvais dossier | Contrôle du dossier avant tout effacement ; test automatique |
| Le serveur TEST « avec porte » collé en production | Jamais écrit dans le dépôt ; `construire.js` et `verifierConfig` le refusent |
| Un correctif urgent du lot 2 qui embarquerait l'outillage | Le serveur ne bouge pas dans `main` avant le lot 7 |
| La clé de la porte divulguée | Elle n'ouvre que des gestes sur des données d'essai de TEST ; changée en 2 minutes |
| Jeton clasp resté sur le PC | Tu lances la commande, elle l'efface à la fin ; consigne `clasp logout` si elle se fige ; contrôle au début de chacune de mes séances |
| Quotas partagés avec la production | Le test de démonstration envoie 1 mail ; déclencheurs TEST retirés à la fin |
| Copie d'essai publique en permanence | Mode TEST forcé, bandeau rouge, non référencée ; elle ne peut écrire que dans la copie TEST |

## Ce qui ne change pas

- Aucune mise en production pour l'outillage : le serveur de production reste en v6.0.1 jusqu'au lot 7.
- Aucune fonctionnalité de l'appli n'est modifiée ni retirée. Le brouillon automatique n'est pas touché.
- Tout est gratuit : GitHub (dépôts publics, organisation Free, Pages, protection de branche), clasp, Node.js déjà installé.
- Je ne touche jamais au vrai Sheet ni au projet Apps Script de production.

## Quand l'outillage sera « en place et vérifié »

1. `main` verrouillée (ta capture), une demande de fusion passée par le lien pré-rempli.
2. La copie d'essai publiée dans l'organisation, ouverte sur ton téléphone, une fiche d'essai envoyée.
3. Un envoi sur TEST par clasp réussi, jeton effacé, empreinte contrôlée.
4. Le test réel de démonstration passé, puis le serveur TEST remis sans porte.
5. Une relecture indépendante de l'ensemble, corrections faites (3 tours au plus).
6. Compte-rendu, `CHANGELOG.md` et `docs/guide-outillage.md` à jour.

Alors seulement, le lot 7 peut commencer.
