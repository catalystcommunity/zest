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
});
