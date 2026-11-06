// One item of a group is in the tab order, and the arrow keys move between the items. Toolbars,
// tabs, menus, radio groups, lists, and trees use this, as the ARIA practices tell.

const KEYS = {
    horizontal: {ArrowLeft: -1, ArrowRight: 1},
    vertical: {ArrowUp: -1, ArrowDown: 1},
};
KEYS.both = {...KEYS.horizontal, ...KEYS.vertical};

export function isRtl(element) {
    try { return element.matches(':dir(rtl)'); } catch { return getComputedStyle(element).direction === 'rtl'; }
}

export function isDisabled(element) {
    return element.hasAttribute('disabled') || element.getAttribute('aria-disabled') === 'true';
}

export class RovingFocus {
    #container;
    #items;
    #options;
    #current = null;
    #typed = '';
    #typedAt = 0;

    // items: a CSS selector, or a function that gives the items in order
    // orientation: 'horizontal', 'vertical', or 'both'
    // skipDisabled: false keeps a disabled item focusable, so that a user can find it
    // onMove(item, event): after the focus moves. Return false from onKey to stop a key.
    constructor(container, {items, orientation = 'horizontal', wrap = true, skipDisabled = false, typeahead = false, onMove = null, onKey = null} = {}) {
        this.#container = container;
        this.#items = typeof items === 'function' ? items : () => [...container.querySelectorAll(items)];
        this.#options = {orientation, wrap, skipDisabled, typeahead, onMove, onKey};
    }

    get items() {
        return this.#items().filter(item => !item.hidden && !(this.#options.skipDisabled && isDisabled(item)));
    }

    get current() {
        const items = this.items;
        return items.includes(this.#current) ? this.#current : (items.find(item => item.tabIndex === 0) ?? items[0] ?? null);
    }

    // Adds the listeners. Give the result to own() in connectedCallback.
    attach() {
        const keydown = (e) => this.#onKeydown(e);
        const focusin = (e) => {
            const item = this.items.find(candidate => candidate === e.target || candidate.contains(e.target));
            if (item) { this.#set(item); }
        };
        this.#container.addEventListener('keydown', keydown);
        this.#container.addEventListener('focusin', focusin);
        return () => {
            this.#container.removeEventListener('keydown', keydown);
            this.#container.removeEventListener('focusin', focusin);
        };
    }

    // Call after the items change, so that exactly one item is in the tab order
    update(current = this.current) {
        this.#set(current);
    }

    focus(item, event = null) {
        if (!item) { return; }
        this.#set(item);
        item.focus();
        this.#options.onMove?.(item, event);
    }

    #set(item) {
        this.#current = item;
        for (const candidate of this.#items()) {
            candidate.tabIndex = candidate === item ? 0 : -1;
        }
    }

    #onKeydown(e) {
        if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) { return; }
        const items = this.items;
        const index = items.indexOf(this.current);
        if (index < 0 || !items.some(item => item === e.target || item.contains(e.target))) { return; }
        if (this.#options.onKey?.(e, items[index]) === false) { return; }
        let step = KEYS[this.#options.orientation]?.[e.key];
        if (step && e.key.match(/Left|Right/) && isRtl(this.#container)) { step = -step; }
        let next = null;
        if (step) {
            next = index + step;
            if (this.#options.wrap) { next = (next + items.length) % items.length; }
            next = items[Math.max(0, Math.min(items.length - 1, next))];
        } else if (e.key === 'Home') {
            next = items[0];
        } else if (e.key === 'End') {
            next = items.at(-1);
        } else if (this.#options.typeahead && e.key.length === 1 && e.key.trim()) {
            next = this.#find(items, index, e.key);
        }
        if (!next) { return; }
        e.preventDefault();
        this.focus(next, e);
    }

    // Typing a letter goes to the next item that starts with what the user typed in the last second
    #find(items, index, key) {
        const now = Date.now();
        this.#typed = now - this.#typedAt < 1000 ? this.#typed + key.toLowerCase() : key.toLowerCase();
        this.#typedAt = now;
        const ordered = [...items.slice(index + 1), ...items.slice(0, index + 1)];
        const text = (item) => (item.getAttribute('aria-label') || item.textContent).trim().toLowerCase();
        return ordered.find(item => text(item).startsWith(this.#typed))
            ?? (this.#typed.length > 1 ? null : ordered.find(item => text(item).startsWith(key.toLowerCase())));
    }
}
