# Décisions prises pendant la construction

> Les décisions courantes que j'ai tranchées seul (méthode `boucle-controle`), avec les options écartées.
> Les choix structurants validés par Franck sont dans `PLAN.md` §1 et §3.

## Lot 0

| # | Décision | Options écartées | Pourquoi |
|---|---|---|---|
| D0-1 | Les adresses des contacts restent renvoyées par `getContacts` jusqu'au lot 2 | Les retirer dès le lot 0 | Les pages actuelles envoient les adresses elles-mêmes : les retirer casserait 6 fiches (critique du plan, B1). Le relais de mails est fermé côté serveur, ce qui est l'essentiel. |
| D0-2 | Les destinataires « du Sheet » gardent **exactement** le mail actuel (un mail par destinataire, même texte) | Passer tout de suite à un mail unique en copie cachée | Commande de Franck : rien ne doit changer pour ses destinataires. Le mail unique viendra au lot 1. |
| D0-3 | Copie cachée des adresses libres : conducteur du chantier (onglet *Chantiers*, colonne D), sinon Franck | Toujours Franck | Choix de Franck (« moi ou le conducteur du chantier »). |
| D0-4 | Sujet des adresses libres : le nom du chantier n'y figure **que s'il existe dans l'onglet *Chantiers*** ; nom de la pièce jointe imposé | Reprendre le chantier tel que saisi | Sinon un pirate pourrait écrire son propre texte dans le sujet ou le nom du fichier. |
| D0-5 | Plafond quotidien des adresses libres compté par jour calendaire (heure de Paris) dans les Propriétés du script, sous verrou | Compter dans l'onglet *Journal* | Plus rapide et sans risque de double comptage entre deux envois simultanés. |
| D0-6 | Une seule alerte mail par jour à Franck ; le détail est dans *Journal* | Une alerte par refus | Un attaquant ne doit pas pouvoir vider le quota par les alertes (critique I1). |
| D0-7 | Mail en échec ou quota bas : mail **reporté** (onglet *Mails en attente*, PDF gardé dans Drive), renvoi toutes les 2 h, abandon après 12 essais avec alerte | Abandon immédiat | Zéro mail perdu. ≈ 1 min par jour de déclencheur sur les 90 autorisées. |
| D0-8 | Absence (pas de dossier Drive) : en cas de report, le PDF est gardé dans `_MAILS EN ATTENTE` puis mis à la corbeille une fois envoyé | Ranger les absences dans Drive dès le lot 0 | Pas de changement de rangement avant le lot 1.5. |
| D0-9 | Fiche de fabrication : les commentaires mis en forme passent par une **liste blanche** (gras, italique, souligné, retours à la ligne, couleur, taille) | Tout échapper (la mise en forme aurait disparu) ; tout accepter | Garder la fonction existante (mise en forme) sans laisser passer de balise dangereuse. |
| D0-10 | Texte commençant par `-` suivi d'un chiffre (cote négative) laissé tel quel dans le Sheet ; `=`, `+`, `@` et `-lettre` préfixés d'une apostrophe | Préfixer tous les `-` | Les cotes négatives sont lues par le skill métré de plinthes (critique, point mineur). |
| D0-11 | Le recensement des partages ne regarde que les fichiers **sous** le dossier racine ou le Planning ; les fichiers personnels du compte ne sont jamais touchés | Tout le Drive | Ne pas toucher ce qui ne concerne pas l'appli. |
| D0-12 | Un type de fiche inconnu renvoie une erreur | Le traiter comme une prise de cotes (ancien comportement) | L'ancien comportement permettait d'envoyer des mails « cotes » avec n'importe quel contenu. |
| D0-13 | Mode test sans URL réglée : adresse volontairement invalide (`.invalid`) → l'envoi échoue avec « Erreur réseau » | Adresse vide | Avec une adresse vide, l'envoi partait vers GitHub Pages et l'appli affichait « Envoyé ». |
| D0-14 | Anonymisation de la copie TEST : fonction `anonymiserCopieTest` lancée par Franck, protégée (nom du Sheet « TEST » **et** propriété `ENVIRONNEMENT = TEST`) | La faire moi-même avec le connecteur Sheets | Le connecteur n'a pas accès au Sheet TEST (refusé). |
| D0-15 | Mise en production du front du lot 0 (étape A) **avant** le test du serveur | Attendre | Le front du lot 0 ne change rien en production (même adresse, vérifié sur les 10 pages), et il est indispensable pour tester avec `?env=test`. Exception assumée à la règle « tester avant la production ». |
| D0-16 | Revue indépendante (point bloquant) : une 3ᵉ adresse tapée à la main est refusée **dans la page**, avec un message, avant l'envoi (note, quitus, bordereaux). Le plafond de 10 par jour reste vérifié par le serveur seul (*Journal* + alerte à Franck). | Laisser le serveur seul refuser, sans prévenir | La page ne peut pas lire la réponse du serveur avant le lot 1. Elle connaît la liste des contacts, mais pas le compteur du jour. |
| D0-17 | Une cellule *Contacts* qui contient plusieurs adresses (« a@…, b@… ») est découpée : chaque adresse reçoit son propre mail | Garder une adresse par cellule | Ces cellules marchaient avant le lot 0 : on ne casse rien. |
| D0-18 | Les identifiants Drive restent visibles dans l'historique GitHub (commits 51bc3bc et 8601235) | Réécrire l'historique | La vraie protection est le retrait des partages, racine comprise. Un identifiant seul ne donne aucun accès. |
| D0-19 | L'« email perso » de l'absence est une adresse libre (texte imposé, compte dans les 10 par jour, Franck en copie) | L'accepter sans contrôle | Sinon, ce champ restait un relais ouvert. |
| D0-20 | Retrait des partages : dossiers d'abord, puis fichiers ; un fichier déjà privé parce que son dossier ne l'est plus est noté « déjà privé (dossier parent) » | Ordre quelconque | Un partage hérité du dossier parent ne peut pas être retiré sur le fichier lui-même. |
| D0-21 | `listerPartages` refuse de vider l'onglet si des partages ont déjà été retirés | Le vider à chaque fois | L'onglet est la base du retour arrière (revue indépendante). |
| D0-22 | Une place du plafond « 10 adresses libres par jour » est consommée même si le mail est reporté pour quota | Rendre la place au report | Cas rare (quota presque épuisé ET adresse libre) ; le mail part quand même plus tard. Simplicité. |
| D0-23 | Chemins de l'onglet *Partages* séparés par « › » et non « / » | « / » | Certains noms de chantiers contiennent « / » (100-PARTICULIERS/DIVERS) : leurs *Plans* auraient été retirés par erreur (revue, tour 2). |
| D0-24 | Fonction de secours `remettreDepuisSauvegarde` pour le cas où l'onglet *Partages* est perdu | Retélécharger le CSV après le retrait | La sauvegarde est prise avant le retrait (colonne État vide) : `remettrePartages` n'y trouverait rien. |

