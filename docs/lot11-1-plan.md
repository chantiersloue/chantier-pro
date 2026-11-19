# Lot 11.1 — Le Sheet « Planning Loué » — PLAN

> Plan du 18/11/2026, **version 3** : tes décisions du 18/11 au soir (chapitre 2), puis **corrigé après une critique indépendante** (un tour ; ce qu'elle a changé : chapitre 11). **Ajout du 19/11 : les chantiers du planning ouverts tout seuls dans l'appli et mis en favoris (chapitre 13, lot 11.1d).** **Rien n'est construit**, sauf une maquette de démonstration avec de faux noms, sans lien avec l'appli.
> L'étude et la maquette sont dans `_prive\` (hors du dépôt public). Tous les exemples d'ici sont inventés.

## 1. Le but

Remplacer l'onglet de planning de ton fichier Excel par un **Google Sheets à part, « Planning Loué »**, tenu par toi et par le chef d'atelier, lu par la direction, et d'où sortent **l'affiche de l'atelier** (A3) et **le PDF des gars** dans l'appli.

Ce plan couvre le planning (lots 11.1). Les onglets de l'atelier sont le lot 11.3 (chapitre 8). La feuille d'heures (lots 11.4 à 11.6) n'est pas dans ce plan.

## 2. Tes décisions (18/11/2026)

| Sujet | Ta décision |
|---|---|
| Absences | **« Absent » pour tout le monde dans le planning.** Le motif reste au bureau, sur papier. Aucun mot de santé dans le Sheet |
| Autres cas | les vraies appellations : Congés, École, Formation, Férié, Atelier, Bureau, SAV / divers |
| Saisie | liste « N° NOM » avec propositions, **et saisie libre acceptée** : au plus un avertissement, jamais un refus |
| Journée | quarts de journée ; **un seul chantier dans la journée prend toute la case** |
| Noms | **prénom et initiale du nom**, par ordre alphabétique |
| Couleurs | **par véhicule** (pastel) |
| Véhicule | il reste dans le planning ; **il peut changer dans la semaine** |
| Atelier | **jusqu'à 4 tâches par jour et par gars**, chacune avec ses chantiers |
| Effectif | pose : 12 gars, 8 places libres ; atelier : 4 gars, 3 places libres ; jamais de samedi |
| Affiche de l'atelier | **une seule A3 en paysage**, pose et atelier ensemble (impératif) : un onglet d'impression à part, compact, avec le texte le plus gros possible (4.5) |
| PDF publié | **la semaine en cours et la suivante** dès qu'elle est prête ; tous les poseurs voient tout ; **même présentation que l'affiche compacte** (une page par semaine, décision du 18/11 au soir) |
| Qui fait quoi | toi et le chef d'atelier modifiez ; la direction lit |
| Semaines passées | deux mois dans le Sheet, puis un onglet « Historique » |
| Mails | aucun en plus |
| Accès et favoris (19/11) | un gars planifié sur un chantier y a accès tout seul dans l'appli, et le chantier passe en favori en tête de sa liste (chapitre 13) |

## 3. Ce que tu verras

**Un onglet par semaine** (« 2026-S48 »). Colonnes : Véhicule de la semaine, Nom, puis lundi à vendredi.

**Un gars de la pose** = un bloc de 4 petites lignes (les 4 quarts de la journée), plus une ligne fine « véhicule du jour ».

| Tu veux | Tu fais | Résultat |
|---|---|---|
| un chantier toute la journée | tu tapes « 901 » dans la case, Entrée | « 901 LES TILLEULS », en gros, sur toute la hauteur |
| autre chose que la liste | tu tapes « Mr DUPONT » | accepté tel quel (petit triangle d'avertissement de Google) |
| couper la journée | menu *Couper la journée* : en 2, ¼ + ¾, ¾ + ¼, en 3 (½ + ¼ + ¼), en 4 | 2 à 4 cases, chacune avec sa liste |
| revenir à la journée entière | menu *Journée entière* | une grande case |
| changer de véhicule un jour | tu choisis le véhicule dans la ligne fine de ce jour-là | la case de ce jour prend la couleur de ce véhicule |

**Un gars de l'atelier** = 4 tâches possibles par jour ; pour chacune, une ligne « tâche » et une ligne « chantiers ».

**Les commandes** (menu « Planning Loué », et boutons en haut de l'onglet) :

| Commande | Ce qu'elle fait | Ce qu'elle ne fait pas |
|---|---|---|
| **Créer la semaine suivante** | recopie la semaine dans un nouvel onglet (gars, véhicules, couleurs), dates mises à jour | — |
| **Ajouter un gars / Retirer un gars** | garde l'ordre alphabétique sans dérégler les blocs | — |
| **Vérifier la semaine** | répare les cases déréglées, liste les valeurs hors liste et les mots à éviter | ne bloque jamais ta saisie |
| **Préparer l'affiche A3** | fabrique l'onglet « AFFICHE A3 » (une ligne par gars) et donne le lien qui ouvre son PDF | ne lance pas l'imprimante : un clic ouvre le PDF, un second l'imprime ; à refaire après un changement du planning |
| **Publier pour les gars** | tu coches « Publier » ; dans les 10 minutes, le PDF de cette semaine est dans l'appli ; la case d'état l'écrit (« Publié le 20/11 à 16 h 10 ») | pas de fenêtre de confirmation : pour annuler, tu décoches avant |

## 4. Les choix techniques

**4.1 Où vivent les programmes**

| Programme | Où | Il fait | Qui peut le modifier |
|---|---|---|---|
| **Le programme du planning** | attaché au Sheet (Extensions → Apps Script) | le menu, les découpages, la complétion, la semaine suivante, les vérifications. **Il ne touche que ce Sheet** | toute personne qui peut modifier le Sheet (c'est une règle de Google) |
| **Le programme de publication** | à part, dans le compte Google de Loué, invisible depuis le Sheet | toutes les 10 minutes : si « Publier » est coché, il dépose le PDF dans le dossier *Planning* de l'appli ; chaque nuit, il recopie la liste des chantiers | le compte de Loué seulement |

Pourquoi deux programmes : la critique a montré qu'un programme attaché au Sheet et lancé avec les droits du compte de Loué pourrait être modifié depuis un compte personnel (le tien, celui du chef d'atelier, ou celui d'un pirate), et agirait alors **avec les droits de Loué sur tout le Drive de l'appli**. Séparés, le programme que vous pouvez modifier n'a aucun droit hors du Sheet.

Solutions écartées : tout dans le serveur de l'appli (chaque retouche du planning obligerait à redéployer l'appli) ; partager le Drive de l'appli avec vos comptes personnels.

**Coût sur les 90 minutes par jour du compte de Loué** (partagées avec l'appli) : 144 passages par jour d'une à deux secondes quand rien n'est coché, soit **2 à 5 minutes par jour**. À mesurer sur la copie TEST ; si c'est trop, un passage toutes les 30 minutes.

**4.2 « Un seul chantier = toute la case »**

| Solution | Pour | Contre |
|---|---|---|
| **A. Des cases collées et décollées par le menu** (celle de la maquette) | exactement ta demande ; les quarts se voient à la hauteur ; une liste par morceau | Google ne garantit rien sur les cases collées : un copier-coller, un tri ou deux personnes en même temps peuvent dérégler un bloc. Il faut *Vérifier la semaine*, *Ajouter / Retirer un gars*, et une liste fermée de découpages |
| **C. Une seule case par jour, jamais collée** ; pour une journée coupée, les chantiers sont écrits l'un sous l'autre dans la même case | rien ne peut se dérégler ; copier-coller sans risque ; programme trois fois plus court | la liste et ses propositions ne valent que pour le premier chantier de la case ; les parts (¼, ½) s'écrivent en clair au lieu de se voir |
| B. Quatre lignes jamais collées | simple | un chantier seul reste écrit en petit : pas ta demande |

**Je recommande d'essayer A sur la maquette**, en la maltraitant exprès (copier-coller, glisser une case sur une autre). Si elle se dérègle trop facilement, on construit C. C'est ta question 2.

**4.3 La saisie**

- Liste déroulante de Google « depuis une plage », réglée sur « afficher un avertissement » : la saisie libre est acceptée. C'est un réglage documenté par Google.
- **Propositions pendant la frappe** : la page d'aide de Google n'en dit rien. **Seul ton essai sur la maquette le dira.**
- En plus, complétion par le programme : « 901 » + Entrée → « 901 LES TILLEULS » (le numéro exact d'abord, sinon le seul chantier qui commence ainsi).
- Limite à connaître : Google ne garde que les deux dernières modifications en attente. En saisie très rapide ou sur un collage, une complétion peut sauter : *Vérifier la semaine* la rattrape.
- En secours, si les propositions de Google ne te conviennent pas : un panneau de recherche sur le côté.

**4.4 La liste « N° NOM »** : recopiée chaque nuit par le programme de publication depuis l'onglet *Chantiers* de l'appli (une formule `IMPORTRANGE` casserait sans prévenir). La liste affiche « à jour du … ». Condition : un numéro pour chaque chantier en cours (colonne E).

**4.5 L'affiche A3 et le PDF : aucune méthode garantie par Google**

La critique l'a vérifié : la seule méthode officielle (`getAs`) exporte **tout le classeur**, sans choix de l'onglet, du papier ni du sens. L'adresse d'export « onglet par onglet » que tout le monde utilise **n'est décrite sur aucune page officielle** : elle marche aujourd'hui, Google peut la changer sans prévenir.

| Sortie | Solution retenue | Repli garanti |
|---|---|---|
| Affiche | un **lien** vers cette adresse d'export, ouvert par ton navigateur (aucun programme, aucune autorisation) | Fichier → Imprimer → « Feuille active », A3 : documenté par Google |
| PDF publié | le programme de publication fabrique lui-même l'affiche compacte de chaque semaine publiée dans un classeur provisoire (il ne dépend pas de l'onglet « AFFICHE A3 », qui peut être en retard sur le planning) et l'exporte | tu télécharges le PDF (Fichier → Télécharger) et tu le déposes dans le dossier *Planning*, comme aujourd'hui |

**Ces deux exports sont le tout premier essai à faire chez Google, avant de construire** (lot 11.1-0).

**L'affiche : une seule A3 en paysage, pose et atelier ensemble** (décision de Franck du 18/11/2026 au soir, impérative). Le planning où tu travailles ne change pas : la commande « Préparer l'affiche A3 » fabrique un **onglet d'impression à part**, « AFFICHE A3 », refait à chaque fois. Une ligne par gars, les places libres absentes ; chantier en « N° + nom court » (colonne facultative « Nom court » dans LISTES) ; quarts de journée dans la même case (« ½ 901 Tilleuls / ½ 903 Lilas ») ; case de la couleur du véhicule du jour, avec une marque courte quand il diffère de celui de la semaine (« [Pla.] ») ; atelier : « Huisseries 901, 903 ». Le programme règle seul largeurs, hauteurs et taille du texte pour remplir la feuille : **environ 16 points (majuscule de 4,1 mm) pour 12 poseurs et 4 gars d'atelier ; environ 12 points (3,1 mm) dans le pire cas, 20 + 7**. Ces tailles sont calculées (largeur des lettres estimée) et vues sur deux aperçus dessinés sur le PC ; **elles restent à mesurer sur une vraie A3 sortie de Google** (essai du lot 11.1-0). À savoir : l'affiche n'est pas reliée au planning par des formules, il faut la préparer de nouveau après un changement ; une journée coupée en quatre ou un nom court trop long font baisser la taille pour tout le monde.

**4.6 « Publier » et l'appli**

- Il faut le **lot 5c en production** (lecture du planning réservée aux comptes).
- Un fichier par semaine, au nom clair : « Planning S48 du 23 au 27-11 ». Republier remplace le fichier (l'ancien part à la corbeille).
- Le programme ne retire que **les fichiers qu'il a lui-même déposés** (il les marque), jamais un fichier que tu as mis à la main ; il les met à la corbeille, il ne supprime rien.
- La semaine suivante n'apparaît que si tu l'as publiée. Les semaines terminées sont retirées le lundi.
- La copie de sauvegarde (Excel) va dans un **autre dossier** du Drive, pas dans *Planning* (elle y serait montrée aux poseurs).

## 5. Les endroits touchés

| Où | Quoi |
|---|---|
| Un nouveau Google Sheets « Planning Loué », et « Planning Loué TEST » avec de faux gars | onglets *Listes*, *Salariés*, semaines, *Historique* |
| `planning/` dans le dépôt (nouveau dossier) | les deux programmes, sans aucun nom ni identifiant |
| `tests/` | les règles testées sans Google : découpages, complétion, semaine suivante (2026 a 53 semaines), noms des fichiers publiés |
| `docs/` | procédure pas à pas, guide d'une page pour toi et le chef d'atelier, journal |
| Serveur et pages de l'appli | **rien jusqu'au lot 11.1c** ; au lot 11.1d : le serveur (lecture du planning, onglets *Accès chantiers* et *Planifiés*) et la page d'accueil (favoris) |

## 6. Données personnelles (prénoms, initiales, absences)

- **Partage nominatif à trois personnes** ; jamais par lien. À décocher dans le partage : « les éditeurs peuvent modifier les autorisations » et « les lecteurs peuvent télécharger, imprimer, copier ».
- **Information des salariés** : une note courte (ce qui est noté, qui le lit, combien de temps). À faire valider par la direction.
- **Durée de l'« Historique »** : je propose **12 mois**, puis effacement par le programme de publication. C'est ta question 6.
- **Mots de santé** : ils ne sont pas dans la liste, mais la saisie libre les permet. Le programme colore en rouge, dès la saisie, une case qui contient un mot à éviter (arrêt, malade, maladie, accident, hôpital, médecin…), sauf si c'est un nom de la liste. **C'est un filet, pas une garantie** : la vraie règle est de ne jamais l'écrire. À savoir : l'historique des versions de Google garde ce qui a été tapé, même effacé.
- **Autorisation** : toi et le chef d'atelier verrez chacun, une fois, l'écran « Google n'a pas validé cette application » pour vous servir du menu. C'est normal pour un programme maison.
- Les messages d'échec du programme de publication arrivent dans la boîte du compte de Loué : il faut que quelqu'un la lise.

## 7. Risques et parades

| Risque | Parade |
|---|---|
| L'adresse d'export de Google change | les replis du 4.5 ; l'essai du lot 11.1-0 |
| Cases déréglées (solution A) | *Vérifier la semaine* ; liste fermée de découpages ; sinon solution C |
| Deux personnes en même temps | chacun ses lignes (pose, atelier) ; les commandes qui déplacent des lignes passent par un verrou |
| Une absence recopiée par erreur dans la semaine suivante | à la création, les cases « Absent », « Congés », « École », « Formation », « Férié » sont vidées ou mises en couleur (ta question 4) |
| Une semaine publiée par erreur | décocher dans les 10 minutes ; republier remplace |
| Liste des chantiers pas à jour | la liste dit « à jour du … » ; commande *Mettre à jour la liste* |
| Double saisie pendant le passage | deux semaines en double avec ton Excel, puis une seule source |
| Perte du planning | historique des versions de Google ; une copie Excel par semaine publiée |

## 8. L'atelier (lot 11.3) : ce que tes réponses fixent, et ce que la critique ajoute

Quatre onglets, dans le même Sheet : **PRÉVISION ATELIER**, **CDE EN ATTENTE**, **COMMANDES**, **CDE REÇUES**.

| Ta demande | Comment | Précaution ajoutée par la critique |
|---|---|---|
| Commandes triées par date | tri par le programme | **pas pendant la frappe** : la ligne partirait sous le curseur. Tri quand la date change, à l'ouverture, et la nuit |
| « N° BL » ; « Reçu » en case à cocher qui grise la ligne et date toute seule | case à cocher + programme | sur un collage de plusieurs lignes, toutes sont traitées |
| Livraison = semaine de l'ARC, tapée à la main ; rouge une fois dépassée | calcul du retard seulement | l'année de la semaine est déduite de la date de commande (passage d'année) |
| Rangement des reçues tous les 15 jours | programme de publication, **la nuit** | seulement les lignes reçues depuis 15 jours, sans reliquat |
| « Commandé » fait passer la ligne dans les commandes | programme | déplacement sous verrou |
| La fabrication propose les commandes, sans doublon | table de règles dans *Listes* | un **numéro de fabrication visible**, donné sous verrou ; la proposition est créée quand la ligne a son chantier, son type et sa quantité ; une proposition corrigée à la main n'est plus écrasée ; commande *Vérifier l'atelier* (doublons, commandes sans ligne de fabrication) |
| État des commandes sur la ligne de fabrication | écrit par le programme | — |
| Option « à commander avant le … » | semaine de fabrication − délai du fournisseur | à valider sur la maquette |

**Ce que ça coûte sur les 90 minutes** : le rangement de quinzaine, une dizaine de secondes toutes les deux semaines, sur le compte de Loué : négligeable. Les gestes du chef d'atelier (cocher, trier) sont comptés par Google, sur le compte de celui qui les fait d'après ce que j'ai pu lire (la page ne le dit pas clairement) : 150 gestes d'une à deux secondes font moins de 5 minutes par jour. À mesurer.

Le lot 11.3 est trop gros pour une seule livraison : **11.3a** les commandes ; **11.3b** les commandes en attente et « la fabrication propose » ; **11.3c** le retour d'état et l'option.

## 9. Tests, essais, découpage

| Lot | Contenu | Dépend de |
|---|---|---|
| **11.1-0** | **les essais chez Google, sur la maquette** (chapitre 10) : aucune construction | rien |
| **11.1a** | le Sheet, les listes, la semaine, *Couper la journée*, *Créer la semaine suivante*, *Ajouter / Retirer un gars*, *Vérifier la semaine* | 11.1-0 |
| **11.1b** | l'affiche A3 | 11.1a |
| **11.1c** | le programme de publication : *Publier*, liste des chantiers chaque nuit, *Historique* | le lot 5c en production |
| **11.1d** | les chantiers du planning ouverts tout seuls dans l'appli, et en favoris (chapitre 13) : d'abord les accès, puis les favoris | 11.1a et 11.1c ; le serveur de l'appli à jour |
| **11.3a, b, c** | l'atelier | 11.1a |

Tests sans Google : découpages, complétion, semaine suivante (S53 puis 2027-S01), noms de fichiers, règles de l'atelier. Sur « Planning Loué TEST » : chaque commande ; deux personnes en même temps ; collage de plusieurs cases ; saisie rapide ; une case cochée depuis l'appli Sheets du téléphone ; publication demandée par le compte du chef d'atelier ; panne de la recopie de nuit. Relecture par un agent indépendant : oui.

## 10. Les essais que seul Google peut trancher (lot 11.1-0, sur la maquette)

1. Des propositions s'affichent-elles pendant la frappe ? Que valide Entrée ?
2. Une liste de choix sur une case collée, puis décollée.
3. Ce que garde la copie d'un onglet (listes, cases collées, couleurs, cases à cocher).
4. Le lien d'export : l'onglet « AFFICHE A3 » seul, sur **une** A3 en paysage, ajusté à la page ; la hauteur d'une majuscule mesurée sur le papier (attendu : 4 mm pour une semaine ordinaire).
5. Copier-coller et glisser-déposer d'une case collée sur une autre découpée autrement.
6. Deux personnes dans le même onglet.
7. Le menu et les cases à cocher depuis un téléphone.
8. Le temps d'un passage du programme, et le total d'une journée de saisie.
9. Le PDF A4 lu sur Android et sur iPhone.

## 11. Ce que la critique indépendante a changé (18/11)

| Constat | Correction |
|---|---|
| Aucune méthode officielle n'exporte un onglet en A3 | dit clairement (4.5) ; replis garantis ; premier essai avant toute construction |
| Une case cochée ne peut ni ouvrir un PDF ni demander confirmation | l'affiche est un lien ; « Publier » écrit son résultat dans une case d'état |
| Ma première solution donnait aux comptes personnels la main sur le compte de Loué | deux programmes séparés (4.1) |
| Un réveil lancé à chaque frappe aurait mangé le quota de Loué | un passage toutes les 10 minutes, chiffré |
| Les cases collées sont fragiles, et je n'avais comparé qu'une solution faible | solution C ajoutée, à comparer sur la maquette |
| Tout doit tenir sur une A3 en paysage | onglet d'impression à part, une ligne par gars, taille du texte calculée ; à mesurer sur une vraie impression |
| La publication pouvait jeter un fichier posé à la main, et montrer la sauvegarde Excel aux poseurs | 4.6 |
| Rien sur les données personnelles | chapitre 6 |
| L'atelier n'était pas spécifié | chapitre 8, trois lots |
| Le lot 11.1a était trop gros | découpage du chapitre 9 |

## 12. Ce qu'il te reste à décider avant la construction

1. **Installer la maquette et faire ses essais** (procédure dans `_prive\planning\maquette\google-sheets\`), en particulier : les propositions pendant la frappe, et le lien de l'affiche.
2. **Cases collées (A) ou une case par jour (C)** : après avoir maltraité la maquette.
3. **Affiche** : *tranché le 18/11 au soir — une seule A3 en paysage.* Il reste à choisir, sur les deux aperçus PDF de la maquette : la notation des quarts et du véhicule du jour te convient-elle ? **Le PDF des gars dans l'appli : la même affiche compacte** (réponse de Franck du 18/11 au soir).
4. **Semaine suivante** : recopie-t-on aussi les chantiers de chacun (tu ne changes que ce qui bouge), ou seulement les gars, les véhicules et les couleurs ? Les absences recopiées : vidées, ou gardées en couleur ?
5. **Publication en 10 minutes au plus**, sans fenêtre de confirmation : d'accord ?
6. **Historique** : 12 mois, puis effacement : d'accord ?
7. **Le véhicule du jour** (ligne fine) et **l'atelier** (4 tâches, chacune avec sa ligne de chantiers) : la forme te convient-elle, et au chef d'atelier ?
8. **Les comptes Google** : le Sheet et le programme de publication appartiendront au compte de Loué. Avec quel compte ouvres-tu le Sheet au bureau ? Qui lit la boîte du compte de Loué ?
9. **Atelier** : la liste des types de fabrication et de ce que chacun fait commander ; les délais de tes fournisseurs ; l'option « à commander avant le … ».
10. **Feuille d'heures, le vendredi** : lieu d'embauche et de débauche.
11. **Accès et favoris depuis le planning** : les cinq points du 13.8.
12. **Avant de commencer** : un numéro pour chaque chantier en cours (colonne E de l'onglet *Chantiers*) ; retirer le mot de santé de ton fichier Excel actuel ; la note d'information aux salariés, avec la direction.

## 13. Les chantiers du planning ouverts tout seuls dans l'appli, et mis en favoris (lot 11.1d)

> Ton idée du 19/11/2026, **critiquée une fois par un agent indépendant** (ce qu'il a changé : 13.9). **Rien n'est construit ; pas de code avant ta validation.** Tous les exemples sont inventés.

**13.1 Ce que tu as demandé**

| Sujet | Ta règle |
|---|---|
| Accès | ajouté tout seul quand le gars est planifié sur le chantier ; **retiré seulement par toi** |
| Favori | apparaît tout seul dès que le gars est planifié ; **ne disparaît pas tout seul** ; le gars le retire d'un appui ; il revient s'il est de nouveau planifié plus tard |
| Qui est qui | une colonne « Compte de l'appli » dans la liste des gars du planning, remplie une fois par toi |
| Sens de lecture | **le serveur de l'appli lit le planning** ; le planning n'écrit jamais dans le Sheet de l'appli |
| Ignorés | les saisies sans numéro (SAV, M. DUPONT, Absent, Congés…) et les lignes de l'atelier |
| Quand | à la publication de la semaine, et chaque jour pour la semaine en cours |

**13.2 Comment ça marche**

1. Dans l'onglet *Salariés* du planning, une colonne « Compte de l'appli » : tu y écris l'identifiant du gars (celui de l'onglet *Utilisateurs* de l'appli, par exemple « poseur01 »). Case vide : le gars est ignoré, sans rien signaler (un gars sans téléphone, c'est normal). **Cette colonne est verrouillée** : toi et le compte de Loué seuls pouvez la modifier (une « plage protégée », réglage ordinaire de Google Sheets).
2. Le serveur de l'appli ouvre le planning **en lecture**. Pour chaque gars de la pose qui a un compte, il lit les cases de la semaine. Dans une case, il regarde chaque ligne de texte (une journée coupée peut en avoir plusieurs) : si **le premier mot est exactement un numéro de chantier** de l'onglet *Chantiers* (colonne E), chantier non « Terminé », le chantier est retenu. « 90 » ne vaut pas pour « 901 ». Tout le reste est ignoré.
3. **Accès** : il coche la case du gars pour ce chantier dans l'onglet *Accès chantiers* (celui que tu remplis aujourd'hui à la main). Il ne décoche jamais rien.
4. **Favori** : il tient, dans un nouvel onglet *Planifiés* du Sheet de l'appli, une ligne par gars et par chantier : la date de début de la série, la dernière semaine planifiée, la date où l'accès a été coché. Le téléphone reçoit ces informations avec la liste des chantiers, et affiche l'étoile.

**Une série** = des semaines publiées qui se suivent, où le gars est planifié sur ce chantier. Une **coupure** = une semaine publiée où il n'y est pas. Une semaine que tu as oublié de publier ne compte pas comme une coupure. Les semaines sont notées par la date de leur lundi (pas de problème au passage d'année).

**13.3 Les règles de détail**

| Cas | Ce qui se passe |
|---|---|
| **Tu décoches un accès** alors que le gars est encore au planning | ta décision tient **tant que la série continue**, même si la semaine suivante est publiée avec lui dessus. L'accès revient tout seul seulement après une coupure suivie d'une nouvelle planification. Entre-temps, tu peux toujours recocher à la main |
| **Le gars retire un favori** alors qu'il est encore planifié | même règle : le favori revient après une coupure suivie d'une nouvelle planification |
| Un gars retiré du planning le mardi et remis le jeudi de la même semaine | la série continue : rien ne revient tout seul |
| Compte inconnu ou inactif, deux gars du planning avec le même compte ou le même nom, numéro de chantier en double dans l'onglet *Chantiers* | ignoré, et listé en haut de l'onglet *Planifiés* (« à voir ») |
| Compte qui voit déjà tous les chantiers (conducteur, case « Tous les chantiers ») | rien à cocher ; le favori s'affiche quand même |
| Chantier passé à « Terminé » | il sort de « Mes chantiers », comme aujourd'hui ; le favori avec lui |
| Chantier renommé | l'onglet *Accès chantiers* range par nom : le serveur coche la ligne du nouveau nom, si la case de l'ancien nom était encore cochée |
| Plus de **8 chantiers nouveaux pour un même gars dans la semaine** (collage raté, mauvaise ligne) | le serveur ne coche rien **pour ce gars-là**, l'écrit dans « à voir » ; les autres gars sont traités. Pour débloquer : tu coches à la main |

**13.4 Deux choix techniques comparés**

*Où retenir les favoris*

| Solution | Pour | Contre |
|---|---|---|
| **A. Le serveur dit « planifié, série commencée le … », le téléphone retient les étoiles retirées** (retenue) | aucun envoi quand le gars retire une étoile : ça marche **sans réseau** ; rien de plus à mettre en file d'attente ; le serveur n'a qu'une lecture en plus | sur un téléphone neuf, une étoile retirée revient une fois, et une étoile mise à la main par le gars est perdue (les favoris du planning, eux, reviennent tous) |
| B. Tout dans le Sheet de l'appli (onglet *Favoris*, une action « retirer ») | suit le compte d'un téléphone à l'autre ; tu vois les favoris de chacun | une action de plus côté serveur, une file d'attente hors réseau de plus, plus de choses à casser |

*Quand le serveur lit le planning*

| Solution | Pour | Contre |
|---|---|---|
| **A. Un passage toutes les 30 minutes, plus un passage chaque matin vers 5 h** (retenue) | le planning n'a rien à envoyer à l'appli : ta règle est respectée à la lettre | l'accès arrive jusqu'à 30 minutes après le « Publié le … » (lui-même jusqu'à 10 minutes après ta coche) |
| B. Le programme de publication prévient l'appli dès qu'il a publié | immédiat | il faudrait écrire l'adresse du serveur à un deuxième endroit (elle change à chaque déploiement) et un mot de passe entre les deux programmes |

**Coût sur les 90 minutes par jour du compte** : 48 passages par jour. Un passage s'arrête tout de suite si le planning n'a pas changé depuis le précédent ; sinon il lit deux onglets au plus (semaine en cours et suivante), sur une zone bornée, et s'arrête de lui-même au bout de 20 secondes. Estimation : **1 à 3 minutes par jour, à mesurer sur la copie TEST**.

Le serveur sait qu'une semaine est publiée en lisant la case d'état « Publié le … » de son onglet (4.6), et il retient lui-même les semaines qu'il a déjà lues. Le passage du matin relit la semaine en cours si elle a été publiée au moins une fois : une semaine jamais publiée est un brouillon.

**« Lecture seule »** : le serveur de l'appli tourne avec le compte de Loué, qui sera propriétaire du planning ; Google ne sait pas lui interdire d'écrire. La garantie est dans le programme : une seule fonction ouvre le planning, elle ne fait que lire, et un test vérifie qu'aucune commande d'écriture ne vise le planning. Les règles de lecture sont **dans le serveur**, testées sans Google : il ne se fie pas au programme du planning (*Vérifier la semaine*), que les éditeurs peuvent modifier. L'identifiant du Sheet du planning va dans les « Propriétés du script », jamais dans le dépôt.

**Écriture dans *Accès chantiers*** : le planning est lu d'abord ; ensuite, sous le verrou du serveur (pour ne pas croiser un autre passage), le serveur vérifie que la ligne du chantier et la colonne du gars existent, relit les titres, puis coche. Il ne note « fait » que si la case est vraiment cochée ; sinon il recommence au passage suivant.

**Autorisation Google** : d'après le code actuel, le serveur a déjà le droit « voir et modifier les feuilles de calcul » ; ouvrir un deuxième Sheet ne devrait rien demander de plus. **À vérifier sur la copie TEST avant tout** : si Google redemandait une autorisation en production, l'appli entière s'arrêterait tant que tu ne l'as pas validée. Si c'est le cas sur TEST, je te le dis avant d'aller plus loin.

**13.5 Ce que ça change pour les poseurs, à l'écran**

Une seule page change : l'accueil.

- En tête de « Mes chantiers », un bloc **« Favoris »** : les chantiers où le gars est ou a été planifié, le plus récent en premier. Sous le nom, en petit : « Cette semaine », « Semaine prochaine », ou « Planifié en S48 ».
- **À gauche du nom, une étoile pleine ★.** Un appui dessus retire le favori ; un message « Retiré des favoris — Annuler » reste 6 secondes. Le chantier ne disparaît pas : il redescend dans la liste, l'accès reste.
- Dans la liste du dessous, chaque chantier a une **étoile vide ☆** : un appui le met en favori. C'est ce qui permet de rattraper un retrait fait par erreur. (Ce point n'était pas dans ta demande : 13.8, point 3.)
- L'étoile est une zone d'appui à part, large (environ 1 cm), placée à gauche, loin de l'endroit où le pouce ouvre le chantier : avec des gants, on ne retire pas un favori en voulant ouvrir.
- Sous les favoris, la liste d'aujourd'hui, inchangée (derniers chantiers ouverts d'abord). La recherche cherche dans les deux. Le bouton « Voir tous les chantiers » ne change pas. Sans compte : pas de favoris.
- Un chantier **nouveau pour lui apparaît tout seul**, à la première ouverture avec du réseau après la publication. Sans réseau, il garde la dernière liste reçue, favoris compris ; mettre ou retirer une étoile marche sans réseau.
- Les favoris **ne partent pas tout seuls** (ta règle) : au fil des mois, le bloc grossit si le gars ne fait pas le ménage. Seul un chantier « Terminé » en sort.
- Rien d'autre ne change : fiches, notes, carnet, signalements. Les plans du carnet d'un nouveau favori **ne se téléchargent pas tout seuls** (poids et forfait) : le gars appuie comme aujourd'hui.

**13.6 Ce que ça change pour toi**

- Une colonne à remplir une fois (« Compte de l'appli »), et à compléter à chaque nouveau gars.
- L'onglet *Accès chantiers* se coche tout seul pour les gars planifiés. Tu gardes la main pour cocher en plus (un gars hors planning) et pour **décocher**.
- Un onglet *Planifiés* en plus dans le Sheet de l'appli, écrit par le serveur seulement : qui est planifié où, la date de chaque accès coché, et en haut les « à voir ».
- **À savoir, sans détour** : toute personne qui peut modifier le planning (toi, le chef d'atelier, ou quelqu'un qui aurait volé l'un de vos deux comptes Google) peut, en écrivant un numéro sur la ligne d'un gars et en publiant, **ouvrir n'importe quel chantier en cours à n'importe quel gars du planning qui a un compte**. C'est le principe même de ta demande. Ce qui limite les dégâts : on ne peut rien retirer par ce chemin ; on ne peut pas viser un compte hors de la colonne verrouillée ; le rôle du compte ne change pas (un poseur reste un poseur) ; 8 chantiers nouveaux au plus par gars et par semaine ; chaque ajout est daté dans *Planifiés* ; tu décoches.

**13.7 Risques et parades**

| Risque | Parade |
|---|---|
| Une erreur dans le planning ouvre un chantier à la mauvaise personne | ajouts seulement, chantiers en cours seulement, comptes actifs seulement ; chaque ajout daté ; plafond par gars ; tu décoches, et ça tient |
| Quelqu'un change la colonne « Compte de l'appli » | colonne verrouillée (toi et le compte de Loué) ; un même compte sur deux lignes est refusé |
| Un numéro tapé dans une saisie libre (« 12 rue des Lilas ») pris pour un chantier | seul un numéro **existant** compte, en premier mot, comparé en entier |
| Cases déréglées, semaine illisible | une ligne que le serveur ne sait pas lire est ignorée et listée « à voir » ; aucun accès n'est jamais retiré |
| Un planning énorme (collage) qui ferait durer les passages et mangerait les 90 minutes | zone de lecture bornée, arrêt à 20 secondes |
| Un texte du planning recopié dans le Sheet de l'appli qui serait une formule | tout texte venu du planning passe par la protection déjà en place dans le serveur (il est écrit comme du texte, jamais comme une formule) |
| Le planning indisponible ou déplacé | le passage ne fait rien et recommence au suivant |
| Données personnelles : l'onglet *Planifiés* dit qui a travaillé où | une ligne par gars et par chantier (la dernière série seulement), lue par toi seul ; à ajouter dans la note d'information aux salariés (chapitre 6) |

**13.8 Où dans le découpage, et ce qu'il te reste à décider**

**Lot 11.1d**, après le 11.1c (la publication). Il dépend du 11.1a (l'onglet *Salariés* et la forme des semaines) et du 11.1c (la case « Publié le … »). La colonne « Compte de l'appli » est créée dès le 11.1a : elle ne coûte rien et tu peux la remplir tôt.

C'est **le premier lot du planning qui touche l'appli** (serveur et page d'accueil) : il passe donc par la copie TEST, une nouvelle version du serveur, un nouveau déploiement, et une relecture par un agent indépendant (il touche aux accès). Il se livre en deux temps, chacun utilisable seul : **d'abord les accès** (serveur seul ; à l'écran, seuls les chantiers apparaissent), **puis les favoris** (page d'accueil, dont les cartes des chantiers sont à refaire pour loger l'étoile).

À décider :

1. **Colonne « Compte de l'appli » verrouillée** : toi et le compte de Loué seuls. Le chef d'atelier ne pourra pas la modifier. D'accord ?
2. **Une seule règle pour l'accès et le favori** : ce que tu as décoché, ou ce que le gars a retiré, ne revient qu'après une coupure. Ou préfères-tu que **l'accès** revienne à chaque nouvelle semaine publiée où le gars est planifié (au risque de recocher ce que tu viens de décocher) ?
3. **L'étoile vide**, pour que le gars mette ou remette un favori lui-même : d'accord ? (Gardée dans le téléphone seulement.)
4. **Délai** : accès dans les 30 minutes après la publication, d'accord ?
5. **Un gars bloqué par le plafond de 8** : c'est écrit dans « à voir », que tu ne regardes pas tous les jours. Un mail à toi seul, uniquement dans ce cas ?

**13.9 Ce que la critique indépendante a changé (19/11)**

| Constat | Correction |
|---|---|
| La colonne « Compte de l'appli » et un plafond global n'étaient pas de vrais garde-fous | colonne verrouillée ; plafond par gars ; le risque est écrit sans détour (13.6) |
| « Le serveur se souvient » ne tenait pas avec deux semaines publiées, au passage d'année, ou avec une semaine non publiée | définition de la série et de la coupure, dates du lundi, semaines lues retenues par le serveur |
| « Chantier renommé : sans effet » était faux, l'onglet des accès range par nom | règle du 13.3 |
| La lecture des cases était floue (« 90 » dans « 901 », doublons, plusieurs chantiers par case) | premier mot entier, chaque ligne de la case, doublons refusés |
| Le serveur ne peut pas se fier à *Vérifier la semaine* | ses propres règles de lecture, testées |
| Ligne ou colonne absente de l'onglet des accès, verrou | 13.4, « Écriture dans *Accès chantiers* » |
| Un plafond global aurait tout bloqué à la mise en service | plafond par gars, déblocage en cochant à la main |
| Chiffrage trop optimiste | 48 passages, arrêt immédiat si rien n'a changé, 1 à 3 minutes à mesurer |
| Étoile à droite sous le pouce ; retrait par erreur sans retour possible | étoile à gauche, étoile vide pour remettre |
| Les favoris s'empilent | tri par semaine la plus récente, libellés clairs, dit au 13.5 |
