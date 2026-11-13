# -*- coding: utf-8 -*-
"""Lot 4 — DÉPÔT AU CARNET : transformer un PDF en pages-images et les ranger dans le dossier du chantier.

    python outils/depot_carnet.py --dossier "<dossier du chantier>" --pdf "<chemin du PDF>" --code 105 --indice A --intitule "PLANS DE RESERVATIONS"
    python outils/depot_carnet.py --dossier "<dossier du chantier>" --verifier
    python outils/depot_carnet.py --dossier "<dossier du chantier>" --retirer 105-A

Le programme écrit dans  <racine>/<dossier du chantier>/<CARNET>/ :
    <CODE> <INDICE> <INTITULÉ>/p<n>-leger.webp, p<n>-net.webp, p<n>-z<z>-<k>.pak   les images de chaque page
    <CODE> <INDICE> <INTITULÉ>/etat.json                                         l'avancement (pour la reprise)
    carnet.json                                                                  la liste lue par l'appli, écrite EN DERNIER

Règles : il ne crée jamais le dossier d'un chantier, n'écrase jamais un document déposé, ne supprime jamais rien
(sauf son propre fichier temporaire). Il travaille page par page : arrêté par la limite de temps (code de sortie 3),
il reprend où il en était quand on relance la même commande.
Codes de sortie : 0 = fait ; 1 = --verifier a trouvé un défaut ; 2 = refus (rien n'est écrit) ; 3 = à relancer.
Aucun chemin, aucun nom de chantier n'est écrit ici : tout est passé en argument (ou lu dans _prive/depot.json).
"""
import argparse
import datetime
import io
import json
import os
import re
import sys
import time

# ── Réglages (faciles à modifier) ───────────────────────────────────────────
# Les codes de documents acceptés au carnet, et la finesse du rendu (dpi = points d'image par pouce).
# Tout autre code est refusé : ni devis, ni pièce interne au carnet.
DPI_PAR_CODE = {
    "001": 150,   # PPSPS
    "002": 150,   # temps de tâches
    "103": 200, "104": 200, "105": 200, "106": 200, "107": 200, "108": 200, "109": 200,
    "151": 200, "152": 200,
    "205": 200, "206": 200,
}
LIMITE = 150         # secondes : au-delà, le programme s'arrête avant la page suivante (une commande de skill : 180 s)
TUILE = 512          # côté d'une tuile, en points d'image
BANDE = 4            # une page est rendue par bandes de 4 rangées de tuiles (2 048 points) : jamais la page entière en mémoire
BLOC = 4             # un paquet = un bloc de 4 x 4 tuiles voisines
QUALITE = 70         # WebP qualité 0,7 (essai S1)
LEGER, NET = 800, 1600   # plus grand côté des deux aperçus
INTITULE_MAX = 80

CARNET_FICHIER = "carnet.json"
ETAT_FICHIER = "etat.json"
DOSSIERS_FICHIER = "dossiers.json"
CARNET_DEFAUT = "CARNET"
NOM_SUR = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$")   # la même règle que CARNET_NOM_SUR dans apps-script/Carnet.gs
INDICE_BON = re.compile(r"^[A-Za-z0-9]{1,3}$")
DOUBLON = re.compile(r" \(\d+\)(\.[^.]*)?$")                 # « carnet (1).json », « p1-net (1).webp » : copies faites par Drive
INSTALLER = "python -m pip install pypdfium2==5.15.2 pillow"


class Refus(Exception):
    """Le programme refuse de travailler : rien n'a été écrit. Le message s'adresse à la personne qui l'a lancé."""


# ── Rendu d'une page (mesuré et validé à l'étape 4.0 avec outils/essai_rendu.py) ──
def charger_modules():
    try:
        import pypdfium2
        from PIL import Image, features
    except ImportError as e:
        raise Refus("Module manquant (%s). À lancer une fois :  %s" % (e.name, INSTALLER))
    if not features.check("webp"):
        raise Refus("Cette installation de Pillow ne sait pas écrire le format WebP. À lancer :  %s" % INSTALLER)
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


