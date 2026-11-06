import { observeResize, tokenAliases } from "@catalystcommunity/base-components";
import { ShadowContainer, clamp, focusRing, smallButton, uid } from "./shared.js";

const MIN_WIDTH = 160;
const MIN_HEIGHT = 96;
const STEP = 10;
const STATES = ['normal', 'minimized', 'maximized'];

// A window in a window area. The user moves it by its title bar and changes its size by its
// corner. The handle button (⠿) and the keys Alt+F7 and Alt+F8 do the same with clicks or keys.
export class FloatingWindow extends ShadowContainer {
    static renderTiming = 'frame';
    static properties = {
        label: {type: String, default: ''},
        x: {type: Number, default: 16},
        y: {type: Number, default: 16},
        width: {type: Number, default: 320},
        height: {type: Number, default: 220},
        state: {type: String, default: 'normal', reflect: true},
        active: {type: Boolean, reflect: true},
        labels: {type: Object, attribute: false},
    };
    static labels = {
        handle: 'Move or resize',
        minimize: 'Minimize',
        maximize: 'Maximize',
        restore: 'Restore',
        close: 'Close',
        moveHint: 'Move: use the arrow keys, or select a place in the area. Enter keeps it, Escape cancels.',
        sizeHint: 'Size: use the arrow keys, or select the new corner in the area. Enter keeps it, Escape cancels.',
    };
    static shadowHtml = `
<div class="window" part="window" role="dialog">
  <div class="titlebar" part="titlebar">
    <button type="button" class="handle" part="handle" aria-pressed="false">⠿</button>
    <span class="title"></span>
    <button type="button" class="minimize" part="minimize"></button>
    <button type="button" class="maximize" part="maximize"></button>
    <button type="button" class="close" part="close">×</button>
  </div>
  <div class="hint" part="hint" role="status"></div>
  <div class="content" part="content"><slot></slot></div>
  <div class="corner" part="corner" aria-hidden="true"></div>
</div>`;
    static styles = `
:host {
    position: absolute;
    box-sizing: border-box;
    display: block;
    min-width: 0;
}
:host([hidden]) {
    display: none;
}
.window {
    ${tokenAliases('floating-window', 'window')}
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    color: var(--_window-text);
    background: var(--_window);
    border: var(--_border-width) solid var(--_border);
    border-radius: var(--_radius);
    box-shadow: 0 0.25em 1em rgb(0 0 0 / 0.2);
    overflow: hidden;
}
:host([active]) .window {
    box-shadow: 0 0.5em 1.5em rgb(0 0 0 / 0.35);
    border-color: var(--_highlight);
}
.titlebar {
    display: flex;
    align-items: center;
    gap: 2px;
    flex: none;
    min-height: 2em;
    padding: 2px;
    color: var(--_face-text);
    background-color: var(--_face);
    background-image: var(--_fill);
    border-block-end: var(--_border-width) solid var(--_line);
    cursor: move;
    touch-action: none;
    user-select: none;
}
/* The active window has a highlight title bar and a bold title, so that color is not the only sign */
:host([active]) .titlebar {
    color: var(--_highlight-text);
    background: var(--_highlight);
}
:host([active]) .title {
    font-weight: bold;
}
.title {
    flex: 1;
    min-width: 0;
    padding-inline: 0.25em;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
}
${smallButton('.titlebar button')}
.titlebar button {
    cursor: pointer;
}
.handle[aria-pressed="true"] {
    background: var(--_window);
    color: var(--_window-text);
    border-color: var(--_border);
}
.hint {
    flex: none;
    padding: 0.25em 0.5em;
    font-size: 0.875em;
    border-block-end: var(--_border-width) dashed var(--_focus);
}
.hint:empty {
    display: none;
}
.content {
    flex: 1;
    min-height: 0;
    overflow: auto;
    padding: var(--_gap);
}
:host([state="minimized"]) .content, :host([state="minimized"]) .corner {
    display: none;
}
:host([state="maximized"]) .window {
    border-radius: 0;
}
.corner {
    position: absolute;
    right: 0;
    bottom: 0;
    width: 24px;
    height: 24px;
    cursor: nwse-resize;
    touch-action: none;
    background: linear-gradient(135deg, transparent 0 55%, var(--_border) 55% 62%, transparent 62% 72%, var(--_border) 72% 79%, transparent 79%);
}
:host([state="maximized"]) .corner {
    display: none;
}
${focusRing}
`;
    #mode = null;
    #before = null;
    #endPlacing = null;
    #restore = null;

