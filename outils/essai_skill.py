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
