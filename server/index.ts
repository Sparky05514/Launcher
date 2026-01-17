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
    }
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
                const command = parts[0];

                if (command === '/spawn') {
                    const type = parts[1];
                    const count = parseInt(parts[2]) || 1;
                    for (let i = 0; i < count; i++) {
                        world.spawnEntity(type, {
                            x: Math.random() * GAME_CONFIG.WORLD_WIDTH,
                            y: Math.random() * GAME_CONFIG.WORLD_HEIGHT
                        });
                    }
                }

                if (command === '/clear') {
                    const activePlayerIds = new Set(playerEntities.values());
                    world.getState().entities;
                    // We need a way to remove multiple entities from world
                    // I'll add a clearAllNPCs method to world that takes a set of IDs to keep
                    world.clearExcept(activePlayerIds);
                }

                if (command === '/broadcast') {
                    const message = parts.slice(1).join(' ');
                    io.emit(SOCKET_EVENTS.SERVER_MESSAGE, { message });
                }

                if (command === '/speed') {
                    const speed = parseFloat(parts[1]);
                    if (!isNaN(speed)) {
                        world.setWorldSpeed(speed);
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
