@echo off
title POS System - Stopping
color 0C

echo ============================================
echo           POS SYSTEM - STOPPING
echo ============================================
echo.

:: Find and kill process on port 3000
set "found=0"
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000 ^| findstr LISTENING 2^>nul') do (
    echo Stopping POS process (PID: %%a)...
    taskkill /F /PID %%a >nul 2>nul
    set "found=1"
)

if "%found%"=="0" (
    echo [INFO] No POS process found running on port 3000.
) else (
    echo.
    echo [OK] POS System stopped successfully!
)

echo.
pause
