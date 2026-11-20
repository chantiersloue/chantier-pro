# Groupe B — lots 10a-1, 10a-2 et 10b en une seule séance

> Pour Franck. Ta décision du 20/11 : **groupe A, puis groupe B, puis mail unique**.
> La branche `lot-10b` (dossier `chantier-pro-lot10a2`) contient le groupe A **et** les trois lots 10 : **10a-1** (« À commander » : le petit matériel), **10a-2** (les articles habituels, les propositions pendant la frappe, l'onglet *Articles*) et **10b** (le point du vendredi, un mail par semaine à toi).
> Serveur **v11.5**, appli **10.6**. **Seulement après le groupe A en production.**
> **Un envoi sur la copie TEST, une séance d'essais (environ 40 minutes), une mise en production.** Le détail de chaque lot reste dans `docs/lot10-procedure.md` (ses numéros de version sont ceux d'avant le regroupement : ne regarde que ceux de cette page).
> **Ne passe à la partie suivante que si la précédente est bonne.** Sinon : arrête-toi et envoie-moi une capture.

## Partie 1 — toi, au PC (5 minutes)

1. Je t'ai confirmé « dossier prêt, branche lot-10b, serveur v11.5 ». PowerShell **dans le dossier `chantier-pro-lot10a2`** :
   ```
   node outils\envoyer-test.js --avec-porte
   ```
   Attends `✅ Envoi réussi`, version **v11.5**. Dis-moi « envoi fait ».

## Partie 2 — moi (10 minutes, sans toi)

Installation du lot 10 sur TEST (`installerLot10` : onglets *Demandes* et *Articles*), publication de la copie d'essai en **10.6**. Je te dis « à toi ».

Si l'installation me répond « un onglet Demandes existe déjà avec d'autres titres » : dans le Sheet « ChantierPro TEST », clic droit sur l'onglet *Demandes* → **Renommer** → `Demandes ancien`. Je relance.

## Partie 3 — toi, au PC puis au téléphone (25 minutes)

**A. L'onglet *Articles* (Sheet « ChantierPro TEST »)**
1. Écris quatre ou cinq articles sous le titre, un par ligne : par exemple `Vis 4×40`, `Embout de vissage`, `Cartouches silicone blanc`, `Éclisse alu`.

**B. « À commander », au téléphone** (copie d'essai, compte de **poseur** d'essai ; « À propos » doit afficher **10.6**)
2. Accueil → **À commander** (la tuile est sous « Hors chantier »). « À commander » est déjà choisi ; aucun gros bouton en haut si ce compte n'a encore rien demandé.
3. Tape `vi` dans « Quoi ? » : « Vis 4×40 » et « Embout de vissage » sont proposés. `ecl` (sans accent) : « Éclisse alu ».
4. Touche « Vis 4×40 », écris `2 boîtes`, **Demander**. Tu lis « ⏳ Demande notée », puis « ✓ Elle part dans le récapitulatif d'aujourd'hui (vers 15 h 45) » (ou « … déjà parti » après 15 h 45). Un gros bouton vert est apparu en haut : **Vis 4×40 — 2 boîtes**.
5. Touche-le, change la quantité en `3 boîtes`, **Demander**. Fais trois ou quatre autres demandes : les boutons s'ajoutent, **5 au plus**.
6. **Outil en panne** : le second champ s'appelle « Précision (facultative) ». Écris « Visseuse à choc », **Demander**.
7. **Avec des gants, le clavier ouvert** (c'est ce que mes tests ne peuvent pas faire) : le champ remonte-t-il en haut ? Vois-tu les propositions, « Quantité » et **Demander** au-dessus du clavier ? Dis-moi ce qui gêne, sur Android et sur iPhone si tu peux.
8. **Mode avion** : rouvre « À commander » : les boutons et « Mes demandes » sont là. Touche un bouton, **Demander** : « ⏳ En attente… ». Remets le réseau : elle part toute seule ; dans l'onglet *Demandes*, **une seule** ligne pour elle.
9. Commence une demande, **ferme l'appli sans toucher Demander**, rouvre : « Brouillon retrouvé » → **Restaurer**.
10. **Second compte** sur le même téléphone : il n'a **pas** les boutons du premier.
11. Dans un chantier, **Signaler** : la phrase « Vis, consommables, outil en panne ? Utilise À commander » est en bas.

**C. Au PC**
12. Onglet *Demandes* : **coche « Commandé »** sur une ligne. Au téléphone, rouvre « À commander » : « ✓ Commandé ». Décoche.
13. Éditeur Apps Script **de la copie TEST** : fonction **`essaiPointDuVendredi`** → ▶ **Exécuter**. Le journal commence par `✅ Essai du point du vendredi (TEST) : mail envoyé à … seulement`.
14. **Lis le mail** « [ESSAI] Point du vendredi … » dans Outlook **et** sur ton téléphone : les trois parties sont-elles là ? Se lisent-elles ?

Dis-moi « essais faits », avec tes remarques.

## Partie 4 — facultative : voir les mails partir tout seuls sur TEST

Sur TEST, les « réveils » (ce qui lance une fonction tout seul) ne sont posés que pendant les essais : leurs 90 minutes par jour sont partagées avec la production.
- **Le mail « À commander » de 15 h 45** : un jour ouvré, avant 15 h 30, dis-moi « réveils ». Fais deux ou trois demandes. Le mail arrive entre 15 h 45 et 16 h : **note l'heure exacte** (c'est la mesure qui nous manque). Fais une demande après : le téléphone dit « … déjà parti : elle sera dans celui de … ».
- **Le point du vendredi** : un vendredi avant 14 h, lance `demarrerPointDuVendredi` sur TEST et dis-moi « réveils ». Vers 14 h, le mail arrive ; note l'heure. Puis `arreterPointDuVendredi` sur TEST.

