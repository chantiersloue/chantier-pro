# Feuille de route — lundi 23/11/2026

> Ce que j'ai fait en autonomie depuis le 19/11, puis **tes actions, dans l'ordre, avec le temps estimé**.
> **Rien n'a été fait sur la copie TEST ni en production, aucun mail n'est parti**, ton dossier principal est resté sur la branche `lot-5`, `_prive\depot.json` n'a pas été touché.
> Tout est construit et testé **contre un faux Google et dans Chrome seulement** : aucun vrai téléphone, rien chez Google.

> État au vendredi 20/11/2026 : tout ce que tu avais demandé est construit, testé, relu là où c'était risqué, corrigé et envoyé sur GitHub.

## 1. En deux lignes

Les cinq points de ton programme sont faits, et le lot 14 aussi : **8d, 12, 13 construits, relus, corrigés** ; **10a-1, 10a-2, 10b et le mail unique remis à jour sur le lot 8** (mail unique relu) ; **le planning (11.1) et la demande d'absence reliée au planning (14) construits, relus, corrigés**.
Pour toi : **3 envois sur TEST et 3 mises en production au lieu de 8** : tu as choisi de regrouper le 20/11 (partie 3).

## 2. Tes actions, dans l'ordre

| # | Quoi | Où | Temps |
|---|---|---|---|
| 1 | **Fusionner le lot 8** avec le lien que je t'ai donné (si ce n'est pas fait vendredi). Après : « À propos » affiche **10.1** | navigateur | 5 min |
| 2 | **Me répondre sur la partie 4** (ce que j'ai tranché, dont le point 6) : un mot par ligne suffit. La partie 3 est décidée : on regroupe | ici | 10 min |
| 3 | **Groupe A — lots 8d, 12, 13 et 14** : un envoi sur TEST, puis une seule séance d'essais : `docs/essais-groupes.md` (branche `lot-14`). **Dossier prêt, branche lot-14, serveur v11.4** (confirmé le 20/11 ; empreinte avec porte 26c5a6bb64, sans porte a1f3c7e2e8). Adresse à mettre dans `ADRESSE_APPLI` sur TEST : `https://loue-essai.github.io/chantier-pro/` | PC, téléphone, Outlook | 45 min |
| 4 | **Groupe A en production** : un collage, un déploiement, deux installations (`installerLot8dProduction`, `installerLot12Production`), une fusion. Les lots 12 et 14 arrivent **éteints** | éditeur Apps Script | 20 min |
| 5 | Le programme du PC pour le récapitulatif des notes (lot 8d, étape C de sa procédure) | PC | 5 min |
| 6 | **Groupe B — lots 10a-1, 10a-2 et 10b** : un envoi, une séance, une production. Je remets d'abord la branche sur le groupe A | PC, téléphone | 40 min |
| 7 | **Mail unique (5b)** : ses cinq essais se font dans l'éditeur de TEST avec tes adresses (`docs/lot5b-procedure.md`). Livré éteint | PC | 30 min |
| 8 | **Planning (11.1)** : quand tu as 30 minutes, l'étape 0 de `docs/lot11-procedure.md` (branche `lot-14`) (les essais que seul Google peut trancher), sur un Sheet d'essai | PC | 30 min |
| 9 | **Allumer** ce qui est livré éteint, quand tu le décides : tous les chantiers ouverts (case de l'onglet *Réglages*), la réponse de la direction aux absences (réglage `ABSENCE_DIRECTION`), le mail unique | éditeur, Sheet | 5 min chacun |

**Archivage des anciens déploiements** : « Lot 5 — production » le **26/11** ; « Lot 5c — production » une semaine après la fusion du lot 8 ; ensuite, toujours une semaine après chaque fusion (les liens des mails d'absence valent 7 jours).

## 3. Décidé le 20/11 : on regroupe

| | Regroupé (ce que je propose) | Un lot à la fois (comme prévu avant) |
|---|---|---|
| Envois sur TEST | **3** : groupe A (`lot-14`), groupe B (`lot-10b`), mail unique (`lot-5b`) | 8 |
| Séances d'essais au téléphone | **2** (45 et 40 minutes) | 7 |
| Mises en production | **3** | 8 |
| Ce qui est en production est exactement ce qui a été essayé sur TEST | oui | oui |
| Si quelque chose casse | un seul retour arrière (l'adresse d'avant et les pages d'avant), mais il retire les quatre lots d'un coup | on sait tout de suite quel lot est en cause |

**Pourquoi je le propose** : les quatre lots du groupe A sont déjà empilés dans la même branche, chacun a ses tests, et les deux qui changent les règles (12 : qui voit quoi ; 14 : qui reçoit les absences) arrivent **éteints** : tu les allumes un par un, plus tard, d'un réglage. Ce qui change dès la mise en production : l'accueil (étoiles), la tuile « Notes », « Garder pour plus tard », le récapitulatif des notes.
**Ordre de mise en production** : lot 8 (fusion) → **groupe A** (8d, 12, 13, 14) → **groupe B** (10a-1, 10a-2, 10b) → **mail unique**. Un jour d'écart au moins entre deux.
Si tu préfères un lot à la fois : 8d → 12 → 13 → 14 → 10a-1 → 10a-2 → 10b → mail unique, chacun avec sa procédure (`docs/lotN-procedure.md` de sa branche) ; les numéros des lots 10 et du mail unique seront réattribués à ce moment-là.

## 4. Ce que j'ai tranché à ta place (dis-moi si quelque chose ne te va pas)

**Lot 14 — absences** (`docs/lot14-plan.md`, branche `lot-14`)
1. Les **adresses de la direction** : il me les faut (1 à 3) avant d'allumer. Rien n'est écrit dans le code.
2. Le lien du mail vaut **7 jours**, pour une seule réponse.
3. **Le PDF de la demande n'est plus rangé dans ADMINISTRATIF/ABSENCES** (il part dans le mail de la direction) et le motif n'est plus écrit dans le Sheet : c'est ce qui le tient hors de ta vue. D'accord ?
4. Appellation dans le planning : Congés, École, Formation ; **tout le reste = « Absent »** (médical, accident, personnel, motif tapé à la main). Trois motifs ajoutés à la liste de la page : Congés, École, Formation.
5. L'absence acceptée s'inscrit dans le planning **dans la nuit, et toujours juste avant une publication** (pas à la seconde).
6. **À toi de choisir** (la relecture l'a relevé) : la boîte « Messages envoyés » du compte Google de Loué garde le mail envoyé à la direction, donc le motif ; qui ouvre ce compte peut le lire. Soit tu l'acceptes (c'est la preuve de la demande), soit je fais mettre ce message à la corbeille de Gmail juste après l'envoi (Google la vide au bout de 30 jours).
7. Un poseur ne peut pas envoyer plus de **5 demandes d'absence par jour** (chacune envoie des mails).

**Lot 11.1 — planning** (`docs/lot11-procedure.md`, branche `lot-14`)
8. **Une case par jour, jamais de cases collées** : tu tapes `901 + 903`, le programme écrit les deux demi-journées l'une sous l'autre. Rien ne peut se dérégler. (Les cases collées de la maquette restent possibles plus tard.)
9. *Créer la semaine suivante* recopie les chantiers de chacun, pas les absences ni le véhicule du jour.
10. « Publier » est une demande : la case se décoche une fois le PDF dans l'appli ; si tu modifies ensuite, l'état te prévient et tu recoches.
11. Historique : deux mois dans le Sheet, puis 12 mois dans *HISTORIQUE*, puis effacé.
12. Atelier : une case par jour, jusqu'à 4 tâches l'une sous l'autre. Pas de lignes vides « places libres » : le menu *Ajouter un gars*.

**Mail unique (5b)**
13. Les **demandes d'absence ne sont jamais groupées** (le plan disait « inchangées », le programme les groupait : corrigé).
14. Le mode à allumer reste **`cache`** ; `conducteur` est la solution de secours que tu as validée le 18/11, avec un essai en plus avant.

**Lot 13**
15. Un brouillon gardé reste **30 jours à partir du jour où il est gardé** (pas du jour de la saisie).

## 5. À savoir

- **Lot 8** : le journal annonçait une « alerte sous 20 mails restants dans la journée ». **Elle n'existe pas** dans ce qui est en production (elle appartenait aux points retirés). Le journal est corrigé. La réserve de 20 mails pour toi, côté serveur, existe toujours.
- **Ce que les relectures indépendantes ont trouvé** (un tour chacune) :
  - lot 8d : un cas bloquant (deux chantiers de même numéro : notes mélangées) — corrigé ;
  - lot 12 : rien de bloquant ;
  - lot 13 : **deux cas de perte de saisie possibles** dans « Garder pour plus tard » (un brouillon de plus de 30 jours ; un appui juste après une frappe) — corrigés, avec leurs tests ;
  - mail unique : rien de bloquant ; les absences sorties du mail groupé, la procédure complétée ;
  - lots 11.1 et 14 (relus ensemble le 20/11) : rien de bloquant ; **cinq points importants corrigés**, avec leurs tests :
    - une demande d'**un seul jour** aurait affiché sa date en charabia chez la direction et le poseur (le tableur de Google transforme « 30/11/2026 » en date) — à confirmer quand même à ton essai ;
    - le poseur pouvait lire « En attente » alors que le mail à la direction n'était pas parti, et la direction pouvait recevoir le mail deux fois ;
    - dans le planning, une absence pouvait s'inscrire **sur la ligne d'un autre gars** si quelqu'un ajoutait un gars au même moment ;
    - `901 R+1` était coupé en « ½ 901 R » et « ½ 1 » ;
    - le motif reste lisible dans « Messages envoyés » du compte de Loué : **à toi de trancher** (partie 4, point 6).
- **Le compteur de mails de Google** a baissé de 4 pour 2 mails pendant les essais du lot 8 : toujours pas expliqué, à mesurer à part avant d'allumer le mail unique.
- **Jamais vérifié, pour tous ces lots** : un vrai téléphone, le vrai Google, Outlook (les boutons du mail d'absence), une vraie impression A3.

## 6. Où en est chaque lot

| Lot | Branche (dossier) | Numéros | État |
|---|---|---|---|
| 8 — note de réunion | `lot-8` | v11.0 / 10.1 | **serveur en production** ; fusion des pages à faire (action 1) |
| 8d — récapitulatif des notes | `lot-8d` | v11.1 / 10.2 | construit, relu, corrigé, envoyé sur GitHub |
| 12 — accueil, favoris, réglage | `lot-12` | v11.2 / 10.3 | idem |
| 13 — « Mes notes », « Garder pour plus tard » | `lot-13` | v11.3 / 10.4 | idem |
| 11.1 — planning | `lot-14` (la version à jour, corrigée après relecture) | hors de l'appli | construit (87 tests), relu, corrigé ; **rien chez Google** |
| 14 — absences | `lot-14` (`chantier-pro-lot14`) | v11.4 / 10.5 | construit, relu, corrigé ; **contient 8d, 12, 13 et 11.1** : c'est le groupe A |
| 10a-1, 10a-2, 10b | `lot-10a1`, `lot-10a2`, `lot-10b` | à réattribuer | remis à jour sur le lot 8, tous leurs tests verts, envoyés sur GitHub |
| mail unique | `lot-5b` | à réattribuer | remis à jour, relu, corrigé, tous ses tests verts, envoyé sur GitHub ; livré éteint |
| 4e — images du carnet | `lot-4e` | programme du PC | construit ; attend ton essai de qualité (partie 7) |

## 7. Ce qui reste d'avant (rien n'est urgent)

- **Lot 4e** (images du carnet un peu plus compressées) : copie le PDF d'un plan chargé dans un dossier à part, donne-moi son chemin et dis « essai qualité » ; je le dépose deux fois sur la copie TEST, tu compares au zoom maximum sur le téléphone (`docs/lot4e-procedure.md`, branche `lot-4e`).
- **Essais sur la copie TEST avant de cocher en production** : « Mails envoyés de plus de 3 mois » et « Anciens indices du carnet » (onglet *Purges*).
- **iPhone** : `docs/essais-iphone.md`, 12 essais, avant la remise de l'appli aux poseurs.
- Les 3 PDF « COMPTE RENDU CHANTIER TEST AUTO » et les mails d'essai du lot 8 dans le compte de TEST : à supprimer quand tu veux.
- Au **prochain bordereau du 403** (plans BAL, n° 108) : refaire le choix 6 du menu de `appli-pc` et ajouter 108 → 108 à sa table.
- `listerPartagesPlans` en production (lecture seule), puis le ménage des partages dans Drive.
- Lot 2 : `demarrerTransition` n'a pas été lancé en production.
- Copie TEST : supprimer les quatre onglets « … (ancienne version …) » ; CHANTIER TEST AUTO est resté à « Terminé ».
- **Planning, avant de commencer** : un numéro pour chaque chantier en cours (colonne E de l'onglet *Chantiers*) ; la note d'information aux salariés avec la direction ; quel compte Google ouvre le Sheet au bureau ; qui lit la boîte du compte de Loué. L'atelier (lot 11.3) et la feuille d'heures ne sont pas construits.
