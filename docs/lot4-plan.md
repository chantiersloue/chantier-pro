# Lot 4 — Carnet de chantier : plan

> Commande : `PLAN.md`, exigence 9 et « Lot 4 — Carnet de chantier » ; résultats de l'essai S1 (`docs/essai-s1.md`) ; contrat avec les skills (`docs/contrat-skills.md`).
> Réponses de Franck à l'interview du 13/11/2026 : D4-1 et D9b-5 (`DECISIONS.md`).
> **Rien n'est construit tant que ce plan n'est pas validé par Franck. Aucun envoi ne lui est demandé avant.**

## 1. La commande, en clair

Les poseurs ouvrent sur leur téléphone les **plans et documents du chantier**, les lisent au zoom (cotes et repères nets), **même sans réseau** une fois vus. Les documents arrivent tout seuls depuis les skills de Franck, **sans manipulation de fichier**, et seulement quand Franck les a validés.

Ce qui est déjà décidé (et ne se rediscute pas ici) :

| Sujet | Décision |
|---|---|
| Ce que voit le poseur | des **pages-images**, jamais le PDF (S1-2) |
| Qualité | WebP qualité 0,7 ; **200 dpi** pour les plans, **150 dpi** pour les documents de texte (S1-1) |
| Accès | vérifié par le serveur à chaque demande ; **aucun lien public** |
| Quand un document arrive | **seulement une version validée** : au moment du bordereau, ou quand Franck dit « mets-le au carnet » (D4-1) |
| Quels documents | réservations int (105, 106) et ext (205, 206), boîtes aux lettres (108), gaines techniques (109), organigramme (151), signalétique (152), PPSPS (001), temps de tâches (002), **tableau de portes (103), repérage des portes (104), pose des huisseries (107)** |
| Où tourne le dépôt | **sur le PC de Franck** (Python et `G:\Mon Drive` y sont ; un module gratuit à installer une fois) |
| Dossier connecté à Claude | **toute la racine** du Drive de l'appli |
| Archive | le PDF d'origine reste dans MEGA ; le carnet n'est pas une archive |

## 2. Trois livraisons, chacune utilisable seule

Le lot est le plus gros du projet. Il est coupé en trois, dans cet ordre, chacune testée et mise en production avant la suivante.

