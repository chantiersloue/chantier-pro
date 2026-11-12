# PLAN — Refonte ChantierPro

> Branche de travail : `refonte`. Document public : aucun identifiant, aucune donnée de `_prive/`.
> Recherche et audit détaillés : [docs/audit-et-plan.md](docs/audit-et-plan.md). Décisions prises pendant la construction : `DECISIONS.md`.

---

## 1. Commande validée (interview du 29/10/2026)

1. **Méthode** `boucle-controle` : plan critiqué par un agent indépendant, puis construction autonome lot par lot sur la branche `refonte`, revue indépendante après chaque lot, essais uniquement sur la copie TEST (Sheet « ChantierPro TEST », dossier Drive « CHANTIERPRO-TEST »).
2. **Lot 0 « sécurité urgente » en premier** :
   - relais de mails fermé : adresses du Sheet servies normalement ; **adresse tapée à la main toujours possible**, mais encadrée (texte du mail imposé, 2 par fiche, 10 par jour, Franck ou le conducteur en copie, journal) ; plafond journalier ;
   - **toutes les fiches de saisie continuent de fonctionner exactement comme aujourd'hui** (remplissage, signature, PDF, envoi) : la fermeture des partages ne touche que la consultation des fichiers Drive. Chaque fiche est testée sur TEST avant la livraison ;
   - partage public conservé **seulement pour Plans et Planning** ; dossier **Accès fermé** ;
   - lien public retiré des fichiers déjà partagés hors Plans/Planning, avec liste et procédure de remise dans `_prive/` ;
   - identifiants Drive retirés du code et de CLAUDE.md (rangés dans `_prive/`) ;
   - **les fiches continuent de partir en pièce jointe PDF** (vérifié : aucun mail ne contient de lien Drive) ;
   - procédure de test, fiche par fiche.
3. **Lot 1 « fondations »** :
   - URL Apps Script à un seul endroit ;
   - code commun partagé ;
   - hors-ligne avec file d'attente et indicateur « envoyée / en attente » ;
   - **boutons Imprimer et Enregistrer en PDF sur PC pour tous les documents** ;
   - **compression des photos avant envoi** (fiches, notes, signalements).
4. **Rôles** : Admin, Conducteur, Poseur, Atelier. 10 à 20 utilisateurs, iPhone et Android mélangés.
5. **Comptes gérés dans des onglets du Sheet**, sans page d'administration dans l'appli :
   - utilisable depuis l'appli Google Sheets du téléphone ;
   - cases à cocher qui déclenchent l'action : « Réinitialiser le mot de passe » (mot de passe provisoire affiché dans la ligne), « Déconnecter ce téléphone » ;
   - listes déroulantes, colonnes techniques protégées ;
   - indicateur de stockage dans un onglet ;
   - guide en 3 étapes maximum par action.
6. **Référentiel** :
   - l'onglet *Chantiers* porte l'identité et le terrain ; il est lu par l'appli **et** par les skills (connecteur Sheets) ;
   - la FICHE INFO garde les intervenants, les lots et les envois, et recopie l'identité depuis le Sheet ;
   - le skill `gestion-documentaire` recopie les intervenants dans un onglet *Intervenants* (sens unique).
7. **Drive** :
   - pont Drive ↔ MEGA par **Google Drive pour ordinateur** (installé et actif : `G:\Mon Drive`), avec une procédure de secours ;
   - arborescence Drive calquée sur MEGA, **noms de dossiers définis à un seul endroit** ;
   - seulement les dossiers utilisés ;
   - migration des anciens dossiers par **déplacement** (identifiants et liens conservés) ;
   - anciens dossiers gardés vides jusqu'à la validation de Franck sur téléphone, puis supprimés à sa demande.
8. **Notes de chantier** :
   - aucun mail ;
   - lecture : poseurs affectés et tous les conducteurs ;
   - modification : l'auteur et les conducteurs, avec « modifiée le … par … » ;
   - case « Fait » (note rayée, avec qui et quand) ;
   - suppression vers une corbeille visible et restaurable par les conducteurs ;
   - badge « nouveau » sur la tuile et sur la vue « tous chantiers » du PC ;
   - texte, photo, dictée, hors-ligne ;
   - export PDF du chantier.
9. **Carnet** :
   - le skill dépose **automatiquement** des **pages-images** ; **pas de PDF dans Drive par défaut**, sauf case « garder le PDF » par document (plan très dense, document à imprimer), à condition que l'essai de lisibilité soit concluant, **résultat montré à Franck avant de généraliser** ;
   - résolution adaptée au format, découpe en morceaux si nécessaire ;
   - lisibilité testée sur les vrais plans de `_prive/` ;
   - poids affiché avant téléchargement, consultation hors-ligne une fois vu, mise à jour automatique en Wi-Fi ;
   - accès vérifié par Apps Script, **aucun lien public** ;
   - tenue de la charge vérifiée ;
   - sur iPhone : place disponible vérifiée, et le poseur est **clairement prévenu quand un plan n'est plus disponible sans réseau**.
10. **Signalement casse / manquant / à recommander** : mail au conducteur **à chaque fois**, à l'atelier **seulement si la case est cochée**.
11. **Stockage** :
    - estimation sur 25 à 50 chantiers par an, en comptant le doublon PDF + images ;
    - indicateur dans le Sheet ;
    - 6 mois après « Terminé » et une fois l'arrivée dans MEGA vérifiée, le chantier est marqué « à purger » ; Franck coche, les fichiers vont à la corbeille ;
    - **la corbeille compte dans les 15 Go pendant 30 jours** : à intégrer au calcul et à l'indicateur.
12. **Lots 6, 8, 9, 10** :
    - délai en texte libre (fiche de fabrication) ;
    - note de réunion avec reprise des points ouverts, numérotation, présents **facultatifs** venant de l'onglet *Intervenants*, photos annotables, dictée, **sans** colonne « actions / responsables » ;
    - contrat écrit pour les skills ;
    - idées classées par gain / effort.
13. **Critères de réussite** :
    - zéro fiche perdue ;
    - plan lisible en 3G et au zoom (cotes et repères) ;
    - sécurité vérifiée ;
    - moins de ressaisie ;
    - **aucune régression**, PDF au moins aussi bons qu'aujourd'hui ;
    - prise en main sans formation en moins de 2 min ;
    - test final sur le téléphone d'un vrai poseur, sur un vrai chantier ;
    - message clair et rien de perdu si Apps Script est en panne ou si le quota est atteint.

**Hors périmètre** (CLAUDE.md) : fiches réserves / OPR, repérage terrain, bon de livraison, colonne « actions / responsables ». Notion n'est pas utilisé.

---

## 2. Ordre des lots et dépendances

```
Lot 0  Sécurité urgente ───────────────┐  (seul, immédiat ; introduit commun/config.js)
Essai S1  Carnet : faisabilité ────────┤  en parallèle du lot 1 : où tournent les skills, voient-ils G:\,
                                       │  lisibilité et poids réels des tuiles, tenue d'Apps Script
Lot 1  Fondations (1.1 → 1.5) ─────────┤  tout le reste s'appuie dessus
Lot 2  Comptes, rôles, accueil + 9a ───┤  nécessaire pour 3, 4, 7, 8
Lot 6  Délai en texte libre            │  (fait pendant le lot 1.3, avec la fiche de fabrication)
Lot 7  Signalement                     │  dépend de 1 + 2
Lot 3  Notes de chantier               │  dépend de 1 + 2
Lot 9b Contrat skills (écrit)          │  AVANT 4, 5 et 8 : ils dépendent des skills mis à jour
Lot 4  Carnet (4a dépôt, 4b lecture)   │  dépend de 1 + 2 + 9b + résultats de S1
Lot 5  Stockage                        │  dépend de 4 (volumes réels)
Lot 8  Note de réunion                 │  dépend de 1 + 2 + onglet Intervenants (9a + skill à jour)
Lot 10 Idées                           ┘  au fil de l'eau, selon gain / effort
```

