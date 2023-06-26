import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import {readFileSync} from 'fs';
import {resolve} from 'path';
import {TwoTierMenu} from '../src';

const html = readFileSync(resolve(__dirname, './basic.html'), 'utf8');

describe('TwoTierMenu', () => {
    beforeAll(() => {
        customElements.define('two-tier-menu', TwoTierMenu );
    });
    beforeEach(() => {
        document.documentElement.innerHTML = html.toString();
    });

    it("should initialize correctly", () => {
        const comp = new TwoTierMenu();
        expect(comp).toBeInstanceOf(TwoTierMenu);
    });
});
