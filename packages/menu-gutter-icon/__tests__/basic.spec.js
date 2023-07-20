import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import {readFileSync} from 'fs';
import {resolve} from 'path';
import {MenuGutterIcon} from '../src';

const html = readFileSync(resolve(__dirname, './basic.html'), 'utf8');

describe('MenuGutterIcon', () => {
    beforeAll(() => {
        customElements.define('menu-gutter-icon', MenuGutterIcon );
    });
    beforeEach(() => {
        document.documentElement.innerHTML = html.toString();
    });

    it("should initialize correctly", () => {
        const comp = new MenuGutterIcon();
        expect(comp).toBeInstanceOf(MenuGutterIcon);
    });
});