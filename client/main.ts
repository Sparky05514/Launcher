import { io } from 'socket.io-client';
import { SOCKET_EVENTS, WorldState, EntityState, PlayerInput } from '../shared/types';

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

// Send input to server at regular intervals
setInterval(() => {
    if (hasJoined && (keys.up || keys.down || keys.left || keys.right)) {
        socket.emit(SOCKET_EVENTS.PLAYER_INPUT, keys);
    }
}, 1000 / 30); // 30 times per second

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
    // Clear screen (White background as requested)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw grid for reference
    ctx.strokeStyle = '#eee';
    ctx.lineWidth = 1;
    const gridSize = 50;
    for (let x = 0; x < canvas.width; x += gridSize) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += gridSize) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
    }

    if (currentState) {
        Object.values(currentState.entities).forEach(entity => {
            drawEntity(entity);
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
