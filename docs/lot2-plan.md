# Lot 2 — Comptes, rôles, accueil (avec 9a) : plan détaillé

> Plan général validé par Franck : `PLAN.md`, section « Lot 2 ». Ce document le précise pour la construction, après une critique indépendante (1er tour : 4 bloquants, 11 importants, 11 mineurs, tous traités ci-dessous).
> Branche `lot-2` (partie de `refonte` après le lot 1). **Rien ne part en production** tant que Franck n'a pas testé le lot 1.

## 0. Écarts avec `PLAN.md` (décidés en autonomie, notés dans `DECISIONS.md`, à confirmer par Franck au compte-rendu)
1. **Une fiche est acceptée pour n'importe quel chantier** (PLAN.md : « toutes les actions vérifient l'accès au chantier »). Seule la **lecture** (plans, liste des chantiers, contacts) est limitée. Raison : envoyer une fiche ne révèle rien, et un oubli de case au bureau ne doit pas bloquer un gars sur le chantier. Garde-fous : confirmation sur la page, auteur noté, **un nom de chantier inconnu ne crée plus de dossier Drive** (le PDF va dans `_À CLASSER` et Franck est prévenu).
2. **Pas d'essai préalable du déclencheur sur téléphone avant de construire** : un secours toutes les 10 minutes rend ce point non bloquant (au pire, le mot de passe provisoire apparaît en 10 minutes). L'essai reste dans la procédure.
3. **Pas de colonnes techniques dans le Sheet** : empreintes et compteurs sont dans les Propriétés du script et le cache du script (voir § 3).
4. **Pas de tuiles Notes, Carnet, Signaler, Atelier** : elles arrivent avec leurs lots, jamais vides.
5. **« Toutes les connexions ralenties » remplacé** par une alerte à Franck : une pause de 2 s par essai occuperait les 30 exécutions simultanées permises et bloquerait les fiches de tout le monde. Le blocage par identifiant (5 essais → 15 min) reste.
6. **Lectures en POST sans repli JSONP** (exception à la règle 3 de CLAUDE.md, pour ces lectures seulement) : en JSONP, le jeton serait dans l'adresse. En cas d'échec, la liste gardée dans le téléphone sert.

## 1. Objectif
- Chaque personne a un compte (identifiant + mot de passe) et ne voit **que ses chantiers** dans l'appli.
- Vérification **par le serveur** (Apps Script), pas seulement par la page.
- Accueil : connexion (une fois tous les 90 jours) → « Mes chantiers » → fiches du chantier, chantier déjà rempli.
- 9a : colonnes ajoutées à *Chantiers*, onglet *Intervenants* créé.
- **Limite dite clairement** : les fichiers du dossier Plans et du Planning restent partagés « à qui a le lien » (décision du lot 0). Le lot 2 cache la **liste** ; un lien déjà connu (ancien salarié) continue de s'ouvrir. La fin des liens partagés arrive avec le carnet (lot 4).

## 2. Ce qui ne doit pas casser
- Les 9 fiches, le brouillon automatique, la file d'envoi hors réseau, l'aperçu = PDF.
- **Une fiche n'est jamais perdue ni bloquée** à cause des comptes : on peut toujours remplir et ranger une fiche, connecté ou non, avec ou sans réseau.
- *Chantiers* A à D inchangées ; « Dossiers chantiers » (lot 1.5) reste la seule source des dossiers Drive.

