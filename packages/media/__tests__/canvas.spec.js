import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { flushRenders } from '@catalystcommunity/base-components';
import { CanvasView, ImageView, drawVideoFrame, fitRect, defineMediaElements } from '../src';
import { fakeContext, installObservers } from './helpers.js';

defineMediaElements();

let observers;
let context;
beforeEach(() => {
    observers = installObservers();
    context = fakeContext();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => context);
});
afterEach(() => {
    document.body.replaceChildren();
    flushRenders();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

function view(attributes = {}) {
    const element = document.createElement('canvas-view');
    for (const [name, value] of Object.entries(attributes)) { element.setAttribute(name, value); }
    element.draw = vi.fn();
    document.body.append(element);
    observers.size(200, 100, 2);
    return element;
}

describe('fitting a picture', () => {
    it('fits, covers, or fills a box, and keeps the picture in the center', () => {
        expect(fitRect(400, 200, 100, 100, 'contain')).toEqual({x: 0, y: 25, width: 100, height: 50});
        expect(fitRect(400, 200, 100, 100, 'cover')).toEqual({x: -50, y: 0, width: 200, height: 100});
        expect(fitRect(400, 200, 100, 100, 'fill')).toEqual({x: 0, y: 0, width: 100, height: 100});
    });

    it('draws nothing for a video with no frame yet', () => {
        expect(drawVideoFrame(context, {videoWidth: 0, videoHeight: 0}, {width: 10, height: 10})).toBeNull();
        expect(context.drawImage).not.toHaveBeenCalled();
        const rect = drawVideoFrame(context, {videoWidth: 20, videoHeight: 10}, {width: 10, height: 10});
        expect(rect).toEqual({x: 0, y: 2.5, width: 10, height: 5});
    });
});

describe('canvas-view', () => {
    it('draws one time in a frame for many requests', () => {
        const element = view();
        flushRenders();
        element.draw.mockClear();
        for (let i = 0; i < 500; i++) { element.invalidate(); }
        expect(element.draw).not.toHaveBeenCalled();
        flushRenders();
        expect(element.draw).toHaveBeenCalledTimes(1);
        expect(element.stats.invalidations).toBeGreaterThanOrEqual(500);
    });

    it('sizes the canvas in device pixels, and lets the application draw in CSS pixels', () => {
        const element = view();
        flushRenders();
        expect([element.canvas.width, element.canvas.height]).toEqual([400, 200]);
        const [ctx, info] = element.draw.mock.calls.at(-1);
        expect(ctx).toBe(context);
        expect(info).toMatchObject({width: 200, height: 100, pixelRatio: 2, view: element});
        expect(context.calls.filter(call => call[0] === 'setTransform').at(-1)).toEqual(['setTransform', 2, 0, 0, 2, 0, 0]);
        expect(context.clearRect).toHaveBeenCalledWith(0, 0, 400, 200);
    });

    it('does not clear with auto-clear="false"', () => {
        view({'auto-clear': 'false'});
        flushRenders();
        expect(context.clearRect).not.toHaveBeenCalled();
    });

    it('animates only while it is on the screen', () => {
        const element = view({animate: ''});
        flushRenders();
        flushRenders();
        flushRenders();
        const drawn = element.framesDrawn;
        expect(drawn).toBeGreaterThanOrEqual(3);
        expect(element.running).toBe(true);
        observers.visible(false);
        flushRenders();
        flushRenders();
        expect(element.framesDrawn).toBeLessThanOrEqual(drawn + 1);
        const stopped = element.framesDrawn;
        flushRenders();
        expect(element.framesDrawn).toBe(stopped);
        observers.visible(true);
        flushRenders();
        flushRenders();
        expect(element.framesDrawn).toBe(stopped + 2);
    });

    it('stops the animation with reduced motion, unless the motion is essential', () => {
        vi.stubGlobal('matchMedia', () => ({matches: true, addEventListener() {}, removeEventListener() {}}));
        const element = view({animate: ''});
        expect(element.running).toBe(false);
        element.essentialMotion = true;
        expect(element.running).toBe(true);
    });

    it('names the picture for a screen reader, and keeps fallback content', () => {
        const element = document.createElement('canvas-view');
        element.innerHTML = '<p>A chart of sales</p>';
        document.body.append(element);
        flushRenders();
        expect(element.canvas.querySelector('p').textContent).toBe('A chart of sales');
        expect(element.canvas.hasAttribute('role')).toBe(false);
        element.label = 'Sales';
        element.description = 'Sales go up in March.';
        flushRenders();
        expect(element.canvas.getAttribute('role')).toBe('img');
        expect(element.canvas.getAttribute('aria-label')).toBe('Sales');
        const described = element.querySelector(`#${element.canvas.getAttribute('aria-describedby')}`);
        expect(described.textContent).toBe('Sales go up in March.');
    });

    it('gives the point of a pointer in CSS pixels and in device pixels', () => {
        const element = view();
        flushRenders();
        vi.spyOn(element.canvas, 'getBoundingClientRect').mockReturnValue({left: 10, top: 20, width: 200, height: 100});
        expect(element.toCanvasPoint({clientX: 60, clientY: 70})).toEqual({x: 50, y: 50, pixelX: 100, pixelY: 100, inside: true});
        expect(element.toCanvasPoint({clientX: 0, clientY: 0}).inside).toBe(false);
    });

    it('draws again for each frame of a video source, and stops when it disconnects', () => {
        let callback = null;
        const video = {
            videoWidth: 32, videoHeight: 18, paused: false,
            requestVideoFrameCallback: vi.fn((fn) => { callback = fn; return 7; }),
            cancelVideoFrameCallback: vi.fn(),
        };
        const element = document.createElement('canvas-view');
        document.body.append(element);
        observers.size(200, 100, 1);
        element.source = video;
        flushRenders();
        expect(context.drawImage).toHaveBeenCalledWith(video, expect.any(Number), 0, expect.any(Number), 100);
        context.drawImage.mockClear();
        callback();
        flushRenders();
        expect(context.drawImage).toHaveBeenCalledTimes(1);
        element.remove();
        expect(video.cancelVideoFrameCallback).toHaveBeenCalledWith(7);
    });

    it('takes the media element of a player as its source', () => {
        const media = {videoWidth: 4, videoHeight: 4, paused: true, requestVideoFrameCallback: vi.fn(() => 1), cancelVideoFrameCallback() {}};
        const element = document.createElement('canvas-view');
        document.body.append(element);
        element.source = {media};
        expect(media.requestVideoFrameCallback).toHaveBeenCalled();
    });

    it('keeps a draw function that was set before the tag was defined', () => {
        const element = document.createElement('late-canvas-view');
        const draw = vi.fn();
        element.draw = draw;
        element.animated = true;
        customElements.define('late-canvas-view', class extends CanvasView {});
        document.body.append(element);
        observers.size(10, 10);
        flushRenders();
        expect(draw).toHaveBeenCalled();
    });
});

describe('image-view', () => {
    function image(attributes = {alt: 'A pattern', src: '/pattern.png'}) {
        const element = document.createElement('image-view');
        for (const [name, value] of Object.entries(attributes)) { element.setAttribute(name, value); }
        document.body.append(element);
        const img = element.image;
        Object.defineProperty(img, 'naturalWidth', {value: 400, configurable: true});
        Object.defineProperty(img, 'naturalHeight', {value: 200, configurable: true});
        const viewport = element.querySelector('.zest-viewport');
        Object.defineProperty(viewport, 'clientWidth', {value: 200, configurable: true});
        Object.defineProperty(viewport, 'clientHeight', {value: 200, configurable: true});
        element.reset();
        return {element, viewport, q: (selector) => element.querySelector(selector)};
    }
    const press = (target, k) => target.dispatchEvent(new KeyboardEvent('keydown', {key: k, bubbles: true, cancelable: true}));

    it('fits the image, and puts it in the center', () => {
        const {element} = image();
        expect(element.scale).toBe(0.5);
        expect(element.offset).toEqual({x: 0, y: 50});
        expect(element.image.style.transform).toBe('translate(0px, 50px) scale(0.5)');
        expect(element.querySelector('.zest-level').textContent).toBe('50%');
    });

    it('zooms with the keys and the buttons, in the limits', () => {
        const {element, viewport, q} = image();
        const heard = vi.fn();
        element.addEventListener('image-view-zoom', heard);
        press(viewport, '+');
        expect(element.zoom).toBe(1.25);
        q('.zest-out').click();
        expect(element.zoom).toBe(1);
        for (let i = 0; i < 20; i++) { press(viewport, '-'); }
        expect(element.zoom).toBe(0.25);
        expect(q('.zest-out').disabled).toBe(true);
        press(viewport, '0');
        expect(element.zoom).toBe(1);
        expect(heard).toHaveBeenCalled();
    });

    it('moves a large image with the arrow keys, and keeps it on the view', () => {
        const {element, viewport} = image();
        element.zoomTo(4);
        const start = element.offset.x;
        press(viewport, 'ArrowRight');
        expect(element.offset.x).toBeLessThan(start);
        for (let i = 0; i < 50; i++) { press(viewport, 'ArrowLeft'); }
        expect(element.offset.x).toBe(0);
        for (let i = 0; i < 100; i++) { press(viewport, 'ArrowRight'); }
        // The image is 400 * 0.5 * 4 = 800 wide, so the right side stops at the right side of the view
        expect(element.offset.x).toBe(-600);
    });

    it('changes the fit mode, and marks the button that is in use', () => {
        const {element, q} = image();
        q('.zest-fit-cover').click();
        expect(element.fit).toBe('cover');
        expect(element.scale).toBe(1);
        expect(q('.zest-fit-cover').getAttribute('aria-pressed')).toBe('true');
        expect(q('.zest-fit-contain').getAttribute('aria-pressed')).toBe('false');
        q('.zest-fit-actual').click();
        expect(element.scale).toBe(1);
    });

    it('warns one time when there is no alt text', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        image({src: '/pattern.png'});
        expect(warn).toHaveBeenCalledTimes(1);
        expect(warn.mock.calls[0][0]).toContain('needs alt text');
    });

    it('gives the alt text and the help to the view', () => {
        const {viewport, element} = image();
        expect(viewport.getAttribute('aria-label')).toBe('A pattern. Use plus and minus to zoom, zero to reset, and the arrow keys to move.');
        expect(element.image.alt).toBe('A pattern');
        expect(element).toBeInstanceOf(ImageView);
    });
});
