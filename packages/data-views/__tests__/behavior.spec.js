import { describe, it, expect, vi, afterEach } from 'vitest';
import { flushRenders } from '@catalystcommunity/base-components';
import { ListView, ShadowListView, TreeView, TableView } from '../src';

customElements.define('list-view', ListView);
customElements.define('shadow-list-view', ShadowListView);
customElements.define('tree-view', TreeView);
customElements.define('table-view', TableView);

afterEach(() => {
    document.body.replaceChildren();
    flushRenders();
});

const press = (view, key, init = {}) => {
    const event = new KeyboardEvent('keydown', {key, bubbles: true, cancelable: true, ...init});
    view.scroller.dispatchEvent(event);
    flushRenders();
    return event;
};
const rows = (view) => [...view.spacer.querySelectorAll('.row:not([hidden])')];
const make = (tag, props) => {
    const view = document.createElement(tag);
    Object.assign(view, props);
    document.body.append(view);
    flushRenders();
    return view;
};
const numbers = (count) => Array.from({length: count}, (_, i) => ({id: i, label: `Item ${i}`}));

describe('list view', () => {
    it('puts only the visible rows and a buffer in the DOM, also for a million items', () => {
        const view = make('list-view', {items: numbers(1_000_000), label: 'Numbers'});
        expect(rows(view).length).toBeLessThan(40);
        expect(view.scroller.getAttribute('role')).toBe('listbox');
        expect(view.scroller.getAttribute('aria-label')).toBe('Numbers');
        const first = rows(view)[0];
        expect(first.getAttribute('role')).toBe('option');
        expect(first.getAttribute('aria-setsize')).toBe('1000000');
        expect(first.getAttribute('aria-posinset')).toBe('1');
        expect(first.textContent).toBe('Item 0');
    });

    it('moves with the arrow keys, selects, and sends list-view-select', () => {
        const view = make('list-view', {items: numbers(100)});
        const selected = vi.fn();
        view.addEventListener('list-view-select', e => selected(e.detail));
        press(view, 'ArrowDown');
        press(view, 'ArrowDown');
        expect(view.active).toBe(1);
        expect(selected).toHaveBeenLastCalledWith(expect.objectContaining({keys: [1], index: 1}));
        expect(view.scroller.getAttribute('aria-activedescendant')).toBe(view.rowElement(1).id);
        expect(view.rowElement(1).getAttribute('aria-selected')).toBe('true');
        press(view, 'End');
        expect(view.active).toBe(99);
        expect(view.rowElement(99)).not.toBeNull();
    });

    it('extends with Shift, moves the focus only with Ctrl, toggles with Space, and selects all with Ctrl+A', () => {
        const view = make('list-view', {items: numbers(50), multiple: true});
        press(view, 'ArrowDown');
        press(view, 'ArrowDown', {shiftKey: true});
        press(view, 'ArrowDown', {shiftKey: true});
        expect(view.selectedKeys).toEqual([0, 1, 2]);
        press(view, 'ArrowDown', {ctrlKey: true});
        press(view, 'ArrowDown', {ctrlKey: true});
        expect(view.active).toBe(4);
        press(view, ' ');
        expect(view.selectedKeys).toEqual([0, 1, 2, 4]);
        press(view, 'a', {ctrlKey: true});
        expect(view.selectedKeys.length).toBe(50);
        expect(view.scroller.getAttribute('aria-multiselectable')).toBe('true');
    });

    it('selects with a click, Shift, and Ctrl, and activates with a double click and Enter', () => {
        const view = make('list-view', {items: numbers(20), multiple: true});
        const activated = vi.fn();
        view.addEventListener('list-view-activate', e => activated(e.detail));
        view.rowElement(2).querySelector('.label').click();
        view.rowElement(5).dispatchEvent(new MouseEvent('click', {bubbles: true, shiftKey: true}));
        view.rowElement(8).dispatchEvent(new MouseEvent('click', {bubbles: true, ctrlKey: true}));
        expect(view.selectedKeys).toEqual([2, 3, 4, 5, 8]);
        expect(view.selectedItems.map(item => item.id)).toEqual([2, 3, 4, 5, 8]);
        view.rowElement(8).dispatchEvent(new MouseEvent('dblclick', {bubbles: true}));
        expect(activated).toHaveBeenCalledWith(expect.objectContaining({index: 8, key: 8, pointer: true}));
        press(view, 'Enter');
        expect(activated).toHaveBeenLastCalledWith(expect.objectContaining({index: 8, pointer: false}));
    });

    it('goes to an item with typeahead', () => {
        const view = make('list-view', {items: ['Cherry', 'Apple', 'Banana', 'Blueberry']});
        press(view, 'b');
        expect(view.active).toBe(2);
        press(view, 'l');
        expect(view.active).toBe(3);
    });

    it('renders the content of one row again for refreshRow, and not the others', () => {
        const renderItem = vi.fn((item, row) => { row.textContent = item.label; });
        const view = make('list-view', {items: numbers(100), renderItem});
        const calls = renderItem.mock.calls.length;
        view.items[3].label = 'Changed';
        view.refreshItem(view.items[3]);
        flushRenders();
        expect(renderItem.mock.calls.length).toBe(calls + 1);
        expect(view.rowElement(3).textContent).toBe('Changed');
    });

    it('keeps the selection by key when the items change, and shows the empty text', () => {
        const view = make('list-view', {items: numbers(10), multiple: true});
        view.selectedKeys = [3, 4];
        view.items = numbers(10).reverse();
        flushRenders();
        expect(view.selectedItems.map(item => item.id)).toEqual([4, 3]);
        view.items = [];
        flushRenders();
        expect(view.querySelector('.empty').hidden).toBe(false);
        expect(view.querySelector('.empty').textContent).toBe('No items');
    });

    it('works in a shadow root', () => {
        const view = make('shadow-list-view', {items: numbers(5)});
        expect(view.shadowRoot.querySelector('[role="listbox"]')).not.toBeNull();
        expect(view.querySelector('[role="listbox"]')).toBeNull();
    });
});

