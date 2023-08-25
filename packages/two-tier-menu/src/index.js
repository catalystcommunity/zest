import { DataComponent } from "@catalystsquad/base-components";

const defaultStyles = `<style>
two-tier-menu, :host {
    display: flex;
    flex-direction: column;
    justify-content: start;
    height: 130vh;
    width: 15em;
    border-right: 1px solid #D7DBDD;
    font-family: sans-serif;
    background: #34495e;
    align-items: flex-end;
}

two-tier-menu .items, :host .items {
    flex-grow: 3;
}

two-tier-menu .items .section-header, :host .items .section-header {
    padding-left: 20px;
}

menu-logo {
  display: inline-block;
  padding: 10px 20px;
  color: white;
  font-size: 2em;
  margin: auto;
  flex-grow: 1;
}
.items {
    display: flex;
    flex-direction: column;
    justify-content: start;
}
menu-item {
  padding: 10px 20px;
  color: white;
  font-size: 20px;
}
menu-item.section-header {
  padding: 10px;
  width: 12em;
}
menu-item.section-header img {
  width: 2em;
}

menu-gutter {
    flex-grow: 1;
}
:host img {
  width: 2em;
}
</style>`

export default class TwoTierMenu extends DataComponent {
    menuconfig;
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
        this.unregisterFunc = this.registerResult.unregisterFunc;
        this.menuConfig = this.registerResult.menuConfig;
        this.render()
    }
    render() {
        this.root.innerHTML = "";
        if (this.menuConfig.logo) {
            if (!this.menuConfig.logo.alt){ this.menuConfig.logo.alt = "Logo"}
            if (!this.menuConfig.logo.img){ 
                console.log("logo img not set!");
                if (!this.menuConfig.logo.text){
                    console.log("neither are set in logo!");
                    this.menuConfig.logo.text = "Zest";
                }
            }
            let menuLogo = document.createElement('menu-logo');
            menuLogo.logo = this.menuConfig.logo.img;
            menuLogo.alt = this.menuConfig.logo.alt;
            menuLogo.logoText = this.menuConfig.logo.text;
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
                if (section.link) {sectionHeader.href = section.link;}
                if (section.icon) {sectionHeader.icon = section.icon;}
                if (section.display) {sectionHeader.display = section.display;}
                itemContainer.appendChild(sectionHeader);
                if(section.items && Array.isArray(section.items)) {
                    for(let j = 0; j < section.items.length; j++ ) {
                        let item = section.items[j];
                        let menuItem = document.createElement('menu-item');
                        menuItem.setAttribute("class", "item");
                        if (item.link) {menuItem.href = item.link;}
                        if (item.icon) {menuItem.icon = item.icon;}
                        if (item.display) {menuItem.display = item.display;}
                        itemContainer.appendChild(menuItem);
                        // This is where we could go one deeper, but that should really be a thing we refactor to a second function
                    }
                }
            }
        }
        if(this.menuConfig.gutter) {
            this.gutter = document.createElement('menu-gutter');
            // Only the behavior wanted is needed here
            this.gutter.overrideTemplateId = this.menuConfig.gutter.overrideTemplateId;
            this.gutter.overrideStyleTemplateId = this.menuConfig.gutter.overrideStyleTemplateId;
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