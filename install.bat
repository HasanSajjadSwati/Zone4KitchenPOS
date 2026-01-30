@echo off
title POS System - Installation
color 0A

echo ============================================
echo         POS SYSTEM - INSTALLATION
echo ============================================
echo.

:: Change to script directory
cd /d "%~dp0"

:: Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js is not installed!
    echo.
    echo Please install Node.js from: https://nodejs.org/
    echo Download the LTS version and run the installer.
    echo After installation, run this script again.
    echo.
    pause
    exit /b 1
)

:: Show Node.js version
echo [OK] Node.js found:
node --version
echo.

:: Check npm
where npm >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] npm is not installed!
    pause
    exit /b 1
)

echo [OK] npm found:
call npm --version
echo.

:: Install dependencies
echo ============================================
echo Installing dependencies...
echo ============================================
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Failed to install dependencies!
    pause
    exit /b 1
)
echo.
echo [OK] Dependencies installed successfully!
echo.

:: Install serve for production server
echo ============================================
echo Installing production server...
echo ============================================
call npm install serve --save-dev
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Failed to install serve package!
    pause
    exit /b 1
)
echo.
echo [OK] Production server installed!
echo.

:: Check if we're in dist folder (production) or root folder (development)
if exist "index.html" (
    echo [OK] Production build detected - ready to run!
) else (
    echo ============================================
    echo Building for production...
    echo ============================================
    call npm run build
    if %ERRORLEVEL% NEQ 0 (
        echo [ERROR] Build failed!
        pause
        exit /b 1
    )
    echo.
    echo [OK] Production build completed!
)
echo.

echo ============================================
echo      INSTALLATION COMPLETED SUCCESSFULLY!
echo ============================================
echo.
echo You can now use:
echo   - POS.bat       : Start POS and open browser
echo   - start.bat     : Start the POS server
echo   - stop.bat      : Stop the POS server
echo   - restart.bat   : Restart the POS server
echo.
echo The POS will be available at: http://localhost:3000
echo.
echo Default login:
echo   Username: admin
echo   Password: admin123
echo.
pause
