# -*- coding: utf-8 -*-
"""Tests du programme de dépôt au carnet (outils/depot_carnet.py).

    python -m unittest tests/test_depot_carnet.py        (depuis la racine du dépôt)

Tout se passe dans des dossiers temporaires, avec un PDF fabriqué ici : jamais le vrai Drive, jamais un vrai plan.
"""
import contextlib
import io
import json
import os
import re
import shutil
import sys
import tempfile
import unittest

DEPOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(DEPOT, "outils"))

import depot_carnet as dc          # noqa: E402
from PIL import Image, ImageDraw   # noqa: E402

CHANTIER = "CHANTIER ESSAI 1"


def nom_sur_du_serveur():
    """L'expression CARNET_NOM_SUR, lue dans le serveur lui-même : le dépôt doit lui convenir exactement."""
    with open(os.path.join(DEPOT, "apps-script", "Carnet.gs"), encoding="utf-8") as f:
        trouve = re.search(r"const CARNET_NOM_SUR = /(.+?)/;", f.read())
    return re.compile(trouve.group(1))


def dessin(largeur, hauteur):
    image = Image.new("RGB", (largeur, hauteur), "white")
    trait = ImageDraw.Draw(image)
    for x in range(0, largeur, 97):
        trait.line([(x, 0), (largeur - x, hauteur)], fill=(40, 40, 40), width=3)
    for y in range(0, hauteur, 211):
        trait.rectangle([y % largeur, y, (y % largeur) + 150, y + 90], outline=(200, 30, 30), width=5)
    return image


def fabriquer_pdf(chemin, tailles):
    """Un PDF dont les pages mesurent « tailles » (en points : 72 par pouce)."""
    pages = [dessin(l, h) for l, h in tailles]
    pages[0].save(chemin, "PDF", resolution=72, save_all=True, append_images=pages[1:])


def nouvelle_racine(parent, carnet=None):
    racine = tempfile.mkdtemp(dir=parent)
    with open(os.path.join(racine, "dossiers.json"), "w", encoding="utf-8") as f:
        json.dump({"documents": {"carnet": carnet} if carnet else {}}, f)
    os.mkdir(os.path.join(racine, CHANTIER))
    return racine


def contenu(racine):
    """Tous les fichiers et dossiers sous la racine, avec la taille des fichiers."""
    vu = {}
    for dossier, sous, fichiers in os.walk(racine):
        for n in sous:
            vu[os.path.relpath(os.path.join(dossier, n), racine)] = "dossier"
        for n in fichiers:
            vu[os.path.relpath(os.path.join(dossier, n), racine)] = os.path.getsize(os.path.join(dossier, n))
    return vu


def lire(chemin):
    with open(chemin, encoding="utf-8") as f:
        return json.load(f)


def sans_date(documents):
    return [{k: v for k, v in d.items() if k != "date"} for d in documents]


COMMUN = {}


def setUpModule():
    """Fabriqué une seule fois pour tous les tests : les deux PDF et le dépôt de référence, fait d'une traite."""
    temp = tempfile.mkdtemp()
    unittest.addModuleCleanup(shutil.rmtree, temp, True)
    # Une petite page, une « grande » (plusieurs niveaux, plusieurs paquets), une petite
    pdf = os.path.join(temp, "plan essai.pdf")
    fabriquer_pdf(pdf, [(400, 560), (3000, 2000), (560, 400)])
    petit = os.path.join(temp, "petit.pdf")
    fabriquer_pdf(petit, [(400, 560), (560, 400)])
    reference = nouvelle_racine(temp)
    lignes = []
    # Code 001 : 150 dpi. L'indice et l'intitulé sont donnés « sales » exprès.
    compte_rendu = dc.deposer(reference, CHANTIER, None, pdf, "001", "a", "PLAN : D'ESSAI ?", dire=lignes.append)
    COMMUN.update(temp=temp, pdf=pdf, petit=petit, reference=reference, lignes=lignes, compte_rendu=compte_rendu)


