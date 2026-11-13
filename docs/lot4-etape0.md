# Lot 4 — étape 4.0 : les trois vérifications

> Plan : `docs/lot4-plan.md`, chapitre 3. Rien n'est en production ; tout se passe sur la copie TEST.

## Où on en est

| Vérification | État |
|---|---|
| **A1. Transformer un grand plan en images sur le PC** | **Fait (13/11/2026).** Module `pypdfium2` 5.15.2 installé. Sur les trois gros PDF d'essai (16 Mo, pages de 1 400 × 841 mm à 200 dpi) : **12 à 102 secondes par grande page** (limite d'une commande de skill : 180 s), 36 fichiers et 2 à 8 Mo par grande page, images au total ≈ poids du PDF + 15 %. Contrôle à l'œil : cotes et repères nets, aucune cassure entre les bandes |
| **A2. Un skill peut-il lancer ce programme et écrire dans le Drive ?** | **À faire par Franck** (20 minutes) : voir ci-dessous |
| **B. Le serveur est-il assez rapide ?** | Serveur d'essai écrit et testé (13 tests) ; **attend un envoi clasp** de Franck, puis je lance `node tests/mesure-lot4.js` |
| **C. Les plans ne prennent pas la place des fiches** | À faire par moi, dans le navigateur, sans rien demander à Franck |

## Essai A2 — à faire par Franck

1. Dans l'application Claude, ouvre le projet **LOUE TRAVAIL** et démarre une nouvelle conversation.
2. Connecte à cette conversation le dossier **`CHANTIERPRO-TEST`** de `G:\Mon Drive` (comme tu connectes d'habitude un dossier de chantier). **Seulement celui-là** : pas la racine de production.
3. Colle le texte ci-dessous, en remplaçant la dernière ligne par le chemin d'un **grand plan PDF** de ton choix (un plan d'architecte de plusieurs Mo).
4. Copie-moi la réponse de Claude en entier.

```text
Essai technique pour mon appli ChantierPro. Il n'y a rien à produire ni à ranger : n'applique PAS les règles de
gestion-documentaire à ce dossier, ne déplace et ne supprime rien.

1. Écris le programme ci-dessous dans ton dossier de travail sur mon PC (pas dans un dossier connecté), sous le nom
   essai_carnet.py, sans rien y changer.
2. Lance-le sur mon PC avec deux arguments : le chemin du dossier CHANTIERPRO-TEST que je viens de connecter, puis le
   chemin du plan PDF indiqué tout en bas.
3. Donne-moi, sans rien résumer : tout ce que le programme a affiché ; l'outil que tu as utilisé pour le lancer ;
   combien de temps la commande a duré ; et dis-moi si tu vois, depuis cet outil, un dossier nommé « chantier-pro »
   (dans Documents\GitHub).
Si un module manque, ne l'installe pas : dis-le-moi simplement.

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

Ce que l'essai nous dira : quel Python utilise un skill et s'il a les deux modules ; s'il peut créer, réécrire et renommer un fichier dans le Drive de l'appli ; s'il voit le dépôt ; et le temps réel de transformation d'un grand plan. Les fichiers d'essai restent dans `CHANTIERPRO-TEST/_ESSAI SKILL` (tu pourras supprimer ce dossier toi-même après).

## Mesure B — ce que je lance après l'envoi

`node tests/mesure-lot4.js` : dépose un faux document (octets au hasard) dans le carnet du chantier d'essai, mesure la liste, les aperçus, des écrans de tuiles, puis 10 et 15 téléphones en même temps, compare chaque image reçue à ce qui a été déposé, et retire le faux document. Aucun mail, aucune donnée réelle.
