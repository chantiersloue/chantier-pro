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
