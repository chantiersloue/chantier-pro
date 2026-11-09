# Lot 2 — Comptes, rôles, accueil : procédure de déploiement et de test

> Pour Franck. **À commencer seulement quand le lot 1 est en production et que tu en es content.**
> Durée : environ 2 h sur TEST, puis 30 min en production, puis la distribution des mots de passe aux gars.
> **Ne passe à l'étape suivante que si la précédente est verte.** Sinon : arrête-toi et envoie-moi une capture.
> Les identifiants (dossiers, Sheet) sont dans `_prive/` : `ids-drive.txt` et `ids-test.txt`.

## Ce que le lot 2 change, en bref

| Pour qui | Avant | Après |
|---|---|---|
| Les gars, à l'ouverture | Menu commun à tous | **Connexion** une fois tous les 90 jours (identifiant + mot de passe), puis **« Mes chantiers »** : seulement les chantiers que tu as cochés pour eux |
| Les gars, dans un chantier | Choisir le chantier dans chaque fiche | Touche le chantier → ses fiches : **le chantier est déjà rempli** ; bouton **Plans** du chantier |
| Les gars, sans réseau ou sans compte | — | **« Remplir une fiche sans être connecté »** toujours proposé : la fiche est gardée et part après la connexion. Une fiche en attente n'est **jamais** perdue ni bloquée à cause du compte |
| Les conducteurs | — | « Mes chantiers » = ceux où ils sont dans la colonne D ; bouton **« Voir tous les chantiers »** |
| Toi, dans le Sheet | — | Onglets **Utilisateurs** (un compte par ligne, des cases à cocher) et **Accès chantiers** (une case par chantier et par poseur) |
| Sécurité | L'adresse du serveur suffit pour lire tous les contacts et chantiers | Sans compte, plus rien n'est lisible (après la période de transition de 15 jours) |
| Le Sheet *Chantiers* (9a) | A à D | Colonnes **E à K** ajoutées : N°, Nom court, Adresse, Client, Architecte, Date « Terminé », Chemin MEGA. Le **nom court**, s'il est rempli, sert au nom des PDF |
| Une fiche pour un chantier inconnu (faute de frappe) | Créait un nouveau dossier Drive | Le PDF va dans **`_À CLASSER`** à la racine du Drive, tu reçois un mail, les destinataires reçoivent la fiche normalement |
| Le nouvel onglet *Intervenants* | — | Créé vide : il sera rempli par ton skill `gestion-documentaire` (plus tard) |

**Ce qui ne change pas** : les fiches elles-mêmes, leurs PDF, leurs destinataires, le brouillon automatique, la file d'envoi.

**Limite à connaître** : les fichiers du dossier *Plans* et du *Planning* restent ouverts « à qui a le lien » (comme au lot 0). Un ancien salarié qui a gardé un lien peut encore l'ouvrir. Cela se règle avec le carnet de chantier (lot 4).

## Comment marchent les comptes (à lire une fois)

- **Créer un compte** : une ligne dans *Utilisateurs* (identifiant, nom, rôle, case **Actif**), puis coche **« Réinitialiser le mot de passe »**. Quelques secondes plus tard (au plus 10 min depuis le téléphone), un **mot de passe provisoire** apparaît dans la colonne F. Donne-le à la personne (de vive voix ou par SMS) : il sert **une fois**, pendant **48 h**. À sa première connexion, elle choisit son mot de passe et le provisoire s'efface.
  - Identifiant : minuscules, chiffres, `-` ou `_`. Conseil : prénom + 2 chiffres (`thomas27`), moins facile à deviner que `tmartin`.
  - Rôles : **Poseur** (ses chantiers cochés), **Atelier** (pareil, pour plus tard), **Conducteur** (tous les chantiers ; « Mes chantiers » = colonne D à son nom), **Admin** (tout, toi).
