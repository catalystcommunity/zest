import { BaseComponent, OpenShadowComponent } from "@catalystsquad/base-components";

export default class MenuLogo extends BaseComponent {
    constructor(){
        super()
    }
}

export class ShadowMenuLogo extends MenuLogo {
    shadow;
    constructor() {
        super();
    }
    connectedCallback(){
        super.connectedCallback();
        this.shadow = this.attachShadow({ mode: 'open' });
    }
}