class Base(unittest.TestCase):
    def setUp(self):
        for nom, valeur in COMMUN.items():
            setattr(self, nom, valeur)

    def carnet(self, racine, nom="CARNET"):
        return os.path.join(racine, CHANTIER, nom)

    def copie(self):
        """Une copie du dépôt de référence, que le test peut abîmer."""
        racine = os.path.join(tempfile.mkdtemp(dir=self.temp), "racine")
        shutil.copytree(self.reference, racine)
        return racine

    def deposer_petit(self, racine, code="105", indice="A", intitule="PETIT PLAN", **plus):
        return dc.deposer(racine, CHANTIER, plus.pop("chantier", None), plus.pop("pdf", self.petit), code, indice, intitule,
                          dire=lambda ligne: None, **plus)

    def refus(self, racine, attendu, travail):
        """Le travail est refusé, avec ce message, et rien n'a changé sous la racine."""
        avant = contenu(racine)
        with self.assertRaises(dc.Refus) as c:
            travail()
        self.assertRegex(str(c.exception), attendu)
        self.assertEqual(contenu(racine), avant, "un refus n'écrit rien")


class DepotComplet(Base):
    def test_compte_rendu_et_lignes(self):
        r = self.compte_rendu
        self.assertEqual((r["termine"], r["id"], r["pages"], r["faites"], r["restent"]), (True, "001-A", 3, 3, 0))
        self.assertEqual(r["dossier"], "001 A PLAN D'ESSAI")
        self.assertEqual(len([ligne for ligne in self.lignes if ligne.startswith("  page ")]), 3, "une ligne par page")

    def test_forme_de_carnet_json(self):
        liste = lire(os.path.join(self.carnet(self.reference), "carnet.json"))
        self.assertEqual(liste["version"], 1)
        self.assertEqual(liste["chantier"], CHANTIER)
        self.assertEqual(len(liste["documents"]), 1)
        d = liste["documents"][0]
        self.assertEqual((d["id"], d["code"], d["indice"], d["intitule"], d["dossier"]),
                         ("001-A", "001", "A", "PLAN D'ESSAI", "001 A PLAN D'ESSAI"))
        self.assertRegex(d["date"], r"^\d{4}-\d{2}-\d{2}$")
        self.assertEqual(d["source"], {"nom": "plan essai.pdf", "poids": os.path.getsize(self.pdf)})
        self.assertEqual(len(d["pages"]), 3)
        petite, grande = d["pages"][0], d["pages"][1]
        self.assertEqual((petite["l"], petite["h"], petite["dpi"], petite["niveaux"]), (833, 1167, 150, []))
        self.assertEqual((grande["l"], grande["h"], grande["dpi"]), (6250, 4167, 150))
        self.assertEqual([n["z"] for n in grande["niveaux"]], [0, 1, 2, 3])
        self.assertGreater(len(grande["niveaux"][0]["paquets"]), 1, "plusieurs paquets au niveau 0")
        self.assertEqual(self.compte_rendu["poids"], d["poids"])

    def test_ce_que_le_serveur_attend(self):
        sur = nom_sur_du_serveur()
        self.assertEqual(sur.pattern, dc.NOM_SUR.pattern, "même règle que CARNET_NOM_SUR")
        d = lire(os.path.join(self.carnet(self.reference), "carnet.json"))["documents"][0]
        self.assertRegex(d["id"], sur)
        self.assertNotRegex(d["dossier"], r"[/\\]")
        self.assertIsInstance(d["pages"], list)
        noms = []
        for numero, page in enumerate(d["pages"], 1):
            self.assertEqual(page["leger"]["f"], "p%d-leger.webp" % numero)
            self.assertEqual(page["net"]["f"], "p%d-net.webp" % numero)
            noms += [page["leger"]["f"], page["net"]["f"]]
            for niveau in page["niveaux"]:
                for k, paquet in enumerate(niveau["paquets"]):
                    self.assertEqual(paquet["f"], "p%d-z%d-%d.pak" % (numero, niveau["z"], k))
                    noms.append(paquet["f"])
                    for t in paquet["tuiles"]:
                        self.assertEqual(len(t), 4)
                        self.assertTrue(all(isinstance(x, int) for x in t))
        for nom in noms:
            self.assertRegex(nom, sur)
        self.assertEqual(len(noms), len(set(noms)), "aucun nom de fichier en double")

    def test_fichiers_presents_et_tailles(self):
        carnet = self.carnet(self.reference)
        d = lire(os.path.join(carnet, "carnet.json"))["documents"][0]
        dossier = os.path.join(carnet, d["dossier"])
        annonces = []
        for page in d["pages"]:
            annonces += [page["leger"], page["net"]] + [p for n in page["niveaux"] for p in n["paquets"]]
        for a in annonces:
            self.assertEqual(os.path.getsize(os.path.join(dossier, a["f"])), a["o"], a["f"])
        self.assertEqual(sum(a["o"] for a in annonces), d["poids"])
        self.assertEqual(sorted(os.listdir(dossier)), sorted([a["f"] for a in annonces] + ["etat.json"]), "rien d'autre dans le dossier")
        self.assertEqual(sorted(os.listdir(carnet)), sorted([d["dossier"], "carnet.json"]), "pas de fichier temporaire oublié")
        etat = lire(os.path.join(dossier, "etat.json"))
        self.assertIs(etat["termine"], True)
        self.assertEqual(etat["source"], d["source"])

    def test_apercus(self):
        carnet = self.carnet(self.reference)
        d = lire(os.path.join(carnet, "carnet.json"))["documents"][0]
        for page in d["pages"]:
            for quoi, cote in (("leger", 800), ("net", 1600)):
                with Image.open(os.path.join(carnet, d["dossier"], page[quoi]["f"])) as image:
                    self.assertEqual(image.format, "WEBP")
                    self.assertLessEqual(max(image.size), cote + 1)
                    self.assertAlmostEqual(image.width / image.height, page["l"] / page["h"], delta=0.01)

    def test_tuiles_decoupees_et_recomposees(self):
        carnet = self.carnet(self.reference)
        d = lire(os.path.join(carnet, "carnet.json"))["documents"][0]
        niveaux = d["pages"][1]["niveaux"]
        precedent = None
        for niveau in niveaux:
            l, h, cols, ligs = niveau["l"], niveau["h"], niveau["cols"], niveau["ligs"]
            self.assertEqual((cols, ligs), (-(-l // 512), -(-h // 512)))
            if precedent:
                self.assertEqual((l, h), ((precedent[0] + 1) // 2, (precedent[1] + 1) // 2))
            precedent = (l, h)
            tailles = {}
            for paquet in niveau["paquets"]:
                with open(os.path.join(carnet, d["dossier"], paquet["f"]), "rb") as f:
                    octets = f.read()
                self.assertEqual(len(octets), paquet["o"])
                self.assertLessEqual(len(paquet["tuiles"]), 16, "un paquet = 4 x 4 tuiles au plus")
                fin = 0
                for c, li, debut, longueur in paquet["tuiles"]:
                    self.assertEqual(debut, fin, "les tuiles sont bout à bout")
                    fin = debut + longueur
                    with Image.open(io.BytesIO(octets[debut:debut + longueur])) as image:
                        self.assertEqual(image.format, "WEBP")
                        self.assertEqual(image.size, (min(512, l - c * 512), min(512, h - li * 512)), "tuile %d,%d du niveau %d" % (c, li, niveau["z"]))
                        self.assertNotIn((c, li), tailles)
                        tailles[(c, li)] = image.size
                self.assertEqual(fin, paquet["o"], "le paquet ne contient rien d'autre")
            self.assertEqual(len(tailles), cols * ligs, "toutes les tuiles du niveau")
            self.assertEqual(sum(tailles[(c, 0)][0] for c in range(cols)), l, "largeur recomposée")
            self.assertEqual(sum(tailles[(0, li)][1] for li in range(ligs)), h, "hauteur recomposée")
        self.assertLessEqual(max(niveaux[-1]["l"], niveaux[-1]["h"]), 1024, "le dernier niveau tient dans 2 x 2 tuiles")

    def test_verifier_bon(self):
        avant = contenu(self.reference)
        r = dc.verifier(self.reference, CHANTIER)
        self.assertEqual(r["problemes"], [])
        self.assertIs(r["bon"], True)
        self.assertEqual((r["documents"], r["retires"]), (1, 0))
        self.assertEqual(r["poids"], sum(t for n, t in avant.items() if t != "dossier" and n.startswith(os.path.join(CHANTIER, "CARNET"))))
        self.assertEqual(contenu(self.reference), avant, "--verifier n'écrit rien")


class Ajouts(Base):
    def test_second_indice_ajoute_a_la_fin(self):
        racine = nouvelle_racine(self.temp)
        self.deposer_petit(racine, indice="A")
        chemin = os.path.join(self.carnet(racine), "carnet.json")
        premier = lire(chemin)["documents"][0]
        apres_a = contenu(racine)
        self.deposer_petit(racine, indice="B", intitule="PETIT PLAN MODIFIE")
        self.deposer_petit(racine, code="106", indice="A", intitule="AUTRE")
        documents = lire(chemin)["documents"]
        self.assertEqual([d["id"] for d in documents], ["105-A", "105-B", "106-A"])
        self.assertEqual(documents[0], premier, "le premier indice est intact dans la liste")
        self.assertEqual(documents[0]["pages"][0]["dpi"], 200)
        apres = contenu(racine)
        for nom, taille in apres_a.items():
            if not nom.endswith("carnet.json"):
                self.assertEqual(apres.get(nom), taille, "intact : " + nom)
        self.assertTrue(dc.verifier(racine, CHANTIER)["bon"])

    def test_nom_du_dossier_du_carnet_lu_dans_dossiers_json(self):
        racine = nouvelle_racine(self.temp, carnet="PLANS DU CARNET")
        self.deposer_petit(racine, chantier="Chantier Essai Un")
        liste = lire(os.path.join(self.carnet(racine, "PLANS DU CARNET"), "carnet.json"))
        self.assertEqual(liste["chantier"], "Chantier Essai Un")
        self.assertFalse(os.path.exists(self.carnet(racine)))

    def test_intitule_nettoye(self):
        self.assertEqual(dc.nettoyer_intitule('  a/b\\c:d*e?f"g<h>i|j   k. '), "a b c d e f g h i j k")
        self.assertEqual(len(dc.nettoyer_intitule("x" * 200)), 80)
        self.assertEqual(dc.nettoyer_intitule("Réservations  béton"), "Réservations béton")

    def test_retirer(self):
        racine = nouvelle_racine(self.temp)
        self.deposer_petit(racine, indice="A")
        self.deposer_petit(racine, indice="B")
        avant = contenu(racine)
        self.refus(racine, "n'est pas dans le carnet", lambda: dc.retirer(racine, CHANTIER, "105-Z"))
        r = dc.retirer(racine, CHANTIER, "105-B")
        self.assertEqual(r["id"], "105-B")
        documents = lire(os.path.join(self.carnet(racine), "carnet.json"))["documents"]
        self.assertEqual([d.get("retire") for d in documents], [None, True])
        apres = contenu(racine)
        self.assertEqual(set(apres), set(avant), "aucun fichier supprimé ni ajouté")
        self.refus(racine, "déjà retiré", lambda: dc.retirer(racine, CHANTIER, "105-B"))
        v = dc.verifier(racine, CHANTIER)
        self.assertTrue(v["bon"], v["problemes"])
        self.assertEqual((v["documents"], v["retires"]), (1, 1))
        # Un document retiré peut être déposé de nouveau (même PDF) : il revient à la fin de la liste
        self.deposer_petit(racine, indice="B")
        documents = lire(os.path.join(self.carnet(racine), "carnet.json"))["documents"]
        self.assertEqual([(d["id"], d.get("retire")) for d in documents], [("105-A", None), ("105-B", True), ("105-B", None)])


class LesRefus(Base):
    def test_racine_sans_dossiers_json(self):
        racine = tempfile.mkdtemp(dir=self.temp)
        os.mkdir(os.path.join(racine, CHANTIER))
        self.refus(racine, "dossiers.json", lambda: self.deposer_petit(racine))
        self.refus(racine, "dossiers.json", lambda: dc.verifier(racine, CHANTIER))

    def test_dossier_du_chantier_absent(self):
        racine = nouvelle_racine(self.temp)
        self.refus(racine, "ne crée jamais", lambda: dc.deposer(racine, "CHANTIER INCONNU", None, self.petit, "105", "A", "X"))
        self.assertFalse(os.path.exists(os.path.join(racine, "CHANTIER INCONNU")))
        self.refus(racine, "simple nom", lambda: dc.deposer(racine, "..", None, self.petit, "105", "A", "X"))

    def test_pdf_absent_ou_illisible(self):
        racine = nouvelle_racine(self.temp)
        self.refus(racine, "introuvable", lambda: self.deposer_petit(racine, pdf=os.path.join(self.temp, "absent.pdf")))
        faux = os.path.join(self.temp, "faux.pdf")
        with open(faux, "w", encoding="utf-8") as f:
            f.write("ceci n'est pas un PDF")
        self.refus(racine, "illisible", lambda: self.deposer_petit(racine, pdf=faux))
        self.assertFalse(os.path.exists(self.carnet(racine)), "pas même le dossier du carnet")

    def test_code_indice_intitule(self):
        racine = nouvelle_racine(self.temp)
        for code in ("110", "5", "", "1050"):
            self.refus(racine, "n'est pas un document du carnet", lambda: self.deposer_petit(racine, code=code))
        for indice in ("", "ABCD", "A-1", "é"):
            self.refus(racine, "indice", lambda: self.deposer_petit(racine, indice=indice))
        self.refus(racine, "intitulé", lambda: self.deposer_petit(racine, intitule=' /?* '))
        self.assertEqual(sorted(dc.DPI_PAR_CODE), ["001", "002", "103", "104", "105", "106", "107", "108", "109", "151", "152", "205", "206"])
        self.assertEqual({c: d for c, d in dc.DPI_PAR_CODE.items() if d != 200}, {"001": 150, "002": 150})

    def test_document_deja_present(self):
        racine = self.copie()
        self.refus(racine, "déjà au carnet", lambda: dc.deposer(racine, CHANTIER, None, self.pdf, "001", "A", "PLAN D'ESSAI"))
        self.refus(racine, "déjà au carnet", lambda: self.deposer_petit(racine, code="001", indice="A", intitule="AUTRE NOM"))

    def test_carnet_json_illisible(self):
        racine = self.copie()
        chemin = os.path.join(self.carnet(racine), "carnet.json")
        with open(chemin, "r+", encoding="utf-8") as f:
            f.truncate(200)
        self.refus(racine, "illisible", lambda: self.deposer_petit(racine))
        self.refus(racine, "illisible", lambda: dc.retirer(racine, CHANTIER, "001-A"))
        with open(chemin, "w", encoding="utf-8") as f:
            f.write('{"version":1}')
        self.refus(racine, "forme attendue", lambda: self.deposer_petit(racine))

    def test_carnet_d_un_autre_chantier(self):
        racine = self.copie()
        self.refus(racine, "celui du chantier", lambda: self.deposer_petit(racine, chantier="AUTRE CHANTIER"))

    def test_doublon_de_liste(self):
        racine = self.copie()
        carnet = self.carnet(racine)
        shutil.copy(os.path.join(carnet, "carnet.json"), os.path.join(carnet, "carnet (1).json"))
        self.refus(racine, r"doublon", lambda: self.deposer_petit(racine))
        self.refus(racine, r"carnet \(1\)\.json", lambda: dc.retirer(racine, CHANTIER, "001-A"))

    def test_dossier_deja_pris_par_un_autre_pdf(self):
        racine = nouvelle_racine(self.temp)
        self.deposer_petit(racine)
        dc.retirer(racine, CHANTIER, "105-A")
        self.refus(racine, "autre PDF", lambda: self.deposer_petit(racine, pdf=self.pdf))
        inconnu = os.path.join(self.carnet(racine), "106 A REPERAGE")
        os.mkdir(inconnu)
        with open(os.path.join(inconnu, "note.txt"), "w") as f:
            f.write("x")
        self.refus(racine, "existe déjà", lambda: self.deposer_petit(racine, code="106", intitule="REPERAGE"))


class Reprise(Base):
    def horloge(self, instants):
        """Une fausse horloge : rend les instants donnés l'un après l'autre, puis toujours le dernier."""
        reste = list(instants)
        return lambda: reste.pop(0) if len(reste) > 1 else reste[0]

    def test_arret_a_la_limite_puis_reprise(self):
        racine = nouvelle_racine(self.temp)
        carnet = self.carnet(racine)
        dossier = os.path.join(carnet, "001 A PLAN D'ESSAI")
        arguments = (racine, CHANTIER, None, self.pdf, "001", "A", "PLAN D'ESSAI")
        # Départ à 0 ; page 1 commencée à 0 ; avant la page 2, il est 1 000 s : arrêt
        r = dc.deposer(*arguments, limite=150, horloge=self.horloge([0, 0, 1000]), dire=lambda ligne: None)
        self.assertEqual((r["termine"], r["faites"], r["restent"], r["pages"]), (False, 1, 2, 3))
        self.assertFalse(os.path.exists(os.path.join(carnet, "carnet.json")), "la liste n'est écrite qu'à la fin")
        etat = lire(os.path.join(dossier, "etat.json"))
        self.assertIs(etat["termine"], False)
        self.assertEqual(sorted(etat["pages"]), ["1"])
        self.assertEqual(sorted(os.listdir(dossier)), ["etat.json", "p1-leger.webp", "p1-net.webp"])
        v = dc.verifier(racine, CHANTIER)
        self.assertFalse(v["bon"])
        self.assertTrue(any("pas fini" in p for p in v["problemes"]), v["problemes"])
        # Un autre PDF sous le même indice : la reprise est refusée
        self.refus(racine, "autre PDF", lambda: self.deposer_petit(racine, code="001", indice="A", intitule="PLAN D'ESSAI"))
        # La page 1 est abîmée entre-temps : elle sera refaite
        with open(os.path.join(dossier, "p1-net.webp"), "r+b") as f:
            f.truncate(10)
        avant = contenu(racine)
        lignes = []
        r = dc.deposer(*arguments, limite=150, horloge=self.horloge([0, 0, 0, 1000]), dire=lignes.append)
        self.assertEqual((r["termine"], r["faites"], r["restent"]), (False, 2, 1))
        self.assertFalse(any("déjà faite" in ligne for ligne in lignes), "la page abîmée est refaite")
        lignes = []
        r = dc.deposer(*arguments, dire=lignes.append)
        self.assertEqual((r["termine"], r["faites"], r["restent"]), (True, 3, 0))
        self.assertEqual(len([ligne for ligne in lignes if "déjà faite" in ligne]), 2)
        self.assertTrue(set(avant) <= set(contenu(racine)), "rien n'est supprimé")
        # Même résultat qu'un dépôt d'une traite
        obtenu = lire(os.path.join(carnet, "carnet.json"))
        attendu = lire(os.path.join(self.carnet(self.reference), "carnet.json"))
        self.assertEqual(sans_date(obtenu["documents"]), sans_date(attendu["documents"]))
        self.assertEqual(contenu(os.path.join(racine, CHANTIER)), contenu(os.path.join(self.reference, CHANTIER)))
        self.assertIs(lire(os.path.join(dossier, "etat.json"))["termine"], True)
        self.assertTrue(dc.verifier(racine, CHANTIER)["bon"])

    def test_limite_depassee_d_emblee_une_page_quand_meme(self):
        racine = nouvelle_racine(self.temp)
        r = self.deposer_petit(racine, limite=0, horloge=self.horloge([0, 0, 5]))
        self.assertEqual((r["termine"], r["faites"], r["restent"]), (False, 1, 1))
        r = self.deposer_petit(racine, limite=0, horloge=self.horloge([0, 0, 5]))
        self.assertTrue(r["termine"], "chaque lancement avance d'au moins une page")


class Verification(Base):
    def test_fichier_tronque_absent_tuile_hors_paquet(self):
        racine = self.copie()
        carnet = self.carnet(racine)
        dossier = os.path.join(carnet, "001 A PLAN D'ESSAI")
        with open(os.path.join(dossier, "p2-z0-0.pak"), "r+b") as f:
            f.truncate(1000)
        avant = contenu(racine)
        v = dc.verifier(racine, CHANTIER)
        self.assertFalse(v["bon"])
        self.assertEqual(len(v["problemes"]), 1, v["problemes"])
        self.assertRegex(v["problemes"][0], r"p2-z0-0\.pak.*1000 octets")
        self.assertEqual(contenu(racine), avant, "--verifier n'écrit rien")
        # Une tuile annoncée au-delà de son paquet
        racine = self.copie()
        chemin = os.path.join(self.carnet(racine), "carnet.json")
        liste = lire(chemin)
        liste["documents"][0]["pages"][1]["niveaux"][1]["paquets"][0]["tuiles"][-1][3] += 1
        with open(chemin, "w", encoding="utf-8") as f:
            json.dump(liste, f)
        v = dc.verifier(racine, CHANTIER)
        self.assertEqual(len(v["problemes"]), 1, v["problemes"])
        self.assertIn("dépasse du paquet", v["problemes"][0])

    def test_doublons_et_dossier_inconnu(self):
        racine = self.copie()
        carnet = self.carnet(racine)
        shutil.copy(os.path.join(carnet, "carnet.json"), os.path.join(carnet, "carnet (1).json"))
        dossier = os.path.join(carnet, "001 A PLAN D'ESSAI")
        shutil.copy(os.path.join(dossier, "p1-net.webp"), os.path.join(dossier, "p1-net (1).webp"))
        os.mkdir(os.path.join(carnet, "105 Z INCONNU"))
        avant = contenu(racine)
        v = dc.verifier(racine, CHANTIER)
        self.assertFalse(v["bon"])
        texte = "\n".join(v["problemes"])
        self.assertIn("carnet (1).json", texte)
        self.assertIn("p1-net (1).webp", texte)
        self.assertIn("Plusieurs listes", texte)
        self.assertIn("« 105 Z INCONNU » n'est dans aucun document", texte)
        self.assertEqual(contenu(racine), avant)

    def test_chantier_sans_carnet(self):
        racine = nouvelle_racine(self.temp)
        v = dc.verifier(racine, CHANTIER)
        self.assertFalse(v["bon"])
        self.assertEqual(contenu(racine), {"dossiers.json": os.path.getsize(os.path.join(racine, "dossiers.json")), CHANTIER: "dossier"})


class LigneDeCommande(Base):
    def lancer(self, *arguments):
        sortie, erreur = io.StringIO(), io.StringIO()
        with contextlib.redirect_stdout(sortie), contextlib.redirect_stderr(erreur):
            code = dc.main(list(arguments))
        return code, sortie.getvalue(), erreur.getvalue()

    def test_codes_de_sortie(self):
        racine = nouvelle_racine(self.temp)
        base = ("--racine", racine, "--dossier", CHANTIER)
        depot = base + ("--pdf", self.petit, "--code", "105", "--indice", "A", "--intitule", "PETIT PLAN")
        code, sortie, _ = self.lancer(*depot, "--limite", "-1")
        self.assertEqual(code, 3)
        self.assertIn("RELANCEZ LA MÊME COMMANDE", sortie)
        self.assertIn("il en reste 2", sortie)
        code, sortie, _ = self.lancer(*depot)
        self.assertEqual(code, 0)
        self.assertIn("Déposé : 105-A, 2 page(s)", sortie)
        self.assertEqual(len(re.findall(r"(?m)^  page \d/2 : \d+ x \d+ points", sortie)), 2)
        code, _, erreur = self.lancer(*depot)
        self.assertEqual(code, 2)
        self.assertIn("REFUS", erreur)
        self.assertEqual(self.lancer(*base, "--verifier")[0], 0)
        self.assertEqual(self.lancer(*base, "--pdf", self.petit)[0], 2, "arguments manquants")
        self.assertEqual(self.lancer(*base, "--retirer", "105-A")[0], 0)
        self.assertEqual(self.lancer(*base, "--retirer", "105-A")[0], 2)
        os.mkdir(os.path.join(self.carnet(racine), "RESTE (1)"))
        code, sortie, _ = self.lancer(*base, "--verifier")
        self.assertEqual(code, 1)
        self.assertIn("défaut(s)", sortie)


if __name__ == "__main__":
    unittest.main()
