import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import {readFileSync} from 'fs';
import {resolve} from 'path';
import {MenuGutter} from '../src';

const html = readFileSync(resolve(__dirname, './basic.html'), 'utf8');

describe('MenuGutter', () => {
    beforeAll(() => {
        customElements.define('menu-gutter', MenuGutter );
    });
    beforeEach(() => {
        document.documentElement.innerHTML = html.toString();
    });

    it("should initialize correctly", () => {
        const comp = new MenuGutter();
        expect(comp).toBeInstanceOf(MenuGutter);
    });
});
