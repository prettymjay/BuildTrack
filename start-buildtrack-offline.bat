@echo off
setlocal

set "ROOT=%~dp0"

if not exist "%ROOT%dist\index.html" (
  echo Offline build not found.
  echo Run "npm run build" first, then try again.
  echo.
  pause
  exit /b 1
)

if not exist "%ROOT%server\.env" (
  echo Missing server\.env configuration file.
  echo Create it first, or copy server\.env.example to server\.env.
  echo.
  pause
  exit /b 1
)

echo Starting BuildTrack offline app...
start "BuildTrack Offline App" cmd /k "cd /d "%ROOT%" && node server\index.js"

echo Waiting for server startup...
timeout /t 3 /nobreak >nul

start "" http://127.0.0.1:4000

echo.
echo Opened BuildTrack at http://127.0.0.1:4000
echo Keep the server window open while using the app.
echo Login with:
echo Username: admin
echo Password: BuildTrack@2026!
echo.
pause
