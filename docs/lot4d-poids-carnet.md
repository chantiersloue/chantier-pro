# Lot 4d — Le poids du carnet : pourquoi l'estimation se trompait, et comment alléger (étude)

> **Étude seulement : rien n'est changé dans la fabrication des images du carnet.** Seule l'estimation de « Voir seulement » est corrigée (lot 4d).
> Mesures du 18/11/2026 : le vrai carnet d'un chantier, lu sans rien toucher (2 plans, 13 pages) ; les essais sont faits sur des **copies** et sur des PDF inventés, dans un dossier temporaire supprimé ensuite. Aucun nom réel ici.
> Mots utilisés : une **page** du carnet est découpée en **tuiles** (carrés de 512 points d'image) ; il y a plusieurs **niveaux** (le niveau le plus fin, à 200 dpi, pour le zoom maximal ; puis chaque niveau divise par deux) ; **WebP** est le format d'image utilisé (comme JPEG, en mieux) ; la **qualité** (0 à 100) règle la compression.

## 1. Ce que pèse vraiment un plan

Le plan de 7 pages qui t'a surpris : **29,0 Mo, 199 fichiers** (184 paquets de tuiles, 14 aperçus, 1 fichier d'avancement), pour 50 Mo annoncés.

| Mesure (vrai carnet, 13 pages) | Valeur |
|---|---|
| Format des pages | 12 pages au format A0 (9 362 × 6 622 points à 200 dpi), 1 page A4 |
| Poids d'une page A0 | de **2,3 Mo** (plan aéré) à **7,6 Mo** (plan chargé) ; **4,8 Mo en moyenne** |
| Tuiles par page A0 | 345 (247 au niveau le plus fin, puis 70, 20, 6, 2) |
| Poids moyen d'une tuile du niveau le plus fin | de 4,9 Ko (page aérée) à 17,9 Ko (page chargée) ; plus haut, 8 à 37 Ko (une tuile couvre 4 fois plus de plan) |
| Part du niveau le plus fin dans le poids | 56 % ; les aperçus : 7 % |
| Tuiles blanches ou presque (moins de 0,7 Ko) | 18 % des tuiles, mais **0,5 % du poids** |

**Pourquoi l'estimation était fausse.** L'ancienne règle comptait un poids fixe par point d'image (0,14 octet), comme si toutes les pages étaient aussi chargées que le plus dense des plans d'essai. Or le poids dépend de ce qui est dessiné : le blanc ne pèse presque rien. Sur ce plan, le vrai chiffre va de 0,038 à 0,128 octet par point (0,081 en moyenne) : d'où 50 Mo annoncés pour 29 Mo. Sur un plan aéré, l'ancienne règle annonçait 25 fois trop ; sur un document de texte serré, 3 fois trop peu.

**La nouvelle estimation** (lot 4d) fabrique pour de vrai une petite partie des images, exactement comme le dépôt, sans rien écrire : les deux aperçus, les petits niveaux en entier, et dans les grands niveaux une tuile sur 20 environ, choisie pour représenter les tuiles vides, moyennes et chargées (d'après l'aperçu). Environ **1 seconde par grande page**.

| Cas | Poids réel du dépôt | Ancienne règle | **Nouvelle estimation** |
|---|---|---|---|
| Le plan réel de 7 pages (copie refaite à partir de ses tuiles) | 24,0 Mo | 50,2 Mo (+109 %) | **23,6 Mo (−2 %)** ; page par page : −8 % à +6 % |
| Plan aéré inventé, A1, 3 pages | 0,50 Mo | 12,4 Mo | **0,48 Mo (−4 %)** |
| Plan chargé inventé, A0, 3 pages | 10,8 Mo | 24,8 Mo | **11,0 Mo (+1 %)** |
| Scan inventé, A3, 2 pages | 1,39 Mo | 2,07 Mo | **1,38 Mo (−1 %)** |
| Document de texte inventé, A4, 8 pages (150 dpi) | 7,25 Mo | 2,32 Mo | **7,24 Mo (0 %)** |

