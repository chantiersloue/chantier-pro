# Lot 3 — Notes de chantier : procédure de déploiement et de test

> Pour Franck. Le lot 3 passe le serveur en **v8.0** et l'appli en **8.0**.
> **Cette procédure ne commence qu'après la mise en production du lot 7.** D'ici là, le lot 3 n'existe que sur la branche `lot-3` : il a été testé contre un faux serveur sur mon poste, jamais contre la copie TEST, jamais sur un vrai téléphone.
> **Ne passe à l'étape suivante que si la précédente est verte.** Sinon : arrête-toi et envoie-moi une capture.
> Plan : `docs/lot3-plan.md`. Outillage : `docs/guide-outillage.md`.

## Ce que le lot 3 change, en bref

- Une tuile **« Notes »** dans chaque chantier : le pense-bête de l'équipe. On écrit en bas de l'écran (texte, micro du clavier, 0 à 3 photos), même sans réseau ; la note part toute seule dès que le réseau revient. **Aucun mail.**
- Chaque note a une grosse case **« Fait »** (qui l'a cochée, et quand). L'auteur et les conducteurs peuvent la modifier ou la supprimer ; une note supprimée va dans une **corbeille**, d'où les conducteurs peuvent la **restaurer** (rien n'est jamais effacé pour de bon).
- Une pastille **« nouveau »** et un chiffre rouge sur l'accueil signalent les notes écrites par les autres depuis ta dernière visite du chantier.
- Pour les conducteurs et l'admin : une tuile **« Notes de chantier »** à l'accueil (toutes les notes, avec filtres et recherche), et un bouton **« Exporter en PDF »** par chantier (le PDF est rangé dans `05 - CHANTIER/COMPTE RENDU`).
- Trois nouveaux onglets dans le Sheet, créés par la fonction d'installation : *Notes*, *Notes historique*, *Notes vues*. Les photos des notes sont rangées dans `05 - CHANTIER/PHOTOS CHANTIER/NOTES` du dossier du chantier.

## Avant de commencer

Le lot 7 est en production, et je t'ai confirmé que la branche du lot 3 a été remise à jour par-dessus.

## Étape A — Copie TEST (toi : 2 minutes)

1. Si tu l'avais désactivée : réactive **« API Google Apps Script »** sur `script.google.com/home/usersettings`.
2. À ma demande, dans PowerShell :
   ```
   cd $HOME\Documents\GitHub\chantier-pro
   ```
   ```
   node outils\envoyer-test.js --avec-porte
   ```
   Page Google → compte de Loué → **Autoriser**. Attends `✅ Envoi réussi`, puis dis-moi « envoi fait ».
3. Je fais le reste sans toi : installation du lot sur TEST, essais contre le vrai serveur TEST (y compris un vrai PDF avec photos, que le faux serveur ne sait pas fabriquer), publication de la copie d'essai.

## Étape B — Tes essais sur téléphone (20 min)

Fais tous tes essais sur le chantier **« CHANTIER TEST AUTO »** de la copie TEST. Ouvre la copie d'essai (icône **« Loué ESSAI »**, bandeau rouge ; « À propos » affiche **8.0**) et connecte-toi avec ton compte d'essai Admin.

