# Lot 2 — Comptes, rôles, accueil : procédure de déploiement et de test

> Pour Franck. Le lot 1 est en production depuis le 10/11/2026 (serveur **v5.1**). Le lot 2 passe le serveur en **v6.0.1** et l'appli en **6.0.1** (6.0 + le correctif de l'essai 12).
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
- **Départ d'un salarié** : décoche **Actif**. Tout de suite, il ne voit plus ni chantiers ni plans. Les fiches restées dans son téléphone partent encore **pendant 7 jours** (notées « compte désactivé » dans *Envois*), puis plus rien. Pour le réactiver : recoche **Actif**.
- **Téléphone perdu ou volé** : coche **« Réinitialiser »** (l'ancien mot de passe ne marche plus, tous ses téléphones sont déconnectés) et donne-lui le nouveau provisoire. Les fiches restées dans le téléphone perdu ne partiront pas sans connexion.
- **« Déconnecter ses téléphones »** seul : pour forcer une nouvelle connexion avec le même mot de passe (téléphone prêté et rendu, par exemple).
- **Identifiant bloqué de nouveau juste après « Réinitialiser »** (alors que la personne n'a rien tapé) : quelqu'un essaie de deviner ses mots de passe. Tu reçois aussi un mail « Beaucoup de connexions ratées ». Préviens-moi.
- **Ne relance pas `preparerOngletsLot2` pour « réparer »** : elle ne touche jamais à un onglet *Utilisateurs* existant (elle ne pose les cases qu'à la création).
- La colonne **État** dit où en est chaque compte (« connecté le … », « bloqué 12 min », « provisoire expiré »…).
- **Règle de sécurité** : le Sheet n'est partagé **qu'avec toi**. Quelqu'un qui peut le modifier peut lire la clé secrète du serveur. `verifierConfig` le contrôle.

## Les fichiers de la livraison

- **`A-COLLER-DANS-APPS-SCRIPT/Code.gs`** : tout le serveur, à coller tel quel (comme aux lots 0 et 1).
- **Demande de fusion `livraison/lot-2-essai`** (fusionnée, essais faits) puis **`livraison/lot-2-essai-2`** (correctif 6.0.1, section ci-dessous) : ajoute au site la copie d'essai du lot 2 (dossier `essai/`, toujours branchée sur TEST) et le nouveau `Code.gs` (v6.0). **Le vrai site n'est pas touché** : les gars continuent avec le lot 1.
- **Demande de fusion `livraison/lot-2`** (étape D, je la prépare quand tu m'envoies l'adresse du nouveau déploiement de production) : les vraies pages du lot 2 avec cette adresse ; elle retire la copie d'essai.

**Ce qu'il te faut avant de commencer** : ton PC ; ton téléphone ; un 2e téléphone si tu peux (sinon le tien suffit, en te déconnectant entre deux essais) ; 3 noms de la liste *Contacts* du Sheet TEST (toi, un poseur, un conducteur) ; environ 2 h devant toi. Rien à acheter, rien à installer sur le PC.

---

## Correctif après tes essais (6.0.1) — à faire avant l'étape D (30 min)

> Tes essais 1 à 11 et 14 à 21 sont validés. L'essai 12 a montré un vrai défaut, corrigé ici, et l'essai 14 une petite amélioration.

| Quoi | Ce qui change |
|---|---|
| **Essai 12 — bouton bloqué sur « Rangement dans le téléphone… »** | Reproduit sur PC : quand un **autre onglet** de l'appli (souvent un onglet Chrome resté ouvert en arrière-plan, qu'Android fige) garde la mémoire du téléphone occupée, la page attendait **sans limite**. Maintenant : au bout de 12 s, la fiche part **directement** s'il y a du réseau ; sinon un message dit quoi faire (garder la page ouverte, fermer les **autres** onglets de l'appli dans Chrome, toucher Envoyer de nouveau) et le texte reste en brouillon. Jamais de fiche en double. **Le même défaut existe dans l'appli 5.1 en production** : il est corrigé à part, par la demande de fusion `livraison/lot-1-correctif-file` (appli **5.1.1**, pages seulement). |
| **Nouveau : journal des incidents** | « À propos » affiche les incidents récents (rangement bloqué ou lent). S'il y en a, envoie-moi une capture. |
| **Essai 14 — État « bloqué »** | La colonne État du Sheet affiche « bloqué » **dès** le 5e essai raté (avant : jusqu'à 10 min plus tard). Seulement pour un compte qui existe. |

**Ordre** (les deux demandes de fusion sont prêtes, rien n'est fusionné) :
1. **Production d'abord** : fusionne **`livraison/lot-1-correctif-file`**. Rien à faire dans Apps Script (les pages seulement). 3 min plus tard, sur ton téléphone (vraie appli) : « À propos » affiche **5.1.1**. Envoie un quitus réel vers toi : reçu.
2. **Copie d'essai** : fusionne **`livraison/lot-2-essai-2`** (elle contient aussi le correctif de production, aucune différence de plus pour le vrai site).
3. **Serveur TEST** (le serveur change) : comme à l'étape A, points 2, 3 et 6 seulement : sauvegarde de `Code.gs` dans `_prive/Code-TEST-avant-6.0.1.gs`, collage du nouveau `A-COLLER-DANS-APPS-SCRIPT/Code.gs`, **Gérer les déploiements → Modifier → Nouvelle version**. L'adresse TEST affiche **« Loué App API v6.0.1 OK »**. Pas besoin de relancer `genererCle`, `preparerOngletsLot2` ni `installerDeclencheurs` (rien n'a changé de ce côté) ; `verifierConfig` doit afficher `v6.0.1`.
4. **Essais** sur la copie d'essai (« À propos » : **6.0.1** ; sinon ferme l'onglet et rouvre-le) :

| # | Essai | Attendu |
|---|---|---|
| 12 | Connecté en `poseur01`, **mode avion**, quitus complet avec photo → Envoyer | « Quitus rangé dans le téléphone » et « ⏳ 1 » en haut, en quelques secondes. Si un jour le message « le téléphone n'arrive pas à ranger la fiche » apparaît : fais ce qu'il dit, puis envoie-moi la capture de « À propos » (incidents) |
| 12 bis | Réseau revenu | la fiche part toute seule, mail reçu une seule fois |
| 14 | 5 faux mots de passe pour `poseur01` | « bloqué » dans la colonne État **tout de suite** (recharge le Sheet) ; « Réinitialiser » le débloque |

5. Si un essai n'est pas vert : arrête-toi et envoie-moi une capture. Sinon : étape D (le `Code.gs` à coller en production est le même, v6.0.1).

**Retour arrière** : production : demande-moi la demande de fusion « retour arrière » des pages 5.1 (ou bouton **Revert** de GitHub sur la fusion de `livraison/lot-1-correctif-file` : ici il suffit, il n'y a pas de changement de serveur). TEST : recolle `_prive/Code-TEST-avant-6.0.1.gs`, Gérer les déploiements → Nouvelle version.

---

## Étape A — Serveur du lot 2 sur la copie TEST (20 min)

> **Fais les points 1 à 6 d'une traite** : entre la fusion (1) et le collage du serveur (3), la copie d'essai du lot 2 parle encore au serveur v5.1 de TEST et affiche des erreurs de connexion. C'est sans gravité (copie d'essai, données TEST), mais n'essaie rien avant le point 6.

1. Sur github.com, fusionne la demande **`livraison/lot-2-essai`** : bouton vert **Merge pull request**, puis **Confirm merge**.
2. Sheet **« ChantierPro TEST »** → Extensions → Apps Script. **Sauvegarde** : clique sur `Code.gs`, Ctrl+A, Ctrl+C, colle dans un fichier texte `_prive/Code-TEST-avant-lot2.gs` sur ton PC.
3. Colle le nouveau `Code.gs` : sur github.com, dossier **`A-COLLER-DANS-APPS-SCRIPT`** → **`Code.gs`** → icône **« Copy raw file »** (deux carrés superposés) ; dans l'éditeur : clique dans `Code.gs`, **Ctrl+A**, **Ctrl+V**, puis l'icône **disquette**. Il ne doit y avoir qu'un seul fichier `Code.gs` dans la liste de gauche.
4. Vérifie que la propriété **`ENVIRONNEMENT`** vaut **`TEST`** : ⚙ **Paramètres du projet** (roue dentée à gauche) → en bas, **Propriétés du script**. Elle existe depuis le lot 0. **Ne touche à aucune autre propriété.**
5. Lance, une par une (choisir la fonction en haut, ▶ Exécuter), et lis le journal. **Si Google demande une autorisation** (à n'importe laquelle de ces fonctions, en général la première) : **Paramètres avancés → Accéder → Autoriser**, comme au lot 0.
   - **`genererCle`** → « ✅ Clé secrète créée » ;
   - **`preparerOngletsLot2`** → onglets créés, colonnes E à K de *Chantiers*. **Si une ligne commence par ❌, arrête-toi et envoie-la-moi** ;
   - **`installerDeclencheurs`** → « Déclencheurs installés : renvoyerMailsEnAttente (2 h), traiterComptes (10 min), surModificationSheet (à chaque modification) » ;
   - **`mesurerHachage`** → il donne un nombre (par exemple 3000). Ajoute la propriété **`HACHAGE_ITERATIONS`** avec ce nombre : ⚙ Paramètres du projet → Propriétés du script → **Modifier les propriétés du script** → **Ajouter une propriété** → nom `HACHAGE_ITERATIONS`, valeur le nombre → **Enregistrer**. **Note-le** : tu mettras le même en production ;
   - **`verifierConfig`** → la 1re ligne dit **`Loué App API v6.0.1`**, puis des ✅. Sont **normales** sans ✅ : « Transition : pas commencée… », « Comptes actifs : 0 », « Hachage : … itérations », « Mails encore possibles aujourd'hui : … », et éventuellement « ⚠ Utilisation sans compte… » ou « Partage du Sheet : non vérifiable ». Une ligne avec ❌ : arrête-toi et envoie-la-moi.
6. **Déployer → Gérer les déploiements** → déploiement TEST → ✏ Modifier → Version : **Nouvelle version** → **Déployer**. Ouvre l'adresse TEST (celle qui finit par `/exec`, dans `_prive/ids-test.txt`) : **`Loué App API v6.0.1 OK`**.
   - Si tu vois encore `v5.1` : la mise à jour n'a pas été prise (règle 2 de CLAUDE.md). Fais **Nouveau déploiement**, envoie-moi la nouvelle adresse, et **attends** que je mette `commun/config.js` à jour.

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

Ouvre `https://chantiersloue.github.io/chantier-pro/essai/` sur ton téléphone : bandeau rouge **« COPIE D'ESSAI »** en haut ; « À propos » affiche **6.0.1**. Si tu as gardé l'icône **« Loué ESSAI »** du lot 1, elle ouvre maintenant la copie d'essai du lot 2 (sinon, l'adresse dans le navigateur suffit : pas besoin d'installer pour les essais). Si la page affiche encore l'ancienne version : ferme l'onglet et rouvre-le (ou attends le bandeau « Nouvelle version — Mettre à jour »).

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
| 10 | Tape un chantier qui n'existe pas (« ESSAI FAUTE ») | Envoyé ; PDF dans `_À CLASSER` ; **aucun** dossier « ESSAI FAUTE » créé ; mail « Document à classer » (**un seul par jour** : si tu refais l'essai le même jour, pas de 2e mail, c'est normal) |
| 11 | Chantier → **Plans** | La liste des plans du chantier |
| 12 | Mode avion → « Remplir une fiche sans être connecté » depuis l'écran de connexion (après « Se déconnecter » dans À propos) | La fiche se remplit et se range (« ⏳ en attente ») |
| 13 | Réseau revenu, reconnecte-toi | La fiche de l'essai 12 part toute seule |
| 14 | 5 faux mots de passe pour `poseur01` | « Identifiant bloqué encore 15 min » ; État « bloqué » dans le Sheet |
| 15 | Coche « Réinitialiser » de `poseur01` | Nouveau provisoire, plus de blocage |
| 16 | `conduc01` : connexion | Ses chantiers (colonne D) + bouton « Voir tous les chantiers » |
| 17 | Connecté en `conduc01` sur le téléphone, coche « Déconnecter ses téléphones » de `conduc01` dans le Sheet, puis rouvre l'accueil | Retour à l'écran de connexion, message « Session terminée » |
| 18 | Éditeur Apps Script : ▶ `finirTransitionMaintenant` (refusé en production, accepté sur TEST). Puis, **déconnecté**, remplis et envoie un quitus « sans être connecté » | La fiche **reste** « en attente — connectez-vous… » (jamais « à vérifier ») ; après connexion, elle part |
| 19 | Après l'essai 18, **quand l'indicateur de la copie d'essai est à « ✓ Tout est envoyé »** (les deux partagent la même mémoire du téléphone) : ouvre `https://chantiersloue.github.io/chantier-pro/?env=test` (**pages du lot 1**) et envoie un quitus | Message « Appli à mettre à jour ou connexion nécessaire… » ; la fiche est gardée |
| 20 | ▶ `prolongerTransition` | « Transition prolongée jusqu'au … » ; l'essai 19 repasse |
| 21 | Onglet *Sans compte* | Les fiches envoyées sans compte sont notées |

Puis **sors du mode test** sur le vrai site : `https://chantiersloue.github.io/chantier-pro/?env=prod`.

**Contrôle des quotas** (2 min) : dans l'éditeur Apps Script TEST, menu de gauche **Exécutions** (icône ☰ avec une flèche) : regarde la **durée** des dernières exécutions de `traiterComptes` (en secondes). Multipliée par 144 (une toutes les 10 min), elle doit rester **sous 30 minutes** par jour (le compte Google en a 90 par jour pour tous les déclencheurs). Dis-moi la durée que tu lis.

Enfin, dans l'éditeur Apps Script **de la copie TEST** : ▶ **`retirerDeclencheurs`**. Les 90 minutes de déclencheurs par jour sont partagées par tout le compte Google : la copie TEST ne doit pas en consommer pour rien (`installerDeclencheurs` les remet si besoin).

## Étape D — Production (après ton feu vert sur l'étape C, 30 min)

Le serveur du lot 2 a sa **propre adresse** : l'ancien déploiement (lot 1) continue de servir les téléphones tant que les pages ne sont pas fusionnées. C'est aussi le retour arrière.

1. Vrai Sheet → Extensions → Apps Script. **Sauvegarde** de `Code.gs` dans `_prive/Code-avant-lot2.gs`.
2. **Gérer les déploiements** : note la **description** et l'**adresse** du déploiement actuel (lot 1) dans `_prive/deploiements.txt`.
3. Colle le nouveau `Code.gs` comme en A.3 (github.com → `A-COLLER-DANS-APPS-SCRIPT/Code.gs` → « Copy raw file » ; dans l'éditeur : Ctrl+A, Ctrl+V, disquette ; un seul fichier `Code.gs` à gauche).
4. Vérifie que la propriété **`ENVIRONNEMENT`** n'est **PAS** `TEST` (en production, elle n'existe pas ou vaut autre chose). Puis ▶ `genererCle`, ▶ `preparerOngletsLot2` (**❌ = arrête-toi**), ▶ `installerDeclencheurs` (autorisation si Google la demande), ajoute la propriété **`HACHAGE_ITERATIONS`** (le nombre de l'étape A.5), ▶ `verifierConfig` (1re ligne `v6.0.1`, des ✅ ; mêmes lignes normales qu'en A.5).
5. **Déployer → Nouveau déploiement** → type « Application Web », description **« Lot 2 — production »**, exécuter en tant que **moi**, accès **Tout le monde** → Déployer. Ouvre la nouvelle adresse (elle finit par `/exec`) : **`Loué App API v6.0.1 OK`**. **Envoie-moi l'adresse** : je prépare `livraison/lot-2` avec cette adresse. Pendant ce temps, les gars continuent avec l'ancien déploiement (lot 1, v5.1) : rien ne change pour eux.
6. Remplis *Utilisateurs* : une ligne par personne, **Actif** coché, **sans** cocher « Réinitialiser » pour l'instant. 10 min plus tard, coche les chantiers de chacun dans *Accès chantiers*.
7. Fusionne **`livraison/lot-2`** (elle retire aussi la copie d'essai `essai/`). Attends 3 min. Sur ton téléphone : écran Connexion ; « À propos » affiche **6.0.1**. Coche « Réinitialiser » pour **toi**, connecte-toi, ouvre un chantier, envoie un quitus réel vers toi → reçu, colonne G de *Envois* à ton identifiant.
   - Les gars qui ne sont pas encore connectés touchent **« Continuer sans compte »** : l'appli marche comme avant (période de transition pas commencée).
8. **Le jour où tu vois les gars** (un seul passage pour les deux lots) :
   - **iPhone** : ouvre l'appli dans Safari et suis l'écran **« Installer l'appli »** jusqu'au bout (c'est l'étape D.11 du lot 1, restée en attente). Sur Android, c'est conseillé aussi ;
   - coche « Réinitialiser » pour chacun, donne-lui son provisoire (valable 48 h), et fais-le se connecter **dans l'appli installée** devant toi (Safari et l'appli installée n'ont pas la même mémoire sur iPhone).
9. Quand tout le monde est connecté (l'onglet *Sans compte* ne bouge plus pendant 2 jours) **et que chaque téléphone affiche 6.0.1 dans « À propos »** (sinon : fermer et rouvrir l'appli, ou toucher « Mettre à jour ») : ▶ **`demarrerTransition`**. Encore 15 jours de tolérance ; tu reçois un mail 3 jours avant la fin. Si tu oublies, un mail te le rappelle chaque jour à partir de 7 jours après la première connexion.
10. **À la fin de la transition** : dans l'Apps Script **de production**, Gérer les déploiements → **archive** les anciens déploiements (lot 0, lot 1). **N'archive jamais celui qui s'appelle « Lot 2 — production »** (son adresse est celle de `commun/config.js`). **Sur TEST, n'archive rien** : il n'y a qu'un déploiement, mis à jour à chaque lot, et son adresse (dans `_prive/ids-test.txt`) est celle de la copie d'essai et du mode test. Les anciennes adresses sont lisibles dans l'historique public du dépôt : tant qu'elles marchent, elles exécutent l'ancien code sans compte.

## Retour arrière

| Problème | Que faire |
|---|---|
| Les gars ne peuvent plus travailler après la fusion de `livraison/lot-2` | Dis-le-moi : je prépare une demande de fusion qui remet **les pages du lot 1 et l'adresse du lot 1** (l'ancien déploiement tourne encore). Rien à faire dans Apps Script |
| Après l'archivage des anciens déploiements | 1. ▶ **`retirerDeclencheurs`** (avant de recoller : sinon les déclencheurs du lot 2 resteraient et échoueraient toutes les 10 min). 2. Recolle `_prive/Code-avant-lot2.gs`, enregistre. 3. ▶ `installerDeclencheurs` (celui du lot 1 remet les mails reportés). 4. **Nouveau déploiement**, envoie-moi l'adresse (je remets les pages du lot 1 avec elle) |
| Revenir au serveur du lot 1 sur TEST | Même chose sur TEST : ▶ `retirerDeclencheurs`, recolle `_prive/Code-TEST-avant-lot2.gs`, ▶ `installerDeclencheurs`, Gérer les déploiements → Modifier → Nouvelle version. Quand tu n'as plus besoin de TEST : supprime son déclencheur (Apps Script → icône réveil **Déclencheurs** → ⋮ → Supprimer), pour le quota |
| Un gars bloqué | Case « Réinitialiser » |
| Tout le monde bloqué après la fin de la transition | ▶ `prolongerTransition` (7 jours de plus) puis dis-le-moi |
| Clé secrète divulguée (quelqu'un a eu accès au script) | Ajoute la propriété `CONFIRMER_CHANGER_CLE` = `OUI`, puis ▶ `changerCle` : tout le monde devra se reconnecter |

## Ce que tu dois faire, en résumé

1. ~~Me dire quand le lot 1 est en production~~ : fait le 10/11/2026 ; `livraison/lot-2-essai` est prête.
2. Étapes A, B, C sur TEST, et me dire le temps de l'essai B.3 (case cochée depuis l'appli Sheets du téléphone).
3. Étape D en production (m'envoyer l'adresse du nouveau déploiement au point D.5), puis installer l'appli sur les iPhone et distribuer les mots de passe le même jour, puis lancer `demarrerTransition`.
