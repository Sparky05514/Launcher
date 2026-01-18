import { Socket } from 'socket.io-client';
import { SOCKET_EVENTS, EntityState, EntityDef, DevState } from '../shared/types';

export class DevPanel {
    private container: HTMLDivElement;
    private isVisible = false;
    private socket: Socket;
    private devState: DevState | null = null;
    private selectedEntityId: string | null = null;
    private activeTab: 'entities' | 'definitions' | 'repl' | 'config' = 'entities';
    private replHistory: string[] = [];

    constructor(socket: Socket) {
        this.socket = socket;
        this.container = this.createContainer();
        document.body.appendChild(this.container);
        this.setupSocketListeners();
        this.setupKeyboardShortcut();
    }

    private createContainer(): HTMLDivElement {
        const container = document.createElement('div');
        container.id = 'devPanel';
        container.innerHTML = `
            <div class="dev-header">
                <span class="dev-title">🛠️ Dev Tools</span>
                <button class="dev-close">×</button>
            </div>
            <div class="dev-tabs">
                <button class="dev-tab active" data-tab="entities">Entities</button>
                <button class="dev-tab" data-tab="definitions">Definitions</button>
                <button class="dev-tab" data-tab="repl">REPL</button>
                <button class="dev-tab" data-tab="config">Config</button>
            </div>
            <div class="dev-content">
                <div class="dev-pane" id="pane-entities"></div>
                <div class="dev-pane" id="pane-definitions" style="display:none"></div>
                <div class="dev-pane" id="pane-repl" style="display:none">
                    <div class="repl-output"></div>
                    <div class="repl-input-container">
                        <input type="text" class="repl-input" placeholder="Enter JavaScript...">
                        <button class="repl-run">Run</button>
                    </div>
                </div>
                <div class="dev-pane" id="pane-config" style="display:none"></div>
            </div>
        `;
        container.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            width: 400px;
            max-height: 80vh;
            background: rgba(20, 20, 30, 0.95);
            border: 1px solid #444;
            border-radius: 8px;
            color: #eee;
            font-family: 'Consolas', 'Monaco', monospace;
            font-size: 12px;
            z-index: 10000;
            display: none;
            flex-direction: column;
            box-shadow: 0 4px 20px rgba(0,0,0,0.5);
        `;

        // Inject additional styles
        const style = document.createElement('style');
        style.textContent = `
            #devPanel .dev-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 8px 12px;
                background: #1a1a2e;
                border-radius: 8px 8px 0 0;
            }
            #devPanel .dev-title { font-weight: bold; font-size: 14px; }
            #devPanel .dev-close {
                background: none;
                border: none;
                color: #888;
                font-size: 18px;
                cursor: pointer;
            }
            #devPanel .dev-close:hover { color: #ff5555; }
            #devPanel .dev-tabs {
                display: flex;
                background: #16162a;
                border-bottom: 1px solid #333;
            }
            #devPanel .dev-tab {
                flex: 1;
                padding: 8px;
                background: none;
                border: none;
                color: #888;
                cursor: pointer;
                transition: all 0.2s;
            }
            #devPanel .dev-tab:hover { background: #252540; color: #fff; }
            #devPanel .dev-tab.active { background: #252540; color: #0af; border-bottom: 2px solid #0af; }
            #devPanel .dev-content { flex: 1; overflow: auto; max-height: 60vh; }
            #devPanel .dev-pane { padding: 10px; }
            #devPanel .entity-item {
                padding: 6px 10px;
                border-radius: 4px;
                cursor: pointer;
                margin-bottom: 4px;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            #devPanel .entity-item:hover { background: #333; }
            #devPanel .entity-item.selected { background: #0a4; }
            #devPanel .entity-color {
                width: 16px;
                height: 16px;
                border-radius: 50%;
                margin-right: 8px;
                display: inline-block;
            }
            #devPanel .prop-row {
                display: flex;
                margin-bottom: 6px;
                align-items: center;
            }
            #devPanel .prop-label {
                width: 80px;
                color: #888;
            }
            #devPanel .prop-input {
                flex: 1;
                background: #222;
                border: 1px solid #444;
                color: #fff;
                padding: 4px 8px;
                border-radius: 4px;
            }
            #devPanel .btn {
                background: #0af;
                border: none;
                color: #000;
                padding: 6px 12px;
                border-radius: 4px;
                cursor: pointer;
                font-weight: bold;
            }
            #devPanel .btn:hover { background: #08d; }
            #devPanel .btn-danger { background: #f55; }
            #devPanel .btn-danger:hover { background: #d33; }
            #devPanel .repl-output {
                background: #111;
                padding: 10px;
                height: 200px;
                overflow-y: auto;
                font-family: monospace;
                border-radius: 4px;
                margin-bottom: 8px;
            }
            #devPanel .repl-input-container { display: flex; gap: 8px; }
            #devPanel .repl-input { flex: 1; }
            #devPanel .repl-run { background: #0a0; }
            #devPanel .repl-line { margin: 2px 0; }
            #devPanel .repl-cmd { color: #0af; }
            #devPanel .repl-result { color: #0f0; }
            #devPanel .repl-error { color: #f55; }
            #devPanel .def-item {
                background: #1a1a2e;
                padding: 10px;
                margin-bottom: 8px;
                border-radius: 4px;
            }
            #devPanel .def-type { font-weight: bold; color: #0af; margin-bottom: 6px; }
            #devPanel textarea.behavior-editor {
                width: 100%;
                height: 80px;
                background: #111;
                border: 1px solid #333;
                color: #0f0;
                font-family: monospace;
                padding: 6px;
                resize: vertical;
            }
        `;
        document.head.appendChild(style);

        // Event listeners
        container.querySelector('.dev-close')!.addEventListener('click', () => this.hide());
        container.querySelectorAll('.dev-tab').forEach(tab => {
            tab.addEventListener('click', () => this.switchTab(tab.getAttribute('data-tab') as any));
        });

        const replInput = container.querySelector('.repl-input') as HTMLInputElement;
        const replRun = container.querySelector('.repl-run')!;
        replRun.addEventListener('click', () => this.executeRepl(replInput.value));
        replInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this.executeRepl(replInput.value);
        });

        return container;
    }

    private setupSocketListeners() {
        this.socket.on(SOCKET_EVENTS.DEV_STATE_SYNC, (state: DevState) => {
            this.devState = state;
            this.render();
        });

        this.socket.on(SOCKET_EVENTS.DEV_EXEC_RESULT, (result: { success: boolean, result?: string, error?: string }) => {
            const output = this.container.querySelector('.repl-output')!;
            if (result.success) {
                output.innerHTML += `<div class="repl-line repl-result">→ ${result.result}</div>`;
            } else {
                output.innerHTML += `<div class="repl-line repl-error">✗ ${result.error}</div>`;
            }
            output.scrollTop = output.scrollHeight;
        });
    }

    private setupKeyboardShortcut() {
        window.addEventListener('keydown', (e) => {
            if (e.key === '`' && !this.isInputFocused()) {
                e.preventDefault();
                this.toggle();
            }
        });
    }

    private isInputFocused(): boolean {
        const active = document.activeElement;
        return active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement;
    }

    public toggle() {
        if (this.isVisible) {
            this.hide();
        } else {
            this.show();
        }
    }

    public show() {
        this.isVisible = true;
        this.container.style.display = 'flex';
        this.socket.emit(SOCKET_EVENTS.DEV_GET_STATE);
    }

    public hide() {
        this.isVisible = false;
        this.container.style.display = 'none';
    }

    private switchTab(tab: 'entities' | 'definitions' | 'repl' | 'config') {
        this.activeTab = tab;
        this.container.querySelectorAll('.dev-tab').forEach(t => t.classList.remove('active'));
        this.container.querySelector(`.dev-tab[data-tab="${tab}"]`)!.classList.add('active');
        this.container.querySelectorAll('.dev-pane').forEach(p => (p as HTMLElement).style.display = 'none');
        (this.container.querySelector(`#pane-${tab}`) as HTMLElement).style.display = 'block';
        this.render();
    }

    private render() {
        if (!this.devState) return;

        switch (this.activeTab) {
            case 'entities':
                this.renderEntities();
                break;
            case 'definitions':
                this.renderDefinitions();
                break;
            case 'config':
                this.renderConfig();
                break;
        }
    }

    private renderEntities() {
        const pane = this.container.querySelector('#pane-entities')!;
        if (!this.devState) return;

        const entities = Object.values(this.devState.entities);
        let html = `<div style="margin-bottom:10px;color:#888">${entities.length} entities</div>`;

        if (this.selectedEntityId && this.devState.entities[this.selectedEntityId]) {
            const entity = this.devState.entities[this.selectedEntityId];
            html += this.renderEntityEditor(entity);
        }

        html += `<div class="entity-list">`;
        for (const entity of entities) {
            const selected = entity.id === this.selectedEntityId ? 'selected' : '';
            html += `
                <div class="entity-item ${selected}" data-id="${entity.id}">
                    <span>
                        <span class="entity-color" style="background:${entity.color || '#888'}"></span>
                        ${entity.type}
                    </span>
                    <span style="color:#666;font-size:10px">${entity.id.substring(0, 8)}</span>
                </div>
            `;
        }
        html += `</div>`;
        pane.innerHTML = html;

        // Add click handlers
        pane.querySelectorAll('.entity-item').forEach(item => {
            item.addEventListener('click', () => {
                this.selectedEntityId = item.getAttribute('data-id');
                this.render();
            });
        });

        // Add editor handlers
        this.setupEntityEditorHandlers();
    }

    private renderEntityEditor(entity: EntityState): string {
        return `
            <div style="background:#1a2a1a;padding:12px;border-radius:6px;margin-bottom:12px;border:1px solid #0a4">
                <div style="font-weight:bold;margin-bottom:10px;color:#0f0">Editing: ${entity.type}</div>
                <div class="prop-row">
                    <span class="prop-label">Color</span>
                    <input type="color" class="prop-input" id="edit-color" value="${entity.color || '#888888'}">
                </div>
                <div class="prop-row">
                    <span class="prop-label">Size</span>
                    <input type="number" class="prop-input" id="edit-size" value="${entity.size || 10}">
                </div>
                <div class="prop-row">
                    <span class="prop-label">X</span>
                    <input type="number" class="prop-input" id="edit-x" value="${Math.round(entity.pos.x)}">
                </div>
                <div class="prop-row">
                    <span class="prop-label">Y</span>
                    <input type="number" class="prop-input" id="edit-y" value="${Math.round(entity.pos.y)}">
                </div>
                <div style="display:flex;gap:8px;margin-top:10px">
                    <button class="btn" id="btn-apply">Apply</button>
                    <button class="btn btn-danger" id="btn-delete">Delete</button>
                </div>
            </div>
        `;
    }

    private setupEntityEditorHandlers() {
        const applyBtn = this.container.querySelector('#btn-apply');
        const deleteBtn = this.container.querySelector('#btn-delete');

        if (applyBtn && this.selectedEntityId) {
            applyBtn.addEventListener('click', () => {
                const color = (this.container.querySelector('#edit-color') as HTMLInputElement).value;
                const size = parseFloat((this.container.querySelector('#edit-size') as HTMLInputElement).value);
                const x = parseFloat((this.container.querySelector('#edit-x') as HTMLInputElement).value);
                const y = parseFloat((this.container.querySelector('#edit-y') as HTMLInputElement).value);

                this.socket.emit(SOCKET_EVENTS.DEV_UPDATE_ENTITY, {
                    entityId: this.selectedEntityId,
                    props: { color, size, pos: { x, y } }
                });
            });
        }

        if (deleteBtn && this.selectedEntityId) {
            deleteBtn.addEventListener('click', () => {
                this.socket.emit(SOCKET_EVENTS.DEV_DELETE_ENTITY, this.selectedEntityId);
                this.selectedEntityId = null;
            });
        }
    }

    private renderDefinitions() {
        const pane = this.container.querySelector('#pane-definitions')!;
        if (!this.devState) return;

        let html = '';
        for (const [type, def] of Object.entries(this.devState.definitions)) {
            html += `
                <div class="def-item">
                    <div class="def-type">${type}</div>
                    <div class="prop-row">
                        <span class="prop-label">Color</span>
                        <input type="color" class="prop-input def-color" data-type="${type}" value="${def.color}">
                    </div>
                    <div class="prop-row">
                        <span class="prop-label">Radius</span>
                        <input type="number" class="prop-input def-radius" data-type="${type}" value="${def.radius}">
                    </div>
                    <div>
                        <label style="color:#888">onTick Behavior:</label>
                        <textarea class="behavior-editor" data-type="${type}">${JSON.stringify(def.behavior?.onTick || [], null, 2)}</textarea>
                    </div>
                    <button class="btn" style="margin-top:8px" data-type="${type}" data-action="save-def">Save</button>
                </div>
            `;
        }

        // Add new definition form
        html += `
            <div class="def-item" style="border: 1px dashed #0af;">
                <div class="def-type">+ New Definition</div>
                <div class="prop-row">
                    <span class="prop-label">Type</span>
                    <input type="text" class="prop-input" id="new-def-type" placeholder="e.g. enemy">
                </div>
                <div class="prop-row">
                    <span class="prop-label">Color</span>
                    <input type="color" class="prop-input" id="new-def-color" value="#ff00ff">
                </div>
                <div class="prop-row">
                    <span class="prop-label">Radius</span>
                    <input type="number" class="prop-input" id="new-def-radius" value="15">
                </div>
                <button class="btn" id="btn-add-def">Add Definition</button>
            </div>
        `;

        pane.innerHTML = html;

        // Handlers
        pane.querySelectorAll('[data-action="save-def"]').forEach(btn => {
            btn.addEventListener('click', () => {
                const type = btn.getAttribute('data-type')!;
                const color = (pane.querySelector(`.def-color[data-type="${type}"]`) as HTMLInputElement).value;
                const radius = parseFloat((pane.querySelector(`.def-radius[data-type="${type}"]`) as HTMLInputElement).value);
                const behaviorText = (pane.querySelector(`.behavior-editor[data-type="${type}"]`) as HTMLTextAreaElement).value;

                let onTick = [];
                try { onTick = JSON.parse(behaviorText); } catch { }

                this.socket.emit(SOCKET_EVENTS.DEV_UPDATE_DEFINITION, {
                    type,
                    def: { type, color, radius, behavior: { onTick } }
                });
            });
        });

        pane.querySelector('#btn-add-def')?.addEventListener('click', () => {
            const type = (pane.querySelector('#new-def-type') as HTMLInputElement).value.trim();
            const color = (pane.querySelector('#new-def-color') as HTMLInputElement).value;
            const radius = parseFloat((pane.querySelector('#new-def-radius') as HTMLInputElement).value);

            if (type) {
                this.socket.emit(SOCKET_EVENTS.DEV_UPDATE_DEFINITION, {
                    type,
                    def: { type, color, radius, behavior: { onTick: [] } }
                });
            }
        });
    }

    private renderConfig() {
        const pane = this.container.querySelector('#pane-config')!;
        if (!this.devState) return;

        let html = '<div style="color:#888;margin-bottom:10px">Game Configuration (read-only for now)</div>';
        for (const [key, value] of Object.entries(this.devState.config)) {
            html += `
                <div class="prop-row">
                    <span class="prop-label" style="width:150px">${key}</span>
                    <input type="text" class="prop-input" value="${value}" readonly>
                </div>
            `;
        }
        pane.innerHTML = html;
    }

    private executeRepl(code: string) {
        if (!code.trim()) return;

        const input = this.container.querySelector('.repl-input') as HTMLInputElement;
        const output = this.container.querySelector('.repl-output')!;

        output.innerHTML += `<div class="repl-line repl-cmd">&gt; ${code}</div>`;
        this.replHistory.push(code);

        this.socket.emit(SOCKET_EVENTS.DEV_EXEC_CODE, code);
        input.value = '';
    }

    public selectEntity(entityId: string) {
        this.selectedEntityId = entityId;
        if (!this.isVisible) this.show();
        this.switchTab('entities');
    }
}