## Essai S1 et carnet (validé par Franck le 29/10/2026)

| # | Décision | Options écartées | Pourquoi |
|---|---|---|---|
| S1-1 | Plans du carnet en tuiles **WebP qualité 0,7 à 200 dpi** (pyramide de 3 ou 4 niveaux) ; documents texte à 150 dpi | JPEG ; 100 ou 150 dpi pour les plans | Lisibilité vérifiée par Franck sur son téléphone ; WebP 36 % plus léger que JPEG à qualité égale |
| S1-2 | **Pas de PDF dans Drive**, sauf case « garder le PDF » cochée pour un document | PDF toujours gardé | Stockage ; validé par Franck |
| S1-3 | Au lot 4, Franck connecte dans l'appli Claude le dossier Drive du carnet (comme son dossier MEGA) ; je lui indique alors le chemin exact, et un essai est fait avec un vrai skill | Dépôt par le connecteur Google Drive de Claude | Accord de Franck ; même mécanisme que pour MEGA |
| L-1 | Livraison par branche `livraison/lot-N` (partant de `main`, seulement le lot) poussée sur GitHub ; Franck crée et fusionne la demande de fusion | Upload manuel | Accord de Franck ; l'outil `gh` n'est pas installé sur le PC, donc Franck ouvre la demande de fusion depuis un lien préparé |

## Lot 1

