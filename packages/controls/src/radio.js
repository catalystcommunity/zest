import { RovingFocus, createElementOf, tokenAliases } from "@catalystcommunity/base-components";
import { FormControl, ZestElement, shadowOf, uniqueId } from "./form-control.js";

const styles = `
radio-group, :host {
    display: block;
    min-width: 0;
}
.zest-radio-group {
    ${tokenAliases('radio-group')}
    display: flex;
    flex-direction: column;
    gap: 0.25em;
    min-width: 0;
    color: var(--_window-text);
}
.zest-radio-group .legend {
    font-weight: 600;
}
.zest-radio-group .legend:empty {
    display: none;
}
.zest-radio-group .items {
    display: flex;
    flex-direction: column;
    flex-wrap: wrap;
    gap: 0.25em var(--_gap-unrelated);
}
.zest-radio-group.horizontal .items {
    flex-direction: row;
}
.zest-radio-group .error {
    font-size: 0.875em;
    color: var(--_invalid);
}
.zest-radio-group .error::before {
    content: "⚠ ";
}
.zest-radio-group .error:empty {
    display: none;
}
`;

const buttonStyles = `
radio-button, :host {
    ${tokenAliases('radio-button')}
    display: inline-flex;
    align-items: center;
    gap: var(--_gap);
    min-height: max(24px, 1.5em);
    min-width: 24px;
    color: var(--_window-text);
    cursor: pointer;
    border-radius: var(--_radius);
}
radio-button:focus-visible, :host(:focus-visible) {
    outline: var(--_focus-width) solid var(--_focus);
    outline-offset: var(--_focus-offset);
}
.zest-radio-button {
    flex: none;
    display: grid;
    place-items: center;
    box-sizing: border-box;
    width: 1.25em;
    height: 1.25em;
    min-width: 18px;
    min-height: 18px;
    background: var(--_field);
    border: max(2px, var(--_border-width)) solid var(--_border);
    border-radius: 50%;
}
.zest-radio-button::after {
    content: "";
    width: 50%;
    height: 50%;
    border-radius: 50%;
}
radio-button[aria-checked="true"] .zest-radio-button, :host([aria-checked="true"]) .zest-radio-button {
    border-color: var(--_highlight);
}
radio-button[aria-checked="true"] .zest-radio-button::after, :host([aria-checked="true"]) .zest-radio-button::after {
    background: var(--_highlight);
}
radio-button[aria-disabled="true"], :host([aria-disabled="true"]) {
    color: var(--_disabled-text);
    cursor: default;
}
radio-button[aria-disabled="true"] .zest-radio-button, :host([aria-disabled="true"]) .zest-radio-button {
    border-style: dashed;
}
@media (forced-colors: active) {
    .zest-radio-button {
        border-color: ButtonText;
    }
    radio-button[aria-checked="true"] .zest-radio-button::after, :host([aria-checked="true"]) .zest-radio-button::after {
        background: Highlight;
        forced-color-adjust: none;
    }
}
`;

// One choice of a radio group. The element itself has the role radio, so that the group can move
// the focus between the choices in the light DOM and in a shadow root in the same way.
export class RadioButton extends ZestElement {
    static styles = buttonStyles;
    static properties = {
        value: {type: String, default: ''},
        checked: {type: Boolean},
        disabled: {type: Boolean, reflect: true},
        label: {type: String, default: ''},
    };
    #text;
    #hasContent = false;

