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
    <label class="zest-check"><input type="checkbox"><span class="zest-check-text"></span></label>
    <span class="zest-plain"></span>
    <button type="button" class="zest-toggle" aria-expanded="true"><span class="zest-chevron" aria-hidden="true"></span><span class="zest-toggle-text"></span></button>
  </legend>
  <div class="zest-content" part="content"><slot></slot></div>
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
.zest-check {
    display: inline-flex;
    align-items: center;
    gap: 0.375em;
    min-height: 24px;
    cursor: pointer;
}
.zest-check input {
    width: 1.125em;
    height: 1.125em;
    min-width: 18px;
    min-height: 18px;
    margin: 0;
    accent-color: var(--_highlight);
}
${smallButton('.zest-toggle')}
.zest-toggle {
    gap: 0.375em;
    font-weight: inherit;
}
.zest-chevron::before {
    content: "▾";
}
:host([collapsed]) .zest-chevron::before {
    content: "▸";
}
.zest-content[hidden] {
    display: none;
}
.zest-content.zest-off {
    opacity: 0.6;
}
${focusRing}
`;

    built() {
        this.shadowPart('.zest-check input').addEventListener('change', (e) => {
            this.checked = e.target.checked;
            // Not 'change': the change events of the fields in the group also reach the group
            this.emit('group-box-check', {checked: this.checked});
        });
        this.shadowPart('.zest-toggle').addEventListener('click', () => {
            this.collapsed = !this.collapsed;
            this.emit('group-box-toggle', {collapsed: this.collapsed});
        });
    }

    render() {
        const check = this.shadowPart('.zest-check');
        const plain = this.shadowPart('.zest-plain');
        const toggle = this.shadowPart('.zest-toggle');
        const content = this.shadowPart('.zest-content');
        check.hidden = !this.checkable;
        plain.hidden = this.checkable || this.collapsible;
        toggle.hidden = !this.collapsible;
        this.shadowPart('.zest-check-text').textContent = this.label;
        plain.textContent = this.label;
        // With a check box, the check box has the words, and the button has only a name
        this.shadowPart('.zest-toggle-text').textContent = this.checkable ? '' : this.label;
        if (this.checkable) { toggle.setAttribute('aria-label', this.label); } else { toggle.removeAttribute('aria-label'); }
        toggle.setAttribute('aria-expanded', String(!this.collapsed));
        this.shadowPart('.zest-check input').checked = this.checked;
        content.hidden = this.collapsible && this.collapsed;
        const off = this.checkable && !this.checked;
        content.inert = off;
        content.classList.toggle('zest-off', off);
    }
}
