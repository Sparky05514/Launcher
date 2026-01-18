import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { SOCKET_EVENTS, PlayerJoinData, PlayerInput } from '../shared/types';
import { WorldManager } from './world';
import { GAME_CONFIG } from '../shared/config';
import chokidar from 'chokidar';
import fs from 'fs';
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

    // ========== DEV TOOLS ==========
    socket.on(SOCKET_EVENTS.DEV_GET_STATE, () => {
        socket.emit(SOCKET_EVENTS.DEV_STATE_SYNC, {
            entities: world.getState().entities,
            definitions: world.getDefinitions(),
            config: GAME_CONFIG
        });
    });

    socket.on(SOCKET_EVENTS.DEV_UPDATE_ENTITY, (data: { entityId: string, props: any }) => {
        const success = world.updateEntityProperties(data.entityId, data.props);
        if (success) {
            console.log(`[Dev] Updated entity ${data.entityId}`);
        }
    });

    socket.on(SOCKET_EVENTS.DEV_DELETE_ENTITY, (entityId: string) => {
        world.removeEntity(entityId);
        console.log(`[Dev] Deleted entity ${entityId}`);
    });

    socket.on(SOCKET_EVENTS.DEV_UPDATE_DEFINITION, (data: { type: string, def: any }) => {
        world.updateDefinition(data.type, data.def);
        io.emit(SOCKET_EVENTS.DEV_STATE_SYNC, {
            entities: world.getState().entities,
            definitions: world.getDefinitions(),
            config: GAME_CONFIG
        });
    });

    socket.on(SOCKET_EVENTS.DEV_EXEC_CODE, (code: string) => {
        // Dev-mode sandboxed eval with game context
        try {
            const context = { world, GAME_CONFIG, io, console };
            const fn = new Function(...Object.keys(context), `return (${code})`);
            const result = fn(...Object.values(context));
            socket.emit(SOCKET_EVENTS.DEV_EXEC_RESULT, { success: true, result: String(result) });
        } catch (err: any) {
            socket.emit(SOCKET_EVENTS.DEV_EXEC_RESULT, { success: false, error: err.message });
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

// ========== HOT RELOAD FILE WATCHER ==========
const GAME_DIR = path.join(process.cwd(), 'game');
const CONFIG_FILE = path.join(GAME_DIR, 'config.json');
const DEFINITIONS_FILE = path.join(GAME_DIR, 'definitions.json');

function loadConfig() {
    try {
        if (fs.existsSync(CONFIG_FILE)) {
            const data = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
            Object.assign(GAME_CONFIG, data);
            console.log('[Hot Reload] Config updated');
            io.emit(SOCKET_EVENTS.CONFIG_SYNC, GAME_CONFIG);
        }
    } catch (err) {
        console.error('[Hot Reload] Config load error:', err);
    }
}

function loadDefinitions() {
    try {
        if (fs.existsSync(DEFINITIONS_FILE)) {
            const data = JSON.parse(fs.readFileSync(DEFINITIONS_FILE, 'utf-8'));
            world.loadContent({ definitions: data });
            console.log('[Hot Reload] Definitions updated');
            // Sync to dev panels
            io.emit(SOCKET_EVENTS.DEV_STATE_SYNC, {
                entities: world.getState().entities,
                definitions: world.getDefinitions(),
                config: GAME_CONFIG
            });
        }
    } catch (err) {
        console.error('[Hot Reload] Definitions load error:', err);
    }
}

// Initial load from files
loadConfig();
loadDefinitions();

// Watch for changes
const watcher = chokidar.watch(GAME_DIR, {
    persistent: true,
    ignoreInitial: true
});

watcher.on('change', (filePath) => {
    console.log(`[Hot Reload] File changed: ${filePath}`);
    if (filePath.endsWith('config.json')) {
        loadConfig();
    } else if (filePath.endsWith('definitions.json')) {
        loadDefinitions();
    }
});

console.log(`[Hot Reload] Watching ${GAME_DIR} for changes...`);
