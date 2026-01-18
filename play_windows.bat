@echo off
TITLE Sandbox Launcher Client
ECHO ==========================================
ECHO      Sandbox Launcher - Client Setup
ECHO ==========================================
ECHO.

:: Check for Node.js
node -v >nul 2>&1
IF %ERRORLEVEL% NEQ 0 (
    ECHO [WARNING] Node.js is not installed!
    
    :: Check for Winget
    winget -v >nul 2>&1
    IF %ERRORLEVEL% EQU 0 (
        ECHO [INFO] Attempting to install Node.js automatically via Winget...
        winget install -e --id OpenJS.NodeJS.LTS --silent --accept-source-agreements --accept-package-agreements
        
        IF %ERRORLEVEL% EQU 0 (
            ECHO.
            ECHO [SUCCESS] Node.js has been installed!
            ECHO [IMPORTANT] Please CLOSE this window and run play_windows.bat again to finish setup.
            PAUSE
            EXIT /B
        ) ELSE (
            ECHO [ERROR] Automatic installation failed.
        )
    ) ELSE (
        ECHO [ERROR] Winget is not available on this system.
    )
    
    ECHO Please install Node.js manually from https://nodejs.org/
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
ECHO.
ECHO Examples:
ECHO   - Cloudflare: https://abc-xyz-123.trycloudflare.com
ECHO   - Localtunnel: https://cool-panda.loca.lt
ECHO.
ECHO NOTE: For localtunnel, if asked for a 'Tunnel Password',
ECHO use the IP address printed in the host's terminal.
ECHO.
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
