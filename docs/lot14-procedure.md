# Lot 14 — La demande d'absence reliée au planning : procédure de déploiement et d'essai

> Pour Franck. Plan : `docs/lot14-plan.md`.
> Une livraison : le **serveur v11.4**, les **pages, appli 10.5**, et les deux programmes du planning (`A-COLLER-PLANNING/`, remis à jour).
> **Il passe avec le groupe A** (lots 8d, 12, 13 et 14 ensemble, ta décision du 20/11) : les essais sont dans `docs/essais-groupes.md`. Cette page explique le lot 14 en détail.
> **État au 20/11/2026** : construit, testé contre le faux serveur et dans Chrome, relu par un agent indépendant (un tour, rien de bloquant) et corrigé, puis adapté à tes réponses du 20/11. **Rien n'a tourné chez Google**, aucun vrai mail n'est parti, aucun vrai téléphone.
> **Le lot est livré ÉTEINT** : tant que la case « Adresses de la direction » de l'onglet *Réglages* est vide, les demandes d'absence partent **exactement comme aujourd'hui** (et tu reçois une alerte).
> **Ne passe à l'étape suivante que si la précédente est verte.** Sinon : arrête-toi et envoie-moi une capture.

## Ce qui change, en clair

- **Le poseur** remplit et envoie sa demande comme aujourd'hui. Il ne reçoit plus de copie par mail (le champ « e-mail personnel » disparaît) : en haut de la page, **« Mes demandes »** lui dit **En attente**, **Acceptée** ou **Refusée**. Cinq motifs s'ajoutent à la liste : Congés, RTT, Récupération, École, Formation.
- **La direction** reçoit **seule** le mail, avec le PDF signé et **deux gros boutons, « ✅ Accepter » et « ❌ Refuser »**. Un clic ouvre une page qui rappelle la demande (qui, quand, quelle durée) ; elle appuie sur **Confirmer**. Deux clics en tout, sans compte ni mot de passe.
- **Le lien** ne sert qu'une fois et vaut **7 jours**. Ouvrir la page ne décide rien (les messageries ouvrent parfois les liens toutes seules) : seul « Confirmer » décide. Avec plusieurs adresses de direction, la première réponse compte.
- **Acceptée** : tu reçois un mail d'information — qui, quand, quelle durée, et l'appellation du planning. **Jamais le motif.** L'absence s'inscrit toute seule dans le planning : dans la nuit, et toujours juste avant une publication.
- **Refusée** : rien dans le planning, aucun mail pour toi. Le poseur le voit dans l'appli.
- **Le motif** n'est écrit que dans le mail de la direction et son PDF : ni dans le Sheet (« (réservé à la direction) »), ni dans Drive (le PDF n'est plus rangé dans ADMINISTRATIF/ABSENCES), ni dans ton mail, ni dans le planning. **Le mail envoyé à la direction est mis à la corbeille de Gmail** juste après l'envoi (ta décision du 20/11) : il ne reste pas lisible dans « Messages envoyés » du compte de Loué. Google vide cette corbeille au bout de 30 jours.
- Un poseur ne peut pas envoyer plus de **5 demandes par jour**.

**L'appellation dans le planning** : Congés (motif « Congés », ou heures imputées sur les congés payés), RTT, Récupération (motif « Récupération », ou heures imputées sur le repos compensateur), École, Formation ; **tout le reste — médical, accident, personnel, un motif tapé à la main — s'affiche « Absent »**. Un motif de santé donne toujours « Absent », même imputé sur les congés.

## Où sont les adresses de la direction

