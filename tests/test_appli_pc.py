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
        self.ecartes = os.path.join(self.prive, ap.ECARTES_FICHIER)
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
                         "anciens_codes": {"042A": "105", "044": "103", "041": "102"}}
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


class Candidats(Monde):
    def voir(self, **plus):
        return ap.candidats_carnet(self.reglages, plus.pop("ecartes", ap.lire_ecartes(self.ecartes)), **plus)

    def test_nom_conforme(self):
        chemin = self.bordereau(2, "901-09 ET 10-105-a-PLANS DE RESERVATIONS : DETAIL.pdf".replace(" :", ""))
        avant = self.photos()
        vu = self.voir()
        self.assertEqual(self.photos(), avant, "chercher les candidats n'écrit rien")
        self.assertEqual(vu["signales"], [])
        self.assertEqual(len(vu["candidats"]), 1)
        c = vu["candidats"][0]
        self.assertEqual((c["numero"], c["chantier"], c["bordereau"], c["dossier_drive"]), ("901", "Chantier Essai Un", "BORDEREAU 2", DRIVE_1))
        self.assertEqual((c["code"], c["indice"], c["intitule"], c["id"]), ("105", "A", "PLANS DE RESERVATIONS DETAIL", "105-A"))
        self.assertEqual((c["pages"], c["poids"], c["chemin"]), (2, os.path.getsize(COMMUN["pdf"]), chemin))
        self.assertEqual(c["relatif"], "/".join([PC_1, D08, "BORDEREAU 2", os.path.basename(chemin)]))
        self.assertRegex(c["date"], r"^\d{2}/\d{2}/\d{4} \d{2}:\d{2}$")
        self.assertIsNone(c["ancien_code"])
        texte = "\n".join(ap.decrire_candidat(c, 1, 1))
        for attendu in ("901", "Chantier Essai Un", "BORDEREAU 2", "2 page(s)", DRIVE_1, "105 A PLANS DE RESERVATIONS DETAIL"):
            self.assertIn(attendu, texte)

    def test_dossier_08_sous_un_autre_libelle_et_dossiers_ignores(self):
        self.bordereau(1, "901-10-104-A-REPERAGE DES PORTES.pdf", d08="08 - ENVOIS")
        self.bordereau(1, "901-10-106-A-HORS DU 08.pdf", d08="05 - CHANTIER")
        chemin = self.bordereau(1, "901-10-107-A-PAS UN BORDEREAU.pdf")
        os.makedirs(os.path.join(self.pc, PC_1, D08, "BROUILLONS"))
        shutil.move(chemin, os.path.join(self.pc, PC_1, D08, "BROUILLONS", os.path.basename(chemin)))
        self.bordereau(1, "BORDEREAU D'ENVOI 1.pdf", d08="08 - ENVOIS")
        self.bordereau(1, "SCAN SANS NOM.pdf", d08="08 - ENVOIS")
        vu = self.voir()
        self.assertEqual([c["id"] for c in vu["candidats"]], ["104-A"])
        self.assertEqual(self.motifs(vu), ["nom"], "le bordereau lui-même n'est pas signalé ; un PDF hors nomenclature l'est")

    def test_autre_chantier_numero_inconnu_ancien_numero(self):
        self.bordereau(1, "902-10-105-A-PLAN D'UN AUTRE CHANTIER.pdf")
        self.bordereau(1, "901-10-999-A-NUMERO INCONNU.pdf")
        self.bordereau(1, "901-10-105B-A-LETTRE INCONNUE.pdf")
        self.bordereau(1, "901-10-042A-A-ANCIEN NUMERO.pdf")
        self.bordereau(1, "901-10-041-A-ANCIEN NUMERO HORS CARNET.pdf")
        self.bordereau(1, "901-10-103-B-TABLEAU DE PORTES.pdf")
        self.bordereau(1, "901-10-105-RDC-PLAN DU REZ DE CHAUSSEE.pdf")
        vu = self.voir()
        self.assertEqual(sorted((c["id"], c["ancien_code"]) for c in vu["candidats"]), [("103-B", None), ("105-A", "042A")])
        self.assertEqual(self.motifs(vu), ["autre-chantier", "nom", "non-reconnu", "non-reconnu"])
        self.assertRegex([x["texte"] for x in vu["signales"] if x["motif"] == "nom"][0], "105-RDC-.*nom non reconnu", "« RDC » n'est pas un indice")
        os.remove(os.path.join(self.pc, PC_1, D08, "BORDEREAU 1", "901-10-105-RDC-PLAN DU REZ DE CHAUSSEE.pdf"))
        self.assertEqual(vu["hors_carnet"], 1, "041 → 102 : connu, pas au carnet, pas signalé")
        self.assertIn("Ancien numéro 042A", "\n".join(ap.decrire_candidat([c for c in vu["candidats"] if c["ancien_code"]][0])))
        # Une table propre au chantier l'emporte ; un numéro « hors carnet » déclaré n'est plus signalé
        self.reglages["chantiers"]["901"]["anciens_codes"] = {"103": "999"}
        self.reglages["hors_carnet"] = ["999"]
        vu = self.voir()
        self.assertEqual([c["id"] for c in vu["candidats"]], ["105-A"])
        self.assertEqual(self.motifs(vu), ["autre-chantier", "non-reconnu"])
        self.assertEqual(vu["hors_carnet"], 3)

    def test_meme_document_dans_deux_bordereaux(self):
        ancien = self.bordereau(1, "901-10-105-A-RESERVATIONS.pdf")
        recent = self.bordereau(3, "901-10-105-A-RESERVATIONS.pdf", COMMUN["autre"])
        os.utime(ancien, (1700000000, 1700000000))
        os.utime(recent, (1750000000, 1750000000))
        vu = self.voir()
        self.assertEqual([(c["bordereau"], c["pages"]) for c in vu["candidats"]], [("BORDEREAU 3", 1)])
        self.assertEqual(self.motifs(vu), ["plusieurs-bordereaux"])
        self.assertRegex(vu["signales"][0]["texte"], r"le plus récent est gardé \(BORDEREAU 3")

    def test_pdf_illisible_et_chantier_sans_dossier(self):
        ecrire(os.path.join(self.pc, PC_1, D08, "BORDEREAU 1", "901-10-105-A-FAUX.pdf"), "ceci n'est pas un PDF")
        self.reglages["chantiers"]["902"] = {"chantier": "Deux", "dossier_drive": "DOSSIER ABSENT"}
        self.reglages["chantiers"]["903"] = {"chantier": "Trois", "dossier_drive": DRIVE_2}
        vu = self.voir()
        self.assertEqual(vu["candidats"], [])
        self.assertEqual(self.motifs(vu), ["chantier", "chantier", "illisible"])

    def test_ecarte_puis_refait(self):
        chemin = self.bordereau(1, "901-10-105-A-RESERVATIONS.pdf")
        c = self.voir()["candidats"][0]
        bilan = ap.traiter_carnet(self.reglages, [c], self.ecartes, saisies("n"), self.dire)
        self.assertEqual((len(bilan["ecartes"]), bilan["deposes"], bilan["verifications"]), (1, [], {}))
        note = lire(self.ecartes)
        self.assertEqual((note["version"], len(note["ecartes"])), (1, 1))
        self.assertEqual((note["ecartes"][0]["chemin"], note["ecartes"][0]["taille"]), (c["relatif"], c["poids"]))
        self.assertFalse(os.path.isabs(note["ecartes"][0]["chemin"]))
        vu = self.voir()
        self.assertEqual((vu["candidats"], vu["ecartes"]), ([], 1), "écarté : plus proposé tant que la taille est la même")
        shutil.copy(COMMUN["autre"], chemin)
        self.assertEqual([c["id"] for c in self.voir()["candidats"]], ["105-A"], "refait sous le même nom : proposé de nouveau")
        self.assertFalse(os.path.exists(os.path.join(self.racine, DRIVE_1, "CARNET")), "rien n'a été déposé")


