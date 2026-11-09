import { OpenShadowComponent } from "@catalystcommunity/base-components";

// Each container holds the children of the application in a shadow root, with slots. The shadow
// root is built one time, when the element first connects. After that, render() changes only the
// parts that changed, so that the focus and the scroll position stay.

let counter = 0;
export function uid(prefix) {
    counter += 1;
    return `${prefix}-${counter}`;
}

// The element that has the focus, also inside shadow roots
export function deepActiveElement() {
    let active = document.activeElement;
    while (active?.shadowRoot?.activeElement) { active = active.shadowRoot.activeElement; }
    return active;
}

export const clamp = (value, low, high) => Math.min(Math.max(value, low), Math.max(low, high));

export const focusRing = `
:focus-visible {
    outline: var(--_focus-width) solid var(--_focus);
    outline-offset: calc(var(--_focus-width) * -1);
}
`;

// A small button of the component, such as a close button. It is 24 by 24 CSS pixels or more.
export const smallButton = (selector) => `
${selector} {
    box-sizing: border-box;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 24px;
    min-height: 24px;
    margin: 0;
    padding: 0 0.25em;
    font: inherit;
    line-height: 1;
    color: inherit;
    background: none;
    border: var(--_border-width) solid transparent;
    border-radius: var(--_radius);
    cursor: pointer;
}
${selector}:hover {
    background: var(--_hover-face);
    border-color: var(--_border);
}
`;

export class ShadowContainer extends OpenShadowComponent {
    // The HTML of the shadow root. A child class declares it as a static field.
    static shadowHtml = '<slot></slot>';
    #built = false;

    connectedCallback() {
        super.connectedCallback();
        if (!this.#built) {
            this.#built = true;
            this.root.innerHTML = this.constructor.shadowHtml;
            this.applyStyles();
            this.built();
        }
        this.connected();
        this.render();
    }
    // Called one time, after the shadow root is built. Add listeners to its parts here.
    built() { }
    // Called on each connect. Add listeners to things outside the element here, with own() and listen().
    connected() { }
    shadowPart(selector) {
        return this.root.querySelector(selector);
    }
    // The text of a label, from the labels property, or the default of the class
    text(name) {
        return this.labels?.[name] ?? this.constructor.labels?.[name] ?? name;
    }
}
