# -*- coding: utf-8 -*-
"""Tests du programme du PC (outils/appli_pc.py) : correspondance, carnet depuis les bordereaux, rapatriement.

    python -m unittest tests/test_appli_pc.py        (depuis la racine du dépôt)

Tout se passe dans des dossiers temporaires : de faux dossiers de chantier du PC, un faux Drive, un faux dossier _prive,
des PDF fabriqués ici. Jamais le vrai Drive, jamais les vrais dossiers de chantier, aucun nom réel de chantier.
Aucune tâche planifiée n'est créée : les commandes de Windows passent par un faux lanceur.
"""
import contextlib
import datetime
import io
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
import unicodedata
import xml.etree.ElementTree as ET
import unittest
from unittest import mock

DEPOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(DEPOT, "outils"))

import appli_pc as ap              # noqa: E402
import depot_carnet as dc          # noqa: E402
from PIL import Image, ImageDraw   # noqa: E402

DRIVE_1, DRIVE_2 = "CHANTIER ESSAI UN", "CHANTIER ESSAI DEUX"
PC_1, PC_2 = "901 - OPERATION ESSAI UN - VILLE", "902 - OPERATION ESSAI DEUX"
D08 = "08 - DOCUMENTS ENVOYES AVEC BORDEREAU"
COTES = "05 - CHANTIER/PRISE DE COTES"
QUITUS = "05 - CHANTIER/OPR - RESERVES - QUITUS"
COMMUN = {}


def fabriquer_pdf(chemin, pages=2, cote=400):
    """Un petit PDF de « pages » pages (le côté change le poids du fichier)."""
    images = []
    for n in range(pages):
        image = Image.new("RGB", (cote, cote + 160), "white")
        trait = ImageDraw.Draw(image)
        for x in range(0, cote, 53):
            trait.line([(x, 0), (cote - x, cote + 160)], fill=(40, 40, 40), width=3)
        trait.rectangle([20 + 30 * n, 40, 170 + 30 * n, 130], outline=(200, 30, 30), width=5)
        images.append(image)
    images[0].save(chemin, "PDF", resolution=72, save_all=True, append_images=images[1:])


def setUpModule():
    temp = tempfile.mkdtemp()
    unittest.addModuleCleanup(shutil.rmtree, temp, True)
    pdf, autre = os.path.join(temp, "modele.pdf"), os.path.join(temp, "modele-refait.pdf")
    fabriquer_pdf(pdf, 2, 400)
    fabriquer_pdf(autre, 1, 430)
    assert os.path.getsize(pdf) != os.path.getsize(autre)
    COMMUN.update(temp=temp, pdf=pdf, autre=autre)


def ecrire(chemin, contenu="x"):
    os.makedirs(os.path.dirname(chemin), exist_ok=True)
    with open(chemin, "wb") as f:
        f.write(contenu.encode("utf-8") if isinstance(contenu, str) else contenu)
    return chemin


def lire(chemin):
    with open(chemin, encoding="utf-8") as f:
        return json.load(f)


def photo(dossier):
    """Tout ce qu'il y a sous le dossier : nom → « dossier », ou (taille, date de modification) pour un fichier."""
    vu = {}
    for ici, sous, fichiers in os.walk(dossier):
        for n in sous:
            vu[os.path.relpath(os.path.join(ici, n), dossier).replace(os.sep, "/")] = "dossier"
        for n in fichiers:
            etat = os.stat(os.path.join(ici, n))
            vu[os.path.relpath(os.path.join(ici, n), dossier).replace(os.sep, "/")] = (etat.st_size, etat.st_mtime_ns)
    return vu


def saisies(*reponses):
    """Une fausse saisie au clavier : rend les réponses l'une après l'autre ; la saisie est « fermée » ensuite."""
    reste = list(reponses)

    def demander(question):
        demander.questions.append(question)
        if not reste:
            raise EOFError
        return reste.pop(0)

    demander.questions = []
    demander.reste = reste
    return demander


class Monde(unittest.TestCase):
    """Un faux PC : _prive/depot.json, un faux Drive (racine) et de faux dossiers de chantier, refaits pour chaque test."""

    def setUp(self):
        self.temp = tempfile.mkdtemp(dir=COMMUN["temp"])
        self.prive = os.path.join(self.temp, "_prive")
        self.racine = os.path.join(self.temp, "drive")
        self.pc = os.path.join(self.temp, "chantiers")
        self.reglages_fichier = os.path.join(self.prive, "depot.json")
        self.memoire = os.path.join(self.prive, ap.MEMOIRE_FICHIER)
        # Les PDF des tests viennent d'être créés : le délai « deux minutes sans bouger » est mis à zéro (un test le remet)
        repos = mock.patch.object(ap, "REPOS", 0)
        repos.start()
        self.addCleanup(repos.stop)
        self.lignes = []
        # Le faux Drive
        ecrire(os.path.join(self.racine, "dossiers.json"), json.dumps({"version": 1, "documents": {"cotes": COTES}}))
        for nom in (DRIVE_1, DRIVE_2, "ADMINISTRATIF/ABSENCES", "_À CLASSER", "PLANNING", DRIVE_1 + " (1)"):
            os.makedirs(os.path.join(self.racine, nom))
        ecrire(os.path.join(self.racine, "ADMINISTRATIF/ABSENCES/ABSENCE ESSAI.pdf"), "absence")
        ecrire(os.path.join(self.racine, "_À CLASSER/QUITUS INCONNU.pdf"), "inconnu")
        # Les faux dossiers de chantier du PC
        for nom in (PC_1, PC_2, "0 - DOSSIER TYPE", "DOSSIER SANS NUMERO"):
            os.makedirs(os.path.join(self.pc, nom))
        self.reglages = {"racine": self.racine, "chantiers_pc": self.pc, "autre_cle": {"gardee": True},
                         "chantiers": {"901": {"chantier": "Chantier Essai Un", "dossier_drive": DRIVE_1}},
                         "bordereaux": {"901": "actuelle", "902": "actuelle"},      # numérotation déclarée : les bordereaux déposent
                         "anciens_codes": {"042A": "105"}}                           # une clé que le programme ne connaît plus : gardée telle quelle
        self.noter_reglages()

    def noter_reglages(self):
        ecrire(self.reglages_fichier, json.dumps(self.reglages, ensure_ascii=False))

    def dire(self, ligne=""):
        self.lignes.append(ligne)

    def texte(self):
        return "\n".join(self.lignes)

    def bordereau(self, numero, nom, modele=None, chantier=PC_1, d08=D08):
        chemin = os.path.join(self.pc, chantier, d08, "BORDEREAU %d" % numero, nom)
        os.makedirs(os.path.dirname(chemin), exist_ok=True)
        shutil.copy(modele or COMMUN["pdf"], chemin)
        return chemin

    def mettre(self, nom, modele=None, chantier=PC_1, dossier="À METTRE AU CARNET"):
        """Glisse un PDF dans le dossier « À METTRE AU CARNET » d'un dossier de chantier du PC."""
        chemin = os.path.join(self.pc, chantier, dossier, nom)
        os.makedirs(os.path.dirname(chemin), exist_ok=True)
        shutil.copy(modele or COMMUN["pdf"], chemin)
        return chemin

    def carnet_json(self, dossier=DRIVE_1):
        return lire(os.path.join(self.racine, dossier, "CARNET", "carnet.json"))

    def fiche(self, relatif, contenu="fiche", dossier=DRIVE_1):
        return ecrire(os.path.join(self.racine, dossier, relatif), contenu)

    def dans_pc(self, relatif, contenu="fiche", chantier=PC_1):
        return ecrire(os.path.join(self.pc, chantier, relatif), contenu)

    def photos(self):
        return photo(self.racine), photo(self.pc), photo(self.prive)

    def motifs(self, vu):
        return sorted(s["motif"] for s in vu["signales"])

    def lancer(self, *arguments, demander=None, lanceur=None):
        def interdit(commande):
            raise AssertionError("un test ne lance jamais une vraie commande de Windows : %r" % (commande,))

        sortie, erreur = io.StringIO(), io.StringIO()
        with contextlib.redirect_stdout(sortie), contextlib.redirect_stderr(erreur):
            code = ap.main(["--reglages", self.reglages_fichier] + list(arguments), demander=demander or saisies(), lanceur=lanceur or interdit)
        return code, sortie.getvalue(), erreur.getvalue()


class Correspondance(Monde):
    def test_numero_lu_au_debut_du_nom(self):
        self.assertEqual(ap.numero_du_dossier("901 - OPERATION ESSAI - VILLE"), "901")
        self.assertEqual(ap.numero_du_dossier("0 - DOSSIER TYPE"), "0")
        for nom, attendu in (("403 - x", "403"), ("403-x", "403"), ("403 x", "403"), ("403", "403"), ("12 -3 - X", "12"),
                             ("4031 - x", "4031"), ("403x", None), ("403.x", None), ("DOSSIER SANS NUMERO", None), ("A12 - X", None)):
            self.assertEqual(ap.numero_du_dossier(nom), attendu, nom)
        self.assertEqual(ap.dossiers_pc(self.pc), {"901": [PC_1], "902": [PC_2], "0": ["0 - DOSSIER TYPE"]})

    def test_dossiers_drive_refuses(self):
        ecrire(os.path.join(self.racine, "un fichier.txt"))
        chantiers = self.reglages["chantiers"]
        for nom, attendu in (("_À CLASSER", "technique"), ("ADMINISTRATIF", "technique"), ("administratif", "technique"),
                             ("PLANNING", "technique"), ("un fichier.txt", "n'est pas un dossier"), ("ABSENT", "n'est pas un dossier"),
                             (DRIVE_1 + " (1)", "double"), (DRIVE_1, "déjà associé au chantier n° 901"), ("..", "simple nom")):
            self.assertRegex(ap.refus_dossier_drive(self.racine, nom, chantiers, "902") or "", attendu, nom)
        os.mkdir(os.path.join(self.racine, "CALENDRIER EQUIPE"))
        self.assertRegex(ap.refus_dossier_drive(self.racine, "CALENDRIER EQUIPE", chantiers, "902", planning="Calendrier équipe".replace("é", "E")), "technique")
        os.mkdir(os.path.join(self.racine, "CHANTIER SEUL (2)"))
        self.assertIsNone(ap.refus_dossier_drive(self.racine, "CHANTIER SEUL (2)", chantiers, "902"), "« (2) » sans son jumeau : un vrai nom")
        os.rmdir(os.path.join(self.racine, "CHANTIER SEUL (2)"))
        self.assertIsNone(ap.refus_dossier_drive(self.racine, DRIVE_2, chantiers, "902"))
        self.assertIsNone(ap.refus_dossier_drive(self.racine, DRIVE_1, chantiers, "901"), "son propre dossier")
        self.assertEqual(ap.dossiers_drive_libres(self.racine, chantiers), ["CALENDRIER EQUIPE", DRIVE_2])

    def test_associer_ecrit_la_correspondance_et_garde_le_reste(self):
        # 0 : passé (Entrée) ; 902 : d'abord un dossier technique tapé à la main (refusé, et la question suivante n'est pas posée)
        demander = saisies("", "ADMINISTRATIF")
        self.assertEqual(ap.associer(self.reglages_fichier, demander, self.dire), 0)
        self.assertIn("REFUSÉ", self.texte())
        self.assertEqual(lire(self.reglages_fichier), self.reglages, "rien n'est écrit quand rien n'est associé")
        # De nouveau : 0 passé ; 902 associé par le numéro de ligne, nom de l'appli tapé
        demander = saisies("", "1", "Chantier Essai Deux")
        self.assertEqual(ap.associer(self.reglages_fichier, demander, self.dire), 1)
        self.assertEqual(demander.reste, [])
        ecrit = lire(self.reglages_fichier)
        self.assertEqual(ecrit["chantiers"]["902"], {"chantier": "Chantier Essai Deux", "dossier_drive": DRIVE_2})
        self.assertEqual(ecrit["chantiers"]["901"], self.reglages["chantiers"]["901"])
        self.assertEqual(ecrit["autre_cle"], {"gardee": True})
        self.assertEqual(ecrit["anciens_codes"], self.reglages["anciens_codes"])
        self.assertEqual(sorted(os.listdir(self.prive)), ["depot.json"], "pas de fichier temporaire oublié")
        # Tout est associé (sauf le dossier type, qu'on passe) : plus aucun dossier Drive libre
        self.lignes.clear()
        self.assertEqual(ap.associer(self.reglages_fichier, saisies("3"), self.dire), 0)
        self.assertIn("plus de dossier libre", self.texte())

    def test_associer_propose_le_nom_note_dans_le_carnet(self):
        ecrire(os.path.join(self.racine, DRIVE_2, "CARNET", "carnet.json"),
               json.dumps({"version": 1, "chantier": "Nom Vu Dans Le Carnet", "documents": []}))
        ap.associer(self.reglages_fichier, saisies("", "1", ""), self.dire)
        self.assertEqual(lire(self.reglages_fichier)["chantiers"]["902"]["chantier"], "Nom Vu Dans Le Carnet")

    def test_deux_dossiers_du_pc_du_meme_numero(self):
        os.mkdir(os.path.join(self.pc, "902 - COPIE"))
        self.assertEqual(ap.associer(self.reglages_fichier, saisies(""), self.dire), 0)
        self.assertIn("plusieurs dossiers de chantier du PC portent ce numéro", self.texte())
        self.assertEqual(ap.dossier_pc_du(self.pc, "902")[0], None)


