# Lot 7 — Signalement casse / manquant / à recommander : plan détaillé

> Plan général validé par Franck : `PLAN.md`, section « Lot 7 ». Ce document le précise pour la construction.
> Réponses de Franck du 12/11/2026 (D7-1) : photo jamais obligatoire ; « Bloquant » sans effet supplémentaire ; copie atelier au chef d'atelier du Sheet ; toujours un chantier.
> Branche de travail : `lot-7` (elle part de `outillage`, qui entre donc en production avec ce lot).
> **Corrigé après la critique d'un agent indépendant** (12/11/2026) : voir la section « Ce que la critique a fait changer », à la fin. En cas de contradiction, c'est elle qui fait foi.

## Objectif

En 30 secondes, depuis un chantier, un poseur signale une casse, un manquant ou une chose à recommander. Le conducteur du chantier reçoit un mail à chaque fois. Rien n'est oublié : chaque signalement a un statut, visible dans l'appli.

## Ce que voit l'utilisateur

### Page `signaler.html` (nouvelle)
Ouverte par la tuile **« Signaler »** d'un chantier, chantier déjà rempli. De haut en bas, tout au pouce :

1. **Chantier** (pré-rempli, modifiable, liste de suggestions comme les autres fiches) — obligatoire.
2. **Type** — 3 gros boutons : Casse / Manquant / À recommander — obligatoire.
3. **Urgence** — 3 gros boutons : Bloquant / Cette semaine / Pas urgent — obligatoire.
4. **Repère** — une ligne de texte (« Porte P12, 2e étage »).
5. **Commentaire** — texte libre, le micro du clavier sert à dicter.
6. **Photos** — 0 à 3 (appareil photo ou galerie).
7. **☐ Prévenir l'atelier**.
8. **Envoyer le signalement**.

Règle de bon sens : il faut au moins un repère, un commentaire ou une photo (sinon le signalement ne dit rien).
Comme les autres fiches : brouillon automatique avec bandeau de restauration, rangement dans le téléphone, envoi au retour du réseau, envoi direct en secours.

