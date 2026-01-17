import { EntityState, WorldState, Vector2, ContentPack, EntityDef } from '../shared/types';
import { v4 as uuidv4 } from 'uuid';
import { SandboxInterpreter } from './interpreter';

export class WorldManager {
    private entities: Map<string, EntityState> = new Map();
    private definitions: Map<string, EntityDef> = new Map();
    private interpreter: SandboxInterpreter;

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

        // Spawn test entities
        this.spawnEntity('blob', { x: 400, y: 300 });
        this.spawnEntity('runner', { x: 100, y: 100 });
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
            pos: { ...pos }, // copy
            color: def.color,
            size: def.radius
        };

        // Run onSpawn if exists
        if (def.behavior?.onSpawn) {
            this.interpreter.execute(entity, def.behavior.onSpawn, 0);
        }

        this.entities.set(id, entity);
        return id;
    }

    public removeEntity(id: string) {
        this.entities.delete(id);
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
        this.entities.forEach(entity => {
            const def = this.definitions.get(entity.type);
            if (def && def.behavior?.onTick) {
                this.interpreter.execute(entity, def.behavior.onTick, deltaTime);
            }
        });
    }
}
