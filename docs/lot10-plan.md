# Lot 10 — « À commander » et le mail du vendredi — PLAN

> Plan du 17/11/2026, **version 1. Rien n'est construit : pas de code avant ta validation.**
> D'après ta commande du 17/11 au soir. Tes choix du lot 10 : idées 4 (point de santé) et 7 (points ouverts des notes de réunion, après le lot 8) retenues ; idées 1, 2, 3, 5, 6 et 8 refusées.

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
| Précision de l'heure d'un déclencheur (le « réveil » qui lance une fonction tout seul) | `nearMinute` : **à 15 minutes près**, en plus ou en moins. `atHour(15)` seul : « entre 15 h et 16 h ». Un mail « à 16 h pile » est donc impossible avec un déclencheur à heure fixe | developers.google.com/apps-script/reference/script/clock-trigger-builder |
| Déclencheurs répétés | toutes les 1, 5, 10, 15 ou 30 minutes | même page |
| Nombre de déclencheurs | 20 par compte et par projet ; le serveur en a 6 | developers.google.com/apps-script/guides/services/quotas |
| Temps total des déclencheurs | 90 minutes par jour (compte gratuit) | même page |
| Mails | 100 destinataires par jour ; ce lot en ajoute **1 par jour ouvré et 1 par semaine**, tous à toi, pris sur les 20 réservés au bureau | même page |
| Mémoire du script (« Propriétés ») | 50 000 lectures ou écritures par jour | même page |

Ces chiffres peuvent changer : à relire avant la construction.

## 3. Les choix techniques (au moins deux solutions à chaque fois)

**3.1 L'heure du récapitulatif**

| Solution | Précision | Retenue ? | Raison |
|---|---|---|---|
| **A. Se servir du réveil qui existe déjà toutes les 10 minutes** (`traiterComptes`) : à chaque passage, « est-il 15 h 45 passé, un jour ouvré, et le récapitulatif du jour n'est-il pas parti ? » | part entre **15 h 45 et 15 h 55** | **oui** | aucun déclencheur en plus ; si un passage échoue, le suivant le rattrape ; coût : une lecture de mémoire toutes les 10 minutes (144 par jour sur 50 000) |
| B. Un déclencheur par jour, `atHour(15).nearMinute(45)` | part entre 15 h 30 et 16 h | non | une demande faite à 15 h 35 est prise ou non selon le hasard ; s'il échoue, rien avant le lendemain |
| C. Cinq déclencheurs, un par jour de la semaine | comme B | non | 5 déclencheurs de plus pour le même résultat |

