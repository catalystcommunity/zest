import { DataComponent } from "@catalystcommunity/base-components";

const defaultStyles = `<style>
two-tier-menu, :host {
    display: flex;
    flex-direction: column;
    justify-content: start;
    box-sizing: border-box;
    height: 100%;
    width: 15em;
    overflow-y: auto;
    border-right: 1px solid #D7DBDD;
    font-family: sans-serif;
    background: #34495e;
    color: white;
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
  padding: 10px 20px;
  font-size: 2em;
  text-align: center;
}
two-tier-menu menu-logo img, :host menu-logo img {
  width: 100%;
  margin: 0;
}
two-tier-menu menu-item, :host menu-item {
  display: block;
  padding: 6px 20px 6px 36px;
}
two-tier-menu menu-item.section-header, :host menu-item.section-header {
  padding: 10px 20px;
  font-size: 1.2em;
}
two-tier-menu menu-gutter, :host menu-gutter {
    flex: 0 0 auto;
    box-sizing: border-box;
    padding: 10px;
    gap: 8px;
}
two-tier-menu img, :host img {
  width: 1.25em;
  margin-right: 0.25em;
  vertical-align: middle;
}
two-tier-menu a, :host a {
  color: inherit;
}
</style>`

export default class TwoTierMenu extends DataComponent {
    menuConfig;
    gutter;

    constructor(){
        super()
        this.menuConfig = {};
        this.gutter = {}
        this.styleTemplate = defaultStyles;
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
        let itemContainer = document.createElement('div');
        itemContainer.setAttribute("class", "items");
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
        if (this.styleTemplate) { 
            this.root.appendChild(this.stringToElement(`${this.styleTemplate}`));
        }
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