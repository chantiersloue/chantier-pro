# Lot 4 — étape 4.0 : les trois vérifications

> Plan : `docs/lot4-plan.md`, chapitre 3. Rien n'est en production ; tout se passe sur la copie TEST.

## Où on en est

| Vérification | État |
|---|---|
| **A1. Transformer un grand plan en images sur le PC** | **Fait (13/11/2026).** Module `pypdfium2` 5.15.2 installé. Sur les trois gros PDF d'essai (16 Mo, pages de 1 400 × 841 mm à 200 dpi) : **12 à 102 secondes par grande page** (limite d'une commande de skill : 180 s), 36 fichiers et 2 à 8 Mo par grande page, images au total ≈ poids du PDF + 15 %. Contrôle à l'œil : cotes et repères nets, aucune cassure entre les bandes |
| **A2. Un skill peut-il lancer ce programme et écrire dans le Drive ?** | **Fait (13/11/2026) : non, pas directement.** Voir « Résultat de l'essai A2 et solutions de dépôt » |
| **B. Le serveur est-il assez rapide ?** | **Fait (13/11/2026), objectifs tenus** : voir « Résultats de la mesure B » |
| **C. Les plans ne prennent pas la place des fiches** | **Pas encore vérifié.** L'essai « carnet plein → une fiche avec photos part quand même » a besoin du vrai rangement du carnet dans le téléphone, qui s'écrit au lot 4a : il y sera un test obligatoire avant toute livraison (écart avec le plan, qui le prévoyait dès 4.0) |

## Résultat de l'essai A2 et solutions de dépôt (13/11/2026)

**Ce que l'essai a montré**, dans une conversation LOUE TRAVAIL :
- le skill travaille dans un espace Linux (Python 3.10, avec Pillow et pypdfium2 5.14), pas sur le PC ;
- le dossier MEGA du chantier (`Z:\CHANTIERS\…`) y est **monté** : le skill peut y lancer des commandes ;
- le dossier du Drive (`G:\Mon Drive\…`) n'y est **pas monté** : le skill ne peut pas y lancer de commande. Il peut seulement y lire, copier ou déposer un fichier par son chemin Windows, un fichier à la fois ;
- sur le PC lui-même, le programme de dépôt écrit sans difficulté dans `G:` (vérifié : deux documents déposés dans le Drive TEST, visibles par le serveur en moins de deux minutes).

