import { tokenAliases } from "@catalystcommunity/base-components";
import { FormControl } from "./form-control.js";

const VARIANTS = ['default', 'primary', 'danger', 'flat'];

const styles = `
push-button, :host {
    display: inline-flex;
    vertical-align: middle;
    min-width: 0;
}
.zest-push-button {
    ${tokenAliases('push-button')}
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--_gap);
    box-sizing: border-box;
    min-height: var(--_height);
    min-width: max(24px, var(--_height));
    max-width: 100%;
    padding: var(--_padding-block) var(--_padding-inline);
    background-color: var(--_face);
    background-image: var(--_fill);
    color: var(--_face-text);
    border: var(--_border-width) solid var(--_border);
    border-radius: var(--_radius);
    font: inherit;
    font-family: var(--zest-font-family, inherit);
    text-align: center;
    overflow-wrap: anywhere;
    cursor: pointer;
    transition: background-color var(--_motion), border-color var(--_motion);
}
.zest-push-button:hover {
    background-image: none;
    border-color: var(--_highlight);
}
.zest-push-button:active {
    background-image: none;
    background-color: color-mix(in srgb, var(--_face) 80%, var(--_face-text));
}
.zest-push-button:focus-visible {
    outline: var(--_focus-width) solid var(--_focus);
    outline-offset: var(--_focus-offset);
}
.zest-push-button.primary {
    background: var(--_highlight);
    color: var(--_highlight-text);
    border-color: var(--_highlight);
    font-weight: 600;
}
.zest-push-button.primary:hover {
    background: color-mix(in srgb, var(--_highlight) 85%, var(--_window-text));
}
.zest-push-button.danger {
    background: var(--_window);
    color: var(--_invalid);
    border-color: var(--_invalid);
    font-weight: 600;
}
.zest-push-button.danger:hover {
    background: color-mix(in srgb, var(--_invalid) 10%, var(--_window));
}
.zest-push-button.flat {
    background: none;
    border-color: transparent;
}
.zest-push-button.flat:hover {
    background: var(--_hover-face);
    border-color: var(--_border);
}
/* Pressed is not shown by color only: the border is thicker and the text is bold */
.zest-push-button[aria-pressed="true"] {
    background: color-mix(in srgb, var(--_highlight) 22%, var(--_window));
    color: var(--_window-text);
    border-color: var(--_highlight);
    box-shadow: inset 0 0 0 1px var(--_highlight);
    font-weight: 700;
}
.zest-push-button:disabled {
    background: var(--_face);
    color: var(--_disabled-text);
    border-style: dashed;
    border-color: var(--_disabled-text);
    cursor: default;
}
.zest-push-button .icon {
    display: inline-flex;
    flex: none;
}
.zest-push-button .icon img {
    width: 1.25em;
    height: 1.25em;
}
.zest-push-button .icon:empty, .zest-push-button .text:empty {
    display: none;
}
@media (forced-colors: active) {
    .zest-push-button {
        border-color: ButtonText;
    }
    .zest-push-button[aria-pressed="true"] {
        background: Highlight;
        color: HighlightText;
        forced-color-adjust: none;
    }
    .zest-push-button:disabled {
        color: GrayText;
        border-color: GrayText;
    }
}
`;

// A button. With `toggle`, it stays pressed until the user selects it again.
// type="submit" or type="reset" acts on its form, also from a shadow root.
export class PushButton extends FormControl {
    static styles = styles;
    static properties = {
        variant: {type: String, default: 'default', reflect: true},
        toggle: {type: Boolean},
        pressed: {type: Boolean, reflect: true},
        type: {type: String, default: 'button'},
        icon: {type: String, default: ''},
    };
    button;
    #icon;
    #text;

    get focusTarget() { return this.button; }

    build() {
        this.button = document.createElement('button');
        this.button.type = 'button';
        this.button.className = 'zest-push-button';
        this.button.part = 'button';
        this.#icon = Object.assign(document.createElement('span'), {className: 'icon'});
        this.#icon.setAttribute('aria-hidden', 'true');
        this.#text = Object.assign(document.createElement('span'), {className: 'text'});
        this.#hasContent = this.takeContent(this.#text);
        this.button.append(this.#icon, this.#text);
        this.button.addEventListener('click', (e) => this.#activate(e));
        this.root.append(this.button);
    }
    #hasContent = false;

    update() {
        const variant = VARIANTS.includes(this.variant) ? this.variant : 'default';
        this.button.className = `zest-push-button ${variant}`;
        this.button.disabled = this.isDisabled;
        if (this.toggle) {
            this.button.setAttribute('aria-pressed', String(this.pressed));
        } else {
            this.button.removeAttribute('aria-pressed');
        }
        if (!this.#hasContent) { this.#text.textContent = this.label; }
        if (this.#icon.dataset.source !== this.icon) {
            this.#icon.dataset.source = this.icon;
            this.#icon.replaceChildren();
            if (/[/.]/.test(this.icon)) {
                this.#icon.append(Object.assign(document.createElement('img'), {src: this.icon, alt: ''}));
            } else if (this.icon) {
                this.#icon.textContent = this.icon;
            }
        }
        // With no text, the label attribute names the button
        if (this.#hasContent || !this.label) {
            this.button.removeAttribute('aria-label');
        } else if (!this.#text.textContent) {
            this.button.setAttribute('aria-label', this.label);
        }
    }

    // Selects the button from code, as a click does
    click() {
        if (this.button && !this.isDisabled) { this.button.click(); } else if (!this.button) { super.click(); }
    }

    #activate(e) {
        if (this.isDisabled) { return; }
        if (this.toggle) {
            this.pressed = !this.pressed;
            this.update();
            this.fire('input');
            this.fire('change');
        }
        if (this.type === 'submit') {
            this.form?.requestSubmit();
        } else if (this.type === 'reset') {
            this.form?.reset();
        }
    }
}

export class ShadowPushButton extends PushButton {
    constructor() {
        super();
        this.shadow = this.attachShadow({mode: 'open', delegatesFocus: true});
        this.root = this.shadow;
    }
}
