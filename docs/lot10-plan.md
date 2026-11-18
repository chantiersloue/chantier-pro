# Lot 10 — « À commander » et le mail du vendredi — PLAN

> Plan du 17/11/2026, **version 3, validée par Franck le 17/11/2026.**
> D'après ta commande du 17/11 au soir. Tes choix du lot 10 : idées 4 (point de santé) et 7 (points ouverts des notes de réunion, après le lot 8) retenues ; idées 1, 2, 3, 5, 6 et 8 refusées.

## 0. Tes réponses du 17/11/2026 et où en est le lot

**Tes réponses aux 9 questions du chapitre 11**

| N° | Question | Ta réponse |
|---|---|---|
| 1 | Heure limite 15 h 45 | **oui** |
| 2 | « Mes demandes » : le poseur ne voit que les siennes | **oui** |
| 3 | Le mail du vendredi part toujours, même vide | **oui** |
| 4 | Mail du vendredi vers 14 h | **oui** |
| 5 | Idée 7 (points ouverts des notes de réunion) | **ni l'un ni l'autre pour l'instant** : le lot 10c est abandonné pour le moment |
| 6 | Lot 10b-2 (les téléphones disent ce qu'ils gardent en attente) | **oui, mais plus tard** : pas maintenant |
| 7 | Rappel des signalements « Bloquant » restés « À traiter » | **oui** |
| 8 | « Outil en panne » : autre chose que « Précision (facultatif) » ? | **non**, rien de plus ; écrire « Précision (facultative) » (18/11) |
| 9 | Ordre de mise en production | **lot 8, puis 10a-1 et 10a-2, puis 10b, puis le mail unique** |

**Ce qui est construit**

| Lot | Construit le | Versions | Branche | Contenu |
|---|---|---|---|---|
| **10a-1** | 17/11/2026 | serveur **v11.2**, appli **10.3** | `lot-10a1` (partie de `lot-8`) | la page, la tuile, l'onglet *Demandes*, le mail de 15 h 45, « Mes demandes », « ✓ Commandé » |
| **10a-2** | 18/11/2026 | serveur **v11.3**, appli **10.4** | `lot-10a2` (partie de `lot-10a1`) | les gros boutons des articles habituels (avec la dernière quantité), les propositions pendant la frappe, l'onglet *Articles* |

Testé contre le faux serveur (un faux Google qui tourne sur mon ordinateur) et dans un vrai Chrome. **Rien n'a tourné chez Google, aucun mail n'est parti.**
Procédure : `docs/lot10-procedure.md` (une partie par lot). Choix faits seul : `DECISIONS.md`, lignes D10-1 et suivantes (10a-2 : D10-27 et suivantes).

**Pas construit** : 10b (mail du vendredi), 10b-2 (plus tard), 10c (abandonné pour le moment).

**Le lot 10a-2 en clair** (chapitres 3.4 et 4)
- **Les gros boutons** : sous « À commander / Outil en panne », les **5 articles que ce compte demande le plus**, deux par ligne, avec la dernière quantité demandée écrite dessous. Un toucher remplit « Quoi ? » **et** la quantité (qu'on peut changer) ; il reste « Demander ». Rien tant qu'il n'a rien demandé. Ils ne sont pas comptés à part : ils sont **recomptés à chaque affichage** à partir de « Mes demandes » (90 jours, gardées dans le téléphone) et des demandes encore en attente d'envoi. Téléphone changé ou appli réinstallée : ils reviennent tout seuls à la connexion.
- **Les propositions pendant la frappe** : dès 2 lettres, **3 gros boutons au plus sous le champ** (48 px au moins) : ses demandes passées d'abord, puis ta liste du Sheet. Sans majuscules ni accents, au début de chaque mot, « x » comme « × ». Aucune liste à dérouler ; le texte libre reste toujours possible.
- **L'onglet *Articles*** : créé vide par l'installation, une colonne, un article par ligne. Le serveur le donne avec « Mes demandes », donc aux comptes connectés seulement ; le téléphone le garde pour le hors réseau. 500 articles et 80 caractères au plus, doublons retirés. Vide, absent, très long ou illisible : tout marche.
- **Clavier ouvert** : quand il reste peu de hauteur à l'écran, la barre du haut ne reste plus collée : le champ, ses 3 propositions, puis « Quantité » et « Demander » tiennent dans 280 px. **C'est mesuré dans Chrome avec un écran réduit, pas avec un vrai clavier** : c'est ton essai, avec des gants.
- Seulement pour « À commander » : « Outil en panne » n'a ni boutons ni propositions (D10-30).

**Trois écarts avec le texte ci-dessous, pour la sécurité des données** (détail dans `DECISIONS.md`) :
1. **Titres de l'onglet *Demandes* changés** (chapitre 5) : le plan disait « les demandes sont quand même notées ». Au vu du code, les noter dans un onglet dont les colonnes ont bougé, c'est risquer de les écrire au mauvais endroit et d'envoyer un mail faux. J'ai fait comme pour les notes de chantier : **rien n'est lu ni écrit, les demandes attendent dans les téléphones** (« ⏳ en attente d'envoi ») **et repartent dès que les titres sont remis** (après 12 essais refusés, le téléphone affiche « à vérifier » : le poseur touche « Réessayer ») ; tu reçois le mail d'alerte (un par jour au plus). Rien n'est perdu.
2. **Le premier passage du réveil arrive après 17 h 30** (panne chez Google, réveils retirés) : le mail ne part plus ce jour-là, même s'il n'y a eu aucun essai avant ; les demandes partent en tête du récapitulatif suivant (« Demandes non envoyées hier »). Même règle que pour un mail en échec : après 17 h 30, il est trop tard pour commander.
3. **Après 17 h 30 sans passage du jour**, le téléphone n'annonce plus « aujourd'hui » : il nomme le jour suivant (c'est ce qui va se passer).

## 1. Ce que tu as demandé

**A. Une tuile « À commander » sur l'accueil**, rattachée à aucun chantier, pour le petit matériel des poseurs (quincaillerie, visserie, consommables, outillage).
- Deux choix : **« À commander »** ou **« Outil en panne »**. « Signaler » ne change pas et reste pour les problèmes sur nos produits.
- Saisie : **quoi** et **quantité** ; le nom du poseur est rempli tout seul. **Aucune liste à dérouler.**
- En haut, 4 ou 5 gros boutons avec **ses** articles les plus demandés (appris dans le téléphone, hors réseau aussi). Pendant la frappe, des propositions dès 2 lettres, tirées de ses demandes passées et d'une liste **facultative** que tu tiens dans un onglet du Sheet. Texte libre toujours possible.
- **Un seul mail, à toi, du lundi au vendredi vers 16 h** : les demandes depuis le récapitulatif précédent (poseur, quoi, quantité). Pas de chantier, pas de signalements. Aucun mail s'il n'y a rien. Une demande faite après le récapitulatif passe au suivant, et le téléphone le dit.
- Suivi : une case **« Commandé »** que tu coches dans le Sheet ; le poseur voit « ✓ Commandé ». Rien d'autre.
- Une phrase sur chaque formulaire qui renvoie vers l'autre.

**B. Un mail du vendredi après-midi** : les signalements de la semaine et leur état, regroupés avec le point de santé (idée 4). Aucun récapitulatif quotidien des signalements.

## 2. Ce que j'ai vérifié chez Google (pages officielles, lues le 17/11/2026)

| Question | Réponse | Source |
|---|---|---|
| Précision de l'heure d'un déclencheur (le « réveil » qui lance une fonction tout seul) | réglage « vers telle minute » (`nearMinute`) : **à 15 minutes près**, en plus ou en moins. Réglage « à 15 h » seul : « entre 15 h et 16 h ». Un mail « à 16 h pile » est donc impossible avec un réveil à heure fixe | developers.google.com/apps-script/reference/script/clock-trigger-builder |
| Réveils répétés | toutes les 1, 5, 10, 15 ou 30 minutes | même page |
| Nombre de réveils | 20 par compte et par projet ; le serveur en a 6 | developers.google.com/apps-script/guides/services/quotas |
| Temps total des réveils | 90 minutes par jour (compte gratuit) | même page |
| Mails | 100 destinataires par jour ; ce lot en ajoute **1 par jour ouvré et 1 par semaine**, tous à toi, pris sur les 20 réservés au bureau | même page |
| Mémoire du script (« Propriétés ») | 50 000 lectures ou écritures par jour | même page |
| Taille d'un mail | sans risque ici : quelques dizaines de lignes de texte | même page |

Le relecteur a relu ces deux pages : les chiffres sont exacts. Ils peuvent changer : à relire avant la construction.

## 3. Les choix techniques (au moins deux solutions à chaque fois)

**3.1 L'heure du récapitulatif**

| Solution | Précision | Retenue ? | Raison |
|---|---|---|---|
| **A. Se servir du réveil qui existe déjà toutes les 10 minutes** (celui des comptes) : à chaque passage, « est-il 15 h 45 passé, un jour ouvré, et le passage du jour n'est-il pas fait ? » | part **en général** entre 15 h 45 et 15 h 55 (Google ne garantit pas la régularité à la minute : à mesurer) | **oui** | aucun réveil en plus ; si un passage échoue, le suivant le rattrape ; coût : une lecture de mémoire toutes les 10 minutes (144 par jour sur 50 000) |
| B. Un réveil par jour, « vers 15 h 45 » | part entre 15 h 30 et 16 h | non | une demande faite à 15 h 35 est prise ou non selon le hasard ; s'il échoue, rien avant le lendemain |
| C. Cinq réveils, un par jour de la semaine | comme B | non | 5 réveils de plus pour le même résultat |

- L'heure limite annoncée aux poseurs est **15 h 45** : tu lis le mail vers 16 h et tu as deux heures pour commander. C'est un réglage (une ligne dans `Config.gs`).
- L'heure et le jour sont calculés **à l'heure de Paris par le code lui-même** (comme le reste du serveur), été comme hiver : rien à régler dans le projet Apps Script.
- **Le « passage du jour »** : au premier passage après 15 h 45, le serveur note en mémoire « passage du jour fait », **même s'il n'y avait aucune demande** (et alors sans mail). Le message donné au téléphone se lit sur cette marque, pas sur l'horloge : une demande arrivée avant le passage part aujourd'hui, une demande arrivée après part au suivant. C'est l'heure d'**arrivée au serveur** qui compte, pas l'heure du téléphone.
- **Si le mail ne peut pas partir** (quota de mails épuisé, panne) : nouvel essai toutes les 10 minutes **jusqu'à 17 h 30**. Après, il serait trop tard pour commander : les demandes restent en attente et partent en tête du récapitulatif suivant, sous le titre « Demandes non envoyées hier ».
- Le récapitulatif tourne à la suite du traitement des comptes, protégé à part : s'il plante, les mots de passe continuent de marcher, et l'inverse.

**3.2 Comment savoir ce qui est « depuis le récapitulatif précédent »**

| Solution | Retenue ? | Raison |
|---|---|---|
| **Une colonne « Récapitulatif du » dans l'onglet** : vide = pas encore envoyée. Le récapitulatif prend toutes les lignes vides, envoie le mail, puis écrit la date | **oui** | rien ne se perd : si le mail échoue, les lignes restent vides et partent au passage suivant ; tu vois dans le Sheet dans quel mail est partie chaque demande |
| Comparer l'heure de la demande à l'heure du dernier récapitulatif | non | une demande écrite pendant l'envoi peut tomber entre les deux |

**3.3 Le chemin de la demande**

| Solution | Retenue ? | Raison |
|---|---|---|
| **La file d'attente commune**, nouveau type « demande », traité **comme les notes de chantier** : compte obligatoire, pas de PDF, pas de mail à l'envoi, pas de recherche de photos | **oui** | hors réseau, attente, renvoi sans doublon : tout existe et est testé ; le nom du poseur vient du compte |
| Un appel direct au serveur | non | rien hors réseau |

- **Il faut être connecté** pour faire une demande : sans compte, pas de nom de poseur et pas de « Mes demandes ». Une demande écrite avant la connexion attend dans le téléphone et part après, comme une note de chantier.
- Le mail du récapitulatif n'a pas de pièce jointe : il part par le même chemin que tes mails d'alerte, pas par celui des fiches.

**3.4 Les articles appris et les propositions**

| Solution | Retenue ? | Raison |
|---|---|---|
| **Compter dans le téléphone** (par compte) les articles déjà demandés ; les 5 premiers deviennent les gros boutons ; propositions = ces articles + ta liste du Sheet, gardée dans le téléphone | **oui** | marche hors réseau ; rien à tenir à jour ; chacun a **ses** boutons |
| Calculer au serveur les articles les plus demandés | non | ne marche pas hors réseau ; un appel de plus |

- Les propositions sont de **gros boutons sous le champ** (**3 au plus** : avec le clavier ouvert, il reste peu de place), pas une liste à dérouler. Quand on touche le champ « Quoi », il remonte en haut de l'écran.
- La recherche ignore majuscules et accents, et cherche au début de chaque mot (« vi » propose « Vis 4×40 » et « Embout de vissage ») ; « 4x40 » trouve « 4×40 ».
- Tant qu'un poseur n'a rien demandé, il n'a pas de gros boutons : seulement les propositions pendant la frappe.
- Toucher un bouton remplit « Quoi » **et la dernière quantité demandée pour cet article** : un toucher, puis « Demander » (la quantité reste modifiable).
- **Téléphone changé ou appli réinstallée** : les boutons se refont tout seuls à partir de « Mes demandes » (90 jours), relu au serveur.

**3.5 Une demande = un article**

| Solution | Retenue ? | Raison |
|---|---|---|
| **Chaque article part tout de suite** (bouton « Demander »), puis la page est prête pour le suivant | **oui** | un geste, rien à valider à la fin, rien à perdre si la page est fermée |
| Un panier, puis « Envoyer » | non | une étape de plus ; un panier oublié ne part pas |

## 4. Ce que verra le poseur

Page `commander.html`, ouverte par la tuile « À commander » de l'accueil :

1. Deux gros boutons en haut : **À commander** (choisi d'avance) · **Outil en panne**.
2. Ses 4 ou 5 articles habituels, en gros boutons.
3. **Quoi ?** (80 caractères au plus), avec les propositions en dessous dès 2 lettres.
4. **Quantité** (texte court : « 2 boîtes », « 1 ») ; pour « Outil en panne », ce champ devient « Précision (facultative) ».
5. Bouton **Demander**. La page affiche tout de suite « ⏳ Demande notée », puis, à la réponse du serveur :
   - passage du jour pas encore fait : « ✓ Elle part dans le récapitulatif d'aujourd'hui (vers 15 h 45). »
   - passage déjà fait : « ✓ Le récapitulatif d'aujourd'hui est déjà parti : elle sera dans celui de lundi 23/11. » (le serveur nomme le jour)
   - sans réseau : « ⏳ En attente : elle partira au retour du réseau, dans le récapitulatif qui suivra. »
6. En dessous, **« Mes demandes »** (90 derniers jours, les plus récentes d'abord), gardées dans le téléphone pour le hors réseau. Chaque ligne dit où elle en est, et c'est cette ligne qui fait foi : « ⏳ en attente d'envoi », « partira dans le prochain récapitulatif », « récapitulatif du 17/11 », « ✓ Commandé ».
7. En bas : « Menuiserie cassée ou manquante ? Utilise **Signaler**. » Et sur `signaler.html` : « Vis, consommables, outil en panne ? Utilise **À commander** (sur l'accueil). »

Le brouillon automatique garde les deux champs, comme sur les autres fiches. Boutons de 48 px au moins, une main, 375 px de large. **Le clavier ouvert ne peut pas être essayé par mes tests** : c'est un de tes essais sur un vrai téléphone, avec des gants.

## 5. Ce que tu verras au bureau

**Onglet *Demandes*** (créé par l'installation) : Date · Poseur · Type (« À commander » / « Outil en panne ») · Quoi · Quantité · **Commandé** (case à cocher) · Récapitulatif du · colonnes techniques (compte, numéro de fiche).

**Onglet *Articles*** (facultatif, créé vide) : une colonne, un article par ligne. Tu y mets ce que tu veux proposer à tous ; vide, tout marche quand même.

**Le mail de 15 h 45**, objet « À commander — mardi 17/11 (3 demandes) » :

```
À COMMANDER
  Poseur A   Vis 4×40                    2 boîtes
  Poseur B   Cartouches silicone blanc   6
OUTIL EN PANNE
  Poseur A   Visseuse à choc             ne charge plus
```

Aucun mail s'il n'y a aucune demande.

**La case « Commandé »**
- Elle est posée par le serveur sur chaque nouvelle ligne.
- Cochée **avant** le récapitulatif (tu as déjà commandé par téléphone) : la ligne reste dans le mail, avec la mention « déjà commandé ».
- Décochée ensuite : le « ✓ Commandé » disparaît du téléphone.
- Ce « Commandé » n'a rien à voir avec l'état « Commandé » d'un signalement : ce sont deux onglets différents.
- Si une colonne est déplacée ou un titre changé, le serveur ne devine rien : les demandes sont quand même notées, et tu reçois un mail (un par jour au plus), comme pour l'onglet *Stockage*.

## 6. Le mail du vendredi (signalements de la semaine + point de santé)

Un seul mail, à toi, le **vendredi vers 14 h** (même mécanique que 3.1, pour qu'il n'arrive pas en même temps que le récapitulatif des commandes).

| Partie | Contenu | Le serveur a-t-il déjà cette information ? |
|---|---|---|
| Signalements de la semaine | ceux créés depuis le vendredi précédent : chantier, type, urgence, auteur, **état** (À traiter, Commandé, Livré, Clos) | oui |
| Point de santé | mails reportés encore en attente ; place du compte (le chiffre de l'onglet *Stockage*) ; fiches arrivées au bureau mais **en erreur** ou **en attente de leurs photos** | oui |

**Ce que j'avais prévu et que le serveur ne sait pas faire aujourd'hui** (le relecteur l'a vérifié dans le code) :
- « comptes bloqués » : un blocage ne dure que 15 minutes ; le vendredi à 14 h, la ligne serait presque toujours vide. **Retirée.**
- « fiches restées dans un téléphone depuis plus de 48 h » : aucun téléphone ne dit au serveur ce qu'il garde en attente. **Retirée.**
- « dernière connexion de chaque compte » : cette date n'est notée nulle part.

Ces deux dernières lignes sont pourtant les plus utiles du point de santé (voir un téléphone qui n'envoie plus). Les obtenir demande une **collecte nouvelle** : chaque téléphone dirait au serveur, une fois par jour au plus, « j'ai N fiches en attente, la plus ancienne date du … ». C'est un petit lot à part (**10b-2**), à décider : ta question 6.

**Propositions que tu n'as pas demandées** (dis non si tu n'en veux pas) :
- une ligne de rappel par signalement « Bloquant » resté « À traiter » depuis une semaine ou plus ;
- le mail part **toujours**, même vide (« rien à signaler ») : s'il n'arrive pas un vendredi, tu sais que quelque chose ne tourne plus.

## 7. Découpage en petits lots

| Lot | Contenu | Touche | Pour toi |
|---|---|---|---|
| **10a-1** | « À commander » : page, tuile, onglet *Demandes*, récapitulatif de 15 h 45, « Mes demandes », « ✓ Commandé », les deux phrases de renvoi | serveur + pages | un envoi sur TEST, 15 min d'essais téléphone, production (30 min) |
| **10a-2** | les gros boutons appris, les propositions pendant la frappe, l'onglet *Articles* | pages surtout (le serveur donne la liste) | un envoi sur TEST, 10 min d'essais téléphone avec des gants, production (le serveur change : coller, relancer `installerLot10Production`, nouveau déploiement, fusion) |
| **10b** | le mail du vendredi, avec ce que le serveur sait déjà | serveur seul | un envoi sur TEST, lire le mail, production (20 min) |
| **10b-2** | (si tu dis oui) les téléphones déclarent leurs fiches en attente ; deux lignes de plus dans le mail du vendredi | serveur + pages | à décider |
| **10c** | idée 7 : les points ouverts des notes de réunion, par chantier | serveur | après un mois de lot 8 en service |

- Ordre de mise en production (ta réponse 9 du 17/11/2026), pour ne pas mélanger les versions du serveur : **lot 8, puis 10a-1 et 10a-2, puis 10b, puis le mail unique**. Le lot 10 n'a pas besoin du mail unique pour marcher.
- Mesure sur la copie TEST : pour voir l'heure réelle du mail pendant deux jours, il faut y laisser les réveils automatiques. Ils partagent les 90 minutes par jour avec la production : je les retire à la fin de l'essai.

## 8. Les endroits touchés (lots 10a-1 et 10a-2)

| Où | Changement |
|---|---|
| `commander.html` (nouvelle) | le formulaire, les boutons appris, les propositions, « Mes demandes » |
| `commun/commander.js` (nouveau) | articles appris par compte, liste du Sheet gardée dans le téléphone, recherche sans accents |
| `index.html` | la tuile « À commander » (hors des chantiers) |
| `signaler.html` | la phrase de renvoi |
| `sw.js`, `manifest.json`, `outils/construire.js` | la nouvelle page disponible hors réseau |
| `apps-script/Demandes.gs` (nouveau) | recevoir une demande, lire « mes demandes », le récapitulatif, l'installation |
| `apps-script/Api.gs`, `Comptes.gs`, `Admin.gs`, `Config.gs`, `Securite.gs` | le type « demande », l'action de lecture, l'appel depuis le réveil des 10 minutes, l'heure limite, l'envoi du mail sans pièce jointe |
| Tests | deux séries nouvelles (serveur, page en vrai Chrome à 375 px) ; le faux serveur (un faux Google sur mon ordinateur) avec une heure réglable |
| Documents | `CHANGELOG.md`, `docs/guide-utilisateur.md`, `docs/guide-poseurs.md`, `docs/structure-sheet.md`, `CLAUDE.md` (liste des pages), une procédure |

Aucune page existante ne change de comportement ; « Signaler » ne gagne qu'une phrase.

## 9. Risques et parades

| Risque | Parade |
|---|---|
| Une demande perdue | file d'attente commune ; colonne « Récapitulatif du » (3.2) : une ligne non envoyée repart au passage suivant |
| Le mail part deux fois | la date est écrite juste après l'envoi, un seul passage à la fois ; au pire tu reçois deux fois la même liste, jamais zéro |
| Le quota de mails est épuisé à 15 h 45 | ce mail est pris sur ta réserve de 20 ; nouvel essai toutes les 10 minutes jusqu'à 17 h 30, puis report au lendemain avec la mention « non envoyées hier » ; les lignes restent visibles dans l'onglet |
| Le réveil des 10 minutes devient trop long (90 minutes par jour au total) | le contrôle de l'heure ne lit qu'une valeur en mémoire ; le temps réel sera mesuré sur la copie TEST |
| Le message du téléphone est démenti (demande écrite hors réseau) | « Mes demandes » dit toujours le vrai : « récapitulatif du … » |
| Un poseur demande une menuiserie par cette page | la phrase de renvoi ; tu le vois dans le mail |
| Abus ou erreur (100 demandes) | 30 demandes par compte et par jour ; textes limités ; un texte qui commence par `=` ne devient pas une formule dans le Sheet |
| Une ligne supprimée ou triée dans l'onglet | chaque demande est retrouvée par son numéro de fiche, pas par sa position |
| Une colonne déplacée, un titre changé | contrôle des titres à chaque passage ; mail d'alerte à toi |
| Jour férié | le mail part s'il y a des demandes : sans gravité |
| Téléphone prêté | les articles appris et « Mes demandes » sont rangés par compte |
| Dépôt public | tests et exemples avec des noms inventés ; la liste *Articles* n'est donnée qu'aux comptes connectés |

## 10. Tests prévus

- **Faux serveur** : demande avant et après le passage du jour, le vendredi soir, le week-end, au changement d'heure ; passage vide (aucun mail, marque posée) ; mail en échec puis repris, puis abandonné à 17 h 30 et reporté ; deux passages au même instant ; demande renvoyée deux fois (une seule ligne) ; case « Commandé » cochée avant et après le récapitulatif, décochée ; un poseur ne voit que ses demandes ; sans compte (attente) ; limites de texte et de nombre ; titres de l'onglet changés ; onglet *Articles* vide, absent, très long ; le traitement des comptes continue si le récapitulatif plante.
- **Page** (vrai Chrome, 375 px et PC) : boutons appris après 1, 5, 20 demandes ; quantité reprise ; propositions dès 2 lettres avec et sans accents ; hors réseau ; réseau lent ; brouillon restauré ; second compte sur le même téléphone ; boutons refaits après réinstallation.
- **Sur la copie TEST, avec toi** : l'heure réelle du mail pendant deux jours ; le mail lu sur ton téléphone ; la case cochée vue par un compte de poseur ; **le clavier ouvert, avec des gants**.

## 11. Tes questions (réponds par le numéro) — **répondues le 17/11/2026 : voir le chapitre 0**

1. **Heure limite 15 h 45** (mail en général avant 16 h) : d'accord ? (ou 15 h 30)
2. **« Mes demandes »** : le poseur voit **seulement les siennes**. D'accord ? (l'autre choix : tout le monde voit tout, pour éviter les doubles demandes)
3. Le **mail du vendredi part toujours**, même s'il n'y a rien à signaler : oui ou non ?
4. Mail du vendredi **vers 14 h** : d'accord ?
5. **Idée 7** (points ouverts des notes de réunion) : une partie du mail du vendredi, ou un document à la demande ?
6. **Lot 10b-2** : veux-tu que les téléphones disent au serveur ce qu'ils gardent en attente (pour voir un téléphone qui n'envoie plus) ? Je recommande : oui, mais plus tard, après un mois de 10b.
7. Le rappel des signalements « Bloquant » restés « À traiter » dans le mail du vendredi : oui ou non ?
8. « Outil en panne » : le second champ s'appelle « Précision (facultatif) ». Faut-il autre chose (« où est l'outil ? ») ? Je recommande : non.
9. « À commander » **avant** le mail unique : oui ou non ? (ton ordre actuel : après)

Les autres points (limite de 30 demandes par compte et par jour, textes exacts, couleurs) : je tranche et je les note dans `DECISIONS.md`.

## 12. Ce que tu auras à faire

| Quand | Quoi | Durée |
|---|---|---|
| Maintenant | répondre aux 9 questions, dire « d'accord » | 10 min |
| Lots 10a-1 et 10a-2 | envoi sur TEST ; 8 essais sur téléphone (dont le clavier ouvert, avec des gants) ; attendre un mail de 15 h 45 ; production (coller le serveur, `installerLot10Production`, nouveau déploiement, fusion) | 1 h en deux fois |
| Lot 10b | envoi sur TEST ; lire un mail du vendredi fabriqué à la demande ; production | 30 min |
| Ensuite | remplir l'onglet *Articles* si tu veux ; cocher « Commandé » | au fil de l'eau |