| # | Essai | Attendu |
|---|---|---|
| 1 | Ouvre CHANTIER TEST AUTO → **Notes**. **Mode avion.** Écris une note **en la dictant au micro du clavier**, ajoute une photo prise avec l'appareil, **Ajouter la note** | La note apparaît tout de suite en haut, marquée « ⏳ en attente d'envoi » ; la zone de saisie se vide |
| 2 | Commence une 2e note, **ferme l'appli sans l'ajouter**, rouvre-la au même endroit | Ton texte est revenu dans la zone de saisie, sans question |
| 3 | Coupe le mode avion | « ⏳ » disparaît tout seul. **Aucun mail** n'arrive. Touche « 📷 Voir la photo » : elle s'affiche |
| 4 | Touche **Marquer « Fait »** | La note est barrée, « Fait par (toi) le … » |
| 5 | **Modifier** → change le texte → **Enregistrer**, puis **Historique** | Le nouveau texte ; l'ancien est dans l'historique |
| 6 | **La barre de saisie avec le clavier ouvert** (iPhone surtout) | La zone de texte et le bouton « Ajouter la note » restent visibles au-dessus du clavier. **C'est le point que je n'ai pas pu tester : dis-moi ce que tu vois** |
| 7 | **Supprimer** une note, puis **🗑 Corbeille** → **Restaurer** | Elle disparaît, se retrouve dans la corbeille, puis revient |
| 8 | **Exporter en PDF** | « PDF rangé dans le dossier du chantier ». Dans le Drive TEST, dossier du chantier → `05 - CHANTIER/COMPTE RENDU` : ouvre le PDF, vérifie le texte **et la photo** |
| 9 | Retour à l'accueil → tuile **Notes de chantier** | Toutes les notes ; tape un mot dans « Chercher » : la liste se réduit. **Tout marquer comme lu** remet à zéro le chiffre rouge de l'accueil |
| 9 bis | Écris une note qui commence par un signe **+** (par exemple « +2 cales au R+1 ») | Elle s'affiche telle quelle dans l'appli, **sans apostrophe devant**. Si une apostrophe apparaît, dis-le-moi |
| 10 | Avec un second téléphone (ou en te connectant avec un compte d'essai Poseur dont le chantier est coché) | Il voit tes notes avec la pastille « nouveau », peut cocher « Fait », mais n'a ni « Modifier » ni « Supprimer » sur **tes** notes, ni corbeille, ni PDF |
| 11 | Sur Android (Chrome) : le bouton **🎤** de la zone de saisie | Il écrit ce que tu dis (il lui faut du réseau). Sur iPhone, ce bouton n'existe pas : c'est normal, le micro du clavier fait le travail |
| 12 | Dans le Sheet TEST | Onglet *Notes* : une ligne par note. Onglet *Notes historique* : ta modification |

Dis-moi ce que tu as vu, puis ton feu vert.

## Étape C — Dernier envoi sur TEST avant la production (toi : 2 minutes)

Sur ma demande :
```
node outils\envoyer-test.js --sans-porte
```
La copie TEST exécute alors le fichier exact qui ira en production. Écris une note (avec réseau) pour le confirmer.

## Étape D — Production (30 min)

Le serveur du lot 3 a sa **propre adresse** : le déploiement du lot 7 continue de servir les téléphones tant que les pages ne sont pas fusionnées. C'est aussi le retour arrière.

1. Vrai Sheet → Extensions → Apps Script. **Sauvegarde** : `Code.gs`, Ctrl+A, Ctrl+C, colle dans un fichier `_prive/Code-avant-lot3.gs`.
2. **Gérer les déploiements** : note la description et l'adresse du déploiement actuel (« Lot 7 — production ») dans `_prive/deploiements.txt`.
3. Colle le nouveau `Code.gs` (je te donne le lien du fichier, branche `livraison/lot-3`) : Ctrl+A, Ctrl+V, disquette.
4. Vérifie que la propriété `ENVIRONNEMENT` n'est **pas** `TEST`, et qu'il n'y a **pas** de propriété `CLE_OUTILS_TEST`.
5. ▶ **`installerLot3Production`**. Le bilan doit montrer `environnement : PRODUCTION`, `serveur v8.0`, trois lignes ✅ (les onglets *Notes*, *Notes historique*, *Notes vues*), puis `✅ Lot 3 : installation terminée.`. Une ligne ❌ : arrête-toi et envoie-la-moi.
6. ▶ **`verifierConfig`** : première ligne `Loué App API v8.0`, aucun ❌.
7. **Déployer → Nouveau déploiement** → « Application Web », description **« Lot 3 — production »**, exécuter en tant que **moi**, accès **Tout le monde** → Déployer. Ouvre la nouvelle adresse : **`Loué App API v8.0 OK`**. **Envoie-moi l'adresse.**
8. Je vérifie l'empreinte du serveur, je mets l'adresse dans les pages et je te donne le **lien pré-rempli** : **Create pull request**, **Merge pull request**, **Confirm merge**.
9. Trois minutes plus tard, sur ton téléphone (vraie appli) : « À propos » affiche **8.0**. Ouvre un chantier → **Notes** → écris une note → elle apparaît, une ligne dans l'onglet *Notes* du vrai Sheet.
10. Montre la tuile « Notes » aux gars.

## À savoir

- **Qui voit quoi** : toute personne qui a accès au chantier (case cochée dans *Accès chantiers*, ou conducteur / admin) lit et écrit ses notes. Un compte Atelier aussi, pour les chantiers cochés pour lui.
- **Compte désactivé** : ses notes en attente ne partent plus (elles restent dans son téléphone). C'est différent des fiches, qui sont acceptées pendant 7 jours.
- **Téléphone partagé** : une note écrite par Paul et pas encore partie ne part jamais sous le nom de Pierre ; elle attend que Paul se reconnecte sur ce téléphone.
- **Tu renommes un chantier dans le Sheet** : remplace aussi son nom dans la colonne B de l'onglet *Notes* (Édition → Rechercher et remplacer, « Rechercher dans cette feuille »), sinon ses notes restent sous l'ancien nom.
- **Ne modifie rien d'autre à la main** dans les onglets *Notes*, *Notes historique* et *Notes vues*. Tu peux les trier et les filtrer.
- **Stockage** : une photo de note pèse environ 0,3 Mo. Cent photos par chantier font 30 Mo.

## Retour arrière

| Problème | Que faire |
|---|---|
| Les gars ne peuvent plus travailler après la fusion | Dis-le-moi : je prépare une demande de fusion qui remet **les pages 7.0 et l'adresse du lot 7** (son déploiement tourne encore). Rien à faire dans Apps Script |
| Une note restée dans un téléphone après ce retour | L'ancien serveur répond « type inconnu » : la note reste dans le téléphone, marquée « à vérifier ». Rien n'est perdu ; elle repartira avec « Réessayer » quand le lot 3 sera remis |
| Revenir aussi à l'ancien serveur | Recolle `_prive/Code-avant-lot3.gs`, enregistre. Les trois onglets peuvent rester : l'ancien serveur les ignore |

## Après la production

- Quand tous les téléphones sont en 8.0 depuis une semaine : **Gérer les déploiements** → archive « Lot 7 — production ». **N'archive jamais « Lot 3 — production ».**
- Désactive « API Google Apps Script » jusqu'au lot suivant.
