# Lot 14 — La demande d'absence reliée au planning — PLAN

> Plan du 19/11/2026, sur ta demande du même jour (« plan, puis construction complète contre le faux serveur, y compris l'inscription dans le planning du lot 11 ; rien d'installé chez Google »). **Construit le 19/11/2026**, en autonomie : procédure `docs/lot14-procedure.md`, décisions D14-… dans `DECISIONS.md`.
> Branche `lot-14`, partie de `lot-11` (qui contient les lots 8, 8d, 12, 13 et 11.1). Tous les exemples sont inventés.

## 1. Ta demande, mot pour mot

Le poseur remplit et envoie sa demande d'absence comme aujourd'hui. Le mail part **uniquement à la direction**, avec deux gros boutons « ✅ Accepter » et « ❌ Refuser ». Un clic ouvre une page de confirmation qui rappelle la demande (qui, quelles dates), puis on confirme : deux clics en tout. Lien unique, à usage unique, qui expire au bout de quelques jours, sans connexion à l'appli. Il doit marcher dans Outlook.
**Acceptée** : un mail part au conducteur de travaux pour information, et l'absence s'inscrit toute seule dans le planning avec la vraie appellation (Congés, École, Formation…), sauf maladie et accident, qui s'affichent « Absent ». **Refusée** : rien dans le planning, pas de mail au conducteur. Le poseur voit l'état de sa demande dans l'appli (En attente / Acceptée / Refusée), pas de mail en retour. **Le motif n'est visible que par la direction.**

## 2. Ce que ça change, en clair

| Qui | Aujourd'hui | Avec le lot 14 |
|---|---|---|
| Le poseur | remplit, signe, envoie ; reçoit une copie s'il a donné son adresse | pareil, **sans copie par mail** ; en haut de la page, **« Mes demandes »** : En attente, Acceptée, Refusée |
| La direction | reçoit le PDF, comme les autres personnes prévenues | reçoit **seule** le mail, avec le PDF et **deux boutons** ; clique, confirme sur une page : c'est fait |
| Toi (conducteur) | reçois toutes les demandes, motif compris | reçois **un mail seulement si la demande est acceptée** : qui, quand, quelle durée, et l'appellation du planning. **Jamais le motif** |
| Le planning | tu recopies l'absence à la main | elle s'y écrit toute seule (dans la nuit, et toujours avant une publication) |

**Le lot est livré ÉTEINT.** Tant que le réglage `ABSENCE_DIRECTION` (les adresses de la direction, dans les Propriétés du script) n'existe pas, le serveur traite les absences **exactement comme aujourd'hui**. L'allumer ne demande ni collage ni déploiement ; l'éteindre non plus.

## 3. Les choix techniques (deux solutions comparées à chaque fois)

**3.1 Qui est « la direction »**

| Solution | Pour | Contre |
|---|---|---|
| **A. Un réglage `ABSENCE_DIRECTION`** dans les Propriétés du script : 1 à 3 adresses (retenue) | hors du Sheet et hors du dépôt public ; sert aussi d'interrupteur ; impossible de s'y retrouver par erreur | à saisir dans l'éditeur Apps Script |
| B. La colonne « absenceNotif » de l'onglet Contacts, comme aujourd'hui | rien à saisir | tu y es toi-même coché aujourd'hui : un oubli, et tu recevrais les boutons et le motif |

**3.2 Où mènent les boutons du mail**

| Solution | Pour | Contre |
|---|---|---|
| **A. Une page de l'appli, `absence-reponse.html`** (retenue) | un lien ordinaire, qui marche dans Outlook ; la page prend l'adresse du serveur au même endroit que le reste de l'appli : **le lien d'un vieux mail marche encore après un nouveau déploiement** ; même présentation que l'appli, lisible sur téléphone | une page de plus |
| B. Une page fabriquée par le serveur Google lui-même | pas de page à écrire | bandeau gris de Google « application créée par un autre utilisateur » ; l'adresse change à chaque déploiement : les liens des mails déjà partis cassent dès que l'ancien déploiement est archivé |

**Pourquoi deux clics** : les messageries d'entreprise (Outlook compris) ouvrent parfois toutes seules les liens d'un mail pour les contrôler. Ouvrir la page **ne décide rien** : seule la pression sur « Confirmer » décide.

**3.3 Le lien unique**

| Solution | Pour | Contre |
|---|---|---|
| **A. Un lien signé par le serveur** (numéro de la demande + date limite + signature faite avec la clé secrète du serveur ; retenue) | rien de secret n'est écrit dans le Sheet : lire le Sheet ne permet pas de fabriquer un lien ; la date limite est dans la signature | — |
| B. Un code tiré au hasard, rangé dans le Sheet | simple | quiconque lit le Sheet peut répondre à la place de la direction |

- **Usage unique** : dès qu'une réponse est enregistrée, le lien ne fait plus rien d'autre que redire la réponse donnée.
- **Expire au bout de 7 jours.** Passé ce délai, la demande s'affiche « Sans réponse » chez le poseur (il la refait, ou voit avec le bureau).
- Avec plusieurs adresses de direction : chacune reçoit le mail ; **la première réponse compte**.

**3.4 Comment l'absence arrive dans le planning**

