# Lot 11.1 — Le Sheet « Planning Loué » — PLAN

> Plan du 18/11/2026, **version 2** : tes réponses du 18/11 au soir sont intégrées (chapitre 2). **Rien n'est construit**, sauf une maquette de démonstration avec de faux noms, sans lien avec l'appli.
> L'étude et la maquette sont dans `_prive\` (hors du dépôt public). Tous les exemples d'ici sont inventés.

## 1. Le but

Remplacer l'onglet de planning de ton fichier Excel par un **Google Sheets à part, « Planning Loué »**, tenu par toi et par le chef d'atelier, lu par la direction, et d'où sortent en un geste **l'affiche de l'atelier** (A3) et **le PDF des gars** dans l'appli.

Ce plan couvre le planning (lots 11.1a et 11.1b). Les onglets de l'atelier (fabrication, commandes) sont le lot 11.3 : ce que tes réponses fixent déjà est au chapitre 8. La feuille d'heures (lots 11.4 à 11.6) n'est pas dans ce plan.

## 2. Tes décisions (18/11/2026)

| Sujet | Ta décision |
|---|---|
| Absences | **« Absent » pour tout le monde dans le planning.** Le motif (arrêt de travail) reste au bureau, sur papier. Aucun mot de santé dans le Sheet |
| Autres cas | les vraies appellations : Congés, École, Formation, Férié, Atelier, Bureau, SAV / divers |
| Saisie | liste « N° NOM » avec propositions, **et saisie libre acceptée** (« Mr DUPONT ») : au plus un avertissement, jamais un refus |
| Journée | quarts de journée ; **un seul chantier dans la journée prend toute la case** |
| Noms | **prénom et initiale du nom**, par ordre alphabétique |
| Couleurs | **par véhicule** (pastel) : les gars d'un même véhicule ont la même couleur |
| Véhicule | il reste dans le planning ; **il peut changer dans la semaine** |
| Atelier | **jusqu'à 4 tâches par jour et par gars**, chacune avec ses chantiers |
| Effectif | pose : 12 gars, 8 places libres ; atelier : 4 gars, 3 places libres ; jamais de samedi |
| Affiche de l'atelier | **A3**, même taille d'écriture que le planning |
| PDF publié | **la semaine en cours et la suivante** dès qu'elle est prête ; tous les poseurs voient tout |
| Qui fait quoi | toi et le chef d'atelier modifiez ; la direction lit |
| Semaines passées | deux mois dans le Sheet, puis un onglet « Historique » |
| Mails | aucun en plus : tout se voit dans le Sheet |

## 3. Ce que tu verras

**Un onglet par semaine** (« 2026-S48 »). Colonnes : Véhicule de la semaine, Nom, puis lundi à vendredi.

**Un gars de la pose** = un bloc de 4 petites lignes (les 4 quarts de la journée), plus une ligne fine « véhicule du jour ».

