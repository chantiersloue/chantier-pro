# Lot 4d — Retouches du programme du PC : mise en service

> Ce lot ne touche **que** le programme du PC (`outils/appli_pc.py`) : ni le serveur, ni les pages de l'appli, ni les téléphones, ni Google.
> Branche `lot-4d` (dans le dossier `chantier-pro-lot4d`). **Statut : construit et testé sur de faux dossiers ; pas encore dans ton dossier principal.**

## Ce qui change

1. **« A VOIR » est plus court.** Les fichiers hors des dossiers de fiches, les doublons fabriqués par Drive, les raccourcis Google et les fiches que tu as déplacées sont regroupés en **une ligne par chantier**, avec leur nombre, sous un titre « Pour information », **après** les points qui demandent une action. Le compteur « N point(s) demandent ton attention » ne compte plus que les points d'action. Les bordereaux à déclarer tiennent en **une seule ligne** pour tous les chantiers. Le détail, fichier par fichier, reste dans « Voir seulement » (`appli-pc`, choix `2`).
   Sur une copie de ton fichier du 18/11 : **48 points deviennent 3 points d'action + 7 lignes « pour information »**.
2. **Le poids annoncé par « Voir seulement » est juste à 20 % près** (il annonçait 50 Mo pour un plan de 29 Mo). Il est calculé en fabriquant pour de vrai une partie des images : compte environ une seconde par grande page. Explications et étude pour alléger le carnet : `docs/lot4d-poids-carnet.md`.

Rien d'autre ne change : le fichier « A VOIR » n'est réécrit que si ses lignes changent (ou une fois par jour), les dépôts des sept derniers jours y restent, le passage automatique n'affiche rien, et l'ancien fichier « A VOIR » est relu sans erreur (vérifié par un test, et sur une copie de ton vrai fichier).

## Ce que lance la tâche automatique (pour comprendre pourquoi c'est sans risque)

La tâche « ChantierPro - recopie des fiches » lance, **toutes les heures et à l'ouverture de ta session** :
`pythonw.exe "<ton dossier principal>\outils\appli_pc.py" --auto`, avec ton dossier principal (`Documents\GitHub\chantier-pro`) comme dossier de travail. Jamais deux passages à la fois ; un passage est arrêté au bout d'une heure.

La tâche désigne le **fichier** `outils\appli_pc.py` de ton dossier principal : quand ce fichier est remplacé par la nouvelle version, le passage suivant utilise la nouvelle version. **La tâche n'a pas besoin d'être réinstallée** (le chemin ne change pas). Un passage déjà en cours garde l'ancienne version jusqu'à sa fin.

## Mise en service : je la fais moi-même (Claude), quand tu me dis « vas-y »

**Ce que tu fais** : me dire « vas-y », et ne pas laisser de fenêtre `appli-pc` ouverte pendant ce temps. C'est tout.

**Ce que je fais** (5 minutes) :

1. **Mettre `lot-4d` à jour avec `lot-5`** (dans le dossier `chantier-pro-lot4d`) : `git merge lot-5`. Depuis le début du lot 4d, `lot-5` n'a changé que `docs/feuille-de-route.md`, que ce lot ne touche pas : aucun conflit attendu. Je relance les deux séries de tests (`python tests\test_appli_pc.py`, `python tests\test_depot_carnet.py`) ; si l'une échoue, j'arrête.
2. **Choisir le moment : juste après un passage automatique.**
   - `appli-pc`, choix `3` (ou `python outils\appli_pc.py --a-voir`, qui ne fait que lire) : « Dernier passage automatique réussi : le … » doit dater de **moins de 15 minutes** ;
   - aucun passage en cours : le fichier `_prive\appli-pc.verrou` n'existe pas, et `schtasks /Query /TN "ChantierPro - recopie des fiches" /V /FO LIST` (lecture seule) dit « Prêt » et pas « En cours d'exécution ».
3. **Noter le point de retour** : `git rev-parse HEAD` dans ton dossier principal (le numéro de la version actuelle), écrit dans le journal du lot.
4. **Avancer `lot-5` dans ton dossier principal** : `git status` doit être propre, puis `git merge --ff-only lot-4d`. « Avance rapide seulement » : Git refuse s'il faudrait mélanger deux histoires ; dans ce cas je m'arrête et rien n'a changé. Puis `git push origin lot-5` (rien n'est publié : l'appli en ligne vient de `main`).
5. **Contrôles immédiats, en lecture seule** : `python -m py_compile outils\appli_pc.py` ; `python outils\appli_pc.py --a-voir` (relit l'ancien fichier « A VOIR » sans erreur).

## Vérifier que le passage suivant a réussi

Au plus une heure après (ou tout de suite : Planificateur de tâches, clic droit sur « ChantierPro - recopie des fiches », « Exécuter ») :
- `appli-pc`, choix `3` : « Dernier passage automatique réussi : le … » avec l'heure du nouveau passage ;
- `CHANTIERPRO - A VOIR.txt` : le compteur a baissé, et la partie « Pour information » est apparue, une ligne par chantier ;
- la dernière ligne de `_prive\appli-pc\auto.txt` finit par « point(s) à voir (+ N ligne(s) pour information). » ;
- `appli-pc`, choix `2` (« Voir seulement ») : le détail des fichiers est toujours là, et le poids annoncé d'un document à déposer est réaliste (patiente quelques secondes par plan).

Si le passage n'a pas réussi (choix `3` dit « ATTENTION… », ou `auto.txt` dit « ERREUR »), montre-moi `_prive\appli-pc\auto.txt` et je fais le retour arrière.

## Retour arrière (2 minutes, sans rien perdre)

Je ne pousse `lot-5` sur GitHub **qu'après** la vérification du passage suivant.
- **Avant** cet envoi : dans ton dossier principal, `git reset --keep <numéro noté à l'étape 3>`. Rien n'est réécrit sur GitHub.
- **Après** cet envoi : un commit d'annulation (`git revert`), jamais de réécriture de l'historique.

Dans les deux cas, seuls les fichiers du programme reviennent à l'ancienne version ; **aucune donnée** n'est touchée (dossiers de chantier, Drive, `_prive\`). La tâche automatique n'est pas à réinstaller.

## Ce qui n'est pas vérifié

- La nouvelle version n'a tourné que sur de faux dossiers et sur une **copie** de ton fichier « A VOIR » ; pas encore par la tâche automatique sur tes vrais dossiers.
- L'estimation du poids n'a pas été mesurée sur le PDF d'origine du plan de 29 Mo (il est sur ton PC), seulement sur une copie refaite à partir de ses images, et sur des PDF inventés.
