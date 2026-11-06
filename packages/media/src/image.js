import { BaseComponent, observeResize, tokenAliases } from "@catalystcommunity/base-components";

// An image that the user can zoom and move. A zoom of 1 is the fit size. The keys and the pointer do
// the same things, so a user does not need a drag or a wheel.

const DEFAULT_LABELS = {
    tools: 'Image tools',
    zoomIn: 'Zoom in',
    zoomOut: 'Zoom out',
    fit: 'Fit',
    contain: 'Show all',
    cover: 'Fill',
    actual: 'Actual size',
    zoom: (percent) => `${percent}%`,
    help: 'Use plus and minus to zoom, zero to reset, and the arrow keys to move.',
};

const imageStyles = `
image-view, :host {
    display: block;
    min-width: 0;
}
.zest-image-view {
    ${tokenAliases('image-view')}
    /* --zest-image-view-height is the height of the image, so it cannot be the height of the buttons */
    --_height: var(--zest-image-view-control-height, var(--zest-control-height, 2.5em));
    display: flex;
    flex-direction: column;
    min-width: 0;
    color: var(--_face-text);
    background: var(--_face);
    border: var(--_border-width) solid var(--_border);
    border-radius: var(--_radius);
    overflow: hidden;
}
.zest-image-view .tools {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.25em;
    padding: 0.25em;
}
.zest-image-view button {
    box-sizing: border-box;
    min-width: max(24px, var(--_height));
    min-height: max(24px, var(--_height));
    padding: 0 0.5em;
    font: inherit;
    color: inherit;
    background-color: var(--_face);
    background-image: var(--_fill);
    border: var(--_border-width) solid var(--_border);
    border-radius: var(--_radius);
    cursor: pointer;
}
.zest-image-view button:hover {
    background-image: none;
    border-color: var(--_highlight);
}
.zest-image-view button[aria-pressed="true"] {
    background: var(--_selected-face);
    color: var(--_selected-text);
    font-weight: bold;
}
.zest-image-view .level {
    min-width: 3.5em;
    text-align: center;
    font-variant-numeric: tabular-nums;
}
.zest-image-view .viewport {
    position: relative;
    height: var(--zest-image-view-height, 20em);
    overflow: hidden;
    background: var(--zest-image-view-window, var(--_window));
    cursor: grab;
    touch-action: none;
}
.zest-image-view .viewport.dragging {
    cursor: grabbing;
}
.zest-image-view .viewport:focus-visible, .zest-image-view button:focus-visible {
    outline: var(--_focus-width) solid var(--_focus);
    outline-offset: calc(var(--_focus-width) * -1);
}
.zest-image-view img {
    position: absolute;
    inset-block-start: 0;
    inset-inline-start: 0;
    max-width: none;
    transform-origin: 0 0;
    user-select: none;
    -webkit-user-drag: none;
}
@media (forced-colors: active) {
    .zest-image-view button[aria-pressed="true"] {
        background: Highlight;
        color: HighlightText;
        forced-color-adjust: none;
    }
}
`;

export class ImageView extends BaseComponent {
    static styles = imageStyles;
    static properties = {
        src: {type: String, default: ''},
        // Necessary: the text of the image for a screen reader. Use "" only for a picture with no meaning.
        alt: {type: String, default: null},
        // 'contain' shows all of the image, 'cover' fills the view, 'actual' is one image pixel for one CSS pixel
        fit: {type: String, default: 'contain', reflect: true},
        zoom: {type: Number, default: 1},
        minZoom: {type: Number, default: 0.25},
        maxZoom: {type: Number, default: 8},
        // The factor of one step of zoom
        zoomStep: {type: Number, default: 1.25},
        labels: {type: Object, attribute: false, default: () => ({})},
    };

    #parts = null;
    #offset = {x: 0, y: 0};
    #drag = null;
    #warned = false;

