@echo off
TITLE Sandbox Launcher Client
ECHO ==========================================
ECHO      Sandbox Launcher - Client Setup
ECHO ==========================================
ECHO.

:: Check for Node.js
node -v >nul 2>&1
IF %ERRORLEVEL% NEQ 0 (
    ECHO [ERROR] Node.js is not installed!
    ECHO Please install it from https://nodejs.org/
    PAUSE
    EXIT /B
)

:: Install deps if needed
IF NOT EXIST "node_modules" (
    ECHO [INFO] Installing dependencies...
    call npm install
)

:: Prompt for Server URL
ECHO.
ECHO ==========================================
ECHO Enter the Game Server URL 
ECHO Example: https://cool-panda.loca.lt
ECHO NOTE: If asked for a 'Tunnel Password', use the IP 
ECHO printed in the host's terminal.
ECHO (Leave empty to play on localhost)
ECHO ==========================================
ECHO.
SET /P SERVER_URL="Server URL: "

IF "%SERVER_URL%"=="" (
    ECHO [INFO] Starting Client in LOCAL mode...
    call npm run client
) ELSE (
    ECHO [INFO] Connecting to %SERVER_URL%...
    set VITE_SERVER_URL=%SERVER_URL%
    call npm run client
)
PAUSE
