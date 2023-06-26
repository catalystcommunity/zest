import { BaseComponent } from "@catalystsquad/base-components";

class MenuGutter extends BaseComponent {
    constructor(){
        super()
    }
    connectedCallback(){
        super.connectedCallback();
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