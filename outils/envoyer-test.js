// ENVOI DU SERVEUR SUR LA COPIE TEST, avec clasp. C'est FRANCK qui lance cette commande, dans PowerShell :
//   node outils\envoyer-test.js --avec-porte     (serveur + outils d'essai : pendant les essais)
//   node outils\envoyer-test.js --sans-porte     (le fichier de production exact : avant le feu vert)
// Une page Google s'ouvre : choisir le compte de Loué, cliquer « Autoriser ». La commande fait tout le reste
// et finit par « ✅ Envoi réussi » ou « ❌ … ». Elle efface le jeton de Google à la fin, DANS TOUS LES CAS.
//
// Pourquoi Franck et pas Claude : le jeton de clasp ouvre tous les projets Apps Script du compte, production
// comprise. Lancé ainsi, il n'existe sur le PC que pendant ces 2 à 3 minutes, et jamais dans la séance de Claude.
//
// LE JETON : la commande demande à clasp de le ranger dans un dossier temporaire à elle (variable
// clasp_config_auth), supprimé à la fin. Par sécurité elle efface aussi l'emplacement habituel (~/.clasprc.json).
// Si la commande est interrompue (Ctrl+C, fenêtre fermée, étape trop longue), elle arrête clasp ET tout ce
// qu'il a lancé avant d'effacer : un clasp resté en route ne peut pas réécrire le jeton après coup.
//
// Ce que fait la commande, dans l'ordre (elle s'arrête au premier écart) :
//   1. contrôles sans réseau : dépôt sans modification en cours, adresse TEST différente de la production,
//      dossier clasp simple (un .clasp.json sans dossier détourné, pas de .claspignore) ;
//   2. au tout premier envoi : Franck colle l'identifiant du script de la copie TEST, lu dans l'éditeur du
//      Sheet TEST ; il doit être celui du dossier clasp. Ensuite il est mémorisé dans _prive/ ;
//   3. connexion Google (clasp login) ;
//   4. le projet relié contient-il bien le déploiement de la copie TEST, et PAS celui de la production ?
//   5. sauvegarde du serveur en ligne dans _prive/ ; contrôle du manifeste et des fichiers du dossier ;
//   6. assemblage du serveur en UN fichier, envoi, mise à jour du déploiement ;
//   7. vérification : l'adresse TEST doit répondre avec l'empreinte du fichier qui vient d'être envoyé ;
//   8. arrêt de clasp, effacement du jeton, compte rendu dans _prive/envois/ (sans aucun secret).
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawn, spawnSync } = require('child_process');
const construire = require('./construire.js');

const RACINE = path.join(__dirname, '..');
const FICHIERS_ATTENDUS = ['.clasp.json', 'appsscript.json', 'Code.js'];   // rien d'autre ne doit partir
const pause = ms => new Promise(r => setTimeout(r, ms));
const horodatage = d => {
  const z = n => String(n).padStart(2, '0');
  return d.getFullYear() + z(d.getMonth() + 1) + z(d.getDate()) + '-' + z(d.getHours()) + z(d.getMinutes()) + z(d.getSeconds());
};