class Carnet(Monde):
    """Ce qui part au carnet tout seul : le dossier « À METTRE AU CARNET » et les bordereaux. Aucune question."""

    def voir(self, **plus):
        return ap.documents_a_deposer(self.reglages, **plus)

    def deposer(self, **plus):
        return ap.deposer_tout(self.reglages, self.prive, self.dire, **plus)

    def test_forme_complete_et_forme_courte(self):
        complet = self.mettre("901-09 ET 10-105-a-PLANS DE RESERVATIONS DETAIL.pdf")
        self.mettre("106-B-Réservations : repérage.pdf".replace(" :", ""))
        self.bordereau(2, "901-10-104-A-REPERAGE DES PORTES.pdf")
        self.bordereau(2, "104-C-FORME COURTE DANS UN BORDEREAU.pdf")          # la forme courte ne vaut que dans « À METTRE AU CARNET »
        self.bordereau(2, "BORDEREAU D'ENVOI 2.pdf")
        avant = self.photos()
        vu = self.voir()
        self.assertEqual(self.photos(), avant, "chercher les documents n'écrit rien")
        self.assertEqual(vu["signales"], [])
        self.assertEqual([(c["id"], c["origine"], c["intitule"]) for c in vu["candidats"]],
                         [("104-A", "BORDEREAU 2", "REPERAGE DES PORTES"), ("105-A", "À METTRE AU CARNET", "PLANS DE RESERVATIONS DETAIL"),
                          ("106-B", "À METTRE AU CARNET", "Réservations repérage")])
        self.assertEqual(len(vu["silencieux"]), 1, "le bordereau lui-même n'est pas un document ; la forme courte hors de son dossier n'est pas reconnue")
        c = vu["candidats"][1]
        self.assertEqual((c["numero"], c["chantier"], c["dossier_drive"], c["pages"], c["poids"], c["chemin"]),
                         ("901", "Chantier Essai Un", DRIVE_1, 2, os.path.getsize(COMMUN["pdf"]), complet))
        self.assertEqual(c["relatif"], "/".join([PC_1, "À METTRE AU CARNET", os.path.basename(complet)]))
        texte = "\n".join(ap.decrire_candidat(c, 1, 1))
        for attendu in ("901", "Chantier Essai Un", "À METTRE AU CARNET", "2 page(s)", DRIVE_1, "105 A PLANS DE RESERVATIONS DETAIL"):
            self.assertIn(attendu, texte)

    def test_dossier_absent_et_nom_du_dossier_sans_casse_ni_forme_des_accents(self):
        self.assertEqual(self.voir(), {"candidats": [], "signales": [], "jeunes": [], "silencieux": [], "deja": 0, "sans_module": False})
        self.assertFalse(os.path.exists(os.path.join(self.pc, PC_1, "À METTRE AU CARNET")), "le programme ne crée jamais ce dossier")
        decompose = unicodedata.normalize("NFD", "à mettre au carnet")
        self.mettre("105-A-PLAN.pdf", dossier=decompose)
        self.mettre("106-A-PLAN.pdf", dossier="A METTRE AU CARNET - BROUILLONS")       # un autre dossier : ignoré
        vu = self.voir()
        self.assertEqual([(c["id"], c["origine"]) for c in vu["candidats"]], [("105-A", decompose)])
        self.assertEqual(vu["signales"], [])

    def test_ce_qui_ne_peut_pas_etre_depose_est_signale(self):
        self.mettre("902-10-105-A-PLAN D'UN AUTRE CHANTIER.pdf")
        self.mettre("PLAN SANS NUMERO.pdf")
        self.mettre("105-RDC-INDICE TROP LONG.pdf")
        self.mettre("999-A-NUMERO HORS LISTE.pdf")
        self.mettre("042A-A-ANCIEN NUMERO.pdf")           # « À METTRE AU CARNET » : numérotation d'aujourd'hui seulement
        self.mettre("106-B-BON DOCUMENT.pdf")
        self.mettre("notes.txt")
        ecrire(os.path.join(self.pc, PC_1, "À METTRE AU CARNET", "105-C-FAUX PDF.pdf"), "ceci n'est pas un PDF")
        self.bordereau(1, "902-10-106-A-AUTRE CHANTIER DANS UN BORDEREAU.pdf")
        self.bordereau(1, "901-10-999-A-DEVIS.pdf")
        self.bordereau(1, "SCAN SANS NOM.pdf")
        vu = self.voir()
        self.assertEqual([c["id"] for c in vu["candidats"]], ["106-B"])
        self.assertEqual(self.motifs(vu), ["autre-chantier", "autre-chantier", "hors-liste", "hors-liste", "illisible", "nom", "nom"])
        textes = "\n".join(x["texte"] for x in vu["signales"])
        for attendu in ("porte le n° de chantier 902, pas 901", "« PLAN SANS NUMERO.pdf » : nom non reconnu", "105-RDC-INDICE TROP LONG.pdf » : nom non reconnu",
                        "« 999 » n'est pas un document du carnet", "« 042A » n'est pas un document du carnet", "105-C-FAUX PDF.pdf » : ce n'est pas un PDF lisible"):
            self.assertIn(attendu, textes)
        # Dans un bordereau, un devis ou un scan n'est pas un souci : rien dans « A VOIR » (seul « Voir seulement » les liste)
        self.assertEqual(len(vu["silencieux"]), 2)
        self.assertRegex("\n".join(vu["silencieux"]), "901-10-999-A-DEVIS.pdf.*\n.*SCAN SANS NOM.pdf")
        # Un PDF trop gros n'est pas déposé tout seul
        with mock.patch.object(ap, "PDF_MAX", 100):
            vu = self.voir()
        self.assertEqual((vu["candidats"], "trop-gros" in self.motifs(vu)), ([], True))
        # Un chantier dont le dossier manque : signalé, rien deviné
        self.reglages["chantiers"]["905"] = {"chantier": "Cinq", "dossier_drive": DRIVE_2}
        self.assertIn("chantier", self.motifs(self.voir()))

    def test_bordereaux_d_un_chantier_non_declare_rien_n_est_depose(self):
        # Le cas grave : un bordereau à l'ANCIENNE numérotation, dont les numéros existent aussi aujourd'hui avec un autre sens
        del self.reglages["bordereaux"]
        self.bordereau(1, "901-10-001-A-DEVIS ET PRIX.pdf")
        self.bordereau(1, "901-10-002-A-PLANS DE RESERVATIONS.pdf")
        self.bordereau(2, "901-10-105-A-RESERVATIONS.pdf")
        self.bordereau(2, "BORDEREAU D'ENVOI 2.pdf")
        self.mettre("106-A-REPERAGE.pdf")
        vu = self.voir()
        self.assertEqual([(c["id"], c["origine"]) for c in vu["candidats"]], [("106-A", "À METTRE AU CARNET")], "« À METTRE AU CARNET » reste actif")
        self.assertEqual([(x["motif"], x["durable"]) for x in vu["signales"]], [("a-declarer", True)], "UNE ligne pour le chantier")
        self.assertRegex(vu["signales"][0]["texte"], "Chantier n° 901 : 3 document\\(s\\) de bordereau en attente — numérotation à déclarer")
        bilan = self.deposer()
        self.assertEqual([d["code"] for d in bilan["deposes"]], ["106"])
        self.assertEqual([d["id"] for d in self.carnet_json()["documents"]], ["106-A"], "aucun document de bordereau n'est parti")
        heure = [time.time() + 30 * 86400]
        self.assertEqual(len(self.deposer(horloge=lambda: heure[0])["a_voir"]), 1, "la ligne reste tant que ce n'est pas déclaré")
        # Deux chantiers non déclarés : UNE seule ligne « A VOIR », qui les cite tous les deux (lot 4d) ; le détail reste dans « Voir seulement »
        self.reglages["chantiers"]["902"] = {"chantier": "Chantier Essai Deux", "dossier_drive": DRIVE_2}
        self.bordereau(3, "902-10-105-A-RESERVATIONS.pdf", chantier=PC_2)
        self.assertEqual(self.deposer()["a_voir"], [
            "Numérotation des bordereaux à déclarer (appli-pc, choix 6) — 2 chantiers : n° 901 (3 PDF), n° 902 (1 PDF). Rien ne part au carnet "
            "depuis leurs bordereaux d'ici là (réponse « r » au choix 6 pour un chantier dont aucun plan ne doit partir)."])
        self.assertEqual([x["motif"] for x in self.voir()["signales"]], ["a-declarer", "a-declarer"])
        del self.reglages["chantiers"]["902"]
        # « Ne rien déposer depuis ces bordereaux » : plus de dépôt, plus de ligne
        self.reglages["bordereaux"] = {"901": "non"}
        vu = self.voir()
        self.assertEqual((vu["candidats"], vu["signales"]), ([], []))
        # Sans aucun PDF de bordereau, un chantier non déclaré ne dit rien
        del self.reglages["bordereaux"]
        shutil.rmtree(os.path.join(self.pc, PC_1, D08))
        self.assertEqual(self.voir()["signales"], [])

    def test_table_propre_au_chantier_seuls_ses_numeros_sont_deposes(self):
        self.reglages["bordereaux"] = {"901": {"002": "105", "005": "001", "011": "102"}}
        self.bordereau(1, "901-10-001-A-DEVIS ET PRIX.pdf")              # 001 existe aujourd'hui (PPSPS), mais n'est pas dans la table
        self.bordereau(1, "901-10-002-A-PLANS DE RESERVATIONS.pdf")      # ancien 002 → 105
        self.bordereau(1, "901-09 ET 10-005-B-PPSPS.pdf")                # ancien 005 → 001
        self.bordereau(1, "901-10-011-A-FICHE DE CHOIX.pdf")             # ancien 011 → 102, qui n'est pas un document du carnet
        self.bordereau(1, "901-10-105-A-DEJA AU NOUVEAU NUMERO.pdf")     # 105 est au carnet aujourd'hui, mais absent de la table
        vu = self.voir()
        self.assertEqual([(c["id"], c["ancien_code"], c["intitule"]) for c in vu["candidats"]],
                         [("001-B", "005", "PPSPS"), ("105-A", "002", "PLANS DE RESERVATIONS")])
        self.assertEqual(vu["signales"], [])
        silencieux = "\n".join(vu["silencieux"])
        for attendu in ("001-A-DEVIS ET PRIX.pdf » : numéro de document « 001 » — absent de la table de ce chantier",
                        "« 011 » → « 102 », pas un document du carnet", "DEJA AU NOUVEAU NUMERO.pdf » : numéro de document « 105 » — absent de la table"):
            self.assertIn(attendu, silencieux)
        self.assertIn("Ancien numéro 002 : déposé sous le numéro actuel 105", "\n".join(ap.decrire_candidat(vu["candidats"][1])))
        self.deposer()
        self.assertEqual([(d["id"], d["source"]["nom"]) for d in self.carnet_json()["documents"]],
                         [("001-B", "901-09 ET 10-005-B-PPSPS.pdf"), ("105-A", "901-10-002-A-PLANS DE RESERVATIONS.pdf")])
        # « À METTRE AU CARNET » ne passe jamais par la table : numérotation d'aujourd'hui
        self.mettre("002-A-TEMPS DE TACHES.pdf")
        self.assertEqual([c["id"] for c in self.voir()["candidats"]], ["002-A"])
        # Une déclaration mal écrite est refusée avant tout
        for mauvais in ("oui", ["105"], {"002": 105}):
            with self.assertRaisesRegex(dc.Refus, "« bordereaux » est mal écrit"):
                ap.controler_reglages(dict(self.reglages, bordereaux={"901": mauvais}))

    def test_declarer_la_numerotation_d_un_chantier(self):
        del self.reglages["bordereaux"]
        self.noter_reglages()
        self.bordereau(1, "901-10-002-A-PLANS DE RESERVATIONS.pdf")
        self.bordereau(1, "901-10-001-A-DEVIS ET PRIX.pdf")
        self.bordereau(2, "901-10-002-B-PLANS DE RESERVATIONS.pdf", COMMUN["autre"])
        self.bordereau(2, "SCAN.pdf")
        # Abandon : rien n'est écrit
        avant = self.photos()
        self.assertIsNone(ap.declarer(self.reglages_fichier, "901", saisies(""), self.dire))
        self.assertEqual(self.photos(), avant)
        texte = self.texte()
        for attendu in ("n° 001   (aujourd'hui, 001 est un document du carnet)", "BORDEREAU 1 — PLANS DE RESERVATIONS (indice A)",
                        "BORDEREAU 2 — PLANS DE RESERVATIONS (indice B)", "(nom hors nomenclature, jamais déposé) BORDEREAU 2 — SCAN.pdf"):
            self.assertIn(attendu, texte)
        # Ancienne numérotation : la table, numéro par numéro (une réponse fausse est redemandée ; Entrée = jamais déposé)
        demander = saisies("n", "", "999", "105")
        note = ap.declarer(self.reglages_fichier, "901", demander, self.dire)
        self.assertEqual((note, demander.reste), ({"002": "105"}, []))
        ecrit = lire(self.reglages_fichier)
        self.assertEqual(ecrit["bordereaux"], {"901": {"002": "105"}})
        self.assertEqual((ecrit["chantiers"], ecrit["autre_cle"], ecrit["anciens_codes"]),
                         (self.reglages["chantiers"], {"gardee": True}, self.reglages["anciens_codes"]), "les autres clés sont gardées")
        self.assertEqual(sorted(os.listdir(self.prive)), ["depot.json"], "pas de fichier temporaire")
        self.assertEqual([c["id"] for c in ap.documents_a_deposer(ecrit)["candidats"]], ["105-A", "105-B"])
        # Numérotation actuelle, puis « rien » ; par la ligne de commande
        code, sortie, _ = self.lancer("--declarer", "901", demander=saisies("o"))
        self.assertEqual((code, lire(self.reglages_fichier)["bordereaux"]), (0, {"901": "actuelle"}))
        self.assertIn("Déjà déclaré : une table (002 → 105)", sortie)
        self.assertEqual(self.lancer("--declarer", "901", demander=saisies("r"))[0], 0)
        self.assertEqual(lire(self.reglages_fichier)["bordereaux"], {"901": "non"})
        for numero, attendu in (("777", "aucun dossier de chantier du PC"), ("9O1", "n'est pas un nombre")):
            code, _, erreur = self.lancer("--declarer", numero, demander=saisies("o"))
            self.assertEqual(code, 2)
            self.assertIn(attendu, erreur)

    def test_nom_qui_se_lit_de_deux_facons(self):
        # Un chantier dont le numéro est aussi un numéro de document du carnet
        os.makedirs(os.path.join(self.racine, "104 - CHANTIER CENT QUATRE", "05 - CHANTIER", "PRISE DE COTES"))
        os.makedirs(os.path.join(self.pc, "104 - OPERATION"))
        self.reglages["chantiers"] = {"104": {"chantier": "Cent Quatre", "dossier_drive": "104 - CHANTIER CENT QUATRE"}}
        self.mettre("104-10-105-A-PLAN.pdf", chantier="104 - OPERATION")       # complète : 105-A ; courte : 104, indice 10
        self.mettre("106-B-PLAN.pdf", chantier="104 - OPERATION")
        self.mettre("104-C-REPERAGE.pdf", chantier="104 - OPERATION")          # courte seulement : 104-C
        vu = self.voir()
        self.assertEqual([c["id"] for c in vu["candidats"]], ["104-C", "106-B"])
        self.assertEqual(self.motifs(vu), ["ambigu"])
        self.assertRegex(vu["signales"][0]["texte"], "peut se lire de deux façons \\(document 105-A ou 104-10\\). Rien n'est déposé")
        # Sur un autre chantier, un nom qui commence par un numéro de document n'est pas pris pour « un autre chantier »
        self.reglages["chantiers"] = {"901": {"chantier": "Chantier Essai Un", "dossier_drive": DRIVE_1}}
        self.mettre("105-A-104-B REPRISE.pdf")
        vu = self.voir()
        self.assertEqual(([(c["id"], c["intitule"]) for c in vu["candidats"]], vu["signales"]), ([("105-A", "104-B REPRISE")], []))

    def test_depot_de_bout_en_bout_sans_aucune_saisie(self):
        self.mettre("105-A-RESERVATIONS DETAIL.pdf")
        self.bordereau(2, "901-10-104-A-REPERAGE DES PORTES.pdf")
        self.bordereau(2, "901-10-999-A-DEVIS.pdf")
        self.fiche(COTES + "/PRISE DE COTES ESSAI 2026-11-12.pdf")
        drive, pc, _ = self.photos()

        def interdite(question):
            raise AssertionError("le passage automatique ne pose aucune question : %r" % question)

        code, sortie, erreur = self.lancer("--auto", demander=interdite)
        self.assertEqual((code, sortie, erreur), (0, "", ""))
        # Dans le Drive : le carnet du chantier, et le relevé ; rien d'autre n'a bougé
        apres = photo(self.racine)
        nouveaux = sorted(n for n in apres if n not in drive)
        self.assertTrue(all(n.startswith(DRIVE_1 + "/CARNET") or n == DRIVE_1 + "/" + ap.INDEX for n in nouveaux), nouveaux)
        self.assertEqual({n: v for n, v in apres.items() if n in drive}, drive)
        liste = self.carnet_json()
        self.assertEqual(liste["chantier"], "Chantier Essai Un")
        self.assertEqual([(d["id"], d["intitule"], len(d["pages"]), d["source"]["nom"]) for d in liste["documents"]],
                         [("104-A", "REPERAGE DES PORTES", 2, "901-10-104-A-REPERAGE DES PORTES.pdf"),
                          ("105-A", "RESERVATIONS DETAIL", 2, "105-A-RESERVATIONS DETAIL.pdf")])
        self.assertTrue(dc.verifier(self.racine, DRIVE_1)["bon"])
        # Sur le PC : rien de supprimé, déplacé ni modifié ; en plus : la fiche recopiée, sa liste, et « A VOIR »
        apres = photo(self.pc)
        self.assertEqual({n: v for n, v in apres.items() if n in pc}, pc)
        self.assertEqual(sorted(n for n in apres if n not in pc and apres[n] != "dossier"),
                         sorted([ap.A_VOIR, PC_1 + "/" + ap.PROVENANCE, PC_1 + "/" + COTES + "/PRISE DE COTES ESSAI 2026-11-12.pdf"]))
        # Franck voit ce qui a été publié aux poseurs : dans « A VOIR » et dans le journal
        texte = ap.lire_a_voir(self.pc)
        self.assertIn("Déposé au carnet ces sept derniers jours", texte)
        self.assertRegex(texte, r"\+ \d{2}/\d{2}/\d{4} \d{2}:\d{2} — chantier n° 901 : 104 A REPERAGE DES PORTES, 2 page\(s\), depuis « BORDEREAU 2 »")
        self.assertRegex(texte, r"\+ .* chantier n° 901 : 105 A RESERVATIONS DETAIL, 2 page\(s\), depuis « À METTRE AU CARNET » \(fichier « 105-A-RESERVATIONS DETAIL.pdf »\)")
        self.assertIn("choix 5", texte)
        self.assertNotIn("DEVIS", texte, "un devis dans un bordereau n'est pas signalé")
        with open(os.path.join(self.prive, "appli-pc", "auto.txt"), encoding="utf-8") as f:
            journal = f.read()
        self.assertIn("1 fichier(s) copié(s), 2 document(s) déposé(s) au carnet, 0 en erreur", journal)
        self.assertEqual(journal.count("DÉPOSÉ AU CARNET : "), 2)
        self.assertEqual(len(lire(self.memoire)["deposes"]), 2)
        # Passage suivant : rien à refaire, rien de réécrit
        drive, pc = photo(self.racine), photo(self.pc)
        memoire = os.stat(self.memoire).st_mtime_ns
        self.assertEqual(self.lancer("--auto", demander=interdite)[0], 0)
        self.assertEqual((photo(self.racine), photo(self.pc), os.stat(self.memoire).st_mtime_ns), (drive, pc, memoire))
        self.assertEqual(self.voir()["deja"], 2)
        self.assertEqual(sorted(os.listdir(self.prive)), ["appli-pc", ap.MEMOIRE_FICHIER, "depot.json"], "le verrou est libéré")

    def test_carnet_json_sans_nom_de_chantier_quand_il_n_est_pas_sur(self):
        # Un chantier trouvé par son numéro, sans correspondance : son nom dans l'appli n'est pas connu, le nom du DOSSIER n'en est pas un
        os.makedirs(os.path.join(self.racine, "903 - CHANTIER TROIS", "05 - CHANTIER", "PRISE DE COTES"))
        os.makedirs(os.path.join(self.pc, "903 - OPERATION TROIS"))
        self.mettre("105-A-PLAN.pdf", chantier="903 - OPERATION TROIS")
        suivis, _ = ap.chantiers_suivis(self.reglages)
        self.assertIsNone(suivis["903"]["nom_appli"])
        self.assertEqual(suivis["901"]["nom_appli"], "Chantier Essai Un")
        recus = []
        vrai = dc.deposer

        def deposer(racine, dossier, chantier, *reste, **options):
            recus.append((dossier, chantier))
            return vrai(racine, dossier, chantier, *reste, **options)

        ap.deposer_tout(dict(self.reglages, chantiers=suivis), self.prive, self.dire, deposer=deposer)
        self.assertEqual(recus, [("903 - CHANTIER TROIS", None)], "jamais le nom du dossier comme nom de chantier")
        self.assertFalse(self.carnet_json("903 - CHANTIER TROIS").get("chantier"))
        # Une correspondance qui recopie le nom du dossier ne vaut pas mieux
        self.reglages["chantiers"]["903"] = {"chantier": "903 - CHANTIER TROIS", "dossier_drive": "903 - CHANTIER TROIS"}
        self.assertIsNone(ap.chantiers_suivis(self.reglages)[0]["903"]["nom_appli"])

    def test_deja_au_carnet_meme_source_rien_autre_contenu_indice_suivant(self):
        chemin = self.mettre("105-A-RESERVATIONS.pdf")
        self.assertEqual(len(self.deposer()["deposes"]), 1)
        vu = self.voir()
        self.assertEqual((vu["candidats"], vu["signales"], vu["deja"]), ([], [], 1))
        # Le même contenu arrive aussi par un bordereau, sous son nom complet : c'est le même document, rien à faire
        self.bordereau(1, "901-10-105-A-RESERVATIONS.pdf")
        vu = self.voir()
        self.assertEqual((vu["candidats"], vu["signales"], vu["deja"]), ([], [], 2))
        # Le fichier est refait sous le même indice : signalé, rien n'est écrasé
        shutil.copy(COMMUN["autre"], chemin)
        drive = photo(self.racine)
        bilan = self.deposer()
        self.assertEqual((bilan["deposes"], len(bilan["a_voir"])), ([], 1))
        self.assertRegex(bilan["a_voir"][0], "le document 105-A est déjà au carnet sous cet indice, avec un AUTRE contenu.*prends l'indice suivant")
        self.assertEqual(photo(self.racine), drive)
        # Sous l'indice suivant, il part
        os.rename(chemin, os.path.join(os.path.dirname(chemin), "105-B-RESERVATIONS.pdf"))
        self.assertEqual([d["indice"] for d in self.deposer()["deposes"]], ["B"])
        self.assertEqual([d["id"] for d in self.carnet_json()["documents"]], ["105-A", "105-B"])

    def test_signalements_durables_et_signalements_des_bordereaux(self):
        mal_nomme = self.mettre("PLAN SANS NUMERO.pdf")
        self.bordereau(1, "902-10-105-A-AUTRE CHANTIER.pdf")
        heure = [time.time()]
        bilan = self.deposer(horloge=lambda: heure[0])
        self.assertEqual(len(bilan["a_voir"]), 2)
        note = lire(self.memoire)["signales"]
        self.assertEqual([(m["chemin"], m["motif"]) for m in note], [(PC_1 + "/" + D08 + "/BORDEREAU 1/902-10-105-A-AUTRE CHANTIER.pdf", "autre-chantier")],
                         "seul le signalement du bordereau a besoin d'être retenu")
        # Les passages suivants : les mêmes lignes (« A VOIR » n'est donc pas réécrit), la mémoire n'est pas réécrite
        date = os.stat(self.memoire).st_mtime_ns
        for _ in range(3):
            heure[0] += 3600
            self.assertEqual(self.deposer(horloge=lambda: heure[0])["a_voir"], bilan["a_voir"])
        self.assertEqual(os.stat(self.memoire).st_mtime_ns, date)
        # Au bout de sept jours : le signalement du BORDEREAU se tait ; celui de « À METTRE AU CARNET » reste tant que la cause est là
        heure[0] += 30 * 86400
        restent = self.deposer(horloge=lambda: heure[0])["a_voir"]
        self.assertEqual(len(restent), 1)
        self.assertIn("PLAN SANS NUMERO.pdf » : nom non reconnu", restent[0])
        # Un chantier entier qui ne peut rien déposer (sa liste du carnet est illisible) : dit sans limite de durée aussi
        ecrire(os.path.join(self.racine, DRIVE_1, "CARNET", "carnet.json"), "{ illisible")
        for jours in (0, 8, 300):
            lignes = self.deposer(horloge=lambda: heure[0] + jours * 86400)["a_voir"]
            self.assertEqual(len(lignes), 1, jours)
            self.assertRegex(lignes[0], "Chantier n° 901 : rien n'est déposé au carnet.*illisible")
        os.remove(os.path.join(self.racine, DRIVE_1, "CARNET", "carnet.json"))
        # La cause disparaît : la ligne aussi
        os.remove(mal_nomme)
        self.assertEqual(self.deposer(horloge=lambda: heure[0])["a_voir"], [])
        # Un essai sur un seul chantier ne retient rien
        os.remove(self.memoire)
        self.assertEqual(len(self.deposer(memoriser=False)["a_voir"]), 1)
        self.assertFalse(os.path.exists(self.memoire))

    def test_conflit_entre_a_mettre_au_carnet_et_un_bordereau(self):
        self.mettre("105-A-RESERVATIONS.pdf")
        self.bordereau(1, "901-10-105-A-RESERVATIONS.pdf", COMMUN["autre"])
        self.mettre("106-A-REPERAGE.pdf")
        self.bordereau(1, "901-10-106-A-REPERAGE.pdf")                      # le même contenu des deux côtés : un seul dépôt
        avant = photo(self.pc)
        bilan = self.deposer()
        self.assertEqual([(d["code"], d["origine"]) for d in bilan["deposes"]], [("106", "À METTRE AU CARNET")])
        self.assertEqual(len(bilan["a_voir"]), 2, "le conflit est dit pour chacun des deux fichiers")
        self.assertRegex(bilan["a_voir"][0], "le document 105-A existe en plusieurs exemplaires de contenus DIFFÉRENTS.*Rien n'est déposé")
        self.assertEqual([d["id"] for d in self.carnet_json()["documents"]], ["106-A"])
        self.assertEqual(photo(self.pc), avant, "rien n'est supprimé ni déplacé dans les dossiers du PC")

    def test_meme_document_dans_deux_bordereaux_le_plus_recent(self):
        ancien = self.bordereau(1, "901-10-105-A-RESERVATIONS.pdf")
        recent = self.bordereau(3, "901-10-105-A-RESERVATIONS.pdf", COMMUN["autre"])
        os.utime(ancien, (1700000000, 1700000000))
        os.utime(recent, (1750000000, 1750000000))
        vu = self.voir()
        self.assertEqual([(c["origine"], c["pages"]) for c in vu["candidats"]], [("BORDEREAU 3", 1)])
        self.assertEqual(vu["signales"], [])

    def test_fichier_qui_vient_d_arriver_attendu_puis_depose(self):
        chemin = self.mettre("105-A-RESERVATIONS.pdf")
        heure, attentes = [time.time()], []

        def patienter(secondes):
            attentes.append(secondes)
            heure[0] += secondes

        with mock.patch.object(ap, "REPOS", 120):
            self.assertEqual([d["fichier"] for d in self.voir(horloge=lambda: heure[0])["jeunes"]], ["105-A-RESERVATIONS.pdf"])
            bilan = self.deposer(horloge=lambda: heure[0], attente=patienter)
            self.assertEqual((len(attentes), 100 < attentes[0] <= 125), (1, True), "on lui laisse deux minutes, une fois")
            self.assertEqual(([d["code"] for d in bilan["deposes"]], bilan["a_voir"]), (["105"], []))
            # Un fichier qui bouge encore après l'attente (copie en cours) : pas déposé, signalé, repris au passage suivant
            autre = self.mettre("106-A-REPERAGE.pdf")
            os.utime(autre, (heure[0], heure[0]))
            bilan = self.deposer(horloge=lambda: heure[0], attente=lambda secondes: None)
            self.assertEqual((bilan["deposes"], bilan["a_voir"]), ([], []), "rien à faire : ce n'est pas un point d'action")
            self.assertRegex(bilan["infos"][0], "106-A-REPERAGE.pdf » : fichier encore en cours d'écriture")
            heure[0] += 3600
            self.assertEqual([d["code"] for d in self.deposer(horloge=lambda: heure[0], attente=patienter)["deposes"]], ["106"])
        self.assertTrue(os.path.isfile(chemin) and os.path.isfile(autre), "les PDF restent où Franck les a mis")

    def test_limite_de_temps_puis_reprise(self):
        self.mettre("105-A-RESERVATIONS.pdf")
        self.mettre("106-A-REPERAGE.pdf")
        vrai, appels = dc.deposer, []

        def presse(*arguments, **options):
            appels.append(arguments[4])
            if len(appels) == 1:                     # la limite de temps tombe après la première page
                instants = [0, 0]
                options.update(limite=150, horloge=lambda: instants.pop(0) if instants else 1000)
            return vrai(*arguments, **options)

        bilan = self.deposer(deposer=presse)
        self.assertEqual((bilan["deposes"], bilan["reste"], bilan["erreurs"], appels), ([], 2, 0, ["105"]), "arrêt propre : on ne commence pas le suivant")
        self.assertIn("Pas fini (1 page(s) sur 2)", self.texte())
        self.assertFalse(os.path.exists(os.path.join(self.racine, DRIVE_1, "CARNET", "carnet.json")), "rien n'est annoncé aux poseurs avant la fin")
        # L'heure limite déjà passée : aucun dépôt n'est commencé
        bilan = self.deposer(fin=time.time() - 1)
        self.assertEqual((bilan["deposes"], bilan["reste"]), ([], 2))
        # Passage suivant : le premier document reprend page par page, le second suit
        self.lignes.clear()
        bilan = self.deposer()
        self.assertEqual(([d["code"] for d in bilan["deposes"]], bilan["reste"], bilan["erreurs"]), (["105", "106"], 0, 0))
        self.assertIn("déjà faite", self.texte())
        self.assertTrue(dc.verifier(self.racine, DRIVE_1)["bon"])

    def test_module_absent_signale_et_la_recopie_des_fiches_continue(self):
        self.mettre("105-A-RESERVATIONS.pdf")
        self.fiche(COTES + "/A.pdf", "a")

        def absent(chemin):
            raise dc.Refus("Module manquant (pypdfium2).")

        with mock.patch.object(ap, "nombre_de_pages", absent):
            vu = ap.documents_a_deposer(self.reglages, compter_pages=absent)
            self.assertEqual((vu["candidats"], vu["sans_module"]), ([], True))
            bilan = ap.deposer_tout(self.reglages, self.prive, self.dire, compter_pages=absent)
            self.assertEqual((bilan["deposes"], bilan["erreurs"], bilan["sans_module"]), ([], 0, True))
            self.assertRegex(bilan["a_voir"][0], "Le dépôt au carnet ne peut pas se faire sur ce PC : un module de Python manque.*pip install")
        with mock.patch.object(ap.deposer_tout, "__defaults__", ap.deposer_tout.__defaults__[:-1] + (absent,)):
            self.assertEqual(self.lancer("--auto")[0], 0)
        self.assertTrue(os.path.isfile(os.path.join(self.pc, PC_1, COTES, "A.pdf")), "la recopie des fiches s'est faite quand même")
        self.assertIn("un module de Python manque", ap.lire_a_voir(self.pc))
        self.assertFalse(os.path.exists(os.path.join(self.racine, DRIVE_1, "CARNET")))

    def test_une_erreur_sur_un_document_n_arrete_pas_les_autres(self):
        self.mettre("105-A-RESERVATIONS.pdf")
        self.mettre("106-A-REPERAGE.pdf")
        self.mettre("107-A-HUISSERIES.pdf")
        self.fiche(COTES + "/A.pdf", "a")
        vrai = dc.deposer

        def plante(*arguments, **options):
            if arguments[4] == "106":
                raise ZeroDivisionError("le rendu de la page a planté")      # ni un refus, ni une erreur de disque
            return vrai(*arguments, **options)

        with mock.patch.object(ap.dc, "deposer", plante):
            code = self.lancer("--auto")[0]
            self.assertEqual(code, 1)
            # Le 1er et le 3e sont déposés ; tout est écrit : « A VOIR », la mémoire, le journal
            self.assertEqual([d["id"] for d in self.carnet_json()["documents"]], ["105-A", "107-A"])
            texte = ap.lire_a_voir(self.pc)
            self.assertRegex(texte, "106-A-REPERAGE.pdf » : pas déposé \\(ZeroDivisionError : le rendu de la page a planté\\). Le prochain passage réessaiera")
            self.assertRegex(texte, r"\+ .*105 A RESERVATIONS")
            self.assertRegex(texte, r"\+ .*107 A HUISSERIES")
            memoire = lire(self.memoire)
            self.assertEqual(([d["code"] for d in memoire["deposes"]], [(e["n"], e["chemin"].split("/")[-1]) for e in memoire["echecs"]]),
                             (["105", "107"], [(1, "106-A-REPERAGE.pdf")]))
            self.assertTrue(os.path.isfile(os.path.join(self.pc, PC_1, COTES, "A.pdf")))
            with open(os.path.join(self.prive, "appli-pc", "auto.txt"), encoding="utf-8") as f:
                self.assertIn("2 document(s) déposé(s) au carnet, 1 en erreur", f.read())
            # Après trois échecs, il n'est plus retenté à chaque heure : signalé, il attend que le fichier change
            appels = []
            with mock.patch.object(ap.dc, "deposer", lambda *a, **o: appels.append(a[4]) or plante(*a, **o)):
                self.assertEqual(self.lancer("--auto")[0], 1)
                self.assertEqual(self.lancer("--auto")[0], 1)
                self.assertIn("Troisième échec", ap.lire_a_voir(self.pc))
                self.assertEqual(self.lancer("--auto")[0], 0)
                self.assertEqual(self.lancer("--auto")[0], 0)
            self.assertEqual(appels, ["106", "106"], "deux essais de plus, puis plus aucun")
            self.assertRegex(ap.lire_a_voir(self.pc), "106-A-REPERAGE.pdf » : le dépôt au carnet a échoué 3 fois .* ne sera plus retenté tant que ce fichier ne change")
        # Le fichier est refait : il est retenté, et cette fois déposé
        shutil.copy(COMMUN["autre"], os.path.join(self.pc, PC_1, "À METTRE AU CARNET", "106-A-REPERAGE.pdf"))
        self.assertEqual(self.lancer("--auto")[0], 0)
        self.assertEqual([d["id"] for d in self.carnet_json()["documents"]], ["105-A", "107-A", "106-A"])
        self.assertEqual(lire(self.memoire)["echecs"], [])
        self.assertNotIn("échoué", ap.lire_a_voir(self.pc))

    def test_refus_ou_erreur_de_disque_puis_suite(self):
        self.mettre("105-A-RESERVATIONS.pdf")
        self.mettre("106-A-REPERAGE.pdf")
        self.mettre("107-A-HUISSERIES.pdf")
        vrai = dc.deposer

        def capricieux(*arguments, **options):
            if arguments[4] == "105":
                raise dc.Refus("refus simulé")
            if arguments[4] == "106":
                raise PermissionError("Drive occupé")
            return vrai(*arguments, **options)

        bilan = self.deposer(deposer=capricieux)
        self.assertEqual(([d["code"] for d in bilan["deposes"]], bilan["erreurs"]), (["107"], 1), "un refus n'est pas une erreur du programme")
        textes = "\n".join(bilan["a_voir"])
        self.assertIn("105-A-RESERVATIONS.pdf » : pas déposé (refus simulé). Le prochain passage réessaiera.", textes)
        self.assertIn("106-A-REPERAGE.pdf » : pas déposé (Drive occupé). Le prochain passage réessaiera.", textes)
        self.assertEqual([d["code"] for d in self.deposer()["deposes"]], ["105", "106"])
        self.assertEqual(lire(self.memoire)["echecs"], [])

    def test_document_retire_n_est_pas_redepose(self):
        chemin = self.mettre("105-A-RESERVATIONS.pdf")
        self.deposer()
        avant = photo(self.racine)
        rendu = ap.retirer_document(self.reglages, saisies("1", "1", "o"), self.dire)
        self.assertEqual(rendu["id"], "105-A")
        self.assertEqual(set(photo(self.racine)), set(avant), "retirer ne supprime aucun fichier")
        bilan = self.deposer()
        self.assertEqual((bilan["deposes"], bilan["a_voir"]), ([], []), "retiré par Franck : il ne revient pas tout seul")
        self.assertIs(self.carnet_json()["documents"][0]["retire"], True)
        shutil.copy(COMMUN["autre"], chemin)
        bilan = self.deposer()
        self.assertEqual(bilan["deposes"], [])
        self.assertRegex(bilan["a_voir"][0], r"AUTRE contenu \(il en a été retiré\).*prends l'indice suivant")
        for reponses in ((), ("",), ("7",), ("1", ""), ("1", "1", ""), ("1", "1", "n")):
            self.assertIsNone(ap.retirer_document(self.reglages, saisies(*reponses), self.dire))

    def test_le_verrou_est_rafraichi_apres_chaque_page_deposee(self):
        self.mettre("105-A-RESERVATIONS.pdf")
        battements = []
        with mock.patch.object(ap, "battre", lambda: battements.append(1)):
            self.deposer()
        self.assertEqual(len(battements), 3, "la ligne d'en-tête du dépôt, puis chacune des deux pages")

    def test_options_separees_en_automatique(self):
        self.mettre("105-A-RESERVATIONS.pdf")
        self.fiche(COTES + "/A.pdf", "a")
        self.assertEqual(self.lancer("--rapatrier", "--auto")[0], 0)
        self.assertTrue(os.path.isfile(os.path.join(self.pc, PC_1, COTES, "A.pdf")))
        self.assertFalse(os.path.exists(os.path.join(self.racine, DRIVE_1, "CARNET")), "--rapatrier : pas de dépôt")
        self.fiche(COTES + "/B.pdf", "b")
        self.assertEqual(self.lancer("--carnet", "--auto")[0], 0)
        self.assertEqual([d["id"] for d in self.carnet_json()["documents"]], ["105-A"])
        self.assertFalse(os.path.exists(os.path.join(self.pc, PC_1, COTES, "B.pdf")), "--carnet : pas de recopie")
        # « A VOIR » garde la section des dépôts quand un passage « fiches seulement » le réécrit
        self.fiche(COTES + "/Lien.gdoc", "{}")
        self.assertEqual(self.lancer("--rapatrier", "--auto")[0], 0)
        texte = ap.lire_a_voir(self.pc)
        self.assertIn("raccourci Google", texte)
        self.assertRegex(texte, r"\+ .*105 A RESERVATIONS")