## Production du groupe B (toi : 20 minutes) — après « essais faits » et mon accord, et le groupe A en production depuis un jour au moins

1. Dans `chantier-pro-lot10a2` : `node outils\envoyer-test.js --sans-porte` (c'est le fichier qui ira en production ; je vérifie son empreinte).
2. Éditeur Apps Script **de production** : remplace tout `Code.gs` par `A-COLLER-DANS-APPS-SCRIPT/Code.gs` **du dossier `chantier-pro-lot10a2`** (la ligne `VERSION_API` dit `v11.5`). **Enregistre.**
3. Fonction **`installerLot10Production`** → ▶. Le journal finit par `✅ Lot 10 : installation terminée.` (onglets *Demandes* et *Articles* ; relançable sans danger).
4. Fonction **`demarrerPointDuVendredi`** → ▶. Tu lis `✅ Point du vendredi mis en service : un mail à … , le vendredi, … après 14 h 00`. **Sans cette étape, le mail du vendredi ne part pas.**
5. Fonction **`verifierConfig`** → ▶. Aucune ligne ne commence par ❌ (sauf, si tu ne les as pas encore écrites, la ligne des adresses de la direction des absences : c'est normal).
6. **Déployer → Nouveau déploiement** (« Groupe B — production »). Donne-moi l'adresse : je la mets dans `commun/config.js` et je te donne le lien de fusion.
7. Après la fusion : « À propos » affiche **10.6** ; la tuile « À commander » est sur l'accueil.
8. Le premier jour ouvré : une demande d'essai avant 15 h 45, le mail, puis **supprime la ligne d'essai** dans l'onglet *Demandes*. Le premier vendredi vers 14 h 10 : le mail « Point du vendredi » est-il arrivé ?
9. Quand tu veux : remplis l'onglet *Articles*.
10. **Anciens déploiements** : le précédent, à archiver une semaine après la fusion (les liens des mails d'absence valent 7 jours).

**L'ordre compte** : le serveur d'abord (2 à 6), les pages ensuite (fusion). Si les pages arrivaient avant le serveur, une demande « À commander » resterait dans le téléphone, marquée « à vérifier » : rien ne serait perdu.

## Retour arrière

- **Arrêter le mail du vendredi** : `arreterPointDuVendredi`, ▶ (immédiat).
- **Tout le groupe B** : je remets l'adresse du déploiement du groupe A et les pages d'avant par une fusion. Les demandes « À commander » faites pendant ce temps restent dans les téléphones (« à vérifier ») ; l'onglet *Demandes* est gardé tel quel. Le groupe A n'est pas touché.

## Ce qui n'a pas été vérifié

- Rien n'a tourné chez Google : les onglets *Demandes* et *Articles*, les heures réelles d'arrivée des mails (15 h 45, vendredi 14 h).
- **Le vrai clavier, avec des gants**, sur Android et sur iPhone ; le plein soleil.
- L'affichage des deux mails dans Outlook et sur téléphone.
- Le regroupement lui-même : les trois lots 10 et le groupe A ensemble passent toutes leurs séries de tests (serveur et pages), mais n'ont jamais tourné ensemble chez Google.
