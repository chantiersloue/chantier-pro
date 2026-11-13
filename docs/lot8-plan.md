# Lot 8 — Note de réunion : plan

> Commande : `PLAN.md`, exigence 12 et « Lot 8 — Note de réunion » ; décision D9b-5 du 13/11/2026 (`DECISIONS.md`).
> **Version 1, rédigée sans interview** : Franck est absent ce week-end et a demandé d'avancer. Chaque choix fait à sa place est marqué **[Hypothèse]** et repris au chapitre 10. **Aucun code n'est écrit avant sa validation.**
> Versions prévues : serveur **v11.0**, appli **10.0** (le lot 5, en cours ailleurs, prend le serveur v10.0 sans changer l'appli).

## 1. La commande, en clair

Aujourd'hui, la note de réunion est un texte libre, des photos et un PDF envoyé par mail. Demain, elle devient un **compte rendu suivi** : chaque note d'un chantier porte un numéro (« CR n° 7 »), elle est faite de **points** que l'on ouvre et que l'on clôt, et les points restés ouverts **reviennent tout seuls** dans la note suivante.

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
| Mails | règles du lot 0 inchangées : 2 adresses tapées à la main par fiche, 10 par jour, quota de 100 destinataires par jour |

**Constat sur l'existant** (lu dans le code, pas supposé) : l'annotation se fait **déjà** sur la photo en pleine résolution, et la gomme repeint **déjà** la photo d'origine (lot 1). Il reste un défaut : une fois « Valider » touché, les traits sont fondus dans la photo. Si on rouvre l'annotation, la gomme ne peut plus les retirer, et la photo est recompressée à chaque fois. C'est ce défaut que la livraison 8c corrige.

## 2. Trois petites livraisons

Le lot touche la page la plus utilisée par Franck, le PDF, le serveur et le Sheet. Il est découpé pour que chaque morceau serve seul et se retire seul.

| | Contenu | Ce que ça apporte | Versions |
|---|---|---|---|
| **8a — Numéro et présents** | numéro donné par le serveur, onglet *Comptes rendus*, présents, rappel des présents et des destinataires de la note précédente | chaque note a son « CR n° x » dans le PDF, le nom du fichier et l'objet du mail | serveur v11.0, appli 10.0 |
| **8b — Points et reprise** | note en points, ouvert / clos, photos par point, reprise des points ouverts, y compris hors réseau, onglet *Points CR* | le suivi d'une réunion à l'autre | serveur v11.1, appli 10.1 |
| **8c — Annotation qu'on peut rouvrir** | la photo d'origine et la liste des traits sont gardées jusqu'à l'envoi | on corrige une annotation sans abîmer la photo | appli 10.2 (serveur inchangé) |

## 3. Ce que l'utilisateur verra (téléphone de 375 px d'abord)

La page reste `note-reunion.html`, avec les mêmes boutons (Retour, Aperçu, Envoyer la note), le même brouillon automatique et le même indicateur d'envoi en haut. Tous les boutons font **48 px au moins** (gants), le texte est noir sur blanc (soleil), une seule colonne.

**Écran 1 — Informations** (comme aujourd'hui, plus le numéro)
- Chantier : celui choisi à l'accueil, sinon la liste. Date du jour. « Rédigé par » : le nom du compte connecté, modifiable.
- Sous le chantier, une ligne de numéro :
  - avec réseau : « **CR n° 7** (prévu) — le précédent est le CR n° 6 du 06/11 » ;
  - sans réseau : « **Numéro donné à l'envoi** — dernier connu de ce téléphone : CR n° 6 du 06/11 » ;
  - chantier tapé à la main et absent de la liste : « Chantier hors liste : cette note n'aura pas de numéro ».
- Le mot « prévu » est voulu : **seul le serveur donne le numéro**, au moment où il reçoit la note. Le vrai numéro apparaît dans le message « ✓ CR n° 7 envoyé », dans le PDF et dans le mail.

**Écran 2 — Présents** (facultatif, 8a)
- Un champ « Nom » et un bouton « + Ajouter » ; chaque présent devient une étiquette avec une croix pour le retirer.
- Les présents de la note précédente sont proposés en étiquettes grises : on touche celles qui sont là aujourd'hui. **[Hypothèse]** aucune n'est cochée d'avance, pour ne jamais marquer présent quelqu'un d'absent. Les noms de l'onglet *Contacts* (les salariés) sont proposés pendant la frappe.

**Écran 3 — Points repris** (8b)
- Titre : « Points ouverts — repris du CR n° 6 ». Chaque point est une carte : son numéro d'ordre, la mention « repris du CR n° 6 · ouvert depuis le CR n° 3 », son texte.
- Deux gros boutons par carte : « **Compléter** » (le texte s'ouvre, le micro du clavier sert à dicter) et « **Clore** ». Un point clos passe en gris avec « Clos ✓ » et un bouton « Rouvrir » : tant que la note n'est pas envoyée, rien n'est définitif. Un point repris ne se supprime pas : on le laisse ouvert ou on le clôt.
- En dessous, repliée : « Clos au CR n° 6 (2) », avec « Rouvrir » sur chaque ligne. C'est la parade au **point clos par erreur**.

**Écran 4 — Nouveaux points** (8b)
- Bouton « + Nouveau point » : un texte, « 📷 Photo », « 🖼 Galerie », case « Clos tout de suite » (point réglé en séance). Un nouveau point peut être retiré avant l'envoi (confirmation s'il a des photos).

**Écran 5 — Remarques générales et autres photos**
- Le champ « Notes et commentaires » d'aujourd'hui est **gardé**, renommé « Remarques générales (facultatif) ». La section « Photos et croquis » est gardée pour les photos qui ne vont avec aucun point. Une note sans aucun point reste donc possible, exactement comme aujourd'hui.

**Photos et annotation**
- 10 photos au plus par note, tous points confondus (limite actuelle ; le compteur est affiché). Toucher une photo ouvre l'annotation plein écran actuelle (stylo, flèche, rectangle, gomme, 6 couleurs, taille, annuler le dernier trait). Avec 8c, rouvrir une photo déjà annotée retrouve ses traits un par un.

**Écran 6 — Destinataires** (brique actuelle, inchangée)
- Le conducteur du chantier reçoit toujours sa copie. Les autres adresses s'ajoutent à la main ; *Contacts notes* et *Contacts* sont proposés pendant la frappe. Nouveau bouton : « Reprendre les destinataires du CR n° 6 ». Le nombre total est affiché (« 3 destinataires + le conducteur »).

**Aperçu et envoi**
- « Aperçu » montre le PDF tel qu'il partira ; à la place du numéro : « CR n° — donné à l'envoi ». « Envoyer la note » range la note dans le téléphone, puis l'envoie (file d'attente actuelle). Au retour du serveur : « ✓ CR n° 7 envoyé — 3 mails envoyés ».

**Hors réseau**
- La note s'écrit et se range comme aujourd'hui. Elle part au retour du réseau, et reçoit son numéro à ce moment-là.
- **Points ouverts sans réseau** : à chaque ouverture de la page avec du réseau, le téléphone reçoit en une seule petite demande, pour chacun de « mes chantiers », le dernier numéro, les points ouverts (texte seul), les présents et les destinataires. Il les garde. Sans réseau, la page affiche ce qu'elle a gardé, avec sa date : « Points du 06/11, gardés dans le téléphone ».
- Si le téléphone n'a rien gardé pour ce chantier, la page le dit : « Points de la dernière note indisponibles sans réseau. Écrivez vos nouveaux points : les anciens restent ouverts et reviendront à la note suivante. » Rien n'est perdu : un point que personne n'a clos reste ouvert.
- **Deux notes de suite sans réseau sur le même chantier** : la seconde reprend les points de la première, marqués « repris de la note du 14/11 (en attente d'envoi) ». Le serveur met les bons numéros dans les PDF à l'arrivée ; les deux notes partent dans l'ordre où elles ont été écrites.

**Deux notes du même chantier écrites en même temps** (Franck au bureau, un poseur sur place)
- Les numéros suivent **l'ordre d'arrivée au serveur** : la première arrivée est le CR n° 7, la seconde le CR n° 8. Aucune n'est refusée, aucune n'est modifiée.
- La seconde a repris les points du CR n° 6 sans connaître le n° 7. Le serveur le voit et le dit à trois endroits : le message sur le téléphone, une ligne en tête du PDF (« Rédigé sans connaître le CR n° 7 »), la colonne « Remarque » du Sheet.
- Règle pour la suite **[Hypothèse]** : **« clos l'emporte »** — un point clos dans l'une des deux notes reste clos ; pour le texte, c'est celui de la dernière note arrivée. « Rouvrir » reste possible à la note suivante.
- Avec du réseau, la page vérifie le dernier numéro à l'ouverture et juste avant l'envoi. S'il a changé : « Un CR n° 7 a été envoyé entre-temps par … Envoyer quand même, ou recharger les points ? ». Simple avertissement : la saisie n'est jamais touchée.
- **Notes envoyées dans le désordre** (un téléphone resté trois jours sans réseau) : la note du 12/11 peut recevoir un numéro plus grand que celle du 14/11. Le PDF porte toujours la **date de la réunion** ; la colonne « Remarque » note « reçu après le CR n° 8 ».

## 4. Les données

**Onglet *Comptes rendus*** (8a) — une ligne par note, écrite par l'appli seulement :

| Col. | Contenu |
|---|---|
| A | Numéro de fiche (créé par le téléphone ; sert à ne jamais compter deux fois la même note) |
| B | Chantier |
| C | N° du CR (1, 2, 3… ; vide si le chantier est hors liste) |
| D | Date de la réunion |
| E | Objet |
| F, G | Rédigé par (nom affiché) ; compte qui a envoyé (identifiant vérifié par le serveur) |
| H | Présents (noms séparés par « ; ») |
| I | Destinataires demandés (adresses séparées par « ; ») |
| J, K | Nombre de points ; dont ouverts |
| L, M | Nom du PDF rangé dans Drive ; reçu le (heure du serveur) |
| N | Remarque de l'appli (« reçu après le CR n° 8 », « rédigé sans connaître le CR n° 7 », « sans point ») |

**Onglet *Points CR*** (8b) — une ligne par point **et par note où il figure** :

| Col. | Contenu |
|---|---|
| A | Identifiant du point (stable : créé une fois par le téléphone, le même d'une note à l'autre) |
| B, C, D | Chantier ; n° du CR ; numéro de fiche de la note |
| E | Rang du point dans la note |
| F | Texte (2 000 caractères au plus) |
| G | État : Ouvert / Clos |
| H, I | Apparu au CR n° (première note du point) ; repris du CR n° (vide pour un point nouveau) |
| J, K | Nombre de photos (les photos sont dans le PDF, pas dans le Sheet) ; enregistré le |
| L | Remarque de l'appli (« clos au CR n° 7 : clos l'emporte », « rouvert ») |

- **L'état d'un point** est celui de sa ligne au numéro de CR le plus grand. **Les points ouverts d'un chantier** sont donc tous ceux dont la dernière ligne dit « Ouvert », quelle que soit la note où ils ont été vus pour la dernière fois.
- Les lignes ne sont **jamais modifiées** : on en ajoute seulement. Franck peut trier et filtrer sans rien casser (les lignes sont retrouvées par identifiant, pas par position). Colonnes de texte en « texte brut » et valeurs neutralisées (fonction existante `cellule_`) : une formule tapée dans un point reste du texte.
- **Les photos ne sont pas reprises** d'une note à l'autre : elles restent dans le PDF de leur note (rangé dans Drive, puis dans MEGA). On peut en ajouter de nouvelles à un point repris.

**Gardé dans le téléphone**
- Brouillon de la note : brique actuelle `commun/brouillon.js`, même clé « note ». Note en attente d'envoi : file d'attente actuelle (`LOUE.mettreEnFile`).
- Dernier état connu de chaque chantier (numéro, points ouverts, présents, destinataires) : **une base à part**, comme celle des notes du lot 3, rangée **par compte**, effacée à la déconnexion et quand le serveur répond que l'accès au chantier est retiré.

**Les 4 endroits à tenir d'accord** (règle technique 5)

| Endroit | Fichier | Changement |
|---|---|---|
| Modèle du PDF | `modeles/note.js` (recopié tout seul dans `apps-script/Modeles.gs` par `outils/construire.js`) | bandeau « CR n° x », présents, tableau des points, photos par point |
| Écran | `note-reunion.html`, nouveau `commun/comptes-rendus.js` | écrans du chapitre 3 |
| Aperçu | le même modèle, appelé par la page | rien à écrire en double (choix T5) |
| Apps Script | `Documents.gs` (`traiterNoteReunion`), nouveau `ComptesRendus.gs`, `Api.gs` (une action de lecture en plus) | numéro, onglets, lecture, droits |
| Et aussi | `docs/structure-sheet.md`, `tests/faux-serveur.js`, `sw.js` (liste des fichiers gardés hors réseau), `CHANGELOG.md`, `docs/guide-utilisateur.md` | mise à jour à chaque livraison |

## 5. Les choix techniques

**5.1 Le numéro : où et quand**

| Solution | Retenue ? | Raison |
|---|---|---|
| Le serveur le donne **à la réception** de la note, sous verrou (une seule note à la fois), en lisant l'onglet *Comptes rendus* | **oui** | marche hors réseau ; deux téléphones ne peuvent pas avoir le même ; visible et corrigeable dans le Sheet |
| Le serveur le réserve à l'ouverture de la page | non | impossible hors réseau ; une note abandonnée laisse un trou |
| Le téléphone calcule « dernier + 1 » | non | deux téléphones donnent le même numéro |

- Numéro = le plus grand numéro du chantier + 1 (pas le nombre de lignes : une ligne effacée à la main ne crée pas de doublon). Le nom du fichier reçoit le complément « CR 07 » (D1-79 l'attendait) ; l'objet du mail aussi.
- **Ni double ni trou** : avant de donner un numéro, le serveur cherche le numéro de fiche dans l'onglet. S'il y est déjà (note renvoyée après une coupure, ou PDF raté au premier essai), il **réutilise le même numéro**.

**5.2 Le stockage des points**

| Solution | Retenue ? | Raison |
|---|---|---|
| **Une ligne par point et par note**, ajoutée, jamais modifiée | **oui** | lisible et filtrable par Franck ; l'histoire d'un point se lit de haut en bas ; deux envois en même temps ne s'écrasent pas |
| Une ligne par point, modifiée à chaque note | non | l'ancien texte est perdu ; modifier une ligne trouvée par sa position est fragile si l'onglet est trié |
| Un bloc par note (toute la note dans une cellule) | non | illisible pour Franck ; limite de 50 000 caractères par cellule |

**5.3 La reprise des points**

| Solution | Retenue ? | Raison |
|---|---|---|
| **Le serveur calcule** les points ouverts ; le téléphone les **garde** pour le hors-réseau | **oui** | juste même si la note précédente vient d'un autre téléphone ; droits vérifiés par le serveur |
| Le téléphone seul, d'après ses propres notes | non | faux dès que deux personnes écrivent sur le même chantier |
| Le serveur seul, à chaque ouverture, sans rien garder | non | rien hors réseau, contraire à « le terrain d'abord » |

**5.4 L'annotation**

| Solution | Retenue ? | Raison |
|---|---|---|
| **Photo d'origine + liste des traits, rejouée** à chaque affichage (c'est déjà le principe du code ; 8c garde en plus l'origine et les traits dans le brouillon) | **oui** | une seule grande image en mémoire (vieux téléphones) ; les traits pèsent quelques Ko ; « annuler » et gomme exacts ; l'image finale n'est compressée qu'une fois, à l'envoi |
| Deux calques (la photo dessous, un calque transparent pour les traits) | non | deux images de 1 600 px en mémoire ; calque lourd à garder dans le brouillon ; tout le code d'annotation à réécrire |

- Un brouillon d'avant 8c contient des photos déjà fondues avec leurs traits : elles restent utilisables, mais leurs anciens traits ne s'effacent plus. La page le dit à la réouverture.

**5.5 Les brouillons et les fiches déjà dans les téléphones au moment de la mise à jour**

| Solution | Retenue ? | Raison |
|---|---|---|
| **Le nouveau format contient l'ancien** : mêmes champs qu'aujourd'hui, plus le numéro, les présents et les points | **oui** | un ancien brouillon se restaure tel quel (texte dans « Remarques générales », photos dans « Autres photos ») ; une ancienne fiche en attente est simplement « une note sans point » : aucun cas particulier |
| Nouveau format + conversion de l'ancien | non | une conversion de plus à tester ; un oubli = un brouillon perdu (contrainte absolue 5) |
| Nouveau type de fiche, l'ancien abandonné | non | les fiches en attente et les pages encore gardées dans les téléphones seraient refusées |

- **Ceinture et bretelles** : la nouvelle page écrit aussi les points en texte simple dans l'ancien champ. Si un ancien serveur répond encore (retour arrière, déploiement en retard), le PDF contient quand même tout le texte.
- Le brouillon ne compte comme « saisie » que ce que la personne a fait. Des points repris et non touchés ne font **pas** apparaître la bannière « Brouillon retrouvé ». Changer de chantier en cours de saisie : les points repris non touchés sont remplacés par ceux du nouveau chantier ; s'ils ont été touchés, la page demande avant.

**5.6 Les droits**

| Solution | Retenue ? | Raison |
|---|---|---|
| **Écrire** : comme aujourd'hui (tout compte). **Lire et reprendre** les points, présents et destinataires : seulement qui a accès au chantier (conducteurs, admin, poseurs et atelier dont la case est cochée), vérifié par le serveur | **oui** | ne retire rien à personne (méthode, point 4) ; même règle que les notes du lot 3 et le carnet |
| Tout réserver aux conducteurs | non, sauf avis de Franck | retirerait une fonction aux poseurs (question 4) |
| Aucune vérification en lecture | non | un poseur lirait les comptes rendus de tous les chantiers |

- Une note n'est **jamais refusée** pour une question de droit (règle « zéro fiche perdue ») : elle est numérotée et envoyée. Mais sans accès au chantier, rien n'est donné à lire. « Chantier inconnu » et « chantier interdit » reçoivent la même réponse. Pendant la période sans compte : la note part comme aujourd'hui et reçoit un numéro ; la reprise demande un compte.

**5.7 Présents et destinataires**

| Solution | Retenue ? | Raison |
|---|---|---|
| **Saisie à la main + rappel de la note précédente**, à toucher | **oui** | décision D9b-5 ; aucun onglet de plus à tenir |
| Cases cochées depuis l'onglet *Intervenants* | non | l'onglet est vide et le restera (D9b-5) |
| Tout retaper à chaque note | non | pénible avec des gants |

- La dictée reste celle du **clavier**. Un bouton de dictée propre à l'appli est écarté : il ne marche pas sur tous les iPhone et demande du réseau.

## 6. Ce qui ne change pas, et ce qui est hors périmètre

- Brouillon automatique, file d'attente, envoi des photos une par une, compression (1 600 px), limites des adresses tapées à la main, copie au conducteur, rangement dans `05 - CHANTIER/COMPTE RENDU`, « Mails en attente » : **inchangés**. Les autres fiches ne sont pas touchées. L'accueil ne change pas (même tuile).
- **Hors périmètre** : colonne « actions / responsables » ; remplissage de l'onglet *Intervenants* ; modification d'une note déjà envoyée ; liste ou recherche des anciens comptes rendus dans l'appli (ils sont dans Drive et MEGA) ; reprise des photos d'une note à l'autre ; tout nouvel outil.
- **Constat hors lot** : le plan d'origine prévoyait un seul mail pour tous les destinataires (choix T8). Le code actuel envoie **un mail par adresse connue**. Le lot 8 ne touche pas à ce moteur, commun à toutes les fiches (question 5).

## 7. Risques et parades

| Risque | Parade |
|---|---|
| Brouillon existant perdu à la mise à jour | l'ancien format reste valable (5.5) ; essai avec un brouillon et un brouillon « mis de côté » créés par l'ancienne page |
| Fiche de l'ancien format en attente, ou vieille page encore gardée dans un téléphone | acceptée et numérotée comme une note sans point, sans limite de durée ; essai dédié |
| Numéros en double ou sautés | numéro donné sous verrou, par le serveur seul, et réutilisé pour un même numéro de fiche ; note abandonnée avant l'envoi = aucun numéro pris ; essai avec deux envois au même instant |
| Série coupée par un chantier renommé dans le Sheet | la suite repartirait à 1 : dit dans la procédure (ne pas renommer un chantier en cours) ; l'installation signale deux noms proches |
| Point clos par erreur | « Rouvrir » avant l'envoi, puis à la note suivante ; rien n'est effacé du Sheet |
| Deux notes en même temps | ordre d'arrivée, avertissements, « clos l'emporte » (chapitre 3) |
| Titres d'un onglet changés à la main | l'onglet n'est ni lu ni écrit, les téléphones gardent tout et réessaient, Franck reçoit un mail (même garde-fou qu'au lot 3) |
| Quota de mails | moteur actuel : mails reportés dans « Mails en attente » et renvoyés ; nombre de destinataires affiché avant l'envoi ; essais limités à 20 mails par séance |
| Photos trop lourdes | 10 par note ; image annotée recompressée une seule fois, avec contrôle du poids (1,5 Mo au plus, limite du serveur) |
| PDF trop lourd ou mal mis en page | photos regroupées par point sur des pages à elles, titre du point en haut (brique existante, contrôlée par le serveur) ; 40 points au plus par note ; cas ajoutés aux essais de PDF |
| Réseau faible | réponse de lecture en texte seul (quelques Ko) ; rien ne bloque la saisie ; la page s'affiche avant la réponse |
| Ancien serveur qui répond encore après l'envoi | points doublés en texte simple (5.5) ; essais réels seulement après 6 bonnes réponses de suite (leçon du lot 3) |
| Régression de la file d'attente (code commun à toutes les fiches) | changement limité à l'ordre d'envoi de deux notes du même chantier ; toutes les séries de tests repassent |

## 8. Tests prévus

- **Serveur, avec le faux Google** (nouveau `tests/lot8-serveur.test.js`) : numéros 1, 2, 3 par chantier ; deux chantiers indépendants ; même fiche renvoyée (même numéro, pas de seconde ligne, pas de second mail) ; PDF raté puis réessayé (même numéro) ; serveur occupé ; chantier hors liste ; ancien format ; points enregistrés ; calcul des points ouverts ; « clos l'emporte » ; arrivée dans le désordre ; droits de lecture par rôle ; titres changés ; texte piégé (formule, HTML) ; quota atteint.
- **PDF** (`tests/pdf-cas.js`) : sans point, 1 point, 15 points longs, photos sur plusieurs points, chantier et noms longs, nombre de pages prévu.
- **Page dans un vrai Chrome, à 375 px et sur PC** (nouveau `tests/lot8-page.test.js`, contre `tests/faux-serveur.js`) : note complète ; reprise, clore, compléter, rouvrir ; hors réseau avec points gardés, puis sans points gardés ; deux notes de suite hors réseau ; réseau lent (réponses à 6 s) ; panne ; réponse perdue ; quota ; **ancien brouillon** et **ancienne fiche en attente** fabriqués avec la page d'avant ; second compte sur le même téléphone (ne voit rien du premier) ; annotation rouverte ; aucun débordement à 375 px.
- Toutes les séries existantes repassent, avec `node --check` et l'équilibre des balises.
- **Ce que seul Franck peut essayer** : gants et plein soleil ; la dictée du clavier sur Android et sur iPhone ; le vrai PDF de Google (son moteur n'est pas celui de Chrome) ; la réception des vrais mails ; une barre de réseau sur chantier ; **son propre brouillon en cours** au moment de la mise à jour.

## 9. Ce que Franck aura à faire, et le retour arrière

| Quand | Quoi | Durée |
|---|---|---|
| Maintenant | lire ce plan, répondre aux questions du chapitre 10 | 15 min |
| 8a, 8b | lancer l'envoi sur la copie TEST (commande habituelle, avec la porte) ; ses essais sur téléphone, dont une note laissée en attente et un brouillon commencé **avant** la mise à jour ; second envoi (sans la porte) ; production : nouveau déploiement, `installerLot8Production` (un clic), fusion par le lien pré-rempli | 30 à 40 min par livraison |
| 8c | essais d'annotation sur téléphone, fusion | 15 min |

- L'installation (`installerLot8Test` / `installerLot8Production`) crée les deux onglets s'ils manquent. Elle peut être relancée sans danger. Sur TEST, je la lance moi-même par la porte de service. Je ne touche ni aux vraies données ni à la production, et je n'envoie aucun vrai mail : ces gestes restent ceux de Franck.
- **Retour arrière** : d'abord les pages (fusion inverse), ensuite le serveur (l'ancien déploiement garde son adresse). Les notes déjà numérotées gardent leur numéro ; les deux onglets peuvent rester, ils ne gênent rien. Aucune donnée existante n'est migrée : il n'y a donc rien à sauvegarder ni à restaurer.

## 10. Ce que je te demande de trancher

L'interview n'a pas eu lieu : voici les choix faits à ta place. Réponds par oui ou non.

1. **Trois livraisons (8a, 8b, 8c) plutôt qu'une seule ?** Ma recommandation : **oui**.
2. **Un point repris se complète-t-il en modifiant son texte** (le PDF de chaque note garde sa version), plutôt que par une ligne « suite » ajoutée à chaque réunion ? Ma recommandation : **oui**, un seul champ, plus simple d'une main.
3. **Les présents de la note précédente sont-ils proposés sans être cochés d'avance ?** Ma recommandation : **oui** (le plan d'origine disait « cochés comme à la note précédente » ; je préfère ne jamais marquer présent un absent).
4. **Les poseurs gardent-ils le droit d'écrire une note de réunion et de reprendre les points de leurs chantiers ?** Ma recommandation : **oui**, comme aujourd'hui. Si tu réponds non, la tuile est réservée aux conducteurs.
5. **Laisse-t-on le moteur des mails tel quel dans ce lot** (un mail par adresse connue, au lieu du mail unique prévu par T8) ? Ma recommandation : **oui**, et le corriger dans un petit lot à part, car il sert à toutes les fiches.
6. **Deux notes en même temps : la règle « clos l'emporte », avec avertissement, te convient-elle ?** Ma recommandation : **oui** ; le cas sera rare si tu es presque seul à rédiger.

Autres hypothèses prises, sans question (dis-le si l'une te gêne) : une note sur un chantier hors liste n'a pas de numéro ; les photos ne sont pas reprises d'une note à l'autre ; 10 photos et 40 points au plus par note ; seuls les points clos à la **dernière** note peuvent être rouverts ; pas de liste des anciens comptes rendus dans l'appli.
