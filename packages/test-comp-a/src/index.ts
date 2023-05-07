// Give us some of the basic functionality to reduce boilerplate
class BaseComponent extends HTMLElement {
  changeAttributes: string[];
  componentTemplate: string | undefined;
  styleTemplate: string | undefined;

  constructor() {
    super();
    this.changeAttributes = [];
  }
  get observedAttributes() {
    return this.changeAttributes;
  }
  attributeChangedCallback(property:string, oldValue:string, newValue:string) {
    if (oldValue === newValue) return;
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    this[property] = newValue;
    this.postAttributeChange();
  }
  postAttributeChange() {}
  connectedCallback() {
    this.render()
  }
  render() {
  }
}

class OpenShadowComponent extends BaseComponent {
  shadow: ShadowRoot;
  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
  }
}

export default class TestCompA extends OpenShadowComponent {
}

customElements.define( 'test-comp-a', TestCompA );
