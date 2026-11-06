import { BaseComponent, observeResize, observeVisibility, tokenAliases, visuallyHidden } from "@catalystcommunity/base-components";

// The paint surface of the toolkit. The application gives draw(), and the view calls it at most one
// time in each frame, however many times something asks for a draw. The canvas has the size of the
// element in device pixels, so lines stay sharp on each screen.

const canvasStyles = `
canvas-view, :host {
    display: block;
    min-width: 0;
}
.zest-canvas-view {
    ${tokenAliases('canvas-view')}
    position: relative;
    min-width: 0;
}
.zest-canvas-view canvas {
    display: block;
    width: 100%;
    height: var(--zest-canvas-view-height, 15em);
    touch-action: var(--zest-canvas-view-touch-action, auto);
    background: var(--zest-canvas-view-window, transparent);
    border-radius: var(--_radius);
}
.zest-canvas-view canvas:focus-visible {
    outline: var(--_focus-width) solid var(--_focus);
    outline-offset: var(--_focus-offset);
}
.zest-canvas-view .description {
    ${visuallyHidden}
}
`;

// Fits a source of size (sourceWidth, sourceHeight) into a box. fit is 'contain', 'cover', or 'fill'.
export function fitRect(sourceWidth, sourceHeight, width, height, fit = 'contain') {
    if (!sourceWidth || !sourceHeight || fit === 'fill') { return {x: 0, y: 0, width, height}; }
    const scale = fit === 'cover'
        ? Math.max(width / sourceWidth, height / sourceHeight)
        : Math.min(width / sourceWidth, height / sourceHeight);
    const w = sourceWidth * scale;
    const h = sourceHeight * scale;
    return {x: (width - w) / 2, y: (height - h) / 2, width: w, height: h};
}

// Draws the current frame of a video (or an image, or another canvas) into a 2D context, and gives
// the rectangle that it used. Give the width and height of the box in the units of the context.
export function drawVideoFrame(context, source, {width, height, fit = 'contain'} = {}) {
    const sourceWidth = source.videoWidth ?? source.naturalWidth ?? source.width;
    const sourceHeight = source.videoHeight ?? source.naturalHeight ?? source.height;
    // A video with no frame yet has no size. Draw nothing, so that the context does not throw.
    if (!sourceWidth || !sourceHeight) { return null; }
    const rect = fitRect(sourceWidth, sourceHeight, width, height, fit);
    context.drawImage(source, rect.x, rect.y, rect.width, rect.height);
    return rect;
}

const reducedMotion = () => globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

export class CanvasView extends BaseComponent {
    static styles = canvasStyles;
    static renderTiming = 'frame';
    static properties = {
        // What a screen reader says for the picture
        label: {type: String, default: ''},
        // Longer text about the picture, which a screen reader can read
        description: {type: String, default: ''},
        // '2d', 'webgl', or 'webgl2'. Set it before the first draw. A canvas has one context type.
        contextType: {type: String, attribute: 'context', default: '2d'},
        // The options of getContext, for example {willReadFrequently: true} or {alpha: false}
        contextOptions: {type: Object, attribute: false, default: null},
        // Draws again in each frame while the canvas is on the screen and the page is visible
        animate: {type: Boolean},
        // The animation is necessary to understand the content, so it continues with reduced motion
        essentialMotion: {type: Boolean},
        // Puts the canvas in the tab order, for an application that uses keys on it
        focusable: {type: Boolean},
        // Clears the 2D canvas before each draw
        autoClear: {type: Boolean, attribute: 'auto-clear', default: true},
        // A number in place of the pixel ratio of the screen. 0 uses the screen.
        pixelRatio: {type: Number, default: 0},
        // draw(context, info). info is {width, height, pixelRatio, time, delta, frame, source, view}.
        draw: {type: Function, attribute: false, default: null},
        // A video element (or a VideoPlayer) to draw. The view draws again for each new video frame.
        source: {type: Object, attribute: false, default: null},
        // How a source fits the canvas when there is no draw(): 'contain', 'cover', or 'fill'
        fit: {type: String, default: 'contain'},
    };

    #canvas = null;
    #context = null;
    #description = null;
    #size = {width: 0, height: 0, pixelWidth: 0, pixelHeight: 0};
    #visible = true;
    #pageVisible = true;
    #lastTime = 0;
    #stats = {framesDrawn: 0, lastDrawMs: 0, totalDrawMs: 0, invalidations: 0};
    #watchedSource = null;
    #videoCallback = null;

