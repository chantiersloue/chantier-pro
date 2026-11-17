# -*- coding: utf-8 -*-
"""Lot 4c — LE PROGRAMME DU PC : recopie des fiches de l'appli vers les dossiers de chantier du PC, et dépôt AUTOMATIQUE au carnet.

    python outils/appli_pc.py                     tout, maintenant : la recopie des fiches, puis le dépôt au carnet (aucune question)
    python outils/appli_pc.py --auto              la même chose sans rien afficher (c'est ce que lance la tâche planifiée de Windows)
    python outils/appli_pc.py --lister            montre ce qui serait fait, sans rien écrire
    python outils/appli_pc.py --chantier NNN      la même chose pour un seul chantier (un premier essai)
    python outils/appli_pc.py --rapatrier         la recopie des fiches seulement        (--carnet : le carnet seulement)
    python outils/appli_pc.py --a-voir            affiche ce qui demande l'attention (« CHANTIERPRO - A VOIR.txt »)
    python outils/appli_pc.py --associer          relie un dossier de chantier du PC à un dossier du Drive, quand le numéro ne suffit pas
    python outils/appli_pc.py --retirer           retire un document du carnet (aucun fichier n'est supprimé)
    python outils/appli_pc.py --installer-tache   crée la tâche planifiée (toutes les heures, et à l'ouverture de session)
    python outils/appli_pc.py --retirer-tache     supprime la tâche planifiée

Ce qui part au carnet, tout seul, sans question : les PDF du dossier « À METTRE AU CARNET » de chaque dossier de chantier du PC,
et les PDF des bordereaux (« 08 - … / BORDEREAU n ») dont le numéro de document est dans la liste du carnet.

Le programme lit ses réglages dans _prive/depot.json (jamais dans le dépôt public) :
    { "racine": "<racine du Drive de l'appli sur le PC>", "chantiers_pc": "<dossier qui contient les dossiers de chantier, sur le PC>",
      "chantiers": { "<n° du chantier>": { "chantier": "<nom dans l'appli>", "dossier_drive": "<nom du dossier dans le Drive>" } },
      "bordereaux": { "<n° du chantier>": "actuelle"  ou  { "<ancien n° de document>": "<n° actuel>" }  ou  "non" } }
« bordereaux » : le dépôt au carnet depuis les bordereaux d'un chantier n'est actif que si sa numérotation y est déclarée.
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
import hashlib
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
VERROU_VIEUX = 2 * 3600                        # secondes : un verrou de plus de deux heures est repris, quelle que soit la machine
VERROU_BATTEMENT = 600                         # secondes : pendant un long travail, le verrou est rafraîchi toutes les dix minutes
ABSENTE_VISIBLE = 7 * 24 * 3600                # secondes : une fiche déplacée ou supprimée par Franck reste signalée sept jours
A_VOIR_FRAIS = 24 * 3600                       # secondes : « A VOIR » inchangé n'est réécrit qu'une fois par jour
AUTO_EN_RETARD = 3 * 3600                      # secondes : au-delà, le menu prévient que la recopie automatique ne tourne plus
PROVENANCE_PAQUET = 25                         # la liste de provenance est écrite toutes les 25 copies, et à la fin
DATE_TOLERANCE = 2                             # secondes : deux dates de fichier plus proches que cela sont « la même »
PAS_FAIT = "PASSAGE NON FAIT"                  # début des lignes « A VOIR » qui disent qu'un passage n'a pas pu se faire
LISTE_MAX = 15                                 # lignes montrées à l'écran pour une liste ; le reste va au journal
# Raccourcis de Google Drive pour ordinateur : de tout petits fichiers qui ne contiennent pas le document.
RACCOURCIS = {".gdoc", ".gsheet", ".gslides", ".gform", ".gdraw", ".gmap", ".gsite", ".gjam", ".gtable", ".gscript",
              ".glink", ".gnote", ".gshortcut", ".gmaillayout", ".gvid", ".gcolab", ".gapp"}
FICHIERS_IGNORES = {"desktop.ini", "thumbs.db", ".megaignore", ".ds_store"}

NUMERO_DOSSIER = re.compile(r"^\s*(\d+)(?=[ \-]|$)")      # « 403 - x », « 403-x », « 403 x » : des chiffres, puis un espace ou un tiret
DOSSIER_BORDEREAU = re.compile(r"^BORDEREAU\s*(\d+)\s*$", re.IGNORECASE)
# <n° chantier>-<lot>-<n° document>-<indice>-<INTITULÉ>.pdf ; le lot peut contenir des espaces et des mots (« 09 ET 10 »)
# L'indice : une ou deux lettres ou chiffres (A, B, AA, 02). Tout autre nom est montré « nom non reconnu », jamais deviné.
NOM_DE_BORDEREAU = re.compile(r"^(\d+)-(.+?)-(\d{3}[A-Za-z]?)-([A-Za-z0-9]{1,2})-(.+)\.pdf$", re.IGNORECASE)

DEPOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REGLAGES_DEFAUT = os.path.join(DEPOT, "_prive", "depot.json")
MEMOIRE_FICHIER = "carnet-memoire.json"        # dans _prive/ : ce qui a déjà été signalé (pour ne pas le répéter), ce qui vient d'être déposé
A_METTRE = "À METTRE AU CARNET"                # dossier que Franck crée dans un dossier de chantier : ses PDF partent au carnet
PDF_MAX = 200 * 1024 * 1024                    # octets : au-delà, un PDF n'est pas déposé tout seul
REPOS = 120                                    # secondes : un PDF n'est déposé que s'il n'a pas bougé depuis deux minutes (fini d'écrire)
LIMITE_PASSAGE = 40 * 60                       # secondes : au-delà, le passage ne commence plus de dépôt (la tâche est arrêtée à 1 heure)
ECHECS_MAX = 3                                 # après trois dépôts manqués, un PDF n'est plus retenté tant qu'il ne change pas
OCTETS_PAR_POINT = 0.14                        # estimation du poids des images du carnet, par point d'image (plans au trait)
DEPOT_VISIBLE = 7 * 24 * 3600                  # secondes : un dépôt, ou un signalement du carnet, reste sept jours dans « A VOIR »
# Dans « À METTRE AU CARNET », la forme courte : <n° document>-<indice>-<INTITULÉ>.pdf (le chantier est celui du dossier)
NOM_COURT = re.compile(r"^(\d{3}[A-Za-z]?)-([A-Za-z0-9]{1,2})-(.+)\.pdf$", re.IGNORECASE)
VERROU_FICHIER = "appli-pc.verrou"
JOURNAL_DOSSIER = "appli-pc"
JOURNAL_AUTO, JOURNAL_AUTO_ANCIEN = "auto.txt", "auto-ancien.txt"     # le journal des passages automatiques, et son prédécesseur
JOURNAL_AUTO_MAX = 300000                      # octets : au-delà, le journal est mis de côté et un nouveau commence
RELEVE_FRAIS = 24 * 3600                       # secondes : en passage automatique, un relevé inchangé n'est refait qu'une fois par jour
DERNIER_PASSAGE = "dernier-passage.json"       # dans _prive/appli-pc/ : l'heure du dernier passage automatique mené à son terme
TACHE = "ChantierPro - recopie des fiches"     # la tâche planifiée de Windows (toutes les heures, et à l'ouverture de session)
TACHE_ANCIENNE = TACHE + " (ouverture de session)"     # un ancien nom, retiré s'il existe
_LISTES = None                                 # pendant un parcours : la liste déjà lue de chaque dossier (jamais relue par fichier)
_VERROU = None                                 # le verrou que ce programme tient, s'il en tient un


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
    if _LISTES is not None:
        connus = _LISTES.get(dossier)
        if connus is None:
            try:
                connus = {cle(present): present for present in os.listdir(dossier)}
            except OSError:
                connus = {}
            _LISTES[dossier] = connus
        return connus.get(voulu)
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
        raise Refus("Le fichier de réglages « _prive/depot.json » n'existe pas. Crée-le en suivant docs/lot4c-procedure.md (étape 1).")
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
                    "Vérifie le chemin, et que ce disque est bien là.")
    if not isinstance(racine, str) or not racine.strip() or not os.path.isdir(racine):
        raise Refus("La racine du Drive de l'appli (clé « racine » de _prive/depot.json) est introuvable. "
                    "Vérifie le chemin, et que Google Drive pour ordinateur est démarré.")
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
    declares = reglages.get("bordereaux", {})
    bon = isinstance(declares, dict) and all(
        v in ("actuelle", "non") or (isinstance(v, dict) and all(isinstance(x, str) for x in v.values())) for v in declares.values())
    if not bon:
        raise Refus("Dans _prive/depot.json, « bordereaux » est mal écrit : pour chaque numéro de chantier, « actuelle », « non », "
                    "ou une table « ancien numéro » : « numéro actuel » (voir docs/lot4c-procedure.md).")
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


def dossier_technique(nom, planning=None):
    """Vrai pour un dossier de la racine du Drive qui n'est pas un chantier (comme estDossierTechnique_ du serveur)."""
    minuscule = cle(nom).strip()
    return (minuscule.startswith("_") or minuscule in DOSSIERS_TECHNIQUES or minuscule.startswith("planning")
            or bool(planning and minuscule == cle(planning).strip()))


