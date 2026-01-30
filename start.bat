@echo off
title POS System - Running
color 0A

echo ============================================
echo           POS SYSTEM - STARTING
echo ============================================
echo.

:: Change to script directory
cd /d "%~dp0"

:: Detect if we're in dist folder (has index.html) or root folder
if exist "index.html" (
    set "SERVE_DIR=."
) else (
    set "SERVE_DIR=dist"
)

:: Check if production build exists
if "%SERVE_DIR%"=="dist" (
    if not exist "dist" (
        echo [ERROR] Production build not found!
        echo Please run install.bat first.
        echo.
        pause
        exit /b 1
    )
)

:: Check if node_modules exists
if not exist "node_modules" (
    echo [ERROR] Dependencies not installed!
    echo Please run install.bat first.
    echo.
    pause
    exit /b 1
)

:: Kill any existing process on port 3000
echo Checking for existing POS process...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000 ^| findstr LISTENING') do (
    echo Stopping existing process on port 3000...
    taskkill /F /PID %%a >nul 2>nul
)

echo.
echo ============================================
echo Starting POS System on port 3000...
echo ============================================
echo.
echo POS is now running at: http://localhost:3000
echo.
echo Press Ctrl+C to stop the server
echo Or run stop.bat from another window
echo ============================================
echo.

:: Start serve
call npx serve -s %SERVE_DIR% -l 3000
