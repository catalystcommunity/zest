import { DataComponent } from "@catalystcommunity/base-components";

const defaultStyles = `
two-tier-menu, :host {
    --_face: var(--zest-two-tier-menu-face, var(--zest-menu-face, var(--zest-color-face, ButtonFace)));
    --_face-text: var(--zest-two-tier-menu-face-text, var(--zest-menu-face-text, var(--zest-color-face-text, ButtonText)));
    --_border: var(--zest-two-tier-menu-border, var(--zest-menu-border, var(--zest-color-border, ButtonBorder)));
    --_highlight: var(--zest-two-tier-menu-highlight, var(--zest-menu-highlight, var(--zest-color-highlight, Highlight)));
    --_hover-face: var(--zest-two-tier-menu-face-hover, var(--zest-menu-face-hover, color-mix(in srgb, var(--_highlight) 12%, transparent)));
    --_focus: var(--zest-two-tier-menu-focus, var(--zest-menu-focus, var(--zest-color-focus, Highlight)));
    --_focus-width: var(--zest-focus-width, 2px);
    --_height: var(--zest-two-tier-menu-item-height, var(--zest-menu-item-height, var(--zest-control-height, 2.5em)));
    --_gap: var(--zest-gap-related, 0.5em);
    --_padding: var(--zest-control-padding-inline, 1em);
    --_motion: var(--zest-motion-duration, 0ms);
    display: flex;
    flex-direction: column;
    justify-content: start;
    box-sizing: border-box;
    height: 100%;
    width: 15em;
    overflow-y: auto;
    border-inline-end: var(--zest-border-width, 1px) solid var(--_border);
    font-family: var(--zest-font-family, inherit);
    line-height: var(--zest-line-height, inherit);
    background: var(--_face);
    color: var(--_face-text);
}

two-tier-menu .items, :host .items {
    display: flex;
    flex-direction: column;
    justify-content: start;
    flex-grow: 3;
}

two-tier-menu menu-logo, :host menu-logo {
  display: block;
  flex: 0 0 auto;
  padding: var(--_gap) var(--_padding);
  font-size: 1.5em;
  font-weight: bold;
  text-align: center;
}
two-tier-menu menu-logo img, :host menu-logo img {
  width: 100%;
  margin: 0;
}
two-tier-menu menu-item, :host menu-item {
  display: block;
}
two-tier-menu menu-item > a, :host menu-item > a,
two-tier-menu menu-item:not(:has(> a)), :host menu-item:not(:has(> a)) {
  display: flex;
  align-items: center;
  gap: var(--_gap);
  box-sizing: border-box;
  min-height: var(--_height);
  padding-block: 0.25em;
  padding-inline: calc(var(--_padding) * 2) var(--_padding);
}
two-tier-menu menu-item.section-header, :host menu-item.section-header {
  margin-block-start: var(--_gap);
  font-weight: bold;
}
two-tier-menu menu-item.section-header > a, :host menu-item.section-header > a,
two-tier-menu menu-item.section-header:not(:has(> a)), :host menu-item.section-header:not(:has(> a)) {
  padding-inline-start: var(--_padding);
}
two-tier-menu menu-gutter, :host menu-gutter {
    flex: 0 0 auto;
    box-sizing: border-box;
    padding: var(--_gap) var(--_padding);
}
two-tier-menu img, :host img {
  flex: 0 0 auto;
  width: 1.25em;
  vertical-align: middle;
}
two-tier-menu a, :host a {
  color: inherit;
  text-decoration: none;
  transition: background-color var(--_motion);
}
two-tier-menu a:hover, :host a:hover {
  background-color: var(--_hover-face);
  text-decoration: underline;
}
two-tier-menu a:focus-visible, :host a:focus-visible {
  outline: var(--_focus-width) solid var(--_focus);
  outline-offset: calc(var(--_focus-width) * -1);
}
@media (forced-colors: active) {
  two-tier-menu a:focus-visible, :host a:focus-visible {
    outline-color: Highlight;
  }
}
`

export default class TwoTierMenu extends DataComponent {
    static styles = defaultStyles;
    menuConfig;
    gutter;

    constructor(){
        super()
        this.menuConfig = {};
        this.gutter = {}
    }
    connectedCallback(){
        super.connectedCallback();
        this.doDataRegistration()
    }
    postDataRegistration(){
        // The base class has already saved the unregisterFunc, if the result has one
        this.menuConfig = this.registerResult?.menuConfig || {};
        this.render()
    }
    // Attributes and not properties, because the element class sets its properties again when it
    // upgrades. That happens when menu-item is defined after this menu renders.
    setItemAttributes(element, item) {
        if (item.link) { element.setAttribute('href', item.link); }
        if (item.icon) { element.setAttribute('icon', item.icon); }
        if (item.display) { element.setAttribute('display', item.display); }
    }
    render() {
        this.root.innerHTML = "";
        if (this.menuConfig.logo) {
            let logo = this.menuConfig.logo;
            let menuLogo = document.createElement('menu-logo');
            menuLogo.setAttribute('alt', logo.alt || "Logo");
            if (logo.img) { menuLogo.setAttribute('logo', logo.img); }
            if (logo.text) {
                menuLogo.setAttribute('logo-text', logo.text);
            } else if (!logo.img) {
                menuLogo.setAttribute('logo-text', "Zest");
            }
            this.root.appendChild(menuLogo);
        }
        let itemContainer = document.createElement('nav');
        itemContainer.setAttribute("class", "items");
        itemContainer.setAttribute("aria-label", this.menuConfig.label || "Menu");
        this.root.appendChild(itemContainer);
        if(this.menuConfig.sections && Array.isArray(this.menuConfig.sections)){
            for (let i = 0; i < this.menuConfig.sections.length; i++) {
                let section = this.menuConfig.sections[i];
                let sectionHeader = document.createElement('menu-item');
                sectionHeader.setAttribute("class", "section-header");
                this.setItemAttributes(sectionHeader, section);
                itemContainer.appendChild(sectionHeader);
                if(section.items && Array.isArray(section.items)) {
                    for(let j = 0; j < section.items.length; j++ ) {
                        let item = section.items[j];
                        let menuItem = document.createElement('menu-item');
                        menuItem.setAttribute("class", "item");
                        this.setItemAttributes(menuItem, item);
                        itemContainer.appendChild(menuItem);
                        // This is where we could go one deeper, but that should really be a thing we refactor to a second function
                    }
                }
            }
        }
        if(this.menuConfig.gutter) {
            this.gutter = document.createElement('menu-gutter');
            // Only the behavior wanted is needed here
            if (this.menuConfig.gutter.overrideTemplateId) {
                this.gutter.setAttribute('override-template-id', this.menuConfig.gutter.overrideTemplateId);
            }
            if (this.menuConfig.gutter.overrideStyleTemplateId) {
                this.gutter.setAttribute('override-style-template-id', this.menuConfig.gutter.overrideStyleTemplateId);
            }
            this.root.appendChild(this.gutter);
        }
        this.applyStyles();
    }
}

class ShadowTwoTierMenu extends TwoTierMenu {
    shadow;
    constructor() {
        super();
        this.shadow = this.attachShadow({ mode: 'open' });
        this.root = this.shadow;
    }
    connectedCallback(){
        super.connectedCallback();
    }
}

export {TwoTierMenu, ShadowTwoTierMenu};