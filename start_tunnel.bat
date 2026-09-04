@echo off
title Hamsayaa Tunnel Manager
color 0B

echo.
echo  ======================================================
echo    HAMSAYAA - PUBLIC TUNNEL LAUNCHER FOR WHATSAPP
echo  ======================================================
echo.
echo  Choose your tunneling provider:
echo.
echo  [1] Cloudflare Tunnel (RECOMMENDED - Unblocked in Pakistan, Zero Signup)
echo  [2] ngrok Tunnel (Requires ngrok authtoken / VPN if on restricted network)
echo.
set /p choice="Enter option (1 or 2, default is 1): "

if "%choice%"=="2" (
    echo.
    echo  Starting ngrok on port 8000...
    ngrok http 8000
) else (
    echo.
    echo  Starting Cloudflare Tunnel on port 8000...
    if exist "%~dp0bin\cloudflared.exe" (
        "%~dp0bin\cloudflared.exe" tunnel --url http://localhost:8000
    ) else (
        echo Cloudflared binary not found in bin\. Falling back to ngrok...
        ngrok http 8000
    )
)
