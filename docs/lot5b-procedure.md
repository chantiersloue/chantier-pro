# Lot 5b — Un seul mail par fiche : procédure de déploiement et d'essai

> Pour Franck. Le plan et ses raisons sont dans `docs/lot5-mail-unique.md` (version 2).
> Cette livraison se compose du **serveur v11.6** (le programme chez Google) et des **pages, appli 10.7** (deux textes changés).
> **État au 19/11/2026 : construit et testé contre le faux Google seulement** (un faux Google qui tourne sur mon ordinateur), **remis à jour sur le lot 8 en production, relu par un agent indépendant (un tour, rien de bloquant) et corrigé**. Rien n'a touché la copie TEST ni la production. Aucun mail n'est parti.
> **Il passe en dernier, après le groupe B en production** (ta décision du 20/11 : groupe A, groupe B, puis mail unique). La branche `lot-5b` (dossier `chantier-pro-lot5b`) contient les deux groupes : serveur **v11.6**, appli **10.7**.
> **Le mail unique est livré ÉTEINT.** Tant que tu n'as pas ajouté le réglage `MAIL_UNIQUE`, le serveur envoie les mails exactement comme aujourd'hui.
> **Ne passe à l'étape suivante que si la précédente est verte.** Sinon : arrête-toi et envoie-moi une capture.

## Ce qui change, en clair

- **Aujourd'hui** : une fiche envoyée à 4 personnes de tes listes = 4 mails, donc 4 fois le PDF gardé dans « Messages envoyés » de Gmail.
- **Avec le mail unique** : 1 seul mail, les 4 personnes en **copie cachée** (« Cci » : chacun reçoit le mail, personne ne voit l'adresse des autres). Le PDF n'est gardé qu'une fois.
- **Les demandes d'absence ne sont jamais groupées** : un mail par personne, comme aujourd'hui (fiche personnelle, et son envoi sera refait avec le lot 14).
- **Ce qui ne change pas** : les adresses **tapées à la main** gardent leur mail séparé, au texte imposé, 2 par fiche, 10 par jour, avec le conducteur en copie cachée. Tes alertes, la réserve de 20 destinataires par jour pour toi, l'onglet *Mails en attente* : pareil qu'avant.
- **Le quota ne change pas** : Google compte les destinataires, pas les mails. 4 copies cachées = 4.
- **Deux textes changent dans l'appli** (ils parlaient de « mails », ils parlent de « destinataires », ce qui est vrai avant comme après) :
  - note de réunion, sous la liste : « 3 destinataires (2 choisis + le conducteur du chantier). » ;
  - fin d'envoi : « ✓ Compte rendu du 06/11/2026 envoyé — 3 destinataires », « ✓ Fiche « Quitus » envoyée — Fiche enregistrée. Envoyé à 3 destinataire(s). ».

**Le réglage `MAIL_UNIQUE`** est une « propriété du script » : une ligne dans la petite liste de réglages du serveur, que tu changes sans toucher au code et **sans refaire de déploiement**. Trois valeurs :

| Valeur | Effet |
|---|---|
| `non` (ou pas de réglage du tout, ou une valeur mal tapée) | comme aujourd'hui : un mail par adresse |
| `cache` | un seul mail, « À » vide, tout le monde en copie cachée |
| `conducteur` | un seul mail, « À » = le conducteur du chantier (son adresse est alors **visible** des autres), les autres en copie cachée. **C'est la solution de secours** si `cache` échoue aux essais E1 ou E2 (tu l'as validée le 18/11) ; elle demande l'essai **E3 bis** avant d'être allumée |

Dans tous les cas, le serveur revient tout seul à « un mail par adresse » pour une fiche quand le mail groupé n'est pas possible : une demande d'absence, une seule adresse, plus de 40 adresses, quota du jour trop bas, ou refus de Google.

## Avant de commencer (2 minutes) : est-ce que ça vaut le coup ?

