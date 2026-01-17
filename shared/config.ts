/**
 * Central configuration for the Sandbox Launcher
 * Modify these values to tune the game behavior.
 */
export const GAME_CONFIG = {
    // Server & Networking
    SERVER_PORT: 3000,
    TICK_RATE: 120, // Ticks per second

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

    // Reconciliation (Smoothing)
    RECONCILIATION_STRENGTH: 0.1, // How fast we pull toward server pos (0-1)
    RECONCILIATION_THRESHOLD: 100, // Snap instantly if distance is above this
};

// Calculated Bounds - these will be updated if the config is synced
export let WORLD_BOUNDS = {
    minX: GAME_CONFIG.PLAYER_SIZE,
    maxX: GAME_CONFIG.WORLD_WIDTH - GAME_CONFIG.PLAYER_SIZE,
    minY: GAME_CONFIG.PLAYER_SIZE,
    maxY: GAME_CONFIG.WORLD_HEIGHT - GAME_CONFIG.PLAYER_SIZE
};

/**
 * Updates the calculated bounds based on current config
 */
export function updateBounds() {
    WORLD_BOUNDS.minX = GAME_CONFIG.PLAYER_SIZE;
    WORLD_BOUNDS.maxX = GAME_CONFIG.WORLD_WIDTH - GAME_CONFIG.PLAYER_SIZE;
    WORLD_BOUNDS.minY = GAME_CONFIG.PLAYER_SIZE;
    WORLD_BOUNDS.maxY = GAME_CONFIG.WORLD_HEIGHT - GAME_CONFIG.PLAYER_SIZE;
}
