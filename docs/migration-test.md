# Copie TEST dans un second compte Google (option C) : plan de migration

> Décision de Franck du 13/11/2026 (D-OUT-1) : option C de `docs/automatisation.md` (piste 2). **But** : que Claude envoie lui-même le serveur sur la copie TEST, sans que Franck soit au bureau, avec un jeton qui **n'ouvre pas la production**.
> **Version 2**, après critique par un agent indépendant (ce qu'elle a fait changer : chapitre 10). Rien n'est fait tant que Franck n'a pas validé ce plan. La production n'est pas touchée : elle reste dans le compte de Loué, mise à jour par Franck au copier-coller depuis un navigateur.

## 1. Le principe

| | Aujourd'hui | Après la migration |
|---|---|---|
| Copie TEST (Sheet, Drive, serveur d'essai) | dans le compte Google de Loué, à côté de la production | dans un **second compte Google gratuit**, qui ne contient rien d'autre |
| Jeton clasp sur le PC | celui du compte de Loué (ouvre aussi la production) : Franck le pose 2 minutes à chaque envoi | celui du second compte, posé **une fois**, rangé à part ; il ne peut ouvrir que la copie TEST |
| Qui envoie sur TEST | Franck, au bureau | **Claude**, à tout moment |
| Production | Franck, copier-coller dans le navigateur | **inchangé** |

**Le mur, et ce qui le ferait tomber.** Le second compte ne doit **jamais** recevoir de partage venant de la production, même en lecture :
- s'il devenait **éditeur du vrai Sheet**, son jeton pourrait modifier le serveur de production (le serveur est lié au Sheet) ;
- s'il recevait un partage du **vrai Drive**, son jeton pourrait lire les noms des fichiers (chantiers, clients).

Tant qu'aucun partage n'existe, rien de ce que je fais avec ce jeton ne peut atteindre la production. À savoir aussi : avec ce jeton, je peux tout faire **dans le second compte** (son Sheet, son Drive, envoyer des mails en son nom). C'est pourquoi il ne doit contenir que des données d'essai.

## 2. Solutions comparées

| Sujet | Retenu | Écarté | Raison |
|---|---|---|---|
| Où mettre TEST | **second compte Google gratuit** | compte de service Google Cloud (projet Cloud, clé à garder, plus technique) ; garder le jeton « 2 minutes » (exige Franck au bureau) | gratuit, simple, et c'est un vrai mur |
| Copier le Sheet et le serveur | **« Créer une copie » du Sheet TEST depuis le second compte** : le serveur d'essai lié est copié avec lui (confirmé par la documentation de Google : celui qui copie devient propriétaire du script copié) | repartir d'un Sheet vide | une seule manipulation ; les onglets et les listes suivent |
| Le Drive TEST | **un dossier neuf et vide** ; le serveur y recrée ce qu'il lui faut | copier ou transférer l'ancien dossier d'un compte à l'autre (long, incertain) | les données de TEST sont jetables |
| Les comptes d'essai de l'appli | **réinitialisés** dans le nouveau Sheet | recopier la clé secrète de l'ancien projet | une clé secrète ne se promène pas d'un compte à l'autre |
| Poser le jeton du second compte | par Franck **au bureau**, une fois | à distance, en ouvrant un lien de connexion que je lui donnerais : s'il choisissait par erreur le compte de Loué, **un jeton de production naîtrait dans ma séance** ; un logiciel de bureau à distance : un outil de plus, et tout le PC exposé | le seul geste qui ne peut pas mal tourner |
| Où ranger ce jeton | dans **un fichier à part**, hors du dépôt, de MEGA et du Drive ; mon outil ne lit que celui-là | l'emplacement habituel de clasp | un futur `clasp login` de Franck sur le compte de Loué ne peut pas se mélanger avec lui |

## 3. Ce que Franck fait, pas à pas

### Partie A — sur un PC, hors du bureau si tu veux (40 minutes)

Sur un **ordinateur** (pas le téléphone : l'éditeur Apps Script y est inutilisable).

**Règle obligatoire pour les étapes 3 à 10 : une fenêtre de navigation privée où SEUL le second compte est connecté.** Dans cette fenêtre, tu ne peux pas ouvrir la production par erreur. (Poser le réglage « TEST » dans le vrai projet déconnecterait tout le monde.)

1. **Créer le compte** (fenêtre privée) : accounts.google.com → « Créer un compte » → usage personnel. Nom au choix (par exemple « Loué Essais »). Google demande en général un numéro de téléphone. Active la **validation en deux étapes**. Ce compte ne sert qu'à la copie TEST.
2. **Dans le compte de Loué** (fenêtre normale), préparer l'ancienne copie :
   - ouvre **« ChantierPro TEST »** (vérifie le nom : pas le vrai Sheet) → Extensions → Apps Script → lance la fonction **`anonymiserCopieTest`** (elle remplace les adresses mail des contacts par des adresses d'essai) ;
   - ⚙ Paramètres du projet → Propriétés du script : **note la valeur de `HACHAGE_ITERATIONS`** (un nombre) ;
   - Partager → ajoute l'adresse du second compte en **Lecteur**. Vérifie, dans ⚙ du partage, que « les lecteurs peuvent télécharger, imprimer et copier » est coché.
3. **Copier le Sheet** (fenêtre privée, second compte) : ouvre le Sheet partagé → Fichier → **Créer une copie** → nom « ChantierPro TEST » → dans « Mon Drive ».
4. **Retirer le partage** de l'étape 2 (compte de Loué → Partager → retirer le second compte). **Le mur est en place.**
5. **Nettoyer la copie** (second compte) : dans les onglets *Envois*, *Mails en attente*, *Signalements*, *Sans compte*, *Dossiers chantiers*, *Partages* et *Migration (lot 1)*, supprime toutes les lignes **sous la ligne de titres** (ces lignes parlent de fichiers de l'ancien compte). Dans *Utilisateurs*, ne garde que tes comptes d'essai.
6. **Créer les deux dossiers Drive** (second compte) : **« CHANTIERPRO-TEST »** et **« Planning TEST »**. Note l'identifiant de chacun (la suite de lettres et de chiffres à la fin de l'adresse quand le dossier est ouvert).
7. **Régler le serveur d'essai** : dans la copie → Extensions → Apps Script → ⚙ Paramètres du projet → **Propriétés du script**. **Si la liste n'est pas vide, supprime tout ce qui s'y trouve.** Puis ajoute :
   - `ENVIRONNEMENT` = `TEST`
   - `DRIVE_ROOT_ID` = l'identifiant de « CHANTIERPRO-TEST »
   - `DRIVE_PLANNING_ID` = l'identifiant de « Planning TEST »
   - `EMAIL_ADMIN` = ton adresse
   - `HACHAGE_ITERATIONS` = le nombre noté à l'étape 2
   Vérifie aussi que l'onglet **Déclencheurs** (réveil, à gauche) est vide.
8. **Autoriser et contrôler** : dans l'éditeur, lance **`genererCle`**. Google demande d'autoriser : choisis le second compte ; à l'écran « Google n'a pas validé cette application », clique **Paramètres avancés → Accéder à … (non sécurisé)** ; s'il y a des cases, **coche-les toutes** ; Autoriser. Puis lance **`verifierConfig`** : aucun ❌ (deux points « à faire » sont normaux à ce stade : la période sans compte et la porte de service).
9. **Activer l'API Apps Script** de ce compte : script.google.com/home/usersettings → « API Google Apps Script » → **Activé**.
10. **Me donner** (pas des secrets, mais je les range dans `_prive/`) : l'identifiant du script (⚙ Paramètres du projet → ID du script), l'identifiant du Sheet, les deux identifiants de dossiers, et l'adresse mail du second compte.

À ce stade **rien n'a changé pour toi ni pour moi** : l'ancienne copie TEST reste celle qui sert, la copie d'essai aussi.

### Partie B — au bureau, une seule fois (15 minutes)

11. **La clé de la porte de service** : dans la fenêtre privée du second compte, Propriétés du script → ajouter `CLE_OUTILS_TEST` = le contenu du fichier que je t'indiquerai dans `_prive/` (une clé neuve ; elle ne passe pas par cette conversation).
12. **Le déploiement** : dans l'éditeur → Déployer → Nouveau déploiement → Application Web → Exécuter en tant que : **moi** → Qui a accès : **Tout le monde** → Déployer. Copie l'adresse dans le fichier de `_prive/` que je t'indiquerai.
13. **Le jeton** : dans PowerShell, dans le dossier du dépôt, la commande que je te donnerai. Une page Google s'ouvre : **choisis le second compte**, « Autoriser ». La commande vérifie que le compte connecté est bien le second **et qu'il ne voit qu'un seul projet** ; sinon elle efface tout et te le dit. Elle range le jeton à part, relie un **nouveau** dossier clasp au nouveau projet, fait un premier envoi et contrôle que le bon serveur répond.
14. *(Facultatif, pour les essais de dépôt de plans depuis le PC)* : ajouter le second compte à Google Drive pour ordinateur. Il apparaît avec **une autre lettre de lecteur** : je règle le dépôt d'essai sur celle-là, et le programme refuse toute racine dont le nom ne contient pas « TEST ».

Dans la même séance, juste après l'étape 13, **je bascule** : nouvelle adresse de TEST dans `commun/config.js`, copie d'essai republiée, comptes et chantier d'essai recréés par la porte, séries d'essais réels rejouées. Tu devras te **reconnecter** une fois sur la copie d'essai (ton ancienne session ne vaut plus).

### Ce qui peut se faire hors du bureau

Les étapes 1 à 10 (sur un ordinateur). Les étapes 11 à 13 demandent le PC du bureau, **une seule fois**. Jusque-là, les envois continuent comme aujourd'hui.

## 4. Ce que je fais

- **Avant** : j'écris le mode « second compte » de `outils/envoyer-test.js` et ses tests — jeton lu dans son fichier à part (jamais l'emplacement habituel de clasp, que l'outil continue d'effacer) ; avant chaque envoi : **compte connecté = le second compte**, **un seul projet visible**, **identifiant du projet = celui mémorisé** ; sinon refus. Nouveau dossier clasp et nouveaux fichiers `_prive/` (l'ancien jeu reste intact). Un geste de la porte « rien n'est partagé avec ce compte », rejoué avant chaque série d'essais.
- **Après l'étape 13** : bascule, puis essais réels des lots 3 et 7 ; ceux du carnet (lot 4) avec un faux dépôt par la porte tant que l'étape 14 n'est pas faite.
- **À chaque envoi ensuite** : sauvegarde du serveur en ligne dans `_prive/`, envoi, contrôle de l'empreinte, compte rendu dans `_prive/envois/` — comme aujourd'hui, mais sans toi.

## 5. Ce qui change, et ce qui ne change pas

- **Change** : l'adresse du serveur de TEST ; les mots de passe de tes comptes d'essai (réinitialisés ; je relance le traitement par la porte) ; les mails d'essai partent du second compte (ils peuvent arriver dans tes indésirables la première fois) ; TEST a **ses propres quotas** (100 destinataires de mails par jour, 15 Go), séparés de la production ; la « période sans compte » de la nouvelle copie repart de zéro ; le dossier Planning de TEST est vide.
- **Ne change pas** : la production, son Sheet, son Drive, son adresse, ta façon de la mettre à jour ; l'adresse de la copie d'essai ; le bandeau rouge « MODE TEST ».
- **L'ancienne copie TEST** est gardée intacte deux semaines. Ensuite : corbeille, et dans le compte de Loué, retirer l'accès de « clasp » (Compte Google → Sécurité → Accès tiers) et **désactiver l'API Apps Script**.

## 6. Risques et parades

| Risque | Parade |
|---|---|
| Le second compte reçoit un partage de la production (le mur tombe) | règle écrite ; avant chaque envoi, l'outil refuse si le compte voit plus d'un projet ; geste de la porte « rien n'est partagé avec ce compte » |
| Se tromper de compte dans le navigateur | fenêtre privée avec le seul second compte, **obligatoire** ; le Sheet garde son nom « ChantierPro TEST » |
| `clasp login` fait avec le compte de Loué à l'étape 13 | la commande lit le compte connecté et **refuse** ; elle efface le jeton |
| Le jeton du second compte fuit | il n'ouvre que le second compte ; on le révoque (Compte Google → Sécurité → Accès tiers) et on refait l'étape 13 |
| Le jeton expire (6 mois sans usage, d'après la documentation de Google) ou est révoqué | retour au bureau pour refaire l'étape 13 ; en attendant, l'ancienne façon de faire |
| Google bloque ou ferme un compte neuf | validation en deux étapes, numéro de secours ; au pire, retour à l'ancienne copie |
| La copie emporte des réglages ou des données de l'ancien compte | étape 7 : tout supprimer avant d'ajouter ; étape 5 : lignes vidées ; étape 2 : adresses anonymisées |
| Un essai envoie un mail à une vraie personne | adresses anonymisées avant la copie ; contrôle « à qui partiraient les mails » rejoué par la porte avant tout essai |
| Deux lecteurs Drive sur le PC : déposer des plans d'essai dans la production | le programme de dépôt d'essai refuse une racine sans « TEST » ; chemin réglé dans `_prive/` |

## 7. Retour arrière

L'ancien jeu complet reste en place (ancienne copie TEST, ancien dossier clasp, anciens fichiers de `_prive/`, ancienne clé). Pour revenir : je remets l'ancienne adresse de TEST dans `commun/config.js`, je republie la copie d'essai, et les envois reprennent comme avant (toi, au bureau). Aucune donnée réelle n'est concernée.

## 8. Ce que cela coûte

Rien : un compte Google gratuit. Ses quotas (15 Go, 100 destinataires de mails par jour, 6 minutes par exécution) suffisent largement ; Google précise qu'ils peuvent changer sans préavis.

## 9. Ce que je te demande de valider

1. Le principe : second compte, Drive TEST neuf et vide, comptes d'essai réinitialisés.
2. Les étapes 11 à 13 **au bureau**, une fois.
3. L'ancienne copie TEST gardée deux semaines.

## 10. Ce que la critique indépendante a fait changer (13/11/2026)

- La clé de la porte et le déploiement passent **au bureau** (la clé est dans un fichier du PC) ; l'adresse de TEST ne change qu'au moment de la bascule, pas avant.
- Les réglages du script : « tout supprimer avant d'ajouter » (rien ne garantit qu'ils ne sont pas copiés avec le Sheet).
- Les fonctions à lancer sont celles qui existent déjà (`genererCle`, `verifierConfig`) ; aucune fonction nouvelle n'est nécessaire dans la copie.
- Fenêtre privée avec le seul second compte : obligatoire.
- Le jeton est rangé dans un fichier à part ; l'ancien jeu (dossier clasp, fichiers de `_prive/`) reste intact pour le retour arrière.
- Le mur est décrit complètement (Sheet **et** Drive), et les garde-fous à écrire sont listés.
- Anonymisation et nettoyage des onglets avant et après la copie ; écran d'autorisation décrit ; « sur un ordinateur, pas sur le téléphone ».
- Sources vérifiées par le critique : documentation Google sur les scripts liés (la copie d'un Sheet copie son script), sur les jetons (expiration à 6 mois sans usage) et sur les quotas.
