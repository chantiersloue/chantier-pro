# -*- coding: utf-8 -*-
"""Lot 4c — LE PROGRAMME DU PC : dépôt au carnet depuis les bordereaux, recopie des fiches de l'appli vers les dossiers de chantier du PC.

    python outils/appli_pc.py                     tout : le carnet, puis la recopie des fiches (avec confirmations)
    python outils/appli_pc.py --lister            montre ce qui serait fait, sans rien écrire
    python outils/appli_pc.py --rapatrier --auto  la recopie des fiches, sans question ni fenêtre (tâche planifiée de Windows)
    python outils/appli_pc.py --a-voir            affiche ce qui demande l'attention (« CHANTIERPRO - A VOIR.txt »)
    python outils/appli_pc.py --associer          relie un dossier de chantier du PC à un dossier du Drive, quand le numéro ne suffit pas
    python outils/appli_pc.py --carnet            le carnet seulement
    python outils/appli_pc.py --rapatrier         la recopie des fiches seulement
    python outils/appli_pc.py --retirer           retire un document du carnet (aucun fichier n'est supprimé)
    python outils/appli_pc.py --installer-tache   crée la tâche planifiée (toutes les heures, et à l'ouverture de session)
    python outils/appli_pc.py --retirer-tache     supprime la tâche planifiée

Le programme lit ses réglages dans _prive/depot.json (jamais dans le dépôt public) :
    { "racine": "<racine du Drive de l'appli sur le PC>", "chantiers_pc": "<dossier qui contient les dossiers de chantier, sur le PC>",
      "chantiers": { "<n° du chantier>": { "chantier": "<nom dans l'appli>", "dossier_drive": "<nom du dossier dans le Drive>" } },
      "anciens_codes": { "<ancien n° de document>": "<n° actuel>" } }
« chantiers » est facultatif : le dossier de chantier du PC est trouvé tout seul par le numéro en tête du nom des dossiers.

Ce qu'il écrit, et rien d'autre : les images du carnet et carnet.json (Drive, par outils/depot_carnet.py) ; le relevé
releve-pc.json (Drive) ; les copies des fiches et la liste « CHANTIERPRO - fiches rapatriees.json » (dossier du chantier sur
le PC) ; « CHANTIERPRO - A VOIR.txt » (dossier qui contient les dossiers de chantier) ; ses propres fichiers dans _prive/.
Il ne supprime, ne déplace, ne renomme et n'écrase jamais un fichier d'un dossier de chantier ou du Drive.
Codes de sortie : 0 = fait ; 2 = refus (rien n'est écrit) ; 1 = erreur ou défaut pendant le travail (lire le bilan).
Aucun chemin, aucun nom de chantier n'est écrit ici : tout vient de _prive/depot.json.
"""
import argparse
import datetime
import json
import os
import re
import socket
import sys
import time
import unicodedata

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import depot_carnet as dc          # noqa: E402
from depot_carnet import Refus     # noqa: E402

# ── Réglages (faciles à modifier) ───────────────────────────────────────────
# Les sous-dossiers par défaut des fiches de l'appli, dans le dossier de chaque chantier.
# RECOPIE de DOSSIERS_DEFAUT.documents (apps-script/Dossiers.gs) : si cette table change là-bas, la changer ici aussi.
# Une clé présente dans dossiers.json (racine du Drive) l'emporte ; une clé absente prend la valeur ci-dessous.
DOCUMENTS_DEFAUT = {
    "cotes": "05 - CHANTIER/PRISE DE COTES",
    "fabrication": "07 - ATELIER",
    "note": "05 - CHANTIER/COMPTE RENDU",
    "quitus": "05 - CHANTIER/OPR - RESERVES - QUITUS",
    "attestation": "05 - CHANTIER/OPR - RESERVES - QUITUS",
    "reception-support": "05 - CHANTIER/OPR - RESERVES - QUITUS",
    "bordereau-orga": "05 - CHANTIER/ORGANIGRAMME",
    "bordereau-materiaux": "05 - CHANTIER/BORDEREAUX MATERIAUX",
    "photos": "05 - CHANTIER/PHOTOS CHANTIER",
    "signalement": "05 - CHANTIER/SIGNALEMENTS",
    "carnet": "CARNET",
    "plans": "Plans",
}
CLES_NON_RAPATRIEES = ("carnet", "plans")      # des copies de documents qui sont déjà dans le dossier du chantier sur le PC
PROVENANCE = "CHANTIERPRO - fiches rapatriees.json"    # dans le dossier du chantier sur le PC : « ces fichiers viennent de l'appli »
A_VOIR = "CHANTIERPRO - A VOIR.txt"            # dans le dossier qui contient les dossiers de chantier : ce que Franck doit regarder
A_VOIR_MAX = 20                                # lignes par chantier et par sorte de signalement dans ce fichier
INDEX = "releve-pc.json"                      # dans le Drive, à la racine du chantier : le relevé de présence (lot 5)
A_CLASSER = "_À CLASSER"                       # à la racine du Drive : documents d'un chantier inconnu de l'appli
DOSSIERS_TECHNIQUES = ("administratif", "dossier base")   # comme estDossierTechnique_ (apps-script/Dossiers.gs)
PARTIEL = ".partiel"                           # une copie en cours porte ce suffixe, jamais le nom final
CHEMIN_MAX = 240                               # au-delà, Windows (et la sauvegarde MEGA) peuvent refuser le fichier
VERROU_VIEUX = 12 * 3600                       # secondes : un verrou d'une autre machine est repris après 12 heures
LISTE_MAX = 15                                 # lignes montrées à l'écran pour une liste ; le reste va au journal
# Raccourcis de Google Drive pour ordinateur : de tout petits fichiers qui ne contiennent pas le document.
RACCOURCIS = {".gdoc", ".gsheet", ".gslides", ".gform", ".gdraw", ".gmap", ".gsite", ".gjam", ".gtable", ".gscript",
              ".glink", ".gnote", ".gshortcut", ".gmaillayout", ".gvid", ".gcolab", ".gapp"}
FICHIERS_IGNORES = {"desktop.ini", "thumbs.db", ".megaignore", ".ds_store"}

NUMERO_DOSSIER = re.compile(r"^\s*(\d+)(?=[ \-]|$)")      # « 403 - x », « 403-x », « 403 x » : des chiffres, puis un espace ou un tiret
DOSSIER_BORDEREAU = re.compile(r"^BORDEREAU\s*(\d+)\s*$", re.IGNORECASE)
# <n° chantier>-<lot>-<n° document>-<indice>-<INTITULÉ>.pdf ; le lot peut contenir des espaces et des mots (« 09 ET 10 »)
NOM_DE_BORDEREAU = re.compile(r"^(\d+)-(.+?)-(\d{3}[A-Za-z]?)-([A-Za-z0-9]{1,3})-(.+)\.pdf$", re.IGNORECASE)

DEPOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REGLAGES_DEFAUT = os.path.join(DEPOT, "_prive", "depot.json")
ECARTES_FICHIER = "carnet-ecartes.json"
VERROU_FICHIER = "appli-pc.verrou"
JOURNAL_DOSSIER = "appli-pc"
JOURNAL_AUTO, JOURNAL_AUTO_ANCIEN = "auto.txt", "auto-ancien.txt"     # le journal des passages automatiques, et son prédécesseur
JOURNAL_AUTO_MAX = 300000                      # octets : au-delà, le journal est mis de côté et un nouveau commence
RELEVE_FRAIS = 24 * 3600                       # secondes : en passage automatique, un relevé inchangé n'est refait qu'une fois par jour
TACHE = "ChantierPro - recopie des fiches"     # la tâche planifiée de Windows (toutes les heures)
TACHE_SESSION = TACHE + " (ouverture de session)"


# ── Petits outils ───────────────────────────────────────────────────────────
def nfc(texte):
    """Le texte avec ses accents codés d'une seule façon (« é » en un caractère)."""
    return unicodedata.normalize("NFC", str(texte))


def cle(texte):
    """Pour comparer deux noms sans tenir compte du codage des accents ni des majuscules (comme Windows)."""
    return nfc(texte).casefold()


def trouver(dossier, nom):
    """Le nom réel, dans ce dossier, de l'élément qui s'appelle « nom » (ou None)."""
    voulu = cle(nom)
    try:
        for present in os.listdir(dossier):
            if cle(present) == voulu:
                return present
    except OSError:
        pass
    return None


def descendre(base, morceaux):
    """Suit le chemin « morceaux » sous « base » en retrouvant les noms réels. Rend le chemin, ou None s'il n'existe pas."""
    chemin = base
    for m in morceaux:
        reel = trouver(chemin, m)
        if reel is None:
            return None
        chemin = os.path.join(chemin, reel)
    return chemin


def viser(base, morceaux):
    """Le chemin de « morceaux » sous « base » : noms réels pour ce qui existe déjà, noms donnés pour le reste."""
    chemin, existe = base, True
    for m in morceaux:
        reel = trouver(chemin, m) if existe else None
        if reel is None:
            existe = False
        chemin = os.path.join(chemin, reel if reel is not None else m)
    return chemin


def ecrire_json(chemin, objet, lisible=True):
    """Écrit par fichier temporaire dans le même dossier, puis remplacement : jamais un fichier à moitié écrit."""
    temporaire = chemin + ".tmp"
    try:
        with open(temporaire, "w", encoding="utf-8", newline="\n") as f:
            if lisible:
                json.dump(objet, f, ensure_ascii=False, indent=2)
                f.write("\n")
            else:
                json.dump(objet, f, ensure_ascii=False, separators=(",", ":"))
            f.flush()
            os.fsync(f.fileno())
        for essai in range(6):
            try:
                os.replace(temporaire, chemin)
                return
            except PermissionError:      # Drive pour ordinateur (ou la sauvegarde MEGA) est peut-être en train de lire le fichier
                if essai == 5:
                    raise
                time.sleep(0.5)
    finally:
        if os.path.exists(temporaire):
            os.remove(temporaire)        # notre propre fichier temporaire


def heure_de_paris(instant=None):
    """L'instant donné (par défaut : maintenant) en heure de Paris, avec son décalage : 2026-11-13T08:30:00+01:00.
    Calculé à la main (heure d'été du dernier dimanche de mars au dernier dimanche d'octobre, 1 h UTC) :
    Windows n'a pas toujours la table des fuseaux horaires."""
    utc = datetime.timezone.utc
    instant = (instant or datetime.datetime.now(utc)).astimezone(utc)

    def dernier_dimanche(mois):
        jour = datetime.datetime(instant.year, mois, 31, 1, tzinfo=utc)
        return jour - datetime.timedelta(days=(jour.weekday() + 1) % 7)

    ete = dernier_dimanche(3) <= instant < dernier_dimanche(10)
    paris = datetime.timezone(datetime.timedelta(hours=2 if ete else 1))
    return instant.astimezone(paris).isoformat(timespec="seconds")


