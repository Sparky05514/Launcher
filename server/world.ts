import { EntityState, WorldState, Vector2, ContentPack, EntityDef, PlayerInput } from '../shared/types';
import { GAME_CONFIG, WORLD_BOUNDS } from '../shared/config';
import { v4 as uuidv4 } from 'uuid';
import { SandboxInterpreter } from './interpreter';

export class WorldManager {
    private entities: Map<string, EntityState> = new Map();
    private definitions: Map<string, EntityDef> = new Map();
    private interpreter: SandboxInterpreter;
    private playerInputs: Map<string, PlayerInput> = new Map();

    constructor() {
        this.interpreter = new SandboxInterpreter();

        // Load default content
        this.loadContent({
            definitions: {
                'blob': {
                    type: 'blob',
                    color: 'red',
                    radius: 15,
                    behavior: {
                        onTick: [
                            { opcode: 'random_walk', params: { speed: 100 } }
                        ]
                    }
                },
                'runner': {
                    type: 'runner',
                    color: 'cyan',
                    radius: 10,
                    behavior: {
                        onTick: [
                            { opcode: 'move_dir', params: { speed: 200, dir: { x: 1, y: 0 } } }
                        ]
                    }
                }
            }
        });

        // No auto test entities - players spawn themselves
    }

    public loadContent(pack: ContentPack) {
        console.log('Loading content pack...');
        for (const [key, def] of Object.entries(pack.definitions)) {
            this.definitions.set(key, def);
            console.log(`Loaded definition: ${key}`);
        }
    }

    public spawnEntity(type: string, pos: Vector2): string {
        const def = this.definitions.get(type);
        if (!def) {
            console.warn(`Unknown entity type: ${type}`);
            return '';
        }

        const id = uuidv4();
        const entity: EntityState = {
            id,
            type,
            pos: { ...pos },
            color: def.color,
            size: def.radius
        };

        if (def.behavior?.onSpawn) {
            this.interpreter.execute(entity, def.behavior.onSpawn, 0);
        }

        this.entities.set(id, entity);
        return id;
    }

    public spawnPlayer(nickname: string, color: string): string {
        const id = uuidv4();
        const entity: EntityState = {
            id,
            type: nickname, // Use nickname as the "type" for display
            pos: {
                x: Math.random() * (GAME_CONFIG.WORLD_WIDTH - 100) + 50,
                y: Math.random() * (GAME_CONFIG.WORLD_HEIGHT - 100) + 50
            },
            color: color,
            size: GAME_CONFIG.PLAYER_SIZE
        };
        this.entities.set(id, entity);
        return id;
    }

    public setPlayerInput(entityId: string, input: PlayerInput) {
        this.playerInputs.set(entityId, input);
    }

    public removeEntity(id: string) {
        this.entities.delete(id);
        this.playerInputs.delete(id);
    }

    public getState(): WorldState {
        const entitiesRecord: Record<string, EntityState> = {};
        this.entities.forEach((e, id) => {
            entitiesRecord[id] = e;
        });
        return {
            entities: entitiesRecord,
            timestamp: Date.now()
        };
    }

    public tick(deltaTime: number) {
        const moveAmt = GAME_CONFIG.PLAYER_SPEED * (deltaTime / 1000);

        // Handle player movement
        this.playerInputs.forEach((input, entityId) => {
            const entity = this.entities.get(entityId);
            if (entity) {
                if (input.up) entity.pos.y -= moveAmt;
                if (input.down) entity.pos.y += moveAmt;
                if (input.left) entity.pos.x -= moveAmt;
                if (input.right) entity.pos.x += moveAmt;

                // Keep in bounds using centralized bounds
                entity.pos.x = Math.max(WORLD_BOUNDS.minX, Math.min(WORLD_BOUNDS.maxX, entity.pos.x));
                entity.pos.y = Math.max(WORLD_BOUNDS.minY, Math.min(WORLD_BOUNDS.maxY, entity.pos.y));
            }
        });

        // Handle NPC behaviors
        this.entities.forEach(entity => {
            const def = this.definitions.get(entity.type);
            if (def && def.behavior?.onTick) {
                this.interpreter.execute(entity, def.behavior.onTick, deltaTime);
            }
        });
    }
}

