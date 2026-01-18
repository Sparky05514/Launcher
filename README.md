# 🎮 Sandbox Launcher

A high-performance, lag-free multiplayer sandbox game with client-authoritative movement and a sleek "Ghost Console" admin system.

## 🚀 How to Host (Linux/User)
Hosting is now automated. Just run the following script:
```bash
bash play_linux.sh
```
1. Select **1) Host a Public Match**.
2. Wait for the `localtunnel` URL (e.g., `https://cool-panda.loca.lt`).
3. **Copy the URL** AND the **Tunnel Password** (your IP) shown in the terminal!
4. Send both to your friends.

> [!NOTE]
> The **Tunnel Password** is a security measure by Localtunnel. Players only need to enter it once to "unlock" the session in their browser.

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

## ⚡ Troubleshooting Latency (High MS)
If your `Ping` is high, follow these steps to find the bottleneck:

### 1. The "Base Lag" Test (Local)
- On the host machine, open `http://localhost:5173`.
- Check the `Ping` display.
- **Result**: If it's **< 5ms**, your code and PC are fine. The lag is coming from the **Tunnel**.

### 2. High Performance Option (Cloudflare)
Localtunnel servers are sometimes far away. If the lag is too high, try our **High-Performance Tunnel**:
- Stop your current host process.
- Run: `npm run host:fast`
- This uses **Cloudflare Tunnel**, which is usually 2-3x faster because it uses a global "Edge" network.

## 💻 Tech Stack
- **Frontend**: Vite + TypeScript + HTML5 Canvas
- **Backend**: Node.js + Express + Socket.IO
- **Hosting**: Localtunnel (Default) / Cloudflare Tunnel (High Speed)
