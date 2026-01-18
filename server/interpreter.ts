import { Action, EntityState, EntityDef, Vector2 } from '../shared/types';
import { GAME_CONFIG } from '../shared/config';

export interface InterpreterContext {
    allEntities: Map<string, EntityState>;
    playerEntities: Set<string>;
    toDestroy: Set<string>;
}

export class SandboxInterpreter {
    private context: InterpreterContext | null = null;

    public setContext(ctx: InterpreterContext) {
        this.context = ctx;
    }

    public execute(entity: EntityState, actions: Action[], deltaTime: number) {
        for (const action of actions) {
            this.runOpcode(entity, action, deltaTime);
        }
    }

    private runOpcode(entity: EntityState, action: Action, deltaTime: number) {
        const params = action.params || {};

        switch (action.opcode) {
            case 'random_walk':
                this.opRandomWalk(entity, params, deltaTime);
                break;
            case 'move_dir':
                this.opMoveDir(entity, params, deltaTime);
                break;
            case 'follow':
                this.opFollow(entity, params, deltaTime);
                break;
            case 'flee':
                this.opFlee(entity, params, deltaTime);
                break;
            case 'orbit':
                this.opOrbit(entity, params, deltaTime);
                break;
            case 'damage':
                this.opDamage(entity, params);
                break;
            case 'destroy_self':
                this.opDestroySelf(entity);
                break;
            default:
                break;
        }
    }

    private opRandomWalk(entity: EntityState, params: any, deltaTime: number) {
        const speed = params.speed || 50;
        const moveAmt = speed * (deltaTime / 1000);
        entity.pos.x += (Math.random() - 0.5) * moveAmt;
        entity.pos.y += (Math.random() - 0.5) * moveAmt;
        this.clampToWorld(entity);
    }

    private opMoveDir(entity: EntityState, params: any, deltaTime: number) {
        const speed = params.speed || 50;
        const dir = params.dir || { x: 1, y: 0 };
        const moveAmt = speed * (deltaTime / 1000);
        entity.pos.x += dir.x * moveAmt;
        entity.pos.y += dir.y * moveAmt;
        this.wrapWorld(entity);
    }

    private opFollow(entity: EntityState, params: any, deltaTime: number) {
        if (!this.context) return;
        const speed = params.speed || 100;
        const target = this.findTarget(entity, params.target || 'player');
        if (!target) return;

        const dx = target.pos.x - entity.pos.x;
        const dy = target.pos.y - entity.pos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 1) return;

        const moveAmt = speed * (deltaTime / 1000);
        entity.pos.x += (dx / dist) * moveAmt;
        entity.pos.y += (dy / dist) * moveAmt;
        this.clampToWorld(entity);
    }

    private opFlee(entity: EntityState, params: any, deltaTime: number) {
        if (!this.context) return;
        const speed = params.speed || 100;
        const target = this.findTarget(entity, 'player');
        if (!target) return;

        const dx = entity.pos.x - target.pos.x;
        const dy = entity.pos.y - target.pos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 1) return;

        const moveAmt = speed * (deltaTime / 1000);
        entity.pos.x += (dx / dist) * moveAmt;
        entity.pos.y += (dy / dist) * moveAmt;
        this.clampToWorld(entity);
    }

    private opOrbit(entity: EntityState, params: any, deltaTime: number) {
        if (!this.context) return;
        const speed = params.speed || 50;
        const radius = params.radius || 100;
        const target = this.findTarget(entity, params.target || 'player');
        if (!target) return;

        // Simple orbit using angle over time
        const angle = (Date.now() / 1000) * speed * 0.01;
        entity.pos.x = target.pos.x + Math.cos(angle) * radius;
        entity.pos.y = target.pos.y + Math.sin(angle) * radius;
    }

    private opDamage(entity: EntityState, params: any) {
        // Called during collision - entity is the one taking damage
        const amount = params.amount || 10;
        if (entity.health !== undefined) {
            entity.health -= amount;
            if (entity.health <= 0) {
                this.context?.toDestroy.add(entity.id);
            }
        }
    }

    private opDestroySelf(entity: EntityState) {
        this.context?.toDestroy.add(entity.id);
    }

    private findTarget(entity: EntityState, targetType: string): EntityState | null {
        if (!this.context) return null;

        if (targetType === 'player') {
            // Find nearest player
            let nearest: EntityState | null = null;
            let minDist = Infinity;
            for (const playerId of this.context.playerEntities) {
                const player = this.context.allEntities.get(playerId);
                if (!player) continue;
                const dist = this.distance(entity.pos, player.pos);
                if (dist < minDist) {
                    minDist = dist;
                    nearest = player;
                }
            }
            return nearest;
        }
        return null;
    }

    private distance(a: Vector2, b: Vector2): number {
        return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
    }

    private clampToWorld(entity: EntityState) {
        entity.pos.x = Math.max(0, Math.min(GAME_CONFIG.WORLD_WIDTH, entity.pos.x));
        entity.pos.y = Math.max(0, Math.min(GAME_CONFIG.WORLD_HEIGHT, entity.pos.y));
    }

    private wrapWorld(entity: EntityState) {
        if (entity.pos.x > GAME_CONFIG.WORLD_WIDTH) entity.pos.x = 0;
        if (entity.pos.x < 0) entity.pos.x = GAME_CONFIG.WORLD_WIDTH;
        if (entity.pos.y > GAME_CONFIG.WORLD_HEIGHT) entity.pos.y = 0;
        if (entity.pos.y < 0) entity.pos.y = GAME_CONFIG.WORLD_HEIGHT;
    }
}
