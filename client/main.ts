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

// Local prediction state
let myLocalPos: { x: number, y: number } | null = null;
let latestServerPos: { x: number, y: number } | null = null;

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
        latestServerPos = currentState.entities[myEntityId].pos;
        if (!myLocalPos) {
            myLocalPos = { ...latestServerPos };
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

    // 2. Soft Reconciliation (Smoothing)
    if (myLocalPos && latestServerPos) {
        const dist = Math.sqrt(Math.pow(myLocalPos.x - latestServerPos.x, 2) + Math.pow(myLocalPos.y - latestServerPos.y, 2));

        if (dist > GAME_CONFIG.RECONCILIATION_THRESHOLD) {
            // Massive drift: Hard snap
            myLocalPos = { ...latestServerPos };
        } else if (dist > 0.1) {
            // Nudge toward server pos
            myLocalPos.x += (latestServerPos.x - myLocalPos.x) * GAME_CONFIG.RECONCILIATION_STRENGTH;
            myLocalPos.y += (latestServerPos.y - myLocalPos.y) * GAME_CONFIG.RECONCILIATION_STRENGTH;
        }
    }

    // 3. Send input to server
    socket.emit(SOCKET_EVENTS.PLAYER_INPUT, keys);
}, 1000 / GAME_CONFIG.TICK_RATE);

function drawEntity(entity: EntityState) {
    ctx.save();
    ctx.translate(entity.pos.x, entity.pos.y);

    ctx.fillStyle = entity.color || 'black';

    // Draw circle
    ctx.beginPath();
    ctx.arc(0, 0, entity.size || 10, 0, Math.PI * 2);
    ctx.fill();

    // Draw nickname above (use type as fallback, or nickname stored in type)
    ctx.fillStyle = 'black';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(entity.type, 0, -(entity.size || 10) - 5);

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
            // Use local position for the player's own entity
            if (entity.id === myEntityId && myLocalPos) {
                drawEntity({ ...entity, pos: myLocalPos });
            } else {
                drawEntity(entity);
            }
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
