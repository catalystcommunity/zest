import { BaseComponent, observeResize, tokenAliases } from "@catalystcommunity/base-components";
import { SelectionModel, Typeahead } from "./selection.js";

// The common part of the list, the tree, and the table. Only the rows in the window, and a few more,
// are in the DOM. Rows are reused: a scroll of one row renders the content of one row.

// Browsers limit the height of an element (Firefox to about 17 million pixels). Above this height,
// the scroll position is scaled, so that a million rows still fit.
export const MAX_SCROLL_HEIGHT = 10_000_000;
const BUFFER = 4;

// The rows to show for a scroll position, with no DOM
export function virtualWindow({count, rowHeight, viewport, scrollTop, buffer = BUFFER, max = MAX_SCROLL_HEIGHT}) {
    const total = count * rowHeight;
    const height = Math.min(total, max);
    const ratio = total > height && height > viewport ? (total - viewport) / (height - viewport) : 1;
    const virtualTop = Math.max(0, Math.min(scrollTop * ratio, Math.max(0, total - viewport)));
    const first = Math.max(0, Math.floor(virtualTop / rowHeight) - buffer);
    const last = Math.min(count, Math.ceil((virtualTop + viewport) / rowHeight) + buffer);
    // The top of a row in the spacer, in pixels
    const top = (index) => scrollTop + index * rowHeight - virtualTop;
    return {count, rowHeight, viewport, scrollTop, total, height, ratio, virtualTop, first, last, top};
}

// The scroll position that shows the row, or null when the row is fully in the window
export function scrollTopFor(view, index) {
    const rowTop = index * view.rowHeight;
    let virtualTop = null;
    if (rowTop < view.virtualTop) {
        virtualTop = rowTop;
    } else if (rowTop + view.rowHeight > view.virtualTop + view.viewport) {
        virtualTop = rowTop + view.rowHeight - view.viewport;
    }
    return virtualTop === null ? null : Math.max(0, virtualTop / view.ratio);
}

// The CSS of one view. Each class has its own sheet, which all of its instances share.
export function viewStyles(tag) {
    return `
${tag}, :host {
    display: flex;
    flex-direction: column;
    min-width: 0;
    block-size: var(--zest-${tag}-height, var(--zest-data-view-height, 20em));
}
.zest-${tag} {
    ${tokenAliases(tag, 'data-view')}
    --_row-height: var(--zest-${tag}-row-height, var(--zest-data-view-row-height, 2em));
    --_indent: var(--zest-${tag}-indent, 1.25em);
}
.zest-${tag} {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    min-width: 0;
    background: var(--_window);
    color: var(--_window-text);
    border: var(--_border-width) solid var(--_border);
    border-radius: var(--_radius);
    overflow: hidden;
    overflow-wrap: normal;
}
.zest-${tag} .scroller {
    position: relative;
    flex: 1;
    min-height: 0;
    overflow: auto;
    overscroll-behavior: contain;
    overflow-anchor: none;
    outline: none;
}
.zest-${tag} .scroller:focus-visible {
    outline: var(--_focus-width) solid var(--_focus);
    outline-offset: calc(var(--_focus-width) * -1);
}
.zest-${tag} .spacer {
    position: relative;
    min-width: 100%;
}
.zest-${tag} .row {
    position: absolute;
    inset-block-start: 0;
    inset-inline: 0;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    gap: var(--_gap);
    height: var(--_row-height);
    padding-inline: 0.25em 0.5em;
    white-space: nowrap;
    overflow: hidden;
    border-inline-start: 0.25em solid transparent;
    cursor: default;
    user-select: none;
    contain: layout paint style;
}
.zest-${tag} .row[hidden] {
    display: none;
}
.zest-${tag} .row:hover {
    background: var(--_hover-face);
}
.zest-${tag} .row[aria-selected="true"] {
    background: var(--_selected-face);
    color: var(--_selected-text);
    border-inline-start-color: currentColor;
}
.zest-${tag} .row[aria-disabled="true"] {
    color: var(--_disabled-text);
}
.zest-${tag} .label {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
}
.zest-${tag} .scroller:focus-visible .active,
.zest-${tag} .scroller.keyboard:focus .active {
    outline: var(--_focus-width) solid var(--_focus);
    outline-offset: calc(var(--_focus-width) * -1);
}
.zest-${tag} .scroller:focus-visible [aria-selected="true"].active,
.zest-${tag} .scroller.keyboard:focus [aria-selected="true"].active,
.zest-${tag} .scroller:focus-visible [aria-selected="true"] .active,
.zest-${tag} .scroller.keyboard:focus [aria-selected="true"] .active {
    outline-color: var(--_selected-text);
    outline-offset: calc(var(--_focus-width) * -2);
}
.zest-${tag} .offscreen {
    clip-path: inset(50%);
    pointer-events: none;
}
.zest-${tag} .empty {
    padding: var(--_gap);
    color: var(--_secondary-text);
}
.zest-${tag} .empty[hidden] {
    display: none;
}
@media (forced-colors: active) {
    .zest-${tag} .row[aria-selected="true"] {
        forced-color-adjust: none;
        background: Highlight;
        color: HighlightText;
    }
    .zest-${tag} .scroller:focus-visible .active,
    .zest-${tag} .scroller.keyboard:focus .active {
        outline-color: CanvasText;
    }
}
`;
}