def traiter_page(page, dpi, ecrire=None, prefixe=""):
    """Rend la page et rend sa description. « ecrire(nom, octets) » reçoit chaque fichier (aperçus et paquets).
    « prefixe » est mis devant chaque nom de fichier (« p3- » pour la page 3)."""
    largeur_pt, hauteur_pt = page.get_size()
    plein = dpi / 72.0
    largeur, hauteur = int(round(largeur_pt * plein)), int(round(hauteur_pt * plein))
    description = {"l": largeur, "h": hauteur, "dpi": dpi, "niveaux": []}
    fichiers = []

    def sortir(nom, octets):
        nom = prefixe + nom
        fichiers.append((nom, len(octets)))
        if ecrire:
            ecrire(nom, octets)
        return {"f": nom, "o": len(octets)}

    for nom, cote in (("leger", LEGER), ("net", NET)):
        e = min(plein, cote / max(largeur_pt, hauteur_pt))
        description[nom] = sortir(nom + ".webp", webp(page.render(scale=e).to_pil().convert("RGB")))
    if max(largeur, hauteur) <= NET:      # très petite page (plus petite que l'aperçu net) : les aperçus suffisent
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
        niveau = {"z": z, "l": l, "h": h, "cols": cols, "ligs": ligs, "paquets": []}
        for numero, cle in enumerate(sorted(paquets)):
            morceaux, tuiles, place = [], [], 0
            for c, li, octets in paquets[cle]:
                tuiles.append([c, li, place, len(octets)])
                morceaux.append(octets)
                place += len(octets)
            p = sortir("z%d-%d.pak" % (z, numero), b"".join(morceaux))
            p["tuiles"] = tuiles
            niveau["paquets"].append(p)
        description["niveaux"].append(niveau)
    return description, fichiers


# ── Contrôles et petits outils ──────────────────────────────────────────────
def nettoyer_intitule(intitule):
    """L'intitulé rendu acceptable pour un nom de dossier Windows et Drive."""
    texte = re.sub(r'[/\\:*?"<>|\x00-\x1f]', " ", str(intitule or ""))
    texte = re.sub(r"\s+", " ", texte).strip()[:INTITULE_MAX]
    return texte.rstrip(" .")          # Windows refuse un nom de dossier fini par un point ou un espace


def controler_document(code, indice, intitule):
    """Rend (code, indice, intitulé nettoyé, dpi), ou refuse."""
    code = str(code or "").strip()
    if code not in DPI_PAR_CODE:
        raise Refus("Le code « %s » n'est pas un document du carnet. Codes acceptés : %s." % (code, ", ".join(sorted(DPI_PAR_CODE))))
    indice = str(indice or "").strip().upper()
    if not INDICE_BON.match(indice):
        raise Refus("L'indice « %s » n'est pas accepté : 1 à 3 lettres ou chiffres (A, B, 02…)." % indice)
    propre = nettoyer_intitule(intitule)
    if not propre:
        raise Refus("L'intitulé du document est vide.")
    return code, indice, propre, DPI_PAR_CODE[code]


def lire_json(chemin):
    with open(chemin, "r", encoding="utf-8-sig") as f:
        return json.load(f)


def ecrire_json(chemin, objet):
    """Écrit par fichier temporaire dans le même dossier, puis remplacement : jamais un fichier à moitié écrit."""
    temporaire = chemin + ".tmp"
    try:
        with open(temporaire, "w", encoding="utf-8", newline="\n") as f:
            json.dump(objet, f, ensure_ascii=False, separators=(",", ":"))
            f.flush()
            os.fsync(f.fileno())
        for essai in range(6):
            try:
                os.replace(temporaire, chemin)
                return
            except PermissionError:      # Drive pour ordinateur est peut-être en train de lire le fichier
                if essai == 5:
                    raise
                time.sleep(0.5)
    finally:
        if os.path.exists(temporaire):
            os.remove(temporaire)        # notre propre fichier temporaire : la seule chose que le programme supprime


def nom_simple(nom):
    return bool(nom) and nom not in (".", "..") and not re.search(r'[/\\:*?"<>|]', nom)


