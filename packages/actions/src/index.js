// An action is one command of the application: "Save", "Bold", "Delete row". A menu item, a toolbar
// button, and a keyboard shortcut can all use the same action. When the action changes, for example
// it becomes disabled, each of them shows the change. The design is in the README.

const isMac = () => /Mac|iPhone|iPad/.test(globalThis.navigator?.platform ?? '') || /Mac OS/.test(globalThis.navigator?.userAgent ?? '');

const MODIFIERS = ['ctrl', 'alt', 'shift', 'meta'];
const ALIASES = {
    control: 'ctrl', cmd: 'meta', command: 'meta', super: 'meta', win: 'meta', option: 'alt', opt: 'alt',
    esc: 'escape', del: 'delete', ins: 'insert', return: 'enter', space: ' ', spacebar: ' ',
    up: 'arrowup', down: 'arrowdown', left: 'arrowleft', right: 'arrowright', plus: '+', pgup: 'pageup', pgdn: 'pagedown',
};

// Reads a shortcut such as 'Mod+Shift+Z', 'Ctrl+S', 'F2', or 'Alt+ArrowDown'. Mod is Command on a
// Mac, and Ctrl on other systems. Each part is not case sensitive.
export function parseShortcut(text, {mac = isMac()} = {}) {
    if (!text) { return null; }
    if (typeof text === 'object') { return text; }
    const parts = String(text).split(/\+(?!$)/).map(part => part.trim().toLowerCase()).filter(Boolean);
    const shortcut = {ctrl: false, alt: false, shift: false, meta: false, key: ''};
    for (const raw of parts) {
        const part = ALIASES[raw] ?? raw;
        if (part === 'mod') { shortcut[mac ? 'meta' : 'ctrl'] = true; continue; }
        if (MODIFIERS.includes(part)) { shortcut[part] = true; continue; }
        if (shortcut.key) { throw new Error(`A shortcut has one key that is not a modifier: ${text}`); }
        shortcut.key = part;
    }
    if (!shortcut.key) { throw new Error(`A shortcut needs a key that is not a modifier: ${text}`); }
    return shortcut;
}

// The key of an event, in the form that parseShortcut gives. With Shift, '!' is still '1', so a
// shortcut does not change with the keyboard layout. Letters use the code of the key only when the
// key is not a Latin letter, for example on a Cyrillic layout.
function keyOf(event) {
    const key = event.key?.toLowerCase() ?? '';
    if (/^[a-z]$/.test(key)) { return key; }
    const code = event.code ?? '';
    if (/^Key[A-Z]$/.test(code) && (event.ctrlKey || event.metaKey || event.altKey)) { return code.slice(3).toLowerCase(); }
    if (/^Digit\d$/.test(code)) { return code.slice(5); }
    return key;
}

export function matchesShortcut(event, shortcut, options) {
    const parsed = parseShortcut(shortcut, options);
    if (!parsed) { return false; }
    const key = keyOf(event);
    // A key such as '?' or '+' is already a shifted key, so Shift does not need to match for it
    const shiftFree = parsed.key.length === 1 && !/[a-z0-9]/.test(parsed.key);
    return key === parsed.key
        && event.ctrlKey === parsed.ctrl
        && event.altKey === parsed.alt
        && event.metaKey === parsed.meta
        && (shiftFree || event.shiftKey === parsed.shift);
}

const NAMES = {
    ' ': 'Space', arrowup: '↑', arrowdown: '↓', arrowleft: '←', arrowright: '→', escape: 'Esc', delete: 'Del',
    backspace: 'Backspace', enter: 'Enter', tab: 'Tab', pageup: 'Page Up', pagedown: 'Page Down', home: 'Home', end: 'End', insert: 'Ins',
};

// The text that a menu shows for a shortcut: '⇧⌘Z' on a Mac, 'Ctrl+Shift+Z' on other systems
export function formatShortcut(shortcut, {mac = isMac()} = {}) {
    const parsed = parseShortcut(shortcut, {mac});
    if (!parsed) { return ''; }
    const key = NAMES[parsed.key] ?? (parsed.key.length === 1 ? parsed.key.toUpperCase() : parsed.key[0].toUpperCase() + parsed.key.slice(1));
    if (mac) {
        return `${parsed.ctrl ? '⌃' : ''}${parsed.alt ? '⌥' : ''}${parsed.shift ? '⇧' : ''}${parsed.meta ? '⌘' : ''}${key}`;
    }
    return [parsed.ctrl && 'Ctrl', parsed.alt && 'Alt', parsed.shift && 'Shift', parsed.meta && 'Meta', key].filter(Boolean).join('+');
}

// The value for aria-keyshortcuts, for example 'Control+Shift+Z'
export function ariaShortcut(shortcut, options) {
    const parsed = parseShortcut(shortcut, options);
    if (!parsed) { return ''; }
    const ARIA = {' ': 'Space', arrowup: 'ArrowUp', arrowdown: 'ArrowDown', arrowleft: 'ArrowLeft', arrowright: 'ArrowRight', pageup: 'PageUp', pagedown: 'PageDown'};
    const key = ARIA[parsed.key] ?? (parsed.key.length === 1 ? parsed.key.toUpperCase() : parsed.key[0].toUpperCase() + parsed.key.slice(1));
    return [parsed.ctrl && 'Control', parsed.alt && 'Alt', parsed.shift && 'Shift', parsed.meta && 'Meta', key].filter(Boolean).join('+');
}

// An action sends a 'change' event when one of its states changes, and a 'trigger' event when it runs
export class Action extends EventTarget {
    #state;

