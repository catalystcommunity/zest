import { BaseComponent, OpenShadowComponent } from "@catalystsquad/base-components";

export default class MenuSectionHeader extends BaseComponent {
    constructor(){
        super()
    }
}

export class ShadowMenuSectionHeader extends MenuSectionHeader {
    shadow;
    constructor() {
        super();
    }
    connectedCallback(){
        super.connectedCallback();
        this.shadow = this.attachShadow({ mode: 'open' });
    }
}