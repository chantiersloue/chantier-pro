# Lot 5 — « Un seul mail par fiche » : note avant de coder

> Pour Franck. Tu as validé le 16/11/2026 l'idée d'envoyer **un seul mail par fiche** aux adresses connues du Sheet (au lieu d'un mail par adresse), avec une règle : **ne rien changer au chemin des adresses tapées à la main** (protection du lot 0).
> **Je n'ai pas codé ce changement dans le lot 5.** Cette note dit pourquoi, compare deux solutions, et donne ma recommandation. La ligne « Mails envoyés de plus de 3 mois », elle, est construite.

## Pourquoi je me suis arrêté avant de coder

1. **C'est le chemin de toutes les fiches.** L'envoi des mails (`distribuer_`, `envoyer_`, `differer_`, `renvoyerMailsEnAttente`) sert à chaque fiche de chaque poseur. Une erreur ici, c'est une fiche qui n'arrive pas, ou qui arrive deux fois.
2. **Une question n'est pas tranchée, et elle se voit dans chaque mail** : qui est le destinataire « visible » (le champ « À ») quand tous les autres sont en copie cachée ? Voir le tableau plus bas.
3. **Ce que fait le vrai Gmail ne se devine pas** : un mail sans destinataire « À », avec seulement des copies cachées, part-il ? Comment Gmail compte-t-il le quota d'un mail à 6 copies cachées quand il en reste 4 ? Le faux serveur des tests ne peut pas répondre : il faut un essai sur la copie TEST.
4. **Quatre séries de tests sont à réécrire** (lot 0, lot 1, lot 2, lot 7) : aujourd'hui elles vérifient « un mail par destinataire ». Les réécrire sans les affaiblir demande un plan relu, pas une fin de lot.

Ta règle sur les adresses tapées à la main est déjà protégée : un nouveau test (`tests/lot0.test.js`, « photographie du chemin des adresses tapées à la main ») fixe leurs mails, leurs objets, leur texte imposé, leurs plafonds (2 par fiche, 10 par jour) et la copie cachée au conducteur. Il devra passer **sans être modifié** le jour où le mail unique sera codé.

## Ce qu'il faut changer

| Où | Aujourd'hui | Avec le mail unique |
|---|---|---|
| `distribuer_` (Securite.gs) | une boucle : un `envoyer_` par adresse connue | un seul envoi pour toutes les adresses connues ; la boucle des adresses tapées à la main **ne bouge pas** |
| `envoyer_` | sert aux deux chemins | reste tel quel pour les adresses tapées à la main ; **une nouvelle fonction** pour l'envoi groupé (on ne modifie pas la fonction protégée) |
| Quota (100 destinataires par jour, 20 réservés pour toi) | compté mail par mail : les premiers partent, les suivants sont reportés | compté pour tout le groupe : soit tout part, soit il faut couper le groupe en deux (ce qui part aujourd'hui, ce qui est reporté) |
| Onglet « Mails en attente » | une ligne par adresse | une ligne par mail, avec toutes ses adresses dans « Copie cachée ». Le renvoi sait déjà lire cette colonne. **Les lignes déjà en attente, écrites par l'ancien serveur, restent valables** (une adresse, pas de copie cachée) : rien à migrer |
| Compte rendu au téléphone (« envoyés », « reportés ») | une adresse par mail | il faut noter **chaque** adresse du groupe, sinon le poseur verrait « envoyé à 1 personne » au lieu de 6 |
| Gmail, « Messages envoyés » | 6 copies du PDF pour 6 destinataires | 1 copie |

## Le destinataire visible : deux solutions

| | Solution A — « À » = toi (l'adresse d'administration) | Solution B — « À » = le conducteur du chantier |
|---|---|---|
| Ce que voient les autres | ton adresse seulement | l'adresse du conducteur seulement |
| Toi | tu reçois **toutes** les fiches (aujourd'hui : seulement celles où tu es destinataire) | rien de changé |
| Quota | +1 destinataire par fiche quand tu n'étais pas dans la liste | inchangé (le conducteur reçoit déjà sa copie) |
| Chantier sans conducteur, absence, signalement | marche toujours | il faut un repli (toi) |
| Simplicité | la plus simple, une seule règle | une règle et un repli |
| Risque | ta boîte se remplit | une adresse interne (le conducteur) visible des externes : c'est déjà le cas aujourd'hui quand il signe ses mails |

Écartée : aucun destinataire visible (copies cachées seulement). Gmail l'accepte peut-être, mais des messageries classent ces mails en indésirables, et je ne peux pas le vérifier ici.

## Ma recommandation

1. **Solution B** (le conducteur du chantier en « À », toi en repli), dans **un petit lot à part** (« lot 5b »), avec son plan relu par un agent indépendant et un essai sur la copie TEST avant la production.
2. Garder **un mail par adresse** quand le quota du jour est presque atteint (comportement d'aujourd'hui) : c'est le cas le plus délicat, et il est rare.
3. En attendant, **la ligne « Mails envoyés de plus de 3 mois »** de l'onglet *Purges* (construite dans ce lot) traite déjà le fond du problème : les copies gardées par Gmail.

Ce que le mail unique rapporterait : avec 3 destinataires en moyenne par fiche, la place prise chaque année dans Gmail serait divisée par trois environ.

## Ce que je te demande

- Ton choix entre A et B.
- Ton accord pour le faire dans un lot à part, après les essais du lot 5.