def mo(octets):
    if octets < 1048576:
        return "%d Ko" % max(1, round(octets / 1024))
    return ("%.1f Mo" % (octets / 1048576)).replace(".", ",")


def date_fr(instant):
    return datetime.datetime.fromtimestamp(instant).strftime("%d/%m/%Y %H:%M")


def montrer_liste(dire, lignes, maxi=LISTE_MAX):
    """Montre les premières lignes ; le reste est noté au journal s'il y en a un, sinon montré aussi."""
    noter = getattr(dire, "noter", None)
    if noter is None:
        maxi = len(lignes)
    for ligne in lignes[:maxi]:
        dire(ligne)
    if len(lignes) > maxi:
        dire("    … et %d autre(s) : la liste complète est dans le journal." % (len(lignes) - maxi))
        for ligne in lignes[maxi:]:
            noter(ligne)


def reponse(demander, question):
    """Pose la question ; rend la réponse sans espaces autour, ou None si la saisie est fermée."""
    try:
        r = demander(question)
    except EOFError:
        return None
    return None if r is None else str(r).strip()


# ── Les réglages : _prive/depot.json ────────────────────────────────────────
def lire_reglages(chemin):
    if not os.path.isfile(chemin):
        raise Refus("Le fichier de réglages « _prive/depot.json » n'existe pas. Créez-le en suivant docs/lot4c-procedure.md (étape 1).")
    try:
        reglages = dc.lire_json(chemin)
    except (OSError, ValueError) as e:
        raise Refus("Le fichier de réglages « _prive/depot.json » est illisible (%s). Une virgule ou un guillemet manque peut-être." % e)
    if not isinstance(reglages, dict):
        raise Refus("Le fichier de réglages « _prive/depot.json » n'a pas la forme attendue (voir docs/lot4c-procedure.md).")
    return reglages


def dossier_des_chantiers(reglages):
    """Le dossier du PC qui contient les dossiers de chantier (clé « chantiers_pc » ; l'ancienne clé est encore lue)."""
    return reglages.get("chantiers_pc") or reglages.get("mega")


def controler_reglages(reglages):
    """Refuse, avant toute écriture, des réglages inutilisables. Rend (racine, dossier des chantiers, correspondance)."""
    racine, chantiers_pc = reglages.get("racine"), dossier_des_chantiers(reglages)
    if not isinstance(chantiers_pc, str) or not chantiers_pc.strip() or not os.path.isdir(chantiers_pc):
        raise Refus("Le dossier qui contient les dossiers de chantier du PC (clé « chantiers_pc » de _prive/depot.json) est introuvable. "
                    "Vérifiez le chemin, et que ce disque est bien là.")
    if not isinstance(racine, str) or not racine.strip() or not os.path.isdir(racine):
        raise Refus("La racine du Drive de l'appli (clé « racine » de _prive/depot.json) est introuvable. "
                    "Vérifiez le chemin, et que Google Drive pour ordinateur est démarré.")
    if not os.path.isfile(os.path.join(racine, dc.DOSSIERS_FICHIER)):
        raise Refus("Le dossier « racine » ne contient pas « %s » : ce n'est pas la racine du Drive de l'appli "
                    "(ou Google Drive pour ordinateur n'a pas fini de démarrer)." % dc.DOSSIERS_FICHIER)
    chantiers = reglages.get("chantiers")
    if chantiers is None:
        chantiers = reglages["chantiers"] = {}
    if not isinstance(chantiers, dict):
        raise Refus("Dans _prive/depot.json, « chantiers » n'a pas la forme attendue (voir docs/lot4c-procedure.md).")
    for numero, fiche in chantiers.items():
        bon = (isinstance(fiche, dict) and isinstance(fiche.get("dossier_drive"), str) and fiche["dossier_drive"].strip()
               and isinstance(fiche.get("chantier"), str) and fiche["chantier"].strip() and re.fullmatch(r"\d+", str(numero)))
        if not bon:
            raise Refus("Dans _prive/depot.json, le chantier « %s » est mal écrit : il faut un numéro, « chantier » et « dossier_drive »." % numero)
    table = reglages.get("anciens_codes", {})
    if not isinstance(table, dict) or not all(isinstance(v, str) for v in table.values()):
        raise Refus("Dans _prive/depot.json, « anciens_codes » doit être une table « ancien numéro » : « numéro actuel ».")
    return racine, chantiers_pc, chantiers


def numero_du_dossier(nom):
    """Le n° du chantier, lu en tête du nom d'un dossier (« 403 - … », « 403-… », « 403 … ») ; None s'il n'y en a pas."""
    trouve = NUMERO_DOSSIER.match(str(nom))
    return trouve.group(1) if trouve else None


def dossiers_pc(chantiers_pc):
    """{n° du chantier: [noms des dossiers de chantier du PC qui commencent par ce n°]}."""
    vus = {}
    for nom in sorted(os.listdir(chantiers_pc)):
        numero = numero_du_dossier(nom)
        if numero is not None and os.path.isdir(os.path.join(chantiers_pc, nom)):
            vus.setdefault(numero, []).append(nom)
    return vus


def dossier_pc_du(chantiers_pc, numero, vus=None):
    """Le dossier du chantier sur le PC : (nom, None), ou (None, pourquoi). Jamais deviné."""
    noms = (vus if vus is not None else dossiers_pc(chantiers_pc)).get(str(numero), [])
    if not noms:
        return None, "aucun dossier de chantier du PC ne commence par le numéro %s" % numero
    if len(noms) > 1:
        return None, "plusieurs dossiers de chantier du PC commencent par le numéro %s (%s)" % (numero, ", ".join("« %s »" % n for n in noms))
    return noms[0], None


def refus_dossier_drive(racine, nom, chantiers, numero, planning=None):
    """Pourquoi ce dossier du Drive ne peut pas être celui du chantier « numero » ; None s'il convient."""
    nom = str(nom or "").strip()
    if not dc.nom_simple(nom):
        return "« %s » n'est pas un simple nom de dossier." % nom
    reel = trouver(racine, nom)
    if reel is None or not os.path.isdir(os.path.join(racine, reel)):
        return "« %s » n'est pas un dossier de la racine du Drive de l'appli." % nom
    minuscule = cle(reel).strip()
    if minuscule.startswith("_") or minuscule in DOSSIERS_TECHNIQUES:
        return "« %s » est un dossier technique de l'appli, pas un chantier." % reel
    if minuscule.startswith("planning") or (planning and minuscule == cle(planning).strip()):
        return "« %s » est le dossier du planning, pas un chantier." % reel
    if dc.DOUBLON.search(reel):
        return ("« %s » est un dossier en double fabriqué par Google Drive. Rangez d'abord ce doublon dans Drive, "
                "puis recommencez." % reel)
    for autre, fiche in chantiers.items():
        if str(autre) != str(numero) and isinstance(fiche, dict) and cle(fiche.get("dossier_drive", "")) == cle(reel):
            return "« %s » est déjà associé au chantier n° %s." % (reel, autre)
    return None


def dossiers_drive_libres(racine, chantiers, planning=None):
    """Les dossiers de la racine du Drive qui peuvent être un chantier et ne sont associés à aucun n°."""
    pris = {cle(f.get("dossier_drive", "")) for f in chantiers.values() if isinstance(f, dict)}
    libres = []
    for nom in sorted(os.listdir(racine)):
        if os.path.isdir(os.path.join(racine, nom)) and cle(nom) not in pris \
                and refus_dossier_drive(racine, nom, chantiers, None, planning) is None:
            libres.append(nom)
    return libres


def nom_dans_l_appli(racine, dossier_drive):
    """Le nom du chantier noté dans le carnet de ce dossier, s'il y en a un (sinon None)."""
    try:
        liste = dc.lire_carnet(dc.dossier_carnet(racine, dossier_drive))
        nom = (liste or {}).get("chantier")
        return nom.strip() if isinstance(nom, str) and nom.strip() else None
    except (Refus, OSError):
        return None


def associer(chemin_reglages, demander=input, dire=print):
    """Pour les dossiers de chantier du PC que leur numéro ne relie à aucun dossier du Drive : pose la question,
    et écrit la correspondance dans _prive/depot.json. Rend le nombre d'associations."""
    reglages = lire_reglages(chemin_reglages)
    racine, chantiers_pc, chantiers = controler_reglages(reglages)
    planning = reglages.get("planning")
    faites = 0
    suivis, _ = chantiers_suivis(reglages)
    sans = [(n, noms) for n, noms in sorted(dossiers_pc(chantiers_pc).items(), key=lambda p: (len(p[0]), p[0])) if n not in suivis]
    if not sans:
        dire("Tous les dossiers de chantier numérotés du PC ont déjà leur dossier dans le Drive de l'appli.")
    for numero, noms in sans:
        if len(noms) > 1:
            dire("")
            dire("N° %s : plusieurs dossiers de chantier du PC portent ce numéro (%s). Impossible de choisir : corrigez d'abord leurs noms."
                 % (numero, ", ".join("« %s »" % n for n in noms)))
            continue
        suivis, _ = chantiers_suivis(reglages)
        libres = dossiers_drive_libres(racine, suivis, planning)
        dire("")
        dire("Dossier du PC « %s » (chantier n° %s)" % (noms[0], numero))
        if not libres:
            dire("  Il n'y a plus de dossier libre dans le Drive de l'appli : rien à associer.")
            break
        for i, nom in enumerate(libres, 1):
            dire("  %2d. %s" % (i, nom))
        r = reponse(demander, "  Numéro de la ligne du dossier Drive de ce chantier (Entrée = passer, q = arrêter) : ")
        if r is None or r.lower() == "q":
            break
        if not r:
            continue
        choisi = libres[int(r) - 1] if r.isdigit() and 1 <= int(r) <= len(libres) else r
        motif = refus_dossier_drive(racine, choisi, suivis, numero, planning)
        if motif:
            dire("  REFUSÉ : " + motif)
            continue
        choisi = trouver(racine, choisi)
        propose = nom_dans_l_appli(racine, choisi) or choisi
        nom = reponse(demander, "  Nom du chantier dans l'appli (Entrée = « %s ») : " % propose) or propose
        chantiers[numero] = {"chantier": nom, "dossier_drive": choisi}
        ecrire_json(chemin_reglages, reglages)      # les autres clés du fichier sont gardées telles quelles
        faites += 1
        dire("  Noté : chantier n° %s = dossier Drive « %s », nom dans l'appli « %s »." % (numero, choisi, nom))
    suivis, _ = chantiers_suivis(reglages)
    restants = dossiers_drive_libres(racine, suivis, planning)
    if restants:
        dire("")
        dire("Dossier(s) du Drive sans dossier de chantier sur le PC : %s." % ", ".join("« %s »" % n for n in restants))
    dire("")
    dire("%d association(s) ajoutée(s) ; %d chantier(s) reconnu(s) en tout." % (faites, len(suivis)))
    return faites


