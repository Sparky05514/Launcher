# 🎮 Sandbox Launcher

A high-performance, lag-free multiplayer sandbox game with client-authoritative movement and a sleek "Ghost Console" admin system.

## 🚀 How to Host (Linux/User)
Hosting is now automated. Just run the following script:
```bash
bash play_linux.sh
```
1. Select **1) Host a Public Match**.
2. Wait for the `localtunnel` URL (e.g., `https://cool-panda.loca.lt`).
3. **Copy this URL** and send it to your friends!

## 🕹️ How to Play (Windows/Players)
If you just want to join a friend's server:
1. Open the URL your friend gave you in your browser (Chrome/Edge/Firefox).
   **OR**
2. Run `play_windows.bat`:
   - Enter the **Server URL** when prompted.
   - The launcher will start the game locally and connect for you.

## 🛠️ Admin Commands
Press **`/`** anywhere in the game to open the **Ghost Console**.
- `/spawn [type] [count]` — Spawn NPCs (e.g., `/spawn blob 20`)
- `/clear` — Clear all NPCs from the world
- `/speed [n]` — Change global world speed (e.g., `/speed 0.5` for slow-motion)
- `/broadcast [msg]` — Send a giant announcement to all players
- `/help admin` — See all admin commands

## 💻 Tech Stack
- **Frontend**: Vite + TypeScript + HTML5 Canvas
- **Backend**: Node.js + Express + Socket.IO
- **Hosting**: Localtunnel (for instant public URLs)
