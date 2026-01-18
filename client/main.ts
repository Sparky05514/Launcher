import { io } from 'socket.io-client';
import { SOCKET_EVENTS, WorldState, EntityState, PlayerInput } from '../shared/types';
import { GAME_CONFIG, WORLD_BOUNDS, updateBounds } from '../shared/config';
import { DevPanel } from './devPanel';

// Connect to remote server if configured, otherwise default (localhost proxy)
const serverUrl = import.meta.env.VITE_SERVER_URL;
const socket = io(serverUrl, {
    transports: ['websocket']
});

const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;

let currentState: WorldState | null = null;
let interpolatedEntities: Map<string, { x: number, y: number }> = new Map();
let myEntityId: string | null = null;
let hasJoined = false;

// Input state
const keys: PlayerInput = { up: false, down: false, left: false, right: false };

// Admin / Server View Detection
const urlParams = new URLSearchParams(window.location.search);
const isServerView = urlParams.get('admin') === 'true';
let serverZoom = GAME_CONFIG.SERVER_VIEW_SCALE;

let myLocalPos: { x: number, y: number } | null = null;
const entityTrails: Map<string, { x: number, y: number, timestamp: number }[]> = new Map();

let ping = 0;
let lastPingTime = 0;

setInterval(() => {
    lastPingTime = Date.now();
    socket.emit('latency_ping');
}, 2000);

socket.on('latency_pong', () => {
    ping = Date.now() - lastPingTime;
});
let serverMessage: { text: string, timestamp: number } | null = null;

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

// Join Screen Logic
const joinScreen = document.getElementById('joinScreen')!;
const joinBtn = document.getElementById('joinBtn')!;
const nicknameInput = document.getElementById('nickname') as HTMLInputElement;
const colorInput = document.getElementById('blobColor') as HTMLInputElement;
const ui = document.getElementById('ui')!;

joinBtn.addEventListener('click', () => {
    const nickname = nicknameInput.value.trim() || 'Player';
    const color = colorInput.value;

    socket.emit(SOCKET_EVENTS.PLAYER_JOIN, { nickname, color });

    joinScreen.style.display = 'none';
    ui.style.display = 'block';
    hasJoined = true;
});

// Auto-join if in server view
if (isServerView) {
    joinScreen.style.display = 'none';
    ui.style.display = 'block';
    hasJoined = true;
}

socket.on('connect', () => {
    console.log('Connected to server with ID:', socket.id);
});

socket.on('playerSpawned', (entityId: string) => {
    myEntityId = entityId;
    console.log('My entity ID:', myEntityId);
});

socket.on(SOCKET_EVENTS.SERVER_MESSAGE, (data: { message: string }) => {
    console.log('Server Broadcast:', data.message);
    serverMessage = { text: data.message, timestamp: Date.now() };
});

socket.on(SOCKET_EVENTS.WORLD_UPDATE, (state: WorldState) => {
    currentState = state;

    // Cleanup interpolated entities that no longer exist
    const currentIds = new Set(Object.keys(state.entities));
    for (const id of interpolatedEntities.keys()) {
        if (!currentIds.has(id)) {
            interpolatedEntities.delete(id);
        }
    }

    // Initialize new entities in interpolator
    Object.values(state.entities).forEach(entity => {
        if (!interpolatedEntities.has(entity.id)) {
            interpolatedEntities.set(entity.id, { ...entity.pos });
        }
    });

    if (myEntityId && state.entities[myEntityId]) {
        const serverPos = state.entities[myEntityId].pos;
        if (!myLocalPos) {
            myLocalPos = { ...serverPos };
        }
    }
});

socket.on(SOCKET_EVENTS.CONFIG_SYNC, (serverConfig: any) => {
    console.log('Syncing config from server...', serverConfig);
    Object.assign(GAME_CONFIG, serverConfig);
    updateBounds();
});

// Dev Panel (Toggle with ` key)
const devPanel = new DevPanel(socket);