### Page `signalements.html` (nouvelle) : le suivi
Ouverte par une tuile **« Signalements »** (dans un chantier : ceux du chantier ; depuis l'accueil : tous ceux que je peux voir).

- Une carte par signalement : type, urgence, chantier, repère, commentaire, auteur, date, **statut**, et « mail reporté » si le mail n'a pas pu partir tout de suite.
- **Conducteurs et Admin** : tous les signalements ; ils changent le statut par 4 gros boutons (À traiter / Commandé / Livré / Clos).
- **Atelier** : tous les signalements, comme les conducteurs (c'est ce que dit `PLAN.md`) ; une pastille « atelier prévenu » montre ceux qui lui ont été adressés.
- **Poseur** : les siens, en lecture seule (il voit où en est sa demande).
- Filtre simple : « En cours » (par défaut : tout sauf Clos) / « Tout ».
- Hors réseau : la dernière liste reçue est affichée avec sa date ; le changement de statut demande du réseau (message clair).

### Accueil
- Dans un chantier : tuile « Signaler » (grille des fiches) et tuile « Signalements ».
- Hors chantier : tuile « Signalements » (suivi de tous les chantiers visibles).

## Données : onglet *Signalements*

| Col. | Contenu |
|---|---|
| A | Numéro (celui de la fiche, sert d'anti-doublon) |
| B | Reçu le |
| C | Chantier |
| D | Auteur : identifiant **vérifié par le serveur** (vide si sans compte) — sert au filtre « les miens » |
| D bis | Auteur affiché : le nom de la personne, ou « sans compte » |
| E | Type : Casse / Manquant / À recommander |
| F | Urgence : Bloquant / Cette semaine / Pas urgent |
| G | Repère |
| H | Commentaire |
| I | Photos (nombre) |
| J | Atelier prévenu : Oui / Non |
| J bis | Remarque (par exemple « aucun chef d'atelier dans Contacts ») |
| K | **Statut** : À traiter / Commandé / Livré / Clos (liste déroulante : Franck peut aussi le changer dans le Sheet) |
| L | Statut modifié par l'appli le |
| M | Statut modifié par l'appli par |
| N | Mail à la réception : en cours / envoyé / reporté / envoyé et reporté / aucun |
| O | Saisi le (date et heure du téléphone : un signalement hors réseau arrive parfois des heures après) |

Créé par la fonction d'installation du lot (pas à la main).

## Serveur

| Élément | Détail |
|---|---|
| Type de fiche `signalement` | Ajouté aux 4 listes (traitements, libellés, dossier de rangement, intitulé). Reçu par le chemin existant `photo` puis `fiche` : anti-doublon, photos, onglet *Envois*, tout est déjà là |
| `traiterSignalement` | 1. cherche le numéro dans *Signalements* ; s'il n'y est pas, écrit la ligne (mail « en cours ») ; 2. fabrique **un PDF de 1 à 3 pages** (les informations + les photos, avec la mise en page commune des photos) par un nouveau modèle `modeles/signalement.js` ; 3. le range dans le dossier du chantier (`05 - CHANTIER/SIGNALEMENTS`) ; 4. envoie le mail ; 5. met à jour la colonne « Mail ». Si une panne coupe le traitement, le nouvel essai retrouve la ligne et ne la réécrit pas |
| Destinataires | Le conducteur du chantier (colonne D de *Chantiers*), sinon Franck. Si « Prévenir l'atelier » est coché : en plus **tous** les contacts dont *ChefAtelier* = O. Résolus côté serveur : la page n'envoie aucune adresse |
| Mail | Sujet : `[Loué App] Signalement — <type> — <chantier>`. Le texte du mail contient tout (type, urgence, repère, commentaire, auteur) pour être lu sur un téléphone sans ouvrir la pièce jointe. « Bloquant » y figure comme les autres urgences (D7-1) |
| Quota | Rien de nouveau : `distribuer_` reporte déjà le mail si le quota est presque atteint ; la colonne N et la réponse à la page le disent |
| Auteur | `recevoirFiche_` connaît le compte ; il le passe au traitement (aujourd'hui le traitement ne sait pas qui envoie) |
| Action `signalements` (lecture) | Rend au plus 100 signalements, les plus récents d'abord, selon le rôle (voir « Droits »). Paramètres : `chantier` (facultatif), `tout` (inclure les Clos) |
| Action `signalementStatut` (écriture) | `{ id, statut }` : vérifie le droit, la liste fermée des statuts, écrit K, L, M sous verrou |
| Fonction `chefsAtelier_()` | Nouvelle, commune : toutes les lignes *ChefAtelier* = O, adresses découpées. (La fiche de fabrication garde son code : on n'y touche pas dans ce lot) |
| Installation | `installerLot7Test` / `installerLot7Production` : une étape, l'onglet *Signalements* avec ses titres et sa liste de statuts. Pas de nouveau déclencheur, pas de nouvelle autorisation Google |
| `verifierConfig` | Une ligne : onglet *Signalements* présent |
| Versions | Serveur **v7.0**, appli **7.0** |

### Droits (vérifiés côté serveur)

| Rôle | Voit | Change le statut |
|---|---|---|
| Admin, Conducteur | Tous les signalements | Oui |
| Atelier | Tous les signalements | Oui |
| Poseur | Les siens (auteur = son identifiant) | Non |
| Sans compte | Rien (connexion demandée) | Non |

Envoyer un signalement suit la règle des fiches (D2-9) : accepté pour n'importe quel chantier existant, auteur noté ; pendant la transition, accepté sans compte (auteur « sans compte »).

## Choix techniques comparés

| Choix | Retenu | Écarté | Pourquoi |
|---|---|---|---|
| Pièce jointe du mail | **Un PDF de 1 à 3 pages** (informations + photos), fabriqué par le modèle commun | Les photos brutes en pièces jointes (ce que dit `PLAN.md`) | Le PDF passe par tout l'existant sans rien modifier : plafond de quota, mail reporté puis renvoyé avec sa pièce jointe, rangement dans le dossier du chantier (donc dans MEGA). Des photos brutes demanderaient un second chemin de mail, de report et de renvoi. **Écart avec `PLAN.md`, noté dans `DECISIONS.md`** |
| Où garder les photos | Dans le PDF rangé dans le chantier | Un dossier de photos à part dans Drive | Un seul fichier par signalement dans Drive. À savoir : chaque mail envoyé garde aussi une copie du PDF dans « Messages envoyés » (1 à 3 Mo par signalement avec atelier), qui compte dans les 15 Go |
| Suivi | Une page `signalements.html` | Dans `signaler.html`, sous le formulaire | Deux écrans simples valent mieux qu'un écran chargé ; le conducteur n'a pas besoin du formulaire |
| Changement de statut hors réseau | Non (réseau demandé) | Mise en file comme une fiche | Deux personnes peuvent changer le même statut : hors-ligne, le dernier arrivé écraserait l'autre sans le savoir. Le poseur, lui, n'en a pas besoin |
| Aperçu avant envoi | Non | Bouton « Aperçu » comme le quitus | 30 secondes pour signaler : la page est courte, tout est sous les yeux |
| Mail au changement de statut | Non | Prévenir le poseur par mail | Le quota (100 destinataires par jour) ; le poseur voit le statut dans l'appli |
| Atelier : ce qu'il voit | Tous les signalements (comme `PLAN.md`) | Seulement ceux où il a été prévenu | Sinon un signalement non coché par le poseur ne pourrait jamais être repris par l'atelier |

## Fichiers touchés

| Fichier | Changement |
|---|---|
| `signaler.html`, `signalements.html` | Nouveaux |
| `modeles/signalement.js` | Nouveau modèle de PDF |
| `commun/fiche.css` | Classe commune pour 3 ou 4 gros boutons à choix unique |
| `commun/api.js` | `LOUE.lireSignalements()`, `LOUE.changerStatutSignalement()` |
| `commun/config.js` | Version 7.0 |
| `index.html` | Tuiles « Signaler » et « Signalements » |
| `sw.js` | Les deux pages gardées hors réseau ; le commentaire sur `essai/` corrigé |
| `apps-script/Signalements.gs` | Nouveau : traitement, lecture, statut, installation |
| `apps-script/Api.gs` | Type `signalement`, actions `signalements` et `signalementStatut`, auteur passé au traitement |
| `apps-script/Securite.gs`, `Dossiers.gs`, `Config.gs`, `Admin.gs` | Libellé, dossier de rangement, version, contrôle |
| `apps-script-test/OutilsTest.gs` | Gestes d'essai : `installerLot7`, `lireSignalements` |
| `outils/construire.js` | `Signalements.gs` dans la liste |
| `tests/lot7-signalement.test.js`, `tests/lot7-page.test.js`, `tests/reel-lot7.js`, `tests/faux-serveur.js` | Tests |
| `docs/lot7-procedure.md`, `docs/guide-utilisateur.md`, `docs/structure-sheet.md`, `CHANGELOG.md`, `DECISIONS.md`, `PLAN.md`, `CLAUDE.md` (liste des pages) | Documents |

Aucune page existante n'est modifiée, sauf l'accueil (deux tuiles). Le brouillon automatique des autres fiches n'est pas touché.

## Risques et parades

| Risque | Parade |
|---|---|
| Un signalement envoyé deux fois (réseau coupé pendant la réponse) | Anti-doublon existant par numéro de fiche ; la ligne de *Signalements* porte le même numéro, écrite une seule fois |
| Mails en trop sur le quota | 1 mail par destinataire, 1 à 3 destinataires ; plafond et report déjà en place |
| Aucun chef d'atelier dans *Contacts* alors que la case est cochée | Le mail part quand même au conducteur ; noté dans le journal et dans la colonne J (« Oui — aucun chef d'atelier trouvé ») |
| Un poseur lit les signalements des autres | Filtre côté serveur, testé |
| Chantier inconnu | Comme les autres fiches : PDF dans `_À CLASSER`, alerte à Franck ; la page demande confirmation si le chantier n'est pas dans la liste |
| Texte hostile dans le repère ou le commentaire | Échappement existant (`preparerDonnees_`, `cellule_`), testé |
| La liste grossit | Lecture bornée à 100 lignes, Clos masqués par défaut |
| Téléphone : gros boutons illisibles ou trop petits | 56 px de haut au moins, contraste fort, essai à 375 px puis sur ton téléphone |

## Tests

**Par moi, sans toi**
- Serveur (faux Apps Script) : ligne écrite, PDF, destinataires selon la case atelier (zéro, un, deux chefs), quota (mail reporté), doublon, droits de lecture et de statut pour chaque rôle, valeurs hors liste, texte hostile, sans photo, 3 photos, chantier inconnu, installation rejouable.
- Pages (Chrome piloté, faux serveur) : 375 px et PC ; brouillon restauré avec les gros boutons ; mode avion puis retour du réseau ; mémoire du téléphone bloquée ; suivi selon le rôle ; changement de statut ; hors réseau.
- **Contre le vrai serveur TEST, par la porte de service** : installation du lot, un signalement envoyé avec une session d'essai (avec et sans atelier), ligne lue dans *Signalements* et *Envois*, changement de statut, droits ; nombre de mails partis contrôlé par le compteur de quota. Environ 4 mails de TEST par série.

**Par toi, sur téléphone (15 min)**
1. Un signalement avec une photo de l'appareil, en **mode avion**, qui part au retour du réseau.
2. Les gros boutons : lisibles dehors, utilisables d'une main.
3. Le mail reçu par le conducteur ; par l'atelier seulement si la case est cochée.
4. Le commentaire dicté au micro du clavier.
5. Le suivi : ton signalement apparaît, tu changes son statut (compte Admin).

## Ce que tu auras à faire

1. Réactiver « API Google Apps Script », puis lancer l'envoi clasp sur TEST quand je te le demande (1 à 3 fois).
2. Les 5 essais sur téléphone.
3. Ton feu vert.
4. En production (au copier-coller pour ce lot, décision n° 3) : coller le serveur, nouveau déploiement, m'envoyer l'adresse, ▶ `installerLot7Production`, puis 3 clics sur mon lien.
5. Dans le vrai Sheet : vérifier que chaque chantier en cours a son conducteur (colonne D) et qu'un contact a *ChefAtelier* = O.

## Ce que la critique a fait changer

**Trois points bloquants, corrigés dans la conception**

1. **Aucun mail d'essai à une vraie personne.** Sur la copie TEST, la case « Prévenir l'atelier » enverrait un mail au chef d'atelier de l'onglet *Contacts* de TEST, qui est peut-être le vrai. La porte de service reçoit un geste qui dit, sans donner d'adresse, combien il y a de chefs d'atelier et si leur adresse est celle de Franck. Mon essai réel « avec atelier » ne se joue que dans ce cas ; sinon il reste sur le faux serveur. Les mails sont comptés par la réponse du serveur, pas par le quota (que la production fait aussi bouger). Avant son essai sur téléphone, Franck vérifie que le chef d'atelier de la copie TEST porte bien sa propre adresse.
2. **Une ligne par signalement, même après une panne.** Le serveur rappelle le traitement d'une fiche restée « en cours » ou « en erreur ». La ligne de *Signalements* est donc cherchée par son numéro avant d'être écrite, et elle est écrite en premier : un PDF qui échoue ne fait jamais perdre le signalement.
3. **L'auteur est l'identifiant vérifié par le serveur.** Le traitement reçoit un « contexte » (numéro de fiche, identifiant du compte tiré du jeton, nom affiché) en plus des données. Il n'est jamais lu dans ce qu'envoie le téléphone. Sans numéro de fiche (ancien format des pages d'avant le lot 1), le signalement est refusé. Conséquences assumées : un signalement envoyé « sans compte » pendant la transition n'apparaît dans la liste d'aucun poseur (les conducteurs le voient) ; une fiche saisie par X mais envoyée depuis le téléphone de Y appartient à Y.

**Autres corrections**

- **Refus définitifs.** Type, urgence, chantier vide, « ni repère ni commentaire ni photo », textes trop longs (repère 120 caractères, commentaire 2 000), plus de 3 photos : le serveur répond « données invalides » avant tout traitement, sans 12 nouveaux essais ni alerte.
- **Texte d'un autre affiché chez moi.** La page de suivi n'écrit jamais du texte reçu comme du code de page (tout passe par un affichage en texte brut), statut et type compris. Test avec un texte hostile.
- **Suivi hors réseau.** La dernière liste est gardée par compte, effacée à la déconnexion, jamais affichée sans compte connecté : le poseur suivant sur le même téléphone ne voit pas la liste du précédent.
- **Réponses qui ne renseignent pas.** Le filtre par rôle passe avant tout autre ; aucun total n'est rendu ; changer le statut d'un signalement inconnu ou interdit donne la même réponse.
- **« Mail reporté ».** La colonne dit ce qui s'est passé **à la réception** ; le suivi affiche « mail parti en retard » sans prétendre savoir s'il est arrivé depuis.
- **Statut changé dans le Sheet.** Possible ; les colonnes L et M ne parlent alors que du dernier changement fait par l'appli. Une valeur hors liste est lue « À traiter ». L'appli retrouve la ligne par son numéro, sous verrou, jamais par sa position.
- **Rangement.** Dossier `05 - CHANTIER/SIGNALEMENTS` (pas avec les réserves ni les quitus). Le fichier `dossiers.json` déjà présent dans Drive n'est pas modifié : le serveur complète toujours ce qu'il y lit (ou ce qui est en cache) par ses valeurs par défaut, y compris quand un ancien déploiement encore en service a rempli le cache. Le nom du PDF porte le type et l'heure.
- **Comptes d'essai.** Un quatrième compte `auto-atelier` pour essayer les droits de l'atelier.
- **Gros boutons.** De vrais boutons radio habillés en gros boutons : le brouillon les reprend sans code particulier.
- **Tuiles.** « Signaler » est aussi dans la grille ouverte sans chantier (le chantier se choisit alors dans la page). « Signalements » est masquée sans compte.
- **« Repère du carnet »** de `PLAN.md` : sans objet tant que le carnet (lot 4) n'existe pas ; le repère est un texte libre.
- **Hors périmètre.** Le suivi « Commandé / Livré » reste un simple statut : ni date de livraison, ni signature, ni bon.

**Production : ce que ce lot emporte en plus**

Le serveur de ce lot contient aussi l'outillage, jamais passé en production : le moteur d'installation, l'empreinte renvoyée par le serveur, la ligne d'accroche des outils d'essai (sans effet en production) et un `verifierConfig` plus bavard. La copie TEST l'exécute déjà depuis le 12/11/2026. Avant le feu vert : dernier envoi `--sans-porte` sur TEST (c'est sur ce serveur exact que Franck fait ses essais), tests des lots 0 à 2 rejoués. En production : `verifierConfig`, et l'empreinte lue en ligne doit être celle de la demande de fusion.

`installerLot7Production` affiche aussi, pour information, les chantiers « En cours » sans conducteur et le nombre de chefs d'atelier : Franck n'a pas à le contrôler à la main.

**Retour arrière**

| Problème | Que faire |
|---|---|
| Les gars ne peuvent plus travailler après la fusion | Je prépare une demande de fusion qui remet les pages 6.0.1 et l'adresse du serveur du lot 2 (l'ancien déploiement tourne encore). Rien à faire dans Apps Script |
| Un signalement resté dans un téléphone après ce retour | Le serveur 6.0.1 répond « type inconnu » : la fiche reste dans le téléphone, marquée « à vérifier », rien n'est perdu |
| L'onglet *Signalements* | Il reste dans le Sheet, sans gêner l'ancien serveur |

**Construction en deux temps**, chacun testé avant le suivant : 7a, signaler (page, mail, onglet) ; 7b, suivi et statut. Une seule livraison.

**Ce que Franck fait, regroupé** : la réactivation de « API Google Apps Script » se fait au moment du premier envoi clasp ; la vérification des conducteurs et du chef d'atelier est faite par la fonction d'installation.

## Ce que la relecture du code a fait changer (12/11/2026)

- **Procédure** : tous les essais de Franck se font sur « CHANTIER TEST AUTO » (sans conducteur, donc mails à Franck). La première version aurait envoyé ses essais au vrai conducteur du chantier choisi.
- **Rangement** : le cache des noms de dossiers, commun à tous les déploiements, pouvait être rempli par l'ancien serveur encore en service ; les PDF seraient alors partis dans « Divers ». Le serveur complète maintenant toujours ce cache par ses valeurs par défaut.
- **Contrôle des données** : date et heure au format attendu, photos acceptées seulement comme références à des photos déposées, légendes bornées à 80 caractères, pas de retour à la ligne dans le chantier ni le repère (un sujet de mail ne peut plus être détourné).
- **Après une coupure** : si le mail d'un signalement est déjà parti, le nouvel essai ne refait ni PDF ni mail.
- **Onglet** : colonnes de texte en « texte brut » ; créé sous verrou.
- **Porte de service** : plus aucun nom de chantier ni identifiant d'un vrai compte dans ses réponses.
- **Page de suivi** : 8 tests automatiques dans un vrai Chrome (elle n'en avait aucun).
- **Formules** : un texte du genre « -1+IMPORTDATA(…) » est maintenant neutralisé dans le Sheet (défaut antérieur au lot).
- **Non corrigé, assumé** : après une panne survenue entre le rangement du PDF et l'envoi du mail, le nouvel essai range un second PDF (« _V2 ») ; si Google coupe l'exécution juste après le mail et avant que la ligne ne le note (une fraction de seconde), le nouvel essai renvoie le mail une seconde fois ; au-delà de 1 000 lignes, les nouvelles lignes de l'onglet peuvent perdre la liste déroulante des statuts et le format « texte brut » (à ce moment-là : relancer `installerLot7Production`, qui les repose).
- **2e relecture** : une tabulation ou un caractère invisible collé dans le chantier, le repère ou une légende est remplacé par une espace par la page (le serveur le refuse, et un refus est définitif) ; le serveur refuse aussi les séparateurs de ligne Unicode.
