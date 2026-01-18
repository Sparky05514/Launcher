// Shared definitions

export interface Vector2 {
    x: number;
    y: number;
}

export interface EntityState {
    id: string;
    type: string;
    pos: Vector2;
    // We can add color or other visual props here
    color?: string;
    size?: number;
    chatMessage?: string;
    chatTimer?: number;
}

export interface WorldState {
    entities: Record<string, EntityState>;
    timestamp: number;
}

export interface Command {
    type: string;
    payload: any;
}

export const SOCKET_EVENTS = {
    CONNECT: 'connect',
    DISCONNECT: 'disconnect',
    WORLD_UPDATE: 'worldUpdate',
    COMMAND: 'command',
    UPLOAD_CONTENT: 'uploadContent',
    CONTENT_ACCEPTED: 'contentAccepted',
    CONTENT_REJECTED: 'contentRejected',
    PLAYER_JOIN: 'playerJoin',
    PLAYER_POSITION: 'player_position',
    CONFIG_SYNC: 'config_sync',
    SERVER_MESSAGE: 'server_message',
    // Dev Tools Events
    DEV_GET_STATE: 'dev_get_state',
    DEV_STATE_SYNC: 'dev_state_sync',
    DEV_UPDATE_ENTITY: 'dev_update_entity',
    DEV_DELETE_ENTITY: 'dev_delete_entity',
    DEV_UPDATE_DEFINITION: 'dev_update_definition',
    DEV_EXEC_CODE: 'dev_exec_code',
    DEV_EXEC_RESULT: 'dev_exec_result',
} as const;

// Sandbox Content Schema
export interface Action {
    opcode: string;
    params?: Record<string, any>;
}

export interface Behavior {
    onTick?: Action[];
    onSpawn?: Action[];
}

export interface EntityDef {
    type: string;
    color: string;
    radius: number;
    speed?: number;
    behavior?: Behavior;
}

export interface ContentPack {
    definitions: Record<string, EntityDef>;
}

export interface PlayerJoinData {
    nickname: string;
    color: string;
}

export interface PlayerInput {
    up: boolean;
    down: boolean;
    left: boolean;
    right: boolean;
}

// Dev Tools Types
export interface DevState {
    entities: Record<string, EntityState>;
    definitions: Record<string, EntityDef>;
    config: Record<string, any>;
}
