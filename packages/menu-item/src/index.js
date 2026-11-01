import { BaseComponent } from "@catalystcommunity/base-components";

// An image must not make the item wider than its parent
const defaultStyles = `
menu-item img, :host img {
    max-width: 100%;
    height: auto;
}
`;

export default class MenuItem extends BaseComponent {
    static styles = defaultStyles;
    static changeAttributes = ['href', 'display', 'icon'];
    href;
    display;
    icon;

    constructor(){
        super()
        this.href = null;
        this.display = null;
        this.icon = null;
    }
    postObservedAttributeChange() {
        if (this.isConnected) { this.render(); }
    }
    connectedCallback(){
        super.connectedCallback();
        this.convertKebabAttributes(['href', 'display', 'icon']);
        this.render();
    }
    render(){
        this.root.innerHTML = "";
        let coreNode = this.root;
        if (this.href) {
            let target = document.createElement('a');
            target.setAttribute('href', this.href);
            coreNode.appendChild(target);
            coreNode = target;
        }
        if (this.icon) {
            let img = document.createElement('img');
            img.setAttribute('src', this.icon);
            // The text says what the item is, so a screen reader must not read the icon too
            img.setAttribute('alt', this.display ? '' : 'Icon');
            coreNode.appendChild(img);
        }
        let textSpan = document.createElement('span');
        textSpan.setAttribute('class', 'display');
        textSpan.textContent = this.display;
        coreNode.appendChild(textSpan);
        this.applyStyles();
    }
}

class ShadowMenuItem extends MenuItem {
    shadow;
    constructor() {
        super();
        this.shadow = this.attachShadow({ mode: 'open' });
        this.root = this.shadow;
    }
}
export { MenuItem, ShadowMenuItem }