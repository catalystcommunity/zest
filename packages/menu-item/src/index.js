import { BaseComponent, OpenShadowComponent } from "@catalystsquad/base-components";

export default class MenuItem extends BaseComponent {
    constructor(){
        super()
    }
}

export class ShadowMenuItem extends MenuItem {
    shadow;
    constructor() {
        super();
    }
    connectedCallback(){
        super.connectedCallback();
        this.shadow = this.attachShadow({ mode: 'open' });
    }
}