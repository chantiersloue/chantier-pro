# Lot 5 — Stockage : suivi, alertes, purge — plan

> Commande : `PLAN.md`, « Lot 5 — Stockage » et exigence 5 ; `docs/contrat-skills.md` et `docs/lot4c-plan.md` (relevé `mega-index.json`) ; décisions D4-7, D4-8, D4-12.
> Branche `lot-5`, partie de `lot-4`. **Version 2, refaite après critique par un agent indépendant** (ce qu'elle a fait changer : chapitre 11). Consigne de Franck (13/11/2026) : construit et testé contre le faux serveur seulement ; **rien qui touche à des données réelles sans lui** ; aucune action sur la copie TEST ni la production.

## 1. La commande, en clair

Le compte Google gratuit a **15 Go pour Drive, Gmail et Photos ensemble**. Le lot 5 doit : (1) montrer à Franck, dans un onglet du Sheet, où en est la place et ce que pèse chaque chantier ; (2) le prévenir par mail avant que ce soit plein ; (3) lui permettre de **libérer la place des chantiers terminés** sans rien perdre : MEGA reste l'archive maître.

Aucune page de l'appli ne change : tout se passe dans le Sheet (utilisable depuis l'appli Google Sheets du téléphone) et dans le serveur.

**Ce qui arrive si le compte est plein** (d'après l'aide de Google) : plus aucun fichier ne peut être créé dans Drive et **plus aucun mail ne part ni n'arrive**. Les fiches des poseurs resteraient dans leurs téléphones (elles ne sont pas perdues), mais plus rien n'arriverait au bureau, pas même le mail d'alerte. D'où trois seuils, et un état écrit en haut de l'onglet.

## 2. Ce que Franck verra

### Onglet *Stockage* (rempli par le serveur)
- En haut : **place utilisée / 15 Go**, en Go et en %, la date de la mesure, et une phrase d'état (« Tout va bien », « Attention : 72 % », « Mesure en cours : 12 chantiers sur 31 »). Si le serveur peut les lire (voir §3) : la part de **Drive**, celle de **Gmail et Photos**, et celle de la **corbeille de Drive**.
- Une ligne par chantier : nom, statut, date « Terminé », **poids total**, dont carnet, fiches, photos, autres ; nombre de fichiers ; date du dernier dépôt au carnet ; anciens indices du carnet (nombre et poids) ; **date de la mesure de cette ligne** ; état de purge.
- Des lignes « Dossiers techniques », « Dossiers de la racine rattachés à aucun chantier », « Chantiers sans dossier ».
- La ligne « Reste du compte » (Gmail, Photos, corbeille, autres fichiers) n'est calculée **qu'après un tour complet** de mesure, et n'est jamais négative.
- Un rappel fixe : **les fiches envoyées par mail restent aussi dans « Messages envoyés » de Gmail**, qui compte dans les 15 Go ; la purge de Drive ne libère pas cette part (ménage de Gmail : à la main, conseil donné dans la procédure).

### Onglet *Purges* (les propositions, et les cases que Franck coche)
Une ligne par chose qui **peut** être mise à la corbeille : chantier, quoi (« anciens indices du carnet » ou « chantier terminé »), poids, nombre de fichiers, pourquoi c'est possible (ou ce qui manque), une case **« Mettre à la corbeille »**. Après traitement : date, nombre de fichiers, **date à laquelle la place sera vraiment libérée** (30 jours plus tard : la corbeille compte dans les 15 Go), et une case **« Annuler »** utilisable 25 jours.
- Chaque ligne a une **clé fixe** (chantier + nature + identifiant du dossier) ; une ligne n'est jamais effacée ni déplacée par le serveur, qui n'écrit que dans ses cellules. Franck peut trier : le serveur retrouve la ligne par sa clé.
- Les deux cases cochées en même temps : rien n'est fait, la ligne le dit.

