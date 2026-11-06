import { isRtl } from "@catalystcommunity/base-components";
import { VirtualView, viewStyles } from "./virtual.js";

const tableStyles = `
.zest-table-view .head {
    position: sticky;
    inset-block-start: 0;
    z-index: 2;
    display: grid;
    grid-template-columns: var(--_columns);
    width: calc(var(--_total-width) + 0.25em);
    min-width: 100%;
    box-sizing: border-box;
    background-color: var(--_face);
    background-image: var(--_fill);
    color: var(--_face-text);
    border-block-end: var(--_border-width) solid var(--_border);
    /* The same start as a row, which has a border that shows the selection */
    border-inline-start: 0.25em solid transparent;
}
.zest-table-view .spacer {
    width: calc(var(--_total-width) + 0.25em);
}
.zest-table-view .row {
    display: grid;
    grid-template-columns: var(--_columns);
    width: calc(var(--_total-width) + 0.25em);
    min-width: 100%;
    align-items: stretch;
    padding: 0;
    gap: 0;
    inset-inline-end: auto;
    border-block-end: var(--_border-width) solid var(--_line);
}
.zest-table-view .cell, .zest-table-view .column-head {
    box-sizing: border-box;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    padding-inline: 0.5em;
    line-height: calc(var(--_row-height) - var(--_border-width));
    border-inline-end: var(--_border-width) solid var(--_line);
}
.zest-table-view .end {
    text-align: end;
    font-variant-numeric: tabular-nums;
}
.zest-table-view .center {
    text-align: center;
}
.zest-table-view .column-head {
    position: relative;
    min-height: var(--_row-height);
    padding-inline-end: 1.5em;
    font-weight: bold;
    cursor: pointer;
    user-select: none;
}
.zest-table-view .column-head:hover {
    background: var(--_hover-face);
}
.zest-table-view .column-head .sort {
    position: absolute;
    inset-inline-end: 0.5em;
}
.zest-table-view .resize {
    position: absolute;
    inset-block: 0;
    inset-inline-end: 0;
    width: 0.75em;
    cursor: col-resize;
    touch-action: none;
}
.zest-table-view .resize:hover, .zest-table-view .resizing .resize {
    background: color-mix(in srgb, var(--_highlight) 35%, transparent);
}
.zest-table-view .scroller:focus-visible .head .active,
.zest-table-view .scroller.keyboard:focus .head .active {
    outline: var(--_focus-width) solid var(--_focus);
    outline-offset: calc(var(--_focus-width) * -1);
}
.zest-table-view .scroller:focus-visible .row.active,
.zest-table-view .scroller.keyboard:focus .row.active {
    outline: none;
}
.zest-table-view .scroller:focus-visible .cell.active,
.zest-table-view .scroller.keyboard:focus .cell.active {
    outline: var(--_focus-width) solid var(--_focus);
    outline-offset: calc(var(--_focus-width) * -1);
}
`;

// One formatter for each locale and kind. Making a formatter is slow.
const formatters = new Map();
function formatter(kind, locale) {
    const key = `${kind}|${locale ?? ''}`;
    if (!formatters.has(key)) {
        formatters.set(key, kind === 'number' ? new Intl.NumberFormat(locale || undefined)
            : kind === 'date' ? new Intl.DateTimeFormat(locale || undefined, {dateStyle: 'medium'})
                : new Intl.Collator(locale || undefined, {numeric: true, sensitivity: 'base'}));
    }
    return formatters.get(key);
}

// The text of a value in a cell of a column
export function formatCell(column, value, item, locale) {
    if (column.format) { return column.format(value, item); }
    if (value === null || value === undefined) { return ''; }
    if (column.type === 'number' && typeof value === 'number') { return formatter('number', locale).format(value); }
    if (column.type === 'date') {
        const date = value instanceof Date ? value : new Date(value);
        return Number.isNaN(date.getTime()) ? String(value) : formatter('date', locale).format(date);
    }
    if (column.type === 'boolean') { return value ? '✓' : ''; }
    return String(value);
}

// The order of the items, sorted by a column, with no DOM. The sort is stable: items with the same
// value keep their order. An empty value goes last in both directions.
export function sortOrder(items, column, direction, locale) {
    const key = column.key;
    const value = column.sortValue ?? ((item) => item?.[key]);
    const values = items.map(item => value(item));
    const order = Array.from(items, (item, index) => index);
    const sign = direction === 'descending' ? -1 : 1;
    const collator = formatter('collator', locale);
    const typed = (v) => (v instanceof Date ? v.getTime() : v);
    order.sort((a, b) => {
        const x = typed(values[a]);
        const y = typed(values[b]);
        const xEmpty = x === null || x === undefined || x === '';
        const yEmpty = y === null || y === undefined || y === '';
        if (xEmpty || yEmpty) { return xEmpty === yEmpty ? a - b : (xEmpty ? 1 : -1); }
        let result;
        if (typeof x === 'number' && typeof y === 'number') {
            result = x - y;
        } else if (typeof x === 'boolean' && typeof y === 'boolean') {
            result = Number(x) - Number(y);
        } else {
            result = collator.compare(String(x), String(y));
        }
        return result * sign || a - b;
    });
    return order;
}

