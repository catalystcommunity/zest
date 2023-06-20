import { DataComponent } from "@catalystsquad/base-components";

export default class TwoTierSectionMenu extends DataComponent {
    constructor(){
        super()
    }
    connectedCallback(){
        super.connectedCallback();
        this.doDataRegistration()
    }
    postDataRegistration(){
        console.log("I am here")
        console.log(this.registerResult)
    }
}

export class ShadowTwoTierSectionMenu extends TwoTierSectionMenu {
    shadow;
    constructor() {
        super();
    }
    connectedCallback(){
        super.connectedCallback();
        this.shadow = this.attachShadow({ mode: 'open' });
    }
}
