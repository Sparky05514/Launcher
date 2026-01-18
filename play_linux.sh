#!/bin/bash

echo "=========================================="
echo "     Sandbox Launcher - Client Setup"
echo "=========================================="
echo ""

# Check for Node.js
if ! command -v node &> /dev/null; then
    echo "[ERROR] Node.js is not installed!"
    echo "Please install it using your package manager (e.g., sudo apt install nodejs npm)"
    exit 1
fi

# Install deps if needed
if [ ! -d "node_modules" ]; then
    echo "[INFO] Installing dependencies..."
    npm install
fi

echo "What would you like to do?"
echo "1) Host a Public Match (localtunnel - Easier)"
echo "2) Host a Public Match (Cloudflare - High Performance)"
echo "3) Join a Server / Play Locally"
read -p "Selection [1-3]: " CHOICE

if [ "$CHOICE" == "1" ]; then
    echo "[INFO] Starting Public Host (localtunnel)..."
    npm run host
    exit 0
fi

if [ "$CHOICE" == "2" ]; then
    echo "[INFO] Starting High-Performance Host (Cloudflare)..."
    npm run host:fast
    exit 0
fi

# Prompt for Server URL
echo ""
echo "Enter the Game Server URL (e.g. https://cool-panda.loca.lt)"
echo "Leave empty to play locally (requires another terminal running 'npm run server')"
echo "NOTE: If asked for a 'Tunnel Password', use the IP printed in your host terminal."
echo ""
read -p "Server URL: " SERVER_URL

if [ -z "$SERVER_URL" ]; then
    echo "[INFO] Starting Client in LOCAL mode..."
    npm run client
else
    echo "[INFO] Connecting to $SERVER_URL..."
    export VITE_SERVER_URL=$SERVER_URL
    npm run client
fi