let instances = 0;

export class VirtualView extends BaseComponent {
    static renderTiming = 'frame';
    static properties = {
        label: {type: String, default: ''},
        multiple: {type: Boolean},
        // A row height in pixels. With 0, the view measures a row, which follows the CSS token.
        rowHeight: {type: Number, default: 0},
        emptyText: {type: String, default: 'No items'},
    };
    // The class of the outer element, for example zest-list-view
    static viewClass = 'zest-list-view';
    static scrollerRole = 'listbox';

    frame = null;
    scroller = null;
    spacer = null;
    header = null;
    selection = new SelectionModel();
    // The index of the row that has the keyboard focus
    active = -1;
    uid = `zdv${++instances}`;
    #rows = new Map();
    #pool = [];
    #dirty = new Set();
    #allDirty = true;
    #measured = 0;
    #view = null;
    #typeahead = new Typeahead();
    #emptyText = null;

    // A child class gives these
    get rowCount() { return 0; }
    keyAt(index) { return index; }
    textAt(index) { return ''; }
    createRow() { return document.createElement('div'); }
    // The content of a row. The view calls it when a row gets a new index, or after refreshRow.
    renderRow(row, index) { }
    // The state of a row: selection and focus. The view calls it for each visible row in each render.
    paintRow(row, index) { }
    buildHeader() { return null; }
    // Return true when the key is used
    onKey(event) { return false; }
    onRowClick(index, event) { this.selectFromPointer(index, event); }
    onRowDoubleClick(index, event) { }
    // The id for aria-activedescendant
    activeDescendant() { return this.#rows.get(this.active)?.id ?? null; }

    connectedCallback() {
        super.connectedCallback();
        if (!this.frame) {
            this.#build();
            this.built();
        }
        this.listen(this.scroller, 'scroll', () => this.invalidate(), {passive: true});
        this.listen(this.scroller, 'keydown', (e) => this.#onKeydown(e));
        this.listen(this.scroller, 'pointerdown', () => this.scroller.classList.remove('keyboard'));
        this.listen(this.scroller, 'click', (e) => {
            const row = this.#rowOf(e);
            if (row) { this.onRowClick(Number(row.dataset.index), e); }
        });
        this.listen(this.scroller, 'dblclick', (e) => {
            const row = this.#rowOf(e);
            if (row) { this.onRowDoubleClick(Number(row.dataset.index), e); }
        });
        this.own(observeResize(this.scroller, () => this.invalidate()));
        this.render();
    }

    propertyChanged(name) {
        if (name === 'multiple') {
            this.selection.multiple = this.multiple;
            if (!this.multiple && this.selection.size > 1) { this.selection.set(this.selection.keys); }
        }
        if (name === 'rowHeight') { this.#measured = 0; }
        this.#allDirty = true;
    }

    #build() {
        const root = this.constructor;
        this.frame = document.createElement('div');
        this.frame.className = `zest-data-view ${root.viewClass}`;
        this.frame.setAttribute('part', 'view');
        this.scroller = document.createElement('div');
        this.scroller.className = 'scroller';
        this.scroller.setAttribute('role', root.scrollerRole);
        this.scroller.setAttribute('part', 'scroller');
        this.scroller.tabIndex = 0;
        this.header = this.buildHeader();
        this.spacer = document.createElement('div');
        this.spacer.className = 'spacer';
        this.spacer.setAttribute('role', 'presentation');
        this.#emptyText = document.createElement('div');
        this.#emptyText.className = 'empty';
        this.#emptyText.setAttribute('role', 'presentation');
        this.scroller.append(...[this.header, this.spacer].filter(Boolean));
        this.frame.append(this.scroller);
        this.root.replaceChildren(this.frame);
        this.applyStyles(this.frame);
    }

    #rowOf(e) {
        const row = e.target.closest?.('[data-index]');
        return row && this.spacer.contains(row) ? row : null;
    }

    get rowHeightPixels() {
        return this.rowHeight > 0 ? this.rowHeight : (this.#measured || 32);
    }

    // The visible window after the last render
    get window() { return this.#view; }

    // Renders the content of one row again, for example after its item changed
    refreshRow(index) {
        this.#dirty.add(index);
        this.invalidate();
    }

    // Renders the content of each row again
    refresh() {
        this.#allDirty = true;
        this.invalidate();
    }

    render() {
        if (!this.frame) { return; }
        const count = this.rowCount;
        const rowHeight = this.rowHeightPixels;
        this.frame.style.setProperty('--_row-height', this.rowHeight > 0 ? `${this.rowHeight}px` : '');
        if (this.label) { this.scroller.setAttribute('aria-label', this.label); } else { this.scroller.removeAttribute('aria-label'); }
        this.scroller.setAttribute('aria-multiselectable', String(this.multiple));
        const headerHeight = this.header?.offsetHeight || 0;
        // A view with no fixed height grows to all of its rows. The rows that it renders stay
        // limited to two windows of rows, so that a layout mistake cannot make 100,000 rows.
        const limit = (globalThis.innerHeight || 1000) * 2;
        const viewport = Math.max(rowHeight, Math.min(this.scroller.clientHeight || rowHeight * 20, limit) - headerHeight);
        const view = virtualWindow({count, rowHeight, viewport, scrollTop: this.scroller.scrollTop});
        this.#view = view;
        const height = `${view.height}px`;
        if (this.spacer.style.height !== height) { this.spacer.style.height = height; }

        if (this.active >= count) { this.active = count - 1; }
        const needed = new Set();
        for (let i = view.first; i < view.last; i++) { needed.add(i); }
        // The row with the focus stays in the DOM, so that aria-activedescendant always has a target
        if (this.active >= 0) { needed.add(this.active); }

        for (const [index, row] of this.#rows) {
            if (needed.has(index)) { continue; }
            this.#rows.delete(index);
            row.hidden = true;
            row.removeAttribute('id');
            this.#pool.push(row);
        }
        for (const index of needed) {
            let row = this.#rows.get(index);
            const fresh = !row;
            if (fresh) {
                row = this.#pool.pop() ?? this.spacer.appendChild(this.#newRow());
                row.hidden = false;
                this.#rows.set(index, row);
            }
            if (fresh || this.#allDirty || this.#dirty.has(index)) {
                row.dataset.index = String(index);
                this.renderRow(row, index);
            }
            this.paintRow(row, index);
            const top = view.top(index);
            const transform = `translateY(${top}px)`;
            if (row.style.transform !== transform) { row.style.transform = transform; }
            row.classList.toggle('offscreen', index < view.first || index >= view.last);
        }
        this.#allDirty = false;
        this.#dirty.clear();

        this.#emptyText.textContent = this.emptyText;
        this.#emptyText.hidden = count > 0;
        if (count === 0 && !this.#emptyText.isConnected) { this.spacer.append(this.#emptyText); }

        const descendant = this.activeDescendant();
        if (descendant) {
            this.scroller.setAttribute('aria-activedescendant', descendant);
        } else {
            this.scroller.removeAttribute('aria-activedescendant');
        }
        this.afterRender(view);
        this.#measure(rowHeight);
    }

    afterRender(view) { }
    // After the view makes its elements, one time
    built() { }

    // Removes each row element, for example when the columns change
    resetRows() {
        for (const row of [...this.#rows.values(), ...this.#pool]) { row.remove(); }
        this.#rows.clear();
        this.#pool = [];
        this.refresh();
    }

    #newRow() {
        const row = this.createRow();
        row.classList.add('row');
        return row;
    }

    // The CSS gives the height of a row. Measure one row, and render again if it is different.
    #measure(rowHeight) {
        if (this.rowHeight > 0) { return; }
        const row = this.#rows.values().next().value;
        const height = row?.getBoundingClientRect().height;
        if (height > 0 && Math.abs(height - rowHeight) > 0.25) {
            this.#measured = height;
            this.invalidate();
        }
    }

    // The element of a visible row, or null
    rowElement(index) { return this.#rows.get(index) ?? null; }
    get renderedRows() { return [...this.#rows.entries()]; }

    scrollToIndex(index) {
        if (!this.frame || index < 0 || index >= this.rowCount) { return; }
        if (!this.#view || this.#view.count !== this.rowCount) { this.render(); }
        const top = scrollTopFor(this.#view, index);
        if (top !== null) { this.scroller.scrollTop = top; }
        this.render();
    }

    // Moves the focus to a row. Shift extends the selection, and Ctrl moves only the focus.
    moveActive(index, {shift = false, ctrl = false} = {}, event = null) {
        const count = this.rowCount;
        if (!count) { return; }
        index = Math.max(0, Math.min(count - 1, index));
        this.active = index;
        let changed = false;
        if (shift && this.multiple) {
            changed = this.selection.extend(index, (i) => this.keyAt(i));
        } else if (!(ctrl && this.multiple)) {
            changed = this.selection.selectOnly(index, (i) => this.keyAt(i));
        }
        this.scrollToIndex(index);
        if (changed) { this.selectionChanged(event); }
    }

    selectFromPointer(index, event) {
        this.active = index;
        const changed = this.selection.fromPointer(index, event, (i) => this.keyAt(i));
        this.render();
        if (changed) { this.selectionChanged(event); }
    }

    // A child class sends its event here
    selectionChanged(event) { }

    get pageSize() {
        return Math.max(1, Math.floor((this.#view?.viewport ?? 0) / this.rowHeightPixels) - 1);
    }

    #onKeydown(e) {
        if (e.defaultPrevented) { return; }
        this.scroller.classList.add('keyboard');
        if (this.onKey(e)) { e.preventDefault(); return; }
        const count = this.rowCount;
        if (!count) { return; }
        const ctrl = e.ctrlKey || e.metaKey;
        const mods = {shift: e.shiftKey, ctrl};
        const at = this.active < 0 ? 0 : this.active;
        const moves = {
            ArrowDown: this.active < 0 ? 0 : at + 1,
            ArrowUp: this.active < 0 ? 0 : at - 1,
            PageDown: at + this.pageSize,
            PageUp: at - this.pageSize,
            Home: 0,
            End: count - 1,
        };
        if (e.key in moves && !e.altKey) {
            e.preventDefault();
            this.moveActive(moves[e.key], mods, e);
            return;
        }
        if (ctrl && e.key.toLowerCase() === 'a' && this.multiple) {
            e.preventDefault();
            this.selection.selectAll(count, (i) => this.keyAt(i));
            this.render();
            this.selectionChanged(e);
            return;
        }
        if (e.key === ' ' && !e.altKey) {
            e.preventDefault();
            if (this.active < 0) { this.moveActive(0, {}, e); return; }
            const changed = ctrl || this.multiple
                ? this.selection.toggle(this.active, (i) => this.keyAt(i))
                : this.selection.selectOnly(this.active, (i) => this.keyAt(i));
            this.render();
            if (changed) { this.selectionChanged(e); }
            return;
        }
        if (e.key.length === 1 && e.key.trim() && !ctrl && !e.altKey) {
            const found = this.#typeahead.find(e.key, at, count, (i) => this.textAt(i));
            if (found >= 0) {
                e.preventDefault();
                this.moveActive(found, {}, e);
            }
        }
    }

    // The keys of the selected rows
    get selectedKeys() { return this.selection.keys; }
    set selectedKeys(keys) {
        this.selection.set(keys ?? []);
        this.invalidate();
    }

    // The index of a key, or -1
    indexOfKey(key) {
        for (let i = 0; i < this.rowCount; i++) {
            if (Object.is(this.keyAt(i), key)) { return i; }
        }
        return -1;
    }

    focus(options) {
        this.scroller?.focus(options);
    }
}
