import { BaseComponent, OpenShadowComponent } from "@catalystsquad/base-components";

export default class MenuGutter extends BaseComponent {
    constructor(){
        super()
    }
}

export class ShadowMenuGutter extends MenuGutter {
    shadow;
    constructor() {
        super();
    }
    connectedCallback(){
        super.connectedCallback();
        this.shadow = this.attachShadow({ mode: 'open' });
    }
}