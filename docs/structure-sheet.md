# Structure du Google Sheet ChantierPro

> Ne mets ici QUE les noms des onglets et des colonnes, jamais de vraies données : ce fichier est public.
> Un exemple complet (avec 2 lignes fictives) est dans `\_prive/exemple-sheet.xlsx`.

## Onglet « Chantiers »

|Colonne|Titre|À quoi ça sert|Exemple fictif|
|-|-|-|-|
|A |NOM|NOM DES CHANTIERS|CHANTIERS TEST 1|
|B|REFERENCE|LIEU DU CHANTIER|LIEU TEST 1|
|C|STATUT|?||
|D|Conducteur|Pré-remplit le champ conducteur des fiches|DUPONT|
|E||||

**Lot 2 (9a)** : colonnes ajoutées après D (titres écrits par `preparerOngletsLot2`) :

|Colonne|Titre|À quoi ça sert|
|-|-|-|
|E|N°|Numéro du chantier (celui des dossiers MEGA)|
|F|Nom court|Utilisé dans le nom des PDF s'il est rempli|
|G|Adresse|Affichée dans « Mes chantiers »|
|H|Client||
|I|Architecte||
|J|Date « Terminé »||
|K|Chemin MEGA|Dossier du chantier dans MEGA|

Statut (C) : liste En préparation / En cours / Terminé (avertissement seulement). Un chantier « Terminé » n'apparaît plus dans « Mes chantiers » des poseurs.

## Onglet « Utilisateurs » (lot 2)

|Colonne|Titre|Rempli par|
|-|-|-|
|A|Identifiant (minuscules, chiffres, - ou _)|Franck|
|B|Nom (liste de l'onglet Contacts)|Franck|
|C|Rôle : Poseur / Conducteur / Atelier / Admin|Franck|
|D|Actif (case)|Franck|
|E|Réinitialiser le mot de passe (case)|Franck coche, l'appli décoche|
|F|Mot de passe provisoire|l'appli (effacé à la première connexion)|
|G|Provisoire valable jusqu'au|l'appli (48 h)|
|H|Déconnecter ses téléphones (case)|Franck coche, l'appli décoche|
|I|Tous les chantiers (case)|Franck|
|J|État|l'appli|

Les empreintes des mots de passe ne sont **pas** dans le Sheet (Propriétés du script, `COMPTE_<identifiant>`).

## Onglet « Accès chantiers » (lot 2)

Ligne 1 : « Chantier », « Remarque (appli) », puis un identifiant de poseur / atelier par colonne. Une ligne par chantier, une case par personne. Lignes et colonnes ajoutées par l'appli, jamais supprimées.

## Onglet « Intervenants » (lot 2, 9a)

Chantier, Nom, Société, Lot / fonction, Mail, Téléphone, Mis à jour le. Vide pour l'instant : la transmission des intervenants par les skills a été abandonnée le 13/11/2026 (D9b-5). La note de réunion (lot 8) laissera ajouter les intervenants à la main.

## Onglets techniques du lot 2

- **Sans compte** : fiches et lectures reçues sans compte pendant la période de transition.
- **Envois**, colonne G **Auteur (compte)**.

## Onglet « Signalements » (lot 7 — créé par `installerLot7Test` / `installerLot7Production`)

Une ligne par signalement, écrite par l'appli. **Seule la colonne M (Statut) se modifie à la main** (liste déroulante).

| Col. | Contenu | Exemple |
|---|---|---|
|A|Numéro (celui de la fiche ; sert à ne jamais écrire deux fois le même)|fiche-…|
|B|Reçu le (heure du serveur)|12/11/2026 14:07|
|C|Chantier| |
|D|Auteur (identifiant du compte, vérifié par le serveur ; vide si « sans compte »)|poseur01|
|E|Auteur (nom affiché)| |
|F|Type : Casse / Manquant / À recommander|Casse|
|G|Urgence : Bloquant / Cette semaine / Pas urgent|Bloquant|
|H|Repère|Porte P12|
|I|Commentaire| |
|J|Photos (nombre ; elles sont dans le PDF)|1|
|K|Atelier prévenu : Oui / Non|Non|
|L|Remarque de l'appli (par exemple : aucun chef d'atelier dans Contacts)| |
|M|**Statut** : À traiter / Commandé / Livré / Clos|À traiter|
|N|Statut modifié par l'appli le| |
|O|Statut modifié par l'appli par| |
|P|Mail à la réception : envoyé / reporté / envoyé et reporté / aucun (« en cours » si le traitement a été coupé avant le mail : le téléphone réessaie)|envoyé|
|Q|Saisi le (date et heure du téléphone)|12/11/2026 14h05|

- Le PDF de chaque signalement est rangé dans le dossier du chantier, sous `05 - CHANTIER/SIGNALEMENTS`.
- Un statut tapé à la main hors de la liste est lu « À traiter » par l'appli. Les colonnes N et O ne parlent que des changements faits dans l'appli.
- Tu peux trier ou filtrer l'onglet : l'appli retrouve chaque signalement par son numéro, pas par sa position.
- Les colonnes de texte (numéro, chantier, auteur, repère, commentaire…) sont au format « texte brut » : un repère « 1/2 » n'y devient pas une date.
- Le chef d'atelier prévenu par la case « Prévenir l'atelier » est le contact (ou les contacts) dont la colonne **ChefAtelier** de l'onglet *Contacts* vaut `O`.

