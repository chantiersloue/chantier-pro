# Lot 1 — retouches après les essais sur TEST : plan

> Essais 1 à 16 et 18 validés par Franck. Trois retouches demandées (R1, R2, R3). Branche `refonte` (sources du lot 1),
> puis `livraison/lot-1-essai-2` (copie d'essai, sert aussi à l'essai 17) et `livraison/lot-1` (vraies pages, étape D).
> Rien n'est publié par moi : Franck fusionne.

## R1 — Photos et croquis en grand dans les PDF

### Constat
- Fabrication (A4 paysage, marges 1 cm : zone utile 277 × 190 mm) : une photo seule est limitée à 95 mm de haut, plusieurs à 135 mm.
  Un **croquis** est une image PNG de la taille de l'écran du téléphone (≈ 340 × 210 pixels) : affiché à sa taille propre, il fait ≈ 90 × 56 mm.
  `max-width` / `max-height` **n'agrandissent jamais** une image : c'est la vraie cause des croquis minuscules.
- Même défaut ailleurs (A4 portrait, marges 1,5 cm : zone utile 180 × 267 mm) : quitus (100 mm, puis 2 par ligne à 110 mm), bordereaux (idem),
  attestation (90 mm, puis 2 par ligne à 68 mm), note de réunion (130 mm, puis 2 par ligne à 120 mm), réception support (2 par ligne à 100 mm).
  Cotes et absence : pas de photos.

### Choix technique (comparaison)
| Option | Pour | Contre |
|---|---|---|
| A. Mise en page « souple » (flexbox, `object-fit`) qui remplit la page toute seule | Exact dans Chrome | Le PDF est fabriqué par Google (`HtmlService…getAs('application/pdf')`) sans JavaScript, avec un moteur ancien : rien ne garantit flexbox / `object-fit`. Impossible à vérifier sans le serveur |
| B. La page du téléphone mesure le document et envoie la place restante | Mesure réelle | Polices différentes sur le téléphone (pas d'Arial sur Android) → mesure fausse pour le serveur ; 7 pages à modifier ; fiches déjà en file sans la mesure |
| **C. Le modèle calcule lui-même** : taille de chaque image lue dans ses premiers octets (PNG / JPEG), hauteur du contenu **estimée** (lignes de tableau, texte), largeur et hauteur de l'image écrites en mm | Même calcul pour l'aperçu et le PDF (un seul modèle) ; n'utilise que des tableaux et des tailles en mm (déjà utilisés et validés par l'essai 16) ; agrandit aussi les croquis | Estimation : si elle se trompe, la photo passe à la page suivante (en grand) au lieu de rester page 1 |

