import { BaseComponent, createElementOf, placePopup, tokenAliases } from "@catalystcommunity/base-components";
import { uniqueId } from "./form-control.js";
import { optionStyles } from "./listbox.js";

// A list of suggestions under a text input or a text area, as the person types. attachTypeahead()
// works with any native field, so that a text field, a combo box, and a spreadsheet cell editor
// use the same code. The design is in the README, at "Type-ahead".

const styles = `
type-ahead-list, :host {
    display: contents;
}
.zest-type-ahead {
    ${tokenAliases('type-ahead-list', 'control')}
    box-sizing: border-box;
    min-width: 10em;
    max-height: min(20em, 60vh);
    overflow-y: auto;
    margin: 0;
    padding: 2px;
    background: var(--_field);
    color: var(--_field-text);
    border: var(--_border-width) solid var(--_border);
    border-radius: var(--_radius);
    box-shadow: 0 0.25em 1em color-mix(in srgb, var(--_window-text) 25%, transparent);
    font-family: var(--zest-font-family, inherit);
    font-size: var(--zest-font-size, 1rem);
    line-height: var(--zest-line-height, 1.4);
    overscroll-behavior: contain;
    z-index: 1000;
}
.zest-type-ahead:not(:popover-open) {
    display: none;
}
.zest-type-ahead[hidden] {
    display: none;
}
.zest-type-ahead [role="option"] mark {
    background: none;
    color: inherit;
    font-weight: bold;
}
${optionStyles('.zest-type-ahead')}
`;

// The element that holds the list. It only brings the styles into the root of the field.
class TypeaheadList extends BaseComponent {
    static styles = styles;
    list;
    constructor() {
        super();
        this.template = '';
    }
    connectedCallback() {
        super.connectedCallback();
        this.applyStyles();
        if (!this.list) {
            this.list = Object.assign(document.createElement('div'), {className: 'zest-type-ahead', id: uniqueId('type-ahead')});
            this.list.setAttribute('role', 'listbox');
            if (typeof this.list.showPopover === 'function') { this.list.setAttribute('popover', 'manual'); } else { this.list.hidden = true; }
            this.append(this.list);
        }
    }
}

// An item is a text, or {value, label, insertText, description, disabled}
function normalize(item) {
    if (item === null || item === undefined) { return null; }
    if (typeof item !== 'object') { const label = String(item); return {value: item, label, insertText: label}; }
    const label = String(item.label ?? item.value ?? '');
    return {...item, value: item.value ?? label, label, insertText: item.insertText ?? label};
}

// An array source is read one time: each label in lower case, so that a key press does not
// change the case of 10,000 labels again
const prepared = new WeakMap();
function prepare(list) {
    let entries = prepared.get(list);
    if (!entries) {
        entries = [];
        for (const raw of list) {
            const item = normalize(raw);
            if (item) { entries.push({item, folded: item.label.toLowerCase()}); }
        }
        prepared.set(list, entries);
    }
    return entries;
}

// The matches of a query: the labels that start with it first, then the labels that contain it.
// It stops when it has `max` labels that start with the query, so a long list costs less.
export function matchSuggestions(list, query, {max = 50, match = 'contains'} = {}) {
    const entries = prepare(list);
    const folded = String(query ?? '').toLowerCase();
    if (!folded) { return entries.slice(0, max).map(entry => entry.item); }
    const starts = [];
    const contains = [];
    for (const entry of entries) {
        const at = entry.folded.indexOf(folded);
        if (at === 0) {
            starts.push(entry.item);
            if (starts.length >= max) { break; }
        } else if (at > 0 && match === 'contains' && contains.length < max) {
            contains.push(entry.item);
        }
    }
    return starts.concat(contains).slice(0, max);
}

const wholeValue = (field) => ({text: field.value, start: 0, end: field.value.length});

// The state of each field with a list. It goes away with the field, so code keeps no handle.
const attached = new WeakMap();

