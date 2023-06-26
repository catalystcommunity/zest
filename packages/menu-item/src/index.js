import { BaseComponent } from "@catalystsquad/base-components";

export default class MenuItem extends BaseComponent {
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
            img.setAttribute('alt',  'Icon for ' + this.display);
            coreNode.appendChild(img);
        }
        let textSpan = document.createElement('span');
        textSpan.setAttribute('class', 'display');
        textSpan.innerHTML = this.display;
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