Ouvre le Sheet de production, onglet ***Stockage***, et lis la ligne de **Gmail**. Si Gmail ne pèse presque rien (quelques dizaines de Mo), ce lot peut attendre : dis-le-moi. Rappel : la ligne « Mails envoyés de plus de 3 mois » de l'onglet *Purges* limite déjà la place des mails de fiches ; le mail unique ne fait gagner que sur les 3 derniers mois.

## Avant tout envoi : le bon dossier, la bonne branche

- Le lot 5b est sur la branche `lot-5b` (une branche = une version du code tenue à part), qui **contient déjà les groupes A et B**. Il se met en service **après le groupe B en production**, pas avant.
- **C'est moi qui prépare ton dossier principal sur cette branche avant de te demander l'envoi**, et je te le confirme par écrit (« dossier prêt, branche lot-5b, serveur v11.6 »). Si je ne te l'ai pas confirmé, n'envoie rien.
- La copie TEST ne porte qu'un lot à la fois : cet envoi remplace le serveur du lot précédent.

## Étape A — envoi sur la copie TEST (toi : 2 minutes)

1. Ouvre PowerShell **dans ton dossier principal de l'appli**, comme pour les lots précédents, et lance :
   ```
   node outils\envoyer-test.js --avec-porte
   ```
   Page Google → compte de Loué → **Autoriser**. Attends `✅ Envoi réussi`. La version affichée doit être **v11.6**. Dis-moi « envoi fait », avec l'empreinte affichée.
2. Dans l'éditeur Apps Script **de la copie TEST** : choisis la fonction `verifierConfig` dans la liste en haut, clique **Exécuter**, ouvre le **Journal d'exécution**. Tu dois lire la ligne :
   `✅ Mail unique (propriété MAIL_UNIQUE) : non — un mail par adresse connue, comme avant le lot 5b`

## Étape B — les essais sur la copie TEST (toi : 30 minutes) — **avec TES adresses seulement**

Ces essais disent ce que mon faux Google ne peut pas dire. Aucun mail ne doit partir vers quelqu'un d'autre que toi. Il te faut **deux adresses à toi** : ton adresse Outlook du bureau, et une adresse Gmail personnelle (ou une autre boîte à toi). Compte une dizaine de destinataires pris sur le quota du jour (100).

### Où sont les « Propriétés du script »

Éditeur Apps Script (de la copie TEST pour les essais) → roue dentée **Paramètres du projet** (colonne de gauche) → tout en bas, **Propriétés du script** → **Modifier les propriétés du script** → **Ajouter une propriété du script** → remplis « Propriété » et « Valeur » → **Enregistrer les propriétés du script**.

### E1 et E4 — Google accepte-t-il un mail sans « À » ? Compte-t-il bien les copies cachées ?

1. Ajoute la propriété `ESSAI_MAIL_UNIQUE`, valeur : tes deux adresses séparées par une virgule (exemple : `moi@bureau.fr, moi@gmail.com`).
2. Dans l'éditeur, choisis la fonction `essaiMailUnique`, **Exécuter**, puis ouvre le **Journal d'exécution**. Cette fonction envoie **un seul mail**, sans « À », avec tes adresses en copie cachée, par la commande même qu'utilise le serveur (`GmailApp.sendEmail`). Elle refuse de tourner ailleurs que sur la copie TEST.
3. Lis le résultat :
   - `E1 : ✅` → Google accepte un mail sans « À ». On continue.
   - `E1 : ❌` → Google le refuse. **On s'arrête là** : laisse `MAIL_UNIQUE` à `non`, envoie-moi la ligne.
   - `Essai non lancé : il ne reste que N destinataire(s)…` → ce n'est pas un refus : trop de mails sont déjà partis aujourd'hui. Refais l'essai demain.
   - `E4 : ✅ … 2 destinataire(s)` → Google a bien compté 2. Si la ligne dit `⚠`, envoie-la-moi (le compteur de Google a parfois du retard).