    build() {
        this.setAttribute('role', 'radio');
        if (!this.hasAttribute('tabindex')) { this.tabIndex = -1; }
        const circle = Object.assign(document.createElement('span'), {className: 'zest-radio-button'});
        circle.setAttribute('aria-hidden', 'true');
        circle.part = 'circle';
        this.#text = Object.assign(document.createElement('span'), {className: 'text'});
        this.#hasContent = this.takeContent(this.#text);
        this.root.append(circle, this.#text);
    }

    connected() {
        // The group can connect before its choices are defined, so a choice tells the group that it is here
        this.group?.invalidate();
    }

    get group() {
        for (let node = this.parentNode; node; node = node.parentNode ?? node.host) {
            if (node instanceof RadioGroup) { return node; }
        }
        return null;
    }

    update() {
        this.setAttribute('aria-checked', String(this.checked));
        if (this.disabled || this.group?.isDisabled) { this.setAttribute('aria-disabled', 'true'); } else { this.removeAttribute('aria-disabled'); }
        if (!this.#hasContent) { this.#text.textContent = this.label || this.value; }
    }
}

// A group of radio buttons. The children are radio-button elements, or `options` makes them.
export class RadioGroup extends FormControl {
    static styles = styles;
    static properties = {
        value: {type: String, default: ''},
        orientation: {type: String, default: 'vertical'},
        options: {type: Array, default: () => []},
    };
    wrapper;
    #legend;
    #items;
    #error;
    #focus;
    #madeFromOptions = '';
    #touched = false;

    get radios() { return [...this.querySelectorAll('*')].filter(item => item instanceof RadioButton); }
    get focusTarget() { return this.radios.find(radio => radio.tabIndex === 0) ?? this.radios[0] ?? null; }

    build() {
        this.wrapper = document.createElement('div');
        this.wrapper.className = 'zest-radio-group';
        this.wrapper.setAttribute('role', 'radiogroup');
        this.wrapper.part = 'group';
        this.#legend = Object.assign(document.createElement('span'), {className: 'legend', id: uniqueId('radio-legend')});
        this.#items = Object.assign(document.createElement('div'), {className: 'items'});
        this.#error = Object.assign(document.createElement('div'), {className: 'error', id: uniqueId('radio-error')});
        this.wrapper.setAttribute('aria-labelledby', this.#legend.id);
        this.takeContent(this.#items);
        this.wrapper.append(this.#legend, this.#items, this.#error);
        this.root.append(this.wrapper);
        this.#focus = new RovingFocus(this, {
            items: () => this.radios.filter(radio => !radio.disabled),
            orientation: 'both',
            skipDisabled: true,
            onMove: (radio) => this.#choose(radio),
            onKey: (e, radio) => {
                if (e.key === ' ') {
                    e.preventDefault();
                    this.#choose(radio);
                    return false;
                }
                return !this.isDisabled;
            },
        });
        this.addEventListener('click', (e) => {
            const radio = e.composedPath().find(node => node instanceof RadioButton);
            if (radio && this.radios.includes(radio) && !radio.disabled && !this.isDisabled) {
                radio.focus();
                this.#choose(radio);
            }
        });
        this.addEventListener('invalid', () => { this.#touched = true; this.update(); });
    }

    connected() {
        this.own(this.#focus.attach());
    }

    update() {
        this.#makeOptions();
        this.#legend.textContent = this.label;
        this.wrapper.classList.toggle('horizontal', this.orientation === 'horizontal');
        if (this.required) { this.wrapper.setAttribute('aria-required', 'true'); } else { this.wrapper.removeAttribute('aria-required'); }
        const radios = this.radios;
        // With no value attribute, a choice with the checked attribute gives the first value
        if (!this.value && !this.#touched && !this.hasAttribute('value')) {
            const initial = radios.find(radio => radio.hasAttribute('checked'));
            if (initial) { this.value = initial.value; }
        }
        for (const radio of radios) {
            radio.checked = radio.value === this.value;
            radio.invalidate();
        }
        // The checked choice is the one in the tab order
        const checked = radios.find(radio => radio.checked && !radio.disabled);
        this.#focus.update(checked ?? radios.find(radio => !radio.disabled) ?? null);
        this.setFormValue(this.value || null, this.value);
        const missing = this.required && !this.value;
        this.setValidity(missing ? {valueMissing: true} : {}, this.text.selectOne, radios[0]);
        this.#error.textContent = missing && this.#touched ? this.text.selectOne : '';
        if (this.#error.textContent) { this.wrapper.setAttribute('aria-describedby', this.#error.id); } else { this.wrapper.removeAttribute('aria-describedby'); }
    }

    #makeOptions() {
        const key = JSON.stringify(this.options);
        if (!this.options.length || key === this.#madeFromOptions) { return; }
        this.#madeFromOptions = key;
        const target = this.root === this ? this.#items : this;
        for (const radio of this.radios) { radio.remove(); }
        for (const option of this.options) {
            const data = typeof option === 'object' ? option : {value: String(option)};
            target.append(createElementOf(RadioButton, 'radio-button', {
                value: data.value, label: data.label ?? data.value, disabled: Boolean(data.disabled),
            }));
        }
    }

    #choose(radio) {
        if (this.isDisabled || radio.disabled || radio.value === this.value) { return; }
        this.value = radio.value;
        this.#touched = true;
        this.update();
        this.fire('input');
        this.fire('change');
    }

    resetValue() {
        this.value = this.getAttribute('value') ?? this.radios.find(radio => radio.hasAttribute('checked'))?.value ?? '';
        this.#touched = false;
    }
    restoreValue(state) { this.value = state ?? ''; }
}

export class ShadowRadioButton extends RadioButton {
    constructor() {
        super();
        this.shadow = this.attachShadow({mode: 'open'});
        this.root = this.shadow;
    }
}
export class ShadowRadioGroup extends shadowOf(RadioGroup) {}

