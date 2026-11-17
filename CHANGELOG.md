# Journal des modifications — ChantierPro

Chaque lot : **quoi**, **pourquoi**, **comment déployer**. Procédures détaillées dans `docs/lotN-procedure.md`.

## Lot 4c — retouche du 17/11/2026 : dossiers du Drive à ignorer (programme du PC seulement)

**Quoi** : une ligne facultative `"ignorer"` dans `_prive\depot.json` (numéros de chantier ou noms exacts de dossiers du Drive). Ces dossiers ne sont plus copiés, plus déposés, et ne reviennent plus dans « A VOIR ».
**Pourquoi** : un chantier archivé et des dossiers d'essai revenaient à chaque passage.
**Déployer** : rien à installer ; ajouter la ligne (voir `docs/lot4c-procedure.md`). Sans cette ligne, rien ne change. 79 tests.

## Lot 5 — Suivi du stockage, alertes et purge sur case cochée — serveur **v10.0**, aucune page ne change — **construit, testé contre le faux serveur seulement** (rien n'a tourné chez Google)

**Quoi**
- **Onglet « Stockage »** (rempli chaque nuit) : la place utilisée sur les 15 Go du compte, en Go et en %, la date de la mesure, une phrase d'état ; une ligne par chantier (poids total, dont carnet, fiches, photos, autres ; nombre de fichiers ; dernier dépôt au carnet ; anciens indices ; date de la mesure de la ligne) ; les lignes « Dossiers techniques », « Dossiers de la racine rattachés à aucun chantier », « Chantiers sans dossier » et « Reste du compte » (calculé seulement après un tour complet, jamais négatif).
- **Suivi de l'objectif de 35 à 40 chantiers en cours**, en haut de l'onglet : « Chantiers en cours », et après un tour complet « Poids moyen d'un chantier en cours » et « À ce rythme, place pour environ n chantiers en cours de plus avant 80 % » (calcul prudent).
- **La mesure** (`mesurerStockage` vers 2 h, `poursuivreMesureStockage` vers 3 h, qui ne fait quelque chose que si le tour n'est pas fini) : lecture seule dans Drive, arrêt propre au bout de 4 minutes, reprise où elle en était. Les fichiers à la corbeille ne sont pas comptés.
- **Deux sources pour la place du compte** : le service avancé Drive s'il est activé (total du compte, part de Drive, part de la corbeille), sinon `DriveApp` ; l'onglet dit laquelle est utilisée.
- **Mails d'alerte** à **80 %** (un mail au franchissement, puis un par mois au plus tant que la place reste au-dessus) et à **95 %** (toujours envoyé, puis un rappel par semaine). Un seuil n'est noté « prévenu » qu'après l'envoi réussi du mail.
- **Date « Terminé »** de l'onglet *Chantiers* : posée toute seule quand le statut passe à « Terminé », effacée s'il change ; une date saisie à la main n'est jamais remplacée.
- **Onglet « Purges »** : une ligne par chose qui peut partir à la corbeille de Drive, avec une case **« Mettre à la corbeille »** et une case **« Annuler »** (25 jours). Deux sortes de lignes : « Anciens indices du carnet » (les dossiers de documents que plus aucun document montré dans l'appli ne désigne) et « Chantier terminé » (fiches et photos, fichier par fichier ; puis le carnet).
- **Conditions d'un chantier terminé**, toutes obligatoires, et **revérifiées quand la case est traitée** : « Terminé » depuis **30 jours** (une constante, `PRG_JOURS_APRES_TERMINE`) ; dossier du chantier pris sur une ligne explicite de *Dossiers chantiers*, sans « À vérifier », porté par un seul chantier, et bien dans le Drive de cet environnement ; relevé `releve-pc.json` du bon chantier, de moins de 7 jours pour proposer et de **moins de 48 heures pour purger** (la recopie vers le PC est automatique, toutes les heures) ; chaque fiche du Drive retrouvée dans le relevé (même chemin, même taille, une ligne du relevé par fiche) ; aucun envoi en attente ni abandonné. La ligne dit toujours ce qui manque et quoi faire.
- **Le traitement des cases** (`traiterPurges`, toutes les 30 minutes) : sort tout de suite s'il n'y a rien à faire ; a son propre verrou et ne prend jamais celui des fiches ; écrit chaque fichier « à faire » dans l'onglet technique **« Purges détail »** avant de le mettre à la corbeille, puis « fait » ; reprend après une exécution coupée ; envoie un mail à Franck à chaque purge.
- **Ne partent jamais** : le dossier d'un chantier, les dossiers des fiches et des photos (ils restent, vides), le relevé, ce qui est hors des dossiers de l'appli. **Aucune suppression définitive nulle part** : la case « Vider la corbeille » du plan d'origine n'est pas construite.
- **Le relevé de présence s'appelle `releve-pc.json`** (précision de Franck du 14/11/2026) : il dit ce qui est dans le dossier du chantier sur le PC ; MEGA ne fait que sauvegarder ce dossier. L'ancien nom `mega-index.json` n'est pas accepté.
- **Programme du PC** (`outils/depot_carnet.py --verifier`) : un ancien indice dont le dossier a été purgé n'est plus signalé comme un défaut.
- **Installation en une fonction** : `installerLot5Test` / `installerLot5Production` (trois onglets, avertissement à la modification des colonnes du serveur, déclencheurs en production seulement). `verifierConfig` contrôle les onglets, la colonne J de *Chantiers* et donne la place du compte.
- **Porte de service de la copie TEST** : `installerLot5` et des lectures (place du compte, haut de l'onglet Stockage, lignes du chantier d'essai, examen de sa purge). Aucun geste ne met quoi que ce soit à la corbeille.

**Pourquoi** : à 100 % de la place, plus aucun fichier ne se crée dans Drive et plus aucun mail ne part ni n'arrive. Il faut voir venir, et pouvoir libérer la place des chantiers terminés sans rien perdre (exigence 5 du plan).

**Comment déployer** : `docs/lot5-procedure.md` (copie TEST d'abord, comparaison du chiffre avec one.google.com/storage, essais de Franck, puis production : coller `A-COLLER-DANS-APPS-SCRIPT/Code.gs`, `installerLot5Production`, nouveau déploiement). Aucune nouvelle autorisation Google n'est attendue ; le service avancé Drive est facultatif.

**Comment vérifier** : `node tests/lot5-stockage.test.js`, `node tests/lot5-mails.test.js`, `python -m unittest tests/test_depot_carnet.py`, et toutes les autres séries du serveur.

**Après la relecture indépendante du 16/11/2026** (aucun point bloquant ; tout est corrigé, avec un test par point) : une ligne dont le chantier affiché ne correspond plus à sa clé (tri d'une partie des colonnes) est refusée et remise en ordre, et le nom du mail vient de la clé ; le dossier d'un autre chantier rangé dans celui-ci n'est jamais parcouru et bloque la purge ; la place et les alertes passent avant tout contrôle d'onglet ; temps de purge plafonné à 30 minutes par jour (« la suite demain »), temps regardé avant chaque fichier, paquets de 10 ; un document montré par le carnet sans ses images est signalé ; la case n'agit que sur une ligne « Proposé » ; clé jamais réutilisée ; ligne en double refusée ; mail envoyé même si la ligne a disparu ; « 95 % » qui oscille : un seul mail ; « Annuler » arrête une purge en cours ; un dossier du carnet modifié depuis moins de 24 heures n'est pas touché ; tutoiement partout.

**Mails envoyés de plus de 3 mois** (décision de Franck du 16/11/2026) : une ligne de plus dans l'onglet *Purges*, proposée par la mesure de la nuit. Choix prudent : elle ne vise que les mails des **fiches de chantier** (liste fermée des objets : note de réunion, bordereaux, quitus, prise de cotes, fiche de fabrication, réception de support, attestation, signalement) **envoyés par l'appli**, avec pièce jointe, de plus de 90 jours, dont l'objet nomme un chantier connu et **dont le PDF est retrouvé dans le dossier Drive de ce chantier**. Jamais une demande d'absence, une fiche d'un chantier inconnu ou mal rangée, un mail reçu, un transfert, un brouillon, un mail suivi, « Important » ou portant un libellé, ni un mail dont le compte est lui-même destinataire. Même case cochée par Franck, même journal écrit avant (rien d'un mail non visé n'y est écrit), même annulation, même plafond de temps ; **corbeille de Gmail seulement, mail par mail, une seule lecture par mail** (service avancé Gmail : lister, lire, mettre à la corbeille, en sortir — rien d'autre). Sur la copie TEST (même compte Google), seuls les mails du chantier d'essai sont visés. **Rien ne prouve dans le dépôt que le service avancé Gmail est activé sur les projets** : `verifierConfig` le dit, et c'est le premier point des essais sur TEST.

**Délais d'une purge étalée sur plusieurs jours** (Drive comme Gmail) : « Annulation possible jusqu'au » et « Place libérée le » se comptent depuis la **plus ancienne** mise à la corbeille de la purge, et la ligne « En cours » les donne déjà.

**Un seul mail par fiche** (validé par Franck le 16/11/2026, avec la règle « rien ne change pour les adresses tapées à la main ») : **pas codé dans ce lot**. Note `docs/lot5-mail-unique.md` (pourquoi, deux solutions, recommandation). Un test photographie le chemin des adresses tapées à la main (`tests/lot0.test.js`) : il devra passer sans être modifié le jour où le mail unique sera codé.

**Reste à faire avec Franck, sur la copie TEST** : ce que mesure vraiment Google ; la durée d'un tour ; ce que devient le contenu d'un dossier mis à la corbeille, et sa restauration ; l'activation du service avancé Drive. Points à trancher : fin de `docs/lot5-procedure.md` (durée de 30 jours, seuil de 80 %, deux mesures pour Gmail, carnet d'un chantier clôturé).

**Décisions de Franck du 14/11/2026, intégrées** : alerte à 80 % (au lieu de 70 % et 85 %), purge 30 jours après la clôture (au lieu de 6 mois), relevé de moins de 48 heures, anciens indices proposés même sur un chantier en cours. L'estimation (`docs/lot5-plan.md`, chapitre 6) montre que Drive tient 40 chantiers en cours, mais que **les mails envoyés gardés par Gmail font déborder le compte en deux à trois ans** : deux mesures sont proposées, hors de ce lot.
## Lot 4c — Le programme du PC : carnet depuis les bordereaux, recopie automatique des fiches de l'appli — **construit, pas encore utilisé sur de vraies données**
## Lot 4c — Le programme du PC : recopie automatique des fiches de l'appli, dépôt automatique au carnet — **construit, pas encore utilisé sur de vraies données**

**Quoi**
- Un programme sur le PC de Franck, `outils/appli_pc.py`. Il fait le pont entre le Drive de l'appli et les **dossiers de chantier du PC** (ceux où travaillent les skills ; MEGA ne fait que les synchroniser).
- **Recopie automatique des fiches** (décision de Franck du 14/11/2026) : **une** tâche du Planificateur de tâches de Windows lance le programme **toutes les heures et à l'ouverture de la session de Franck**, sans fenêtre et sans question. Les **nouvelles** fiches que l'appli a rangées dans le Drive sont recopiées, au même chemin, dans le bon dossier de chantier du PC ; une fiche déjà copiée une fois n'est jamais recopiée (si Franck la déplace ou la supprime, son choix est respecté). Mise en place une seule fois, sans droits d'administrateur : double-clic sur **`outils\installer-tache.bat`** ; arrêt : `outils\retirer-tache.bat`.
- **Le bon dossier est trouvé par le numéro du chantier**, en tête du nom des dossiers (`403 - …`, `403-…`, `403 …`), pour les dossiers du Drive qui sont bien des dossiers de chantier de l'appli. Rien n'est deviné : aucun dossier pour ce numéro, ou plusieurs, ou une correspondance qui contredit le numéro, et rien n'est copié pour ce chantier. Une correspondance écrite à la main (`_prive/depot.json`, commande « Associer les chantiers ») sert pour un dossier sans numéro. Option « un seul chantier » (`--chantier NNN`, question du menu) pour le premier essai.
- **Copie seulement** : sous un nom temporaire, taille vérifiée, **jamais d'écrasement, de déplacement, de renommage ni de suppression**. Signalés sans copie : fichiers hors des dossiers de fiches, `_À CLASSER`, raccourcis Google, doublons `nom (1)`, chemins trop longs, fichiers illisibles, même nom mais autre taille. Jamais les demandes d'absence.
- **`CHANTIERPRO - A VOIR.txt`**, à côté des dossiers de chantier, réécrit quand sa liste change : ce qui demande l'attention de Franck, ou « Rien à signaler ». Le menu prévient si la recopie automatique n'a pas tourné depuis plus de 3 heures.
- Deux autres fichiers écrits : dans chaque dossier de chantier du PC, **`CHANTIERPRO - fiches rapatriees.json`** (la liste cumulée des fiches venues de l'appli, que les skills lisent) ; dans le Drive, **`releve-pc.json`** (le relevé de présence que le lot 5 lira avant toute purge : seulement les fiches du Drive réellement à leur place sur le PC, contenu vérifié pour celles que le programme n'a pas copiées lui-même ; il s'appelait « mega-index.json » dans le contrat précédent).
- **Dépôt automatique au carnet** (décision de Franck du 16/11/2026, qui remplace la confirmation document par document) : au même passage, sans question, le programme dépose au carnet (avec `depot_carnet.py`) les PDF des **bordereaux** (`08 - DOCUMENTS ENVOYES AVEC BORDEREAU/BORDEREAU n`) dont le numéro est dans la liste du carnet, et les PDF que Franck glisse dans un dossier **`À METTRE AU CARNET`** d'un chantier (forme complète des bordereaux, ou forme courte `<n° document>-<indice>-<INTITULÉ>.pdf`). **Les bordereaux d'un chantier ne déposent que si Franck a déclaré sa numérotation** (`--declarer NNN`, choix 6 du menu : « actuelle », ou une table d'anciens numéros propre au chantier, dont seuls les numéros partent) : un ancien numéro ne peut pas être pris pour un numéro d'aujourd'hui. Garde-fous : deux minutes sans que le fichier bouge, en-tête de PDF, 200 Mo au plus, limite de temps par passage avec reprise page par page. Rien n'est supprimé ni déplacé. Ce qui est déposé est listé sept jours dans « A VOIR » ; ce qui ne peut pas l'être y est signalé (nom non reconnu, numéro hors liste ou d'un autre chantier, même indice avec un autre contenu, contenus différents entre les deux sources, PDF illisible). **`outils\appli-pc.bat`** : tout traiter maintenant (même logique, sans question), voir seulement, lire « A VOIR », associer, retirer un document du carnet.
- Un seul traitement à la fois (verrou repris s'il est orphelin), refus avant toute écriture si un réglage est faux, journaux dans `_prive/appli-pc/` (celui des passages automatiques ne grossit pas sans fin).
- `docs/contrat-skills.md` passe en **version 5** : un skill n'écrit jamais dans le Drive de l'appli, qui n'a plus à être relié à Claude ; les textes à coller ne concernent plus que `gestion-documentaire` (chapitre 8) ; « dossier du chantier sur le PC » remplace « MEGA ».
- Ni le serveur ni les pages de l'appli ne changent.

**Pourquoi** : un skill voit le dossier du chantier sur le PC, pas le Drive de l'appli (essai A2, `docs/lot4-etape0.md`) ; le PC voit les deux. Plutôt que de faire écrire des « demandes » par neuf skills, le programme lit ce qu'ils produisent déjà : les bordereaux. Seule une version validée, et confirmée par Franck, part aux poseurs. Et les fiches des téléphones rejoignent l'archive sans aucune manipulation. Plan et critique indépendante : `docs/lot4c-plan.md`.

**Comment déployer** : rien à envoyer sur le serveur ni sur GitHub Pages. Marche à suivre de Franck (réglages, lignes à coller dans le skill, essais, installation de la tâche, limites, retour arrière) : `docs/lot4c-procedure.md`.

**Tests** : `python -m unittest tests/test_appli_pc.py` (78 tests, faux dossiers temporaires, aucune tâche planifiée créée) ; `python -m unittest tests/test_depot_carnet.py` (27). Corrigé le 16/11/2026 après deux relectures indépendantes (`docs/lot4c-plan.md`, chapitre 11). **Pas testé par moi** : le vrai Drive, les vrais dossiers de chantier, la copie TEST, **la création réelle de la tâche planifiée** (sa description n'est vérifiée que dans sa forme) et son lancement sans fenêtre, le double-clic sur les `.bat` au-delà du menu, et les lignes du contrat avec le vrai skill (essais obligatoires de la procédure).

## Lot 4b — Carnet de chantier : hors réseau complet, et retrait de la tuile « Plans » — appli 9.0, serveur **v9.1** — **en production depuis le 16/11/2026** (déploiement « Lot 4 — production »)

**Quoi**
- **« ⬇ Tout télécharger »** sous chaque document (poids restant annoncé) et pour tout le chantier : avancement, arrêt, reprise où on en était. Une seule demande à la fois au serveur.
- États dans la liste : **« ✓ disponible sans réseau, en entier »** ; **« ⚠ plus disponible en entier sans réseau »** quand le téléphone a fait de la place dans un document complet ; « ● Nouvel indice … téléchargez-le » sur les téléphones qui ne savent pas dire s'ils sont en Wi-Fi (iPhone).
- **Android en Wi-Fi** : à l'ouverture du carnet d'un chantier, les plans incomplets se téléchargent tout seuls (case à cocher, cochée au départ), pour les poseurs seulement, jamais au-delà de 150 Mo de carnet, jamais quand des fiches attendent d'être envoyées, et plus après un arrêt par la personne.
- La place se compte **avant** de commencer : un document qui ne tient pas est refusé avec les poids, sans rien effacer ; un document téléchargé en entier n'est jamais chassé par le téléchargement d'un autre.
- Un ancien indice téléchargé en entier reste lisible tant que le nouveau ne l'est pas aussi.
- L'écran reste allumé pendant un téléchargement.

**Retrait de l'ancienne tuile « Plans »** (décision de Franck du 13/11/2026)
- **Quoi, dans l'appli** : dans un chantier, la tuile « Plans » et sa fenêtre de documents n'existent plus (`index.html`) ; la tuile « Carnet » les remplace. Les tuiles Carnet, Signalements, Notes, les fiches et le **planning de l'équipe** ne changent pas.
- **Quoi, sur le serveur** (toujours v9.0) : le dossier `Plans` d'un chantier n'est plus lu. Une ancienne page encore gardée dans un téléphone qui demande les plans d'un chantier reçoit une **liste vide, sans erreur**. Le sous-dossier `Plans` n'est plus créé dans les nouveaux dossiers de chantier. La fonction `lireSousDossier` est supprimée. Le planning garde exactement son fonctionnement (lecture du dossier Planning, partage par lien de ses fichiers).
- **Pourquoi** : le carnet remplace la tuile (plans lus dans l'appli, au zoom, sans réseau, réservés aux comptes). Surtout, **la fin du partage par lien automatique** : jusqu'ici, chaque ouverture de la tuile mettait **tous** les fichiers du dossier `Plans` du chantier en « toute personne disposant du lien » ; un ancien salarié qui avait gardé un lien pouvait toujours ouvrir le plan. L'appli ne pose plus ces partages.
- **Rien n'est supprimé dans le Drive** : les dossiers `Plans` existants et leurs fichiers restent où ils sont, et **les partages par lien déjà posés restent** tant que Franck ne les retire pas.
- **Nouvelle fonction `listerPartagesPlans()`** (`apps-script/Admin.gs`, à lancer dans l'éditeur Apps Script) : écrit dans l'onglet **« Partages Plans »** les fichiers et dossiers encore partagés par lien dans les dossiers `Plans` des chantiers (chantier, chemin, nom, type de partage, date de modification, identifiant). **Lecture seule** : elle ne change aucun partage et ne supprime rien. Si le journal dit « À suivre », la relancer : elle reprend où elle s'était arrêtée. C'est Franck qui décide ensuite de retirer les partages, dans Drive.
- **Comment vérifier** : `node tests/accueil-page.test.js` (page d'accueil dans un vrai Chrome), `node tests/lot0.test.js`, `node tests/lot1-dossiers.test.js`, `node tests/lot2-comptes.test.js`.

**Pourquoi** : préparer son téléphone au dépôt ou en Wi-Fi, et savoir à tout moment si un plan est lisible sans réseau (exigence 9).

**Comment déployer** : `docs/lot4b-procedure.md`. Le serveur reste en v9.0 mais son code change avec le retrait de la tuile « Plans » : le `Code.gs` à coller est celui de `A-COLLER-DANS-APPS-SCRIPT/` de cette livraison.

## Lot 4a — Carnet de chantier : déposer et lire — serveur v9.1, appli 9.0 — **en production depuis le 16/11/2026** (déploiement « Lot 4 — production »)

**Quoi**
- Page **« Carnet »** (`carnet.html`), ouverte depuis un chantier : la liste des plans et documents validés (intitulé, indice, pages, poids, « nouveau »), et une visionneuse plein écran : un doigt déplace, deux doigts ou deux tapes grossissent, bouton de rotation, pages, « Signaler ici » (ouvre le signalement avec le chantier et le repère déjà remplis).
- Les plans sont des **images** (jamais le PDF) : un aperçu de la page d'abord, puis seulement les morceaux de la zone regardée. Ce qui a été vu reste dans le téléphone et se relit **sans réseau**.
- Programme de dépôt sur le PC : `outils/depot_carnet.py` et `outils/deposer.bat` (PDF → images dans `<chantier>/CARNET/`, liste `carnet.json` écrite en dernier ; reprise page par page ; `--verifier`, `--retirer` ; ne supprime jamais rien).
- Serveur : actions `carnet` et `carnetTuiles` (`apps-script/Carnet.gs`) ; droit vérifié à chaque demande ; aucun lien public, aucun identifiant Drive envoyé aux téléphones ; le serveur n'écrit et ne supprime rien dans le carnet. Aucun onglet nouveau, aucun mail.
- Dans le téléphone : base à part pour les plans, limitée (400 Mo, 80 Mo toujours laissés libres), rangée par compte.

**Pourquoi** : les poseurs lisent les plans validés sur leur téléphone, au zoom, même sans réseau, sans manipulation de fichier (exigence 9 du plan).

**Comment déployer** : `docs/lot4a-procedure.md`. Mesures préalables : `docs/lot4-etape0.md`.

## Lot 3 — Notes de chantier : la liste des choses à faire — serveur v8.0, appli 8.0 — **en production depuis le 13/11/2026** (déploiement « Lot 3 — production »)

**Quoi**
- Page **« Notes »** (`notes.html`), ouverte depuis un chantier : la liste des choses à faire du chantier, façon « Keep ». Un élément = une ligne de texte et une case à cocher ; on ajoute en bas de l'écran ; toucher un texte permet de le corriger ; un élément coché descend dans « Éléments terminés », d'où on peut le décocher. Rien ne se supprime. Hors réseau : ajouts et gestes sont gardés dans le téléphone et partent au retour du réseau, dans l'ordre.
- Toute personne qui a accès au chantier lit, ajoute, corrige, coche et décoche. À l'écran : ni auteur, ni date.
- Vue **« Tous chantiers »** pour les conducteurs et l'admin (lecture, recherche, « nouveaux », « avec les terminés », « tout marquer comme lu »).
- Accueil : tuile « Notes » dans chaque chantier, tuile « Notes de chantier » pour les conducteurs, chiffre rouge des éléments nouveaux.
- Serveur : onglets *Notes*, *Notes historique* (une ligne par geste : qui, quoi, quand — le filet de sécurité, invisible dans l'appli) et *Notes vues* ; droits vérifiés par le jeton ; **aucun mail**.
- Installation en une fonction : `installerLot3Test` / `installerLot3Production`.

**Pourquoi** : un pense-bête qui suit le chantier, pas la personne (`PLAN.md`, lot 3). **Simplifié le 13/11/2026 à la demande de Franck**, après ses essais de la première version (notes avec auteur, date, photos, corbeille, historique et export PDF : retirés, code compris). Décisions D3-1 à D3-4 ; plan : `docs/lot3-plan.md`, chapitre 14.

**Comment déployer** : `docs/lot3-procedure.md`.

**Tests** : serveur (`tests/lot3-notes.test.js`), page dans un vrai Chrome en largeur téléphone, hors réseau et en réseau lent (`tests/lot3-page.test.js`), essais réels sur la copie TEST (`tests/reel-lot3.js`) ; toutes les séries existantes repassent. **Pas testé par moi** : un vrai téléphone, en particulier le champ d'ajout avec le clavier ouvert.

## Lot 9b — Contrat avec les skills (12/11/2026) — un document, rien à déployer

**Quoi** : `docs/contrat-skills.md`, le contrat entre l'appli et les skills Claude de Franck : identité du chantier lue dans l'onglet *Chantiers*, intervenants transmis par un fichier que l'appli recopie, carnet, rapatriement des fiches de Drive vers MEGA avec son relevé. Textes à coller dans les skills (chapitre 8). **13/11/2026** : la règle sur les cotes de placards (métré des plinthes) est abandonnée et retirée.

**Pourquoi** : les lots 4, 5 et 8 en dépendent (`PLAN.md`, lot 9). Décisions D9b-1 à D9b-3. Principe retenu après une relecture indépendante : **un skill ne modifie jamais le Sheet de l'appli**.

**Comment déployer** : rien dans l'appli. **Rien n'est collé dans les skills pour l'instant** (décision de Franck du 13/11/2026, D9b-4) : tous les blocs seront mis à jour en une seule fois au lot 4.

**Pas vérifié** : aucun essai avec un vrai skill ni avec le vrai Sheet (hors de ma portée). Le contrat a été relu par un agent indépendant (trois tours) : les corrections sont listées à son chapitre 11.

## Lot 7 — Signalement casse / manquant / à recommander — serveur v7.0, appli 7.0 — **en production depuis le 13/11/2026** (déploiement « Lot 7 — production »)

**Quoi**
- Page **« Signaler »** (`signaler.html`), ouverte depuis un chantier : type et urgence en gros boutons, repère, commentaire, 0 à 3 photos, case « Prévenir l'atelier ». Brouillon automatique, rangement dans le téléphone, envoi au retour du réseau, comme les autres fiches.
- Page **« Signalements »** (`signalements.html`) : le suivi. Conducteurs, admin et atelier voient tout et changent le statut (À traiter / Commandé / Livré / Clos) ; chaque poseur voit les siens.
- Serveur : onglet *Signalements*, PDF (informations et photos) rangé dans `05 - CHANTIER/SIGNALEMENTS`, mail au conducteur du chantier à chaque fois, au chef d'atelier (Contacts, *ChefAtelier* = O) seulement si la case est cochée ; plafond de quota inchangé (mail reporté si besoin).
- Installation en une fonction : `installerLot7Test` / `installerLot7Production`.
- Ce lot emporte l'outillage du serveur (fonction d'installation unique, empreinte du serveur, `verifierConfig` complété).

**Pourquoi** : rien d'oublié sur le chantier, et un suivi visible par tous (`PLAN.md`, lot 7). Décisions D7-1 à D7-3 ; écart avec le plan général : un PDF au lieu des photos brutes en pièces jointes (D7-2).

**Comment déployer** : `docs/lot7-procedure.md`.

**Tests** : serveur 31 (`tests/lot7-signalement.test.js`), page dans un vrai Chrome en largeur téléphone 8 (`tests/lot7-page.test.js`), porte de service 48, essais réels sur la copie TEST (`tests/reel-lot7.js`), toutes les séries des lots précédents.

## Outillage — étape C (12/11/2026) — copie TEST seulement, aucun changement pour les téléphones ni pour la production

**Quoi** : 1. `node outils\envoyer-test.js` envoie le serveur sur la copie TEST avec clasp : c'est Franck qui la lance (2 lignes, 1 clic « Autoriser »), elle vérifie que le projet visé est bien celui de TEST, sauvegarde, envoie, contrôle en ligne par l'empreinte du serveur, et efface le jeton Google dans tous les cas. 2. Une « porte de service », présente seulement dans le serveur envoyé sur TEST, permet à Claude de lancer depuis le PC une liste fermée de gestes d'essai (`node outils/porte.js`). 3. Le serveur renvoie son empreinte (`ping`). 4. `verifierConfig` signale par un ❌ tout reste des outils d'essai hors de TEST.

**Pourquoi** : plus de copier-coller sur TEST, et des essais que Claude peut jouer seul contre le vrai serveur TEST (`docs/automatisation.md`, O-3 à O-5).

**Vérifié en vrai le 12/11/2026** : trois envois par clasp réussis (deux avec la porte, le dernier sans), jeton effacé à chaque fois ; après le dernier, la copie TEST exécute le serveur sans outils d'essai (la porte y répond « action inconnue ») ; déclencheur posé puis retiré par la porte ; démonstration complète (contrôle du lot 2, comptes d'essai, session d'essai acceptée puis annulée, lecture de l'onglet *Envois*, déclencheurs posés puis retirés, copie TEST remise en ordre).

**Comment déployer** : rien en production. Le code est sur la branche `outillage` et entrera dans `main` avec le lot 7. Modes d'emploi : `docs/guide-outillage.md`, `docs/clasp.md`. Pas fait (reporté au lot 7, qui en aura besoin) : les gestes qui touchent à Drive, et l'envoi d'une fiche par un navigateur piloté avec une session d'essai.

## Outillage — étapes A et B (12/11/2026) — outils du PC seulement, aucun changement pour les téléphones

**Quoi** : 1. `main` est verrouillée sur GitHub : plus rien n'y entre sans demande de fusion. 2. `node outils/lien-fusion.js` prépare le lien qui ouvre une demande de fusion déjà remplie (serveur changé ou non, pages changées ou non, empreinte du `Code.gs`) : il reste 3 clics à Franck. 3. La copie d'essai sort de ce dépôt : `node outils/publier-essai.js` la fabrique dans un dossier voisin et la publie dans un dépôt à part (organisation GitHub gratuite), à sa propre adresse, toujours en mode TEST. 4. Prêt mais pas encore en service (branche `outillage`) : l'installation d'un lot en une seule fonction Apps Script.

**Pourquoi** : que Claude fasse seul le maximum pour les prochains lots, sans jamais pouvoir publier la production à la place de Franck (`docs/automatisation.md`, décisions O-2 à O-4).

**Comment déployer** : rien à mettre dans Apps Script, rien ne change pour les poseurs. Franck : fusionner la demande `livraison/outillage` (documents et outils) ; créer l'organisation et le dépôt d'essai (`docs/outillage-plan.md`, séance B). Mode d'emploi : `docs/guide-outillage.md`. Reste à faire : étape C (clasp et porte de service sur TEST).

## Lot 2 — Comptes, rôles, accueil (avec 9a) — serveur v6.0.1, appli 6.0.1 — **en production depuis le 12/11/2026**

**En production (12/11/2026)** : le serveur v6.0.1 tourne sous le déploiement « Lot 2 — production » ; la demande de fusion `livraison/lot-2` (n° 10) est fusionnée : vraies pages 6.0.1, copie d'essai `essai/` retirée. Vérifié par Franck : « À propos » affiche 6.0.1, connexion avec son compte, quitus réel envoyé et reçu. L'ancien déploiement (lot 1) reste en service comme retour arrière jusqu'à la fin de la transition ; d'ici là, les gars sans compte touchent « Continuer sans compte » et l'appli marche comme avant.

**Reste à la charge de Franck** : 1. le jour où il voit les poseurs, installer l'appli sur chaque téléphone (iPhone surtout : c'est aussi l'étape D.11 du lot 1) et remettre à chacun son mot de passe provisoire ; 2. quand tout le monde est connecté et en 6.0.1, lancer `demarrerTransition` ; 3. à la fin de la transition, archiver les anciens déploiements (jamais « Lot 2 — production »). Détail : `docs/lot2-procedure.md`, étape D, points 8 à 10.

**Lot suivant** : pas commencé. Franck répond d'abord aux six décisions de `docs/automatisation.md`.

**Correctif 6.0.1 (après les essais sur TEST)** : essai 12, le bouton ne reste plus bloqué sur « Rangement dans le téléphone… » (même correctif que la 5.1.1 de production) ; essai 14, la colonne État dit « bloqué » dès le 5e essai raté ; journal des incidents dans « À propos » ; nouveau test `node tests/hors-ligne.test.js` (vrai Chrome hors-ligne, avec un autre onglet qui occupe la mémoire du téléphone). Procédure : `docs/lot2-procedure.md`, section « Correctif après tes essais ».

**Quoi**
- **Comptes** : identifiant + mot de passe (connexion une fois tous les 90 jours). Onglet *Utilisateurs* : rôle, case « Réinitialiser » (mot de passe provisoire de 48 h, déblocage, déconnexion), case « Déconnecter ses téléphones », case « Tous les chantiers ». Empreintes des mots de passe dans les Propriétés du script, jamais dans le Sheet. 5 erreurs = 15 min de blocage ; alerte à Franck au-delà de 50 échecs par heure.
- **Droits vérifiés par le serveur** : un poseur ne lit que **ses** chantiers (onglet *Accès chantiers*) et leurs plans ; conducteurs et admin voient tout. Une fiche reste possible pour n'importe quel chantier (auteur noté dans *Envois*).
- **Accueil** : Connexion → Mes chantiers (recherche, derniers ouverts) → fiches du chantier **pré-remplies** + Plans ; Planning, Absence, « Fiche sans chantier choisi » ; « Remplir une fiche sans être connecté » toujours proposé ; À propos : compte, se déconnecter, changer de mot de passe.
- **File d'envoi** : une fiche sans compte ou avec une session terminée attend la connexion (jamais « à vérifier ») et repart dès la connexion. Une panne du serveur ne déconnecte personne.
- **Brouillon** : un chantier pré-rempli ne crée pas de faux brouillon ; le bandeau « Brouillon retrouvé » affiche le chantier du brouillon.
- **Période de transition** de 15 jours, lancée par Franck (`demarrerTransition`) : l'appli marche encore sans compte (onglet *Sans compte*), puis plus rien n'est lisible sans compte. Mail 3 jours avant la fin.
- **9a** : colonnes E à K de *Chantiers* (N°, nom court, adresse, client, architecte, date « Terminé », chemin MEGA) ; nom court dans le nom des PDF ; onglet *Intervenants* créé.
- **Chantier inconnu** : plus de dossier Drive créé par une faute de frappe : le PDF va dans `_À CLASSER` et Franck est prévenu.

**Pourquoi** : chaque gars voit ses chantiers et rien d'autre, et la liste des contacts n'est plus lisible par quiconque connaît l'adresse du serveur.

**Comment déployer** : `docs/lot2-procedure.md` (étapes A à D : serveur TEST, comptes d'essai, essais sur la copie d'essai `livraison/lot-2-essai`, production avec un **nouveau déploiement**).

**Mise à jour avec le lot 1 en production (10/11/2026)** : retouches du lot 1 reprises ; versions 6.0 ; `node outils/construire.js --verifier` refuse désormais un marqueur de conflit oublié ou un script illisible (un service worker cassé avait échappé au contrôle sur la branche du lot 2, jamais en production) ; envoi direct (téléphone qui ne peut pas garder la fiche) : connexion dans la page, sans la quitter ; listes de secours la 1re fois sans réseau ; fiches restées « à vérifier » sur l'appli 5.1 reprises par la 6.0.

**Tests** : `node tests/lot2-comptes.test.js` (44 tests) + tests des lots 0 et 1 ; pages essayées dans le navigateur avec le faux serveur (comptes d'essai), en 375 px.

## Lot 1 — Correctif 5.1.1 : bouton bloqué sur « Rangement dans le téléphone… » — prêt pour la production

**Quoi** : la fiche et ses photos sont rangées dans le téléphone en une seule opération, annulée net au bout de 12 s si la mémoire est bloquée (rien n'est écrit en retard). La fiche part alors directement si le réseau est là ; sinon un message qui **reste à l'écran** dit quoi faire (garder la page ouverte, fermer les autres fenêtres de l'appli et ses onglets dans Chrome, toucher Envoyer de nouveau sans rien changer) et le texte reste en brouillon. Le 2e appui garde le même numéro de fiche : pas de 2e mail. Le brouillon d'une fiche rangée n'est plus jamais reproposé, même si son effacement tarde. La sauvegarde automatique du brouillon a aussi une limite (8 s, puis bandeau rouge). Nouveau : un journal des incidents dans « À propos » (30 jours : rangement bloqué ou lent, sauvegarde bloquée, file occupée), à transmettre au bureau.

**Pourquoi** : essai 12 du lot 2 (Motorola, appli installée, mode avion) : le bouton restait bloqué plus de 2 min sans message. Reproduit sur PC quand un AUTRE onglet de l'appli garde la mémoire du téléphone occupée (Android fige les onglets en arrière-plan) : la page attendait sans limite. Même défaut dans l'appli 5.1 en production (même code de rangement).

**Comment déployer** : fusionner la demande `livraison/lot-1-correctif-file`. Rien à changer dans Apps Script. « À propos » affiche ensuite **5.1.1**.

## Lot 1 — Retouches après les essais (serveur v5.1, appli 5.1) — en production depuis le 10/11/2026

**Quoi**
- **R1 — Photos et croquis en grand dans les PDF** (fabrication, quitus, bordereaux, attestation, note de réunion, réception support) : la 1re photo se place sous le contenu de la page 1 et prend toute la place restante ; chaque croquis a une page entière ; les autres photos ont leur page (deux par page quand elles y gardent leur taille). Les petites images sont agrandies, proportions gardées. Quitus, bordereaux, attestation : les signatures passent avant les photos. Croquis dessinés en résolution double. Le serveur vérifie chaque PDF qui contient des photos et le refait une fois s'il a une page de trop (il garde le meilleur des deux). Nouvelle fonction `essaiMiseEnPage` (TEST, sans mail).
- **R2 — Bordereau matériaux** : nouvel onglet **« Matériaux bordereau »** (créé par `verifierConfig`) ; le Type remplit la case **« Matériaux remis »** (modifiable), qui apparaît dans le PDF.
- **R3 — Sablier** : une fiche partie dont la réponse s'est perdue est redemandée en quelques secondes (et dès le retour dans l'appli) ; le sablier disparaît dès que le serveur confirme. Aucun mail en double (numéro unique, y compris pour l'envoi direct de secours).

**Pourquoi** : retours de Franck après les essais 1 à 18 sur la copie TEST.

**Comment déployer** : `docs/lot1-procedure.md`, section « Retouches » (coller `Code.gs` v5.1 sur TEST, `verifierConfig`, `essaiMiseEnPage`, puis fusionner `livraison/lot-1-essai-2`).

**Tests** : `node tests/lot1-retouches.test.js` (29) ; `node tests/pdf-mise-en-page.js` (23 PDF fabriqués par Chrome) ; file d'envoi essayée dans le navigateur avec le faux serveur (réponse perdue, envoi lent, retour dans l'appli).

## Lot 1 — Fondations (serveur v5, appli 5.0) — en production depuis le 10/11/2026 (avec les retouches, v5.1)

**État au 10/11/2026** : serveur v5.1 collé et déployé en production ; pages fusionnées (demande de fusion #6) ; appli 5.1 essayée sur le téléphone de Franck ; anciens documents du vrai Drive rangés (étape E). **Reste** : l'installation de l'appli sur les iPhone des poseurs (étape D.11), faite le jour où Franck les voit (en même temps que la distribution des mots de passe du lot 2). La copie d'essai `essai/` a été retirée du site.

**Quoi**
- **Envoi sûr** : chaque fiche est rangée dans le téléphone (IndexedDB) puis envoyée ; elle n'est retirée que quand le serveur répond « enregistrée ». Renvoi automatique au retour du réseau, à l'ouverture, au retour dans l'appli. Numéro unique par fiche : jamais de double envoi. Indicateur permanent « ✓ Tout est envoyé » / « ⏳ N en attente ».
- **Serveur v5** : réponses lisibles (`{ok, code, message}`), photos envoyées une par une, onglet *Envois*, verrou, erreurs claires ; l'ancien format reste accepté.
- **Briques communes** (`commun/`) : configuration, appels serveur, messages, photos compressées (1600 px, environ 350 Ko), signatures, brouillon automatique complet (photos dans IndexedDB, bandeau rouge s'il ne peut pas être gardé), destinataires, mode hors-ligne.
- **Un seul modèle par document** (`modeles/`) : l'aperçu, l'impression et le PDF du mail viennent du même modèle. Boutons Imprimer / Enregistrer en PDF.
- **Toutes les pages migrées** : prise de cotes, fabrication (+ **lot 6** : précision libre du délai, colonne M de *Fabrication*), note de réunion, bordereaux (une seule page), quitus, attestation, réception support, absence, accueil. Bugs de l'audit corrigés page par page (liste dans `DECISIONS.md`).
- **Retours terrain** : brouillon de l'attestation avec photos (« Erreur sauvegarde ») ; adresse tapée sans bulle ajoutée à l'envoi ou envoi bloqué ; nouvelle version reçue tout de suite après une fusion.
- **iPhone** : écran « Installer l'appli » ; avertissement sur les fiches tant qu'elle n'est pas installée. **À propos** : version, installation, place utilisée, fiches en attente, mises à jour.
- **Rangement Drive (1.5)** : noms des dossiers dans `dossiers.json` ; dossiers du skill `gestion-documentaire` (`05 - CHANTIER/…`, `07 - ATELIER`, `ADMINISTRATIF/ABSENCES`) ; nommage `<INTITULÉ> <CHANTIER> <AAAA-MM-JJ>[_Vn]` ; onglet *Dossiers chantiers* ; `planMigration` / `executerMigration` / `annulerMigration`.
- **Livraison** : serveur complet en un seul fichier `A-COLLER-DANS-APPS-SCRIPT/Code.gs` ; copie d'essai `essai/` (`node outils/essai.js`), toujours en mode TEST.

**Pourquoi** : zéro fiche perdue avec un réseau faible, un PDF identique à l'aperçu, un code commun maintenable, et le rangement Drive aligné sur MEGA.

**Comment déployer** : `docs/lot1-procedure.md` (étapes A à E : serveur TEST, copie d'essai, essais, production, migration Drive).

**Tests** : `node tests/lot0.test.js`, `node tests/lot1-api.test.js`, `node tests/lot1-dossiers.test.js` (services Google simulés) ; chaque page essayée dans le navigateur avec le faux serveur (`tests/faux-serveur.js`) en 375 px et sur PC, hors-ligne et réseau lent.

## Lot 0 — Correctif : listes vides sur 4 pages — en production

**Quoi** : `attestation.html`, `reception-support.html`, `absence.html` et `index.html` (Chantiers, Planning, documents d'un chantier) chargent maintenant leurs listes comme les 6 autres pages : d'abord un appel **anonyme** (sans les cookies Google), puis l'ancienne méthode (JSONP) seulement si le premier échoue. Aucun autre changement.

**Pourquoi** : à l'étape C, sur la copie TEST, ces 4 pages restaient vides (essais 7, 8, 9 et 12). Elles n'utilisaient que le JSONP, qui envoie les cookies du compte Google connecté et se comporte différemment selon ce compte (règle 3 du CLAUDE.md).

**Comment déployer** : valider la demande de fusion (pull request) `livraison/lot-0-correctif` sur GitHub, attendre quelques minutes, recharger la page (sur le téléphone : fermer puis rouvrir l'appli), puis refaire les essais 7, 8, 9 et 12 de l'étape C. Rien à changer dans Apps Script.

Au passage, les délais d'attente de l'accueil passent à 15 secondes, comme sur les autres pages.

## Lot 0 — Sécurité urgente (Apps Script v4.1) — en production (remplacé par le serveur v5.1 du lot 1)

**Quoi**
- Mails : une adresse du Sheet (*Contacts*, *Contacts notes*) reçoit le mail habituel. Une adresse tapée à la main reçoit un mail **au texte imposé** + le PDF, 2 par fiche et 10 par jour au maximum, avec le conducteur du chantier (ou Franck) en copie cachée. Chaque envoi ou refus est noté dans l'onglet **Journal**.
- Quota : en dessous de 20 mails restants dans la journée, seuls les mails de Franck partent. Les autres vont dans **Mails en attente** et repartent toutes les 2 h.
- Partages : plus aucun partage public automatique, sauf le dossier *Plans* et le *Planning*. Fonctions `listerPartages` / `retirerPartages` / `remettrePartages`.
- Tuile *Chantiers* : seul l'onglet *Plans* est affiché.
- Textes saisis rendus inoffensifs dans les PDF et les mails ; formules neutralisées dans le Sheet ; signatures et photos contrôlées.
- Identifiants Drive retirés du code (Propriétés du script) et de CLAUDE.md.
- **Adresse Apps Script écrite à un seul endroit** : `commun/config.js`, avec un mode test `?env=test` (bandeau rouge).
- Bugs corrigés au passage :
  - destinataire de secours vide (le mail ne partait pas) ;
  - fiche de fabrication qui échouait entièrement si un mail échouait ;
  - bordereaux rangés dans « Quitus » (maintenant « Bordereaux ») ;
  - type de fiche inconnu traité comme une prise de cotes ;
  - tri des documents par date faux d'un mois sur l'autre.
- Outils : `verifierConfig`, `installerDeclencheurs`, `anonymiserCopieTest` (copie TEST uniquement).

**Pourquoi** : n'importe qui connaissant l'adresse Apps Script (publique) pouvait envoyer des mails au nom de Loué et vider le quota. Par ailleurs, l'ouverture d'un chantier dans l'appli partageait publiquement tous ses fichiers.

**Comment déployer** : `docs/lot0-procedure.md` (étapes A à D).

**Tests** : `node tests/lot0.test.js` (30 tests, services Google simulés) ; les 10 pages chargées sans erreur en mode test et en mode production.
