import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import {readFileSync} from 'fs';
import {resolve} from 'path';
import {BaseComponent, DataComponent, OpenShadowDataComponent} from '../src';

class TestBaseComponent extends BaseComponent {
    constructor() {
        super();
    }
    connectedCallback(){
        super.connectedCallback();
        this.render()
    }
    render() {
        this.innerHTML = this.template
    }
}
const html = readFileSync(resolve(__dirname, './basic.html'), 'utf8');

describe('BaseComponent', () => {
    beforeAll(() => {
        customElements.define( 'base-component', TestBaseComponent );
    });
    beforeEach(() => {
        document.documentElement.innerHTML = html.toString();
    });

    it("should initialize correctly", () => {
        const base = new TestBaseComponent();
        expect(base).toBeInstanceOf(BaseComponent);
        expect(base).toBeInstanceOf(TestBaseComponent);
    });

    it("should have a paragraph with the right ID", () => {
        const base = new TestBaseComponent();
        base.connectedCallback() // We have to call this because we're not actually in the dom
        base.innerHTML = base.template
        const nameP = base.querySelector('#testParagraphId')
        expect(nameP).not.toBeNull();
        expect(nameP).not.toBeUndefined();
        expect(nameP.innerHTML).toEqual('Test Template');
        // const style = window.getComputedStyle(base)
        // console.log(style)
        // expect(style.marginTop).toEqual('3em');
    });

    it("should have the right overridden template", () => {
        const base = document.getElementById('testOverridesComp');
        const nameP = base.querySelector('#testSecondParagraphId');
        expect(nameP).not.toBeNull();
        expect(nameP).not.toBeUndefined();
        expect(nameP.innerHTML).toEqual('Second Test Template');
    });
});