### E2 — le mail arrive-t-il bien ?

Regarde tes deux boîtes. Note pour chacune : **boîte de réception ou indésirables (spam) ?** Et ce qui est écrit dans « À » (souvent « destinataires non divulgués » ou rien). S'il est dans les indésirables d'une des deux boîtes : **on s'arrête**, dis-le-moi.

### E5 — une adresse fausse dans le groupe

1. Change la valeur de `ESSAI_MAIL_UNIQUE` : ajoute une troisième adresse volontairement fausse (exemple : `moi@bureau.fr, moi@gmail.com, personne@adresse-qui-nexiste-pas.invalid`).
2. Relance `essaiMailUnique`. Note : `E1 : ✅` ou `❌` ? Tes deux vraies boîtes ont-elles reçu le mail ? Un message « Échec de la remise » est-il arrivé dans la boîte Gmail du compte de Loué ?
3. Remets la valeur avec tes deux vraies adresses.

### E3 — une vraie fiche en mode `cache`, vue dans « Messages envoyés »

1. **Vérifie d'abord les onglets *Contacts* et *Contacts notes* du Sheet « ChantierPro TEST »** : il ne doit y avoir **que tes adresses**. Si tu y vois l'adresse de quelqu'un d'autre, arrête-toi et dis-le-moi.
2. Ajoute la propriété `MAIL_UNIQUE`, valeur `cache`. Relance `verifierConfig` : `✅ Mail unique (propriété MAIL_UNIQUE) : cache — …`.
3. Sur ton téléphone, avec la copie d'essai (icône « Loué ESSAI ») : envoie un **quitus** du chantier **« CHANTIER TEST AUTO »** (ce chantier-là : c'est le seul que mon contrôle du point 7 sait lire) avec deux destinataires de la liste. Message attendu : « … Envoyé à 3 destinataire(s). » (ou 2 si le conducteur du chantier d'essai est l'un des deux).
4. Ouvre Gmail avec le compte de Loué → **Messages envoyés** : **un seul** mail pour ce quitus, avec le PDF. Ouvre-le, clique sur la petite flèche sous l'objet : la ligne **Cci** doit montrer toutes les adresses. Envoie-moi une capture.
5. Dans la même fiche, essaie aussi une adresse **tapée à la main** (une autre adresse à toi) : elle doit recevoir **son propre mail**, au texte « Veuillez trouver ci-joint le document… », avec le conducteur en copie cachée — comme avant.
6. Supprime le mail d'essai `[Loué App] Essai du mail unique` de « Messages envoyés » (l'appli ne le supprimera jamais toute seule).
7. **Mon contrôle de la purge (moi, 1 minute)** : dis-moi « quitus envoyé ». Je demande au serveur de la copie TEST de relire ce mail **comme le fera la purge des mails de plus de 3 mois** (geste `lireMailsEssai` : il ne me rend que des nombres, aucune adresse). Il doit retrouver les adresses en copie cachée. S'il n'en retrouve aucune, les mails groupés ne seraient **jamais** purgés : on reste à `non` et je corrige d'abord.

### E3 bis — seulement si on doit passer au mode `conducteur`

