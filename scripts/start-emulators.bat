@echo off
echo Starting Firebase Emulators for AI Fitness App...
echo.

REM Check if Firebase CLI is installed
where firebase >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo Firebase CLI is not installed!
    echo Please install it using: npm install -g firebase-tools
    exit /b 1
)

REM Check if we're in the right directory
if not exist firebase.json (
    echo firebase.json not found!
    echo Please run this script from the project root directory.
    exit /b 1
)

echo Starting emulators...
echo - Firestore on port 8080
echo - Auth on port 9099
echo - Functions on port 5001
echo - Storage on port 9199
echo - Emulator UI on port 4000
echo.

REM Start emulators
firebase emulators:start --import=./emulator-data --export-on-exit

echo.
echo Emulators stopped.
pause