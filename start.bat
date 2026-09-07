@echo off
title Hamsayaa Launcher
color 0A

:: Get the directory where this script lives (works for any collaborator)
set PROJECT_DIR=%~dp0

echo.
echo  ============================================
echo    HAMSAYAA - AI Society Management Platform
echo  ============================================
echo.
echo  Project Directory: %PROJECT_DIR%
echo  Starting all services...
echo.

:: 1. Start FastAPI Backend (new window)
echo  [1/3] Starting FastAPI Backend on port 8000...
start "Hamsayaa Backend" cmd /k "cd /d %PROJECT_DIR%backend && python app/main.py"
ping 127.0.0.1 -n 3 >nul

:: 2. Start React Frontend (new window)
echo  [2/3] Starting React Frontend Dashboard...
start "Hamsayaa Frontend" cmd /k "cd /d %PROJECT_DIR%frontend && npm run dev"
ping 127.0.0.1 -n 2 >nul

:: 3. Start ngrok tunnel (new window)
echo  [3/3] Starting ngrok tunnel...
start "Hamsayaa ngrok" cmd /k "ngrok http 8000"
ping 127.0.0.1 -n 3 >nul

echo.
echo  ============================================
echo   ALL SERVICES LAUNCHED SUCCESSFULLY!
echo  ============================================
echo.
echo   Backend:   http://localhost:8000
echo   Frontend:  http://localhost:3000
echo   ngrok:     Check the ngrok window for URL
echo.
echo   REMINDER: Update your Meta WhatsApp Webhook
echo   URL with the new ngrok address!
echo.
echo   Press any key to close this launcher window.
echo   (The services will keep running.)
echo  ============================================
pause >nul
