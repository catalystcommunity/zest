import { vi } from 'vitest';

// jsdom has no media playback. This gives a media element the state and the events that a browser gives.
export function fakeMedia(media, {duration = 60} = {}) {
    const state = {paused: true, currentTime: 0, duration, ended: false};
    Object.defineProperties(media, {
        paused: {get: () => state.paused, configurable: true},
        ended: {get: () => state.ended, configurable: true},
        duration: {get: () => state.duration, configurable: true},
        currentTime: {
            get: () => state.currentTime,
            set: (value) => { state.currentTime = value; media.dispatchEvent(new Event('timeupdate')); },
            configurable: true,
        },
    });
    media.play = vi.fn(() => {
        state.paused = false;
        media.dispatchEvent(new Event('play'));
        return Promise.resolve();
    });
    media.pause = vi.fn(() => {
        state.paused = true;
        media.dispatchEvent(new Event('pause'));
    });
    media.load = vi.fn();
    media.end = () => {
        state.ended = true;
        state.paused = true;
        media.dispatchEvent(new Event('ended'));
    };
    return state;
}

// A 2D context that records calls
export function fakeContext() {
    const calls = [];
    const record = (name) => vi.fn((...args) => calls.push([name, ...args]));
    return {
        calls,
        setTransform: record('setTransform'),
        clearRect: record('clearRect'),
        drawImage: record('drawImage'),
        fillRect: record('fillRect'),
    };
}

// Observers that a test triggers by hand
export function installObservers() {
    const resize = [];
    const intersection = [];
    // One observer can watch many targets, as the shared observers of base-components do
    class FakeResizeObserver {
        constructor(callback) { this.callback = callback; this.targets = []; resize.push(this); }
        observe(target) { this.targets.push(target); }
        unobserve(target) { this.targets = this.targets.filter(item => item !== target); }
        disconnect() { this.targets = []; }
    }
    class FakeIntersectionObserver {
        constructor(callback) { this.callback = callback; this.targets = []; intersection.push(this); }
        observe(target) { this.targets.push(target); }
        unobserve(target) { this.targets = this.targets.filter(item => item !== target); }
        disconnect() { this.targets = []; }
    }
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);
    vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
    return {
        resize,
        intersection,
        size(width, height, ratio = 1) {
            for (const observer of resize) {
                observer.callback(observer.targets.map(target => ({
                    target,
                    contentRect: {width, height},
                    contentBoxSize: [{inlineSize: width, blockSize: height}],
                    devicePixelContentBoxSize: [{inlineSize: width * ratio, blockSize: height * ratio}],
                })));
            }
        },
        visible(isIntersecting) {
            for (const observer of intersection) { observer.callback(observer.targets.map(target => ({target, isIntersecting}))); }
        },
    };
}