class Rapatriement(Monde):
    def setUp(self):
        super().setUp()
        self.instant = datetime.datetime(2026, 11, 13, 7, 30, tzinfo=datetime.timezone.utc)

    def rapatrier(self, **plus):
        return ap.rapatrier(self.reglages, "901", dire=self.dire, maintenant=plus.pop("maintenant", self.instant), **plus)

    def provenance(self):
        return lire(os.path.join(self.pc, PC_1, ap.PROVENANCE))

    def index(self):
        return lire(os.path.join(self.racine, DRIVE_1, ap.INDEX))

    def test_sous_dossiers_par_defaut_et_table_du_serveur(self):
        with open(os.path.join(DEPOT, "apps-script", "Dossiers.gs"), encoding="utf-8") as f:
            bloc = re.search(r"const DOSSIERS_DEFAUT = \{.*?documents: \{(.*?)\n  \},", f.read(), re.S).group(1)
        self.assertEqual(dict(re.findall(r"'([^']+)':\s*'([^']+)'", bloc)), ap.DOCUMENTS_DEFAUT, "même table que le serveur")
        ecrire(os.path.join(self.racine, "dossiers.json"), json.dumps({"documents": {
            "photos": "05 - CHANTIER/PHOTOS", "note": "../AILLEURS", "carnet": "PLANS VALIDES", "nouvelle": "05 - CHANTIER/NOUVEAU"}}))
        sous = ap.sous_dossiers(self.racine)
        fiches = ["/".join(m) for m in sous["fiches"]]
        self.assertIn("05 - CHANTIER/PHOTOS", fiches, "le fichier l'emporte")
        self.assertNotIn("05 - CHANTIER/PHOTOS CHANTIER", fiches)
        self.assertIn("05 - CHANTIER/COMPTE RENDU", fiches, "valeur dangereuse : valeur par défaut")
        self.assertIn("05 - CHANTIER/SIGNALEMENTS", fiches, "clé absente du fichier : valeur par défaut")
        self.assertIn("05 - CHANTIER/NOUVEAU", fiches)
        self.assertEqual(len(fiches), len(set(fiches)), "un sous-dossier commun à trois fiches n'est parcouru qu'une fois")
        self.assertEqual(sorted("/".join(m) for m in sous["exclus"]), ["PLANS VALIDES", "Plans"])
        ecrire(os.path.join(self.racine, "dossiers.json"), "{ illisible")
        with self.assertRaisesRegex(dc.Refus, "illisible"):
            ap.sous_dossiers(self.racine)

    def test_copie_et_tous_les_cas_signales(self):
        f = self.fiche
        copies = {COTES + "/PRISE DE COTES ESSAI 2026-11-12.pdf": "cotes du 12",
                  QUITUS + "/QUITUS ESSAI 2026-11-12.pdf": "quitus",
                  QUITUS + "/LOT 2/ATTESTATION ESSAI 2026-11-12_V2.pdf": "attestation dans un sous-dossier",
                  "05 - CHANTIER/SIGNALEMENTS/SIGNALEMENT ESSAI 2026-11-10.jpg": "photo",
                  "07 - ATELIER/FICHE FABRICATION ESSAI 2026-11-11.pdf": "fabrication"}
        for relatif, contenu in copies.items():
            os.utime(f(relatif, contenu), (1760000000, 1760000000))
        f(COTES + "/DEJA LA.pdf", "le même")
        self.dans_pc(COTES + "/DEJA LA.pdf", "le même")
        f(COTES + "/AUTRE TAILLE.pdf", "version du Drive")
        self.dans_pc(COTES + "/AUTRE TAILLE.pdf", "version du PC, plus longue")
        f(COTES + "/Compte rendu.gdoc", "{}")
        f(COTES + "/Tableau.GSHEET", "{}")
        f(COTES + "/PRISE DE COTES ESSAI 2026-11-12 (1).pdf", "doublon")
        f(COTES + " (1)/DANS UN DOSSIER EN DOUBLE.pdf", "hors")
        f(QUITUS + "/COPIES (2)/QUITUS.pdf", "dans un dossier en double")
        copies[QUITUS + "/COPIES/ORIGINAL.pdf"] = "le dossier d'origine du doublon"
        copies["05 - CHANTIER/PHOTOS CHANTIER/IMG (12).jpg"] = "« (12) » sans jumeau : une vraie photo, copiée"
        copies["05 - CHANTIER/PHOTOS CHANTIER/Façade (2)/vue.jpg"] = "un dossier « (2) » sans jumeau : un vrai dossier"
        for relatif in list(copies)[-3:]:
            os.utime(f(relatif, copies[relatif]), (1760000000, 1760000000))
        f(COTES + "/MEME TAILLE.pdf", "contenu A")
        self.dans_pc(COTES + "/MEME TAILLE.pdf", "contenu B")
        f(COTES + "/RESTE.pdf.partiel", "reste d'une écriture")
        self.dans_pc(COTES + "/VIEUX.pdf.partiel", "reste d'une copie")
        f(COTES + "/desktop.ini", "systeme")
        f("Divers/ANCIEN.pdf", "hors rangement")
        f("A LA RACINE.pdf", "hors rangement")
        f("CARNET/carnet.json", "{}")
        f("CARNET/105 A PLAN/p1-net.webp", "image")
        f("Plans/ANCIEN PLAN.pdf", "plan")
        f("desktop.ini", "systeme")
        long = QUITUS + "/" + "L" * 200 + ".pdf"
        f(long, "long")
        self.dans_pc("05 - CHANTIER/COMPTE RENDU/CR MOE 12.pdf", "compte rendu de la maîtrise d'œuvre")
        self.dans_pc("02 - MARCHE/DEVIS.pdf", "devis")
        self.dans_pc(COTES + "/0-OLD/ANCIENNE.pdf", "archive")
        drive, pc, _ = self.photos()

        plan = self.rapatrier()

        # Ce qui est copié : au même chemin, même contenu, même date ; les sous-dossiers manquants sont créés
        self.assertEqual(sorted(a["chemin"] for a in plan["copies"]), sorted(copies))
        for relatif, contenu in copies.items():
            cible = os.path.join(self.pc, PC_1, relatif)
            with open(cible, encoding="utf-8") as lu:
                self.assertEqual(lu.read(), contenu)
            self.assertEqual(int(os.path.getmtime(cible)), 1760000000)
        self.assertEqual([a["chemin"] for a in plan["deja"]], [COTES + "/DEJA LA.pdf", COTES + "/MEME TAILLE.pdf"])
        self.assertEqual(plan["erreurs"], [])
        # Ce qui est signalé sans être copié
        signales = {}
        for s in plan["signales"]:
            signales.setdefault(s["motif"], []).append(s["chemin"])
        self.assertEqual({m: sorted(c) for m, c in signales.items()}, {
            "taille-differente": [COTES + "/AUTRE TAILLE.pdf"],
            "autre-contenu": [COTES + "/MEME TAILLE.pdf"],
            "raccourci": [COTES + "/Compte rendu.gdoc", COTES + "/Tableau.GSHEET"],
            "doublon": sorted([COTES + "/PRISE DE COTES ESSAI 2026-11-12 (1).pdf", QUITUS + "/COPIES (2)/QUITUS.pdf"]),
            "hors-rangement": sorted([COTES + " (1)/DANS UN DOSSIER EN DOUBLE.pdf", "Divers/ANCIEN.pdf", "A LA RACINE.pdf"]),
            "trop-long": [long]})
        with open(os.path.join(self.pc, PC_1, COTES, "AUTRE TAILLE.pdf"), encoding="utf-8") as lu:
            self.assertEqual(lu.read(), "version du PC, plus longue", "jamais écrasé")
        # Le faux Drive : seul releve-pc.json est apparu ; rien n'a été modifié ni supprimé
        apres = photo(self.racine)
        self.assertEqual(sorted(set(apres) - set(drive)), [DRIVE_1 + "/" + ap.INDEX])
        self.assertEqual({n: v for n, v in apres.items() if n in drive}, drive)
        # Les faux dossiers du PC : rien de modifié ni supprimé ; en plus, les copies, leurs dossiers et la liste de provenance
        apres = photo(self.pc)
        self.assertEqual({n: v for n, v in apres.items() if n in pc}, pc)
        ajoutes = {n for n in apres if n not in pc and apres[n] != "dossier"}
        self.assertEqual(ajoutes, {PC_1 + "/" + c for c in copies} | {PC_1 + "/" + ap.PROVENANCE})
        for interdit in ("ADMINISTRATIF", "ABSENCE", "CARNET", "Plans", "_À CLASSER", ".partiel", ".tmp"):
            self.assertFalse([n for n in apres if interdit in n and n not in pc], interdit)
        with open(os.path.join(self.pc, PC_1, COTES, "MEME TAILLE.pdf"), encoding="utf-8") as lu:
            self.assertEqual(lu.read(), "contenu B", "jamais écrasé")
        self.assertEqual(ap.a_classer(self.racine), ["QUITUS INCONNU.pdf"])

        # (a) La liste de provenance, dans le dossier du chantier sur le PC
        provenance = self.provenance()
        self.assertEqual(sorted(provenance), ["chantier", "differents", "fichiers", "numero", "version"])
        self.assertEqual([(d["chemin"], d["taille"]) for d in provenance["differents"]], [(COTES + "/MEME TAILLE.pdf", 9)])
        self.assertEqual((provenance["version"], provenance["chantier"], provenance["numero"]), (1, "Chantier Essai Un", "901"))
        self.assertEqual(sorted(e["chemin"] for e in provenance["fichiers"]), sorted(list(copies) + [COTES + "/DEJA LA.pdf"]))
        for e in provenance["fichiers"]:
            # « déjà présent » : inscrit seulement après comparaison du contenu, et c'est noté
            deja = e["chemin"] == COTES + "/DEJA LA.pdf"
            self.assertEqual(sorted(e), ["chemin", "copie_le", "date", "taille", "verifie"] if deja else ["chemin", "copie_le", "date", "taille"])
            self.assertEqual(e["date"], int(os.path.getmtime(os.path.join(self.racine, DRIVE_1, e["chemin"]))), "la date de la fiche du Drive est notée")
            self.assertEqual(e.get("verifie"), "contenu" if deja else None)
            self.assertEqual(e["taille"], os.path.getsize(os.path.join(self.pc, PC_1, e["chemin"])))
            self.assertEqual(e["copie_le"], "2026-11-13T08:30:00+01:00")
        self.assertEqual(plan["ajoutes"], 9)
        # (b) Le relevé de présence, dans le Drive : format exact du contrat
        index = self.index()
        self.assertEqual(list(index), ["version", "chantier", "numero", "releve_le", "fichiers"])
        self.assertEqual((index["version"], index["chantier"], index["numero"], index["releve_le"]),
                         (1, "Chantier Essai Un", "901", "2026-11-13T08:30:00+01:00"))
        attendus = sorted(list(copies) + [COTES + "/DEJA LA.pdf"])
        self.assertEqual([e["chemin"] for e in index["fichiers"]], attendus,
                         "seulement les fiches du Drive qui sont à leur place sur le PC : ni les documents de Franck (CR de la MOE, 0-OLD), "
                         "ni un fichier d'une autre taille ou d'un autre contenu, ni un reste « .partiel »")
        for e in index["fichiers"]:
            self.assertEqual(list(e), ["chemin", "taille"])
            self.assertEqual(e["taille"], os.path.getsize(os.path.join(self.pc, PC_1, e["chemin"])))
            self.assertNotIn("\\", e["chemin"])
        self.assertEqual(plan["releve"], len(attendus))
        texte = self.texte()
        self.assertNotIn(self.racine, texte)
        self.assertNotIn(self.pc, texte)

    def test_relance_cumul_et_fiche_deplacee_par_franck(self):
        self.fiche(COTES + "/A.pdf", "a")
        self.fiche(COTES + "/B.pdf", "bb")
        self.rapatrier()
        premiere = self.provenance()
        # Relance sans rien de neuf : rien n'est copié, la liste de provenance n'est pas réécrite, le relevé est refait
        date = os.stat(os.path.join(self.pc, PC_1, ap.PROVENANCE)).st_mtime_ns
        plus_tard = self.instant + datetime.timedelta(days=200)
        plan = self.rapatrier(maintenant=plus_tard)
        self.assertEqual((plan["copies"], len(plan["deja"]), plan["ajoutes"]), ([], 2, 0))
        self.assertEqual(os.stat(os.path.join(self.pc, PC_1, ap.PROVENANCE)).st_mtime_ns, date)
        self.assertEqual(self.index()["releve_le"], "2027-06-01T09:30:00+02:00", "heure d'été")
        # Franck a rangé A.pdf ailleurs dans le dossier du chantier, et une nouvelle fiche est arrivée
        os.makedirs(os.path.join(self.pc, PC_1, COTES, "0-OLD"))
        shutil.move(os.path.join(self.pc, PC_1, COTES, "A.pdf"), os.path.join(self.pc, PC_1, COTES, "0-OLD", "A.pdf"))
        self.fiche(COTES + "/C.pdf", "ccc")
        plan = self.rapatrier(maintenant=plus_tard)
        self.assertEqual([a["chemin"] for a in plan["copies"]], [COTES + "/C.pdf"], "A, déjà copié une fois, n'est JAMAIS recopié : son choix est respecté")
        self.assertFalse(os.path.exists(os.path.join(self.pc, PC_1, COTES, "A.pdf")))
        self.assertEqual([(x["motif"], x["chemin"]) for x in plan["signales"]], [("absente", COTES + "/A.pdf")])
        # « A VOIR » (lot 4d) : pas un point d'action, une ligne « pour information » avec le nombre ; le détail reste à l'écran
        self.assertEqual(ap.lignes_a_voir(plan), [])
        self.assertEqual(ap.info_a_voir(plan), "Chantier n° 901 : 1 fiche de l'appli absente du dossier du PC (déplacée ou supprimée par toi : "
                                               "pas recopiée) (détail : appli-pc, choix 2 « Voir seulement »).")
        self.lignes = []
        ap.dire_rapatriement(plan, self.dire)
        self.assertRegex(self.texte(), "fiche de l'appli absente du dossier du PC : déplacée ou supprimée \\?.*\n.*A\\.pdf")
        provenance = self.provenance()
        self.assertEqual([e["chemin"] for e in provenance["fichiers"]], [COTES + "/A.pdf", COTES + "/B.pdf", COTES + "/C.pdf"], "jamais de doublon")
        self.assertEqual(provenance["fichiers"][1], premiere["fichiers"][1], "les entrées existantes sont gardées telles quelles")
        self.assertEqual({k: v for k, v in provenance["fichiers"][0].items() if k != "absente_signalee_le"}, premiere["fichiers"][0])
        self.assertEqual(provenance["fichiers"][0]["absente_signalee_le"], "2027-06-01T09:30:00+02:00")
        self.assertEqual(provenance["fichiers"][2]["copie_le"], "2027-06-01T09:30:00+02:00")
        self.assertEqual([e["chemin"] for e in self.index()["fichiers"]], [COTES + "/B.pdf", COTES + "/C.pdf"], "A n'est plus à sa place : pas au relevé")
        # Les jours suivants : même ligne (le fichier « A VOIR » ne change donc pas) ; au bout de sept jours, on n'en parle plus
        date = os.stat(os.path.join(self.pc, PC_1, ap.PROVENANCE)).st_mtime_ns
        plan = self.rapatrier(maintenant=plus_tard + datetime.timedelta(days=3))
        self.assertEqual(([x["motif"] for x in plan["signales"]], plan["copies"]), (["absente"], []))
        self.assertEqual(os.stat(os.path.join(self.pc, PC_1, ap.PROVENANCE)).st_mtime_ns, date)
        plan = self.rapatrier(maintenant=plus_tard + datetime.timedelta(days=8))
        self.assertEqual((plan["signales"], plan["copies"], len(plan["absentes"])), ([], [], 1))
        self.assertEqual(sorted(os.listdir(os.path.join(self.pc, PC_1, COTES))), ["0-OLD", "B.pdf", "C.pdf"])
        # Une entrée dont le fichier a disparu du dossier du PC ET du Drive reste dans la liste, telle quelle
        self.reglages["chantiers"]["902"] = {"chantier": "Deux", "dossier_drive": DRIVE_2}
        ecrire(os.path.join(self.pc, PC_2, ap.PROVENANCE), json.dumps(
            {"version": 1, "chantier": "Deux", "numero": "902", "note": "gardée", "fichiers": [{"chemin": COTES + "/PARTI.pdf", "taille": 5, "copie_le": "x"}]}))
        self.fiche(COTES + "/NOUVEAU.pdf", "n", dossier=DRIVE_2)
        ap.rapatrier(self.reglages, "902", dire=self.dire)
        liste = lire(os.path.join(self.pc, PC_2, ap.PROVENANCE))
        self.assertEqual(liste["fichiers"][0], {"chemin": COTES + "/PARTI.pdf", "taille": 5, "copie_le": "x"})
        self.assertEqual((liste["note"], [e["chemin"] for e in liste["fichiers"]][1:]), ("gardée", [COTES + "/NOUVEAU.pdf"]))
        self.assertRegex(liste["fichiers"][1]["copie_le"], r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+0[12]:00$")

    def test_fiche_nouvelle_sous_le_nom_d_une_ancienne(self):
        source = self.fiche(COTES + "/QUITUS.pdf", "premier quitus")
        self.rapatrier()
        sur_pc = os.path.join(self.pc, PC_1, COTES, "QUITUS.pdf")
        # Franck range la fiche ailleurs ; dans le Drive, l'ancienne est supprimée et une AUTRE fiche prend son nom (autre taille)
        os.makedirs(os.path.join(self.pc, PC_1, "06 - COURRIER"))
        shutil.move(sur_pc, os.path.join(self.pc, PC_1, "06 - COURRIER", "QUITUS.pdf"))
        ecrire(source, "un second quitus, plus long que le premier")
        plus_tard = self.instant + datetime.timedelta(days=1)
        plan = self.rapatrier(maintenant=plus_tard)
        self.assertEqual(([a["chemin"] for a in plan["copies"]], plan["signales"], plan["absentes"]), ([COTES + "/QUITUS.pdf"], [], []),
                         "autre taille que celle notée : c'est une fiche NOUVELLE, la place est libre, elle est copiée")
        with open(sur_pc, encoding="utf-8") as f:
            self.assertEqual(f.read(), "un second quitus, plus long que le premier")
        entrees = self.provenance()["fichiers"]
        self.assertEqual(len(entrees), 1, "jamais deux fois le même chemin : l'entrée est mise à jour")
        self.assertEqual((entrees[0]["taille"], entrees[0]["copie_le"]), (os.path.getsize(source), ap.heure_de_paris(plus_tard)))
        self.assertNotIn("absente_signalee_le", entrees[0])
        self.assertEqual(self.index()["fichiers"], [{"chemin": COTES + "/QUITUS.pdf", "taille": os.path.getsize(source)}])
        # Si la place est occupée par un fichier d'une autre taille : rien n'est touché, et c'est signalé SANS limite de durée
        ecrire(source, "une troisième fiche, encore plus longue que la deuxième")
        for jours in (2, 30, 400):
            plan = self.rapatrier(maintenant=self.instant + datetime.timedelta(days=jours))
            self.assertEqual(([x["motif"] for x in plan["signales"]], plan["copies"]), (["taille-differente"], []), jours)
        with open(sur_pc, encoding="utf-8") as f:
            self.assertEqual(f.read(), "un second quitus, plus long que le premier", "jamais écrasé")
        self.assertEqual(self.index()["fichiers"], [], "pas au relevé : la fiche du Drive n'est pas sur le PC")
        # La même fiche (même taille) supprimée par Franck, elle, n'est toujours pas recopiée
        os.remove(sur_pc)
        ecrire(source, "un second quitus, plus long que le premier")
        plan = self.rapatrier(maintenant=self.instant + datetime.timedelta(days=401))
        self.assertEqual(([x["motif"] for x in plan["signales"]], plan["copies"]), (["absente"], []))

    def test_la_liste_de_provenance_est_ecrite_en_cours_de_route(self):
        for n in range(60):
            self.fiche(COTES + "/FICHE %02d.pdf" % n, "fiche %d" % n)
        vraie_ecriture, ecritures = ap.ecrire_json, []

        def compter(chemin, objet, lisible=True):
            if os.path.basename(chemin) == ap.PROVENANCE:
                ecritures.append(len(objet["fichiers"]))
            vraie_ecriture(chemin, objet, lisible)

        vraie_copie, copies = ap.copier_blocs, []

        def coupure(lecture, ecriture):
            copies.append(lecture.name)
            if len(copies) == 56:
                raise RuntimeError("arrêt par Windows au bout d'une heure")
            vraie_copie(lecture, ecriture)

        with mock.patch.object(ap, "ecrire_json", compter), mock.patch.object(ap, "copier_blocs", coupure), self.assertRaises(RuntimeError):
            self.rapatrier()
        self.assertEqual(ecritures, [25, 50, 55], "toutes les 25 copies, et ce qui reste au moment de l'arrêt")
        self.assertEqual(len(self.provenance()["fichiers"]), 55)
        # À la relance : les 55 fichiers déjà notés ne sont pas relus (aucune comparaison de contenu), les 5 derniers sont copiés
        lectures = []
        with mock.patch.object(ap, "empreinte", lambda chemin: lectures.append(chemin) or "x"):
            plan = self.rapatrier()
        self.assertEqual((len(plan["copies"]), len(plan["deja"]), lectures), (5, 55, []))
        self.assertEqual(len(self.index()["fichiers"]), 60)

    def test_meme_taille_la_date_doit_etre_la_meme_sinon_le_contenu_est_compare(self):
        source = self.fiche(COTES + "/A.pdf", "AAAAA")
        os.utime(source, (1760000000, 1760000000))
        self.rapatrier()
        self.assertEqual(self.provenance()["fichiers"][0]["date"], 1760000000)
        lectures, vraie = [], ap.empreinte

        def empreinte(chemin):
            lectures.append(chemin)
            return vraie(chemin)

        with mock.patch.object(ap, "empreinte", empreinte):
            # Rien n'a changé : affirmé au relevé sans relire les fichiers
            self.rapatrier()
            self.assertEqual((lectures, len(self.index()["fichiers"])), ([], 1))
            # Le fichier du Drive est remplacé par un autre de même nom ET de même taille (sa date change) : on ne l'affirme plus
            ecrire(source, "BBBBB")
            os.utime(source, (1770000000, 1770000000))
            plan = self.rapatrier()
            self.assertEqual(len(lectures), 2, "le contenu est comparé")
            self.assertEqual([x["motif"] for x in plan["signales"]], ["autre-contenu"])
            self.assertEqual(self.index()["fichiers"], [], "pas au relevé : ce n'est pas la même fiche")
            # Le résultat est mémorisé (taille et date des deux côtés) : pas de nouvelle lecture tant qu'aucun des deux ne change
            del lectures[:]
            for _ in range(3):
                plan = self.rapatrier()
            self.assertEqual((lectures, [x["motif"] for x in plan["signales"]]), ([], ["autre-contenu"]))
            note = self.provenance()["differents"]
            self.assertEqual([(d["chemin"], d["taille"], d["date_drive"]) for d in note], [(COTES + "/A.pdf", 5, 1770000000)])
            # L'un des deux change (Franck remplace le fichier du PC par le bon) : recomparé, reconnu, inscrit ; le doute est levé
            sur_pc = ecrire(os.path.join(self.pc, PC_1, COTES, "A.pdf"), "BBBBB")
            os.utime(sur_pc, (1780000000, 1780000000))
            plan = self.rapatrier()
            self.assertEqual((len(lectures), plan["signales"]), (2, []))
            self.assertEqual(self.provenance()["differents"], [])
            self.assertEqual((self.provenance()["fichiers"][0]["date"], self.provenance()["fichiers"][0]["verifie"]), (1770000000, "contenu"))
            self.assertEqual(len(self.index()["fichiers"]), 1)
            # Même contenu, mais la date du fichier du Drive a bougé (Drive l'a resynchronisé) : une comparaison, puis plus rien
            del lectures[:]
            os.utime(source, (1790000000, 1790000000))
            self.rapatrier()
            self.rapatrier()
            self.assertEqual((len(lectures), len(self.index()["fichiers"]), self.provenance()["fichiers"][0]["date"]), (2, 1, 1790000000))
        # Une ancienne entrée sans date (liste écrite avant cette version) : la date du fichier du PC sert de repère
        liste = self.provenance()
        del liste["fichiers"][0]["date"]
        ecrire(os.path.join(self.pc, PC_1, ap.PROVENANCE), json.dumps(liste))
        os.utime(sur_pc, (1790000000, 1790000000))
        with mock.patch.object(ap, "empreinte", empreinte):
            del lectures[:]
            self.rapatrier()
        self.assertEqual((lectures, len(self.index()["fichiers"])), ([], 1))

    def test_un_fichier_apparu_entre_temps_n_est_jamais_ecrase(self):
        if os.name != "nt":
            self.skipTest("le renommage qui refuse d'écraser est celui de Windows")
        self.fiche(COTES + "/A.pdf", "version du Drive")
        cible = os.path.join(self.pc, PC_1, COTES, "A.pdf")
        vraie = ap.copier_blocs

        def apparition(lecture, ecriture):
            vraie(lecture, ecriture)
            ecrire(cible, "posé là par Franck pendant la copie")

        # 1. Le contrôle fait juste avant le renommage le voit
        with mock.patch.object(ap, "copier_blocs", apparition):
            plan = self.rapatrier()
        self.assertEqual((plan["copies"], len(plan["erreurs"])), ([], 1))
        with open(cible, encoding="utf-8") as f:
            self.assertEqual(f.read(), "posé là par Franck pendant la copie")
        self.assertEqual(os.listdir(os.path.dirname(cible)), ["A.pdf"], "la copie inachevée est retirée")
        # 2. Même si ce contrôle ne voyait rien (fichier apparu à la dernière seconde), le renommage lui-même refuse d'écraser
        os.remove(cible)
        os.remove(os.path.join(self.racine, DRIVE_1, ap.INDEX))
        with mock.patch.object(ap, "copier_blocs", apparition), mock.patch.object(ap.os.path, "lexists", lambda chemin: False):
            with self.assertRaises(FileExistsError):
                ap.copier_fichier(os.path.join(self.racine, DRIVE_1, COTES, "A.pdf"), cible)
        with open(cible, encoding="utf-8") as f:
            self.assertEqual(f.read(), "posé là par Franck pendant la copie", "jamais écrasé")
        self.assertEqual(os.listdir(os.path.dirname(cible)), ["A.pdf"])

    def test_restes_partiel_jamais_copies_ni_au_releve(self):
        self.fiche(COTES + "/A.pdf", "a")
        self.fiche(COTES + "/B.pdf.partiel", "reste dans le Drive")
        self.fiche(COTES + "/C.tmp", "temporaire")
        self.dans_pc(COTES + "/D.pdf.partiel", "reste sur le PC")
        plan = self.rapatrier()
        self.assertEqual([a["chemin"] for a in plan["copies"]], [COTES + "/A.pdf"])
        self.assertEqual(plan["signales"], [])
        self.assertEqual([e["chemin"] for e in self.index()["fichiers"]], [COTES + "/A.pdf"])
        self.assertEqual([e["chemin"] for e in self.provenance()["fichiers"]], [COTES + "/A.pdf"])
        self.assertEqual(sorted(os.listdir(os.path.join(self.pc, PC_1, COTES))), ["A.pdf", "D.pdf.partiel"])

    def test_releve_impossible_a_ecrire_le_compte_rendu_dit_vrai(self):
        self.fiche(COTES + "/A.pdf", "a")
        vraie = ap.ecrire_json

        def panne(chemin, objet, lisible=True):
            if os.path.basename(chemin) == ap.INDEX:
                raise PermissionError("Drive pour ordinateur refuse l'écriture")
            vraie(chemin, objet, lisible)

        with mock.patch.object(ap, "ecrire_json", panne):
            bilan = ap.rapatrier_tout(self.reglages, dire=self.dire, maintenant=self.instant)
        self.assertEqual((bilan["copies"], bilan["refuses"], bilan["ecritures"]), (1, 0, 1), "la copie faite reste comptée")
        self.assertTrue(os.path.isfile(os.path.join(self.pc, PC_1, COTES, "A.pdf")))
        self.assertEqual([e["chemin"] for e in self.provenance()["fichiers"]], [COTES + "/A.pdf"])
        texte = ap.lire_a_voir(self.pc)
        self.assertRegex(texte, "le relevé « releve-pc.json » n'a pas pu être écrit dans le Drive")
        self.assertNotIn("n'a pas pu se faire", texte)
        self.assertIn("1 fichier(s) copié(s)", self.texte())

    def test_la_liste_de_chaque_dossier_n_est_lue_qu_une_fois(self):
        for n in range(40):
            self.fiche(COTES + "/FICHE %02d.pdf" % n, "x")
        self.rapatrier()
        vraie, lectures = os.listdir, []

        def compter(chemin):
            lectures.append(chemin)
            return vraie(chemin)

        with mock.patch.object(ap.os, "listdir", compter):
            plan = ap.plan_rapatriement(self.reglages, "901")
        self.assertEqual(len(plan["deja"]), 40)
        dans_le_dossier = [c for c in lectures if c == os.path.join(self.pc, PC_1, "05 - CHANTIER", "PRISE DE COTES")]
        self.assertLessEqual(len(dans_le_dossier), 1, "pas une relecture du dossier par fichier")
        self.assertLess(len(lectures), 20)
        self.assertIsNone(ap._LISTES, "la mémoire ne sert que le temps du parcours")

    def test_simuler_n_ecrit_rien(self):
        self.fiche(COTES + "/A.pdf", "a")
        avant = self.photos()
        plan = self.rapatrier(simuler=True)
        self.assertEqual(([a["chemin"] for a in plan["a_copier"]], plan["copies"]), ([COTES + "/A.pdf"], []))
        self.assertEqual(self.photos(), avant)

    def test_arret_en_cours_de_copie_puis_relance(self):
        contenus = {"A.pdf": "a" * 5000, "B.pdf": "b" * 5000, "C.pdf": "c" * 5000}
        for nom, contenu in contenus.items():
            self.fiche(COTES + "/" + nom, contenu)
        drive = photo(self.racine)
        vraie = ap.copier_blocs

        def coupure(lecture, ecriture):
            if lecture.name.endswith("B.pdf"):
                ecriture.write(lecture.read(1200))
                ecriture.flush()
                raise RuntimeError("coupure simulée")
            vraie(lecture, ecriture)

        with mock.patch.object(ap, "copier_blocs", coupure), self.assertRaisesRegex(RuntimeError, "coupure"):
            self.rapatrier()
        dossier = os.path.join(self.pc, PC_1, COTES)
        self.assertEqual(os.listdir(dossier), ["A.pdf"], "ni fichier tronqué sous son nom final, ni reste de copie")
        self.assertEqual(photo(self.racine), drive, "le Drive n'a pas bougé")
        self.assertEqual([e["chemin"] for e in self.provenance()["fichiers"]], [COTES + "/A.pdf"], "ce qui a été copié avant l'arrêt est noté")
        # Arrêt brutal (le programme est tué) : il peut rester une copie inachevée sous son nom temporaire
        ecrire(os.path.join(dossier, "B.pdf" + ap.PARTIEL), "b" * 1200)
        plan = self.rapatrier()
        self.assertEqual(sorted(a["chemin"] for a in plan["copies"]), [COTES + "/B.pdf", COTES + "/C.pdf"])
        self.assertEqual(sorted(os.listdir(dossier)), ["A.pdf", "B.pdf", "C.pdf"])
        for nom, contenu in contenus.items():
            with open(os.path.join(dossier, nom), encoding="utf-8") as f:
                self.assertEqual(f.read(), contenu)
        self.assertEqual(sorted(e["chemin"] for e in self.provenance()["fichiers"]), [COTES + "/" + n for n in sorted(contenus)],
                         "A, copié avant l'arrêt, est retrouvé « déjà présent » et entre dans la liste")
        self.assertEqual([e["chemin"] for e in self.index()["fichiers"]], [COTES + "/" + n for n in sorted(contenus)])

    def test_fichier_illisible_signale_et_suite(self):
        for nom in ("A.pdf", "B.pdf", "C.pdf"):
            self.fiche(COTES + "/" + nom, nom * 100)
        vraie = ap.copier_blocs

        def illisible(lecture, ecriture):
            if lecture.name.endswith("B.pdf"):
                ecriture.write(b"debut")
                raise OSError("fichier en ligne seulement, téléchargement impossible")
            vraie(lecture, ecriture)

        with mock.patch.object(ap, "copier_blocs", illisible):
            plan = self.rapatrier()
        self.assertEqual(sorted(a["chemin"] for a in plan["copies"]), [COTES + "/A.pdf", COTES + "/C.pdf"])
        self.assertEqual([e["chemin"] for e in plan["erreurs"]], [COTES + "/B.pdf"])
        self.assertEqual(sorted(os.listdir(os.path.join(self.pc, PC_1, COTES))), ["A.pdf", "C.pdf"])
        self.assertEqual(sorted(e["chemin"] for e in self.provenance()["fichiers"]), [COTES + "/A.pdf", COTES + "/C.pdf"])
        self.assertIn("pas copié", self.texte())

    def test_taille_fausse_a_l_arrivee_la_copie_n_est_pas_gardee(self):
        self.fiche(COTES + "/A.pdf", "a" * 3000)
        with mock.patch.object(ap, "copier_blocs", lambda lecture, ecriture: ecriture.write(lecture.read(100))):
            plan = self.rapatrier()
        self.assertEqual((plan["copies"], len(plan["erreurs"])), ([], 1))
        self.assertEqual(os.listdir(os.path.join(self.pc, PC_1, COTES)), [])

    def test_provenance_illisible_rien_n_est_copie(self):
        self.fiche(COTES + "/A.pdf", "a")
        self.dans_pc(ap.PROVENANCE, "{ pas du json")
        avant = self.photos()
        with self.assertRaisesRegex(dc.Refus, "illisible"):
            self.rapatrier()
        self.assertEqual(self.photos(), avant)

    def test_accents_codes_autrement_meme_fichier(self):
        nom = "RÉCEPTION DE SUPPORT ÉTÉ.pdf"
        compose, decompose = unicodedata.normalize("NFC", nom), unicodedata.normalize("NFD", nom)
        self.assertNotEqual(compose, decompose)
        self.fiche(COTES + "/" + compose, "le même")
        self.dans_pc(COTES + "/" + decompose, "le même")
        plan = self.rapatrier()
        self.assertEqual((plan["copies"], [a["chemin"] for a in plan["deja"]]), ([], [COTES + "/" + compose]))
        self.assertEqual(len(os.listdir(os.path.join(self.pc, PC_1, COTES))), 1, "pas de second fichier au même nom")
        self.assertEqual([e["chemin"] for e in self.index()["fichiers"]], [COTES + "/" + compose])
        self.assertEqual(self.provenance()["fichiers"][0]["verifie"], "contenu")

    def test_chantier_sans_dossier_du_pc_ou_drive_technique(self):
        self.reglages["chantiers"]["905"] = {"chantier": "Cinq", "dossier_drive": DRIVE_2}
        self.reglages["chantiers"]["902"] = {"chantier": "Deux", "dossier_drive": "ADMINISTRATIF"}
        avant = self.photos()
        with self.assertRaisesRegex(dc.Refus, "aucun dossier de chantier du PC"):
            ap.rapatrier(self.reglages, "905", dire=self.dire)
        with self.assertRaisesRegex(dc.Refus, "technique"):
            ap.rapatrier(self.reglages, "902", dire=self.dire)
        self.assertEqual(self.photos(), avant)

    def test_heure_de_paris(self):
        utc = datetime.timezone.utc
        for instant, attendu in (((2026, 1, 15, 12, 0), "2026-01-15T13:00:00+01:00"), ((2026, 7, 14, 12, 0), "2026-07-14T14:00:00+02:00"),
                                 ((2026, 3, 29, 0, 59), "2026-03-29T01:59:00+01:00"), ((2026, 3, 29, 1, 0), "2026-03-29T03:00:00+02:00"),
                                 ((2026, 10, 25, 0, 59), "2026-10-25T02:59:00+02:00"), ((2026, 10, 25, 1, 0), "2026-10-25T02:00:00+01:00")):
            self.assertEqual(ap.heure_de_paris(datetime.datetime(*instant, tzinfo=utc)), attendu)
        self.assertRegex(ap.heure_de_paris(), r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+0[12]:00$")


class Verrou(Monde):
    def setUp(self):
        super().setUp()
        self.verrou = os.path.join(self.prive, ap.VERROU_FICHIER)

    def poser(self, machine, processus, age=0):
        ecrire(self.verrou, json.dumps({"machine": machine, "processus": processus, "instant": 1000000 - age, "date": "01/01/2026 08:00"}))

    def prendre(self, vivant):
        return ap.prendre_verrou(self.verrou, self.dire, vivant=lambda numero: vivant, horloge=lambda: 1000000, machine="PC-ESSAI", processus=4242)

    def test_pose_et_libere(self):
        moi = self.prendre(True)
        self.assertEqual((lire(self.verrou)["machine"], lire(self.verrou)["processus"]), ("PC-ESSAI", 4242))
        ap.liberer_verrou(self.verrou, moi)
        self.assertFalse(os.path.exists(self.verrou))

    def test_verrou_vivant_respecte(self):
        self.poser("PC-ESSAI", 77)
        avant = photo(self.prive)
        with self.assertRaisesRegex(dc.Refus, "déjà en cours"):
            self.prendre(True)
        self.assertEqual(photo(self.prive), avant)
        ap.liberer_verrou(self.verrou, {"machine": "PC-ESSAI", "processus": 4242})
        self.assertTrue(os.path.exists(self.verrou), "on ne retire jamais le verrou d'un autre")

    def test_verrou_orphelin_repris(self):
        self.poser("PC-ESSAI", 77)
        moi = self.prendre(False)
        self.assertIn("a été repris", self.texte())
        self.assertEqual(lire(self.verrou)["processus"], 4242)
        ap.liberer_verrou(self.verrou, moi)
        self.assertEqual(os.listdir(self.prive), ["depot.json"])

    def test_autre_machine(self):
        self.poser("AUTRE-PC", 77, age=3600)
        with self.assertRaises(dc.Refus):
            self.prendre(False)
        self.poser("AUTRE-PC", 77, age=3 * 3600)
        self.prendre(False)
        self.assertEqual(lire(self.verrou)["machine"], "PC-ESSAI")

    def test_verrou_de_plus_de_deux_heures_repris_meme_si_son_numero_est_vivant(self):
        self.poser("PC-ESSAI", 77, age=3600)
        with self.assertRaises(dc.Refus):
            self.prendre(True)
        self.poser("PC-ESSAI", 77, age=2 * 3600 + 60)
        moi = self.prendre(True)
        self.assertIn("a été repris", self.texte())
        self.assertEqual((lire(self.verrou)["processus"], lire(self.verrou)["instant"]), (4242, 1000000), "le verrou porte l'heure de démarrage")
        ap.liberer_verrou(self.verrou, moi)
        self.assertEqual(os.listdir(self.prive), ["depot.json"], "ni verrou, ni reste de reprise")

    def test_deux_reprises_en_meme_temps_une_seule_passe(self):
        self.poser("PC-ESSAI", 77)
        vrai = os.rename

        def devance(source, cible):
            # Un autre programme reprend le verrou orphelin juste avant nous : il l'écarte, puis pose le sien
            vrai(source, cible)
            os.remove(cible)
            ecrire(self.verrou, json.dumps({"machine": "PC-ESSAI", "processus": 99, "instant": 1000000, "date": "à l'instant"}))
            raise FileNotFoundError(source)

        with mock.patch.object(ap.os, "rename", devance), self.assertRaisesRegex(dc.Refus, "déjà en cours"):
            ap.prendre_verrou(self.verrou, self.dire, vivant=lambda numero: numero == 99, horloge=lambda: 1000000, machine="PC-ESSAI", processus=4242)
        self.assertEqual(lire(self.verrou)["processus"], 99, "le verrou de l'autre est intact")

    def test_le_verrou_est_rafraichi_pendant_un_long_travail(self):
        heure = [1000000]
        moi = ap.prendre_verrou(self.verrou, self.dire, horloge=lambda: heure[0], machine="PC-ESSAI", processus=4242)
        heure[0] += 60
        ap.battre()
        self.assertEqual(lire(self.verrou)["instant"], 1000000, "pas avant dix minutes")
        heure[0] += 700
        ap.battre()
        self.assertEqual(lire(self.verrou)["instant"], 1000760)
        ap.liberer_verrou(self.verrou, moi)
        ap.battre()
        self.assertFalse(os.path.exists(self.verrou))

    def test_verrou_illisible_recent(self):
        ecrire(self.verrou, "pas du json")
        with self.assertRaises(dc.Refus):
            ap.prendre_verrou(self.verrou, self.dire)

    def test_processus_vivant(self):
        self.assertTrue(ap.processus_vivant(os.getpid()))
        fini = subprocess.Popen([sys.executable, "-c", "pass"])
        fini.wait()
        self.assertFalse(ap.processus_vivant(fini.pid))
        self.assertFalse(ap.processus_vivant("abc"))
        self.assertFalse(ap.processus_vivant(0))


class LigneDeCommande(Monde):
    def test_refus_avant_toute_ecriture(self):
        def refuse(attendu, *arguments):
            avant = self.photos()
            code, _, erreur = self.lancer(*arguments)
            self.assertEqual(code, 2, erreur)
            self.assertRegex(erreur, attendu)
            self.assertEqual(self.photos(), avant, "un refus n'écrit rien : ni verrou, ni journal")

        self.reglages["chantiers"] = {"901": {"chantier": "Un"}}
        self.noter_reglages()
        refuse("mal écrit")
        self.reglages["chantiers"] = {"901": {"chantier": "Un", "dossier_drive": DRIVE_1}}
        self.reglages["chantiers_pc"] = os.path.join(self.temp, "chantiers absents")
        self.noter_reglages()
        refuse("dossiers de chantier du PC")
        refuse("dossiers de chantier du PC", "--associer")
        refuse("dossiers de chantier du PC", "--lister")
        refuse("dossiers de chantier du PC", "--a-voir")
        refuse("dossiers de chantier du PC", "--installer-tache")
        self.reglages["chantiers_pc"] = self.pc
        self.noter_reglages()
        ecrire(self.memoire, "pas du json")
        refuse("illisible")
        os.remove(self.memoire)
        shutil.move(os.path.join(self.racine, "dossiers.json"), os.path.join(self.temp, "dossiers.json"))
        refuse("dossiers.json")
        refuse("dossiers.json", "--rapatrier")
        ecrire(os.path.join(self.racine, "dossiers.json"), "{ illisible")
        refuse("illisible", "--rapatrier")
        os.remove(self.reglages_fichier)
        refuse("n'existe pas")
        ecrire(self.reglages_fichier, "{ illisible")
        refuse("illisible")

    def test_verrou_vivant_refuse(self):
        ecrire(os.path.join(self.prive, ap.VERROU_FICHIER),
               json.dumps({"machine": ap.socket.gethostname(), "processus": os.getppid() or 4, "instant": time.time(), "date": "à l'instant"}))
        with mock.patch.object(ap, "processus_vivant", lambda numero: True):
            avant = self.photos()
            code, _, erreur = self.lancer()
        self.assertEqual(code, 2)
        self.assertIn("déjà en cours", erreur)
        self.assertEqual(self.photos(), avant)

    def test_lister_n_ecrit_rien(self):
        self.bordereau(1, "901-10-105-A-RESERVATIONS.pdf")
        self.bordereau(1, "901-10-777-A-INCONNU.pdf")
        self.fiche(COTES + "/A.pdf", "a")
        self.fiche("Divers/B.pdf", "b")
        self.fiche(COTES + "/X.pdf", "x", dossier=DRIVE_2)
        avant = self.photos()
        code, sortie, erreur = self.lancer("--lister")
        self.assertEqual((code, erreur), (0, ""))
        self.assertEqual(self.photos(), avant)
        for attendu in ("VOIR SEULEMENT", "n° 901", PC_1, DRIVE_2, "105 A RESERVATIONS", "numéro de document « 777 » — pas un document du carnet", "1 fichier(s) à copier",
                        "chantier n° 901 : 1 document(s), 2 page(s), environ ", "bordereaux du chantier n° 901 : numérotation actuelle déclarée",
                        "hors des dossiers de fiches", "_À CLASSER"):
            self.assertIn(attendu, sortie)

    def test_tout_traiter_maintenant_sans_question(self):
        self.bordereau(1, "901-10-105-A-RESERVATIONS.pdf")
        self.mettre("PLAN SANS NUMERO.pdf")
        self.fiche(COTES + "/A.pdf", "a")
        self.fiche(COTES + "/B.gdoc", "{}")
        self.fiche(COTES + "/X.pdf", "x", dossier=DRIVE_2)

        def interdite(question):
            raise AssertionError("« tout traiter » ne pose plus aucune question : %r" % question)

        code, sortie, erreur = self.lancer(demander=interdite)
        self.assertEqual((code, erreur), (0, ""))
        self.assertTrue(os.path.isfile(os.path.join(self.racine, DRIVE_1, "CARNET", "carnet.json")))
        self.assertTrue(os.path.isfile(os.path.join(self.pc, PC_1, COTES, "A.pdf")))
        for attendu in ("BILAN", "Recopie des fiches : 1 fichier(s) copié(s) dans les dossiers de chantier du PC, 0 déjà présent(s)",
                        "Carnet : 1 document(s) déposé(s)", "DÉPOSÉ AU CARNET : ", "105 A RESERVATIONS, 2 page(s), depuis « BORDEREAU 1 »",
                        "choix 5 du menu", "À voir : 3 point(s)", "Pour information (rien à faire) : 1 ligne(s).",
                        "* Chantier n° 901 : 1 raccourci Google, non copié (détail : appli-pc, choix 2 « Voir seulement »).", "VÉRIFIER QUE MEGA A FINI DE SYNCHRONISER", "Rien n'a été supprimé", "page 2/2"):
            self.assertIn(attendu, sortie)
        self.assertEqual(sorted(os.listdir(self.prive)), ["appli-pc", ap.MEMOIRE_FICHIER, "depot.json"], "le verrou est libéré")
        journal = [n for n in os.listdir(os.path.join(self.prive, "appli-pc")) if n.startswith("journal-")]
        self.assertEqual(len(journal), 1)
        self.assertRegex(journal[0], r"^journal-\d{4}-\d{2}-\d{2}\.txt$")
        with open(os.path.join(self.prive, "appli-pc", journal[0]), encoding="utf-8") as f:
            note = f.read()
        self.assertIn("BILAN", note)
        self.assertIn("DÉPOSÉ AU CARNET", note)
        a_voir = ap.lire_a_voir(self.pc)
        for attendu in ("raccourci Google", DRIVE_2, "PLAN SANS NUMERO.pdf » : nom non reconnu", "+ ", "105 A RESERVATIONS"):
            self.assertIn(attendu, a_voir)
        # Deuxième lancement : rien à déposer, rien à copier ; rien ne change dans les dossiers du PC ni dans le Drive
        drive, pc, _ = self.photos()
        code, sortie, _ = self.lancer(demander=interdite)
        self.assertEqual(code, 0)
        self.assertIn("Aucun document à déposer au carnet", sortie)
        self.assertIn("Carnet : 0 document(s) déposé(s)", sortie)
        sans_releve = lambda vu: {n: v for n, v in vu.items() if not n.endswith(ap.INDEX)}      # noqa: E731 (le relevé, lui, est refait)
        self.assertEqual((sans_releve(photo(self.racine)), photo(self.pc)), (sans_releve(drive), pc))

    def test_options_separees(self):
        self.bordereau(1, "901-10-105-A-RESERVATIONS.pdf")
        self.fiche(COTES + "/A.pdf", "a")
        code, sortie, _ = self.lancer("--rapatrier")
        self.assertEqual(code, 0)
        self.assertNotIn("CARNET :", sortie)
        self.assertFalse(os.path.exists(os.path.join(self.racine, DRIVE_1, "CARNET")))
        self.assertTrue(os.path.isfile(os.path.join(self.pc, PC_1, COTES, "A.pdf")))
        pc = photo(self.pc)
        # Le carnet seul : le document est déposé, les dossiers de chantier ne sont pas touchés (« A VOIR » gagne sa ligne de dépôt)
        self.fiche(COTES + "/B.pdf", "b")
        code, sortie, _ = self.lancer("--carnet")
        self.assertEqual(code, 0)
        apres = photo(self.pc)
        self.assertEqual({n: v for n, v in apres.items() if n != ap.A_VOIR}, {n: v for n, v in pc.items() if n != ap.A_VOIR}, "--carnet ne recopie pas")
        self.assertTrue(os.path.isfile(os.path.join(self.racine, DRIVE_1, "CARNET", "carnet.json")))
        # Un chantier de la correspondance sans dossier sur le PC : rien n'est deviné ni copié pour lui, c'est écrit dans
        # « A VOIR » ; les autres chantiers sont faits ; ce n'est pas une erreur du programme (code 0)
        self.reglages["chantiers"]["905"] = {"chantier": "Cinq", "dossier_drive": DRIVE_2}
        self.noter_reglages()
        self.fiche(COTES + "/C.pdf", "c")
        self.fiche(COTES + "/D.pdf", "d", dossier=DRIVE_2)
        code, sortie, _ = self.lancer("--rapatrier")
        self.assertEqual(code, 0)
        self.assertRegex(ap.lire_a_voir(self.pc), "Chantier n° 905 .*aucun dossier de chantier du PC ne commence par le numéro 905")
        self.assertIn("905", sortie)
        self.assertTrue(os.path.isfile(os.path.join(self.pc, PC_1, COTES, "C.pdf")))
        self.assertFalse([n for n in photo(self.pc) if n.endswith("D.pdf")])
        self.assertEqual(sorted(os.listdir(self.prive)), ["appli-pc", ap.MEMOIRE_FICHIER, "depot.json"])

    def test_releve_impossible_a_ecrire_code_de_sortie_1(self):
        self.fiche(COTES + "/A.pdf", "a")
        vraie = ap.ecrire_json

        def panne(chemin, objet, lisible=True):
            if os.path.basename(chemin) == ap.INDEX:
                raise PermissionError("Drive pour ordinateur refuse l'écriture")
            vraie(chemin, objet, lisible)

        with mock.patch.object(ap, "ecrire_json", panne):
            code, sortie, _ = self.lancer("--rapatrier")
            self.assertEqual(code, 1, "une écriture manquée est un défaut")
            self.assertIn("1 fichier(s) copié(s)", sortie)
            self.assertIn("le relevé « releve-pc.json » n'a pas pu être écrit", sortie)
            self.assertIn("1 défaut(s)", sortie)
            self.fiche(COTES + "/B.pdf", "b")
            self.assertEqual(self.lancer("--rapatrier", "--auto")[0], 1, "en passage automatique aussi")
        with open(os.path.join(self.prive, "appli-pc", "auto.txt"), encoding="utf-8") as f:
            self.assertIn("1 fichier(s) copié(s), 0 document(s) déposé(s) au carnet, 1 en erreur", f.read())
        self.assertEqual(self.lancer("--rapatrier", "--auto")[0], 0, "le relevé s'écrit : tout est rentré dans l'ordre")
        self.assertEqual(len(lire(os.path.join(self.racine, DRIVE_1, ap.INDEX))["fichiers"]), 2)

    def test_associer_et_retirer_par_la_ligne_de_commande(self):
        code, sortie, _ = self.lancer("--associer", demander=saisies("", "1", ""))
        self.assertEqual(code, 0)
        self.assertEqual(lire(self.reglages_fichier)["chantiers"]["902"]["dossier_drive"], DRIVE_2)
        self.bordereau(1, "901-10-105-A-RESERVATIONS.pdf")
        self.assertEqual(self.lancer("--carnet")[0], 0)
        code, sortie, _ = self.lancer("--retirer", demander=saisies("1", "1", "o"))
        self.assertEqual(code, 0)
        self.assertIn("est retiré", sortie)
        self.assertIs(lire(os.path.join(self.racine, DRIVE_1, "CARNET", "carnet.json"))["documents"][0]["retire"], True)

    def test_un_seul_chantier(self):
        self.lancer("--associer", demander=saisies("", "1", ""))
        self.bordereau(1, "901-10-105-A-RESERVATIONS.pdf")
        self.bordereau(1, "902-10-106-A-REPERAGE.pdf", chantier=PC_2)
        self.fiche(COTES + "/UN.pdf", "1")
        self.fiche(COTES + "/DEUX.pdf", "2", dossier=DRIVE_2)
        # Voir seulement : le chantier 902 et lui seul
        avant = self.photos()
        code, sortie, _ = self.lancer("--lister", "--chantier", "902")
        self.assertEqual((code, self.photos()), (0, avant))
        self.assertIn("n° 902", sortie)
        self.assertNotIn("n° 901", sortie)
        self.assertIn("106 A REPERAGE", sortie)
        self.assertNotIn("105 A RESERVATIONS", sortie)
        # Tout traiter pour le 902 seul : son plan, ses fiches ; rien pour le 901 ; « A VOIR » n'est pas écrit
        drive, pc, _ = self.photos()
        code, sortie, erreur = self.lancer("--chantier", "902")
        self.assertEqual((code, erreur), (0, ""))
        self.assertIn("UN SEUL CHANTIER : le n° 902", sortie)
        self.assertIn("106 A REPERAGE, 2 page(s), depuis « BORDEREAU 1 »", sortie)
        self.assertEqual([d["id"] for d in self.carnet_json(DRIVE_2)["documents"]], ["106-A"])
        self.assertFalse(os.path.exists(os.path.join(self.racine, DRIVE_1, "CARNET")), "le carnet du 901 n'est pas touché")
        apres_drive, apres_pc = photo(self.racine), photo(self.pc)
        self.assertTrue(os.path.isfile(os.path.join(self.pc, PC_2, COTES, "DEUX.pdf")))
        self.assertTrue(os.path.isfile(os.path.join(self.racine, DRIVE_2, "CARNET", "carnet.json")))
        self.assertTrue(all(n.startswith(PC_2 + "/") for n in apres_pc if n not in pc), "rien hors du dossier du chantier 902")
        self.assertTrue(all(n.startswith(DRIVE_2 + "/") for n in apres_drive if n not in drive))
        self.assertEqual({n: v for n, v in apres_pc.items() if n in pc}, pc)
        self.assertFalse(os.path.exists(os.path.join(self.pc, ap.A_VOIR)))
        # Le passage automatique accepte aussi --chantier (essai), sans toucher aux autres
        self.fiche(COTES + "/TROIS.pdf", "3", dossier=DRIVE_2)
        self.assertEqual(self.lancer("--rapatrier", "--auto", "--chantier", "902")[0], 0)
        self.assertTrue(os.path.isfile(os.path.join(self.pc, PC_2, COTES, "TROIS.pdf")))
        self.assertFalse(os.path.exists(os.path.join(self.pc, PC_1, COTES, "UN.pdf")))
        # Un numéro inconnu, ou qui n'est pas un nombre : refus avant toute écriture
        for numero, attendu in (("777", "n'est pas reconnu"), ("9O2", "n'est pas un nombre")):
            avant = self.photos()
            code, _, erreur = self.lancer("--chantier", numero)
            self.assertEqual(code, 2)
            self.assertIn(attendu, erreur)
            self.assertEqual(self.photos(), avant)



class Automatique(Monde):
    """La recopie sans personne : chantiers trouvés par leur numéro, fichier « A VOIR », journal, verrou."""

    def setUp(self):
        super().setUp()
        # Des dossiers de chantier de l'appli : chacun a au moins un sous-dossier de fiches
        for nom in ("903 - CHANTIER TROIS", "904-CHANTIER QUATRE", "905 CHANTIER CINQ", DRIVE_2, DRIVE_1 + " (1)"):
            os.makedirs(os.path.join(self.racine, nom, "05 - CHANTIER", "PRISE DE COTES"))
        for nom in ("903 - OPERATION TROIS - VILLE", "904-OPERATION QUATRE", "905 OPERATION CINQ"):
            os.makedirs(os.path.join(self.pc, nom))
        self.journal = os.path.join(self.prive, "appli-pc", "auto.txt")

    def monde_propre(self):
        """Plus rien à signaler : ni dossier sans numéro, ni doublon, ni fichier en attente de classement."""
        shutil.rmtree(os.path.join(self.racine, DRIVE_2))
        shutil.rmtree(os.path.join(self.racine, DRIVE_1 + " (1)"))
        os.remove(os.path.join(self.racine, "_À CLASSER", "QUITUS INCONNU.pdf"))

    def auto(self):
        code, sortie, erreur = self.lancer("--rapatrier", "--auto")
        self.assertEqual((sortie, erreur), ("", ""), "le passage automatique n'affiche rien")
        return code

    def lignes_du_journal(self):
        with open(self.journal, encoding="utf-8") as f:
            return f.read().splitlines()

    def test_chantiers_trouves_par_le_numero_en_tete_du_nom(self):
        # Un dossier qui commence par des chiffres mais que l'appli n'utilise pas (aucun sous-dossier de fiches) : ignoré, sans bruit
        os.makedirs(os.path.join(self.racine, "2024 - archives", "Divers"))
        ecrire(os.path.join(self.racine, "2024 - archives", "Divers", "vieux.pdf"))
        os.makedirs(os.path.join(self.pc, "2024 - ARCHIVES DU BUREAU"))
        os.makedirs(os.path.join(self.racine, "DOSSIER QUELCONQUE"))
        # … alors qu'un dossier qui n'a que le carnet est bien un dossier de chantier de l'appli
        os.makedirs(os.path.join(self.racine, "908 - AVEC CARNET SEUL", "CARNET"))
        os.makedirs(os.path.join(self.pc, "908 - OPERATION HUIT"))
        avant = self.photos()
        suivis, a_voir = ap.chantiers_suivis(self.reglages)
        self.assertEqual(self.photos(), avant, "chercher les chantiers n'écrit rien")
        self.assertEqual({n: f["dossier_drive"] for n, f in suivis.items()},
                         {"901": DRIVE_1, "903": "903 - CHANTIER TROIS", "904": "904-CHANTIER QUATRE", "905": "905 CHANTIER CINQ",
                          "908": "908 - AVEC CARNET SEUL"})
        self.assertEqual(suivis["901"]["chantier"], "Chantier Essai Un", "la correspondance garde le nom dans l'appli")
        self.assertEqual(suivis["903"]["chantier"], "903 - CHANTIER TROIS", "sans correspondance : le nom du dossier")
        texte = "\n".join(a_voir)
        self.assertEqual(len(a_voir), 2, a_voir)
        self.assertRegex(texte, "« %s » : pas de numéro de chantier" % DRIVE_2)
        self.assertRegex(texte, r"« %s \(1\) » : c'est un dossier en double" % DRIVE_1)
        for ignore in ("ADMINISTRATIF", "_À CLASSER", "PLANNING", "2024", "QUELCONQUE"):
            self.assertNotIn(ignore, texte)
        bilan = ap.rapatrier_tout(self.reglages, dire=self.dire)
        self.assertEqual((bilan["copies"], [n for n in photo(self.pc) if n.startswith("2024") and "/" in n]), (0, []), "rien pour « 2024 - archives »")

    def test_dossiers_du_drive_a_ignorer(self):
        # Sans la clé « ignorer » : comme avant
        avant_suivis, avant_a_voir = ap.chantiers_suivis(self.reglages)
        self.assertIn("903", avant_suivis)
        self.assertRegex("\n".join(avant_a_voir),"« %s » : pas de numéro de chantier" % DRIVE_2)
        # Un numéro (chantier archivé) et un nom exact, sans tenir compte des majuscules : ni suivis, ni cités dans « à voir »
        self.reglages["ignorer"] = ["903", DRIVE_2.lower()]
        suivis, a_voir = ap.chantiers_suivis(self.reglages)
        self.assertEqual(sorted(suivis), sorted(n for n in avant_suivis if n != "903"), "les autres chantiers ne bougent pas")
        self.assertEqual(a_voir, [l for l in avant_a_voir if "« %s »" % DRIVE_2 not in l])
        self.assertNotIn(DRIVE_2, "\n".join(a_voir))
        # Un nom n'ignore que le dossier qui porte exactement ce nom ; un numéro ne se confond pas avec un autre (90 n'est pas 903)
        self.reglages["ignorer"] = ["CHANTIER", "90", "", None]
        self.assertEqual(ap.chantiers_suivis(self.reglages), (avant_suivis, avant_a_voir))
        # Une clé mal écrite (un texte seul, ou autre chose qu'une liste) ne casse rien
        self.reglages["ignorer"] = "903"
        self.assertNotIn("903", ap.chantiers_suivis(self.reglages)[0])
        self.reglages["ignorer"] = {"903": True}
        self.assertEqual(ap.chantiers_suivis(self.reglages), (avant_suivis, avant_a_voir))

    def test_la_correspondance_ne_peut_pas_contredire_le_numero_du_dossier(self):
        self.monde_propre()
        # Une faute de frappe dans depot.json : le dossier « 903 - … » relié au chantier 904
        self.reglages["chantiers"]["904"] = {"chantier": "Quatre", "dossier_drive": "903 - CHANTIER TROIS"}
        self.fiche(COTES + "/F3.pdf", "3", dossier="903 - CHANTIER TROIS")
        self.fiche(COTES + "/F4.pdf", "4", dossier="904-CHANTIER QUATRE")
        suivis, a_voir = ap.chantiers_suivis(self.reglages)
        self.assertNotIn("903", suivis)
        self.assertEqual(suivis["904"]["dossier_drive"], "904-CHANTIER QUATRE", "le vrai dossier 904 garde son lien")
        self.assertEqual(len(a_voir), 1)
        self.assertRegex(a_voir[0], "« 903 - CHANTIER TROIS » : son nom commence par le numéro 903, mais .* n° 904")
        self.noter_reglages()
        self.assertEqual(self.auto(), 0)
        self.assertFalse([n for n in photo(self.pc) if n.endswith("F3.pdf")], "les fiches du 903 ne vont nulle part")
        self.assertTrue(os.path.isfile(os.path.join(self.pc, "904-OPERATION QUATRE", COTES, "F4.pdf")))
        self.assertIn("numéro 903, mais", ap.lire_a_voir(self.pc))
        # La correspondance sert pour un dossier SANS numéro : c'est son seul lien
        self.reglages["chantiers"] = {"901": self.reglages["chantiers"]["901"], "905": {"chantier": "Cinq", "dossier_drive": "DOSSIER SANS NUMERO NI FICHE"}}
        os.makedirs(os.path.join(self.racine, "DOSSIER SANS NUMERO NI FICHE"))
        suivis, a_voir = ap.chantiers_suivis(self.reglages)
        self.assertNotIn("905", suivis, "deux dossiers du Drive pour le n° 905 : rien n'est deviné")
        self.assertRegex("\n".join(a_voir), "n° 905 : plusieurs dossiers du Drive")

    def test_copie_automatique_dans_le_bon_dossier(self):
        self.monde_propre()
        self.fiche(COTES + "/A.pdf", "aaa", dossier="903 - CHANTIER TROIS")
        self.fiche(QUITUS + "/Q.pdf", "qq", dossier="904-CHANTIER QUATRE")
        self.fiche(COTES + "/C.pdf", "c", dossier="905 CHANTIER CINQ")
        self.fiche(COTES + "/U.pdf", "u")
        drive = photo(self.racine)
        self.assertEqual(self.auto(), 0)
        for dossier, relatif in (("903 - OPERATION TROIS - VILLE", COTES + "/A.pdf"), ("904-OPERATION QUATRE", QUITUS + "/Q.pdf"),
                                 ("905 OPERATION CINQ", COTES + "/C.pdf"), (PC_1, COTES + "/U.pdf")):
            self.assertTrue(os.path.isfile(os.path.join(self.pc, dossier, relatif)), dossier)
            self.assertEqual([e["chemin"] for e in lire(os.path.join(self.pc, dossier, ap.PROVENANCE))["fichiers"]], [relatif])
        apres = photo(self.racine)
        self.assertEqual({n: v for n, v in apres.items() if n in drive}, drive, "rien de modifié ni supprimé dans le Drive")
        self.assertEqual(sorted(set(apres) - set(drive)), sorted(d + "/" + ap.INDEX for d in (
            DRIVE_1, "903 - CHANTIER TROIS", "904-CHANTIER QUATRE", "905 CHANTIER CINQ")))
        self.assertEqual(ap.INDEX, "releve-pc.json")
        releve = lire(os.path.join(self.racine, "903 - CHANTIER TROIS", ap.INDEX))
        self.assertEqual(list(releve), ["version", "chantier", "numero", "releve_le", "fichiers"])
        self.assertEqual((releve["numero"], releve["fichiers"]), ("903", [{"chemin": COTES + "/A.pdf", "taille": 3}]))
        self.assertIn("Rien à signaler.", ap.lire_a_voir(self.pc))
        journal = self.lignes_du_journal()
        self.assertRegex(journal[0], r"^\[\d{2}/\d{2}/\d{4} \d{2}:\d{2}\] 4 chantier\(s\) ; 4 fichier\(s\) copié\(s\), 0 document\(s\) déposé\(s\) au carnet, 0 en erreur ; 0 point\(s\) à voir\.$")
        self.assertEqual(len(journal), 5, "le détail des copies suit la ligne du passage")
        self.assertEqual(sorted(os.listdir(self.prive)), ["appli-pc", "depot.json"], "le verrou est libéré")

    def test_rien_a_faire_une_ligne_et_rien_a_signaler(self):
        self.monde_propre()
        self.assertEqual(self.auto(), 0)
        texte = ap.lire_a_voir(self.pc)
        self.assertIn("Rien à signaler.", texte)
        self.assertRegex(texte, r"Mis à jour le \d{2}/\d{2}/\d{4} à \d{2}:\d{2}")
        fichier = os.path.join(self.pc, ap.A_VOIR)
        with open(fichier, "rb") as f:
            brut = f.read()
        self.assertTrue(brut.startswith(b"\xef\xbb\xbf") and b"\r\n" in brut, "lisible dans le Bloc-notes")
        self.assertEqual(len(self.lignes_du_journal()), 1)
        self.assertIn("0 fichier(s) copié(s)", self.lignes_du_journal()[0])
        # Deuxième passage : une ligne de plus au journal ; NI « A VOIR » NI le relevé du Drive, inchangés, ne sont réécrits
        releve = os.path.join(self.racine, DRIVE_1, ap.INDEX)
        avant_releve, avant_a_voir, drive, pc = os.stat(releve).st_mtime_ns, os.stat(fichier).st_mtime_ns, photo(self.racine), photo(self.pc)
        self.assertEqual(self.auto(), 0)
        self.assertEqual(len(self.lignes_du_journal()), 2)
        self.assertEqual((os.stat(releve).st_mtime_ns, os.stat(fichier).st_mtime_ns), (avant_releve, avant_a_voir))
        self.assertEqual((photo(self.racine), photo(self.pc)), (drive, pc), "un passage sans rien de neuf n'écrit rien hors de _prive")
        # « A VOIR » est réécrit quand ses lignes changent…
        self.fiche(COTES + "/Lien.gdoc", "{}")
        self.assertEqual(self.auto(), 0)
        self.assertIn("raccourci Google", ap.lire_a_voir(self.pc))
        self.assertEqual(sorted(n for n in os.listdir(self.pc) if not os.path.isdir(os.path.join(self.pc, n))), [ap.A_VOIR], "pas de fichier temporaire")
        os.remove(os.path.join(self.racine, DRIVE_1, COTES, "Lien.gdoc"))
        self.assertEqual(self.auto(), 0)
        self.assertIn("Rien à signaler.", ap.lire_a_voir(self.pc))
        # … et au moins une fois par jour, comme le relevé
        avant_hier = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=2)
        with open(fichier, "w", encoding="utf-8-sig", newline="") as f:
            f.write(ap.texte_a_voir([], avant_hier))
        vieux = lire(releve)
        vieux["releve_le"] = "2026-01-01T08:00:00+01:00"
        ecrire(releve, json.dumps(vieux))
        ancien = ap.lire_a_voir(self.pc)
        self.assertEqual(self.auto(), 0)
        self.assertNotEqual(ap.lire_a_voir(self.pc), ancien)
        self.assertNotEqual(lire(releve)["releve_le"], vieux["releve_le"])

    def test_a_voir_reessaie_si_le_fichier_est_occupe(self):
        vrai, essais = os.replace, []

        def occupe(source, cible):
            essais.append(cible)
            if len(essais) < 3:
                raise PermissionError("fichier ouvert")
            vrai(source, cible)

        with mock.patch.object(ap.os, "replace", occupe), mock.patch.object(ap.time, "sleep", lambda secondes: None):
            self.assertTrue(ap.ecrire_a_voir(self.pc, ["un point"]))
        self.assertEqual(len(essais), 3)
        self.assertEqual(ap.points_a_voir(self.pc)[0], ["un point"])
        self.assertFalse(ap.ecrire_a_voir(self.pc, ["un point"]), "mêmes lignes : pas réécrit")
        self.assertTrue(ap.ecrire_a_voir(self.pc, ["un autre point"]))

    def test_aucun_ou_plusieurs_dossiers_du_pc_rien_n_est_devine(self):
        self.monde_propre()
        for nom in ("906 - SANS DOSSIER PC", "907 - DEUX DOSSIERS PC", "CHANTIER SANS NUMERO"):
            self.fiche(COTES + "/FICHE.pdf", "f", dossier=nom)
        for nom in ("907 - OPERATION", "907-OPERATION BIS", "9070 - AUTRE NUMERO", "90 - AUTRE NUMERO"):
            os.makedirs(os.path.join(self.pc, nom))
        self.fiche(COTES + "/BONNE.pdf", "b", dossier="903 - CHANTIER TROIS")
        self.fiche(COTES + "/MEME NOM.pdf", "taille du Drive", dossier="903 - CHANTIER TROIS")
        ecrire(os.path.join(self.pc, "903 - OPERATION TROIS - VILLE", COTES, "MEME NOM.pdf"), "autre taille")
        self.fiche("Divers/HORS.pdf", "h", dossier="903 - CHANTIER TROIS")
        self.fiche(COTES + "/Lien.gdoc", "{}", dossier="903 - CHANTIER TROIS")
        pc = photo(self.pc)
        self.assertEqual(self.auto(), 0)
        apres = photo(self.pc)
        self.assertEqual({n: v for n, v in apres.items() if n in pc}, pc, "rien de modifié ni supprimé")
        nouveaux = sorted(n for n in apres if n not in pc)
        self.assertEqual(nouveaux, sorted([ap.A_VOIR, "903 - OPERATION TROIS - VILLE/" + ap.PROVENANCE,
                                           "903 - OPERATION TROIS - VILLE/" + COTES + "/BONNE.pdf"]))
        texte = ap.lire_a_voir(self.pc)
        for attendu in (r"n° 906 \(dossier du Drive « 906 - SANS DOSSIER PC »\) : aucun dossier de chantier du PC ne commence par le numéro 906",
                        r"n° 907 .*plusieurs dossiers de chantier du PC commencent par le numéro 907 \(« 907 - OPERATION », « 907-OPERATION BIS »\)",
                        r"« CHANTIER SANS NUMERO » : pas de numéro de chantier", r"PAS de la même taille.*MEME NOM\.pdf",
                        r"4 point\(s\) demandent ton attention", r"Pour information .*\n\* Chantier n° 903 : 1 fichier hors des dossiers de fiches et "
                        r"1 raccourci Google, non copiés \(détail : appli-pc, choix 2 « Voir seulement »\)\."):
            self.assertRegex(texte, attendu)
        self.assertNotIn(self.racine, texte)
        self.assertNotIn(self.pc, texte)
        self.assertIn("4 point(s) à voir (+ 1 ligne(s) pour information).", self.lignes_du_journal()[0])
        self.assertNotIn("HORS.pdf", texte, "le détail fichier par fichier n'est plus dans « A VOIR »…")
        self.assertIn("Divers/HORS.pdf", self.lancer("--lister")[1], "… il est dans « Voir seulement »")

    def test_verrou_pris_sort_sans_erreur_et_le_dit(self):
        self.monde_propre()
        self.fiche(COTES + "/Lien.gdoc", "{}")
        self.assertEqual(self.auto(), 0)                    # un premier passage : un point connu dans « A VOIR »
        self.fiche(COTES + "/A.pdf", "a", dossier="903 - CHANTIER TROIS")
        ecrire(os.path.join(self.prive, ap.VERROU_FICHIER),
               json.dumps({"machine": ap.socket.gethostname(), "processus": 4, "instant": time.time(), "date": "à l'instant"}))
        drive, pc = photo(self.racine), photo(self.pc)
        with mock.patch.object(ap, "processus_vivant", lambda numero: True):
            self.assertEqual(self.auto(), 0)
            apres = photo(self.pc)
            self.assertEqual(photo(self.racine), drive)
            self.assertEqual({n: v for n, v in apres.items() if n != ap.A_VOIR}, {n: v for n, v in pc.items() if n != ap.A_VOIR}, "rien n'est copié")
            self.assertIn("un autre passage", self.lignes_du_journal()[-1])
            self.assertTrue(os.path.exists(os.path.join(self.prive, ap.VERROU_FICHIER)), "le verrou de l'autre reste")
            # C'est écrit dans « A VOIR », en PLUS des points déjà connus, et une seule fois
            texte = ap.lire_a_voir(self.pc)
            self.assertRegex(texte, "PASSAGE NON FAIT : le passage automatique a trouvé le programme déjà occupé")
            self.assertIn("* Chantier n° 901 : 1 raccourci Google", texte, "les lignes « pour information » sont gardées aussi")
            self.assertIn("1 point(s)", texte)
            date = os.stat(os.path.join(self.pc, ap.A_VOIR)).st_mtime_ns
            self.assertEqual(self.auto(), 0)
            self.assertEqual(os.stat(os.path.join(self.pc, ap.A_VOIR)).st_mtime_ns, date, "même ligne : pas réécrit")
            # Un verrou resté là depuis trente jours, même si son numéro de programme est vivant : repris, le travail se fait
            ecrire(os.path.join(self.prive, ap.VERROU_FICHIER),
                   json.dumps({"machine": ap.socket.gethostname(), "processus": 4, "instant": time.time() - 30 * 86400, "date": "il y a un mois"}))
            self.assertEqual(self.auto(), 0)
        self.assertTrue(os.path.isfile(os.path.join(self.pc, "903 - OPERATION TROIS - VILLE", COTES, "A.pdf")))
        self.assertNotIn("PASSAGE NON FAIT", ap.lire_a_voir(self.pc))
        self.assertEqual(sorted(os.listdir(self.prive)), ["appli-pc", "depot.json"])

    def test_drive_arrete_signale_et_ancienne_cle(self):
        # L'ancienne clé du réglage est encore lue
        del self.reglages["chantiers_pc"]
        self.reglages["mega"] = self.pc
        self.noter_reglages()
        self.monde_propre()
        self.fiche(COTES + "/Lien.gdoc", "{}")
        self.assertEqual(self.auto(), 0)
        self.assertIn("raccourci Google", ap.lire_a_voir(self.pc))
        # Drive pour ordinateur arrêté : rien n'est copié, code 2 ; la ligne est AJOUTÉE aux points connus, qui ne sont pas effacés
        shutil.move(os.path.join(self.racine, "dossiers.json"), os.path.join(self.temp, "dossiers.json"))
        self.fiche(COTES + "/A.pdf", "a")
        drive = photo(self.racine)
        self.assertEqual(self.auto(), 2)
        self.assertEqual(photo(self.racine), drive)
        self.assertFalse(os.path.exists(os.path.join(self.pc, PC_1, COTES, "A.pdf")))
        texte = ap.lire_a_voir(self.pc)
        self.assertRegex(texte, "PASSAGE NON FAIT : la recopie des fiches et le dépôt au carnet n'ont pas pu se faire.*Google Drive pour ordinateur")
        self.assertIn("raccourci Google", texte)
        self.assertIn("PAS FAIT", self.lignes_du_journal()[-1])
        # Drive revenu : le passage se fait, la ligne « non fait » disparaît
        shutil.move(os.path.join(self.temp, "dossiers.json"), os.path.join(self.racine, "dossiers.json"))
        self.assertEqual(self.auto(), 0)
        self.assertNotIn("PASSAGE NON FAIT", ap.lire_a_voir(self.pc))
        self.assertTrue(os.path.isfile(os.path.join(self.pc, PC_1, COTES, "A.pdf")))
        # Réglages absents : code 2, une ligne au journal, rien d'autre
        os.remove(self.reglages_fichier)
        self.assertEqual(self.auto(), 2)
        self.assertIn("n'existe pas", self.lignes_du_journal()[-1])

    def test_copie_en_erreur_code_1_et_a_voir(self):
        self.monde_propre()
        self.fiche(COTES + "/A.pdf", "a" * 50, dossier="903 - CHANTIER TROIS")

        def illisible(lecture, ecriture):
            raise OSError("lecture impossible")

        with mock.patch.object(ap, "copier_blocs", illisible):
            self.assertEqual(self.auto(), 1)
        self.assertRegex(ap.lire_a_voir(self.pc), r"copie impossible, à réessayer au prochain passage : .*A\.pdf")
        self.assertEqual(self.auto(), 0, "le passage suivant réussit")
        self.assertTrue(os.path.isfile(os.path.join(self.pc, "903 - OPERATION TROIS - VILLE", COTES, "A.pdf")))
        self.assertIn("Rien à signaler.", ap.lire_a_voir(self.pc))

    def test_a_voir_regroupe_par_chantier_ce_qui_ne_demande_rien(self):
        """Lot 4d : « hors des dossiers de fiches », « doublon fabriqué par Drive »… : UNE ligne par chantier, avec les nombres,
        après les points d'action, sous « Pour information » ; le compteur ne compte que les points d'action."""
        self.monde_propre()
        for nom in ("CCTP/LOT 08.pdf", "CCTP/LOT 10.pdf", "QT Tableau/QUANTITATIF.pdf"):
            self.fiche(nom, "hors", dossier="903 - CHANTIER TROIS")
        for nom in ("FICHE.pdf", "FICHE (1).pdf", "FICHE (2).pdf"):
            self.fiche(COTES + "/" + nom, "même", dossier="903 - CHANTIER TROIS")
        self.fiche(COTES + "/AUTRE.pdf", "a", dossier="904-CHANTIER QUATRE")
        self.fiche(COTES + "/AUTRE (1).pdf", "a", dossier="904-CHANTIER QUATRE")
        self.fiche(COTES + "/MEME NOM.pdf", "taille du Drive", dossier="904-CHANTIER QUATRE")
        ecrire(os.path.join(self.pc, "904-OPERATION QUATRE", COTES, "MEME NOM.pdf"), "autre taille")
        self.assertEqual(self.auto(), 0)
        texte = ap.lire_a_voir(self.pc)
        lignes = texte.splitlines()
        self.assertIn("1 point(s) demandent ton attention :", lignes, "seul le fichier de taille différente demande une action")
        self.assertEqual([l for l in lignes if l.startswith("* ")], [
            "* Chantier n° 903 : 3 fichiers hors des dossiers de fiches et 2 doublons fabriqués par Drive, non copiés "
            "(détail : appli-pc, choix 2 « Voir seulement »).",
            "* Chantier n° 904 : 1 doublon fabriqué par Drive, non copié (détail : appli-pc, choix 2 « Voir seulement »)."])
        # L'ordre : les points d'action, puis « Pour information », puis les dépôts au carnet
        rang = [next(i for i, l in enumerate(lignes) if l.startswith(debut)) for debut in ("- ", "Pour information", "* ", "Déposé au carnet")]
        self.assertEqual(rang, sorted(rang))
        self.assertNotIn("CCTP/LOT 08.pdf", texte)
        self.assertEqual(ap.points_a_voir(self.pc)[0], [l[2:] for l in lignes if l.startswith("- ")])
        self.assertEqual(len(ap.points_a_voir(self.pc, infos=True)[0]), 2)
        self.assertIn("1 point(s) à voir (+ 2 ligne(s) pour information).", [l for l in self.lignes_du_journal() if l.startswith("[")][-1])
        # Rien ne change : le fichier n'est pas réécrit
        date = os.stat(os.path.join(self.pc, ap.A_VOIR)).st_mtime_ns
        self.assertEqual(self.auto(), 0)
        self.assertEqual(os.stat(os.path.join(self.pc, ap.A_VOIR)).st_mtime_ns, date, "mêmes lignes : pas réécrit")
        # Un nombre change : réécrit
        self.fiche("CCTP/LOT 12.pdf", "hors", dossier="903 - CHANTIER TROIS")
        self.assertEqual(self.auto(), 0)
        self.assertIn("* Chantier n° 903 : 4 fichiers hors des dossiers de fiches et 2 doublons", ap.lire_a_voir(self.pc))
        # « Voir seulement » garde TOUT le détail, fichier par fichier
        code, sortie, _ = self.lancer("--lister")
        self.assertEqual(code, 0)
        for nom in ("CCTP/LOT 08.pdf", "CCTP/LOT 10.pdf", "CCTP/LOT 12.pdf", "QT Tableau/QUANTITATIF.pdf", "FICHE (1).pdf", "FICHE (2).pdf", "AUTRE (1).pdf"):
            self.assertIn(nom, sortie)

    def test_ancien_fichier_a_voir_relu_sans_erreur(self):
        """La tâche planifiée tournera avec la nouvelle version sur le fichier laissé par l'ancienne (lot 4c)."""
        self.monde_propre()
        hors = "hors des dossiers de fiches (pas copié : range-le dans le Drive s'il doit aller dans le dossier du chantier)"
        ancien = "\r\n".join([
            "CHANTIERPRO — À VOIR", "Mis à jour le 18/11/2026 à 17:42 (recopie des fiches de l'appli, dépôt au carnet des poseurs).", "",
            "8 point(s) demandent ton attention :",
            "- Dossier du Drive « CHANTIER SANS NUMERO » : pas de numéro de chantier en tête de son nom. Rien n'est copié pour lui "
            "(pour le relier à son dossier du PC : choix 4 du menu de appli-pc).",
            "- Chantier n° 903 (« 903 - OPERATION TROIS - VILLE ») — %s : CCTP/LOT 08.pdf" % hors,
            "- Chantier n° 903 (« 903 - OPERATION TROIS - VILLE ») — %s : QT Tableau/QUANTITATIF.pdf" % hors,
            "- Chantier n° 903 (« 903 - OPERATION TROIS - VILLE ») — %s : … et 4 autre(s) (liste complète : choix 2 du menu de appli-pc)." % hors,
            "- Chantier n° 903 (« 903 - OPERATION TROIS - VILLE ») — raccourci Google, qui ne contient pas le document (pas copié) : "
            "05 - CHANTIER/PRISE DE COTES/Lien.gdoc",
            "- Chantier n° 904 (« 904 - OPERATION — QUATRE ») — doublon fabriqué par Drive (pas copié) : 07 - ATELIER/Fab (1).pdf",
            "- Chantier n° 901 : 11 document(s) de bordereau en attente — numérotation à déclarer (appli-pc, choix 6). "
            "Rien n'est déposé au carnet depuis ses bordereaux d'ici là.",
            "- Chantier n° 902 : 4 document(s) de bordereau en attente — numérotation à déclarer (appli-pc, choix 6). "
            "Rien n'est déposé au carnet depuis ses bordereaux d'ici là.",
            "", "Déposé au carnet ces sept derniers jours (les poseurs voient ces documents) :",
            "+ 18/11/2026 17:23 — chantier n° 903 : 152 A PLAN D'ESSAI, 7 page(s), depuis « BORDEREAU 9 » (fichier « 903-08-152-A-PLAN D'ESSAI.pdf »)",
            "", "Un document déposé par erreur ? appli-pc, choix 5 (« Retirer un document du carnet »).",
            "Ce fichier n'est réécrit que si quelque chose change, et au moins une fois par jour.",
            "Pour savoir quand le passage automatique a tourné pour la dernière fois : appli-pc, choix 3.",
            "Rien n'est jamais supprimé ni écrasé par le programme.", ""])
        fichier = os.path.join(self.pc, ap.A_VOIR)
        with open(fichier, "w", encoding="utf-8-sig", newline="") as f:
            f.write(ancien)
        # Relu tel quel
        points, quand = ap.points_a_voir(self.pc)
        self.assertEqual((len(points), quand), (8, datetime.datetime(2026, 11, 18, 17, 42)))
        self.assertEqual(ap.points_a_voir(self.pc, infos=True)[0], [])
        # Un passage NON FAIT (Drive arrêté) juste après la mise à jour : sa ligne est ajoutée, l'ancien détail est regroupé
        shutil.move(os.path.join(self.racine, "dossiers.json"), os.path.join(self.temp, "dossiers.json"))
        self.assertEqual(self.auto(), 2)
        lignes = ap.lire_a_voir(self.pc).splitlines()
        self.assertIn("3 point(s) demandent ton attention :", lignes)
        self.assertIn("- Numérotation des bordereaux à déclarer (appli-pc, choix 6) — 2 chantiers : n° 901 (11 PDF), n° 902 (4 PDF). "
                      "Rien ne part au carnet depuis leurs bordereaux d'ici là (réponse « r » au choix 6 pour un chantier dont aucun plan "
                      "ne doit partir).", lignes)
        self.assertEqual([l for l in lignes if l.startswith("* ")], [
            "* Chantier n° 903 : 6 fichiers hors des dossiers de fiches et 1 raccourci Google, non copiés (détail : appli-pc, choix 2 « Voir seulement »).",
            "* Chantier n° 904 : 1 doublon fabriqué par Drive, non copié (détail : appli-pc, choix 2 « Voir seulement »)."])
        self.assertEqual(len([l for l in lignes if l.startswith("+ ")]), 1, "les dépôts récents sont gardés")
        self.assertEqual(len([l for l in lignes if l.startswith("- PASSAGE NON FAIT")]), 1)
        # Le passage suivant réussit et réécrit tout au format d'aujourd'hui, sans erreur ; « --a-voir » le montre
        shutil.move(os.path.join(self.temp, "dossiers.json"), os.path.join(self.racine, "dossiers.json"))
        self.assertEqual(self.auto(), 0)
        texte = ap.lire_a_voir(self.pc)
        self.assertIn("Rien à signaler.", texte)
        self.assertNotIn("PASSAGE NON FAIT", texte)
        self.assertNotIn("hors des dossiers de fiches (pas copié", texte)
        self.assertIn("152 A PLAN D'ESSAI", texte, "la section des dépôts n'est pas touchée par un passage des fiches seules")
        code, sortie, _ = self.lancer("--a-voir")
        self.assertEqual(code, 0)
        self.assertIn("Rien à signaler.", sortie)

    def test_le_journal_ne_grossit_pas_sans_fin(self):
        ecrire(self.journal, "x" * (ap.JOURNAL_AUTO_MAX + 10))
        ap.noter_auto(self.prive, ["un passage", "son détail"])
        dossier = os.path.dirname(self.journal)
        self.assertEqual(sorted(os.listdir(dossier)), ["auto-ancien.txt", "auto.txt"])
        self.assertEqual(os.path.getsize(os.path.join(dossier, "auto-ancien.txt")), ap.JOURNAL_AUTO_MAX + 10)
        self.assertRegex(self.lignes_du_journal()[0], r"^\[.+\] un passage$")
        self.assertEqual(self.lignes_du_journal()[1], "    son détail")
        ecrire(self.journal, "y" * (ap.JOURNAL_AUTO_MAX + 10))
        ap.noter_auto(self.prive, ["encore"])
        self.assertEqual(sorted(os.listdir(dossier)), ["auto-ancien.txt", "auto.txt"], "un seul ancien journal est gardé")

    def test_option_a_voir_et_dernier_passage(self):
        code, sortie, _ = self.lancer("--a-voir")
        self.assertEqual(code, 0)
        self.assertIn("n'existe pas encore", sortie)
        self.assertIn("n'a encore jamais tourné", sortie)
        self.assertRegex(self.lancer("--etat")[1], "jamais tourné.*étape 6 de la procédure.*APRÈS les essais")
        ap.ecrire_a_voir(self.pc, ["un point à regarder"])
        code, sortie, _ = self.lancer("--a-voir")
        self.assertIn("- un point à regarder", sortie)
        self.assertIn("1 point(s) demandent ton attention", sortie)
        # Après un passage automatique : la date du dernier passage ; --etat ne dit rien tant que tout va bien
        self.monde_propre()
        self.assertEqual(self.auto(), 0)
        self.assertRegex(self.lancer("--a-voir")[1], r"Dernier passage automatique réussi : le \d{2}/\d{2}/\d{4} à \d{2}:\d{2}\.")
        self.assertEqual(self.lancer("--etat"), (0, "", ""))
        # Plus de 3 heures sans passage réussi : le menu et « A VOIR » préviennent
        dernier = os.path.join(self.prive, "appli-pc", ap.DERNIER_PASSAGE)
        ecrire(dernier, json.dumps({"instant": time.time() - 4 * 3600, "date": "14/11/2026 à 06:00"}))
        for option in ("--etat", "--a-voir"):
            sortie = self.lancer(option)[1]
            self.assertRegex(sortie, "ATTENTION : le passage automatique .* n'a pas tourné depuis le 14/11/2026 à 06:00")
            self.assertIn("installer-tache.bat", sortie)
        # Un passage refusé (Drive arrêté) ne compte pas comme un passage réussi
        shutil.move(os.path.join(self.racine, "dossiers.json"), os.path.join(self.temp, "dossiers.json"))
        self.assertEqual(self.auto(), 2)
        self.assertIn("ATTENTION", self.lancer("--etat")[1])


class EstimationDuPoids(unittest.TestCase):
    """Lot 4d : le poids des images du carnet annoncé par « Voir seulement » doit tomber à ±20 % du poids réel du dépôt,
    quel que soit le plan (aéré ou chargé), alors que l'ancienne règle (tant d'octets par point) ne voyait que la surface."""

    @staticmethod
    def plan(chemin, pages=1, largeur=1700, hauteur=1200, charge=False):
        """Un PDF inventé : des pièces et quelques cotes (aéré), ou des hachures serrées et beaucoup de textes (chargé).
        Les points sont posés à 100 par pouce : une page de 1 700 points fait 3 400 points d'image à 200 dpi."""
        images = []
        for n in range(pages):
            image = Image.new("RGB", (largeur, hauteur), "white")
            trait = ImageDraw.Draw(image)
            for x in range(60 + 20 * n, largeur - 200, 260):
                trait.rectangle([x, 80, x + 200, hauteur - 120], outline=(0, 0, 0), width=3)
                trait.text((x + 60, hauteur // 2), "CH %d" % (x // 10), fill=(0, 0, 0))
            if charge:
                for x in range(-hauteur, largeur, 9):
                    trait.line([(x, 0), (x + hauteur, hauteur)], fill=(70, 70, 70), width=1)
                for y in range(20, hauteur, 14):
                    for x in range(10, largeur - 60, 70):
                        trait.text((x + (y * 7) % 23, y), "%d" % ((x * 31 + y * 17) % 4000), fill=(150, 0, 0))
            images.append(image)
        images[0].save(chemin, "PDF", resolution=100, save_all=True, append_images=images[1:])
        return chemin

    @staticmethod
    def vrai_poids(chemin, code):
        pypdfium2, _ = dc.charger_modules()
        document = pypdfium2.PdfDocument(chemin)
        try:
            return sum(o for n in range(len(document)) for _, o in dc.traiter_page(document[n], dc.DPI_PAR_CODE[code])[1])
        finally:
            document.close()

    def test_estimation_a_20_pour_cent_pres(self):
        dossier = tempfile.mkdtemp(dir=COMMUN["temp"])
        aere = self.plan(os.path.join(dossier, "aere.pdf"))
        charge = self.plan(os.path.join(dossier, "charge.pdf"), charge=True)
        long = self.plan(os.path.join(dossier, "long.pdf"), pages=11, largeur=900, hauteur=650, charge=True)
        estimes = {}
        for chemin, code in ((aere, "105"), (charge, "105"), (long, "001")):
            vrai, estime = self.vrai_poids(chemin, code), ap.poids_estime(chemin, code)
            estimes[os.path.basename(chemin)] = estime
            self.assertLess(abs(estime / vrai - 1), 0.20, "%s : estimé %d octets, réel %d" % (os.path.basename(chemin), estime, vrai))
        # Même surface, poids très différents : c'est ce que l'ancienne règle ne voyait pas
        self.assertGreater(estimes["charge.pdf"], 3 * estimes["aere.pdf"])

    def test_estimation_impossible(self):
        dossier = tempfile.mkdtemp(dir=COMMUN["temp"])
        self.assertIsNone(ap.poids_estime(ecrire(os.path.join(dossier, "faux.pdf"), "pas un PDF"), "105"))
        self.assertIsNone(ap.poids_estime(COMMUN["pdf"], "999"), "un numéro qui n'est pas du carnet : pas d'estimation")
        petit = ap.poids_estime(COMMUN["pdf"], "105")
        self.assertEqual(petit, self.vrai_poids(COMMUN["pdf"], "105"), "une petite page n'a que ses deux aperçus : pesée exacte")


class TachePlanifiee(Monde):
    """La tâche du Planificateur de Windows : on vérifie sa description (XML) et les commandes, sans jamais en lancer une."""
    PYTHONW = "C:\\Program Files\\Python Été & Cie\\pythonw.exe"
    SCRIPT = "C:\\Dépôt d'essai <1>\\chantier-pro\\outils\\appli_pc.py"
    ESPACE = "{http://schemas.microsoft.com/windows/2004/02/mit/task}"
    DEPART = datetime.datetime(2026, 11, 14, 8, 37, 12)
    SID = "S-1-5-21-1111111111-2222222222-3333333333-1001"
    WHOAMI = (0, '"pc-essai\\franck","%s"' % SID)

    def faux_lanceur(self, codes=()):
        codes = list(codes)

        def lanceur(arguments):
            if arguments[0] == "whoami":                  # la lecture de l'identifiant de la session
                lanceur.lectures.append(arguments)
                return self.WHOAMI
            lanceur.commandes.append(arguments)
            if "/xml" in arguments:
                with open(arguments[arguments.index("/xml") + 1], "rb") as f:
                    lanceur.xml.append(f.read())
            return (codes.pop(0) if codes else 0), "message de Windows"

        lanceur.commandes, lanceur.xml, lanceur.lectures = [], [], []
        return lanceur

    def valeur(self, racine, chemin):
        return racine.find("/".join(self.ESPACE + m for m in chemin.split("/"))).text

    def test_description_de_la_tache(self):
        texte = ap.xml_tache(self.PYTHONW, self.SCRIPT, "C:\\Dépôt d'essai <1>\\chantier-pro", "PC-ESSAI\\franck", self.DEPART,
                             ("--reglages", "C:\\Un Dossier\\depot.json"))
        self.assertTrue(texte.startswith('<?xml version="1.0" encoding="UTF-16"?>'))
        racine = ET.fromstring(texte.split("?>", 1)[1])          # bien formé, y compris avec « & », « < », espaces et accents
        v = lambda chemin: self.valeur(racine, chemin)           # noqa: E731
        # Deux déclencheurs dans UNE tâche : toutes les heures, et à l'ouverture de session de CET utilisateur seulement
        declencheurs = racine.find(self.ESPACE + "Triggers")
        self.assertEqual([d.tag.replace(self.ESPACE, "") for d in declencheurs], ["TimeTrigger", "LogonTrigger"])
        self.assertEqual(v("Triggers/TimeTrigger/Repetition/Interval"), "PT1H")
        self.assertEqual(v("Triggers/TimeTrigger/Repetition/StopAtDurationEnd"), "false")
        self.assertEqual(v("Triggers/TimeTrigger/StartBoundary"), "2026-11-14T08:37:12")
        self.assertEqual(v("Triggers/LogonTrigger/UserId"), "PC-ESSAI\\franck", "pas « tout utilisateur »")
        # Sans élévation, dans la session ouverte
        self.assertEqual(v("Principals/Principal/UserId"), "PC-ESSAI\\franck")
        self.assertEqual(v("Principals/Principal/LogonType"), "InteractiveToken")
        self.assertEqual(v("Principals/Principal/RunLevel"), "LeastPrivilege")
        self.assertNotIn("HighestAvailable", texte)
        self.assertNotIn("Password", texte)
        # Réglages
        for nom, attendu in (("DisallowStartIfOnBatteries", "false"), ("StopIfGoingOnBatteries", "false"), ("MultipleInstancesPolicy", "IgnoreNew"),
                             ("ExecutionTimeLimit", "PT1H"), ("StartWhenAvailable", "true"), ("Enabled", "true"), ("Hidden", "false"),
                             ("RunOnlyIfNetworkAvailable", "false"), ("WakeToRun", "false")):
            self.assertEqual(v("Settings/" + nom), attendu, nom)
        # Ce qui est lancé : sans fenêtre (pythonw), en mode automatique, depuis le dépôt
        self.assertEqual(v("Actions/Exec/Command"), self.PYTHONW)
        self.assertEqual(v("Actions/Exec/Arguments"), '"%s" --auto --reglages "C:\\Un Dossier\\depot.json"' % self.SCRIPT)
        self.assertEqual(v("Actions/Exec/WorkingDirectory"), "C:\\Dépôt d'essai <1>\\chantier-pro")
        self.assertNotIn("python.exe", texte)
        self.assertEqual(ap.commande_tache(ap.TACHE, "C:\\Temp\\t.xml"),
                         ["schtasks", "/create", "/tn", "ChantierPro - recopie des fiches", "/xml", "C:\\Temp\\t.xml", "/f"])
        self.assertEqual(ap.commande_retrait(ap.TACHE), ["schtasks", "/delete", "/tn", "ChantierPro - recopie des fiches", "/f"])
        for interdit in ("/ru", "/rl", "/rp", "/sc"):
            self.assertNotIn(interdit, ap.commande_tache(ap.TACHE, "t.xml"))

    def test_installer_une_seule_tache(self):
        pythonw = ecrire(os.path.join(self.temp, "pythonw.exe"))
        lanceur = self.faux_lanceur()
        self.assertEqual(ap.installer_tache(self.dire, lanceur, pythonw=pythonw, script=self.SCRIPT, utilisateur="PC-ESSAI\\franck",
                                            maintenant=self.DEPART), 0)
        creation, menage = lanceur.commandes
        self.assertEqual(creation[:5] + creation[6:], ["schtasks", "/create", "/tn", ap.TACHE, "/xml", "/f"])
        self.assertEqual(menage, ap.commande_retrait(ap.TACHE_ANCIENNE), "l'ancienne seconde tâche est retirée si elle existe")
        self.assertFalse(os.path.exists(creation[5]), "le fichier temporaire de description est supprimé")
        self.assertTrue(lanceur.xml[0].startswith(b"\xff\xfe"), "écrit en UTF-16, comme l'attend le Planificateur")
        racine = ET.fromstring(lanceur.xml[0].decode("utf-16").split("?>", 1)[1])
        self.assertEqual(self.valeur(racine, "Actions/Exec/Command"), pythonw)
        self.assertEqual(self.valeur(racine, "Triggers/LogonTrigger/UserId"), "PC-ESSAI\\franck")
        self.assertEqual(self.valeur(racine, "Triggers/TimeTrigger/StartBoundary"), "2026-11-14T08:37:00")
        for attendu in ("Toutes les heures", "ouverture de ta session", "À METTRE AU CARNET", "Planificateur de tâches", ap.A_VOIR, "mise à jour de Python"):
            self.assertIn(attendu, self.texte())

    def test_identifiant_de_la_session(self):
        self.assertEqual(ap.identifiant_utilisateur(lambda arguments: self.WHOAMI), self.SID)
        self.assertEqual(ap.identifiant_utilisateur(lambda arguments: (0, "PC\\franck S-1-5-21-9-8-7-1002\r\n")), "S-1-5-21-9-8-7-1002")
        for reponse in ((1, "accès refusé"), (0, "rien d'utile"), (0, "")):
            self.assertIsNone(ap.identifiant_utilisateur(lambda arguments: reponse))

        def absent(arguments):
            raise FileNotFoundError("whoami")

        self.assertIsNone(ap.identifiant_utilisateur(absent))
        # Lecture impossible : repli sur le nom de la session, la tâche est quand même décrite
        pythonw = ecrire(os.path.join(self.temp, "pythonw.exe"))
        lanceur = self.faux_lanceur()
        self.WHOAMI = (1, "")
        with mock.patch.dict(ap.os.environ, {"USERDOMAIN": "PC-ESSAI", "USERNAME": "franck"}):
            self.assertEqual(ap.installer_tache(self.dire, lanceur, pythonw=pythonw, script=self.SCRIPT), 0)
        racine = ET.fromstring(lanceur.xml[0].decode("utf-16").split("?>", 1)[1])
        self.assertEqual(self.valeur(racine, "Triggers/LogonTrigger/UserId"), "PC-ESSAI\\franck")

    def test_tache_refusee_par_windows(self):
        pythonw = ecrire(os.path.join(self.temp, "pythonw.exe"))
        lanceur = self.faux_lanceur([1])
        self.assertEqual(ap.installer_tache(self.dire, lanceur, pythonw=pythonw, script=self.SCRIPT, utilisateur="PC-ESSAI\\franck"), 1)
        self.assertEqual(len(lanceur.commandes), 1, "on n'insiste pas")
        self.assertFalse(os.path.exists(lanceur.commandes[0][5]))
        self.assertIn("n'a PAS pu être créée", self.texte())
        self.assertIn("message de Windows", self.texte())
        with self.assertRaisesRegex(dc.Refus, "pythonw"):
            ap.installer_tache(self.dire, lanceur, pythonw=os.path.join(self.temp, "absent.exe"), script=self.SCRIPT)
        self.assertEqual(len(lanceur.commandes), 1)

    def test_retirer_la_tache_et_l_ancien_nom(self):
        lanceur = self.faux_lanceur([0, 1])
        self.assertEqual(ap.retirer_tache(self.dire, lanceur), 0)
        self.assertEqual(lanceur.commandes, [ap.commande_retrait(ap.TACHE), ap.commande_retrait(ap.TACHE_ANCIENNE)])
        self.assertIn("Tâche retirée : « %s »." % ap.TACHE, self.texte())
        self.assertNotIn(ap.TACHE_ANCIENNE, self.texte(), "l'ancien nom absent : aucun message, aucune erreur")
        self.lignes.clear()
        lanceur = self.faux_lanceur([1, 0])
        self.assertEqual(ap.retirer_tache(self.dire, lanceur), 0)
        self.assertIn("rien à retirer", self.texte())
        self.assertIn("Tâche retirée : « %s »." % ap.TACHE_ANCIENNE, self.texte())

    def test_par_la_ligne_de_commande(self):
        avant = self.photos()
        lanceur = self.faux_lanceur()
        faux_python = ecrire(os.path.join(self.temp, "python", "python.exe"))
        ecrire(os.path.join(self.temp, "python", "pythonw.exe"))
        with mock.patch.object(ap.sys, "executable", faux_python):
            code, sortie, erreur = self.lancer("--installer-tache", lanceur=lanceur)
        self.assertEqual((code, erreur), (0, ""))
        self.assertEqual(len(lanceur.commandes), 2)
        racine = ET.fromstring(lanceur.xml[0].decode("utf-16").split("?>", 1)[1])
        self.assertEqual(self.valeur(racine, "Actions/Exec/Command"), os.path.join(self.temp, "python", "pythonw.exe"))
        arguments = self.valeur(racine, "Actions/Exec/Arguments")
        self.assertRegex(arguments, r'^"[^"]+appli_pc\.py" --auto --reglages ')
        self.assertIn(self.reglages_fichier, arguments, "la tâche lancera le programme avec les mêmes réglages")
        self.assertEqual(self.valeur(racine, "Actions/Exec/WorkingDirectory"), DEPOT)
        self.assertEqual(lanceur.lectures, [["whoami", "/user", "/fo", "csv", "/nh"]])
        self.assertEqual(self.valeur(racine, "Triggers/LogonTrigger/UserId"), self.SID, "l'utilisateur est désigné par son identifiant")
        self.assertEqual(self.valeur(racine, "Principals/Principal/UserId"), self.SID)
        lanceur = self.faux_lanceur()
        code, sortie, _ = self.lancer("--retirer-tache", lanceur=lanceur)
        self.assertEqual((code, len(lanceur.commandes)), (0, 2))
        shutil.rmtree(os.path.join(self.temp, "python"))
        self.assertEqual(self.photos(), avant, "installer ou retirer la tâche n'écrit aucun fichier dans les dossiers")


if __name__ == "__main__":
    unittest.main()