// Les identifiants des déploiements sont publics : c'est la partie des adresses entre /s/ et /exec
function deploiementTest(racine) {
  const config = fs.readFileSync(path.join(racine || RACINE, 'commun', 'config.js'), 'utf8');
  const lire = nom => new RegExp("var " + nom + " = '(https:\\/\\/script\\.google\\.com\\/macros\\/s\\/([A-Za-z0-9_-]{20,})\\/exec)'").exec(config);
  const t = lire('URL_TEST'), p = lire('URL_PRODUCTION');
  if (!t) throw new Error('URL_TEST introuvable dans commun/config.js');
  if (!p) throw new Error('URL_PRODUCTION introuvable dans commun/config.js : impossible de vérifier que la copie TEST en est différente');
  if (t[2] === p[2]) throw new Error('Dans commun/config.js, URL_TEST est la même adresse que URL_PRODUCTION : REFUSÉ, rien n’est envoyé');
  return { url: t[1], id: t[2], idProduction: p[2] };
}
function git(racine) {
  return execFileSync('git', ['-C', racine].concat(Array.prototype.slice.call(arguments, 1)), { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}
// Le dossier clasp : un .clasp.json avec un identifiant, sans dossier détourné ; pas de .claspignore
function lireProjet(dossier) {
  const f = path.join(dossier, '.clasp.json');
  if (!fs.existsSync(f)) throw new Error('Dossier clasp introuvable ou pas relié (' + dossier + ') : refaire l’installation de docs/clasp.md');
  let p;
  try { p = JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { throw new Error('.clasp.json illisible'); }
  if (!p.scriptId || typeof p.scriptId !== 'string') throw new Error('.clasp.json sans identifiant de script');
  ['rootDir', 'srcDir'].forEach(k => {
    if (p[k] && p[k] !== '.' && p[k] !== './') throw new Error('.clasp.json désigne un autre dossier (' + k + ') : refusé, préviens Claude');
  });
  if (fs.existsSync(path.join(dossier, '.claspignore'))) throw new Error('Un fichier .claspignore est présent dans le dossier clasp : refusé, préviens Claude');
  return p.scriptId;
}
// Identifiants des déploiements dans la sortie de « clasp list-deployments » (une ligne « - <id> @<version> … » chacun)
function lireDeploiements(sortie) {
  return String(sortie).split(/\r?\n/).map(l => /^- (\S+) @/.exec(l.trim())).filter(Boolean).map(m => m[1]);
}

// Arrête un programme ET tout ce qu'il a lancé (sous Windows, clasp est lancé par cmd.exe : sans cela il survivrait)
function tuerArbre(pid) {
  if (!pid) return;
  try {
    if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
    else process.kill(pid, 'SIGKILL');
  } catch (e) {}
}

// Lance clasp dans le dossier clasp, avec une durée limite. interactif : la fenêtre de Franck voit la connexion Google.
function lancerClasp(etat, args, options) {
  options = options || {};
  const base = etat.claspCmd || (process.platform === 'win32' ? ['cmd.exe', '/d', '/s', '/c', 'clasp'] : ['clasp']);
  return new Promise((resoudre, rejeter) => {
    let sortie = '', fini = false;
    const enfant = spawn(base[0], base.slice(1).concat(args), {
      cwd: etat.dossierClasp, env: etat.env, windowsHide: true,
      stdio: options.interactif ? 'inherit' : ['ignore', 'pipe', 'pipe'],   // sans clavier : clasp ne pose aucune question
    });
    etat.enfant = enfant;
    const finir = (erreur) => {
      if (fini) return; fini = true; clearTimeout(minuteur); etat.enfant = null;
      if (erreur) rejeter(erreur); else resoudre(sortie);
    };
    const minuteur = setTimeout(() => {
      tuerArbre(enfant.pid);
      finir(new Error('clasp ' + args[0] + ' : trop long (plus de ' + Math.round((options.maxMs || 120000) / 1000) + ' s), arrêté'));
    }, options.maxMs || 120000);
    if (enfant.stdout) enfant.stdout.on('data', d => { sortie += d; });
    if (enfant.stderr) enfant.stderr.on('data', d => { sortie += d; });
    enfant.on('error', e => finir(new Error('clasp ' + args[0] + ' : ' + (e.code === 'ENOENT' ? 'clasp n’est pas installé (docs/clasp.md)' : e.message))));
    enfant.on('close', code => finir(code === 0 ? null
      : new Error('clasp ' + args[0] + ' a échoué' + (sortie.trim() ? ' : ' + sortie.trim().split(/\r?\n/).slice(-3).join(' / ') : ''))));
  });
}

// Vérifie en ligne que le déploiement TEST exécute bien le fichier envoyé (jusqu'à maxMs)
async function attendreEmpreinte(url, attendue, o) {
  o = o || {};
  const appeler = o.appeler || (async u => {
    const r = await fetch(u, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action: 'ping', v: 5 }),
      signal: AbortSignal.timeout(20000) });   // une connexion figée ne bloque pas la commande
    return r.json();
  });
  const fin = Date.now() + (o.maxMs || 90000);
  let vue = '';
  for (;;) {
    try { const rep = await appeler(url); vue = (rep && rep.data && rep.data.empreinte) || ''; if (vue === attendue) return { ok: true, vue: vue, version: rep.data.version }; }
    catch (e) { vue = 'pas de réponse (' + e.message + ')'; }
    if (Date.now() > fin) return { ok: false, vue: vue };
    await pause(o.pasMs || 5000);
  }
}
function demanderAuClavier(question) {
  return new Promise(r => {
    const rl = require('readline').createInterface({ input: process.stdin, output: process.stdout });
    let repondu = false;
    rl.question(question, rep => { repondu = true; rl.close(); r(rep); });
    rl.on('close', () => { if (!repondu) r(''); });   // Ctrl+C pendant la question : réponse vide, donc refus
  });
}

