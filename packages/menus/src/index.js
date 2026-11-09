import {
    BaseComponent, RovingFocus, createElementOf, defineElements, isRtl, observeResize, placePopup, placePopupAt,
} from "@catalystcommunity/base-components";
import { Action, ShortcutMap, ariaShortcut, formatShortcut } from "@catalystcommunity/actions";
import * as css from "./styles.js";

// The design and each option are in the README. In short: a menu, a menu bar, and a toolbar show
// actions. The action holds the label, the shortcut, and the enabled and checked states, so each
// place that shows one action shows the same state. Selecting an item calls action.trigger().

let counter = 0;
const nextId = (name) => `zest-${name}-${++counter}`;

// The focused element, also inside shadow roots
function activeElement() {
    let active = document.activeElement;
    while (active?.shadowRoot?.activeElement) { active = active.shadowRoot.activeElement; }
    return active;
}

// A popup goes in the same root as the element that it is for, so that IDs and styles work there
function containerOf(element) {
    const root = element.getRootNode();
    return root instanceof ShadowRoot ? root : document.body;
}

const hasModifier = (e) => e.ctrlKey || e.altKey || e.metaKey;

// The top layer keeps a popup out of a parent with overflow: hidden. With no Popover API, the
// popup still works with position: fixed.
const canPopover = typeof HTMLElement !== 'undefined' && typeof HTMLElement.prototype.showPopover === 'function';
function makePopover(element) {
    if (canPopover) { element.setAttribute('popover', 'manual'); }
}

// '&File' shows "File" with F underlined, and Alt+F opens it. '&&' is one '&'.
export function parseMnemonic(label = '') {
    const source = String(label ?? '');
    let text = '';
    let mnemonic = null;
    for (let i = 0; i < source.length; i++) {
        if (source[i] === '&' && i + 1 < source.length) {
            if (source[i + 1] === '&') { text += '&'; i++; continue; }
            if (mnemonic === null) { mnemonic = {index: text.length, key: source[i + 1].toLowerCase()}; continue; }
        }
        text += source[i];
    }
    return {text, mnemonic};
}

// Doubles each '&' of a text, so that a label from user data, such as "R&D", shows each '&' and has no mnemonic
export function escapeMnemonic(text = '') {
    return String(text ?? '').replaceAll('&', '&&');
}

// The text and the mnemonic of a label. With mnemonic false, each '&' is a plain '&'.
function readLabel(label, mnemonic = true) {
    return mnemonic ? parseMnemonic(label) : {text: String(label ?? ''), mnemonic: null};
}

function labelContent(label, useMnemonic = true) {
    const {text, mnemonic} = readLabel(label, useMnemonic);
    const fragment = document.createDocumentFragment();
    if (!mnemonic) {
        fragment.append(text);
        return fragment;
    }
    const letter = document.createElement('u');
    letter.textContent = text[mnemonic.index];
    fragment.append(text.slice(0, mnemonic.index), letter, text.slice(mnemonic.index + 1));
    return fragment;
}

// An icon is a path to an image, or a short text such as an emoji or a symbol
function setIcon(span, icon) {
    span.replaceChildren();
    span.removeAttribute('data-icon');
    if (!icon) { return; }
    if (/[/.]/.test(icon)) {
        const image = document.createElement('img');
        image.src = icon;
        image.alt = '';
        span.append(image);
    } else {
        span.dataset.icon = icon;
    }
}

function span(className) {
    const element = document.createElement('span');
    element.className = className;
    return element;
}

// A plain object becomes an Action one time, so that its checked state stays between renders
const converted = new WeakMap();
function toAction(definition) {
    if (definition instanceof Action) { return definition; }
    if (!converted.has(definition)) {
        const id = definition.id ?? readLabel(definition.label, definition.mnemonic !== false).text;
        converted.set(definition, new Action({...definition, id}));
    }
    return converted.get(definition);
}

// The data of a menu: an Action, {action}, {label, shortcut, run}, {separator: true}, or a
// submenu {label, items} or {action, items}. Separators at the ends or next to each other go away.
// mnemonic: false on an item shows each '&' of its label as text.
export function menuEntries(items = []) {
    const entries = [];
    for (const item of items ?? []) {
        if (!item) { continue; }
        let entry;
        if (item instanceof Action) {
            entry = {type: 'action', action: item};
        } else if (item.separator) {
            entry = {type: 'separator'};
        } else if (Array.isArray(item.items)) {
            const action = item.action ? toAction(item.action) : null;
            entry = {type: 'submenu', label: item.label ?? action?.label ?? '', icon: item.icon ?? action?.icon ?? null, items: item.items, action, disabled: Boolean(item.disabled)};
        } else {
            entry = {type: 'action', action: toAction(item.action ?? item)};
        }
        if (entry.type === 'separator' && (!entries.length || entries.at(-1).type === 'separator')) { continue; }
        if (entry.type !== 'separator') { entry.mnemonic = item.mnemonic !== false && item.action?.mnemonic !== false; }
        entries.push(entry);
    }
    while (entries.at(-1)?.type === 'separator') { entries.pop(); }
    return entries;
}

// Each action in the data, also in submenus
export function menuActions(items = []) {
    const actions = [];
    for (const entry of menuEntries(items)) {
        if (entry.type === 'action') { actions.push(entry.action); }
        if (entry.type === 'submenu') { actions.push(...menuActions(entry.items)); }
    }
    return actions;
}

const labelOf = (entry) => (entry.type === 'submenu' ? entry.label || entry.action?.label : entry.action.label) ?? '';
// The text and the mnemonic of an entry, in a menu that has mnemonics on or off
const entryLabel = (entry, mnemonics = true) => readLabel(labelOf(entry), mnemonics && entry.mnemonic !== false);
const isEntryDisabled = (entry) => entry.type === 'submenu' ? entry.disabled || entry.action?.enabled === false : !entry.action.enabled;

