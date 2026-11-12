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

Chantier, Nom, Société, Lot / fonction, Mail, Téléphone, Mis à jour le. Rempli par le skill `gestion-documentaire` (contrat 9b, plus tard).

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
|P|Mail à la réception : envoyé / reporté / envoyé et reporté / aucun|envoyé|
|Q|Saisi le (date et heure du téléphone)|12/11/2026 14h05|

- Le PDF de chaque signalement est rangé dans le dossier du chantier, sous `05 - CHANTIER/SIGNALEMENTS`.
- Un statut tapé à la main hors de la liste est lu « À traiter » par l'appli. Les colonnes N et O ne parlent que des changements faits dans l'appli.
- Tu peux trier ou filtrer l'onglet : l'appli retrouve chaque signalement par son numéro, pas par sa position.
- Le chef d'atelier prévenu par la case « Prévenir l'atelier » est le contact (ou les contacts) dont la colonne **ChefAtelier** de l'onglet *Contacts* vaut `O`.

## Onglet « Installation » (outillage)

Bilan des fonctions d'installation (`installerLot7…`, `controlerInstallationLot2`) : date, lot, environnement, mode, ligne du bilan. Les 50 dernières lignes sont gardées. Peut être supprimé sans risque.

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

