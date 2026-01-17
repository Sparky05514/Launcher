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

# Prompt for Server URL
echo ""
echo "Enter the Game Server URL (e.g. https://my-game.onrender.com)"
echo "Leave empty to play locally (requires npm run server running locally)"
echo ""
read -p "Server URL: " SERVER_URL

if [ -z "$SERVER_URL" ]; then
    echo "[INFO] Starting in LOCAL mode..."
    npm run client
else
    echo "[INFO] Connecting to $SERVER_URL..."
    export VITE_SERVER_URL=$SERVER_URL
    npm run client
fi
