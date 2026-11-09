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

// True if the nodes have an element or text that is not only white space
const hasText = (nodes) => [...nodes].some(node => node.nodeType === 1 || node.textContent.trim());

// Attributes of the host that go to the inner control. aria-label names the inner control, and
// aria-describedby adds descriptions to it. The host itself has no role.
const HOST_ATTRIBUTES = ['aria-label', 'aria-describedby'];

export class ZestElement extends BaseComponent {
    static properties = {
        labels: {type: Object, attribute: false, default: () => ({})},
    };
    #built = false;

    get built() { return this.#built; }
    get text() { return {...DEFAULT_LABELS, ...this.labels}; }

    static get observedAttributes() {
        return [...new Set([...super.observedAttributes, ...HOST_ATTRIBUTES, ...this.forwardAttributes])];
    }
    // Attributes of the host that the control copies to its inner native element. A child class adds to it.
    static forwardAttributes = [];

    attributeChangedCallback(name, oldValue, newValue) {
        if (HOST_ATTRIBUTES.includes(name) || this.constructor.forwardAttributes.includes(name)) {
            if (oldValue !== newValue && this.built) { this.invalidate(); }
            return;
        }
        super.attributeChangedCallback(name, oldValue, newValue);
    }

    // Names the inner element. An aria-label on the host always wins, as an aria-label wins over a
    // native label. The fallback is for a control with no visible text, for example an icon button.
    // With labelledBy, the element has the visible label as its name when the host has no aria-label.
    nameInner(element, {fallback = '', labelledBy = null} = {}) {
        const name = this.getAttribute('aria-label') || '';
        if (name || !labelledBy) {
            element.removeAttribute('aria-labelledby');
        } else {
            element.setAttribute('aria-labelledby', labelledBy);
        }
        const label = name || (labelledBy ? '' : fallback);
        if (label) { element.setAttribute('aria-label', label); } else { element.removeAttribute('aria-label'); }
    }

    // Gives the inner element its descriptions: the ids of the control (help text, error) and the ids
    // in the host aria-describedby. In a shadow root, an id cannot refer across the boundary, so the
    // element gets the elements themselves, where the browser supports it.
    describe(ids, element = this.focusTarget) {
        if (!element) { return; }
        const own = ids.filter(Boolean);
        const host = (this.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean);
        if (this.root === this) {
            const list = [...new Set([...own, ...host])].join(' ');
            if (list) { element.setAttribute('aria-describedby', list); } else { element.removeAttribute('aria-describedby'); }
            return;
        }
        if (host.length && 'ariaDescribedByElements' in element) {
            const scope = this.getRootNode();
            const elements = [
                ...own.map(id => this.root.getElementById(id)),
                ...host.map(id => scope.getElementById?.(id)),
            ].filter(Boolean);
            element.ariaDescribedByElements = elements.length ? elements : null;
            return;
        }
        if ('ariaDescribedByElements' in element && element.ariaDescribedByElements) { element.ariaDescribedByElements = null; }
        if (own.length) { element.setAttribute('aria-describedby', own.join(' ')); } else { element.removeAttribute('aria-describedby'); }
    }

    // Copies the forwardAttributes of the host to the inner native element
    forwardTo(element) {
        for (const name of this.constructor.forwardAttributes) {
            const value = this.getAttribute(name);
            if (value === null) { element.removeAttribute(name); } else { element.setAttribute(name, value); }
        }
    }

    connectedCallback() {
        super.connectedCallback();
        this.render();
        // A parent can move this element through a detached container. The browser then calls
        // connectedCallback late, while the element is out of the page. It connects again later.
        if (this.isConnected) { this.connected(); }
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
            return hasText(this.childNodes);
        }
        const nodes = [...this.childNodes].filter(node => node.localName !== 'style' && keep(node));
        container.append(...nodes);
        return hasText(nodes);
    }

