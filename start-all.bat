@echo off
REM POS System - Start Backend and Frontend

echo.
echo ============================================
echo   POS System - Starting Backend & Frontend
echo ============================================
echo.

REM Check if backend directory exists
if not exist "backend" (
    echo ERROR: Backend directory not found!
    echo Please ensure you are in the POS root directory.
    pause
    exit /b 1
)

REM Check if node_modules exists in backend
if not exist "backend\node_modules" (
    echo Installing backend dependencies...
    cd backend
    call npm install
    cd ..
)

REM Check if node_modules exists in frontend
if not exist "node_modules" (
    echo Installing frontend dependencies...
    call npm install
)

echo.
echo Starting Backend Server...
echo Opening new window for backend...
start "POS Backend" cmd /k "cd backend && npm run dev"

REM Wait a moment for backend to start
timeout /t 3 /nobreak

echo.
echo Starting Frontend Server...
echo Opening new window for frontend...
start "POS Frontend" cmd /k "npm run dev"

REM Wait for frontend to fully start
timeout /t 7 /nobreak

echo.
echo Opening browser to http://localhost:5173...
start http://localhost:5173

echo.
echo ============================================
echo   ✓ Both servers are starting
echo ============================================
echo.
echo Backend:  http://localhost:3001
echo Frontend: http://localhost:5173
echo.
echo Press any key to close this window...
pause
