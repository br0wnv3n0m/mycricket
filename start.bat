@echo off
title MyCricket Dev Server
cd /d "%~dp0"

echo ============================================
echo   MyCricket - starting dev server...
echo   Open http://localhost:3000 in your browser
echo   Press Ctrl+C to stop
echo ============================================
echo.

start "" http://localhost:3000
npm run dev

pause