# Lot 11.1 — Le Sheet « Planning Loué » — PLAN PROPOSÉ

> Plan du 18/11/2026, **version 1, pas encore critiquée par un agent indépendant. Rien n'est construit.**
> D'après l'étude du lot 11 et tes réponses du 18/11 (accord de la direction et du chef d'atelier donné). La maquette de démonstration et l'étude sont dans `_prive\` (hors du dépôt public). Tous les exemples d'ici sont inventés.

## 1. Le but

Remplacer l'onglet de planning de ton fichier Excel par un **Google Sheets à part, « Planning Loué »**, où :
- il y a **une ligne par gars** (12 à la pose et 8 places libres, 4 à l'atelier et 3 places libres), du lundi au vendredi ;
- le chantier se choisit dans une **liste « N° NOM »** (« 901 LES TILLEULS »), avec des propositions dès qu'on tape ; les autres cas (Congés, École, Formation, Férié, Arrêt…) sont dans la même liste ; plus de saisie libre ;
- **un seul chantier dans la journée prend toute la case** ; une journée coupée montre ses quarts (jusqu'à 4 chantiers) ;
- pour l'atelier : **un titre de tâche**, et en dessous les chantiers concernés ;
- **le véhicule** de chaque gars est dans le planning ;
- un menu **« Planning Loué »** donne : *Créer la semaine suivante*, *Couper la journée*, *Imprimer l'affiche de l'atelier*, *Publier pour les gars*.

Ce lot ne touche ni aux heures, ni à la paie, ni aux onglets de commandes de l'atelier (lots 11.3 à 11.6).

## 2. Ce que tu verras

**Un onglet par semaine**, nommé « 2026-S48 ». Colonnes : Véhicule, Nom, puis les cinq jours. Chaque gars a un bloc de 4 petites lignes (les 4 quarts de la journée) :

| Tu veux | Tu fais | La case devient |
|---|---|---|
| un chantier toute la journée | tu choisis le chantier dans la case | une grande case, en gros |
| couper la journée | menu *Couper la journée* → « en 2 », « ¼ + ¾ », « ¾ + ¼ », « en 4 »… | 2 à 4 cases, chacune avec sa liste |
| revenir à la journée entière | menu *Journée entière* | une grande case |

La couleur suit le chantier choisi. « Arrêt » est en rouge.

**Les quatre commandes du menu**

| Commande | Ce qu'elle fait |
|---|---|
| **Créer la semaine suivante** | recopie la semaine affichée dans un nouvel onglet (tu ne changes que ce qui bouge) ; les jours fériés connus sont pré-remplis |
| **Couper la journée / Journée entière** | découpe ou recolle la case choisie |
| **Imprimer l'affiche de l'atelier** | fabrique un PDF d'**une page A4 en largeur**, gros caractères, et l'ouvre : il reste à cliquer sur Imprimer |
| **Publier pour les gars** | fabrique le PDF de la semaine et le dépose dans le dossier *Planning* du Drive de l'appli ; la tuile Planning le montre aux comptes de l'appli |

Sur l'affiche et dans le PDF publié, **« Arrêt » est écrit « Absent »**. Ils sont fabriqués à partir d'une copie où le mot est déjà remplacé : il n'y est pas caché, il n'y est pas.

**Deux autres onglets** : *Listes* (chantiers recopiés tout seuls depuis l'onglet *Chantiers* de l'appli, autres cas, véhicules, tâches d'atelier) et *Salariés* (prénom affiché, pose ou atelier, actif).

## 3. Les choix techniques (deux solutions au moins à chaque fois)

**3.1 Où vit le programme du planning**

| Solution | Pour | Contre | Retenue ? |
|---|---|---|---|
| **Un petit programme attaché au Sheet du planning** (Apps Script « lié au document » : il s'ouvre par Extensions → Apps Script, depuis le Sheet) | un menu dans le Sheet ; aucune adresse de déploiement ; rien à changer dans le serveur de l'appli | un second programme à coller (une fois par mise à jour) | **oui** |
| Dans le serveur de l'appli | un seul programme | pas de menu dans le Sheet ; chaque retouche du planning obligerait à redéployer l'appli | non |

Gratuit. Le Sheet doit appartenir au **compte Google de Loué** (celui de l'appli), pour que « Publier » puisse écrire dans le dossier *Planning*.

**3.2 Comment montrer « un seul chantier = toute la case »**

| Solution | Pour | Contre | Retenue ? |
|---|---|---|---|
| **A. Des cases collées et décollées par le menu** (la case entière est une vraie grande case) | exactement ta demande ; se lit d'un coup d'œil ; l'affiche est le même dessin | les cases collées supportent mal un copier-coller fait de travers : il faut une commande *Vérifier la semaine* qui répare | **oui** |
| B. Quatre lignes jamais collées ; une ligne vide « continue » celle du dessus ; seules l'affiche et le PDF montrent les grandes cases | rien ne peut se dérégler | dans le Sheet, un chantier seul reste écrit en petit sur la première ligne : pas ce que tu demandes | non |

**3.3 La liste « N° NOM »**

| Solution | Pour | Contre | Retenue ? |
|---|---|---|---|
| **Recopie par le programme** depuis l'onglet *Chantiers* de l'appli (chaque nuit, et par le menu) | pas de panne silencieuse ; un chantier terminé sort de la liste mais reste écrit dans les semaines passées | une autorisation de plus à donner au programme | **oui** |
| Une formule `IMPORTRANGE` | une ligne à écrire | casse sans prévenir si une autorisation saute | non |

Condition : chaque chantier en cours a son **numéro** dans l'onglet *Chantiers* (colonne E). L'identifiant du Sheet de l'appli est rangé dans les réglages du programme, jamais dans le dépôt.

**3.4 Fabriquer l'affiche et le PDF**

| Solution | Pour | Contre | Retenue ? |
|---|---|---|---|
| **Le programme dessine la page dans un classeur provisoire, l'exporte en PDF, puis jette le classeur** | la page ne contient que ce qu'on veut montrer (« Absent », pas « Arrêt ») ; mise en page maîtrisée | à vérifier dans la documentation de Google avant de construire (export PDF d'un classeur, réglages de page) | **oui, sous réserve** |
| Imprimer l'onglet de travail tel quel | rien à programmer | « Arrêt » serait imprimé ; les lignes libres aussi ; réglages d'impression à refaire | non |

À dire clairement : un programme Google **ne peut pas lancer l'imprimante**. « Un bouton » veut dire : un clic fabrique et ouvre le PDF, un second clic l'imprime.

**3.5 « Publier » et l'appli**

Le PDF est déposé dans le dossier *Planning* du Drive de l'appli (un fichier par semaine, remplacé à chaque publication). **Il faut que le lot 5c soit en production** : c'est lui qui réserve la lecture du planning aux comptes de l'appli et retire tout partage par lien. Aucune page de l'appli ne change dans ce lot.

## 4. Les endroits touchés

| Où | Quoi |
|---|---|
| Un nouveau Google Sheets « Planning Loué » (et sa copie « Planning Loué TEST ») | onglets *Listes*, *Salariés*, modèle de semaine |
| `planning/` dans le dépôt (nouveau dossier) | le programme attaché au Sheet (un fichier à coller), sans aucun nom ni identifiant |
| `tests/` | les règles pures (découpage d'une journée, remplacement « Arrêt » → « Absent », nom du fichier publié) testées sans Google |
| `docs/` | procédure pas à pas, guide d'une page pour toi et le chef d'atelier, journal |
| Serveur et pages de l'appli | **rien** |

## 5. Risques et parades

| Risque | Parade |
|---|---|
| « Arrêt » sort sur l'affiche ou dans le PDF | la page est fabriquée depuis une copie déjà remplacée ; un test le vérifie ; le programme refuse de publier s'il trouve le mot dans la page finale |
| Toute personne qui ouvre le Sheet y lit « Arrêt » | ta question 1 ci-dessous ; partage nominatif seulement, jamais « toute personne qui a le lien » |
| Cases déréglées par un copier-coller | *Vérifier la semaine* (lancée aussi avant chaque publication) : répare ce qui se répare, liste le reste |
| Une semaine publiée par erreur | *Publier* demande confirmation et affiche la semaine ; republier remplace le fichier |
| Chantier absent de la liste (pas de numéro) | une entrée « SAV / divers » ; la liste dit quels chantiers de l'appli n'ont pas de numéro |
| Double saisie pendant le passage | deux semaines en double avec ton Excel, puis une seule source |
| Perte du planning | historique des versions de Google ; à chaque publication, une copie Excel de la semaine dans le Drive (donc sur ton PC) |
| Programme collé au mauvais endroit | la procédure montre chaque clic ; le programme dit sa version dans le menu |

## 6. Tests et essais

- **Sans Google** : découpage et recollage d'une journée (toutes les formes), « Arrêt » jamais dans une sortie, semaine suivante (dates, fériés), liste des chantiers (statuts, sans numéro, doublons).
- **Sur « Planning Loué TEST »** (faux gars) : les commandes du menu une à une ; l'affiche imprimée ; le PDF publié dans le dossier *Planning* de la copie TEST et ouvert dans l'appli d'essai avec un compte, puis sans.
- **Avec toi** : deux semaines saisies en double ; l'affiche collée à l'atelier (lisible de loin ?) ; le chef d'atelier saisit ses lignes.
- Relecture par un agent indépendant : oui (données de salariés, publication).

## 7. Découpage

| Lot | Contenu | Dépend de |
|---|---|---|
| **11.1a** | le Sheet, les listes, le modèle de semaine, *Créer la semaine suivante*, *Couper la journée*, *Vérifier la semaine*, *Imprimer l'affiche* | rien |
| **11.1b** | *Publier pour les gars* | le lot 5c en production |

## 8. Tes questions (réponds par le numéro)

1. **« Arrêt » dans le Sheet** : le chef d'atelier (qui modifie ses lignes) et la direction (qui lit) le verront. Trois possibilités : **(a)** c'est accepté par la direction ; **(b)** tu choisis « Absent » dans le planning et tu notes le motif ailleurs, pour toi seul ; **(c)** le chef d'atelier travaille dans un Sheet à lui, que le planning recopie. Je recommande (a) ou (b) ; (c) est plus lourd.
2. **Véhicule** : un par gars pour la semaine, ou peut-il changer d'un jour à l'autre ?
3. **Atelier** : une tâche par jour et par gars, ou parfois deux (matin et après-midi) ?
4. **Affiche** : A4 suffit-il, ou as-tu une imprimante A3 ? (16 gars sur une page A4 : les journées entières se lisent de loin, les quarts de journée de près.)
5. **Couleurs par chantier** : oui ou non ?
6. **Noms affichés** : prénom seul, ou prénom et initiale du nom ?
7. **Chantier sans numéro** (petit dépannage) : une entrée « SAV / divers » te suffit-elle ?
8. **Qui modifie** : toi et le chef d'atelier ; la direction en lecture. D'accord ?
9. **Le PDF publié** : seulement la semaine en cours, ou aussi la suivante dès qu'elle est prête ?
10. **Semaines passées** : gardées deux mois dans le Sheet, puis rangées dans un onglet « Historique » : d'accord ?

## 9. Ce que tu auras à faire

| Quand | Quoi | Durée |
|---|---|---|
| Maintenant | regarder la maquette, répondre aux 10 questions | 20 min |
| Avant | donner un numéro à chaque chantier en cours dans l'onglet *Chantiers* (colonne E) ; retirer le mot de santé de ton fichier Excel actuel | 15 min |
| 11.1a | créer le Sheet (import d'un fichier que je te donne), coller le programme, l'autoriser, saisir tes gars ; deux semaines en double | 45 min, puis 10 min par semaine |
| 11.1b | publier une semaine ; l'ouvrir sur Android et iPhone | 15 min |

Après tes réponses : je fais critiquer ce plan par un agent indépendant, je le corrige, puis je construis sur une branche à part, contre de faux gars.
