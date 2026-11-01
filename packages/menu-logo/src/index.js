import { BaseComponent } from "@catalystcommunity/base-components";

// An image must not make the logo wider than its parent
const defaultStyles = `
menu-logo img, :host img {
    max-width: 100%;
    height: auto;
}
`;

export default class MenuLogo extends BaseComponent {
    static styles = defaultStyles;
    static changeAttributes = ['logo', 'alt', 'logo-text', 'href'];
    logo;
    logoText;
    alt;
    href;

    constructor(){
        super()
        this.logo = null;
        this.logoText = null;
        this.alt = null;
        this.href = null;
    }
    postObservedAttributeChange() {
        if (this.isConnected) { this.render(); }
    }
    connectedCallback(){
        super.connectedCallback();
        this.convertKebabAttributes(['logo', 'alt', 'logo-text', 'href']);
        this.render()
    }
    render(){
        this.root.innerHTML = "";
        let coreNode = this.root;
        if (this.href) {
            let target = document.createElement('a');
            target.setAttribute('href',this.href);
            coreNode.appendChild(target);
            coreNode = target;
        }
        if (this.logo) {
            let img = document.createElement('img');
            img.src = this.logo;
            img.alt = this.alt ? this.alt : "Logo image";
            coreNode.appendChild(img);
        }
        if (this.logoText) {
            let textSpan = document.createElement('span');
            textSpan.className = "logoText";
            textSpan.textContent = this.logoText;
            coreNode.appendChild(textSpan);
        }
        this.applyStyles();
    }
}

class ShadowMenuLogo extends MenuLogo {
    shadow;
    constructor() {
        super();
        this.shadow = this.attachShadow({ mode: 'open' });
        this.root = this.shadow
    }
}

export { MenuLogo, ShadowMenuLogo }
