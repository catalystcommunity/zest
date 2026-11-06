import { BaseComponent } from "@catalystcommunity/base-components";

// The parts that each control of this package shares: form association, the native input and
// change events, the label content, and the focus of the inner element.

let nextId = 0;
export const uniqueId = (prefix) => `${prefix}-${++nextId}`;

// One formatter for each locale and set of options. A new Intl formatter is slow to make.
const numberFormats = new Map();
export function numberFormat(locale, options = {}) {
    const key = `${locale ?? ''}|${JSON.stringify(options)}`;
    if (!numberFormats.has(key)) {
        let format;
        try { format = new Intl.NumberFormat(locale || undefined, options); } catch { format = new Intl.NumberFormat(undefined, options); }
        numberFormats.set(key, format);
    }
    return numberFormats.get(key);
}

// Words that a person reads. An application gives other words with the labels property.
export const DEFAULT_LABELS = {
    clear: 'Clear',
    show: 'Show',
    hide: 'Hide',
    showPassword: 'Show password',
    increase: 'Increase',
    decrease: 'Decrease',
    showOptions: 'Show options',
    noOptions: 'No options',
    working: 'Working',
    charactersLeft: (count) => `${count} ${count === 1 ? 'character' : 'characters'} left`,
    characterCount: (count, max) => `${count} of ${max}`,
    on: 'On',
    off: 'Off',
    selectOne: 'Select one.',
    fillNumber: 'Fill in a number.',
    selectAtLeastOne: 'Select one or more.',
    checkThis: 'Select this to continue.',
};

// Makes a class with an open shadow root that gives the focus to the inner control
export function shadowOf(ControlClass) {
    return class extends ControlClass {
        constructor() {
            super();
            this.shadow = this.attachShadow({mode: 'open', delegatesFocus: true});
            this.root = this.shadow;
        }
    };
}

export class ZestElement extends BaseComponent {
    static properties = {
        labels: {type: Object, attribute: false, default: () => ({})},
    };
    #built = false;

    get built() { return this.#built; }
    get text() { return {...DEFAULT_LABELS, ...this.labels}; }

    connectedCallback() {
        super.connectedCallback();
        this.render();
        this.connected();
    }
    // Called after each connect, after the first render. own() and listen() work here.
    connected() { }
    render() {
        if (!this.#built) {
            this.#built = true;
            this.build();
            // After build, so that a style element (with no adopted sheets) is not taken as content
            this.applyStyles();
        }
        this.update();
    }
    // Makes the DOM one time
    build() { }
    // Changes the DOM to agree with the properties
    update() { }

    // The children of the application go in the container: a slot in a shadow root, or the
    // children themselves in the light DOM
    takeContent(container, keep = (node) => true) {
        if (this.root !== this) {
            container.append(document.createElement('slot'));
            return [...this.childNodes].some(node => node.nodeType === 1 || node.textContent.trim());
        }
        const nodes = [...this.childNodes].filter(node => node.localName !== 'style' && keep(node));
        container.append(...nodes);
        return nodes.some(node => node.nodeType === 1 || node.textContent.trim());
    }

    // The events of a native element inside must not leave the component. The component sends its own.
    stopInner(container, names = ['input', 'change']) {
        for (const name of names) {
            container.addEventListener(name, (e) => { if (e.target !== this) { e.stopPropagation(); } });
        }
    }

    fire(name) {
        return this.dispatchEvent(new Event(name, {bubbles: true, composed: true}));
    }
}

export class FormControl extends ZestElement {
    static formAssociated = true;
    static properties = {
        name: {type: String, render: false},
        disabled: {type: Boolean, reflect: true},
        required: {type: Boolean},
        label: {type: String, default: ''},
    };
    internals;
    #formDisabled = false;

    constructor() {
        super();
        this.internals = this.attachInternals?.() ?? null;
    }

