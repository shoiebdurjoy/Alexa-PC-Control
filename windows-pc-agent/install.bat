@echo off
title Alexa PC Control Agent Installer
echo =======================================================
echo  Alexa PC Control Agent Windows Installer
echo =======================================================
echo.

set INSTALL_DIR=%APPDATA%\AlexaPCAgent
echo Installing to: %INSTALL_DIR%
if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"

echo.
echo [1/3] Copying files...
copy /Y "AlexaPCAgent.exe" "%INSTALL_DIR%\AlexaPCAgent.exe" >nul
copy /Y "AlexaPCAgent.vbs" "%INSTALL_DIR%\AlexaPCAgent.vbs" >nul

if not exist "%INSTALL_DIR%\appsettings.json" (
    echo [2/3] Creating appsettings.json from template...
    copy /Y "src\AlexaPCAgent\appsettings.json.example" "%INSTALL_DIR%\appsettings.json" >nul
) else (
    echo [2/3] appsettings.json already exists. Preserving configuration.
)

echo.
echo [3/3] Setting up Windows Auto-Start...
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v "AlexaPCAgent" /d "wscript.exe \"%INSTALL_DIR%\AlexaPCAgent.vbs\"" /f >nul

echo.
echo Starting the Alexa PC Control Agent silently...
start "" wscript.exe "%INSTALL_DIR%\AlexaPCAgent.vbs"

echo.
echo =======================================================
echo  Installation Completed Successfully!
echo =======================================================
echo.
echo Next steps:
echo 1. Open and configure your production token in:
echo    %INSTALL_DIR%\appsettings.json
echo.
pause