    get area() {
        return this.parentElement instanceof WindowArea ? this.parentElement : null;
    }
    get mode() {
        return this.#mode;
    }

    built() {
        const title = this.part('.title');
        title.id = uid('window-title');
        this.part('.window').setAttribute('aria-labelledby', title.id);
        this.part('.handle').addEventListener('click', () => this.#cycleMode());
        this.part('.minimize').addEventListener('click', () => this.#userState(this.state === 'minimized' ? 'normal' : 'minimized'));
        this.part('.maximize').addEventListener('click', () => this.#userState(this.state === 'maximized' ? 'normal' : 'maximized'));
        this.part('.close').addEventListener('click', () => this.#userClose());
        const titlebar = this.part('.titlebar');
        titlebar.addEventListener('dblclick', (e) => {
            if (!e.target.closest('button')) { this.#userState(this.state === 'maximized' ? 'normal' : 'maximized'); }
        });
        titlebar.addEventListener('pointerdown', (e) => {
            if (e.target.closest('button') || this.state === 'maximized') { return; }
            this.#drag(e, titlebar, 'move');
        });
        const corner = this.part('.corner');
        corner.addEventListener('pointerdown', (e) => this.#drag(e, corner, 'size'));
        this.root.addEventListener('keydown', (e) => this.#onKeydown(e));
    }

    connected() {
        this.own(() => this.#stopMode(false));
    }

    // Closes the window, and sends no event
    close() {
        const area = this.area;
        this.remove();
        area?.focusTop();
    }

    // Moves and sizes the window in the area, and keeps it in the area
    setGeometry({x = this.x, y = this.y, width = this.width, height = this.height} = {}) {
        const room = this.#room();
        width = clamp(width, MIN_WIDTH, room.width);
        height = clamp(height, MIN_HEIGHT, room.height);
        this.width = Math.round(width);
        this.height = Math.round(height);
        this.x = Math.round(clamp(x, 0, room.width - width));
        this.y = Math.round(clamp(y, 0, room.height - height));
    }

    #room() {
        const area = this.area;
        const width = area?.clientWidth || Infinity;
        const height = area?.clientHeight || Infinity;
        return {width, height};
    }
    #geometry() {
        return {x: this.x, y: this.y, width: this.width, height: this.height};
    }

    #userState(state) {
        if (state === this.state) { return; }
        if (this.#mode) { this.#stopMode(true); }
        this.state = state;
        this.emit('floating-window-state', {state});
        this.area?.arrange();
    }

    #userClose() {
        if (!this.emit('floating-window-close', {label: this.label}, {cancelable: true})) { return; }
        this.close();
    }

    #drag(e, handle, kind) {
        if (e.button !== 0) { return; }
        e.preventDefault();
        this.area?.activate(this);
        if (this.state === 'minimized' && kind === 'move') { return; }
        handle.setPointerCapture?.(e.pointerId);
        const start = {px: e.clientX, py: e.clientY, ...this.#geometry()};
        let moved = false;
        const move = (event) => {
            moved = true;
            const dx = event.clientX - start.px;
            const dy = event.clientY - start.py;
            if (kind === 'move') {
                this.setGeometry({x: start.x + dx, y: start.y + dy});
            } else {
                this.setGeometry({width: start.width + dx, height: start.height + dy});
            }
        };
        const end = () => {
            handle.removeEventListener('pointermove', move);
            handle.removeEventListener('pointerup', end);
            handle.removeEventListener('pointercancel', end);
            if (moved) { this.emit(kind === 'move' ? 'floating-window-move' : 'floating-window-resize', this.#geometry()); }
        };
        handle.addEventListener('pointermove', move);
        handle.addEventListener('pointerup', end);
        handle.addEventListener('pointercancel', end);
    }

    // The handle goes from move, to size, to off. After the last step, the change is kept.
    #cycleMode() {
        if (!this.#mode) { this.#startMode('move'); }
        else if (this.#mode === 'move') { this.#startMode('size'); }
        else { this.#stopMode(true); }
    }

    #startMode(mode) {
        if (this.state !== 'normal') {
            this.state = 'normal';
            this.area?.arrange();
        }
        this.#before ??= this.#geometry();
        this.#mode = mode;
        this.area?.activate(this);
        // A click in the area puts the window there. A click in the window itself does nothing.
        this.#endPlacing?.();
        const area = this.area;
        if (area) {
            const place = (e) => {
                if (e.composedPath().includes(this) || e.button !== 0) { return; }
                e.preventDefault();
                e.stopPropagation();
                const rect = area.getBoundingClientRect();
                const px = e.clientX - rect.left - area.clientLeft;
                const py = e.clientY - rect.top - area.clientTop;
                if (this.#mode === 'move') { this.setGeometry({x: px, y: py}); }
                else { this.setGeometry({width: px - this.x, height: py - this.y}); }
                this.#stopMode(true);
                this.part('.handle').focus();
            };
            area.addEventListener('pointerdown', place, true);
            this.#endPlacing = () => area.removeEventListener('pointerdown', place, true);
        }
        this.invalidate();
    }

    #stopMode(keep) {
        if (!this.#mode) { return; }
        const mode = this.#mode;
        this.#mode = null;
        this.#endPlacing?.();
        this.#endPlacing = null;
        const before = this.#before;
        this.#before = null;
        if (!keep && before) {
            this.setGeometry(before);
        } else if (before && (before.x !== this.x || before.y !== this.y || before.width !== this.width || before.height !== this.height)) {
            this.emit(mode === 'move' ? 'floating-window-move' : 'floating-window-resize', this.#geometry());
        }
        this.invalidate();
    }

    #onKeydown(e) {
        if (e.altKey && (e.key === 'F7' || e.key === 'F8')) {
            e.preventDefault();
            this.#startMode(e.key === 'F7' ? 'move' : 'size');
            this.part('.handle').focus();
            return;
        }
        if (!this.#mode) { return; }
        const step = e.shiftKey ? 1 : STEP;
        const arrows = {ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step]};
        if (e.key in arrows) {
            const [dx, dy] = arrows[e.key];
            if (this.#mode === 'move') { this.setGeometry({x: this.x + dx, y: this.y + dy}); }
            else { this.setGeometry({width: this.width + dx, height: this.height + dy}); }
        } else if (e.key === 'Enter') {
            this.#stopMode(true);
        } else if (e.key === 'Escape') {
            this.#stopMode(false);
        } else {
            return;
        }
        e.preventDefault();
        e.stopPropagation();
    }

    render() {
        const state = STATES.includes(this.state) ? this.state : 'normal';
        this.part('.title').textContent = this.label;
        const handle = this.part('.handle');
        handle.setAttribute('aria-label', this.text('handle'));
        handle.title = this.text('handle');
        handle.setAttribute('aria-pressed', String(Boolean(this.#mode)));
        handle.setAttribute('aria-keyshortcuts', 'Alt+F7 Alt+F8');
        const minimize = this.part('.minimize');
        const maximize = this.part('.maximize');
        minimize.textContent = state === 'minimized' ? '▭' : '–';
        minimize.setAttribute('aria-label', this.text(state === 'minimized' ? 'restore' : 'minimize'));
        minimize.title = minimize.getAttribute('aria-label');
        maximize.textContent = state === 'maximized' ? '❐' : '□';
        maximize.setAttribute('aria-label', this.text(state === 'maximized' ? 'restore' : 'maximize'));
        maximize.title = maximize.getAttribute('aria-label');
        const close = this.part('.close');
        close.setAttribute('aria-label', this.text('close'));
        close.title = this.text('close');
        this.part('.hint').textContent = this.#mode ? this.text(`${this.#mode}Hint`) : '';

        const style = this.style;
        if (state === 'maximized') {
            Object.assign(style, {left: '0', top: '0', right: '', bottom: '', width: '100%', height: '100%'});
        } else if (state === 'minimized') {
            const minimized = this.area?.windows.filter(win => win.state === 'minimized') ?? [this];
            const index = Math.max(0, minimized.indexOf(this));
            Object.assign(style, {left: `calc(${index} * 13em)`, top: 'auto', right: '', bottom: '0', width: '12em', height: 'auto'});
        } else {
            Object.assign(style, {left: `${this.x}px`, top: `${this.y}px`, right: '', bottom: '', width: `${this.width}px`, height: `${this.height}px`});
        }
    }
}

// The area of a multiple document interface. It holds floating windows, keeps them in the area,
// and puts the active window on top.
export class WindowArea extends ShadowContainer {
    static properties = {
        label: {type: String, default: ''},
    };
    static shadowHtml = `<div class="area" part="area"><slot></slot></div>`;
    static styles = `
:host {
    position: relative;
    display: block;
    box-sizing: border-box;
    min-width: 0;
    min-height: var(--zest-window-area-min-height, 24em);
    overflow: hidden;
    contain: layout paint;
    background: var(--zest-window-area-face, color-mix(in srgb, var(--zest-color-face, ButtonFace) 70%, var(--zest-color-window, Canvas)));
    border: var(--zest-border-width, 1px) solid color-mix(in srgb, var(--zest-color-border, ButtonBorder) 45%, transparent);
    border-radius: var(--zest-control-radius, 0.375em);
}
:host([hidden]) {
    display: none;
}
.area {
    position: absolute;
    inset: 0;
}
`;
    #order = [];

    get windows() {
        return [...this.children].filter(child => child instanceof FloatingWindow);
    }
    get activeWindow() {
        return this.windows.find(win => win.active) ?? null;
    }

    built() {
        this.part('slot').addEventListener('slotchange', () => this.#restack());
        this.addEventListener('pointerdown', (e) => this.#activateFrom(e), true);
        this.addEventListener('focusin', (e) => this.#activateFrom(e));
    }

    connected() {
        this.own(observeResize(this, () => {
            for (const win of this.windows) { win.setGeometry(); }
        }));
    }

    #activateFrom(e) {
        const win = e.composedPath().find(node => node instanceof FloatingWindow && node.parentElement === this);
        if (win) { this.activate(win); }
    }

    // Puts the window on top, and makes it the active window
    activate(win) {
        if (!this.windows.includes(win)) { return; }
        if (win.active && this.#order.at(-1) === win) { return; }
        this.#order = [...this.#order.filter(other => other !== win && other.parentElement === this), win];
        this.#restack();
        this.emit('window-area-activate', {window: win, label: win.label});
    }

    // Gives the focus to the window on top
    focusTop() {
        const top = this.#order.filter(win => win.parentElement === this).at(-1) ?? this.windows.at(-1);
        if (!top) { return; }
        this.activate(top);
        top.shadowRoot?.querySelector('.handle')?.focus();
    }

    // Puts the minimized windows in a row at the bottom
    arrange() {
        for (const win of this.windows) { win.invalidate(); }
    }

    #restack() {
        const windows = this.windows;
        this.#order = [...this.#order.filter(win => windows.includes(win)), ...windows.filter(win => !this.#order.includes(win))];
        const top = this.#order.at(-1);
        this.#order.forEach((win, i) => {
            win.style.zIndex = String(i + 1);
            win.active = win === top;
        });
    }

    // Puts the windows one over the other, each a step lower and to the right
    cascade() {
        const step = 32;
        const width = this.clientWidth * 0.6;
        const height = this.clientHeight * 0.6;
        this.#order.filter(win => win.parentElement === this).forEach((win, i) => {
            win.state = 'normal';
            win.setGeometry({x: i * step, y: i * step, width, height});
        });
        this.arrange();
    }

    // Puts the windows side by side in a grid, so that all of them show
    tile() {
        const windows = this.windows;
        if (!windows.length) { return; }
        const columns = Math.ceil(Math.sqrt(windows.length));
        const rows = Math.ceil(windows.length / columns);
        const width = this.clientWidth / columns;
        const height = this.clientHeight / rows;
        windows.forEach((win, i) => {
            win.state = 'normal';
            win.setGeometry({x: (i % columns) * width, y: Math.floor(i / columns) * height, width, height});
        });
        this.arrange();
    }

    render() {
        if (this.label) {
            this.setAttribute('role', 'group');
            this.setAttribute('aria-label', this.label);
        }
    }
}
