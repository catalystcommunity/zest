import { BaseComponent } from "@catalystcommunity/base-components";

const defaultStyles = `
menu-gutter, :host {
    display: flex;
    margin: auto 0;
    width: 100%;
    justify-content: space-evenly;
    align-items: center;
    gap: var(--zest-gap-related, 0.5em);
}
`

export default class MenuGutter extends BaseComponent {
    static styles = defaultStyles;

    constructor(){
        super()
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
        this.applyStyles();
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