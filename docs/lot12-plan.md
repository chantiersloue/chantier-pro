# Lot 12 — Tous les chantiers ouverts à tous les comptes, et nouvel accueil — PLAN

> **Construit le 19/11/2026** après tes deux réponses du même jour (chapitre 9) : **1 non** — les chantiers « Terminé » restent **visibles, en bas de la liste, grisés** ; **2 oui** — même écran pour toi, tes chantiers de conducteur arrivent tout seuls dans « Mes chantiers ». Les favoris du planning (chapitre 13 du plan du lot 11.1) sont construits dans ce lot, côté appli, éteints tant que le planning n'existe pas. Procédure : `docs/lot12-procedure.md` ; décisions prises pendant la construction : D12-… dans `DECISIONS.md`. **Là où ce plan et la procédure diffèrent (chantiers terminés, état écrit dans les 10 minutes), c'est la procédure qui dit vrai.**
> Plan du 19/11/2026, sur ta décision du jour.
> **Pas encore critiqué par un agent indépendant** : il le sera une fois, quand tu auras répondu aux deux points du chapitre 9 (pour ne pas payer deux critiques). Le relevé du chapitre 3 a été fait par moi, dans le code des lots en service et des branches des lots 8, 10 et 5b.

## 1. Ta décision

- **Tout gars qui a un compte peut ouvrir tous les chantiers** : carnet, fiches, notes, signalements. Sans compte : rien, comme aujourd'hui.
- C'est un **réglage allumé / éteint**, pour pouvoir revenir en arrière.
- **L'accueil change** : « Mes chantiers » = les favoris du gars, classés par numéro ; « Tous les chantiers » en dessous, replié.
- Le planning n'ouvre plus aucun accès : il ajoute seulement des favoris (lot 11.1d, chapitre 13 de `docs/lot11-1-plan.md`).

Le lot a deux parties : **12a, le réglage** (serveur) ; **12b, l'accueil** (une page). Elles partent en production ensemble, le réglage **livré éteint**.

## 2. Le réglage (12a)

**Où** : un nouvel onglet « Réglages » du Sheet de l'appli, une ligne « Tous les comptes ouvrent tous les chantiers », une case à cocher. À côté, le serveur écrit l'état (« Allumé depuis le 24/11 à 8 h 12 »). Pris en compte **en une minute au plus**, sans rien redéployer.

**Trois façons de faire, comparées**

| Solution | Pour | Contre |
|---|---|---|
| **A. Une case dans un onglet « Réglages »** (retenue) | tu l'allumes et tu l'éteins toi-même, même depuis ton téléphone ; un seul geste pour tout le monde | une case peut se décocher par erreur : l'onglet ne contient que les réglages, et l'état écrit à côté te le montre |
| B. Cocher « Tous les chantiers » (colonne I de l'onglet *Utilisateurs*) pour chaque gars | existe déjà, aucun programme à écrire | à refaire à chaque nouveau compte ; et deux effets que tu ne veux pas : pour ces comptes, **les plans ne se téléchargent plus tout seuls en Wi-Fi**, et les chantiers « Terminé » apparaissent |
| C. Une « propriété du script » (comme le réglage du mail unique) | aucun risque de clic par erreur | il faut ouvrir l'éditeur Apps Script pour la changer |

**Comment** : dans le serveur, tous les contrôles d'accès à un chantier passent par **deux fonctions seulement** (la liste des chantiers d'un compte, et « ce compte peut-il lire ce chantier ? »). Je l'ai vérifié dans le code en service et dans les branches des lots 8, 10 et 5b. Le réglage se lit dans ces deux fonctions, nulle part ailleurs. Un test vérifiera qu'aucun autre chemin n'existe.

**Retour arrière** : tu décoches. Dans la minute, les cases de l'onglet *Accès chantiers* reprennent leur effet, telles que tu les avais laissées. Aucune donnée n'est touchée.

## 3. Ce que ça change dans les règles déjà en service