| | Contenu | Ce que ça apporte | Demandé à Franck |
|---|---|---|---|
| **4a — Déposer et lire** | le programme de dépôt (`outils/depot_carnet.py`), le serveur du carnet, la page « Carnet » avec sa visionneuse | les plans sont lisibles sur le téléphone, avec du réseau ; ce qui a été regardé reste lisible sans réseau | installer le module (une ligne), un envoi clasp, essais téléphone, production |
| **4b — Hors réseau complet** | « Tout télécharger » par document, téléchargement automatique en Wi-Fi sur Android, place disponible, alerte « plan plus disponible » et « ancien indice » | le poseur prépare son téléphone au dépôt, et sait toujours si son plan est à jour | essais téléphone, production |
| **4c — Les skills** | les blocs à coller dans les skills (dépôt au carnet, contrôle de l'identité, rapatriement Drive → MEGA avec `rapatrier.py` et le relevé `mega-index.json`), validés par Franck avec Claude | plus aucune manipulation : un plan validé part au carnet tout seul ; les fiches de l'appli redescendent dans MEGA | connecter la racine du Drive à Claude, coller les blocs, 3 essais avec un vrai skill |

Pendant 4a et 4b, c'est moi (ou Franck) qui lance le programme de dépôt à la main, sur de vrais plans, dans la copie TEST puis en production. Le dépôt automatique par les skills n'arrive qu'en 4c : tant qu'il n'est pas là, le carnet marche quand même.

## 3. Le dépôt : du PDF aux pages-images (`outils/depot_carnet.py`)

### Ce que fait le programme
```
python outils\depot_carnet.py --chantier "<nom du chantier dans l'appli>" --pdf "<chemin du PDF>" --code 105 --indice A --intitule "PLANS DE RESERVATIONS MEN INT"
```
1. Il trouve le dossier du chantier dans `G:\Mon Drive\<racine de l'appli>` et son sous-dossier carnet (nom lu dans `dossiers.json`, jamais écrit en dur).
2. Il transforme chaque page du PDF en images :
   - un **aperçu** de la page entière (1 600 px au plus) : c'est ce qui s'affiche d'abord, en une demande ;
   - pour une grande page, des **tuiles** de 512 px à plusieurs niveaux de zoom (pleine résolution, moitié, quart…), comme une carte ;
   - une petite page (A4 de texte) n'a que son image entière.
3. Il range les tuiles par **paquets d'environ 1 Mo** (un paquet = un fichier), avec un index. Une grande page fait une dizaine de fichiers, pas trois cents.
4. Il écrit le tout dans un dossier `CARNET/<CODE> <INDICE> <INTITULÉ>/`, puis, **en dernier**, met à jour `CARNET/carnet.json` (la liste que l'appli lit). Tant que cette liste n'est pas à jour, l'appli ne montre rien du nouveau document : pas de plan à moitié déposé.
5. Il **ne supprime rien**. L'ancien indice reste dans son dossier ; c'est le serveur qui le mettra à la corbeille de Drive (voir §4), parce que la suppression est interdite aux skills dans les dossiers connectés.

### Garde-fous
- Il refuse d'écrire si le dossier racine ne contient pas `dossiers.json` (mauvais dossier), si le chantier n'a pas de dossier (sauf option explicite), si le code du document n'est pas dans la liste des documents du carnet (aucun devis, aucune pièce interne).
- Les commandes lancées par un skill sur le PC sont limitées à 3 minutes : le programme travaille **page par page** et **reprend où il s'était arrêté**. Une grande page (plus grande qu'un A0) doit tenir largement dans ce délai : **mesuré sur les vrais plans de `_prive/` avant toute livraison**.
- `--verifier` : compare ce qui est dans le carnet et ce qu'annonce `carnet.json` (fichiers manquants, poids).
- Sans le module `pypdfium2`, il le dit et donne la ligne à lancer.

### Choix comparés

| Sujet | Retenu | Écarté | Raison |
|---|---|---|---|
| Transformer le PDF | **pypdfium2** (libre, une ligne d'installation, pas de compte) | PyMuPDF (licence plus contraignante) ; Ghostscript ou Poppler (logiciels à installer à part) ; le navigateur (comme à l'essai S1 : pas automatisable depuis un skill) | le plus simple à installer et à maintenir pour un débutant |
| Ranger les tuiles | **paquets d'environ 1 Mo** (une dizaine de fichiers par grande page) | un fichier par tuile (300 fichiers par page : Drive pour ordinateur synchronise mal des milliers de petits fichiers) ; un seul gros paquet par page lu « par morceaux » (demande une nouvelle autorisation Google au serveur et une étape de plus pour Franck) | peu de fichiers, et **aucune nouvelle autorisation** à donner dans Apps Script |
| Retirer l'ancien indice | **par le serveur**, à la corbeille de Drive, quand il lit la nouvelle liste | par le programme sur le PC | la suppression est interdite aux skills ; un seul code, testé |
| Où est le programme | dans le dépôt (`outils/`), donc sur le PC de Franck | recopié dans chaque skill | une seule version à maintenir ; le dépôt est public mais le programme ne contient aucun secret |

## 4. Le serveur (`apps-script/Carnet.gs`)

Trois actions, toutes réservées à un compte qui a accès au chantier (même contrôle que les notes) :

| Action | Rend |
|---|---|
| `carnet` `{ chantier }` | la liste des documents du chantier (dernier indice seulement) : code, intitulé, indice, date, nombre de pages, poids |
| `carnetDoc` `{ chantier, doc }` | la description d'un document : taille de chaque page, niveaux de zoom, quelle tuile est dans quel paquet |
| `carnetTuiles` `{ chantier, doc, page, niveau, tuiles }` | l'aperçu ou les tuiles demandées, découpées dans leurs paquets ; au plus environ 1,5 Mo par réponse |

- Le serveur lit `carnet.json` et les paquets avec les outils Drive qu'il utilise déjà : **aucune nouvelle autorisation**, donc rien à réautoriser.
- Les identifiants Drive des paquets sont retrouvés une fois puis gardés en mémoire du serveur (6 heures) : pas de recherche par nom à chaque tuile. Ils ne sont **jamais envoyés** aux téléphones.
- **Document en cours de synchronisation** : Drive pour ordinateur met quelques minutes à monter les fichiers. Tant qu'un paquet annoncé par `carnet.json` n'est pas arrivé, le document est affiché « en cours d'arrivée » et ne s'ouvre pas.
- **Ancien indice** : quand la liste annonce un nouvel indice et que tous ses fichiers sont arrivés, le serveur met le dossier de l'ancien indice à la corbeille de Drive (il reste dans MEGA). Il ne touche qu'aux dossiers du carnet qui portent le même code de document.
- Même réponse pour « chantier inconnu » et « chantier interdit ». Aucun mail.
- Limites vérifiées dans la documentation officielle de Google (13/11/2026) : 6 minutes par exécution, 30 exécutions en même temps pour le compte. Chaque téléphone ne fait jamais plus de **2 demandes à la fois**.

## 5. La page (`carnet.html`)

**La liste** (tuile « Carnet » dans chaque chantier) : un document par ligne, gros caractères — intitulé, indice, date, poids (« 2,4 Mo »), et son état : « 📶 avec du réseau » ou « ✓ disponible sans réseau ». Une pastille « nouveau » quand l'indice a changé depuis la dernière ouverture sur ce téléphone.

**La visionneuse** :
- l'aperçu de la page s'affiche tout de suite (une demande, 200 à 300 Ko) ; en zoomant, seules les tuiles de la zone regardée sont demandées (environ 100 Ko par écran : cela passe en 3G) ;
- gros boutons « page précédente / suivante », numéro de page ;
- bouton **« Signaler ici »** : ouvre le signalement (lot 7) avec le chantier et le repère « <document>, page n » déjà remplis ;
- **tout ce qui a été affiché est gardé dans le téléphone** et se relit sans réseau ;
- **pas de bouton de rotation** : tourner le téléphone suffit (le plan d'origine en prévoyait un ; je propose de ne pas le faire — à me dire si tu y tiens).

| Sujet | Retenu | Écarté | Raison |
|---|---|---|---|
| Visionneuse | **Leaflet** (bibliothèque libre et gratuite, copiée dans le dépôt, sans rien charger d'ailleurs) | une visionneuse écrite à la main ; PDF.js | zoom et déplacement au doigt éprouvés sur tous les téléphones (T14) |
| Stockage dans le téléphone | une base **à part** (`loue_carnet_…`), comme pour les notes | la base des fiches | un retour arrière des pages ne peut pas casser la file des fiches |
| À qui sont les plans gardés | au compte qui les a téléchargés ; effacés si un autre compte se connecte sur le téléphone | partagés entre comptes | un poseur ne doit pas voir les plans d'un chantier qui n'est pas le sien |

## 6. Hors réseau complet (4b)

- **« Tout télécharger »** par document, avec le poids annoncé avant, une barre d'avancement, et l'arrêt possible ; il reprend où il s'était arrêté.
- **Android** : téléchargement automatique des documents nouveaux ou changés quand le téléphone est en Wi-Fi (Chrome le dit). **iPhone** : l'information n'existe pas ; l'appli propose le téléchargement à l'ouverture quand un indice a changé.
- **Place** : la place libre est lue avant un gros téléchargement ; l'appli demande au téléphone de ne pas effacer ses données.
- **Deux alertes claires dans la liste** : « ⚠ plus disponible sans réseau » (le téléphone a fait le ménage) et « ancien indice B — le C est sorti » tant que le nouveau n'est pas téléchargé (le plan périmé reste consultable, barré de rouge).
- Sur iPhone, vérifié dans la documentation de WebKit : une appli **installée sur l'écran d'accueil** n'est pas concernée par l'effacement automatique au bout de 7 jours sans visite. Un iPhone qui ouvre l'appli dans Safari sans l'installer, si : la page le dit.

## 7. Les skills (4c)

À faire **une seule fois**, à la fin, comme Franck l'a demandé, et validé par lui avec Claude :
1. **Vérification de faisabilité avec un vrai skill** (c'est le point jamais essayé, décision S1-3) : depuis une conversation du projet LOUE TRAVAIL, Claude voit-il la racine du Drive connectée, peut-il y lancer `depot_carnet.py` et y écrire ? Si un de ces points échoue, je reviens vers Franck avant d'aller plus loin.
2. **Blocs à coller**, mis à jour dans `docs/contrat-skills.md` :
   - dans chaque skill de plans : « quand Franck a validé le document (bordereau, ou sur sa demande), le déposer au carnet avec `depot_carnet.py` » ;
   - dans `gestion-documentaire` : contrôle de l'identité du chantier (règle 1), rapatriement des fiches de l'appli vers MEGA avec `rapatrier.py` et le relevé `mega-index.json` (règle 4), et les trois exceptions qui protègent ces fichiers.
3. `outils/rapatrier.py` : copie sans déplacer ni écraser, vérifie les tailles, écrit le relevé. Testé sur la copie TEST et un faux dossier MEGA avant tout vrai chantier.
4. Trois essais avec un vrai skill sur un vrai chantier, décrits pas à pas.

## 8. Ce que Franck aura à faire

| Quand | Quoi | Durée |
|---|---|---|
| 4a, au début | installer le module : `python -m pip install pypdfium2` (je donne la ligne ; gratuit, sans compte) | 2 min |
| 4a | un envoi clasp `--avec-porte`, ses essais sur téléphone avec ses vrais plans, un envoi `--sans-porte`, la production | comme les lots 7 et 3 |
| 4b | essais sur téléphone (mode avion, Wi-Fi), la production (pages seulement si le serveur ne change pas) | 20 min |
| 4c | connecter la racine du Drive à Claude, coller les blocs, 3 essais avec un skill | 30 à 45 min |

## 9. Risques et parades

| Risque | Parade |
|---|---|
| Un plan illisible au zoom | réglages de l'essai S1 (200 dpi, WebP 0,7), contrôle visuel à 375 px sur les vrais plans de `_prive/`, capture jointe au compte rendu |
| Une grande page trop longue à transformer (limite de 3 minutes) | travail page par page avec reprise ; durée mesurée avant livraison ; si elle ne tient pas, la page est coupée en bandes |
| Plan à moitié arrivé dans Drive | la liste n'est écrite qu'à la fin ; le serveur vérifie que tous les paquets sont là |
| Poser sur un plan périmé | « ancien indice — le nouveau est sorti », pastille « nouveau », dépôt seulement d'une version validée |
| Un poseur ouvre les plans d'un autre chantier | droit vérifié à chaque demande ; plans gardés par compte ; aucun lien public, aucun identifiant Drive envoyé |
| Trop de téléphones en même temps | 2 demandes à la fois par téléphone ; essai de charge avec 5 téléphones simulés sur la copie TEST |
| Le téléphone efface les plans | état affiché, alerte, demande de stockage durable ; l'appli installée sur l'écran d'accueil est protégée sur iPhone |
| Forfait des gars | rien n'est téléchargé d'office hors Wi-Fi ; le poids est toujours annoncé |
| Drive pour ordinateur ne synchronise plus | `depot_carnet.py --verifier` ; état « en cours d'arrivée » visible dans l'appli ; procédure de secours en 3 étapes dans la procédure du lot |
| Stockage Drive (15 Go) | les images pèsent environ le poids du PDF (essai S1) ; l'ancien indice part à la corbeille ; le suivi fin est le lot 5 |
| Le serveur change pendant que l'ancien répond encore | leçon du lot 3 : les essais réels attendent que le bon serveur réponde 6 fois de suite |

## 10. Tests prévus

- **Dépôt** : tests automatiques sur un PDF fabriqué pour l'occasion (petite et grande page, reprise après interruption, refus du mauvais dossier, rien de supprimé) ; **mesures sur les vrais plans de `_prive/`** (durée par page, nombre et poids des fichiers), jamais publiées.
- **Serveur** : droits par rôle, document incomplet, ancien indice mis à la corbeille (et lui seul), tuiles découpées à l'identique, taille des réponses, identifiants Drive jamais rendus.
- **Page** dans un vrai Chrome à 375 px : liste, ouverture, zoom, changement de page, relecture sans réseau, second compte sur le même téléphone, « Signaler ici », réseau lent.
- **Essais réels sur la copie TEST** avec de vrais plans déposés par le programme, et essai de charge.
- Toutes les séries existantes repassent.
- **Ce que je ne pourrai pas tester moi-même**, et que Franck verra sur son téléphone : la lisibilité réelle en plein soleil, le zoom au doigt, le téléchargement en Wi-Fi, un iPhone.

## 11. Ce qui n'est pas dans ce lot

- Le suivi du stockage, les alertes à 70 % et 85 %, la purge des chantiers terminés : **lot 5**.
- La case « garder le PDF » : **je propose de l'abandonner**. L'essai S1 a montré que les images à 200 dpi se lisent ; servir un PDF de 17 Mo à travers le serveur, sans lien public, n'est pas raisonnable sur un compte gratuit. Le PDF reste dans MEGA. À me dire si tu y tiens.
- Un indicateur dans le Sheet de la date du dernier dépôt par chantier : lot 5.

## 12. Trois points que je te demande de trancher en validant ce plan

1. **Pas de bouton de rotation** dans la visionneuse (§5).
2. **Pas de « garder le PDF »** (§11).
3. **Trois livraisons** (4a, 4b, 4c) plutôt qu'une seule (§2).