## 3. Données
### Onglet *Utilisateurs* (Franck le remplit ; ligne 1 et colonne A figées)
| Col. | Titre | Rempli par |
|---|---|---|
| A | Identifiant (minuscules, chiffres, `-` ou `_` ; conseillé : prénom + 2 chiffres, ex. `thomas27`, moins facile à deviner) | Franck |
| B | Nom (liste issue de *Contacts*, colonne A) | Franck |
| C | Rôle (liste : Poseur / Conducteur / Atelier / Admin) | Franck |
| D | Actif (case) | Franck |
| E | Réinitialiser le mot de passe (case) | Franck coche, l'appli décoche |
| F | Mot de passe provisoire | l'appli (effacé à la première connexion) |
| G | Provisoire valable jusqu'au (48 h) | l'appli |
| H | Déconnecter ses téléphones (case) | Franck coche, l'appli décoche |
| I | Tous les chantiers (case, pour un poseur qui va partout) | Franck |
| J | État : « connecté le … », « bloqué jusqu'à 14h47 », « identifiant en double », « en attente du premier mot de passe »… | l'appli |

- **Réinitialiser** = nouveau provisoire **et** déblocage **et** déconnexion de ses téléphones.
- Données techniques (empreinte, sel, nombre d'itérations, version de session) : Propriétés du script, `COMPTE_<identifiant>`. Compteurs d'essais ratés : cache du script (pas de quota journalier, contrairement aux Propriétés : 50 000 lectures/écritures par jour).
- Un jeton n'est valable que si la ligne existe, est **Active**, et que le rôle est connu. Identifiant en double : aucun des deux ne peut se connecter, la colonne État le dit.

### Onglet *Accès chantiers* (et non « Accès », déjà le nom d'un sous-dossier Drive)
- Ligne 1 : « Chantier », « Remarque (appli) », puis une colonne par identifiant actif de rôle **Poseur** ou **Atelier** (sauf case « Tous les chantiers »). Ligne 1 et colonnes A-B figées.
- Une ligne par chantier de *Chantiers*. Ajouts automatiques seulement, jamais de suppression ; une ligne dont le chantier n'existe plus est marquée « chantier absent de l'onglet Chantiers (renommé ?) ».
- **Conducteur, Admin** : tous les chantiers. « Mes chantiers » d'un conducteur = colonne D à son nom ; « Tous les chantiers » montre le reste.

### Onglet *Chantiers* (9a)
- A à D inchangées. Ajoutées en E à K : **N°**, **Nom court**, **Adresse**, **Client**, **Architecte**, **Date « Terminé »**, **Chemin MEGA**. Titres écrits **seulement si E1 à K1 sont vides**.
- Statut (C) : liste En préparation / En cours / Terminé en **avertissement** ; `preparerOngletsLot2()` liste les statuts déjà présents avant.
- Nom court : utilisé dans le nom des PDF s'il est rempli (sinon le nom du chantier, comme au lot 1). À remplir avant le premier document pour ne pas avoir deux familles de noms.
- **Terminé** : retiré de « Mes chantiers » des poseurs ; une fiche (quitus tardif) reste possible par « Fiche sans chantier choisi » ou en tapant le nom (confirmation), et elle est rangée normalement.

### Onglet *Intervenants* (9a) : titres seulement (Chantier, Nom, Société, Lot / fonction, Mail, Téléphone, Mis à jour le), rempli plus tard par le skill `gestion-documentaire` (contrat 9b).

### Onglet *Sans compte* (transition)
- Une ligne par fiche reçue sans compte (date, type, chantier, nom saisi dans la fiche), 200 lignes par jour au plus.
- Lectures sans compte : comptées dans le cache, recopiées par le déclencheur des 10 min (une ligne par jour et par sorte de lecture, avec le nombre).

### Onglet *Envois* : colonne G « Auteur (compte) » ajoutée (titre écrit par `preparerOngletsLot2()`), remplie aussi quand une fiche est renvoyée.

## 4. Serveur (`apps-script/Comptes.gs`, nouveau)
### Mots de passe
- Empreinte : HMAC-SHA256 répété N fois, sel propre au compte. N mesuré sur TEST (`mesurerHachage()`, but ≈ 0,3 s) et gardé par compte.
- Choisi : 8 caractères au moins, sans l'identifiant, pas dans une liste de mots de passe évidents. Provisoire : 8 minuscules et chiffres sans caractères ambigus, 48 h, à changer à la première connexion.

### Déclencheurs
- « À la modification » : s'arrête **dès la première ligne** si la modification n'est pas dans *Utilisateurs* (colonnes A à I). Sinon `traiterComptes()`.
- Toutes les 10 min : `traiterComptes()` (cases, onglet *Accès chantiers*, État, recopie des compteurs *Sans compte*, alerte de fin de transition).
- `traiterComptes()` sous **verrou du document** (pas celui des fiches) : jamais deux provisoires de suite ; la case est décochée **dans la même écriture** que le provisoire.
- `installerDeclencheurs()` supprime puis recrée **chacun** des 3 déclencheurs (relancé deux fois : pas de doublon).

### Connexion et jeton
- `connexion {identifiant, motDePasse}` → jeton, ou `NOUVEAU_MDP` (provisoire) ; `motDePasse {identifiant, ancien, nouveau}` → jeton. Même compteur d'essais pour les deux.
- Jeton : `identifiant.environnement.version.expiration.signature` (environnement `p` ou `t` : un jeton TEST ne passe jamais en production). Clé `CLE_JETON` créée par `genererCle()` directement dans les Propriétés (refuse d'écraser). `changerCle()` refuse sauf si la propriété `CONFIRMER_CHANGER_CLE` vaut `OUI` (posée à la main juste avant).
- Vérifié à chaque requête : signature à temps constant, expiration, environnement, ligne présente, active, rôle connu, version de session.
- **Codes de réponse distincts** :
  - `JETON_INVALIDE` (signature fausse, expiré, révoqué, compte inactif ou supprimé) → la page efface le jeton ;
  - `CONNEXION_REQUISE` (pas de jeton, transition finie) → rien à effacer ;
  - `ERREUR` (le serveur n'arrive pas à lire l'onglet, la clé ou les Propriétés) → **le jeton est gardé**, nouvel essai plus tard. Un problème du serveur ne déconnecte jamais personne.
- Prolongation : toute réponse à une requête avec un jeton de plus de 30 jours contient un jeton neuf de 90 jours.
- Force brute : 5 essais ratés → identifiant bloqué 15 min (les téléphones déjà connectés ne sont **pas** touchés : le blocage ne vise que la connexion). Plus de 50 échecs par heure dans toute l'appli → alerte à Franck (une par jour). Identifiant inconnu : même message, même calcul.

### Droits
| Action | Sans compte (transition) | Poseur / Atelier | Conducteur / Admin |
|---|---|---|---|
| `listes` | GET `getContacts` (compté) | ses chantiers (non terminés) + contacts + listes | tous, « les miens » marqués |
| `dossiers` (plans) | GET `getDossiers` (compté) | chantiers cochés (ou case « Tous ») | tous |
| `planning` | GET (compté) | oui (commun à tous) | oui |
| `fiche`, `photo` | acceptées et notées | tout chantier (auteur noté) | tout chantier |

### Période de transition
- **Démarrage manuel** : `demarrerTransition()`, lancée par Franck **après** la fusion des pages du lot 2 (fin = +15 jours). Tant qu'elle n'a pas démarré, tout ce qui marchait au lot 1 continue de marcher (rien ne peut se terminer tout seul).
- Pendant : ancien format, GET `getContacts` / `getDossiers`, fiches sans jeton acceptés et notés.
- Après : `CONNEXION_REQUISE`, avec le message (affiché aussi par les anciennes pages du lot 1) : « Appli à mettre à jour : touchez « Mettre à jour » en haut de l'accueil, puis connectez-vous. Votre fiche est gardée dans le téléphone. »
- Mail à Franck **3 jours avant la fin** avec le nombre d'utilisations sans compte des 3 derniers jours ; `verifierConfig()` affiche la date de fin et l'activité sans compte des dernières 48 h.
- `prolongerTransition()` : +7 jours. `finirTransitionMaintenant()` : **refusée hors TEST** (propriété `ENVIRONNEMENT`).
- **À la fin de la transition** : archiver tous les anciens déploiements (lots 0 et 1, production et TEST) : ils exécutent encore l'ancien code, sans comptes, et leurs adresses sont dans l'historique public du dépôt.

### Chantier inconnu
- `classerDocument_` : si le nom n'est pas dans la colonne A de *Chantiers*, **aucun dossier n'est créé** ; le PDF va dans `_À CLASSER` à la racine, l'alerte « rangement » prévient Franck, les mails partent normalement.

## 5. Pages
### `commun/api.js`
- Jeton + profil (identifiant, nom, rôle) dans `localStorage`, une clé par mode.
- `LOUE.appeler` ajoute le jeton à chaque requête ; récupère un jeton neuf s'il y en a un dans la réponse.
- Une fiche garde l'identifiant de la personne connectée **au moment où elle est rangée** (« saisie par ») ; le serveur note les deux s'ils diffèrent.
- `JETON_INVALIDE` : jeton effacé, la fiche reste « en attente — connectez-vous depuis l'accueil » ; `CONNEXION_REQUISE` : pareil, sans rien effacer. Jamais compté comme refus : la fiche ne passe jamais « à vérifier » pour ça. La file repart à la connexion.
- `LOUE.chargerListes()` : POST `listes` avec jeton, sinon GET (transition), sinon liste gardée. **Une réponse n'est gardée que si elle contient bien une liste de chantiers** ; la liste gardée est propre à chaque compte et effacée à la déconnexion.

### Accueil `index.html`
1. **Connexion** : identifiant, mot de passe (« Afficher »), « Se connecter » ; et **toujours** (réseau ou pas, transition ou pas) : « Remplir une fiche sans être connecté — elle partira après la connexion ».
2. **Choix du mot de passe** : nouveau + confirmation, « Afficher », règles en clair.
3. **Mes chantiers** : « Bonjour <prénom> », recherche (plus de 6 chantiers), derniers ouverts en premier, « Tous les chantiers » (conducteurs, admin, case « Tous »). Hors réseau : dernière liste gardée.
4. **Un chantier** : nom, référence, adresse ; les fiches rangées comme aujourd'hui (« Fiches » : cotes, fabrication, bordereaux, quitus, réception ; « Conducteur » : note de réunion, attestation — visibles par tous, comme aujourd'hui) ; « Plans ».
5. **Hors chantier** : Planning, Demande d'absence, « Fiche sans chantier choisi ».
6. **À propos** : « Connecté : nom (rôle) », « Se déconnecter » (avertit si des fiches attendent).

### Fiches (8 pages avec chantier)
- `?chantier=…` (`&chantier=` pour `bordereau.html?type=…`) remplit le champ **avant** la prise de la page vierge par le brouillon, marqué `data-auto`.
- `commun/brouillon.js` : un champ `data-auto` non modifié ne compte pas comme une saisie ; la bannière affiche **le chantier du brouillon** (« Brouillon retrouvé — CHANTIER Y ») pour qu'on ne restaure pas un autre chantier sans le voir.
- Chantier tapé hors de « mes chantiers » : confirmation (comme avec une liste ancienne).
- Aucune page de fiche ne renvoie vers la connexion.

## 6. Fichiers touchés
- Nouveaux : `apps-script/Comptes.gs`, `docs/lot2-procedure.md`, `tests/lot2-comptes.test.js`.
- Modifiés : `apps-script/Api.gs`, `Admin.gs`, `Dossiers.gs`, `Securite.gs` (alertes), `outils/construire.js` ; `commun/api.js`, `brouillon.js`, `ui.js`, `style.css` ; `index.html` ; les 8 fiches ; `tests/gas-harness.js`, `tests/faux-serveur.js` ; `docs/structure-sheet.md`, `docs/guide-utilisateur.md`, `CHANGELOG.md`, `DECISIONS.md`.

## 7. Choix comparés
| Choix | Retenu | Écarté | Raison |
|---|---|---|---|
| Empreinte du mot de passe | Propriétés du script | Colonnes protégées du Sheet | Pas d'historique lisible, pas d'écrasement par erreur |
| Compteurs d'essais | Cache du script | Propriétés | Pas de quota journalier ; une perte du cache ne fait que remettre un compteur à zéro |
| Case « Réinitialiser » | Déclencheur + secours 10 min | Déclencheur seul ; menu | Menu absent sur téléphone ; déclencheur pas garanti depuis l'appli Sheets mobile |
| Transport du jeton | Corps d'un POST | Adresse (GET / JSONP) | Une adresse finit dans des journaux |
| Fiche pour un chantier non coché | Acceptée, confirmée, auteur noté | Refusée | Le terrain d'abord ; rien n'est révélé |
| Début de la transition | Manuel, après la fusion | Automatique | Ne peut pas se terminer avant que les gars aient l'écran de connexion |
| Retour arrière | Remettre l'adresse du serveur du lot 1 dans `config.js` (l'ancien déploiement tourne encore) | Recoller l'ancien code | Une seule ligne, et aucun nouveau déploiement |

