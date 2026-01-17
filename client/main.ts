import { io } from 'socket.io-client';
import { SOCKET_EVENTS, WorldState, EntityState } from '../shared/types';

// Connect to remote server if configured, otherwise default (localhost proxy)
const serverUrl = import.meta.env.VITE_SERVER_URL;
const socket = io(serverUrl);

const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;

let currentState: WorldState | null = null;

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

socket.on('connect', () => {
    console.log('Connected to server with ID:', socket.id);
});

socket.on(SOCKET_EVENTS.WORLD_UPDATE, (state: WorldState) => {
    currentState = state;
});

function drawEntity(entity: EntityState) {
    ctx.save();
    ctx.translate(entity.pos.x, entity.pos.y);

    ctx.fillStyle = entity.color || 'black';

    // Draw circle
    ctx.beginPath();
    ctx.arc(0, 0, entity.size || 10, 0, Math.PI * 2);
    ctx.fill();

    // Draw ID slightly above
    ctx.fillStyle = 'black';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(entity.type, 0, -15);

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
        ctx.fillText(`Ping: ${Date.now() - currentState.timestamp}ms`, 10, 20);
    } else {
        ctx.fillStyle = 'black';
        ctx.fillText('Connecting...', 10, 20);
    }

    requestAnimationFrame(render);
}
render();

const input = document.getElementById('commandInput') as HTMLInputElement;
input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        const text = input.value;
        if (text) {
            socket.emit(SOCKET_EVENTS.COMMAND, { type: 'chat', payload: text });
        }
        input.value = '';
    }
});