**État au 12/11/2026** : lots 0, 1 (avec le 6) et 2 (avec le 9a) **en production**. Reste à Franck pour le lot 2 : installation sur les téléphones et remise des mots de passe, `demarrerTransition`, archivage des anciens déploiements (`docs/lot2-procedure.md`, D.8 à D.10). Outillage en place et vérifié le 12/11/2026 (`docs/guide-outillage.md`). **Lot 7 en cours** (plan : `docs/lot7-plan.md`, procédure : `docs/lot7-procedure.md`). **Lot 3 construit** sur la branche `lot-3`, testé contre le faux serveur seulement ; ses essais réels et sa livraison attendent la production du lot 7 (plan : `docs/lot3-plan.md`, procédure : `docs/lot3-procedure.md`).

**Pourquoi cet ordre ?**
- Le lot 0 ferme une faille ouverte aujourd'hui.
- Le lot 1 évite de refaire chaque lot 10 fois.
- Le lot 2 conditionne tout ce qui est réservé à un chantier.
- Le signalement (7) et les notes (3) apportent vite un gain aux poseurs avec peu de risque.
- Le carnet (4) est le plus gros et le plus important. Il arrive quand la base (comptes, hors-ligne, arborescence) est solide.
- On ne règle pas le stockage (5) avant de connaître les volumes réels du carnet.

**Règles de mise en production (précisions de Franck au feu vert)** :
1. **Le mode test est public lui aussi.** L'Apps Script TEST exécute **exactement le même code** que la production (mêmes adresses encadrées, plafonds, journal). Seules ses Propriétés du script diffèrent (identifiants des dossiers TEST).
2. **Un lot à la fois en production.** GitHub Pages publie la branche `main`. Pour chaque lot, je prépare une branche `livraison/lot-N` qui part de `main` et ne contient **que** ce lot. Franck la publie, soit en fusionnant la demande de fusion (« pull request ») sur GitHub, en un clic, soit en uploadant les fichiers listés. **Jamais deux lots non testés d'un coup.** La procédure exacte est dans chaque `docs/lotN-procedure.md`.
3. **Je construis la suite pendant que Franck teste**, mais un lot ne part en production qu'après le test du précédent par Franck. **Un bug trouvé par Franck passe avant tout le reste.**

Chaque lot (et chaque sous-lot du lot 1) est **déployable et testable seul**. Il est commité séparément sur `refonte` et accompagné de :
- ses fichiers prêts à déployer ;
- sa procédure pas à pas ;
- ses tests à faire par Franck ;
- sa mise à jour de `CHANGELOG.md` et de `docs/guide-utilisateur.md`.

---

## 3. Choix techniques comparés

| # | Sujet | Option retenue | Option(s) écartée(s) | Raison |
|---|---|---|---|---|
| T1 | Connexion | **Comptes maison** : mot de passe haché avec un sel (HMAC-SHA256 répété, ≈ 0,3 s), jeton signé de 90 jours prolongé à chaque usage, clé secrète dans les « Propriétés du script » | Connexion Google ; Firebase | Aucun outil en plus, aucun compte Google demandé aux poseurs. Voir audit §1.2. |
| T2 | Révocation | Colonne « version de session » par utilisateur dans le Sheet ; la case s'appelle **« Déconnecter tous ses téléphones »**, car elle les déconnecte tous, et augmente la version de 1 | Liste des sessions en cache | CacheService limite à 6 h et peut perdre des données. |
| T3 | Hors-ligne | **Service worker écrit à la main + file d'attente IndexedDB**, renvoi au retour du réseau, à l'ouverture, au retour dans l'appli et sur bouton | Background Sync seul ; Workbox | Background Sync ne fonctionne pas sur iPhone. Workbox est illisible pour un débutant. |
| T4 | Doublons d'envoi | **Numéro unique par fiche** (créé sur le téléphone), mémorisé par le serveur, qui ignore un second envoi | Aucun | Indispensable avec les renvois automatiques. |
| T5 | Modèle des PDF | **Un seul modèle par document**, écrit une fois en JavaScript dans `modeles/`. Il est exécuté dans le navigateur (aperçu, impression) **et** sur le serveur : une copie `apps-script/Modeles.gs` est **générée automatiquement** par `outils/construire.js`, jamais modifiée à la main. **La page envoie des données (JSON), pas du HTML.** Le modèle utilise seulement des tableaux et des styles en ligne, que comprend le convertisseur PDF de Google (pas de flex ni de grid). | Deux modèles (situation actuelle) ; HTML fabriqué par la page puis nettoyé par le serveur (écarté : Apps Script n'a pas d'outil fiable pour nettoyer du HTML, et un nettoyeur maison serait contournable) | Supprime les écarts aperçu / PDF. Ramène la règle des « 4 endroits » à 2 : le modèle et les colonnes du Sheet. L'impression sur PC est **très proche** du PDF envoyé, mais **pas identique au pixel** : le convertisseur de Google n'est pas Chrome. |
| T6 | Échappement côté serveur | Toute donnée reçue passe par `esc()` avant d'entrer dans un PDF ou un mail ; aucun HTML étranger n'est accepté | Faire confiance aux données | Empêche un faux PDF ou un mail piégé à l'en-tête Loué. |
| T7 | Photos | Compression sur le téléphone (1600 px, qualité JPEG 0,7, plan B en 1200 px si le décodage échoue), **une photo par requête**, déposée dans Drive avant la fiche ; la fiche cite les numéros des photos | Photos en base64 dans la fiche (actuel) | Plus d'envois de 20 à 30 Mo ; si le réseau coupe, seule la photo manquante repart. |
| T8 | Mails | **Un seul mail**, destinataires **en copie cachée (Cci)** pour ne pas exposer les adresses aux externes ; format de chaque adresse vérifié avant l'envoi ; PDF fabriqué une seule fois ; destinataires résolus côté serveur. Plafond : 80 destinataires par jour pour l'appli, 20 réservés à Franck. Le quota est compté sur **24 h glissantes** **[à vérifier]** : les mails reportés sont retentés plusieurs fois. | Un mail par destinataire (actuel) | Un mail par destinataire fait N conversions et N copies dans « Messages envoyés », qui comptent dans les 15 Go. |
| T9 | Réponses serveur | `fetch` POST en `text/plain` (pas de demande préalable CORS), réponse lue, statut réel `{ok, code, message}`. JSONP gardé seulement en secours pour **lire** des données non sensibles. | `no-cors` (actuel, réponse illisible) | Condition de « zéro fiche perdue ». |
| T10 | Code serveur | Code.gs découpé en **6 fichiers au plus** : `Config`, `Securite`, `Api`, `Documents`, `Carnet`, `Admin`. Chacun se colle en entier dans l'éditeur. | Un fichier de 3 000 lignes ; outil `clasp` | Lisible et peu de copier-coller. `clasp` est un outil de plus et demande une connexion. |
| T11 | Identifiants Drive | Dans les **Propriétés du script** (saisis une fois par Franck), jamais dans le dépôt | Constantes dans le code | Dépôt public. |
| T12 | Noms de dossiers | **Un seul fichier `dossiers.json`** à la racine du Drive de l'appli (donc aussi visible dans `G:\Mon Drive\…`). Il est lu par Apps Script (avec un cache), par `depot_carnet.py` et par les skills. Aucun nom de dossier ni chemin en dur ailleurs. Une fonction `verifierConfig()` contrôle que chaque dossier existe. | Noms dans `Config.gs` et recopiés dans les skills | Condition de Franck : **un seul endroit** à modifier, pour l'appli **et** pour les skills. |
| T13 | Gestion des comptes | Onglets *Utilisateurs* et *Accès* + déclencheur « à la modification » installé dans le Sheet ; cases à cocher, listes déroulantes, protections en mode « avertissement » | Page d'administration ; menu du Sheet | Choix de Franck : pas de page de plus sur une appli publique, et les menus n'existent pas dans l'appli Sheets du téléphone. |
| T14 | Carnet, lecture | **Pages-images servies par Apps Script après contrôle du jeton**, gardées sur le téléphone. Grands formats : **pyramide de 3 ou 4 niveaux de zoom** (comme une carte), tuiles **regroupées en un seul fichier « paquet » par page et par niveau**, avec un index ; le serveur lit un seul fichier et renvoie les tuiles demandées. Visionneuse **Leaflet** (bibliothèque libre, copiée dans le dépôt, sans CDN), en mode « image simple » | Aperçu Drive par lien public ; PDF.js ; une tuile = un fichier Drive (des centaines de fichiers et de recherches par nom) ; visionneuse écrite à la main | Accès réservé et hors-ligne. Leaflet gère zoom, déplacement et tuiles de façon éprouvée. Paramètres exacts (résolution, taille des tuiles, niveaux) fixés par l'**essai S1** sur les vrais plans. |
| T15 | Carnet, dépôt | Script commun `depot_carnet.py`, appelé par chaque skill : découpe, `carnet.json`, dépôt dans le dossier CARNET, retrait de l'ancienne version. **Le mécanisme de dépôt (écriture dans `G:\Mon Drive` sur le PC, ou connecteur Google Drive de Claude) n'est pas encore vérifié : l'essai S1 le tranche** | Chaque skill fait son propre dépôt | Une seule règle, un seul code à maintenir. Aucune manipulation manuelle. |
| T16 | Wi-Fi | Android : téléchargement automatique quand le téléphone est sur Wi-Fi (information fournie par Chrome). iPhone : l'information n'existe pas, donc bouton « Tout mettre à jour » et proposition à l'ouverture de l'appli | Tout télécharger tout le temps | iOS ne dit pas si le téléphone est en Wi-Fi. Respect du forfait des gars. |
| T17 | Échappement des textes | Une fonction commune `esc()` utilisée par **tous** les affichages, plus une règle de relecture : pas d'`innerHTML` avec une saisie non échappée | Correction au cas par cas | Les notes partagées (lot 3) rendraient le défaut dangereux. |
| T18 | Polices | Polices système (rien à télécharger) | Google Fonts | Écran blanc en 3G, et une dépendance en moins. |

