import { placePopup, tokenAliases } from "@catalystcommunity/base-components";
import { FormControl, Typeahead, fieldStyles, readOptions, shadowOf, uniqueId } from "./form-control.js";
import { optionElement, optionStyles } from "./listbox.js";

const styles = `
combo-box, :host {
    display: inline-block;
    vertical-align: top;
    min-width: 0;
    max-width: 100%;
}
.zest-combo-box {
    ${tokenAliases('combo-box')}
}
${fieldStyles('.zest-combo-box')}
.zest-combo-box .select {
    flex: 1;
    display: flex;
    align-items: center;
    min-width: 6em;
    padding: var(--_padding-block) calc(var(--_padding-inline) * 0.75);
    cursor: pointer;
    outline: none !important;
    overflow-wrap: anywhere;
}
.zest-combo-box .select.placeholder {
    color: var(--_secondary-text);
}
.zest-combo-box .box .toggle {
    padding-inline: 0.5em;
}
.zest-combo-box .popup {
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
    line-height: var(--zest-line-height, inherit);
    overscroll-behavior: contain;
}
.zest-combo-box .popup:not(:popover-open) {
    display: none;
}
.zest-combo-box .popup[hidden] {
    display: none;
}
${optionStyles('.zest-combo-box')}
`;

// A field with a list of options. Without `editable`, the user can only select an option.
// With `editable`, the user can also type, and the list shows the options that match.
export class ComboBox extends FormControl {
    static styles = styles;
    static properties = {
        options: {type: Array, default: () => []},
        value: {type: String, default: ''},
        editable: {type: Boolean},
        placeholder: {type: String, default: ''},
    };
    wrapper;
    control;
    popup;
    #label;
    #box;
    #toggle;
    #items = [];
    #shown = [];
    #elements = new Map();
    #madeFrom = null;
    #madeEditable = null;
    #open = false;
    #active = -1;
    #text = '';
    #committed = '';
    #filtering = false;
    #typeahead = new Typeahead();