Mesuré sur le PC : le Drive de l'appli pèse **0,5 Go** aujourd'hui (15 Go au plus, c'est la limite du compte gratuit) ; le disque `C:` a 57 Go libres.

### Les solutions comparées

| | Ce que ça demande | Avantages | Inconvénients |
|---|---|---|---|
| **1. Drive pour ordinateur en mode « miroir »** | Changer un réglage de Drive pour ordinateur : tout « Mon Drive » est recopié sur le disque (0,5 Go aujourd'hui, jusqu'à 15 Go), dans un dossier ordinaire. Puis essayer si ce dossier se monte dans le skill | Si le dossier se monte, le skill dépose seul, tout de suite | **Rien ne garantit que le dossier se montera** (à essayer). Le Drive change d'emplacement sur le PC (les habitudes et les chemins changent). Le skill transformerait les plans avec **son** Python (3.10, autre version du moteur) : un rendu jamais contrôlé, et la limite de 3 minutes par commande. Deux environnements à maintenir |
| **2. Le skill fabrique les images chez lui, puis les dépose une par une par le chemin Windows** | Rien à installer | Aucune action de Franck | Un document de 3 grands plans = **environ 110 fichiers** à déposer un par un : long, coûteux, et un arrêt en route laisse un document à moitié déposé. Même défaut de rendu non contrôlé que la solution 1. **Écartée** |
| **3. Un fichier `.bat` lancé par Franck** | Rien : `outils\deposer.bat` existe et marche | Sûr, déjà testé, un seul programme | Une manipulation par document (répondre à 5 questions) : c'est ce que la commande voulait éviter |
| **4. Le skill écrit une « demande de dépôt », le PC dépose** *(ma proposition)* | Le skill dépose **un seul petit fichier** dans un dossier `_DEPOTS` du Drive (ce qu'il sait faire) : quel chantier, quel PDF de MEGA, quel code, quel indice. Sur le PC, le programme de dépôt traite les demandes en attente : soit d'un double-clic (« Déposer ce qui attend »), soit tout seul par une **tâche planifiée de Windows** (gratuit, déjà dans Windows) | Aucune réponse à taper ; un seul programme et un seul rendu, ceux qui sont testés ; pas de limite de 3 minutes ; le Drive reste comme il est ; le skill peut relire le résultat | Le PC doit être allumé (c'est déjà le cas pour MEGA). Un petit programme de plus à écrire (au lot 4c). La tâche planifiée est à créer une fois par Franck |

Source pour le mode miroir : aide officielle de Google, « Diffuser et dupliquer des fichiers avec Drive pour ordinateur » (support.google.com/drive/answer/13401938) — en miroir, une copie complète de « Mon Drive » est sur l'ordinateur et utilise son disque ; le réglage est dans Préférences → Dossiers de Drive → options de synchronisation de Mon Drive.

### Recommandation

**Solution 4**, avec la solution 3 en secours (elle marche dès aujourd'hui). Le mode miroir n'est **pas recommandé** : il ne coûterait que 0,5 Go, mais il déplace le Drive, son résultat est incertain, et il ferait fabriquer les plans par un second environnement jamais contrôlé.

Ce qui reste à vérifier pour la solution 4 (5 minutes, quand tu veux ; rien ne presse, c'est pour le lot 4c) :
1. Dans une conversation LOUE TRAVAIL, avec le dossier `CHANTIERPRO-TEST` connecté, colle :
   ```text
   Essai technique pour mon appli ChantierPro (n'applique pas gestion-documentaire à ce dossier, ne supprime rien).
   Dépose dans le dossier CHANTIERPRO-TEST connecté, dans un sous-dossier nommé _DEPOTS (crée-le s'il n'existe pas),
   un fichier texte nommé essai-demande.json contenant exactement : {"essai": true, "heure": "<l'heure qu'il est>"}
   Puis relis ce fichier et montre-moi son contenu. Dis-moi quel outil tu as utilisé et si quelque chose a été refusé.
   ```
2. Dis-moi « demande déposée » : je vérifie depuis le PC que le fichier est bien arrivé dans `G:`.

Si cet essai échoue, on garde la solution 3 (le `.bat`), et le mode miroir devient l'essai suivant : Préférences de Drive pour ordinateur → Dossiers de Drive → « Dupliquer les fichiers », choisir un dossier, attendre la fin de la copie, connecter ce dossier à une conversation et demander à Claude s'il le voit dans son espace de travail.

## Essai A2 — le texte utilisé

1. Dans l'application Claude, ouvre le projet **LOUE TRAVAIL** et démarre une nouvelle conversation.
2. Connecte à cette conversation le dossier **`CHANTIERPRO-TEST`** de `G:\Mon Drive` (comme tu connectes d'habitude un dossier de chantier). **Seulement celui-là** : pas la racine de production.
3. Colle le texte ci-dessous, en remplaçant la dernière ligne par le chemin d'un **grand plan PDF** de ton choix (un plan d'architecte de plusieurs Mo).
4. Copie-moi la réponse de Claude en entier.

```text
Essai technique pour mon appli ChantierPro. Il n'y a rien à produire ni à ranger : n'applique PAS les règles de
gestion-documentaire à ce dossier, ne déplace et ne supprime rien.

Le programme ci-dessous doit tourner LÀ OÙ SONT MES FICHIERS. Fais l'essai DEUX fois si tu as les deux moyens, et
dis-moi clairement lequel est lequel :
 (1) SUR MON PC WINDOWS, avec l'outil qui lance des commandes sur mon ordinateur (celui dont parle
     gestion-documentaire pour les scripts du PC), en donnant les chemins Windows du dossier CHANTIERPRO-TEST connecté
     et du plan PDF ;
 (2) DANS TON ESPACE DE TRAVAIL (Linux), en donnant les chemins sous lesquels TU vois le dossier CHANTIERPRO-TEST
     connecté et le plan PDF (dossiers montés), pas les chemins Windows.
Pour chaque essai : écris le programme tel quel sous le nom essai_carnet.py (hors des dossiers connectés), lance-le
avec deux arguments (le dossier CHANTIERPRO-TEST, puis le plan PDF), et donne-moi sans rien résumer : tout ce qu'il a
affiché, l'outil utilisé, et la durée de la commande.
Dis-moi aussi : sous quel chemin vois-tu le dossier CHANTIERPRO-TEST et le plan dans ton espace de travail ? Vois-tu,
sur mon PC, un dossier « chantier-pro » dans DocumentsGitHub ?
Si un module manque ou si un des deux moyens n'existe pas, n'installe rien : dis-le-moi simplement.

--- essai_carnet.py ---
# -*- coding: utf-8 -*-
# Essai technique ChantierPro (lot 4, etape 4.0-A) : un skill peut-il deposer des images dans le Drive de l'appli ?
# Usage : python essai_carnet.py "<dossier CHANTIERPRO-TEST connecte>" "<un grand plan PDF>"
# N'ecrit que dans le sous-dossier "_ESSAI SKILL" du dossier donne. Ne supprime rien.
import os, sys, time, platform

def ligne(nom, fn):
    try:
        print("[OK]    %s : %s" % (nom, fn()))
    except Exception as e:
        print("[ECHEC] %s : %s: %s" % (nom, type(e).__name__, e))

racine, pdf = sys.argv[1], sys.argv[2]
essai = os.path.join(racine, "_ESSAI SKILL")
if not os.path.isdir(racine) or not os.path.isfile(pdf):
    print("Python %s (%s) sur %s" % (platform.python_version(), sys.executable, platform.platform()))
    print("ARRET, rien n'est ecrit. Dossier visible d'ici : %s | PDF visible d'ici : %s" % (os.path.isdir(racine), os.path.isfile(pdf)))
    print("Ce programme ne tourne pas la ou sont ces fichiers, ou les chemins ne sont pas ceux de cette machine.")
    print("Dossier courant : %s | contenu du dossier personnel : %s" % (os.getcwd(), sorted(os.listdir(os.path.expanduser("~")))[:30]))
    sys.exit(2)
print("Python %s (%s) sur %s" % (platform.python_version(), sys.executable, platform.platform()))
print("Dossier donne : %s | existe : %s | contient dossiers.json : %s" % (racine, os.path.isdir(racine), os.path.exists(os.path.join(racine, "dossiers.json"))))
ligne("module Pillow avec WebP", lambda: __import__("PIL").__version__ + " webp=" + str(__import__("PIL.features").features.check("webp")))
ligne("module pypdfium2", lambda: str(__import__("pypdfium2").PYPDFIUM_INFO))

def ecrire(nom, texte):
    with open(os.path.join(essai, nom), "w", encoding="utf-8") as f:
        f.write(texte)
    return "fait"

graine = time.strftime("%H%M%S")
ligne("creer le dossier d'essai", lambda: (os.makedirs(essai, exist_ok=True), "fait")[1])
ligne("creer un fichier", lambda: ecrire("a-%s.txt" % graine, "premiere version"))
ligne("reecrire ce fichier", lambda: ecrire("a-%s.txt" % graine, "seconde version"))
ligne("le renommer", lambda: (os.rename(os.path.join(essai, "a-%s.txt" % graine), os.path.join(essai, "b-%s.txt" % graine)), "fait")[1])
ligne("creer un second fichier", lambda: ecrire("c-%s.txt" % graine, "a remplacer"))
ligne("renommer PAR-DESSUS un fichier existant", lambda: (os.replace(os.path.join(essai, "b-%s.txt" % graine), os.path.join(essai, "c-%s.txt" % graine)), "fait")[1])
ligne("relire le resultat", lambda: open(os.path.join(essai, "c-%s.txt" % graine), encoding="utf-8").read())
ligne("ecrire 500 Ko d'octets", lambda: (open(os.path.join(essai, "paquet-%s.pak" % graine), "wb").write(os.urandom(512000)), "fait")[1])

def rendre():
    import io, pypdfium2
    doc = pypdfium2.PdfDocument(pdf)
    page = max(doc, key=lambda p: p.get_size()[0] * p.get_size()[1])
    l, h = page.get_size(); s = 200 / 72.0; debut = time.time(); poids = 0
    for i in range(4):                       # 4 bandes : jamais la page entiere en memoire
        im = page.render(scale=s, crop=(0, h * (3 - i) / 4, 0, h * i / 4)).to_pil().convert("RGB")
        t = io.BytesIO(); im.save(t, "WEBP", quality=70); poids += len(t.getvalue())
    return "%d pages ; la plus grande %.0f x %.0f mm rendue a 200 dpi en %.1f s ; %.1f Mo de WebP" % (len(doc), l / 72 * 25.4, h / 72 * 25.4, time.time() - debut, poids / 1048576)

ligne("transformer la plus grande page du PDF", rendre)
print("Fin de l'essai. Les fichiers d'essai sont dans : " + essai)
--- fin ---

Plan PDF à utiliser : (colle ici le chemin du plan)
```

**Premier essai (13/11/2026) : non concluant.** Le programme a tourné dans l'espace de travail de Claude (Linux, Python 3.10, avec Pillow et pypdfium2 5.14 déjà présents), pas sur le PC : les chemins Windows n'y existent pas, donc rien n'a été écrit dans le Drive et le plan n'a pas été trouvé. Enseignement utile : cet espace de travail a déjà les deux modules. Le texte ci-dessus a été corrigé (les deux moyens sont essayés, et le programme s'arrête sans rien écrire s'il ne voit pas les fichiers).

Ce que l'essai nous dira : quel Python utilise un skill et s'il a les deux modules ; s'il peut créer, réécrire et renommer un fichier dans le Drive de l'appli ; s'il voit le dépôt ; et le temps réel de transformation d'un grand plan. Les fichiers d'essai restent dans `CHANTIERPRO-TEST/_ESSAI SKILL` (tu pourras supprimer ce dossier toi-même après).

## Résultats de la mesure B (13/11/2026, copie TEST, serveur dc9f6f8892)

| Geste | Mesuré (bon réseau) | dont serveur | Réponse | Avec une barre de réseau (**calculé**, pas mesuré) | Objectif |
|---|---|---|---|---|---|
| liste des documents | 3,7 s | 1,5 s | 1 Ko | 5,0 s | 8 s ✓ |
| aperçu léger (70 Ko) | 4,6 s | 2,2 s | 93 Ko | 7,7 s | 10 s ✓ |
| aperçu net (250 Ko) | 6,0 s | 2,9 s | 333 Ko | 14,0 s | — |
| écran de 4 tuiles voisines (1 paquet) | 5,5 s | 2,5 s | 142 Ko | 9,6 s | 15 s ✓ |
| écran de 6 tuiles sur 2 paquets | 5,8 s | 3,1 s | 204 Ko | 11,2 s | 15 s ✓ |
| 16 tuiles d'un paquet (téléchargement de masse) | 5,4 s | 2,3 s | 554 Ko | 17,9 s | — |

- Toutes les images reçues sont **identiques à l'octet près** à ce qui a été déposé (le découpage des paquets par le vrai serveur est juste).
- **10 téléphones** en même temps (60 demandes) : 0 erreur, la plus lente 9,2 s. **15 téléphones** (90 demandes) : 0 erreur, la plus lente 9,2 s.
- Aucun mail, faux document retiré, comptes d'essai refermés.

Ce qu'il faut en retenir :
- **Chaque demande coûte 4 à 6 secondes, même avec un bon réseau** (2 à 3 s dans le serveur, 2 s d'aller-retour chez Google). Le carnet ne sera jamais « instantané » en ligne : d'où l'aperçu léger affiché d'abord, et l'intérêt de tout garder dans le téléphone. Une page déjà vue s'ouvre, elle, tout de suite.
- Le chiffre « une barre de réseau » est un **calcul** (3 allers-retours de 400 ms + 50 Ko/s). **Mesuré pour de bon le 13/11/2026** avec la vraie page en « 3G lente » (`docs/lot4a-procedure.md`) : liste 3,9 s, aperçu 8,6 s, zoom 11,3 s — objectifs tenus.
- Non mesuré ici : des fiches envoyées pendant que 15 téléphones lisent le carnet ; les paquets réels les plus lourds (690 Ko, contre 400 Ko dans l'essai). À refaire au 4a avec de vrais plans.
- Format confirmé : paquets de 4 × 4 tuiles voisines, réponses de 300 Ko au plus en lecture.

## Mesure B — comment elle est faite

`node tests/mesure-lot4.js` : dépose un faux document (octets au hasard) dans le carnet du chantier d'essai, mesure la liste, les aperçus, des écrans de tuiles, puis 10 et 15 téléphones en même temps, compare chaque image reçue à ce qui a été déposé, et retire le faux document. Aucun mail, aucune donnée réelle.
