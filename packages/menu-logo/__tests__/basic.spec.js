import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import {readFileSync} from 'fs';
import {resolve} from 'path';
import {MenuLogo} from '../src';

const html = readFileSync(resolve(__dirname, './basic.html'), 'utf8');

describe('MenuLogo', () => {
    beforeAll(() => {
        customElements.define('menu-logo', MenuLogo );
    });
    beforeEach(() => {
        document.documentElement.innerHTML = html.toString();
    });

    it("should initialize correctly", () => {
        const comp = new MenuLogo();
        expect(comp).toBeInstanceOf(MenuLogo);
    });

    it("should have an anchor with a span inside", () => {
        const comp = new MenuLogo();
        comp.href = "/notreal";
        comp.logoText = "fake";
        comp.connectedCallback(); // We have to call this because we're not actually in the dom
        const link = comp.firstChild;
        expect(link).toBeInstanceOf(HTMLAnchorElement);
        expect(link.href).toMatch(/\/notreal$/);
        const display = link.firstChild;
        expect(display).toBeInstanceOf(HTMLSpanElement);
        expect(display.innerHTML).toEqual('fake');
    });

    it("should have an anchor with an image inside", () => {
        const comp = document.getElementById('item1');
        const link = comp.firstChild;
        expect(link).toBeInstanceOf(HTMLAnchorElement);
        expect(link.href).toMatch(/\/toFoo$/);
        const img = link.querySelector("img");
        expect(img).toBeInstanceOf(HTMLImageElement);
        expect(img.src).toMatch(/\/foo.png$/);
        expect(img.alt).toEqual('Logo image')
        const display = link.querySelector("span");
        expect(display).toBeInstanceOf(HTMLSpanElement);
        expect(display.innerHTML).toEqual('Item 1');
    });

    it("should have no anchor, just an img and a span", () => {
        const comp = document.getElementById('item2');
        const img = comp.querySelector("img");
        expect(img).toBeInstanceOf(HTMLImageElement);
        expect(img.src).toMatch(/\/bar.png$/);
        expect(img.alt).toEqual('nongenerated')
        const display = comp.querySelector("span");
        expect(display).toBeInstanceOf(HTMLSpanElement);
        expect(display.innerHTML).toEqual('Item 2');
    });
});