    get canvas() { return this.#canvas; }
    get width() { return this.#size.width; }
    get height() { return this.#size.height; }
    get framesDrawn() { return this.#stats.framesDrawn; }
    get lastDrawMs() { return this.#stats.lastDrawMs; }
    // The numbers that the scale tests read
    get stats() {
        const s = this.#stats;
        return {...s, averageDrawMs: s.framesDrawn ? s.totalDrawMs / s.framesDrawn : 0};
    }
    resetStats() { this.#stats = {framesDrawn: 0, lastDrawMs: 0, totalDrawMs: 0, invalidations: 0}; }

    // True while the animation runs
    get running() {
        return this.animate && this.#visible && this.#pageVisible && this.isConnected && (this.essentialMotion || !reducedMotion());
    }

    // The 2D or WebGL context. The first call makes it.
    get context() {
        if (!this.#context && this.#canvas) {
            this.#context = (this.contextOptions
                ? this.#canvas.getContext(this.contextType, this.contextOptions)
                : this.#canvas.getContext(this.contextType)) ?? null;
        }
        return this.#context;
    }

    invalidate() {
        // The base class can call this before the fields of this class exist, for a value set before the upgrade
        if (#stats in this) { this.#stats.invalidations++; }
        super.invalidate();
    }

    connectedCallback() {
        super.connectedCallback();
        if (!this.#canvas) { this.#build(); }
        const wrapper = this.#canvas.parentNode;
        wrapper.querySelectorAll(':scope > style').forEach(style => style.remove());
        this.applyStyles(wrapper);
        if (typeof ResizeObserver === 'function') {
            this.own(observeResize(this.#canvas, (entry) => this.#resized(entry), {box: 'device-pixel-content-box'}));
        } else {
            this.#measure();
        }
        if (typeof IntersectionObserver === 'function') {
            this.own(observeVisibility(this.#canvas, (entry) => {
                const visible = entry.isIntersecting;
                if (visible === this.#visible) { return; }
                this.#visible = visible;
                if (visible) { this.invalidate(); }
            }));
        }
        this.#pageVisible = document.visibilityState !== 'hidden';
        this.listen(document, 'visibilitychange', () => {
            this.#pageVisible = document.visibilityState !== 'hidden';
            if (this.#pageVisible) { this.invalidate(); }
        });
        const motion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');
        if (motion?.addEventListener) { this.listen(motion, 'change', () => this.invalidate()); }
        this.own(() => this.#watch(null));
        this.#watch(this.source);
        this.invalidate();
    }

    #build() {
        const wrapper = document.createElement('div');
        wrapper.className = 'zest-canvas-view';
        wrapper.setAttribute('part', 'view');
        const canvas = document.createElement('canvas');
        canvas.setAttribute('part', 'canvas');
        // The children of the application are the fallback content, which a screen reader can read
        if (this.root === this) {
            canvas.append(...[...this.childNodes]);
        } else {
            canvas.append(document.createElement('slot'));
        }
        const description = document.createElement('div');
        description.className = 'description';
        description.id = `zest-canvas-${Math.random().toString(36).slice(2)}`;
        this.#description = description;
        wrapper.append(canvas, description);
        this.#canvas = canvas;
        this.root.append(wrapper);
    }

    propertyChanged(name, oldValue, newValue) {
        if (!(#stats in this)) { return; }
        if (name === 'source' && this.isConnected) { this.#watch(newValue); }
        if (name === 'contextType' && this.#context) {
            throw new Error('A canvas has one context type. Set context before the first draw.');
        }
    }

    #resized(entry) {
        const ratio = this.pixelRatio || globalThis.devicePixelRatio || 1;
        const box = entry.devicePixelContentBoxSize?.[0];
        const content = entry.contentBoxSize?.[0];
        const width = content ? content.inlineSize : entry.contentRect.width;
        const height = content ? content.blockSize : entry.contentRect.height;
        // The exact device pixels, when the browser gives them and the application did not set a ratio
        const pixelWidth = box && !this.pixelRatio ? box.inlineSize : Math.round(width * ratio);
        const pixelHeight = box && !this.pixelRatio ? box.blockSize : Math.round(height * ratio);
        this.#setSize(width, height, pixelWidth, pixelHeight);
    }

    #measure() {
        const rect = this.#canvas.getBoundingClientRect();
        const ratio = this.pixelRatio || globalThis.devicePixelRatio || 1;
        this.#setSize(rect.width, rect.height, Math.round(rect.width * ratio), Math.round(rect.height * ratio));
    }

    #setSize(width, height, pixelWidth, pixelHeight) {
        const size = this.#size;
        if (size.pixelWidth === pixelWidth && size.pixelHeight === pixelHeight && size.width === width && size.height === height) { return; }
        this.#size = {width, height, pixelWidth, pixelHeight};
        // A change of the canvas size clears it, so draw again in the same frame
        this.#canvas.width = Math.max(1, pixelWidth);
        this.#canvas.height = Math.max(1, pixelHeight);
        this.invalidate();
    }

    // Draws each new frame of a video. requestVideoFrameCallback gives exactly the frames of the video.
    #watch(source) {
        const old = this.#watchedSource;
        if (old && this.#videoCallback) { this.#videoCallback.stop(); }
        this.#videoCallback = null;
        this.#watchedSource = null;
        const video = source?.media ?? source;
        if (!video || !this.isConnected) { return; }
        this.#watchedSource = video;
        if (typeof video.requestVideoFrameCallback === 'function') {
            let handle = null;
            const next = () => {
                handle = video.requestVideoFrameCallback(() => { this.invalidate(); next(); });
            };
            next();
            this.#videoCallback = {stop: () => video.cancelVideoFrameCallback?.(handle)};
        } else {
            // With no frame callback, draw in each frame while the video plays
            const events = ['play', 'seeked', 'loadeddata', 'timeupdate'];
            const onEvent = () => this.invalidate();
            for (const name of events) { video.addEventListener(name, onEvent); }
            this.#videoCallback = {stop: () => events.forEach(name => video.removeEventListener(name, onEvent))};
        }
    }

    get #drawsVideo() {
        const video = this.#watchedSource;
        return Boolean(video && !video.paused && !video.ended && typeof video.requestVideoFrameCallback !== 'function');
    }

    render() {
        const canvas = this.#canvas;
        if (!canvas) { return; }
        canvas.tabIndex = this.focusable ? 0 : -1;
        if (!this.focusable) { canvas.removeAttribute('tabindex'); }
        const hasFallback = this.root === this ? canvas.childNodes.length > 0 : this.childNodes.length > 0;
        if (this.label || !hasFallback) {
            canvas.setAttribute('role', 'img');
            canvas.setAttribute('aria-label', this.label || 'Canvas');
        } else {
            canvas.removeAttribute('role');
            canvas.removeAttribute('aria-label');
        }
        this.#description.textContent = this.description;
        if (this.description) {
            canvas.setAttribute('aria-describedby', this.#description.id);
        } else {
            canvas.removeAttribute('aria-describedby');
        }
        if (!this.#size.pixelWidth && typeof ResizeObserver !== 'function') { this.#measure(); }
        this.#paint();
        if (this.running || this.#drawsVideo) { this.invalidate(); }
    }

    #paint() {
        const context = this.context;
        const {width, height} = this.#size;
        if (!context || !width || !height) { return; }
        const now = globalThis.performance?.now() ?? Date.now();
        const delta = this.#lastTime ? now - this.#lastTime : 0;
        this.#lastTime = now;
        const ratio = this.#canvas.width / width;
        const is2d = typeof context.setTransform === 'function';
        if (is2d) {
            context.setTransform(1, 0, 0, 1, 0, 0);
            if (this.autoClear) { context.clearRect(0, 0, this.#canvas.width, this.#canvas.height); }
            // The application draws in CSS pixels
            context.setTransform(ratio, 0, 0, ratio, 0, 0);
        } else if (typeof context.viewport === 'function') {
            context.viewport(0, 0, this.#canvas.width, this.#canvas.height);
        }
        const info = {
            width, height, pixelRatio: ratio, time: now, delta, frame: this.#stats.framesDrawn,
            source: this.#watchedSource, view: this,
        };
        const start = now;
        if (this.draw) {
            this.draw(context, info);
        } else if (this.#watchedSource && is2d) {
            drawVideoFrame(context, this.#watchedSource, {width, height, fit: this.fit});
        }
        const spent = (globalThis.performance?.now() ?? Date.now()) - start;
        this.#stats.framesDrawn++;
        this.#stats.lastDrawMs = spent;
        this.#stats.totalDrawMs += spent;
    }

    // The point of a pointer event in CSS pixels of the canvas, and in device pixels
    toCanvasPoint(event) {
        const rect = this.#canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        const ratio = rect.width ? this.#canvas.width / rect.width : 1;
        return {x, y, pixelX: x * ratio, pixelY: y * ratio, inside: x >= 0 && y >= 0 && x <= rect.width && y <= rect.height};
    }
}

export class ShadowCanvasView extends CanvasView {
    shadow;
    constructor() {
        super();
        this.shadow = this.attachShadow({mode: 'open'});
        this.root = this.shadow;
    }
}