const ALIGN = {end: 'end', right: 'end', center: 'center'};
const MIN_WIDTH = 48;

// A table of items. A column is {key, label, width, type, sortable, resizable, align, format, render}.
// Only the visible rows are in the DOM.
export class TableView extends VirtualView {
    static styles = viewStyles('table-view') + tableStyles;
    static viewClass = 'zest-table-view';
    static scrollerRole = 'grid';
    static properties = {
        items: {type: Array, attribute: false, default: () => []},
        columns: {type: Array, default: () => []},
        keyOf: {type: Function, attribute: false},
        // 'internal': the table sorts. 'external': the table sends table-view-sort, and the application sorts.
        sort: {type: String, default: 'internal'},
        locale: {type: String, default: ''},
    };

    // The column with the keyboard focus. The header row is row -1.
    activeColumn = 0;
    sortKey = null;
    sortDirection = null;
    #order = null;
    #widths = [];
    #headCells = [];
    #onHeader = false;

    propertyChanged(name, oldValue, newValue) {
        super.propertyChanged(name, oldValue, newValue);
        if (name === 'columns') {
            this.#widths = this.columns.map(column => Math.max(MIN_WIDTH, Number(column.width) || 150));
            this.activeColumn = Math.min(this.activeColumn, Math.max(0, this.columns.length - 1));
            this.#buildHead();
            // Each row has one cell for each column, so new columns need new rows
            this.resetRows();
        }
        if (name === 'items' || name === 'locale') {
            this.#order = null;
            if (this.sortKey && this.sort !== 'external') { this.#sortNow(); }
        }
    }

    get rowCount() { return this.items.length; }

    // The index in items of a row
    itemIndex(row) { return this.#order ? this.#order[row] : row; }
    itemAt(row) { return this.items[this.itemIndex(row)]; }

    keyAt(row) {
        const index = this.itemIndex(row);
        const item = this.items[index];
        return this.keyOf ? this.keyOf(item, index) : (item?.id ?? index);
    }

    textAt(row) {
        const column = this.columns[this.activeColumn] ?? this.columns[0];
        return column ? formatCell(column, this.itemAt(row)?.[column.key], this.itemAt(row), this.locale) : '';
    }

    buildHeader() {
        const group = document.createElement('div');
        group.className = 'head';
        group.setAttribute('role', 'row');
        group.setAttribute('aria-rowindex', '1');
        group.setAttribute('part', 'header');
        group.addEventListener('click', (e) => {
            const cell = e.target.closest('.column-head');
            if (!cell || e.target.closest('.resize')) { return; }
            this.#onHeader = true;
            this.activeColumn = Number(cell.dataset.column);
            this.toggleSort(this.columns[this.activeColumn], e);
        });
        group.addEventListener('pointerdown', (e) => this.#startResize(e));
        return group;
    }

    #buildHead() {
        if (!this.header) { return; }
        this.#headCells = this.columns.map((column, i) => {
            const cell = document.createElement('div');
            cell.className = `column-head ${ALIGN[column.align] ?? (column.type === 'number' ? 'end' : '')}`;
            cell.setAttribute('role', 'columnheader');
            cell.setAttribute('aria-colindex', String(i + 1));
            cell.dataset.column = String(i);
            cell.id = `${this.uid}-h${i}`;
            const label = document.createElement('span');
            label.textContent = column.label ?? column.key;
            const sort = document.createElement('span');
            sort.className = 'sort';
            sort.setAttribute('aria-hidden', 'true');
            cell.append(label, sort);
            if (column.resizable !== false) {
                const resize = document.createElement('span');
                resize.className = 'resize';
                resize.setAttribute('aria-hidden', 'true');
                cell.append(resize);
            }
            return cell;
        });
        this.header.replaceChildren(...this.#headCells);
        this.#paintHead();
        this.#applyWidths();
    }

    #paintHead() {
        this.#headCells.forEach((cell, i) => {
            const column = this.columns[i];
            const sorted = this.sortKey === column.key ? this.sortDirection : null;
            if (sorted) { cell.setAttribute('aria-sort', sorted); } else { cell.removeAttribute('aria-sort'); }
            cell.querySelector('.sort').textContent = sorted === 'ascending' ? '▲' : sorted === 'descending' ? '▼' : '';
            cell.classList.toggle('active', this.#onHeader && i === this.activeColumn);
        });
    }

    #applyWidths() {
        if (!this.frame) { return; }
        this.frame.style.setProperty('--_columns', this.#widths.map(width => `${width}px`).join(' '));
        this.frame.style.setProperty('--_total-width', `${this.#widths.reduce((sum, width) => sum + width, 0)}px`);
    }

    // The width of each column in pixels
    get columnWidths() { return [...this.#widths]; }

    setColumnWidth(index, width, event = null) {
        if (!this.columns[index]) { return; }
        width = Math.max(MIN_WIDTH, Math.round(width));
        if (width === this.#widths[index]) { return; }
        this.#widths[index] = width;
        this.#applyWidths();
        if (event) { this.emit('table-view-resize', {key: this.columns[index].key, index, width}); }
    }

    #startResize(e) {
        const handle = e.target.closest('.resize');
        if (!handle || e.button !== 0) { return; }
        e.preventDefault();
        const cell = handle.closest('.column-head');
        const index = Number(cell.dataset.column);
        const startX = e.clientX;
        const startWidth = this.#widths[index];
        const sign = isRtl(this.scroller) ? -1 : 1;
        handle.setPointerCapture?.(e.pointerId);
        cell.classList.add('resizing');
        const move = (moveEvent) => this.setColumnWidth(index, startWidth + (moveEvent.clientX - startX) * sign, moveEvent);
        const end = () => {
            cell.classList.remove('resizing');
            handle.removeEventListener('pointermove', move);
            handle.removeEventListener('pointerup', end);
            handle.removeEventListener('pointercancel', end);
        };
        handle.addEventListener('pointermove', move);
        handle.addEventListener('pointerup', end);
        handle.addEventListener('pointercancel', end);
    }

    built() {
        this.#buildHead();
    }

    // Sorts by a column. direction is 'ascending', 'descending', or null for the order of the items.
    sortBy(key, direction = 'ascending', event = null) {
        const column = this.columns.find(candidate => candidate.key === key);
        if (key !== null && !column) { throw new Error(`The table has no column with the key ${key}`); }
        const activeKey = this.active >= 0 ? this.keyAt(this.active) : undefined;
        if (event && !this.emit('table-view-sort', {key: direction ? key : null, direction: direction || null}, {cancelable: true})) { return; }
        this.sortKey = direction ? key : null;
        this.sortDirection = direction ? direction : null;
        if (this.sort === 'external') {
            this.#paintHead();
            return;
        }
        this.#sortNow();
        if (activeKey !== undefined) { this.active = this.indexOfKey(activeKey); }
        this.#paintHead();
        this.refresh();
        if (this.active >= 0) { this.scrollToIndex(this.active); }
    }

    #sortNow() {
        const column = this.columns.find(candidate => candidate.key === this.sortKey);
        this.#order = column && this.sortDirection ? sortOrder(this.items, column, this.sortDirection, this.locale) : null;
    }

    // ascending, then descending, then the order of the items
    toggleSort(column, event = null) {
        if (!column || column.sortable === false) { return; }
        const next = this.sortKey !== column.key ? 'ascending'
            : this.sortDirection === 'ascending' ? 'descending' : null;
        this.sortBy(column.key, next, event);
    }

    indexOfKey(key) {
        if (!this.#order) { return super.indexOfKey(key); }
        for (let row = 0; row < this.#order.length; row++) {
            if (Object.is(this.keyAt(row), key)) { return row; }
        }
        return -1;
    }

    createRow() {
        const row = document.createElement('div');
        row.setAttribute('role', 'row');
        row.setAttribute('part', 'row');
        this.columns.forEach((column, i) => {
            const cell = document.createElement('div');
            cell.className = `cell ${ALIGN[column.align] ?? (column.type === 'number' ? 'end' : '')}`;
            cell.setAttribute('role', 'gridcell');
            cell.setAttribute('aria-colindex', String(i + 1));
            cell.dataset.column = String(i);
            row.append(cell);
        });
        return row;
    }

    renderRow(row, index) {
        const item = this.itemAt(index);
        row.id = `${this.uid}-r${index}`;
        row.setAttribute('aria-rowindex', String(index + 2));
        this.columns.forEach((column, i) => {
            const cell = row.children[i];
            if (!cell) { return; }
            cell.id = `${this.uid}-r${index}c${i}`;
            const value = item?.[column.key];
            if (column.render) {
                column.render(cell, value, item);
            } else {
                cell.textContent = formatCell(column, value, item, this.locale);
            }
        });
    }

    paintRow(row, index) {
        const selected = String(this.selection.has(this.keyAt(index)));
        if (row.getAttribute('aria-selected') !== selected) { row.setAttribute('aria-selected', selected); }
        const activeRow = !this.#onHeader && index === this.active;
        row.classList.toggle('active', activeRow);
        for (const cell of row.children) {
            cell.classList.toggle('active', activeRow && Number(cell.dataset.column) === this.activeColumn);
        }
    }

    afterRender() {
        this.scroller.setAttribute('aria-rowcount', String(this.items.length + 1));
        this.scroller.setAttribute('aria-colcount', String(this.columns.length));
        this.#paintHead();
    }

    activeDescendant() {
        if (this.#onHeader) { return this.#headCells[this.activeColumn]?.id ?? null; }
        return this.rowElement(this.active)?.children[this.activeColumn]?.id ?? null;
    }

    onRowClick(index, e) {
        const cell = e.target.closest('.cell');
        this.#onHeader = false;
        if (cell) { this.activeColumn = Number(cell.dataset.column); }
        this.selectFromPointer(index, e);
    }

    onRowDoubleClick(index) {
        this.#activate(index);
    }

    #activate(index) {
        this.emit('table-view-activate', {index, key: this.keyAt(index), item: this.itemAt(index), column: this.columns[this.activeColumn]?.key});
    }

    #moveColumn(step) {
        const next = Math.max(0, Math.min(this.columns.length - 1, this.activeColumn + step));
        this.activeColumn = next;
        const cell = this.#onHeader ? this.#headCells[next] : this.rowElement(this.active)?.children[next];
        this.render();
        // Show the column too, when the table scrolls to the side
        const box = cell?.getBoundingClientRect?.();
        const view = this.scroller.getBoundingClientRect?.();
        if (box && view && box.width) {
            if (box.left < view.left) { this.scroller.scrollLeft -= view.left - box.left; }
            if (box.right > view.right) { this.scroller.scrollLeft += box.right - view.right; }
        }
    }

    onKey(e) {
        const rtl = isRtl(this.scroller);
        const step = {ArrowRight: rtl ? -1 : 1, ArrowLeft: rtl ? 1 : -1}[e.key];
        const ctrl = e.ctrlKey || e.metaKey;
        if (this.#onHeader) {
            const column = this.columns[this.activeColumn];
            if (step && e.shiftKey) {
                this.setColumnWidth(this.activeColumn, this.#widths[this.activeColumn] + step * 16, e);
                return true;
            }
            if (step) { this.#moveColumn(step); return true; }
            if (e.key === 'Home' || e.key === 'End') { this.#moveColumn(e.key === 'Home' ? -Infinity : Infinity); return true; }
            if (e.key === 'Enter' || e.key === ' ') { this.toggleSort(column, e); return true; }
            if (e.key === 'ArrowDown' && this.items.length) {
                this.#onHeader = false;
                this.moveActive(0, {}, e);
                return true;
            }
            return ['ArrowUp', 'PageUp', 'PageDown'].includes(e.key);
        }
        if (step && !e.altKey) { this.#moveColumn(step); return true; }
        if ((e.key === 'Home' || e.key === 'End') && !ctrl) {
            this.#moveColumn(e.key === 'Home' ? -Infinity : Infinity);
            return true;
        }
        if (e.key === 'ArrowUp' && (this.active <= 0) && !e.shiftKey) {
            this.#onHeader = true;
            this.render();
            return true;
        }
        if (e.key === 'Enter' && this.active >= 0) {
            this.#activate(this.active);
            return true;
        }
        return false;
    }

    moveActive(index, mods, event) {
        this.#onHeader = false;
        super.moveActive(index, mods, event);
    }

    selectionChanged() {
        const index = this.active;
        this.emit('table-view-select', {keys: this.selectedKeys, index, key: index >= 0 ? this.keyAt(index) : null, item: this.itemAt(index) ?? null});
    }

    get selectedItems() {
        return this.items.filter((item, index) => this.selection.has(this.keyOf ? this.keyOf(item, index) : (item?.id ?? index)));
    }

    // Renders the row of one item again, after the item changed. The order does not change.
    refreshItem(item) {
        const index = this.items.indexOf(item);
        if (index < 0) { return; }
        const row = this.#order ? this.#order.indexOf(index) : index;
        this.refreshRow(row);
    }
}

export class ShadowTableView extends TableView {
    shadow;
    constructor() {
        super();
        this.shadow = this.attachShadow({mode: 'open'});
        this.root = this.shadow;
    }
}