function files() {
    return [
        {id: 'docs', label: 'Documents', icon: '📁', children: [
            {id: 'a', label: 'a.txt'},
            {id: 'b', label: 'b.txt'},
        ]},
        {id: 'pics', label: 'Pictures', hasChildren: true},
        {id: 'music', label: 'Music', children: []},
    ];
}

describe('tree view', () => {
    it('shows the top nodes, with level, position, and the expanded state', () => {
        const view = make('tree-view', {items: files()});
        expect(rows(view).map(row => row.querySelector('.label').textContent)).toEqual(['Documents', 'Pictures', 'Music']);
        const [docs, pics, music] = rows(view);
        expect(docs.getAttribute('aria-expanded')).toBe('false');
        expect(pics.getAttribute('aria-expanded')).toBe('false');
        expect(music.hasAttribute('aria-expanded')).toBe(false);
        expect([docs.getAttribute('aria-level'), docs.getAttribute('aria-posinset'), docs.getAttribute('aria-setsize')]).toEqual(['1', '1', '3']);
    });

    it('opens with Right, goes to the child with Right, back to the parent with Left, and closes with Left', () => {
        const view = make('tree-view', {items: files()});
        const expanded = vi.fn();
        view.addEventListener('tree-view-expand', e => expanded(e.detail.key, e.detail.expanded));
        press(view, 'ArrowDown');
        press(view, 'ArrowRight');
        expect(view.rowCount).toBe(5);
        expect(expanded).toHaveBeenCalledWith('docs', true);
        press(view, 'ArrowRight');
        expect(view.keyAt(view.active)).toBe('a');
        expect(view.rowElement(view.active).getAttribute('aria-level')).toBe('2');
        press(view, 'ArrowLeft');
        expect(view.keyAt(view.active)).toBe('docs');
        press(view, 'ArrowLeft');
        expect(view.rowCount).toBe(3);
        expect(expanded).toHaveBeenLastCalledWith('docs', false);
    });

    it('loads the children of a lazy node, and shows a loading row first', async () => {
        let finish;
        const loadChildren = vi.fn(() => new Promise(resolve => { finish = resolve; }));
        const view = make('tree-view', {items: files(), loadChildren});
        view.setExpanded(view.items[1], true);
        flushRenders();
        expect(loadChildren).toHaveBeenCalledTimes(1);
        const loading = rows(view).find(row => row.classList.contains('loading'));
        expect(loading.textContent).toBe('Loading…');
        expect(view.rowElement(1).getAttribute('aria-busy')).toBe('true');
        finish([{id: 'p1', label: 'photo.png'}]);
        await new Promise(resolve => setTimeout(resolve));
        flushRenders();
        expect(view.visibleEntries.map(entry => entry.key)).toEqual(['docs', 'pics', 'p1', 'music']);
        expect(view.rowElement(1).hasAttribute('aria-busy')).toBe(false);
    });

    it('closes a node again when its children cannot load', async () => {
        const view = make('tree-view', {items: files(), loadChildren: () => Promise.reject(new Error('offline'))});
        const failed = vi.fn();
        view.addEventListener('tree-view-load-error', e => failed(e.detail.error.message));
        await view.setExpanded(view.items[1], true);
        expect(failed).toHaveBeenCalledWith('offline');
        expect(view.isExpanded(view.items[1])).toBe(false);
    });

    it('opens each sibling with *, and opens a node that starts expanded', () => {
        const items = files();
        items[2].children = [{id: 'song', label: 'song.mp3'}];
        items[2].expanded = true;
        const view = make('tree-view', {items, loadChildren: async () => []});
        expect(view.rowCount).toBe(4);
        press(view, 'ArrowDown');
        press(view, '*');
        expect(view.isExpanded(items[0])).toBe(true);
        expect(view.isExpanded(items[1])).toBe(true);
    });

    it('checks a parent and its children, and shows mixed when some are checked', () => {
        const view = make('tree-view', {items: files(), checkboxes: true});
        view.setExpanded(view.items[0], true);
        flushRenders();
        press(view, 'ArrowDown');
        press(view, 'ArrowDown');
        press(view, ' ');
        expect(view.rowElement(1).getAttribute('aria-checked')).toBe('true');
        expect(view.rowElement(0).getAttribute('aria-checked')).toBe('mixed');
        expect(view.checkedKeys).toEqual(['a']);
        view.rowElement(0).querySelector('.check').click();
        flushRenders();
        expect(view.checkedKeys).toEqual(['docs']);
        expect(view.rowElement(2).getAttribute('aria-checked')).toBe('true');
    });

    it('opens a parent with a double click, unless the application cancels the activate event', () => {
        const view = make('tree-view', {items: files()});
        view.rowElement(0).dispatchEvent(new MouseEvent('dblclick', {bubbles: true}));
        expect(view.isExpanded(view.items[0])).toBe(true);
        view.addEventListener('tree-view-activate', e => e.preventDefault());
        view.rowElement(0).dispatchEvent(new MouseEvent('dblclick', {bubbles: true}));
        expect(view.isExpanded(view.items[0])).toBe(true);
    });

    it('opens a node with the twisty, and keeps the focus on the same node when rows move', () => {
        const view = make('tree-view', {items: files()});
        view.rowElement(2).click();
        expect(view.keyAt(view.active)).toBe('music');
        view.rowElement(0).querySelector('.twisty').click();
        flushRenders();
        expect(view.keyAt(view.active)).toBe('docs');
        press(view, 'End');
        expect(view.keyAt(view.active)).toBe('music');
        view.setExpanded(view.items[0], false);
        flushRenders();
        expect(view.keyAt(view.active)).toBe('music');
    });

    it('handles a hundred thousand visible nodes with a small DOM', () => {
        const items = Array.from({length: 1000}, (_, i) => ({id: `f${i}`, label: `Folder ${i}`, expanded: true,
            children: Array.from({length: 100}, (_, j) => ({id: `f${i}-${j}`, label: `File ${j}`}))}));
        const start = performance.now();
        const view = make('tree-view', {items});
        expect(view.rowCount).toBe(101_000);
        expect(rows(view).length).toBeLessThan(40);
        expect(performance.now() - start).toBeLessThan(1000);
    });
});

