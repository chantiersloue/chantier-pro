# Lot 3 — Notes de chantier : plan

> Commande : `PLAN.md`, exigence 8 et « Lot 3 — Notes de chantier ». Consigne de Franck du 12/11/2026 : plan critiqué, puis construction sur la branche `lot-3` (qui part de `lot-7`), **testée contre le faux serveur seulement**. Ni copie TEST, ni production, ni `main`. Les essais réels et la livraison attendront que le lot 7 soit en production.
> Serveur **v8.0**, appli **8.0**.

## 1. Ce que le lot apporte

Un pense-bête partagé **par chantier** : il suit le chantier, pas la personne. Texte, photo, dictée, y compris sans réseau. **Aucun mail.**

| Qui | Peut |
|---|---|
| Toute personne qui a accès au chantier (poseur ou atelier dont la case est cochée, conducteurs, admin) | lire les notes, en écrire, cocher ou décocher « Fait » |
| L'auteur d'une note, les conducteurs, l'admin | modifier le texte, supprimer (mise à la corbeille) |
| Conducteurs, admin | voir la corbeille, restaurer, voir toutes les notes de tous les chantiers, exporter en PDF |

Tous ces droits sont **vérifiés par le serveur**, d'après le compte (jeton), jamais d'après ce que dit le téléphone.

## 2. Données (Sheet)