# ── Le carnet : ce que les bordereaux proposent ─────────────────────────────
def lire_ecartes(chemin):
    """Les documents que Franck a écartés pour de bon : [{"chemin", "taille", "ecarte_le"}]."""
    if not os.path.isfile(chemin):
        return []
    try:
        lu = dc.lire_json(chemin)
        liste = lu["ecartes"]
        if not isinstance(liste, list):
            raise ValueError("pas de liste « ecartes »")
    except (OSError, ValueError, KeyError, TypeError) as e:
        raise Refus("Le fichier « _prive/%s » est illisible (%s). Rien n'est fait : montrez ce message." % (ECARTES_FICHIER, e))
    return [e for e in liste if isinstance(e, dict)]


def est_ecarte(ecartes, relatif, taille):
    return any(cle(e.get("chemin", "")) == cle(relatif) and e.get("taille") == taille for e in ecartes)


def nombre_de_pages(chemin):
    pypdfium2, _ = dc.charger_modules()
    document = pypdfium2.PdfDocument(chemin)
    try:
        return len(document)
    finally:
        document.close()


def table_des_codes(reglages, numero):
    """Anciens numéros de documents → numéros actuels : la table générale, complétée par celle du chantier s'il en a une."""
    table = {}
    propre = (reglages.get("chantiers", {}).get(numero) or {}).get("anciens_codes")
    for source in (reglages.get("anciens_codes"), propre):
        if isinstance(source, dict):
            table.update({str(k).strip().upper(): str(v).strip().upper() for k, v in source.items()})
    return table


def candidats_carnet(reglages, ecartes=(), compter_pages=nombre_de_pages):
    """Parcourt les bordereaux des chantiers suivis. N'écrit rien.
    Rend {"candidats": [...], "signales": [{"numero", "motif", "texte"}], "hors_carnet": n, "ecartes": n}."""
    racine, chantiers_pc, chantiers = reglages["racine"], dossier_des_chantiers(reglages), reglages["chantiers"]
    connus = reglages.get("hors_carnet")       # facultatif : des numéros actuels qui ne vont pas au carnet, à ne pas signaler
    hors = {str(c).strip().upper() for c in connus} if isinstance(connus, list) else set()
    vus = dossiers_pc(chantiers_pc)
    rendu = {"candidats": [], "signales": [], "hors_carnet": 0, "ecartes": 0}

    def signaler(numero, motif, texte):
        rendu["signales"].append({"numero": numero, "motif": motif, "texte": texte})

    for numero in sorted(chantiers, key=lambda n: (len(n), n)):
        fiche = chantiers[numero]
        nom_pc, pourquoi = dossier_pc_du(chantiers_pc, numero, vus)
        if nom_pc is None:
            signaler(numero, "chantier", "Chantier n° %s laissé de côté : %s." % (numero, pourquoi))
            continue
        motif = refus_dossier_drive(racine, fiche["dossier_drive"], chantiers, numero, reglages.get("planning"))
        if motif:
            signaler(numero, "chantier", "Chantier n° %s laissé de côté : %s Corrigez _prive/depot.json." % (numero, motif))
            continue
        try:
            carnet = dc.dossier_carnet(racine, fiche["dossier_drive"])
            liste = dc.lire_carnet(carnet)
        except (Refus, OSError) as e:
            signaler(numero, "chantier", "Chantier n° %s laissé de côté : %s" % (numero, e))
            continue
        au_carnet = {d["id"]: d for d in (liste or {}).get("documents", [])
                     if isinstance(d, dict) and isinstance(d.get("id"), str) and d.get("retire") is not True}
        codes = table_des_codes(reglages, numero)
        base = os.path.join(chantiers_pc, nom_pc)
        retenus = {}
        for d08 in sorted(n for n in os.listdir(base) if nfc(n).strip().startswith("08") and os.path.isdir(os.path.join(base, n))):
            bordereaux = [n for n in os.listdir(os.path.join(base, d08))
                          if DOSSIER_BORDEREAU.match(nfc(n).strip()) and os.path.isdir(os.path.join(base, d08, n))]
            for bordereau in sorted(bordereaux, key=lambda n: int(DOSSIER_BORDEREAU.match(nfc(n).strip()).group(1))):
                dossier = os.path.join(base, d08, bordereau)
                for fichier in sorted(os.listdir(dossier)):
                    chemin = os.path.join(dossier, fichier)
                    if not fichier.lower().endswith(".pdf") or not os.path.isfile(chemin):
                        continue
                    ou = "%s, « %s »" % (bordereau, fichier)
                    lu = NOM_DE_BORDEREAU.match(nfc(fichier))
                    if not lu:
                        if not cle(fichier).startswith("bordereau"):       # le bordereau lui-même n'est pas un document
                            signaler(numero, "nom", "Chantier n° %s, %s : nom hors nomenclature, ignoré." % (numero, ou))
                        continue
                    n_chantier, _, ancien, indice, intitule = lu.groups()
                    if n_chantier != numero:
                        signaler(numero, "autre-chantier", "Chantier n° %s, %s : ce fichier porte le n° de chantier %s, ignoré."
                                 % (numero, ou, n_chantier))
                        continue
                    ancien = ancien.upper()
                    code = codes.get(ancien, ancien)
                    if code not in dc.DPI_PAR_CODE:
                        if ancien in codes or ancien in hors:
                            rendu["hors_carnet"] += 1      # un numéro connu, qui n'est pas un document du carnet
                        else:
                            signaler(numero, "non-reconnu", "Chantier n° %s, %s : numéro de document « %s » non reconnu "
                                     "(ni un document du carnet, ni dans la table des anciens numéros), pas proposé." % (numero, ou, ancien))
                        continue
                    indice = indice.upper()
                    ident = "%s-%s" % (code, indice)
                    try:
                        etat = os.stat(chemin)
                    except OSError as e:
                        signaler(numero, "illisible", "Chantier n° %s, %s : fichier illisible (%s)." % (numero, ou, e))
                        continue
                    if ident in au_carnet:
                        source = au_carnet[ident].get("source")
                        if isinstance(source, dict) and (cle(source.get("nom", "")) != cle(fichier) or source.get("poids") != etat.st_size):
                            signaler(numero, "change", "Chantier n° %s, %s : ce document (%s) A CHANGÉ DEPUIS SON DÉPÔT au carnet "
                                     "(déposé : « %s », %s ; aujourd'hui : %s). Le carnet montre toujours l'ancien, et rien n'y est jamais écrasé : "
                                     "pour publier le nouveau, renvoyez-le sous l'indice suivant (nouveau bordereau)."
                                     % (numero, ou, ident, source.get("nom", "?"), mo(source.get("poids") or 0), mo(etat.st_size)))
                        continue
                    propre = dc.nettoyer_intitule(intitule)
                    if not propre:
                        signaler(numero, "nom", "Chantier n° %s, %s : intitulé vide, ignoré." % (numero, ou))
                        continue
                    candidat = {"chantier": fiche["chantier"], "numero": numero, "bordereau": bordereau, "fichier": fichier,
                                "chemin": chemin, "relatif": "/".join(nfc(m) for m in (nom_pc, d08, bordereau, fichier)),
                                "pages": None, "poids": etat.st_size, "instant": etat.st_mtime, "date": date_fr(etat.st_mtime),
                                "dossier_drive": fiche["dossier_drive"], "dossier_carnet": os.path.basename(carnet),
                                "code": code, "indice": indice, "intitule": propre, "id": ident,
                                "ancien_code": ancien if ancien != code else None}
                    autre = retenus.get(ident)
                    if autre is not None:
                        garde, laisse = (candidat, autre) if candidat["instant"] > autre["instant"] else (autre, candidat)
                        signaler(numero, "plusieurs-bordereaux", "Chantier n° %s : le document %s est dans plusieurs bordereaux ; "
                                 "le plus récent est gardé (%s, du %s), l'autre est laissé (%s, du %s)."
                                 % (numero, ident, garde["bordereau"], garde["date"], laisse["bordereau"], laisse["date"]))
                        candidat = garde
                    retenus[ident] = candidat
        for ident in sorted(retenus):
            candidat = retenus[ident]
            if est_ecarte(ecartes, candidat["relatif"], candidat["poids"]):
                rendu["ecartes"] += 1
                continue
            try:
                candidat["pages"] = compter_pages(candidat["chemin"])
            except Refus:
                raise
            except Exception as e:
                signaler(numero, "illisible", "Chantier n° %s, %s, « %s » : PDF illisible (%s), pas proposé."
                         % (numero, candidat["bordereau"], candidat["fichier"], e))
                continue
            rendu["candidats"].append(candidat)
    return rendu


def decrire_candidat(c, rang=None, total=None):
    """Les lignes montrées à Franck avant sa réponse."""
    tete = "Document %d/%d — " % (rang, total) if rang else ""
    lignes = ["%schantier n° %s « %s »" % (tete, c["numero"], c["chantier"]),
              "  Bordereau : %s" % c["bordereau"],
              "  Fichier   : %s" % c["fichier"],
              "  %d page(s), %s, fichier du %s" % (c["pages"], mo(c["poids"]), c["date"])]
    if c.get("ancien_code"):
        lignes.append("  Ancien numéro %s : déposé sous le numéro actuel %s." % (c["ancien_code"], c["code"]))
    lignes.append("  Ira dans le Drive de l'appli : « %s », dossier « %s », sous le nom « %s %s %s »."
                  % (c["dossier_drive"], c["dossier_carnet"], c["code"], c["indice"], c["intitule"]))
    return lignes