// o : { avecPorte (obligatoire), description } ; pour les tests seulement : racine, dossierClasp, dossierJeton, dossierPrive,
//     claspCmd, env, appeler, pasMs, maxMs, maxMsClasp, dire, demander, etatDepot, sansSignaux
async function envoyer(o) {
  if (typeof o.avecPorte !== 'boolean') throw new Error('Préciser --avec-porte ou --sans-porte');
  const racine = o.racine || RACINE;
  const prive = o.dossierPrive || path.join(racine, '_prive');
  const memoire = path.join(prive, 'script-test-id.txt');
  const jetonHabituel = path.join(o.dossierJeton || os.homedir(), '.clasprc.json');
  // Restes d'un envoi précédent interrompu brutalement : effacés avant tout
  const PREFIXE = 'loue-clasp-';
  try {
    fs.readdirSync(os.tmpdir()).filter(d => d.indexOf(PREFIXE) === 0 && !o.garderRestes)
      .forEach(d => { try { fs.rmSync(path.join(os.tmpdir(), d), { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); } catch (e) {} });
  } catch (e) {}
  const dossierTemp = fs.mkdtempSync(path.join(os.tmpdir(), PREFIXE));
  const jetonTemp = path.join(dossierTemp, 'jeton.json');
  const dire = o.dire || (t => console.log(t));
  const rapport = [];
  let secret = '';   // l'identifiant du script n'est jamais écrit dans un message
  const noter = t => { if (secret) t = t.split(secret).join('<identifiant du script>'); rapport.push(t); dire(t); };
  const debut = new Date();
  let connecte = false, envoiCommence = false, reussi = false, erreur = null, jetonEfface = [];

  // Environnement donné à clasp : aucun réglage clasp_config_* hérité, et le jeton rangé dans NOTRE dossier temporaire
  const env = Object.assign({}, process.env, o.env || {});
  Object.keys(env).filter(k => /^clasp_config_/i.test(k)).forEach(k => { delete env[k]; });
  env.clasp_config_auth = jetonTemp;
  const etat = { dossierClasp: o.dossierClasp || path.join(os.homedir(), 'clasp-loue', 'TEST'), claspCmd: o.claspCmd, env: env, enfant: null };
  const clasp = (args, options) => lancerClasp(etat, args, Object.assign({ maxMs: o.maxMsClasp }, options || {}));

  // Effacement du jeton : arrêt de clasp et de ses enfants, puis suppression des deux emplacements possibles
  // Rend la liste des fichiers de jeton qui n'ont PAS pu être supprimés (vide = tout est effacé).
  const effacerJeton = () => {
    if (etat.enfant) tuerArbre(etat.enfant.pid);
    [jetonTemp, jetonHabituel].forEach(f => {
      // d'abord vider le fichier : même s'il ne peut pas être supprimé (tenu par un antivirus), il ne contient plus rien
      try { if (fs.existsSync(f)) fs.writeFileSync(f, ''); } catch (e) {}
    });
    try { fs.rmSync(dossierTemp, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }); } catch (e) {}
    try { fs.rmSync(jetonHabituel, { force: true, maxRetries: 10, retryDelay: 200 }); } catch (e) {}
    return [jetonTemp, jetonHabituel].filter(f => { try { return fs.existsSync(f) && fs.statSync(f).size > 0; } catch (e) { return true; } });
  };
  const ecrireRapport = suffixe => {   // compte rendu : ni jeton, ni clé, ni identifiant de script
    try {
      const dossier = path.join(prive, 'envois'); fs.mkdirSync(dossier, { recursive: true });
      fs.writeFileSync(path.join(dossier, horodatage(debut) + suffixe + '.txt'), rapport.join('\n') + '\n');
    } catch (e) { dire('(compte rendu non écrit : ' + e.message + ')'); }
  };
  const direJeton = restes => restes.length
    ? '❌ LE JETON GOOGLE N’A PAS PU ÊTRE EFFACÉ : supprime à la main ' + restes.join(' et ') + ', puis préviens Claude.'
    : 'Jeton Google effacé du PC.';
  // Ctrl+C, fenêtre fermée : on arrête clasp, on efface, on écrit le compte rendu, PUIS on s'arrête
  const interruption = () => {
    const restes = effacerJeton();
    noter('❌ Commande interrompue.' + (envoiCommence ? ' L’envoi avait commencé : le serveur TEST est peut-être dans un état intermédiaire.' : ' Rien n’a été envoyé.'));
    noter(direJeton(restes));
    noter('Préviens Claude avant tout essai.');
    ecrireRapport('-INTERROMPU');
    process.exit(1);
  };
  const signaux = o.sansSignaux ? [] : ['SIGINT', 'SIGBREAK', 'SIGHUP', 'SIGTERM'];
  signaux.forEach(s => process.on(s, interruption));

  try {
    // ── 1. Contrôles sans réseau ──
    const cible = deploiementTest(racine);
    const depot = o.etatDepot ? o.etatDepot() : { propre: !git(racine, 'status', '--porcelain'), source: git(racine, 'rev-parse', '--abbrev-ref', 'HEAD') + ' ' + git(racine, 'rev-parse', '--short', 'HEAD') };
    if (!depot.propre) throw new Error('Des modifications ne sont pas enregistrées dans le dépôt : préviens Claude, rien n’a été envoyé');
    const serveur = construire.assembler(o.avecPorte);
    if (construire.contientPorte(serveur.code) !== o.avecPorte) throw new Error('Assemblage incohérent (porte de service) : rien n’a été envoyé');
    noter('Envoi sur la copie TEST — ' + debut.toLocaleString('fr-FR') + ' — source ' + depot.source
      + ' — serveur ' + (o.avecPorte ? 'AVEC outils d’essai' : 'SANS outils d’essai (fichier de production)') + ' — empreinte ' + serveur.empreinte);
    const scriptId = lireProjet(etat.dossierClasp);
    secret = scriptId;
    const memePojet = () => { if (lireProjet(etat.dossierClasp) !== scriptId) throw new Error('Le fichier .clasp.json a changé pendant l’envoi : arrêt, préviens Claude'); };
    if (fs.existsSync(jetonHabituel)) {
      // « clasp logout » laisse un fichier vide de tout jeton : on n'alerte que s'il en contient vraiment un
      let contenu = ''; try { contenu = fs.readFileSync(jetonHabituel, 'utf8'); } catch (e) {}
      const vraiJeton = /refresh_token|access_token/.test(contenu) || !/^\s*\{/.test(contenu);
      fs.rmSync(jetonHabituel, { force: true });
      if (vraiJeton) noter('⚠ Un jeton Google était resté sur le PC : il a été effacé avant de commencer.');
    }

    // ── 2. Premier envoi : l'identifiant vient de l'éditeur du Sheet TEST, collé par Franck ──
    let aMemoriser = false;
    if (fs.existsSync(memoire)) {
      if (fs.readFileSync(memoire, 'utf8').trim() !== scriptId) throw new Error('Le dossier clasp n’est PAS relié au projet de la copie TEST mémorisé : rien n’a été envoyé, préviens Claude');
    } else {
      noter('Premier envoi : il faut confirmer que le dossier clasp est bien relié à la copie TEST.');
      const colle = String(await (o.demander || demanderAuClavier)(
        'Ouvre le Sheet « ChantierPro TEST » → Extensions → Apps Script → ⚙ Paramètres du projet → « ID du script » → Copier.\nColle-le ici (clic droit), puis Entrée : ')).trim();
      if (colle !== scriptId) throw new Error('L’identifiant collé n’est pas celui du dossier clasp : le dossier n’est pas relié à la copie TEST (ou l’identifiant vient d’un autre Sheet). Rien n’a été envoyé, préviens Claude');
      aMemoriser = true;
    }

    // ── 3. Connexion Google ──
    noter('1/6 Connexion Google : une page s’ouvre, choisis le compte de Loué puis « Autoriser »…');
    connecte = true;   // à partir d'ici, un jeton peut exister : il sera effacé quoi qu'il arrive
    await clasp(['login'], { interactif: !o.claspCmd, maxMs: o.maxMsClasp || 5 * 60 * 1000 });

    // ── 4. Est-ce bien le projet de la copie TEST ? Il contient le déploiement TEST, et pas celui de la production ──
    const deploiements = lireDeploiements(await clasp(['list-deployments']));
    if (deploiements.indexOf(cible.idProduction) > -1) throw new Error('Le projet relié au dossier clasp contient le déploiement de PRODUCTION : REFUSÉ, rien n’a été envoyé. Préviens Claude');
    if (deploiements.indexOf(cible.id) < 0) throw new Error('Le projet relié au dossier clasp ne contient PAS le déploiement de la copie TEST : rien n’a été envoyé, préviens Claude');
    if (aMemoriser) { fs.mkdirSync(prive, { recursive: true }); fs.writeFileSync(memoire, scriptId + '\n'); noter('   (identifiant du projet TEST mémorisé dans _prive/script-test-id.txt)'); }
    noter('2/6 Projet vérifié : c’est bien celui de la copie TEST.');

    // ── 5. Sauvegarde du serveur en ligne, contrôle des fichiers et du manifeste ──
    await clasp(['pull']);
    const present = fs.readdirSync(etat.dossierClasp);
    const enTrop = present.filter(f => FICHIERS_ATTENDUS.indexOf(f) < 0), manquant = FICHIERS_ATTENDUS.filter(f => present.indexOf(f) < 0);
    if (enTrop.length || manquant.length) throw new Error('Le dossier clasp ne contient pas exactement appsscript.json et Code.js'
      + (enTrop.length ? ' (en trop : ' + enTrop.join(', ') + ')' : '') + (manquant.length ? ' (manquant : ' + manquant.join(', ') + ')' : '') + ' : rien n’a été envoyé, préviens Claude');
    const manifeste = JSON.parse(fs.readFileSync(path.join(etat.dossierClasp, 'appsscript.json'), 'utf8'));
    if (!manifeste.webapp || manifeste.webapp.access !== 'ANYONE_ANONYMOUS' || manifeste.webapp.executeAs !== 'USER_DEPLOYING') {
      throw new Error('Le manifeste du projet n’a pas le réglage attendu (webapp : ANYONE_ANONYMOUS, USER_DEPLOYING) : rien n’a été envoyé, préviens Claude');
    }
    const sauvegarde = 'Code-TEST-avant-' + horodatage(debut) + '.gs';
    fs.copyFileSync(path.join(etat.dossierClasp, 'Code.js'), path.join(prive, sauvegarde));
    noter('3/6 Serveur en ligne sauvegardé : _prive/' + sauvegarde);

    // ── 6. Envoi et mise à jour du déploiement ──
    memePojet();
    fs.writeFileSync(path.join(etat.dossierClasp, 'Code.js'), serveur.code);
    envoiCommence = true;
    const pousse = await clasp(['push']);   // jamais --force ; sans clavier, clasp refuse seul de toucher au manifeste
    if (/skipping push/i.test(pousse)) throw new Error('clasp a refusé d’envoyer (le manifeste aurait été modifié) : rien n’a été envoyé, préviens Claude');
    if (!/pushed|already up to date/i.test(pousse)) throw new Error('clasp push n’a pas confirmé l’envoi : préviens Claude');
    noter('4/6 Serveur envoyé.');
    memePojet();
    const description = String(o.description || ('Outillage ' + (o.avecPorte ? 'avec porte' : 'sans porte') + ' ' + serveur.empreinte)).replace(/[^A-Za-z0-9 ._-]/g, '').slice(0, 80);
    const redeploye = await clasp(['update-deployment', cible.id, '--description', description]);
    noter('5/6 Déploiement TEST mis à jour (même adresse).' + (/redeployed/i.test(redeploye) ? '' : ' (clasp ne l’a pas confirmé en toutes lettres : la vérification en ligne tranchera)'));

    // Le jeton ne sert plus : on l'efface AVANT la vérification en ligne (jusqu'à 90 s), pas après
    try { await clasp(['logout'], { maxMs: 30000 }); } catch (e) {}
    jetonEfface = effacerJeton();
    connecte = false;

    // ── 7. Vérification en ligne ──
    const v = await attendreEmpreinte(cible.url, serveur.empreinte, o);
    if (!v.ok) throw new Error('L’adresse TEST ne répond pas avec le nouveau serveur (attendu ' + serveur.empreinte + ', vu « ' + v.vue + ' ») : la mise à jour du déploiement n’a pas été prise. Préviens Claude');
    noter('6/6 Vérifié en ligne : l’adresse TEST exécute bien ce serveur (' + v.version + ', empreinte ' + v.vue + ').');
    reussi = true;
  } catch (e) {
    erreur = e;
    noter('❌ ' + e.message);
    if (envoiCommence) noter('⚠ L’envoi avait commencé : le serveur TEST est peut-être dans un état intermédiaire. La sauvegarde est dans _prive/. Préviens Claude avant tout essai.');
  } finally {
    // ── 8. Arrêt de clasp, effacement du jeton, dans tous les cas ──
    if (connecte) { try { await clasp(['logout'], { maxMs: 30000 }); } catch (e) {} }
    jetonEfface = effacerJeton();
    signaux.forEach(s => process.removeListener(s, interruption));
    noter(direJeton(jetonEfface));
    noter(reussi ? '✅ Envoi réussi. Dis à Claude : « envoi fait ».' : '❌ Envoi NON réussi. Copie ce texte et envoie-le à Claude.');
    ecrireRapport(reussi ? '-reussi' : '-ECHEC');
  }
  return { ok: reussi, erreur: erreur ? erreur.message : '', rapport: rapport, jetonRestant: jetonEfface.length > 0, restes: jetonEfface };
}

module.exports = { envoyer, deploiementTest, lireProjet, lireDeploiements, attendreEmpreinte, tuerArbre, FICHIERS_ATTENDUS };
if (require.main === module) {
  const args = process.argv.slice(2);
  const o = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--avec-porte') o.avecPorte = true;
    else if (args[i] === '--sans-porte') o.avecPorte = false;
    else if (args[i] === '--description') o.description = args[++i];
    else { console.error('❌ Option inconnue : ' + args[i]); process.exit(1); }
  }
  envoyer(o).then(r => process.exit(r.ok ? 0 : 1)).catch(e => { console.error('❌ ' + e.message); process.exit(1); });
}
