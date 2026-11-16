@echo off
chcp 65001 >nul
setlocal
rem Met en place la recopie automatique des fiches de l'appli (lot 4c) : une tâche du Planificateur de tâches
rem de Windows, toutes les heures et à l'ouverture de session. Sans droits d'administrateur. Relançable.
cd /d "%~dp0.."

echo.
echo  CHANTIERPRO - RECOPIE AUTOMATIQUE DES FICHES : MISE EN PLACE
echo  ------------------------------------------------------------
echo  Windows lancera tout seul, toutes les heures, la recopie des nouvelles fiches de l'appli
echo  vers vos dossiers de chantier. Rien n'est jamais supprimé ni écrasé.
echo.

python outils\appli_pc.py --installer-tache
set "RESULTAT=%ERRORLEVEL%"

echo.
if "%RESULTAT%"=="0" (
  echo  TERMINÉ : la recopie automatique est en place. Vous n'avez plus rien à faire.
  echo  Pour l'arrêter un jour : double-clic sur outils\retirer-tache.bat
) else if "%RESULTAT%"=="2" (
  echo  REFUSÉ : rien n'a été créé. Lisez le message ci-dessus ^(le fichier _prive\depot.json est-il rempli ?^).
) else if "%RESULTAT%"=="9009" (
  echo  Python est introuvable sur ce PC : montrez ce message pour le faire installer.
) else (
  echo  PAS INSTALLÉ ^(code %RESULTAT%^) : copiez le texte ci-dessus pour le montrer.
)
echo.
pause
endlocal