| Solution | Pour | Contre |
|---|---|---|
| **A. Le programme de publication du planning vient LIRE les absences acceptées dans le Sheet de l'appli** (retenue) | les deux règles du lot 11 tiennent : l'appli n'écrit jamais dans le planning, le planning n'écrit jamais dans l'appli ; aucune adresse ni mot de passe à échanger | l'inscription n'est pas immédiate : dans la nuit, et toujours juste avant une publication |
| B. Le serveur de l'appli écrit dans le planning | immédiat | casse la règle « l'appli ne fait que lire le planning » (et son test) ; une erreur de l'appli pourrait abîmer le planning |

- Le gars est retrouvé par son **compte de l'appli** (colonne « Compte de l'appli » de l'onglet *SALARIÉS* du planning), jamais par son nom (« Kévin L. » dans le planning, un autre libellé dans la demande).
- Journée entière : la case devient l'appellation (ce qui y était écrit est noté dans le journal des absences du planning). Matin ou après-midi : « ½ Congés » est ajouté dans la case, avec le chantier de l'autre demi-journée.
- Une semaine pas encore créée : l'absence attend, et s'inscrit dès que l'onglet existe.
- Un onglet *ABSENCES* du planning tient le journal : ce qui a été inscrit, et **ce qui n'a pas pu l'être** (gars sans compte, dates illisibles) : à inscrire à la main.
- Une semaine déjà publiée où une absence vient s'inscrire affiche « ⚠ Modifié depuis la publication » : tu recoches « Publier ».

**3.5 L'appellation dans le planning et dans le mail au conducteur**

| Ce que le poseur a choisi | Appellation |
|---|---|
| motif « Congés », ou heures imputées sur « Congés payés » | **Congés** |
| motif « École » | **École** |
| motif « Formation » | **Formation** |
| tout le reste (médical, maladie, accident, personnel, sépulture, naissance, un motif tapé à la main…) | **Absent** |

Dans le doute, c'est « Absent » : aucun mot de santé ni de vie privée ne sort de la demande. Trois motifs sont ajoutés à la liste de la page : **Congés, École, Formation**.

## 4. Données personnelles : où est le motif

| Endroit | Aujourd'hui | Avec le lot 14 |
|---|---|---|
| Mail à la direction (et son PDF) | motif | motif (c'est le seul endroit) |
| Onglet *Absences* du Sheet | motif et précisions | **« (réservé à la direction) »** |
| Nouvel onglet *Absences suivi* (états, lu par le planning) | — | **aucun motif** : qui, quand, durée, appellation, état |
| Dossier Drive ADMINISTRATIF/ABSENCES | le PDF | **plus de PDF rangé** (il part dans le mail de la direction) |
| Mail au conducteur, planning, écran du poseur, page de confirmation | — | **aucun motif** |
| Onglet *Mails en attente* | le texte du mail s'il est reporté | **jamais** : si le mail ne peut pas partir, la demande reste dans le téléphone du poseur et repart toute seule |

Ce que l'appli ne peut pas empêcher : la boîte « Messages envoyés » du compte Google de Loué garde le mail (c'est la preuve de la demande) ; qui ouvre ce compte peut le lire.

## 5. Risques et parades

| Risque | Parade |
|---|---|
| Quelqu'un d'autre que la direction répond | lien signé, impossible à fabriquer ; envoyé aux seules adresses du réglage |
| Une messagerie « clique » le lien toute seule | ouvrir la page ne décide rien ; il faut confirmer |
| Double réponse (deux directeurs, double clic) | sous verrou : la première compte, la seconde lit la réponse déjà donnée |
| Le mail à la direction ne part pas (quota, panne) | la demande n'est pas marquée « reçue » : le téléphone la garde et la renvoie ; aucun doublon (même numéro) |
| Le mail au conducteur ne part pas | noté « à envoyer », renvoyé au passage suivant (toutes les 10 minutes) |
| Un gars sans compte dans le planning | journal *ABSENCES* : « à inscrire à la main » |
| L'absence écrase un chantier dans le planning | ce qui était écrit est gardé dans le journal *ABSENCES* |
| Une demande sans compte (pendant la transition) | elle marche, mais le poseur ne verra pas son état (rien ne le relie à un compte) |
| Retour arrière | supprimer le réglage `ABSENCE_DIRECTION` : tout redevient comme avant, dès la demande suivante |

## 6. Les endroits touchés

| Où | Quoi |
|---|---|
| `apps-script/Absences.gs` (nouveau) | le mode « direction », le lien signé, les réponses, l'état pour le poseur, le mail au conducteur |
| `apps-script/Documents.gs`, `Api.gs`, `Comptes.gs`, `Config.gs` | l'aiguillage (éteint = comme avant), trois actions nouvelles, le passage de 10 minutes |
| `absence.html`, `absence-reponse.html` (nouvelle), `sw.js` | « Mes demandes » ; la page de confirmation de la direction |
| `planning/Regles.gs`, `planning/Publication.gs` | inscrire une absence dans une case ; lire les absences acceptées |
| `tests/` | `lot14-absences.test.js` (serveur), `lot14-planning.test.js` (planning), `lot14-page.test.js` (vrai Chrome) |

Numéros : serveur **v11.4**, appli **10.5** (à réattribuer à la mise en production).

## 7. Ce qu'il te restera à décider

1. Les **adresses de la direction** (1 à 3).
2. Le **délai du lien** : 7 jours te va-t-il ?
3. Ne plus ranger le PDF dans ADMINISTRATIF/ABSENCES : d'accord ? (C'est ce qui tient le motif hors de ton Drive.)
4. Les trois motifs ajoutés (Congés, École, Formation) et le tableau des appellations (3.5).
