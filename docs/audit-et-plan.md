# ChantierPro — Recherche, audit et plan

> Document public (le dépôt GitHub est public) : il ne contient aucun identifiant de dossier, aucune adresse, aucun nom de client ni de contact, et rien de recopié depuis `_prive/`.
> État : **recherche et audit terminés (29/10/2026)**. Le plan détaillé par lots sera ajouté ici après l'interview.

## Petit lexique

| Mot | Ce que ça veut dire |
|---|---|
| **Apps Script** | Le programme Google qui reçoit les fiches, fabrique les PDF, range dans Drive et envoie les mails. Il a une adresse web (« URL ») que l'appli appelle. |
| **Requête** | Un message envoyé par l'appli à Apps Script (« donne-moi la liste des chantiers », « voici une fiche »). |
| **PWA** | « Appli web installable » : un site qu'on ajoute à l'écran d'accueil du téléphone et qui se comporte comme une appli. |
| **Service worker** | Petit programme que le navigateur garde sur le téléphone : il permet d'ouvrir l'appli sans réseau. |
| **Cache** | Copie gardée sur le téléphone pour ne pas retélécharger. |
| **File d'attente** | Liste des fiches remplies sans réseau, renvoyées automatiquement plus tard. |
| **Hacher un mot de passe** | Le transformer de façon irréversible : on peut vérifier qu'il est bon, mais personne ne peut le relire. |
| **Jeton** | Une sorte de badge signé que le téléphone garde après la connexion, et qu'il montre à chaque requête. |
| **JSONP / fetch** | Deux façons pour une page de demander des données à Apps Script. JSONP est ancien et moins sûr, à réserver aux lectures. |
| **Échapper un texte** | Le rendre inoffensif avant de l'afficher (un `<` ou un `"` tapé par un poseur ne doit pas casser la page). |
| **Base64** | Façon d'écrire une photo en texte pour l'envoyer ; elle grossit de 33 %. |

---

## 1. Recherche

Sources officielles lues le 29/10/2026. **[off.]** = page officielle ; **[conn.]** = connaissance générale non revérifiée ; **[incert.]** = à tester.

### 1.1 Quotas Google pour un compte GRATUIT

