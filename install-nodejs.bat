@echo off
REM ============================================================
REM Node.js Installer for Windows using Chocolatey
REM Must be run as Administrator
REM ============================================================
REM Right-click this file and select "Run as Administrator"
REM ============================================================

setlocal EnableDelayedExpansion

echo.
echo ================================================================
echo           Node.js Installer for Windows
echo           Node.js v24.13.0 with npm v11.6.2
echo ================================================================
echo.

REM Check for Administrator privileges
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [ERROR] This script must be run as Administrator!
    echo.
    echo Right-click this file and select "Run as Administrator"
    echo.
    pause
    exit /b 1
)

echo [OK] Running with Administrator privileges
echo.

REM Check if Chocolatey is already installed
echo [STEP 1] Checking for Chocolatey installation...
where choco >nul 2>&1
if %errorLevel% equ 0 (
    for /f "tokens=*" %%i in ('choco --version') do set CHOCO_VER=%%i
    echo [OK] Chocolatey v!CHOCO_VER! is already installed
) else (
    echo [INFO] Chocolatey not found. Installing...
    echo [INFO] This may take a minute...
    
    REM Install Chocolatey
    powershell -NoProfile -ExecutionPolicy Bypass -Command "iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))"
    
    if %errorLevel% neq 0 (
        echo [ERROR] Failed to install Chocolatey
        pause
        exit /b 1
    )
    
    echo [OK] Chocolatey installed successfully!
    
    REM Refresh environment
    call refreshenv
)

echo.
echo [STEP 2] Installing Node.js v24.13.0...
echo [INFO] This may take a few minutes...
echo.

REM Install Node.js
call choco install nodejs --version=24.13.0 -y --force

if %errorLevel% neq 0 (
    echo [ERROR] Failed to install Node.js
    pause
    exit /b 1
)

echo.
echo [OK] Node.js installation completed!
echo.

REM Refresh environment variables
call refreshenv

echo [STEP 3] Verifying installation...
echo.

REM Verify Node.js
for /f "tokens=*" %%i in ('node -v 2^>nul') do set NODE_VER=%%i
if defined NODE_VER (
    echo [OK] Node.js version: !NODE_VER!
) else (
    echo [WARNING] Could not verify Node.js. Restart terminal and run: node -v
)

REM Verify npm
for /f "tokens=*" %%i in ('npm -v 2^>nul') do set NPM_VER=%%i
if defined NPM_VER (
    echo [OK] npm version: !NPM_VER!
) else (
    echo [WARNING] Could not verify npm. Restart terminal and run: npm -v
)

echo.
echo ================================================================
echo                    Installation Complete!
echo ================================================================
echo.
echo Please restart your terminal to use Node.js and npm.
echo Then verify with: node -v ^&^& npm -v
echo.
pause
