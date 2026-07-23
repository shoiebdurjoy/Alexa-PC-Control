@echo off
title Alexa PC Control Agent Uninstaller
echo =======================================================
echo  Alexa PC Control Agent Windows Uninstaller
echo =======================================================
echo.

echo [1/3] Terminating active agent processes...
taskkill /F /IM AlexaPCAgent.exe >nul 2>&1

echo [2/3] Removing Registry auto-start key...
reg delete "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v "AlexaPCAgent" /f >nul 2>&1

set INSTALL_DIR=%APPDATA%\AlexaPCAgent
if exist "%INSTALL_DIR%" (
    echo [3/3] Deleting files from %INSTALL_DIR%...
    rmdir /S /Q "%INSTALL_DIR%" >nul 2>&1
)

echo.
echo =======================================================
echo  Uninstallation Completed Successfully!
echo =======================================================
echo.
pause
