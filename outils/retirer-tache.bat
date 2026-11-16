@echo off
chcp 65001 >nul
setlocal
rem Arrête la recopie automatique des fiches de l'appli (lot 4c) : supprime les tâches planifiées de Windows.
rem Aucun fichier n'est touché.
cd /d "%~dp0.."

echo.
echo  CHANTIERPRO - RECOPIE AUTOMATIQUE DES FICHES : ARRÊT
echo  ----------------------------------------------------
echo.

python outils\appli_pc.py --retirer-tache
set "RESULTAT=%ERRORLEVEL%"

echo.
if "%RESULTAT%"=="0" (
  echo  TERMINÉ. Pour la remettre en place : double-clic sur outils\installer-tache.bat
) else if "%RESULTAT%"=="9009" (
  echo  Python est introuvable sur ce PC : montrez ce message pour le faire installer.
) else (
  echo  ERREUR ^(code %RESULTAT%^) : copiez le texte ci-dessus pour le montrer.
)
echo.
pause
endlocal
