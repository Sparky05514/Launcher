/**
 * Central configuration for the Sandbox Launcher
 * Modify these values to tune the game behavior.
 */
export const GAME_CONFIG = {
    // Server & Networking
    SERVER_PORT: 3000,
    TICK_RATE: 240, // Ticks per second

    // World Dimensions
    WORLD_WIDTH: 800,
    WORLD_HEIGHT: 600,

    // Player Settings
    PLAYER_SPEED: 400,
    PLAYER_SIZE: 30,

    // Visuals (Client Only)
    GRID_SIZE: 50,
    BACKGROUND_COLOR: '#ffffff',
    GRID_COLOR: '#eee',
};

// Calculated Bounds (to prevent hardcoding the math everywhere)
export const WORLD_BOUNDS = {
    minX: GAME_CONFIG.PLAYER_SIZE,
    maxX: GAME_CONFIG.WORLD_WIDTH - GAME_CONFIG.PLAYER_SIZE,
    minY: GAME_CONFIG.PLAYER_SIZE,
    maxY: GAME_CONFIG.WORLD_HEIGHT - GAME_CONFIG.PLAYER_SIZE
};