Trois onglets créés par `installerLot3Test` / `installerLot3Production` (moteur d'installation existant, relançable sans danger).

**Notes** — une ligne par note, écrite par l'appli seulement :

| Col. | Contenu |
|---|---|
| A | Numéro (celui donné par le téléphone ; sert à ne jamais écrire deux fois la même) |
| B | Chantier |
| C | Auteur (identifiant du compte, vérifié) |
| D | Auteur (nom affiché) |
| E | Créée le (heure du serveur) |
| F | Texte |
| G | Photos (identifiants des fichiers Drive, séparés par un espace ; jamais envoyés aux téléphones) |
| H | Fait : Oui / vide |
| I, J | Fait par, Fait le |
| K, L | Modifiée par, Modifiée le |
| M, N | Supprimée par, Supprimée le (ligne gardée : c'est la corbeille) |
| O | Version (1, 2, 3… : augmente à chaque modification du texte) |
| P | Remarque de l'appli (« modifiée en même temps par X ») |
| Q | Saisie le (date et heure du téléphone) |
| R | Dernier changement (heure du serveur : création, modification, fait, suppression, restauration) |

**Notes historique** — l'ancienne version à chaque modification : Numéro, Enregistrée le, Version remplacée, Ancien texte, Écrit par, Remplacé par, Motif (modification / modification en même temps / reçue après suppression).

**Notes vues** — pour le badge « nouveau » : Identifiant, Chantier, Vue le. Une ligne par personne et par chantier. Côté serveur, donc le badge suit la personne si elle change de téléphone.

Colonnes de texte en « texte brut » (comme *Signalements*), toute valeur passe par `cellule_` (formules neutralisées).

## 3. Photos

- 0 à 3 photos par note, compressées sur le téléphone (brique existante `commun/photos.js`), envoyées une par une avant la note (mécanisme existant : action `photo`, numéro unique).
- À la réception de la note, le serveur les range dans le dossier du chantier : **`05 - CHANTIER/PHOTOS CHANTIER/NOTES`** (nouvelle clé `notes-photos` dans les valeurs par défaut de `dossiers.json`). Elles redescendront donc dans MEGA (contrat 9b, règle 4).
- **Aucun lien public.** Une photo est rendue au téléphone par le serveur (action `notePhoto`), après contrôle du jeton et du droit de lire le chantier. La demande cite le numéro de la note et le rang de la photo, jamais un identifiant Drive.
- Sur le téléphone : la photo se charge **quand on touche « 📷 »** (pas de photos téléchargées d'office en 3G), puis reste gardée dans le téléphone (60 photos au plus, les plus anciennes sont retirées) pour être revue sans réseau.

| Option | Retenue ? | Raison |
|---|---|---|
| Photo rendue par Apps Script après contrôle | **oui** | accès réservé, rien de public ; même principe que le futur carnet (T14) |
| Lien Drive « toute personne ayant le lien » | non | public ; contraire au lot 0 |
| Photo en base64 dans la cellule du Sheet | non | limite de 50 000 caractères par cellule |

## 4. Écriture : tout passe par la file d'attente existante

La file d'attente du téléphone (`LOUE.mettreEnFile`) garde, renvoie et dédoublonne déjà les fiches. Les notes l'utilisent telle quelle, avec deux nouveaux types de fiche :

- **`note-chantier`** : une nouvelle note `{ chantier, texte, photos:[{photoRef}], date, heure }`.
- **`note-action`** : un geste sur une note `{ chantier, note, geste, texte?, base? }`, geste = `modifier` / `fait` / `defaire` / `supprimer` / `restaurer` ; `base` = la version que le téléphone avait sous les yeux.

| Option | Retenue ? | Raison |
|---|---|---|
| Réutiliser la file des fiches (numéro unique, renvoi automatique, « ⏳ ») | **oui** | déjà éprouvée (lots 1, 2, 7) ; une note écrite sans réseau part toute seule ; aucun nouveau mécanisme à maintenir |
| Une synchronisation propre aux notes (copie locale complète, fusion) | non | beaucoup de code fragile pour un pense-bête ; risque de régression sur la file |
| Gestes seulement avec du réseau | non | la commande demande le hors-ligne et la règle de conflit |

Conséquences assumées :
- chaque note et chaque geste laisse une ligne dans l'onglet *Envois* (c'est le registre anti-doublon). Volume attendu : quelques dizaines par jour, sans effet ;
- tant qu'une note n'est pas partie (« ⏳ en attente »), ses boutons sont inactifs : on ne modifie pas une note que le serveur ne connaît pas encore. Elle est déjà affichée dans la liste.

**Contrôle avant tout** (dans `recevoirFiche_`, avant de réserver le numéro, comme pour les signalements) :
- données invalides (texte vide sans photo, plus de 2 000 caractères, caractères de contrôle, geste inconnu, numéro mal formé…) → refus **définitif** (`DONNEES_INVALIDES`) ;
- pas de compte (jeton perdu pendant la transition) → `CONNEXION_REQUISE` : la note **attend dans le téléphone** que la personne se reconnecte ; elle n'est jamais enregistrée « sans auteur » ;
- pas le droit (chantier non coché, note d'un autre) → refus définitif avec un message clair ; la fiche reste visible dans le téléphone, marquée « à vérifier » (comportement existant) ;
- note inconnue du serveur → refus définitif (ne peut pas arriver depuis la page, voir ci-dessus).

**Traitement** (sous verrou, la ligne retrouvée par son numéro, jamais par sa position) :
- `note-chantier` : photos rangées dans Drive sous un nom fixe (`NOTE <numéro>-<rang>`) — un nouvel essai après une coupure ne les range pas deux fois —, puis la ligne, une seule fois ;
- `modifier` : l'ancien texte part dans *Notes historique*, la version augmente. **Si `base` n'est pas la version actuelle** (quelqu'un d'autre a modifié entre-temps) : la modification reçue l'emporte quand même (la dernière reçue par le serveur gagne, l'heure du serveur fait foi), l'ancienne version est gardée dans l'historique avec le motif « modification en même temps », et la note affiche « modifiée en même temps par X — voir l'historique » ;
- `modifier` reçu pour une note **supprimée** : le texte reçu est gardé dans l'historique (« reçue après suppression »), la note reste à la corbeille. Rien n'est perdu ;
- `fait` / `defaire` : qui et quand ; répété, il ne change rien ;
- `supprimer` / `restaurer` : qui et quand ; la ligne n'est jamais effacée.

## 5. Lecture

| Action | Qui | Rend |
|---|---|---|
| `notes` `{ chantier }` | accès au chantier | les notes non supprimées (200 plus récentes), avec pour chacune : `mien`, `peutModifier`, nombre de photos, `nouveau` ; la date de la visite précédente ; et **note cette visite** dans *Notes vues* |
| `notes` `{ chantier, corbeille:true }` | conducteurs, admin | les notes supprimées de ce chantier |
| `notes` `{ }` (sans chantier) | tout compte | les notes de **ses** chantiers visibles (300 plus récentes), chacune avec son chantier et `nouveau`. Ne marque rien comme vu |
| `notesNouvelles` | tout compte | pour chaque chantier visible : le nombre de notes nouvelles (pour les badges) |
| `noteHistorique` `{ note }` | accès au chantier de la note | les anciennes versions |
| `notePhoto` `{ note, rang }` | accès au chantier de la note | la photo (base64) |
| `notesPdf` `{ chantier }` | conducteurs, admin | fabrique le PDF et le range ; rend son nom |

- **« Nouveau »** : une note créée ou modifiée **par quelqu'un d'autre** après ma dernière visite de ce chantier. Première visite : tout ce que les autres ont écrit est nouveau.
- Même réponse pour « chantier inconnu » et « chantier interdit » : on n'apprend pas qu'un chantier existe.
- La dernière liste reçue est gardée dans le téléphone **par compte et par chantier**, effacée à la déconnexion, jamais affichée sans compte (même règle que les signalements).

## 6. Pages

**`notes.html?chantier=…`** (téléphone d'abord) :
- la liste, la plus récente en haut ; pastille « nouveau » ; note faite = barrée, « Fait par X le … » ; « modifiée le … par … » ; « modifiée en même temps par X » avec un bouton « Historique » ;
- les notes et gestes encore dans le téléphone sont affichés tout de suite, avec « ⏳ en attente d'envoi » ;
- **saisie rapide toujours visible en bas** : zone de texte (le micro du clavier fonctionne), bouton 📷 (0 à 3 photos), bouton 🎤 de dictée **seulement si le téléphone le permet**, gros bouton « Ajouter » ;
- brouillon automatique de la saisie en cours (brique `commun/brouillon.js`, clé par chantier) : une note commencée n'est pas perdue si l'appli se ferme ;
- par note : grosse case « Fait » ; « Modifier » et « Supprimer » (avec confirmation) si on en a le droit ;
- conducteurs : « Corbeille » (liste, bouton « Restaurer ») et « Exporter en PDF » ;
- tout texte venu du serveur est posé par `textContent`, jamais comme du code (T17).

**`notes.html` sans chantier** — vue « Tous chantiers » (pensée pour le PC, utilisable au téléphone) : filtres chantier, auteur, « nouveau », « non fait », et une recherche dans le texte ; un clic sur une note ouvre son chantier.

**Accueil** : tuile « Notes » dans chaque chantier, tuile « Notes (tous chantiers) » à l'accueil pour les comptes ; badge du nombre de nouvelles notes (demandé une fois à l'ouverture, en tâche de fond : l'accueil ne l'attend pas).

**Dictée** : le micro du clavier marche partout et sans rien installer : c'est la voie principale. Le bouton 🎤 utilise la reconnaissance vocale du navigateur quand elle existe (Chrome sur Android ; partielle sur iPhone) ; sinon il n'est pas affiché. Gratuit, mais **il lui faut du réseau** : la page le dit.

## 7. Export PDF

- Modèle `modeles/notes-chantier.js` (une seule source, exécutée sur le serveur ; règles T5 : tableaux et styles en ligne).
- Contenu : chantier, date, puis les notes non supprimées, de la plus ancienne à la plus récente : date, auteur, texte, « fait par / le », « modifiée par / le », et les photos (24 au plus dans le PDF ; au-delà, « n photos non reprises : voir le dossier PHOTOS CHANTIER/NOTES »).
- Rangé dans **`05 - CHANTIER/COMPTE RENDU`** (clé `notes-chantier`, intitulé `NOTES DE CHANTIER`) : il redescend dans MEGA.
- Sur PC, la page s'imprime aussi directement (feuille de style d'impression), sans passer par le serveur.

## 8. Fichiers touchés

| Fichier | Changement |
|---|---|
| `apps-script/Notes.gs` (nouveau) | onglets, contrôle, traitement, lectures, photo, PDF, installation |
| `apps-script/Api.gs` | 2 types de fiche, contrôle avant réservation, 5 actions ; le compte complet passe dans le contexte du traitement |
| `apps-script/Dossiers.gs`, `Config.gs` | clés `notes-photos`, `notes-chantier` ; `v8.0` |
| `modeles/notes-chantier.js` (nouveau), `outils/construire.js` | modèle du PDF ; `Notes.gs` dans l'ordre d'assemblage |
| `notes.html` (nouveau) | la page |
| `commun/api.js` | lectures des notes, liste gardée par compte, photos gardées |
| `index.html`, `sw.js`, `commun/config.js` | tuiles et badges ; page gardée hors réseau ; `8.0` |
| `apps-script-test/OutilsTest.gs` | geste `installerLot3` (pour les essais réels, plus tard) |
| `tests/lot3-notes.test.js`, `tests/lot3-page.test.js` (nouveaux), `tests/faux-serveur.js` | tests serveur ; tests dans un vrai Chrome à 375 px |
| `docs/lot3-procedure.md`, `docs/guide-utilisateur.md`, `docs/structure-sheet.md`, `CHANGELOG.md`, `PLAN.md`, `DECISIONS.md` | documents |

Rien n'est retiré. Les fiches existantes et les signalements ne changent pas de comportement.

## 9. Risques et parades

| Risque | Parade |
|---|---|
| Note perdue (réseau, appli fermée) | file d'attente existante + brouillon de la saisie ; numéro unique : un renvoi n'écrit jamais deux fois |
| Deux personnes modifient la même note sans réseau | règle « la dernière reçue gagne », ancienne version dans l'historique, mention visible (§4) |
| Texte hostile affiché chez les autres | `textContent` partout ; test avec du HTML dans une note |
| Un poseur lit les notes d'un chantier qui n'est pas le sien | droit vérifié par le serveur à chaque lecture, photo et geste ; tests par rôle |
| Franck trie ou filtre l'onglet | lignes retrouvées par numéro |
| Photos lourdes en 3G | chargées seulement à la demande, gardées ensuite |
| Quota Apps Script | une lecture = une exécution courte ; aucun mail ; PDF limité à 24 photos |
| Ancien déploiement encore en service | il répond « action inconnue » ou « type inconnu » : la page dit « le serveur n'est pas encore à jour », la note reste dans le téléphone |
| Stockage Drive | photos compressées (≈ 0,3 Mo) ; comptées dans l'estimation du lot 5 |

## 10. Tests prévus (faux serveur seulement)

- **Serveur** (`tests/lot3-notes.test.js`) : création, renvoi sans doublon, droits par rôle (poseur affecté / non affecté / atelier / conducteur / admin / sans compte), modification par l'auteur, par un conducteur, refus pour un autre poseur, conflit de version, modification après suppression, fait / défaire, corbeille et restauration, « nouveau » et *Notes vues*, photos (rangement unique, lecture réservée), historique, PDF, données invalides, formules neutralisées, installation relançable.
- **Page** (`tests/lot3-page.test.js`, vrai Chrome, 375 px) : note écrite hors réseau puis partie au retour, « ⏳ », brouillon restauré, « Fait », modification, suppression et restauration par le conducteur, un second poseur ne voit rien du premier sur le même téléphone, texte hostile affiché comme du texte, pas de défilement horizontal, vue « Tous chantiers » et ses filtres, badge de l'accueil.
- Toutes les séries existantes repassent (aucune régression).
- **Pas testé dans ce lot** (dit clairement à Franck) : le vrai serveur TEST, un vrai téléphone, la dictée par le bouton 🎤 (un navigateur de test n'a pas de micro), le vrai convertisseur PDF de Google.

## 11. Ce que Franck aura à faire (plus tard, après la production du lot 7)

Un envoi clasp `--avec-porte`, ses essais sur téléphone (procédure `docs/lot3-procedure.md`), un envoi `--sans-porte`, puis la production (`installerLot3Production`, nouveau déploiement, lien pré-rempli). Rien avant.

---

## 12. Ce que la critique du plan a fait changer (12/11/2026) — ce chapitre l'emporte sur ce qui précède

Un agent indépendant a relu ce plan contre le code réel, avant toute construction. Trois points bloquants et treize importants ; tous sont intégrés ci-dessous.

**Bloquants**
1. **Message d'envoi.** Telle quelle, chaque note aurait affiché « ⚠ enregistrée, mais aucun mail n'est parti » pendant 10 secondes. Le serveur répond « Note enregistrée » pour les notes, et `commun/ui.js` affiche un message court sans alerte.
2. **Refus et alertes.** Tous les refus (données, droits, note inconnue) sont faits **avant** de réserver le numéro, sous le code que le téléphone tient pour définitif. Un « serveur occupé » pendant l'écriture d'une note n'envoie **pas** le mail d'alerte « fiche non traitée » à Franck (une seule alerte part par jour : une note en panne aurait masqué une vraie fiche perdue) : le téléphone réessaie, c'est tout.
3. **Ordre des gestes.** La file d'attente peut envoyer deux gestes sur la même note dans le désordre (le premier reporté d'une minute, le second parti tout de suite). Le téléphone n'envoie donc **jamais** un geste tant qu'un geste plus ancien sur la même note attend encore. Sans effet sur les fiches.

**Importants**
- **Brouillon de la saisie rapide** : pas la brique générale (elle capture tous les champs de la page et rejouerait des gestes), mais une sauvegarde **silencieuse** du texte et des photos en cours, par compte et par chantier, restaurée sans question. `commun/brouillon.js` n'est pas touché.
- **Chantier** : il doit exister dans l'onglet *Chantiers* (sinon refus), et la note enregistre le nom exact du Sheet. Un chantier « Terminé » garde ses notes lisibles par qui y a accès. **Chantier renommé dans le Sheet** : ses notes restent sous l'ancien nom ; il faut le remplacer aussi dans la colonne B de l'onglet *Notes* (écrit dans `docs/structure-sheet.md`).
- **Compte désactivé** : ses notes en attente ne sont pas acceptées (contrairement aux fiches) ; elles restent dans son téléphone.
- **Téléphone partagé** : une note rangée par X ne part **jamais** sous le nom de Y qui se connecte ensuite ; elle attend que X se reconnecte. Sur la page, les « ⏳ » d'une autre personne ne sont pas affichés.
- **Sans compte** : refusé avant l'onglet *Sans compte* (pas de lignes parasites).
- **Stockage dans le téléphone** : une base **séparée** (`loue_notes_…`) pour les listes gardées, les photos vues et la saisie en cours. La base des fiches et des brouillons n'est pas modifiée (un retour arrière des pages ne peut pas la casser). Tout y est rangé par compte et effacé à la déconnexion.
- **« Nouveau »** : la visite n'est plus notée à la lecture mais par une petite action à part (`notesVues`), envoyée **après l'affichage**, avec l'heure du serveur de la liste affichée. Un rafraîchissement n'efface plus les pastilles avant qu'on les ait vues.
- **Texte brut** : chaque nouvelle ligne est mise en « texte brut » au moment où elle est écrite (au-delà de 1 000 lignes, le format posé à l'installation ne suffit plus : « 12/11 » serait devenu une date).
- **Note supprimée** : son historique et ses photos ne sont plus lisibles que par les conducteurs.
- **Vue « Tous chantiers »** : réservée aux conducteurs et à l'admin (comme la commande) ; filtres et recherche appliqués **par le serveur**, avant le plafond de 300.
- **Renvoi après une réponse perdue** : le serveur regarde d'abord si la note est déjà enregistrée, avant de recontrôler les droits (sinon une case décochée entre-temps aurait fait dire « refusée » pour une note bien arrivée).
- **Nettoyage du texte par la page** : 2 000 caractères au plus, tabulations et caractères invisibles remplacés par une espace, retours à la ligne gardés.

**Mineurs**
- PDF : **12 photos** au plus (les premières, dans l'ordre des notes), délai d'attente de 2 minutes ; photo d'une note : délai de 90 secondes.
- Bouton 🎤 : seulement sur Chrome pour Android (sur iPhone il existe mais ne marche pas dans l'appli installée).
- Pas de feuille de style d'impression : le PDF suffit.
- **Ancien déploiement encore en service** : il répond « type inconnu », que le téléphone tient pour définitif. La note reste dans le téléphone, marquée « à vérifier », et **ne repart pas toute seule** : il faudra toucher « Réessayer ». C'est pourquoi le lot 3 a sa propre adresse de serveur, mise dans les pages en même temps qu'elles.
- Si le téléphone refuse de garder la note (navigation privée, mémoire pleine) : envoi direct, page ouverte, comme pour les fiches.
- **Rôle Atelier** : il lit et écrit les notes des chantiers cochés pour lui (la commande ne parlait que des poseurs et des conducteurs) : noté dans `DECISIONS.md`.
- **Pas testé dans ce lot**, en plus du §10 : la barre de saisie avec le clavier d'un vrai iPhone.
- Tests ajoutés : deux gestes en file sur la même note, compte désactivé, poseur « tous les chantiers », chantier inexistant, téléphone partagé, réseau lent.

## 13. Ce que la relecture du code a fait changer (13/11/2026)

Un agent indépendant a relu le code construit, et rejoué ses propres scénarios dans un vrai Chrome. Aucun point bloquant ; cinq importants, tous corrigés :

- **Texte en cours de modification** : il était remis à l'ancien texte dès que la liste se rafraîchissait (un « Fait » confirmé sur une autre note, une photo qui arrive). La liste n'est plus redessinée pendant une modification.
- **Téléphone partagé** : le geste resté en attente d'un autre compte bloquait sans fin mes gestes sur la même note. L'ordre des gestes est maintenant tenu par personne.
- **Mention de conflit** : une seconde modification du même téléphone la faisait disparaître ; elle ne s'efface plus que par une modification faite en ayant vu la version actuelle.
- **Réseau faible** : à l'ouverture, la liste gardée dans le téléphone et les notes en attente s'affichent tout de suite, sans attendre la réponse du serveur (jusqu'à 20 secondes avec une barre de réseau).
- **Conducteurs** : bouton « Tout marquer comme lu » dans la vue « Tous chantiers » (sinon le chiffre rouge de l'accueil ne redescendait qu'en ouvrant chaque chantier).

Et aussi : la liste et le PDF suivent la date des notes, pas l'ordre des lignes (Franck peut trier l'onglet) ; bouton « Galerie » pour les photos ; la saisie en cours survit à une déconnexion ; une note déjà arrivée quitte la file même si une autre personne s'est connectée entre-temps ; un double appui ne fait pas deux gestes ; messages propres aux notes ; un test prouve maintenant que deux gestes ne partent jamais dans le désordre (il échoue si on retire la protection).

**Laissé tel quel, assumé** : un « Fait » peut encore être coché sur une note qui vient d'être supprimée (sans effet visible) ; la corbeille se consulte chantier par chantier ; pas de lien vers le PDF depuis l'appli (il est dans le dossier du chantier) ; chaque geste coûte deux à trois appels au serveur.

**À vérifier à l'essai réel** (le faux serveur ne le montre pas) : une note qui commence par « + », « = », « - » ou « @ » (l'apostrophe de protection ne doit pas s'afficher dans l'appli) ; le PDF avec 12 photos ; la barre de saisie avec le clavier ouvert.

**Second tour de relecture (13/11/2026)** : aucun bloquant. Corrigé : une note ou un « Fait » ajouté pendant que la liste arrivait pouvait disparaître de l'écran quelques instants (rien n'était perdu, mais on pouvait croire le contraire) ; pendant une modification, la page dit maintenant pourquoi le reste attend et les autres boutons sont inactifs ; une note renvoyée « sans rien changer » en envoi direct garde son heure, donc son numéro (jamais deux fois la même) ; « Tout marquer comme lu » écrit ses lignes en une fois. Verdict du relecteur : prêt pour les essais réels sur la copie TEST. **Laissé tel quel** : l'indicateur d'envoi du haut de l'écran parle de « fiche(s) » aussi pour les notes.
