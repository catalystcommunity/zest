import { tokenAliases } from "@catalystcommunity/base-components";
import { ShadowContainer } from "./shared.js";

// A region that scrolls. It is in the tab order, so that a keyboard user can scroll it. The
// header and footer slots stay in place while the content scrolls.
export class ScrollArea extends ShadowContainer {
    static properties = {
        label: {type: String, default: ''},
    };
    static labels = {region: 'Scrolling content'};
    static shadowHtml = `
<div class="area" part="area">
  <slot name="header"></slot>
  <div class="viewport" part="viewport" role="region" tabindex="0"><slot></slot></div>
  <slot name="footer"></slot>
</div>`;
    static styles = `
:host {
    display: block;
    min-width: 0;
    min-height: 0;
}
:host([hidden]) {
    display: none;
}
.area {
    ${tokenAliases('scroll-area')}
    display: flex;
    flex-direction: column;
    height: 100%;
    max-height: var(--zest-scroll-area-max-height, none);
    min-height: 0;
    border: var(--_border-width) solid var(--_line);
    border-radius: var(--_radius);
    background: var(--_window);
    color: var(--_window-text);
}
.viewport {
    flex: 1;
    min-height: 0;
    overflow: auto;
    padding: var(--_gap);
    overscroll-behavior: contain;
}
.viewport:focus-visible {
    outline: var(--_focus-width) solid var(--_focus);
    outline-offset: calc(var(--_focus-width) * -1);
}
::slotted([slot="header"]), ::slotted([slot="footer"]) {
    flex: none;
    padding: var(--_gap);
    background: var(--_face);
    color: var(--_face-text);
}
::slotted([slot="header"]) {
    border-block-end: var(--_border-width) solid var(--_line);
}
::slotted([slot="footer"]) {
    border-block-start: var(--_border-width) solid var(--_line);
}
`;
    get viewport() {
        return this.part('.viewport');
    }
    render() {
        this.part('.viewport').setAttribute('aria-label', this.label || this.text('region'));
    }
}

// A bar of status panes at the bottom of a window
export class StatusBar extends ShadowContainer {
    static properties = {
        label: {type: String, default: ''},
    };
    static labels = {bar: 'Status'};
    static shadowHtml = `<div class="bar" part="bar" role="group"><slot></slot></div>`;
    static styles = `
:host {
    display: block;
    min-width: 0;
}
:host([hidden]) {
    display: none;
}
.bar {
    ${tokenAliases('status-bar')}
    display: flex;
    flex-wrap: wrap;
    align-items: stretch;
    min-height: 1.75em;
    background: var(--_face);
    color: var(--_face-text);
    border-block-start: var(--_border-width) solid var(--_line);
    font-size: 0.875em;
}
`;
    render() {
        this.part('.bar').setAttribute('aria-label', this.label || this.text('bar'));
    }
}

// One pane of a status bar. `live` makes it a status region, so that a screen reader tells each change.
export class StatusPane extends ShadowContainer {
    static properties = {
        width: {type: String, default: ''},
        stretch: {type: Boolean, reflect: true},
        live: {type: Boolean},
    };
    static styles = `
:host {
    box-sizing: border-box;
    display: flex;
    align-items: center;
    gap: 0.25em;
    flex: 0 1 var(--_status-width, auto);
    min-width: 0;
    padding: 0.125em 0.75em;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    border-inline-end: var(--zest-border-width, 1px) solid color-mix(in srgb, var(--zest-color-border, GrayText) 45%, transparent);
}
:host(:last-child) {
    border-inline-end: none;
}
:host([stretch]) {
    flex: 1 1 0;
}
:host([hidden]) {
    display: none;
}
`;
    render() {
        if (this.width) { this.style.setProperty('--_status-width', this.width); } else { this.style.removeProperty('--_status-width'); }
        if (this.live) { this.setAttribute('role', 'status'); } else if (this.getAttribute('role') === 'status') { this.removeAttribute('role'); }
    }
}

// Labels and fields in two columns. When the layout is narrow, it uses one column. A child with
// `span` uses both columns.
export class FormLayout extends ShadowContainer {
    static properties = {
        narrow: {type: String, default: ''},
    };
    static shadowHtml = `<div class="outer"><div class="grid" part="grid"><slot></slot></div></div>`;
    static styles = `
:host {
    display: block;
    min-width: 0;
}
:host([hidden]) {
    display: none;
}
.outer {
    ${tokenAliases('form-layout')}
    container-type: inline-size;
}
.grid {
    display: grid;
    grid-template-columns: minmax(max-content, 12em) minmax(0, 1fr);
    gap: var(--_gap) var(--_gap-unrelated);
    align-items: center;
}
::slotted(label), ::slotted([data-label]) {
    justify-self: end;
    text-align: end;
}
::slotted([span]) {
    grid-column: 1 / -1;
}
@container (max-width: 30em) {
    .grid {
        grid-template-columns: minmax(0, 1fr);
        gap: 0.25em;
    }
    ::slotted(label), ::slotted([data-label]) {
        justify-self: start;
        text-align: start;
        margin-block-start: var(--_gap);
    }
}
`;
    render() { }
}

const GAPS = {none: '0', related: 'var(--zest-gap-related, 0.5em)', unrelated: 'var(--zest-gap-unrelated, 1.5em)'};

// A row or a column of children, as the horizontal and vertical boxes of a GUI toolkit. A child with
// `stretch` takes the space that is left.
export class BoxLayout extends ShadowContainer {
    static properties = {
        direction: {type: String, default: 'row'},
        gap: {type: String, default: 'related'},
        align: {type: String, default: ''},
        justify: {type: String, default: ''},
        wrap: {type: Boolean},
    };
    static styles = `
:host {
    display: flex;
    flex-direction: row;
    gap: var(--_box-gap, var(--zest-gap-related, 0.5em));
    min-width: 0;
}
:host([direction="column"]) {
    flex-direction: column;
}
:host([wrap]) {
    flex-wrap: wrap;
}
:host([hidden]) {
    display: none;
}
::slotted([stretch]) {
    flex: 1 1 0;
    min-width: 0;
    min-height: 0;
}
`;
    render() {
        const gap = GAPS[this.gap] ?? this.gap;
        this.style.setProperty('--_box-gap', gap);
        this.style.alignItems = this.align || '';
        this.style.justifyContent = this.justify || '';
    }
}
