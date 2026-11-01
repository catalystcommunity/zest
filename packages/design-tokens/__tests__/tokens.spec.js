import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { tokensCss } from '../src';

const file = readFileSync(resolve(import.meta.dirname, '../src/tokens.css'), 'utf8');

function channels(hex) {
    return [1, 3, 5].map(start => parseInt(hex.slice(start, start + 2), 16));
}

function luminance(rgb) {
    const [r, g, b] = rgb.map((value) => {
        const part = value / 255;
        return part <= 0.04045 ? part / 12.92 : ((part + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(first, second) {
    const [low, high] = [luminance(first), luminance(second)].sort((a, b) => a - b);
    return (high + 0.05) / (low + 0.05);
}

function mix(first, second, share) {
    return first.map((value, i) => value * share + second[i] * (1 - share));
}

const defaults = tokensCss.slice(0, tokensCss.indexOf('@media'));
const colors = {light: {}, dark: {}};
for (const [, role, light, dark] of defaults.matchAll(/--zest-color-([a-z-]+): light-dark\((#[0-9a-f]{6}), (#[0-9a-f]{6})\)/g)) {
    colors.light[role] = channels(light);
    colors.dark[role] = channels(dark);
}

const TEXT = [
    ['window-text', 'window'], ['face-text', 'face'], ['field-text', 'field'], ['highlight-text', 'highlight'],
    ['secondary-text', 'window'], ['secondary-text', 'face'], ['disabled-text', 'window'], ['disabled-text', 'face'],
    ['disabled-text', 'field'], ['invalid', 'window'], ['invalid', 'field'], ['highlight', 'window'],
];
const NON_TEXT = [
    ['border', 'window'], ['border', 'face'], ['border', 'field'], ['focus', 'window'], ['focus', 'face'],
    ['focus', 'field'], ['highlight', 'face'], ['invalid', 'face'],
];

describe('the tokens', () => {
    it('are the same in the file and in the JavaScript', () => {
        expect(file.endsWith(tokensCss)).toBe(true);
    });

    it('have a light and a dark value for each color', () => {
        expect(Object.keys(colors.light).length).toBe(13);
        const declared = [...defaults.matchAll(/--zest-color-/g)].length;
        expect(Object.keys(colors.light).length).toBe(declared);
    });

    describe.each(['light', 'dark'])('%s', (scheme) => {
        const palette = colors[scheme];

        it.each(TEXT)('%s on %s has a contrast of 4.5:1 or more', (text, background) => {
            expect(contrast(palette[text], palette[background])).toBeGreaterThanOrEqual(4.5);
        });

        it.each(NON_TEXT)('%s on %s has a contrast of 3:1 or more', (part, background) => {
            expect(contrast(palette[part], palette[background])).toBeGreaterThanOrEqual(3);
        });

        it('keeps the contrast of text on the lightest part of a control fill', () => {
            const top = mix(palette.face, [255, 255, 255], 0.88);
            expect(contrast(palette['face-text'], top)).toBeGreaterThanOrEqual(4.5);
        });

        it('keeps the contrast of text on a selected range and on a hover', () => {
            for (const share of [0.25, 0.12]) {
                const face = mix(palette.highlight, palette.window, share);
                expect(contrast(palette['window-text'], face)).toBeGreaterThanOrEqual(4.5);
            }
        });
    });

    it('have no motion unless the user allows it', () => {
        expect(defaults).toMatch(/--zest-motion-duration: 0ms/);
        expect(tokensCss).toMatch(/prefers-reduced-motion: no-preference\) \{\s+:root \{\s+--zest-motion-duration: 120ms/);
    });

    it('keep a control at or above the minimum target size at a small font', () => {
        const height = Number(/--zest-control-height: ([\d.]+)em/.exec(defaults)[1]);
        expect(height * 12).toBeGreaterThanOrEqual(24);
    });
});

describe('the default sizes in the components', () => {
    const sizes = Object.fromEntries([...defaults.matchAll(/(--zest-(?!color-|font-|line-)[a-z-]+): ([^;]+);/g)].map(match => [match[1], match[2]]));

    it.each(['date-time-picker', 'two-tier-menu', 'menu-gutter'])('%s falls back to the same values as the tokens', (name) => {
        const source = readFileSync(resolve(import.meta.dirname, `../../${name}/src/index.js`), 'utf8');
        const used = [...source.matchAll(/var\((--zest-(?:control-[a-z-]+|gap-[a-z-]+|margin-[a-z-]+|border-width|focus-[a-z-]+)), ([\d.]+(?:em|px))\)/g)];
        expect(used.length).toBeGreaterThan(0);
        for (const [, token, fallback] of used) {
            expect(fallback, token).toEqual(sizes[token]);
        }
    });
});
