declare class BaseComponent extends HTMLElement {
    changeAttributes: string[];
    componentTemplate: string | undefined;
    styleTemplate: string | undefined;
    constructor();
    get observedAttributes(): string[];
    attributeChangedCallback(property: string, oldValue: string, newValue: string): void;
    postAttributeChange(): void;
    connectedCallback(): void;
    render(): void;
}
declare class OpenShadowComponent extends BaseComponent {
    shadow: ShadowRoot;
    constructor();
}
export default class TestCompA extends OpenShadowComponent {
}
export {};
