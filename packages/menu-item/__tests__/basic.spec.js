import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import {readFileSync} from 'fs';
import {resolve} from 'path';
import {MenuItem} from '../src';

const html = readFileSync(resolve(__dirname, './basic.html'), 'utf8');

describe('MenuItem', () => {
    beforeAll(() => {
        customElements.define('menu-item', MenuItem );
    });
    beforeEach(() => {
        document.documentElement.innerHTML = html.toString();
    });

    it("should initialize correctly", () => {
        const comp = new MenuItem();
        expect(comp).toBeInstanceOf(MenuItem);
    });

    it("should have an anchor and a span", () => {
        const comp = new MenuItem();
        comp.href = "/notreal";
        comp.display = "fake";
        comp.connectedCallback(); // We have to call this because we're not actually in the dom
        const link = comp.firstChild;
        expect(link).toBeInstanceOf(HTMLAnchorElement);
        expect(link.href).toMatch(/\/notreal$/);
        const display = link.firstChild;
        expect(display).toBeInstanceOf(HTMLSpanElement);
        expect(display.innerHTML).toEqual('fake');
    });

    it("should have an anchor and an icon and a span", () => {
        const comp = document.getElementById('item1');
        const link = comp.firstChild;
        expect(link).toBeInstanceOf(HTMLAnchorElement);
        expect(link.href).toMatch(/\/toFoo$/);
        const img = link.querySelector("img");
        expect(img).toBeInstanceOf(HTMLImageElement);
        expect(img.src).toMatch(/\/foo.png$/);
        const display = link.querySelector("span");
        expect(display).toBeInstanceOf(HTMLSpanElement);
        expect(display.innerHTML).toEqual('Item 1');
    });

    it("should have an anchor and an icon and a span", () => {
        const comp = document.getElementById('item2');
        const img = comp.querySelector("img");
        expect(img).toBeInstanceOf(HTMLImageElement);
        expect(img.src).toMatch(/\/bar.png$/);
        const display = comp.querySelector("span");
        expect(display).toBeInstanceOf(HTMLSpanElement);
        expect(display.innerHTML).toEqual('Item 2');
    });
});