def dossier_carnet(racine, dossier):
    """Le chemin du dossier CARNET du chantier (qui n'existe peut-être pas encore). Refuse si la racine ou le chantier manquent."""
    if not racine or not os.path.isdir(racine):
        raise Refus("La racine du Drive de l'appli est introuvable. Vérifiez --racine (ou _prive/depot.json), et que Google Drive pour ordinateur est démarré.")
    fichier = os.path.join(racine, DOSSIERS_FICHIER)
    if not os.path.isfile(fichier):
        raise Refus("Ce dossier ne contient pas « %s » : ce n'est pas la racine du Drive de l'appli." % DOSSIERS_FICHIER)
    try:
        reglages = lire_json(fichier)
    except (OSError, ValueError) as e:
        raise Refus("Le fichier « %s » de la racine est illisible (%s)." % (DOSSIERS_FICHIER, e))
    documents = reglages.get("documents") if isinstance(reglages, dict) else None
    nom = documents.get("carnet") if isinstance(documents, dict) else None
    nom = nom.strip() if isinstance(nom, str) and nom.strip() else CARNET_DEFAUT
    morceaux = [m.strip() for m in nom.split("/") if m.strip()]
    if not morceaux or not all(nom_simple(m) for m in morceaux):
        raise Refus("Dans « %s », le nom du dossier du carnet (« %s ») n'est pas utilisable." % (DOSSIERS_FICHIER, nom))
    dossier = str(dossier or "").strip()
    if not nom_simple(dossier):
        raise Refus("Le nom du dossier du chantier (« %s ») n'est pas un simple nom de dossier." % dossier)
    chantier = os.path.join(racine, dossier)
    if not os.path.isdir(chantier):
        raise Refus("Le dossier du chantier « %s » n'existe pas sous la racine. Ce programme ne crée jamais le dossier d'un chantier : "
                    "c'est l'appli qui le crée. Vérifiez le nom, lettre pour lettre." % dossier)
    return os.path.join(chantier, *morceaux)


def listes_du_carnet(carnet):
    """Les fichiers « carnet*.json » du dossier CARNET (un doublon « carnet (1).json » est fabriqué parfois par Drive)."""
    if not os.path.isdir(carnet):
        return []
    return sorted(n for n in os.listdir(carnet)
                  if n.lower().startswith("carnet") and n.lower().endswith(".json") and os.path.isfile(os.path.join(carnet, n)))


def lire_carnet(carnet, chantier=None):
    """La liste carnet.json (None s'il n'y en a pas encore). Refuse un doublon, un fichier illisible, un autre chantier."""
    noms = listes_du_carnet(carnet)
    en_trop = [n for n in noms if n.lower() != CARNET_FICHIER]
    if en_trop:
        raise Refus("Le dossier du carnet contient plusieurs listes (%s). Google Drive pour ordinateur a fabriqué un doublon : "
                    "ouvrez le dossier, gardez la bonne liste sous le nom « %s », mettez l'autre de côté, puis relancez."
                    % (", ".join("« %s »" % n for n in noms), CARNET_FICHIER))
    if not noms:
        return None
    try:
        liste = lire_json(os.path.join(carnet, noms[0]))
    except (OSError, ValueError) as e:
        raise Refus("La liste « %s » du carnet est illisible (%s). Rien n'est modifié : attendez la fin de la synchronisation de Drive, "
                    "ou restaurez une version précédente du fichier." % (CARNET_FICHIER, e))
    if not isinstance(liste, dict) or not isinstance(liste.get("documents"), list):
        raise Refus("La liste « %s » du carnet n'a pas la forme attendue (pas de liste « documents »). Rien n'est modifié." % CARNET_FICHIER)
    if chantier is not None and liste.get("chantier") and str(liste["chantier"]).strip() != chantier:
        raise Refus("Ce carnet est celui du chantier « %s », pas de « %s ». Vérifiez --dossier et --chantier."
                    % (liste["chantier"], chantier))
    return liste


def page_presente(dossier_doc, description):
    """Vrai si tous les fichiers annoncés pour cette page sont là, avec la taille annoncée."""
    try:
        annonces = [description["leger"], description["net"]]
        for niveau in description["niveaux"]:
            annonces.extend(niveau["paquets"])
        for a in annonces:
            chemin = os.path.join(dossier_doc, a["f"])
            if not NOM_SUR.match(a["f"]) or not os.path.isfile(chemin) or os.path.getsize(chemin) != a["o"]:
                return False
        return True
    except (KeyError, TypeError, OSError):
        return False


def poids_page(description):
    return description["leger"]["o"] + description["net"]["o"] + sum(p["o"] for n in description["niveaux"] for p in n["paquets"])


