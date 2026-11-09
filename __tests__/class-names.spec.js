import { describe, it, expect } from 'vitest';
import {readdirSync, readFileSync} from 'fs';
import {resolve} from 'path';
import * as zest from '../src/index.js';

// A light DOM component is part of the page, so a page rule for a class such as .row or .select
// also changes an element inside the component. Each class that a component puts on its own
// elements, and each class in its default CSS, starts with zest-.

const root = resolve(import.meta.dirname, '..');
const PREFIX = /^zest-/;

// Class names in CSS text, with comments, strings, and url() removed
function cssClasses(css) {
    const clean = css
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/url\([^)]*\)/g, '')
        .replace(/"[^"]*"|'[^']*'/g, '')
        // Numbers such as 0.5em or .25s are not classes
        .replace(/(^|[^\w-])\.\d[\w%]*/g, '$1');
    return [...clean.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)].map(match => match[1]);
}

// Class names that the source gives to elements: className, classList, and class="..." in markup
function sourceClasses(source) {
    const names = [];
    const words = (text) => text.split(/\s+/).filter(word => word && !word.includes('${') && !word.includes('}'));
    for (const match of source.matchAll(/className\s*[:=]\s*(['"`])([^'"`]*)\1/g)) { names.push(...words(match[2])); }
    for (const match of source.matchAll(/classList\.(?:add|toggle|remove|contains|replace)\(\s*(['"`])([^'"`]+)\1/g)) { names.push(...words(match[2])); }
    for (const match of source.matchAll(/class="([^"]*)"/g)) { names.push(...words(match[1])); }
    return names;
}

const LIGHT_DOM_PACKAGES = ['actions', 'calendar-view', 'containers', 'controls', 'data-views', 'date-time-picker', 'media', 'menus', 'spreadsheet'];

describe('internal class names', () => {
    it('start with zest- in the default CSS of each component', () => {
        const problems = [];
        for (const [name, value] of Object.entries(zest)) {
            if (typeof value !== 'function' || typeof value.styles !== 'string' || !value.styles) { continue; }
            for (const cls of cssClasses(value.styles)) {
                if (!PREFIX.test(cls)) { problems.push(`${name}: .${cls}`); }
            }
        }
        expect([...new Set(problems)]).toEqual([]);
    });

    for (const dir of LIGHT_DOM_PACKAGES) {
        it(`start with zest- where ${dir} sets them`, () => {
            const sourceDir = resolve(root, 'packages', dir, 'src');
            const problems = [];
            for (const file of readdirSync(sourceDir).filter(file => file.endsWith('.js'))) {
                const source = readFileSync(resolve(sourceDir, file), 'utf8');
                for (const cls of sourceClasses(source)) {
                    if (!PREFIX.test(cls)) { problems.push(`${file}: ${cls}`); }
                }
            }
            expect([...new Set(problems)]).toEqual([]);
        });
    }
});