**Choix : C**, calibré sur Chrome (le rendu Google est « très proche » de l'aperçu Chrome : essai 16), avec une marge de sécurité.

### Règles de mise en page (communes, nouveau fichier `modeles/mise-en-page.js`)
1. **Une photo** (la première photo de la fiche) se place **sur la page 1, sous le contenu** (tableau, texte, signatures), et prend **toute la place restante**, en gardant ses proportions (largeur et hauteur calculées, agrandissement permis).
   S'il reste moins de 60 mm (contenu trop long), elle part sur une page à elle, en pleine page.
2. **Un croquis** (image PNG dessinée dans l'appli) a **toujours une page entière** pour lui.
3. **Les autres photos** : une par page, en pleine page ; deux par page **seulement** si elles y gardent au moins 85 % de leur taille « seule »
   (ex. deux photos en largeur l'une sous l'autre sur une page A4 debout ; deux photos en hauteur côte à côte sur une page paysage).
4. La légende reste sous chaque photo. Taille inconnue (image illisible) : ancien comportement (`max-width` / `max-height`).
5. Quitus, bordereaux, attestation : les **signatures passent avant les photos** (sinon une photo qui remplit la page 1 rejetterait les signatures en page 2).
   La mention de l'organigramme reste collée aux signatures.
6. Réception support : chaque point garde sa page ; sa 1re photo prend la place sous le titre du point, les suivantes suivent les règles 2 et 3.
7. Note de réunion : le texte peut faire plusieurs pages ; la règle 1 ne s'applique que si l'estimation tient sur une page, sinon les photos commencent sur une nouvelle page.

### Les 4 endroits
Modèle (`modeles/*.js` + `mise-en-page.js`), écran (rien à changer : la fiche ne montre que des vignettes), aperçu (le même modèle : chaque page charge `modeles/mise-en-page.js`),
Apps Script (`Modeles.gs` regénéré, contient `mise-en-page.js`).

## R2 — Bordereau matériaux : liste de matériaux par défaut selon le Type

### Constat
- Le champ « Type » du bordereau matériaux propose aujourd'hui l'onglet *Materiaux* : c'est la liste des **panneaux et bois de la fiche de fabrication** (Médium, Mélaminé…).
- Le bordereau ne contient qu'une ligne « Nombre × Type ». Il n'y a pas de liste des matériaux remis.

### Choix (comparaison)
| Option | Pour | Contre |
|---|---|---|
| A. Une colonne de texte « matériaux » par type (plusieurs lignes dans une cellule) | 1 ligne par type | Une cellule sur plusieurs lignes (Alt+Entrée) est pénible dans Sheets, surtout sur téléphone |
| **B. Nouvel onglet « Matériaux bordereau » : une ligne par matériau** — A = Type, B = Matériau, C = Quantité (le même type répété sur plusieurs lignes) | Modifiable par Franck comme une simple liste, sans code ; ajout d'un type = ajouter des lignes | Le type est répété |
| C. Réutiliser l'onglet *Materiaux* | Rien à créer | Mélange avec la fiche de fabrication |

**Choix : B.**
- Le champ « Type » du bordereau matériaux propose les types de ce nouvel onglet (s'il est vide ou absent : l'onglet *Materiaux*, comme aujourd'hui).
- Choisir un type **remplit** un nouveau champ « Matériaux remis » (une ligne par matériau : « 2 × Vis inox »), **modifiable** sur place.
  Il n'est rempli que s'il est vide ou s'il contient encore la liste proposée pour l'ancien type : ce que le poseur a tapé n'est jamais écrasé.
- Le PDF montre « Matériaux remis » sous la ligne « Nombre × Type ». Brouillon : le champ est gardé (comme tous les champs).
- `verifierConfig` crée l'onglet (titres seulement) s'il n'existe pas. Rien ne change pour l'organigramme.
- 4 endroits : modèle `bordereau.js`, écran `bordereau.html`, aperçu (même modèle), Apps Script (lecture de l'onglet + `Modeles.gs`).

## R3 — Sablier « fiche en attente » qui reste affiché

### Cause trouvée
Le serveur reçoit la fiche et envoie le mail, mais la **réponse** n'arrive pas au téléphone. C'est typique quand l'appli passe en arrière-plan pendant l'envoi (on va voir le mail dans Gmail, l'écran s'éteint). iOS coupe alors la connexion.
La page croit à une coupure de réseau et attend **jusqu'à 5 minutes** avant de redemander. Pendant ce temps, le sablier reste.
« Envoyer maintenant » force la demande. Le serveur répond « déjà reçue » (numéro unique de la fiche) et le sablier disparaît **sans 2e mail**.
Deuxième cas : si on redemande pendant que le serveur fabrique encore le PDF, il répond « en cours ». La page le compte comme un refus et attend 1 à 60 minutes.

### Corrections (`commun/api.js`, rien côté serveur)
1. Fiche (pas les photos) partie avec du réseau mais sans réponse, ou réponse « en cours » : la fiche passe « **à confirmer** ». Le téléphone redemande vite (15 s, 30 s, 60 s, puis toutes les 5 min). « En cours » ne compte plus comme un refus.
2. Une minuterie relance la demande à l'heure prévue au lieu d'attendre le passage de chaque minute.
3. **Retour dans l'appli, retour du réseau** : les fiches en attente à cause du réseau (ou « à confirmer ») sont retentées **tout de suite**. Les fiches refusées par le serveur gardent leur attente.
4. Retour dans l'appli après plus de 5 s en arrière-plan pendant l'envoi d'une fiche : la demande, probablement morte, est abandonnée et refaite. Sans danger : le serveur ne traite qu'une fois un même numéro.
5. Plusieurs pages ouvertes (PC) : quand une page envoie une fiche, les autres mettent leur indicateur à jour (`BroadcastChannel`).
6. Détail de la file : « Envoyée, confirmation du serveur attendue… » pour une fiche « à confirmer ».

### Doublons de mail : vérifications
- Renvoi d'un même numéro (« Envoyer maintenant », relance automatique, 2 onglets) : le serveur répond « déjà reçue » ou « en cours » et n'envoie aucun mail. Test automatique ajouté.
- Le seul vrai doublon possible : refaire la fiche à la main dans le formulaire (nouveau numéro). Après la correction, le sablier est juste, donc il n'y a plus de raison de le faire. Pas de garde-fou en plus : il faudrait poser une question à chaque fiche du même chantier.
- Risque résiduel, déjà connu : une exécution du serveur coupée par Google au bout de 6 minutes, après l'envoi des mails. La fiche reste « en cours » et elle est retraitée 7 minutes plus tard. Très rare (une fiche se traite en quelques secondes).

## Version
Serveur `v5.1`, appli `5.1` (vérification facile après collage). Le service worker change tout seul (fichiers modifiés), ce qui sert à l'essai 17.

## Tests prévus
- Unitaires (node) : lecture de la taille PNG / JPEG ; règles 1 à 3 (une photo, croquis, paires) ; estimation ≥ hauteur réelle mesurée dans Chrome sur des fiches types (pas de débordement) et pas plus de 30 mm de perdu ; R2 lecture de l'onglet ; R3 file (réponse perdue → à confirmer → déjà reçue ; « en cours » non compté ; retour dans l'appli) ; serveur : même numéro 2 fois → 1 seul mail.
- PDF réels fabriqués par Chrome (`--print-to-pdf`) pour chaque fiche avec 1 photo, 3 photos, 1 croquis : contrôle visuel.
- Navigateur 375 px et PC : bordereau (type → liste), fiche de fabrication (aperçu), file d'envoi (faux serveur qui « perd » une réponse).
- Tests existants (lot 0 et lot 1) tous verts ; `node outils/construire.js --verifier`.

## Livraison
1. `refonte` : les 3 retouches + CHANGELOG, DECISIONS, procédure.
2. `livraison/lot-1-essai-2` (depuis `main`) : `essai/` regénéré + `A-COLLER-DANS-APPS-SCRIPT/Code.gs` + procédure. Franck colle Code.gs sur TEST (v5.1), puis fusionne pendant qu'une fiche est ouverte dans l'appli d'essai → essai 17.
3. `livraison/lot-1` (depuis `main`) : vraies pages du lot 1 avec les retouches, `essai/` retiré (étape D).
4. `lot-2` reprend les retouches (fusion de `refonte`), tests du lot 2 relancés.

## Après la critique indépendante (1 tour : 2 bloquants, 9 importants, 7 mineurs)
- **Moteur PDF de Google jamais mesuré (bloquant)** : aucun PDF du serveur n'est accessible ici. Deux protections :
  - **contrôle par le serveur** de chaque PDF qui contient une photo en page 1. Il lit le nombre de pages et le format réel (MediaBox). S'il y a une page de trop, il refait le PDF une fois, avec le format réel et la photo sur une page à elle. Quelques secondes de plus, rare ;
  - fonction **`essaiMiseEnPage`** à lancer sur TEST, sans mail. Elle fabrique un PDF d'essai dans le Drive et écrit dans le journal le format de page et le nombre de pages. Franck me donne ce journal.
- **Images** : seule la **largeur** est écrite (en mm), avec `height:auto;max-width:100%`. Les proportions sont toujours gardées, et l'aperçu sur téléphone ne déborde pas.
- **Croquis flous** : le canevas du croquis dessine en résolution double (plafond 1 400 px), avec un trait adapté et une pile d'annulation limitée. C'est un 5e endroit modifié (l'écran). Les croquis déjà faits restent en petite résolution.
- **Fabrication sur plusieurs pages** : la photo reste en page 1 **seulement** si le contenu estimé tient sur la page 1. Sinon, elle va sur une page à elle.
- **Gardé malgré la critique** : deux photos par page (si chacune garde 85 % de sa taille), pour ne pas multiplier les pages d'un quitus à 5 photos.
- **R2, sens de la demande (bloquant)** : la solution couvre les deux lectures possibles.
  - Si Franck ne remplit que la colonne A du nouvel onglet, c'est simplement **une liste de types dédiée** : rien d'autre ne change.
  - S'il remplit aussi les colonnes B et C, le type **remplit la liste des matériaux**.
  - Quantité = quantité remise, telle quelle, sans la multiplier par « Nombre ».
  - La liste proposée est retenue dans un champ caché, sauvegardé avec le brouillon : un changement de type après restauration marche aussi.
  - Ordre de déploiement : serveur d'abord, puis pages.
  - Fiche ancienne sans ce champ : rien ne s'affiche. Liste ancienne gardée dans le téléphone : liste *Materiaux*, comme aujourd'hui.
- **R3**, ajouts :
  - toute erreur pendant l'étape « fiche » avec du réseau, délai de 120 s dépassé compris, donne une fiche « à confirmer » ;
  - juste avant l'étape « fiche », la fiche est notée « à confirmer » dans le téléphone : si la page est fermée pendant l'envoi, la page suivante redemande tout de suite ;
  - « Envoyer maintenant » touché pendant un envoi garde maintenant son effet (défaut trouvé par le relecteur) ;
  - texte : « Pas encore confirmée par le bureau (nouvelle demande automatique) » ;
  - abandon au retour dans l'appli : seulement l'étape « fiche », commencée **avant** le passage en arrière-plan ;
  - canal entre onglets nommé par mode (`loue-file-<env>`).
- **Doublon déjà connu, cité** : le même brouillon envoyé depuis deux onglets donne deux fiches.
- **Ajouts** : guide des poseurs, essai en réseau lent et hors-ligne, retour arrière dans la procédure. L'ordre « signatures avant photos » est signalé à Franck dans le compte-rendu.
