// Renders that wait for the next frame. A GUI toolkit paints a window one time after a burst of
// changes, not one time for each change. A component with `static renderTiming = 'frame'` does the same.

const pending = new Map();
let handle = null;

const nextFrame = (callback) => typeof requestAnimationFrame === 'function'
    ? {frame: requestAnimationFrame(callback)}
    : {timer: setTimeout(callback, 16)};

function cancel(waiting) {
    if (waiting?.frame !== undefined) { cancelAnimationFrame(waiting.frame); }
    if (waiting?.timer !== undefined) { clearTimeout(waiting.timer); }
}

// Parents before children, so that a child paints after the parent that can change it.
// The depth crosses shadow roots.
function depth(node) {
    let count = 0;
    for (let at = node; at; at = at.parentNode ?? at.host) { count++; }
    return count;
}

// An error in one render must not stop the others, and it must not be lost
function report(error) {
    if (typeof reportError === 'function') { reportError(error); return; }
    setTimeout(() => { throw error; });
}

// Calls the render one time in the next frame, however many times this is called before it
export function scheduleRender(component, render) {
    pending.set(component, render);
    if (handle === null) { handle = nextFrame(flushRenders); }
}

// True while a render of this component waits for the next frame
export function isRenderScheduled(component) {
    return pending.has(component);
}

// Does the waiting renders now. Tests and measurements call this. A render that asks for a render
// again goes to the next frame, so that a loop of renders cannot hold the page.
export function flushRenders() {
    cancel(handle);
    handle = null;
    if (!pending.size) { return 0; }
    const batch = [...pending].map(([component, render]) => ({component, render, depth: depth(component)}));
    pending.clear();
    batch.sort((a, b) => a.depth - b.depth);
    for (const {render} of batch) {
        try { render(); } catch (e) { report(e); }
    }
    return batch.length;
}
