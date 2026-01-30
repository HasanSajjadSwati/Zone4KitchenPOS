@echo off
title POS System - Rebuilding
color 0E

echo ============================================
echo          POS SYSTEM - REBUILDING
echo ============================================
echo.

:: Change to script directory
cd /d "%~dp0"

:: Check if we're in dist folder - can't rebuild from there
if exist "index.html" (
    echo [ERROR] Cannot rebuild from production folder!
    echo Please rebuild from the source folder.
    echo.
    pause
    exit /b 1
)

:: Check if node_modules exists
if not exist "node_modules" (
    echo [ERROR] Dependencies not installed!
    echo Please run install.bat first.
    echo.
    pause
    exit /b 1
)

:: Stop any running server
echo Stopping any running POS server...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000 ^| findstr LISTENING 2^>nul') do (
    taskkill /F /PID %%a >nul 2>nul
)

:: Rebuild
echo.
echo Building for production...
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Build failed!
    pause
    exit /b 1
)

echo.
echo ============================================
echo       REBUILD COMPLETED SUCCESSFULLY!
echo ============================================
echo.
echo The dist folder is ready to deploy.
echo Run start.bat or POS.bat to start the server.
echo.
pause
