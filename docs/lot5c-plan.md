# Lot 5c — Le planning lisible par les seuls comptes de l'appli — PLAN COURT

> Plan du 18/11/2026, version 1. Demandé par toi le 18/11 : « Seuls les comptes de l'appli doivent pouvoir lire le PDF du planning. »
> Branche `lot-5c`, partie de `main` (la production, lot 5). **Petit lot à part, à mettre en production avant le lot 8.**

## 1. Le problème (constaté dans le code de production)

À chaque ouverture de la tuile « Planning », le serveur met **chaque fichier** du dossier *Planning* du Drive en partage « toute personne qui a le lien » (`apps-script/Api.gs`, fonction `lireDossiers_`). Le téléphone ouvre ensuite ce lien Google Drive.

Conséquences :
- quiconque a le lien (transféré par un poseur, resté dans un historique, une capture) lit le planning **sans compte** ;
- même si tu retires le partage à la main dans Drive, le serveur le remet à la prochaine ouverture ;
- sans compte, la lecture est encore ouverte à tous tant que la « période sans compte » n'a pas commencé (`demarrerTransition` n'a jamais été lancé en production).

## 2. Les solutions comparées

| Solution | Pour | Contre | Retenue ? |
|---|---|---|---|
| **A. Le serveur envoie lui-même le PDF au téléphone**, seulement à un compte connecté ; les fichiers redeviennent **privés** dans Drive | seuls les comptes de l'appli lisent ; aucun lien ne circule ; même mécanique que les photos et le carnet | le téléphone ouvre un PDF reçu de l'appli, pas Google Drive : l'affichage dépend du téléphone (à essayer sur Android et iPhone) | **oui** |
| B. Partager chaque fichier avec l'adresse Google de chaque poseur | Drive gère les droits | les comptes de l'appli ne sont pas des comptes Google ; il faudrait l'adresse Google de chaque gars, et la tenir à jour | non |
| C. Le programme du PC transforme le planning en images, déposées comme le carnet | lisible hors réseau, zoom du carnet | beaucoup plus lourd ; dépend du PC allumé ; pas « maintenant » | non (peut-être avec le lot 11) |

## 3. Ce qui change

**Serveur (v10.1)**
- La liste du planning ne met **plus rien en partage**. Mieux : tout fichier du dossier *Planning* trouvé partagé (par lien ou public) est **remis en privé** à la lecture suivante. Tu n'as rien à faire dans Drive.
- La liste ne donne plus le lien Drive, seulement : nom, sorte (PDF…), date, taille, et un numéro interne.
- **Nouvelle action « planningFichier »** : un compte connecté et actif demande un fichier par son numéro ; le serveur vérifie que ce fichier est **bien dans le dossier *Planning*** (rien d'autre du Drive ne peut sortir par là), qu'il pèse moins de 10 Mo, puis renvoie son contenu.
- **Sans compte** (ancienne lecture `getDossiers`), le planning n'est plus servi : réponse « Connectez-vous pour voir le planning », la même que celle de la fin de la période sans compte, que la page sait déjà afficher. Les autres lectures sans compte (listes) ne changent pas.

**Page d'accueil (appli 9.1)**
- La liste du planning est la même (nom, date, marque PDF).
- Toucher un document : « ⏳ Téléchargement… », puis le bouton devient **« Ouvrir le PDF »** ; un second toucher l'ouvre avec le lecteur du téléphone. (Deux touchers, parce qu'un téléphone bloque l'ouverture d'un document qui n'arrive pas tout de suite après le toucher.)
- Un fichier qui n'est pas un PDF (Excel, image) : même chose, il s'ouvre avec l'appli du téléphone qui sait le lire.
- Hors réseau : message clair, comme aujourd'hui.

**Ce qui ne change pas** : le dossier *Planning* du Drive (tu continues d'y déposer tes PDF), le carnet, les fiches, le brouillon automatique.

## 4. Risques et parades

| Risque | Parade |
|---|---|
| Un téléphone n'affiche pas le PDF reçu | essai sur Android et iPhone (procédure) ; sur PC, le navigateur l'affiche |
| Un gros fichier sur une barre de réseau | 10 Mo au plus ; la taille est affichée dans la liste |
| Un compte demande un autre fichier du Drive | le serveur ne sert que les fichiers **directement** dans le dossier *Planning* |
| Des poseurs sans compte ne voient plus le planning | c'est ta demande ; dis-le-leur, ou crée-leur un compte avant la mise en production |
| Ancienne page restée dans un téléphone (sans la mise à jour) | elle ne trouve plus de lien : elle affiche « Aucun lien » ; la mise à jour se propose d'elle-même |

## 5. Tests

Faux serveur : partage remis en privé ; aucun lien dans la liste ; fichier servi à un compte, refusé sans compte, refusé hors du dossier *Planning*, refusé au-delà de 10 Mo ; compte désactivé ; ancienne lecture sans compte. Page (vrai Chrome, 375 px et PC) : liste, téléchargement puis « Ouvrir le PDF », hors réseau, sans compte. Les séries existantes qui attendaient le partage par lien sont mises à jour.

## 6. Ce que tu auras à faire (30 min)

1. Après les essais du lot 8 sur la copie TEST : un envoi `--avec-porte` depuis le dossier `chantier-pro-lot5c` ; tes essais téléphone (Android et iPhone : ouvrir un planning).
2. Production : coller `Code.gs` (v10.1), nouveau déploiement, me donner l'adresse, fusion.
3. Vérifier dans Drive : clic droit sur un PDF du dossier *Planning* → Partager : « Accès limité ».

Ensuite, je reporte ce lot dans les branches `lot-8`, `lot-10a1`, `lot-10a2`, `lot-10b` et `lot-5b`, pour qu'aucune mise en production suivante ne remette l'ancien comportement.