const columns = [
    {key: 'name', label: 'Name', width: 120},
    {key: 'amount', label: 'Amount', type: 'number', width: 100},
    {key: 'note', label: 'Note', sortable: false},
];
const people = () => [
    {id: 'c', name: 'Carol', amount: 30, note: 'x'},
    {id: 'a', name: 'alice', amount: 10, note: 'y'},
    {id: 'b', name: 'Bob', amount: 20, note: 'z'},
];

describe('table view', () => {
    const names = (view) => rows(view).sort((x, y) => x.getAttribute('aria-rowindex') - y.getAttribute('aria-rowindex'))
        .map(row => row.children[0].textContent);

    it('has a header row, grid roles, and the counts of rows and columns', () => {
        const view = make('table-view', {columns, items: people()});
        expect(view.scroller.getAttribute('role')).toBe('grid');
        expect([...view.header.children].map(cell => cell.textContent)).toEqual(['Name', 'Amount', 'Note']);
        expect(view.scroller.getAttribute('aria-rowcount')).toBe('4');
        expect(view.scroller.getAttribute('aria-colcount')).toBe('3');
        expect(view.rowElement(0).getAttribute('aria-rowindex')).toBe('2');
        expect(view.rowElement(0).children[1].textContent).toBe('30');
        expect(view.rowElement(0).children[1].classList.contains('end')).toBe(true);
    });

    it('sorts with a click on a header: ascending, descending, then the first order', () => {
        const view = make('table-view', {columns, items: people()});
        const sorted = vi.fn();
        view.addEventListener('table-view-sort', e => sorted(e.detail));
        view.header.children[0].click();
        flushRenders();
        expect(names(view)).toEqual(['alice', 'Bob', 'Carol']);
        expect(view.header.children[0].getAttribute('aria-sort')).toBe('ascending');
        view.header.children[0].click();
        flushRenders();
        expect(names(view)).toEqual(['Carol', 'Bob', 'alice']);
        view.header.children[0].click();
        flushRenders();
        expect(names(view)).toEqual(['Carol', 'alice', 'Bob']);
        expect(view.header.children[0].hasAttribute('aria-sort')).toBe(false);
        expect(sorted.mock.calls.map(call => call[0].direction)).toEqual(['ascending', 'descending', null]);
        view.header.children[2].click();
        expect(sorted).toHaveBeenCalledTimes(3);
    });

    it('does not sort when a listener cancels table-view-sort', () => {
        const view = make('table-view', {columns, items: people()});
        view.addEventListener('table-view-sort', e => e.preventDefault());
        view.header.children[0].click();
        flushRenders();
        expect(names(view)).toEqual(['Carol', 'alice', 'Bob']);
        expect(view.header.children[0].hasAttribute('aria-sort')).toBe(false);
    });

    it('lets the application sort with sort="external"', () => {
        const view = make('table-view', {columns, items: people(), sort: 'external'});
        view.header.children[1].click();
        flushRenders();
        expect(names(view)).toEqual(['Carol', 'alice', 'Bob']);
        expect(view.header.children[1].getAttribute('aria-sort')).toBe('ascending');
    });

    it('moves between cells, goes to the header, sorts with Enter, and resizes with Shift and an arrow', () => {
        const view = make('table-view', {columns, items: people()});
        press(view, 'ArrowDown');
        press(view, 'ArrowRight');
        expect(view.scroller.getAttribute('aria-activedescendant')).toBe(view.rowElement(0).children[1].id);
        press(view, 'End');
        expect(view.activeColumn).toBe(2);
        press(view, 'Home');
        press(view, 'ArrowUp');
        expect(view.scroller.getAttribute('aria-activedescendant')).toBe(view.header.children[0].id);
        press(view, 'Enter');
        flushRenders();
        expect(names(view)).toEqual(['alice', 'Bob', 'Carol']);
        const resized = vi.fn();
        view.addEventListener('table-view-resize', e => resized(e.detail));
        press(view, 'ArrowRight', {shiftKey: true});
        expect(view.columnWidths[0]).toBe(136);
        expect(resized).toHaveBeenCalledWith({key: 'name', index: 0, width: 136});
        expect(view.frame.style.getPropertyValue('--_columns')).toBe('136px 100px 150px');
        press(view, 'ArrowDown');
        expect(view.active).toBe(0);
        expect(view.keyAt(0)).toBe('a');
    });

    it('keeps the focus and the selection on the same item after a sort', () => {
        const view = make('table-view', {columns, items: people()});
        press(view, 'ArrowDown');
        expect(view.selectedKeys).toEqual(['c']);
        view.sortBy('name', 'ascending');
        flushRenders();
        expect(view.keyAt(view.active)).toBe('c');
        expect(view.rowElement(view.active).getAttribute('aria-selected')).toBe('true');
    });

    it('sorts the new items with the same column', () => {
        const view = make('table-view', {columns, items: people()});
        view.sortBy('amount', 'descending');
        view.items = [...people(), {id: 'd', name: 'Dan', amount: 99}];
        flushRenders();
        expect(names(view)[0]).toBe('Dan');
    });

    it('uses the render function of a column, and refreshes one item', () => {
        const render = vi.fn((cell, value) => { cell.textContent = `<${value}>`; });
        const view = make('table-view', {columns: [{key: 'name', render}], items: people()});
        expect(view.rowElement(0).children[0].textContent).toBe('<Carol>');
        view.items[0].name = 'Caroline';
        view.refreshItem(view.items[0]);
        flushRenders();
        expect(view.rowElement(0).children[0].textContent).toBe('<Caroline>');
    });

    it('refuses to sort by a column that it does not have', () => {
        const view = make('table-view', {columns, items: people()});
        expect(() => view.sortBy('nothing')).toThrow('no column with the key nothing');
    });
});
