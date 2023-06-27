import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import {readFileSync} from 'fs';
import {resolve} from 'path';
import {TwoTierMenu} from '../src';

const html = readFileSync(resolve(__dirname, './basic.html'), 'utf8');

describe('TwoTierMenu', () => {
    let myThing = "foo"
    function thedatacompunregisterfunc (someId, newData) {
        expect(newData).toBeUndefined();
        if (someId == "itemid3") {
            myThing = "baz";
        }
    }

    beforeAll(() => {
        function thedatacompfunc (theId, registerData) {
            expect(theId).toMatch(/itemid[123]/);
            if(theId == "itemid3") {
                myThing = "bar"
            }
            let menu = {
                unregisterFunc: thedatacompunregisterfunc,
                menuConfig: {
                  logo: {img: 'myLogo.png'},
                  sections: [
                    {
                      display: "Home Section",
                      icon: "foo.gif",
                      link: "/home",
                      items: [
                        {display: "Home Again", link: "/home/again"},
                        {display: "Item 2", icon: "icons8-open-source-150.png"},
                        {display: "Item 3"}
                      ]
                    },
                    {
                      display: "Second Section",
                      items: [
                        {display: "Item 1", icon: "icons8-open-source-150.png"}
                      ]
                    }
                  ],
                  gutter: {}
                }
            }
            if (theId == 'itemid2') {
                menu.menuConfig.sections = [{
                    display: "Second Section",
                    items: [
                      {display: "Item 1", icon: "icons8-open-source-150.png"}
                    ]
                  }
                ];
            }
            return menu
        }
        global.zestTestDataRegistry = {datacompfunc: thedatacompfunc}
        customElements.define('two-tier-menu', TwoTierMenu );
    });
    beforeEach(() => {
        myThing = "foo";
        document.documentElement.innerHTML = html.toString();
    });

    it("should initialize correctly with the proper lifecycle", () => {
        const comp = new TwoTierMenu();
        comp.id='item3';
        comp.instanceId='itemid3';
        comp.registryName = "zestTestDataRegistry";
        comp.dataRegisterFuncName = "datacompfunc";
        expect(myThing).toEqual('foo');
        comp.connectedCallback(); // We have to call this because we're not actually in the dom
        expect(myThing).toEqual('bar');
        expect(comp).toBeInstanceOf(TwoTierMenu);
        comp.disconnectedCallback(); // Simulate removing it from the dom
        expect(myThing).toEqual('baz');
    });

    it("should initialize correctly with a logo, menu items, and a gutter", () => {
        const comp = document.getElementById('item1');
        expect(myThing).toEqual('foo');
        const link = comp.firstChild;
        expect(link.tagName).toEqual('MENU-LOGO');
        const items = comp.querySelector("div");
        expect(items).toBeInstanceOf(HTMLDivElement);
        expect(items.getAttribute("class")).toMatch(/items/);
        expect(items.childNodes.length).toEqual(6);
        const gutter = comp.querySelector("menu-gutter");
        expect(gutter.tagName).toEqual('MENU-GUTTER');
        const display = link.querySelector("span");
        expect(myThing).toEqual('foo'); // This path should not modify myThing
    });

    it("should initialize correctly with a logo, menu items, and a gutter", () => {
        const comp = document.getElementById('item2');
        expect(myThing).toEqual('foo');
        const link = comp.firstChild;
        expect(link.tagName).toEqual('MENU-LOGO');
        const items = comp.querySelector("div");
        expect(items).toBeInstanceOf(HTMLDivElement);
        expect(items.getAttribute("class")).toMatch(/items/);
        expect(items.childNodes.length).toEqual(2);
        const gutter = comp.querySelector("menu-gutter");
        expect(gutter.tagName).toEqual('MENU-GUTTER');
        const display = link.querySelector("span");
        expect(myThing).toEqual('foo'); // This path should not modify myThing
    });
});
