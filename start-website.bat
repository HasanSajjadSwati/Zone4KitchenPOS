@echo off
REM Zone 4 Kitchen Website - Start Script

echo.
echo ============================================
echo   Zone 4 Kitchen Website - Starting...
echo ============================================
echo.

cd /d "%~dp0website"

REM Check if node_modules exists
if not exist "node_modules" (
    echo Installing website dependencies...
    call npm install
)

echo.
echo Starting Website Server on http://localhost:3000...
call npm run dev
