import { BaseComponent } from "@catalystsquad/base-components";

const defaultStyles = `<style>
menu-gutter, :host {
    display: flex;
    margin: auto 0;
    width: 100%;
    justify-content: space-evenly;
    align-items: center;
}
</style>`

export default class MenuGutter extends BaseComponent {
    constructor(){
        super()
        this.styleTemplate = defaultStyles;
        this.template = '';
    }
    connectedCallback(){
        super.connectedCallback();
        this.render();
    }
    render(){
        this.root.innerHTML = "";
        if (this.template) {
            this.root.appendChild(this.stringToElement(`${this.template}`));
        }
        if (this.styleTemplate) {
            this.root.appendChild(this.stringToElement(`${this.styleTemplate}`));
        }
    }
}

class ShadowMenuGutter extends MenuGutter {
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
export { MenuGutter, ShadowMenuGutter }