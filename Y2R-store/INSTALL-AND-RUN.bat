@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Install Node.js 18+ first.
  pause
  exit /b 1
)
if not exist .env (
  echo Create your private administrator key for this local demo.
  set /p ADMIN_KEY=Enter an admin key (at least 20 characters recommended):
  if "%ADMIN_KEY%"=="" set ADMIN_KEY=local-demo-admin-key-change-this
  echo PORT=3000>.env
  echo ADMIN_KEY=%ADMIN_KEY%>>.env
)
echo Installing dependencies...
call npm ci
if errorlevel 1 (
  echo Dependency installation failed. Check your internet connection and npm.
  pause
  exit /b 1
)
start "Y2R Store" http://localhost:3000
call npm start
pause
