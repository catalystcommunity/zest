import { tokenAliases } from "@catalystcommunity/base-components";
import { ShadowContainer, focusRing, uid } from "./shared.js";

// One section of an accordion: a heading with a button, and content that shows when it is open
export class AccordionSection extends ShadowContainer {
    static properties = {
        label: {type: String, default: ''},
        open: {type: Boolean, reflect: true},
        level: {type: Number, default: 3},
        disabled: {type: Boolean, reflect: true},
    };
    static shadowHtml = `
<div class="section" part="section">
  <div role="heading" class="heading"><button type="button" part="header" aria-expanded="false"><span class="chevron" aria-hidden="true"></span><span class="label"></span></button></div>
  <div role="region" class="content" part="content" hidden><slot></slot></div>
</div>`;
    static styles = `
:host {
    display: block;
    min-width: 0;
}
:host([hidden]) {
    display: none;
}
.section {
    ${tokenAliases('accordion-view')}
    border: var(--_border-width) solid var(--_line);
    border-radius: var(--_radius);
    background: var(--_window);
    color: var(--_window-text);
}
.heading {
    margin: 0;
}
button {
    box-sizing: border-box;
    display: flex;
    align-items: center;
    gap: var(--_gap);
    width: 100%;
    min-height: var(--_height);
    margin: 0;
    padding: var(--_padding-block) var(--_padding-inline);
    font: inherit;
    font-weight: bold;
    text-align: start;
    color: var(--_face-text);
    background-color: var(--_face);
    background-image: var(--_fill);
    border: none;
    border-radius: var(--_radius);
    cursor: pointer;
}
button:hover {
    background-image: none;
    background-color: var(--_hover-face);
}
button[aria-disabled="true"] {
    color: var(--_disabled-text);
    cursor: default;
}
.chevron::before {
    content: "▸";
}
:host([open]) .chevron::before {
    content: "▾";
}
:host(:dir(rtl)) .chevron::before {
    content: "◂";
}
:host([open]:dir(rtl)) .chevron::before {
    content: "▾";
}
.content {
    padding: var(--_gap) var(--_padding-inline);
}
.content[hidden] {
    display: none;
}
${focusRing}
`;

    built() {
        const button = this.part('button');
        const region = this.part('.content');
        button.id = uid('accordion-header');
        region.id = uid('accordion-region');
        button.setAttribute('aria-controls', region.id);
        region.setAttribute('aria-labelledby', button.id);
        button.addEventListener('click', () => {
            if (this.disabled) { return; }
            this.open = !this.open;
            this.emit('accordion-section-toggle', {open: this.open});
        });
    }
    focusHeader() {
        this.part('button')?.focus();
    }
    render() {
        const button = this.part('button');
        this.part('.heading').setAttribute('aria-level', String(this.level || 3));
        this.part('.label').textContent = this.label;
        button.setAttribute('aria-expanded', String(this.open));
        if (this.disabled) { button.setAttribute('aria-disabled', 'true'); } else { button.removeAttribute('aria-disabled'); }
        this.part('.content').hidden = !this.open;
    }
}

// A list of accordion sections. Only one is open, unless `multiple` is set. The up and down arrows
// go between the headings.
export class AccordionView extends ShadowContainer {
    static properties = {
        multiple: {type: Boolean},
    };
    static styles = `
:host {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
}
:host([hidden]) {
    display: none;
}
`;

    get sections() {
        return [...this.children].filter(child => child instanceof AccordionSection);
    }

    built() {
        this.addEventListener('accordion-section-toggle', (e) => {
            const opened = e.composedPath()[0];
            if (this.multiple || !e.detail.open || !this.sections.includes(opened)) { return; }
            for (const section of this.sections) {
                if (section !== opened) { section.open = false; }
            }
        });
        this.addEventListener('keydown', (e) => {
            const sections = this.sections.filter(section => !section.hidden);
            const from = sections.findIndex(section => e.composedPath().includes(section.shadowRoot?.querySelector('button')));
            if (from < 0 || e.altKey || e.ctrlKey || e.metaKey) { return; }
            const target = {
                ArrowDown: sections[(from + 1) % sections.length],
                ArrowUp: sections[(from - 1 + sections.length) % sections.length],
                Home: sections[0],
                End: sections.at(-1),
            }[e.key];
            if (!target) { return; }
            e.preventDefault();
            target.focusHeader();
        });
    }
    render() { }
}