def traiter_carnet(reglages, candidats, chemin_ecartes, demander=input, dire=print, deposer=None, verifier=None, maintenant=None):
    """Demande, document par document : o (déposer), n (écarter pour de bon), Entrée (plus tard).
    Rend {"deposes", "ecartes", "plus_tard", "refuses": [(candidat, message)], "verifications": {n°: compte rendu}}."""
    deposer, verifier = deposer or dc.deposer, verifier or dc.verifier
    bilan = {"deposes": [], "ecartes": [], "plus_tard": [], "refuses": [], "verifications": {}}
    ferme = False
    for rang, c in enumerate(candidats, 1):
        dire("")
        for ligne in decrire_candidat(c, rang, len(candidats)):
            dire(ligne)
        choix = ""
        for _ in range(3):
            if ferme:
                break
            r = reponse(demander, "  Déposer au carnet ? o = oui / n = non, ne plus le proposer / Entrée = plus tard : ")
            if r is None:
                ferme = True
                break
            r = r.lower()
            if r in ("o", "oui", "n", "non", ""):
                choix = r[:1]
                break
            dire("  Réponse non comprise : tapez o, n, ou seulement Entrée.")
        if choix == "n":
            ecartes = lire_ecartes(chemin_ecartes)
            ecartes = [e for e in ecartes if cle(e.get("chemin", "")) != cle(c["relatif"])]
            ecartes.append({"chemin": c["relatif"], "taille": c["poids"], "ecarte_le": heure_de_paris(maintenant)})
            os.makedirs(os.path.dirname(chemin_ecartes), exist_ok=True)
            ecrire_json(chemin_ecartes, {"version": 1, "ecartes": ecartes})
            bilan["ecartes"].append(c)
            dire("  Écarté : il ne sera plus proposé (sauf s'il est refait).")
            continue
        if choix != "o":
            bilan["plus_tard"].append(c)
            dire("  Plus tard : il sera proposé de nouveau au prochain lancement.")
            continue
        try:
            r = None
            for _ in range(1000):          # sans limite de temps ; relancé tant que le dépôt n'est pas terminé
                r = deposer(reglages["racine"], c["dossier_drive"], c["chantier"], c["chemin"], c["code"], c["indice"], c["intitule"],
                            limite=float("inf"), dire=lambda ligne: dire("    " + ligne))
                if r["termine"]:
                    break
            if not r or not r["termine"]:
                raise Refus("le dépôt n'est pas terminé : relancez le programme, il reprendra où il en est.")
            bilan["deposes"].append(c)
            dire("  Déposé : %s, %d page(s), %s d'images." % (r["id"], r["pages"], mo(r["poids"])))
        except (Refus, OSError) as e:
            bilan["refuses"].append((c, str(e)))
            dire("  PAS DÉPOSÉ : %s" % e)
    for numero in sorted({c["numero"] for c in bilan["deposes"]} | {c["numero"] for c, _ in bilan["refuses"]}):
        dossier = reglages["chantiers"][numero]["dossier_drive"]
        try:
            v = verifier(reglages["racine"], dossier)
        except (Refus, OSError) as e:
            v = {"bon": False, "problemes": [str(e)], "documents": 0, "retires": 0, "poids": 0}
        bilan["verifications"][numero] = v
        dire("")
        dire("Contrôle du carnet du chantier n° %s : %s (%d document(s) montré(s), %s)."
             % (numero, "tout est bon" if v["bon"] else "%d défaut(s)" % len(v["problemes"]), v["documents"], mo(v["poids"])))
        for p in v["problemes"]:
            dire("  ! " + p)
    return bilan


def retirer_document(reglages, demander=input, dire=print, retirer=None):
    """Menu : choisir un chantier, puis un document de son carnet, et le masquer dans l'appli. Aucun fichier n'est supprimé.
    Rend le compte rendu de depot_carnet.retirer, ou None si rien n'a été retiré."""
    retirer = retirer or dc.retirer
    racine, chantiers = reglages["racine"], reglages["chantiers"]
    numeros = sorted(chantiers, key=lambda n: (len(n), n))
    dire("Retirer un document du carnet — de quel chantier ?")
    for i, numero in enumerate(numeros, 1):
        dire("  %2d. n° %s « %s »" % (i, numero, chantiers[numero]["chantier"]))
    r = reponse(demander, "Numéro de la ligne (Entrée = abandonner) : ")
    if not r or not r.isdigit() or not 1 <= int(r) <= len(numeros):
        dire("Abandon : rien n'est modifié.")
        return None
    fiche = chantiers[numeros[int(r) - 1]]
    liste = dc.lire_carnet(dc.dossier_carnet(racine, fiche["dossier_drive"]))
    documents = [d for d in (liste or {}).get("documents", []) if isinstance(d, dict) and isinstance(d.get("id"), str) and d.get("retire") is not True]
    if not documents:
        dire("Le carnet de ce chantier ne montre aucun document.")
        return None
    dire("Quel document ?")
    for i, d in enumerate(documents, 1):
        dire("  %2d. %s  %s  (déposé le %s)" % (i, d["id"], d.get("intitule", ""), d.get("date", "?")))
    r = reponse(demander, "Numéro de la ligne (Entrée = abandonner) : ")
    if not r or not r.isdigit() or not 1 <= int(r) <= len(documents):
        dire("Abandon : rien n'est modifié.")
        return None
    choisi = documents[int(r) - 1]
    r = reponse(demander, "Retirer « %s %s » du carnet de « %s » ? Les poseurs ne le verront plus. o = oui / Entrée = non : "
                % (choisi["id"], choisi.get("intitule", ""), fiche["chantier"]))
    if not r or r.lower() not in ("o", "oui"):
        dire("Abandon : rien n'est modifié.")
        return None
    rendu = retirer(racine, fiche["dossier_drive"], choisi["id"])
    dire("Le document %s est retiré : il ne sera plus montré dans l'appli (dix minutes au plus). "
         "Ses fichiers restent dans le dossier « %s »." % (rendu["id"], rendu["dossier"]))
    return rendu


# ── La recopie des fiches : Drive de l'appli → dossier du chantier sur le PC ──
def sous_dossiers(racine):
    """Lit dossiers.json. Rend {"fiches": [chemins à rapatrier], "exclus": [carnet, plans]} ; un chemin = une liste de noms."""
    try:
        lu = dc.lire_json(os.path.join(racine, dc.DOSSIERS_FICHIER))
    except (OSError, ValueError) as e:
        raise Refus("Le fichier « %s » de la racine du Drive est illisible (%s) : rien n'est rapatrié." % (dc.DOSSIERS_FICHIER, e))
    documents = dict(DOCUMENTS_DEFAUT)
    lus = lu.get("documents") if isinstance(lu, dict) else None
    for nom, valeur in (lus.items() if isinstance(lus, dict) else ()):
        valeur = str(valeur if valeur is not None else "").strip()
        if valeur and all(m.strip() != ".." for m in valeur.split("/")):     # comme cheminsSurs_ (apps-script/Dossiers.gs)
            documents[nom] = valeur
    rendu = {"fiches": [], "exclus": []}
    for nom in sorted(documents):
        morceaux = [m.strip() for m in documents[nom].split("/") if m.strip()]
        if not morceaux or not all(dc.nom_simple(m) for m in morceaux):
            raise Refus("Dans « %s », le dossier « %s » (« %s ») n'est pas utilisable : rien n'est rapatrié."
                        % (dc.DOSSIERS_FICHIER, nom, documents[nom]))
        ou = rendu["exclus"] if nom in CLES_NON_RAPATRIEES else rendu["fiches"]
        if [cle(m) for m in morceaux] not in [[cle(m) for m in deja] for deja in ou]:
            ou.append(morceaux)
    return rendu


def est_sous(morceaux, chemins):
    """Vrai si le chemin « morceaux » est l'un de ces chemins, ou dedans."""
    cles = [cle(m) for m in morceaux]
    return any(cles[:len(c)] == [cle(m) for m in c] for c in chemins)


def parcourir(base, signaler):
    """Tous les fichiers sous « base » : (noms depuis la base, chemin complet). Un dossier illisible est signalé."""
    def erreur(e):
        signaler("illisible", os.path.relpath(getattr(e, "filename", None) or base, base).replace(os.sep, "/"), str(e))

    for dossier, sous, fichiers in os.walk(base, onerror=erreur):
        sous.sort()
        relatif = [] if dossier == base else os.path.relpath(dossier, base).split(os.sep)
        for nom in sorted(fichiers):
            yield relatif + [nom], os.path.join(dossier, nom)


def plan_rapatriement(reglages, numero, sous=None):
    """Ce que le rapatriement du chantier ferait. N'écrit rien.
    Rend {"numero", "chantier", "dossier_drive", "drive", "dossier_pc", "chantiers_pc", "a_copier", "deja", "signales"}."""
    racine, chantiers_pc, chantiers = reglages["racine"], dossier_des_chantiers(reglages), reglages["chantiers"]
    fiche = chantiers[numero]
    sous = sous or sous_dossiers(racine)
    motif = refus_dossier_drive(racine, fiche["dossier_drive"], chantiers, numero, reglages.get("planning"))
    if motif:
        raise Refus(motif + " Corrigez _prive/depot.json.")
    nom_pc, pourquoi = dossier_pc_du(chantiers_pc, numero)
    if nom_pc is None:
        raise Refus(pourquoi + ".")
    drive = os.path.join(racine, trouver(racine, fiche["dossier_drive"]))
    base_pc = os.path.join(chantiers_pc, nom_pc)
    plan = {"numero": numero, "chantier": fiche["chantier"], "dossier_drive": os.path.basename(drive), "drive": drive,
            "dossier_pc": nom_pc, "pc": base_pc, "a_copier": [], "deja": [], "signales": []}

    def signaler(motif, chemin, detail=""):
        plan["signales"].append({"motif": motif, "chemin": nfc(chemin), "detail": detail})

    vus = set()
    for relatif, source in parcourir(drive, signaler):
        chemin = "/".join(relatif)
        nom = relatif[-1]
        if cle(nom) in FICHIERS_IGNORES or (len(relatif) == 1 and cle(nom) in (INDEX, INDEX + ".tmp")):
            continue
        if est_sous(relatif, sous["exclus"]):
            continue                                   # le carnet et l'ancien dossier des plans : des copies, pas des fiches
        if not est_sous(relatif, sous["fiches"]):
            signaler("hors-rangement", chemin)
            continue
        if cle(chemin) in vus:
            continue
        vus.add(cle(chemin))
        if os.path.splitext(nom)[1].lower() in RACCOURCIS:
            signaler("raccourci", chemin)
            continue
        if any(dc.DOUBLON.search(m) for m in relatif):
            signaler("doublon", chemin)
            continue
        cible = viser(base_pc, relatif)
        if len(os.path.abspath(source)) > CHEMIN_MAX or len(os.path.abspath(cible)) > CHEMIN_MAX:
            signaler("trop-long", chemin, "%d caractères" % max(len(os.path.abspath(source)), len(os.path.abspath(cible))))
            continue
        try:
            taille = os.path.getsize(source)
        except OSError as e:
            signaler("illisible", chemin, str(e))
            continue
        if os.path.isdir(cible):
            signaler("taille-differente", chemin, "dans le dossier du PC, ce nom est celui d'un dossier")
        elif os.path.lexists(cible):
            presente = os.path.getsize(cible)
            if presente == taille:
                plan["deja"].append({"chemin": nfc(chemin), "taille": taille})
            else:
                signaler("taille-differente", chemin, "Drive : %d octets ; PC : %d octets" % (taille, presente))
        else:
            plan["a_copier"].append({"chemin": nfc(chemin), "taille": taille, "source": source, "cible": cible})
    return plan