| Règle | Aujourd'hui | Réglage allumé |
|---|---|---|
| Chantiers d'un poseur ou d'un gars de l'atelier | ceux dont la case est cochée, non « Terminé » | **tous les chantiers non « Terminé »** (point 1 du chapitre 9) |
| Conducteur, Admin | tous | inchangé |
| Sans compte | rien | inchangé |
| Compte inactif ou déconnecté par toi | rien | inchangé |
| **Carnet** : voir et télécharger les plans | ses chantiers | tous. Le téléchargement automatique en Wi-Fi ne change pas : seulement le chantier ouvert à l'écran |
| Documents du chantier | ses chantiers | tous |
| **Notes de chantier** (lot 3) : lire, ajouter, cocher | ses chantiers | tous. Les chiffres rouges comptent tous les chantiers ; ils s'affichent sur chaque chantier, pas sur la liste repliée |
| **Fiches** : la question « ce chantier n'est pas dans votre liste, continuer ? » | posée pour un chantier hors de ses cases | posée seulement pour un chantier « Terminé » ou inconnu |
| **Signalements** (lot 7) : en envoyer | déjà possible sur tout chantier (avec la question ci-dessus) | pareil, sans la question |
| **Signalements** : qui les voit, qui change le statut | par **rôle**, pas par chantier : un poseur voit les siens ; conducteur, admin et atelier voient tout et changent le statut | **inchangé** |
| **Note de réunion** (lot 8) | tout le monde peut en écrire une, sur tout chantier | **inchangé**. Les points (clore, rouvrir) ont été retirés du lot 8 le 19/11 : la question « qui peut clore un point » ne se pose plus |
| **Récapitulatif des notes** d'un chantier (lot 8d, s'il est validé) | — | lisible par tout compte, sur tout chantier |
| Planning (tuile, lot 5c) | tous les comptes | inchangé |
| Mails, purges, stockage, quotas | — | inchangé |

Les lots 10a-1, 10a-2, 10b et le mail unique n'ajoutent aucun contrôle d'accès à eux : ils suivent tout seuls.

## 4. Les cases d'accès par chantier : on les garde

Je te conseille de **les garder, sans effet** tant que le réglage est allumé.

- Ce sont elles qui permettent le retour arrière en une minute. Retirées, il faudrait tout recocher.
- Les garder ne coûte rien : le serveur continue d'y ajouter les lignes et les colonnes, comme aujourd'hui.
- La case « Tous les chantiers » de l'onglet *Utilisateurs* reste aussi, sans effet pour les poseurs.
- En tête de l'onglet *Accès chantiers*, le serveur écrira « Sans effet : réglage « tous les chantiers » allumé », pour que tu ne coches pas pour rien.

On pourra les retirer dans quelques mois, si tu es sûr de ne pas revenir en arrière.

## 5. Le nouvel accueil (12b)

Une seule page change : l'accueil. Il marche avec le réglage allumé comme éteint.

**« Mes chantiers », en tête** : les favoris du gars, **classés par numéro** (un chantier sans numéro va à la fin, par ordre alphabétique). Juste la liste, sans sous-titre. À gauche de chaque nom, une **étoile pleine ★** : un appui retire le chantier de « Mes chantiers », avec un message « Retiré — Annuler » pendant 6 secondes.

**« Tous les chantiers (32) », en dessous, plus petit, replié** : un appui déplie la liste complète, classée par numéro, avec la recherche. Un appui sur un chantier l'ouvre directement. À gauche, une **étoile vide ☆** : un appui l'ajoute à « Mes chantiers ». La liste est repliée à chaque ouverture de l'appli ; si « Mes chantiers » est vide, elle est dépliée, avec une phrase d'explication.

**Les détails que j'ai tranchés**