| Tu veux | Tu fais | Résultat |
|---|---|---|
| un chantier toute la journée | tu tapes « 901 » dans la case, Entrée | la case devient « 901 LES TILLEULS », en gros, sur toute la hauteur |
| autre chose que la liste | tu tapes « Mr DUPONT » | accepté tel quel (petit triangle d'avertissement de Google) |
| couper la journée | menu *Couper la journée* : en 2, ¼ + ¾, ¾ + ¼, en 3, en 4 | 2 à 4 cases, chacune avec sa liste |
| revenir à la journée entière | menu *Journée entière* | une grande case |
| changer de véhicule un jour | tu choisis le véhicule dans la ligne fine de ce jour-là | la case de ce jour prend la couleur de ce véhicule |

**Un gars de l'atelier** = 4 tâches possibles par jour ; pour chacune, une ligne « tâche » (liste : Huisseries, Préparation…) et une ligne « chantiers ».

**En bas** : qui a quel véhicule chaque jour, avec une alerte si un véhicule a plus de 3 gars.

**Trois boutons** en haut de l'onglet, et les mêmes commandes dans un menu « Planning Loué » :

| Bouton | Ce qu'il fait |
|---|---|
| **Créer la semaine suivante** | recopie la semaine dans un nouvel onglet : gars, véhicules, couleurs, répartition (tu ne changes que ce qui bouge) ; dates mises à jour |
| **Imprimer l'affiche de l'atelier** | ouvre le PDF A3 de la semaine (les lignes libres n'y sont pas) ; il reste à cliquer sur Imprimer |
| **Publier pour les gars** | dépose le PDF de la semaine en cours, et celui de la suivante s'il existe, dans le dossier *Planning* de l'appli |

Puisque « Absent » est écrit tel quel dans le planning, **l'affiche et le PDF sont le planning lui-même** : plus de copie à fabriquer, plus de mot à remplacer.

## 4. Les choix techniques (deux solutions au moins à chaque fois)

**4.1 Où vit le programme du planning**

| Solution | Pour | Contre | Retenue ? |
|---|---|---|---|
| **Un programme attaché au Sheet du planning** (Extensions → Apps Script, depuis le Sheet) | un menu et des boutons dans le Sheet ; aucune adresse de déploiement ; le serveur de l'appli n'est pas touché | un second programme à coller à chaque mise à jour | **oui** |
| Dans le serveur de l'appli | un seul programme | pas de menu dans le Sheet ; chaque retouche du planning obligerait à redéployer l'appli | non |

**4.2 Qui fait tourner le programme**

Un geste dans le Sheet tourne au nom de **celui qui le fait**. Or « Publier » doit écrire dans le dossier *Planning* du Drive de l'appli, et la liste des chantiers doit lire le Sheet de l'appli : seul le **compte Google de Loué** y a accès.

| Solution | Pour | Contre | Retenue ? |
|---|---|---|---|
| **Le Sheet appartient au compte de Loué, qui y installe deux « réveils »** : l'un guette la case « Publier », l'autre recopie la liste des chantiers chaque nuit. Ils tournent au nom du compte de Loué, quel que soit celui qui coche | marche pour toi et pour le chef d'atelier avec vos propres comptes ; aucun partage du Drive de l'appli | une installation à faire une fois, avec le compte de Loué | **oui** |
| Partager le dossier *Planning* et le Sheet de l'appli avec vos comptes personnels | pas de réveil | ouvre les données de l'appli à des comptes personnels | non |

Coût sur les 90 minutes par jour de réveils du compte de Loué (partagées avec l'appli) : la recopie de la liste, quelques secondes par nuit ; la publication, quelques secondes par clic. À mesurer sur la copie TEST.

**4.3 « Un seul chantier = toute la case »**

| Solution | Pour | Contre | Retenue ? |
|---|---|---|---|
| **Des cases collées et décollées par le menu** | exactement ta demande ; l'affiche est le même dessin | un copier-coller fait de travers peut dérégler un bloc : commande *Vérifier la semaine*, lancée aussi avant chaque publication | **oui** |
| Quatre lignes jamais collées | rien ne se dérègle | un chantier seul reste écrit en petit sur la première ligne | non |

**4.4 La saisie : liste, propositions, saisie libre**

| Solution | Pour | Contre | Retenue ? |
|---|---|---|---|
| **Liste déroulante de Google réglée sur « afficher un avertissement »**, plus une complétion par le programme : « 901 » + Entrée → « 901 LES TILLEULS » quand un seul chantier commence ainsi | la saisie libre est acceptée (réglage prévu par Google) ; la complétion ne dépend pas de l'affichage de Google | la page d'aide de Google ne dit pas si des propositions s'affichent **pendant** la frappe : **à vérifier par ton essai sur la maquette** | **oui** |
| Un panneau de recherche sur le côté | propositions garanties | un clic de plus à chaque case | en secours seulement |

**4.5 La liste « N° NOM »**

| Solution | Pour | Contre | Retenue ? |
|---|---|---|---|
| **Recopie par le programme** depuis l'onglet *Chantiers* de l'appli (chaque nuit, et par le menu) | pas de panne silencieuse ; un chantier terminé sort de la liste mais reste écrit dans les semaines passées | une autorisation de plus | **oui** |
| Une formule `IMPORTRANGE` | une ligne à écrire | casse sans prévenir si une autorisation saute | non |

Condition : chaque chantier en cours a son **numéro** dans l'onglet *Chantiers* (colonne E).

**4.6 L'affiche et le PDF**

| Solution | Pour | Contre | Retenue ? |
|---|---|---|---|
| **Le PDF est l'onglet de la semaine, exporté par Google** (A3 en largeur pour l'affiche, A4 pour les gars), sans les boutons ni les lignes libres | rien à redessiner ; ce que tu vois est ce qui sort | réglages d'export à vérifier dans la documentation de Google avant de construire | **oui, sous réserve** |
| Une page redessinée par le programme | mise en page libre | un second dessin à tenir à jour | non |

Un programme Google **ne peut pas lancer l'imprimante** : un clic ouvre le PDF, un second l'imprime.

**4.7 « Publier » et l'appli**

Le PDF est déposé dans le dossier *Planning* du Drive de l'appli (un fichier par semaine, remplacé à chaque publication ; les semaines passées sont retirées). **Il faut le lot 5c en production** : c'est lui qui réserve la lecture du planning aux comptes de l'appli. Aucune page de l'appli ne change.

## 5. Les endroits touchés

| Où | Quoi |
|---|---|
| Un nouveau Google Sheets « Planning Loué », et sa copie « Planning Loué TEST » avec de faux gars | onglets *Listes*, *Salariés*, semaines, *Historique* |
| `planning/` dans le dépôt (nouveau dossier) | le programme attaché au Sheet, sans aucun nom ni identifiant |
| `tests/` | les règles testées sans Google : découpage d'une journée, complétion, semaine suivante, nom des fichiers publiés |
| `docs/` | procédure pas à pas, guide d'une page pour toi et le chef d'atelier, journal |
| Serveur et pages de l'appli | **rien** |

## 6. Risques et parades

| Risque | Parade |
|---|---|
| Un mot de santé réapparaît dans le planning (saisie libre) | il n'est pas dans la liste ; *Vérifier la semaine* signale les mots « arrêt », « maladie », « accident » avant toute publication, et refuse de publier |
| Cases déréglées par un copier-coller | *Vérifier la semaine* répare ce qui se répare, liste le reste |
| Saisie libre : un chantier mal écrit ne sera pas reconnu plus tard (feuille d'heures) | l'avertissement de Google ; *Vérifier la semaine* liste les valeurs hors liste, sans les refuser |
| Une semaine publiée par erreur | la publication demande confirmation ; republier remplace le fichier |
| Le Sheet ouvert à trop de monde | partage nominatif seulement (toi, le chef d'atelier, la direction en lecture) ; jamais « toute personne qui a le lien » |
| Double saisie pendant le passage | deux semaines en double avec ton Excel, puis une seule source |
| Perte du planning | historique des versions de Google ; à chaque publication, une copie Excel de la semaine dans le Drive (donc sur ton PC) |
| Programme collé au mauvais endroit | la procédure montre chaque clic ; le menu affiche la version du programme |

## 7. Tests, essais, découpage

- **Sans Google** : découpage et recollage d'une journée, complétion, semaine suivante (dates, passage d'année), liste des chantiers.
- **Sur « Planning Loué TEST »** : chaque commande ; l'affiche imprimée en A3 ; le PDF publié dans le dossier *Planning* de la copie TEST et ouvert dans l'appli d'essai, avec un compte puis sans.
- **Avec toi** : deux semaines saisies en double ; l'affiche à l'atelier ; le chef d'atelier saisit ses lignes.
- Relecture par un agent indépendant : oui (données de salariés, publication).

| Lot | Contenu | Dépend de |
|---|---|---|
| **11.1a** | le Sheet, les listes, la semaine, *Créer la semaine suivante*, *Couper la journée*, *Vérifier la semaine*, l'affiche A3 | rien |
| **11.1b** | *Publier pour les gars* (semaine en cours et suivante) | le lot 5c en production |
| **11.3** | les onglets de l'atelier (chapitre 8) | le 11.1a |

## 8. L'atelier (lot 11.3) : ce que tes réponses fixent déjà

Quatre onglets, dans le même Sheet : **PRÉVISION ATELIER**, **CDE EN ATTENTE**, **COMMANDES**, **CDE REÇUES**.

- **Commandes** : un seul tableau, trié tout seul par date ; une colonne « N° BL » ; « Reçu » est une case à cocher, qui grise la ligne et remplit seule la date ; la semaine de livraison est celle de l'ARC du fournisseur, tapée à la main ; la ligne passe en rouge une fois cette semaine dépassée sans « Reçu ».
- **Tous les 15 jours**, les lignes reçues partent dans « CDE REÇUES ».
- **Commandes en attente** : une case « Commandé » fait passer la ligne dans les commandes, avec la date du jour, sans ressaisie.
- **La fabrication déclenche les commandes** : une ligne de la prévision crée toute seule la ou les lignes à commander, selon une table de règles que tu modifies (huisseries → portes ; châssis fixe → vitrages ; portes vitrées → vitrages). Le programme propose, il ne commande jamais ; pas de doublon si la ligne de fabrication change.
- **En retour**, chaque ligne de la prévision affiche l'état de ses commandes.
- **En option**, à valider sur la maquette : « à commander avant le … », d'après la semaine de fabrication et le délai habituel de chaque fournisseur.

**Ce que ça coûte sur les 90 minutes par jour** : le rangement tous les 15 jours est un réveil du compte de Loué, d'une dizaine de secondes par quinzaine : négligeable. Les gestes du chef d'atelier (cocher, trier) tournent à son nom, pendant une à deux secondes chacun. Je n'ai pas trouvé dans la documentation si ces gestes sont comptés dans les 90 minutes de **son** compte : même s'ils le sont, 150 gestes par jour font moins de 5 minutes. À mesurer pendant les essais.

## 9. Ce qu'il te reste à décider avant la construction

1. **La maquette Google Sheets** (procédure dans `_prive\planning\maquette\google-sheets\`) : des propositions s'affichent-elles pendant la frappe ? Les « boutons » de la maquette sont des cases à cocher à côté d'un libellé bleu : cela te va-t-il, ou veux-tu de vrais boutons dessinés (une manipulation de plus à l'installation) ?
2. **Le véhicule du jour** : la ligne fine sous chaque gars te convient-elle ?
3. **L'atelier** : 4 tâches par jour, chacune avec sa ligne de chantiers : est-ce la bonne forme pour le chef d'atelier ?
4. **Les comptes Google** : le Sheet appartiendra au compte de Loué. Avec quel compte l'ouvres-tu au bureau : celui de Loué, ou le tien ?
5. **Feuille d'heures, le vendredi** : lieu d'embauche et de débauche, si les gars travaillent ce jour-là.
6. **Règles de l'atelier** : la liste des types de fabrication et de ce que chacun fait commander ; les délais habituels de tes fournisseurs ; l'option « à commander avant le … » : oui ou non.
7. **Jours fériés** : pré-remplis « Férié » à la création de la semaine : oui ou non ?
8. **Avant de commencer** : un numéro pour chaque chantier en cours dans l'onglet *Chantiers* (colonne E) ; retirer le mot de santé de ton fichier Excel actuel.

## 10. Ce que tu auras à faire

| Quand | Quoi | Durée |
|---|---|---|
| Maintenant | installer la maquette, faire ses essais, répondre au chapitre 9 | 30 min |
| 11.1a | créer le Sheet avec le compte de Loué, coller le programme, l'autoriser, saisir tes gars ; deux semaines en double | 45 min, puis 10 min par semaine |
| 11.1b | publier une semaine ; l'ouvrir sur Android et iPhone | 15 min |
| 11.3 | une heure avec le chef d'atelier ; reprise de ses lignes en cours | 1 h 30 |