def copier_blocs(lecture, ecriture):
    while True:
        bloc = lecture.read(1048576)
        if not bloc:
            return
        ecriture.write(bloc)


def copier_fichier(source, cible):
    """Copie « source » vers « cible » sans jamais écraser : sous un nom temporaire, puis renommage si la taille est bonne.
    Un arrêt en route ne laisse jamais un fichier tronqué sous son nom final. Rend la taille copiée."""
    os.makedirs(os.path.dirname(cible), exist_ok=True)
    partiel = cible + PARTIEL
    fini = False
    try:
        avant = os.stat(source)
        with open(source, "rb") as lecture, open(partiel, "wb") as ecriture:
            copier_blocs(lecture, ecriture)
            ecriture.flush()
            os.fsync(ecriture.fileno())
        taille = os.path.getsize(partiel)
        if taille != avant.st_size or os.path.getsize(source) != avant.st_size:
            raise OSError("la copie fait %d octets au lieu de %d : elle n'est pas gardée" % (taille, avant.st_size))
        os.utime(partiel, (avant.st_atime, avant.st_mtime))        # la copie garde la date du fichier d'origine
        if os.path.lexists(cible):
            raise OSError("un fichier de ce nom vient d'apparaître dans le dossier du chantier : rien n'est écrasé")
        os.replace(partiel, cible)
        fini = True
        return taille
    finally:
        if not fini and os.path.exists(partiel):
            try:
                os.remove(partiel)       # notre propre copie inachevée
            except OSError:
                pass


def lire_provenance(chemin, chantier, numero):
    """La liste cumulée des fichiers copiés (dans le dossier du chantier sur le PC). Refuse si elle est illisible : on ne la remplace pas."""
    if not os.path.isfile(chemin):
        return {"version": 1, "chantier": chantier, "numero": numero, "fichiers": []}
    try:
        liste = dc.lire_json(chemin)
        if not isinstance(liste, dict) or not isinstance(liste.get("fichiers"), list):
            raise ValueError("pas de liste « fichiers »")
    except (OSError, ValueError) as e:
        raise Refus("dans le dossier du chantier sur le PC, la liste « %s » est illisible (%s). Rien n'est copié pour ce chantier : "
                    "attendez que MEGA ait fini de synchroniser, ou montrez ce message." % (PROVENANCE, e))
    return liste


def relever_pc(base_pc, fiches):
    """Les fichiers présents dans le dossier du chantier sur le PC, pour les sous-dossiers des fiches : [{"chemin", "taille"}]."""
    releve = {}
    for morceaux in fiches:
        dossier = descendre(base_pc, morceaux)
        if dossier is None or not os.path.isdir(dossier):
            continue
        debut = os.path.relpath(dossier, base_pc).split(os.sep)
        for relatif, chemin in parcourir(dossier, lambda *a: None):
            nom = relatif[-1]
            if cle(nom) in FICHIERS_IGNORES or nom.endswith(PARTIEL) or nom.endswith(".tmp"):
                continue
            try:
                releve[nfc("/".join(debut + relatif))] = os.path.getsize(chemin)
            except OSError:
                pass
    return [{"chemin": c, "taille": releve[c]} for c in sorted(releve)]


def releve_a_refaire(chemin, releve, instant):
    """Faux si le relevé déjà écrit dit la même chose et date de moins d'un jour (inutile de faire travailler Drive)."""
    try:
        ancien = dc.lire_json(chemin)
        memes = all(ancien.get(k) == releve[k] for k in ("version", "chantier", "numero", "fichiers"))
        age = datetime.datetime.fromisoformat(instant) - datetime.datetime.fromisoformat(ancien["releve_le"])
        return not memes or not 0 <= age.total_seconds() < RELEVE_FRAIS
    except (OSError, ValueError, KeyError, TypeError, AttributeError):
        return True


def rapatrier(reglages, numero, sous=None, dire=print, maintenant=None, simuler=False, econome=False):
    """Copie les fiches du chantier du Drive vers son dossier sur le PC (jamais l'inverse), puis écrit la liste de provenance
    (dossier du PC) et le relevé releve-pc.json (Drive). Rend le plan, complété de "copies", "erreurs", "ajoutes" et "releve"."""
    racine = reglages["racine"]
    sous = sous or sous_dossiers(racine)
    plan = plan_rapatriement(reglages, numero, sous)
    plan.update(copies=[], erreurs=[], ajoutes=0, releve=0)
    if simuler:
        return plan
    chemin_provenance = os.path.join(plan["pc"], PROVENANCE)
    provenance = lire_provenance(chemin_provenance, plan["chantier"], numero)      # refus AVANT toute copie
    instant = heure_de_paris(maintenant)
    for a in plan["a_copier"]:
        try:
            copier_fichier(a["source"], a["cible"])
            plan["copies"].append(a)
            dire("    copié : %s — %s (%s)" % (plan["dossier_pc"], a["chemin"], mo(a["taille"])))
        except OSError as e:
            plan["erreurs"].append({"chemin": a["chemin"], "detail": str(e)})
            dire("    ! pas copié : %s — %s (%s)" % (plan["dossier_pc"], a["chemin"], e))
    # (a) dans le dossier du PC : la provenance, cumulée. Les entrées déjà là sont gardées telles quelles, sans doublon de chemin.
    connus = {cle(e.get("chemin", "")) for e in provenance["fichiers"] if isinstance(e, dict)}
    for a in plan["copies"] + plan["deja"]:      # « déjà présent » : même nom et même taille qu'une fiche du Drive, dans un dossier de fiches
        if cle(a["chemin"]) not in connus:
            connus.add(cle(a["chemin"]))
            provenance["fichiers"].append({"chemin": a["chemin"], "taille": a["taille"], "copie_le": instant})
            plan["ajoutes"] += 1
    if plan["ajoutes"]:
        ecrire_json(chemin_provenance, provenance)
    # (b) dans le Drive : le relevé de présence, refait en entier (format du contrat).
    fichiers = relever_pc(plan["pc"], sous["fiches"])
    releve = {"version": 1, "chantier": plan["chantier"], "numero": numero, "releve_le": instant, "fichiers": fichiers}
    chemin_releve = os.path.join(plan["drive"], INDEX)
    if not econome or releve_a_refaire(chemin_releve, releve, instant):
        ecrire_json(chemin_releve, releve, lisible=False)
    plan["releve"] = len(fichiers)
    return plan


def a_classer(racine):
    """Les fichiers du dossier « _À CLASSER » de la racine du Drive : signalés, jamais copiés."""
    dossier = descendre(racine, [A_CLASSER])
    if dossier is None or not os.path.isdir(dossier):
        return []
    return [nfc("/".join(relatif)) for relatif, _ in parcourir(dossier, lambda *a: None) if cle(relatif[-1]) not in FICHIERS_IGNORES]


LIBELLES = {
    "hors-rangement": "hors des dossiers de fiches (pas copié : rangez-le dans le Drive s'il doit aller dans le dossier du chantier)",
    "raccourci": "raccourci Google, qui ne contient pas le document (pas copié)",
    "doublon": "doublon fabriqué par Drive (pas copié)",
    "trop-long": "chemin trop long (pas copié)",
    "illisible": "illisible (pas copié)",
    "taille-differente": "déjà dans le dossier du PC sous le même nom, mais PAS de la même taille (rien n'est touché)",
}


def dire_rapatriement(plan, dire, simuler=False):
    dire("")
    dire("Chantier n° %s « %s » — Drive « %s » → dossier du PC « %s »" % (plan["numero"], plan["chantier"], plan["dossier_drive"], plan["dossier_pc"]))
    if simuler:
        dire("  %d fichier(s) à copier, %d déjà dans le dossier du PC." % (len(plan["a_copier"]), len(plan["deja"])))
        montrer_liste(dire, ["    à copier : %s (%s)" % (a["chemin"], mo(a["taille"])) for a in plan["a_copier"]])
    else:
        dire("  %d fichier(s) copié(s), %d déjà dans le dossier du PC, %d en erreur ; %d ajouté(s) à la liste de provenance ; relevé : %d fichier(s)."
             % (len(plan["copies"]), len(plan["deja"]), len(plan["erreurs"]), plan["ajoutes"], plan["releve"]))
    for motif in LIBELLES:
        lignes = ["    - %s%s" % (s["chemin"], " (%s)" % s["detail"] if s["detail"] else "") for s in plan["signales"] if s["motif"] == motif]
        if lignes:
            dire("  %d signalé(s) — %s :" % (len(lignes), LIBELLES[motif]))
            montrer_liste(dire, lignes)


