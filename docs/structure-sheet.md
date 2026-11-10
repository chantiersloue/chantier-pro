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

