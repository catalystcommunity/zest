import { BaseComponent } from "@catalystcommunity/base-components";

export default class MenuItem extends BaseComponent {
    static changeAttributes = ['href', 'display', 'icon'];
    href;
    display;
    icon;

    constructor(){
        super()
        this.href = null;
        this.display = null;
        this.icon = null;
        this.styleTemplate = null;
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
            img.setAttribute('alt', this.display ? 'Icon for ' + this.display : 'Icon');
            coreNode.appendChild(img);
        }
        let textSpan = document.createElement('span');
        textSpan.setAttribute('class', 'display');
        textSpan.textContent = this.display;
        coreNode.appendChild(textSpan);
        if (this.styleTemplate) {
            this.root.appendChild(this.stringToElement(`${this.styleTemplate}`));
        }
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