# ── Un seul traitement à la fois : le verrou ; et le journal ────────────────
def processus_vivant(numero):
    """Vrai si un programme porte ce numéro sur ce PC. Ne fait que regarder : n'arrête et ne dérange aucun programme."""
    try:
        numero = int(numero)
    except (TypeError, ValueError):
        return False
    if numero <= 0:
        return False
    if os.name == "nt":
        import ctypes
        from ctypes import wintypes
        noyau = ctypes.WinDLL("kernel32", use_last_error=True)
        noyau.OpenProcess.restype = wintypes.HANDLE
        noyau.OpenProcess.argtypes = (wintypes.DWORD, wintypes.BOOL, wintypes.DWORD)
        noyau.GetExitCodeProcess.argtypes = (wintypes.HANDLE, ctypes.POINTER(wintypes.DWORD))
        noyau.CloseHandle.argtypes = (wintypes.HANDLE,)
        poignee = noyau.OpenProcess(0x1000, False, numero)          # 0x1000 : seulement le droit de demander son état
        if not poignee:
            return ctypes.get_last_error() == 5                      # 5 = accès refusé : il existe, mais n'est pas à nous
        try:
            code = wintypes.DWORD()
            return not noyau.GetExitCodeProcess(poignee, ctypes.byref(code)) or code.value == 259    # 259 = toujours en marche
        finally:
            noyau.CloseHandle(poignee)
    try:
        os.kill(numero, 0)               # hors Windows : le signal 0 ne fait que vérifier
    except ProcessLookupError:
        return False
    except PermissionError:
        return True
    return True