- **Le premier jour** : les chantiers que le gars a aujourd'hui dans « Mes chantiers » deviennent ses favoris. Rien ne disparaît de son écran.
- **Où sont gardées les étoiles** : dans le téléphone (ton accord du 19/11). Ça marche sans réseau. Sur un téléphone neuf, les étoiles mises à la main sont à remettre ; celles du planning reviennent.
- **Réglage éteint** : « Tous les chantiers » ne montre que les chantiers dont la case est cochée, et un chantier nouvellement coché arrive tout seul dans « Mes chantiers », comme aujourd'hui.
- L'étoile est une zone d'appui à part, large (environ 1 cm), à gauche, loin de l'endroit où le pouce ouvre le chantier.
- **Ce qui disparaît** : le classement « derniers chantiers ouverts d'abord » (remplacé par le numéro, à ta demande) et le bouton « Voir tous les chantiers » (remplacé par la liste repliée). Le programme qui s'en occupait est retiré avec.
- Mode « sans compte » de la période de transition : inchangé, pas d'étoiles.

## 6. Ce que tu acceptes, côté sécurité

- **Un compte = tous les chantiers en cours** : plans, documents, notes, points des comptes rendus. Un téléphone perdu, un mot de passe prêté ou un gars qui part donnent accès à tout, et plus seulement à ses chantiers. La parade existe déjà : décocher « Actif » et cocher « Déconnecter ses téléphones » dans l'onglet *Utilisateurs*, le jour même.
- **Plus de compte « limité »** tant que le réglage est allumé : c'est tout ou rien pour tout le monde (intérimaire et apprenti compris).
- Rien ne change pour quelqu'un qui n'a pas de compte : il ne voit rien.

Pour une entreprise de ta taille, où tout le monde voit déjà tout le planning, ce choix se défend. Je le signale pour que ce soit dit.

## 7. Les endroits touchés, et les tests

| Où | Quoi |
|---|---|
| Serveur (`apps-script/Comptes.gs`, installation) | l'onglet « Réglages », la lecture du réglage dans les deux fonctions d'accès, l'état écrit dans les onglets |
| `index.html` | le nouvel accueil (cartes des chantiers refaites pour loger l'étoile), retrait du classement par derniers ouverts |
| `docs/` | `structure-sheet.md` (onglet « Réglages »), `guide-utilisateur.md` (« Mes chantiers »), procédure pas à pas, `CHANGELOG.md` |
| `tests/` | réglage éteint : exactement le comportement d'aujourd'hui ; allumé : un poseur lit tout chantier non « Terminé », pas un « Terminé » ; compte inactif et sans compte toujours refusés ; aucun autre chemin d'accès |
| Carnet, notes, signalements, fiches, PDF, mails | **aucune modification** : ils suivent les deux fonctions |

Essais sur la copie TEST : allumer, éteindre, rallumer avec un compte de poseur ; l'accueil à 375 px et sur PC, en réseau lent et hors réseau ; les étoiles avec des gants. Relecture par un agent indépendant : **oui** (accès).

Une nouvelle version du serveur, donc un nouveau déploiement et une nouvelle adresse dans `commun/config.js`.

## 8. Sa place dans l'ordre de production

**5c → lot 8 → lot 12 → 10a-1 → 10a-2 → 10b → mail unique.** Oui, juste après le lot 8.

- Il est petit côté serveur, et le lot 11.1d (les favoris du planning) a besoin de son accueil.
- Il se construit sur la branche du lot 8 (sans les points, retirés le 19/11). Après sa mise en production, je le reporte dans les branches des lots 10 et du mail unique, comme pour le 5c.
- Ce que ça coûte : une mise en production de plus (environ 30 minutes pour toi) et un jour de plus avant le lot 10a-1.

## 9. Ce qu'il te reste à décider

1. **Les chantiers « Terminé »** restent-ils cachés aux poseurs et à l'atelier, comme aujourd'hui ? Je le recommande : la liste reste courte, et le carnet d'un chantier terminé est purgé 30 jours après.
2. **Ton accueil à toi** (conducteurs et admin) : le même écran. Les chantiers dont tu es le conducteur (colonne D) arrivent tout seuls dans « Mes chantiers », et tu peux en retirer ou en ajouter comme les gars. D'accord ?
