#Requires -RunAsAdministrator
<#
.SYNOPSIS
    Node.js Installer for Windows using Chocolatey
.DESCRIPTION
    This script installs Chocolatey package manager and Node.js v24.13.0
    Must be run as Administrator
.NOTES
    Run this script in PowerShell with Administrator privileges:
    Right-click PowerShell -> "Run as Administrator" -> Navigate to script location
    Then run: .\install-nodejs.ps1
#>

# Configuration
$NodeVersion = "24.13.0"
$ExpectedNpmVersion = "11.6.2"

# Colors for output
function Write-Step { param($Message) Write-Host "`n▶ $Message" -ForegroundColor Cyan }
function Write-Success { param($Message) Write-Host "✓ $Message" -ForegroundColor Green }
function Write-Error { param($Message) Write-Host "✗ $Message" -ForegroundColor Red }
function Write-Info { param($Message) Write-Host "  $Message" -ForegroundColor Gray }

# Header
Write-Host "`n" -NoNewline
Write-Host "╔══════════════════════════════════════════════════════════════╗" -ForegroundColor Magenta
Write-Host "║           Node.js Installer for Windows                      ║" -ForegroundColor Magenta
Write-Host "║           Node.js v$NodeVersion with npm v$ExpectedNpmVersion                  ║" -ForegroundColor Magenta
Write-Host "╚══════════════════════════════════════════════════════════════╝" -ForegroundColor Magenta

# Check if running as Administrator
$currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
$isAdmin = $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Error "This script must be run as Administrator!"
    Write-Info "Right-click PowerShell and select 'Run as Administrator'"
    Write-Host "`nPress any key to exit..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}

Write-Success "Running with Administrator privileges"

# Step 1: Check if Chocolatey is already installed
Write-Step "Checking for Chocolatey installation..."

$chocoInstalled = $false
try {
    $chocoVersion = choco --version 2>$null
    if ($chocoVersion) {
        $chocoInstalled = $true
        Write-Success "Chocolatey v$chocoVersion is already installed"
    }
} catch {
    $chocoInstalled = $false
}

# Step 2: Install Chocolatey if not present
if (-not $chocoInstalled) {
    Write-Step "Installing Chocolatey package manager..."
    Write-Info "This may take a minute..."
    
    try {
        Set-ExecutionPolicy Bypass -Scope Process -Force
        [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
        Invoke-Expression ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
        
        # Refresh environment variables
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
        
        Write-Success "Chocolatey installed successfully!"
    } catch {
        Write-Error "Failed to install Chocolatey: $_"
        Write-Host "`nPress any key to exit..."
        $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
        exit 1
    }
}

# Step 3: Install Node.js
Write-Step "Installing Node.js v$NodeVersion..."
Write-Info "This may take a few minutes..."

try {
    choco install nodejs --version="$NodeVersion" -y --force
    
    # Refresh environment variables
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
    
    Write-Success "Node.js installation completed!"
} catch {
    Write-Error "Failed to install Node.js: $_"
    Write-Host "`nPress any key to exit..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}

# Step 4: Verify installation
Write-Step "Verifying installation..."

# Refresh PATH one more time
$env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")

# Check Node.js version
try {
    $nodeVersion = node -v 2>$null
    if ($nodeVersion -eq "v$NodeVersion") {
        Write-Success "Node.js version: $nodeVersion ✓"
    } else {
        Write-Info "Node.js version: $nodeVersion (expected v$NodeVersion)"
        Write-Info "You may need to restart your terminal"
    }
} catch {
    Write-Error "Could not verify Node.js installation"
    Write-Info "Try restarting your terminal and running: node -v"
}

# Check npm version
try {
    $npmVersion = npm -v 2>$null
    if ($npmVersion -eq $ExpectedNpmVersion) {
        Write-Success "npm version: $npmVersion ✓"
    } else {
        Write-Info "npm version: $npmVersion (expected $ExpectedNpmVersion)"
    }
} catch {
    Write-Error "Could not verify npm installation"
    Write-Info "Try restarting your terminal and running: npm -v"
}

# Summary
Write-Host "`n" -NoNewline
Write-Host "╔══════════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║                    Installation Complete!                    ║" -ForegroundColor Green
Write-Host "╚══════════════════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host "`n  Please restart your terminal to use Node.js and npm." -ForegroundColor Yellow
Write-Host "  Then verify with: node -v && npm -v`n" -ForegroundColor Gray

Write-Host "Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