    get text() { return {...DEFAULT_LABELS, ...this.labels}; }
    get image() { return this.#parts?.img ?? null; }
    get offset() { return {...this.#offset}; }
    // The scale from image pixels to CSS pixels, with the zoom
    get scale() { return this.#baseScale() * this.zoom; }

    connectedCallback() {
        super.connectedCallback();
        if (!this.#parts) { this.#build(); }
        const wrapper = this.#parts.wrapper;
        wrapper.querySelectorAll(':scope > style').forEach(style => style.remove());
        this.applyStyles(wrapper);
        this.own(observeResize(this.#parts.viewport, () => this.#place()));
        this.render();
    }

    #build() {
        const t = this.text;
        const wrapper = document.createElement('div');
        wrapper.className = 'zest-image-view';
        wrapper.setAttribute('part', 'view');
        wrapper.innerHTML = `
            <div class="tools" role="toolbar" part="tools">
                <button type="button" class="out"></button>
                <span class="level" part="level"></span>
                <button type="button" class="in"></button>
                <button type="button" class="fit-contain" aria-pressed="false"></button>
                <button type="button" class="fit-cover" aria-pressed="false"></button>
                <button type="button" class="fit-actual" aria-pressed="false"></button>
            </div>
            <div class="viewport" part="viewport" tabindex="0" role="group"><img part="image" draggable="false"></div>`;
        const q = (selector) => wrapper.querySelector(selector);
        const parts = {
            wrapper, tools: q('.tools'), out: q('.out'), in: q('.in'), level: q('.level'),
            contain: q('.fit-contain'), cover: q('.fit-cover'), actual: q('.fit-actual'),
            viewport: q('.viewport'), img: q('img'),
        };
        this.#parts = parts;
        parts.out.textContent = '−';
        parts.in.textContent = '+';
        parts.out.setAttribute('aria-label', t.zoomOut);
        parts.in.setAttribute('aria-label', t.zoomIn);
        parts.contain.textContent = t.contain;
        parts.cover.textContent = t.cover;
        parts.actual.textContent = t.actual;
        parts.tools.setAttribute('aria-label', t.tools);
        parts.out.addEventListener('click', () => this.#userZoom(this.zoom / this.zoomStep));
        parts.in.addEventListener('click', () => this.#userZoom(this.zoom * this.zoomStep));
        for (const fit of ['contain', 'cover', 'actual']) {
            parts[fit].addEventListener('click', () => this.#userFit(fit));
        }
        parts.img.addEventListener('load', () => this.#place());
        parts.viewport.addEventListener('keydown', (e) => this.#onKeydown(e));
        parts.viewport.addEventListener('wheel', (e) => this.#onWheel(e), {passive: false});
        parts.viewport.addEventListener('pointerdown', (e) => this.#onPointerDown(e));
        parts.viewport.addEventListener('pointermove', (e) => this.#onPointerMove(e));
        parts.viewport.addEventListener('pointerup', (e) => this.#onPointerUp(e));
        parts.viewport.addEventListener('pointercancel', (e) => this.#onPointerUp(e));
        this.root.append(wrapper);
    }

    propertyChanged(name) {
        // The base class can call this before the fields of this class exist, for a value set before the upgrade
        if (!(#offset in this)) { return; }
        if (name === 'fit' || name === 'src') {
            this.#offset = {x: 0, y: 0};
            this.#centered = true;
        }
    }

    #centered = true;

    render() {
        const p = this.#parts;
        if (!p) { return; }
        if (this.alt === null && !this.#warned) {
            this.#warned = true;
            console.warn('An image-view needs alt text. Set alt="" only for a picture with no meaning.');
        }
        if (p.img.getAttribute('src') !== this.src) { p.img.setAttribute('src', this.src); }
        p.img.alt = this.alt ?? '';
        const t = this.text;
        p.viewport.setAttribute('aria-label', [this.alt, t.help].filter(Boolean).join('. '));
        for (const fit of ['contain', 'cover', 'actual']) {
            p[fit].setAttribute('aria-pressed', String(this.fit === fit && this.zoom === 1));
        }
        this.#place();
    }

    #natural() {
        const img = this.#parts.img;
        return {width: img.naturalWidth || 0, height: img.naturalHeight || 0};
    }

    #view() {
        const viewport = this.#parts.viewport;
        return {width: viewport.clientWidth, height: viewport.clientHeight};
    }

    #baseScale() {
        if (!this.#parts) { return 1; }
        const image = this.#natural();
        const view = this.#view();
        if (!image.width || !image.height || !view.width || !view.height || this.fit === 'actual') { return 1; }
        const x = view.width / image.width;
        const y = view.height / image.height;
        return this.fit === 'cover' ? Math.max(x, y) : Math.min(x, y);
    }

    // Keeps the image on the view: a small image is in the center, and a large one covers the view
    #clamp(offset, width, height) {
        const view = this.#view();
        const axis = (value, size, room) => (size <= room ? (room - size) / 2 : Math.min(0, Math.max(room - size, value)));
        return {x: axis(offset.x, width, view.width), y: axis(offset.y, height, view.height)};
    }

    #place() {
        const p = this.#parts;
        if (!p) { return; }
        const image = this.#natural();
        const scale = this.scale;
        const width = image.width * scale;
        const height = image.height * scale;
        if (this.#centered) {
            const view = this.#view();
            this.#offset = {x: (view.width - width) / 2, y: (view.height - height) / 2};
            this.#centered = false;
        }
        this.#offset = this.#clamp(this.#offset, width, height);
        p.img.style.transform = `translate(${this.#offset.x}px, ${this.#offset.y}px) scale(${scale})`;
        p.level.textContent = this.text.zoom(Math.round(scale * 100));
        p.out.disabled = this.zoom <= this.minZoom;
        p.in.disabled = this.zoom >= this.maxZoom;
    }

    // Zooms and keeps the point (x, y) of the view in place. With no point, the center stays in place.
    zoomTo(zoom, x, y) {
        const view = this.#view();
        const fx = x ?? view.width / 2;
        const fy = y ?? view.height / 2;
        const before = this.scale;
        const next = Math.min(this.maxZoom, Math.max(this.minZoom, zoom));
        if (next === this.zoom) { return; }
        const after = this.#baseScale() * next;
        const ratio = before ? after / before : 1;
        this.#offset = {x: fx - (fx - this.#offset.x) * ratio, y: fy - (fy - this.#offset.y) * ratio};
        this.zoom = next;
        this.render();
    }

    // Moves the image by (dx, dy) CSS pixels
    panBy(dx, dy) {
        this.#offset = {x: this.#offset.x + dx, y: this.#offset.y + dy};
        this.#place();
    }

    reset() {
        this.#centered = true;
        this.zoom = 1;
        this.render();
    }

    #userZoom(zoom, x, y) {
        const before = this.zoom;
        this.zoomTo(zoom, x, y);
        if (this.zoom !== before) { this.emit('image-view-zoom', {zoom: this.zoom, scale: this.scale, fit: this.fit}); }
    }

    #userFit(fit) {
        this.fit = fit;
        this.#centered = true;
        this.zoom = 1;
        this.render();
        this.emit('image-view-zoom', {zoom: this.zoom, scale: this.scale, fit});
    }

    #onKeydown(e) {
        if (e.ctrlKey || e.metaKey || e.altKey) { return; }
        const view = this.#view();
        const step = (size) => Math.max(20, size * 0.1);
        switch (e.key) {
            case '+': case '=': this.#userZoom(this.zoom * this.zoomStep); break;
            case '-': case '_': this.#userZoom(this.zoom / this.zoomStep); break;
            case '0': this.#userFit(this.fit); break;
            case 'ArrowLeft': this.panBy(step(view.width), 0); break;
            case 'ArrowRight': this.panBy(-step(view.width), 0); break;
            case 'ArrowUp': this.panBy(0, step(view.height)); break;
            case 'ArrowDown': this.panBy(0, -step(view.height)); break;
            default: return;
        }
        e.preventDefault();
    }

    // Ctrl and the wheel zoom, as in most image programs. The wheel alone scrolls the page.
    #onWheel(e) {
        if (!e.ctrlKey && !e.metaKey) { return; }
        e.preventDefault();
        const rect = this.#parts.viewport.getBoundingClientRect();
        const factor = Math.exp(-e.deltaY * 0.002);
        this.#userZoom(this.zoom * factor, e.clientX - rect.left, e.clientY - rect.top);
    }

    #onPointerDown(e) {
        if (e.button !== 0) { return; }
        this.#drag = {id: e.pointerId, x: e.clientX, y: e.clientY};
        this.#parts.viewport.setPointerCapture?.(e.pointerId);
        this.#parts.viewport.classList.add('dragging');
    }

    #onPointerMove(e) {
        const drag = this.#drag;
        if (!drag || drag.id !== e.pointerId) { return; }
        this.panBy(e.clientX - drag.x, e.clientY - drag.y);
        drag.x = e.clientX;
        drag.y = e.clientY;
    }

    #onPointerUp(e) {
        if (!this.#drag || this.#drag.id !== e.pointerId) { return; }
        this.#drag = null;
        this.#parts.viewport.classList.remove('dragging');
    }
}

export class ShadowImageView extends ImageView {
    shadow;
    constructor() {
        super();
        this.shadow = this.attachShadow({mode: 'open'});
        this.root = this.shadow;
    }
}
