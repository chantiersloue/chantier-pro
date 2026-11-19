# Lot 11.1 — Le Sheet « Planning Loué » : procédure d'installation et d'essai

> Pour Franck. Plan : `docs/lot11-1-plan.md`. Mode d'emploi d'une page : `docs/guide-planning.md`.
> **État au 19/11/2026 : construit et testé contre un faux Google seulement** (83 tests, dont un essai de bout en bout avec le vrai serveur de l'appli). **Rien n'est installé chez Google**, aucun Sheet n'existe, aucun mail n'est parti.
> Cette procédure est donc **pour plus tard** : elle commence par les essais que seul Google peut trancher.
> **Ne passe à l'étape suivante que si la précédente est verte.** Sinon : arrête-toi et envoie-moi une capture.

## Ce qui est construit, en clair

Deux programmes, dans le dossier `A-COLLER-PLANNING/` :

| Fichier | Où il va | Ce qu'il fait |
|---|---|---|
| `1-Programme-du-planning.gs` | **dans le Sheet** « Planning Loué » (Extensions → Apps Script) | le menu « Planning Loué », la saisie complétée, les couleurs, *Créer la semaine suivante*, *Ajouter / Retirer un gars*, *Vérifier la semaine*, *Préparer l'affiche A3*. **Il ne peut toucher que ce Sheet** (Google le lui interdit ailleurs) |
| `2-Programme-de-publication.gs` | **à part**, sur script.google.com, dans le compte de Loué | toutes les 10 minutes : le PDF des gars dans le dossier *Planning* de l'appli quand « Publier » est coché ; chaque nuit : la liste des chantiers recopiée de l'appli, les PDF des semaines finies retirés, les vieilles semaines rangées dans *HISTORIQUE* |

Rien ne change dans l'appli : la lecture du planning par l'appli (chantiers mis tout seuls en favoris) est déjà dans le **lot 12**, éteinte tant qu'on ne lui donne pas l'adresse du planning (étape E).

## Ce que j'ai tranché à ta place (tu peux me faire changer d'avis)

1. **Une case par jour, jamais de cases collées.** Un seul chantier = il est seul dans la case. Une journée coupée = tu tapes `901 + 903`, le programme écrit « ½ 901 LES TILLEULS » et « ½ 903 LES LILAS » l'un sous l'autre. Rien ne peut se dérégler, le copier-coller est sans risque. (Les cases collées de la maquette restent possibles plus tard si tu y tiens.)
2. **Semaine suivante** : les chantiers de chacun sont recopiés (tu ne changes que ce qui bouge) ; les absences, congés, école, formation et fériés ne le sont pas ; le véhicule du jour non plus.
3. **Publier** : la case est une demande. Dans les 10 minutes le PDF est dans l'appli, la case se décoche et l'état dit « Publié le 20/11 à 16 h 10 ». Si tu modifies la semaine ensuite, l'état prévient (« les gars voient encore l'ancienne version ») : tu recoches.
4. **Historique** : une semaine reste deux mois dans le Sheet, puis une ligne par gars dans *HISTORIQUE*, effacée au bout de 12 mois.
5. **Atelier** : une case par jour et par gars, jusqu'à 4 tâches l'une sous l'autre, en texte libre (« Huisseries 901, 903 »).
6. **Pas de lignes vides « places libres »** : le menu *Ajouter un gars* le met à sa place alphabétique (20 poseurs et 7 gars d'atelier au plus).

## Étape 0 — les essais que seul Google peut trancher (toi : 30 minutes, avec la maquette ou avec le vrai programme sur un Sheet d'essai)

À faire **avant** de mettre un seul vrai nom dans un Sheet. Crée un Google Sheets vide « Planning Loué TEST », colle le programme 1 (étape A), mets trois faux gars.

| N° | Essai | Ce que tu me dis |
|---|---|---|
| 1 | Tape `901`, puis `901 + 903`, dans une case de pose | la case est-elle complétée en moins de 2 secondes ? Des propositions s'affichent-elles pendant la frappe ? |
| 2 | Copie une case, colle-la sur trois autres | sont-elles complétées et colorées ? |
| 3 | *Créer la semaine suivante* | la nouvelle semaine a-t-elle ses listes, ses couleurs, sa case « Publier » ? |
| 4 | *Préparer l'affiche A3*, puis le lien « Ouvrir le PDF de l'affiche » | le PDF tient-il sur **une** A3 en paysage ? Imprime-le : mesure la hauteur d'une majuscule (attendu : environ 4 mm) |
| 5 | Ouvre le Sheet à deux (toi et un autre compte), tapez en même temps | rien ne se mélange ? |
| 6 | Ouvre le Sheet sur ton téléphone (appli Google Sheets), tape dans une case, coche « Publier » | la saisie est-elle complétée ? (le menu n'existe pas sur téléphone : c'est normal) |
| 7 | Regarde le temps mis par *Vérifier la semaine* | plus de 10 secondes ? |

Si l'essai 4 échoue (le lien ne donne pas un PDF) : Fichier → Imprimer → « Feuille active », A3, paysage, « Ajuster à la page ». C'est la méthode garantie par Google.

## Étape A — le Sheet et son programme (toi : 15 minutes)

1. Avec **le compte Google de Loué** : crée un Google Sheets vide, nomme-le **Planning Loué**.
2. **Extensions → Apps Script.** Efface ce qui est dans `Code.gs`, colle tout `A-COLLER-PLANNING/1-Programme-du-planning.gs`. **Enregistre** (Ctrl+S). Ferme l'onglet de l'éditeur.
3. Recharge le Sheet (F5). Le menu **Planning Loué** apparaît (après quelques secondes) → **Installer le planning (une seule fois)**. Google demande une autorisation : « Google n'a pas validé cette application » → *Paramètres avancés* → *Accéder à … (non sécurisé)* → **Autoriser**. C'est normal pour un programme maison, et il ne demande que le droit sur **ce** Sheet.
4. Relance **Installer le planning**. Tu dois lire trois lignes ✅ : onglet *LISTES*, onglet *SALARIÉS*, première semaine.
5. Onglet ***LISTES*** : remplis les **véhicules** (colonne F) et leur **couleur** (colonne G, un code comme `#FFE0B2` : je te donnerai une liste de couleurs pastel). Ne touche pas aux colonnes A à D : elles sont remplies par le programme de publication.
6. Onglet ***SALARIÉS*** : rien à remplir pour l'instant (le menu *Ajouter un gars* le fait). La colonne D « Compte de l'appli » viendra à l'étape E.
7. **Partage** (bouton *Partager*) : toi et le chef d'atelier en **Éditeur**, la direction en **Lecteur**. **Jamais par lien.** Dans la roue dentée du partage, **décoche** « Les éditeurs peuvent modifier les autorisations et partager » et « Les lecteurs et commentateurs peuvent télécharger, imprimer et copier ».
8. Toi et le chef d'atelier ouvrez le Sheet chacun une fois et acceptez l'autorisation du menu (point 3).

## Étape B — le programme de publication (toi : 20 minutes, avec le compte de Loué)

1. Va sur **script.google.com** (compte de Loué) → **Nouveau projet**. Nomme-le **Planning Loué — publication**.
2. Efface ce qui est dans `Code.gs`, colle tout `A-COLLER-PLANNING/2-Programme-de-publication.gs`. **Enregistre.**
3. Roue dentée **Paramètres du projet** → **Propriétés du script** → ajoute (les identifiants sont dans l'adresse de chaque fichier ou dossier ; je te dirai où les lire, ils sont aussi dans `_prive/`) :

   | Propriété | Valeur |
   |---|---|
   | `PLANNING_ID` | l'identifiant du Sheet « Planning Loué » |
   | `APPLI_SHEET_ID` | l'identifiant du Sheet de l'appli (il ne sera que **lu**) |
   | `DOSSIER_PLANNING_ID` | l'identifiant du dossier Drive *Planning* de l'appli |
   | `DOSSIER_SAUVEGARDE_ID` | (facultatif) un **autre** dossier, où garder une copie de chaque PDF publié |

4. Choisis la fonction **`verifierPublication`** → **Exécuter** → autorise (même écran que plus haut ; ce programme-là demande le droit sur Sheets et Drive, et celui d'appeler une adresse web pour fabriquer le PDF). Ouvre le **Journal d'exécution** : trois lignes ✅ (planning, Sheet de l'appli, dossier), deux ❌ pour les minuteries. Envoie-moi une capture.
5. Fonction **`installerPublication`** → **Exécuter**. Le journal doit maintenant montrer les deux minuteries ✅.
6. Dans le Sheet, onglet *LISTES*, coche la case **« Mettre à jour maintenant »** (N2). Dans les 10 minutes : les colonnes A à D sont remplies, la case N1 dit « à jour du … ».

**Sur la copie TEST d'abord** : fais cette étape une première fois avec « Planning Loué TEST », le Sheet « ChantierPro TEST » et le dossier *Planning* du Drive « CHANTIERPRO-TEST ».

## Étape C — une semaine d'essai (toi : 15 minutes)

1. Menu **Ajouter un gars…** : deux poseurs, un gars d'atelier (de faux noms sur le Sheet TEST).
2. Tape une semaine : `901`, `901 + 903`, `abs`, un véhicule du jour différent le mercredi.
3. Menu **Vérifier la semaine** : « Rien à signaler ».
4. Coche **Publier pour les gars** (B2). Dans les 10 minutes : la case se décoche, l'état dit « Publié le … ».
5. Dans l'appli (copie d'essai), tuile **Planning** : le PDF « Planning S.. du .. au .. » est là. Ouvre-le sur Android **et** sur iPhone : lisible ?
6. Modifie une case : dans les 10 minutes l'état dit « ⚠ Modifié depuis la publication… ». Recoche **Publier** : le PDF est remplacé.
7. Onglet *APPLI* (créé par le programme) : une ligne `SEMAINE`, et des lignes `PLANIFIE` quand la colonne « Compte de l'appli » est remplie (étape E).

## Étape D — deux semaines en double, puis le vrai planning

1. Deux semaines : tu tiens ton Excel **et** le Sheet. Le chef d'atelier sort l'affiche A3 du Sheet.
2. Avant : un numéro pour chaque chantier en cours (colonne E de l'onglet *Chantiers* de l'appli) ; la note d'information aux salariés validée par la direction (chapitre 6 du plan).
3. Ensuite : une seule source, le Sheet.

## Étape E — relier le planning à l'appli (favoris) — seulement quand le lot 12 est en production

1. Onglet *SALARIÉS*, colonne D « Compte de l'appli » : l'identifiant de chaque poseur (celui de l'onglet *Utilisateurs* de l'appli). Colonne verrouillée : toi seul.
2. Éditeur Apps Script **de l'appli** → Propriétés du script → ajoute `PLANNING_SHEET_ID` = l'identifiant du Sheet « Planning Loué ». **Sur la copie TEST d'abord** : on vérifie que Google ne redemande aucune autorisation (sinon je te le dis avant la production).
3. À la publication suivante, les chantiers planifiés arrivent dans « Mes chantiers » des gars (dans les 30 minutes).

## Retour arrière

- **Tout arrêter** : dans le projet « Planning Loué — publication », fonction **`arreterPublication`** → Exécuter. Plus rien ne tourne ; les PDF déjà dans le dossier *Planning* y restent (tu les retires à la main).
- **Côté appli** : supprimer la propriété `PLANNING_SHEET_ID` : l'appli ne lit plus le planning.
- Le Sheet lui-même reste lisible sans aucun programme : c'est un tableau ordinaire.

## Ce qui n'a pas été vérifié

- **Tout ce qui dépend du vrai Google** : l'adresse d'export en PDF (non garantie par Google : le programme a un repli par la méthode officielle, moins bien cadrée), la taille réelle du texte sur une A3, le temps d'un passage, la complétion pendant une saisie rapide, le comportement sur téléphone, les listes de choix « avertissement seulement ».
- **Les couleurs et la mise en page** : mon faux Google note les couleurs demandées, il ne dessine rien. À regarder de tes yeux à l'étape 0.
- **L'affiche** : les mesures sont calculées (largeur des lettres estimée) ; à mesurer sur une vraie impression.
- **Une relecture par un agent indépendant** : prévue avec le lot 14 (absences), avant toute installation.