## 8. Déploiement (détail dans `docs/lot2-procedure.md`)
1. TEST : nouveau déploiement du lot 2, `genererCle`, `preparerOngletsLot2`, `installerDeclencheurs`, `mesurerHachage`, comptes d'essai, essais (y compris la case cochée depuis l'appli Sheets du téléphone, et `finirTransitionMaintenant`).
2. Production, serveur : nouveau déploiement, `genererCle`, `preparerOngletsLot2`, `installerDeclencheurs`. **Noter l'adresse du déploiement du lot 1** (retour arrière).
3. Pages : une seule demande de fusion (pages du lot 2 + nouvelle adresse). Les téléphones encore sur les pages du lot 1 parlent au nouveau serveur sans compte : accepté (transition pas commencée).
4. Comptes : lignes remplies, **puis** cases « Réinitialiser » cochées le jour où Franck distribue les provisoires (48 h).
5. `demarrerTransition()` quand tous les gars sont connectés (ou au plus tard une semaine après la fusion).
6. Fin de la transition : archiver les anciens déploiements.

## 9. Tests
- Harnais : connexion bonne / mauvaise / inconnue (même message) ; blocage et déblocage (15 min, Réinitialiser) ; alerte globale ; provisoire (créé une seule fois, expiré à 48 h, à changer, effacé) ; jeton falsifié, expiré, autre environnement, révoqué, compte inactif, supprimé, en double, rôle changé ; **erreur du serveur → `ERREUR` et non `JETON_INVALIDE`** ; poseur et plans d'un chantier non coché (refus) ; listes filtrées, chantiers terminés ; transition (pas commencée, pendant, finie, alerte J-3, `finir…` refusé hors TEST) ; auteur noté (aussi au renvoi) ; *Accès chantiers* complété sans rien effacer, ligne orpheline marquée ; `preparerOngletsLot2` qui ne remplace rien ; chantier inconnu → `_À CLASSER` ; nom court ; déclencheur « à la modification » ignoré hors *Utilisateurs* ; `installerDeclencheurs` deux fois sans doublon.
- Navigateur (faux serveur) : connexion, choix du mot de passe, Mes chantiers, fiche pré-remplie sans bannière, brouillon d'un autre chantier proposé avec son nom, « Remplir une fiche sans être connecté » hors réseau, fiche rangée sans compte puis partie après connexion, session révoquée pendant qu'une fiche attend, serveur en panne (jeton gardé) ; 375 px et PC ; réseau lent, hors réseau.
- Tests des lots 0 et 1 relancés.
