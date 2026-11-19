# Lot 14 — La demande d'absence reliée au planning : procédure de déploiement et d'essai

> Pour Franck. Plan : `docs/lot14-plan.md`.
> Une livraison : le **serveur v11.4**, les **pages, appli 10.5**, et les deux programmes du planning (`A-COLLER-PLANNING/`, remis à jour).
> **État au 19/11/2026** : construit, testé contre le faux serveur et dans Chrome. **Rien n'a tourné chez Google**, aucun vrai mail n'est parti, aucun vrai téléphone.
> **Le lot est livré ÉTEINT** : tant que tu n'as pas ajouté le réglage `ABSENCE_DIRECTION`, les demandes d'absence partent **exactement comme aujourd'hui**.
> Les numéros v11.4 / 10.5 seront réattribués à la mise en production (d'autres lots passent avant).
> **Ne passe à l'étape suivante que si la précédente est verte.** Sinon : arrête-toi et envoie-moi une capture.

## Ce qui change, en clair

- **Le poseur** remplit et envoie sa demande comme aujourd'hui. Il ne reçoit plus de copie par mail (le champ « e-mail personnel » disparaît) : en haut de la page, **« Mes demandes »** lui dit **En attente**, **Acceptée** ou **Refusée**. Trois motifs s'ajoutent à la liste : Congés, École, Formation.
- **La direction** reçoit **seule** le mail, avec le PDF signé et **deux gros boutons, « ✅ Accepter » et « ❌ Refuser »**. Un clic ouvre une page qui rappelle la demande (qui, quand, quelle durée) ; elle appuie sur **Confirmer**. Deux clics en tout, sans compte ni mot de passe.
- **Le lien** ne sert qu'une fois et vaut **7 jours**. Ouvrir la page ne décide rien (les messageries ouvrent parfois les liens toutes seules) : seul « Confirmer » décide. Avec plusieurs adresses de direction, la première réponse compte.
- **Acceptée** : tu reçois un mail d'information — qui, quand, quelle durée, et l'appellation du planning. **Jamais le motif.** L'absence s'inscrit toute seule dans le planning : dans la nuit, et toujours juste avant une publication.
- **Refusée** : rien dans le planning, aucun mail pour toi. Le poseur le voit dans l'appli.
- **Le motif** n'est plus écrit que dans le mail de la direction et son PDF : ni dans le Sheet (« (réservé à la direction) »), ni dans Drive (le PDF n'est plus rangé dans ADMINISTRATIF/ABSENCES), ni dans ton mail, ni dans le planning.

**L'appellation dans le planning** : Congés (motif « Congés », ou heures imputées sur les congés payés), École, Formation ; **tout le reste — médical, accident, personnel, un motif tapé à la main — s'affiche « Absent »**.

## Avant de commencer : ce qu'il te faut

1. Les **adresses de la direction** (1 à 3) qui doivent recevoir les demandes et répondre.
2. Le **lot 11.1** installé (le Sheet « Planning Loué » et son programme de publication) si tu veux l'inscription dans le planning. **Sans le planning, tout le reste marche** : mail à la direction, boutons, état pour le poseur, mail au conducteur.

## Étape A — la copie TEST (toi : 5 minutes)

1. Je t'ai confirmé « dossier prêt, branche lot-14, serveur v11.4 ». PowerShell **dans le dossier `chantier-pro-lot14`** :
   ```
   node outils\envoyer-test.js --avec-porte
   ```
   Attends `✅ Envoi réussi`, version **v11.4**. Dis-moi « envoi fait ».
2. Éditeur Apps Script **de la copie TEST** → roue dentée **Paramètres du projet** → **Propriétés du script** → **Ajouter** :

   | Propriété | Valeur |
   |---|---|
   | `ABSENCE_DIRECTION` | **une adresse à toi** (pas celle de la direction : ce sont des essais) |
   | `ADRESSE_APPLI` | l'adresse de la copie d'essai de l'appli (je te la donne) |

3. Fonction **`verifierConfig`** → Exécuter → Journal d'exécution : tu dois lire
   `✅ Absences (propriété ABSENCE_DIRECTION) : allumé — 1 adresse(s) de la direction ; boutons du mail vers …`
4. Je publie la copie d'essai en **10.5**.

## Étape B — tes essais (15 minutes) : téléphone, puis ta boîte Outlook

Sur la copie d'essai (icône « Loué ESSAI »), connecté. « À propos » doit afficher **10.5**.

1. Tuile **Demande d'absence** : la section **« Mes demandes »** est en haut (vide), le champ e-mail a disparu.
2. Fais une demande pour une date dans trois semaines, **motif « Médical »**, précisions « essai ». Envoie. « Mes demandes » affiche la date et **En attente**.
3. **Dans Outlook, sur ton PC** : le mail « [Loué App] Demande d'absence — … » est arrivé. **Regarde bien** :
   - les deux boutons, vert et rouge, sont-ils de vrais boutons ? (envoie-moi une capture)
   - le PDF est-il joint ? le motif est-il dans le mail ?
   - est-il en boîte de réception, pas dans les indésirables ?
