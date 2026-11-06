import { tokenAliases } from "@catalystcommunity/base-components";
import { FormControl, fieldStyles, numberFormat, shadowOf, uniqueId } from "./form-control.js";

const styles = `
spin-box, :host {
    display: inline-block;
    vertical-align: top;
    min-width: 0;
    max-width: 100%;
}
.zest-spin-box {
    ${tokenAliases('spin-box')}
}
${fieldStyles('.zest-spin-box')}
.zest-spin-box input {
    width: 6em;
    text-align: end;
    font-variant-numeric: tabular-nums;
}
.zest-spin-box .steps {
    display: flex;
    flex-direction: column;
    border-inline-start: var(--_border-width) solid var(--_line);
}
.zest-spin-box .box .steps button {
    flex: 1;
    min-height: 24px;
    min-width: 24px;
    margin: 0;
    padding: 0 0.375em;
    border-radius: 0;
    font-size: 0.75em;
    line-height: 1;
}
.zest-spin-box .box .steps button:first-child {
    border-start-end-radius: calc(var(--_radius) - 1px);
}
.zest-spin-box .box .steps button:last-child {
    border-end-end-radius: calc(var(--_radius) - 1px);
}
.zest-spin-box .box .steps button:disabled {
    color: var(--_disabled-text);
    cursor: default;
    background: none;
    border-color: transparent;
}
`;

const decimalsOf = (number) => {
    const text = String(number);
    if (text.includes('e-')) { return Number(text.split('e-')[1]); }
    return text.includes('.') ? text.split('.')[1].length : 0;
};

// A number field with buttons and keys that change the value by a step
export class SpinBox extends FormControl {
    static styles = styles;
    static properties = {
        value: {type: Number, default: null},
        min: {type: Number, default: null},
        max: {type: Number, default: null},
        step: {type: Number, default: 1},
        precision: {type: Number, default: null},
        locale: {type: String, default: ''},
        placeholder: {type: String, default: ''},
        readonly: {type: Boolean},
    };
    input;
    wrapper;
    #label;
    #up;
    #down;
    #help;
    #committed = null;
    #typing = false;
    #repeat = null;

    get focusTarget() { return this.input; }

    get decimals() {
        if (this.precision !== null && !Number.isNaN(this.precision)) { return Math.max(0, Math.min(20, this.precision)); }
        return Math.min(20, decimalsOf(this.step || 1));
    }
    get format() {
        const decimals = this.decimals;
        return numberFormat(this.locale || undefined, {minimumFractionDigits: decimals, maximumFractionDigits: decimals});
    }