À faire **uniquement** si je te dis que `cache` ne convient pas (E1 refusé, ou mail classé en indésirable à l'essai E2).

1. Dans le Sheet « ChantierPro TEST », onglet *Chantiers* : le conducteur de « CHANTIER TEST AUTO » doit être une personne dont l'adresse est **à toi**.
2. Propriété `MAIL_UNIQUE`, valeur `conducteur`. Relance `verifierConfig` : `✅ … : conducteur — …`.
3. Envoie un **quitus** de « CHANTIER TEST AUTO » avec deux destinataires de la liste.
4. Dans « Messages envoyés » : **un seul** mail, « À » = l'adresse du conducteur, les autres en **Cci**.
5. Dans la boîte d'un destinataire en copie cachée (une autre adresse à toi) : il voit l'adresse du conducteur en « À », et **aucune autre**. Boîte de réception ou indésirables ?
6. Dis-moi « quitus envoyé » : je refais le contrôle de la purge (point 7 de E3).

À savoir : même en `conducteur`, le « À » reste **vide** quand le conducteur du chantier n'est pas destinataire de la fiche, ou quand le chantier n'a pas de conducteur connu. Les essais E1 et E2 restent donc obligatoires.

Dis-moi « essais faits », avec tes notes. **Je te réponds « on peut allumer » ou « on reste à non ».**

## Étape C — production (toi : 20 minutes) — le réglage reste à `non`

1. Je te confirme que le fichier `A-COLLER-DANS-APPS-SCRIPT/Code.gs` de la branche `lot-5b` est prêt, avec son empreinte. Il doit contenir `VERSION_API = 'v11.6'`.
2. Éditeur Apps Script **de production** : ouvre `Code.gs`, sélectionne tout (Ctrl+A), colle le nouveau fichier (Ctrl+V), enregistre (Ctrl+S).
3. Exécute `verifierConfig`. Tout doit être ✅, dont `Mail unique (propriété MAIL_UNIQUE) : non`.
4. **Déployer → Nouveau déploiement** (type « Application Web », exécuter en tant que « Moi », accès « Tout le monde »), description `Lot 5b`. Copie l'adresse qui finit par `/exec` et **donne-la-moi** : je l'écris dans `commun/config.js` et je publie les pages (appli 10.7).
5. Envoie une fiche réelle habituelle : elle doit partir **comme avant** (un mail par adresse). Seul le texte de fin a changé (« Envoyé à N destinataire(s) »).

## Étape D — allumer le mail unique (toi : 5 minutes) — seulement après mon « on peut allumer »

1. Éditeur Apps Script **de production** → **Paramètres du projet** → **Propriétés du script** → **Modifier** → **Ajouter une propriété du script** : Propriété `MAIL_UNIQUE`, Valeur **celle que je t'aurai donnée après les essais** (`cache`, sauf si les essais ont montré qu'il faut `conducteur`) → **Enregistrer**.
2. Exécute `verifierConfig` : `✅ Mail unique (propriété MAIL_UNIQUE) : cache — un seul mail par fiche pour les adresses connues, « À » vide, tout le monde en copie cachée` (ou `conducteur — …`).
3. À la prochaine fiche envoyée à plusieurs personnes : un seul mail dans « Messages envoyés ». Demande à un destinataire s'il l'a bien reçu en boîte de réception.
4. Pendant une semaine, jette un œil à l'onglet ***Journal*** : une ligne au statut **« repli »** veut dire que Google a refusé un mail groupé et que la fiche est partie par un mail par adresse (personne n'a rien perdu). S'il y en a, dis-le-moi.

## Retour arrière (30 secondes)

**Propriétés du script** → `MAIL_UNIQUE` → remets la valeur `non` (ou supprime la ligne) → **Enregistrer**. Effet immédiat, dès la fiche suivante : pas de collage, pas de déploiement, rien à faire sur les téléphones. Les mails déjà partis ne sont pas touchés.

## Comment vérifier que tout va bien

| Où | Ce que tu dois voir |
|---|---|
| `verifierConfig` | la ligne `Mail unique (propriété MAIL_UNIQUE) : …` avec la valeur attendue ; `❌` si la valeur est mal tapée (elle est alors lue comme `non`) |
| Gmail du compte de Loué, « Messages envoyés » | en mode `cache` : un mail par fiche (plus un mail par adresse tapée à la main) |
| Onglet *Envois*, colonne « Détail » | « envoyé à N destinataire(s) » |
| Onglet *Journal* | pas de ligne « repli » en temps normal |
| Onglet *Mails en attente* | comme avant : une ligne par adresse reportée |