// Adds a list of suggestions to a native input or text area. Returns a function that removes it.
// Code sends commands with the functions of `typeahead`, and the field sends `typeahead-*` events.
export function attachTypeahead(field, options = {}) {
    attached.get(field)?.remove();
    const settings = {
        source: [],
        max: 50,
        match: 'contains',
        minLength: 1,
        delay: 0,
        autoSelect: false,
        inline: false,
        arrowOpens: true,
        enter: 'accept',
        tab: 'accept-continue',
        query: wholeValue,
        label: '',
        container: null,
        onAccept: null,
        ...options,
    };
    const host = createElementOf(TypeaheadList, 'type-ahead-list');
    const root = field.getRootNode();
    const container = settings.container ?? (root instanceof ShadowRoot ? root : document.body);
    container.append(host);
    const list = host.list;
    if (settings.label) { list.setAttribute('aria-label', settings.label); }
    const before = {};
    for (const name of ['role', 'aria-autocomplete', 'aria-controls', 'aria-expanded', 'aria-activedescendant']) {
        before[name] = field.getAttribute(name);
    }
    // An input becomes a combo box. A text area cannot have that role, so it stays a text box
    // with aria-autocomplete and aria-activedescendant, which a text box supports.
    const combobox = field.localName === 'input';
    if (combobox) { field.setAttribute('role', 'combobox'); }
    field.setAttribute('aria-autocomplete', 'list');
    field.setAttribute('aria-controls', list.id);
    const expanded = (value) => { if (combobox) { field.setAttribute('aria-expanded', value); } };
    expanded('false');

    let items = [];
    let active = -1;
    let open = false;
    let query = null;
    let sequence = 0;
    let timer = null;
    let accepting = false;
    // The inline completion: the part of an item after the typed text, selected in the field
    let wantInline = false;
    let inlineTail = null;
    const pool = [];
    const tell = (name, detail) => field.dispatchEvent(new CustomEvent(`typeahead-${name}`, {bubbles: true, composed: true, detail}));

    const optionAt = (index) => {
        let element = pool[index];
        if (!element) {
            element = document.createElement('div');
            element.setAttribute('role', 'option');
            element.id = `${list.id}-${index}`;
            element.dataset.index = index;
            pool[index] = element;
        }
        return element;
    };

    let told = -1;
    const showActive = () => {
        if (open && told !== active) {
            told = active;
            tell('active', {item: items[active] ?? null, index: active});
        }
        for (let i = 0; i < items.length; i++) {
            const element = pool[i];
            const on = i === active;
            if (element.classList.contains('zest-active') !== on) {
                element.classList.toggle('zest-active', on);
                element.setAttribute('aria-selected', String(on));
            }
        }
        if (active >= 0 && open) {
            field.setAttribute('aria-activedescendant', pool[active].id);
            pool[active].scrollIntoView?.({block: 'nearest'});
        } else {
            field.removeAttribute('aria-activedescendant');
        }
    };

    const paint = () => {
        const children = [];
        const folded = (query?.text ?? '').toLowerCase();
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const element = optionAt(i);
            // The matched part is bold. It is not the only sign: the list has only the matches.
            const at = folded ? item.label.toLowerCase().indexOf(folded) : -1;
            const key = `${item.label}\u0000${at}\u0000${folded.length}\u0000${item.description ?? ''}`;
            if (element.dataset.key !== key) {
                element.dataset.key = key;
                // One element for the label, so that the gap of the option does not split it
                const label = document.createElement('span');
                if (at >= 0) {
                    const mark = document.createElement('mark');
                    mark.textContent = item.label.slice(at, at + folded.length);
                    label.append(item.label.slice(0, at), mark, item.label.slice(at + folded.length));
                } else {
                    label.textContent = item.label;
                }
                element.replaceChildren(label);
                if (item.description) {
                    element.append(Object.assign(document.createElement('span'), {className: 'zest-description', textContent: item.description}));
                }
            }
            if (item.disabled) { element.setAttribute('aria-disabled', 'true'); } else { element.removeAttribute('aria-disabled'); }
            element.setAttribute('aria-selected', 'false');
            element.classList.remove('zest-active');
            children.push(element);
        }
        list.replaceChildren(...children);
        showActive();
    };

    const place = () => {
        if (!open) { return; }
        list.style.minWidth = `${Math.max(160, field.getBoundingClientRect().width)}px`;
        placePopup(list, field, {placement: 'bottom-start'});
    };

    const show = () => {
        if (open) { place(); return; }
        open = true;
        if (list.showPopover) {
            try { list.showPopover(); } catch { /* It is already open */ }
        } else {
            list.hidden = false;
        }
        expanded('true');
        told = -1;
        tell('open', {items});
        place();
        showActive();
    };

    const close = () => {
        clearTimeout(timer);
        timer = null;
        sequence++;
        if (!open) { return; }
        open = false;
        active = -1;
        if (list.hidePopover) {
            try { list.hidePopover(); } catch { /* It is already closed */ }
        } else {
            list.hidden = true;
        }
        expanded('false');
        field.removeAttribute('aria-activedescendant');
        tell('close', {});
    };

    const firstEnabled = (from, direction) => {
        for (let i = from + direction; i >= 0 && i < items.length; i += direction) {
            if (!items[i].disabled) { return i; }
        }
        return -1;
    };

    const receive = (found, mine) => {
        if (mine !== sequence) { return; }
        items = (found ?? []).map(normalize).filter(Boolean).slice(0, settings.max);
        active = settings.autoSelect ? firstEnabled(-1, 1) : -1;
        if (!items.length) { close(); return; }
        const inline = wantInline ? completeInline() : -1;
        if (inline >= 0) { active = inline; }
        paint();
        show();
    };

    // Types the rest of the first item that starts with the query, and selects that rest, so that
    // the next key replaces it. Only after the person typed at the end of the query.
    const completeInline = () => {
        wantInline = false;
        if (!query || !query.text || field.selectionStart !== query.end || field.selectionEnd !== query.end) { return -1; }
        const folded = query.text.toLowerCase();
        const index = items.findIndex(item => !item.disabled && item.insertText.length > query.text.length && item.insertText.toLowerCase().startsWith(folded));
        if (index < 0) { return -1; }
        const rest = items[index].insertText.slice(query.text.length);
        const value = field.value;
        accepting = true;
        try {
            field.value = value.slice(0, query.end) + rest + value.slice(query.end);
            field.setSelectionRange?.(query.end, query.end + rest.length);
            field.dispatchEvent(new Event('input', {bubbles: true, composed: true}));
        } finally {
            accepting = false;
        }
        inlineTail = {start: query.end, end: query.end + rest.length, value: field.value};
        // An accepted item replaces the completion too
        query = {...query, end: inlineTail.end};
        return index;
    };

    // Removes the inline completion, if it is still there as it was typed
    const dropInline = () => {
        const tail = inlineTail;
        inlineTail = null;
        if (!tail || field.value !== tail.value || field.selectionStart !== tail.start || field.selectionEnd !== tail.end) { return false; }
        accepting = true;
        try {
            field.value = field.value.slice(0, tail.start) + field.value.slice(tail.end);
            field.setSelectionRange?.(tail.start, tail.start);
            field.dispatchEvent(new Event('input', {bubbles: true, composed: true}));
        } finally {
            accepting = false;
        }
        return true;
    };

    // Reads the query from the field and asks the source. `all` shows the list also for a short query.
    const lookup = ({all = false} = {}) => {
        clearTimeout(timer);
        timer = null;
        query = settings.query(field);
        if (!query || (!all && query.text.length < settings.minLength)) { close(); return; }
        const mine = ++sequence;
        const ask = () => {
            const source = settings.source;
            if (typeof source === 'function') {
                const result = source(query.text, {field, all});
                if (result && typeof result.then === 'function') {
                    result.then((found) => receive(found, mine), () => receive([], mine));
                } else {
                    receive(result, mine);
                }
            } else {
                receive(matchSuggestions(source ?? [], all && !query.text ? '' : query.text, settings), mine);
            }
        };
        if (settings.delay > 0 && typeof settings.source === 'function') { timer = setTimeout(ask, settings.delay); } else { ask(); }
    };

    const accept = (index = active) => {
        const item = items[index];
        if (!item || item.disabled || !query) { return false; }
        const value = field.value;
        const text = item.insertText;
        const next = value.slice(0, query.start) + text + value.slice(query.end);
        const caret = query.start + text.length;
        close();
        accepting = true;
        try {
            field.value = next;
            field.setSelectionRange?.(caret, caret);
            field.dispatchEvent(new Event('input', {bubbles: true, composed: true}));
        } finally {
            accepting = false;
        }
        inlineTail = null;
        settings.onAccept?.(item, {field, query});
        tell('accept', {item, query});
        return true;
    };

    const onInput = (e) => {
        if (accepting || e.isComposing) { return; }
        inlineTail = null;
        // A deletion does not complete again, so that Backspace removes the completion
        wantInline = Boolean(settings.inline) && (e.type === 'compositionend' || String(e.inputType ?? 'insertText').startsWith('insert'));
        lookup();
    };

    const onKeydown = (e) => {
        if (e.isComposing) { return; }
        switch (e.key) {
            case 'ArrowDown':
            case 'ArrowUp': {
                if (!open) {
                    if (e.altKey || (settings.arrowOpens && !e.ctrlKey && !e.metaKey && !e.shiftKey)) {
                        e.preventDefault();
                        e.stopPropagation();
                        lookup({all: true});
                        if (open && !e.altKey) { active = e.key === 'ArrowDown' ? firstEnabled(-1, 1) : firstEnabled(items.length, -1); showActive(); }
                    }
                    return;
                }
                e.preventDefault();
                e.stopPropagation();
                if (e.altKey && e.key === 'ArrowUp') { close(); return; }
                const next = e.key === 'ArrowDown' ? firstEnabled(active, 1) : firstEnabled(active < 0 ? items.length : active, -1);
                if (next >= 0) { active = next; showActive(); }
                return;
            }
            case 'PageDown':
            case 'PageUp': {
                if (!open) { return; }
                e.preventDefault();
                e.stopPropagation();
                const step = e.key === 'PageDown' ? 1 : -1;
                let index = active;
                for (let i = 0; i < 10; i++) { const next = firstEnabled(index, step); if (next < 0) { break; } index = next; }
                active = index;
                showActive();
                return;
            }
            case 'Escape':
                if (!open) { return; }
                e.preventDefault();
                e.stopPropagation();
                dropInline();
                close();
                return;
            case 'Enter':
            case 'Tab': {
                if (!open || e.altKey || e.ctrlKey || e.metaKey || (e.key === 'Tab' && e.shiftKey)) { if (e.key === 'Tab') { close(); } return; }
                const mode = e.key === 'Enter' ? settings.enter : settings.tab;
                if (mode === 'none' || active < 0) { close(); return; }
                accept();
                // 'accept' uses the key. 'accept-continue' lets the key do its normal action after.
                if (mode === 'accept') {
                    e.preventDefault();
                    e.stopPropagation();
                }
                return;
            }
            default:
                break;
        }
    };

    const onBlur = () => close();
    const onPointerDown = (e) => {
        // The field keeps the focus while the person presses an option
        e.preventDefault();
    };
    const onClick = (e) => {
        const element = e.target.closest?.('[role="option"]');
        if (!element) { return; }
        accept(Number(element.dataset.index));
        field.focus();
    };
    const onScroll = () => place();

    field.addEventListener('input', onInput);
    // Capture, so that the list reads a key before the handlers of the field and its parents
    field.addEventListener('keydown', onKeydown, {capture: true});
    field.addEventListener('blur', onBlur);
    field.addEventListener('compositionend', onInput);
    list.addEventListener('mousedown', onPointerDown);
    list.addEventListener('pointerdown', onPointerDown);
    list.addEventListener('click', onClick);
    window.addEventListener('resize', onScroll);
    window.addEventListener('scroll', onScroll, {capture: true, passive: true});

    const remove = () => {
        if (attached.get(field)?.remove !== remove) { return; }
        attached.delete(field);
        close();
        field.removeEventListener('input', onInput);
        field.removeEventListener('keydown', onKeydown, {capture: true});
        field.removeEventListener('blur', onBlur);
        field.removeEventListener('compositionend', onInput);
        window.removeEventListener('resize', onScroll);
        window.removeEventListener('scroll', onScroll, {capture: true});
        for (const [name, value] of Object.entries(before)) {
            if (value === null) { field.removeAttribute(name); } else { field.setAttribute(name, value); }
        }
        host.remove();
    };
    attached.set(field, {
        isOpen: () => open,
        activeItem: () => items[active] ?? null,
        items: () => items,
        list,
        open: ({all = true} = {}) => lookup({all}),
        close,
        accept: () => accept(),
        refresh: () => { if (open) { lookup({all: true}); } },
        setSource: (source) => { settings.source = source; if (open) { lookup({all: true}); } },
        remove,
    });
    return remove;
}

// Commands and questions for the list of a field. Each takes the field. A field with no list
// gives false, null, or an empty list, and a command does nothing.
export const typeahead = {
    isAttached: (field) => attached.has(field),
    isOpen: (field) => attached.get(field)?.isOpen() ?? false,
    activeItem: (field) => attached.get(field)?.activeItem() ?? null,
    items: (field) => attached.get(field)?.items() ?? [],
    listOf: (field) => attached.get(field)?.list ?? null,
    // Shows the matches of the text now. `all` (the default) also shows them for an empty text.
    open: (field, options) => attached.get(field)?.open(options),
    close: (field) => attached.get(field)?.close(),
    accept: (field) => attached.get(field)?.accept() ?? false,
    refresh: (field) => attached.get(field)?.refresh(),
    setSource: (field, source) => attached.get(field)?.setSource(source),
    remove: (field) => attached.get(field)?.remove(),
};

export { TypeaheadList };
