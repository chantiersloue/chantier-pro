# Lot 4b — Carnet de chantier : hors réseau complet — procédure

> Plan : `docs/lot4-plan.md`, chapitre 7. Le lot 4a (`docs/lot4a-procedure.md`) et le lot 4b iront **en production ensemble**, après l'essai sur iPhone (décision de Franck du 13/11/2026, D4-9). Le serveur ne change pas entre 4a et 4b : il reste en v9.0. L'appli reste en 9.0.

## Ce que le lot 4b ajoute, en bref

- **« ⬇ Tout télécharger »** sous chaque document, avec le poids restant, et un bouton pour **tout le chantier**. Une barre d'avancement, un bouton « Arrêter », et la reprise où on en était.
- Un document téléchargé en entier est marqué **« ✓ disponible sans réseau, en entier »** : toutes ses pages se lisent à tous les grossissements, sans réseau.
- **« ⚠ plus disponible en entier sans réseau »** quand le téléphone a fait de la place dans un document qui était complet.
- **Android, en Wi-Fi** : les plans incomplets se téléchargent tout seuls (case « Télécharger les plans tout seul quand le téléphone est en Wi-Fi », cochée au départ). Sur la page Carnet d'un chantier pour tout le monde ; depuis l'accueil pour les chantiers d'un poseur (5 au plus). **iPhone** : le téléphone ne dit pas s'il est en Wi-Fi ; on appuie sur « Tout télécharger ».
- L'écran reste allumé pendant un téléchargement.

## À savoir (limites dites clairement)

- Un téléchargement ne continue **que si l'appli reste ouverte à l'écran** : une appli web ne travaille pas en arrière-plan. Si on la quitte, il reprendra où il en était.
- **Une seule demande à la fois** au serveur pendant un téléchargement (le serveur est partagé par toute l'entreprise) : compter environ **1 minute pour 5 Mo** en Wi-Fi, soit 3 à 4 minutes pour un dossier de trois grands plans.
- Le carnet d'un téléphone ne dépasse pas 400 Mo et laisse toujours 80 Mo libres. S'il n'a plus de place, le téléchargement s'arrête et le dit ; ce qui est déjà là reste lisible ; **les fiches et les brouillons passent toujours avant**.
- Le téléchargement automatique ne part jamais en données mobiles, ni pour un conducteur ou l'admin depuis l'accueil (ils voient tous les chantiers).

## Étapes

Le serveur étant le même qu'au lot 4a, **aucun envoi clasp n'est nécessaire pour le 4b** tant que `apps-script/` ne change pas : la copie TEST a déjà le serveur v9.0.

1. Je publie la copie d'essai (pages du 4b) et je rejoue mes essais réels sur la copie TEST.
2. **Tes essais sur téléphone** (liste donnée avec l'adresse).
3. Essai sur **iPhone** (4a et 4b).
4. Production des deux lots ensemble : envoi `--sans-porte`, collage du serveur v9.0, nouveau déploiement, adresse, lien de fusion (`docs/lot4a-procedure.md`, étapes C à E).

## Proposition : retirer l'ancienne tuile « Plans » (à décider par Franck)

**Aujourd'hui**, dans un chantier, la tuile « Plans » ouvre la liste des fichiers du dossier `Plans` du Drive du chantier, par des **liens Drive** : il faut du réseau, le PDF s'ouvre hors de l'appli, et les fichiers doivent être partagés « toute personne disposant du lien ».

**Ce que je propose, une fois le carnet en production et utilisé deux semaines sans souci :**
1. retirer la tuile « Plans » de la page d'un chantier (la tuile « Carnet » la remplace) ;
2. retirer du serveur la lecture du dossier `Plans` pour les chantiers (`getDossiers` pour un chantier) — **en gardant** celle du planning, qui passe par le même code ;
3. ne plus créer le sous-dossier `Plans` dans les nouveaux dossiers de chantier ;
4. te donner la liste des fichiers encore partagés « par lien » dans les dossiers `Plans`, pour que tu décides de retirer ces partages (c'est le gain de confidentialité : plus aucun plan accessible par un simple lien).

**Ce qui ne change pas** : les dossiers `Plans` existants et leurs fichiers restent dans le Drive ; rien n'est supprimé.

**Ce que tu perds** : la possibilité de montrer un PDF quelconque en le glissant dans le dossier `Plans` (sans passer par le dépôt au carnet). Si cet usage te sert encore, on garde la tuile.

**Ce que je te demande** : oui ou non, et si oui, tout de suite après la mise en production du carnet ou après deux semaines d'usage (ma recommandation : deux semaines, pour garder un secours).