// Entity Click Detection for Dev Tools
canvas.addEventListener('click', (e) => {
    if (!currentState) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    // Find entity at click position
    for (const entity of Object.values(currentState.entities)) {
        const dx = clickX - entity.pos.x;
        const dy = clickY - entity.pos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < (entity.size || 10) + 5) {
            devPanel.selectEntity(entity.id);
            return;
        }
    }
});

// WASD Input
window.addEventListener('keydown', (e) => {
    if (!hasJoined) return;
    if (e.target === nicknameInput || e.target === document.getElementById('commandInput')) return;

    switch (e.key.toLowerCase()) {
        case 'w': keys.up = true; break;
        case 's': keys.down = true; break;
        case 'a': keys.left = true; break;
        case 'd': keys.right = true; break;
    }
});

window.addEventListener('keyup', (e) => {
    switch (e.key.toLowerCase()) {
        case 'w': keys.up = false; break;
        case 's': keys.down = false; break;
        case 'a': keys.left = false; break;
        case 'd': keys.right = false; break;
    }
});

// Redundant prediction interval removed (logic moved to render loop)

function drawEntity(entity: EntityState) {
    ctx.save();
    ctx.translate(entity.pos.x, entity.pos.y);

    // Apply rotation if specified
    if (entity.visual?.rotation) {
        ctx.rotate((entity.visual.rotation * Math.PI) / 180);
    }

    ctx.fillStyle = entity.color || 'black';

    // Draw shape based on visual type
    const visual = entity.visual;
    const size = entity.size || 10;

    if (visual?.shape === 'rect') {
        const w = visual.width || size * 2;
        const h = visual.height || size * 2;
        ctx.fillRect(-w / 2, -h / 2, w, h);
    } else if (visual?.shape === 'triangle') {
        ctx.beginPath();
        ctx.moveTo(0, -size);
        ctx.lineTo(-size, size);
        ctx.lineTo(size, size);
        ctx.closePath();
        ctx.fill();
    } else {
        // Default: circle
        ctx.beginPath();
        ctx.arc(0, 0, size, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.restore();
    ctx.save();
    ctx.translate(entity.pos.x, entity.pos.y);

    // Draw health bar if entity has health
    if (entity.health !== undefined && entity.maxHealth) {
        const barWidth = 40;
        const barHeight = 4;
        const healthPercent = entity.health / entity.maxHealth;

        ctx.fillStyle = '#333';
        ctx.fillRect(-barWidth / 2, -size - 12, barWidth, barHeight);
        ctx.fillStyle = healthPercent > 0.3 ? '#0f0' : '#f00';
        ctx.fillRect(-barWidth / 2, -size - 12, barWidth * healthPercent, barHeight);
    }

    // Draw nickname
    ctx.fillStyle = 'black';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(entity.type, 0, -(entity.size || 10) - 16);

    // Draw Chat Bubble
    if (entity.chatMessage) {
        ctx.font = '14px sans-serif';
        const metrics = ctx.measureText(entity.chatMessage);
        const padding = 8;
        const bubbleWidth = metrics.width + padding * 2;
        const bubbleHeight = 24;
        const bubbleY = -(entity.size || 10) - 48;

        ctx.fillStyle = 'white';
        ctx.strokeStyle = '#ccc';
        ctx.lineWidth = 1;

        const r = 10;
        const x = -bubbleWidth / 2;
        const y = bubbleY;
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + bubbleWidth - r, y);
        ctx.quadraticCurveTo(x + bubbleWidth, y, x + bubbleWidth, y + r);
        ctx.lineTo(x + bubbleWidth, y + bubbleHeight - r);
        ctx.quadraticCurveTo(x + bubbleWidth, y + bubbleHeight, x + bubbleWidth - r, y + bubbleHeight);
        ctx.lineTo(x + bubbleWidth / 2 + 10, y + bubbleHeight);
        ctx.lineTo(x + bubbleWidth / 2, y + bubbleHeight + 10);
        ctx.lineTo(x + bubbleWidth / 2 - 10, y + bubbleHeight);
        ctx.lineTo(x + r, y + bubbleHeight);
        ctx.quadraticCurveTo(x, y + bubbleHeight, x, y + bubbleHeight - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#333';
        ctx.fillText(entity.chatMessage, 0, bubbleY + 16);
    }

    ctx.restore();
}

let lastTime = performance.now();

function render(now: number) {
    const dt = now - lastTime;
    lastTime = now;

    // 1. Update Player Prediction (High FPS)
    if (hasJoined && myLocalPos) {
        if (keys.up || keys.down || keys.left || keys.right) {
            const moveAmt = GAME_CONFIG.PLAYER_SPEED * (dt / 1000);
            if (keys.up) myLocalPos.y -= moveAmt;
            if (keys.down) myLocalPos.y += moveAmt;
            if (keys.left) myLocalPos.x -= moveAmt;
            if (keys.right) myLocalPos.x += moveAmt;

            myLocalPos.x = Math.max(WORLD_BOUNDS.minX, Math.min(WORLD_BOUNDS.maxX, myLocalPos.x));
            myLocalPos.y = Math.max(WORLD_BOUNDS.minY, Math.min(WORLD_BOUNDS.maxY, myLocalPos.y));
        }

        // Collision logic
        if (GAME_CONFIG.COLLISION_ENABLED && currentState) {
            Object.values(currentState.entities).forEach(other => {
                if (other.id === myEntityId) return;
                const dx = myLocalPos!.x - other.pos.x;
                const dy = myLocalPos!.y - other.pos.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const minDist = GAME_CONFIG.PLAYER_SIZE + (other.size || 10);
                if (dist < minDist) {
                    const angle = Math.atan2(dy, dx);
                    myLocalPos!.x = other.pos.x + Math.cos(angle) * minDist;
                    myLocalPos!.y = other.pos.y + Math.sin(angle) * minDist;
                }
            });
        }
    }

    ctx.save();

    // Apply server view scaling
    if (isServerView) {
        ctx.scale(serverZoom, serverZoom);
    }

    // 1. Draw Void (everything outside the game world)
    ctx.fillStyle = isServerView ? '#000000' : GAME_CONFIG.VOID_COLOR;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 2. Draw World Background
    ctx.fillStyle = isServerView ? '#000000' : GAME_CONFIG.BACKGROUND_COLOR;
    ctx.fillRect(0, 0, GAME_CONFIG.WORLD_WIDTH, GAME_CONFIG.WORLD_HEIGHT);

    // 3. Draw Grid (Limited to world bounds)
    ctx.strokeStyle = isServerView ? 'rgba(255, 255, 255, 0.1)' : GAME_CONFIG.GRID_COLOR;
    ctx.lineWidth = 1;
    const gridSize = GAME_CONFIG.GRID_SIZE;

    ctx.beginPath();
    for (let x = 0; x <= GAME_CONFIG.WORLD_WIDTH; x += gridSize) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, GAME_CONFIG.WORLD_HEIGHT);
    }
    for (let y = 0; y <= GAME_CONFIG.WORLD_HEIGHT; y += gridSize) {
        ctx.moveTo(0, y);
        ctx.lineTo(GAME_CONFIG.WORLD_WIDTH, y);
    }
    ctx.stroke();

    // 4. Draw World Border
    ctx.strokeStyle = isServerView ? '#00d2ff' : '#333';
    ctx.lineWidth = 4;
    ctx.strokeRect(0, 0, GAME_CONFIG.WORLD_WIDTH, GAME_CONFIG.WORLD_HEIGHT);

    // 5. Draw Ping (Top Left)
    ctx.fillStyle = isServerView ? 'white' : 'black';
    ctx.font = 'bold 14px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`Ping: ${ping}ms`, 20, 30);

    if (currentState) {
        Object.values(currentState.entities).forEach(entity => {
            const pos = (entity.id === myEntityId && myLocalPos) ? myLocalPos : entity.pos;

            // 1. Trail Logic
            if (GAME_CONFIG.TRAIL_ENABLED) {
                let trail = entityTrails.get(entity.id) || [];
                const now = Date.now();

                // Add current position to trail (every frame for maximum smoothness)
                trail.push({ x: pos.x, y: pos.y, timestamp: now });

                // Filter out points older than the duration
                trail = trail.filter(p => now - p.timestamp < GAME_CONFIG.TRAIL_DURATION_MS);

                // Performance cap
                if (trail.length > 60) trail.shift();
                entityTrails.set(entity.id, trail);

                // Draw Ghosting Trail (Shadow Echo)
                // We draw a fixed number of ghosts sampled from our high-res points for smoothness
                const ghostCount = 6;
                for (let i = 0; i < ghostCount; i++) {
                    const index = Math.floor((i / ghostCount) * trail.length);
                    const p = trail[index];
                    if (!p) continue;

                    const alpha = (i / ghostCount) * 0.4; // Max 0.4 opacity
                    ctx.globalAlpha = alpha;
                    ctx.fillStyle = entity.color || 'black';

                    ctx.beginPath();
                    ctx.arc(p.x, p.y, (entity.size || 10), 0, Math.PI * 2);
                    ctx.fill();
                }
                ctx.globalAlpha = 1.0;
            }

            // 2. Draw Entity
            let displayPos = entity.pos;
            if (entity.id !== myEntityId) {
                const interp = interpolatedEntities.get(entity.id);
                if (interp) {
                    // Time-based Lerp for high FPS smoothness
                    // We want to reach the target roughly in 1 tick (100ms at 10Hz, or here ~16ms at 60Hz)
                    // The factor 0.15 * (dt / 16.6) makes it smooth across refresh rates
                    const lerpFactor = 1 - Math.exp(-0.015 * dt);
                    interp.x += (entity.pos.x - interp.x) * lerpFactor;
                    interp.y += (entity.pos.y - interp.y) * lerpFactor;
                    displayPos = interp;
                }
            } else if (myLocalPos) {
                displayPos = myLocalPos;
            }

            drawEntity({ ...entity, pos: displayPos });
        });

        // Cleanup stale trails
        entityTrails.forEach((_, id) => {
            if (!currentState!.entities[id]) entityTrails.delete(id);
        });
    } else {
        ctx.fillStyle = 'black';
        ctx.fillText('Connecting...', 10, 20);
    }

    // 5. Draw Server Broadcast
    if (serverMessage && Date.now() - serverMessage.timestamp < 5000) {
        ctx.save();
        ctx.resetTransform(); // Keep at full screen
        ctx.fillStyle = 'rgba(0, 210, 255, 0.9)';
        ctx.font = 'bold 24px sans-serif';
        ctx.textAlign = 'center';
        ctx.shadowBlur = 10;
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.fillText(serverMessage.text, canvas.width / 2, 60);
        ctx.restore();
    }
    ctx.restore();
    requestAnimationFrame(render);
}

// Separate interval for network sync (still matches tick rate or slightly lower)
setInterval(() => {
    if (hasJoined && myLocalPos) {
        socket.emit(SOCKET_EVENTS.PLAYER_POSITION, myLocalPos);
    }
}, 1000 / GAME_CONFIG.TICK_RATE);

// Start render loop with high-precision timestamp
requestAnimationFrame(render);

const commandInput = document.getElementById('commandInput') as HTMLInputElement;

// Global hotkey for command input
window.addEventListener('keydown', (e) => {
    if (e.key === '/' && document.activeElement !== commandInput) {
        e.preventDefault();
        commandInput.focus();
    }
});

commandInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        const text = commandInput.value;
        if (text) {
            socket.emit(SOCKET_EVENTS.COMMAND, { type: 'chat', payload: text });
        }
        commandInput.value = '';
    }
});