    get isDisabled() { return this.disabled || this.#formDisabled; }
    get form() { return this.internals?.form ?? null; }
    get validity() { return this.internals?.validity; }
    get validationMessage() { return this.internals?.validationMessage ?? ''; }
    get willValidate() { return this.internals?.willValidate ?? false; }
    checkValidity() { return this.internals?.checkValidity?.() ?? true; }
    reportValidity() { return this.internals?.reportValidity?.() ?? true; }

    connectedCallback() {
        super.connectedCallback();
        // A form that is not valid gives the focus to its first problem. Firefox ignores the anchor of
        // setValidity and focuses the host, which must then be focusable. The host gives the focus on.
        if (this.root === this && this.focusTarget) {
            if (!this.hasAttribute('tabindex')) { this.tabIndex = -1; }
            this.listen(this, 'focus', (e) => { if (e.target === this) { this.focusTarget?.focus(); } });
        }
    }

    // The inner element that gets the focus
    get focusTarget() { return null; }
    focus(options) {
        const target = this.focusTarget;
        if (target) { target.focus(options); } else { super.focus(options); }
    }
    blur() { this.focusTarget?.blur(); }

    formDisabledCallback(disabled) {
        this.#formDisabled = disabled;
        this.invalidate();
    }
    formResetCallback() { this.resetValue(); }
    formStateRestoreCallback(state) { this.restoreValue(state); }
    resetValue() { }
    restoreValue(state) { }

    setFormValue(value, state = value) {
        this.internals?.setFormValue?.(value, state);
    }
    // flags as ValidityState, for example {valueMissing: true}. An empty object is valid.
    setValidity(flags = {}, message = '', anchor = this.focusTarget) {
        if (!this.internals?.setValidity) { return; }
        if (Object.values(flags).some(Boolean)) {
            this.internals.setValidity(flags, message || ' ', anchor ?? undefined);
        } else {
            this.internals.setValidity({});
        }
    }
}

// The options of a list box or a combo box, from data or from <option> children:
// strings, or objects {value, label, disabled, description}
export function readOptions(host, options) {
    const children = [...host.querySelectorAll(':scope > option')];
    // In the light DOM, the option elements would show as text
    for (const option of children) { option.hidden = true; }
    const source = options?.length ? options : children.map(option => ({
        value: option.value,
        label: option.label || option.textContent.trim(),
        disabled: option.disabled,
        selected: option.hasAttribute('selected'),
    }));
    return source.map(option => {
        if (typeof option !== 'object' || option === null) {
            return {value: String(option), label: String(option), disabled: false};
        }
        const value = String(option.value ?? option.label ?? '');
        return {...option, value, label: String(option.label ?? value), disabled: Boolean(option.disabled)};
    });
}

// Typing a few letters finds the next option that starts with them
export class Typeahead {
    #typed = '';
    #at = 0;
    find(items, index, key, labelOf) {
        const now = Date.now();
        this.#typed = now - this.#at < 1000 ? this.#typed + key.toLowerCase() : key.toLowerCase();
        this.#at = now;
        const ordered = [...items.slice(index + 1), ...items.slice(0, index + 1)];
        const repeated = [...this.#typed].every(letter => letter === this.#typed[0]);
        return ordered.find(item => labelOf(item).toLowerCase().startsWith(this.#typed))
            ?? (repeated ? ordered.find(item => labelOf(item).toLowerCase().startsWith(this.#typed[0])) : null);
    }
}

// The CSS that each control with a box shares: the label above, the box, and the help text
export function fieldStyles(selector) {
    return `
${selector} {
    display: flex;
    flex-direction: column;
    gap: 0.25em;
    min-width: 0;
    color: var(--_window-text);
}
${selector} .label {
    font-weight: 600;
}
${selector} .label:empty {
    display: none;
}
${selector} .box {
    display: flex;
    align-items: stretch;
    box-sizing: border-box;
    min-height: var(--_height);
    min-width: 0;
    background: var(--_field);
    color: var(--_field-text);
    border: var(--_border-width) solid var(--_border);
    border-radius: var(--_radius);
    transition: border-color var(--_motion);
}
${selector} .box:hover {
    border-color: var(--_highlight);
}
${selector} .box:has(:focus-visible) {
    outline: var(--_focus-width) solid var(--_focus);
    outline-offset: var(--_focus-offset);
}
${selector} .box input, ${selector} .box textarea {
    flex: 1;
    min-width: 0;
    box-sizing: border-box;
    padding: var(--_padding-block) calc(var(--_padding-inline) * 0.75);
    border: none;
    background: transparent;
    color: inherit;
    font: inherit;
    /* The box shows the focus. A general page rule for :focus-visible must not add a second ring. */
    outline: none !important;
}
${selector} .box input::placeholder, ${selector} .box textarea::placeholder {
    color: var(--_secondary-text);
    opacity: 1;
}
${selector} .help {
    font-size: 0.875em;
    color: var(--_secondary-text);
}
${selector} .help:empty {
    display: none;
}
${selector} .help.error {
    color: var(--_invalid);
}
${selector} .help.error::before {
    content: "⚠ ";
}
${selector}.invalid .box, ${selector} .box:has([aria-invalid="true"]) {
    border-color: var(--_invalid);
    border-width: max(2px, var(--_border-width));
}
${selector}.disabled {
    color: var(--_disabled-text);
}
${selector}.disabled .box {
    border-style: dashed;
    color: var(--_disabled-text);
    background: var(--_face);
}
${selector} .box button {
    box-sizing: border-box;
    min-width: max(24px, 2em);
    min-height: 24px;
    margin: 2px;
    padding: 0 0.5em;
    border: var(--_border-width) solid transparent;
    border-radius: calc(var(--_radius) - 2px);
    background: none;
    color: inherit;
    font: inherit;
    cursor: pointer;
}
${selector} .box button:hover {
    background: var(--_hover-face);
    border-color: var(--_border);
}
${selector} .box button:focus-visible {
    outline: var(--_focus-width) solid var(--_focus);
    outline-offset: -2px;
}
${selector} .box button[hidden] {
    display: none;
}
${selector} .affix {
    display: flex;
    align-items: center;
    padding-inline: calc(var(--_padding-inline) * 0.5);
    color: var(--_secondary-text);
    white-space: nowrap;
}
${selector} .affix:empty {
    display: none;
}
@media (forced-colors: active) {
    ${selector} .box {
        border-color: ButtonText;
    }
    ${selector}.disabled .box {
        border-color: GrayText;
        color: GrayText;
    }
}
`;
}
