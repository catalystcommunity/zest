import { tokenAliases, visuallyHidden } from "@catalystcommunity/base-components";
import { FormControl, fieldStyles, shadowOf, uniqueId } from "./form-control.js";

const TYPES = ['text', 'email', 'password', 'search', 'url', 'tel'];

const styles = `
text-field, text-area, :host {
    display: inline-block;
    vertical-align: top;
    min-width: 0;
    max-width: 100%;
}
.zest-text-field {
    ${tokenAliases('text-field', 'control')}
}
.zest-text-area {
    ${tokenAliases('text-area', 'control')}
}
${fieldStyles('.zest-text-field')}
${fieldStyles('.zest-text-area')}
.zest-text-area textarea {
    min-height: calc(var(--_rows, 3) * 1lh + var(--_padding-block) * 2);
    resize: vertical;
}
.zest-text-area.grow textarea {
    resize: none;
    overflow: hidden;
}
.zest-text-area .footer {
    display: flex;
    gap: var(--_gap);
    justify-content: space-between;
}
.zest-text-area .count {
    margin-inline-start: auto;
    font-size: 0.875em;
    color: var(--_secondary-text);
    font-variant-numeric: tabular-nums;
}
.zest-text-area .count:empty {
    display: none;
}
.zest-text-area .count.full {
    color: var(--_invalid);
    font-weight: 600;
}
.zest-text-field .sr, .zest-text-area .sr {
    ${visuallyHidden}
}
`;

// The validity of the inner native field, which also has the browser's words for the problem
function mirrorValidity(control, field, customError) {
    field.setCustomValidity(customError || '');
    const flags = {};
    for (const key of ['valueMissing', 'typeMismatch', 'patternMismatch', 'tooLong', 'tooShort', 'badInput', 'customError']) {
        if (field.validity[key]) { flags[key] = true; }
    }
    // minlength counts only after the user types. A value from code must also follow it.
    const min = Number(field.getAttribute('minlength'));
    if (min && field.value && field.value.length < min && !flags.tooShort) {
        flags.tooShort = true;
    }
    let message = field.validationMessage;
    if (flags.tooShort && !message) { message = `Use ${min} characters or more.`; }
    control.setValidity(flags, message, field);
    return Object.keys(flags).length ? message : '';
}

class TextControl extends FormControl {
    static styles = styles;
    static properties = {
        value: {type: String, default: ''},
        placeholder: {type: String, default: ''},
        readonly: {type: Boolean},
        minlength: {type: Number, default: null},
        maxlength: {type: Number, default: null},
        helper: {type: String, default: ''},
        error: {type: String, default: ''},
        autocomplete: {type: String, default: ''},
    };
    field;
    wrapper;
    labelElement;
    box;
    help;
    touched = false;

    get focusTarget() { return this.field; }

    makeField() { return document.createElement('input'); }

    build() {
        const kind = this.constructor.kind;
        this.wrapper = Object.assign(document.createElement('div'), {className: `zest-${kind}`});
        this.wrapper.part = 'control';
        this.field = this.makeField();
        this.field.id = uniqueId(kind);
        this.field.className = 'field';
        this.labelElement = Object.assign(document.createElement('label'), {className: 'label', htmlFor: this.field.id});
        this.box = Object.assign(document.createElement('div'), {className: 'box'});
        this.box.part = 'box';
        this.help = Object.assign(document.createElement('div'), {className: 'help', id: uniqueId(`${kind}-help`)});
        this.buildBox();
        this.wrapper.append(this.labelElement, this.box, this.footer());
        this.stopInner(this.wrapper);
        this.field.addEventListener('input', () => {
            this.value = this.field.value;
            this.afterInput();
            this.update();
            this.fire('input');
        });
        this.field.addEventListener('change', () => {
            this.touched = true;
            this.update();
            this.fire('change');
        });
        this.field.addEventListener('blur', () => {
            if (!this.touched && this.field.value) { this.touched = true; this.update(); }
        });
        this.addEventListener('invalid', () => { this.touched = true; this.update(); });
        this.root.append(this.wrapper);
    }
    buildBox() { this.box.append(this.field); }
    footer() { return this.help; }
    afterInput() { }

    update() {
        const field = this.field;
        if (field.value !== this.value) { field.value = this.value ?? ''; }
        this.labelElement.textContent = this.label;
        if (!this.label && this.getAttribute('aria-label')) {
            field.setAttribute('aria-label', this.getAttribute('aria-label'));
        }
        field.placeholder = this.placeholder;
        field.disabled = this.isDisabled;
        field.readOnly = this.readonly;
        field.required = this.required;
        for (const name of ['minlength', 'maxlength']) {
            if (this[name] === null || Number.isNaN(this[name])) { field.removeAttribute(name); } else { field.setAttribute(name, this[name]); }
        }
        if (this.autocomplete) { field.setAttribute('autocomplete', this.autocomplete); } else { field.removeAttribute('autocomplete'); }
        this.updateField();
        this.wrapper.classList.toggle('disabled', this.isDisabled);
        this.setFormValue(this.value || null, this.value);
        const problem = mirrorValidity(this, field, this.error);
        const showProblem = Boolean(problem) && (this.touched || Boolean(this.error));
        if (showProblem) { field.setAttribute('aria-invalid', 'true'); } else { field.removeAttribute('aria-invalid'); }
        this.help.textContent = showProblem ? problem : this.helper;
        this.help.classList.toggle('error', showProblem);
        this.describe([this.help.textContent && this.help.id, ...this.moreDescriptions()]);
    }
    updateField() { }
    moreDescriptions() { return []; }