Dans le Sheet de l'appli, onglet ***Réglages***, ligne **« Adresses de la direction (demandes d'absence) »** (posée par l'installation du lot 14) :

| Colonne | Contenu |
|---|---|
| A | le nom de la ligne (ne pas le changer) |
| B | **1 à 3 adresses**, séparées par une virgule. C'est toi qui les écris |
| C | ce que l'appli a compris, écrit par elle dans les 10 minutes (« Allumé : 2 adresse(s) lue(s)… » ou « Éteint (la case est vide)… ») |

- **Vérifie bien chaque adresse** : une adresse mal tapée mais bien formée (« direction@loue.fr » au lieu de « .com ») fait partir le mail sans erreur, et personne ne s'en aperçoit avant « Sans réponse » au bout de 7 jours.
- **Case vide** (ou rien de lisible) : la demande d'absence **n'est pas bloquée**. Elle part comme aujourd'hui (aux personnes prévenues des absences, motif compris), et **tu reçois une alerte**, une fois par jour au plus.
- Plus de 3 adresses : les 3 premières servent, le reste est ignoré (la colonne C le dit).
- Le changement agit **tout de suite**, sans rien redéployer.

## Étape A — la copie TEST : avec le groupe A

L'envoi sur TEST et l'installation sont dans `docs/essais-groupes.md` (parties 1 et 2). **Pour les essais, l'installation de TEST met ton adresse** (celle qui reçoit déjà les alertes et les mails d'essai) dans la case « Adresses de la direction » : c'est toi qui joues la direction. Tu n'as rien à saisir dans l'éditeur Apps Script.

## Étape B — tes essais (dans la séance du groupe A)

Ce sont les points D, F et G de `docs/essais-groupes.md` : une demande d'un seul jour (motif « Médical »), une seconde (motif « École »), les deux boutons dans Outlook, la confirmation, le mail « Absence acceptée », le refus, « Mes demandes », et en plus :

- **Pour que la corbeille soit vraiment essayée**, la case doit contenir au moins une adresse **qui n'est pas celle du compte Google de Loué** (par exemple ton Outlook). Si l'installation de TEST te dit « ⚠ c'est l'adresse du compte lui-même », ajoute ton Outlook dans la case, après une virgule.
- **Réponds** au mail de la direction depuis Outlook (« Bien reçu ») : ta réponse arrive dans la boîte du compte de Loué ; elle ne doit **pas** partir à la corbeille.

- **« Messages envoyés » du compte de Loué** : le mail « [Loué App] Demande d'absence — … » **n'y est plus** ; il est dans la **corbeille** (dans les 10 minutes au plus). L'onglet *Absences suivi*, colonne « Copie dans Gmail », dit « à la corbeille le … ».
- **Case vide** : efface ton adresse de la case B, attends 10 minutes (la colonne C dit « Éteint »), fais une demande : elle part comme aujourd'hui, et tu reçois l'alerte « Demande d'absence partie comme avant ». Remets ton adresse.

**À savoir pour la copie TEST** : si ton adresse est celle du compte Google de Loué lui-même, le mail est aussi dans sa boîte de réception : il est alors **gardé** (le jeter le supprimerait aussi de ta boîte). La colonne « Copie dans Gmail » dit « gardé ».

## Étape C — l'inscription dans le planning (seulement si le lot 11.1 est installé sur la copie TEST)

1. Dans « Planning Loué TEST », onglet *SALARIÉS*, colonne D : le compte de l'appli du gars d'essai.
2. Colle la nouvelle version de `A-COLLER-PLANNING/2-Programme-de-publication.gs` dans le projet « Planning Loué — publication » de TEST. **Enregistre.**
3. Fais une demande d'absence **acceptée** pour un jour de la semaine en cours du planning TEST.
4. Si ce planning a été créé avant le 20/11 (par exemple le Sheet d'essai de l'étape 0 du lot 11), ajoute **RTT** et **Récupération** à la main dans la colonne I de l'onglet *LISTES* (la liste n'est remplie qu'à la création du planning).
5. Coche **Publier pour les gars** sur cette semaine. Dans les 10 minutes : la case du gars affiche « Congés » (ou « Absent », « RTT »…), le PDF publié la montre, et l'onglet ***ABSENCES*** du planning a une ligne « inscrite : 1 jour(s) ».

## Étape D — production : avec le groupe A — le lot reste ÉTEINT

Collage et déploiement : `docs/essais-groupes.md`, partie « Production ». Pour le lot 14, une fonction à lancer dans l'éditeur de production : **`installerLot14Production`** (journal : `✅ Lot 14 : installation terminée.`). Elle ajoute la ligne « Adresses de la direction » à l'onglet *Réglages*, **case vide**.