class Depot(Monde):
    def test_depot_de_bout_en_bout(self):
        self.bordereau(1, "901-10-105-A-RESERVATIONS DETAIL.pdf")
        self.bordereau(1, "901-10-106-A-RESERVATIONS REPERAGE.pdf")
        self.bordereau(2, "901-10-104-A-REPERAGE DES PORTES.pdf")
        self.fiche(COTES + "/PRISE DE COTES ESSAI 2026-11-12.pdf")
        drive, pc, _ = self.photos()
        candidats = ap.candidats_carnet(self.reglages)["candidats"]
        self.assertEqual([c["id"] for c in candidats], ["104-A", "105-A", "106-A"])
        demander = saisies("x", "o", "n", "")          # « x » n'est pas compris : la question est reposée
        bilan = ap.traiter_carnet(self.reglages, candidats, self.ecartes, demander, self.dire)
        self.assertEqual(demander.reste, [])
        self.assertEqual([c["id"] for c in bilan["deposes"]], ["104-A"])
        self.assertEqual([c["id"] for c in bilan["ecartes"]], ["105-A"])
        self.assertEqual([c["id"] for c in bilan["plus_tard"]], ["106-A"])
        self.assertEqual(bilan["refuses"], [])
        self.assertTrue(bilan["verifications"]["901"]["bon"], bilan["verifications"])
        self.assertIn("page 2/2", self.texte(), "l'avancement page par page est montré")
        # Dans le Drive : seul le dossier CARNET du chantier est apparu ; rien d'autre n'a bougé
        apres = photo(self.racine)
        nouveaux = sorted(n for n in apres if n not in drive)
        self.assertTrue(nouveaux and all(n.startswith(DRIVE_1 + "/CARNET") for n in nouveaux), nouveaux)
        self.assertEqual({n: v for n, v in apres.items() if n in drive}, drive)
        self.assertEqual(photo(self.pc), pc, "les dossiers de chantier ne sont pas touchés par le dépôt")
        liste = lire(os.path.join(self.racine, DRIVE_1, "CARNET", "carnet.json"))
        self.assertEqual(liste["chantier"], "Chantier Essai Un")
        self.assertEqual([(d["id"], d["intitule"], len(d["pages"])) for d in liste["documents"]], [("104-A", "REPERAGE DES PORTES", 2)])
        self.assertEqual(liste["documents"][0]["source"]["nom"], "901-10-104-A-REPERAGE DES PORTES.pdf")
        self.assertTrue(dc.verifier(self.racine, DRIVE_1)["bon"])
        # Au lancement suivant : le déposé et l'écarté ne sont plus proposés, le « plus tard » l'est
        vu = ap.candidats_carnet(self.reglages, ap.lire_ecartes(self.ecartes))
        self.assertEqual(([c["id"] for c in vu["candidats"]], vu["signales"], vu["ecartes"]), (["106-A"], [], 1))

    def test_document_change_depuis_son_depot(self):
        chemin = self.bordereau(1, "901-10-105-A-RESERVATIONS.pdf")
        candidats = ap.candidats_carnet(self.reglages)["candidats"]
        ap.traiter_carnet(self.reglages, candidats, self.ecartes, saisies("o"), self.dire)
        self.assertEqual(ap.candidats_carnet(self.reglages), {"candidats": [], "signales": [], "hors_carnet": 0, "ecartes": 0, "retires": 0})
        shutil.copy(COMMUN["autre"], chemin)
        vu = ap.candidats_carnet(self.reglages)
        self.assertEqual((vu["candidats"], self.motifs(vu)), ([], ["change"]))
        self.assertIn("A CHANGÉ DEPUIS SON DÉPÔT", vu["signales"][0]["texte"])
        self.assertIn("indice suivant", vu["signales"][0]["texte"])
        # L'ancien est retiré par le menu : aucun fichier n'est supprimé, et le document n'est PAS reproposé à chaque lancement
        avant = photo(self.racine)
        rendu = ap.retirer_document(self.reglages, saisies("1", "1", "o"), self.dire)
        self.assertEqual(rendu["id"], "105-A")
        self.assertEqual(set(photo(self.racine)), set(avant), "retirer ne supprime aucun fichier")
        vu = ap.candidats_carnet(self.reglages)
        self.assertEqual((vu["candidats"], self.motifs(vu), vu["retires"]), ([], ["change"], 0))
        self.assertRegex(vu["signales"][0]["texte"], "retiré du carnet.*indice suivant")
        # Le fichier d'origine remis à sa place : retiré, et identique à ce qui avait été déposé → ni proposé, ni signalé
        shutil.copy(COMMUN["pdf"], chemin)
        vu = ap.candidats_carnet(self.reglages)
        self.assertEqual((vu["candidats"], vu["signales"], vu["retires"]), ([], [], 1))
        # Le même document sous l'indice suivant est proposé normalement
        self.bordereau(2, "901-10-105-B-RESERVATIONS.pdf", COMMUN["autre"])
        self.assertEqual([c["id"] for c in ap.candidats_carnet(self.reglages)["candidats"]], ["105-B"])

    def test_retirer_abandonne(self):
        self.bordereau(1, "901-10-105-A-RESERVATIONS.pdf")
        ap.traiter_carnet(self.reglages, ap.candidats_carnet(self.reglages)["candidats"], self.ecartes, saisies("o"), self.dire)
        avant = photo(self.racine)
        for reponses in ((), ("",), ("7",), ("1", ""), ("1", "1", ""), ("1", "1", "n")):
            self.assertIsNone(ap.retirer_document(self.reglages, saisies(*reponses), self.dire))
        self.assertEqual(photo(self.racine), avant)

    def test_depot_refuse_puis_suite(self):
        self.bordereau(1, "901-10-105-A-RESERVATIONS.pdf")
        self.bordereau(1, "901-10-106-A-REPERAGE.pdf")
        candidats = ap.candidats_carnet(self.reglages)["candidats"]
        appels = []

        def deposer(*arguments, **options):
            appels.append(arguments[4])
            if arguments[4] == "105":
                raise dc.Refus("refus simulé")
            if appels.count("106") == 1:           # une première fois « pas terminé » : le programme relance
                return {"termine": False, "id": "106-A", "pages": 2, "faites": 1, "restent": 1, "poids": 0, "dossier": "x"}
            return dc.deposer(*arguments, **options)

        bilan = ap.traiter_carnet(self.reglages, candidats, self.ecartes, saisies("o", "o"), self.dire, deposer=deposer)
        self.assertEqual(appels, ["105", "106", "106"])
        self.assertEqual([(c["id"], m) for c, m in bilan["refuses"]], [("105-A", "refus simulé")])
        self.assertEqual([c["id"] for c in bilan["deposes"]], ["106-A"])
        self.assertTrue(bilan["verifications"]["901"]["bon"])

    def test_saisie_fermee_rien_n_est_depose(self):
        self.bordereau(1, "901-10-105-A-RESERVATIONS.pdf")
        self.bordereau(1, "901-10-106-A-REPERAGE.pdf")
        avant = self.photos()
        bilan = ap.traiter_carnet(self.reglages, ap.candidats_carnet(self.reglages)["candidats"], self.ecartes, saisies(), self.dire)
        self.assertEqual(len(bilan["plus_tard"]), 2)
        self.assertEqual(self.photos(), avant)


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
        self.assertEqual(sorted(provenance), ["chantier", "fichiers", "numero", "version"])
        self.assertEqual((provenance["version"], provenance["chantier"], provenance["numero"]), (1, "Chantier Essai Un", "901"))
        self.assertEqual(sorted(e["chemin"] for e in provenance["fichiers"]), sorted(list(copies) + [COTES + "/DEJA LA.pdf"]))
        for e in provenance["fichiers"]:
            # « déjà présent » : inscrit seulement après comparaison du contenu, et c'est noté
            deja = e["chemin"] == COTES + "/DEJA LA.pdf"
            self.assertEqual(sorted(e), ["chemin", "copie_le", "taille", "verifie"] if deja else ["chemin", "copie_le", "taille"])
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
        self.assertRegex("\n".join(ap.lignes_a_voir(plan)), "fiche de l'appli absente du dossier du PC : déplacée ou supprimée \\?.*A\\.pdf")
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
        self.assertFalse(os.path.exists(os.path.join(self.pc, PC_1, ap.PROVENANCE)))
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
        ecrire(self.ecartes, "pas du json")
        refuse("illisible")
        os.remove(self.ecartes)
        shutil.move(os.path.join(self.racine, "dossiers.json"), os.path.join(self.temp, "dossiers.json"))
        refuse("dossiers.json")
        refuse("dossiers.json", "--rapatrier")
        ecrire(os.path.join(self.racine, "dossiers.json"), "{ illisible")
        refuse("illisible", "--rapatrier", "--oui-rapatrier")
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
        for attendu in ("VOIR SEULEMENT", "n° 901", PC_1, DRIVE_2, "105 A RESERVATIONS", "non reconnu", "1 fichier(s) à copier",
                        "hors des dossiers de fiches", "_À CLASSER"):
            self.assertIn(attendu, sortie)

    def test_tout_traiter(self):
        self.bordereau(1, "901-10-105-A-RESERVATIONS.pdf")
        self.fiche(COTES + "/A.pdf", "a")
        self.fiche(COTES + "/B.gdoc", "{}")
        self.fiche(COTES + "/X.pdf", "x", dossier=DRIVE_2)
        demander = saisies("o", "o")
        code, sortie, erreur = self.lancer(demander=demander)
        self.assertEqual((code, erreur, demander.reste), (0, "", []))
        self.assertTrue(os.path.isfile(os.path.join(self.racine, DRIVE_1, "CARNET", "carnet.json")))
        self.assertTrue(os.path.isfile(os.path.join(self.pc, PC_1, COTES, "A.pdf")))
        for attendu in ("BILAN", "Carnet : 1 déposé(s)", "Recopie des fiches : 1 fichier(s) copié(s) dans les dossiers de chantier du PC, 0 déjà présent(s), 1 signalé(s)",
                        "VÉRIFIER QUE MEGA A FINI DE SYNCHRONISER", "Rien n'a été supprimé"):
            self.assertIn(attendu, sortie)
        self.assertEqual(sorted(os.listdir(self.prive)), ["appli-pc", "depot.json"], "le verrou est libéré")
        journal = os.listdir(os.path.join(self.prive, "appli-pc"))
        self.assertEqual(len(journal), 1)
        self.assertRegex(journal[0], r"^journal-\d{4}-\d{2}-\d{2}\.txt$")
        with open(os.path.join(self.prive, "appli-pc", journal[0]), encoding="utf-8") as f:
            note = f.read()
        self.assertIn("BILAN", note)
        self.assertIn("Déposer au carnet ?", note)
        a_voir = ap.lire_a_voir(self.pc)
        self.assertIn("raccourci Google", a_voir)
        self.assertIn(DRIVE_2, a_voir, "un dossier du Drive sans numéro est signalé")
        # Deuxième lancement : rien à proposer, « non » à la recopie ; rien ne change dans les dossiers du PC ni dans le Drive
        drive, pc, _ = self.photos()
        code, sortie, _ = self.lancer(demander=saisies(""))
        self.assertEqual(code, 0)
        self.assertIn("Aucun document à proposer", sortie)
        self.assertIn("pas fait", sortie)
        self.assertEqual((photo(self.racine), photo(self.pc)), (drive, pc))

    def test_options_separees_et_code_1(self):
        self.bordereau(1, "901-10-105-A-RESERVATIONS.pdf")
        self.fiche(COTES + "/A.pdf", "a")
        code, sortie, _ = self.lancer("--rapatrier", "--oui-rapatrier")
        self.assertEqual(code, 0)
        self.assertNotIn("CARNET :", sortie)
        self.assertFalse(os.path.exists(os.path.join(self.racine, DRIVE_1, "CARNET")))
        self.assertTrue(os.path.isfile(os.path.join(self.pc, PC_1, COTES, "A.pdf")))
        pc = photo(self.pc)
        # Le carnet seul : le document est déposé, les dossiers de chantier ne sont pas touchés
        code, sortie, _ = self.lancer("--carnet", demander=saisies("o"))
        self.assertEqual(code, 0)
        self.assertEqual(photo(self.pc), pc, "--carnet ne rapatrie pas")
        self.assertTrue(os.path.isfile(os.path.join(self.racine, DRIVE_1, "CARNET", "carnet.json")))
        # Un chantier de la correspondance sans dossier sur le PC : rien n'est deviné ni copié pour lui, c'est écrit dans
        # « A VOIR » ; les autres chantiers sont faits ; ce n'est pas une erreur du programme (code 0)
        self.reglages["chantiers"]["905"] = {"chantier": "Cinq", "dossier_drive": DRIVE_2}
        self.noter_reglages()
        self.fiche(COTES + "/C.pdf", "c")
        self.fiche(COTES + "/D.pdf", "d", dossier=DRIVE_2)
        code, sortie, _ = self.lancer("--rapatrier", "--oui-rapatrier")
        self.assertEqual(code, 0)
        self.assertRegex(ap.lire_a_voir(self.pc), "Chantier n° 905 .*aucun dossier de chantier du PC ne commence par le numéro 905")
        self.assertIn("905", sortie)
        self.assertTrue(os.path.isfile(os.path.join(self.pc, PC_1, COTES, "C.pdf")))
        self.assertFalse([n for n in photo(self.pc) if n.endswith("D.pdf")])
        self.assertEqual(sorted(os.listdir(self.prive)), ["appli-pc", "depot.json"])

    def test_associer_et_retirer_par_la_ligne_de_commande(self):
        code, sortie, _ = self.lancer("--associer", demander=saisies("", "1", ""))
        self.assertEqual(code, 0)
        self.assertEqual(lire(self.reglages_fichier)["chantiers"]["902"]["dossier_drive"], DRIVE_2)
        self.bordereau(1, "901-10-105-A-RESERVATIONS.pdf")
        self.assertEqual(self.lancer("--carnet", demander=saisies("o"))[0], 0)
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
        demander = saisies("o", "o")
        code, sortie, erreur = self.lancer("--chantier", "902", demander=demander)
        self.assertEqual((code, erreur, demander.reste), (0, "", []))
        self.assertIn("UN SEUL CHANTIER : le n° 902", sortie)
        self.assertIn("1 chantier(s)", demander.questions[-1])
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
            code, _, erreur = self.lancer("--chantier", numero, demander=saisies("o", "o"))
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
        self.assertRegex(journal[0], r"^\[\d{2}/\d{2}/\d{4} \d{2}:\d{2}\] 4 chantier\(s\) ; 4 fichier\(s\) copié\(s\), 0 en erreur ; 0 point\(s\) à voir\.$")
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
                        r"hors des dossiers de fiches.*Divers/HORS\.pdf", r"raccourci Google.*Lien\.gdoc", r"6 point\(s\) demandent ton attention"):
            self.assertRegex(texte, attendu)
        self.assertNotIn(self.racine, texte)
        self.assertNotIn(self.pc, texte)
        self.assertIn("6 point(s) à voir", self.lignes_du_journal()[0])

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
            self.assertRegex(texte, "PASSAGE NON FAIT : la recopie automatique a trouvé le programme déjà occupé")
            self.assertIn("raccourci Google", texte)
            self.assertIn("2 point(s)", texte)
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
        self.assertRegex(texte, "PASSAGE NON FAIT : la recopie des fiches n'a pas pu se faire.*Google Drive pour ordinateur")
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
        self.assertIn("jamais tourné", self.lancer("--etat")[1])
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
            self.assertRegex(sortie, "ATTENTION : la recopie automatique des fiches n'a pas tourné depuis le 14/11/2026 à 06:00")
            self.assertIn("installer-tache.bat", sortie)
        # Un passage refusé (Drive arrêté) ne compte pas comme un passage réussi
        shutil.move(os.path.join(self.racine, "dossiers.json"), os.path.join(self.temp, "dossiers.json"))
        self.assertEqual(self.auto(), 2)
        self.assertIn("ATTENTION", self.lancer("--etat")[1])