def prendre_verrou(chemin, dire=print, vivant=processus_vivant, horloge=time.time, machine=None, processus=None):
    """Pose le verrou (refuse si un autre traitement tourne). Un verrou laissé par un programme arrêté est repris."""
    moi = {"machine": machine or socket.gethostname(), "processus": processus or os.getpid(),
           "instant": horloge(), "date": datetime.datetime.fromtimestamp(horloge()).strftime("%d/%m/%Y %H:%M")}
    os.makedirs(os.path.dirname(chemin), exist_ok=True)
    try:
        fichier = os.open(chemin, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
    except FileExistsError:
        try:
            autre = dc.lire_json(chemin)
            age = horloge() - float(autre["instant"])
            meme_machine = autre["machine"] == moi["machine"]
            quand = str(autre.get("date", "?"))
            orphelin = (not vivant(autre["processus"]) or autre["processus"] == moi["processus"]) if meme_machine else age > VERROU_VIEUX
        except (OSError, ValueError, KeyError, TypeError):
            quand = "?"
            orphelin = horloge() - os.path.getmtime(chemin) > VERROU_VIEUX
        if not orphelin:
            raise Refus("Un autre traitement est déjà en cours (lancé le %s). Attendez qu'il ait fini, puis relancez. "
                        "Si aucune autre fenêtre du programme n'est ouverte, réessayez dans quelques minutes." % quand)
        dire("Un verrou laissé par un traitement qui ne tourne plus (du %s) a été repris : le travail continue normalement." % quand)
        ecrire_json(chemin, moi)
        return moi
    with os.fdopen(fichier, "w", encoding="utf-8") as f:
        json.dump(moi, f, ensure_ascii=False)
    return moi


def liberer_verrou(chemin, moi):
    """Retire notre verrou (et seulement le nôtre)."""
    try:
        autre = dc.lire_json(chemin)
        if autre.get("machine") == moi["machine"] and autre.get("processus") == moi["processus"]:
            os.remove(chemin)
    except (OSError, ValueError, AttributeError):
        pass


class Journal:
    """Dit à l'écran et note dans _prive/appli-pc/journal-AAAA-MM-JJ.txt (noms de fichiers seulement : aucun secret)."""

    def __init__(self, dossier, dire=print):
        self.dire = dire
        self.chemin = os.path.join(dossier, "journal-%s.txt" % datetime.date.today().isoformat())
        try:
            os.makedirs(dossier, exist_ok=True)
        except OSError:
            self.chemin = None

    def noter(self, ligne=""):
        if not self.chemin:
            return
        try:
            with open(self.chemin, "a", encoding="utf-8", newline="\n") as f:
                f.write("[%s] %s\n" % (datetime.datetime.now().strftime("%H:%M:%S"), ligne))
        except OSError:
            self.chemin = None

    def __call__(self, ligne=""):
        self.dire(ligne)
        self.noter(ligne)


# ── Quels chantiers : la correspondance d'abord, sinon le numéro en tête du nom du dossier ──
def tri_numeros(numeros):
    return sorted(numeros, key=lambda n: (len(n), n))


def chantiers_suivis(reglages):
    """Trouve tout seul les chantiers : pour chaque dossier de chantier du Drive, son n° (la correspondance de
    _prive/depot.json s'il y est, sinon les chiffres en tête de son nom), puis LE dossier du PC qui commence par ce n°.
    Aucun dossier du PC, ou plusieurs : rien n'est deviné. N'écrit rien.
    Rend ({n°: {"chantier", "dossier_drive", …}}, [lignes « à voir »])."""
    racine, chantiers_pc = reglages["racine"], dossier_des_chantiers(reglages)
    correspondance = reglages.get("chantiers") or {}
    planning = reglages.get("planning")
    par_dossier = {cle(f["dossier_drive"]): str(n) for n, f in correspondance.items()}
    a_voir, par_numero = [], {}
    for nom in sorted(os.listdir(racine)):
        if not os.path.isdir(os.path.join(racine, nom)):
            continue
        if dc.DOUBLON.search(nom):
            a_voir.append("Dossier du Drive « %s » : c'est un dossier en double fabriqué par Google Drive. Rien n'est copié pour lui : "
                          "rangez ce doublon dans Drive." % nom)
            continue
        if refus_dossier_drive(racine, nom, {}, None, planning) is not None:
            continue                                   # dossier technique (_À CLASSER, ADMINISTRATIF, planning…) : pas un chantier
        numero = par_dossier.get(cle(nom)) or numero_du_dossier(nom)
        if numero is None:
            a_voir.append("Dossier du Drive « %s » : pas de numéro de chantier en tête de son nom. Rien n'est copié pour lui "
                          "(pour le relier à son dossier du PC : choix 4 du menu de appli-pc)." % nom)
            continue
        par_numero.setdefault(numero, []).append(nom)
    for numero, fiche in correspondance.items():
        reel = trouver(racine, fiche["dossier_drive"])
        if reel is None or not os.path.isdir(os.path.join(racine, reel)):
            a_voir.append("Chantier n° %s : le dossier du Drive noté dans la correspondance (« %s ») est introuvable. "
                          "Corrigez _prive/depot.json." % (numero, fiche["dossier_drive"]))
    vus = dossiers_pc(chantiers_pc)
    suivis = {}
    for numero in tri_numeros(par_numero):
        noms = par_numero[numero]
        if len(noms) > 1:
            a_voir.append("Chantier n° %s : plusieurs dossiers du Drive portent ce numéro (%s). Rien n'est copié pour eux."
                          % (numero, ", ".join("« %s »" % n for n in noms)))
            continue
        nom_pc, pourquoi = dossier_pc_du(chantiers_pc, numero, vus)
        if nom_pc is None:
            a_voir.append("Chantier n° %s (dossier du Drive « %s ») : %s. Rien n'est copié pour lui." % (numero, noms[0], pourquoi))
            continue
        fiche = dict(correspondance.get(numero) or {})
        fiche["dossier_drive"] = noms[0]
        if not fiche.get("chantier"):
            fiche["chantier"] = nom_dans_l_appli(racine, noms[0]) or noms[0]
        suivis[numero] = fiche
    return suivis, a_voir


# ── Ce qui demande l'attention de Franck : le fichier « CHANTIERPRO - A VOIR.txt » ──
def lignes_a_voir(plan, maxi=A_VOIR_MAX):
    """Les lignes « à voir » d'un chantier rapatrié : ce qui a été signalé sans être copié, et les copies en erreur."""
    qui = "Chantier n° %s (« %s »)" % (plan["numero"], plan["dossier_pc"])
    lignes = []
    for motif in LIBELLES:
        trouves = [s for s in plan["signales"] if s["motif"] == motif]
        for s in trouves[:maxi]:
            lignes.append("%s — %s : %s%s" % (qui, LIBELLES[motif], s["chemin"], " (%s)" % s["detail"] if s["detail"] else ""))
        if len(trouves) > maxi:
            lignes.append("%s — %s : … et %d autre(s) (liste complète : choix 2 du menu de appli-pc)." % (qui, LIBELLES[motif], len(trouves) - maxi))
    for e in plan.get("erreurs", []):
        lignes.append("%s — copie impossible, à réessayer au prochain passage : %s (%s)" % (qui, e["chemin"], e["detail"]))
    return lignes


def texte_a_voir(lignes, maintenant=None):
    quand = datetime.datetime.fromisoformat(heure_de_paris(maintenant)).strftime("%d/%m/%Y à %H:%M")
    texte = ["CHANTIERPRO — À VOIR", "Dernier passage : le %s (recopie des fiches de l'appli vers les dossiers de chantier du PC)." % quand, ""]
    if lignes:
        texte.append("%d point(s) demandent votre attention :" % len(lignes))
        texte.extend("- " + ligne for ligne in lignes)
    else:
        texte.append("Rien à signaler.")
    texte += ["", "Ce fichier est réécrit à chaque passage du programme. Rien n'est jamais supprimé ni écrasé par le programme."]
    return "\r\n".join(texte) + "\r\n"


def ecrire_a_voir(chantiers_pc, lignes, maintenant=None):
    """Réécrit « CHANTIERPRO - A VOIR.txt » à la racine du dossier des chantiers (temporaire, puis remplacement)."""
    chemin = os.path.join(chantiers_pc, A_VOIR)
    temporaire = chemin + ".tmp"
    try:
        with open(temporaire, "w", encoding="utf-8-sig", newline="") as f:      # « -sig » : le Bloc-notes affiche bien les accents
            f.write(texte_a_voir(lignes, maintenant))
        os.replace(temporaire, chemin)
    finally:
        if os.path.exists(temporaire):
            os.remove(temporaire)
    return chemin


def lire_a_voir(chantiers_pc):
    try:
        with open(os.path.join(chantiers_pc, A_VOIR), encoding="utf-8-sig") as f:
            return f.read()
    except OSError:
        return None


def rapatrier_tout(reglages, dire=print, maintenant=None, econome=False, resume=True):
    """Le rapatriement de tous les chantiers trouvés, puis le fichier « A VOIR ». La même fonction sert au double-clic
    et au passage automatique. Rend {"chantiers", "copies", "deja", "signales", "erreurs", "refuses", "plans", "a_voir"}."""
    racine, chantiers_pc = reglages["racine"], dossier_des_chantiers(reglages)
    sous = sous_dossiers(racine)
    suivis, a_voir = chantiers_suivis(reglages)
    effectif = dict(reglages, chantiers=suivis)
    bilan = {"chantiers": len(suivis), "copies": 0, "deja": 0, "signales": 0, "erreurs": 0, "refuses": 0, "plans": [], "a_voir": a_voir}
    for numero in tri_numeros(suivis):
        try:
            plan = rapatrier(effectif, numero, sous, dire=dire, maintenant=maintenant, econome=econome)
        except (Refus, OSError) as e:
            bilan["refuses"] += 1
            a_voir.append("Chantier n° %s : rien n'a été copié (%s)" % (numero, e))
            if resume:
                dire("")
                dire("Chantier n° %s : PAS RAPATRIÉ (%s)" % (numero, e))
            continue
        if resume:
            dire_rapatriement(plan, dire)
        bilan["plans"].append(plan)
        bilan["copies"] += len(plan["copies"])
        bilan["deja"] += len(plan["deja"])
        bilan["signales"] += len(plan["signales"])
        bilan["erreurs"] += len(plan["erreurs"])
        a_voir.extend(lignes_a_voir(plan))
    en_attente = a_classer(racine)
    if en_attente:
        a_voir.append("%d fichier(s) dans « %s » (racine du Drive de l'appli) : ils n'iront dans aucun dossier de chantier tant qu'ils "
                      "ne sont pas rangés dans le Drive (%s%s)." % (len(en_attente), A_CLASSER, ", ".join(en_attente[:5]), "…" if len(en_attente) > 5 else ""))
    ecrire_a_voir(chantiers_pc, a_voir, maintenant)
    return bilan


# ── Le passage automatique (tâche planifiée de Windows) : aucune question, aucune fenêtre ──
def noter_auto(prive, lignes):
    """Ajoute des lignes au journal des passages automatiques ; au-delà de 300 Ko, l'ancien journal est mis de côté."""
    dossier = os.path.join(prive, JOURNAL_DOSSIER)
    chemin = os.path.join(dossier, JOURNAL_AUTO)
    try:
        os.makedirs(dossier, exist_ok=True)
        if os.path.isfile(chemin) and os.path.getsize(chemin) > JOURNAL_AUTO_MAX:
            os.replace(chemin, os.path.join(dossier, JOURNAL_AUTO_ANCIEN))      # un seul ancien journal est gardé : il ne grossit pas sans fin
        quand = datetime.datetime.now().strftime("%d/%m/%Y %H:%M")
        with open(chemin, "a", encoding="utf-8", newline="\n") as f:
            for rang, ligne in enumerate(lignes):
                f.write(("[%s] %s\n" % (quand, ligne)) if rang == 0 else "    %s\n" % ligne)
    except OSError:
        pass


def passage_auto(chemin_reglages, maintenant=None):
    """Un passage sans personne devant l'écran : recopie les nouvelles fiches, met « A VOIR » à jour, note une ligne au journal.
    Codes : 0 = fait (même s'il n'y avait rien), ou un autre passage tourne déjà ; 2 = réglages ou Drive pas prêts ; 1 = erreur."""
    chemin_reglages = os.path.abspath(chemin_reglages)
    prive = os.path.dirname(chemin_reglages)
    reglages = None
    try:
        reglages = lire_reglages(chemin_reglages)
        controler_reglages(reglages)
        sous_dossiers(reglages["racine"])
    except Refus as e:
        noter_auto(prive, ["PAS FAIT : %s" % e])
        chantiers_pc = dossier_des_chantiers(reglages) if isinstance(reglages, dict) else None
        if isinstance(chantiers_pc, str) and os.path.isdir(chantiers_pc):
            try:
                ecrire_a_voir(chantiers_pc, ["La recopie des fiches n'a pas pu se faire : %s Le prochain passage réessaiera." % e], maintenant)
            except OSError:
                pass
        return 2
    verrou = os.path.join(prive, VERROU_FICHIER)
    try:
        moi = prendre_verrou(verrou, dire=lambda ligne: None)
    except Refus:
        noter_auto(prive, ["Rien fait : un autre passage du programme est en cours."])
        return 0
    detail = []
    try:
        bilan = rapatrier_tout(reglages, dire=detail.append, maintenant=maintenant, econome=True, resume=False)
    except Refus as e:
        noter_auto(prive, ["PAS FAIT : %s" % e])
        return 2
    except Exception as e:                     # personne ne regarde l'écran : tout est noté au journal
        noter_auto(prive, ["ERREUR : %s : %s" % (type(e).__name__, e)] + detail)
        return 1
    finally:
        liberer_verrou(verrou, moi)
    ligne = "%d chantier(s) ; %d fichier(s) copié(s), %d en erreur ; %d point(s) à voir." % (
        bilan["chantiers"], bilan["copies"], bilan["erreurs"], len(bilan["a_voir"]))
    noter_auto(prive, [ligne] + (detail if bilan["copies"] or bilan["erreurs"] else []))
    return 1 if bilan["erreurs"] else 0


# ── La tâche planifiée de Windows (sans droits d'administrateur) ────────────
def commande_tache(nom, declencheur, pythonw, script, options=()):
    """Les arguments de « schtasks » qui créent la tâche : le programme est lancé SANS fenêtre (pythonw), en mode automatique.
    « declencheur » : "HOURLY" (toutes les heures) ou "ONLOGON" (à l'ouverture de session)."""
    if declencheur not in ("HOURLY", "ONLOGON"):
        raise ValueError(declencheur)
    lancement = " ".join(['"%s"' % pythonw, '"%s"' % script, "--rapatrier", "--auto"] + ['"%s"' % o if " " in o else o for o in options])
    if len(lancement) > 261:
        raise Refus("Le chemin du dépôt est trop long pour une tâche planifiée de Windows (%d caractères, 261 au plus)." % len(lancement))
    arguments = ["schtasks", "/create", "/tn", nom, "/tr", lancement, "/sc", declencheur]
    if declencheur == "HOURLY":
        arguments += ["/mo", "1"]
    return arguments + ["/f"]


def commande_retrait(nom):
    return ["schtasks", "/delete", "/tn", nom, "/f"]


def lancer_commande(arguments):
    """Lance une commande de Windows ; rend (code de sortie, texte affiché)."""
    import subprocess
    fait = subprocess.run(arguments, capture_output=True)
    return fait.returncode, (fait.stdout + fait.stderr).decode("oem" if os.name == "nt" else "utf-8", "replace").strip()


def installer_tache(dire=print, lanceur=lancer_commande, pythonw=None, script=None, options=()):
    """Crée la tâche « toutes les heures », et si Windows l'accepte sans droits d'administrateur, celle de l'ouverture de session.
    Relançable (les tâches sont refaites). Rend 0, ou 1 si la tâche horaire n'a pas pu être créée."""
    pythonw = pythonw or os.path.join(os.path.dirname(sys.executable), "pythonw.exe")
    script = script or os.path.abspath(__file__)
    if not os.path.isfile(pythonw):
        raise Refus("« pythonw.exe » est introuvable à côté de Python : la tâche ne peut pas être créée. Montrez ce message.")
    code, texte = lanceur(commande_tache(TACHE, "HOURLY", pythonw, script, options))
    if code != 0:
        dire("La tâche « %s » n'a PAS pu être créée (code %s). Message de Windows : %s" % (TACHE, code, texte or "aucun"))
        return 1
    dire("Tâche créée : « %s » — toutes les heures, sans fenêtre." % TACHE)
    code, texte = lanceur(commande_tache(TACHE_SESSION, "ONLOGON", pythonw, script, options))
    if code == 0:
        dire("Tâche créée : « %s » — à chaque ouverture de session." % TACHE_SESSION)
    else:
        dire("La tâche « %s » n'a pas pu être créée sans droits d'administrateur (Windows a répondu : %s)." % (TACHE_SESSION, texte or "code %s" % code))
        dire("Ce n'est pas grave : la tâche horaire seule est gardée ; les fiches arrivent au plus tard une heure après.")
    dire("")
    dire("Pour vérifier : menu Démarrer, tapez « Planificateur de tâches », ouvrez-le, cliquez sur « Bibliothèque du Planificateur de tâches » :")
    dire("la ligne « %s » doit y être, avec l'heure de sa prochaine exécution." % TACHE)
    dire("Ce qui demande votre attention est écrit dans « %s », dans le dossier qui contient vos dossiers de chantier." % A_VOIR)
    return 0


def retirer_tache(dire=print, lanceur=lancer_commande):
    """Supprime les deux tâches planifiées. Aucun fichier n'est touché."""
    for nom in (TACHE, TACHE_SESSION):
        code, texte = lanceur(commande_retrait(nom))
        dire("Tâche retirée : « %s »." % nom if code == 0 else "Tâche « %s » : rien à retirer (elle n'existait pas, ou Windows a répondu : %s)." % (nom, texte or "code %s" % code))
    dire("La recopie automatique des fiches est arrêtée. Aucun fichier n'a été touché ; le double-clic sur appli-pc marche toujours.")
    return 0


# ── Les travaux complets ────────────────────────────────────────────────────
def lister(reglages, chemin_ecartes, dire=print):
    """Montre tout ce qui serait fait. N'écrit rien, nulle part."""
    racine, chantiers_pc, _ = controler_reglages(reglages)
    suivis, a_voir = chantiers_suivis(reglages)
    effectif = dict(reglages, chantiers=suivis)
    dire("VOIR SEULEMENT : rien n'est écrit, rien n'est copié.")
    dire("")
    dire("Chantiers reconnus : %d" % len(suivis))
    vus = dossiers_pc(chantiers_pc)
    for numero in tri_numeros(suivis):
        dire("  n° %s « %s » : Drive « %s » ; dossier du PC « %s »" % (numero, suivis[numero]["chantier"], suivis[numero]["dossier_drive"],
                                                                 dossier_pc_du(chantiers_pc, numero, vus)[0]))
    if a_voir:
        dire("À voir (%d) :" % len(a_voir))
        montrer_liste(dire, ["  ! " + ligne for ligne in a_voir])
    sans = [noms[0] for n, noms in sorted(vus.items()) if n not in suivis]
    if sans:
        dire("Dossiers de chantier du PC sans dossier dans le Drive de l'appli (%d) : normal pour un chantier qui n'est pas dans l'appli." % len(sans))
        montrer_liste(dire, ["    - " + n for n in sans])
    if not suivis:
        return
    dire("")
    dire("— CARNET —")
    vu = candidats_carnet(effectif, lire_ecartes(chemin_ecartes))
    for s in vu["signales"]:
        dire("  ! " + s["texte"])
    if not vu["candidats"]:
        dire("Aucun document à proposer au carnet.")
    for rang, c in enumerate(vu["candidats"], 1):
        dire("")
        for ligne in decrire_candidat(c, rang, len(vu["candidats"])):
            dire(ligne)
    if vu["ecartes"] or vu["hors_carnet"]:
        dire("(%d document(s) écarté(s) par vous, %d qui ne vont pas au carnet.)" % (vu["ecartes"], vu["hors_carnet"]))
    dire("")
    dire("— RECOPIE DES FICHES (Drive de l'appli → dossiers de chantier du PC) —")
    sous = sous_dossiers(racine)
    for numero in tri_numeros(suivis):
        try:
            dire_rapatriement(rapatrier(effectif, numero, sous, simuler=True), dire, simuler=True)
        except (Refus, OSError) as e:
            dire("")
            dire("Chantier n° %s : laissé de côté (%s)" % (numero, e))
    en_attente = a_classer(racine)
    if en_attente:
        dire("")
        dire("%d fichier(s) dans « %s » (racine du Drive) : ils n'iront dans aucun dossier de chantier tant qu'ils ne sont pas rangés." % (len(en_attente), A_CLASSER))
        montrer_liste(dire, ["    - " + c for c in en_attente])


def tout_traiter(reglages, prive, demander, dire, carnet=True, rapatriement=True, oui_rapatrier=False):
    """Le carnet, puis la recopie des fiches. Rend le nombre de défauts (0 = tout s'est bien passé)."""
    controler_reglages(reglages)
    chemin_ecartes = os.path.join(prive, ECARTES_FICHIER)
    ecartes = lire_ecartes(chemin_ecartes)               # tous les refus possibles AVANT la première écriture
    if rapatriement:
        sous_dossiers(reglages["racine"])
    suivis, a_voir = chantiers_suivis(reglages)
    effectif = dict(reglages, chantiers=suivis)
    defauts = 0
    resume = []
    if carnet:
        dire("— CARNET : les documents des bordereaux —")
        if not rapatriement:
            for ligne in a_voir:
                dire("  ! " + ligne)
        vu = candidats_carnet(effectif, ecartes)
        for s in vu["signales"]:
            dire("  ! " + s["texte"])
        if not vu["candidats"]:
            dire("Aucun document à proposer au carnet.")
        bilan = traiter_carnet(effectif, vu["candidats"], chemin_ecartes, demander, dire)
        defauts += len(bilan["refuses"]) + sum(1 for v in bilan["verifications"].values() if not v["bon"])
        resume.append("Carnet : %d déposé(s), %d écarté(s), %d remis à plus tard, %d pas déposé(s), %d signalement(s)."
                      % (len(bilan["deposes"]), len(bilan["ecartes"]), len(bilan["plus_tard"]), len(bilan["refuses"]), len(vu["signales"])))
        for c in bilan["deposes"]:
            resume.append("  déposé : chantier n° %s, %s %s %s" % (c["numero"], c["code"], c["indice"], c["intitule"]))
        for c, message in bilan["refuses"]:
            resume.append("  PAS DÉPOSÉ : chantier n° %s, « %s » : %s" % (c["numero"], c["fichier"], message))
        for numero, v in sorted(bilan["verifications"].items()):
            if not v["bon"]:
                resume.append("  ! carnet du chantier n° %s : %d défaut(s) trouvé(s) au contrôle." % (numero, len(v["problemes"])))
        if bilan["deposes"]:
            resume.append("  Les documents apparaissent dans l'appli quand Google Drive a fini de les envoyer (quelques minutes).")
    if rapatriement:
        dire("")
        dire("— RECOPIE DES FICHES : du Drive de l'appli vers les dossiers de chantier du PC —")
        accord = "o" if oui_rapatrier else reponse(demander, "Recopier maintenant les nouvelles fiches de %d chantier(s) ? Rien n'est supprimé ni modifié "
                                                   "dans le Drive. o = oui / Entrée = non : " % len(suivis))
        if not accord or accord.lower() not in ("o", "oui"):
            resume.append("Recopie des fiches : pas faite (vous avez répondu non).")
        else:
            fait = rapatrier_tout(reglages, dire=dire)
            defauts += fait["erreurs"] + fait["refuses"]
            resume.append("Recopie des fiches : %d fichier(s) copié(s) dans les dossiers de chantier du PC, %d déjà présent(s), "
                          "%d signalé(s) sans copie, %d en erreur." % (fait["copies"], fait["deja"], fait["signales"], fait["erreurs"]))
            resume.append("  À voir : %d point(s), écrits dans « %s » (dossier qui contient vos dossiers de chantier)." % (len(fait["a_voir"]), A_VOIR)
                          if fait["a_voir"] else "  À voir : rien à signaler.")
            for ligne in fait["a_voir"][:LISTE_MAX]:
                resume.append("    ! " + ligne)
            if fait["copies"]:
                resume.append("  VÉRIFIEZ L'ICÔNE DE MEGA : les fichiers sont sur le disque du PC ; MEGA doit encore finir de les synchroniser.")
    dire("")
    dire("═══ BILAN ═══")
    for ligne in resume:
        dire(ligne)
    dire("Rien n'a été supprimé, déplacé ni renommé." + ("" if not defauts else " %d défaut(s) : lisez les lignes marquées « ! » ou « PAS »." % defauts))
    return defauts


# ── Ligne de commande ───────────────────────────────────────────────────────
def lire_arguments(argv=None):
    a = argparse.ArgumentParser(description="Dépose au carnet les documents des bordereaux, et recopie les fiches de l'appli "
                                            "du Drive vers les dossiers de chantier du PC (lot 4c). Sans option : tout, avec confirmations.",
                                add_help=False,
                                usage="python outils/appli_pc.py [--lister | --associer | --carnet | --rapatrier [--auto] | --retirer | --a-voir "
                                      "| --installer-tache | --retirer-tache]",
                                epilog="Codes de sortie : 0 fait ; 2 refus (rien n'est écrit) ; 1 erreur ou défaut (lire le bilan).")
    a.add_argument("-h", "--help", action="help", help="affiche cette aide")
    a.add_argument("--lister", action="store_true", help="montre ce qui serait fait, sans rien écrire")
    a.add_argument("--associer", action="store_true", help="relie un dossier de chantier du PC à un dossier du Drive, quand le numéro ne suffit pas")
    a.add_argument("--carnet", action="store_true", help="le dépôt au carnet seulement")
    a.add_argument("--rapatrier", action="store_true", help="la recopie des fiches (Drive → dossiers de chantier du PC) seulement")
    a.add_argument("--auto", action="store_true", help="avec --rapatrier : aucune question, aucun affichage (pour la tâche planifiée)")
    a.add_argument("--retirer", action="store_true", help="retire un document du carnet (aucun fichier n'est supprimé)")
    a.add_argument("--a-voir", action="store_true", help="affiche le fichier « %s »" % A_VOIR)
    a.add_argument("--installer-tache", action="store_true", help="crée la tâche planifiée de Windows (recopie automatique, toutes les heures)")
    a.add_argument("--retirer-tache", action="store_true", help="supprime la tâche planifiée de Windows")
    a.add_argument("--oui-rapatrier", action="store_true", help="ne pose pas la question avant la recopie des fiches")
    a.add_argument("--reglages", default=REGLAGES_DEFAUT, help="fichier de réglages (par défaut : _prive/depot.json)")
    return a.parse_args(argv)


def lancer(o, demander=input, dire=print, lanceur=lancer_commande):
    chemin = os.path.abspath(o.reglages)
    prive = os.path.dirname(chemin)
    options = () if chemin == os.path.abspath(REGLAGES_DEFAUT) else ("--reglages", chemin)
    if o.auto:
        return passage_auto(chemin)
    if o.retirer_tache:
        return retirer_tache(dire, lanceur)
    reglages = lire_reglages(chemin)
    _, chantiers_pc, _ = controler_reglages(reglages)
    if o.installer_tache:
        sous_dossiers(reglages["racine"])
        return installer_tache(dire, lanceur, options=options)
    if o.a_voir:
        dire(lire_a_voir(chantiers_pc) or "Le fichier « %s » n'existe pas encore : aucune recopie des fiches n'a eu lieu." % A_VOIR)
        return 0
    if o.lister:
        lister(reglages, os.path.join(prive, ECARTES_FICHIER), dire)
        return 0
    # Tous les refus prévisibles tombent ici, AVANT le verrou et le journal : un refus n'écrit rien.
    if not (o.associer or o.retirer):
        lire_ecartes(os.path.join(prive, ECARTES_FICHIER))
        if o.rapatrier or not o.carnet:
            sous_dossiers(reglages["racine"])
    verrou = os.path.join(prive, VERROU_FICHIER)
    moi = prendre_verrou(verrou, dire)
    try:
        journal = Journal(os.path.join(prive, JOURNAL_DOSSIER), dire)

        def poser(question):
            r = reponse(demander, question)
            journal.noter("%s%s" % (question, "(saisie fermée)" if r is None else r))
            return r

        journal.noter("=== Lancement : %s ===" % (" ".join(n for n in ("associer", "retirer", "carnet", "rapatrier") if getattr(o, n)) or "tout"))
        if o.associer:
            associer(chemin, poser, journal)
            return 0
        if o.retirer:
            suivis, _ = chantiers_suivis(reglages)
            if not suivis:
                journal("Aucun chantier reconnu : rien à retirer.")
                return 0
            retirer_document(dict(reglages, chantiers=suivis), poser, journal)
            return 0
        tout = not (o.carnet or o.rapatrier)
        defauts = tout_traiter(reglages, prive, poser, journal, carnet=tout or o.carnet, rapatriement=tout or o.rapatrier,
                               oui_rapatrier=o.oui_rapatrier)
        return 1 if defauts else 0
    finally:
        liberer_verrou(verrou, moi)


def main(argv=None, demander=input, lanceur=lancer_commande):
    for flux in (sys.stdout, sys.stderr):
        if hasattr(flux, "reconfigure"):
            flux.reconfigure(encoding="utf-8", errors="replace")
    o = lire_arguments(argv)
    try:
        return lancer(o, demander, lanceur=lanceur)
    except Refus as e:
        print("REFUS : %s" % e, file=sys.stderr)
        return 2
    except KeyboardInterrupt:
        print("ARRÊT demandé. Rien n'est abîmé : relancez le programme, il reprendra où il en est.", file=sys.stderr)
        return 1
    except OSError as e:
        print("ARRÊT : un dossier n'a pas pu être lu ou écrit (%s). Vérifiez que Google Drive pour ordinateur est démarré et que le disque "
              "des chantiers est là, puis relancez : le programme reprendra où il en est." % e, file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
