import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { SOCKET_EVENTS, PlayerJoinData, PlayerInput } from '../shared/types';
import { WorldManager } from './world';
import { GAME_CONFIG } from '../shared/config';

import path from 'path';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    },
    transports: ['websocket']
});

const world = new WorldManager();

// Track which entity belongs to which socket
const playerEntities: Map<string, string> = new Map();

// Serve static files (Client Build)
const clientDist = path.join(process.cwd(), 'client/dist');
app.use(express.static(clientDist));


io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    // Send immediate state
    socket.emit(SOCKET_EVENTS.CONFIG_SYNC, GAME_CONFIG);
    socket.emit(SOCKET_EVENTS.WORLD_UPDATE, world.getState());

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
        // Remove player entity
        const entityId = playerEntities.get(socket.id);
        if (entityId) {
            world.removeEntity(entityId);
            playerEntities.delete(socket.id);
        }
    });

    socket.on(SOCKET_EVENTS.PLAYER_JOIN, (data: PlayerJoinData) => {
        console.log('Player joining:', data.nickname, data.color);
        // Spawn player blob at random position
        const entityId = world.spawnPlayer(data.nickname, data.color);
        playerEntities.set(socket.id, entityId);
        socket.emit('playerSpawned', entityId);
    });

    socket.on(SOCKET_EVENTS.PLAYER_POSITION, (pos: { x: number, y: number }) => {
        const entityId = playerEntities.get(socket.id);
        if (entityId) {
            world.setPlayerPosition(entityId, pos);
        }
    });

    socket.on(SOCKET_EVENTS.COMMAND, (cmd) => {
        console.log('Received command:', cmd);
        if (cmd.type === 'chat') {
            const text = cmd.payload as string;

            if (text.startsWith('/')) {
                const parts = text.split(' ');
                const command = parts[0].toLowerCase();

                if (command === '/spawn') {
                    const type = parts[1] || 'blob';
                    const count = parseInt(parts[2]) || 1;
                    console.log(`[Admin] Spawning ${count} of ${type}`);
                    for (let i = 0; i < count; i++) {
                        world.spawnEntity(type, {
                            x: Math.random() * GAME_CONFIG.WORLD_WIDTH,
                            y: Math.random() * GAME_CONFIG.WORLD_HEIGHT
                        });
                    }
                    socket.emit(SOCKET_EVENTS.SERVER_MESSAGE, { message: `Spawned ${count} ${type}(s)` });
                }

                if (command === '/clear') {
                    const activePlayerIds = new Set(playerEntities.values());
                    console.log(`[Admin] Clearing world. Keeping players: ${Array.from(activePlayerIds)}`);
                    world.clearExcept(activePlayerIds);
                    io.emit(SOCKET_EVENTS.SERVER_MESSAGE, { message: '🧹 World cleared by Admin' });
                }

                if (command === '/broadcast') {
                    const message = parts.slice(1).join(' ');
                    if (message.trim()) {
                        console.log(`[Admin] Broadcasting: ${message}`);
                        io.emit(SOCKET_EVENTS.SERVER_MESSAGE, { message });
                    }
                }

                if (command === '/help' && parts[1] === 'admin') {
                    socket.emit(SOCKET_EVENTS.SERVER_MESSAGE, {
                        message: 'Admin Commands: /spawn [type] [count], /clear, /speed [n], /broadcast [msg]'
                    });
                }

                if (command === '/speed') {
                    const speed = parseFloat(parts[1]);
                    if (!isNaN(speed)) {
                        console.log(`[Admin] Setting world speed to ${speed}x`);
                        world.setWorldSpeed(speed);
                        socket.emit(SOCKET_EVENTS.SERVER_MESSAGE, { message: `World speed set to ${speed}x` });
                    }
                }

                if (text.startsWith('/upload ')) {
                    try {
                        const jsonStr = text.substring(8);
                        const pack = JSON.parse(jsonStr);
                        world.loadContent(pack);
                        socket.emit(SOCKET_EVENTS.CONTENT_ACCEPTED, { message: 'Content loaded!' });
                    } catch (e) {
                        socket.emit(SOCKET_EVENTS.CONTENT_REJECTED, { error: 'Invalid JSON' });
                        console.error('Upload error', e);
                    }
                }
            } else {
                // Not a command: Broadcast as chat bubble
                const entityId = playerEntities.get(socket.id);
                if (entityId) {
                    world.setChatMessage(entityId, text);
                }
            }
        }
    });

    socket.on('latency_ping', () => {
        socket.emit('latency_pong');
    });
});

// Game Loop (defined by TICK_RATE)
const TICK_MS = 1000 / GAME_CONFIG.TICK_RATE;

setInterval(() => {
    world.tick(TICK_MS);
    io.emit(SOCKET_EVENTS.WORLD_UPDATE, world.getState());
}, TICK_MS);

const PORT = process.env.PORT || GAME_CONFIG.SERVER_PORT;
httpServer.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