class TachePlanifiee(Monde):
    """La tâche du Planificateur de Windows : on vérifie sa description (XML) et les commandes, sans jamais en lancer une."""
    PYTHONW = "C:\\Program Files\\Python Été & Cie\\pythonw.exe"
    SCRIPT = "C:\\Dépôt d'essai <1>\\chantier-pro\\outils\\appli_pc.py"
    ESPACE = "{http://schemas.microsoft.com/windows/2004/02/mit/task}"
    DEPART = datetime.datetime(2026, 11, 14, 8, 37, 12)

    def faux_lanceur(self, codes=()):
        codes = list(codes)

        def lanceur(arguments):
            lanceur.commandes.append(arguments)
            if "/xml" in arguments:
                with open(arguments[arguments.index("/xml") + 1], "rb") as f:
                    lanceur.xml.append(f.read())
            return (codes.pop(0) if codes else 0), "message de Windows"

        lanceur.commandes, lanceur.xml = [], []
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
        self.assertEqual(v("Actions/Exec/Arguments"), '"%s" --rapatrier --auto --reglages "C:\\Un Dossier\\depot.json"' % self.SCRIPT)
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
        for attendu in ("toutes les heures", "ouverture de ta session", "Planificateur de tâches", ap.A_VOIR, "mise à jour de Python"):
            self.assertIn(attendu, self.texte())

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
        self.assertRegex(arguments, r'^"[^"]+appli_pc\.py" --rapatrier --auto --reglages ')
        self.assertIn(self.reglages_fichier, arguments, "la tâche lancera le programme avec les mêmes réglages")
        self.assertEqual(self.valeur(racine, "Actions/Exec/WorkingDirectory"), DEPOT)
        self.assertTrue(self.valeur(racine, "Triggers/LogonTrigger/UserId"))
        lanceur = self.faux_lanceur()
        code, sortie, _ = self.lancer("--retirer-tache", lanceur=lanceur)
        self.assertEqual((code, len(lanceur.commandes)), (0, 2))
        shutil.rmtree(os.path.join(self.temp, "python"))
        self.assertEqual(self.photos(), avant, "installer ou retirer la tâche n'écrit aucun fichier dans les dossiers")


if __name__ == "__main__":
    unittest.main()
