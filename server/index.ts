import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { SOCKET_EVENTS } from '../shared/types';
import { WorldManager } from './world';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const world = new WorldManager();

io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    // Send immediate state
    socket.emit(SOCKET_EVENTS.WORLD_UPDATE, world.getState());

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });

    socket.on(SOCKET_EVENTS.COMMAND, (cmd) => {
        console.log('Received command:', cmd);
        if (cmd.type === 'chat') {
            const text = cmd.payload as string;

            if (text.startsWith('/spawn ')) {
                const type = text.split(' ')[1];
                // Spawn at random location
                world.spawnEntity(type, { x: Math.random() * 800, y: Math.random() * 600 });
            }

            if (text.startsWith('/upload ')) {
                try {
                    const jsonStr = text.substring(8);
                    const pack = JSON.parse(jsonStr);
                    world.loadContent(pack);
                    socket.emit(SOCKET_EVENTS.CONTENT_ACCEPTED, { message: 'Content loaded!' });
                } catch (e) {
                    socket.emit(SOCKET_EVENTS.CONTENT_REJECTED, { error: 'Invalid JSON' }); // cast 'e' to string?
                    console.error('Upload error', e);
                }
            }
        }
    });
});

// Game Loop (30 TPS)
const TICK_RATE = 30;
const TICK_MS = 1000 / TICK_RATE;

setInterval(() => {
    world.tick(TICK_MS);
    io.emit(SOCKET_EVENTS.WORLD_UPDATE, world.getState());
}, TICK_MS);

const PORT = 3000;
httpServer.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
