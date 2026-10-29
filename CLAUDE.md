# ChantierPro (Loué App) — Instructions pour Claude Code

## Contexte
ChantierPro est l'application web de chantier de **Loué Menuiserie** (menuiseries extérieures et intérieures).
- **Utilisateurs** :
  - Franck, conducteur de travaux, sur PC de bureau et sur smartphone ;
  - les poseurs, sur leur propre smartphone, souvent avec un **réseau faible ou absent**.
- **Front** : pages HTML statiques sur GitHub Pages (dépôt `chantiersloue/chantier-pro`, publié sur `chantiersloue.github.io/chantier-pro`). PWA avec `manifest.json`. **Le dépôt est public** : tout ce qui est dans le code est visible par n'importe qui.
- **Back** : Google Apps Script (`apps-script/`) : données, génération des PDF, envoi des mails.
- **Données** : Google Sheets (onglets Chantiers, Fonctions, Types…). Le conducteur est pré-rempli depuis la colonne D de l'onglet Chantiers. Structure détaillée dans `docs/structure-sheet.md`.
- **Documents** : Google Drive (dossier racine `1VUEOvq6Wvyqpvf6ISaoJfJXwLCR-OYxm`).
- **Compte Google** : compte gratuit (grand public), créé par Franck au nom de Loué. Pas de Google Workspace.
- **URL Apps Script** : celle présente dans le code fait foi. Elle change à chaque nouveau déploiement.
- **Dossier `_prive/`** (exclu de GitHub par `.gitignore`) : exemples réels de documents, copie anonymisée du Sheet (`exemple-sheet.xlsx`), sauvegardes. Lis-le librement, mais **ne copie jamais son contenu** dans un fichier suivi par Git, et ne retire jamais `_prive/` du `.gitignore`.
- **Environnement de test** : copie du Sheet « ChantierPro TEST » et dossier Drive « CHANTIERPRO-TEST ». Leurs identifiants sont dans `_prive/ids-test.txt`. Tous les essais se font là, jamais sur les vraies données.

## Pages existantes
- `index.html` : accueil avec tuiles de navigation.
- Fiches métier : `cotes.html`, `fiche-fabrication.html`, `note-reunion.html`, `bordereau-orga.html`, `bordereau-materiaux.html`, `quitus.html`, `attestation.html`.
- Toutes les fiches ont : un bouton Retour, un brouillon automatique avec bannière de restauration, des signatures sur canvas 300×150, un chargement via `chargerAppsScript` / `chargerJSONP` / `_parseRep`.

## Contraintes absolues
1. **Gratuit uniquement**, ou outils déjà utilisés par Franck (Google gratuit, GitHub Pages, MEGA, Claude, Outlook). Si une solution est « gratuite » seulement pendant un essai ou au-delà d'un seuil, signale-le clairement.
2. **MEGA reste l'archive maître** de tous les dossiers chantier, synchronisée sur le PC de Franck. Non négociable.
3. **Limiter le nombre d'outils et d'interactions.** Pas de nouvel outil sans justification solide. Notion est abandonné, ne pas l'intégrer.
4. **Le terrain d'abord** : chaque écran doit être utilisable d'une main, avec des gants, en plein soleil et avec une barre de réseau.
5. **Ne jamais casser le brouillon automatique** : c'est la protection anti-perte des gars.

## Limites connues du compte Google gratuit (à vérifier dans la doc officielle et à intégrer dans ta conception)
- Apps Script : **100 destinataires de mails par jour**, 6 min max par exécution, 90 min/jour de déclencheurs automatiques, 30 exécutions simultanées.
- Stockage : **15 Go partagés entre Drive, Gmail et Photos** pour tout le compte.
- Ces quotas peuvent changer : vérifie la page officielle « Quotas for Google Services » avant de concevoir.

## Qui est Franck (important pour ta façon de travailler)
- **Débutant en programmation** : explique en français simple, définis chaque terme technique.
- Préfère des **fichiers complets prêts à déployer** plutôt que des modifications à faire à la main.
- **Déploie lui-même** : upload des HTML sur GitHub, copier-coller dans l'éditeur Apps Script. Pour chaque livraison, procédure pas à pas avec ce qu'il doit cliquer.
- Ne suis pas ses idées sans les vérifier. Si une idée est mauvaise, risquée ou coûteuse, dis-le et propose mieux.
- Corrige l'orthographe de tous les textes affichés dans l'appli.

## Règles techniques (apprises à la dure)
1. **Jamais de backticks imbriqués** dans un template literal (bug JS silencieux). Construis les morceaux dans des variables, puis interpole.
2. **Déploiement Apps Script** : une mise à jour de déploiement peut ne pas être prise en compte. La solution fiable est un nouveau déploiement, donc une nouvelle URL. Objectif : cette URL n'est écrite qu'à **un seul endroit**.
3. **Appels Apps Script** : `fetch` avec `credentials:'omit'` d'abord, repli JSONP ensuite (le JSONP envoie les cookies Google et se comporte différemment selon le compte connecté).
4. **Code orphelin** : quand un élément HTML est supprimé, supprime aussi le JS qui y fait référence.
5. **Modifications coordonnées** : un changement de données touche 4 endroits : modèle, tableau à l'écran, aperçu PDF dans l'appli, Apps Script. N'en oublie aucun.
6. **Aucun secret dans le dépôt** (mots de passe, clés, liens de documents) : il est public.
7. **Validation** avant toute livraison : `node --check` sur les scripts, équilibre des balises, test en largeur smartphone (375 px) ET PC, test en réseau lent (« Slow 3G » dans les outils du navigateur) et hors-ligne.

## Hors périmètre (Franck n'en veut pas)
Fiches réserves / OPR, repérage terrain, bon de livraison, colonne « actions / responsables » dans la note de réunion.

## Méthode de travail
0. **Applique le skill `boucle-controle`** : interview → plan critiqué par un agent séparé → construction autonome → revue par un agent relecteur indépendant → corrections (3 tours max) → compte-rendu. Après la validation de l'interview et du plan, **travaille en autonomie maximale** : ne pose plus de questions, tranche toi-même et note tes choix dans `DECISIONS.md`. Arrête-toi uniquement pour une action irréversible (données réelles, production, envoi de mail) ou une dépense.
1. **Recherche et audit d'abord, aucun code** avant validation du plan par Franck.
2. Avant de choisir une technique, **compare au moins deux solutions** et justifie ton choix (coût, simplicité, robustesse, maintenance par un débutant).
3. **Petits lots**, sur une branche séparée, chacun déployable et testable seul. Les lots qui touchent aux données passent d'abord sur une **copie de test** du Sheet et du dossier Drive.
4. Ne supprime aucune fonctionnalité existante sans accord explicite.
5. Avant toute migration de données : **sauvegarde** et procédure de retour arrière.
6. Tiens à jour `CHANGELOG.md` (quoi, pourquoi, comment déployer) et `docs/guide-utilisateur.md` (mode d'emploi simple pour les poseurs).
7. Pour chaque lot, liste ce que Franck doit faire lui-même et comment vérifier que ça marche.