def lire_etat(dossier_doc, ident, source, dpi, pages):
    """L'avancement noté dans le dossier du document. Refuse la reprise si le dossier ne correspond pas à ce dépôt."""
    neuf = {"version": 1, "id": ident, "source": source, "dpi": dpi, "nombre": pages, "termine": False, "pages": {}}
    if not os.path.isdir(dossier_doc) or not os.listdir(dossier_doc):
        return neuf
    nom = os.path.basename(dossier_doc)
    chemin = os.path.join(dossier_doc, ETAT_FICHIER)
    if not os.path.isfile(chemin):
        raise Refus("Le dossier « %s » existe déjà dans le carnet et ne vient pas d'un dépôt en cours. Rien n'est écrasé : prenez un autre indice." % nom)
    try:
        etat = lire_json(chemin)
        memes = (etat["id"] == ident and etat["source"] == source and etat["dpi"] == dpi and etat["nombre"] == pages
                 and isinstance(etat["pages"], dict))
    except (OSError, ValueError, KeyError, TypeError):
        raise Refus("Le fichier « %s » du dossier « %s » est illisible : la reprise est impossible. Rien n'est écrasé : prenez un autre indice." % (ETAT_FICHIER, nom))
    if not memes:
        raise Refus("Le dossier « %s » contient déjà un dépôt fait avec un autre PDF (« %s », %d octets). "
                    "Rien n'est écrasé : pour un PDF modifié, prenez l'indice suivant."
                    % (nom, etat["source"].get("nom", "?") if isinstance(etat["source"], dict) else "?",
                       etat["source"].get("poids", 0) if isinstance(etat["source"], dict) else 0))
    etat["termine"] = False
    return etat


# ── Les trois travaux : déposer, retirer, vérifier ──────────────────────────
def deposer(racine, dossier, chantier, pdf, code, indice, intitule, limite=LIMITE, horloge=time.time, dire=print):
    """Dépose un PDF au carnet du chantier. Rend un compte rendu :
    {"termine", "id", "dossier", "pages", "faites", "restent", "poids"}. « termine » faux = à relancer (limite de temps)."""
    debut = horloge()
    code, indice, intitule, dpi = controler_document(code, indice, intitule)
    carnet = dossier_carnet(racine, dossier)
    chantier = str(chantier or dossier).strip()
    ident = "%s-%s" % (code, indice)
    nom_dossier = "%s %s %s" % (code, indice, intitule)

    def controler_liste():
        liste = lire_carnet(carnet, chantier)
        for d in (liste or {}).get("documents", []):
            if isinstance(d, dict) and d.get("id") == ident and d.get("retire") is not True:
                raise Refus("Le document %s est déjà au carnet de ce chantier. Rien n'est écrasé : prenez l'indice suivant, "
                            "ou retirez d'abord l'ancien avec --retirer %s." % (ident, ident))
        return liste

    controler_liste()
    if not pdf or not os.path.isfile(pdf):
        raise Refus("Le PDF est introuvable : « %s »." % pdf)
    source = {"nom": os.path.basename(pdf), "poids": os.path.getsize(pdf)}
    pypdfium2, _ = charger_modules()
    try:
        document = pypdfium2.PdfDocument(pdf)
        nombre = len(document)
    except Exception as e:
        raise Refus("Le PDF est illisible (%s) : « %s »." % (e, source["nom"]))
    try:
        if nombre < 1:
            raise Refus("Le PDF ne contient aucune page : « %s »." % source["nom"])
        dossier_doc = os.path.join(carnet, nom_dossier)
        etat = lire_etat(dossier_doc, ident, source, dpi, nombre)
        # À partir d'ici, le programme écrit.
        os.makedirs(dossier_doc, exist_ok=True)
        chemin_etat = os.path.join(dossier_doc, ETAT_FICHIER)
        ecrire_json(chemin_etat, etat)
        dire("%s — « %s », %d page(s), %.1f Mo ; rendu à %d dpi" % (ident, source["nom"], nombre, source["poids"] / 1048576, dpi))

        def ecrire(nom, octets):
            with open(os.path.join(dossier_doc, nom), "wb") as f:
                f.write(octets)

        for n in range(1, nombre + 1):
            faite = etat["pages"].get(str(n))
            if faite and page_presente(dossier_doc, faite):
                dire("  page %d/%d : déjà faite" % (n, nombre))
                continue
            if horloge() - debut > limite:
                faites = sum(1 for k in range(1, nombre + 1) if str(k) in etat["pages"] and page_presente(dossier_doc, etat["pages"][str(k)]))
                return {"termine": False, "id": ident, "dossier": nom_dossier, "pages": nombre, "faites": faites,
                        "restent": nombre - faites, "poids": sum(poids_page(p) for p in etat["pages"].values())}
            depart = time.perf_counter()
            page = document[n - 1]
            try:
                description, fichiers = traiter_page(page, dpi, ecrire, "p%d-" % n)
            finally:
                page.close()
            etat["pages"][str(n)] = description
            ecrire_json(chemin_etat, etat)
            dire("  page %d/%d : %d x %d points ; %.1f s ; %d fichier(s), %.2f Mo"
                 % (n, nombre, description["l"], description["h"], time.perf_counter() - depart, len(fichiers), poids_page(description) / 1048576))
    finally:
        document.close()

    # Toutes les pages sont faites : la liste est écrite en dernier (relue juste avant, au cas où elle aurait changé).
    pages = [etat["pages"][str(n)] for n in range(1, nombre + 1)]
    poids = sum(poids_page(p) for p in pages)
    liste = controler_liste() or {"version": 1, "chantier": chantier, "documents": []}
    liste.setdefault("version", 1)
    if not liste.get("chantier"):
        liste["chantier"] = chantier
    liste["documents"].append({"id": ident, "code": code, "indice": indice, "intitule": intitule, "dossier": nom_dossier,
                               "date": datetime.date.today().isoformat(),
                               # « depose » : instant du dépôt ; un redépôt sous le même identifiant fait effacer aux téléphones ce qu'ils gardaient
                               "depose": datetime.datetime.now().isoformat(timespec="seconds"), "poids": poids, "source": source, "pages": pages})
    ecrire_json(os.path.join(carnet, CARNET_FICHIER), liste)
    etat["termine"] = True
    ecrire_json(chemin_etat, etat)
    return {"termine": True, "id": ident, "dossier": nom_dossier, "pages": nombre, "faites": nombre, "restent": 0, "poids": poids}