    // id: a name for the action. label: the words in a menu or on a button. shortcut: as parseShortcut.
    // run(detail): what the action does. checkable: a toggle, such as Bold. group: an ActionGroup
    // that keeps only one action of the group checked, such as an alignment.
    constructor({id, label = id, shortcut = null, icon = null, description = '', enabled = true, checkable = false, checked = false, run = null, group = null} = {}) {
        super();
        if (!id) { throw new Error('An action needs an id'); }
        this.id = id;
        this.run = run;
        this.#state = {label, shortcut, icon, description, enabled, checkable, checked: Boolean(checked)};
        group?.add(this);
    }

    get label() { return this.#state.label; }
    set label(value) { this.#change({label: value}); }
    get shortcut() { return this.#state.shortcut; }
    set shortcut(value) { parseShortcut(value); this.#change({shortcut: value}); }
    get icon() { return this.#state.icon; }
    set icon(value) { this.#change({icon: value}); }
    get description() { return this.#state.description; }
    set description(value) { this.#change({description: value}); }
    get enabled() { return this.#state.enabled; }
    set enabled(value) { this.#change({enabled: Boolean(value)}); }
    get checkable() { return this.#state.checkable; }
    set checkable(value) { this.#change({checkable: Boolean(value)}); }
    get checked() { return this.#state.checked; }
    set checked(value) { this.#change({checked: Boolean(value)}); }

    // Changes many states, and sends one 'change' event
    update(changes) { this.#change(changes); }

    #change(changes) {
        const changed = Object.keys(changes).filter(key => key in this.#state && !Object.is(this.#state[key], changes[key]));
        if (!changed.length) { return; }
        for (const key of changed) { this.#state[key] = changes[key]; }
        this.dispatchEvent(new CustomEvent('change', {detail: {action: this, changed}}));
    }

    // Runs the action, if it is enabled. A checkable action changes its checked state first.
    // source is the element that the user used, for example the menu item.
    trigger(source = null, detail = {}) {
        if (!this.enabled) { return false; }
        if (this.checkable) { this.checked = this.group ? true : !this.checked; }
        const event = new CustomEvent('trigger', {detail: {action: this, source, ...detail}, cancelable: true});
        if (!this.dispatchEvent(event)) { return false; }
        this.run?.({action: this, source, ...detail});
        return true;
    }
}

// Keeps one checked action in a group, such as Left, Center, and Right alignment
export class ActionGroup {
    #actions = new Set();

    add(action) {
        this.#actions.add(action);
        action.group = this;
        action.checkable = true;
        action.addEventListener('change', (e) => {
            if (!e.detail.changed.includes('checked') || !action.checked) { return; }
            for (const other of this.#actions) {
                if (other !== action) { other.checked = false; }
            }
        });
        return action;
    }

    get actions() { return [...this.#actions]; }
    get checked() { return this.actions.find(action => action.checked) ?? null; }
}

// The shortcuts of a part of the page. attach(element) listens for keydown on the element, so a
// shortcut works while the focus is in that element, as in a window of a GUI toolkit. A map on a
// child element hears the key first. When it runs an action, it stops the key, so a parent map and
// the browser do not also use it.
export class ShortcutMap {
    #actions = [];
    #options;

    // ignoreInFields: shortcuts with no Ctrl, Alt, or Meta do not run while the user types in a text field
    constructor(actions = [], {ignoreInFields = true, mac} = {}) {
        this.#options = {ignoreInFields, mac};
        for (const action of actions) { this.add(action); }
    }

    add(action) {
        this.#actions.push(action);
        return () => this.remove(action);
    }

    remove(action) {
        this.#actions = this.#actions.filter(candidate => candidate !== action);
    }

    get actions() { return [...this.#actions]; }

    // The action of the event, or null
    find(event) {
        const typing = this.#options.ignoreInFields && isTextField(event.composedPath?.()[0] ?? event.target);
        return this.#actions.find(action => {
            if (!action.shortcut) { return false; }
            const parsed = parseShortcut(action.shortcut, {mac: this.#options.mac});
            if (typing && !parsed.ctrl && !parsed.alt && !parsed.meta && !/^f\d+$|^escape$/.test(parsed.key)) { return false; }
            return matchesShortcut(event, parsed);
        }) ?? null;
    }

    // Runs the action of the event. A disabled action still stops the key, as a menu shortcut does.
    handle(event) {
        if (event.defaultPrevented || event.isComposing) { return false; }
        const action = this.find(event);
        if (!action) { return false; }
        event.preventDefault();
        event.stopPropagation();
        action.trigger(event.currentTarget ?? null, {event});
        return true;
    }

    // Returns the removal function. In a component: this.own(map.attach(this))
    attach(element) {
        const listener = (e) => this.handle(e);
        element.addEventListener('keydown', listener);
        return () => element.removeEventListener('keydown', listener);
    }
}

function isTextField(element) {
    if (!element || element.nodeType !== 1) { return false; }
    if (element.isContentEditable) { return true; }
    if (element.localName === 'textarea' || element.localName === 'select') { return true; }
    if (element.localName !== 'input') { return false; }
    return !['button', 'checkbox', 'radio', 'range', 'submit', 'reset', 'color', 'file', 'image'].includes(element.type);
}

// Makes a list of actions from plain objects: actionsFrom({save: {label: 'Save', shortcut: 'Mod+S', run}})
export function actionsFrom(definitions) {
    const result = {};
    for (const [id, definition] of Object.entries(definitions)) {
        result[id] = definition instanceof Action ? definition : new Action({id, ...definition});
    }
    return result;
}
