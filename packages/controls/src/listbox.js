import { tokenAliases } from "@catalystcommunity/base-components";
import { FormControl, Typeahead, readOptions, shadowOf, uniqueId } from "./form-control.js";

// The look of an option, which the combo box also uses
export const optionStyles = (selector) => `
${selector} [role="option"] {
    display: flex;
    align-items: center;
    gap: var(--_gap);
    box-sizing: border-box;
    min-height: max(24px, 2em);
    padding: 0.25em calc(var(--_padding-inline) * 0.75);
    padding-inline-start: 0.5em;
    cursor: pointer;
    border-radius: calc(var(--_radius) - 2px);
    color: var(--_field-text);
}
${selector} [role="option"]::before {
    content: "";
    flex: none;
    width: 1em;
    text-align: center;
}
${selector} [role="option"][aria-selected="true"] {
    background: var(--_selected-face);
    color: var(--_selected-text);
}
/* A check mark also shows the selection, so that it is not color only */
${selector} [role="option"][aria-selected="true"]::before {
    content: "✓";
}
${selector} [role="option"]:hover {
    background: var(--_hover-face);
}
${selector} [role="option"][aria-selected="true"]:hover {
    background: var(--_selected-face);
}
${selector} [role="option"].active {
    outline: var(--_focus-width) solid var(--_focus);
    outline-offset: calc(var(--_focus-width) * -1);
}
${selector} [role="option"][aria-disabled="true"] {
    color: var(--_disabled-text);
    cursor: default;
    text-decoration: line-through;
}
${selector} [role="option"] .description {
    margin-inline-start: auto;
    font-size: 0.875em;
    opacity: 0.85;
}
${selector} .empty {
    padding: 0.5em;
    color: var(--_secondary-text);
}
@media (forced-colors: active) {
    ${selector} [role="option"][aria-selected="true"] {
        background: Highlight;
        color: HighlightText;
        forced-color-adjust: none;
    }
    ${selector} [role="option"].active {
        outline-color: CanvasText;
    }
}
`;

// Makes the element of one option
export function optionElement(option, id) {
    const element = document.createElement('div');
    element.setAttribute('role', 'option');
    element.id = id;
    element.dataset.value = option.value;
    const label = Object.assign(document.createElement('span'), {className: 'option-label', textContent: option.label});
    element.append(label);
    if (option.description) {
        element.append(Object.assign(document.createElement('span'), {className: 'description', textContent: option.description}));
    }
    if (option.disabled) { element.setAttribute('aria-disabled', 'true'); }
    return element;
}

const styles = `
list-box, :host {
    display: block;
    min-width: 0;
}
.zest-list-box {
    ${tokenAliases('list-box', 'control')}
    display: flex;
    flex-direction: column;
    gap: 0.25em;
    min-width: 0;
    color: var(--_window-text);
}
.zest-list-box .label {
    font-weight: 600;
}
.zest-list-box .label:empty {
    display: none;
}
.zest-list-box .list {
    box-sizing: border-box;
    max-height: var(--zest-list-box-max-height, 15em);
    overflow-y: auto;
    padding: 2px;
    background: var(--_field);
    border: var(--_border-width) solid var(--_border);
    border-radius: var(--_radius);
    overscroll-behavior: contain;
}
.zest-list-box .list:focus-visible {
    outline: var(--_focus-width) solid var(--_focus);
    outline-offset: var(--_focus-offset);
}
.zest-list-box.disabled .list {
    border-style: dashed;
}
.zest-list-box.disabled [role="option"] {
    color: var(--_disabled-text);
    cursor: default;
}
${optionStyles('.zest-list-box')}
`;

// A list of options. With `multiple`, the user can select more than one.
export class ListBox extends FormControl {
    static styles = styles;
    static properties = {
        options: {type: Array, default: () => []},
        multiple: {type: Boolean},
        value: {type: String, default: ''},
        // All the selected values, also for a single selection
        values: {type: Array, attribute: false, default: () => []},
    };
    list;
    wrapper;
    #label;
    #items = [];
    #elements = new Map();
    #active = null;
    #anchor = null;
    #madeFrom = null;
    #typeahead = new Typeahead();
    #syncing = false;