def retirer(racine, dossier, ident):
    """Masque un document dans l'appli ("retire": true dans carnet.json). Aucun fichier n'est supprimé."""
    carnet = dossier_carnet(racine, dossier)
    liste = lire_carnet(carnet)
    ident = str(ident or "").strip()
    trouves = [d for d in (liste or {}).get("documents", []) if isinstance(d, dict) and d.get("id") == ident]
    if not trouves:
        raise Refus("Le document « %s » n'est pas dans le carnet de ce chantier." % ident)
    a_retirer = [d for d in trouves if d.get("retire") is not True]
    if not a_retirer:
        raise Refus("Le document « %s » est déjà retiré du carnet." % ident)
    for d in a_retirer:
        d["retire"] = True
    ecrire_json(os.path.join(carnet, CARNET_FICHIER), liste)
    return {"id": ident, "dossier": a_retirer[-1].get("dossier", "")}


def verifier(racine, dossier):
    """Compare carnet.json et les fichiers présents. N'écrit rien. Rend {"bon", "problemes", "documents", "retires", "poids"}."""
    carnet = dossier_carnet(racine, dossier)
    problemes = []
    rendu = {"bon": False, "problemes": problemes, "documents": 0, "retires": 0, "poids": 0}
    if not os.path.isdir(carnet):
        problemes.append("Ce chantier n'a pas encore de dossier de carnet.")
        return rendu
    for dossier_lu, _, fichiers in os.walk(carnet):
        for f in fichiers:
            try:
                rendu["poids"] += os.path.getsize(os.path.join(dossier_lu, f))
            except OSError:
                pass
            if DOUBLON.search(f):
                problemes.append("Doublon fabriqué par Drive : « %s »." % os.path.relpath(os.path.join(dossier_lu, f), carnet))
    sous_dossiers = sorted(n for n in os.listdir(carnet) if os.path.isdir(os.path.join(carnet, n)))
    for n in sous_dossiers:
        if DOUBLON.search(n):
            problemes.append("Dossier en double fabriqué par Drive : « %s »." % n)
    listes = listes_du_carnet(carnet)
    if len(listes) > 1:
        problemes.append("Plusieurs listes dans le carnet : %s. Une seule doit rester, sous le nom « %s »." % (", ".join("« %s »" % n for n in listes), CARNET_FICHIER))
    documents = []
    if not any(n.lower() == CARNET_FICHIER for n in listes):
        problemes.append("Pas de liste « %s » dans le carnet." % CARNET_FICHIER)
    else:
        try:
            liste = lire_json(os.path.join(carnet, CARNET_FICHIER))
            documents = liste["documents"]
            if not isinstance(documents, list):
                raise ValueError("pas de liste « documents »")
        except (OSError, ValueError, KeyError, TypeError) as e:
            documents = []
            problemes.append("La liste « %s » est illisible (%s)." % (CARNET_FICHIER, e))
    connus = set()
    for d in documents:
        if isinstance(d, dict) and isinstance(d.get("dossier"), str):
            connus.add(d["dossier"].lower())
        if isinstance(d, dict) and d.get("retire") is True:
            rendu["retires"] += 1
            continue
        rendu["documents"] += 1
        problemes.extend(defauts_document(carnet, d))
    for n in sous_dossiers:
        if n.lower() not in connus:
            en_cours = os.path.isfile(os.path.join(carnet, n, ETAT_FICHIER))
            problemes.append("Le dossier « %s » n'est dans aucun document de la liste%s." % (n, " (dépôt commencé et pas fini : relancez-le)" if en_cours else ""))
    rendu["bon"] = not problemes
    return rendu