La copie du plan réel pèse 17 % de moins que l'original (elle est refaite à partir d'images déjà compressées) : la nouvelle estimation a été vérifiée sur cette copie, pas sur le PDF d'origine (qui est sur ton PC, hors de ce que j'avais le droit de lire). Deux tests automatiques vérifient les ±20 %.

## 2. Comment alléger : les pistes mesurées

Mesures sur la pyramide complète d'une page (toutes les tuiles), par rapport à aujourd'hui (WebP qualité 70, 200 dpi). Lisibilité : j'ai regardé des recadrages grossis comme au zoom maximal du carnet (3 fois), sur une cote de 2 mm d'un plan inventé et sur une zone chargée du plan réel (petites annotations de 1,5 mm).

| Piste | Plan réel chargé | Plan réel aéré | Plan chargé inventé | Plan aéré inventé | Scan | Lisibilité au zoom maximal | Côté appli |
|---|---|---|---|---|---|---|---|
| **WebP qualité 50** | **−15 %** | **−14 %** | −11 % | −5 % | −50 % | identique à l'œil (cote de 2 mm et annotations de 1,5 mm nettes) | rien |
| WebP qualité 35 | −27 % | −26 % | −20 % | −10 % | −73 % | lisible ; petites taches sur les aplats, couleurs fines ternies | rien |
| JPEG qualité 70 | +60 % | +138 % | +139 % | +650 % | +77 % | — | à changer (format annoncé au téléphone) |
| PNG en palette (16 couleurs) | +39 % | +71 % | −27 % | −14 % | +641 % | net, couleurs approchées | à changer |
| WebP « sans perte » en palette (16 couleurs) | +12 % | +32 % | −46 % | −55 % | +610 % | très net ; un rouge foncé devient brun | rien |
| Le plus léger des deux, tuile par tuile (WebP 70 ou sans perte) | −3 % | −4 % | −46 % | −55 % | 0 % | comme ci-dessus selon la tuile | rien |
| Niveaux de gris | −10 % | −9 % | −3 % | 0 % | 0 % | lisible, **couleurs perdues** (repérages, signalétique) | rien |
| Niveau le plus fin à 150 dpi au lieu de 200 | −35 % | −32 % | −28 % | −32 % | −53 % | cote de 2 mm lisible mais floue ; annotations de 1 à 1,5 mm à la limite (comme à l'essai S1) | rien |
| 150 dpi + WebP 50 | −45 % | −43 % | −35 % | non mesuré | non mesuré | idem, un peu plus flou | rien |
| Tuiles blanches non gardées | −0,5 % (vrai carnet) | −2 % | 0 % | −9 % | 0 % | identique | presque rien (le carnet sait déjà se passer d'une tuile) ; le contrôle `--verifier` à adapter |

Ce qu'il faut savoir :
- **WebP est déjà le format du carnet**, lu par les iPhone depuis iOS 14 et par Android. Changer de format (JPEG, PNG) obligerait à changer `carnet.html` (le téléphone annonce « image WebP » pour chaque tuile), donc une nouvelle version de l'appli et de son cache : à éviter, et ce serait plus lourd de toute façon.
- **Les pistes « rien côté appli »** ne touchent que les **nouveaux** dépôts : les documents déjà au carnet restent tels quels, les téléphones n'ont rien à vider.
- **Le « sans perte »** est très bon sur un plan vectoriel propre (−46 à −55 %), mauvais sur le plan réel (dont ma copie est refaite à partir d'images déjà compressées : elle le défavorise) et catastrophique sur un scan. Seul un essai sur les **vrais PDF** dira ce qu'il donne pour tes plans.
- **Le temps de dépôt** : 8 à 10 secondes par page A0 aujourd'hui ; WebP 50 ne change rien ; « le plus léger des deux » le multiplie par 2 ou 3.

## 3. La place du compte (15 Go pour Drive, Gmail et Photos)

**Hypothèses** : 35 à 40 chantiers en cours, 6 à 8 plans au carnet chacun, 3 à 7 pages par plan ; 6 pages sur 7 en grand format (comme les deux plans mesurés), d'où **4,1 Mo par page** en moyenne aujourd'hui (6 × 4,8 + 0,2) ÷ 7 ; 3,5 Mo avec WebP 50 (−15 %) ; 2,8 Mo à 150 dpi (−32 %).

| Cas | Pages | Aujourd'hui | Avec WebP 50 | Avec 150 dpi |
|---|---|---|---|---|
| Bas : 35 chantiers × 6 plans × 3 pages | 630 | **2,5 Go** | 2,2 Go | 1,7 Go |
| Moyen : 38 chantiers × 7 plans × 5 pages | 1 330 | **5,3 Go** | 4,5 Go | 3,6 Go |
| Haut : 40 chantiers × 8 plans × 7 pages | 2 240 | **9,0 Go** | 7,7 Go | 6,1 Go |

Calcul : pages × poids d'une page ÷ 1 024 (Mo → Go). Exemple du cas moyen : 38 × 7 × 5 = 1 330 pages ; 1 330 × 4,1 = 5 453 Mo = 5,3 Go.

**Les anciens indices.** Un plan refait part sous l'indice suivant : **l'ancien reste dans le Drive** (le carnet ne le montre plus) jusqu'à ce que tu coches « Anciens indices du carnet » dans l'onglet *Purges* (lot 5), puis 30 jours dans la corbeille, qui compte dans les 15 Go. Si un plan sur deux est refait une fois : **+50 %** sans jamais purger ; environ **+10 %** en cochant la purge une fois par mois.

**À comparer** : le budget du lot 5 comptait 80 Mo de carnet par chantier ; le cas moyen mesuré en donne **environ 145 Mo** (7 plans × 5 pages × 4,1 Mo). Avec les fiches et photos (1,5 Go), ce qui est déjà utilisé (3,3 Go) et la corbeille (0,9 Go), le cas moyen arrive vers **11,5 Go, soit 77 %** : juste sous l'alerte de 80 %. Le carnet est donc le premier poste à surveiller (l'onglet *Stockage* donnera le vrai chiffre chaque nuit).

## 4. Recommandation

1. **Passer à WebP qualité 50 pour les nouveaux dépôts** : −11 à −15 % sur les plans, −50 % sur les scans, lisibilité identique à l'œil, une seule ligne à changer dans `outils/depot_carnet.py`, rien côté téléphones. **À essayer d'abord** : déposer un vrai plan dans le carnet TEST en qualité 50 et le regarder au zoom maximal sur ton téléphone, en plein jour, à côté du même plan en qualité 70.
2. **Purger les anciens indices une fois par mois** (case déjà construite au lot 5) : c'est la plus grosse économie possible (jusqu'à un tiers du carnet), sans rien perdre.
3. **Essai à faire, sans engagement** : « le plus léger des deux, tuile par tuile » (WebP avec perte ou sans perte en palette de 32 couleurs) sur 3 ou 4 vrais PDF de ton PC. À retenir seulement s'il gagne au moins 25 % et si les couleurs restent justes.
4. **Ne pas faire** : JPEG, PNG, niveaux de gris, tuiles blanches non gardées (gain nul). **150 dpi en dernier recours seulement** (−30 %, mais les petites annotations deviennent floues : c'est pour elles que 200 dpi avait été choisi).

**Ce qu'il faudrait construire (rien n'est construit)** : un petit lot « 4e » — la qualité 50 dans `depot_carnet.py`, ses tests, l'essai sur la copie TEST avec un vrai plan, la ligne du journal ; puis, si l'essai 3 est concluant, une option « le plus léger des deux » derrière un réglage, essayée de la même façon.
