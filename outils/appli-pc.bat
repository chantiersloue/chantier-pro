@echo off
chcp 65001 >nul
setlocal
rem Programme du PC (lot 4c) : dépôt au carnet depuis les bordereaux, recopie des fiches de l'appli
rem vers les dossiers de chantier du PC. Les réglages sont lus dans _prive\depot.json.
cd /d "%~dp0.."
set /a VIDES=0

:menu
echo.
echo  CHANTIERPRO - PROGRAMME DU PC
echo  -----------------------------
echo   1. Tout traiter : le carnet, puis la recopie des fiches de l'appli
echo   2. Voir seulement (rien n'est écrit)
echo   3. Lire ce qui demande mon attention (« A VOIR »)
echo   4. Associer les chantiers (quand le numéro du dossier ne suffit pas)
echo   5. Retirer un document du carnet
echo   6. Quitter
echo.
set "CHOIX="
set /p "CHOIX=Votre choix (1 à 6), puis Entrée : "
if not defined CHOIX goto vide
set "CHOIX=%CHOIX:"=%"
if not defined CHOIX goto vide
set "OPTION=?"
if "%CHOIX%"=="1" set "OPTION="
if "%CHOIX%"=="2" set "OPTION=--lister"
if "%CHOIX%"=="3" set "OPTION=--a-voir"
if "%CHOIX%"=="4" set "OPTION=--associer"
if "%CHOIX%"=="5" set "OPTION=--retirer"
if "%CHOIX%"=="6" goto fin
if "%OPTION%"=="?" (
  echo    Choix non compris : tapez un chiffre de 1 à 6.
  goto vide
)

echo.
python outils\appli_pc.py %OPTION%
set "RESULTAT=%ERRORLEVEL%"

echo.
if "%RESULTAT%"=="0" (
  if "%CHOIX%"=="1" (
    echo  TERMINÉ. Laissez Google Drive finir ses envois avant d'éteindre le PC.
  ) else (
    echo  TERMINÉ.
  )
) else if "%RESULTAT%"=="2" (
  echo  REFUSÉ : rien n'a été écrit. Lisez le message ci-dessus.
) else if "%RESULTAT%"=="1" (
  echo  FINI AVEC UN DÉFAUT : lisez les lignes marquées « ! » ou « PAS » ci-dessus. Rien n'a été supprimé ; vous pouvez relancer.
) else if "%RESULTAT%"=="9009" (
  echo  Python est introuvable sur ce PC : montrez ce message pour le faire installer.
) else (
  echo  ERREUR inattendue ^(code %RESULTAT%^) : copiez le texte ci-dessus pour le montrer.
)
echo.
pause
endlocal
exit /b

:vide
set /a VIDES+=1
if %VIDES% GTR 30 goto fin
goto menu

:fin
endlocal