    build() {
        this.wrapper = Object.assign(document.createElement('div'), {className: 'zest-spin-box'});
        this.wrapper.part = 'control';
        this.input = Object.assign(document.createElement('input'), {type: 'text', id: uniqueId('spin')});
        this.input.setAttribute('role', 'spinbutton');
        this.input.setAttribute('inputmode', 'decimal');
        this.input.setAttribute('autocomplete', 'off');
        this.#label = Object.assign(document.createElement('label'), {className: 'label', htmlFor: this.input.id});
        const box = Object.assign(document.createElement('div'), {className: 'box'});
        box.part = 'box';
        const steps = Object.assign(document.createElement('div'), {className: 'steps'});
        this.#up = this.#stepButton('▲', 1);
        this.#down = this.#stepButton('▼', -1);
        steps.append(this.#up, this.#down);
        box.append(this.input, steps);
        this.#help = Object.assign(document.createElement('div'), {className: 'help', id: uniqueId('spin-help')});
        this.wrapper.append(this.#label, box, this.#help);
        this.stopInner(this.wrapper);
        this.input.addEventListener('input', () => {
            this.#typing = true;
            const number = this.parse(this.input.value);
            if (number !== undefined && !Object.is(number, this.value)) {
                this.value = number;
                this.fire('input');
            }
        });
        this.input.addEventListener('change', () => this.commit());
        this.input.addEventListener('blur', () => this.commit());
        this.input.addEventListener('keydown', (e) => this.#onKeydown(e));
        this.root.append(this.wrapper);
        this.#committed = this.value;
    }

    #stepButton(text, direction) {
        const element = Object.assign(document.createElement('button'), {type: 'button', textContent: text, tabIndex: -1});
        element.setAttribute('aria-hidden', 'true');
        // A button is only for a pointer. The arrow keys do the same for the keyboard.
        element.addEventListener('pointerdown', (e) => {
            if (e.button !== 0) { return; }
            this.input.focus();
            this.stepBy(direction);
            this.#stopRepeat();
            this.#repeat = setTimeout(() => {
                this.#repeat = setInterval(() => this.stepBy(direction), 60);
            }, 400);
        });
        // The field keeps the focus
        element.addEventListener('mousedown', (e) => e.preventDefault());
        for (const name of ['pointerup', 'pointerleave', 'pointercancel']) {
            element.addEventListener(name, () => this.#stopRepeat());
        }
        return element;
    }

    #stopRepeat() {
        clearTimeout(this.#repeat);
        clearInterval(this.#repeat);
        this.#repeat = null;
    }

    disconnectedCallback() {
        this.#stopRepeat();
        super.disconnectedCallback();
    }

    // The number of a text in the locale, or null for no text, or undefined for text that is not a number
    parse(text) {
        const trimmed = String(text ?? '').trim();
        if (!trimmed) { return null; }
        const parts = this.format.formatToParts(-12345.6);
        const group = parts.find(part => part.type === 'group')?.value ?? ',';
        const decimal = parts.find(part => part.type === 'decimal')?.value ?? '.';
        const digits = new Map([...numberFormat(this.locale || undefined, {useGrouping: false}).format(9876543210)].map((digit, i) => [digit, String(9 - i)]));
        let plain = '';
        for (const character of trimmed.replaceAll(/[\s  ]/g, '')) {
            if (digits.has(character)) { plain += digits.get(character); }
            else if (/\d/.test(character)) { plain += character; }
            else if (character === decimal || (character === '.' && group !== '.')) { plain += '.'; }
            else if (character === group || character === "'") { continue; }
            else if (/[-−‐–]/.test(character) && !plain) { plain += '-'; }
            else if (character === '+' && !plain) { continue; }
            else { return undefined; }
        }
        const number = Number(plain);
        return plain === '-' || plain === '.' || Number.isNaN(number) ? undefined : number;
    }

    // Keeps the value in the limits and at the precision
    clamp(number) {
        if (number === null || number === undefined || Number.isNaN(number)) { return null; }
        let result = number;
        if (this.min !== null && !Number.isNaN(this.min)) { result = Math.max(this.min, result); }
        if (this.max !== null && !Number.isNaN(this.max)) { result = Math.min(this.max, result); }
        return Number(result.toFixed(this.decimals));
    }

    // Changes the value by a number of steps, as the user would
    stepBy(count) {
        if (this.isDisabled || this.readonly) { return; }
        const step = this.step || 1;
        const start = this.value ?? (count > 0 ? (this.min ?? 0) - step : (this.max ?? 0) + step);
        // A value between two steps goes to the next step
        const base = this.min ?? 0;
        const steps = (start - base) / step;
        const target = base + (count > 0 ? Math.floor(steps + 1e-9) + count : Math.ceil(steps - 1e-9) + count) * step;
        this.#set(this.clamp(target), true);
    }
    stepUp(count = 1) { this.stepBy(count); }
    stepDown(count = 1) { this.stepBy(-count); }

    #set(number, commit) {
        this.#typing = false;
        const changed = !Object.is(number, this.value);
        this.value = number;
        this.update();
        if (changed) { this.fire('input'); }
        if (commit) { this.commit(); }
    }

    // Reads the text and sends change if the value is different from the last change
    commit() {
        if (!this.input) { return; }
        if (this.#typing) {
            const number = this.parse(this.input.value);
            this.value = number === undefined ? this.value : this.clamp(number);
            this.#typing = false;
        }
        this.update();
        if (!Object.is(this.value, this.#committed)) {
            this.#committed = this.value;
            this.fire('change');
        }
    }

    #onKeydown(e) {
        if (e.altKey || e.ctrlKey || e.metaKey) { return; }
        const step = this.step || 1;
        const big = Math.max(1, Math.round(((this.max ?? 100) - (this.min ?? 0)) / step / 10));
        const keys = {ArrowUp: 1, ArrowDown: -1, PageUp: big, PageDown: -big};
        if (keys[e.key]) {
            e.preventDefault();
            if (this.#typing) { this.commit(); }
            this.stepBy(keys[e.key]);
        } else if (e.key === 'Home' && this.min !== null) {
            e.preventDefault();
            this.#set(this.clamp(this.min), true);
        } else if (e.key === 'End' && this.max !== null) {
            e.preventDefault();
            this.#set(this.clamp(this.max), true);
        } else if (e.key === 'Enter') {
            this.commit();
        }
    }

    update() {
        const input = this.input;
        const text = this.value === null || Number.isNaN(this.value) ? '' : this.format.format(this.value);
        if (!this.#typing && input.value !== text) { input.value = text; }
        this.#label.textContent = this.label;
        if (!this.label && this.getAttribute('aria-label')) { input.setAttribute('aria-label', this.getAttribute('aria-label')); }
        input.placeholder = this.placeholder;
        input.disabled = this.isDisabled;
        input.readOnly = this.readonly;
        input.required = this.required;
        this.wrapper.classList.toggle('disabled', this.isDisabled);
        const attributes = {'aria-valuemin': this.min, 'aria-valuemax': this.max, 'aria-valuenow': this.value};
        for (const [name, value] of Object.entries(attributes)) {
            if (value === null || Number.isNaN(value)) { input.removeAttribute(name); } else { input.setAttribute(name, value); }
        }
        if (text) { input.setAttribute('aria-valuetext', text); } else { input.removeAttribute('aria-valuetext'); }
        this.#up.disabled = this.isDisabled || this.readonly || (this.max !== null && this.value !== null && this.value >= this.max);
        this.#down.disabled = this.isDisabled || this.readonly || (this.min !== null && this.value !== null && this.value <= this.min);
        this.setFormValue(this.value === null ? null : String(this.value), text);
        const missing = this.required && this.value === null;
        this.setValidity(missing ? {valueMissing: true} : {}, this.text.fillNumber, input);
    }

    resetValue() {
        const attribute = this.getAttribute('value');
        this.value = attribute === null || attribute === '' ? null : Number(attribute);
        this.#committed = this.value;
        this.#typing = false;
    }
    restoreValue(state) {
        this.value = this.parse(state) ?? null;
    }
}

export class ShadowSpinBox extends shadowOf(SpinBox) {}
