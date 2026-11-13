@echo off
chcp 65001 >nul
setlocal
rem Dépôt d'un PDF au carnet d'un chantier : pose les questions, puis lance outils\depot_carnet.py.
rem Le dossier racine du Drive de l'appli est lu dans _prive\depot.json (clé "racine").
cd /d "%~dp0.."
set /a VIDES=0

echo.
echo  DÉPÔT D'UN DOCUMENT AU CARNET D'UN CHANTIER
echo  -------------------------------------------
echo  Répondez à chaque question, puis appuyez sur Entrée.
echo.

:question_dossier
set /a VIDES+=1
if %VIDES% GTR 30 goto abandon
set "DOSSIER="
set /p "DOSSIER=1. Nom du dossier du chantier (tel qu'il est écrit dans le Drive) : "
if not defined DOSSIER goto question_dossier
set "DOSSIER=%DOSSIER:"=%"
if not defined DOSSIER goto question_dossier

:question_pdf
set /a VIDES+=1
if %VIDES% GTR 30 goto abandon
set "PDF="
set /p "PDF=2. Chemin du PDF (vous pouvez glisser le fichier dans cette fenêtre) : "
if not defined PDF goto question_pdf
set "PDF=%PDF:"=%"
if not defined PDF goto question_pdf
if not exist "%PDF%" (
  echo    Fichier introuvable. Recommencez.
  goto question_pdf
)

:question_code
set /a VIDES+=1
if %VIDES% GTR 30 goto abandon
set "CODE="
set /p "CODE=3. Code du document (001, 002, 103 à 109, 151, 152, 205, 206) : "
if not defined CODE goto question_code
set "CODE=%CODE:"=%"
if not defined CODE goto question_code

:question_indice
set /a VIDES+=1
if %VIDES% GTR 30 goto abandon
set "INDICE="
set /p "INDICE=4. Indice (A, B, C...) : "
if not defined INDICE goto question_indice
set "INDICE=%INDICE:"=%"
if not defined INDICE goto question_indice

:question_intitule
set /a VIDES+=1
if %VIDES% GTR 30 goto abandon
set "INTITULE="
set /p "INTITULE=5. Intitulé du document (exemple : PLANS DE RESERVATIONS) : "
if not defined INTITULE goto question_intitule
set "INTITULE=%INTITULE:"=%"
if not defined INTITULE goto question_intitule

echo.
set /a TOURS=0

:lancer
set /a TOURS+=1
python outils\depot_carnet.py --dossier "%DOSSIER%" --pdf "%PDF%" --code "%CODE%" --indice "%INDICE%" --intitule "%INTITULE%"
set "RESULTAT=%ERRORLEVEL%"
if "%RESULTAT%"=="3" if %TOURS% LSS 200 (
  echo    ... le travail continue ...
  goto lancer
)

echo.
if "%RESULTAT%"=="0" (
  echo  TERMINÉ : le document est déposé. Laissez Google Drive finir l'envoi avant d'éteindre le PC.
) else if "%RESULTAT%"=="2" (
  echo  REFUSÉ ou ARRÊTÉ : rien n'a été ajouté à la liste du carnet. Lisez le message ci-dessus.
) else if "%RESULTAT%"=="3" (
  echo  PAS FINI : relancez ce programme avec les mêmes réponses, le travail reprendra où il en est.
) else if "%RESULTAT%"=="9009" (
  echo  Python est introuvable sur ce PC : montrez ce message pour le faire installer.
) else (
  echo  ERREUR inattendue ^(code %RESULTAT%^) : copiez le texte ci-dessus pour le montrer.
)
echo.
pause
endlocal
exit /b

:abandon
echo.
echo  Trop de réponses vides : abandon. Rien n'a été écrit.
pause
endlocal
