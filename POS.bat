@echo off
title POS System
color 0A

:: Change to script directory
cd /d "%~dp0"

:: Detect if we're in dist folder (has index.html) or root folder
if exist "index.html" (
    set "SERVE_DIR=."
    set "IS_DIST=1"
) else (
    set "SERVE_DIR=dist"
    set "IS_DIST=0"
)

:: Check if first time setup needed
if not exist "node_modules" (
    echo First time setup detected...
    echo.
    call install.bat
    if %ERRORLEVEL% NEQ 0 exit /b 1
)

:: Check if build exists (only if we're in root folder)
if "%IS_DIST%"=="0" (
    if not exist "dist" (
        echo Building application...
        call npm run build
        if %ERRORLEVEL% NEQ 0 (
            echo Build failed! Please run install.bat
            pause
            exit /b 1
        )
    )
)

:: Kill any existing process on port 3000
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000 ^| findstr LISTENING 2^>nul') do (
    taskkill /F /PID %%a >nul 2>nul
)

echo ============================================
echo            POS SYSTEM STARTING
echo ============================================
echo.
echo Opening browser in 3 seconds...
echo.

:: Open browser after delay
start "" cmd /c "timeout /t 3 /nobreak >nul && start http://localhost:3000"

echo POS is running at: http://localhost:3000
echo.
echo Keep this window open while using POS!
echo Close this window or press Ctrl+C to stop.
echo ============================================
echo.

:: Start server
call npx serve -s %SERVE_DIR% -l 3000