    // In the light DOM, children that the application adds to the host later also go in the
    // container. A change such as host.textContent = 'New' then does not remove the internals.
    // inner is the internal child of the host, or a list of them. In a shadow root, the slot shows
    // the children. changed() gets true if the content has text or an element. Call it in connected().
    followContent(container, inner, changed, keep = (node) => true) {
        if (this.root !== this) {
            const slot = container.querySelector('slot');
            if (slot) { this.listen(slot, 'slotchange', () => changed(hasText(slot.assignedNodes()))); }
            return;
        }
        const parts = [inner].flat();
        const move = () => {
            const added = [...this.childNodes].filter(node => !parts.includes(node) && node.localName !== 'style' && keep(node));
            if (parts.some(part => part.parentNode !== this)) {
                // replaceChildren() or textContent on the host removed the internals
                container.replaceChildren(...added);
                this.append(...parts);
            } else if (added.length) {
                container.append(...added);
            } else {
                return;
            }
            changed(hasText(container.childNodes));
        };
        move();
        const observer = new MutationObserver(move);
        observer.observe(this, {childList: true});
        this.own(() => observer.disconnect());
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

    // True for a control that submits its form, so that Enter in a field can find the default button
    get submitsForm() { return false; }
    // True for a field in which Enter submits the form, as it does in a native text input
    get blocksImplicitSubmission() { return false; }

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
        // The browser does autofocus only while the document loads. A control that is added later
        // does it here, with the same rule: only when nothing else has the focus.
        if (this.hasAttribute('autofocus') && this.focusTarget) {
            const active = document.activeElement;
            if (!active || active === document.body || active === document.documentElement) { this.focus(); }
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

// The types of a native input in which Enter submits the form
const IMPLICIT_TYPES = new Set(['text', 'search', 'url', 'tel', 'email', 'password', 'number',
    'date', 'month', 'week', 'time', 'datetime-local']);

// The control that owns a native element in the light DOM, if there is one
function ownerControl(element, form) {
    for (let node = element.parentElement; node && node !== form; node = node.parentElement) {
        if (node instanceof FormControl) { return node; }
    }
    return null;
}

const isNativeSubmit = (element) =>
    (element.localName === 'button' || element.localName === 'input') && (element.type === 'submit' || element.type === 'image');

// The default button of a form: its first submit button in tree order, a Zest push-button or a
// native button
export function defaultButton(form) {
    for (const element of form?.elements ?? []) {
        if (element instanceof FormControl ? element.submitsForm : isNativeSubmit(element)) { return element; }
    }
    return null;
}

// Implicit submission, as the browser does it for Enter in a native field of the form. If the form
// has a default button, this clicks it. A disabled default button stops the submission. With no
// submit button, the form submits only when it has one field in which Enter submits.
// A native input in a shadow root is not in the form, so Zest fields call this themselves.
export function submitImplicitly(form) {
    if (!form) { return false; }
    const button = defaultButton(form);
    if (button) {
        if (button.matches(':disabled') || button.isDisabled) { return false; }
        button.click();
        return true;
    }
    let fields = 0;
    for (const element of form.elements) {
        if (element instanceof FormControl) {
            if (element.blocksImplicitSubmission) { fields++; }
        } else if (element.localName === 'input' && IMPLICIT_TYPES.has(element.type) && !ownerControl(element, form)) {
            fields++;
        }
    }
    if (fields > 1) { return false; }
    form.requestSubmit();
    return true;
}

// True for an Enter key that would submit the form from a native field. A modifier key does not
// change it, as in a native field. A key that ends a composition of an input method does not submit.
export function isSubmitKey(e) {
    return e.key === 'Enter' && !e.defaultPrevented && !e.isComposing && e.keyCode !== 229;
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
${selector} .zest-label {
    font-weight: 600;
}
${selector} .zest-label:empty {
    display: none;
}
${selector} .zest-box {
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
${selector} .zest-box:hover {
    border-color: var(--_highlight);
}
${selector} .zest-box:has(:focus-visible) {
    outline: var(--_focus-width) solid var(--_focus);
    outline-offset: var(--_focus-offset);
}
${selector} .zest-box input, ${selector} .zest-box textarea {
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
${selector} .zest-box input::placeholder, ${selector} .zest-box textarea::placeholder {
    color: var(--_secondary-text);
    opacity: 1;
}
${selector} .zest-help {
    font-size: 0.875em;
    color: var(--_secondary-text);
}
${selector} .zest-help:empty {
    display: none;
}
${selector} .zest-help.zest-error {
    color: var(--_invalid);
}
${selector} .zest-help.zest-error::before {
    content: "⚠ ";
}
${selector}.zest-invalid .zest-box, ${selector} .zest-box:has([aria-invalid="true"]) {
    border-color: var(--_invalid);
    border-width: max(2px, var(--_border-width));
}
${selector}.zest-disabled {
    color: var(--_disabled-text);
}
${selector}.zest-disabled .zest-box {
    border-style: dashed;
    color: var(--_disabled-text);
    background: var(--_face);
}
${selector} .zest-box button {
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
${selector} .zest-box button:hover {
    background: var(--_hover-face);
    border-color: var(--_border);
}
${selector} .zest-box button:focus-visible {
    outline: var(--_focus-width) solid var(--_focus);
    outline-offset: -2px;
}
${selector} .zest-box button[hidden] {
    display: none;
}
${selector} .zest-affix {
    display: flex;
    align-items: center;
    padding-inline: calc(var(--_padding-inline) * 0.5);
    color: var(--_secondary-text);
    white-space: nowrap;
}
${selector} .zest-affix:empty {
    display: none;
}
@media (forced-colors: active) {
    ${selector} .zest-box {
        border-color: ButtonText;
    }
    ${selector}.zest-disabled .zest-box {
        border-color: GrayText;
        color: GrayText;
    }
}
`;
}
