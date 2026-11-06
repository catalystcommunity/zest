import { tokenAliases } from "@catalystcommunity/base-components";
import { ShadowContainer, focusRing, smallButton } from "./shared.js";

// A frame with a title around related content. The title can be a check box that turns the
// content on and off, and a button that shows and hides the content.
export class GroupBox extends ShadowContainer {
    static properties = {
        label: {type: String, default: ''},
        collapsible: {type: Boolean},
        collapsed: {type: Boolean, reflect: true},
        checkable: {type: Boolean},
        checked: {type: Boolean, reflect: true},
    };
    static shadowHtml = `
<fieldset part="frame">
  <legend part="title">
    <label class="check"><input type="checkbox"><span class="check-text"></span></label>
    <span class="plain"></span>
    <button type="button" class="toggle" aria-expanded="true"><span class="chevron" aria-hidden="true"></span><span class="toggle-text"></span></button>
  </legend>
  <div class="content" part="content"><slot></slot></div>
</fieldset>`;
    static styles = `
:host {
    display: block;
    min-width: 0;
}
:host([hidden]) {
    display: none;
}
fieldset {
    ${tokenAliases('group-box')}
    box-sizing: border-box;
    min-inline-size: 0;
    margin: 0;
    padding: 0 var(--_gap) var(--_gap);
    border: var(--_border-width) solid var(--_line);
    border-radius: var(--_radius);
}
legend {
    display: flex;
    align-items: center;
    gap: 0.25em;
    max-width: 100%;
    padding: 0 0.25em;
    font-weight: bold;
}
legend [hidden] {
    display: none !important;
}
.check {
    display: inline-flex;
    align-items: center;
    gap: 0.375em;
    min-height: 24px;
    cursor: pointer;
}
.check input {
    width: 1.125em;
    height: 1.125em;
    min-width: 18px;
    min-height: 18px;
    margin: 0;
    accent-color: var(--_highlight);
}
${smallButton('.toggle')}
.toggle {
    gap: 0.375em;
    font-weight: inherit;
}
.chevron::before {
    content: "▾";
}
:host([collapsed]) .chevron::before {
    content: "▸";
}
.content[hidden] {
    display: none;
}
.content.off {
    opacity: 0.6;
}
${focusRing}
`;

    built() {
        this.part('.check input').addEventListener('change', (e) => {
            this.checked = e.target.checked;
            // Not 'change': the change events of the fields in the group also reach the group
            this.emit('group-box-check', {checked: this.checked});
        });
        this.part('.toggle').addEventListener('click', () => {
            this.collapsed = !this.collapsed;
            this.emit('group-box-toggle', {collapsed: this.collapsed});
        });
    }

    render() {
        const check = this.part('.check');
        const plain = this.part('.plain');
        const toggle = this.part('.toggle');
        const content = this.part('.content');
        check.hidden = !this.checkable;
        plain.hidden = this.checkable || this.collapsible;
        toggle.hidden = !this.collapsible;
        this.part('.check-text').textContent = this.label;
        plain.textContent = this.label;
        // With a check box, the check box has the words, and the button has only a name
        this.part('.toggle-text').textContent = this.checkable ? '' : this.label;
        if (this.checkable) { toggle.setAttribute('aria-label', this.label); } else { toggle.removeAttribute('aria-label'); }
        toggle.setAttribute('aria-expanded', String(!this.collapsed));
        this.part('.check input').checked = this.checked;
        content.hidden = this.collapsible && this.collapsed;
        const off = this.checkable && !this.checked;
        content.inert = off;
        content.classList.toggle('off', off);
    }
}