    get focusTarget() { return this.list; }
    get items() { return this.#items; }
    get activeValue() { return this.#active; }

    build() {
        this.wrapper = Object.assign(document.createElement('div'), {className: 'zest-list-box'});
        this.wrapper.part = 'control';
        this.#label = Object.assign(document.createElement('span'), {className: 'label', id: uniqueId('list-label')});
        this.list = Object.assign(document.createElement('div'), {className: 'list', tabIndex: 0});
        this.list.setAttribute('role', 'listbox');
        this.list.part = 'list';
        this.wrapper.append(this.#label, this.list);
        this.list.addEventListener('keydown', (e) => this.#onKeydown(e));
        this.list.addEventListener('click', (e) => this.#onClick(e));
        this.list.addEventListener('mousedown', (e) => { if (e.shiftKey) { e.preventDefault(); } });
        this.list.addEventListener('focus', () => {
            if (this.#active === null) { this.#setActive(this.values[0] ?? this.#enabled()[0]?.value ?? null); }
        });
        this.root.append(this.wrapper);
    }

    propertyChanged(name, oldValue, newValue) {
        if (this.#syncing) { return; }
        this.#syncing = true;
        try {
            if (name === 'value') { this.values = newValue === '' || newValue === null ? [] : [String(newValue)]; }
            if (name === 'values') { this.value = newValue[0] ?? ''; }
        } finally {
            this.#syncing = false;
        }
    }

    #enabled() { return this.#items.filter(item => !item.disabled); }

    update() {
        const key = JSON.stringify(this.options);
        if (key !== this.#madeFrom) {
            this.#madeFrom = key;
            this.#items = readOptions(this, this.options);
            this.#elements.clear();
            const base = uniqueId('option');
            this.list.replaceChildren(...this.#items.map((item, index) => {
                const element = optionElement(item, `${base}-${index}`);
                this.#elements.set(item.value, element);
                return element;
            }));
            const preselected = this.#items.filter(item => item.selected).map(item => item.value);
            if (!this.values.length && preselected.length && !this.hasAttribute('value')) {
                this.values = this.multiple ? preselected : preselected.slice(0, 1);
            }
        }
        this.#label.textContent = this.label;
        if (this.label) { this.list.setAttribute('aria-labelledby', this.#label.id); } else { this.list.removeAttribute('aria-labelledby'); }
        if (!this.label && this.getAttribute('aria-label')) { this.list.setAttribute('aria-label', this.getAttribute('aria-label')); }
        this.list.setAttribute('aria-multiselectable', String(this.multiple));
        if (this.required) { this.list.setAttribute('aria-required', 'true'); } else { this.list.removeAttribute('aria-required'); }
        this.wrapper.classList.toggle('disabled', this.isDisabled);
        if (this.isDisabled) { this.list.setAttribute('aria-disabled', 'true'); } else { this.list.removeAttribute('aria-disabled'); }
        const selected = new Set(this.values);
        for (const [value, element] of this.#elements) {
            element.setAttribute('aria-selected', String(selected.has(value)));
            element.classList.toggle('active', value === this.#active);
        }
        const active = this.#elements.get(this.#active);
        if (active) { this.list.setAttribute('aria-activedescendant', active.id); } else { this.list.removeAttribute('aria-activedescendant'); }
        this.#writeForm();
    }

    #writeForm() {
        if (this.multiple && typeof FormData === 'function' && this.name) {
            const data = new FormData();
            for (const value of this.values) { data.append(this.name, value); }
            this.setFormValue(this.values.length ? data : null, JSON.stringify(this.values));
        } else {
            this.setFormValue(this.values[0] ?? null, JSON.stringify(this.values));
        }
        const missing = this.required && !this.values.length;
        this.setValidity(missing ? {valueMissing: true} : {}, this.multiple ? this.text.selectAtLeastOne : this.text.selectOne, this.list);
    }

    #setActive(value, scroll = true) {
        this.#active = value;
        this.update();
        if (scroll) { this.#elements.get(value)?.scrollIntoView?.({block: 'nearest'}); }
    }

    #select(values) {
        const next = [...new Set(values)].filter(value => this.#items.some(item => item.value === value && !item.disabled));
        if (JSON.stringify(next) === JSON.stringify(this.values)) { return; }
        this.values = next;
        this.update();
        this.fire('input');
        this.fire('change');
    }

    #range(from, to) {
        const enabled = this.#enabled().map(item => item.value);
        const start = enabled.indexOf(from);
        const end = enabled.indexOf(to);
        if (start < 0 || end < 0) { return [to]; }
        return enabled.slice(Math.min(start, end), Math.max(start, end) + 1);
    }

    #onKeydown(e) {
        if (this.isDisabled) { return; }
        const enabled = this.#enabled();
        if (!enabled.length) { return; }
        const index = enabled.findIndex(item => item.value === this.#active);
        const pageSize = Math.max(1, Math.floor((this.list.clientHeight || 300) / (this.list.firstElementChild?.offsetHeight || 30)) - 1);
        let target = null;
        switch (e.key) {
            case 'ArrowDown': target = enabled[Math.min(enabled.length - 1, index + 1)]; break;
            case 'ArrowUp': target = enabled[Math.max(0, index < 0 ? 0 : index - 1)]; break;
            case 'Home': target = enabled[0]; break;
            case 'End': target = enabled.at(-1); break;
            case 'PageDown': target = enabled[Math.min(enabled.length - 1, index + pageSize)]; break;
            case 'PageUp': target = enabled[Math.max(0, index - pageSize)]; break;
            default: break;
        }
        if (target) {
            e.preventDefault();
            const value = target.value;
            if (!this.multiple) {
                this.#setActive(value);
                this.#select([value]);
                return;
            }
            if (e.shiftKey) {
                // Shift with Home or End selects to the end, and Shift with an arrow extends the selection
                this.#anchor ??= this.#active ?? value;
                this.#setActive(value);
                this.#select(this.#range(this.#anchor, value));
            } else {
                this.#anchor = value;
                this.#setActive(value);
            }
            return;
        }
        if (e.key === ' ' && this.multiple) {
            e.preventDefault();
            if (this.#active === null) { return; }
            if (e.shiftKey && this.#anchor !== null) {
                this.#select(this.#range(this.#anchor, this.#active));
            } else {
                this.#anchor = this.#active;
                const values = this.values.includes(this.#active) ? this.values.filter(value => value !== this.#active) : [...this.values, this.#active];
                this.#select(values);
            }
            return;
        }
        if (e.key.toLowerCase() === 'a' && (e.ctrlKey || e.metaKey) && this.multiple) {
            e.preventDefault();
            const all = enabled.map(item => item.value);
            this.#select(this.values.length === all.length ? [] : all);
            return;
        }
        if (e.key.length === 1 && e.key.trim() && !e.ctrlKey && !e.metaKey && !e.altKey) {
            const found = this.#typeahead.find(enabled, index, e.key, item => item.label);
            if (found) {
                e.preventDefault();
                this.#setActive(found.value);
                if (!this.multiple) { this.#select([found.value]); }
            }
        }
    }

    #onClick(e) {
        if (this.isDisabled) { return; }
        const element = e.target.closest?.('[role="option"]');
        if (!element || element.getAttribute('aria-disabled') === 'true') { return; }
        const value = element.dataset.value;
        this.list.focus({preventScroll: true});
        if (!this.multiple) {
            this.#setActive(value, false);
            this.#select([value]);
            return;
        }
        if (e.shiftKey && this.#anchor !== null) {
            this.#setActive(value, false);
            this.#select(this.#range(this.#anchor, value));
        } else {
            this.#anchor = value;
            this.#setActive(value, false);
            // A click in a list of many toggles the option, as the check mark tells
            const values = this.values.includes(value) ? this.values.filter(item => item !== value) : [...this.values, value];
            this.#select(values);
        }
    }

    resetValue() {
        const attribute = this.getAttribute('value');
        this.values = attribute ? [attribute] : this.#items.filter(item => item.selected).map(item => item.value);
        this.#active = null;
        this.#anchor = null;
    }
    restoreValue(state) {
        try { this.values = JSON.parse(state); } catch { this.values = []; }
    }
}

export class ShadowListBox extends shadowOf(ListBox) {}