À partir de là, chaque jour où une demande d'absence arrive, tu reçois l'alerte « Demande d'absence partie comme avant » (une par jour au plus) : c'est normal tant que la case est vide.

## Étape E — allumer (toi : 5 minutes) — quand tu le décides

1. **Préviens la direction** : elle recevra désormais un mail avec deux boutons ; elle clique, puis confirme sur la page.
2. Sheet de production, onglet ***Réglages***, ligne « Adresses de la direction » : écris les adresses de la direction en colonne **B**, séparées par une virgule.
3. Dans les 10 minutes, la colonne C dit « Allumé : N adresse(s) lue(s) ». Tu peux aussi lancer `verifierConfig` : `✅ Absences … : allumé — N adresse(s) de la direction ; boutons du mail vers https://chantiersloue.github.io/chantier-pro/`.
4. **Préviens les gars** : plus de copie par mail ; la réponse se lit dans « Mes demandes ».

## Retour arrière (30 secondes)

**Efface la case B** de la ligne « Adresses de la direction ». Dès la demande suivante, tout redevient comme avant (mail aux personnes prévenues, copie au salarié, PDF rangé dans Drive), avec une alerte pour toi. **Pour ne plus recevoir l'alerte**, supprime toute la ligne (clic droit sur son numéro → Supprimer la ligne) : c'est alors exactement l'état d'avant le lot 14. Les demandes déjà envoyées gardent leur état, le poseur les voit toujours dans « Mes demandes », et **leurs liens marchent encore** : si la direction accepte l'une d'elles, tu reçois le mail et le planning l'inscrit.

## Comment vérifier que tout va bien

| Où | Ce que tu dois voir |
|---|---|
| Onglet *Réglages*, colonne C de la ligne « Adresses de la direction » | « Allumé : N adresse(s) lue(s) » ; « Éteint (…) » si la case est vide ou illisible |
| `verifierConfig` | la ligne `Absences (onglet Réglages, ligne « Adresses de la direction … ») : …` (les adresses ne sont jamais affichées) |
| Onglet *Absences suivi* | une ligne par demande : numéro, compte, demandeur, dates, durée, appellation, état ; « envoyé le … » pour ton mail et pour celui de la direction (**vide : il n'est pas encore parti**) ; « Copie dans Gmail » : « à la corbeille le … » |
| Onglet *Envois* | la demande « traité » ; « erreur — Demande gardée dans le téléphone… » si le mail à la direction n'a pas pu partir (elle repartira toute seule, et tu reçois une alerte) |
| Planning, onglet *ABSENCES* | « inscrite : N jour(s) », ou « ⚠ à inscrire à la main : … » |

## Ce qui n'a pas été vérifié

- **L'aspect du mail dans Outlook** : les boutons sont faits « en tableau », la façon qui marche dans Outlook, mais seul ton essai le dira. Si les boutons ne s'affichent pas, les deux liens sont aussi écrits en clair sous le mail.
- **La mise à la corbeille dans le vrai Gmail** : le mail part par un brouillon envoyé aussitôt, Gmail rend le message envoyé, et le programme jette exactement celui-là (aucune recherche : un mail reçu n'est jamais touché). Que Google ne demande aucune autorisation nouvelle (le serveur envoie déjà des mails avec le même service) est à voir sur la copie TEST.
- **Les indésirables** : un mail avec deux liens peut être filtré par la messagerie de la direction. À vérifier avec elle au premier vrai mail.
- **Les messageries qui ouvrent les liens toutes seules** : la page est faite pour (rien n'est décidé à l'ouverture), mais je n'ai pas pu l'essayer avec une vraie messagerie d'entreprise.
- **La façon dont le vrai Google Sheets range une date** : une demande d'un seul jour (« 14/12/2026 ») est écrite en texte pour ne pas devenir une date de tableur ; à confirmer à l'essai.
- **Relecture par un agent indépendant** : faite le 20/11/2026 sur la première version, un tour (rien de bloquant) ; les changements du 20/11 après tes réponses (adresses dans le Sheet, corbeille de Gmail) ont été relus à leur tour (un tour, rien de bloquant ; corrigés, voir D14-35 à D14-39).
