@echo off
REM Zone 4 Kitchen - Start Everything (POS + Website)

echo.
echo ============================================
echo   Zone 4 Kitchen - Full System Startup
echo ============================================
echo.
echo This will start:
echo   - POS Backend (Port 3001)
echo   - POS Frontend (Port 5173)
echo   - Customer Website (Port 3000)
echo.

REM Check directories
if not exist "backend" (
    echo ERROR: Backend directory not found!
    pause
    exit /b 1
)

if not exist "website" (
    echo ERROR: Website directory not found!
    pause
    exit /b 1
)

REM Install dependencies if needed
echo Checking dependencies...

if not exist "backend\node_modules" (
    echo Installing backend dependencies...
    cd backend
    call npm install
    cd ..
)

if not exist "node_modules" (
    echo Installing POS frontend dependencies...
    call npm install
)

if not exist "website\node_modules" (
    echo Installing website dependencies...
    cd website
    call npm install
    cd ..
)

echo.
echo ============================================
echo   Starting All Services...
echo ============================================
echo.

REM Start Backend
echo Starting POS Backend...
start "POS Backend" cmd /k "cd backend && npm run dev"
timeout /t 3 /nobreak >nul

REM Start POS Frontend
echo Starting POS Frontend...
start "POS Frontend" cmd /k "npm run dev"
timeout /t 2 /nobreak >nul

REM Start Website
echo Starting Customer Website...
start "Zone 4 Kitchen Website" cmd /k "cd website && npm run dev"
timeout /t 5 /nobreak >nul

echo.
echo ============================================
echo   All Services Starting
echo ============================================
echo.
echo POS Backend:       http://localhost:3001
echo POS Frontend:      http://localhost:5173
echo Customer Website:  http://localhost:3000
echo Admin Panel:       http://localhost:3000/admin
echo.
echo Opening POS in browser...
start http://localhost:5173
echo.
echo Press any key to close this window...
pause