---

## 4. Détail des lots

Pour chaque lot :
- **Intérêt** : ce que ça t'apporte ;
- **Difficulté / Risque** : de 1 (faible) à 3 (fort) ;
- **Fichiers** : ce qui est touché ;
- **Tests** : ce que je teste moi-même ;
- **À faire par Franck** : ta part ;
- **Vérification** : comment tu sais que ça marche.

### Lot 0 — Sécurité urgente

- **Intérêt** : ferme le relais de mails et les fuites de documents.
- **Difficulté** 1 / **Risque** 2 : on touche aux envois qui fonctionnent aujourd'hui.

**Ce qui change pour les gens** (validé au récapitulatif) :
- **Destinataires** (clients, archis, bureau) : rien ne change. Ils reçoivent toujours le PDF en pièce jointe, et aucun mail ne contient de lien Drive (vérifié dans Code.gs).
- **Poseurs** :
  - dans la tuile *Chantiers*, seuls les onglets encore partagés sont affichés, les autres sont masqués ;
  - les liens de *Accès* ne s'ouvrent plus (choix de Franck), ni ceux des onglets fermés (voir la liste au récapitulatif) ;
  - **les fiches de saisie ne changent pas** (fabrication, cotes, note, bordereaux orga et matériaux, quitus, attestation, réception, absence) : remplissage, signature, PDF et envoi identiques. La fermeture des partages ne concerne que la **consultation** des fichiers Drive depuis la tuile *Chantiers*, et la mise en partage public des PDF produits, que personne n'utilise (vérifié : les mails ne contiennent pas de lien) ;
  - une adresse tapée à la main **reste possible sur toutes les fiches**, avec les garde-fous ci-dessous. Si une limite est atteinte, la fiche part quand même aux destinataires du Sheet, et un message l'explique.
- **Ce qui reste ouvert jusqu'au lot 2** : la liste des contacts reste lisible par quiconque a l'URL. Les pages actuelles en ont besoin, et la fermer imposerait de les réécrire. Le relais de mails, lui, est fermé dès le lot 0.

**Fichiers touchés** :

| Fichier | Changement |
|---|---|
| `apps-script/Code.gs` | sécurité, partages, quota, échappement |
| `commun/config.js` | nouveau : **l'URL Apps Script à un seul endroit**, plus le passage en mode test avec `?env=test` (bandeau rouge permanent) |
| les 10 pages | **une seule ligne changée** chacune : l'URL est lue dans `config.js` |
| `CLAUDE.md` | identifiants Drive retirés, liste des pages complétée |
| `_prive/ids-drive.txt` | nouveau : les identifiants Drive |
| `docs/lot0-procedure.md` | procédure et tableau de tests |

**Contenu, côté serveur** :
1. **Destinataires** (choix de Franck : la saisie libre reste possible, mais encadrée) :
   - **adresses du Sheet** (*Contacts*, *Contacts notes*) : servies normalement, avec le mail actuel ;
   - le conducteur et la liste des absences sont **calculés par le serveur** (onglet *Chantiers* colonne D, onglet *Contacts* colonne H), sans se fier à la page ;
   - **adresse libre** (tapée à la main) :
     - **mail au contenu imposé** : objet et texte automatiques (« Loué Menuiserie — <type de fiche> — <chantier> »), plus le PDF de la fiche. **Aucun texte libre du demandeur dans le mail.** Le PDF, lui, contient bien sûr ce qui a été saisi dans la fiche : le risque est réduit, pas nul, d'où la copie systématique ;
     - **2 adresses libres maximum par fiche** ;
     - **10 adresses libres maximum par jour** pour toute l'appli (chaque envoi coûte 2 destinataires sur le quota avec la copie, soit 20 au maximum sur les 80 réservés à l'appli) ;
     - **le conducteur du chantier en copie cachée** de chaque envoi libre, ou Franck s'il n'y a pas de conducteur, pour voir un abus immédiatement ;
     - chaque envoi libre est noté dans l'onglet ***Journal*** (date, fiche, chantier, adresse, envoyé / refusé et pourquoi) ;
     - **après le lot 2**, la saisie libre est réservée aux utilisateurs connectés ;
   - les refus (limite atteinte, adresse mal formée) vont aussi dans le *Journal*, avec **un seul mail d'alerte par jour au maximum** à Franck.
2. **Plafond** : `MailApp.getRemainingDailyQuota()` est consulté avant chaque envoi.
   - En dessous de 20 restants, seuls les mails vers Franck partent.
   - Les autres sont reportés dans *Mails en attente*, avec l'identifiant du PDF déjà rangé dans Drive, et retentés toutes les 2 h par un déclencheur (≈ 1 min par jour sur les 90 autorisées).
3. **Échappement** : toute donnée reçue est échappée avant d'entrer dans un PDF ou un mail. Les textes commençant par `=`, `+` ou `@`, ou par `-` suivi d'une lettre, sont neutralisés avant écriture dans le Sheet (les cotes négatives restent des nombres).
4. **Partages** :
   - plus aucun partage automatique, sauf dans les dossiers gardés partagés ;
   - `getDossiers` ne renvoie que les onglets encore partagés ;
   - `listerPartages()` liste **fichiers ET dossiers** partagés par lien (racine comprise) dans un onglet *Partages (lot 0)*. Elle travaille par paquets et reprend où elle s'était arrêtée, pour rester sous les 6 min. Franck enregistre ensuite cet onglet dans `_prive/partages-avant-lot0.csv` ;
   - `retirerPartages()` passe en « accès limité » tout ce qui n'est pas dans un dossier gardé (Accès compris), par paquets également ;
   - `remettrePartages()` restaure à partir de la liste ;
   - ordre imposé : **TEST d'abord, puis réel**, avec l'accord explicite de Franck (action sur les données réelles).
5. **Identifiants Drive** : lus dans les Propriétés du script. `verifierConfig()` signale un identifiant faux au lieu d'échouer en silence.
6. **Version** : `doGet` renvoie `Loué App API v4.1 OK`. Franck ouvre l'URL après chaque déploiement pour vérifier que la nouvelle version tourne (règle 2 de CLAUDE.md : une mise à jour de déploiement peut ne pas être prise en compte).
7. **Bugs corrigés au passage** :
   - adresse de secours vide (`Session.getActiveUser()`) remplacée par celle de Franck (Propriétés du script) ;
   - échec du mail de la fiche de fabrication protégé ;
   - les bordereaux ne vont plus dans « Quitus ».

