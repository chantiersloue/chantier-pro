# Lot 4b — Carnet de chantier : hors réseau complet — procédure

> Plan : `docs/lot4-plan.md`, chapitre 7. Le lot 4a (`docs/lot4a-procedure.md`), le lot 4b et le retrait de la tuile « Plans » vont **en production ensemble**, dès que c'est prêt (décision de Franck du 13/11/2026, D4-12 : l'essai sur iPhone se fera avant la remise de l'appli aux poseurs). Serveur v9.0, appli 9.0. **Le retrait de la tuile « Plans » a modifié le serveur** : un envoi sur la copie TEST est nécessaire avant la production.

## Ce que le lot 4b ajoute, en bref

- **« ⬇ Tout télécharger »** sous chaque document, avec le poids restant, et un bouton pour **tout le chantier**. Une barre d'avancement, un bouton « Arrêter », et la reprise où on en était.
- Un document téléchargé en entier est marqué **« ✓ disponible sans réseau, en entier »** : toutes ses pages se lisent à tous les grossissements, sans réseau.
- **« ⚠ plus disponible en entier sans réseau »** quand le téléphone a fait de la place dans un document qui était complet.
- **Android, en Wi-Fi** : quand un poseur ouvre le carnet d'un chantier, les plans incomplets se téléchargent tout seuls (case « Télécharger les plans tout seul quand le téléphone est en Wi-Fi », cochée au départ). **iPhone** : le téléphone ne dit pas s'il est en Wi-Fi ; l'appli signale un nouvel indice et on appuie sur « Tout télécharger ».
- L'écran reste allumé pendant un téléchargement.

## À savoir (limites dites clairement)

- Un téléchargement ne continue **que si l'appli reste ouverte à l'écran** : une appli web ne travaille pas en arrière-plan. Si on la quitte, il reprendra où il en était.
- **Une seule demande à la fois** au serveur pendant un téléchargement (le serveur est partagé par toute l'entreprise) : compter environ **1 minute pour 5 Mo** en Wi-Fi, soit 3 à 4 minutes pour un dossier de trois grands plans.
- Le carnet d'un téléphone ne dépasse pas 400 Mo et laisse toujours 80 Mo libres. S'il n'a plus de place, le téléchargement s'arrête et le dit ; ce qui est déjà là reste lisible ; **les fiches et les brouillons passent toujours avant**.
- Le téléchargement automatique ne part **jamais** : en données mobiles ; pour un conducteur ou l'admin ; quand des fiches attendent d'être envoyées ; au-delà de 150 Mo de carnet ; après un arrêt par la personne (jusqu'à sa prochaine visite). Il ne part **pas depuis l'accueil** : il faut ouvrir le carnet du chantier (écart avec le plan, qui prévoyait « les plans de mes chantiers » dès l'ouverture de l'appli : sans écran gardé allumé ni bouton d'arrêt, cela coûtait au serveur sans servir).
- Un **partage de connexion** depuis un autre téléphone est vu comme du Wi-Fi : c'est dit dans le guide des poseurs.
- La place est vérifiée **avant** de commencer : un document qui ne tient pas est refusé avec les poids, sans rien effacer. Les documents téléchargés en entier ne sont jamais chassés par le téléchargement d'un autre.

## Étapes

1. **Envoi sur la copie TEST** (toi) : `node outilsenvoyer-test.js --avec-porte`. Je rejoue alors mes essais réels et je republie la copie d'essai.
2. **Tes essais sur téléphone** (liste courte donnée avec l'adresse) : le carnet marche toujours, la tuile « Plans » a disparu, le planning s'ouvre toujours.
3. **Dernier envoi** (toi) : `node outilsenvoyer-test.js --sans-porte`.
4. Production de l'ensemble : envoi `--sans-porte`, collage du serveur v9.0, nouveau déploiement, adresse, lien de fusion (`docs/lot4a-procedure.md`, étapes C à E).

## Retrait de l'ancienne tuile « Plans » — **décidé par Franck le 13/11/2026 : fait tout de suite**

> Les points 1 à 3 ci-dessous sont faits dans cette livraison. Pour le point 4 : lance `listerPartagesPlans()` dans l'éditeur Apps Script (choisis la fonction en haut, puis ▶ Exécuter ; si le journal dit « À suivre », relance-la). Elle remplit l'onglet « Partages Plans » et ne modifie rien dans le Drive. La proposition d'origine est gardée ci-dessous pour mémoire.
>
> **Attention** : ce retrait modifie le code du serveur (`apps-script/`), sans changer son numéro (v9.0). Contrairement à ce qui est écrit plus haut (« le serveur ne change pas entre 4a et 4b »), il faut donc un **nouvel envoi sur la copie TEST** avant les essais, et c'est le `Code.gs` de cette livraison qui ira en production.

**Aujourd'hui**, dans un chantier, la tuile « Plans » ouvre la liste des fichiers du dossier `Plans` du Drive du chantier, par des **liens Drive** : il faut du réseau, le PDF s'ouvre hors de l'appli, et les fichiers doivent être partagés « toute personne disposant du lien ».

**Ce que je propose, une fois le carnet en production et utilisé deux semaines sans souci :**
1. retirer la tuile « Plans » de la page d'un chantier (la tuile « Carnet » la remplace) ;
2. retirer du serveur la lecture du dossier `Plans` pour les chantiers (`getDossiers` pour un chantier) — **en gardant** celle du planning, qui passe par le même code ;
3. ne plus créer le sous-dossier `Plans` dans les nouveaux dossiers de chantier ;
4. te donner la liste des fichiers encore partagés « par lien » dans les dossiers `Plans`, pour que tu décides de retirer ces partages (c'est le gain de confidentialité : plus aucun plan accessible par un simple lien).

**Ce qui ne change pas** : les dossiers `Plans` existants et leurs fichiers restent dans le Drive ; rien n'est supprimé.

**Ce que tu perds** : la possibilité de montrer un PDF quelconque en le glissant dans le dossier `Plans` (sans passer par le dépôt au carnet). Si cet usage te sert encore, on garde la tuile.

**Ce que je te demande** : oui ou non, et si oui, tout de suite après la mise en production du carnet ou après deux semaines d'usage (ma recommandation : deux semaines, pour garder un secours).
