import { VirtualView, viewStyles } from "./virtual.js";

// A list of items. Only the visible rows are in the DOM, so a list of a million items opens quickly.
export class ListView extends VirtualView {
    static styles = viewStyles('list-view');
    static viewClass = 'zest-list-view';
    static scrollerRole = 'listbox';
    static properties = {
        items: {type: Array, attribute: false, default: () => []},
        // renderItem(item, row, index) changes the children of a reused row
        renderItem: {type: Function, attribute: false},
        // itemText(item) gives the text for typeahead and for the default row
        itemText: {type: Function, attribute: false},
        // keyOf(item, index) gives a key that stays with the item. The default is item.id, then the index.
        keyOf: {type: Function, attribute: false},
    };

    propertyChanged(name, oldValue, newValue) {
        super.propertyChanged(name, oldValue, newValue);
        if (name === 'items') { this.active = Math.min(this.active, this.items.length - 1); }
    }

    get rowCount() { return this.items.length; }

    keyAt(index) {
        const item = this.items[index];
        return this.keyOf ? this.keyOf(item, index) : (item?.id ?? index);
    }

    textAt(index) {
        const item = this.items[index];
        return this.itemText ? this.itemText(item) : (item?.label ?? item?.text ?? item?.name ?? (typeof item === 'object' ? '' : String(item)));
    }

    createRow() {
        const row = document.createElement('div');
        row.setAttribute('role', 'option');
        row.setAttribute('part', 'item');
        return row;
    }

    renderRow(row, index) {
        row.id = `${this.uid}-${index}`;
        row.setAttribute('aria-posinset', String(index + 1));
        row.setAttribute('aria-setsize', String(this.items.length));
        if (this.renderItem) {
            this.renderItem(this.items[index], row, index);
            return;
        }
        let label = row.firstElementChild;
        if (!label?.classList.contains('zest-label')) {
            label = document.createElement('span');
            label.className = 'zest-label';
            row.replaceChildren(label);
        }
        label.textContent = this.textAt(index);
    }

    paintRow(row, index) {
        const selected = String(this.selection.has(this.keyAt(index)));
        if (row.getAttribute('aria-selected') !== selected) { row.setAttribute('aria-selected', selected); }
        row.classList.toggle('zest-active', index === this.active);
    }

    onKey(e) {
        if (e.key === 'Enter' && this.active >= 0) {
            this.#activate(this.active, e);
            return true;
        }
        return false;
    }

    onRowDoubleClick(index, e) { this.#activate(index, e); }

    #activate(index, event) {
        this.emit('list-view-activate', {index, key: this.keyAt(index), item: this.items[index], pointer: event?.type === 'dblclick'});
    }

    selectionChanged() {
        const index = this.active;
        this.emit('list-view-select', {keys: this.selectedKeys, index, key: index >= 0 ? this.keyAt(index) : null, item: this.items[index] ?? null});
    }

    // The items whose keys are selected, in the order of the list
    get selectedItems() {
        return this.items.filter((item, index) => this.selection.has(this.keyAt(index)));
    }

    // Renders the row of one item again, after the item changed
    refreshItem(item) {
        const index = this.items.indexOf(item);
        if (index >= 0) { this.refreshRow(index); }
    }
}

export class ShadowListView extends ListView {
    shadow;
    constructor() {
        super();
        this.shadow = this.attachShadow({mode: 'open'});
        this.root = this.shadow;
    }
}