Source : [Quotas for Google Services](https://developers.google.com/apps-script/guides/services/quotas) **[off., page mise à jour le 03/09/2026]**.

| Quota | Compte gratuit | (Workspace, pour comparer) |
|---|---|---|
| Destinataires de mails par jour | **100** | 1 500 |
| Durée maximale d'une exécution | **6 min** | 6 min |
| Déclencheurs automatiques (temps total par jour) | **90 min** | 6 h |
| Exécutions simultanées | **30** par utilisateur | 30 |
| Google Docs créés par jour | 250 | 1 500 |
| Taille des pièces jointes d'un mail | 25 Mo | 25 Mo |
| Corps d'un mail | 200 Ko | 400 Ko |
| Lectures/écritures « Properties » par jour | 50 000 | 500 000 |
| Valeur « Properties » | 9 Ko (500 Ko au total) | idem |
| Cache (CacheService) | 100 Ko par valeur, 6 h maximum, 1 000 éléments | idem |

- Le compteur des quotas journaliers repart 24 h après la première requête.
- `MailApp.getRemainingDailyQuota()` donne le nombre de mails restant : on peut **refuser proprement** avant d'atteindre la limite.
- Aucune limite documentée pour la taille d'une fiche reçue par `doPost` **[incert.]** : rester sous 5 à 10 Mo par requête.
- **Stockage** : 15 Go partagés entre Drive, Gmail (corbeille et spam compris) et Photos ([aide Google One](https://support.google.com/googleone/answer/9312312) **[off.]**). Une fois plein : plus d'ajout dans Drive, plus de création de fichiers, Gmail perturbé. Taille maximale d'un fichier Drive : 5 To ([aide Drive](https://support.google.com/drive/answer/37603) **[off.]**), donc sans souci pour nous.
- **GitHub Pages** : site de 1 Go maximum, 100 Go de bande passante par mois ([docs GitHub](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits) **[off.]**). Les pages sont gardées en cache 10 min par les navigateurs (en-tête vérifié).

**À retenir** : le quota qui nous contraint vraiment est **100 destinataires de mails par jour**. Une note de réunion envoyée à 8 personnes en consomme 8.

### 1.2 Connexion avec identifiant et mot de passe

Contraintes d'Apps Script ([guide web apps](https://developers.google.com/apps-script/guides/web) **[off.]**) : pas de cookie possible, pas d'accès aux en-têtes de la requête ni à l'adresse IP du téléphone. Le jeton doit donc voyager **dans le corps de la requête**.

| | A. Comptes maison dans un onglet du Sheet | B. Connexion Google | C. Firebase Auth |
|---|---|---|---|
| Coût | 0 € | 0 € | 0 € (plan gratuit) |
| Nouvel outil | aucun | console Google Cloud | Firebase |
| Ce qu'il faut aux poseurs | rien | **un compte Google chacun** | une adresse mail |
| Connexion longue sur le téléphone | oui | non (≈ 1 h, il faut quand même un jeton maison) | oui |
| Mot de passe oublié | Franck réinitialise | géré par Google | mail auto (150/jour) |
| Facile à maintenir pour un débutant | ★★★ | ★★ | ★ |

Sources : [vérification d'un jeton Google](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token) **[off.]** ; [limites Firebase](https://firebase.google.com/docs/auth/limits) **[off.]**.

**Recommandation : A, comptes maison**, faits sérieusement :
- mot de passe **haché avec un « sel »** propre à chaque compte (fonction HMAC-SHA256 répétée, réglée pour prendre environ 0,3 s) ; jamais en clair ;
- **5 essais ratés → 15 min de blocage** de l'identifiant ;
- **jeton signé** (identifiant + date d'expiration + signature) avec une clé secrète rangée dans les « Propriétés du script » d'Apps Script, **jamais dans le dépôt**. Valable 60 à 90 jours, prolongé à chaque usage ;
- Franck peut **déconnecter un téléphone** (téléphone perdu, départ d'un salarié) en un clic ;
- mot de passe oublié : Franck génère un mot de passe provisoire, que le poseur change à la connexion suivante. Aucun mail, donc aucun quota consommé ;
- **toutes** les requêtes (sauf la connexion) vérifient le jeton et les droits sur le chantier, côté Apps Script.

B est écarté parce qu'il oblige chaque poseur à avoir un compte Google ; C ajoute un outil pour un gain faible avec 20 utilisateurs.

### 1.3 Mode hors-ligne

- **Synchronisation en arrière-plan** (la fiche part même appli fermée) : fonctionne sur Android/Chrome, **pas sur iPhone** ([caniuse](https://caniuse.com/background-sync), [MDN](https://developer.mozilla.org/en-US/docs/Web/API/Background_Synchronization_API) **[off.]**). On ne peut pas compter dessus.
- **Safari (iPhone) peut effacer les données d'un site après 7 jours sans visite**, sauf pour une appli **ajoutée à l'écran d'accueil** ([WebKit](https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/), [politique de stockage](https://webkit.org/blog/14403/updates-to-storage-policy/) **[off.]**).
- Place disponible sur le téléphone : largement suffisante (jusqu'à environ 60 % du disque) ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria) **[off.]**).

| | File d'attente sur le téléphone + renvoi automatique | Synchronisation en arrière-plan seule |
|---|---|---|
| iPhone | oui | **non** |
| Envoi appli fermée | non (renvoi à la réouverture) | oui, Android seulement |
| Complexité | moyenne | moyenne, plus un plan B obligatoire |

| | Service worker écrit à la main (≈ 80 lignes) | Bibliothèque Workbox |
|---|---|---|
| Dépendance | aucune | oui ([doc](https://developer.chrome.com/docs/workbox/modules/workbox-sw) **[off.]**) |
| Lisible par Franck | oui | non |

**Recommandation** :
- service worker écrit à la main ;
- **file d'attente stockée sur le téléphone** (IndexedDB), renvoyée au retour du réseau, à la réouverture de l'appli et sur un bouton « Envoyer maintenant » ;
- un **numéro unique par fiche**, pour que le serveur ignore un doublon si une réponse s'est perdue ;
- un compteur visible : « 2 fiches en attente », puis « Envoyée ✓ » quand le serveur a **vraiment** confirmé ;
- **installation sur l'écran d'accueil obligatoire** pour les iPhone ;
- **pas de mise à jour automatique en pleine saisie** : un bandeau « Nouvelle version — toucher pour mettre à jour », le brouillon étant sauvé avant.

### 1.4 Afficher vite des PDF lourds sur smartphone

Les plans produits par les skills pèsent plusieurs Mo **par page** (dessin scanné ou image de fond).

| Option | Rapide en réseau faible ? | Hors-ligne ? | Remarques |
|---|---|---|---|
| a. Aperçu Google Drive | **oui** : Drive envoie seulement les pages regardées, en images **[conn., non documenté]** | non | demande un partage « tous ceux qui ont le lien » |
| b. Lecteur PDF.js dans l'appli | moyen : il faut télécharger le PDF | oui, une fois gardé | lire directement depuis Drive bute sur des règles de sécurité (CORS) **[incert., à tester]** ([FAQ PDF.js](https://github.com/mozilla/pdf.js/wiki/Frequently-Asked-Questions) **[off.]**) |
| c. Version allégée préparée à l'avance | **oui** | oui | Apps Script **ne sait pas** transformer un PDF en images : la version allégée doit être produite **par le skill**, sur le PC |
| d. « Garder sur le téléphone » | — | **oui** | téléchargement une fois, au dépôt sur le Wi-Fi |

**Recommandation (à détailler dans le plan du lot 4)** :
- chaque skill produit, en plus du PDF complet, une **version « terrain » allégée** (images de page compressées) ;
- l'appli affiche le **poids avant téléchargement** ;
- les documents ouverts une fois restent **sur le téléphone** ;
- un bouton « Tout télécharger en Wi-Fi ».
- Le lien public de l'aperçu Drive (option a) est **en conflit avec ta règle « jamais de lien public devinable »**. Un lien Drive n'est pas devinable, mais il peut être retransmis. À trancher pendant l'interview.

### 1.5 Compression des photos

- Les navigateurs récents redressent automatiquement les photos selon le capteur (EXIF) ([MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/image-orientation) **[off.]**). La recompression **efface la position GPS** de la photo, ce qui protège la vie privée.
- iPhone : avec un champ photo réglé sur `image/*`, Safari convertit les photos HEIC en JPEG **[incert., à tester]** ([bug WebKit](https://bugs.webkit.org/show_bug.cgi?id=303803)).

| | Code maison (≈ 30 lignes) | Bibliothèque `browser-image-compression` |
|---|---|---|
| Dépendance | aucune | oui |
| Résultat | ≈ 200 à 400 Ko par photo | équivalent |

**Recommandation : code maison**, grand côté 1600 px, qualité JPEG 0,7. Si une photo est illisible, afficher un message clair au lieu de bloquer l'envoi. Envoyer **une photo par requête** : si le réseau coupe, on ne renvoie que la photo manquante.

### 1.6 MEGA : l'appli peut-elle lire les fichiers ?

- **Pas d'outil officiel** pour qu'une page web lise MEGA. La bibliothèque non officielle `megajs` ([site](https://mega.js.org/)) télécharge **le fichier entier** avant de l'afficher : impossible pour un plan de 30 Mo en 3G.
- Un lien MEGA contient **sa clé de déchiffrement** : le mettre dans l'appli (dépôt public) revient à ouvrir le dossier à tout le monde.
- Le quota de téléchargement gratuit n'est pas publié. Selon des sources non officielles, il est compté par adresse IP **[incert.]**, et les opérateurs mobiles font partager une même adresse à beaucoup d'abonnés.
- MEGAcmd ([GitHub](https://github.com/meganz/MEGAcmd)) peut servir les fichiers en WebDAV, mais seulement sur le PC lui-même.

**Conclusion : MEGA reste l'archive maîtresse, mais Google Drive est le seul pont réaliste vers les téléphones.** Seule une **sélection de documents « terrain »** passe de MEGA vers Drive.

### 1.7 Dictée vocale

| | Bouton micro du clavier du téléphone | Reconnaissance vocale intégrée à la page (Web Speech) |
|---|---|---|
| Code à écrire | **aucun** | oui |
| iPhone / Android | oui / oui | partiel, variable selon le navigateur **[conn.]** |
| Hors-ligne | souvent oui sur téléphones récents **[conn.]** | non (envoyé aux serveurs Google/Apple) |

**Recommandation** : s'appuyer sur le **micro du clavier**, et montrer aux gars où il se trouve (guide utilisateur). Ajouter un gros bouton « 🎤 Dicter » seulement si la reconnaissance intégrée est disponible sur le téléphone.

### 1.8 Risques connus et parades

| Risque | Parade |
|---|---|
| Adresse Apps Script publique : n'importe qui peut l'appeler | jeton obligatoire, liste fermée d'actions, droits vérifiés par chantier |
| Mails envoyés vers des adresses choisies par la page | **destinataires pris uniquement dans le Sheet**, plafond journalier avec une réserve pour Franck |
| Texte commençant par `=`, `+`, `-` ou `@` interprété comme une formule dans le Sheet | ajouter une apostrophe devant |
| JSONP (ancien mode de lecture) | réservé aux lectures non sensibles, comme le recommande Google ([doc](https://developers.google.com/apps-script/guides/content) **[off.]**) ; toutes les écritures en `fetch` POST |
| Nouveau déploiement Apps Script = nouvelle URL | URL écrite dans **un seul fichier** `config.js` ; « Gérer les déploiements → Modifier → Nouvelle version » garde l'URL **[conn.]** |
| 30 exécutions simultanées, 6 min maximum | verrou d'écriture (LockService), réponses courtes, PDF fabriqué une seule fois |
| Stockage plein | photos compressées, purge et archivage vers MEGA des chantiers terminés |

---

## 2. Audit du code existant

Périmètre :
- 10 pages HTML : `index`, `cotes`, `fiche-fabrication`, `note-reunion`, `bordereau-orga`, `bordereau-materiaux`, `quitus`, `attestation`, plus **`absence` et `reception-support`, absentes de CLAUDE.md** ;
- `apps-script/Code.gs` (1 361 lignes).
- Syntaxe vérifiée avec `node --check` : **aucune erreur** sur les 10 pages ni sur Code.gs.

### 2.1 Sécurité — ce que peut faire quelqu'un qui connaît l'URL Apps Script

L'URL est écrite dans les 10 pages du dépôt public, et Apps Script est ouvert à « tout le monde, même anonyme ». Aujourd'hui, **sans aucun mot de passe**, n'importe qui peut :

1. **BLOQUANT — faire envoyer des mails par le Gmail de Loué vers n'importe quelle adresse**, avec un PDF à l'en-tête Loué. Toutes les fiches transmettent leur liste de destinataires, et le serveur l'utilise telle quelle :
   - `destinataires` : note, bordereaux, quitus, absence ;
   - « email perso » : absence ;
   - `conducteurEmail` / `destSupp` : réception, attestation.

   Conséquences : spam au nom de Loué, quota de 100 mails vidé (plus aucune fiche ne part de la journée), risque de blocage du compte.
2. **IMPORTANT — télécharger tous les contacts** (noms, mails, fonctions, internes et externes) avec `action=getContacts`. C'est un sujet RGPD, la loi sur les données personnelles.
3. **IMPORTANT — remplir le Sheet et le Drive** de fausses fiches, sans limite.
4. **IMPORTANT — partage automatique de tous les fichiers des chantiers** : quand un dossier chantier est ouvert dans l'appli, Code.gs passe **chaque fichier** (Accès, Sécurité, CCTP, Plans…) et chaque PDF produit en « tous ceux qui ont le lien peuvent voir ». Il fait de même pour le dossier Planning.
5. **IMPORTANT — identifiants de dossiers Drive dans le dépôt public** : dans `Code.gs` (dossier racine et dossier Planning) **et dans CLAUDE.md lui-même**, ce qui contredit sa règle 6.
6. **MINEUR** — texte saisi inséré dans les pages et dans le HTML des PDF **sans échappement**. Pas de danger pour les autres utilisateurs aujourd'hui (aucun écran n'affiche les saisies d'un autre), mais **ce le deviendra avec les notes partagées du lot 3**.

### 2.2 Bugs qui font perdre des données

| Gravité | Où | Problème |
|---|---|---|
| BLOQUANT | toutes les fiches | Envoi « à l'aveugle » (`mode: no-cors`) : la page ne peut pas lire la réponse. **« Envoyé ! » s'affiche et le brouillon est effacé même si le serveur a échoué.** De son côté, le serveur répond « ok » même quand le PDF, Drive ou le mail ont échoué. |
| BLOQUANT | fiche-fabrication, reception-support, absence, attestation | **Pas de brouillon automatique**, contrairement à ce que dit CLAUDE.md. Attestation : brouillon manuel qui stocke les photos non compressées, en double ; il dépasse la place disponible dès la première photo et **ne sauve alors plus rien, même pas le texte**. |
| BLOQUANT | reception-support | La **zone de signature ne s'affiche jamais** (le code cherche un élément `section-dest` qui n'existe pas et s'arrête). |
| BLOQUANT | reception-support, attestation | Photos envoyées **sans compression** : 20 à 33 Mo pour 5 photos, plus de 7 min en 3G, risque de dépasser les 6 min d'Apps Script. Explique les attestations de plus de 10 Mo dans Drive. |
| BLOQUANT | note-reunion, bordereaux, quitus | Une photo illisible (HEIC sur PC ou Android, fichier abîmé) **bloque le bouton sur « Envoi… »** pour toujours. |
| BLOQUANT | fiche-fabrication | En « huisserie seule », **hauteur, largeur et talon** sont affichés et dans l'aperçu, mais **le serveur ne les lit pas** : l'atelier ne les reçoit pas. |
| BLOQUANT | absence | Changer la taille de l'écran (clavier qui s'ouvre, barre d'adresse Android) **efface la signature**, mais la fiche part quand même avec une signature blanche. |
| IMPORTANT | toutes les fiches avec liste de chantiers | Si la liste ne se charge pas (réseau faible), **impossible de choisir le chantier, donc d'envoyer**, sans aucun message. Rien n'est gardé en mémoire d'une fois sur l'autre. |
| IMPORTANT | cotes, note, bordereaux, quitus | « Restaurer » le brouillon avant la fin du chargement de la liste **efface le chantier restauré**, sans prévenir. |
| IMPORTANT | brouillons existants | Ne gardent ni les **photos**, ni les **signatures**, ni les **destinataires** ; quitus : ni le choix « Soldé OUI/NON » ; cotes : les tuiles Plinthe/Socle/Sol ne se réaffichent pas. |
| IMPORTANT | toutes | **Double envoi** possible : le bouton se réactive et la fiche n'est pas vidée. |
| IMPORTANT | Code.gs | Quand le destinataire est introuvable, l'adresse de secours (`Session.getActiveUser()`) est **vide** pour un utilisateur anonyme : **le mail ne part pas, sans rien dire**. |
| IMPORTANT | Code.gs | La fiche de fabrication n'a pas de protection autour de l'envoi du mail : un échec fait planter tout l'enregistrement. |
| IMPORTANT | cotes | Logement limité à 4 caractères, pièce à 5 (« Chambre » est tronqué). Avec un socle, le tableau est décalé d'une colonne. Le type de sol reste figé sur les anciennes lignes. Le bâtiment est envoyé mais n'apparaît pas dans le PDF. |
| IMPORTANT | fiche-fabrication | Le n° de série « Auto » n'est jamais rempli. Un appui à côté du croquis le ferme et **perd le dessin**. |
| IMPORTANT | attestation | À partir de la 3ᵉ photo, **les photos disparaissent du PDF** (l'aperçu les montre toutes). Le texte de l'objet peut être vide. |
| IMPORTANT | quitus | Les légendes des photos sont saisies mais n'apparaissent nulle part. La liste « Client » propose… les salariés de Loué. |
| IMPORTANT | note-reunion | Une adresse tapée sans appuyer sur « + Ajouter » est perdue. Erreur à chaque ajout de destinataire (élément `dest-list` absent). Photo annotée réduite à la largeur de l'écran, donc floue dans le PDF. |
| IMPORTANT | toutes | Un `"` ou un `<` dans un texte **tronque la saisie** au réaffichage ou dans le PDF. |
| IMPORTANT | bordereaux, quitus, réception | **Signatures étirées et floues** : zone affichée sur environ 150 px de large, enregistrée en 300 ou 600. Aucune vérification qu'il y a bien une signature. |
| IMPORTANT | Code.gs | Bordereaux rangés dans le dossier Drive « Quitus ». Documents triés par date comme du texte (« 02/11 » passe avant « 30/10 »). |
| MINEUR | divers | Les dates partent tantôt en `2026-11-12`, tantôt en `12/11/2026`. Calculs de semaine faux certains jours (fuseau horaire, semaines 53). Couleurs `--teal` non définies sur l'accueil. Textes « Vous recevrez une copie » faux : c'est le conducteur qui la reçoit. |

### 2.3 Code en double

- **URL Apps Script copiée dans les 10 pages.**
- Fonctions recopiées de page en page :

  | Fonction | Nombre de copies |
  |---|---|
  | `showToast` | 10 |
  | `loadContacts` | 9 (4 versions différentes) |
  | `openPreview` | 9 |
  | signatures (`initSig`, `clearSig`) | 6 (3 façons de dessiner) |
  | `renderPhotos` | 6 |
  | brouillon (`_br…`) | 5 |
  | destinataires | 5 |
  | `compressPhoto` | 4 |

- `bordereau-orga.html` et `bordereau-materiaux.html` : **identiques à 98 %** (9 petites différences). Le serveur les traite déjà ensemble.
- ≈ 190 lignes de **code mort** dans `fiche-fabrication.html` (anciens modes « porte » et « photo »).
- **Deux modèles pour chaque PDF** : l'aperçu dans l'appli et le PDF fabriqué par Apps Script sont écrits séparément. Ils ont déjà divergé (titres, colonnes, photos, mise en page).
- **Le même PDF est refabriqué une fois par destinataire** (5 destinataires = 5 conversions) : lent et inutile.
- La règle « 4 endroits à modifier pour un changement de données » vient directement de cette duplication.
- Le service avancé « Gmail » est activé dans `appscript.json` mais jamais utilisé.

### 2.4 Smartphone, réseau faible, PC

**Smartphone**
- **Zoom à deux doigts interdit** (`user-scalable=no`) sur toutes les pages, alors que beaucoup de textes font 10 à 12 px et que des tableaux font 680 à 860 px de large.
- **Zones tactiles trop petites** pour des gants : la taille minimale conseillée est de 44 px.
  - croix de suppression : 12 à 18 px ;
  - boutons OK / NC / SO : 26 à 34 px ;
  - « effacer la signature » : 26 px.
- Contraste insuffisant au soleil sur les textes ambre.
- Champs numériques sans clavier chiffres (`inputmode`).

**Réseau faible**
- Les polices Google sont chargées avant d'afficher la page : **écran blanc** tant qu'elles n'arrivent pas.
- Chaque ouverture de fiche retélécharge tous les contacts et chantiers.
- Aucun délai maximum à l'envoi, aucune barre de progression, aucun message en cas d'échec de chargement.
- Ouvrir un chantier relit 8 dossiers Drive **et repartage chaque fichier** : plusieurs secondes d'attente.
- **Aucun mode hors-ligne** : pas de service worker.

**PC**
- La mise en page tient, mais **aucun bouton Imprimer**. Ctrl+P imprime le formulaire, pas la fiche, faute de style d'impression.

### 2.5 Poids

| Élément | Poids |
|---|---|
| Pages HTML | 33 à 96 Ko chacune (≈ 470 Ko au total), CSS et JS recopiés dans chaque page |
| Logo | 75 Ko, affiché sur 36 px de haut (pourrait faire < 10 Ko) |
| Polices Google | 2 familles, chargées à chaque page |
| PDF sans photo | quelques dizaines de Ko |
| PDF avec photos non compressées | **plus de 10 Mo** (relevé de stockage dans `_prive/`) |
| Envoi d'une note ou fabrication avec 5 photos | ≈ 1 à 1,7 Mo (déjà compressé) |
| Envoi d'une réception avec 5 photos | ≈ 20 à 33 Mo |
| Plans produits par les skills (carnet) | plusieurs Mo **par page** |

### 2.6 Ce qui existe déjà et recoupe tes demandes

| Ta demande | Ce qui existe | Verdict |
|---|---|---|
| Lot 7 — signaler une casse | `bordereau-materiaux.html` est un **reçu de remise en main propre** (« je soussigné… déclare avoir remis à… »), avec deux signatures. Pas de champ défaut, urgence ni fournisseur. Sa liste « Type » est celle des cylindres (copiée de l'orga). | **Ne convient pas.** Mais on réutilise sa base (photos, chantier, envoi). |
| Lot 4 — carnet de chantier | La tuile *Chantiers* de l'accueil lit déjà 8 sous-dossiers Drive par chantier (Accès, Plans, QT/Tableau, CCTP, Sécurité, Fiches, Note/Réunion, Quitus). La tuile *Planning* lit un dossier Drive. | **Ébauche à refondre** : pas de « dernière version », pas de droits, tout est partagé par lien, lent. |
| Lot 6 — délai en texte libre | Délai = date ou semaine, dans `fiche-fabrication.html`. | Petit ajout. |
| Lot 8 — note de réunion | Texte libre, photos annotables, destinataires. Pas de numérotation ni de reprise des points ouverts. Pas de colonne « actions / responsables » (conforme). | Base réutilisable. |
| Lot 9 — référentiel chantier | Onglet *Chantiers* : nom, référence, statut, conducteur. La FICHE INFO de ton skill contient bien plus (adresse, intervenants, lots, lien MEGA…). | **Deux sources possibles pour les mêmes infos** : à trancher. |
| Lot 9 — cotes → métré plinthes | Les cotes sont déjà enregistrées ligne par ligne dans l'onglet *Prise de Cote* (dont la hauteur de plinthe). L'en-tête de la colonne A est décalé (« REF » au-dessus du chantier). | Exploitable en lecture par le skill. |

### 2.7 Écart avec le skill `gestion-documentaire`

| | Skill gestion-documentaire (MEGA) | Appli aujourd'hui (Drive) |
|---|---|---|
| Arborescence | `00` à `08`, avec `05 - CHANTIER/…` (PRISE DE COTES, COMPTE RENDU, OPR - RESERVES - QUITUS, PHOTOS CHANTIER…), `07 - ATELIER` | 8 dossiers maison : Accès, Plans, QT/Tableau, CCTP, Sécurité, Fiches, Note/Réunion/Réunion, Quitus, plus Réceptions Support et Attestations créés à la volée |
| Nommage | `<INTITULÉ> <NOM COURT> <AAAA-MM-JJ>` ; nomenclature `NNN-LOT-NNN-INDICE-INTITULÉ` pour les documents émis (dossier 08) | `Quitus_<chantier>_<date>.pdf`, `Fab_…`, `Cotes_…` |
| Infos chantier | FICHE INFO (xlsx, à la racine du dossier MEGA) | onglet *Chantiers* du Sheet |
| Versions | une seule version active, les anciennes dans `0-OLD` / `INDICE PRECEDENTS` | aucune gestion |

**Adaptations probables du skill** (à confirmer en interview) :
- les documents produits par l'appli rejoignent les dossiers du skill, avec son nommage :
  - quitus et attestations → `05 - CHANTIER/OPR - RESERVES - QUITUS` ;
  - cotes → `PRISE DE COTES` ;
  - notes de réunion → `COMPTE RENDU` ;
  - fabrication → `07 - ATELIER` ;
  - photos → `PHOTOS CHANTIER` ;
- une nouvelle règle « **dépôt dans le carnet terrain** » : quel document, quelle version, quel nom, à quel moment ;
- une seule **source de vérité** pour l'identité du chantier (FICHE INFO ou onglet Chantiers), l'autre la lisant.

---

## 3. Premières réponses à tes questions

- **Le lot 2 (comptes) doit-il passer en premier ?**
  - **Non, pas tout à fait.** Je recommande un **lot 0 « sécurité urgente »**, très court, avant tout le reste : destinataires de mails fixés côté serveur, fin du partage public automatique, identifiants Drive retirés du dépôt. La faille du mail est ouverte **aujourd'hui**.
  - Ensuite le lot 1 (fondations : sans fichiers communs, chaque lot serait à refaire 10 fois), puis le lot 2.
  - Le carnet (lot 4) et les notes (lot 3) dépendent des deux.
- **Le lot 7 peut-il réutiliser une page existante ?** Pas `bordereau-materiaux` tel quel (c'est un reçu de remise). Il faut une petite fiche dédiée « Signaler », construite avec les briques communes du lot 1 : 30 secondes, 4 champs.
- **Quota de mails (lots 3, 7, 8)** : pour ne pas épuiser les 100 mails, je proposerai des **mails groupés** (un récapitulatif) plutôt qu'un mail par note ou par signalement, sauf urgence.

## 4. Plan par lots

*À rédiger après l'interview, puis à faire critiquer par un agent indépendant (méthode `boucle-controle`).*

## 5. Ce que Franck devra préparer avant le premier lot

*(Liste provisoire, complétée après l'interview.)*
- Vérifier que la copie de test « ChantierPro TEST » (Sheet + dossier Drive) est à jour, et y attacher une **copie** du script Apps Script pour les tests.
- Noter quel téléphone utilise chaque poseur (iPhone / Android) pour les tests hors-ligne.
- Garder sous la main l'accès à l'éditeur Apps Script et à GitHub (upload des fichiers).