### Mails
- Alerte de place : **70 %**, puis **85 %** (deux mails au plus par mois pour ces deux seuils), puis **95 %** (toujours envoyé). Un seuil n'est noté « prévenu » qu'**après** l'envoi réussi du mail. Si la place est déjà au-dessus d'un seuil à l'installation, le mail part à la première mesure.
- **Un mail à chaque mise à la corbeille** : quoi, combien de fichiers, comment annuler, jusqu'à quand.

## 3. La mesure

- Un déclencheur de nuit lance `mesurerStockage` ; un second, une heure plus tard, ne fait quelque chose **que si** le tour n'est pas fini. Chaque passage s'arrête proprement au bout de 4 minutes et note où il en est. Ces deux déclencheurs sont ajoutés à la liste que `retirerDeclencheurs` et `verifierConfig` connaissent. Lecture seule : la mesure ne modifie rien dans le Drive.
- Les fichiers à la corbeille ne sont pas comptés dans les chantiers. Les documents Google (Sheets, Docs) pèsent 0 pour Google : c'est normal.

### La place du compte : un chiffre à vérifier avant de s'y fier
La documentation de Google dit de `DriveApp.getStorageUsed()` seulement « octets stockés dans Drive » : **rien ne garantit qu'il compte Gmail et Photos**. L'interface plus complète de Drive (le « service avancé Drive », à activer une fois dans l'éditeur Apps Script) donne trois chiffres sûrs : total du compte, part de Drive, part de la corbeille.

| | Retenu | Écarté | Raison |
|---|---|---|---|
| D'où vient le chiffre | **le service avancé Drive s'il est activé, sinon `DriveApp`** ; l'onglet dit lequel est utilisé | `DriveApp` seul | le serveur marche dans les deux cas ; le premier essai sur la copie TEST compare le chiffre à celui de one.google.com/storage, et dit s'il faut activer le service avancé (une case à cocher dans l'éditeur ; à vérifier : sans nouvelle autorisation) |
| Parcours des fichiers | **dossier par dossier, avec reprise** | liste complète par le service avancé (plus rapide, mais le rend obligatoire) | marche sans rien activer ; la durée réelle sera mesurée sur la copie TEST et le choix revu si un tour prend plus de trois nuits |
| Quand | la nuit | à chaque fiche ; à la demande | aucun coût pour les poseurs ; 4 à 8 minutes par nuit sur les 90 permises |
| Où | onglets du Sheet | page de l'appli | exigence 5 |

## 4. La purge : jamais automatique, annulable 25 jours

### 4.1 Quel dossier est celui du chantier (condition commune)
Une purge n'est proposée que si le dossier du chantier vient d'**une ligne explicite de l'onglet *Dossiers chantiers***, sans mention « À vérifier », et que **son identifiant n'est porté par aucun autre chantier**. Jamais par ressemblance de nom. Et avant chaque mise à la corbeille, le serveur vérifie que le fichier **descend bien de la racine du Drive de cet environnement** (la copie TEST et la production sont dans le même compte).

### 4.2 Anciens indices du carnet
Raisonnement **par dossier**, avec la même fonction que celle qui sert le carnet aux téléphones : un dossier de document est proposé seulement si `carnet.json` le connaît, si **aucun document montré** dans l'appli ne le désigne (un document retiré puis redéposé garde le même dossier : il n'est donc pas proposé), et s'il n'existe **qu'un seul dossier de ce nom**. Un dossier inconnu de `carnet.json` (dépôt en cours, fichier posé à la main) n'est jamais proposé. La mise à la corbeille porte sur le dossier entier du document.

### 4.3 Chantier terminé
Proposé seulement si **tout** est vrai :
1. statut « Terminé » **depuis au moins 6 mois** ;
2. relevé `mega-index.json` à la racine du dossier Drive, dont le **chantier** est bien celui-là, **daté de moins de 30 jours** pour la proposition et de **moins de 7 jours au moment où la case est traitée** ;
3. **chaque fiche du Drive** correspond à **une ligne distincte** du relevé : même chemin, même taille (accents comparés sans tenir compte de leur codage). Deux fichiers de même nom dans un dossier du Drive : bloqué, avec le nom ;
4. aucun envoi en attente ni abandonné pour ce chantier (onglet *Mails en attente*).

La ligne dit toujours **ce qui manque et quoi faire** (« 3 fiches absentes du relevé : relancer le programme du PC, puis attendre la prochaine mesure »).

**La date « Terminé »** est posée automatiquement quand le statut passe à « Terminé », effacée s'il repasse à un autre statut ; une date dans le futur est ignorée.

Ce qui part quand Franck coche :
- **fiches et photos : fichier par fichier**, et **seulement les fichiers comparés au relevé dans la même exécution** (un fichier arrivé entre-temps n'est pas touché). Les dossiers restent en place, vides : une fiche qui arriverait plus tard d'un téléphone retrouve son dossier ;
- **carnet** : le dossier de chaque document, puis `carnet.json` en dernier ;
- **jamais** : le dossier du chantier, `mega-index.json`, ce qui est hors de ces sous-dossiers (signalé, laissé).

### 4.4 Le traitement d'une case
- Un déclencheur dédié (`traiterPurges`, toutes les 30 minutes) qui **sort tout de suite** s'il n'y a rien à faire. Il **ne prend pas le verrou du serveur** (celui des fiches) : une purge ne retarde jamais une fiche ; il a son propre verrou.
- Toutes les conditions sont **revérifiées** ; si elles ne tiennent plus, rien n'est fait et la ligne dit pourquoi.
- **Le journal d'abord** : chaque fichier est écrit « à faire » dans l'onglet technique *Purges détail* (clé de la ligne, identifiant, chemin, taille) **avant** d'être mis à la corbeille, puis marqué « fait ». Une exécution coupée ne laisse donc jamais un fichier à la corbeille sans trace. Écritures groupées, par paquets, avec reprise.
- **Annuler** : sort de la corbeille exactement ce que la ligne y a mis, et dit combien de fichiers n'ont pas pu revenir (corbeille vidée à la main entre-temps).

### 4.5 Ce que le serveur ne fait jamais
- **Aucune suppression définitive.** Le plan d'origine prévoyait une case « Vider la corbeille de ce chantier maintenant ». **Je propose de ne pas la faire** : une suppression sans retour, déclenchée par une case d'un tableur, est le geste le plus dangereux du lot. Si Franck a besoin de la place avant 30 jours, il le fait dans Drive, **en sélectionnant les fichiers voulus dans la corbeille** — pas avec « Vider la corbeille », qui supprimerait aussi les autres purges encore annulables. À me dire si tu veux quand même la case.
- Aucune purge sans case cochée ; aucune purge d'un chantier qui n'est pas « Terminé » ; rien dans MEGA.

## 5. Ce que le lot change ailleurs

- **Programme du PC** (`outils/depot_carnet.py --verifier`) : un ancien indice dont le dossier a été purgé n'est plus signalé comme une anomalie.
- `apps-script/Carnet.gs` : son en-tête (« le serveur ne supprime rien ») est précisé : le carnet ne supprime rien ; seul le lot 5 met à la corbeille, sur case cochée.
- Le programme du PC du lot 4c rapatrie **tous** les chantiers suivis, terminés compris : c'est lui qui rafraîchit le relevé avant une purge.

## 6. Estimation recalée avec les chiffres réels du lot 4

| Par chantier | Estimation d'origine | Avec les mesures du lot 4 |
|---|---|---|
| Carnet (7 documents terrain, images seules, sans PDF) | 40 à 80 Mo | **60 à 130 Mo** (un dossier de trois grands plans : 18 Mo ; images ≈ poids du PDF + 15 %) |
| Anciens indices gardés jusqu'à leur purge | 20 Mo | 20 à 40 Mo |
| Fiches PDF, et leurs copies dans Gmail | 40 Mo | 40 Mo (dont la moitié dans Gmail, non libérée par la purge de Drive) |
| Photos | 60 Mo | 60 Mo |
| **Total** | 200 à 255 Mo | **180 à 270 Mo** |

À 25 chantiers par an, avec une purge 6 mois après la fin : environ **7 à 10 Go en régime stable**, tenable. À 50 chantiers par an : au-delà des 15 Go, il faudra purger plus tôt. Ces chiffres seront remplacés par ceux de l'onglet *Stockage* dès la première mesure réelle.

**Politique de conservation** (inchangée) : pages et code sur GitHub, toujours ; données du Sheet, toujours ; PDF des fiches, photos et carnet dans Drive **jusqu'à la purge** ; archive maîtresse dans MEGA, toujours ; anciens indices du carnet : dans MEGA seulement, purgés de Drive sur case cochée.

## 7. Technique

- `apps-script/Stockage.gs` et `apps-script/Purges.gs` ; installation en une fonction par environnement (`installerLot5Test` / `installerLot5Production`) : onglets, formats, cases, avertissement sur les colonnes techniques (Franck est propriétaire : une protection ne l'arrête pas, elle le prévient), déclencheurs.
- Serveur **v10.0**. Aucune page ne change.
- Titres des onglets contrôlés avant toute écriture (comme les notes) ; un onglet modifié à la main → arrêt et alerte.
- Sur la copie TEST, les déclencheurs ne sont posés que pendant les essais (règle existante).
- Aucune nouvelle autorisation Google n'est nécessaire pour la mesure de base ni pour la corbeille (le serveur a déjà le droit complet sur le Drive). Le service avancé Drive est facultatif.

## 8. Tests prévus (faux serveur seulement)

**D'abord compléter le faux Drive des tests** : place du compte, corbeille d'un dossier et de son contenu, pannes simulées de mise à la corbeille, horloge réglable (6 mois, 30 jours), service avancé présent ou absent.
- **Mesure** : poids par chantier et par sous-dossier ; reprise après arrêt, sans doublon ni oubli ; lignes datées ; « reste » seulement après un tour complet, jamais négatif ; chantier sans dossier ; dossier sans chantier ; corbeille non comptée ; avec et sans service avancé ; onglet aux titres modifiés → arrêt.
- **Alertes** : 70, 85, 95 ; plafond de deux par mois pour les deux premiers ; marque posée après l'envoi seulement (panne de mail simulée) ; au-dessus du seuil à l'installation.
- **Propositions** : anciens indices (dernier indice, document retiré puis redéposé, dossier inconnu, deux dossiers de même nom : jamais proposés) ; chantier terminé — chaque condition manquante bloque et le dit ; dossier trouvé par ressemblance, « À vérifier », identifiant partagé par deux chantiers, relevé d'un autre chantier : jamais proposé ; date « Terminé » posée et effacée toute seule.
- **Purge** : rien sans case ; conditions revérifiées (relevé de plus de 7 jours, fichier arrivé entre-temps laissé en place) ; fichier par fichier ; dossiers gardés ; journal écrit avant ; exécution coupée au milieu puis reprise ; **annulation qui remet tout** et compte ce qui manque ; lignes triées par Franck ; deux cases cochées ; fichier hors de la racine de l'environnement refusé ; mail envoyé ; le verrou des fiches n'est jamais pris.
- **Jamais** : aucun appel de suppression définitive dans le fichier assemblé (test).
- Programme du PC : `--verifier` après purge d'un ancien indice.
- Toutes les séries existantes repassent.

**Ce qui ne se saura que sur le vrai Google, avec Franck, sur la copie TEST** : ce que mesure vraiment Google (comparé à one.google.com/storage) ; la durée du parcours ; ce que devient le contenu d'un dossier mis à la corbeille et sa restauration ; l'activation du service avancé. **Aucun essai de purge en production** : la première vraie purge sera faite par Franck, sur un chantier qu'il choisit, après avoir vu les onglets.

## 9. Ce que Franck aura à faire

1. Un envoi sur la copie TEST ; je mesure, je compare avec lui le chiffre de Google ; purge d'essai d'un faux chantier terminé de la copie TEST ; il regarde les deux onglets depuis son téléphone, coche, annule.
2. Si besoin : activer le service avancé Drive (une case, je guide).
3. Production : coller le serveur v10.0, `installerLot5Production`, nouveau déploiement.
4. Avant de cocher une purge : vérifier les lignes « À vérifier » de *Dossiers chantiers*, relancer le programme du PC (relevé de moins de 7 jours), regarder l'icône de MEGA.

**Retour arrière** : retirer les déclencheurs du lot (une fonction), recoller le serveur v9.1 ; les onglets *Stockage* et *Purges* peuvent rester ; une purge déjà faite reste annulable à la main dans la corbeille de Drive pendant 30 jours (les fichiers y sont listés dans *Purges détail*).

## 10. Risques

| Risque | Parade |
|---|---|
| Purger une fiche qui n'est pas dans MEGA | comparaison un pour un avec un relevé de moins de 7 jours, dans la même exécution ; corbeille seulement ; annulation 25 jours ; mail à chaque purge |
| Purger le mauvais chantier | dossier pris sur une ligne explicite et unique ; relevé du bon chantier ; racine de l'environnement vérifiée |
| Le relevé dit « présent » alors que MEGA n'a pas fini d'envoyer | rappel sur la ligne et dans le mail : « vérifiez l'icône de MEGA » |
| Case cochée par erreur | revérification ; corbeille ; mail immédiat ; case « Annuler » |
| Exécution coupée en pleine purge | journal écrit avant chaque mise à la corbeille ; reprise |
| Une fiche arrive d'un téléphone après la purge | les dossiers restent ; elle est rangée normalement, et sera rapatriée puis proposée plus tard |
| Le chiffre de place est faux | deux sources, comparées à celle de Google lors de l'essai ; l'onglet dit laquelle |
| Compte plein | seuil à 95 % toujours envoyé ; état en haut de l'onglet ; explication dans la procédure |
| Les limites de Google | 4 minutes par passage ; purge hors du verrou des fiches ; déclencheur de purge qui sort aussitôt |

## 11. Ce que la critique indépendante a fait changer (14/11/2026)

- Anciens indices : raisonnement **par dossier** (un document retiré puis redéposé partage son dossier : la version 1 l'aurait mis à la corbeille alors qu'il est en service).
- Le dossier du chantier n'est jamais pris par ressemblance ; le relevé doit être celui du chantier ; la racine de l'environnement est vérifiée.
- Fiches et photos : **fichier par fichier**, seulement ceux qui viennent d'être comparés ; les dossiers restent.
- Journal écrit **avant** la mise à la corbeille.
- Le chiffre de Google n'est plus tenu pour acquis : deux sources, essai de comparaison.
- Gmail et la corbeille apparaissent dans l'onglet ; troisième seuil à 95 % ; ce qui arrive à 100 % est écrit.
- La purge a son propre déclencheur et son propre verrou : elle ne retarde jamais une fiche.
- Lignes à clé fixe ; mail à chaque purge ; annulation fermée à 25 jours.
- Date « Terminé » posée et effacée automatiquement ; relevé de moins de 7 jours au moment de la purge.
- Estimation recalée ; politique de conservation reprise ; retour arrière écrit.

## 12. Ce que je te demanderai de trancher

1. **Pas de suppression définitive par le serveur** (§4.5).
2. Les seuils : 70 %, 85 %, 95 % ; 6 mois après « Terminé » ; relevé de moins de 7 jours au moment de la purge.
3. Le carnet d'un chantier terminé part en même temps que ses fiches (ou reste plus longtemps ?).
