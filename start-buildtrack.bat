@echo off
setlocal

set "ROOT=%~dp0"

echo Starting BuildTrack offline server...
start "BuildTrack Offline Server" cmd /k "cd /d "%ROOT%server" && npm start"

echo Starting BuildTrack frontend...
start "BuildTrack Frontend" cmd /k "cd /d "%ROOT%" && npm run dev"

echo.
echo BuildTrack is launching in two windows:
echo 1. Offline Server
echo 2. Frontend
echo.
echo When the frontend shows a localhost URL, open it in your browser.
echo Login with:
echo Username: admin
echo Password: 1234
echo.
pause