def defauts_document(carnet, d):
    """Les défauts d'un document de la liste : forme, fichiers manquants ou de mauvaise taille, tuiles hors de leur paquet."""
    if not isinstance(d, dict) or not isinstance(d.get("id"), str) or not NOM_SUR.match(d["id"]):
        return ["Un document de la liste n'a pas d'identifiant correct : l'appli ne le montrera pas."]
    qui = d["id"]
    nom = d.get("dossier")
    if not isinstance(nom, str) or not nom.strip() or re.search(r"[/\\]", nom) or not isinstance(d.get("pages"), list):
        return ["%s : dossier ou pages mal décrits, l'appli ne le montrera pas." % qui]
    dossier_doc = os.path.join(carnet, nom)
    if not os.path.isdir(dossier_doc):
        return ["%s : le dossier « %s » est absent." % (qui, nom)]
    defauts = []

    def fichier(annonce, quoi):
        """Contrôle un fichier annoncé ; rend sa taille annoncée, ou None s'il est mal décrit."""
        if not isinstance(annonce, dict) or not isinstance(annonce.get("f"), str) or not NOM_SUR.match(annonce["f"]) or not isinstance(annonce.get("o"), int):
            defauts.append("%s, %s : fichier mal décrit dans la liste." % (qui, quoi))
            return None
        chemin = os.path.join(dossier_doc, annonce["f"])
        if not os.path.isfile(chemin):
            defauts.append("%s : le fichier « %s » est absent." % (qui, annonce["f"]))
        elif os.path.getsize(chemin) != annonce["o"]:
            defauts.append("%s : le fichier « %s » fait %d octets au lieu de %d." % (qui, annonce["f"], os.path.getsize(chemin), annonce["o"]))
        return annonce["o"]

    for numero, page in enumerate(d["pages"], 1):
        ou = "page %d" % numero
        if not isinstance(page, dict):
            defauts.append("%s, %s : page mal décrite." % (qui, ou))
            continue
        fichier(page.get("leger"), ou + ", aperçu léger")
        fichier(page.get("net"), ou + ", aperçu net")
        for niveau in page.get("niveaux") or []:
            for paquet in (niveau.get("paquets") if isinstance(niveau, dict) else None) or []:
                taille = fichier(paquet, ou + ", paquet")
                if taille is None:
                    continue
                for t in paquet.get("tuiles") or []:
                    bonne = (isinstance(t, list) and len(t) == 4 and all(isinstance(x, int) for x in t)
                             and t[2] >= 0 and t[3] > 0 and t[2] + t[3] <= taille)
                    if not bonne:
                        defauts.append("%s : dans « %s », une tuile dépasse du paquet (%s)." % (qui, paquet["f"], t))
    return defauts


# ── Ligne de commande ───────────────────────────────────────────────────────
def racine_notee():
    """La racine notée dans _prive/depot.json du dépôt (clé « racine »), ou None."""
    chemin = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "_prive", "depot.json")
    try:
        racine = lire_json(chemin).get("racine")
        return racine if isinstance(racine, str) and racine.strip() else None
    except (OSError, ValueError, AttributeError):
        return None