## Onglets « Notes », « Notes historique », « Notes vues » (lot 3 — créés par `installerLot3Test` / `installerLot3Production`)

La liste des choses à faire de chaque chantier. Écrits par l'appli seulement. Tu peux les trier et les filtrer.

**Notes** — une ligne par élément de liste :

| Col. | Contenu |
|---|---|
|A|Numéro (sert à ne jamais écrire deux fois le même élément)|
|B|Chantier (le nom de l'onglet *Chantiers*)|
|C|Texte (une seule ligne)|
|D|Fait : Oui / vide|
|E|Créé le (heure du serveur)|
|F|Créé par : nom (identifiant du compte)|
|G|Texte modifié le|
|H|Texte modifié par (identifiant) : sert au chiffre rouge « nouveau »|
|I|Coché le|
|J|Coché par : nom (identifiant)|

**Notes historique** — le filet de sécurité : une ligne **par geste**, jamais affichée dans l'appli.

| Col. | Contenu |
|---|---|
|A|Le (heure du serveur)|
|B|Numéro de l'élément|
|C|Chantier|
|D|Geste : création / modification / modification en même temps / coché / décoché|
|E|Ancien texte (pour une modification)|
|F|Nouveau texte (création, modification)|
|G|Par (nom)|
|H|Par (identifiant du compte)|

« modification en même temps » : la personne a corrigé un texte que quelqu'un d'autre venait de changer ; sa version a remplacé l'autre, et les deux sont dans cet onglet.

**Notes vues** — la dernière visite de chaque personne sur chaque chantier (pour « nouveau ») : Identifiant, Chantier, Vue le.

- **L'appli ne supprime jamais rien.** Pour faire disparaître pour de bon un élément écrit par erreur : supprime sa ligne dans l'onglet *Notes* (toi seul). Sinon, coche-le.
- **Chantier renommé dans l'onglet *Chantiers*** : sa liste reste sous l'ancien nom. Remplace-le aussi dans la colonne B de l'onglet *Notes* (Édition → Rechercher et remplacer, dans cette feuille seulement).
- Ne modifie rien d'autre à la main dans ces trois onglets.

## Onglet « Installation » (outillage)

Bilan des fonctions d'installation (`installerLot7…`, `controlerInstallationLot2`) : date, lot, environnement, mode, ligne du bilan. Les 50 dernières lignes sont gardées. Peut être supprimé sans risque.

## Onglet « Prise de Cote »

Une ligne par placard relevé, écrite par la fiche « Prise de cotes ». Les titres de la ligne 1 sont anciens et décalés : **c'est la position des colonnes qui compte**.

|Colonne|Contenu|
|-|-|
|A|Référence de la fiche|
|B|Chantier|
|C|Bâtiment|
|D|Auteur|
|E|Date|
|F|N° du logement|
|G|Pièce|
|H|Hauteur de façade (mm)|
|I|Largeur entre plinthes (mm)|
|J|Largeur en haut de façade (mm)|
|K|Longueur de l'aménagement (mm)|
|L|Profondeur de l'aménagement (mm)|
|M|Côté de la penderie|
|N|Hauteur de plinthe (mm)|
|O|Sol|
|P|Socle|
|Q|Commentaires|
|R|Reçu le (heure du serveur)|

Aucun skill ne lit cet onglet (la règle 5 du contrat `docs/contrat-skills.md` a été abandonnée le 13/11/2026).

## Onglet « Dossiers chantiers » (lot 1.5)

Écrit par l'appli : pour chaque chantier, le dossier Drive où elle range ses documents.

|Colonne|Contenu|
|-|-|
|A|Chantier|
|B|Dossier Drive (son nom au moment où l'appli l'a noté)|
|C|Identifiant du dossier (c'est lui qui fait foi pour l'appli)|
|D|Trouvé par : nom exact / ressemblance / créé|
|E|À vérifier : « OUI… » si le dossier a été trouvé par ressemblance|

## Onglet « Fonctions »

|Colonne|Titre|À quoi ça sert|Exemple fictif|
|-|-|-|-|
|A|FONCTIONS|TYPE DE METIERS|ELECTRICIEN|

## Onglet « Types »

|Colonne|Titre|À quoi ça sert|Exemple fictif|
|-|-|-|-|
|A|TYPES|DIFFERNET MODELES DE CYLINDRE OU CLE|PASS GENERA|

## Onglet « Matériaux bordereau » (lot 1, retouche R2 — créé vide par `verifierConfig`)

Une ligne **par matériau** ; le même type est répété sur plusieurs lignes. Une ligne avec seulement la colonne A ajoute un type sans liste.

|Colonne|Titre|À quoi ça sert|Exemple fictif|
|-|-|-|-|
|A|Type|Proposé dans le champ « Type » du bordereau matériaux|KIT POSE FENETRE|
|B|Matériau|Ligne ajoutée à « Matériaux remis » quand ce type est choisi|VIS INOX 4X40|
|C|Quantité|Quantité proposée (modifiable sur le téléphone), telle quelle|20|

Si l'onglet est vide, le champ « Type » propose l'onglet *Materiaux*, comme avant.

## Autres onglets

(Recopie le même tableau pour chaque onglet.)