    describe(ids) {
        const list = ids.filter(Boolean).join(' ');
        if (list) { this.field.setAttribute('aria-describedby', list); } else { this.field.removeAttribute('aria-describedby'); }
    }

    select() { this.field?.select(); }
    setCustomValidity(message) { this.error = message || ''; }

    resetValue() {
        this.value = this.getAttribute('value') ?? '';
        this.touched = false;
    }
    restoreValue(state) { this.value = state ?? ''; }
}

// A field for one line of text
export class TextField extends TextControl {
    static kind = 'text-field';
    static properties = {
        type: {type: String, default: 'text'},
        pattern: {type: String, default: ''},
        // Not prefix and suffix: an element already has a prefix property
        prefixText: {type: String, default: ''},
        suffixText: {type: String, default: ''},
        inputmode: {type: String, default: ''},
    };
    #prefix;
    #suffix;
    #clear;
    #reveal;
    #revealed = false;

    buildBox() {
        this.#prefix = Object.assign(document.createElement('span'), {className: 'affix prefix', id: uniqueId('prefix')});
        this.#suffix = Object.assign(document.createElement('span'), {className: 'affix suffix', id: uniqueId('suffix')});
        this.#clear = Object.assign(document.createElement('button'), {type: 'button', className: 'clear', textContent: '✕'});
        this.#reveal = Object.assign(document.createElement('button'), {type: 'button', className: 'reveal'});
        this.#clear.addEventListener('click', () => this.clear());
        this.#reveal.addEventListener('click', () => {
            this.#revealed = !this.#revealed;
            this.update();
        });
        this.field.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.type === 'search' && this.value) {
                e.preventDefault();
                this.clear();
            }
        });
        this.box.append(this.#prefix, this.field, this.#clear, this.#reveal, this.#suffix);
    }

    // Removes the text, and sends the events as the user would
    clear() {
        if (this.isDisabled || this.readonly || !this.value) { return; }
        this.value = '';
        this.update();
        this.fire('input');
        this.fire('change');
        this.field.focus();
    }

    updateField() {
        const type = TYPES.includes(this.type) ? this.type : 'text';
        this.field.type = type === 'password' && this.#revealed ? 'text' : type;
        if (this.pattern) { this.field.pattern = this.pattern; } else { this.field.removeAttribute('pattern'); }
        if (this.inputmode) { this.field.inputMode = this.inputmode; } else { this.field.removeAttribute('inputmode'); }
        this.#prefix.textContent = this.prefixText;
        this.#suffix.textContent = this.suffixText;
        const text = this.text;
        this.#clear.hidden = type !== 'search' || !this.value || this.isDisabled || this.readonly;
        this.#clear.setAttribute('aria-label', text.clear);
        this.#reveal.hidden = type !== 'password';
        this.#reveal.textContent = this.#revealed ? text.hide : text.show;
        this.#reveal.setAttribute('aria-label', text.showPassword);
        this.#reveal.setAttribute('aria-pressed', String(this.#revealed));
        this.#reveal.disabled = this.isDisabled;
    }

    moreDescriptions() {
        return [this.prefixText && this.#prefix.id, this.suffixText && this.#suffix.id];
    }
}

// A field for many lines of text. With `autogrow`, it grows with its text.
export class TextArea extends TextControl {
    static kind = 'text-area';
    static properties = {
        rows: {type: Number, default: 3},
        autogrow: {type: Boolean},
    };
    #count;
    #live;
    #announced = null;

    makeField() { return document.createElement('textarea'); }

    footer() {
        const footer = Object.assign(document.createElement('div'), {className: 'footer'});
        this.#count = Object.assign(document.createElement('span'), {className: 'count', id: uniqueId('count')});
        this.#count.setAttribute('aria-hidden', 'true');
        this.#live = Object.assign(document.createElement('span'), {className: 'sr'});
        this.#live.setAttribute('aria-live', 'polite');
        footer.append(this.help, this.#count, this.#live);
        return footer;
    }

    afterInput() {
        // The live region speaks only near the limit, not for each key
        const max = this.maxlength;
        if (!max) { return; }
        const left = max - this.value.length;
        const near = left <= Math.max(10, Math.round(max * 0.1));
        const step = left === 0 ? 0 : Math.ceil(left / 5) * 5;
        if (near && step !== this.#announced) {
            this.#announced = step;
            this.#live.textContent = this.text.charactersLeft(left);
        } else if (!near) {
            this.#announced = null;
        }
    }

    updateField() {
        this.field.rows = Math.max(1, this.rows || 3);
        this.wrapper.style.setProperty('--_rows', Math.max(1, this.rows || 3));
        this.wrapper.classList.toggle('grow', this.autogrow);
        const max = this.maxlength;
        this.#count.textContent = max ? this.text.characterCount(this.value.length, max) : '';
        this.#count.classList.toggle('full', Boolean(max) && this.value.length >= max);
        if (this.autogrow && this.isConnected) {
            this.field.style.height = 'auto';
            if (this.field.scrollHeight) { this.field.style.height = `${this.field.scrollHeight + 2}px`; }
        } else {
            this.field.style.removeProperty('height');
        }
    }

    moreDescriptions() {
        return [this.maxlength && this.#count.id];
    }
}

export class ShadowTextField extends shadowOf(TextField) {}
export class ShadowTextArea extends shadowOf(TextArea) {}