// Keeps a set of actions, and calls a function when one of them changes
class ActionWatch {
    #watched = new Set();
    #listener;
    constructor(onChange) {
        this.#listener = (e) => onChange(e.detail.action, e.detail.changed);
    }
    set(actions) {
        const next = new Set(actions.filter(Boolean));
        for (const action of this.#watched) {
            if (!next.has(action)) { action.removeEventListener('change', this.#listener); }
        }
        for (const action of next) {
            if (!this.#watched.has(action)) { action.addEventListener('change', this.#listener); }
        }
        this.#watched = next;
    }
    clear() { this.set([]); }
}

function updateMenuItem(item) {
    const entry = item._zestEntry;
    const action = entry.action;
    const on = item._zestMnemonics !== false && entry.mnemonic !== false;
    item.querySelector('.zest-label').replaceChildren(labelContent(labelOf(entry), on));
    setIcon(item.querySelector('.zest-icon'), entry.icon ?? action?.icon);
    const shortcut = item.querySelector('.zest-shortcut');
    if (entry.type === 'action') {
        item.setAttribute('role', action.checkable ? (action.group ? 'menuitemradio' : 'menuitemcheckbox') : 'menuitem');
        if (action.checkable) {
            item.setAttribute('aria-checked', String(action.checked));
        } else {
            item.removeAttribute('aria-checked');
        }
        if (shortcut) { shortcut.textContent = action.shortcut ? formatShortcut(action.shortcut) : ''; }
        if (action.shortcut) {
            item.setAttribute('aria-keyshortcuts', ariaShortcut(action.shortcut));
        } else {
            item.removeAttribute('aria-keyshortcuts');
        }
        if (action.description) { item.title = action.description; }
    }
    if (isEntryDisabled(entry)) {
        item.setAttribute('aria-disabled', 'true');
    } else {
        item.removeAttribute('aria-disabled');
    }
    item.dataset.mnemonic = readLabel(labelOf(entry), on).mnemonic?.key ?? '';
}

// mnemonics is false when the menu has mnemonics off
function makeMenuItem(entry, className = 'zest-item', mnemonics = true) {
    const item = document.createElement('div');
    item.className = className;
    item.tabIndex = -1;
    item.id = nextId('item');
    item._zestEntry = entry;
    item._zestMnemonics = mnemonics;
    // The shortcut is in aria-keyshortcuts, so the name of the item is only its label
    const shortcut = span('zest-shortcut');
    shortcut.setAttribute('aria-hidden', 'true');
    item.append(span('zest-icon'), span('zest-label'), shortcut);
    item.setAttribute('role', 'menuitem');
    if (entry.type === 'submenu') {
        item.classList.add('zest-has-sub');
        item.setAttribute('aria-haspopup', 'menu');
        item.setAttribute('aria-expanded', 'false');
    }
    updateMenuItem(item);
    return item;
}

class PopupMenu extends BaseComponent {
    static styles = css.popupMenu;
    static properties = {
        items: {type: Array, attribute: false, default: () => []},
        label: {type: String},
        // Set mnemonics="false" to show each '&' of the labels as text. The submenus also get it.
        mnemonics: {type: Boolean, default: true},
    };
    // The owner of the menu sets this: {owner, navigate(direction), closed(reason)}.
    // owner is an element where a pointer press does not close the menu, for example its button.
    controller = null;
    // The menu that opened this one as a submenu
    parentMenu = null;
    #menu;
    #roving;
    #watch;
    #open = false;
    #opener = null;
    #child = null;
    #dirty = true;
    #hoverTimer = null;
    #spaceOn = null;
    #removeGlobal = null;

    constructor() {
        super();
        this.#menu = document.createElement('div');
        this.#menu.className = 'zest-popup-menu';
        this.#menu.id = nextId('menu');
        this.#menu.setAttribute('role', 'menu');
        makePopover(this.#menu);
        this.#menu.tabIndex = -1;
        this.#menu.hidden = true;
        this.#watch = new ActionWatch((action) => {
            for (const item of this.#items()) {
                if (item._zestEntry.action === action) { updateMenuItem(item); }
            }
        });
        this.#roving = new RovingFocus(this.#menu, {items: () => this.#items(), orientation: 'vertical', typeahead: true});
        this.#menu.addEventListener('keydown', (e) => this.#onKeydown(e));
        this.#menu.addEventListener('keyup', (e) => this.#onKeyup(e));
        this.#menu.addEventListener('click', (e) => {
            const item = this.#ownItem(e.target);
            if (item) { this.#activate(item, 'pointer'); }
        });
        this.#menu.addEventListener('pointerover', (e) => this.#onHover(e));
        this.#roving.attach();
    }

    // The element with role="menu"
    get menuElement() { return this.#menu; }
    get isOpen() { return this.#open; }
    get rootMenu() {
        let menu = this;
        while (menu.parentMenu) { menu = menu.parentMenu; }
        return menu;
    }

    connectedCallback() {
        super.connectedCallback();
        if (this.#menu.parentNode !== this.root) { this.root.append(this.#menu); }
        this.own(() => {
            this.#watch.clear();
            this.#removeGlobal?.();
            this.#removeGlobal = null;
            clearTimeout(this.#hoverTimer);
            this.#open = false;
            this.#child = null;
        });
        this.#dirty = true;
        this.render();
    }

    propertyChanged() {
        this.#dirty = true;
    }

    render() {
        this.applyStyles();
        if (this.label) {
            this.#menu.setAttribute('aria-label', this.label);
        } else {
            this.#menu.removeAttribute('aria-label');
        }
        if (!this.#dirty) { return; }
        this.#dirty = false;
        this.#child?.close({returnFocus: false});
        const entries = menuEntries(this.items);
        const parts = entries.map((entry) => {
            if (entry.type === 'separator') {
                const separator = document.createElement('div');
                separator.setAttribute('role', 'separator');
                return separator;
            }
            const item = makeMenuItem(entry, 'zest-item', this.mnemonics);
            if (entry.type !== 'submenu') { return item; }
            const wrapper = document.createElement('div');
            wrapper.className = 'zest-entry';
            wrapper.setAttribute('role', 'none');
            const submenu = createElementOf(PopupMenu, 'popup-menu');
            submenu.items = entry.items;
            submenu.label = entryLabel(entry, this.mnemonics).text;
            submenu.mnemonics = this.mnemonics;
            submenu.parentMenu = this;
            item._zestSubmenu = submenu;
            item.setAttribute('aria-controls', submenu.menuElement.id);
            wrapper.append(item, submenu);
            return wrapper;
        });
        this.#menu.replaceChildren(...parts);
        this.#watch.set(entries.map(entry => entry.action));
        this.#roving.update(this.#items()[0]);
    }

    // Opens the menu next to an anchor, or at a point. focus: 'first', 'last', or 'none'.
    // opener gets the focus back when the menu closes.
    open({anchor = null, x, y, placement = 'bottom-start', focus = 'first', opener = activeElement()} = {}) {
        if (!this.isConnected) {
            throw new Error('A popup menu must be on the page before it opens');
        }
        if (this.#dirty) { this.render(); }
        if (!this.#open) {
            this.#open = true;
            this.#opener = opener;
            this.#menu.hidden = false;
            try { this.#menu.showPopover?.(); } catch { /* It is open already */ }
            if (!this.parentMenu) { this.#listenOutside(); }
        }
        if (anchor) {
            placePopup(this.#menu, anchor, {placement, offset: placement.startsWith('right') || placement.startsWith('left') ? 0 : 2});
        } else if (x !== undefined) {
            placePopupAt(this.#menu, x, y);
        }
        const items = this.#items();
        const target = focus === 'last' ? items.at(-1) : (focus === 'first' ? items[0] : null);
        if (target) {
            this.#roving.focus(target);
        } else {
            this.#roving.update(items[0]);
        }
        this.emit('popup-menu-open', {});
        return this;
    }

    // Closes the menu and its submenus. returnFocus gives the focus back to the opener.
    close({returnFocus = true, reason = 'code'} = {}) {
        if (!this.#open) { return; }
        this.#child?.close({returnFocus: false, reason});
        this.#child = null;
        this.#open = false;
        clearTimeout(this.#hoverTimer);
        this.#removeGlobal?.();
        this.#removeGlobal = null;
        try { this.#menu.hidePopover?.(); } catch { /* It is closed already */ }
        this.#menu.hidden = true;
        const opener = this.#opener;
        this.#opener = null;
        if (returnFocus && opener?.isConnected) { opener.focus({preventScroll: true}); }
        this.controller?.closed?.(reason);
        if (this.isConnected) { this.emit('popup-menu-close', {reason}); }
    }

    #items() {
        const items = [];
        for (const child of this.#menu.children) {
            if (child.classList.contains('zest-item')) { items.push(child); }
            if (child.classList.contains('zest-entry')) { items.push(child.firstElementChild); }
        }
        return items;
    }

    // An item of this menu, not of a submenu
    #ownItem(target) {
        const item = target?.closest?.('.zest-item');
        return item && item.closest('.zest-popup-menu') === this.#menu ? item : null;
    }

    // A pointer press outside each open menu closes them all, and so does a change of the window
    #listenOutside() {
        const inside = (path) => path.includes(this.#menu) || (this.controller?.owner && path.includes(this.controller.owner));
        const pointerdown = (e) => {
            if (!inside(e.composedPath())) { this.close({returnFocus: false, reason: 'outside'}); }
        };
        const resize = () => this.close({returnFocus: false, reason: 'resize'});
        const scroll = (e) => {
            if (!e.composedPath().includes(this.#menu)) { this.close({returnFocus: false, reason: 'scroll'}); }
        };
        document.addEventListener('pointerdown', pointerdown, true);
        window.addEventListener('resize', resize);
        // The browser sends a scroll event in the next frame. A focus that scrolled the page just
        // before the menu opened must not close it, so the scroll listener starts after that frame.
        const frame = requestAnimationFrame(() => document.addEventListener('scroll', scroll, true));
        this.#removeGlobal = () => {
            cancelAnimationFrame(frame);
            document.removeEventListener('pointerdown', pointerdown, true);
            window.removeEventListener('resize', resize);
            document.removeEventListener('scroll', scroll, true);
        };
    }

    #onKeydown(e) {
        const item = this.#ownItem(e.target);
        if (!item || e.isComposing) { return; }
        const rtl = isRtl(this.#menu);
        const forward = rtl ? 'ArrowLeft' : 'ArrowRight';
        const back = rtl ? 'ArrowRight' : 'ArrowLeft';
        const entry = item._zestEntry;
        if (hasModifier(e) && e.key !== 'Tab') { return; }
        switch (e.key) {
        case 'Enter':
            e.preventDefault();
            this.#activate(item, 'keyboard');
            return;
        case ' ':
            // Space selects on keyup, so that the keyup does not reach the element that gets the focus
            e.preventDefault();
            this.#spaceOn = item;
            return;
        case forward:
            e.preventDefault();
            if (entry.type === 'submenu' && !isEntryDisabled(entry)) {
                this.#openSubmenu(item, 'first');
            } else {
                this.rootMenu.controller?.navigate?.(1);
            }
            return;
        case back:
            e.preventDefault();
            if (this.parentMenu) {
                this.close({returnFocus: true, reason: 'back'});
            } else {
                this.controller?.navigate?.(-1);
            }
            return;
        case 'Escape':
            // preventDefault also stops a modal dialog from closing
            e.preventDefault();
            e.stopPropagation();
            this.close({returnFocus: true, reason: 'escape'});
            return;
        case 'Tab':
            // The focus goes back to the opener, and then the browser moves it as usual
            this.rootMenu.close({returnFocus: true, reason: 'tab'});
            return;
        }
        if (e.key.length === 1 && e.key.trim()) {
            const matches = this.#items().filter(candidate => candidate.dataset.mnemonic === e.key.toLowerCase());
            if (matches.length === 1) {
                e.preventDefault();
                this.#roving.focus(matches[0]);
                this.#activate(matches[0], 'keyboard');
            }
        }
    }

    #onKeyup(e) {
        if (e.key !== ' ') { return; }
        const item = this.#ownItem(e.target);
        const pressed = this.#spaceOn;
        this.#spaceOn = null;
        if (item && item === pressed) {
            e.preventDefault();
            this.#activate(item, 'keyboard');
        }
    }

    #onHover(e) {
        if (e.pointerType === 'touch') { return; }
        const item = this.#ownItem(e.target);
        if (!item) { return; }
        if (activeElement() !== item) {
            item.focus({preventScroll: true});
            this.#roving.update(item);
        }
        clearTimeout(this.#hoverTimer);
        if (item._zestSubmenu) {
            if (this.#child !== item._zestSubmenu && !isEntryDisabled(item._zestEntry)) {
                this.#hoverTimer = setTimeout(() => this.#openSubmenu(item, 'none'), 200);
            }
        } else if (this.#child) {
            this.#hoverTimer = setTimeout(() => {
                this.#child?.close({returnFocus: false, reason: 'hover'});
            }, 300);
        }
    }

    #openSubmenu(item, focus) {
        clearTimeout(this.#hoverTimer);
        const submenu = item._zestSubmenu;
        if (this.#child && this.#child !== submenu) { this.#child.close({returnFocus: false, reason: 'other'}); }
        this.#child = submenu;
        submenu.controller = {
            closed: () => {
                item.setAttribute('aria-expanded', 'false');
                if (this.#child === submenu) { this.#child = null; }
            },
        };
        item.setAttribute('aria-expanded', 'true');
        submenu.open({anchor: item, placement: 'right-start', focus, opener: item});
    }

    #activate(item, how) {
        const entry = item._zestEntry;
        if (isEntryDisabled(entry)) { return; }
        if (entry.type === 'submenu') {
            this.#openSubmenu(item, 'first');
            return;
        }
        const root = this.rootMenu;
        root.close({returnFocus: true, reason: 'select'});
        entry.action.trigger(item, {menu: root, how});
        root.emit('popup-menu-select', {id: entry.action.id, action: entry.action});
    }
}

class ShadowPopupMenu extends PopupMenu {
    shadow;
    constructor() {
        super();
        this.shadow = this.attachShadow({mode: 'open'});
        this.root = this.shadow;
    }
}

class MenuBar extends BaseComponent {
    static styles = css.menuBar;
    static properties = {
        items: {type: Array, attribute: false, default: () => []},
        label: {type: String, default: 'Menu'},
        // 'document', or the ID of an element. Each shortcut of the menus works in it.
        shortcutsFor: {type: String},
        // Alt alone moves the focus to the bar, as F10 does. Set alt-key="false" to turn it off.
        altKey: {type: Boolean, default: true},
        // Set mnemonics="false" to show each '&' of the labels as text. Alt and a letter then open nothing.
        mnemonics: {type: Boolean, default: true},
    };
    #bar;
    #roving;
    #watch;
    #shortcuts = new ShortcutMap();
    #openIndex = -1;
    #previousFocus = null;
    #unbind = null;
    #dirty = true;

    constructor() {
        super();
        this.#bar = document.createElement('div');
        this.#bar.className = 'zest-menu-bar';
        this.#bar.setAttribute('role', 'menubar');
        this.#watch = new ActionWatch((action) => {
            for (const top of this.#tops()) {
                if (top._zestEntry.action === action) { this.#updateTop(top); }
            }
        });
        this.#roving = new RovingFocus(this.#bar, {
            items: () => this.#tops(),
            orientation: 'horizontal',
            typeahead: true,
            onMove: (top) => {
                if (this.#openIndex >= 0 && top._zestMenu) { this.#openAt(this.#tops().indexOf(top), 'none'); }
            },
        });
        this.#roving.attach();
        this.#bar.addEventListener('keydown', (e) => this.#onKeydown(e));
        this.#bar.addEventListener('click', (e) => this.#onClick(e));
        this.#bar.addEventListener('pointerover', (e) => {
            const top = this.#topOf(e.target);
            if (!top || e.pointerType === 'touch') { return; }
            const index = this.#tops().indexOf(top);
            if (this.#openIndex >= 0 && this.#openIndex !== index && top._zestMenu) {
                top.focus({preventScroll: true});
                this.#openAt(index, 'none');
            }
        });
    }

    get menuBarElement() { return this.#bar; }

    connectedCallback() {
        super.connectedCallback();
        if (this.#bar.parentNode !== this.root) { this.root.append(this.#bar); }
        this.own(() => {
            this.#watch.clear();
            this.#unbind?.();
            this.#unbind = null;
            this.#openIndex = -1;
        });
        this.#dirty = true;
        this.render();
        this.#bindAttribute();
    }

    propertyChanged(name) {
        if (name === 'mnemonics') { this.#dirty = true; }
        if (name === 'items') {
            this.#dirty = true;
            this.#shortcuts = new ShortcutMap(menuActions(this.items));
        }
        if (name === 'shortcutsFor' && this.isConnected) { this.#bindAttribute(); }
    }

    #bindAttribute() {
        this.#unbind?.();
        this.#unbind = null;
        if (!this.shortcutsFor) { return; }
        const root = this.getRootNode();
        const target = this.shortcutsFor === 'document' ? document : (root.getElementById?.(this.shortcutsFor) ?? document.getElementById(this.shortcutsFor));
        if (!target) {
            throw new Error(`menu-bar shortcuts-for names no element: ${this.shortcutsFor}`);
        }
        this.#unbind = this.bindShortcuts(target);
    }

    // The shortcut of each action works while the focus is in the scope. F10, Alt, and Alt with a
    // mnemonic letter go to the bar. Returns the removal function.
    bindShortcuts(scope = document) {
        let altAlone = false;
        const keydown = (e) => {
            if (e.defaultPrevented || e.isComposing) { return; }
            if (e.key !== 'Alt') { altAlone = false; }
            if (e.key === 'F10' && !hasModifier(e) && !e.shiftKey) {
                e.preventDefault();
                this.focusBar();
                return;
            }
            if (e.altKey && !e.ctrlKey && !e.metaKey && e.key !== 'Alt') {
                const key = /^Key[A-Z]$/.test(e.code ?? '') ? e.code.slice(3).toLowerCase() : e.key.toLowerCase();
                const top = this.#tops().find(candidate => candidate.dataset.mnemonic === key);
                if (top) {
                    e.preventDefault();
                    this.#rememberFocus();
                    this.#activateTop(top, 'first');
                    return;
                }
            }
            if (this.#shortcuts.handle(e)) { return; }
            if (e.key === 'Alt' && !e.repeat && !e.ctrlKey && !e.metaKey && !e.shiftKey) { altAlone = true; }
        };
        const keyup = (e) => {
            if (e.key !== 'Alt' || !altAlone || !this.altKey) { return; }
            altAlone = false;
            e.preventDefault();
            if (this.#bar.contains(activeElement()) && this.#openIndex < 0) {
                this.#returnFocus();
            } else if (this.#openIndex < 0) {
                this.focusBar();
            }
        };
        const pointerdown = () => { altAlone = false; };
        scope.addEventListener('keydown', keydown);
        scope.addEventListener('keyup', keyup);
        scope.addEventListener('pointerdown', pointerdown);
        return () => {
            scope.removeEventListener('keydown', keydown);
            scope.removeEventListener('keyup', keyup);
            scope.removeEventListener('pointerdown', pointerdown);
        };
    }

    // Moves the focus to the bar. Escape gives it back.
    focusBar() {
        this.#rememberFocus();
        this.#roving.focus(this.#roving.current);
    }

    // Opens the menu at the index, or the one with the label
    openMenu(which = 0, focus = 'first') {
        const tops = this.#tops();
        const index = typeof which === 'number' ? which : tops.findIndex(top => entryLabel(top._zestEntry, this.mnemonics).text === which);
        this.#rememberFocus();
        this.#openAt(index, focus);
    }

    closeMenus() {
        if (this.#openIndex >= 0) { this.#tops()[this.#openIndex]?._zestMenu?.close({returnFocus: false}); }
    }

    render() {
        this.applyStyles();
        this.#bar.setAttribute('aria-label', this.label);
        if (!this.#dirty) { return; }
        this.#dirty = false;
        this.closeMenus();
        const entries = menuEntries(this.items).filter(entry => entry.type !== 'separator');
        const parts = entries.map((entry, index) => {
            const top = makeMenuItem(entry, 'zest-top', this.mnemonics);
            top.classList.remove('zest-has-sub');
            top.querySelector('.zest-shortcut').remove();
            const wrapper = document.createElement('div');
            wrapper.setAttribute('role', 'none');
            wrapper.className = 'zest-entry';
            wrapper.append(top);
            if (entry.type === 'submenu') {
                const menu = createElementOf(PopupMenu, 'popup-menu');
                menu.items = entry.items;
                menu.label = entryLabel(entry, this.mnemonics).text;
                menu.mnemonics = this.mnemonics;
                menu.controller = {
                    owner: top,
                    navigate: (direction) => this.#step(index, direction),
                    closed: () => {
                        top.setAttribute('aria-expanded', 'false');
                        if (this.#openIndex === index) { this.#openIndex = -1; }
                    },
                };
                top._zestMenu = menu;
                top.setAttribute('aria-controls', menu.menuElement.id);
                wrapper.append(menu);
            }
            return wrapper;
        });
        // New items replace the old ones. If the user was on an item, the focus stays at that place.
        const active = (this.root === this ? document : this.root).activeElement;
        const focusedIndex = this.#tops().findIndex(top => top === active);
        this.#bar.replaceChildren(...parts);
        this.#watch.set(entries.map(entry => entry.action));
        const tops = this.#tops();
        if (focusedIndex >= 0 && tops.length) {
            const keep = tops[Math.min(focusedIndex, tops.length - 1)];
            this.#roving.update(keep);
            keep.focus({preventScroll: true});
        } else {
            this.#roving.update(tops[0]);
        }
    }

    #tops() {
        return [...this.#bar.children].map(entry => entry.firstElementChild).filter(Boolean);
    }

    #topOf(target) {
        const top = target?.closest?.('.zest-top');
        return top && top.parentElement?.parentElement === this.#bar ? top : null;
    }

    #updateTop(top) {
        updateMenuItem(top);
        top.setAttribute('role', 'menuitem');
        top.removeAttribute('aria-checked');
    }

    #rememberFocus() {
        const active = activeElement();
        if (active && !this.#bar.contains(active) && !this.#tops().some(top => top._zestMenu?.contains(active))) {
            this.#previousFocus = active;
        }
    }

    #returnFocus() {
        const previous = this.#previousFocus;
        this.#previousFocus = null;
        if (previous?.isConnected) {
            previous.focus({preventScroll: true});
        } else {
            activeElement()?.blur?.();
        }
    }

    #openAt(index, focus) {
        const tops = this.#tops();
        const top = tops[index];
        if (!top?._zestMenu || isEntryDisabled(top._zestEntry)) { return; }
        if (this.#openIndex >= 0 && this.#openIndex !== index) {
            tops[this.#openIndex]?._zestMenu?.close({returnFocus: false, reason: 'other'});
        }
        this.#openIndex = index;
        top.setAttribute('aria-expanded', 'true');
        this.#roving.update(top);
        top._zestMenu.open({anchor: top, placement: 'bottom-start', focus, opener: top});
    }

    #activateTop(top, focus) {
        const entry = top._zestEntry;
        if (top._zestMenu) {
            this.#openAt(this.#tops().indexOf(top), focus);
        } else if (entry.type === 'action' && entry.action.enabled) {
            entry.action.trigger(top, {menu: this});
            this.emit('menu-bar-select', {id: entry.action.id, action: entry.action});
        }
    }

    // From a menu, Left and Right go to the next menu of the bar, and open it
    #step(index, direction) {
        const tops = this.#tops();
        const next = (index + direction + tops.length) % tops.length;
        tops[index]?._zestMenu?.close({returnFocus: false, reason: 'navigate'});
        this.#roving.focus(tops[next]);
        if (tops[next]._zestMenu) { this.#openAt(next, 'first'); }
    }

    #onKeydown(e) {
        const top = this.#topOf(e.target);
        if (!top || hasModifier(e) || e.isComposing) { return; }
        switch (e.key) {
        case 'ArrowDown':
        case 'Enter':
        case ' ':
            e.preventDefault();
            this.#activateTop(top, 'first');
            return;
        case 'ArrowUp':
            if (top._zestMenu) {
                e.preventDefault();
                this.#activateTop(top, 'last');
            }
            return;
        case 'Escape':
            e.preventDefault();
            if (this.#openIndex >= 0) {
                this.closeMenus();
            } else {
                this.#returnFocus();
            }
            return;
        }
        if (e.key.length === 1) {
            const match = this.#tops().find(candidate => candidate.dataset.mnemonic === e.key.toLowerCase());
            if (match) {
                e.preventDefault();
                this.#roving.focus(match);
                this.#activateTop(match, 'first');
            }
        }
    }

    #onClick(e) {
        const top = this.#topOf(e.target);
        if (!top) { return; }
        const index = this.#tops().indexOf(top);
        if (top._zestMenu && this.#openIndex === index) {
            top._zestMenu.close({returnFocus: false, reason: 'toggle'});
            return;
        }
        this.#rememberFocus();
        this.#activateTop(top, e.detail === 0 ? 'first' : 'none');
    }
}

class ShadowMenuBar extends MenuBar {
    shadow;
    constructor() {
        super();
        this.shadow = this.attachShadow({mode: 'open'});
        this.root = this.shadow;
    }
}

// Makes a button open a menu, as the ARIA menu button pattern tells. Returns the open function.
function wireMenuButton(button, menu, placement) {
    button.setAttribute('aria-haspopup', 'menu');
    button.setAttribute('aria-expanded', 'false');
    button.setAttribute('aria-controls', menu.menuElement.id);
    menu.controller = {owner: button, closed: () => button.setAttribute('aria-expanded', 'false')};
    const open = (focus) => {
        if (button.disabled || button.getAttribute('aria-disabled') === 'true') { return; }
        button.setAttribute('aria-expanded', 'true');
        menu.open({anchor: button, placement: placement(), focus, opener: button});
    };
    button.addEventListener('click', () => {
        if (menu.isOpen) {
            menu.close({returnFocus: true, reason: 'toggle'});
        } else {
            open('first');
        }
    });
    button.addEventListener('keydown', (e) => {
        if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && !hasModifier(e)) {
            e.preventDefault();
            open(e.key === 'ArrowUp' ? 'last' : 'first');
        }
    });
    return open;
}

// The text that a screen reader reads from the nodes. Text in an aria-hidden element does not count.
function spokenText(nodes) {
    let text = '';
    for (const node of nodes) {
        if (node.nodeType === Node.TEXT_NODE) { text += node.textContent; }
        if (node.nodeType !== Node.ELEMENT_NODE || node.getAttribute('aria-hidden') === 'true') { continue; }
        if (node.localName === 'img') { text += node.getAttribute('alt') ?? ''; }
        text += spokenText(node.localName === 'slot' ? node.assignedNodes({flatten: true}) : node.childNodes);
    }
    return text.trim();
}

class MenuButton extends BaseComponent {
    static styles = css.menuButton;
    static properties = {
        label: {type: String, default: 'Menu'},
        icon: {type: String},
        items: {type: Array, attribute: false, default: () => []},
        // A split button: the main part runs `action` (or the first action of the items), and the arrow opens the menu
        split: {type: Boolean},
        action: {type: Object, attribute: false},
        moreLabel: {type: String, default: 'More options'},
        placement: {type: String, default: 'bottom-start'},
        disabled: {type: Boolean, reflect: true},
        // Set mnemonics="false" to show each '&' of the labels as text, also in the menu
        mnemonics: {type: Boolean, default: true},
    };
    #wrapper;
    #main;
    #toggle;
    #content;
    #slot = null;
    #menu;
    #watch;
    #open;

    constructor() {
        super();
        this.#wrapper = document.createElement('span');
        this.#wrapper.className = 'zest-menu-button';
        this.#main = document.createElement('button');
        this.#main.type = 'button';
        this.#main.className = 'zest-main';
        this.#main.append(span('zest-icon'), span('zest-label'));
        this.#toggle = document.createElement('button');
        this.#toggle.type = 'button';
        this.#toggle.className = 'zest-toggle';
        this.#toggle.append(span('zest-icon'), span('zest-label'));
        // The children of the application, as the face of the button in place of the icon and the label
        this.#content = span('zest-content');
        this.#content.hidden = true;
        this.#menu = createElementOf(PopupMenu, 'popup-menu');
        this.#open = wireMenuButton(this.#toggle, this.#menu, () => this.placement);
        this.#main.addEventListener('click', () => {
            const action = this.#defaultAction();
            if (action?.trigger(this.#main)) { this.emit('menu-button-select', {id: action.id, action}); }
        });
        this.#menu.addEventListener('popup-menu-select', (e) => {
            e.stopPropagation();
            this.emit('menu-button-select', e.detail);
        });
        this.#wrapper.append(this.#main, this.#toggle, this.#menu);
        this.#watch = new ActionWatch(() => this.#update());
    }

    get menu() { return this.#menu; }

    connectedCallback() {
        super.connectedCallback();
        if (this.#wrapper.parentNode !== this.root) { this.root.append(this.#wrapper); }
        if (this.root === this) {
            // In the light DOM, children that the application adds later also go in the face
            this.#takeContent();
            const observer = new MutationObserver(() => {
                if (this.#takeContent()) { this.#update(); }
            });
            observer.observe(this, {childList: true});
            this.own(() => observer.disconnect());
        } else if (!this.#slot) {
            this.#slot = document.createElement('slot');
            this.#slot.addEventListener('slotchange', () => this.#update());
            this.#content.append(this.#slot);
        }
        this.own(() => this.#watch.clear());
        this.render();
    }

    // Moves the children of the application into the face. Gives true if it moved one.
    #takeContent() {
        const nodes = [...this.childNodes].filter(node => node !== this.#wrapper && node.localName !== 'style');
        this.#content.append(...nodes);
        return nodes.length > 0;
    }

    #contentNodes() {
        return this.#slot ? this.#slot.assignedNodes({flatten: true}) : [...this.#content.childNodes];
    }

    // Opens the menu, for example from a shortcut
    open(focus = 'first') {
        this.#open(focus);
    }

    close() {
        this.#menu.close({returnFocus: true});
    }

    focus(options) { (this.split ? this.#main : this.#toggle).focus(options); }

    #defaultAction() {
        if (this.action) { return this.action instanceof Action ? this.action : toAction(this.action); }
        return menuActions(this.items)[0] ?? null;
    }

    render() {
        this.applyStyles();
        this.#menu.items = this.items;
        this.#menu.label = readLabel(this.label, this.mnemonics).text;
        this.#menu.mnemonics = this.mnemonics;
        this.#watch.set(this.split ? [this.#defaultAction()] : []);
        this.#update();
    }

    #update() {
        const split = this.split;
        const mnemonics = this.mnemonics;
        this.#wrapper.classList.toggle('zest-split', split);
        this.#main.hidden = !split;
        const action = split ? this.#defaultAction() : null;
        // The face is the main part of a split button, or else the button that opens the menu
        const face = split ? this.#main : this.#toggle;
        const custom = this.#contentNodes().some(node => node.nodeType === Node.ELEMENT_NODE || node.textContent.trim());
        if (this.#content.parentNode !== face) { face.append(this.#content); }
        this.#content.hidden = !custom;
        this.#wrapper.classList.toggle('zest-custom', custom);
        const faceLabel = split ? (action?.label ?? this.label) : this.label;
        this.#main.querySelector('.zest-label').replaceChildren(split && custom ? '' : labelContent(action?.label ?? this.label, mnemonics));
        setIcon(this.#main.querySelector('.zest-icon'), split && !custom ? (action?.icon ?? this.icon) : null);
        this.#main.disabled = this.disabled || (action ? !action.enabled : false);
        const toggleLabel = this.#toggle.querySelector('.zest-label');
        if (split) {
            toggleLabel.replaceChildren();
            setIcon(this.#toggle.querySelector('.zest-icon'), null);
            this.#toggle.setAttribute('aria-label', this.moreLabel);
        } else {
            toggleLabel.replaceChildren(custom ? '' : labelContent(this.label, mnemonics));
            setIcon(this.#toggle.querySelector('.zest-icon'), custom ? null : this.icon);
            this.#toggle.removeAttribute('aria-label');
        }
        // Content with no text, such as an image with no alt text, gets its name from the label
        this.#main.removeAttribute('aria-label');
        if (custom && !spokenText(this.#contentNodes())) {
            face.setAttribute('aria-label', readLabel(faceLabel, mnemonics).text);
        }
        this.#toggle.disabled = this.disabled;
    }
}

class ShadowMenuButton extends MenuButton {
    shadow;
    constructor() {
        super();
        this.shadow = this.attachShadow({mode: 'open'});
        this.root = this.shadow;
    }
}

const toolTipText = (action, mnemonic = true) => {
    const label = readLabel(action.label, mnemonic).text;
    const parts = [action.shortcut ? `${label} (${formatShortcut(action.shortcut)})` : label];
    if (action.description) { parts.push(action.description); }
    return parts.join(': ');
};

class ToolBar extends BaseComponent {
    static styles = css.toolBar;
    static properties = {
        items: {type: Array, attribute: false, default: () => []},
        label: {type: String, default: 'Toolbar'},
        // Only the icon shows. The label is the name of the button, and the tooltip shows it.
        iconsOnly: {type: Boolean},
        orientation: {type: String, default: 'horizontal'},
        // The items go on more lines when they do not fit, in place of a "More" menu
        wrap: {type: Boolean},
        moreLabel: {type: String, default: 'More'},
        // Set mnemonics="false" to show each '&' of the labels as text, also in the menus of the toolbar
        mnemonics: {type: Boolean, default: true},
    };
    #bar;
    #roving;
    #watch;
    #more;
    #moreMenu;
    #tools = [];
    #tips = [];
    #dirty = true;

    constructor() {
        super();
        this.#bar = document.createElement('div');
        this.#bar.className = 'zest-tool-bar';
        this.#bar.setAttribute('role', 'toolbar');
        this.#more = document.createElement('button');
        this.#more.type = 'button';
        this.#more.className = 'zest-more';
        this.#more.hidden = true;
        const moreIcon = span('zest-icon');
        moreIcon.dataset.icon = '⋯';
        this.#more.append(moreIcon);
        this.#moreMenu = createElementOf(PopupMenu, 'popup-menu');
        wireMenuButton(this.#more, this.#moreMenu, () => 'bottom-end');
        this.#roving = new RovingFocus(this.#bar, {
            items: () => [...this.#tools.filter(tool => tool.localName === 'button'), this.#more],
            orientation: 'horizontal',
        });
        this.#roving.attach();
        this.#watch = new ActionWatch((action, changed) => {
            for (const tool of this.#tools) {
                if (tool._zestEntry?.action === action) { this.#updateTool(tool); }
            }
            if (changed.includes('label') || changed.includes('icon')) { this.#layout(); }
        });
        this.#bar.addEventListener('click', (e) => {
            const tool = e.target.closest?.('button.zest-tool');
            if (!tool || !this.#tools.includes(tool)) { return; }
            const entry = tool._zestEntry;
            if (entry.type !== 'action' || !entry.action.enabled) { return; }
            if (entry.action.trigger(tool, {toolbar: this})) {
                this.emit('tool-bar-select', {id: entry.action.id, action: entry.action});
            }
        });
    }

    get toolBarElement() { return this.#bar; }

    connectedCallback() {
        super.connectedCallback();
        if (this.#bar.parentNode !== this.root) { this.root.append(this.#bar); }
        this.own(observeResize(this.#bar, () => this.#layout()));
        this.own(() => {
            this.#watch.clear();
            this.#removeTips();
        });
        this.#dirty = true;
        this.render();
    }

    propertyChanged(name) {
        if (['items', 'iconsOnly', 'mnemonics'].includes(name)) { this.#dirty = true; }
    }

    render() {
        this.applyStyles();
        const vertical = this.orientation === 'vertical';
        this.#bar.setAttribute('aria-label', this.label);
        this.#bar.setAttribute('aria-orientation', vertical ? 'vertical' : 'horizontal');
        this.#bar.classList.toggle('zest-wrap', this.wrap);
        this.#bar.classList.toggle('zest-icons-only', this.iconsOnly);
        this.#more.setAttribute('aria-label', this.moreLabel);
        this.#moreMenu.label = this.moreLabel;
        this.#moreMenu.mnemonics = this.mnemonics;
        if (this.#dirty) {
            this.#dirty = false;
            this.#removeTips();
            const entries = menuEntries(this.items);
            this.#tools = entries.map(entry => this.#makeTool(entry, vertical));
            // The menus go after the items, so that they take no room in the bar
            this.#bar.replaceChildren(...this.#tools, this.#more, this.#moreMenu, ...this.#tools.map(tool => tool._zestMenu).filter(Boolean));
            this.#watch.set(entries.map(entry => entry.action));
            for (const tool of this.#tools) {
                if (tool.localName === 'button' && tool._zestEntry.type === 'action' && (this.iconsOnly || tool._zestEntry.action.shortcut || tool._zestEntry.action.description)) {
                    const action = tool._zestEntry.action;
                    const mnemonic = this.mnemonics && tool._zestEntry.mnemonic !== false;
                    this.#tips.push(attachToolTip(tool, () => toolTipText(action, mnemonic), {placement: vertical ? 'right' : 'bottom'}));
                }
            }
            this.#roving.update(this.#tools.find(tool => tool.localName === 'button') ?? this.#more);
        }
        for (const separator of this.#tools.filter(tool => tool.getAttribute('role') === 'separator')) {
            separator.setAttribute('aria-orientation', vertical ? 'horizontal' : 'vertical');
        }
        this.#layout();
    }

    #removeTips() {
        for (const remove of this.#tips) { remove(); }
        this.#tips = [];
    }

    #makeTool(entry, vertical) {
        if (entry.type === 'separator') {
            const separator = document.createElement('div');
            separator.setAttribute('role', 'separator');
            separator._zestEntry = entry;
            return separator;
        }
        const tool = document.createElement('button');
        tool.type = 'button';
        tool.className = 'zest-tool';
        tool._zestEntry = entry;
        tool.append(span('zest-icon'), span('zest-label'));
        if (entry.type === 'submenu') {
            const menu = createElementOf(PopupMenu, 'popup-menu');
            menu.items = entry.items;
            menu.label = entryLabel(entry, this.mnemonics).text;
            menu.mnemonics = this.mnemonics;
            tool._zestMenu = menu;
            wireMenuButton(tool, menu, () => (vertical ? 'right-start' : 'bottom-start'));
        }
        this.#updateTool(tool);
        return tool;
    }

    #updateTool(tool) {
        const entry = tool._zestEntry;
        const action = entry.action;
        const label = tool.querySelector('.zest-label');
        label.replaceChildren(labelContent(labelOf(entry), this.mnemonics && entry.mnemonic !== false));
        label.classList.toggle('zest-sr', this.iconsOnly && Boolean(entry.icon ?? action?.icon));
        setIcon(tool.querySelector('.zest-icon'), entry.icon ?? action?.icon);
        const disabled = isEntryDisabled(entry);
        if (disabled) {
            tool.setAttribute('aria-disabled', 'true');
        } else {
            tool.removeAttribute('aria-disabled');
        }
        if (entry.type === 'action' && action.checkable) {
            tool.setAttribute('aria-pressed', String(action.checked));
        } else {
            tool.removeAttribute('aria-pressed');
        }
        if (entry.type === 'action' && action.shortcut) {
            tool.setAttribute('aria-keyshortcuts', ariaShortcut(action.shortcut));
        } else {
            tool.removeAttribute('aria-keyshortcuts');
        }
    }

    // The items that do not fit go into the "More" menu
    #layout() {
        if (!this.isConnected) { return; }
        const tools = this.#tools;
        for (const tool of tools) { tool.hidden = false; }
        const overflowing = !this.wrap && this.orientation !== 'vertical' && tools.length && typeof ResizeObserver === 'function';
        this.#more.hidden = !overflowing;
        if (!overflowing) { return; }
        const bar = this.#bar.getBoundingClientRect();
        const style = getComputedStyle(this.#bar);
        const rtl = style.direction === 'rtl';
        const inset = (side) => parseFloat(style[`padding${side}`]) + parseFloat(style[`border${side}Width`]);
        const start = rtl ? bar.right - inset('Right') : bar.left + inset('Left');
        const limit = bar.width - inset('Left') - inset('Right');
        const edge = (element) => {
            const box = element.getBoundingClientRect();
            return rtl ? start - box.left : box.right - start;
        };
        const fits = (element, room) => edge(element) <= room + 0.5;
        if (fits(tools.at(-1), limit)) {
            this.#more.hidden = true;
            this.#moreMenu.items = [];
            this.#roving.update();
            return;
        }
        const room = limit - this.#more.getBoundingClientRect().width - 2;
        let cut = tools.findIndex(tool => !fits(tool, room));
        if (cut < 0) { cut = tools.length; }
        while (cut > 0 && tools[cut - 1].getAttribute('role') === 'separator') { cut--; }
        const hidden = tools.slice(cut);
        for (const tool of hidden) { tool.hidden = true; }
        this.#moreMenu.items = hidden.map(tool => {
            const entry = tool._zestEntry;
            if (entry.type === 'separator') { return {separator: true}; }
            if (entry.type === 'submenu') { return {label: entry.label, icon: entry.icon, items: entry.items, action: entry.action, mnemonic: entry.mnemonic}; }
            return {action: entry.action, mnemonic: entry.mnemonic};
        });
        if (hidden.includes(activeElement())) { this.#roving.focus(this.#more); }
        this.#roving.update();
    }
}

class ShadowToolBar extends ToolBar {
    shadow;
    constructor() {
        super();
        this.shadow = this.attachShadow({mode: 'open'});
        this.root = this.shadow;
    }
}

// The tooltip that shows now. Only one shows at a time.
let shownTip = null;

class ToolTip extends BaseComponent {
    static styles = css.toolTip;
    static properties = {
        // The ID of the element that the tooltip is for, in the same root
        for: {type: String},
        text: {type: String},
        placement: {type: String, default: 'top'},
        delay: {type: Number, default: 500},
    };
    // A function that gives the text each time that the tooltip shows
    textSource = null;
    #target = null;
    #showTimer = null;
    #hideTimer = null;
    #removeEscape = null;

    constructor() {
        super();
        this.addEventListener('pointerenter', () => clearTimeout(this.#hideTimer));
        this.addEventListener('pointerleave', () => this.#hideSoon());
    }

    get isShown() { return shownTip === this; }

    connectedCallback() {
        super.connectedCallback();
        this.classList.add('zest-tool-tip');
        this.setAttribute('role', 'tooltip');
        makePopover(this);
        this.id ||= nextId('tip');
        this.own(() => this.hide());
        this.render();
        if (this.for) {
            const target = this.getRootNode().getElementById?.(this.for) ?? document.getElementById(this.for);
            if (target) { this.own(this.attachTo(target)); }
        }
    }

    render() {
        this.applyStyles();
        if (this.text !== null && this.text !== undefined) { this.textContent = this.text; }
    }

    // Shows the tooltip for the element on hover and on keyboard focus. Returns the removal function.
    attachTo(element) {
        this.id ||= nextId('tip');
        this.#target = element;
        const ids = (element.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean);
        if (!ids.includes(this.id)) { element.setAttribute('aria-describedby', [...ids, this.id].join(' ')); }
        const enter = (e) => {
            if (e.pointerType === 'touch') { return; }
            clearTimeout(this.#hideTimer);
            clearTimeout(this.#showTimer);
            this.#showTimer = setTimeout(() => this.show(), shownTip ? 0 : this.delay);
        };
        const leave = () => {
            clearTimeout(this.#showTimer);
            this.#hideSoon();
        };
        // A focus from the keyboard shows the tooltip. A focus from a pointer press does not.
        let pressedAt = -Infinity;
        const focusin = () => {
            if (performance.now() - pressedAt > 500) { this.show(); }
        };
        const hideNow = () => {
            clearTimeout(this.#showTimer);
            this.hide();
        };
        const press = () => {
            pressedAt = performance.now();
            hideNow();
        };
        element.addEventListener('pointerenter', enter);
        element.addEventListener('pointerleave', leave);
        element.addEventListener('focusin', focusin);
        element.addEventListener('focusout', hideNow);
        element.addEventListener('pointerdown', press);
        return () => {
            element.removeEventListener('pointerenter', enter);
            element.removeEventListener('pointerleave', leave);
            element.removeEventListener('focusin', focusin);
            element.removeEventListener('focusout', hideNow);
            element.removeEventListener('pointerdown', press);
            const left = (element.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(id => id && id !== this.id);
            if (left.length) {
                element.setAttribute('aria-describedby', left.join(' '));
            } else {
                element.removeAttribute('aria-describedby');
            }
            hideNow();
            if (this.#target === element) { this.#target = null; }
        };
    }

    show() {
        if (!this.isConnected || !this.#target?.isConnected) { return; }
        clearTimeout(this.#hideTimer);
        if (this.textSource) { this.text = this.textSource(); this.textContent = this.text; }
        if (!this.textContent.trim()) { return; }
        if (shownTip && shownTip !== this) { shownTip.hide(); }
        shownTip = this;
        this.classList.add('zest-shown');
        try { this.showPopover?.(); } catch { /* It is open already */ }
        placePopup(this, this.#target, {placement: this.placement, offset: 6});
        if (!this.#removeEscape) {
            // Escape hides the tooltip and does nothing else, as WCAG 1.4.13 tells
            const keydown = (e) => {
                if (e.key !== 'Escape') { return; }
                e.preventDefault();
                e.stopPropagation();
                this.hide();
            };
            document.addEventListener('keydown', keydown, true);
            this.#removeEscape = () => document.removeEventListener('keydown', keydown, true);
        }
    }

    hide() {
        clearTimeout(this.#hideTimer);
        this.#removeEscape?.();
        this.#removeEscape = null;
        if (shownTip === this) { shownTip = null; }
        this.classList.remove('zest-shown');
        try { this.hidePopover?.(); } catch { /* It is closed already */ }
    }

    // A short time, so that the pointer can move from the element onto the tooltip
    #hideSoon() {
        clearTimeout(this.#hideTimer);
        this.#hideTimer = setTimeout(() => this.hide(), 150);
    }
}

// Adds a tooltip to an element. text is a text or a function that gives it. Returns the removal function.
function attachToolTip(element, text, {placement = 'top', delay = 500, container = containerOf(element)} = {}) {
    const tip = createElementOf(ToolTip, 'tool-tip');
    if (typeof text === 'function') {
        tip.textSource = text;
        tip.text = text();
    } else {
        tip.text = text;
    }
    tip.placement = placement;
    tip.delay = delay;
    container.append(tip);
    const detach = tip.attachTo(element);
    return () => {
        detach();
        tip.remove();
    };
}

// A menu that opens with the context menu of the element: the right button, Shift+F10, or the
// context menu key. items is the data, or a function that gets the event and gives the data.
function attachContextMenu(element, items, {label = 'Context menu', container = containerOf(element), mnemonics = true} = {}) {
    let menu = null;
    let keyAt = -Infinity;
    const open = (e, position) => {
        const list = typeof items === 'function' ? items(e) : items;
        if (!list?.length) { return false; }
        if (!menu) {
            menu = createElementOf(PopupMenu, 'popup-menu');
            container.append(menu);
        }
        menu.label = label;
        menu.mnemonics = mnemonics;
        menu.items = list;
        menu.controller = {owner: null};
        const opener = menu.isOpen ? null : (element.contains(activeElement()) || element === activeElement() ? activeElement() : element);
        menu.open({...position, focus: 'first', ...(opener ? {opener} : {})});
        return true;
    };
    const contextmenu = (e) => {
        // The key already opened the menu, and the browser sends this event after the key
        if (performance.now() - keyAt < 500) {
            e.preventDefault();
            return;
        }
        if (open(e, {x: e.clientX, y: e.clientY})) { e.preventDefault(); }
    };
    const keydown = (e) => {
        const shiftF10 = e.key === 'F10' && e.shiftKey && !hasModifier(e);
        if (!shiftF10 && e.key !== 'ContextMenu') { return; }
        const target = e.composedPath()[0];
        if (open(e, {anchor: target instanceof Element ? target : element, placement: 'bottom-start'})) {
            e.preventDefault();
            keyAt = performance.now();
        }
    };
    element.addEventListener('contextmenu', contextmenu);
    element.addEventListener('keydown', keydown);
    return () => {
        element.removeEventListener('contextmenu', contextmenu);
        element.removeEventListener('keydown', keydown);
        menu?.close({returnFocus: false});
        menu?.remove();
        menu = null;
    };
}

const DEFAULT_TIMEOUT = {info: 6000, success: 6000, warning: 10000, error: 0};
const KIND_TEXT = {info: '', success: 'Done: ', warning: 'Warning: ', error: 'Error: '};

class NoticeArea extends BaseComponent {
    static styles = css.notices;
    static properties = {
        // The most notices that show at one time. An older notice that is not an error goes first.
        max: {type: Number, default: 4},
        dismissLabel: {type: String, default: 'Dismiss'},
    };
    #box;
    #polite;
    #assertive;
    #readyAt = 0;

    constructor() {
        super();
        this.#box = document.createElement('div');
        this.#box.className = 'zest-notices';
        makePopover(this.#box);
        // The live regions must be on the page before a notice goes in, or a screen reader may not read it
        this.#polite = document.createElement('div');
        this.#polite.setAttribute('role', 'status');
        this.#assertive = document.createElement('div');
        this.#assertive.setAttribute('role', 'alert');
        this.#box.append(this.#polite, this.#assertive);
    }

    connectedCallback() {
        super.connectedCallback();
        if (this.#box.parentNode !== this.root) { this.root.append(this.#box); }
        this.#readyAt = performance.now() + 100;
        this.render();
    }

    render() {
        this.applyStyles();
        try { this.#box.showPopover?.(); } catch { /* It is open already */ }
    }

    get notices() { return [...this.#box.querySelectorAll('.zest-notice')]; }

    // Adds a notice. Returns {element, close(), closed}, where closed is a promise of the reason.
    add({text, kind = 'info', timeout = DEFAULT_TIMEOUT[kind] ?? 6000, action = null} = {}) {
        const notice = document.createElement('div');
        notice.className = 'zest-notice';
        notice.dataset.kind = kind;
        const words = span('zest-text');
        const prefix = span('zest-sr');
        prefix.textContent = KIND_TEXT[kind] ?? '';
        words.append(prefix, String(text ?? ''));
        notice.append(words);
        let resolve;
        const closed = new Promise(done => { resolve = done; });
        let timer = null;
        let left = timeout;
        let startedAt = 0;
        const close = (reason = 'code') => {
            if (!notice.isConnected) { return; }
            clearTimeout(timer);
            const next = this.notices[this.notices.indexOf(notice) + 1];
            const hadFocus = notice.contains(activeElement());
            notice.remove();
            if (hadFocus) { next?.querySelector('button')?.focus(); }
            resolve(reason);
        };
        const start = () => {
            if (!(left > 0)) { return; }
            startedAt = performance.now();
            timer = setTimeout(() => close('timeout'), left);
        };
        const pause = () => {
            if (!timer) { return; }
            clearTimeout(timer);
            timer = null;
            left -= performance.now() - startedAt;
        };
        if (action) {
            const run = action instanceof Action ? action : toAction(action);
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'zest-action';
            button.textContent = readLabel(run.label, action.mnemonic !== false).text;
            button.addEventListener('click', () => {
                run.trigger(button, {notice});
                close('action');
            });
            notice.append(button);
        }
        const dismiss = document.createElement('button');
        dismiss.type = 'button';
        dismiss.className = 'zest-dismiss';
        dismiss.setAttribute('aria-label', this.dismissLabel);
        dismiss.textContent = '✕';
        dismiss.addEventListener('click', () => close('dismiss'));
        notice.append(dismiss);
        // The time stops while the user reads or uses the notice
        notice.addEventListener('pointerenter', pause);
        notice.addEventListener('pointerleave', () => { if (!notice.contains(activeElement())) { start(); } });
        notice.addEventListener('focusin', pause);
        notice.addEventListener('focusout', (e) => { if (!notice.contains(e.relatedTarget)) { start(); } });
        const insert = () => {
            if (!this.isConnected) { return; }
            (kind === 'error' ? this.#assertive : this.#polite).append(notice);
            const extra = this.notices.length - this.max;
            for (const old of this.notices.filter(item => item.dataset.kind !== 'error').slice(0, Math.max(0, extra))) {
                old.querySelector('.zest-dismiss').click();
            }
            start();
        };
        const wait = this.#readyAt - performance.now();
        if (wait > 0) { setTimeout(insert, wait); } else { insert(); }
        return {element: notice, close: () => close('code'), closed};
    }
}

let defaultArea = null;

// Shows a short message in a corner of the window: showNotice({text, kind, timeout, action}).
// kind is 'info', 'success', 'warning', or 'error'. An error stays until the user closes it.
function showNotice(options) {
    const settings = typeof options === 'string' ? {text: options} : options;
    let area = settings.area;
    if (!area) {
        if (!defaultArea?.isConnected) {
            defaultArea = createElementOf(NoticeArea, 'notice-area');
            document.body.append(defaultArea);
        }
        area = defaultArea;
    }
    return area.add(settings);
}

// Defines the default tag of each menu component that has no tag yet. Importing defines nothing.
function defineMenus() {
    defineElements({
        'menu-bar': MenuBar, 'shadow-menu-bar': ShadowMenuBar,
        'popup-menu': PopupMenu, 'shadow-popup-menu': ShadowPopupMenu,
        'menu-button': MenuButton, 'shadow-menu-button': ShadowMenuButton,
        'tool-bar': ToolBar, 'shadow-tool-bar': ShadowToolBar,
        'tool-tip': ToolTip, 'notice-area': NoticeArea,
    });
}

export {
    defineMenus,
    PopupMenu, ShadowPopupMenu,
    MenuBar, ShadowMenuBar,
    MenuButton, ShadowMenuButton,
    ToolBar, ShadowToolBar,
    ToolTip, attachToolTip,
    NoticeArea, showNotice,
    attachContextMenu,
};
