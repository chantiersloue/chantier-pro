# -*- coding: utf-8 -*-
"""Lot 4, étape 4.0 — MESURE : transformer un PDF en pages-images (aperçus + tuiles), et dire combien de temps cela prend.

    python outils/essai_rendu.py "<chemin du PDF>" [--sortie <dossier>] [--dpi 200] [--pages 1,3]

Ce programme ne dépose rien dans le carnet : il mesure (durée par page, nombre et poids des images) et, avec --sortie,
écrit les images dans un dossier pour les regarder. Le rendu lui-même est celui du programme de dépôt (depot_carnet.py).
Aucun chemin, aucun nom de chantier n'est écrit ici : tout est passé en argument.
"""
import argparse
import os
import sys
import time

# Le rendu (bandes, tuiles, paquets) vit dans le programme de dépôt : une seule version du code, mesurée ici.
from depot_carnet import QUALITE, Refus, charger_modules, traiter_page


def main():
    a = argparse.ArgumentParser(description="Mesure du rendu d'un PDF en pages-images (lot 4, étape 4.0)")
    a.add_argument("pdf")
    a.add_argument("--dpi", type=int, default=200)
    a.add_argument("--sortie", help="dossier où écrire les images (pour les regarder)")
    a.add_argument("--pages", help="numéros de pages, séparés par des virgules (par défaut : toutes)")
    o = a.parse_args()
    for flux in (sys.stdout, sys.stderr):
        if hasattr(flux, "reconfigure"):
            flux.reconfigure(encoding="utf-8", errors="replace")
    try:
        pypdfium2, _ = charger_modules()
    except Refus as e:
        sys.exit(str(e))
    pdf = pypdfium2.PdfDocument(o.pdf)
    voulues = [int(x) for x in o.pages.split(",")] if o.pages else list(range(1, len(pdf) + 1))
    print("PDF de %.1f Mo, %d page(s) ; rendu à %d dpi, WebP qualité %d" % (os.path.getsize(o.pdf) / 1048576, len(pdf), o.dpi, QUALITE))
    total_s, total_o, pire = 0.0, 0, 0.0
    for n in voulues:
        page = pdf[n - 1]
        ecrire = None
        if o.sortie:
            dossier = os.path.join(o.sortie, "p%d" % n)
            os.makedirs(dossier, exist_ok=True)

            def ecrire(nom, octets, dossier=dossier):
                with open(os.path.join(dossier, nom), "wb") as f:
                    f.write(octets)
        debut = time.time()
        d, fichiers = traiter_page(page, o.dpi, ecrire)
        duree = time.time() - debut
        poids = sum(t for _, t in fichiers)
        tuiles = sum(len(p["tuiles"]) for z in d["niveaux"] for p in z["paquets"])
        paquets = [t for nom, t in fichiers if nom.endswith(".pak")]
        print("  page %d : %d x %d points (%.0f x %.0f mm) ; %.1f s ; %d fichier(s), %.2f Mo ; aperçus %d et %d Ko ; %d tuile(s) en %d paquet(s)%s"
              % (n, d["l"], d["h"], d["l"] * 25.4 / o.dpi, d["h"] * 25.4 / o.dpi, duree, len(fichiers), poids / 1048576,
                 d["leger"]["o"] // 1024, d["net"]["o"] // 1024, tuiles, len(paquets),
                 (" (le plus gros : %d Ko)" % (max(paquets) // 1024)) if paquets else ""))
        total_s += duree
        total_o += poids
        pire = max(pire, duree)
        page.close()
    print("Total : %.1f s, %.2f Mo d'images (PDF : %.2f Mo) ; page la plus longue : %.1f s (limite d'une commande de skill : 180 s)"
          % (total_s, total_o / 1048576, os.path.getsize(o.pdf) / 1048576, pire))


if __name__ == "__main__":
    main()
