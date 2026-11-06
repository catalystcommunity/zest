// One ResizeObserver and one IntersectionObserver for all components. An observer for each
// instance costs much more than one observer with many targets.

const resizers = new Map();
const watchers = new Map();

// A test can put a different observer class in place, so the shared observer follows the class
function shared(map, key, Kind, make) {
    if (map.get(key)?.Kind !== Kind) {
        const callbacks = new Map();
        const observer = make((entries) => {
            for (const entry of entries) {
                for (const callback of [...(callbacks.get(entry.target) ?? [])]) {
                    try { callback(entry); } catch (e) {
                        if (typeof reportError === 'function') { reportError(e); } else { setTimeout(() => { throw e; }); }
                    }
                }
            }
        });
        map.set(key, {observer, callbacks, Kind});
    }
    return map.get(key);
}

function add(group, element, callback, observe) {
    const first = !group.callbacks.has(element);
    if (first) { group.callbacks.set(element, new Set()); }
    group.callbacks.get(element).add(callback);
    if (first) { observe(); }
    return () => {
        const set = group.callbacks.get(element);
        if (!set?.delete(callback) || set.size) { return; }
        group.callbacks.delete(element);
        group.observer.unobserve(element);
    };
}

// Calls callback(entry) when the size of the element changes, and one time after it starts.
// box is 'content-box', 'border-box', or 'device-pixel-content-box'. A browser that does not
// know the box uses the content box. Returns the removal function. Give it to own().
export function observeResize(element, callback, {box = 'content-box'} = {}) {
    if (typeof ResizeObserver !== 'function') { return () => {}; }
    const group = shared(resizers, box, ResizeObserver, (handle) => new ResizeObserver(handle));
    try {
        return add(group, element, callback, () => group.observer.observe(element, {box}));
    } catch (e) {
        group.callbacks.delete(element);
        if (box === 'content-box') { throw e; }
        return observeResize(element, callback);
    }
}

// Calls callback(entry) when the element goes into or out of the window. Returns the removal function.
export function observeVisibility(element, callback, {rootMargin = '0px', threshold = 0} = {}) {
    if (typeof IntersectionObserver !== 'function') { return () => {}; }
    const key = `${rootMargin}|${threshold}`;
    const group = shared(watchers, key, IntersectionObserver, (handle) => new IntersectionObserver(handle, {rootMargin, threshold}));
    return add(group, element, callback, () => group.observer.observe(element));
}