def lire_arguments(argv=None):
    a = argparse.ArgumentParser(description="Dépose un PDF au carnet d'un chantier, en pages-images (lot 4).", add_help=False,
                                epilog="Codes de sortie : 0 fait ; 1 défaut trouvé par --verifier ; 2 refus (rien n'est écrit) ; 3 à relancer (limite de temps).")
    a.add_argument("-h", "--help", action="help", help="affiche cette aide")
    a.add_argument("--racine", help="dossier racine du Drive de l'appli sur ce PC (à défaut : clé « racine » de _prive/depot.json)")
    a.add_argument("--dossier", required=True, help="nom du dossier du chantier, sous la racine")
    a.add_argument("--chantier", help="nom du chantier dans l'appli (par défaut : le nom du dossier)")
    a.add_argument("--pdf", help="chemin du PDF à déposer")
    a.add_argument("--code", help="code du document : %s" % ", ".join(sorted(DPI_PAR_CODE)))
    a.add_argument("--indice", help="indice du document : 1 à 3 lettres ou chiffres (A, B…)")
    a.add_argument("--intitule", help="intitulé du document (nom montré dans l'appli)")
    a.add_argument("--limite", type=float, default=LIMITE, help="secondes de travail avant un arrêt propre, à relancer (défaut : %d)" % LIMITE)
    a.add_argument("--verifier", action="store_true", help="contrôle le carnet du chantier, sans rien écrire")
    a.add_argument("--retirer", metavar="ID", help="masque un document dans l'appli (exemple : 105-A) ; aucun fichier n'est supprimé")
    return a.parse_args(argv)


def main(argv=None):
    for flux in (sys.stdout, sys.stderr):
        if hasattr(flux, "reconfigure"):
            flux.reconfigure(encoding="utf-8", errors="replace")
    o = lire_arguments(argv)
    try:
        racine = o.racine or racine_notee()
        if not racine:
            raise Refus("La racine du Drive de l'appli n'est pas donnée : ajoutez --racine \"<dossier>\", "
                        "ou créez le fichier _prive/depot.json contenant {\"racine\": \"<dossier>\"}.")
        if o.verifier:
            r = verifier(racine, o.dossier)
            for p in r["problemes"]:
                print("  ! " + p)
            print("Carnet : %d document(s) montré(s), %d retiré(s) ; %.1f Mo en tout." % (r["documents"], r["retires"], r["poids"] / 1048576))
            print("Tout est bon." if r["bon"] else "%d défaut(s) trouvé(s)." % len(r["problemes"]))
            return 0 if r["bon"] else 1
        if o.retirer:
            r = retirer(racine, o.dossier, o.retirer)
            print("Le document %s est retiré de la liste : il ne sera plus montré dans l'appli (dix minutes au plus). "
                  "Ses fichiers restent dans le dossier « %s »." % (r["id"], r["dossier"]))
            return 0
        manquants = [n for n in ("pdf", "code", "indice", "intitule") if not getattr(o, n)]
        if manquants:
            raise Refus("Pour déposer un document, il manque : %s." % ", ".join("--" + n for n in manquants))
        debut = time.time()
        r = deposer(racine, o.dossier, o.chantier, o.pdf, o.code, o.indice, o.intitule, limite=o.limite)
        if not r["termine"]:
            print("Arrêt à la limite de temps : %d page(s) faite(s), il en reste %d. RELANCEZ LA MÊME COMMANDE : le travail reprend où il en est."
                  % (r["faites"], r["restent"]))
            return 3
        print("Déposé : %s, %d page(s), %.1f Mo d'images, en %.0f s, dans « %s ». Le document apparaît dans l'appli quand "
              "Google Drive a fini de l'envoyer (quelques minutes)." % (r["id"], r["pages"], r["poids"] / 1048576, time.time() - debut, r["dossier"]))
        return 0
    except OSError as e:
        # disque plein, Drive pour ordinateur arrêté, chemin trop long, fichier verrouillé… : rien n'est annoncé dans la liste
        print("ARRÊT : le dossier n'a pas pu être lu ou écrit (%s). Rien n'est ajouté à la liste du carnet ; vérifiez que Google Drive pour ordinateur tourne, puis relancez la même commande." % e, file=sys.stderr)
        return 2
    except Refus as e:
        print("REFUS : %s" % e, file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
