# -*- coding: utf-8 -*-
"""Lot 4, étape 4.0 — MESURE : transformer un PDF en pages-images (aperçus + tuiles), et dire combien de temps cela prend.

    python outils/essai_rendu.py "<chemin du PDF>" [--sortie <dossier>] [--dpi 200] [--pages 1,3]

Ce programme ne dépose rien dans le carnet : il mesure (durée par page, nombre et poids des images) et, avec --sortie,
écrit les images dans un dossier pour les regarder. Le vrai programme de dépôt (lot 4a) reprendra ces fonctions.
Aucun chemin, aucun nom de chantier n'est écrit ici : tout est passé en argument.
"""
import argparse
import io
import os
import sys
import time

TUILE = 512          # côté d'une tuile, en points d'image
BANDE = 4            # une page est rendue par bandes de 4 rangées de tuiles (2 048 points) : jamais la page entière en mémoire
BLOC = 4             # un paquet = un bloc de 4 x 4 tuiles voisines
QUALITE = 70         # WebP qualité 0,7 (essai S1)
LEGER, NET = 800, 1600   # plus grand côté des deux aperçus


def charger_modules():
    try:
        import pypdfium2
        from PIL import Image, features
    except ImportError as e:
        sys.exit("Module manquant (%s). À lancer une fois :  python -m pip install pypdfium2==5.15.2 pillow" % e.name)
    if not features.check("webp"):
        sys.exit("Cette installation de Pillow ne sait pas écrire le format WebP.")
    Image.MAX_IMAGE_PIXELS = None    # nos bandes sont petites ; l'avertissement « image trop grande » ne nous concerne pas
    return pypdfium2, Image


def webp(image):
    tampon = io.BytesIO()
    image.save(tampon, "WEBP", quality=QUALITE, method=4)
    return tampon.getvalue()


def rendre_bande(page, echelle, largeur_pt, hauteur_pt, y0, y1):
    """La bande [y0, y1[ (en points d'image, depuis le haut) de la page rendue à cette échelle."""
    haut, bas = y0 / echelle, max(0.0, hauteur_pt - y1 / echelle)
    return page.render(scale=echelle, crop=(0, bas, 0, haut)).to_pil().convert("RGB")


def niveaux_de(largeur, hauteur):
    """Niveau 0 = pleine définition ; chaque niveau suivant divise par 2, jusqu'à tenir dans 2 x 2 tuiles."""
    n = [(0, largeur, hauteur)]
    while max(n[-1][1], n[-1][2]) > 2 * TUILE:
        z, l, h = n[-1]
        n.append((z + 1, (l + 1) // 2, (h + 1) // 2))
    return n


def traiter_page(page, dpi, ecrire=None):
    """Rend la page et rend sa description. « ecrire(nom, octets) » reçoit chaque fichier (aperçus et paquets)."""
    largeur_pt, hauteur_pt = page.get_size()
    plein = dpi / 72.0
    largeur, hauteur = int(round(largeur_pt * plein)), int(round(hauteur_pt * plein))
    description = {"l": largeur, "h": hauteur, "niveaux": []}
    fichiers = []

    def sortir(nom, octets):
        fichiers.append((nom, len(octets)))
        if ecrire:
            ecrire(nom, octets)
        return {"f": nom, "o": len(octets)}

    for nom, cote in (("leger", LEGER), ("net", NET)):
        e = min(plein, cote / max(largeur_pt, hauteur_pt))
        description[nom] = sortir(nom + ".webp", webp(page.render(scale=e).to_pil().convert("RGB")))
    if max(largeur, hauteur) <= NET:      # petite page (A4 de texte à 150 dpi) : les aperçus suffisent
        return description, fichiers
    for z, l, h in niveaux_de(largeur, hauteur):
        echelle = plein / (2 ** z)
        cols, ligs = -(-l // TUILE), -(-h // TUILE)
        paquets = {}
        for rangee in range(0, ligs, BANDE):
            y0, y1 = rangee * TUILE, min(h, (rangee + BANDE) * TUILE)
            bande = rendre_bande(page, echelle, largeur_pt, hauteur_pt, y0, y1)
            for li in range(rangee, min(ligs, rangee + BANDE)):
                for c in range(cols):
                    boite = (c * TUILE, li * TUILE - y0, min(l, (c + 1) * TUILE, bande.width), min(y1, (li + 1) * TUILE) - y0)
                    if boite[2] <= boite[0] or boite[3] <= boite[1]:
                        continue
                    paquets.setdefault((li // BLOC, c // BLOC), []).append((c, li, webp(bande.crop(boite))))
            bande.close()
        niveau = {"z": z, "cols": cols, "ligs": ligs, "paquets": []}
        for numero, cle in enumerate(sorted(paquets)):
            contenu, tuiles = b"", []
            for c, li, octets in paquets[cle]:
                tuiles.append([c, li, len(contenu), len(octets)])
                contenu += octets
            p = sortir("z%d-%d.pak" % (z, numero), contenu)
            p["tuiles"] = tuiles
            niveau["paquets"].append(p)
        description["niveaux"].append(niveau)
    return description, fichiers


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
    pypdfium2, _ = charger_modules()
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