    get focusTarget() { return this.control; }
    get open() { return this.#open; }
    get items() { return this.#items; }
    get selectedOption() { return this.#items.find(item => item.value === this.value) ?? null; }

    build() {
        this.wrapper = Object.assign(document.createElement('div'), {className: 'zest-combo-box'});
        this.wrapper.part = 'control';
        this.#label = Object.assign(document.createElement('label'), {className: 'label', id: uniqueId('combo-label')});
        this.#box = Object.assign(document.createElement('div'), {className: 'box'});
        this.#box.part = 'box';
        this.#toggle = Object.assign(document.createElement('button'), {type: 'button', className: 'toggle', textContent: '▾', tabIndex: -1});
        this.#toggle.setAttribute('aria-hidden', 'true');
        this.#toggle.addEventListener('pointerdown', (e) => {
            if (e.button !== 0 || this.isDisabled) { return; }
            this.control.focus();
            this.#open ? this.close() : this.show();
        });
        this.popup = Object.assign(document.createElement('div'), {className: 'popup', id: uniqueId('combo-list')});
        this.popup.setAttribute('role', 'listbox');
        this.popup.setAttribute('popover', 'manual');
        this.popup.setAttribute('aria-labelledby', this.#label.id);
        this.popup.part = 'popup';
        if (typeof this.popup.showPopover !== 'function') { this.popup.hidden = true; }
        // The control keeps the focus while the user presses an option or the button
        this.popup.addEventListener('mousedown', (e) => e.preventDefault());
        this.#toggle.addEventListener('mousedown', (e) => e.preventDefault());
        this.popup.addEventListener('click', (e) => {
            const element = e.target.closest?.('[role="option"]');
            if (!element || element.getAttribute('aria-disabled') === 'true') { return; }
            this.#choose(this.#items.find(item => item.value === element.dataset.value));
            this.close();
        });
        this.wrapper.append(this.#label, this.#box, this.popup);
        this.stopInner(this.wrapper);
        this.root.append(this.wrapper);
    }

    connected() {
        this.listen(document, 'pointerdown', (e) => {
            if (this.#open && !e.composedPath().includes(this)) { this.close(); }
        });
        const place = () => { if (this.#open) { this.#place(); } };
        this.listen(window, 'resize', place);
        this.listen(window, 'scroll', place, {capture: true, passive: true});
    }

    disconnectedCallback() {
        this.close();
        super.disconnectedCallback();
    }

    #makeControl() {
        this.control?.remove();
        const id = uniqueId('combo');
        if (this.editable) {
            this.control = Object.assign(document.createElement('input'), {type: 'text', id, autocomplete: 'off'});
            this.control.setAttribute('aria-autocomplete', 'list');
            this.control.addEventListener('input', () => this.#onType());
            this.control.addEventListener('change', (e) => e.stopPropagation());
            this.#label.htmlFor = id;
        } else {
            this.control = Object.assign(document.createElement('div'), {className: 'select', id, tabIndex: 0});
            this.control.setAttribute('aria-labelledby', this.#label.id);
            this.control.addEventListener('click', () => {
                if (this.isDisabled) { return; }
                this.#open ? this.close() : this.show();
            });
            this.#label.removeAttribute('for');
            this.#label.onclick = () => this.control.focus();
        }
        this.control.setAttribute('role', 'combobox');
        this.control.setAttribute('aria-controls', this.popup.id);
        this.control.setAttribute('aria-haspopup', 'listbox');
        this.control.addEventListener('keydown', (e) => this.#onKeydown(e));
        this.control.addEventListener('blur', () => {
            // The focus can go to an option of the popup only with a pointer, which we stop
            this.close();
            if (this.editable) { this.#commitText(); }
        });
        this.#box.prepend(this.control);
        this.#box.append(this.#toggle);
    }

    update() {
        const key = JSON.stringify(this.options);
        if (key !== this.#madeFrom) {
            this.#madeFrom = key;
            this.#items = readOptions(this, this.options);
            const preselected = this.#items.find(item => item.selected);
            if (!this.value && preselected && !this.hasAttribute('value')) { this.value = preselected.value; }
            this.#text = this.selectedOption?.label ?? this.value;
            this.#committed = this.value;
            this.#filter(false);
        }
        if (this.#madeEditable !== this.editable) {
            this.#madeEditable = this.editable;
            this.#makeControl();
        }
        this.#label.textContent = this.label;
        const control = this.control;
        if (!this.label && this.getAttribute('aria-label')) { control.setAttribute('aria-label', this.getAttribute('aria-label')); }
        this.wrapper.classList.toggle('disabled', this.isDisabled);
        control.setAttribute('aria-expanded', String(this.#open));
        if (this.required) { control.setAttribute('aria-required', 'true'); } else { control.removeAttribute('aria-required'); }
        if (this.editable) {
            control.disabled = this.isDisabled;
            control.placeholder = this.placeholder;
            if (!this.#filtering && control.value !== this.#text) { control.value = this.#text; }
        } else {
            const option = this.selectedOption;
            control.textContent = option?.label ?? (this.placeholder || ' ');
            control.classList.toggle('placeholder', !option);
            control.tabIndex = this.isDisabled ? -1 : 0;
            if (this.isDisabled) { control.setAttribute('aria-disabled', 'true'); } else { control.removeAttribute('aria-disabled'); }
        }
        const activeItem = this.#shown[this.#active];
        for (const [value, element] of this.#elements) {
            element.setAttribute('aria-selected', String(value === this.value));
            element.classList.toggle('active', value === activeItem?.value);
        }
        const active = activeItem && this.#elements.get(activeItem.value);
        if (active && this.#open) {
            control.setAttribute('aria-activedescendant', active.id);
            active.scrollIntoView?.({block: 'nearest'});
        } else {
            control.removeAttribute('aria-activedescendant');
        }
        this.setFormValue(this.value || null, this.value);
        const missing = this.required && !this.value;
        this.setValidity(missing ? {valueMissing: true} : {}, this.text.selectOne, control);
    }

    // The options that the list shows: all of them, or the ones that match the text
    #filter(byText) {
        const query = byText ? this.#text.trim().toLowerCase() : '';
        this.#shown = query ? this.#items.filter(item => item.label.toLowerCase().includes(query)) : this.#items;
        this.#elements.clear();
        const base = uniqueId('combo-option');
        const elements = this.#shown.map((item, index) => {
            const element = optionElement(item, `${base}-${index}`);
            this.#elements.set(item.value, element);
            return element;
        });
        if (!elements.length) {
            elements.push(Object.assign(document.createElement('div'), {className: 'empty', textContent: this.text.noOptions}));
        }
        this.popup.replaceChildren(...elements);
    }

    // Opens the list. The active option is the selected one, or `at` ('first' or 'last').
    show(at = null) {
        if (this.isDisabled || this.#open) { return; }
        this.#open = true;
        const selected = this.#shown.findIndex(item => item.value === this.value);
        this.#active = at === 'first' ? this.#next(-1, 1) : at === 'last' ? this.#next(this.#shown.length, -1) : (this.editable && at === null ? selected : (selected >= 0 ? selected : this.#next(-1, 1)));
        if (this.popup.showPopover) {
            try { this.popup.showPopover(); } catch { /* It is already open */ }
        } else {
            this.popup.hidden = false;
        }
        this.#place();
        this.update();
    }

    close() {
        if (!this.#open) { return; }
        this.#open = false;
        this.#active = -1;
        if (this.popup.hidePopover) {
            try { this.popup.hidePopover(); } catch { /* It is already closed */ }
        } else {
            this.popup.hidden = true;
        }
        this.update();
    }

    // placePopup puts the list next to the box. The list then gets the height of the room on its
    // side, so that a long list scrolls in place of covering the box.
    #place() {
        const popup = this.popup;
        const box = this.#box.getBoundingClientRect();
        popup.style.minWidth = `${Math.max(160, box.width)}px`;
        placePopup(popup, this.#box, {placement: 'bottom-start'});
        const view = document.documentElement.clientHeight || innerHeight;
        const em = parseFloat(getComputedStyle(popup).fontSize) || 16;
        const wanted = Math.min(popup.scrollHeight + 2, em * 20, view * 0.6);
        const below = view - box.bottom - 6;
        const above = box.top - 6;
        const side = below >= wanted || below >= above ? 'bottom' : 'top';
        const height = Math.max(0, Math.min(wanted, side === 'bottom' ? below : above));
        popup.style.maxHeight = `${height}px`;
        const actual = popup.getBoundingClientRect().height;
        popup.style.top = `${Math.round(side === 'bottom' ? box.bottom + 2 : box.top - 2 - actual)}px`;
        popup.dataset.side = side;
    }

    #next(from, direction) {
        for (let i = from + direction; i >= 0 && i < this.#shown.length; i += direction) {
            if (!this.#shown[i].disabled) { return i; }
        }
        return from >= 0 && from < this.#shown.length ? from : -1;
    }

    #move(index) {
        this.#active = index;
        this.update();
    }

    #choose(item) {
        if (!item || item.disabled) { return; }
        this.#text = item.label;
        this.#filtering = false;
        const changed = item.value !== this.value;
        this.value = item.value;
        this.update();
        if (changed) { this.fire('input'); }
        if (item.value !== this.#committed) {
            this.#committed = item.value;
            this.fire('change');
        }
    }

    #onType() {
        this.#filtering = true;
        this.#text = this.control.value;
        const exact = this.#items.find(item => item.label.toLowerCase() === this.#text.trim().toLowerCase());
        this.value = exact ? exact.value : this.#text;
        this.#filter(true);
        this.#active = -1;
        if (!this.#open && this.#text) { this.show(); } else { this.update(); }
        this.fire('input');
    }

    #commitText() {
        if (!this.editable) { return; }
        this.#filtering = false;
        const exact = this.#items.find(item => item.value === this.value);
        if (exact) { this.#text = exact.label; }
        this.#filter(false);
        this.update();
        if (this.value !== this.#committed) {
            this.#committed = this.value;
            this.fire('change');
        }
    }

    #onKeydown(e) {
        if (this.isDisabled) { return; }
        const open = this.#open;
        const pageSize = 10;
        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                if (!open) { this.show(e.altKey ? null : (this.editable ? 'first' : null)); return; }
                if (!e.altKey) { this.#move(this.#next(this.#active, 1)); }
                return;
            case 'ArrowUp':
                e.preventDefault();
                if (e.altKey) {
                    if (open && !this.editable && this.#shown[this.#active]) { this.#choose(this.#shown[this.#active]); }
                    this.close();
                    return;
                }
                if (!open) { this.show(this.editable ? 'last' : 'first'); return; }
                this.#move(this.#next(this.#active, -1));
                return;
            case 'PageDown':
            case 'PageUp':
                if (!open) { return; }
                e.preventDefault();
                {
                    const direction = e.key === 'PageDown' ? 1 : -1;
                    let index = this.#active;
                    for (let i = 0; i < pageSize; i++) { index = this.#next(index, direction); }
                    this.#move(index);
                }
                return;
            case 'Home':
            case 'End':
                if (this.editable) { return; }
                e.preventDefault();
                if (!open) { this.show(e.key === 'Home' ? 'first' : 'last'); return; }
                this.#move(e.key === 'Home' ? this.#next(-1, 1) : this.#next(this.#shown.length, -1));
                return;
            case 'Enter':
                if (open) {
                    e.preventDefault();
                    if (this.#shown[this.#active]) { this.#choose(this.#shown[this.#active]); } else { this.#commitText(); }
                    this.close();
                } else if (this.editable) {
                    this.#commitText();
                } else {
                    e.preventDefault();
                    this.show();
                }
                return;
            case ' ':
                if (this.editable) { return; }
                e.preventDefault();
                if (open) {
                    if (this.#shown[this.#active]) { this.#choose(this.#shown[this.#active]); }
                    this.close();
                } else {
                    this.show();
                }
                return;
            case 'Escape':
                if (open) {
                    e.preventDefault();
                    e.stopPropagation();
                    this.close();
                } else if (this.editable && this.control.value) {
                    e.preventDefault();
                    this.control.value = '';
                    this.#onType();
                }
                return;
            case 'Tab':
                if (open && !this.editable && this.#shown[this.#active]) { this.#choose(this.#shown[this.#active]); }
                this.close();
                return;
            default:
                break;
        }
        if (!this.editable && e.key.length === 1 && e.key.trim() && !e.ctrlKey && !e.metaKey && !e.altKey) {
            const found = this.#typeahead.find(this.#shown, this.#active, e.key, item => item.label);
            if (!found || found.disabled) { return; }
            e.preventDefault();
            if (!open) { this.show(); }
            this.#move(this.#shown.indexOf(found));
        }
    }

    resetValue() {
        this.value = this.getAttribute('value') ?? this.#items.find(item => item.selected)?.value ?? '';
        this.#text = this.selectedOption?.label ?? this.value;
        this.#committed = this.value;
        this.#filtering = false;
    }
    restoreValue(state) {
        this.value = state ?? '';
        this.#text = this.selectedOption?.label ?? this.value;
    }

    propertyChanged(name) {
        // A value from code also changes the text of an editable box
        if (name === 'value' && !this.#filtering) {
            this.#text = this.selectedOption?.label ?? this.value;
        }
    }
}

export class ShadowComboBox extends shadowOf(ComboBox) {}