- **Lui donner un chantier** : onglet *Accès chantiers*, coche la case (ligne du chantier, colonne de son identifiant). Effet immédiat. Les lignes et colonnes s'ajoutent toutes seules (dans les 10 min). Case **« Tous les chantiers »** dans *Utilisateurs* pour un poseur qui va partout.
- **Mot de passe oublié, ou identifiant bloqué** (5 erreurs = 15 min de blocage) : coche **« Réinitialiser »** → nouveau provisoire, c'est débloqué, et **l'ancien mot de passe ne marche plus** (ses téléphones sont déconnectés).
- **Téléphone perdu, départ d'un salarié** : coche **« Déconnecter ses téléphones »** (et décoche **Actif** s'il part). À la requête suivante, son téléphone revient à l'écran de connexion. Si le mot de passe a pu être vu par quelqu'un : coche plutôt **« Réinitialiser »** (l'ancien mot de passe ne marche plus). Les fiches déjà dans son téléphone partent quand même (notées « compte désactivé »).
- **Ne relance pas `preparerOngletsLot2` pour « réparer »** : elle ne touche jamais à un onglet *Utilisateurs* existant (elle ne pose les cases qu'à la création).
- La colonne **État** dit où en est chaque compte (« connecté le … », « bloqué 12 min », « provisoire expiré »…).
- **Règle de sécurité** : le Sheet n'est partagé **qu'avec toi**. Quelqu'un qui peut le modifier peut lire la clé secrète du serveur. `verifierConfig` le contrôle.

## Les fichiers de la livraison

- **`A-COLLER-DANS-APPS-SCRIPT/Code.gs`** : tout le serveur, à coller tel quel (comme aux lots 0 et 1).
- **Demande de fusion `livraison/lot-2-essai`** (je la prépare quand tu me dis que le lot 1 est en production) : la copie d'essai du lot 2, branchée sur TEST.
- **Demande de fusion `livraison/lot-2`** (étape D) : les vraies pages du lot 2 avec l'adresse du nouveau serveur.

---

## Étape A — Serveur du lot 2 sur la copie TEST (20 min)

1. Fusionne **`livraison/lot-2-essai`**.
2. Sheet **« ChantierPro TEST »** → Extensions → Apps Script. **Sauvegarde** : tout `Code.gs` dans `_prive/Code-TEST-avant-lot2.gs`.
3. Colle le nouveau `Code.gs` (github.com → `A-COLLER-DANS-APPS-SCRIPT/Code.gs` → icône « Copy raw file » → dans l'éditeur Ctrl+A, Ctrl+V → disquette).
4. Vérifie que la propriété **`ENVIRONNEMENT`** vaut **`TEST`** (Paramètres du projet ⚙ → Propriétés du script). Elle existe depuis le lot 0.
5. Lance, une par une (choisir la fonction en haut, ▶ Exécuter), et lis le journal :
   - **`genererCle`** → « ✅ Clé secrète créée » ;
   - **`preparerOngletsLot2`** → onglets créés, colonnes E à K de *Chantiers*. **Si une ligne commence par ❌, arrête-toi et envoie-la-moi** ;
   - **`installerDeclencheurs`** → Google demande une nouvelle autorisation (« voir et modifier vos feuilles de calcul » : c'est pour les cases à cocher) : Paramètres avancés → Accéder → Autoriser ;
   - **`mesurerHachage`** → il donne un nombre (par exemple 3000). Ajoute la propriété **`HACHAGE_ITERATIONS`** avec ce nombre. **Note-le** : tu mettras le même en production ;
   - **`verifierConfig`** → que des ✅, sauf la ligne « Transition : pas commencée » (normal).
6. **Déployer → Gérer les déploiements** → déploiement TEST → ✏ Modifier → **Nouvelle version** → Déployer. Ouvre l'adresse TEST : **`Loué App API v5.0 OK`**. (Si l'ancienne version reste : Nouveau déploiement et envoie-moi l'adresse.)

## Étape B — Comptes d'essai (20 min)

1. Dans *Utilisateurs* du Sheet TEST, remplis 3 lignes **à partir de la ligne 2** :

   | Identifiant | Nom | Rôle | Actif |
   |---|---|---|---|
   | `franck01` | ton nom (liste) | Admin | ☑ |
   | `poseur01` | un nom de la liste | Poseur | ☑ |
   | `conduc01` | un conducteur de la liste | Conducteur | ☑ |

2. **Sur PC**, coche « Réinitialiser » de `franck01` : le provisoire doit apparaître **en quelques secondes**.
3. **Sur ton téléphone, dans l'appli Google Sheets**, coche « Réinitialiser » de `poseur01`. **Note le temps** avant que le provisoire apparaisse (quelques secondes, ou jusqu'à 10 min) et dis-le-moi : c'est le point que je ne peux pas vérifier moi-même.
4. Coche « Réinitialiser » de `conduc01`.
5. Attends 10 min (ou modifie n'importe quelle case de *Utilisateurs*) : l'onglet *Accès chantiers* a une colonne `poseur01` et une ligne par chantier. Coche **un** chantier pour `poseur01`.

## Étape C — Essais sur la copie d'essai (1 h)

Ouvre `https://chantiersloue.github.io/chantier-pro/essai/` (ou l'icône « Loué ESSAI »).

| # | Essai | Attendu |
|---|---|---|
| 1 | Ouvre l'appli | Écran **Connexion** |
| 2 | `poseur01` + un faux mot de passe | « Identifiant ou mot de passe incorrect. » |
| 3 | `poseur01` + son provisoire | Écran « Choisissez votre mot de passe » |
| 4 | Deux mots de passe différents, puis `12345678` | Messages clairs, rien n'est enregistré |
| 5 | Un vrai mot de passe (2 fois le même) | « Bonjour … », **un seul chantier** (celui coché) ; colonne F vide dans le Sheet, État « mot de passe choisi le … » |
| 6 | Touche le chantier → **Quitus** | Le chantier est **déjà rempli** ; **pas** de bandeau « Brouillon retrouvé » |
| 7 | Tape quelque chose, reviens, ouvre le quitus depuis un **autre** chemin (« Fiche sans chantier choisi ») | Bandeau « Brouillon retrouvé — chantier X » |
| 8 | Envoie un quitus | « ✓ Tout est envoyé », mail reçu ; onglet *Envois*, colonne G : `poseur01` |
| 9 | Dans le quitus, tape un chantier qui n'est pas le sien (un vrai chantier du Sheet) | Question « ne fait pas partie de vos chantiers… Envoyer quand même ? » → Oui → envoyé, rangé dans le dossier de ce chantier |
| 10 | Tape un chantier qui n'existe pas (« ESSAI FAUTE ») | Envoyé ; mail « Document à classer » ; PDF dans `_À CLASSER` ; **aucun** dossier « ESSAI FAUTE » créé |
| 11 | Chantier → **Plans** | La liste des plans du chantier |
| 12 | Mode avion → « Remplir une fiche sans être connecté » depuis l'écran de connexion (après « Se déconnecter » dans À propos) | La fiche se remplit et se range (« ⏳ en attente ») |
| 13 | Réseau revenu, reconnecte-toi | La fiche de l'essai 12 part toute seule |
| 14 | 5 faux mots de passe pour `poseur01` | « Identifiant bloqué encore 15 min » ; État « bloqué » dans le Sheet |
| 15 | Coche « Réinitialiser » de `poseur01` | Nouveau provisoire, plus de blocage |
| 16 | `conduc01` : connexion | Ses chantiers (colonne D) + bouton « Voir tous les chantiers » |
| 17 | Connecté en `conduc01` sur le téléphone, coche « Déconnecter ses téléphones » de `conduc01` dans le Sheet, puis rouvre l'accueil | Retour à l'écran de connexion, message « Session terminée » |
| 18 | Éditeur Apps Script : ▶ `finirTransitionMaintenant` (refusé en production, accepté sur TEST). Puis, **déconnecté**, remplis et envoie un quitus « sans être connecté » | La fiche **reste** « en attente — connectez-vous… » (jamais « à vérifier ») ; après connexion, elle part |
| 19 | Après l'essai 18 : ouvre `https://chantiersloue.github.io/chantier-pro/?env=test` (**pages du lot 1**) et envoie un quitus | Message « Appli à mettre à jour ou connexion nécessaire… » ; la fiche est gardée |
| 20 | ▶ `prolongerTransition` | « Transition prolongée jusqu'au … » ; l'essai 19 repasse |
| 21 | Onglet *Sans compte* | Les fiches envoyées sans compte sont notées |

Puis **sors du mode test** sur le vrai site : `https://chantiersloue.github.io/chantier-pro/?env=prod`.

Enfin, dans l'éditeur Apps Script **de la copie TEST** : ▶ **`retirerDeclencheurs`**. Les 90 minutes de déclencheurs par jour sont partagées par tout le compte Google : la copie TEST ne doit pas en consommer pour rien (`installerDeclencheurs` les remet si besoin).

## Étape D — Production (après ton feu vert sur l'étape C, 30 min)

Le serveur du lot 2 a sa **propre adresse** : l'ancien déploiement (lot 1) continue de servir les téléphones tant que les pages ne sont pas fusionnées. C'est aussi le retour arrière.

1. Vrai Sheet → Extensions → Apps Script. **Sauvegarde** de `Code.gs` dans `_prive/Code-avant-lot2.gs`.
2. **Gérer les déploiements** : note la **description** et l'**adresse** du déploiement actuel (lot 1) dans `_prive/deploiements.txt`.
3. Colle le nouveau `Code.gs`, enregistre.
4. ▶ `genererCle`, ▶ `preparerOngletsLot2` (**❌ = arrête-toi**), ▶ `installerDeclencheurs` (autorisation), ajoute la propriété **`HACHAGE_ITERATIONS`** (le nombre de l'étape A.5), ▶ `verifierConfig` (que des ✅ sauf « Transition : pas commencée »).
5. **Déployer → Nouveau déploiement** → type « Application Web », description **« Lot 2 — production »**, exécuter en tant que **moi**, accès **Tout le monde** → Déployer. **Envoie-moi l'adresse** : je prépare `livraison/lot-2` avec cette adresse.
6. Remplis *Utilisateurs* : une ligne par personne, **Actif** coché, **sans** cocher « Réinitialiser » pour l'instant. 10 min plus tard, coche les chantiers de chacun dans *Accès chantiers*.
7. Fusionne **`livraison/lot-2`**. Attends 3 min. Sur ton téléphone : écran Connexion. Coche « Réinitialiser » pour **toi**, connecte-toi, ouvre un chantier, envoie un quitus réel vers toi → reçu, colonne G de *Envois* à ton identifiant.
   - Les gars qui ne sont pas encore connectés touchent **« Continuer sans compte »** : l'appli marche comme avant (période de transition pas commencée).
8. **Le jour où tu vois les gars** : coche « Réinitialiser » pour chacun, donne-lui son provisoire (valable 48 h), et fais-le se connecter devant toi.
9. Quand tout le monde est connecté (l'onglet *Sans compte* ne bouge plus pendant 2 jours) : ▶ **`demarrerTransition`**. Encore 15 jours de tolérance ; tu reçois un mail 3 jours avant la fin. Si tu oublies, un mail te le rappelle chaque jour à partir de 7 jours après la première connexion.
10. **À la fin de la transition** : Gérer les déploiements → **archive** tous les anciens déploiements (lot 0, lot 1), en production **et** sur TEST. **N'archive jamais celui qui s'appelle « Lot 2 — production »** (son adresse est celle de `commun/config.js`). Les anciennes adresses sont lisibles dans l'historique public du dépôt : tant qu'elles marchent, elles exécutent l'ancien code sans compte.

## Retour arrière

| Problème | Que faire |
|---|---|
| Les gars ne peuvent plus travailler après la fusion de `livraison/lot-2` | Dis-le-moi : je prépare une demande de fusion qui remet **les pages du lot 1 et l'adresse du lot 1** (l'ancien déploiement tourne encore). Rien à faire dans Apps Script |
| Après l'archivage des anciens déploiements | Recolle `_prive/Code-avant-lot2.gs`, **Nouveau déploiement**, envoie-moi l'adresse (je remets les pages du lot 1 avec elle) |
| Un gars bloqué | Case « Réinitialiser » |
| Tout le monde bloqué après la fin de la transition | ▶ `prolongerTransition` (7 jours de plus) puis dis-le-moi |
| Clé secrète divulguée (quelqu'un a eu accès au script) | Ajoute la propriété `CONFIRMER_CHANGER_CLE` = `OUI`, puis ▶ `changerCle` : tout le monde devra se reconnecter |

## Ce que tu dois faire, en résumé

1. Me dire quand le lot 1 est en production (je prépare `livraison/lot-2-essai`).
2. Étapes A, B, C sur TEST, et me dire le temps de l'essai B.3 (case cochée depuis l'appli Sheets du téléphone).
3. Étape D en production, puis distribuer les mots de passe et lancer `demarrerTransition`.
