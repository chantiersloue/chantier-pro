# Lot 13 — La tuile « Notes » de l'accueil, et « Garder pour plus tard » — PLAN COURT

> Plan du 20/11/2026, sur tes deux remarques du 19/11 et ta consigne « plan, puis construction ». **Construit le 20/11/2026**, en autonomie (procédure : `docs/lot13-procedure.md`) ; les choix faits pendant la construction sont dans `DECISIONS.md` (D13-…).
> Pas de critique du plan par un agent séparé (règle d'économie) ; une relecture indépendante du résultat, un tour, parce que le lot touche au brouillon automatique.
> Pages seules pour le brouillon ; une petite retouche du serveur pour les notes. Il vient après le lot 12.

## 1. Tes deux demandes

1. **Notes** : renommer « Notes de chantier » en « Notes » partout. Une tuile « Notes » sur l'accueil, qui ouvre la liste de **toutes les notes que le gars a écrites lui-même**, tous chantiers confondus, avec pour chacune le chantier et la date, et une **case à cocher dans la liste**, sans ouvrir la note. Les notes cochées vont dans une partie « Faites ». Utilisable hors réseau.
2. **Brouillon** : un bouton **« Garder pour plus tard »**, sans jamais casser la protection anti-perte.

## 2. La tuile « Notes » (13a)

**Ce que le gars voit**
- Sur l'accueil, une tuile **« Notes »** (pour tout compte). Elle ouvre **« Mes notes »** : ce qu'il a écrit lui-même dans les listes des chantiers, la plus récente en haut. Sous chaque texte : le chantier et la date.
- **Une grande case à cocher** devant chaque note. Cochée : la note reste barrée trois secondes (un nouvel appui annule), puis descend dans **« Faites (n) »**, repliée en bas. On peut l'y décocher.
- Toucher le nom du chantier ouvre la liste de ce chantier (pour modifier un texte ou ajouter une note).
- **Sans réseau** : la dernière liste reçue s'affiche, avec sa date ; une case cochée est gardée dans le téléphone et part toute seule au retour du réseau, marquée ⏳ en attendant.
- Conducteurs et admin : la même page, plus un bouton **« Les notes de tous les chantiers »** (la vue qu'ils ont aujourd'hui, inchangée).

**Deux façons de faire, comparées**

| Solution | Pour | Contre |
|---|---|---|
| **A. Une page à part, légère (`mes-notes.html`)** (retenue) | la page des notes d'un chantier, qui marche et que les gars connaissent, n'est pas touchée ; peu de programme | une page de plus |
| B. Un troisième mode dans la page des notes d'un chantier | une seule page | cette page gère déjà l'ajout, la modification et la vue des conducteurs : y ajouter un mode, c'est risquer de casser ce qui marche |

**Côté serveur** : la lecture des notes accepte « les miennes ». Le serveur reconnaît l'auteur à l'**identifiant du compte** noté à la création (colonne « Créé par »), jamais à ce que dit le téléphone. Il ne rend que les notes des chantiers que le compte peut encore lire, et pas celles d'un chantier « Terminé ». Cocher et décocher passent par le geste qui existe déjà : aucun droit nouveau.

**Ce qui ne change pas** : la liste d'un chantier (ajout, modification, cases), les chiffres rouges, la vue « tous chantiers » des conducteurs.

## 3. « Garder pour plus tard » (13b)

**Aujourd'hui** : quand on rouvre une fiche qui a un brouillon, un bandeau propose **Restaurer** ou **Repartir à zéro** (qui efface, après confirmation). Si le gars tape sans répondre, le brouillon proposé est « mis de côté » tout seul (5 au plus, 30 jours) et reproposé plus tard. Rien ne lui permet de dire lui-même « je le garde, je fais d'abord une autre fiche ».

**Ce qui change**
- Le bandeau a un troisième bouton : **« Garder pour plus tard »**. Le brouillon est rangé dans les **brouillons gardés** de cette fiche ; la page reste vide pour une autre fiche.
- Sur la fiche, une ligne discrète **« 📝 Brouillons gardés (2) »** apparaît dès qu'il y en a. Elle ouvre la liste : la date, le chantier, **Reprendre** ou **Effacer** (avec confirmation).
- Dans cette liste, un bouton **« Garder la fiche en cours pour plus tard »** : ce qui est à l'écran est rangé, et la fiche repart vide. Quand il n'y a encore aucun brouillon gardé, la même ligne propose directement « 📝 Garder pour plus tard » dès que la fiche contient quelque chose.
- **Reprendre** un brouillon gardé alors que la fiche contient déjà quelque chose : ce qui est à l'écran est d'abord gardé à son tour. Rien n'est jamais écrasé.

**Les règles qui protègent la saisie**
- Un brouillon **gardé exprès** n'est plus reproposé par le bandeau à chaque ouverture (c'était le but : faire autre chose). Il attend dans la liste.
- Un brouillon mis de côté **tout seul** (bandeau resté sans réponse) continue d'être reproposé, comme aujourd'hui.
- **5 brouillons gardés exprès au plus par fiche** : au sixième, la page refuse et dit d'en reprendre ou d'en effacer un. Jamais d'effacement silencieux d'un brouillon gardé exprès. Les brouillons mis de côté tout seuls gardent leur limite (les plus anciens laissent la place), sans jamais pousser dehors un brouillon gardé exprès.
- **30 jours**, comme aujourd'hui : la liste affiche la date limite de chacun.
- Photos et signatures suivent le brouillon, comme aujourd'hui.

**Deux façons de faire, comparées**

| Solution | Pour | Contre |
|---|---|---|
| **A. S'appuyer sur la liste « mis de côté » qui existe** (retenue) | le rangement (deux copies, photos, 30 jours) est déjà éprouvé ; peu de programme nouveau | une liste par sorte de fiche, pas une liste commune |
| B. Un vrai brouillon par chantier | automatique | toute la protection anti-perte à réécrire et à réessayer sur toutes les fiches ; une fiche commencée sans chantier ne saurait pas où aller |

## 4. Les endroits touchés, et les tests

| Où | Quoi |
|---|---|
| Serveur (`apps-script/Notes.gs`) | la lecture « les miennes » |
| `mes-notes.html` (nouvelle), `commun/notes.js`, `index.html`, `sw.js` | la tuile, la page, la liste gardée hors réseau |
| `notes.html`, `index.html`, guide | « Notes de chantier » devient « Notes » |
| `commun/brouillon.js`, `commun/style.css` | le troisième bouton, la ligne « Brouillons gardés », la liste |
| `tests/` | serveur : les miennes seulement, jamais celles d'un autre, chantier retiré ou terminé ; page « Mes notes » dans Chrome (cocher, hors réseau) ; brouillon dans Chrome : garder, reprendre, effacer, limite de 5, rien d'écrasé, et tout ce qui marchait avant |
| `docs/` | procédure, guide des poseurs, journal, décisions |

Une nouvelle version du serveur (lecture « les miennes ») et des pages. La nouvelle page avec l'ancien serveur dit « le serveur n'est pas encore à jour » ; le brouillon ne dépend pas du serveur.

## 5. Ce qui n'est pas dans ce lot

- Ajouter une note depuis « Mes notes » (une note appartient à un chantier : on l'ajoute depuis le chantier).
- Une liste commune des brouillons de toutes les fiches sur l'accueil.