| # | Décision | Options écartées | Pourquoi |
|---|---|---|---|
| D1-1 | Code serveur découpé en 5 fichiers par thème (`Config`, `Api`, `Documents`, `Securite`, `Admin`) + `Modeles.gs` généré | Un seul `Code.gs` | Lisibilité ; chaque fichier se colle en entier. |
| D1-2 | API v5 : la page envoie `{action:'fiche', id, donnees}` ; l'ancien format reste accepté pendant la migration des pages | Tout basculer d'un coup | Les pages non encore refondues continuent de marcher. |
| D1-3 | Photos envoyées une par une avant la fiche, rangées dans `_PHOTOS EN COURS/<n° de fiche>`, intégrées au PDF puis mises à la corbeille | Garder les photos dans Drive | Comme avant : les photos des fiches ne vivent que dans le PDF (stockage). Les notes et signalements (lots 3 et 7) les garderont. |
| D1-4 | Le brouillon est effacé dès que la fiche est rangée dans la file d'envoi du téléphone (et non après la réponse du serveur) | Attendre la réponse du serveur | La file la protège déjà ; attendre laisserait un brouillon et une fiche en double. |
| D1-5 | Après envoi, la page reste ouverte et se vide (au lieu de revenir à l'accueil) | Retour à l'accueil | Quitter la page couperait l'envoi en cours ; il reprendrait plus tard, mais le poseur croirait que c'est parti. |
| D1-6 | Champ « Chantier » : liste à choix + saisie libre (au lieu d'une liste fermée) | Liste fermée | Sans réseau et sans liste gardée, le poseur peut quand même remplir et envoyer. |
| D1-7 | Champ « Client » du quitus : plus de suggestions | Proposer les contacts | Les suggestions étaient… les salariés de Loué (audit). |
| D1-8 | Polices système à la place de Google Fonts | Garder Google Fonts | Écran blanc en 3G ; une dépendance en moins. |
| D1-9 | Le service worker n'a pas pu être essayé dans le navigateur de test (il refuse les service workers) ; il sera vérifié sur les téléphones pendant le test du lot 1 | — | Limite de l'outil de test, pas du code ; `outils/sw-secours.js` est prêt en cas de souci. |
| D1-10 | Une base de stockage par mode (`loue` en production, `loue_test`, `loue_local`) : une fiche ou un brouillon d'essai ne part jamais en production, et l'inverse | Noter le mode dans chaque fiche | Plus simple et sans risque d'oubli (revue, B1). |
| D1-11 | Si le téléphone refuse de garder la fiche (navigation privée, mémoire pleine) : envoi direct, page ouverte, 3 essais | Bloquer l'envoi | L'ancienne page envoyait toujours : pas de régression (revue, B2). |
| D1-12 | Brouillon en double : tout sauf les photos dans localStorage, tout dans IndexedDB ; avertissement si rien ne peut être gardé | IndexedDB seul | Le texte est gardé même quand les photos ne peuvent pas l'être (revue, B2). |
| D1-13 | Copie au conducteur du chantier ajoutée par le serveur (sinon Franck), et plus par la page | Calcul dans la page | Toujours au moins un destinataire, même chantier tapé à la main ou listes absentes (revue, B3). |
| D1-14 | Bannière de brouillon sans réponse : l'ancien brouillon est mis de côté (« _precedent ») et reproposé à l'ouverture suivante ; « Repartir à zéro » demande confirmation | Écraser | Photos et signatures ne se refont pas (revue, I1). |
| D1-15 | Erreur du serveur = passagère : nouvel essai après 1, 5, 15, 60 min, « à vérifier » après 12 essais ; alerte à Franck à chaque erreur serveur (une par jour) | Refus définitif immédiat ; essai chaque minute | Les erreurs Drive / conversion sont souvent passagères ; économie de batterie et de forfait (revue, I3). |
| D1-16 | Chantier : obligatoirement dans la liste quand elle est chargée ; saisie libre seulement sans liste | Toujours libre | Une faute de frappe créait un nouveau dossier Drive (revue, I4). |
| D1-17 | Signatures du quitus **facultatives**, comme avant la refonte | Obligatoires | Commande : rien ne change pour les fiches (revue, I5). |
| D1-18 | Photos : 15 par fiche, 400 par jour pour toute l'appli ; photos de fiches jamais terminées mises à la corbeille après 7 jours | Sans limite | Protège les 15 Go contre un abus ou un bug (revue, I6). |
| D1-19 | Le PDF n'est fabriqué qu'une fois par fiche, puis copié pour chaque destinataire | Une conversion par destinataire | Lenteur, risque de dépasser 6 min (revue). |
| D1-20 | Service worker « réseau d'abord » (3 s) pour **tous** les fichiers, le cache seulement sans réseau | Cache d'abord pour les scripts | Avec du réseau, page et scripts sont toujours de la même version : impossible de mélanger deux versions après une livraison, même si `VERSION` n'est pas changée (revue, tour 2, B1). |
| D1-21 | Les coupures de réseau ne font jamais passer une fiche « à vérifier » (essais au plus toutes les 5 min, sans fin) ; seuls 12 refus du **serveur** le font | Compter toutes les erreurs | Un réseau qui coupe et revient sans cesse bloquait la fiche (revue, tour 2, I1). |
| D1-22 | Brouillons proposés et laissés sans réponse : une liste « mis de côté » (5 au plus, 30 jours), reproposés un par un ; la copie la plus récente (localStorage ou IndexedDB) est restaurée | Une seule place « _precedent » | Plus aucune façon de perdre un brouillon en ignorant la bannière (revue, tour 2, I2). |
| D1-23 | La page ne se recharge après une mise à jour de l'appli que si la personne a touché « Mettre à jour » | Rechargement automatique | La première installation rechargeait la page en pleine saisie (revue, tour 2, I3). |
| D1-24 | Liste de chantiers gardée dans le téléphone (pas de réseau) : un nom hors liste est accepté après confirmation | Toujours refusé | Un chantier récent manquerait dans une liste ancienne (revue, tour 2, I4). |
| D1-25 | Chaque fichier commun est appelé avec un numéro de version (`commun/api.js?v=…`) écrit automatiquement par `node outils/construire.js` ; le service worker sert la copie **exacte** de cette version si le téléphone l'a, sinon attend le réseau (au lieu d'échouer au bout de 3 s) | Délai fichier par fichier | Sur réseau faible, une page reçoit toujours les scripts de SA version (revue, tour 3). **À chaque livraison : lancer `node outils/construire.js`** (je le fais ; `--verifier` le contrôle). |
| D1-26 | Fin des 3 tours de relecture du pilote : aucun point bloquant ni important restant ; restent à vérifier sur un vrai téléphone le service worker et l'impression sur iPhone (D1-9) | — | Limite de l'outil de test. |
| D1-27 | Les deux bordereaux deviennent une seule page `bordereau.html?type=orga|materiaux` ; les anciennes adresses redirigent (favoris des gars) ; chaque type garde son propre brouillon et reprend son ancien brouillon | Garder deux pages | Elles étaient identiques à 98 % (audit). |
| D1-28 | Bordereau matériaux : la liste « Type » vient enfin de l'onglet *Materiaux* (elle proposait les cylindres) ; le nombre y reste obligatoire (l'étoile l'indiquait déjà) | — | Bug de l'audit. |
| D1-29 | Mention de l'organigramme : orthographe corrigée (« passe général », « Les frais sont supportés… ») | Texte d'origine | CLAUDE.md : corriger l'orthographe des textes affichés. |
| D1-30 | CSS commun des fiches dans `commun/fiche.css` | Recopier dans chaque page | Une seule mise en page à maintenir. |
| D1-31 | Les anciens brouillons (d'avant la refonte) ne sont repris qu'en mode normal, jamais en mode test ou local | Partout | Un essai ne doit jamais consommer un vrai brouillon. |
| D1-32 | Prise de cotes : page **rénovée** plutôt que réécrite (ses règles de plinthe, socle, sol et son tableau sont gardés) ; seuls l'envoi, le brouillon, l'aperçu (modèle unique) et les bugs changent | Réécriture complète | Moins de risque de régression sur des cotes. |
| D1-33 | Cotes : logement jusqu'à 12 caractères et pièce jusqu'à 30 (au lieu de 4 et 5) ; colonne « Socle » ajoutée à l'en-tête ; changer le type de sol met à jour les lignes qui suivaient l'ancien ; valeur « Fini » unifiée ; bâtiment, plinthe générale et type de sol affichés dans le PDF | — | Bugs de l'audit. |
| D1-34 | Brouillon : une page peut fournir la conversion de son ancien format (`convertirAncien`) ; utilisé par les cotes (lignes et modes) | — | L'ancien brouillon des cotes avait un format à lui. |
