@echo off
title Synoza - Reset MySQL Root Password
color 0A
echo ============================================
echo   Synoza - Reset MySQL root password
echo   MUST RUN AS ADMINISTRATOR
echo ============================================
echo.
net session >nul 2>&1
if %errorLevel% neq 0 (
    color 0C
    echo [ERROR] Not running as Administrator!
    echo.
    echo Right-click this file and choose:
    echo   "Run as administrator"
    echo.
    pause
    exit /b 1
)
echo [OK] Running as Administrator
echo.
powershell -ExecutionPolicy Bypass -File "%~dp0reset-mysql-root.ps1"
echo.
pause
