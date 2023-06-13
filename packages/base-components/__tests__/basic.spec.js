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

class TestDataComponent extends DataComponent {
    someData;
    constructor() {
        super();
        this.registryName = "zestTestDataRegistry"
        this.dataRegisterFuncName = "datacompfunc"
        this.registerData = "myRegisterData"
    }
    connectedCallback(){
        super.connectedCallback();
        this.doDataRegistration(this.instanceId, this.registerData)
        this.render()
    }
    postDataRegistration() {
        this.unregisterData = this.registerResult.somedata
    }
    render() {
        this.innerHTML = this.template
    }
}

describe('DataComponent', () => {
    let myThing = "foo"
    function thedatacompunregisterfunc (someId, newData) {
        if (someId != "alwaysdata") {
            expect(newData).toEqual("unregisterData")
        } else {
            expect(newData).toEqual("unregisterData2")
        }
        myThing = "baz"
    }

    beforeAll(() => {
        function thedatacompfunc (theId, registerData) {
            expect(registerData).toEqual("myRegisterData")
            myThing = "bar"
            return {
                unregisterFunc: thedatacompunregisterfunc,
                somedata: "unregisterData"
            }
        }
        function thedatacompfunc2 (theId, registerData) {
            expect(registerData).toEqual("myRegisterData2")
            myThing = "bar2"
            return {
                unregisterFunc: thedatacompunregisterfunc,
                somedata: "unregisterData2"
            }
        }
        global.zestTestDataRegistry = {datacompfunc: thedatacompfunc}
        global.differentRegistry = {customFunc: thedatacompfunc2}
        customElements.define( 'data-component', TestDataComponent );
    });
    beforeEach(() => {
        myThing = "foo"
        document.documentElement.innerHTML = html.toString();
    });

    it("should initialize correctly", () => {
        const base = new TestDataComponent();
        expect(base).toBeInstanceOf(DataComponent);
        expect(base).toBeInstanceOf(TestDataComponent);
    });

    it("should have a paragraph with the right ID on an object with the right data", () => {
        const base = new TestDataComponent();
        base.connectedCallback() // We have to call this because we're not actually in the dom
        expect(myThing).toEqual("bar");
        base.innerHTML = base.template
        const nameP = base.querySelector('#testParagraphId')
        expect(nameP).not.toBeNull();
        expect(nameP).not.toBeUndefined();
        expect(base.registryName).toEqual("zestTestDataRegistry");
        expect(base.dataRegisterFuncName).toEqual("datacompfunc");
        expect(base.registerData).toEqual("myRegisterData");
        expect(nameP.innerHTML).toEqual('Test Template');
    });

    it("should have the right overridden template with overidden data results", () => {
        const base = document.getElementById('testDataOverridesComp');
        const nameP = base.querySelector('#testdataParagraphId');
        expect(nameP).not.toBeNull();
        expect(nameP).not.toBeUndefined();
        expect(nameP.innerHTML).toEqual('Data Test Template');
        expect(base.registryName).toEqual("differentRegistry");
        expect(base.dataRegisterFuncName).toEqual("customFunc");
        expect(base.registerData).toEqual("myRegisterData2");
        expect(base.unregisterData).toEqual("unregisterData2");
    });
});