def refus_dossier_drive(racine, nom, chantiers, numero, planning=None):
    """Pourquoi ce dossier du Drive ne peut pas être celui du chantier « numero » ; None s'il convient."""
    nom = str(nom or "").strip()
    if not dc.nom_simple(nom):
        return "« %s » n'est pas un simple nom de dossier." % nom
    reel = trouver(racine, nom)
    if reel is None or not os.path.isdir(os.path.join(racine, reel)):
        return "« %s » n'est pas un dossier de la racine du Drive de l'appli." % nom
    if dossier_technique(reel, planning):
        return "« %s » est un dossier technique de l'appli (ou le planning), pas un chantier." % reel
    if dc.est_doublon(racine, reel):
        return ("« %s » est un dossier en double fabriqué par Google Drive. Range d'abord ce doublon dans Drive, "
                "puis recommence." % reel)
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
            dire("N° %s : plusieurs dossiers de chantier du PC portent ce numéro (%s). Impossible de choisir : corrige d'abord leurs noms."
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


# ── Le carnet : ce qui part tout seul (« À METTRE AU CARNET » et les bordereaux) ──
def lire_memoire(chemin):
    """La mémoire du dépôt automatique (_prive/carnet-memoire.json) :
    "signales" : ce qui a déjà été dit à Franck (fichier, taille, date), pour ne pas le répéter tant que le fichier ne change pas ;
    "deposes"  : ce qui vient d'être déposé au carnet (gardé sept jours, pour la section « Déposé au carnet » de « A VOIR »)."""
    vide = {"version": 1, "signales": [], "deposes": []}
    if not os.path.isfile(chemin):
        return vide
    try:
        lu = dc.lire_json(chemin)
        if not isinstance(lu, dict) or not isinstance(lu.get("signales"), list) or not isinstance(lu.get("deposes"), list):
            raise ValueError("forme inattendue")
    except (OSError, ValueError) as e:
        raise Refus("Le fichier « _prive/%s » est illisible (%s). Rien n'est fait : montre ce message." % (MEMOIRE_FICHIER, e))
    lu["signales"] = [x for x in lu["signales"] if isinstance(x, dict)]
    lu["deposes"] = [x for x in lu["deposes"] if isinstance(x, dict)]
    return lu


def nombre_de_pages(chemin):
    pypdfium2, _ = dc.charger_modules()
    document = pypdfium2.PdfDocument(chemin)
    try:
        return len(document)
    finally:
        document.close()


def numerotation(reglages, numero):
    """Ce que Franck a déclaré pour les bordereaux de ce chantier, dans _prive/depot.json (clé « bordereaux ») :
    "actuelle" (les numéros sont ceux d'aujourd'hui), une table {ancien numéro: numéro actuel} (SEULS ses numéros sont déposés),
    "non" (rien n'est déposé depuis ses bordereaux), ou None : pas déclaré — rien n'est déposé, et c'est signalé."""
    declares = reglages.get("bordereaux")
    valeur = declares.get(str(numero)) if isinstance(declares, dict) else None
    if isinstance(valeur, dict):
        return {str(k).strip().upper(): str(v).strip().upper() for k, v in valeur.items()}
    return valeur if valeur in ("actuelle", "non") else None


def entete_pdf(chemin):
    """Vrai si le fichier commence comme un PDF (« %PDF- » dans ses premiers octets)."""
    with open(chemin, "rb") as f:
        return b"%PDF-" in f.read(1024)


def pdf_des_bordereaux(base):
    """Les PDF des bordereaux d'un dossier de chantier : [(nom du bordereau, dossier, fichier)], le bordereau lui-même excepté."""
    trouves = []
    for d08 in sorted(n for n in os.listdir(base) if nfc(n).strip().startswith("08") and os.path.isdir(os.path.join(base, n))):
        bordereaux = [n for n in os.listdir(os.path.join(base, d08))
                      if DOSSIER_BORDEREAU.match(nfc(n).strip()) and os.path.isdir(os.path.join(base, d08, n))]
        for bordereau in sorted(bordereaux, key=lambda n: int(DOSSIER_BORDEREAU.match(nfc(n).strip()).group(1))):
            dossier = os.path.join(base, d08, bordereau)
            trouves += [(bordereau, dossier, f) for f in sorted(os.listdir(dossier))
                        if f.lower().endswith(".pdf") and os.path.isfile(os.path.join(dossier, f)) and not cle(f).startswith("bordereau")]
    return trouves


def documents_a_deposer(reglages, horloge=time.time, compter_pages=nombre_de_pages):
    """Parcourt, pour chaque chantier suivi, le dossier « À METTRE AU CARNET » et les bordereaux. N'écrit rien, ne demande rien.
    Rend {"candidats": [...] (ce qui peut partir au carnet),
          "signales": [{"numero", "motif", "texte", "chemin", "taille", "date", "durable"}] (ce qui ne peut pas être déposé ;
                       « durable » : dit tant que la cause est là — « À METTRE AU CARNET » et chantier entier),
          "jeunes": [fichiers qui ont bougé il y a moins de deux minutes],
          "silencieux": [textes : PDF des bordereaux qui ne vont pas au carnet — montrés seulement par « Voir seulement »],
          "deja": n, "sans_module": bool}."""
    racine, chantiers_pc, chantiers = reglages["racine"], dossier_des_chantiers(reglages), reglages["chantiers"]
    vus = dossiers_pc(chantiers_pc)
    rendu = {"candidats": [], "signales": [], "jeunes": [], "silencieux": [], "deja": 0, "sans_module": False}

    def signaler(numero, motif, texte, d=None, durable=True):
        rendu["signales"].append({"numero": numero, "motif": motif, "texte": texte, "chemin": d["relatif"] if d else "chantier %s" % numero,
                                  "taille": d["poids"] if d else 0, "date": int(d["instant"]) if d else 0, "durable": durable})

    for numero in tri_numeros(chantiers):
        fiche = chantiers[numero]
        nom_pc, pourquoi = dossier_pc_du(chantiers_pc, numero, vus)
        if nom_pc is None:
            signaler(numero, "chantier", "Chantier n° %s : rien n'est déposé au carnet (%s)." % (numero, pourquoi))
            continue
        motif = refus_dossier_drive(racine, fiche["dossier_drive"], chantiers, numero, reglages.get("planning"))
        if motif:
            signaler(numero, "chantier", "Chantier n° %s : rien n'est déposé au carnet. %s Corrige _prive/depot.json." % (numero, motif))
            continue
        try:
            carnet = dc.dossier_carnet(racine, fiche["dossier_drive"])
            liste = dc.lire_carnet(carnet)
        except (Refus, OSError) as e:
            signaler(numero, "chantier", "Chantier n° %s : rien n'est déposé au carnet. %s" % (numero, e))
            continue
        documents = [d for d in (liste or {}).get("documents", []) if isinstance(d, dict) and isinstance(d.get("id"), str)]
        au_carnet = {d["id"]: d for d in documents if d.get("retire") is not True}
        retires = {d["id"]: d for d in documents if d.get("retire") is True and d["id"] not in au_carnet}
        base = os.path.join(chantiers_pc, nom_pc)
        declare = numerotation(reglages, numero)

        # 1. Tous les PDF des deux sources
        trouves = []                       # (origine, dossier, fichier, depuis « À METTRE AU CARNET » ?)
        a_mettre = trouver(base, A_METTRE)
        if a_mettre and os.path.isdir(os.path.join(base, a_mettre)):
            trouves += [(a_mettre, os.path.join(base, a_mettre), f, True) for f in sorted(os.listdir(os.path.join(base, a_mettre)))
                        if f.lower().endswith(".pdf") and os.path.isfile(os.path.join(base, a_mettre, f))]
        des_bordereaux = pdf_des_bordereaux(base)
        if declare is None:
            # Numérotation des bordereaux pas déclarée : un ancien numéro pourrait être pris pour un numéro d'aujourd'hui (et publier
            # un mauvais document aux poseurs). RIEN n'est déposé depuis les bordereaux de ce chantier ; une seule ligne le dit.
            if des_bordereaux:
                signaler(numero, "a-declarer", "Chantier n° %s : %d document(s) de bordereau en attente — numérotation à déclarer "
                         "(appli-pc, choix 6). Rien n'est déposé au carnet depuis ses bordereaux d'ici là." % (numero, len(des_bordereaux)))
        elif declare != "non":
            trouves += [(origine, dossier, f, False) for origine, dossier, f in des_bordereaux]

        # 2. Chaque PDF : son nom, son numéro, son état
        par_document = {}
        for origine, dossier, fichier, voulu in trouves:
            chemin = os.path.join(dossier, fichier)
            ou = "« %s », « %s »" % (origine, fichier)
            try:
                etat = os.stat(chemin)
            except OSError as e:
                signaler(numero, "illisible", "Chantier n° %s, %s : fichier illisible (%s)." % (numero, ou, e), durable=voulu)
                continue
            d = {"chantier": fiche["chantier"], "nom_appli": fiche.get("nom_appli", fiche.get("chantier")), "numero": numero,
                 "origine": origine, "bordereau": origine, "voulu": voulu, "fichier": fichier, "chemin": chemin,
                 "relatif": "/".join(nfc(m) for m in os.path.relpath(chemin, chantiers_pc).split(os.sep)),
                 "pages": None, "poids": etat.st_size, "instant": etat.st_mtime, "date": date_fr(etat.st_mtime),
                 "dossier_drive": fiche["dossier_drive"], "dossier_carnet": os.path.basename(carnet)}
            complet, court = NOM_DE_BORDEREAU.match(nfc(fichier)), NOM_COURT.match(nfc(fichier))
            if voulu:
                # « À METTRE AU CARNET » : numérotation ACTUELLE seulement. Deux lectures possibles du nom ; on ne garde que celles
                # qui tiennent debout. Deux lectures valables qui ne disent pas la même chose : rien n'est deviné.
                lectures = []
                if complet and complet.group(1) == numero and complet.group(3).upper() in dc.DPI_PAR_CODE:
                    lectures.append((complet.group(3).upper(), complet.group(4).upper(), complet.group(5)))
                if court and court.group(1).upper() in dc.DPI_PAR_CODE:
                    lectures.append((court.group(1).upper(), court.group(2).upper(), court.group(3)))
                if len({(code, indice) for code, indice, _ in lectures}) > 1:
                    signaler(numero, "ambigu", "Chantier n° %s, %s : ce nom peut se lire de deux façons (document %s). Rien n'est déposé : "
                             "renomme-le sous la forme courte « <n° document>-<indice>-<INTITULÉ>.pdf »."
                             % (numero, ou, " ou ".join("%s-%s" % (code, indice) for code, indice, _ in lectures)), d)
                    continue
                if not lectures:
                    if complet and complet.group(1) != numero:
                        signaler(numero, "autre-chantier", "Chantier n° %s, %s : ce fichier porte le n° de chantier %s, pas %s. Pas déposé."
                                 % (numero, ou, complet.group(1), numero), d)
                    elif complet or court:
                        lu = complet.group(3) if complet and complet.group(1) == numero else court.group(1) if court else complet.group(3)
                        signaler(numero, "hors-liste", "Chantier n° %s, %s : le numéro de document « %s » n'est pas un document du carnet "
                                 "(dans « %s », la numérotation est celle d'aujourd'hui). Pas déposé." % (numero, ou, lu.upper(), A_METTRE), d)
                    else:
                        signaler(numero, "nom", "Chantier n° %s, %s : nom non reconnu, pas déposé. Formes acceptées : "
                                 "« <n° document>-<indice>-<INTITULÉ>.pdf » ou « %s-<lot>-<n° document>-<indice>-<INTITULÉ>.pdf »." % (numero, ou, numero), d)
                    continue
                code, indice, intitule = lectures[0]
                ancien = code
            else:
                if not complet:
                    rendu["silencieux"].append("Chantier n° %s, %s : nom hors nomenclature." % (numero, ou))
                    continue
                n_chantier, _, ancien, indice, intitule = complet.groups()
                if n_chantier != numero:
                    signaler(numero, "autre-chantier", "Chantier n° %s, %s : ce fichier porte le n° de chantier %s, pas %s. Pas déposé."
                             % (numero, ou, n_chantier, numero), d, durable=False)
                    continue
                ancien, indice = ancien.upper(), indice.upper()
                # Table propre au chantier : SEULS ses numéros partent, convertis. Un numéro absent de la table n'est jamais déposé,
                # même s'il existe dans la liste du carnet.
                code = ancien if declare == "actuelle" else declare.get(ancien)
                if code not in dc.DPI_PAR_CODE:
                    rendu["silencieux"].append("Chantier n° %s, %s : numéro de document « %s »%s." % (
                        numero, ou, ancien, " — pas un document du carnet" if declare == "actuelle" else " — absent de la table de ce chantier"
                        if code is None else " → « %s », pas un document du carnet" % code))
                    continue
            propre = dc.nettoyer_intitule(intitule)
            if not propre:
                signaler(numero, "nom", "Chantier n° %s, %s : intitulé vide, pas déposé." % (numero, ou), d, durable=voulu)
                continue
            d.update(code=code, indice=indice, intitule=propre, id="%s-%s" % (code, indice), ancien_code=ancien if ancien != code else None)
            for quoi, connu in (("déposé", au_carnet.get(d["id"])), ("retiré", retires.get(d["id"]))):
                if connu is None:
                    continue
                source = connu.get("source")
                if isinstance(source, dict) and source.get("poids") != etat.st_size:
                    signaler(numero, "change", "Chantier n° %s, %s : le document %s est déjà au carnet sous cet indice, avec un AUTRE contenu%s. "
                             "Rien n'est jamais écrasé au carnet : prends l'indice suivant."
                             % (numero, ou, d["id"], " (il en a été retiré)" if quoi == "retiré" else ""), d, durable=voulu)
                else:
                    rendu["deja"] += 1
                break
            else:
                if horloge() - max(etat.st_mtime, getattr(etat, "st_birthtime", etat.st_ctime)) < REPOS:
                    rendu["jeunes"].append(d)              # encore en cours d'écriture ou de synchronisation, peut-être
                    continue
                if etat.st_size > PDF_MAX:
                    signaler(numero, "trop-gros", "Chantier n° %s, %s : %s, c'est plus que %s. Pas déposé tout seul : utilise outils\\deposer.bat."
                             % (numero, ou, mo(etat.st_size), mo(PDF_MAX)), d, durable=voulu)
                    continue
                try:
                    bon = entete_pdf(chemin)
                except OSError as e:
                    bon = False
                    ou += " (%s)" % e
                if not bon:
                    signaler(numero, "illisible", "Chantier n° %s, %s : ce n'est pas un PDF lisible. Pas déposé." % (numero, ou), d, durable=voulu)
                    continue
                par_document.setdefault(d["id"], []).append(d)

        # 3. Un seul fichier par document : jamais deux contenus différents pour le même indice
        for ident in sorted(par_document):
            groupe = par_document[ident]
            voulus = [d for d in groupe if d["voulu"]]
            envoyes = sorted((d for d in groupe if not d["voulu"]), key=lambda d: d["instant"])[-1:]      # le bordereau le plus récent
            choisis = voulus + envoyes
            try:
                contenus = {(d["poids"], empreinte(d["chemin"])) for d in choisis} if len(choisis) > 1 else {0}
            except OSError:
                contenus = {0, 1}
            if len(contenus) > 1:
                for d in choisis:
                    signaler(numero, "conflit", "Chantier n° %s : le document %s existe en plusieurs exemplaires de contenus DIFFÉRENTS (%s). "
                             "Rien n'est déposé : garde le bon, ou donne l'indice suivant au plus récent."
                             % (numero, ident, " ; ".join("« %s », « %s »" % (x["origine"], x["fichier"]) for x in choisis)), d)
                continue
            candidat = choisis[0]
            if rendu["sans_module"]:
                continue
            try:
                candidat["pages"] = compter_pages(candidat["chemin"])
            except Refus:
                rendu["sans_module"] = True            # pypdfium2 ou Pillow absent : aucun dépôt possible ; le reste du passage continue
                continue
            except Exception as e:
                signaler(numero, "illisible", "Chantier n° %s, « %s », « %s » : PDF illisible (%s). Pas déposé."
                         % (numero, candidat["origine"], candidat["fichier"], e), candidat, durable=candidat["voulu"])
                continue
            rendu["candidats"].append(candidat)
    return rendu


def decrire_candidat(c, rang=None, total=None):
    """Les lignes qui décrivent un document qui part au carnet."""
    tete = "Document %d/%d — " % (rang, total) if rang else ""
    lignes = ["%schantier n° %s « %s »" % (tete, c["numero"], c["chantier"]),
              "  Vient de  : « %s »" % c["origine"],
              "  Fichier   : %s" % c["fichier"],
              "  %d page(s), %s, fichier du %s" % (c["pages"], mo(c["poids"]), c["date"])]
    if c.get("ancien_code"):
        lignes.append("  Ancien numéro %s : déposé sous le numéro actuel %s (table de ce chantier)." % (c["ancien_code"], c["code"]))
    lignes.append("  Ira dans le Drive de l'appli : « %s », dossier « %s », sous le nom « %s %s %s »."
                  % (c["dossier_drive"], c["dossier_carnet"], c["code"], c["indice"], c["intitule"]))
    return lignes


def ligne_depot(d):
    return "%s — chantier n° %s : %s %s %s, %d page(s), depuis « %s » (fichier « %s »)" % (
        d.get("le", "?"), d.get("numero", "?"), d.get("code", "?"), d.get("indice", "?"), d.get("intitule", ""), d.get("pages", 0),
        d.get("origine", "?"), d.get("fichier", "?"))


def poids_estime(chemin, code):
    """Une estimation du poids des images du carnet pour ce PDF (d'après la surface de ses pages) ; None si on ne sait pas."""
    try:
        pypdfium2, _ = dc.charger_modules()
        document = pypdfium2.PdfDocument(chemin)
        try:
            echelle = dc.DPI_PAR_CODE[code] / 72.0
            return int(sum(document[n].get_size()[0] * document[n].get_size()[1] for n in range(len(document))) * echelle * echelle * OCTETS_PAR_POINT)
        finally:
            document.close()
    except Exception:
        return None


def deposer_tout(reglages, prive, dire=print, horloge=time.time, attente=time.sleep, fin=None, memoriser=True,
                 deposer=None, verifier=None, compter_pages=nombre_de_pages):
    """Le dépôt automatique au carnet, pour les chantiers de « reglages » : aucune question.
    « fin » : l'heure (horloge) après laquelle on ne commence plus de dépôt ; un dépôt en cours s'arrête proprement entre deux
    pages et reprendra au passage suivant. « memoriser » faux (essai sur un seul chantier) : les signalements ne sont pas retenus.
    Une erreur sur un document n'arrête jamais les autres ; la mémoire est écrite quoi qu'il arrive.
    Rend {"deposes", "a_voir" (lignes), "recents" (dépôts des sept derniers jours), "erreurs", "reste", "signales", "sans_module"}."""
    deposer, verifier = deposer or dc.deposer, verifier or dc.verifier
    chemin_memoire = os.path.join(prive, MEMOIRE_FICHIER)
    memoire = lire_memoire(chemin_memoire)
    memoire.setdefault("echecs", [])
    avant = json.dumps(memoire, sort_keys=True)
    vu = documents_a_deposer(reglages, horloge, compter_pages)
    if vu["jeunes"]:
        # Des PDF viennent d'arriver : on leur laisse deux minutes pour finir de s'écrire, puis on regarde de nouveau
        plus_recent = max(max(d["instant"], os.stat(d["chemin"]).st_ctime) for d in vu["jeunes"])
        attente(max(1, min(REPOS + 5, plus_recent + REPOS + 2 - horloge())))
        vu = documents_a_deposer(reglages, horloge, compter_pages)
        for d in vu["jeunes"]:
            vu["signales"].append({"numero": d["numero"], "motif": "en-cours", "chemin": d["relatif"], "taille": d["poids"], "date": int(d["instant"]),
                                   "durable": True,
                                   "texte": "Chantier n° %s, « %s », « %s » : fichier encore en cours d'écriture ou de synchronisation. "
                                            "Il sera déposé au prochain passage." % (d["numero"], d["origine"], d["fichier"])})
    bilan = {"deposes": [], "a_voir": [], "recents": [], "erreurs": 0, "reste": 0, "signales": len(vu["signales"]),
             "sans_module": vu["sans_module"], "candidats": len(vu["candidats"])}
    if vu["sans_module"]:
        bilan["a_voir"].append("Le dépôt au carnet ne peut pas se faire sur ce PC : un module de Python manque. À lancer une fois dans une "
                               "fenêtre de commande :  %s  (la recopie des fiches, elle, continue)." % dc.INSTALLER)

    def echecs_de(c):
        return [e for e in memoire["echecs"] if isinstance(e, dict) and cle(e.get("chemin", "")) == cle(c["relatif"])]

    touches = set()
    try:
        for rang, c in enumerate(vu["candidats"]):
            if fin is not None and horloge() >= fin:
                bilan["reste"] = len(vu["candidats"]) - rang
                break
            qui = "Chantier n° %s, « %s », « %s »" % (c["numero"], c["origine"], c["fichier"])
            connus = [e for e in echecs_de(c) if e.get("taille") == c["poids"] and e.get("date") == int(c["instant"])]
            if connus and connus[0].get("n", 0) >= ECHECS_MAX:
                # Déjà trois dépôts manqués pour ce fichier-là : on ne recommence pas toutes les heures ; on attend qu'il change
                bilan["a_voir"].append("%s : le dépôt au carnet a échoué %d fois (%s). Il ne sera plus retenté tant que ce fichier ne change "
                                       "pas : refais le PDF, ou montre cette ligne." % (qui, connus[0]["n"], connus[0].get("pourquoi", "?")))
                continue
            dire("")
            for ligne in decrire_candidat(c, rang + 1, len(vu["candidats"])):
                dire(ligne)
            touches.add(c["numero"])
            try:
                r = deposer(reglages["racine"], c["dossier_drive"], c["nom_appli"] or None, c["chemin"], c["code"], c["indice"], c["intitule"],
                            limite=float("inf") if fin is None else max(1.0, fin - horloge()), horloge=horloge,
                            dire=lambda ligne: (dire("    " + ligne), battre()))
            except Exception as e:              # quelle que soit l'erreur : ce document est signalé, et on passe au suivant
                pourquoi = str(e) if isinstance(e, (Refus, OSError)) else "%s : %s" % (type(e).__name__, e)
                n = (connus[0].get("n", 0) if connus else 0) + 1
                memoire["echecs"] = [x for x in memoire["echecs"] if x not in echecs_de(c)]
                memoire["echecs"].append({"chemin": c["relatif"], "taille": c["poids"], "date": int(c["instant"]), "n": n, "pourquoi": pourquoi[:300]})
                if not isinstance(e, Refus):
                    bilan["erreurs"] += 1
                bilan["a_voir"].append("%s : pas déposé (%s). %s" % (qui, pourquoi, "Le prochain passage réessaiera." if n < ECHECS_MAX else
                                       "Troisième échec : il ne sera plus retenté tant que ce fichier ne change pas."))
                dire("  PAS DÉPOSÉ : %s" % pourquoi)
                continue
            if not r["termine"]:
                touches.discard(c["numero"])       # son carnet est en cours : il sera contrôlé quand le dépôt sera fini
                bilan["reste"] = len(vu["candidats"]) - rang
                dire("  Pas fini (%d page(s) sur %d) : la suite au prochain passage, là où il en est." % (r["faites"], r["pages"]))
                break
            memoire["echecs"] = [x for x in memoire["echecs"] if x not in echecs_de(c)]
            fait = {"instant": horloge(), "le": datetime.datetime.fromtimestamp(horloge()).strftime("%d/%m/%Y %H:%M"), "numero": c["numero"],
                    "chantier": c["chantier"], "code": c["code"], "indice": c["indice"], "intitule": c["intitule"], "pages": r["pages"],
                    "origine": c["origine"], "fichier": c["fichier"]}
            memoire["deposes"].append(fait)
            bilan["deposes"].append(fait)
            dire("  DÉPOSÉ AU CARNET : %s, %d page(s), %s d'images." % (r["id"], r["pages"], mo(r["poids"])))
        for numero in sorted(touches):
            try:
                defauts = verifier(reglages["racine"], reglages["chantiers"][numero]["dossier_drive"])["problemes"]
            except Exception as e:
                defauts = [str(e)]
            for x in defauts:
                bilan["erreurs"] += 1
                bilan["a_voir"].append("Carnet du chantier n° %s, défaut trouvé au contrôle : %s" % (numero, x))
                dire("  ! carnet du chantier n° %s : %s" % (numero, x))
    finally:
        # Ce qui n'a pas pu être déposé. « Durable » (« À METTRE AU CARNET », chantier entier) : dit tant que la cause est là.
        # Le reste (bordereaux) : dit une fois — la ligne reste sept jours — puis plus répété tant que le fichier ne change pas.
        maintenant = horloge()
        for x in vu["signales"]:
            if x.get("durable"):
                bilan["a_voir"].append(x["texte"])
                continue
            note = [m for m in memoire["signales"] if cle(m.get("chemin", "")) == cle(x["chemin"]) and m.get("motif") == x["motif"]]
            meme = [m for m in note if m.get("taille") == x["taille"] and m.get("date") == x["date"]]
            if meme:
                if maintenant - float(meme[0].get("vu", 0)) < DEPOT_VISIBLE:
                    bilan["a_voir"].append(x["texte"])
                continue
            bilan["a_voir"].append(x["texte"])
            if memoriser:
                memoire["signales"] = [m for m in memoire["signales"] if m not in note]
                memoire["signales"].append({"chemin": x["chemin"], "motif": x["motif"], "taille": x["taille"], "date": x["date"], "vu": maintenant})
        memoire["deposes"] = [d for d in memoire["deposes"] if maintenant - float(d.get("instant", 0)) < DEPOT_VISIBLE]
        memoire["signales"] = [m for m in memoire["signales"] if maintenant - float(m.get("vu", 0)) < 400 * 24 * 3600]
        bilan["recents"] = [ligne_depot(d) for d in memoire["deposes"]]
        if json.dumps(memoire, sort_keys=True) != avant:
            os.makedirs(prive, exist_ok=True)
            ecrire_json(chemin_memoire, memoire)
    return bilan


def declarer(chemin_reglages, numero, demander=input, dire=print):
    """Déclare la numérotation des bordereaux d'un chantier (clé « bordereaux » de _prive/depot.json) : montre ses PDF de
    bordereau, demande si la numérotation est celle d'aujourd'hui, sinon la table ancien numéro → numéro actuel, numéro par numéro.
    Tant qu'un chantier n'est pas déclaré, rien n'est déposé au carnet depuis ses bordereaux. Rend ce qui a été noté, ou None."""
    reglages = lire_reglages(chemin_reglages)
    _, chantiers_pc, _ = controler_reglages(reglages)
    numero = str(numero or "").strip()
    nom_pc, pourquoi = dossier_pc_du(chantiers_pc, numero)
    if nom_pc is None:
        raise Refus("Chantier n° %s : %s." % (numero, pourquoi))
    par_numero, autres = {}, []
    for bordereau, _, fichier in pdf_des_bordereaux(os.path.join(chantiers_pc, nom_pc)):
        lu = NOM_DE_BORDEREAU.match(nfc(fichier))
        if lu and lu.group(1) == numero:
            par_numero.setdefault(lu.group(3).upper(), []).append("%s — %s (indice %s)" % (bordereau, lu.group(5), lu.group(4).upper()))
        else:
            autres.append("%s — %s" % (bordereau, fichier))
    dire("Chantier n° %s « %s » : les PDF de ses bordereaux, par numéro de document." % (numero, nom_pc))
    for code in sorted(par_numero):
        dire("  n° %s%s" % (code, "   (aujourd'hui, %s est un document du carnet)" % code if code in dc.DPI_PAR_CODE else ""))
        for ligne in par_numero[code]:
            dire("        " + ligne)
    for ligne in autres:
        dire("  (nom hors nomenclature, jamais déposé) " + ligne)
    if not par_numero:
        dire("  Aucun PDF de bordereau au nom reconnu pour l'instant.")
    deja = numerotation(reglages, numero)
    if deja is not None:
        dire("Déjà déclaré : %s. Ta réponse le remplacera." % (deja if isinstance(deja, str) else "une table (%s)" % ", ".join(
            "%s → %s" % paire for paire in sorted(deja.items()))))
    dire("")
    dire("Les numéros de documents du carnet aujourd'hui : %s." % ", ".join(sorted(dc.DPI_PAR_CODE)))
    r = reponse(demander, "Ces bordereaux sont-ils numérotés comme AUJOURD'HUI (001 = PPSPS, 105 = réservations…) ? "
                          "o = oui / n = non, ancienne numérotation / r = ne rien déposer depuis ces bordereaux / Entrée = abandonner : ")
    r = (r or "").lower()
    if r in ("o", "oui"):
        note = "actuelle"
    elif r == "r":
        note = "non"
    elif r in ("n", "non"):
        note = {}
        dire("Pour chaque ancien numéro, tape le numéro ACTUEL du document s'il doit aller au carnet ; Entrée seule = ne jamais le déposer.")
        for code in sorted(par_numero):
            for _ in range(3):
                v = reponse(demander, "  ancien n° %s (%s) → n° actuel : " % (code, par_numero[code][0]))
                v = (v or "").strip().upper()
                if not v or v in dc.DPI_PAR_CODE:
                    break
                dire("    « %s » n'est pas un numéro du carnet. Numéros possibles : %s. Ou Entrée seule." % (v, ", ".join(sorted(dc.DPI_PAR_CODE))))
            else:
                v = ""
            if v:
                note[code] = v
        dire("Table de ce chantier : %s. Les autres numéros ne seront jamais déposés."
             % (", ".join("%s → %s" % paire for paire in sorted(note.items())) or "vide (rien ne sera déposé depuis ses bordereaux)"))
    else:
        dire("Abandon : rien n'est modifié.")
        return None
    if not isinstance(reglages.get("bordereaux"), dict):
        reglages["bordereaux"] = {}
    reglages["bordereaux"][numero] = note
    ecrire_json(chemin_reglages, reglages)          # les autres clés du fichier sont gardées telles quelles
    dire("Noté dans _prive/depot.json. Regarde ce qui partirait avec « Voir seulement » (choix 2) avant le prochain passage.")
    return note


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
    """Lit dossiers.json. Rend {"fiches": [chemins à recopier], "exclus": [carnet, plans]} ; un chemin = une liste de noms."""
    try:
        lu = dc.lire_json(os.path.join(racine, dc.DOSSIERS_FICHIER))
    except (OSError, ValueError) as e:
        raise Refus("Le fichier « %s » de la racine du Drive est illisible (%s) : rien n'est recopié." % (dc.DOSSIERS_FICHIER, e))
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
            raise Refus("Dans « %s », le dossier « %s » (« %s ») n'est pas utilisable : rien n'est recopié."
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


def doublon_de_drive(dossier, nom):
    """Vrai si « nom » finit par « (n) » ET que le même nom sans « (n) » existe à côté : une copie fabriquée par Drive.
    « IMG (12).jpg » tout seul est un vrai fichier, pas un doublon."""
    trouve = dc.DOUBLON.search(nom)
    return bool(trouve) and trouver(dossier, nom[:trouve.start()] + (trouve.group(1) or "")) is not None


def signalement_recent(entree, instant):
    """Vrai si l'absence de cette fiche a déjà été signalée il y a plus de sept jours : on n'en parle plus."""
    try:
        age = datetime.datetime.fromisoformat(instant) - datetime.datetime.fromisoformat(entree["absente_signalee_le"])
        return age.total_seconds() < ABSENTE_VISIBLE
    except (KeyError, ValueError, TypeError):
        return True


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
                    "attends que MEGA ait fini de synchroniser, ou montre ce message." % (PROVENANCE, e))
    return liste


def meme_date(a, b):
    try:
        return abs(float(a) - float(b)) <= DATE_TOLERANCE
    except (TypeError, ValueError):
        return False


def plan_rapatriement(reglages, numero, sous=None, maintenant=None):
    """Ce que la recopie des fiches du chantier ferait. N'écrit rien.
    Rend {"numero", "chantier", "dossier_drive", "drive", "dossier_pc", "pc", "a_copier", "deja", "absentes", "signales", "provenance"}."""
    global _LISTES
    racine, chantiers_pc, chantiers = reglages["racine"], dossier_des_chantiers(reglages), reglages["chantiers"]
    fiche = chantiers[numero]
    sous = sous or sous_dossiers(racine)
    motif = refus_dossier_drive(racine, fiche["dossier_drive"], chantiers, numero, reglages.get("planning"))
    if motif:
        raise Refus(motif + " Corrige _prive/depot.json.")
    nom_pc, pourquoi = dossier_pc_du(chantiers_pc, numero)
    if nom_pc is None:
        raise Refus(pourquoi + ".")
    drive = os.path.join(racine, trouver(racine, fiche["dossier_drive"]))
    base_pc = os.path.join(chantiers_pc, nom_pc)
    provenance = lire_provenance(os.path.join(base_pc, PROVENANCE), fiche["chantier"], numero)      # refus AVANT toute copie
    inscrits = {cle(e["chemin"]): e for e in provenance["fichiers"] if isinstance(e, dict) and isinstance(e.get("chemin"), str)}
    instant = heure_de_paris(maintenant)
    plan = {"numero": numero, "chantier": fiche["chantier"], "dossier_drive": os.path.basename(drive), "drive": drive,
            "dossier_pc": nom_pc, "pc": base_pc, "a_copier": [], "deja": [], "absentes": [], "signales": [], "provenance": provenance}

    def signaler(motif, chemin, detail=""):
        plan["signales"].append({"motif": motif, "chemin": nfc(chemin), "detail": detail})

    vus = set()
    _LISTES = {}                                       # la liste de chaque dossier n'est lue qu'une fois pendant ce parcours
    try:
        for relatif, source in parcourir(drive, signaler):
            chemin = "/".join(relatif)
            nom = relatif[-1]
            if cle(nom) in FICHIERS_IGNORES or (len(relatif) == 1 and cle(nom) in (INDEX, INDEX + ".tmp")):
                continue
            if est_sous(relatif, sous["exclus"]):
                continue                               # le carnet et l'ancien dossier des plans : des copies, pas des fiches
            if not est_sous(relatif, sous["fiches"]):
                signaler("hors-rangement", chemin)
                continue
            if cle(chemin) in vus or nom.endswith(PARTIEL) or nom.endswith(".tmp"):
                continue                               # déjà vu, ou reste d'une écriture en cours : jamais une fiche
            vus.add(cle(chemin))
            if os.path.splitext(nom)[1].lower() in RACCOURCIS:
                signaler("raccourci", chemin)
                continue
            dossier, double = drive, False
            for morceau in relatif:
                double = double or doublon_de_drive(dossier, morceau)
                dossier = os.path.join(dossier, morceau)
            if double:
                signaler("doublon", chemin)
                continue
            cible = viser(base_pc, relatif)
            if len(os.path.abspath(source)) > CHEMIN_MAX or len(os.path.abspath(cible)) > CHEMIN_MAX:
                signaler("trop-long", chemin, "%d caractères" % max(len(os.path.abspath(source)), len(os.path.abspath(cible))))
                continue
            try:
                etat = os.stat(source)
            except OSError as e:
                signaler("illisible", chemin, str(e))
                continue
            taille = etat.st_size
            note = inscrits.get(cle(chemin))
            # « Connue » : la liste de provenance a ce chemin AVEC cette taille. Même chemin, autre taille : c'est une fiche NOUVELLE
            # qui a pris le nom d'une ancienne (l'ancienne avait été supprimée du Drive).
            connue = note is not None and note.get("taille") == taille
            entree = {"chemin": nfc(chemin), "taille": taille, "date": int(etat.st_mtime), "source": source, "cible": cible, "inscrit": connue}
            if os.path.isdir(cible):
                signaler("taille-differente", chemin, "dans le dossier du PC, ce nom est celui d'un dossier")
            elif os.path.lexists(cible):
                sur_pc = os.stat(cible)
                if sur_pc.st_size != taille:
                    signaler("taille-differente", chemin, "Drive : %d octets ; PC : %d octets" % (taille, sur_pc.st_size))
                    continue
                entree["date_pc"] = int(sur_pc.st_mtime)
                # Même taille ne suffit pas pour l'affirmer au relevé : la date du fichier du Drive doit être celle qui a été notée
                # à la copie (ou, pour une ancienne entrée sans date, celle du fichier du PC). Au moindre doute : comparaison du contenu.
                if connue and not meme_date(etat.st_mtime, note["date"] if "date" in note else sur_pc.st_mtime):
                    entree["inscrit"] = False
                plan["deja"].append(entree)
            elif connue:
                # Déjà copiée une fois, et plus à sa place : Franck l'a déplacée, renommée ou supprimée. Son choix est respecté.
                plan["absentes"].append(note)
                if signalement_recent(note, instant):
                    signaler("absente", chemin)
            else:
                plan["a_copier"].append(entree)
    finally:
        _LISTES = None
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
        os.rename(partiel, cible)        # sous Windows, « rename » refuse d'écraser un fichier apparu entre-temps
        fini = True
        return taille
    finally:
        if not fini and os.path.exists(partiel):
            try:
                os.remove(partiel)       # notre propre copie inachevée
            except OSError:
                pass


def empreinte(chemin):
    """L'empreinte SHA-256 du contenu d'un fichier (deux fichiers de même empreinte ont le même contenu)."""
    calcul = hashlib.sha256()
    with open(chemin, "rb") as f:
        for bloc in iter(lambda: f.read(1048576), b""):
            calcul.update(bloc)
    return calcul.hexdigest()


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
    """Copie les nouvelles fiches du chantier du Drive vers son dossier sur le PC (jamais l'inverse), puis écrit la liste de
    provenance (dossier du PC) et le relevé releve-pc.json (Drive).
    Rend le plan, complété de "copies", "erreurs", "ajoutes", "releve" et "ecritures" (écritures de liste ou de relevé manquées)."""
    racine = reglages["racine"]
    sous = sous or sous_dossiers(racine)
    plan = plan_rapatriement(reglages, numero, sous, maintenant)
    plan.update(copies=[], erreurs=[], ajoutes=0, releve=0, ecritures=[])
    if simuler:
        return plan
    provenance = plan["provenance"]
    instant = heure_de_paris(maintenant)
    chemin_provenance = os.path.join(plan["pc"], PROVENANCE)
    en_attente = [0]                 # changements de la liste pas encore écrits sur le disque

    def inscrire(a, verifie=False):
        """Note la fiche dans la liste : l'entrée de ce chemin est mise à jour si elle existe (jamais deux fois le même chemin)."""
        nouvelle = {"chemin": a["chemin"], "taille": a["taille"], "copie_le": instant, "date": a["date"]}
        if verifie:
            nouvelle["verifie"] = "contenu"
        for entree in provenance["fichiers"]:
            if isinstance(entree, dict) and cle(entree.get("chemin", "")) == cle(a["chemin"]):
                if entree.get("taille") == a["taille"] and "copie_le" in entree:
                    nouvelle["copie_le"] = entree["copie_le"]          # même fiche : sa date de copie d'origine est gardée
                    if "verifie" in entree:
                        nouvelle["verifie"] = entree["verifie"]
                entree.clear()
                entree.update(nouvelle)
                break
        else:
            provenance["fichiers"].append(nouvelle)
            plan["ajoutes"] += 1
        a["inscrit"] = True
        en_attente[0] += 1

    def sauver(force=False):
        """Écrit la liste toutes les 25 nouveautés, et à la fin : un arrêt en route ne fait pas refaire tout le travail."""
        if en_attente[0] and (force or en_attente[0] >= PROVENANCE_PAQUET):
            try:
                ecrire_json(chemin_provenance, provenance)
                en_attente[0] = 0
            except OSError as e:
                if force:
                    plan["ecritures"].append("la liste « %s » n'a pas pu être écrite (%s)" % (PROVENANCE, e))

    try:
        for a in plan["a_copier"]:
            try:
                copier_fichier(a["source"], a["cible"])
                plan["copies"].append(a)
                inscrire(a)
                dire("    copié : %s — %s (%s)" % (plan["dossier_pc"], a["chemin"], mo(a["taille"])))
            except OSError as e:
                plan["erreurs"].append({"chemin": a["chemin"], "detail": str(e)})
                dire("    ! pas copié : %s — %s (%s)" % (plan["dossier_pc"], a["chemin"], e))
            battre()
            sauver()
        # Un fichier « déjà présent » (même nom, même taille) que la liste ne connaît pas, ou dont la date fait douter : il n'entre
        # dans la liste, et au relevé, qu'après comparaison du CONTENU des deux fichiers. Le résultat est noté : les fichiers
        # identiques ne sont comparés qu'une fois ; les fichiers différents ne sont recomparés que si l'un des deux change.
        differents = provenance.get("differents") if isinstance(provenance.get("differents"), list) else []
        for a in plan["deja"]:
            if a["inscrit"]:
                continue
            connu = [d for d in differents if isinstance(d, dict) and cle(d.get("chemin", "")) == cle(a["chemin"])]
            if connu and connu[0].get("taille") == a["taille"] and meme_date(connu[0].get("date_drive"), a["date"]) \
                    and meme_date(connu[0].get("date_pc"), a["date_pc"]):
                plan["signales"].append({"motif": "autre-contenu", "chemin": a["chemin"], "detail": ""})
                continue                     # déjà comparés, et aucun des deux n'a changé : pas de nouvelle lecture
            try:
                memes = empreinte(a["source"]) == empreinte(a["cible"])
            except OSError as e:
                plan["erreurs"].append({"chemin": a["chemin"], "detail": "comparaison impossible : %s" % e})
                continue
            differents = [d for d in differents if d not in connu]
            if memes:
                inscrire(a, verifie=True)
            else:
                differents.append({"chemin": a["chemin"], "taille": a["taille"], "date_drive": a["date"], "date_pc": a["date_pc"], "vu_le": instant})
                plan["signales"].append({"motif": "autre-contenu", "chemin": a["chemin"], "detail": ""})
            if connu or not memes:
                en_attente[0] += 1
            if differents or "differents" in provenance:
                provenance["differents"] = differents
            battre()
            sauver()
        for entree in plan["absentes"]:
            if "absente_signalee_le" not in entree:
                entree["absente_signalee_le"] = instant
                en_attente[0] += 1
    finally:
        # (a) dans le dossier du PC : la provenance, cumulée ; écrite même si le travail est interrompu
        sauver(force=True)
    # (b) dans le Drive : le relevé de présence. Seulement les fiches du Drive qui sont à leur place sur le PC, avec la même
    # taille, et connues de la liste de provenance (copiées par le programme, ou contenu vérifié).
    fichiers = sorted(({"chemin": a["chemin"], "taille": a["taille"]} for a in plan["copies"] + plan["deja"] if a["inscrit"]),
                      key=lambda f: f["chemin"])
    releve = {"version": 1, "chantier": plan["chantier"], "numero": numero, "releve_le": instant, "fichiers": fichiers}
    chemin_releve = os.path.join(plan["drive"], INDEX)
    if not econome or releve_a_refaire(chemin_releve, releve, instant):
        try:
            ecrire_json(chemin_releve, releve, lisible=False)
        except OSError as e:
            plan["ecritures"].append("le relevé « %s » n'a pas pu être écrit dans le Drive (%s)" % (INDEX, e))
    plan["releve"] = len(fichiers)
    return plan


def a_classer(racine):
    """Les fichiers du dossier « _À CLASSER » de la racine du Drive : signalés, jamais copiés."""
    dossier = descendre(racine, [A_CLASSER])
    if dossier is None or not os.path.isdir(dossier):
        return []
    return [nfc("/".join(relatif)) for relatif, _ in parcourir(dossier, lambda *a: None) if cle(relatif[-1]) not in FICHIERS_IGNORES]


LIBELLES = {
    "hors-rangement": "hors des dossiers de fiches (pas copié : range-le dans le Drive s'il doit aller dans le dossier du chantier)",
    "raccourci": "raccourci Google, qui ne contient pas le document (pas copié)",
    "doublon": "doublon fabriqué par Drive (pas copié)",
    "trop-long": "chemin trop long (pas copié)",
    "illisible": "illisible (pas copié)",
    "taille-differente": "déjà dans le dossier du PC sous le même nom, mais PAS de la même taille (rien n'est touché)",
    "autre-contenu": "déjà dans le dossier du PC sous le même nom et la même taille, mais PAS le même contenu (rien n'est touché)",
    "absente": "fiche de l'appli absente du dossier du PC : déplacée ou supprimée ? (ton choix est respecté : elle n'est pas recopiée)",
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
        for ligne in plan["ecritures"]:
            dire("  ! " + ligne)
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
    """Pose le verrou (refuse si un autre traitement tourne). Le verrou porte l'heure de démarrage du traitement.
    Il est repris s'il est orphelin : son programme ne tourne plus, ou il a plus de deux heures (quelle que soit la machine)."""
    global _VERROU
    moi = {"machine": machine or socket.gethostname(), "processus": processus or os.getpid(),
           "instant": horloge(), "date": datetime.datetime.fromtimestamp(horloge()).strftime("%d/%m/%Y %H:%M")}
    os.makedirs(os.path.dirname(chemin), exist_ok=True)
    for essai in (1, 2):
        try:
            fichier = os.open(chemin, os.O_CREAT | os.O_EXCL | os.O_WRONLY)      # création exclusive : un seul programme y arrive
        except FileExistsError:
            try:
                autre = dc.lire_json(chemin)
                age = horloge() - float(autre["instant"])
                quand = str(autre.get("date", "?"))
                meme = autre["machine"] == moi["machine"]
                orphelin = age > VERROU_VIEUX or (meme and (not vivant(autre["processus"]) or autre["processus"] == moi["processus"]))
            except (OSError, ValueError, KeyError, TypeError):
                quand = "?"
                try:
                    orphelin = horloge() - os.path.getmtime(chemin) > VERROU_VIEUX
                except OSError:
                    orphelin = True          # il vient de disparaître : on retente la création
            if not orphelin or essai == 2:
                raise Refus("Un autre traitement est déjà en cours (lancé le %s). Attends qu'il ait fini, puis relance. "
                            "S'il ne finit jamais, le verrou sera repris tout seul deux heures après son lancement." % quand)
            ecarte = "%s.repris-%s-%d" % (chemin, moi["machine"], moi["processus"])
            try:
                os.rename(chemin, ecarte)    # un seul des programmes qui voudraient le reprendre réussit ce renommage
                os.remove(ecarte)
                dire("Un verrou laissé par un traitement qui ne tourne plus (du %s) a été repris : le travail continue normalement." % quand)
            except OSError:
                pass                         # un autre programme l'a repris avant nous : la création suivante le dira
            continue
        with os.fdopen(fichier, "w", encoding="utf-8") as f:
            json.dump(moi, f, ensure_ascii=False)
        _VERROU = {"chemin": chemin, "moi": moi, "horloge": horloge}
        return moi
    raise Refus("Un autre traitement est déjà en cours.")


def battre():
    """Pendant un long travail, rafraîchit l'heure du verrou toutes les dix minutes (pour qu'il ne soit pas pris pour un orphelin)."""
    if not _VERROU:
        return
    chemin, moi, horloge = _VERROU["chemin"], _VERROU["moi"], _VERROU["horloge"]
    if horloge() - moi["instant"] < VERROU_BATTEMENT:
        return
    try:
        autre = dc.lire_json(chemin)
        if autre.get("machine") == moi["machine"] and autre.get("processus") == moi["processus"]:
            moi["instant"] = horloge()
            ecrire_json(chemin, moi, lisible=False)
    except (OSError, ValueError, AttributeError):
        pass


def liberer_verrou(chemin, moi):
    """Retire notre verrou (et seulement le nôtre)."""
    global _VERROU
    _VERROU = None
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


# ── Quels chantiers : le numéro en tête du nom du dossier, pour les dossiers que l'appli connaît ──
def tri_numeros(numeros):
    return sorted(numeros, key=lambda n: (len(n), n))


def chantiers_suivis(reglages, sous=None):
    """Trouve tout seul les chantiers. Un dossier du Drive est suivi s'il est un dossier de chantier de l'appli (il contient au
    moins un sous-dossier de fiches, ou le carnet) ou s'il est dans la correspondance de _prive/depot.json. Son n° : les chiffres
    en tête de son nom ; la correspondance ne sert que s'il n'en a pas, et ne peut pas le contredire. Puis LE dossier du PC qui
    commence par ce n°. Aucun, plusieurs, contradiction : rien n'est deviné. N'écrit rien.
    Rend ({n°: {"chantier", "dossier_drive", …}}, [lignes « à voir »])."""
    racine, chantiers_pc = reglages["racine"], dossier_des_chantiers(reglages)
    sous = sous or sous_dossiers(racine)
    correspondance = reglages.get("chantiers") or {}
    planning = reglages.get("planning")
    par_dossier = {cle(f["dossier_drive"]): str(n) for n, f in correspondance.items()}
    reperes = sous["fiches"] + sous["exclus"]
    a_voir, par_numero = [], {}
    for nom in sorted(os.listdir(racine)):
        dossier = os.path.join(racine, nom)
        if not os.path.isdir(dossier) or dossier_technique(nom, planning):
            continue                                   # _À CLASSER, ADMINISTRATIF, planning… : pas des chantiers
        associe, lu = par_dossier.get(cle(nom)), numero_du_dossier(nom)
        connu = any(descendre(dossier, morceaux) is not None for morceaux in reperes)
        if not associe and not connu:
            continue                                   # un dossier que l'appli n'utilise pas (« 2024 - archives ») : ignoré, sans bruit
        if dc.est_doublon(racine, nom):
            a_voir.append("Dossier du Drive « %s » : c'est un dossier en double fabriqué par Google Drive. Rien n'est copié pour lui : "
                          "range ce doublon dans Drive." % nom)
            continue
        if associe and lu and associe != lu:
            a_voir.append("Dossier du Drive « %s » : son nom commence par le numéro %s, mais _prive/depot.json le relie au chantier n° %s. "
                          "Rien n'est copié pour lui : corrige l'un des deux." % (nom, lu, associe))
            continue
        numero = associe or lu
        if numero is None:
            a_voir.append("Dossier du Drive « %s » : pas de numéro de chantier en tête de son nom. Rien n'est copié pour lui "
                          "(pour le relier à son dossier du PC : choix 4 du menu de appli-pc)." % nom)
            continue
        par_numero.setdefault(numero, []).append(nom)
    for numero, fiche in correspondance.items():
        reel = trouver(racine, fiche["dossier_drive"])
        if reel is None or not os.path.isdir(os.path.join(racine, reel)):
            a_voir.append("Chantier n° %s : le dossier du Drive noté dans la correspondance (« %s ») est introuvable. "
                          "Corrige _prive/depot.json." % (numero, fiche["dossier_drive"]))
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
        # « nom_appli » : le nom du chantier DANS L'APPLI, seulement s'il est sûr (écrit par Franck, ou déjà dans le carnet).
        # Le nom du dossier n'en est pas un : il n'est jamais donné au dépôt du carnet (il ne sert qu'à l'affichage).
        fiche["nom_appli"] = fiche.get("chantier") or nom_dans_l_appli(racine, noms[0])
        if str(fiche["nom_appli"] or "").strip() == noms[0].strip():
            fiche["nom_appli"] = None
        if not fiche.get("chantier"):
            fiche["chantier"] = fiche["nom_appli"] or noms[0]
        suivis[numero] = fiche
    return suivis, a_voir


def un_seul(suivis, a_voir, seul):
    """Ne garde que le chantier demandé par --chantier (refuse s'il n'est pas reconnu)."""
    if seul is None:
        return suivis, a_voir
    seul = str(seul).strip()
    if seul not in suivis:
        raison = [ligne for ligne in a_voir if re.search(r"n° %s\b|numéro %s\b" % (re.escape(seul), re.escape(seul)), ligne)]
        raise Refus("Le chantier n° %s n'est pas reconnu : %s" % (seul, raison[0] if raison else
                    "aucun dossier de chantier de l'appli ne porte ce numéro dans le Drive (regarde avec « Voir seulement »)."))
    return {seul: suivis[seul]}, []


# ── Ce qui demande l'attention de Franck : le fichier « CHANTIERPRO - A VOIR.txt » ──
def lignes_a_voir(plan, maxi=A_VOIR_MAX):
    """Les lignes « à voir » d'un chantier : ce qui a été signalé sans être copié, les copies et les écritures en erreur."""
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
    for ligne in plan.get("ecritures", []):
        lignes.append("%s — %s : à réessayer au prochain passage." % (qui, ligne))
    return lignes


def texte_a_voir(lignes, maintenant=None, deposes=()):
    quand = datetime.datetime.fromisoformat(heure_de_paris(maintenant)).strftime("%d/%m/%Y à %H:%M")
    texte = ["CHANTIERPRO — À VOIR", "Mis à jour le %s (recopie des fiches de l'appli, dépôt au carnet des poseurs)." % quand, ""]
    if lignes:
        texte.append("%d point(s) demandent ton attention :" % len(lignes))
        texte.extend("- " + ligne for ligne in lignes)
    else:
        texte.append("Rien à signaler.")
    texte += ["", "Déposé au carnet ces sept derniers jours (les poseurs voient ces documents) :"]
    texte.extend("+ " + ligne for ligne in deposes)
    if not deposes:
        texte.append("  aucun document.")
    texte += ["", "Un document déposé par erreur ? appli-pc, choix 5 (« Retirer un document du carnet »).",
              "Ce fichier n'est réécrit que si quelque chose change, et au moins une fois par jour.",
              "Pour savoir quand le passage automatique a tourné pour la dernière fois : appli-pc, choix 3.",
              "Rien n'est jamais supprimé ni écrasé par le programme."]
    return "\r\n".join(texte) + "\r\n"


def lire_a_voir(chantiers_pc):
    try:
        with open(os.path.join(chantiers_pc, A_VOIR), encoding="utf-8-sig") as f:
            return f.read()
    except OSError:
        return None


def points_a_voir(chantiers_pc, deposes=False):
    """Ce que dit le fichier « A VOIR » déjà écrit : (ses lignes, la date de sa mise à jour) ; (None, None) s'il n'existe pas.
    « deposes » vrai : les lignes de la section « Déposé au carnet » à la place des points."""
    texte = lire_a_voir(chantiers_pc)
    if texte is None:
        return None, None
    trouve = re.search(r"Mis à jour le (\d{2}/\d{2}/\d{4}) à (\d{2}:\d{2})", texte)
    try:
        quand = datetime.datetime.strptime("%s %s" % trouve.groups(), "%d/%m/%Y %H:%M") if trouve else None
    except ValueError:
        quand = None
    return [ligne[2:] for ligne in texte.splitlines() if ligne.startswith("+ " if deposes else "- ")], quand


def ecrire_a_voir(chantiers_pc, lignes, maintenant=None, deposes=None):
    """Réécrit « CHANTIERPRO - A VOIR.txt » SEULEMENT si ses lignes changent, ou s'il a plus d'un jour (pour ne pas faire
    travailler la sauvegarde toutes les heures). Temporaire puis remplacement. Rend True s'il a été réécrit.
    « deposes » : les lignes de la section « Déposé au carnet » ; None = garder celles qui y sont déjà."""
    anciennes, quand = points_a_voir(chantiers_pc)
    anciens_depots = points_a_voir(chantiers_pc, deposes=True)[0] or []
    if deposes is None:
        deposes = anciens_depots
    present = datetime.datetime.fromisoformat(heure_de_paris(maintenant)).replace(tzinfo=None)
    if anciennes == list(lignes) and anciens_depots == list(deposes) and quand is not None \
            and 0 <= (present - quand).total_seconds() < A_VOIR_FRAIS:
        return False
    chemin = os.path.join(chantiers_pc, A_VOIR)
    temporaire = chemin + ".tmp"
    try:
        with open(temporaire, "w", encoding="utf-8-sig", newline="") as f:      # « -sig » : le Bloc-notes affiche bien les accents
            f.write(texte_a_voir(lignes, maintenant, deposes))
        for essai in range(6):
            try:
                os.replace(temporaire, chemin)
                break
            except PermissionError:      # le fichier est peut-être ouvert, ou en cours de sauvegarde
                if essai == 5:
                    raise
                time.sleep(0.5)
    finally:
        if os.path.exists(temporaire):
            os.remove(temporaire)
    return True


def ajouter_a_voir(chantiers_pc, ligne, maintenant=None):
    """Un passage n'a pas pu se faire : on AJOUTE cette ligne aux points déjà connus, sans les effacer."""
    anciennes, _ = points_a_voir(chantiers_pc)
    gardees = [a for a in (anciennes or []) if not a.startswith(PAS_FAIT)]
    return ecrire_a_voir(chantiers_pc, gardees + ["%s : %s" % (PAS_FAIT, ligne)], maintenant)


def rapatrier_tout(reglages, dire=print, maintenant=None, econome=False, resume=True, seul=None, ecrire=True):
    """La recopie des fiches de tous les chantiers reconnus (ou du seul chantier « seul »), puis le fichier « A VOIR ».
    La même fonction sert au double-clic et au passage automatique.
    Rend {"chantiers", "copies", "deja", "signales", "erreurs", "refuses", "ecritures", "plans", "a_voir"}."""
    racine, chantiers_pc = reglages["racine"], dossier_des_chantiers(reglages)
    sous = sous_dossiers(racine)
    suivis, a_voir = un_seul(*chantiers_suivis(reglages, sous), seul)
    effectif = dict(reglages, chantiers=suivis)
    bilan = {"chantiers": len(suivis), "copies": 0, "deja": 0, "signales": 0, "erreurs": 0, "refuses": 0, "ecritures": 0,
             "plans": [], "a_voir": a_voir}
    for numero in tri_numeros(suivis):
        try:
            plan = rapatrier(effectif, numero, sous, dire=dire, maintenant=maintenant, econome=econome)
        except (Refus, OSError) as e:
            bilan["refuses"] += 1
            a_voir.append("Chantier n° %s : la recopie n'a pas pu se faire (%s)" % (numero, e))
            if resume:
                dire("")
                dire("Chantier n° %s : PAS RECOPIÉ (%s)" % (numero, e))
            continue
        if resume:
            dire_rapatriement(plan, dire)
        bilan["plans"].append(plan)
        bilan["copies"] += len(plan["copies"])
        bilan["deja"] += len(plan["deja"])
        bilan["signales"] += len(plan["signales"])
        bilan["erreurs"] += len(plan["erreurs"])
        bilan["ecritures"] += len(plan["ecritures"])
        a_voir.extend(lignes_a_voir(plan))
    if seul is None:
        en_attente = a_classer(racine)
        if en_attente:
            a_voir.append("%d fichier(s) dans « %s » (racine du Drive de l'appli) : ils n'iront dans aucun dossier de chantier tant qu'ils "
                          "ne sont pas rangés dans le Drive (%s%s)." % (len(en_attente), A_CLASSER, ", ".join(en_attente[:5]), "…" if len(en_attente) > 5 else ""))
        if ecrire:
            ecrire_a_voir(chantiers_pc, a_voir, maintenant)      # avec --chantier (un essai), « A VOIR » n'est pas touché
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


def noter_passage(prive, horloge=time.time):
    """Retient l'heure du dernier passage automatique mené à son terme (pour prévenir Franck s'il n'y en a plus)."""
    try:
        os.makedirs(os.path.join(prive, JOURNAL_DOSSIER), exist_ok=True)
        ecrire_json(os.path.join(prive, JOURNAL_DOSSIER, DERNIER_PASSAGE),
                    {"instant": horloge(), "date": datetime.datetime.fromtimestamp(horloge()).strftime("%d/%m/%Y à %H:%M")}, lisible=False)
    except OSError:
        pass


def etat_auto(prive, horloge=time.time):
    """Où en est la recopie automatique : (phrase, vrai s'il faut s'en inquiéter)."""
    try:
        dernier = dc.lire_json(os.path.join(prive, JOURNAL_DOSSIER, DERNIER_PASSAGE))
        age = horloge() - float(dernier["instant"])
        quand = str(dernier["date"])
    except (OSError, ValueError, KeyError, TypeError):
        return ("Le passage automatique (recopie des fiches, dépôt au carnet) n'a encore jamais tourné sur ce PC. Il se met en place à l'étape 6 de la "
                "procédure (docs/lot4c-procedure.md), APRÈS les essais : double-clic sur outils\\installer-tache.bat.", True)
    if age > AUTO_EN_RETARD:
        return ("ATTENTION : le passage automatique (recopie des fiches, dépôt au carnet) n'a pas tourné depuis le %s (plus de 3 heures). PC éteint depuis ? "
                "Sinon : relance outils\\installer-tache.bat (à refaire après une mise à jour de Python ou un déplacement du dépôt), "
                "et montre _prive\\appli-pc\\auto.txt." % quand, True)
    return "Dernier passage automatique réussi : le %s." % quand, False


def passage(reglages, prive, dire=print, maintenant=None, econome=False, resume=True, seul=None, fiches=True, carnet=True,
            horloge=time.time, attente=time.sleep):
    """UN passage complet, le même pour la tâche planifiée et pour le double-clic : la recopie des fiches, PUIS le dépôt au carnet,
    pour tous les chantiers reconnus (ou le seul chantier « seul »), sans aucune question ; puis « A VOIR ».
    Rend {"chantiers", "copies", "deja", "signales", "rates" (copies, chantiers, écritures, dépôts en erreur), "deposes", "reste",
    "a_voir", "recents", "candidats"}."""
    debut = horloge()
    racine, chantiers_pc = reglages["racine"], dossier_des_chantiers(reglages)
    sous = sous_dossiers(racine)
    suivis, a_voir = un_seul(*chantiers_suivis(reglages, sous), seul)
    bilan = {"chantiers": len(suivis), "copies": 0, "deja": 0, "signales": 0, "rates": 0, "deposes": [], "reste": 0, "candidats": 0,
             "a_voir": a_voir, "recents": None}
    if fiches:
        fait = rapatrier_tout(reglages, dire=dire, maintenant=maintenant, econome=econome, resume=resume, seul=seul, ecrire=False)
        bilan.update(copies=fait["copies"], deja=fait["deja"], signales=fait["signales"], a_voir=fait["a_voir"],
                     rates=fait["erreurs"] + fait["refuses"] + fait["ecritures"])
    if carnet:
        if resume:
            dire("")
            dire("— CARNET : ce qui part tout seul (« %s » et les bordereaux) —" % A_METTRE)
        depots = deposer_tout(dict(reglages, chantiers=suivis), prive, dire=dire, horloge=horloge, attente=attente,
                              fin=debut + LIMITE_PASSAGE, memoriser=seul is None)
        bilan.update(deposes=depots["deposes"], reste=depots["reste"], recents=depots["recents"], candidats=depots["candidats"])
        bilan["rates"] += depots["erreurs"]
        bilan["signales"] += depots["signales"]
        bilan["a_voir"] = bilan["a_voir"] + depots["a_voir"]
        if resume and not depots["candidats"]:
            dire("Aucun document à déposer au carnet.")
    if seul is None:
        ecrire_a_voir(chantiers_pc, bilan["a_voir"], maintenant, bilan["recents"])      # avec --chantier (un essai) : pas touché
    return bilan


def passage_auto(chemin_reglages, maintenant=None, seul=None, fiches=True, carnet=True, horloge=time.time, attente=time.sleep):
    """Un passage sans personne devant l'écran : recopie les nouvelles fiches, dépose au carnet ce qui doit l'être, met « A VOIR »
    à jour, note une ligne au journal (et chaque dépôt au carnet).
    Codes : 0 = fait (même s'il n'y avait rien), ou un autre passage tourne déjà ; 2 = réglages ou Drive pas prêts ;
    1 = une copie, un chantier, une écriture ou un dépôt en erreur."""
    chemin_reglages = os.path.abspath(chemin_reglages)
    prive = os.path.dirname(chemin_reglages)
    reglages = None

    def prevenir(ligne):
        chantiers_pc = dossier_des_chantiers(reglages) if isinstance(reglages, dict) else None
        if isinstance(chantiers_pc, str) and os.path.isdir(chantiers_pc):
            try:
                ajouter_a_voir(chantiers_pc, ligne, maintenant)
            except OSError:
                pass

    try:
        reglages = lire_reglages(chemin_reglages)
        controler_reglages(reglages)
        sous_dossiers(reglages["racine"])
        lire_memoire(os.path.join(prive, MEMOIRE_FICHIER))
    except Refus as e:
        noter_auto(prive, ["PAS FAIT : %s" % e])
        prevenir("la recopie des fiches et le dépôt au carnet n'ont pas pu se faire. %s Le prochain passage réessaiera." % e)
        return 2
    verrou = os.path.join(prive, VERROU_FICHIER)
    try:
        moi = prendre_verrou(verrou, dire=lambda ligne: None)
    except Refus as e:
        noter_auto(prive, ["Rien fait : un autre passage du programme est en cours."])
        prevenir("le passage automatique a trouvé le programme déjà occupé. %s Si une fenêtre « appli-pc » est restée ouverte sur "
                 "une question, réponds-y ou ferme-la." % e)
        return 0
    detail = []
    try:
        bilan = passage(reglages, prive, dire=detail.append, maintenant=maintenant, econome=True, resume=False, seul=seul,
                        fiches=fiches, carnet=carnet, horloge=horloge, attente=attente)
    except Refus as e:
        noter_auto(prive, ["PAS FAIT : %s" % e])
        return 2
    except Exception as e:                     # personne ne regarde l'écran : tout est noté au journal
        noter_auto(prive, ["ERREUR : %s : %s" % (type(e).__name__, e)] + detail)
        return 1
    finally:
        liberer_verrou(verrou, moi)
    ligne = "%d chantier(s) ; %d fichier(s) copié(s), %d document(s) déposé(s) au carnet%s, %d en erreur ; %d point(s) à voir." % (
        bilan["chantiers"], bilan["copies"], len(bilan["deposes"]), " (%d restent pour le prochain passage)" % bilan["reste"] if bilan["reste"] else "",
        bilan["rates"], len(bilan["a_voir"]))
    noter_auto(prive, [ligne] + ["DÉPOSÉ AU CARNET : " + ligne_depot(d) for d in bilan["deposes"]]
               + ([x for x in detail if x.strip() and "DÉPOSÉ AU CARNET" not in x] if bilan["copies"] or bilan["rates"] else []))
    noter_passage(prive)
    return 1 if bilan["rates"] else 0


# ── La tâche planifiée de Windows : une seule tâche, deux déclencheurs, sans droits d'administrateur ──
def xml_tache(pythonw, script, dossier, utilisateur, depart, options=()):
    """La description de la tâche, au format du Planificateur de tâches de Windows :
    - deux déclencheurs : toutes les heures, et à l'ouverture de session de CET utilisateur seulement ;
    - sans élévation (LeastPrivilege), dans la session ouverte (InteractiveToken) ;
    - elle démarre et continue sur batterie ; un passage manqué (PC éteint) est rattrapé dès que possible ;
    - jamais deux passages à la fois (IgnoreNew) ; un passage est arrêté au bout d'une heure ;
    - le programme est lancé SANS fenêtre (pythonw), en mode automatique."""
    from xml.sax.saxutils import escape
    arguments = " ".join(['"%s"' % script, "--auto"] + ['"%s"' % o if " " in o else o for o in options])
    return "\r\n".join([
        '<?xml version="1.0" encoding="UTF-16"?>',
        '<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">',
        "  <RegistrationInfo>",
        "    <Description>ChantierPro : recopie les nouvelles fiches de l'appli (Drive) dans les dossiers de chantier du PC. "
        "Dépose au carnet des poseurs les PDF de « À METTRE AU CARNET » et des bordereaux. Rien n'est supprimé ni écrasé. "
        "Pour l'arrêter : outils\\retirer-tache.bat.</Description>",
        "  </RegistrationInfo>",
        "  <Triggers>",
        "    <TimeTrigger>",
        "      <Repetition>",
        "        <Interval>PT1H</Interval>",
        "        <StopAtDurationEnd>false</StopAtDurationEnd>",
        "      </Repetition>",
        "      <StartBoundary>%s</StartBoundary>" % depart.strftime("%Y-%m-%dT%H:%M:%S"),
        "      <Enabled>true</Enabled>",
        "    </TimeTrigger>",
        "    <LogonTrigger>",
        "      <Enabled>true</Enabled>",
        "      <UserId>%s</UserId>" % escape(utilisateur),
        "    </LogonTrigger>",
        "  </Triggers>",
        "  <Principals>",
        '    <Principal id="Author">',
        "      <UserId>%s</UserId>" % escape(utilisateur),
        "      <LogonType>InteractiveToken</LogonType>",
        "      <RunLevel>LeastPrivilege</RunLevel>",
        "    </Principal>",
        "  </Principals>",
        "  <Settings>",
        "    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>",
        "    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>",
        "    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>",
        "    <AllowHardTerminate>true</AllowHardTerminate>",
        "    <StartWhenAvailable>true</StartWhenAvailable>",
        "    <RunOnlyIfNetworkAvailable>false</RunOnlyIfNetworkAvailable>",
        "    <IdleSettings>",
        "      <StopOnIdleEnd>false</StopOnIdleEnd>",
        "      <RestartOnIdle>false</RestartOnIdle>",
        "    </IdleSettings>",
        "    <AllowStartOnDemand>true</AllowStartOnDemand>",
        "    <Enabled>true</Enabled>",
        "    <Hidden>false</Hidden>",
        "    <RunOnlyIfIdle>false</RunOnlyIfIdle>",
        "    <WakeToRun>false</WakeToRun>",
        "    <ExecutionTimeLimit>PT1H</ExecutionTimeLimit>",
        "    <Priority>7</Priority>",
        "  </Settings>",
        '  <Actions Context="Author">',
        "    <Exec>",
        "      <Command>%s</Command>" % escape(pythonw),
        "      <Arguments>%s</Arguments>" % escape(arguments),
        "      <WorkingDirectory>%s</WorkingDirectory>" % escape(dossier),
        "    </Exec>",
        "  </Actions>",
        "</Task>", ""])


def commande_tache(nom, fichier_xml):
    """Les arguments de « schtasks » qui créent (ou refont) la tâche à partir de sa description."""
    return ["schtasks", "/create", "/tn", nom, "/xml", fichier_xml, "/f"]


def commande_retrait(nom):
    return ["schtasks", "/delete", "/tn", nom, "/f"]


def lancer_commande(arguments):
    """Lance une commande de Windows ; rend (code de sortie, texte affiché)."""
    import subprocess
    fait = subprocess.run(arguments, capture_output=True)
    return fait.returncode, (fait.stdout + fait.stderr).decode("oem" if os.name == "nt" else "utf-8", "replace").strip()


def identifiant_utilisateur(lanceur=lancer_commande):
    """L'identifiant de la session Windows ouverte (son « SID », de la forme S-1-5-21-…), lu par « whoami /user ».
    Il désigne le compte sans ambiguïté, même pour un compte Microsoft. None si la lecture échoue."""
    try:
        code, texte = lanceur(["whoami", "/user", "/fo", "csv", "/nh"])
    except OSError:
        return None
    trouve = re.search(r"S-1-\d+(?:-\d+)+", texte or "")
    return trouve.group(0) if code == 0 and trouve else None


def installer_tache(dire=print, lanceur=lancer_commande, pythonw=None, script=None, options=(), utilisateur=None, maintenant=None):
    """Crée (ou refait) la tâche planifiée, sans droits d'administrateur. Rend 0, ou 1 si Windows l'a refusée."""
    import tempfile
    pythonw = pythonw or os.path.join(os.path.dirname(sys.executable), "pythonw.exe")
    script = script or os.path.abspath(__file__)
    if not os.path.isfile(pythonw):
        raise Refus("« pythonw.exe » est introuvable à côté de Python : la tâche ne peut pas être créée. Montre ce message.")
    if not utilisateur:
        utilisateur = identifiant_utilisateur(lanceur)
    if not utilisateur:                      # repli : le nom de la session
        domaine, nom = os.environ.get("USERDOMAIN", ""), os.environ.get("USERNAME", "")
        if not nom:
            raise Refus("Le nom de ta session Windows est introuvable : la tâche ne peut pas être créée. Montre ce message.")
        utilisateur = "%s\\%s" % (domaine, nom) if domaine else nom
    depart = (maintenant or datetime.datetime.now()).replace(second=0, microsecond=0)
    description = xml_tache(pythonw, script, os.path.dirname(os.path.dirname(script)), utilisateur, depart, options)
    poignee, fichier = tempfile.mkstemp(suffix=".xml", prefix="chantierpro-tache-")
    try:
        with os.fdopen(poignee, "w", encoding="utf-16", newline="") as f:
            f.write(description)
        code, texte = lanceur(commande_tache(TACHE, fichier))
    finally:
        try:
            os.remove(fichier)           # notre fichier temporaire
        except OSError:
            pass
    if code != 0:
        dire("La tâche « %s » n'a PAS pu être créée (code %s). Message de Windows : %s" % (TACHE, code, texte or "aucun"))
        dire("Rien n'est cassé : la recopie à la demande (double-clic sur appli-pc, choix 1) marche toujours. Montre ce message.")
        return 1
    lanceur(commande_retrait(TACHE_ANCIENNE))            # l'ancienne seconde tâche, si elle existe : sans importance sinon
    dire("Tâche créée : « %s »." % TACHE)
    dire("Toutes les heures, et à l'ouverture de ta session, sans fenêtre : elle recopie les nouvelles fiches de l'appli,")
    dire("et dépose au carnet des poseurs les PDF de « %s » et des bordereaux." % A_METTRE)
    dire("")
    dire("Pour vérifier : menu Démarrer, tape « Planificateur de tâches », ouvre-le, clique sur « Bibliothèque du Planificateur de tâches » :")
    dire("la ligne « %s » doit y être, avec l'heure de sa prochaine exécution." % TACHE)
    dire("Ce qui demande ton attention est écrit dans « %s », dans le dossier qui contient tes dossiers de chantier." % A_VOIR)
    dire("À refaire (même double-clic) après une mise à jour de Python ou un déplacement du dépôt.")
    return 0


def retirer_tache(dire=print, lanceur=lancer_commande):
    """Supprime la tâche planifiée (et l'ancienne seconde tâche, si elle existe). Aucun fichier n'est touché."""
    code, texte = lanceur(commande_retrait(TACHE))
    dire("Tâche retirée : « %s »." % TACHE if code == 0 else
         "Tâche « %s » : rien à retirer (elle n'existait pas, ou Windows a répondu : %s)." % (TACHE, texte or "code %s" % code))
    if lanceur(commande_retrait(TACHE_ANCIENNE))[0] == 0:
        dire("Tâche retirée : « %s »." % TACHE_ANCIENNE)
    dire("Le passage automatique (recopie des fiches, dépôt au carnet) est arrêté. Aucun fichier n'a été touché ; "
         "le double-clic sur appli-pc marche toujours.")
    return 0


# ── Les travaux complets ────────────────────────────────────────────────────
def lister(reglages, dire=print, seul=None, horloge=time.time):
    """Montre tout ce qui serait fait. N'écrit rien, nulle part."""
    racine, chantiers_pc, _ = controler_reglages(reglages)
    sous = sous_dossiers(racine)
    suivis, a_voir = un_seul(*chantiers_suivis(reglages, sous), seul)
    effectif = dict(reglages, chantiers=suivis)
    dire("VOIR SEULEMENT : rien n'est écrit, rien n'est copié, rien n'est déposé.")
    dire("")
    dire("Chantiers reconnus : %d" % len(suivis))
    vus = dossiers_pc(chantiers_pc)
    for numero in tri_numeros(suivis):
        nom_pc = dossier_pc_du(chantiers_pc, numero, vus)[0]
        a_mettre = trouver(os.path.join(chantiers_pc, nom_pc), A_METTRE)
        dire("  n° %s « %s » : Drive « %s » ; dossier du PC « %s »%s" % (numero, suivis[numero]["chantier"], suivis[numero]["dossier_drive"], nom_pc,
                                                                    " ; dossier « %s » présent" % a_mettre if a_mettre else ""))
    if a_voir:
        dire("À voir (%d) :" % len(a_voir))
        montrer_liste(dire, ["  ! " + ligne for ligne in a_voir])
    if not suivis:
        return
    dire("")
    dire("— RECOPIE DES FICHES (Drive de l'appli → dossiers de chantier du PC) —")
    for numero in tri_numeros(suivis):
        try:
            dire_rapatriement(rapatrier(effectif, numero, sous, simuler=True), dire, simuler=True)
        except (Refus, OSError) as e:
            dire("")
            dire("Chantier n° %s : laissé de côté (%s)" % (numero, e))
    en_attente = a_classer(racine) if seul is None else []
    if en_attente:
        dire("")
        dire("%d fichier(s) dans « %s » (racine du Drive) : ils n'iront dans aucun dossier de chantier tant qu'ils ne sont pas rangés." % (len(en_attente), A_CLASSER))
        montrer_liste(dire, ["    - " + c for c in en_attente])
    dire("")
    dire("— CARNET : ce qui partirait tout seul (« %s » et les bordereaux) —" % A_METTRE)
    vu = documents_a_deposer(effectif, horloge)
    if vu["sans_module"]:
        dire("  ! Un module de Python manque : aucun dépôt possible. À lancer une fois :  %s" % dc.INSTALLER)
    for x in vu["signales"]:
        dire("  ! " + x["texte"])
    for d in vu["jeunes"]:
        dire("  (attendra deux minutes : fichier tout juste arrivé) chantier n° %s, « %s », « %s »" % (d["numero"], d["origine"], d["fichier"]))
    if not vu["candidats"]:
        dire("Aucun document à déposer au carnet.")
    for rang, c in enumerate(vu["candidats"], 1):
        dire("")
        for ligne in decrire_candidat(c, rang, len(vu["candidats"])):
            dire(ligne)
    if vu["candidats"]:
        dire("")
        dire("Ce qui partirait au carnet, par chantier (le poids est une estimation des images, dans le Drive de l'appli) :")
        for numero in tri_numeros({c["numero"] for c in vu["candidats"]}):
            les_siens = [c for c in vu["candidats"] if c["numero"] == numero]
            poids = [poids_estime(c["chemin"], c["code"]) for c in les_siens]
            dire("  chantier n° %s : %d document(s), %d page(s), environ %s" % (
                numero, len(les_siens), sum(c["pages"] for c in les_siens), mo(sum(x for x in poids if x)) if all(poids) else "? (poids non estimé)"))
    for numero in tri_numeros(suivis):
        declare = numerotation(effectif, numero)
        dire("  bordereaux du chantier n° %s : %s" % (numero, {"actuelle": "numérotation actuelle déclarée", "non": "déclaré « ne rien déposer »",
                                                              None: "numérotation PAS déclarée : rien ne part de ses bordereaux (choix 6)"}.get(
            declare if not isinstance(declare, dict) else "table", "table d'anciens numéros (%d numéro(s))" % len(declare or {}))))
    dire("")
    dire("(%d document(s) déjà au carnet.)" % vu["deja"])
    if vu["silencieux"]:
        dire("PDF des bordereaux qui ne partent PAS au carnet (%d) — normal pour un devis ou un dossier technique ; si un plan pour les poseurs "
             "est dans cette liste, son numéro manque dans la table de son chantier (choix 6) :" % len(vu["silencieux"]))
        montrer_liste(dire, ["    - " + texte for texte in vu["silencieux"]])


def tout_traiter(reglages, prive, dire, carnet=True, rapatriement=True, seul=None, horloge=time.time, attente=time.sleep):
    """Le double-clic « tout traiter maintenant » : exactement le passage automatique, mais affiché. Aucune question.
    Rend le nombre de défauts (0 = tout s'est bien passé)."""
    controler_reglages(reglages)
    if seul is not None:
        dire("UN SEUL CHANTIER : le n° %s. Les autres ne sont pas touchés, et « %s » n'est pas réécrit." % (seul, A_VOIR))
    if rapatriement:
        dire("— RECOPIE DES FICHES : du Drive de l'appli vers les dossiers de chantier du PC —")
    bilan = passage(reglages, prive, dire=dire, seul=seul, fiches=rapatriement, carnet=carnet, horloge=horloge, attente=attente)
    resume = []
    if rapatriement:
        resume.append("Recopie des fiches : %d fichier(s) copié(s) dans les dossiers de chantier du PC, %d déjà présent(s)." % (bilan["copies"], bilan["deja"]))
    if carnet:
        resume.append("Carnet : %d document(s) déposé(s)%s." % (len(bilan["deposes"]),
                      " ; %d restent pour le prochain passage (limite de temps)" % bilan["reste"] if bilan["reste"] else ""))
        for d in bilan["deposes"]:
            resume.append("  DÉPOSÉ AU CARNET : " + ligne_depot(d))
        if bilan["deposes"]:
            resume.append("  Les poseurs voient ces documents quand Google Drive a fini de les envoyer (quelques minutes). "
                          "Une erreur ? choix 5 du menu (« Retirer un document du carnet »).")
    if not bilan["a_voir"]:
        resume.append("À voir : rien à signaler.")
    elif seul is None:
        resume.append("À voir : %d point(s), écrits dans « %s » (dossier qui contient tes dossiers de chantier)." % (len(bilan["a_voir"]), A_VOIR))
    else:
        resume.append("À voir : %d point(s) pour ce chantier." % len(bilan["a_voir"]))
    for ligne in bilan["a_voir"][:LISTE_MAX]:
        resume.append("  ! " + ligne)
    if bilan["copies"]:
        resume.append("PENSE À VÉRIFIER QUE MEGA A FINI DE SYNCHRONISER : les fichiers sont sur le disque du PC, la sauvegarde suit.")
    dire("")
    dire("═══ BILAN ═══")
    for ligne in resume:
        dire(ligne)
    dire("Rien n'a été supprimé, déplacé ni renommé." + ("" if not bilan["rates"] else " %d défaut(s) : lis les lignes marquées « ! » ou « PAS »." % bilan["rates"]))
    return bilan["rates"]


# ── Ligne de commande ───────────────────────────────────────────────────────
def lire_arguments(argv=None):
    a = argparse.ArgumentParser(description="Recopie les fiches de l'appli du Drive vers les dossiers de chantier du PC, et dépose au carnet les PDF "
                                            "de « À METTRE AU CARNET » et des bordereaux (lot 4c). Sans option : tout, maintenant, sans question.",
                                add_help=False,
                                usage="python outils/appli_pc.py [--auto] [--lister | --associer | --declarer NNN | --carnet | --rapatrier | --retirer | --a-voir "
                                      "| --etat | --installer-tache | --retirer-tache] [--chantier NNN]",
                                epilog="Codes de sortie : 0 fait ; 2 refus (rien n'est écrit) ; 1 erreur ou défaut (lire le bilan).")
    a.add_argument("-h", "--help", action="help", help="affiche cette aide")
    a.add_argument("--lister", action="store_true", help="montre ce qui serait fait, sans rien écrire")
    a.add_argument("--chantier", metavar="NNN", help="ne traite que ce chantier (son numéro) : pour un premier essai")
    a.add_argument("--associer", action="store_true", help="relie un dossier de chantier du PC à un dossier du Drive, quand le numéro ne suffit pas")
    a.add_argument("--declarer", metavar="NNN", help="déclare la numérotation des bordereaux d'un chantier (sans cela, rien ne part de ses bordereaux)")
    a.add_argument("--carnet", action="store_true", help="le dépôt au carnet seulement (« %s » et les bordereaux), sans question" % A_METTRE)
    a.add_argument("--rapatrier", action="store_true", help="la recopie des fiches (Drive → dossiers de chantier du PC) seulement")
    a.add_argument("--auto", action="store_true", help="aucun affichage : c'est le mode de la tâche planifiée (fiches, puis carnet)")
    a.add_argument("--retirer", action="store_true", help="retire un document du carnet (aucun fichier n'est supprimé)")
    a.add_argument("--a-voir", action="store_true", help="affiche le fichier « %s », et la date du dernier passage automatique" % A_VOIR)
    a.add_argument("--etat", action="store_true", help="une ligne, seulement si la recopie automatique n'a pas tourné depuis plus de 3 heures")
    a.add_argument("--installer-tache", action="store_true", help="crée la tâche planifiée de Windows (recopie automatique, toutes les heures)")
    a.add_argument("--retirer-tache", action="store_true", help="supprime la tâche planifiée de Windows")
    a.add_argument("--reglages", default=REGLAGES_DEFAUT, help="fichier de réglages (par défaut : _prive/depot.json)")
    return a.parse_args(argv)


def lancer(o, demander=input, dire=print, lanceur=lancer_commande):
    chemin = os.path.abspath(o.reglages)
    prive = os.path.dirname(chemin)
    options = () if chemin == os.path.abspath(REGLAGES_DEFAUT) else ("--reglages", chemin)
    seul = None
    if o.chantier is not None and str(o.chantier).strip():
        seul = str(o.chantier).strip()
        if not re.fullmatch(r"\d+", seul):
            raise Refus("Le numéro de chantier « %s » n'est pas un nombre." % seul)
    if o.etat:
        phrase, alerte = etat_auto(prive)
        if alerte:
            dire(phrase)
        return 0
    if o.auto:
        return passage_auto(chemin, seul=seul, fiches=o.rapatrier or not o.carnet, carnet=o.carnet or not o.rapatrier)
    if o.retirer_tache:
        return retirer_tache(dire, lanceur)
    reglages = lire_reglages(chemin)
    _, chantiers_pc, _ = controler_reglages(reglages)
    if o.installer_tache:
        sous_dossiers(reglages["racine"])
        return installer_tache(dire, lanceur, options=options)
    if o.a_voir:
        dire(etat_auto(prive)[0])
        dire("")
        dire(lire_a_voir(chantiers_pc) or "Le fichier « %s » n'existe pas encore : aucun passage n'a eu lieu." % A_VOIR)
        return 0
    if o.lister:
        lister(reglages, dire, seul=seul)
        return 0
    # Tous les refus prévisibles tombent ici, AVANT le verrou et le journal : un refus n'écrit rien.
    sous = sous_dossiers(reglages["racine"])
    if o.declarer is not None and not re.fullmatch(r"\d+", str(o.declarer).strip()):
        raise Refus("Le numéro de chantier « %s » n'est pas un nombre." % o.declarer)
    if o.declarer is not None and dossier_pc_du(chantiers_pc, str(o.declarer).strip())[0] is None:
        raise Refus("Chantier n° %s : %s." % (o.declarer, dossier_pc_du(chantiers_pc, str(o.declarer).strip())[1]))
    if not (o.associer or o.declarer is not None):
        lire_memoire(os.path.join(prive, MEMOIRE_FICHIER))
        un_seul(*chantiers_suivis(reglages, sous), seul)
    verrou = os.path.join(prive, VERROU_FICHIER)
    moi = prendre_verrou(verrou, dire)
    try:
        journal = Journal(os.path.join(prive, JOURNAL_DOSSIER), dire)

        def poser(question):
            r = reponse(demander, question)
            battre()                       # après chaque question : le verrou reste le nôtre
            journal.noter("%s%s" % (question, "(saisie fermée)" if r is None else r))
            return r

        journal.noter("=== Lancement : %s%s ===" % (" ".join(n for n in ("associer", "declarer", "retirer", "carnet", "rapatrier") if getattr(o, n)) or "tout",
                                                   " ; chantier %s" % seul if seul else ""))
        if o.associer:
            associer(chemin, poser, journal)
            return 0
        if o.declarer is not None:
            declarer(chemin, o.declarer, poser, journal)
            return 0
        if o.retirer:
            suivis, _ = un_seul(*chantiers_suivis(reglages, sous), seul)
            if not suivis:
                journal("Aucun chantier reconnu : rien à retirer.")
                return 0
            retirer_document(dict(reglages, chantiers=suivis), poser, journal)
            return 0
        tout = not (o.carnet or o.rapatrier)
        defauts = tout_traiter(reglages, prive, journal, carnet=tout or o.carnet, rapatriement=tout or o.rapatrier, seul=seul)
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
        print("ARRÊT demandé. Rien n'est abîmé : relance le programme, il reprendra où il en est.", file=sys.stderr)
        return 1
    except OSError as e:
        print("ARRÊT : un dossier n'a pas pu être lu ou écrit (%s). Vérifie que Google Drive pour ordinateur est démarré et que le disque "
              "des chantiers est là, puis relance : le programme reprendra où il en est." % e, file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