4. Clique **✅ Accepter** : une page s'ouvre dans ton navigateur, rappelle la demande **sans le motif**, avec un bouton vert **« Confirmer : j'accepte »**. **N'appuie pas encore.** Regarde sur ton téléphone : la demande est toujours « En attente » (ouvrir la page ne décide rien).
5. Appuie sur **Confirmer**. La page dit « ✅ Demande acceptée ».
6. Tu reçois un second mail, « [Loué App] Absence acceptée — … » : il dit **« Dans le planning : Absent »**, et **pas un mot du motif**.
7. Sur le téléphone, rouvre *Demande d'absence* : **Acceptée**.
8. Dans le premier mail, clique **❌ Refuser** : la page dit « Une réponse a déjà été donnée : demande acceptée ». Aucun bouton.
9. Fais une seconde demande, **motif « École »**. Dans son mail, clique **❌ Refuser**, puis **Confirmer**. Téléphone : **Refusée**. Tu ne reçois **pas** de mail « Absence acceptée ».
10. **Mode avion**, rouvre *Demande d'absence* : les deux états s'affichent encore (« gardé dans le téléphone »).
11. Ouvre le Sheet « ChantierPro TEST » : onglet ***Absences suivi*** (deux lignes, aucun motif) ; onglet *Absences* : « (réservé à la direction) » dans les colonnes Motif et Précisions.
12. Si tu as aussi un téléphone avec ta boîte mail : refais l'essai 4 depuis le téléphone (la page de confirmation doit être lisible, le bouton facile à toucher).

Dis-moi « essais faits », avec ta capture d'Outlook.

## Étape C — l'inscription dans le planning (seulement si le lot 11.1 est installé sur la copie TEST)

1. Dans « Planning Loué TEST », onglet *SALARIÉS*, colonne D : le compte de l'appli du gars d'essai.
2. Colle la nouvelle version de `A-COLLER-PLANNING/2-Programme-de-publication.gs` dans le projet « Planning Loué — publication » de TEST. **Enregistre.**
3. Fais une demande d'absence **acceptée** pour un jour de la semaine en cours du planning TEST.
4. Coche **Publier pour les gars** sur cette semaine. Dans les 10 minutes : la case du gars affiche « Congés » (ou « Absent », « École »…), le PDF publié la montre, et l'onglet ***ABSENCES*** du planning a une ligne « inscrite : 1 jour(s) ».

## Étape D — production (toi : 15 minutes) — le lot reste ÉTEINT

1. Dans `chantier-pro-lot14` : `node outils\envoyer-test.js --sans-porte` (je vérifie l'empreinte).
2. Éditeur Apps Script **de production** : remplace tout `Code.gs` par `A-COLLER-DANS-APPS-SCRIPT/Code.gs` **du dossier `chantier-pro-lot14`**. **Enregistre.** `verifierConfig` : `✅ Absences … : éteint`. **Déployer → Nouveau déploiement** (« Lot 14 — production »). Donne-moi l'adresse.
3. Je mets l'adresse dans `commun/config.js` et je te donne le lien de fusion. Après la fusion : « À propos » affiche **10.5**.
4. Une demande d'absence réelle part **comme avant** (le lot est éteint).
5. **Anciens déploiements** : à n'archiver qu'**une semaine après**.

## Étape E — allumer (toi : 5 minutes) — après ton accord et celui de la direction

1. **Préviens la direction** : elle recevra désormais un mail avec deux boutons ; elle clique, puis confirme sur la page.
2. Éditeur Apps Script **de production** → Propriétés du script → `ABSENCE_DIRECTION` = les adresses de la direction, séparées par une virgule. (`ADRESSE_APPLI` : inutile en production.)
3. `verifierConfig` : `✅ Absences … : allumé — N adresse(s) de la direction ; boutons du mail vers https://chantiersloue.github.io/chantier-pro/`.
4. **Préviens les gars** : plus de copie par mail ; la réponse se lit dans « Mes demandes ».

## Retour arrière (30 secondes)

**Propriétés du script** → supprime `ABSENCE_DIRECTION` → Enregistrer. Dès la demande suivante, tout redevient comme avant (mail aux personnes prévenues, copie au salarié, PDF rangé dans Drive). Les demandes déjà envoyées gardent leur état ; leurs liens marchent encore.

## Comment vérifier que tout va bien

| Où | Ce que tu dois voir |
|---|---|
| `verifierConfig` | la ligne `Absences (propriété ABSENCE_DIRECTION) : …` ; `❌` si aucune adresse n'est lisible (lu alors comme éteint) |
| Onglet *Absences suivi* | une ligne par demande : numéro, compte, demandeur, dates, durée, appellation, état, « envoyé le … » pour ton mail |
| Onglet *Envois* | la demande « traité » ; « erreur — Demande gardée dans le téléphone… » si le mail à la direction n'a pas pu partir (elle repartira toute seule) |
| Planning, onglet *ABSENCES* | « inscrite : N jour(s) », ou « ⚠ à inscrire à la main : … » |

## Ce qui n'a pas été vérifié

- **L'aspect du mail dans Outlook** : les boutons sont faits « en tableau », la façon qui marche dans Outlook, mais seul ton essai B3 le dira. Si les boutons ne s'affichent pas, les deux liens sont aussi écrits en clair sous le mail.
- **Les indésirables** : un mail avec deux liens peut être filtré par la messagerie de la direction. À vérifier avec elle au premier vrai mail.
- **Les messageries qui ouvrent les liens toutes seules** : la page est faite pour (rien n'est décidé à l'ouverture), mais je n'ai pas pu l'essayer avec une vraie messagerie d'entreprise.
- **Rien chez Google** : les mails, le Sheet, l'inscription dans le vrai planning.
- **Relecture par un agent indépendant** : faite le 19/11/2026 (voir le journal), un tour.
