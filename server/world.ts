import { EntityState, WorldState, Vector2, ContentPack, EntityDef, PlayerInput } from '../shared/types';
import { GAME_CONFIG, WORLD_BOUNDS } from '../shared/config';
import { v4 as uuidv4 } from 'uuid';
import { SandboxInterpreter, InterpreterContext } from './interpreter';

export class WorldManager {
    private entities: Map<string, EntityState> = new Map();
    private definitions: Map<string, EntityDef> = new Map();
    private interpreter: SandboxInterpreter;
    private worldSpeed: number = 1.0;
    private playerEntityIds: Set<string> = new Set();

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

    public getDefinitions(): Record<string, EntityDef> {
        const result: Record<string, EntityDef> = {};
        this.definitions.forEach((def, key) => {
            result[key] = def;
        });
        return result;
    }

    public updateEntityProperties(entityId: string, props: Partial<EntityState>): boolean {
        const entity = this.entities.get(entityId);
        if (!entity) return false;

        if (props.pos) entity.pos = { ...props.pos };
        if (props.color !== undefined) entity.color = props.color;
        if (props.size !== undefined) entity.size = props.size;
        if (props.type !== undefined) entity.type = props.type;

        return true;
    }

    public updateDefinition(type: string, def: EntityDef) {
        this.definitions.set(type, def);
        console.log(`[Dev] Updated definition: ${type}`);
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
            size: def.radius,
            visual: def.visual,
            health: def.health,
            maxHealth: def.health
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
            type: nickname,
            pos: {
                x: Math.random() * (GAME_CONFIG.WORLD_WIDTH - 100) + 50,
                y: Math.random() * (GAME_CONFIG.WORLD_HEIGHT - 100) + 50
            },
            color: color,
            size: GAME_CONFIG.PLAYER_SIZE,
            health: 100,
            maxHealth: 100
        };
        this.entities.set(id, entity);
        this.playerEntityIds.add(id);
        return id;
    }

    public setPlayerPosition(entityId: string, pos: Vector2) {
        const entity = this.entities.get(entityId);
        if (entity) {
            entity.pos = { ...pos };
        }
    }

    public setChatMessage(entityId: string, message: string) {
        const entity = this.entities.get(entityId);
        if (entity) {
            entity.chatMessage = message;
            entity.chatTimer = GAME_CONFIG.CHAT_DURATION_SEC;
        }
    }

    public removeEntity(id: string) {
        this.entities.delete(id);
        this.playerEntityIds.delete(id);
    }

    public clearExcept(keepIds: Set<string>) {
        const idsToRemove: string[] = [];
        this.entities.forEach((_, id) => {
            if (!keepIds.has(id)) {
                idsToRemove.push(id);
            }
        });
        idsToRemove.forEach(id => this.entities.delete(id));
    }

    public setWorldSpeed(speed: number) {
        this.worldSpeed = speed;
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
        const deltaSec = (deltaTime * this.worldSpeed) / 1000;
        const toDestroy: Set<string> = new Set();

        // Set up interpreter context
        const ctx: InterpreterContext = {
            allEntities: this.entities,
            playerEntities: this.playerEntityIds,
            toDestroy
        };
        this.interpreter.setContext(ctx);

        // Collision detection
        const entityList = Array.from(this.entities.values());
        for (let i = 0; i < entityList.length; i++) {
            for (let j = i + 1; j < entityList.length; j++) {
                const a = entityList[i];
                const b = entityList[j];
                const dx = a.pos.x - b.pos.x;
                const dy = a.pos.y - b.pos.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const minDist = (a.size || 10) + (b.size || 10);

                if (dist < minDist) {
                    // Collision! Execute onCollision behaviors
                    const defA = this.definitions.get(a.type);
                    const defB = this.definitions.get(b.type);

                    if (defA?.behavior?.onCollision) {
                        // A's collision behavior affects B
                        this.interpreter.execute(b, defA.behavior.onCollision, deltaTime);
                    }
                    if (defB?.behavior?.onCollision) {
                        // B's collision behavior affects A
                        this.interpreter.execute(a, defB.behavior.onCollision, deltaTime);
                    }
                }
            }
        }

        // Handle NPC behaviors and Chat expiration
        this.entities.forEach(entity => {
            // Expire chat
            if (entity.chatTimer !== undefined) {
                entity.chatTimer -= deltaSec / this.worldSpeed;
                if (entity.chatTimer <= 0) {
                    delete entity.chatMessage;
                    delete entity.chatTimer;
                }
            }

            const def = this.definitions.get(entity.type);
            if (def && def.behavior?.onTick) {
                this.interpreter.execute(entity, def.behavior.onTick, deltaTime * this.worldSpeed);
            }
        });

        // Cleanup destroyed entities
        for (const id of toDestroy) {
            this.entities.delete(id);
            this.playerEntityIds.delete(id);
        }
    }
}

