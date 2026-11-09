import { tokenAliases } from "@catalystcommunity/base-components";
import { FormControl, shadowOf } from "./form-control.js";

const checkStyles = `
check-box, toggle-switch, :host {
    display: inline-flex;
    vertical-align: middle;
    min-width: 0;
}
.zest-check-box, .zest-toggle-switch {
    ${tokenAliases('check-box')}
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: var(--_gap);
    min-height: max(24px, 1.5em);
    min-width: 24px;
    padding-block: 0.125em;
    color: var(--_window-text);
    cursor: pointer;
}
.zest-check-box input {
    flex: none;
    width: 1.25em;
    height: 1.25em;
    min-width: 18px;
    min-height: 18px;
    margin: 0;
    accent-color: var(--_highlight);
    cursor: inherit;
}
.zest-check-box input:focus-visible {
    outline: var(--_focus-width) solid var(--_focus);
    outline-offset: var(--_focus-offset);
}
.zest-check-box .zest-text:empty, .zest-toggle-switch .zest-text:empty {
    display: none;
}
.zest-check-box.zest-disabled, .zest-toggle-switch.zest-disabled {
    color: var(--_disabled-text);
    cursor: default;
}
`;

const switchStyles = `
.zest-toggle-switch {
    ${tokenAliases('toggle-switch')}
}
.zest-toggle-switch input {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    margin: 0;
    opacity: 0;
    cursor: inherit;
}
.zest-toggle-switch .zest-track {
    position: relative;
    flex: none;
    box-sizing: border-box;
    width: 2.75em;
    height: 1.5em;
    min-width: 44px;
    min-height: 24px;
    background: var(--_face);
    border: var(--_border-width) solid var(--_border);
    border-radius: 0.75em;
    transition: background-color var(--_motion);
}
.zest-toggle-switch .zest-thumb {
    position: absolute;
    inset-block: 2px;
    inset-inline-start: 2px;
    display: grid;
    place-items: center;
    aspect-ratio: 1;
    box-sizing: border-box;
    background: var(--_window);
    border: var(--_border-width) solid var(--_border);
    border-radius: 50%;
    font-size: 0.75em;
    line-height: 1;
    color: var(--_highlight);
    transition: inset-inline-start var(--_motion);
}
.zest-toggle-switch.zest-on .zest-track {
    background: var(--_highlight);
    border-color: var(--_highlight);
}
/* The thumb moves to the end, and shows a check mark: the state is not color only */
.zest-toggle-switch.zest-on .zest-thumb {
    inset-inline-start: calc(100% - 2px - (1.5em - 4px - var(--_border-width) * 2));
    border-color: var(--_highlight);
}
.zest-toggle-switch.zest-on .zest-thumb::before {
    content: "✓";
}
.zest-toggle-switch input:focus-visible + .zest-track {
    outline: var(--_focus-width) solid var(--_focus);
    outline-offset: var(--_focus-offset);
}
.zest-toggle-switch .zest-state {
    min-width: 2em;
    font-size: 0.875em;
    color: var(--_secondary-text);
}
.zest-toggle-switch.zest-disabled .zest-track {
    border-style: dashed;
    background: var(--_face);
}
@media (forced-colors: active) {
    .zest-toggle-switch .zest-track {
        border-color: ButtonText;
    }
    .zest-toggle-switch.zest-on .zest-track {
        background: Highlight;
        border-color: Highlight;
        forced-color-adjust: none;
    }
    .zest-toggle-switch .zest-thumb {
        background: ButtonText;
        forced-color-adjust: none;
    }
    .zest-toggle-switch.zest-on .zest-thumb {
        background: HighlightText;
        color: Highlight;
    }
}
`;

// A check box with three states: not checked, checked, and indeterminate
export class CheckBox extends FormControl {
    static styles = checkStyles;
    static properties = {
        checked: {type: Boolean},
        indeterminate: {type: Boolean},
        value: {type: String, default: 'on', render: false},
    };
    static kind = 'check-box';
    input;
    wrapper;
    #text;
    #hasContent = false;

    get focusTarget() { return this.input; }

    connected() {
        this.followContent(this.#text, this.wrapper, (hasContent) => {
            this.#hasContent = hasContent;
            this.invalidate();
        });
    }

    build() {
        this.wrapper = document.createElement('label');
        this.wrapper.className = `zest-${this.constructor.kind}`;
        this.wrapper.part = 'control';
        this.input = document.createElement('input');
        this.input.type = 'checkbox';
        this.#text = Object.assign(document.createElement('span'), {className: 'zest-text'});
        this.#hasContent = this.takeContent(this.#text);
        this.wrapper.append(this.input, ...this.extraParts(), this.#text);
        this.stopInner(this.wrapper);
        this.input.addEventListener('change', () => {
            this.checked = this.input.checked;
            this.indeterminate = false;
            this.update();
            this.fire('input');
            this.fire('change');
        });
        this.root.append(this.wrapper);
    }
    extraParts() { return []; }

    update() {
        this.input.checked = this.checked;
        this.input.indeterminate = this.indeterminate && !this.checked;
        this.input.disabled = this.isDisabled;
        this.input.required = this.required;
        this.wrapper.classList.toggle('zest-disabled', this.isDisabled);
        if (!this.#hasContent) { this.#text.textContent = this.label; }
        this.nameInner(this.input);
        this.describe([], this.input);
        this.setFormValue(this.checked ? this.value : null, this.checked ? 'checked' : '');
        this.setValidity(this.required && !this.checked ? {valueMissing: true} : {}, this.text.checkThis);
    }

    // Changes the state, as a click does, and sends the events
    toggle() {
        if (this.isDisabled) { return; }
        this.input ? this.input.click() : (this.checked = !this.checked);
    }

    resetValue() {
        this.checked = this.hasAttribute('checked');
        this.indeterminate = this.hasAttribute('indeterminate');
    }
    restoreValue(state) {
        this.checked = state === 'checked';
    }
}

// An on and off switch. It has the same API as CheckBox, and the role switch.
export class ToggleSwitch extends CheckBox {
    static styles = checkStyles + switchStyles;
    static kind = 'toggle-switch';
    static properties = {
        showState: {type: Boolean},
    };
    #state;

    extraParts() {
        this.input.setAttribute('role', 'switch');
        const track = Object.assign(document.createElement('span'), {className: 'zest-track'});
        track.setAttribute('aria-hidden', 'true');
        track.append(Object.assign(document.createElement('span'), {className: 'zest-thumb'}));
        this.#state = Object.assign(document.createElement('span'), {className: 'zest-state'});
        this.#state.setAttribute('aria-hidden', 'true');
        return [track, this.#state];
    }

    update() {
        this.indeterminate = false;
        super.update();
        this.wrapper.classList.toggle('zest-on', this.checked);
        this.#state.hidden = !this.showState;
        this.#state.textContent = this.checked ? this.text.on : this.text.off;
    }
}

export class ShadowCheckBox extends shadowOf(CheckBox) {}
export class ShadowToggleSwitch extends shadowOf(ToggleSwitch) {}
