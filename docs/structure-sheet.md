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

## Onglet « Fonctions »

|Colonne|Titre|À quoi ça sert|Exemple fictif|
|-|-|-|-|
|A|FONCTIONS|TYPE DE METIERS|ELECTRICIEN|

## Onglet « Types »

|Colonne|Titre|À quoi ça sert|Exemple fictif|
|-|-|-|-|
|A|TYPES|DIFFERNET MODELES DE CYLINDRE OU CLE|PASS GENERA|

## Autres onglets

(Recopie le même tableau pour chaque onglet.)

