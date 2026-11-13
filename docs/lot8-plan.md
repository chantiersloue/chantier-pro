# Lot 8 — Note de réunion : plan

> Commande : `PLAN.md`, exigence 12 et « Lot 8 — Note de réunion » ; décision D9b-5 du 13/11/2026 (`DECISIONS.md`).
> **Version 2**, après critique par un agent indépendant (ce qu'elle a fait changer : chapitre 12).
> **Rédigée sans interview** : Franck est absent et a demandé d'avancer. Chaque choix fait à sa place est marqué **[Hypothèse]** et repris au chapitre 11. **Aucun code n'est écrit avant sa validation**, sauf accord pour 8a et 8b (chapitre 2).

## 1. La commande, en clair

Aujourd'hui, la note de réunion est un texte libre, des photos et un PDF envoyé par mail. Demain, elle devient un **compte rendu suivi** : chaque note d'un chantier porte un numéro (« Compte rendu n° 7 », abrégé « CR n° 7 »), elle est faite de **points** que l'on ouvre et que l'on clôt, et les points restés ouverts **reviennent tout seuls** dans la note suivante.

Ce qui est déjà décidé (et ne se rediscute pas ici) :

| Sujet | Décision |
|---|---|
| Numéro | automatique, **par chantier**, gardé dans le Sheet |
| Pré-remplissage | date, chantier, rédacteur (le compte connecté) |
| Un point | un texte, des photos, un état **ouvert / clos**. **Pas de colonne « actions / responsables »** |
| Reprise | les points non clos reviennent, marqués « repris du CR n° x » ; le rédacteur les clôt ou les complète |
| Présents | **facultatifs**, saisis **à la main** (D9b-5 : l'onglet *Intervenants* n'est rempli par personne) |
| Destinataires | saisis à la main ; l'onglet *Contacts notes* propose les adresses connues ; note avant tout **interne** |
| Photos | compressées sur le téléphone ; annotation à la résolution de la photo ; la gomme efface le trait, pas la photo |
| Dictée | le micro du clavier du téléphone (rien à installer) |

**Constat sur l'existant** (lu dans le code) : l'annotation se fait **déjà** sur la photo en pleine résolution, et la gomme repeint **déjà** la photo d'origine (lot 1). Il reste un défaut : une fois « Valider » touché, les traits sont fondus dans la photo. Si on rouvre l'annotation, la gomme ne peut plus les retirer, et la photo est recompressée à chaque validation.

## 2. Trois livraisons, dont deux qui n'attendent pas

| | Contenu | Dépend de | Versions |
|---|---|---|---|
| **8a — Annotation qu'on peut rouvrir** | la photo d'origine et les traits sont gardés jusqu'à l'envoi | rien (pages seules) | appli 10.0 |
| **8b — Numéro et présents** | numéro donné par le serveur **à la réception**, onglet *Comptes rendus*, présents saisis à la main. **Rien à lire sur le serveur** | rien | serveur v11.0, appli 10.1 |
| **8c — Points et reprise** | note en points, reprise des points ouverts, hors réseau, rappel des présents | **les réponses de Franck** (chapitre 11) | serveur v11.1, appli 10.2 |

- **8a et 8b peuvent être construits avant les réponses de Franck.** Leurs hypothèses sont minces et se changent en une ligne avant la production :
  - 8a : la photo annotée pèse le double dans le brouillon (origine + image finale) ; une photo annotée avant 8a garde ses anciens traits pour de bon ;
  - 8b : numéro dans l'ordre d'arrivée au serveur (question 3) ; une note envoyée sans compte est numérotée (question 4) ; une note sur un chantier hors liste n'a pas de numéro ; 10 adresses connues au plus par note (question 6).
- **8c attend la validation de Franck** : sa conception dépend des questions 1, 2, 5, 7 et 8.
- **Numéros de version** : le lot 5, en cours ailleurs, prend le serveur v10.0. Si le lot 8 sort avant lui, le serveur passera de v9.1 à v11.0, puis reviendra à un « v10.0 » plus récent : les numéros se croiseront. À trancher au moment de la fusion (renuméroter celui qui sort en second).

## 3. Ce que l'utilisateur verra (téléphone de 375 px d'abord)

La page reste `note-reunion.html`, avec les mêmes boutons (Retour, Aperçu, Envoyer la note), le même brouillon automatique et le même indicateur d'envoi. Boutons de **48 px au moins** (gants), texte noir sur blanc (soleil), une seule colonne.

**8a — Annotation**
- Rien ne change à l'écran (stylo, flèche, rectangle, gomme, 6 couleurs, taille, annuler). Nouveau : rouvrir une photo déjà annotée retrouve ses traits un par un ; la gomme et « annuler » agissent sur eux. Une photo annotée avant la mise à jour s'ouvre avec ce message : « Les anciens traits de cette photo ne s'effacent plus. »

**8b — Numéro**
- Sous le chantier, une ligne fixe : « **Le numéro du compte rendu est donné à l'envoi.** » La page ne lit rien sur le serveur : elle n'annonce donc aucun numéro. Chantier tapé à la main et absent de la liste : « Chantier hors liste : cette note n'aura pas de numéro ».
- Au retour du serveur, l'indicateur d'envoi affiche « ✓ Compte rendu n° 7 envoyé — 3 mails envoyés ». Le numéro figure dans le PDF, dans le nom du fichier rangé dans Drive et dans l'objet du mail.
- **Deux exceptions, dites clairement** : pour une adresse tapée à la main, l'objet du mail et le nom de la pièce jointe restent ceux imposés par le lot 0 (sans numéro ; le numéro est dans le PDF). Et si la réponse arrive sans numéro (ancien serveur encore en service), le message est « ✓ Note envoyée. Numéro non reçu : il sera dans le PDF. » Aperçu : à la place du numéro, « CR n° — donné à l'envoi ».

**8b — Présents** (facultatif)
- Un champ « Nom » et un bouton « + Ajouter » ; chaque présent devient une étiquette avec une croix. Les noms de l'onglet *Contacts* (les salariés) sont proposés pendant la frappe. Aucun rappel de la note précédente en 8b (il faudrait lire le serveur) : il arrive en 8c.

**8b — Destinataires** (brique actuelle)
- Inchangée, plus un compteur avant l'envoi : « 4 mails partiront (3 destinataires + le conducteur) ». Au-delà de 10 adresses connues, « + Ajouter » est refusé avec un message. **Pas de bouton « Reprendre les destinataires »** : la commande ne le demande pas (chapitre 12).

**8c — Points repris**
- Titre : « Points ouverts (5) ». Chaque point est une **carte repliée** : une ligne de texte, la mention « repris du CR n° 6 · ouvert depuis le CR n° 3 », et un gros bouton « **Clore** ». Toucher la carte l'ouvre : texte complet, « **Compléter** » (le micro du clavier sert à dicter), photos.
- Un point clos passe en gris avec « Clos ✓ » et « Rouvrir » : rien n'est définitif avant l'envoi. Un point repris ne se supprime pas. En dessous, repliée : « Clos récemment », les points clos par les **3 derniers** comptes rendus, avec « Rouvrir ». C'est la parade au **point clos par erreur**.
- Le bouton « **+ Nouveau point** » reste toujours visible au-dessus de la barre du bas, même avec 15 points repris.

**8c — Nouveaux points, remarques, photos**
- « + Nouveau point » : un texte, « 📷 Photo », « 🖼 Galerie », case « Réglé pendant la réunion ». Un nouveau point peut être retiré avant l'envoi.
- Le champ « Notes et commentaires » est **gardé**, renommé « Remarques générales (facultatif) » ; la section « Photos et croquis » aussi, pour les photos qui ne vont avec aucun point. Une note sans point reste possible. 10 photos au plus par note, tous points confondus (limite actuelle), compteur affiché.

**8c — Hors réseau**
- Avec du réseau, la page demande au serveur l'état **du chantier affiché** (dernier numéro, points ouverts, points clos récemment, présents de la dernière note) et le garde dans le téléphone. Elle rafraîchit aussi, 5 au plus par ouverture, les chantiers déjà gardés depuis plus d'un jour.
- Sans réseau, elle affiche ce qu'elle a gardé, avec sa date : « Points du 06/11, gardés dans le téléphone ». Si elle n'a rien : « Points de la dernière note indisponibles sans réseau. Écrivez vos nouveaux points : les anciens restent ouverts et reviendront à la note suivante. »
- **Deux notes de suite sans réseau sur le même chantier** : la seconde montre aussi les points de la première, marqués « note du 14/11 (en attente d'envoi) ». Les deux partent dans l'ordre où elles ont été écrites.
- **Présents** (8c) : ceux de la dernière note sont proposés en étiquettes grises à toucher.

**8c — Deux notes du même chantier en même temps, ou dans le désordre**
- Aucune note n'est refusée ni réécrite. Les numéros suivent **l'ordre d'arrivée au serveur** ; le PDF porte toujours la **date de la réunion**.
- Le téléphone n'envoie pas « l'état des points » mais **ce que la personne a fait** (chapitre 5.2). Un téléphone resté trois jours sans réseau ne peut donc **pas** rouvrir un point clos entre-temps, ni remplacer un texte complété par un vieux texte : il n'a rien fait sur ces points.
- Si le serveur voit qu'un compte rendu est arrivé entre-temps, il le dit : message sur le téléphone, ligne en tête du PDF (« Rédigé sans connaître le CR n° 7 »), colonne « Remarque » du Sheet.
- **Écart connu entre l'aperçu et le PDF** (exception au choix T5) : cette ligne, les vrais numéros à la place de « note du 14/11 (en attente) » et l'état d'un point clos entre-temps sont écrits par le serveur ; l'aperçu ne peut pas les montrer.

## 4. Les données

**Onglet *Comptes rendus*** — une ligne par note, écrite **en une seule fois** par l'appli :

| Col. | Livraison | Contenu |
|---|---|---|
| A | 8b | Numéro de fiche (créé par le téléphone ; sert à ne jamais compter deux fois la même note) |
| B, C | 8b | Chantier (nom) ; N° du chantier (colonne E de l'onglet *Chantiers*, s'il est rempli) |
| D | 8b | N° du compte rendu (vide si le chantier est hors liste) |
| E, F | 8b | Date de la réunion ; objet |
| G, H | 8b | Rédigé par (nom affiché) ; compte qui a envoyé (vérifié par le serveur, ou « sans compte ») |
| I | 8b | Présents (noms séparés par « ; ») |
| J, K | 8b | Nom du PDF rangé dans Drive ; reçu le (heure du serveur) |
| L | 8b | Remarque de l'appli (« reçu après le CR n° 8 », « rédigé sans connaître le CR n° 7 ») |
| M | 8c | Points ouverts après cette note, lisibles par Franck (un point par ligne) |
| N | 8c | Points clos par cette note, lisibles par Franck |
| O | 8c | Données de l'appli (identifiants et textes des points ; à ne pas modifier) |

- **Aucune adresse de destinataire** n'est gardée dans cet onglet (les adresses tapées à la main sont déjà dans le *Journal*).
- **Rattachement au chantier** : par le N° du chantier quand il est rempli, sinon par le nom (minuscules, espaces retirés). Un chantier renommé garde ainsi sa série et ses points, s'il a un N°.
- Colonnes de texte en « texte brut », valeurs neutralisées (fonction existante `cellule_`) : une formule tapée dans un point reste du texte. **Identifiant d'un point** : créé une fois par le téléphone, le même d'une note à l'autre.
- **Les photos ne sont pas reprises** d'une note à l'autre : elles restent dans le PDF de leur note (rangé dans Drive, puis dans le dossier du chantier sur le PC).

**Gardé dans le téléphone**
- Brouillon : brique actuelle `commun/brouillon.js`, **non modifiée**, même clé « note ». Note en attente : file d'attente actuelle.
- 8c : dernier état connu de chaque chantier, dans **une base à part** (comme celle des notes du lot 3), rangée **par compte**, effacée à la déconnexion et quand le serveur dit que l'accès au chantier est retiré.

**Les 4 endroits à tenir d'accord** (règle technique 5)

| Endroit | Fichiers | Livraison |
|---|---|---|
| Modèle du PDF | `modeles/note.js` (recopié tout seul dans `apps-script/Modeles.gs`) ; `modeles/mise-en-page.js` **non modifié** | 8b, 8c |
| Écran | `note-reunion.html` (8a, 8b, 8c) ; `commun/ui.js` (le message « ✓ Compte rendu n° 7 » vient de l'indicateur commun) ; nouveau `commun/comptes-rendus.js` (8c) ; `commun/api.js` (8c : ordre d'envoi de deux notes du même chantier) | toutes |
| Aperçu | le même modèle, appelé par la page | 8b, 8c |
| Apps Script | `Documents.gs` (`traiterNoteReunion`), nouveau `ComptesRendus.gs`, `Api.gs` (numéro rendu aussi quand la fiche est « déjà reçue » ; une action de lecture en 8c) | 8b, 8c |
| Et aussi | `docs/structure-sheet.md`, `tests/faux-serveur.js`, `sw.js`, `CHANGELOG.md`, `docs/guide-utilisateur.md` | toutes |

## 5. Les choix techniques

**5.1 Le numéro : où et quand** (8b)

| Solution | Retenue ? | Raison |
|---|---|---|
| Le serveur le donne **à la réception**, sous verrou (une seule note à la fois), en lisant l'onglet | **oui** | marche hors réseau ; deux téléphones ne peuvent pas avoir le même ; visible dans le Sheet |
| Le serveur le réserve à l'ouverture de la page | non | impossible hors réseau ; une note abandonnée laisse un trou |
| Le téléphone calcule « dernier + 1 » | non | deux téléphones donnent le même numéro |

- Numéro = le plus grand numéro du chantier + 1. **Jamais de double** : avant d'en donner un, le serveur cherche le numéro de fiche dans l'onglet et réutilise le sien (note renvoyée, PDF raté au premier essai).
- **Un trou reste possible** et se voit dans le Sheet : numéro pris, PDF en échec, et téléphone qui ne réessaie jamais (appli désinstallée). Je ne promets donc pas « aucun trou ». Après une réponse perdue, le serveur répond « déjà reçue » : cette réponse portera désormais le numéro, pour que le téléphone l'affiche.

**5.2 Ce que la note envoie pour les points** (8c)

| Solution | Retenue ? | Raison |
|---|---|---|
| **Des gestes** : pour chaque point, « rien », « complété », « clos », « rouvert » ou « nouveau », avec le texte affiché et le numéro du compte rendu d'où venait la liste. Le serveur **n'applique que les gestes** | **oui** | une liste périmée ne peut rien défaire ; le serveur distingue « rouvert exprès » de « pas au courant » |
| L'état de chaque point (ouvert / clos), le dernier arrivé gagne (version 1) | non | un téléphone en retard rouvre des points clos et écrase des textes |

- Règles du serveur : « rien » ne change rien ; « clos » sur un point déjà clos ne change rien ; « complété » sur un point clos entre-temps garde le texte dans le PDF et la remarque, le point **reste clos** ; seul « rouvert » rouvre. Deux « complété » croisés : le dernier arrivé donne le texte, l'autre reste dans son PDF, avec une remarque.
- Un geste sur un identifiant inconnu (note précédente abandonnée dans un téléphone) devient un **nouveau point** avec son texte : rien n'est perdu.

**5.3 Où garder les points** (8c)

| Solution | Pour | Contre |
|---|---|---|
| **A. Dans la ligne du compte rendu** : la liste des points ouverts après la note, dans une cellule (proposée par la critique) | une seule ligne écrite d'un coup : ni lignes en double ni écriture à moitié ; lecture très courte (la dernière ligne du chantier) ; un seul onglet | pas de filtre « histoire d'un point » dans le Sheet (elle est dans les PDF) ; 50 000 caractères par cellule |
| B. Un onglet *Points CR*, une ligne par geste | histoire d'un point lisible et filtrable | lignes à dédoublonner après un envoi coupé ; tout l'onglet relu à chaque ouverture ; un onglet de plus |
| C. Un onglet, une ligne par point et par note (version 1) | — | texte recopié même inchangé ; mêmes défauts que B, en plus lourd |

- **Je recommande A**, avec les gestes de 5.2 : le serveur prend la liste de la **dernière ligne** du chantier, applique les gestes, écrit la nouvelle liste. La règle 5.2 vaut pour A comme pour B.
- Limite de la cellule : un point fait 2 000 caractères au plus. Au-delà de 45 000 caractères de points ouverts, la suite va dans une colonne « suite » et Franck reçoit un mail : la note n'est jamais refusée.
- Si Franck veut filtrer l'histoire des points dans le Sheet, c'est B (question 5) ; le reste du plan ne change pas.

**5.4 La reprise** (8c)

| Solution | Retenue ? | Raison |
|---|---|---|
| **Le serveur donne** la liste du chantier affiché ; le téléphone la **garde** | **oui** | juste même si la note précédente vient d'un autre appareil (Franck écrit sur PC et sur téléphone) ; droits vérifiés par le serveur |
| Le téléphone seul, d'après ses propres notes | non | faux dès que deux appareils écrivent sur le même chantier |
| Tous « mes chantiers » à chaque ouverture (version 1) | non | pour Franck, c'est tous les chantiers : trop lourd avec une barre de réseau |

**5.5 L'annotation** (8a)

| Solution | Retenue ? | Raison |
|---|---|---|
| **Photo d'origine + liste des traits** ; à « Valider », l'image finale est **refaite depuis l'origine** | **oui** | jamais de recompression en chaîne ; une seule grande image en mémoire ; rien de lourd au moment de l'envoi ni de l'aperçu |
| Image finale fabriquée seulement à l'envoi (version 1) | non | 10 grands rendus d'un coup, là où un vieux téléphone manque de mémoire |
| Deux calques (photo dessous, traits dessus) | non | deux images de 1 600 px en mémoire ; tout le code d'annotation à réécrire |

- Les traits sont arrondis au pixel et allégés (points trop proches retirés) avant d'être gardés ; leur poids dans le brouillon est **mesuré par un test**. Le poids de l'image finale est contrôlé (1,5 Mo au plus, limite du serveur).

**5.6 Brouillons, fiches en attente, ancien et nouveau serveur**

| Solution | Retenue ? | Raison |
|---|---|---|
| **Le nouveau format contient l'ancien** : mêmes champs qu'aujourd'hui, plus les présents et les points | **oui** | un ancien brouillon se restaure tel quel ; une ancienne fiche en attente est « une note sans point » |
| Nouveau format + conversion de l'ancien | non | un oubli = un brouillon perdu (contrainte absolue 5) |
| Nouveau type de fiche | non | les fiches en attente et les vieilles pages seraient refusées |

- **Nouvelle page + ancien serveur** (déploiement en retard, retour arrière) : rien ne doit manquer dans le PDF. Donc **toutes les photos restent dans la liste actuelle, à plat**, chacune avec le nom de son point ; et l'ancien champ de texte reçoit une copie lisible (présents, points, remarques). Le nouveau serveur, lui, lit un champ « remarques » **distinct** et ignore la copie : rien n'est imprimé deux fois.
- **La « page vierge » du brouillon** (mécanisme précis, `brouillon.js` non modifié) : le brouillon compare ce que la page lui donne à ce qu'elle donnait 0,5 s après l'ouverture. La page ne lui donne donc **que les gestes de la personne** (points ajoutés, complétés, clos, rouverts, présents, photos), **jamais** les points reçus du serveur ou du téléphone. Les champs des cartes sont marqués pour ne pas être pris par le brouillon. Ainsi : pas de faux « Brouillon retrouvé » à l'ouverture, ni après un envoi.
- **Brouillon restauré plus tard** : les gestes sont **rejoués sur la liste du jour**. Un geste sur un point clos entre-temps est montré (« clos au CR n° 7 — votre texte : … »), avec le choix de le rouvrir ou d'en faire un nouveau point. Rien n'est jeté en silence.

**5.7 Les droits**

| Solution | Retenue ? | Raison |
|---|---|---|
| **Écrire** : comme aujourd'hui. **Lire** (8c) : seulement qui a accès au chantier. **Gestes sur des points existants** : seulement avec un compte qui a accès au chantier | **oui** | ne retire rien à personne ; même règle que les notes du lot 3 et le carnet |
| Tout réserver aux conducteurs | non, sauf avis de Franck | retirerait une fonction aux poseurs (question 7) |
| Aucune vérification | non | n'importe quel compte pourrait clore les points de tous les chantiers |

- Une note n'est **jamais refusée**. Sans accès au chantier, ou sans compte : elle est envoyée, mais **seuls ses nouveaux points sont pris**. Un identifiant de point inconnu, ou d'un autre chantier, est traité comme un nouveau point. En lecture, « chantier inconnu » et « chantier interdit » reçoivent la même réponse.

**5.8 Présents, dictée**

| Solution | Retenue ? | Raison |
|---|---|---|
| **Saisie à la main** (8b), **plus rappel de la dernière note** à toucher (8c) | **oui** | décision D9b-5 ; aucun onglet de plus à tenir |
| Cases cochées depuis l'onglet *Intervenants* | non | l'onglet est vide et le restera |

- Dictée : celle du **clavier**. Un bouton de dictée propre à l'appli est écarté : il ne marche pas sur tous les iPhone et demande du réseau.

## 6. Ce qui ne change pas, et ce qui est hors périmètre

- Brouillon automatique, file d'attente, envoi des photos une par une, compression (1 600 px), limites des adresses tapées à la main (2 par fiche, 10 par jour), copie au conducteur, rangement dans `05 - CHANTIER/COMPTE RENDU`, « Mails en attente » : **inchangés**. Les autres fiches et l'accueil ne sont pas touchés.
- **Hors périmètre** : colonne « actions / responsables » ; onglet *Intervenants* ; modification d'une note envoyée ; liste des anciens comptes rendus dans l'appli ; reprise des photos d'une note à l'autre ; reprise des destinataires ; tout nouvel outil.
- **Constat hors lot** : le plan d'origine prévoyait un seul mail pour tous les destinataires (choix T8) ; le code envoie **un mail par adresse connue**, sans limite par note. Le lot 8 ajoute seulement le compteur et le plafond de 10 (question 6).

## 7. Risques et parades

| Risque | Parade |
|---|---|
| Brouillon existant perdu à la mise à jour | l'ancien format reste valable (5.6) ; essais avec un brouillon et un brouillon « mis de côté » de l'ancienne page |
| Brouillon perdu au **retour arrière** | voir chapitre 10 : on ne remet que le serveur ; si la page doit reculer, une « page de repli » testée d'avance |
| Fiche de l'ancien format en attente, vieille page gardée dans un téléphone | acceptée et numérotée comme une note sans point, sans limite de durée |
| Nouvelle page, ancien serveur | photos à plat, copie du texte, message « numéro non reçu » (5.6) ; essai dédié |
| Numéro en double | donné sous verrou par le serveur seul ; essai réel avec deux envois au même instant |
| Liste de points périmée | gestes (5.2) ; essai dédié |
| Point clos par erreur | « Rouvrir » avant l'envoi, puis pendant 3 comptes rendus |
| Compte sans accès qui clôt les points d'un autre chantier | seuls ses nouveaux points sont pris (5.7) ; essai avec des identifiants forgés |
| Chantier renommé | rattachement par le N° du chantier (chapitre 4) ; sans N°, la série repart : dit dans la procédure |
| Plus de 40 points ouverts | la limite de 40 ne porte que sur les **nouveaux** points d'une note |
| Titres de l'onglet changés à la main | l'onglet n'est ni lu ni écrit, les téléphones gardent tout et réessaient, Franck reçoit un mail (garde-fou du lot 3) |
| Quota de mails | compteur avant l'envoi, 10 adresses connues au plus par note ; en 8c, « reste x aujourd'hui » (donné par la lecture) ; mails reportés comme aujourd'hui |
| Photos lourdes, PDF lourd | 10 photos par note ; poids contrôlé ; photos en fin de PDF dans l'ordre des points, la légende commence par « Point 3 — » (aucun changement de la mise en page commune) |
| Réseau faible | 8b ne lit rien ; 8c lit un seul chantier ; la page s'affiche avant la réponse |
| Régression de la file d'attente (code commun) | 8c seulement, changement limité à l'ordre de deux notes du même chantier ; toutes les séries repassent |
| Ancien serveur qui répond encore après l'envoi | essais réels seulement après 6 bonnes réponses de suite (leçon du lot 3) |

## 8. Tests prévus

- **8a, page dans un vrai Chrome (375 px et PC)** : annoter, valider, rouvrir, gommer un ancien trait, annuler ; brouillon restauré avec ses traits ; ancienne photo annotée ; poids des traits et de l'image mesurés ; échec de mémoire simulé (la photo d'origine reste).
- **8b, serveur avec le faux Google** (`tests/lot8-serveur.test.js`) : numéros 1, 2, 3 ; deux chantiers ; rattachement par N° après renommage ; fiche renvoyée (même numéro, une seule ligne, pas de second mail, numéro dans « déjà reçue ») ; PDF raté puis réessayé ; chantier hors liste ; sans compte ; ancien format ; adresse tapée à la main (objet imposé) ; plus de 10 adresses ; titres changés ; texte piégé ; quota.
- **8b, page** : note complète ; hors réseau ; réseau lent (6 s) ; panne ; réponse perdue ; **réponse sans numéro** ; **ancien brouillon** et **ancienne fiche en attente** ; **nouvelle page contre l'ancien serveur** ; **brouillon et fiche du nouveau format après retour arrière** (page de repli) ; pas de faux brouillon après l'envoi.
- **8c, serveur** : chaque geste ; liste périmée ; gestes croisés ; identifiants forgés, inconnus, d'un autre chantier ; second essai après une écriture coupée ; plus de 40 points ouverts ; cellule pleine ; droits de lecture par rôle ; note abandonnée dont la suivante reprend les points.
- **8c, page** : reprise, clore, compléter, rouvrir ; cartes repliées à 375 px ; hors réseau avec et sans liste gardée ; deux notes de suite hors réseau ; brouillon restauré face à une liste qui a changé ; second compte sur le même téléphone ; pas de faux brouillon à l'ouverture.
- **PDF** (`tests/pdf-cas.js`) : sans point, 15 points longs, photos de plusieurs points, données réécrites par le serveur (écart connu avec l'aperçu).
- **Essais réels sur la copie TEST** (`tests/reel-lot8.js`, par la porte de service, comme les lots 3, 4 et 7) : deux envois au même instant (le vrai verrou), hauteur réelle du tableau des points dans le PDF de Google, 20 mails au plus par séance.
- Toutes les séries existantes repassent, avec `node --check` et l'équilibre des balises.
- **Ce que seul Franck peut essayer** : gants et plein soleil ; la dictée du clavier sur Android et iPhone ; la réception des vrais mails ; une barre de réseau sur chantier ; son propre brouillon en cours au moment de la mise à jour.

## 9. Ce que Franck aura à faire

| Quand | Quoi | Durée |
|---|---|---|
| Maintenant | lire ce plan, répondre aux questions du chapitre 11 | 20 min |
| 8a | essais d'annotation sur téléphone, fusion par le lien pré-rempli | 15 min |
| 8b, 8c | envoi sur la copie TEST (commande habituelle, avec la porte) ; essais sur téléphone, dont une note laissée en attente et un brouillon commencé **avant** la mise à jour ; second envoi (sans la porte) ; production : nouveau déploiement, `installerLot8Production` (un clic), fusion | 30 à 40 min chacune |

- L'installation crée l'onglet *Comptes rendus* (8b) puis ses colonnes M à O (8c). Elle se relance sans danger. Sur TEST, je la lance par la porte de service. Je ne touche ni aux vraies données ni à la production, et je n'envoie aucun vrai mail.

## 10. Le retour arrière

- **8a** : fusion inverse. L'ancienne page relit les brouillons de la nouvelle (l'image finale y est à la place habituelle) : rien n'est perdu, seuls les traits ne sont plus modifiables.
- **8b et 8c, premier geste : ne remettre que le serveur** (l'ancien déploiement garde son adresse). La nouvelle page marche avec l'ancien serveur (5.6) : les brouillons ne sont pas touchés.
- **Si la page elle-même doit reculer** : une fusion inverse simple **perdrait** les présents et les points d'un brouillon en cours (l'ancienne page les ignore, puis les écrase 4 secondes plus tard). On publie donc une **page de repli**, préparée et testée avant la production : l'ancienne page, qui verse en plus les présents et les points du brouillon dans « Notes et commentaires », et leurs photos dans la liste des photos.
- Les notes déjà numérotées gardent leur numéro ; l'onglet peut rester. Aucune donnée existante n'est migrée : rien à sauvegarder ni à restaurer.

## 11. Ce que je te demande de trancher

L'interview n'a pas eu lieu. Réponds par oui ou non ; les questions 3, 4 et 6 concernent 8b, les autres 8c.

1. **Un point repris se complète-t-il en modifiant son texte** (le PDF de chaque note garde sa version), plutôt que par une ligne « suite » à chaque réunion ? Recommandation : **oui**.
2. **Les présents de la dernière note sont-ils proposés sans être cochés d'avance ?** Recommandation : **oui** (le plan d'origine disait « cochés » ; je préfère ne jamais marquer présent un absent).
3. **Acceptes-tu que le numéro suive l'ordre d'arrivée au serveur**, donc qu'un CR n° 9 puisse porter une date antérieure au CR n° 8 (téléphone resté sans réseau) ? Recommandation : **oui** ; l'autre voie serait de changer des numéros déjà envoyés par mail.
4. **Une note envoyée sans compte (période de transition) reçoit-elle un numéro ?** Recommandation : **oui** (elle est rangée et envoyée comme les autres) ; ses gestes sur les points, eux, sont ignorés.
5. **Veux-tu pouvoir filtrer l'histoire de chaque point dans le Sheet ?** Recommandation : **non** (solution A de 5.3 : plus simple et plus sûre ; l'histoire est dans les PDF).
6. **Mails : garde-t-on les 2 adresses tapées à la main par note** (comportement actuel, alors que le plan d'origine disait « une adresse nouvelle s'ajoute d'abord dans le Sheet »), **avec un plafond de 10 adresses connues par note et le moteur « un mail par adresse » inchangé ?** Recommandation : **oui** aux trois ; le mail unique (T8) dans un petit lot à part, car il sert à toutes les fiches.
7. **Les poseurs gardent-ils le droit d'écrire une note de réunion et de reprendre les points de leurs chantiers ?** Recommandation : **oui**, comme aujourd'hui.
8. **Veux-tu un bouton « Reprendre les destinataires de la dernière note » ?** Recommandation : **non** : il garderait des adresses de tiers dans le Sheet et dans les téléphones des poseurs, pour une note interne, et consommerait le quota.

Autres hypothèses, sans question (dis-le si l'une te gêne) : note sur un chantier hors liste = pas de numéro ; photos non reprises d'une note à l'autre ; 10 photos par note, 40 nouveaux points par note ; points clos rouvrables pendant 3 comptes rendus ; pas de liste des anciens comptes rendus dans l'appli.

## 12. Ce que la critique indépendante a fait changer

Chaque point a été vérifié dans le code avant d'être adopté.

| Point | Changement |
|---|---|
| B1 liste périmée | la note envoie des **gestes** ; la règle « clos l'emporte » et « l'état de la dernière ligne » disparaissent (5.2) |
| B2 nouvelle page, ancien serveur | photos à plat, champ « remarques » distinct, réponse sans numéro prévue et testée (5.6) |
| B3 retour arrière | serveur seul d'abord ; page de repli testée (chapitre 10) |
| B4 page vierge du brouillon | mécanisme écrit ; `brouillon.js` non modifié (5.6) |
| I1 | numéro absent de l'objet et de la pièce jointe pour une adresse tapée à la main : dit au chapitre 3 |
| I2 | sans accès ou sans compte, seuls les nouveaux points sont pris (5.7) |
| I3 | « ni double ni trou » retiré ; ligne écrite d'un coup ; numéro rendu avec « déjà reçue » (5.1) |
| I4 | rattachement par le N° du chantier (chapitre 4) |
| I5 | limite de 40 sur les nouveaux points seulement |
| I6 | nouveau découpage : annotation d'abord, numéro sans lecture, points en dernier |
| I7, I8 | quatre questions de plus (3, 4, 6, 8) ; bouton « Reprendre les destinataires » retiré ; compteur et plafond |
| I9 | image refaite depuis l'origine à « Valider » ; traits allégés ; poids mesuré (5.5) |
| I10 | essais réels sur la copie TEST et tests manquants ajoutés (chapitre 8) |
| I11 | lecture du seul chantier affiché ; plus de ligne par point et par note |
| M1 à M7 | écart aperçu / PDF écrit ; cartes repliées et bouton toujours visible ; « Compte rendu » en toutes lettres, « Réglé pendant la réunion » ; rouvrir sur 3 comptes rendus ; `commun/ui.js` listé ; croisement des versions dit |
| Version plus simple | adoptée pour le stockage (solution A), soumise à Franck (question 5) |

**Points non suivis tels quels, et pourquoi**
- **B3, variante « recopier le texte des points dans le champ du brouillon »** : la page ne peut pas écrire dans les champs du brouillon sans modifier `brouillon.js` ou salir le champ « Remarques » visible. Remplacée par la page de repli.
- **I8, « reste x mails aujourd'hui »** : pas en 8b, qui ne lit rien sur le serveur ; ajouté en 8c.
- **M2** : plutôt que du code nouveau dans la mise en page commune, les photos restent une liste à plat, dans l'ordre des points, avec une légende qui nomme le point.
- **Deux livraisons au lieu de trois** : trois sont gardées, pour que 8a et 8b sortent sans attendre les réponses.
