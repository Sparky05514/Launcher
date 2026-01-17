import { io } from 'socket.io-client';
import { SOCKET_EVENTS, WorldState, EntityState, PlayerInput } from '../shared/types';
import { GAME_CONFIG, WORLD_BOUNDS, updateBounds } from '../shared/config';

// Connect to remote server if configured, otherwise default (localhost proxy)
const serverUrl = import.meta.env.VITE_SERVER_URL;
const socket = io(serverUrl);

const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;

let currentState: WorldState | null = null;
let myEntityId: string | null = null;
let hasJoined = false;

// Input state
const keys: PlayerInput = { up: false, down: false, left: false, right: false };

let myLocalPos: { x: number, y: number } | null = null;
const entityTrails: Map<string, { x: number, y: number }[]> = new Map();

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

socket.on('connect', () => {
    console.log('Connected to server with ID:', socket.id);
});

socket.on('playerSpawned', (entityId: string) => {
    myEntityId = entityId;
    console.log('My entity ID:', myEntityId);
});

socket.on(SOCKET_EVENTS.WORLD_UPDATE, (state: WorldState) => {
    currentState = state;

    if (myEntityId && currentState.entities[myEntityId]) {
        const serverPos = currentState.entities[myEntityId].pos;
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

// Prediction and Input Loop
setInterval(() => {
    if (!hasJoined) return;

    // 1. Client-Side Prediction
    if (myLocalPos && (keys.up || keys.down || keys.left || keys.right)) {
        const deltaTime = 1000 / GAME_CONFIG.TICK_RATE;
        const moveAmt = GAME_CONFIG.PLAYER_SPEED * (deltaTime / 1000);

        if (keys.up) myLocalPos.y -= moveAmt;
        if (keys.down) myLocalPos.y += moveAmt;
        if (keys.left) myLocalPos.x -= moveAmt;
        if (keys.right) myLocalPos.x += moveAmt;

        // Keep in bounds
        myLocalPos.x = Math.max(WORLD_BOUNDS.minX, Math.min(WORLD_BOUNDS.maxX, myLocalPos.x));
        myLocalPos.y = Math.max(WORLD_BOUNDS.minY, Math.min(WORLD_BOUNDS.maxY, myLocalPos.y));
    }

    // 2. Client Authority: Send local position to server
    if (myLocalPos) {
        socket.emit(SOCKET_EVENTS.PLAYER_POSITION, myLocalPos);
    }
}, 1000 / GAME_CONFIG.TICK_RATE);

function drawEntity(entity: EntityState) {
    ctx.save();
    ctx.translate(entity.pos.x, entity.pos.y);

    ctx.fillStyle = entity.color || 'black';

    // Draw circle
    ctx.beginPath();
    ctx.arc(0, 0, entity.size || 10, 0, Math.PI * 2);
    ctx.fill();

    // Draw nickname
    ctx.fillStyle = 'black';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(entity.type, 0, -(entity.size || 10) - 8);

    // Draw Chat Bubble
    if (entity.chatMessage) {
        ctx.font = '14px sans-serif';
        const metrics = ctx.measureText(entity.chatMessage);
        const padding = 8;
        const bubbleWidth = metrics.width + padding * 2;
        const bubbleHeight = 24;
        const bubbleY = -(entity.size || 10) - 40;

        // Bubble background
        ctx.fillStyle = 'white';
        ctx.strokeStyle = '#ccc';
        ctx.lineWidth = 1;

        // Rounded rect for bubble
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
        ctx.lineTo(x + bubbleWidth / 2, y + bubbleHeight + 10); // Pointy part
        ctx.lineTo(x + bubbleWidth / 2 - 10, y + bubbleHeight);
        ctx.lineTo(x + r, y + bubbleHeight);
        ctx.quadraticCurveTo(x, y + bubbleHeight, x, y + bubbleHeight - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Chat text
        ctx.fillStyle = '#333';
        ctx.fillText(entity.chatMessage, 0, bubbleY + 16);
    }

    ctx.restore();
}

function render() {
    // Clear screen
    ctx.fillStyle = GAME_CONFIG.BACKGROUND_COLOR;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw grid for reference
    ctx.strokeStyle = GAME_CONFIG.GRID_COLOR;
    ctx.lineWidth = 1;
    const gridSize = GAME_CONFIG.GRID_SIZE;
    for (let x = 0; x < canvas.width; x += gridSize) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += gridSize) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
    }

    if (currentState) {
        Object.values(currentState.entities).forEach(entity => {
            const pos = (entity.id === myEntityId && myLocalPos) ? myLocalPos : entity.pos;

            // 1. Trail Logic
            if (GAME_CONFIG.TRAIL_ENABLED) {
                let trail = entityTrails.get(entity.id) || [];
                // Only add point if it moved significantly
                const lastPoint = trail[trail.length - 1];
                if (!lastPoint || Math.abs(lastPoint.x - pos.x) > 1 || Math.abs(lastPoint.y - pos.y) > 1) {
                    trail.push({ ...pos });
                }
                if (trail.length > GAME_CONFIG.TRAIL_LENGTH) trail.shift();
                entityTrails.set(entity.id, trail);

                // Draw Trail
                ctx.beginPath();
                ctx.strokeStyle = entity.color || 'black';
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                trail.forEach((p, i) => {
                    ctx.globalAlpha = i / trail.length; // Fade trail
                    ctx.lineWidth = (entity.size || 10) * (i / trail.length) * 0.8;
                    if (i === 0) ctx.moveTo(p.x, p.y);
                    else ctx.lineTo(p.x, p.y);
                });
                ctx.stroke();
                ctx.globalAlpha = 1.0;
            }

            // 2. Draw Entity
            if (entity.id === myEntityId && myLocalPos) {
                drawEntity({ ...entity, pos: myLocalPos });
            } else {
                drawEntity(entity);
            }
        });

        // Cleanup stale trails
        entityTrails.forEach((_, id) => {
            if (!currentState!.entities[id]) entityTrails.delete(id);
        });

        ctx.fillStyle = 'black';
        ctx.font = '12px monospace';
        ctx.fillText(`Ping: ${Date.now() - currentState.timestamp}ms`, 10, 20);
    } else {
        ctx.fillStyle = 'black';
        ctx.fillText('Connecting...', 10, 20);
    }

    requestAnimationFrame(render);
}
render();

const commandInput = document.getElementById('commandInput') as HTMLInputElement;
commandInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        const text = commandInput.value;
        if (text) {
            socket.emit(SOCKET_EVENTS.COMMAND, { type: 'chat', payload: text });
        }
        commandInput.value = '';
    }
});
