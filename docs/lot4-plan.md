# Lot 4 — Carnet de chantier : plan

> Commande : `PLAN.md`, exigence 9 et « Lot 4 — Carnet de chantier » ; résultats de l'essai S1 (`docs/essai-s1.md`) ; contrat avec les skills (`docs/contrat-skills.md`).
> Réponses de Franck à l'interview du 13/11/2026 : D4-1 et D9b-5 (`DECISIONS.md`).
> **Version 2**, après critique par un agent indépendant (ce qu'elle a fait changer : chapitre 13).
> **Plan validé par Franck le 13/11/2026**, avec ses réponses au chapitre 12 (décision D4-2). Suivi de l'étape 4.0 : `docs/lot4-etape0.md`.

## 1. La commande, en clair

Les poseurs ouvrent sur leur téléphone les **plans et documents du chantier**, les lisent au zoom (cotes et repères nets), **même sans réseau** une fois téléchargés. Les documents arrivent depuis les skills de Franck, **sans manipulation de fichier**, et seulement quand Franck les a validés.

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

## 2. Une étape de vérification, puis trois livraisons

Le lot est le plus gros du projet. Trois points n'ont jamais été essayés et peuvent changer la conception : ils sont **vérifiés d'abord**, avant d'écrire la moindre page.

| | Contenu | Ce que ça apporte | Demandé à Franck |
|---|---|---|---|
| **4.0 — Trois vérifications** (une demi-journée) | voir §3 | on sait si le dépôt par un skill est possible, si le serveur est assez rapide avec une barre de réseau, et si les plans ne prennent pas la place des fiches | connecter la racine du Drive à Claude, installer le module, **un essai de 20 minutes** dans une conversation LOUE TRAVAIL, un envoi clasp `--avec-porte` |
| **4a — Déposer et lire** | le programme de dépôt, le serveur du carnet, la page « Carnet » et sa visionneuse | les plans sont lisibles sur le téléphone ; ce qui a été regardé reste lisible sans réseau | un envoi clasp, essais téléphone (dont **un iPhone**), production |
| **4b — Hors réseau complet** | « Tout télécharger », téléchargement en Wi-Fi, place, alertes « plus disponible » et « ancien indice » | le poseur prépare son téléphone au dépôt, et sait si son plan est à jour | essais téléphone, production |
| **4c — Les skills** | les blocs à coller (dépôt au carnet, contrôle de l'identité, rapatriement Drive → MEGA avec `rapatrier.py` et `mega-index.json`), validés par Franck avec Claude | un plan validé part au carnet tout seul ; les fiches de l'appli redescendent dans MEGA | coller les blocs, 3 essais avec un vrai skill |

Si une vérification du 4.0 échoue, **je reviens vers Franck avec les chiffres et une solution de repli avant de construire** (c'était déjà la règle S1-3).

Pendant 4a et 4b, le dépôt est lancé à la main : par moi sur la copie TEST ; **par Franck en production** (écrire dans le vrai Drive est une action sur des données réelles : je ne la fais pas). Un fichier `deposer.bat` lui pose les questions (quel chantier, quel PDF, quel code, quel indice) : aucune ligne à taper.

## 3. Étape 4.0 : les trois vérifications

**A. Un skill peut-il déposer ?** (20 minutes, Franck dans une conversation LOUE TRAVAIL, rien n'est collé dans les skills.) Je fournis un petit texte à coller dans la conversation, qui demande à Claude de : dire quelle version de Python il utilise, vérifier que Pillow et pypdfium2 s'y chargent, créer puis **réécrire** puis **renommer** un fichier dans un dossier d'essai du Drive TEST (la règle « suppression interdite » des dossiers connectés laisse-t-elle réécrire ?), dire s'il voit le dossier du dépôt GitHub, et transformer une grande page en moins de 3 minutes.
Le résultat décide **où vit le programme** : dans le dépôt s'il est visible depuis le skill ; sinon dans un dossier `_OUTILS` du Drive de l'appli ; en dernier recours, un `.bat` que Franck lance lui-même après validation du plan.

**B. Le serveur est-il assez rapide ?** Un essai sur la copie TEST avec de faux paquets, mesuré en réseau normal et en « 3G lente ». Objectifs chiffrés :

| Geste | Objectif en 3G lente |
|---|---|
| liste des documents d'un chantier | moins de 8 s (puis gardée dans le téléphone) |
| premier aperçu d'une page (image légère) | moins de 10 s |
| un écran de tuiles après un zoom | moins de 15 s |
| 10 puis 15 téléphones simulés en même temps | aucune erreur, aucune fiche retardée de plus de 30 s |

Ces mesures fixent la taille des paquets et des réponses. Si les objectifs ne sont pas tenus, les solutions de repli sont connues (tuiles plus petites, aperçu plus léger, lecture partielle par une autre voie qui demanderait une nouvelle autorisation à Franck) et je les lui soumets.

**C. Les plans ne doivent jamais prendre la place des fiches** (contrainte n° 5 : ne jamais casser le brouillon). Le téléphone donne **une seule réserve de place par site** : des centaines de Mo de plans pourraient empêcher l'enregistrement d'une fiche avec photos. Parade, testée dès 4.0 : le carnet garde toujours une marge libre, efface d'abord ses plans les plus anciens, traite « plein » chez lui sans jamais toucher à la file des fiches ; essai « carnet plein → une fiche avec photos part quand même ».

## 4. Le dépôt : du PDF aux pages-images (`depot_carnet.py`)

### Ce que fait le programme
1. Il reçoit **en argument** la racine du Drive de l'appli et le dossier du chantier (ou les lit dans un fichier de `_prive/`) : aucun chemin du PC dans le dépôt public. Il **ne crée jamais** le dossier d'un chantier (c'est l'appli qui le crée : sinon, doublons) ; il écrit le nom du chantier dans `carnet.json`, et le serveur vérifie que c'est le bon.
2. Il transforme chaque page du PDF, **par bandes** (une grande page ne tient pas d'un bloc en mémoire) :
   - un **aperçu léger** (800 px, 50 à 80 Ko) et un **aperçu net** (1 600 px) de la page entière ;
   - pour une grande page, des **tuiles** de 512 px à plusieurs niveaux de zoom, comme une carte ;
   - une petite page (A4 de texte) n'a que ses images entières.
3. Il range les tuiles par **paquets de tuiles voisines** (environ 4 × 4 tuiles, 300 à 500 Ko ; taille fixée par la mesure B). Une grande page fait 20 à 30 fichiers, pas trois cents.
4. Il écrit le tout dans `CARNET/<CODE> <INDICE> <INTITULÉ>/`, puis, **en dernier**, met à jour `CARNET/carnet.json` (la liste que l'appli lit). Pas de plan à moitié déposé.
5. Il **ne supprime rien**. L'ancien indice reste dans son dossier (voir §5).

### Garde-fous
- Refus si la racine ne contient pas `dossiers.json`, si le dossier du chantier n'existe pas, si le code du document n'est pas dans la liste du carnet (aucun devis, aucune pièce interne), si l'indice existe déjà (pas d'écrasement).
- Limite de 3 minutes des commandes lancées par un skill : travail **page par page, avec reprise**. Durée mesurée sur les vrais plans de `_prive/` (jamais publiés).
- `--verifier` : compare le carnet et `carnet.json` (fichiers manquants, poids, doublons « (1) » créés par Drive pour ordinateur).
- `--retirer` : retire de la liste un document déposé par erreur (il est masqué dans l'appli ; les fichiers ne sont pas supprimés).
- Module fixé : `pypdfium2==5.15.2` (vérifié sur le site officiel des modules Python : compatible avec le Python du PC, gratuit, libre).
- **Contrôle visuel obligatoire** avant 4a : le moteur n'est pas celui de l'essai S1 (qui passait par le navigateur). Les mêmes plans sont comparés, calques compris.

### Choix comparés

| Sujet | Retenu | Écarté | Raison |
|---|---|---|---|
| Transformer le PDF | **pypdfium2** | PyMuPDF (licence plus contraignante) ; Ghostscript ou Poppler (logiciels à installer à part) ; le navigateur (pas automatisable depuis un skill) | le plus simple à installer et à maintenir |
| Ranger les tuiles | **paquets de tuiles voisines** | un fichier par tuile (des milliers de petits fichiers : Drive pour ordinateur les synchronise mal) ; un gros paquet par page lu par morceaux (nouvelle autorisation Google) | peu de fichiers, **aucune nouvelle autorisation**, et un écran zoomé ne lit qu'un ou deux paquets |
| Ancien indice | **laissé en place en 4a** ; le serveur ne montre que le dernier | mis à la corbeille par le serveur dès qu'un poseur lit la liste | une suppression déclenchée par une simple lecture est trop risquée (fichier en double, liste coupée) ; le ménage sera fait au **lot 5**, avec journal et accord |
| Où vit le programme | décidé par la vérification A | — | les scripts des skills sont aujourd'hui recopiés à chaque session : il faut voir ce qui marche vraiment |

## 5. Le serveur (`apps-script/Carnet.gs`)

Actions réservées à un compte qui a accès au chantier (même contrôle que les notes) :

| Action | Rend |
|---|---|
| `carnet` `{ chantier }` | la liste des documents (dernier indice seulement) **et leur description** (pages, niveaux, paquets) en une seule demande, gardée dans le téléphone |
| `carnetTuiles` `{ chantier, doc, page, niveau, tuiles }` | l'aperçu ou les tuiles demandées ; **200 à 300 Ko au plus** en lecture ; jusqu'à 1,5 Mo seulement pour « Tout télécharger » |

- Le serveur lit avec les outils Drive qu'il utilise déjà : **aucune nouvelle autorisation** (vérifié : le manifeste n'en déclare pas, et l'outil est déjà utilisé).
- Le paramètre `doc` est contrôlé contre `carnet.json` : jamais un chemin. Les identifiants Drive ne sont **jamais envoyés** aux téléphones. Ils sont gardés en mémoire du serveur, sous une clé qui change à chaque nouvelle liste ; un fichier à la corbeille ou de mauvaise taille est refusé.
- **Document en cours d'arrivée** (Drive pour ordinateur met quelques minutes) : affiché tel quel, ne s'ouvre pas.
- **Aucune suppression par le serveur** dans ce lot. Deux `carnet.json` (doublon) → le serveur prend le plus récent et prévient Franck une fois.
- Même réponse pour « chantier inconnu » et « chantier interdit ». Aucun mail.
- Limites officielles (vérifiées le 13/11/2026) : 6 minutes par exécution, 30 exécutions en même temps pour tout le compte, **partagées avec l'envoi des fiches**. Donc : 2 demandes à la fois par téléphone en lecture, **1 seule** en téléchargement de masse, départ décalé au hasard, réponse « occupé » reprise plus tard.

## 6. La page (`carnet.html`)

**La liste** (tuile « Carnet » dans chaque chantier) : un document par ligne, gros caractères — intitulé, indice, date, poids, et son état : « 📶 avec du réseau » ou « ✓ disponible sans réseau ». Pastille « nouveau » quand l'indice a changé.

**La visionneuse** :
- l'aperçu léger s'affiche d'abord, puis l'aperçu net ; au zoom, seules les tuiles de la zone regardée sont demandées ;
- gros boutons « page précédente / suivante », numéro de page ; utilisable aussi sur PC (molette) ;
- un **bouton de rotation** (quart de tour) : les gars peuvent avoir verrouillé la rotation de leur téléphone (demande de Franck) ;
- bouton **« Signaler ici »** : ouvre le signalement (lot 7) avec le chantier et le repère « <document>, page n » déjà remplis. Cela touche `signaler.html` : test que le brouillon d'un signalement en cours **n'est pas écrasé** ;
- tout ce qui a été affiché est gardé dans le téléphone, dans la limite de place du §3-C.

**Règles des plans gardés dans le téléphone** (écrites et testées) :
- gardés pour le compte qui les a téléchargés ; **effacés** si un autre compte se connecte, ou si le serveur répond « interdit » (poseur retiré du chantier, compte désactivé) ;
- **gardés** quand la session expire pour le même compte (sinon un poseur sans réseau perdrait ses plans) ;
- ménage à chaque liste reçue : documents retirés, chantier terminé ; ancien indice effacé une fois le nouveau téléchargé.

**Technique** : `carnet.html`, la visionneuse et son script entrent dans la liste des fichiers gardés par l'appli pour le hors réseau (`sw.js`) et dans la numérotation des versions (`outils/construire.js`).

| Sujet | Retenu | Écarté | Raison |
|---|---|---|---|
| Visionneuse | **Leaflet** (libre, gratuite, copiée dans le dépôt) avec une couche écrite pour l'appli, qui regroupe les demandes de tuiles | visionneuse entièrement à la main ; PDF.js | le zoom au doigt est éprouvé ; la couche de regroupement, elle, est à nous et sera testée comme telle |
| Stockage | une base **à part**, avec plafond et ménage (§3-C) | la base des fiches | un retour arrière ne casse pas la file des fiches |
| Tuile « Plans » existante (liens Drive) | **laissée telle quelle** dans ce lot | supprimée | aucune fonctionnalité retirée sans accord ; à décider par Franck après 4b |

## 7. Hors réseau complet (4b)

- **« Tout télécharger »** par document **et par chantier**, poids annoncé avant, barre d'avancement, arrêt et reprise.
- **Android** : quand le téléphone est en Wi-Fi, les documents nouveaux de **mes chantiers** (pas « tous les chantiers » d'un conducteur) se téléchargent. **Limite à connaître** : cela ne marche qu'**appli ouverte et écran allumé** (une appli web ne travaille pas en arrière-plan) ; l'appli empêche l'écran de s'éteindre pendant le téléchargement. Compter 5 à 8 minutes pour un gros chantier.
- **iPhone** : le téléphone ne dit pas s'il est en Wi-Fi ; l'appli propose le téléchargement à l'ouverture quand un indice a changé.
- **Place** : l'appli demande au téléphone de ne pas effacer ses données (dès 4a) ; elle affiche ce que le carnet occupe.
- **Deux alertes** dans la liste : « ⚠ plus disponible sans réseau » et « ancien indice B — le C est sorti » (le plan périmé reste consultable, barré de rouge).
- iPhone (documentation de WebKit) : une appli **installée sur l'écran d'accueil** n'est pas effacée au bout de 7 jours sans visite ; ouverte dans Safari sans installation, si. L'appli installée a sa propre réserve : il faut s'y reconnecter et retélécharger. Écrit dans le guide des poseurs.

## 8. Les skills (4c)

À faire **une seule fois**, à la fin, et validé par Franck avec Claude. Le risque de faisabilité est déjà levé au 4.0.
1. **Blocs à coller**, mis à jour dans `docs/contrat-skills.md` :
   - dans chaque skill de plans : « quand Franck a validé le document, le déposer au carnet » ;
   - dans `gestion-documentaire` : contrôle de l'identité (règle 1), rapatriement vers MEGA avec `rapatrier.py` et `mega-index.json` (règle 4) ;
   - **une interdiction nouvelle** : dans le Drive de l'appli, les règles habituelles de rangement (une seule version, archivage `0-OLD`) **ne s'appliquent pas** ; un skill n'y écrit que le dossier `CARNET/` (par le programme) et `mega-index.json` ; `carnet.json` est le second fichier qu'un skill a le droit de réécrire.
2. `rapatrier.py` : copie sans déplacer ni écraser, vérifie les tailles, écrit le relevé. Testé sur la copie TEST et un faux dossier MEGA.
3. Trois essais avec un vrai skill, décrits pas à pas.

## 9. Ce que Franck aura à faire

| Quand | Quoi | Durée |
|---|---|---|
| 4.0 | installer le module (une ligne fournie, puis une ligne de contrôle) ; vérifier que Drive pour ordinateur tourne ; connecter la racine du Drive à Claude ; l'essai A (texte fourni à coller) ; un envoi clasp `--avec-porte` | 45 min |
| 4a | un envoi clasp, essais sur téléphone avec de vrais plans (**Android et un iPhone**), envoi `--sans-porte`, production, puis premier dépôt réel avec `deposer.bat` | comme les lots 7 et 3, plus 15 min |
| 4b | essais sur téléphone (mode avion, Wi-Fi), production | 20 à 30 min |
| 4c | coller les blocs, 3 essais avec un skill | 30 à 45 min |

Retour arrière à chaque étape : revenir aux pages précédentes par une fusion inverse (la tuile « Carnet » disparaît, rien d'autre ne change) ; le dossier `CARNET/` du Drive peut rester, il ne gêne rien. `CHANGELOG.md` et `docs/guide-utilisateur.md` sont mis à jour à chaque livraison.

## 10. Risques et parades

| Risque | Parade |
|---|---|
| Le dépôt par un skill est impossible | vérification A avant toute construction, trois solutions de repli |
| Trop lent avec une barre de réseau | vérification B avec objectifs chiffrés, aperçu léger d'abord, petites réponses |
| Les plans prennent la place des fiches et des brouillons | vérification C, plafond, ménage, essai « carnet plein » |
| Plan illisible au zoom | réglages S1, contrôle visuel du nouveau moteur sur les vrais plans, à 375 px et sur PC |
| Grande page trop longue à transformer | par bandes, page par page, avec reprise ; durée mesurée |
| Plan à moitié arrivé dans Drive | liste écrite en dernier ; le serveur vérifie les paquets |
| Poser sur un plan périmé | « ancien indice », pastille « nouveau », dépôt d'une version validée seulement |
| Un poseur voit les plans d'un autre chantier | droit vérifié à chaque demande ; plans gardés par compte, effacés sur refus ; aucun lien public |
| Trop de téléphones le lundi matin | une demande à la fois en téléchargement de masse, départs décalés, essai à 15 téléphones |
| Mauvais document déposé | `--retirer` |
| Doublons créés par Drive pour ordinateur | détectés par `--verifier` et par le serveur ; jamais de création de dossier chantier depuis le PC |
| Stockage Drive (15 Go) | images ≈ poids du PDF ; les anciens indices restent jusqu'au lot 5 (à surveiller : affiché par `--verifier`) |
| L'ancien serveur répond encore après un envoi | les essais réels attendent 6 bonnes réponses de suite (leçon du lot 3) |

## 11. Tests prévus

- **Dépôt** (tests Python sans rien installer de plus : `unittest`, fourni avec Python) : PDF fabriqué (petite et grande page), reprise après interruption, refus (mauvais dossier, code inconnu, indice existant), rien de supprimé, `--retirer`, `--verifier`.
- **Serveur** : droits par rôle, document incomplet, doublon de liste, tuiles découpées **à l'identique** — le faux Drive des tests est corrigé pour rendre les octets comme le vrai (de −128 à 127), sinon un découpage juste en test serait faux en vrai —, taille des réponses, identifiants jamais rendus.
- **Page** dans un vrai Chrome à 375 px et sur PC : liste, ouverture, zoom, pages, relecture sans réseau, second compte, compte refusé, carnet plein, « Signaler ici » sans écraser un brouillon, réseau lent.
- **Essais réels sur la copie TEST** : vrais plans déposés par le programme, mesures du 4.0-B refaites sur la version finale, charge à 15 téléphones.
- Toutes les séries existantes repassent.
- **Ce que seul Franck peut voir** : lisibilité en plein soleil, zoom au doigt, Wi-Fi réel, **un iPhone réel avant la production de 4a**.
- **Ce qui ne sera vu qu'à l'usage**, et que je surveillerai avec lui : délais réels de Drive pour ordinateur, effacement par iOS, vraie barre de réseau sur chantier.

## 12. Ce que je te demande de trancher en validant ce plan

1. **Une étape de vérification (4.0) puis trois livraisons** (4a, 4b, 4c), plutôt qu'une seule.
2. ~~Pas de bouton de rotation~~ → **Franck : il faut un bouton de rotation** (rotation du téléphone parfois verrouillée). Ajouté au §6.
3. **Pas de « garder le PDF »** : les images à 200 dpi se lisent (essai S1) ; servir un PDF de 17 Mo par le serveur, sans lien public, n'est pas raisonnable sur un compte gratuit. Le PDF reste dans MEGA.
4. **Les anciens indices restent dans Drive jusqu'au lot 5** (invisibles dans l'appli) : pas de suppression automatique dans ce lot.
5. **Simplifications par rapport au plan d'origine** (dis-moi si l'une te manque) :
   - les codes sont ceux de tes documents (105, 106…) et **l'indice est celui que tu donnes** : le programme refuse un indice déjà déposé au lieu d'en inventer un ;
   - `--verifier` compare le carnet à sa liste, **pas MEGA au Drive** (le rapprochement MEGA ↔ Drive relève du rapatriement, en 4c) ;
   - **pas d'onglet « Carnet index » dans le Sheet** : la liste est le fichier `carnet.json` (qui note aussi le nom et le poids du PDF d'origine) ;
   - la **date du dernier dépôt par chantier** dans le Sheet et le suivi du stockage attendent le **lot 5** ;
   - la tuile « Plans » actuelle (liens Drive) **reste** pour l'instant ; **son retrait sera proposé à Franck à la fin de 4b**, une fois le carnet en production (sa demande).

**Réponses de Franck (13/11/2026)** : 1 oui ; 2 bouton de rotation à ajouter ; 3 oui ; 4 oui ; 5 oui, avec le retrait de la tuile « Plans » à lui proposer à la fin de 4b.

## 13. Ce que la critique indépendante a fait changer (13/11/2026)

- **Trois vérifications passent avant toute construction** (étape 4.0) : dépôt depuis un vrai skill (prévu en dernier dans la version 1, alors que la commande l'exigeait avant), rapidité réelle du serveur avec objectifs chiffrés, place partagée entre plans et fiches.
- **Plus de mise à la corbeille par le serveur** dans ce lot (trop risquée sur une simple lecture) : repoussée au lot 5.
- Paquets **de tuiles voisines** et plus petits ; aperçu léger d'abord ; réponses de 200 à 300 Ko en lecture ; liste et description en une seule demande.
- Le programme reçoit la racine et le dossier en argument, ne crée jamais de dossier de chantier, sait **retirer** un document, détecte les doublons.
- Règles écrites pour les plans gardés dans le téléphone (autre compte, compte refusé, session expirée, ménage).
- Limites dites clairement : téléchargement Wi-Fi seulement appli ouverte ; une seule demande à la fois en téléchargement de masse ; essai de charge à 15 téléphones.
- Interdiction nouvelle pour les skills dans le Drive de l'appli ; `deposer.bat` pour Franck ; iPhone réel exigé avant la production ; faux Drive des tests corrigé ; abandons et simplifications tous listés au chapitre 12.
- Points confirmés par le critique : le module est installable et gratuit ; aucune nouvelle autorisation Google n'est nécessaire.
