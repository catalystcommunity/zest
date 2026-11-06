import { describe, it, expect } from 'vitest';
import { virtualWindow, virtualScrollTop, MAX_VIRTUAL_HEIGHT, ViewSelection, ViewTypeahead, tableSortOrder, formatTableCell } from '../src';

describe('the virtual window', () => {
    it('gives the visible rows and a buffer on each side', () => {
        const view = virtualWindow({count: 1000, rowHeight: 20, viewport: 200, scrollTop: 400, buffer: 2});
        expect([view.first, view.last]).toEqual([18, 32]);
        expect(view.height).toBe(20000);
        expect(view.ratio).toBe(1);
        expect(view.top(20)).toBe(400);
    });

    it('stops at the ends of the list', () => {
        expect(virtualWindow({count: 5, rowHeight: 20, viewport: 200, scrollTop: 0}).last).toBe(5);
        const end = virtualWindow({count: 100, rowHeight: 20, viewport: 200, scrollTop: 5000});
        expect(end.virtualTop).toBe(1800);
        expect(end.last).toBe(100);
    });

    it('scales a list that is taller than the browser allows, and reaches the last row', () => {
        const rows = 1_000_000;
        const top = virtualWindow({count: rows, rowHeight: 32, viewport: 640, scrollTop: 0});
        expect(top.height).toBe(MAX_VIRTUAL_HEIGHT);
        expect(top.ratio).toBeGreaterThan(3);
        const bottom = virtualWindow({count: rows, rowHeight: 32, viewport: 640, scrollTop: MAX_VIRTUAL_HEIGHT - 640});
        expect(bottom.last).toBe(rows);
        // The last row ends at the bottom of the scroll area
        expect(bottom.top(rows - 1) + 32).toBeCloseTo(MAX_VIRTUAL_HEIGHT, 3);
    });

    it('gives the scroll position that shows a row, and null for a visible row', () => {
        const view = virtualWindow({count: 1000, rowHeight: 20, viewport: 200, scrollTop: 400});
        expect(virtualScrollTop(view, 25)).toBeNull();
        expect(virtualScrollTop(view, 5)).toBe(100);
        expect(virtualScrollTop(view, 40)).toBe(620);
        const scaled = virtualWindow({count: 1_000_000, rowHeight: 32, viewport: 640, scrollTop: 0});
        expect(virtualScrollTop(scaled, 999_999)).toBeCloseTo(MAX_VIRTUAL_HEIGHT - 640, 3);
    });
});

describe('the selection', () => {
    const keyAt = (index) => `k${index}`;

    it('selects one, toggles, and extends from the anchor', () => {
        const selection = new ViewSelection({multiple: true});
        expect(selection.selectOnly(2, keyAt)).toBe(true);
        expect(selection.selectOnly(2, keyAt)).toBe(false);
        selection.toggle(5, keyAt);
        expect(selection.keys).toEqual(['k2', 'k5']);
        selection.extend(3, keyAt);
        expect(selection.keys).toEqual(['k3', 'k4', 'k5']);
        selection.toggle(4, keyAt);
        expect(selection.has('k4')).toBe(false);
    });

    it('keeps one key in a single selection', () => {
        const selection = new ViewSelection();
        selection.toggle(1, keyAt);
        selection.extend(4, keyAt);
        expect(selection.keys).toEqual(['k4']);
        expect(selection.selectAll(10, keyAt)).toBe(false);
        selection.set(['a', 'b']);
        expect(selection.keys).toEqual(['a']);
    });

    it('reads Shift and Ctrl from a pointer event', () => {
        const selection = new ViewSelection({multiple: true});
        selection.fromPointer(1, {}, keyAt);
        selection.fromPointer(3, {shiftKey: true}, keyAt);
        selection.fromPointer(6, {metaKey: true}, keyAt);
        expect(selection.keys).toEqual(['k1', 'k2', 'k3', 'k6']);
    });

    it('finds a row by the first letters that the user typed', () => {
        const typeahead = new ViewTypeahead();
        const names = ['apple', 'banana', 'blueberry', 'cherry'];
        const textAt = (i) => names[i];
        expect(typeahead.find('b', 0, 4, textAt, 1000)).toBe(1);
        expect(typeahead.find('l', 1, 4, textAt, 1200)).toBe(2);
        expect(typeahead.find('b', 2, 4, textAt, 5000)).toBe(1);
        expect(typeahead.find('z', 0, 4, textAt, 9000)).toBe(-1);
    });
});

describe('table sort and format', () => {
    const items = [
        {id: 1, name: 'item 10', amount: 5, date: '2026-01-02'},
        {id: 2, name: 'Item 9', amount: null, date: '2025-12-30'},
        {id: 3, name: 'item 2', amount: 5, date: ''},
        {id: 4, name: 'Älpha', amount: -1, date: '2026-03-01'},
    ];

    it('sorts text by the locale and numbers in text by value', () => {
        expect(tableSortOrder(items, {key: 'name'}, 'ascending', 'en').map(i => items[i].id)).toEqual([4, 3, 2, 1]);
    });

    it('is stable, and puts an empty value last in both directions', () => {
        expect(tableSortOrder(items, {key: 'amount'}, 'ascending').map(i => items[i].id)).toEqual([4, 1, 3, 2]);
        expect(tableSortOrder(items, {key: 'amount'}, 'descending').map(i => items[i].id)).toEqual([1, 3, 4, 2]);
    });

    it('uses a sort value of the column', () => {
        const column = {key: 'date', sortValue: (item) => (item.date ? new Date(item.date) : null)};
        expect(tableSortOrder(items, column, 'ascending').map(i => items[i].id)).toEqual([2, 1, 4, 3]);
    });

    it('formats numbers, dates, and booleans, and uses the format of the column first', () => {
        expect(formatTableCell({type: 'number'}, 1234.5, {}, 'en-US')).toBe('1,234.5');
        expect(formatTableCell({type: 'number'}, 1234.5, {}, 'de-DE')).toBe('1.234,5');
        expect(formatTableCell({type: 'date'}, '2026-03-13T12:00:00', {}, 'en-US')).toBe('Mar 13, 2026');
        expect(formatTableCell({type: 'boolean'}, true)).toBe('✓');
        expect(formatTableCell({format: (v) => `#${v}`}, 3)).toBe('#3');
        expect(formatTableCell({}, null)).toBe('');
    });
});
