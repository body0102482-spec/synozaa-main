@echo off
title Synoza - Use XAMPP MySQL (no password)
color 0E
echo ============================================
echo   Alternative: Use XAMPP MySQL instead
echo   MUST RUN AS ADMINISTRATOR
echo ============================================
echo.
net session >nul 2>&1
if %errorLevel% neq 0 (
    color 0C
    echo [ERROR] Run as Administrator!
    pause
    exit /b 1
)
echo Stopping MySQL90 service...
net stop MySQL90
echo.
echo Done. Now:
echo   1. Open XAMPP Control Panel
echo   2. Click START on MySQL
echo   3. Open http://localhost/phpmyadmin
echo   4. Login: root / (empty password)
echo.
pause