L'heure limite annoncée aux poseurs est donc **15 h 45** : tu lis le mail vers 16 h et tu as deux heures pour commander. Elle sera un réglage (une ligne dans `Config.gs`).
À vérifier une fois : le fuseau horaire du projet Apps Script doit être « Paris » (`verifierConfig` l'affichera).

**3.2 Comment savoir ce qui est « depuis le récapitulatif précédent »**

| Solution | Retenue ? | Raison |
|---|---|---|
| **Une colonne « Récapitulatif du » dans l'onglet** : vide = pas encore envoyée. Le récapitulatif prend toutes les lignes vides, envoie le mail, puis écrit la date | **oui** | rien ne se perd : si le mail échoue (quota, panne), les lignes restent vides et partent au passage suivant ; tu vois dans le Sheet dans quel mail est partie chaque demande |
| Comparer l'heure de la demande à l'heure du dernier récapitulatif | non | une demande écrite pendant l'envoi peut tomber entre les deux |

**3.3 Le chemin de la demande**

| Solution | Retenue ? | Raison |
|---|---|---|
| **La file d'attente commune des fiches** (celle de « Signaler »), nouveau type « demande », sans PDF ni mail à l'envoi | **oui** | hors réseau, attente, renvoi sans doublon, « fiche sans être connecté » : tout existe et est testé |
| Un appel direct au serveur | non | rien hors réseau |

**3.4 Les articles appris et les propositions**

| Solution | Retenue ? | Raison |
|---|---|---|
| **Compter dans le téléphone** (par compte) les articles déjà demandés ; les 5 premiers deviennent les gros boutons ; propositions = ces articles + ta liste du Sheet, gardée dans le téléphone | **oui** | marche hors réseau ; rien à tenir à jour ; chacun a **ses** boutons |
| Calculer au serveur les articles les plus demandés | non | ne marche pas hors réseau ; un appel de plus |

- Les propositions sont de **gros boutons sous le champ** (5 au plus), pas une liste à dérouler.
- La recherche ignore majuscules et accents, et cherche au début de chaque mot (« vi » propose « Vis 4×40 » et « Embout de vissage »).
- Tant qu'un poseur n'a rien demandé, il n'a pas de gros boutons : seulement les propositions pendant la frappe.
- Toucher un bouton remplit « Quoi » ; il reste la quantité à taper.

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
4. **Quantité** (texte court : « 2 boîtes », « 1 ») ; pour « Outil en panne », ce champ devient « Précision (facultatif) ».
5. Bouton **Demander**. Message selon l'heure, donné par le serveur :
   - avant 15 h 45 un jour ouvré : « ✓ Demande notée : elle part dans le récapitulatif d'aujourd'hui, 15 h 45. »
   - après : « ✓ Demande notée : le récapitulatif d'aujourd'hui est déjà parti, elle sera dans celui de demain (lundi, le vendredi soir et le week-end). »
   - sans réseau : « ⏳ Demande en attente : elle partira au retour du réseau, dans le récapitulatif qui suivra. »
6. En dessous, **« Mes demandes »** (30 derniers jours) : chaque ligne, avec « ✓ Commandé » quand tu as coché la case.
7. En bas : « Menuiserie cassée ou manquante ? Utilise **Signaler**. » Et sur `signaler.html` : « Vis, consommables, outil en panne ? Utilise **À commander** (sur l'accueil). »

Le brouillon automatique garde les deux champs, comme sur les autres fiches. Boutons de 48 px au moins, une main, 375 px de large.

## 5. Ce que tu verras au bureau

**Onglet *Demandes*** (créé par l'installation) : Date · Poseur · Type (« À commander » / « Outil en panne ») · Quoi · Quantité · **Commandé** (case à cocher) · Récapitulatif du · colonnes techniques (compte, numéro de fiche).

**Onglet *Articles*** (facultatif, créé vide) : une colonne, un article par ligne. Tu y mets ce que tu veux proposer à tous ; vide, tout marche quand même.

**Le mail de 15 h 45**, objet « À commander — mardi 17/11 (6 demandes) » :

```
À COMMANDER
  Poseur A   Vis 4×40                 2 boîtes
  Poseur B   Cartouches silicone blanc   6
OUTIL EN PANNE
  Poseur A   Visseuse à choc          ne charge plus
```

Aucun mail s'il n'y a aucune demande.

## 6. Le mail du vendredi (signalements de la semaine + point de santé)

Un seul mail, à toi, le **vendredi entre 14 h et 14 h 10** (même mécanique que 3.1, pour qu'il n'arrive pas en même temps que le récapitulatif des commandes).

| Partie | Contenu |
|---|---|
| Signalements de la semaine | ceux créés depuis le vendredi précédent : chantier, type, urgence, auteur, **état** (À traiter, Commandé, Livré, Clos) |
| Signalements plus anciens encore ouverts | une ligne de rappel par signalement « Bloquant » resté « À traiter », et le nombre des autres |
| Point de santé | comptes bloqués ; mails reportés encore en attente ; place du compte (le chiffre de l'onglet *Stockage*) ; fiches restées en attente dans un téléphone depuis plus de 48 h |

- **Limite à connaître** : le serveur ne sait qu'un téléphone garde une fiche en attente que si ce téléphone a pu le lui dire. Un téléphone éteint ou sans réseau depuis une semaine n'apparaît pas. Je propose une ligne simple : « dernière connexion de chaque compte », qui montre un téléphone qui ne donne plus de nouvelles.
- Je propose que ce mail parte **toujours**, même vide (« rien à signaler ») : s'il n'arrive pas un vendredi, tu sais que quelque chose ne tourne plus. C'est ta question 3.

## 7. Découpage en petits lots

| Lot | Contenu | Touche | Pour toi |
|---|---|---|---|
| **10a** | « À commander » : page, tuile, onglets *Demandes* et *Articles*, récapitulatif de 15 h 45, « ✓ Commandé » | serveur + pages | un envoi sur TEST, 15 min d'essais téléphone, production (30 min) |
| **10b** | le mail du vendredi | serveur seul | un envoi sur TEST, lire le mail, production (20 min) |
| **10c** | idée 7 : les points ouverts des notes de réunion, par chantier (dans le mail du vendredi ou à la demande : ta question 5) | serveur | après un mois de lot 8 en service |

Ordre de mise en production, pour ne pas mélanger les versions du serveur : **lot 8, puis mail unique, puis 10a, puis 10b**. Le lot 10 sera construit sur une branche partie de celle du mail unique.

## 8. Les endroits touchés (lot 10a)

| Où | Changement |
|---|---|
| `commander.html` (nouvelle) | le formulaire, les boutons appris, les propositions, « Mes demandes » |
| `commun/commander.js` (nouveau) | articles appris par compte, liste du Sheet gardée dans le téléphone, recherche sans accents |
| `index.html` | la tuile « À commander » (hors des chantiers) |
| `signaler.html` | la phrase de renvoi |
| `sw.js`, `manifest.json`, `outils/construire.js` | la nouvelle page disponible hors réseau |
| `apps-script/Demandes.gs` (nouveau) | recevoir une demande, lire « mes demandes », le récapitulatif, l'installation |
| `apps-script/Api.gs`, `Comptes.gs`, `Admin.gs`, `Config.gs` | le type « demande », l'action de lecture, l'appel depuis le réveil des 10 minutes, l'heure limite |
| Tests | deux séries nouvelles (serveur, page en vrai Chrome à 375 px) ; faux serveur : l'heure réglable |
| Documents | `CHANGELOG.md`, `docs/guide-utilisateur.md`, `docs/guide-poseurs.md`, `docs/structure-sheet.md`, `CLAUDE.md` (liste des pages), une procédure |

Aucune page existante ne change de comportement ; « Signaler » ne gagne qu'une phrase.

## 9. Risques et parades

| Risque | Parade |
|---|---|
| Une demande perdue | file d'attente commune ; colonne « Récapitulatif du » (3.2) : une ligne non envoyée repart au passage suivant |
| Le mail part deux fois | la date est écrite juste après l'envoi, sous verrou (un seul passage à la fois) ; au pire tu reçois deux fois la même liste, jamais zéro |
| Le quota de mails est épuisé à 15 h 45 | ce mail est pris sur ta réserve de 20 ; s'il ne part pas, il repart 10 minutes plus tard, et les lignes restent visibles dans l'onglet |
| Le réveil des 10 minutes devient trop long (90 minutes par jour au total) | le contrôle de l'heure se fait avant tout le reste et ne lit qu'une valeur en mémoire ; le temps réel sera mesuré sur la copie TEST |
| Un poseur demande une menuiserie par cette page | la phrase de renvoi ; tu le vois dans le mail |
| Abus ou erreur (100 demandes) | 30 demandes par compte et par jour ; textes limités ; un texte qui commence par `=` ne devient pas une formule dans le Sheet |
| Une ligne supprimée ou triée dans l'onglet | chaque demande est retrouvée par son numéro de fiche, pas par sa position |
| Jour férié | le mail part s'il y a des demandes : sans gravité |
| Téléphone prêté | les articles appris sont rangés par compte |

## 10. Tests prévus

- **Faux serveur** : demande avant et après l'heure limite, le vendredi soir, le week-end ; récapitulatif vide (aucun mail) ; mail en échec puis repris ; deux passages au même instant ; demande renvoyée deux fois (une seule ligne) ; case « Commandé » lue par le téléphone ; un poseur ne voit que ses demandes ; sans compte ; limites de texte et de nombre ; onglet *Articles* vide, absent, très long.
- **Page** (vrai Chrome, 375 px et PC) : boutons appris après 1, 5, 20 demandes ; propositions dès 2 lettres avec et sans accents ; hors réseau ; réseau lent ; brouillon restauré ; second compte sur le même téléphone.
- **Sur la copie TEST, avec toi** : l'heure réelle du mail pendant deux jours ; le mail lu sur ton téléphone ; la case cochée vue par un compte de poseur.

## 11. Tes questions (réponds par le numéro)

1. **Heure limite 15 h 45**, mail entre 15 h 45 et 15 h 55 : d'accord ? (ou 15 h 30)
2. **« Mes demandes »** : le poseur voit **seulement les siennes**, sur 30 jours. D'accord ? (l'autre choix : tout le monde voit tout, pour éviter les doubles demandes)
3. Le **mail du vendredi part toujours**, même s'il n'y a rien à signaler : oui ou non ?
4. Mail du vendredi **à 14 h** : d'accord ?
5. **Idée 7** (points ouverts des notes de réunion) : une partie du mail du vendredi, ou un document à la demande ?
6. « Outil en panne » : faut-il un champ de plus (« où est l'outil ? ») ou « quoi » et « précision » suffisent ? Je recommande : suffisent.
7. Un poseur **sans compte** peut-il faire une demande (gardée dans le téléphone jusqu'à sa connexion, comme les fiches) ? Je recommande : oui.

Les autres points (limites, textes exacts, couleurs) : je tranche et je les note dans `DECISIONS.md`.

## 12. Ce que tu auras à faire

| Quand | Quoi | Durée |
|---|---|---|
| Maintenant | répondre aux 7 questions, dire « d'accord » | 10 min |
| Lot 10a | envoi sur TEST ; 8 essais sur téléphone ; attendre un mail de 15 h 45 ; production (coller le serveur, `installerLot10Production`, nouveau déploiement, fusion) | 1 h en deux fois |
| Lot 10b | envoi sur TEST ; lire un mail du vendredi fabriqué à la demande ; production | 30 min |
| Ensuite | remplir l'onglet *Articles* si tu veux ; cocher « Commandé » | au fil de l'eau |
