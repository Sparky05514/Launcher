import { Action, EntityState, EntityDef } from '../shared/types';

export class SandboxInterpreter {

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
            default:
                // Unknown opcode, ignore safely
                break;
        }
    }

    private opRandomWalk(entity: EntityState, params: any, deltaTime: number) {
        const speed = params.speed || 50;
        // Simple jitter for now, or persist a velocity in entity state if we expanded it
        // To be deterministic and smooth, we should probably have velocity. 
        // But for minimal requirement:
        const moveAmt = speed * (deltaTime / 1000);
        entity.pos.x += (Math.random() - 0.5) * moveAmt;
        entity.pos.y += (Math.random() - 0.5) * moveAmt;
    }

    private opMoveDir(entity: EntityState, params: any, deltaTime: number) {
        const speed = params.speed || 50;
        const dir = params.dir || { x: 1, y: 0 };
        const moveAmt = speed * (deltaTime / 1000);
        entity.pos.x += dir.x * moveAmt;
        entity.pos.y += dir.y * moveAmt;

        // Wrap around world
        if (entity.pos.x > 800) entity.pos.x = 0;
        if (entity.pos.x < 0) entity.pos.x = 800;
        if (entity.pos.y > 600) entity.pos.y = 0;
        if (entity.pos.y < 0) entity.pos.y = 600;
    }
}
