@echo off
title Hamsayaa - Stop All Services
color 0C

echo.
echo  ============================================
echo    HAMSAYAA - Stopping All Services
echo  ============================================
echo.

:: Kill Python (backend)
taskkill /F /IM python.exe /T >nul 2>&1
echo  [1/3] Backend server stopped.

:: Kill Node (frontend)
taskkill /F /IM node.exe /T >nul 2>&1
echo  [2/3] Frontend server stopped.

:: Kill ngrok
taskkill /F /IM ngrok.exe /T >nul 2>&1
echo  [3/3] ngrok tunnel stopped.

echo.
echo  ============================================
echo   ALL SERVICES STOPPED.
echo  ============================================
echo.
ping 127.0.0.1 -n 3 >nul