**Environnement de test** (I6 de la critique) :
- La copie TEST du Sheet contient de **vraies adresses** (c'est une copie). Avant tout essai, je remplace sur TEST les adresses de *Contacts* et *Contacts notes* par des variantes de l'adresse de Franck : `adresse+conducteur@…` arrive dans sa boîte Gmail.
- Le quota de 100 mails, les 30 exécutions simultanées et les 90 min de déclencheurs sont **communs** à TEST et au réel : les essais se font hors des jours chargés, avec 20 mails au plus par séance.

**Tests (moi)** :
- harnais Node qui simule les services Google : pour chaque type de fiche, avec les **vrais champs envoyés par les pages actuelles**, une adresse inconnue est refusée, une adresse connue est servie, le plafond fonctionne, l'alerte est limitée ;
- appels réels au serveur TEST une fois déployé par Franck : **chacune des 9 fiches** envoyée avec signature et photos, mail reçu et PDF récupéré dans le dossier TEST, comparés à ceux d'avant le lot 0 ; plus les cas « adresse libre » (acceptée, 3ᵉ refusée, 11ᵉ du jour refusée, copie au conducteur reçue, ligne au *Journal*) ;
- `node --check`.

**À faire par Franck** (procédure pas à pas dans `docs/lot0-procedure.md`) :
1. Projet Apps Script TEST : ajouter les Propriétés du script, coller Code.gs, autoriser (écran « application non validée » décrit pas à pas), déployer, me donner l'URL.
2. Uploader `commun/config.js` et les 10 pages sur GitHub.
3. Ouvrir l'appli avec `?env=test` et remplir le tableau de tests : une ligne par fiche, plus l'essai « adresse inconnue » qui doit être refusé.
4. Lancer `listerPartages()` puis `retirerPartages()` sur TEST, et vérifier.
5. Sur le réel, **après accord** : coller Code.gs (Modifier → Nouvelle version), vérifier « v4.1 OK », lancer `listerPartages()`, sauvegarder la liste dans `_prive/`, puis `retirerPartages()`.

**Vérification** :
- chaque fiche arrive par mail avec son PDF ;
- un poseur ouvre toujours un plan depuis la tuile *Chantiers* ;
- un fichier de *Accès* ouvert par son lien depuis un autre navigateur affiche « Accès refusé » ;
- un envoi pirate vers une adresse inconnue n'arrive pas.

### Essai S1 — Faisabilité du carnet (avant le lot 4, en parallèle du lot 1)

Le carnet est ton lot le plus important, et il repose sur des hypothèses non vérifiées : on les vérifie avant de construire.
1. **Où tournent les skills ?** Un skill peut-il écrire dans `G:\Mon Drive`, directement ou par l'outil de dépôt de fichiers sur le PC ? Sinon, le connecteur Google Drive de Claude accepte-t-il des fichiers de plusieurs Mo ? **Si aucun des deux ne marche**, je reviens vers toi avant de construire le lot 4 (pas d'installation de Python ou d'un autre outil sous Windows sans ton accord).
2. **Lisibilité et poids** : découpe des plus grands plans de `_prive/` à plusieurs résolutions ; captures au zoom maximal en 375 px ; poids par page et par chantier. Les images de test restent hors du dépôt.
3. **Tenue d'Apps Script** : paquet de tuiles servi depuis Drive, temps de réponse, taille maximale, 5 téléphones simulés en même temps, en Slow 3G simulé.
4. **Résultat** : paramètres définitifs (résolution, niveaux, taille des paquets), estimation de stockage recalée, mécanisme de dépôt choisi, écrit dans DECISIONS.md.
5. **Point d'arrêt voulu par Franck** : je lui montre les captures de lisibilité et les poids **avant de généraliser** « pas de PDF dans Drive ». Le lot 1 continue pendant ce temps.

### Lot 1 — Fondations

Découpé en 5 sous-lots déployables séparément.

#### 1.1 Serveur fiable (Apps Script)
- **Intérêt** : fini les « Envoyé ! » mensongers ; erreurs claires ; plus rapide.
- **Difficulté** 2 / **Risque** 2.
- **Fichiers** : `apps-script/*.gs` (6 fichiers).
- **Contenu** :
  - API v5 : liste fermée d'actions, réponse `{ok, code, message, data}` ;
  - numéro unique par fiche (onglet *Envois* : numéro, date, type, statut, lien du PDF) ;
  - verrou d'écriture `LockService` ;
  - action `photo` (dépôt d'une photo, renvoie son numéro) ;
  - HTML de PDF nettoyé (T6), conversion **une seule fois** ;
  - un mail multi-destinataires ;
  - classement selon `DOSSIERS` (T12) avec ton nommage `<INTITULÉ> <NOM COURT> <AAAA-MM-JJ>[_Vn]` ;
  - quota surveillé.
  - **L'ancienne API reste acceptée** (mêmes types de fiches), pour que les pages non encore migrées continuent de marcher pendant 1.3.
- **Tests (moi)** : harnais Node, scénarios OK, doublon, verrou, quota atteint, photo manquante, HTML piégé.

#### 1.2 Briques communes (GitHub Pages)

| Fichier | Rôle |
|---|---|
| `commun/config.js` | (créé au lot 0) **seul endroit** de l'URL Apps Script, production et test via `?env=test` (bandeau rouge permanent), et de la version de l'appli. Chaque page vérifie que sa version et celle de `commun/` concordent (protection contre un upload GitHub incomplet) |
| `commun/api.js` | Appels serveur (`fetch` lisible, délai maximal, JSONP de secours en lecture), file d'attente IndexedDB, renvoi automatique, numéro unique |
| `commun/ui.js` | `esc()`, messages, bandeau « en attente / envoyée ✓ », boutons de 48 px, fenêtre d'aperçu |
| `commun/brouillon.js` | Brouillon automatique **complet** : champs, lignes dynamiques, choix, photos (Blob dans IndexedDB), signatures, destinataires ; restauration **après** le chargement des listes. **Reprise des anciens brouillons** : au premier chargement de chaque page migrée, les anciennes clés `localStorage` (`brouillon_cotes`, `brouillon_note`, `brouillon_quitus`, `brouillon_bord_orga`, `brouillon_bord_mat`, `loue_attestation_brouillon`) sont importées puis gardées une semaine (contrainte absolue 5) |
| `commun/photos.js` | Compression (T7), message clair si une photo est illisible, nombre maximal (10 par fiche) |
| `commun/signature.js` | La meilleure des 3 versions existantes (pointeurs, annuler), écran haute densité, taille réelle 300×150 conservée, contrôle « signature vide » |
| `commun/impression.js` | Boutons **Imprimer** et **Enregistrer en PDF** : ouvrent la fenêtre d'impression du navigateur avec le modèle unique, où il suffit de choisir « Enregistrer au format PDF » |
| `commun/style.css` | Styles communs, zones tactiles d'au moins 44 px, contraste soleil, styles d'impression `@media print` |
| `commun/listes.js` | Contacts, chantiers et listes gardés sur le téléphone (dernière version connue + date) |
| `sw.js` | Service worker : pages et `commun/` en cache versionné ; `config.js` redemandé au réseau d'abord **avec un délai maximal de 3 s**, puis repris du cache ; bandeau « Nouvelle version — toucher pour mettre à jour » (le brouillon est sauvé avant) |
| `outils/sw-secours.js` | **Service worker de secours, prêt à déployer** : s'il y a un problème grave, Franck le renomme en `sw.js` et l'uploade ; il se désinstalle de tous les téléphones et l'appli redevient un site normal |
| `modeles/*.js` | Un modèle par document (cotes, fabrication, note, bordereau, quitus, attestation, réception, absence) |

- **Difficulté** 3 / **Risque** 2 : cœur de la refonte, mais testable hors production.
- **Tests (moi)** :
  - faux serveur Node (`tests/faux-serveur.js`) avec les modes normal, lent (Slow 3G simulé), panne, quota atteint, réponse perdue ;
  - navigateur en 375 px et en largeur PC, mode hors-ligne ;
  - tests automatisés de la file d'attente (rien n'est perdu après fermeture et réouverture de la page).

#### 1.3 Migration des pages, une par une
- Ordre : `quitus` (le plus simple) → `bordereau` → `cotes` → `fiche-fabrication` (+ **lot 6**) → `note-reunion` → `attestation` → `reception-support` → `absence` → `index`.
- Chaque page passe sur les briques communes. **Toutes les fonctions actuelles sont gardées.** Les bugs de l'audit §2.2 sont corrigés page par page (liste cochée dans le commit).
- `bordereau-orga.html` et `bordereau-materiaux.html` deviennent **une seule page** `bordereau.html?type=orga|materiaux`. Les anciennes adresses restent, en simple redirection, pour les favoris des gars. La liste « Type » du bordereau matériaux utilise enfin l'onglet *Materiaux*.
- **Lot 6** :
  - champ « Précision du délai » en texte libre (exemples : « S48 — au plus tôt », « dès réception des cotes ») ;
  - présent à l'écran, dans le modèle (donc l'aperçu, l'impression et le PDF), et dans une colonne du Sheet *Fabrication*.
- **Écarts de PDF à arbitrer moi-même**, notés dans DECISIONS.md : le nouveau modèle reprend la **version la plus complète** (exemple : les hauteur, largeur et talon de l'huisserie seule) ; aucune information présente aujourd'hui dans le PDF serveur ne disparaît.
- **Tests (moi)** :
  - pour chaque page, comparaison des **vrais PDF** produits par le serveur TEST, ancien code puis nouveau code, avec le même jeu de données (le convertisseur de Google ne peut pas être simulé) ; captures côte à côte dans le compte rendu ;
  - test hors-ligne, 375 px, PC, Slow 3G ;
  - test « `Vis 4"` et `<90 cm` ».

#### 1.4 Hors-ligne et iPhone
- Indicateur permanent : « ✓ Tout est envoyé » ou « ⏳ 2 fiches en attente — Envoyer maintenant ».
- **Sur iPhone, installation obligatoire avant tout usage** : écran « Installer l'appli » (gestes avec captures). Sur iOS, Safari et l'appli installée ont **des mémoires séparées** : brouillons, file d'attente et connexion ne passent pas de l'un à l'autre. Dans Safari non installé, l'appli refuse de mettre une fiche en file d'attente sans avertissement, car iOS efface ces données après 7 jours sans visite.
- `navigator.storage.persist()` demandé, `estimate()` affiché dans « À propos » (place utilisée / disponible).
- Règles iPhone, d'après la [politique de stockage WebKit](https://webkit.org/blog/14403/updates-to-storage-policy/) (iOS 17+) **[off.]** :
  - une appli **installée sur l'écran d'accueil** a les mêmes droits que Safari : jusqu'à 60 % du disque pour le site ;
  - iOS peut **quand même effacer** les données si le téléphone manque de place ou si l'appli n'est pas utilisée, en commençant par la moins récemment utilisée ;
  - la demande de stockage persistant est accordée selon des critères internes (l'installation aide).
  - Conséquence : l'appli **vérifie à chaque ouverture** ce qu'elle a réellement en mémoire, et ne promet jamais qu'un document est disponible sans réseau sans l'avoir vérifié.

#### 1.5 Arborescence Drive et migration
- `dossiers.json` (T12) : seulement les dossiers utilisés par l'appli.
- **Seuls les documents produits par l'appli sont migrés** : Fiches, Note/Réunion, Quitus, Réceptions Support, Attestations.
- Les dossiers remplis à la main par Franck (*Plans*, *QT/Tableau*, *CCTP*, *Sécurité*, *Accès*) **restent où ils sont jusqu'au lot 4** : leurs documents utiles aux gars passeront alors dans le CARNET. **Le partage par lien de *Plans* prend fin au déploiement du lot 4.**

  | Ce que l'appli produit | Dossier Drive |
  |---|---|
  | Cotes | `05 - CHANTIER/PRISE DE COTES` |
  | Fabrication | `07 - ATELIER` |
  | Notes de réunion | `05 - CHANTIER/COMPTE RENDU` |
  | Quitus, attestations, réceptions | `05 - CHANTIER/OPR - RESERVES - QUITUS` |
  | Bordereaux d'organigramme | `05 - CHANTIER/ORGANIGRAMME` |
  | Photos | `05 - CHANTIER/PHOTOS CHANTIER` |
  | Carnet (lot 4) | `CARNET` |

  Absences : dossier `ADMINISTRATIF/ABSENCES` à la racine, hors chantiers.
- Nom du dossier chantier : `NNN - NOM COURT`, tiré de l'onglet *Chantiers*. **Plus de correspondance « approximative »** des noms, source actuelle d'erreurs de classement.
- **Table de correspondance** (onglet *Migration*) : ancien nom de dossier ou de chantier → nouveau nom, proposée automatiquement puis vérifiée par Franck avant toute exécution. Les anciennes fiches du Sheet, rattachées par le nom, restent lisibles.
- Fonction `planMigration()` : liste ce qui serait déplacé, sans rien faire, dans un onglet *Migration*. Puis `executerMigration()` : **déplace** (`moveTo`, l'identifiant et le lien sont conservés) et n'écrase jamais rien.
- Les anciens dossiers restent vides. `supprimerAnciensDossiers()` n'est fournie qu'après la validation de Franck sur téléphone, et met à la corbeille : réversible pendant 30 jours.
- **Ordre : TEST, puis réel avec l'accord de Franck** (action sur les données réelles).

**À faire par Franck pour le lot 1** :
- déployer chaque sous-lot (upload GitHub des fichiers listés, collage Apps Script) ;
- lancer la migration sur TEST, contrôler, puis sur le réel ;
- installer l'appli sur l'écran d'accueil d'un iPhone et d'un Android de test.

**Vérification** : les 9 fiches en mode avion partent au retour du réseau ; « Envoyée ✓ » n'apparaît qu'après confirmation ; Imprimer sur PC donne la même page que le PDF reçu par mail ; les fichiers sont rangés dans les nouveaux dossiers avec le bon nom.

### Lot 2 — Comptes, rôles, accueil (avec 9a)
- **Intérêt** : chaque gars voit **ses** chantiers et rien d'autre ; la sécurité est réelle côté serveur.
- **Difficulté** 3 / **Risque** 3 : un bug ici bloque tout le monde. D'où une **période de transition** : l'ancienne façon d'envoyer reste acceptée 15 jours, avec un journal de qui l'utilise encore.

**Onglets du Sheet**

| Onglet | Contenu |
|---|---|
| *Utilisateurs* | identifiant, nom (liste depuis *Contacts*), rôle (liste), actif (case) ; ☐ « Réinitialiser le mot de passe » → mot de passe provisoire de 8 caractères affiché dans la ligne, **valable 48 h**, effacé à la première connexion (il reste visible dans l'historique des versions du Sheet : risque accepté, car il est à usage unique et expire) ; ☐ « Déconnecter tous ses téléphones » ; colonnes techniques protégées (empreinte, sel, version de session, dernière connexion, essais ratés) |
| *Accès* | une ligne par chantier, une case par poseur (le nom de la colonne vient d'*Utilisateurs*) ; les conducteurs voient tous leurs chantiers ; l'admin voit tout |
| *Chantiers* (9a) | **Colonnes A à D inchangées** (nom, référence, statut, conducteur), pour ne rien casser. **Ajoutées après D** : n°, nom court, adresse, client, architecte, date « Terminé », chemin du dossier MEGA, identifiant du dossier Drive (rempli par l'appli). Statut en liste : En préparation / En cours / Terminé |
| *Intervenants* (9a) | rempli par le skill `gestion-documentaire` à partir de la FICHE INFO (sens unique) |

**Serveur**
- action `connexion`, jeton signé (T1, T2) ;
- **toutes** les autres actions vérifient le jeton, puis le rôle, puis l'accès au chantier ;
- `getContacts` public supprimé : la liste des contacts n'est plus lisible sans compte ;
- 5 essais ratés → 15 min de blocage de l'identifiant, **plus une limite globale** (au-delà de 50 échecs par heure, toutes les connexions sont ralenties) ;
- **règle de sécurité écrite** : le Sheet n'est partagé qu'avec Franck. Toute personne qui peut le modifier peut aussi ouvrir le script et lire la clé secrète.

**Point à tester d'abord, sur TEST** : les cases à cocher et le déclencheur « à la modification » utilisés depuis l'appli Google Sheets **sur iPhone et sur Android**. Les protections en mode « avertissement » ne s'affichent peut-être pas sur mobile. Si le déclencheur ne réagit pas sur mobile, je reviens vers toi avec une solution de remplacement avant de construire le reste.

**Accueil**
- connexion (une fois tous les 90 jours) → « Mes chantiers » (recherche, derniers ouverts en premier) → tuiles du chantier (Fiches, Notes, Carnet, Signaler) ;
- tuiles hors chantier : Planning, Absence ; plus « Tous chantiers » pour conducteurs et admin, et « Atelier » (fabrications et signalements) pour le rôle Atelier ;
- le chantier choisi est **pré-rempli** dans toutes les fiches (plus de liste déroulante à charger).

**Tests (moi)**
- harnais : jeton expiré, falsifié, révoqué, poseur qui demande un chantier non autorisé (refus), force brute ;
- temps réel du hachage mesuré dans le harnais, à confirmer sur Apps Script TEST.

**À faire par Franck**
- remplir *Utilisateurs* et *Accès* sur TEST, puis sur le réel ;
- coller la clé secrète générée (procédure : une fonction `genererCle()` à lancer une fois) ;
- distribuer identifiant et mot de passe provisoire aux gars.

**Vérification**
- un poseur ne voit que ses chantiers ;
- l'URL Apps Script ouverte sans jeton ne renvoie plus rien d'utile ;
- un téléphone « déconnecté » depuis le Sheet est renvoyé à l'écran de connexion à la requête suivante ;
- guide : créer un gars, lui donner un chantier, le débloquer, en 3 étapes chacun.

### Lot 7 — Signalement casse / manquant / à recommander
- **Intérêt** : 30 secondes pour signaler, rien d'oublié, suivi visible.
- **Difficulté** 1 / **Risque** 1.
- **Page** `signaler.html` (briques communes) :
  - photo (1 à 3) ;
  - repère (texte court, ou repère du carnet si ouvert depuis un plan) ;
  - type en 3 gros boutons : Casse / Manquant / À recommander ;
  - urgence en 3 gros boutons : Bloquant / Cette semaine / Pas urgent ;
  - commentaire facultatif (micro du clavier) ;
  - case « Prévenir l'atelier ».
- **Serveur** :
  - onglet *Signalements* (statut : À traiter / Commandé / Livré / Clos) ;
  - mail **au conducteur du chantier à chaque fois**, photo en pièce jointe compressée ;
  - **atelier en copie seulement si coché** ;
  - plafond de quota (T8) : si le quota est presque atteint, le signalement est enregistré et marqué « mail reporté », et l'appli l'affiche.
- **Rôles Conducteur et Atelier** : liste des signalements, changement de statut ; le poseur voit le statut de ses signalements.
- `bordereau-materiaux` reste ce qu'il est : un reçu de remise. Ses briques sont réutilisées.
- **Vérification** : signalement en mode avion, parti au retour du réseau, mail reçu par le conducteur, et par l'atelier seulement si la case est cochée.

### Lot 3 — Notes de chantier
- **Intérêt** : un pense-bête partagé par chantier, qui suit le chantier et non la personne.
- **Difficulté** 2 / **Risque** 2 (synchronisation hors-ligne).
- **Données** :
  - onglet *Notes* : numéro, chantier, auteur, date, texte, photos (numéros), fait (qui, quand), modifiée (qui, quand), supprimée (qui, quand) ;
  - onglet *Notes historique* : ancienne version à chaque modification.
- **Page** `notes.html` :
  - liste du chantier, la plus récente en haut ;
  - saisie rapide toujours visible en bas : texte, 📷, 🎤 (le micro du clavier, plus un bouton de dictée si le téléphone le permet) ;
  - case « Fait » (barré, « Fait par X le … ») ;
  - « modifiée le … par … » ;
  - corbeille réservée aux conducteurs ;
  - badge « nouveau » (date de dernière visite mémorisée par utilisateur et par chantier, côté serveur, pour qu'elle suive le gars s'il change de téléphone).
- **Droits vérifiés côté serveur** :
  - lecture : poseurs affectés et conducteurs ;
  - modification : l'auteur et les conducteurs ;
  - « Fait » : n'importe qui sur le chantier ;
  - restauration : conducteurs.
- **Conflit hors-ligne** : si deux personnes modifient la même note, **la dernière modification reçue par le serveur l'emporte** (l'heure du serveur fait foi, pas celle des téléphones) ; l'autre version est gardée dans l'historique, et la note affiche « modifiée en même temps par X — voir l'historique ».
- **Vue PC « Tous chantiers »** (conducteurs, admin) : toutes les notes, filtres par chantier, auteur, « nouveau », « non fait », recherche plein texte.
- **Export PDF** d'un chantier : rangé dans `05 - CHANTIER/COMPTE RENDU`, donc il redescend dans MEGA.

### Lot 4 — Carnet de chantier

#### 4a. Dépôt automatique par les skills
- **Nommage dans le carnet** : `CARNET/<CODE DOC> <INDICE> <INTITULÉ>`, où `CODE DOC` est le n° de la nomenclature `gestion-documentaire` (`002`, `003`, `005`, `007`…). Un document non encore émis prend un code du carnet (`C01`, `C02`…), noté dans `carnet.json`. L'indice A, B, C… est donné par le skill, sinon augmenté automatiquement par `depot_carnet.py`.
- **`carnet.json`** (un par chantier, écrit par le script) : document, intitulé, indice, date, nombre de pages, poids de chaque page et du PDF, source dans MEGA. **L'appli lit ce fichier, sans deviner à partir des noms.**
- **`depot_carnet.py`** (dans le dépôt, `outils/`), appelé à la fin de chaque skill concerné :
  1. découpe le PDF en pages ;
  2. choisit la résolution selon le format : jusqu'à A3, une image par page ; au-delà, une **pyramide de 3 ou 4 niveaux** (image d'ensemble d'environ 1 600 px, puis niveaux intermédiaires, puis pleine résolution d'au moins 200 dpi), les tuiles de chaque niveau étant **regroupées en un seul fichier paquet avec son index** (T14) ; paramètres fixés par l'essai S1 ;
  3. écrit tout dans le dossier CARNET du chantier, dont le chemin est lu dans `dossiers.json` (jamais écrit en dur) ;
  4. met l'ancienne version à la corbeille Drive (elle reste dans MEGA) ;
  5. met à jour `carnet.json`.

  **PDF complet** (décision de Franck) : **jamais dans Drive par défaut**. Les images en pleine résolution font foi, et le PDF reste dans MEGA. Une **case « garder le PDF » par document** (colonne de l'onglet *Carnet index*, que le skill peut aussi demander à l'appel) permet de le garder exceptionnellement (plan très dense, document à imprimer sur chantier). **Condition : l'essai S1 doit prouver que cotes et repères se lisent au zoom sur téléphone. Le résultat est montré à Franck avant de généraliser.**
- **Où il tourne et comment il dépose** : tranché par l'essai S1, qui vérifie si un skill peut écrire dans `G:\Mon Drive` ou s'il faut passer par le connecteur Google Drive de Claude. **Aucune installation sur le PC sans l'accord de Franck.**
- **Secours si Drive pour ordinateur ne synchronise plus** :
  - l'appli affiche dans le Sheet (onglet *Stockage*) la date du dernier `carnet.json` reçu pour chaque chantier ; un écart avec MEGA se voit ;
  - procédure en 3 étapes : redémarrer Drive pour ordinateur ; vérifier l'icône ; sinon, glisser le dossier `CARNET` depuis l'explorateur dans drive.google.com ;
  - `depot_carnet.py --verifier` compare MEGA et Drive et liste les écarts.
- **Test obligatoire** (commencé à l'essai S1) : avec les plus grands plans de `_prive/`, contrôle visuel au zoom maximal sur un écran de 375 px (capture d'écran jointe au compte rendu), mesure des poids, ajustement de la résolution.

#### 4b. Lecture sur le téléphone
- **Tuile Carnet** :
  - liste des documents (dernier indice seulement) ;
  - badge « nouveau » si l'indice a changé depuis ta dernière ouverture ;
  - poids affiché (« 2,4 Mo ») ;
  - état « 📶 en ligne seulement » / « ✓ disponible hors réseau » ;
  - **⚠ « plus disponible hors réseau »** si iOS l'a effacé, ou **« ancien indice B — le C est sorti »** si le téléphone garde une version périmée.
- **Visionneuse** (Leaflet, T14) : image d'ensemble immédiate, tuiles nettes au zoom, gros boutons page suivante / précédente, rotation, « Signaler ici » (vers le lot 7, repère prérempli).
- **Serveur** :
  - action `carnetPage` : contrôle du jeton et du chantier, puis renvoi des tuiles demandées (base64, soit +33 % de poids), lues dans **un seul fichier paquet** ;
  - les identifiants Drive des paquets sont **mémorisés côté serveur** (onglet *Carnet index*, plus un cache), pour éviter de chercher les fichiers par leur nom ;
  - réponses d'environ 1,5 Mo au plus (≈ 2 Mo une fois en base64) ;
  - **test de charge** : 5 téléphones simulés qui ouvrent un grand plan en même temps ; on mesure le temps, les erreurs et la limite des 30 exécutions simultanées ; chaque téléphone fait 2 appels en parallèle au maximum.
- **Hors-ligne** :
  - chaque page vue est gardée ;
  - « Tout télécharger » par chantier ;
  - automatique en Wi-Fi sur Android (T16) ;
  - sur iPhone, proposition à l'ouverture de l'appli si des indices ont changé ;
  - place libre affichée avant un gros téléchargement.

### Lot 5 — Stockage
- **Onglet *Stockage*** (mis à jour chaque nuit, chantier par chantier, en reprenant là où il s'était arrêté pour rester sous les 6 min) :
  - espace utilisé / 15 Go (Drive, Gmail et Photos ensemble) ;
  - **corbeille : ce que l'appli y a mis, quand, et la date à laquelle la place sera libérée** (tenu dans un onglet *Purges*, car Drive ne donne pas facilement la date de mise à la corbeille). La corbeille compte dans les 15 Go pendant 30 jours ;
  - utilisation par chantier (carnet, fiches, photos) ;
  - date du dernier dépôt du carnet ;
  - alerte par mail à Franck à 70 % et à 85 % (2 mails maximum par mois).
- **Politique** :

  | Contenu | Où | Combien de temps |
  |---|---|---|
  | Pages et fichiers de l'appli | GitHub | toujours |
  | Données (Sheet) | Drive | toujours (léger) |
  | PDF des fiches, photos compressées, carnet | Drive | jusqu'à la purge |
  | Archive maîtresse | MEGA | toujours |
  | Anciennes versions du carnet | MEGA seulement | à la corbeille Drive dès qu'une nouvelle version arrive |

- **Purge** :
  - 6 mois après « Terminé », `controlePurge()` vérifie que chaque fichier Drive du chantier existe dans le dossier MEGA. Il passe par Drive pour ordinateur : le skill `gestion-documentaire` écrit un relevé `mega-index.json`, à défaut d'un accès direct à MEGA.
  - Le chantier passe alors « à purger » ; Franck coche « Purger », et les fichiers vont à la corbeille.
  - **La corbeille occupe encore de la place pendant 30 jours.** L'indicateur le montre, et une case « Vider la corbeille de ce chantier maintenant » est proposée : **suppression définitive**, toujours cochée par Franck lui-même, jamais automatique.
- **Estimation PROVISOIRE** (hypothèses issues de `docs/skills.md`, à recaler par l'essai S1 : un plan A0 en tuiles pleine résolution peut peser bien plus que prévu) :

  | Par chantier | Taille |
  |---|---|
  | Carnet : environ 7 documents terrain, PDF 40 à 55 Mo + images 40 à 80 Mo | ≈ 80 à 135 Mo |
  | Remplacements de version (corbeille 30 jours, en moyenne) | ≈ 20 Mo |
  | Fiches PDF avec photos (≈ 40 × 0,5 Mo) + copies dans « Messages envoyés » | ≈ 40 Mo |
  | Photos dans Drive : notes, signalements et photos des fiches, **qui figurent aussi dans les PDF** (≈ 200 × 0,3 Mo) | ≈ 60 Mo |
  | **Total** | **≈ 200 à 255 Mo** |

  - Sans purge : 25 chantiers par an ≈ **5 à 6,5 Go par an** ; 50 chantiers par an ≈ **10 à 13 Go par an**. En partant de l'usage actuel (voir `_prive/stockage.txt`), **les 15 Go seraient atteints en 1 à 2 ans**, et en **moins d'un an à 50 chantiers**.
  - Avec purge 6 mois après la fin et un chantier qui dure environ 12 mois : au plus 1,5 année de chantiers présente en même temps. Cela donne **≈ 7,5 à 9,5 Go en régime stable à 25 chantiers par an** (tenable), et **≈ 15 à 19 Go à 50 chantiers par an (au-delà des 15 Go)**.
  - Parades déjà prévues : **carnet sans PDF par défaut** (≈ −40 à −55 Mo par chantier, donc ≈ 150 à 200 Mo par chantier au lieu de 200 à 255), un seul mail multi-destinataires.
  - **À 50 chantiers par an, il faudra plus** : purge 3 mois après la fin, ou carnet seulement pour les chantiers « En cours », ou photos de Drive supprimées une fois intégrées au PDF et archivées dans MEGA. Décision au vu des chiffres réels de l'essai S1 et du lot 4.

### Lot 8 — Note de réunion
- Numérotation automatique par chantier (`CR n°7`), stockée dans le Sheet.
- Pré-remplissage : date, chantier, rédacteur (compte connecté). Présents **facultatifs**, cochés depuis *Intervenants*, comme à la note précédente.
- **Reprise des points ouverts** : la note est structurée en points (texte + case « clos »). Les points non clos de la note précédente sont repris automatiquement, marqués « repris du CR n°6 », et le rédacteur les clôt ou les complète.
- **Pas de colonne « actions / responsables »** : un point n'a qu'un texte, des photos et l'état ouvert / clos.
- Photos annotables : annotation à la **résolution de la photo**, et non de l'écran ; la gomme efface le trait et non la photo.
- Dictée (micro du clavier).
- Destinataires : *Intervenants* et *Contacts notes* seulement (lot 0). Une adresse nouvelle s'ajoute d'abord dans le Sheet.

### Lot 9 — Référentiel et contrat avec les skills
- **9a** (fait dans le lot 2) : onglets *Chantiers* et *Intervenants*.
- **9b** (livré **avant** les lots 4, 5 et 8, qui en dépendent) : `docs/contrat-skills.md`, le contrat que les skills doivent respecter :
  1. **Lire l'identité du chantier** dans l'onglet *Chantiers* (connecteur Sheets) ; la FICHE INFO n'en garde que la copie.
  2. **Écrire les intervenants** dans l'onglet *Intervenants* à chaque mise à jour de la FICHE INFO.
  3. **Déposer dans le carnet** avec `depot_carnet.py` : quels documents, quand, comment les nommer.
  4. **Rapatrier les fiches de l'appli** de Drive (dossiers T12) vers les mêmes dossiers dans MEGA, avec une nouvelle ligne dans la table de routage de `gestion-documentaire` et le relevé `mega-index.json`.
  5. **Cotes vers le métré de plinthes** : le skill `metre-plinthes` lit l'onglet *Prise de Cote* (colonnes listées) pour un chantier donné.
- Texte à ajouter dans chaque skill concerné, fourni prêt à coller. **Je ne modifie pas tes skills moi-même** : tu les mets à jour.

### Lot 10 — Idées (gain / effort, gratuites, sans outil en plus)

| # | Idée | Gain | Effort |
|---|---|---|---|
| 1 | **QR code par chantier** (affiche A4 à imprimer pour la base vie) : il ouvre directement le chantier dans l'appli | fort | faible |
| 2 | **Avertissement « indice périmé »** : un plan gardé sur le téléphone dont un nouvel indice est sorti s'affiche barré en rouge tant qu'il n'est pas mis à jour (éviter la pose sur un plan périmé) | fort | faible (inclus au lot 4) |
| 3 | **Accusé de lecture du carnet** : tu vois qui a ouvert l'indice C du plan des réservations | fort | faible |
| 4 | **« Préparer ma journée »** : le matin au dépôt (Wi-Fi), un bouton télécharge le carnet des chantiers du jour | moyen | faible |
| 5 | **Galerie photos par chantier** (toutes les photos des fiches, notes et signalements, avec date et auteur) | moyen | moyen |
| 6 | **Récapitulatif hebdomadaire PDF** par chantier (notes, signalements, fiches de la semaine) pour préparer la réunion | moyen | moyen |
| 7 | **Mode gants** : tout en très gros, en réglage par utilisateur | moyen | faible |
| 8 | **Suivi des signalements par le poseur** (Commandé / Livré), pour éviter de rappeler le bureau | moyen | faible (inclus au lot 7) |

---

## 5. Risques et parades

| Risque | Parade |
|---|---|
| Une régression casse une fiche qui marchait | Ancienne API acceptée pendant la transition ; pages migrées une par une ; comparaison des PDF avant / après ; tests sur TEST avant le réel |
| Un poseur bloqué à la connexion sur le chantier | Session de 90 jours ; Franck réinitialise depuis son téléphone (Sheets) ; message clair « appelez le bureau » |
| Vieille version de l'appli bloquée en cache | Version dans `sw.js` ; `config.js` toujours redemandé au réseau ; bandeau de mise à jour |
| Effacement des données par iOS | Installation obligatoire ; vérification de ce qui est réellement présent à chaque ouverture ; avertissement « plus disponible hors réseau » ; la file d'attente des fiches est envoyée le plus vite possible (jamais gardée longtemps) |
| Quotas Google atteints | Plafond de mails avec réserve ; mails reportés ; réponses claires « quota atteint, la fiche est enregistrée, le mail partira demain » |
| Apps Script surchargé (carnet) | Paquets de tuiles, 2 appels en parallèle au maximum par téléphone, test de charge au lot 4 |
| Drive pour ordinateur arrêté | Indicateur de date du dernier dépôt ; procédure de secours ; `depot_carnet.py --verifier` |
| Stockage plein | Lot 5 : indicateur, alertes, purge, carnet sans PDF lourd |
| Franck débutant face à 6 fichiers Apps Script | Procédure pas à pas avec captures ; chaque fichier se remplace en entier ; **l'ancien `Code.gs` est supprimé** au passage aux 6 fichiers (sinon doublons) ; vérification « API v5 OK » à l'ouverture de l'URL |
| Nouvelles autorisations Google (quota de mails, déclencheurs) | Écran « application non validée » décrit pas à pas dans chaque procédure concernée |
| TEST et réel partagent les quotas | Essais limités à 20 mails par séance, adresses de TEST remplacées par des variantes de celle de Franck |

---

## 6. Tests prévus (règle 7 de CLAUDE.md)

- `node --check` sur tous les scripts ; contrôle de l'équilibre des balises.
- Harnais Node pour Apps Script : services Google simulés.
- Faux serveur : modes normal, lent, panne, quota, réponse perdue.
- Navigateur : 375 px et PC, Slow 3G simulé, hors-ligne ; captures jointes au compte rendu de chaque lot.
- Comparaison visuelle des PDF avant / après (lot 1.3).
- Lisibilité des plans au zoom avec les vrais plans de `_prive/` (lot 4) ; images de test **jamais** commitées.
- Tests par Franck : sur la copie TEST après chaque déploiement ; test final sur le téléphone d'un vrai poseur, sur un vrai chantier.
- **Test « prise en main en 2 min »** à la fin des lots 2 et 4 : un poseur qui n'a jamais vu la nouvelle version se connecte, trouve son chantier et ouvre un plan, chronométré, sans aide. Protocole fourni à Franck.

**Limite** : je ne peux pas déployer Apps Script moi-même. Le vrai serveur n'est testé qu'après chaque déploiement de Franck sur TEST, avec la procédure fournie.

## 7. Ce que Franck doit préparer avant le lot 0

1. Créer, ou vérifier, un **projet Apps Script lié au Sheet « ChantierPro TEST »** (Extensions → Apps Script), avec son propre déploiement « web app », et me donner son URL. Elle sera écrite dans `config.js` comme URL de test : elle sera donc publique, mais **le TEST contient de vraies adresses** (c'est une copie). D'où l'étape suivante.
2. **M'autoriser à remplacer, dans le Sheet TEST uniquement**, les adresses de *Contacts* et *Contacts notes* par des variantes de ton adresse Gmail (`…+conducteur@gmail.com`, qui arrivent dans ta boîte), pour qu'aucun essai n'écrive à un vrai conducteur ou client.
3. Vérifier que le dossier « CHANTIERPRO-TEST » contient au moins un chantier avec des dossiers *Plans*, *Accès* et *Fiches*, et quelques fichiers partagés par lien, pour tester le retrait des partages.
4. Avoir sous la main 2 téléphones de test (un iPhone, un Android) pour le lot 1.

---

## 8. Critique indépendante du plan (tour 1, 29/10/2026)

Un agent séparé, qui n'a pas écrit le plan, l'a relu avec la commande, CLAUDE.md et le code actuel. Il a trouvé **5 points bloquants**, tous corrigés :

| Point | Correction |
|---|---|
| Lot 0 : retirer les adresses des contacts aurait cassé l'envoi de 6 pages | Adresses gardées jusqu'au lot 2 ; le **serveur** vérifie et calcule les destinataires |
| Lot 0 : les poseurs perdaient des onglets sans le savoir | Onglets fermés masqués, liste soumise à Franck |
| Lot 0 impossible à tester sur TEST (URL de production en dur dans 10 pages) | `commun/config.js` créé dès le lot 0, avec le mode `?env=test` |
| Dépôt du carnet par un « conteneur cloud » sur `G:\` non vérifié | **Essai S1** de faisabilité avant le lot 4, sans installation sans accord |
| « Modèle unique » fondé sur du HTML envoyé et nettoyé par le serveur | La page envoie des **données** ; le même modèle JS tourne des deux côtés (copie générée) |

Points importants intégrés :
- quota d'alertes de sécurité limité ;
- échappement côté serveur dès le lot 0 ;
- dossiers partagés traités, par paquets ;
- numéro de version vérifié après chaque déploiement ;
- adresses de TEST remplacées ;
- règle « Sheet partagé avec Franck seul » ;
- mot de passe provisoire de 48 h ;
- service worker de secours et délai de 3 s ;
- iOS : installation avant la connexion ;
- reprise des anciens brouillons ;
- vrais PDF comparés sur TEST ;
- colonnes A à D de *Chantiers* conservées et table de correspondance ;
- sort des dossiers *Plans*, *CCTP*, *Sécurité* et *Accès* ;
- `dossiers.json` unique ;
- pyramide et paquets de tuiles ;
- contrat 9b avancé ;
- estimation de stockage recalculée et marquée provisoire.

Points mineurs intégrés :
- copie cachée (Cci) ;
- case « Déconnecter tous ses téléphones » ;
- limite globale de connexion ;
- suppression de l'ancien `Code.gs` ;
- cotes négatives préservées ;
- bandeau rouge en mode test ;
- heure du serveur qui fait foi ;
- onglet *Purges* ;
- test de prise en main en 2 min ;
- `verifierConfig()`.
