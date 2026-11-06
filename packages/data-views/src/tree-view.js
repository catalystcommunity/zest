import { isRtl } from "@catalystcommunity/base-components";
import { VirtualView, viewStyles } from "./virtual.js";

const treeStyles = `
.zest-tree-view .row {
    padding-inline-start: calc(0.25em + var(--_level, 0) * var(--_indent));
    gap: 0.25em;
}
.zest-tree-view .twisty, .zest-tree-view .check {
    display: inline-flex;
    flex: none;
    align-items: center;
    justify-content: center;
    min-width: 1.5em;
    min-height: 1.5em;
}
.zest-tree-view .check[hidden] {
    display: none;
}
.zest-tree-view .twisty::before {
    content: "";
}
.zest-tree-view [aria-expanded="false"] > .twisty::before {
    content: "▸";
}
.zest-tree-view [aria-expanded="true"] > .twisty::before {
    content: "▾";
}
.zest-tree-view [aria-busy="true"] > .twisty::before {
    content: "…";
}
.zest-tree-view .scroller:dir(rtl) [aria-expanded="false"] > .twisty::before {
    content: "◂";
}
.zest-tree-view .check::before {
    content: "";
    box-sizing: border-box;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1em;
    height: 1em;
    font-size: 0.875em;
    line-height: 1;
    background: var(--_field);
    color: var(--_field-text);
    border: var(--_border-width) solid var(--_border);
    border-radius: 0.2em;
}
.zest-tree-view [aria-checked="true"] > .check::before {
    content: "✓";
    background: var(--_highlight);
    color: var(--_highlight-text);
    border-color: var(--_highlight);
}
.zest-tree-view [aria-checked="mixed"] > .check::before {
    content: "–";
    background: var(--_highlight);
    color: var(--_highlight-text);
    border-color: var(--_highlight);
}
.zest-tree-view .icon {
    flex: none;
}
.zest-tree-view .icon:empty {
    display: none;
}
.zest-tree-view .loading {
    font-style: italic;
    color: var(--_secondary-text);
}
@media (forced-colors: active) {
    .zest-tree-view [aria-checked] > .check::before {
        forced-color-adjust: none;
        background: Canvas;
        color: CanvasText;
        border-color: CanvasText;
    }
}
`;

// A tree of nodes. A node is {id, label, icon, children, hasChildren, expanded, checked, disabled}.
// With hasChildren and no children, the tree calls loadChildren(node) when the node opens.
// Only the visible rows are in the DOM.
export class TreeView extends VirtualView {
    static styles = viewStyles('tree-view') + treeStyles;
    static viewClass = 'zest-tree-view';
    static scrollerRole = 'tree';
    static properties = {
        items: {type: Array, attribute: false, default: () => []},
        // async loadChildren(node) gives the children of a node that has hasChildren and no children
        loadChildren: {type: Function, attribute: false},
        // renderItem(node, label, entry) changes the label element of a reused row
        renderItem: {type: Function, attribute: false},
        keyOf: {type: Function, attribute: false},
        checkboxes: {type: Boolean},
        loadingText: {type: String, default: 'Loading…'},
    };

    #visible = [];
    #stale = true;
    #expanded = new Set();
    #seen = new WeakSet();
    #loading = new Set();
    #checked = new Map();
    #states = new Map();

    propertyChanged(name, oldValue, newValue) {
        super.propertyChanged(name, oldValue, newValue);
        if (name === 'items' || name === 'keyOf') {
            this.#stale = true;
            this.#states.clear();
        }
        if (name === 'checkboxes') { this.#states.clear(); }
    }

    key(node) { return this.keyOf ? this.keyOf(node) : (node.id ?? node); }

    // The visible rows, in order: {node, level, parent, posinset, setsize}
    get visibleEntries() {
        if (this.#stale) { this.#flatten(); }
        return this.#visible;
    }

    #flatten() {
        const activeKey = this.active >= 0 ? this.#keyOfEntry(this.#visible[this.active]) : undefined;
        const visible = [];
        const walk = (nodes, level, parent) => {
            nodes.forEach((node, i) => {
                const key = this.key(node);
                // A node with expanded: true starts open, one time
                if (node.expanded && !this.#seen.has(node)) { this.#expanded.add(key); }
                this.#seen.add(node);
                const entry = {node, key, level, parent, posinset: i + 1, setsize: nodes.length};
                visible.push(entry);
                if (!this.#expanded.has(key)) { return; }
                if (Array.isArray(node.children)) {
                    walk(node.children, level + 1, entry);
                } else if (this.#loading.has(key)) {
                    visible.push({loading: true, level: level + 1, parent: entry, posinset: 1, setsize: 1, key: `loading:${String(key)}`});
                }
            });
        };
        walk(this.items, 1, null);
        this.#visible = visible;
        this.#stale = false;
        if (activeKey !== undefined) {
            const index = visible.findIndex(entry => Object.is(entry.key, activeKey));
            this.active = index >= 0 ? index : Math.min(this.active, visible.length - 1);
        }
    }

    #keyOfEntry(entry) { return entry?.key; }

    get rowCount() { return this.visibleEntries.length; }
    keyAt(index) { return this.visibleEntries[index]?.key; }
    textAt(index) { return this.visibleEntries[index]?.node?.label ?? ''; }

    hasChildren(node) {
        return Array.isArray(node.children) ? node.children.length > 0 : Boolean(node.hasChildren);
    }

    isExpanded(node) { return this.#expanded.has(this.key(node)); }

    // Opens or closes a node. A node with no children yet gets them from loadChildren.
    async setExpanded(node, expanded, event = null) {
        const key = this.key(node);
        if (!this.hasChildren(node) || this.#expanded.has(key) === expanded) { return; }
        if (expanded) { this.#expanded.add(key); } else { this.#expanded.delete(key); }
        this.#changed();
        this.emit('tree-view-expand', {key, node, expanded, keyboard: event?.type === 'keydown'});
        if (!expanded || Array.isArray(node.children) || this.#loading.has(key)) { return; }
        if (typeof this.loadChildren !== 'function') {
            throw new Error('A node has hasChildren and no children, and the tree has no loadChildren function');
        }
        this.#loading.add(key);
        this.#changed();
        try {
            const children = await this.loadChildren(node);
            node.children = Array.isArray(children) ? children : [];
            // The children of a checked node are checked
            const state = this.#checked.get(key);
            if (state !== undefined) { this.#setChecked(node, state); }
        } catch (error) {
            this.#expanded.delete(key);
            this.emit('tree-view-load-error', {key, node, error});
        } finally {
            this.#loading.delete(key);
            this.#states.clear();
            this.#changed();
        }
    }

    // Opens each parent of a node in the loaded data, so that the node is visible, and focuses it
    reveal(key) {
        const path = [];
        const find = (nodes) => nodes?.some(node => {
            path.push(node);
            if (Object.is(this.key(node), key) || find(node.children)) { return true; }
            path.pop();
            return false;
        });
        if (!find(this.items)) { return false; }
        for (const node of path.slice(0, -1)) { this.#expanded.add(this.key(node)); }
        this.#changed();
        this.active = this.indexOfKey(key);
        this.scrollToIndex(this.active);
        return true;
    }

    #changed() {
        this.#stale = true;
        this.refresh();
    }

    // The check state of a node: true, false, or 'mixed', from its loaded children
    checkState(node) {
        const key = this.key(node);
        if (this.#states.has(key)) { return this.#states.get(key); }
        let state;
        if (Array.isArray(node.children) && node.children.length) {
            const states = new Set(node.children.map(child => this.checkState(child)));
            state = states.size === 1 ? [...states][0] : 'mixed';
        } else {
            state = this.#checked.get(key) ?? Boolean(node.checked);
        }
        this.#states.set(key, state);
        return state;
    }

    #setChecked(node, checked) {
        this.#checked.set(this.key(node), checked);
        for (const child of Array.isArray(node.children) ? node.children : []) { this.#setChecked(child, checked); }
    }

    toggleChecked(node, event = null) {
        if (node.disabled) { return; }
        const checked = this.checkState(node) !== true;
        this.#setChecked(node, checked);
        this.#states.clear();
        this.refresh();
        this.emit('tree-view-check', {key: this.key(node), node, checked, keyboard: event?.type === 'keydown'});
    }

    // The keys of the checked nodes that have no checked parent
    get checkedKeys() {
        const keys = [];
        const walk = (nodes) => {
            for (const node of nodes ?? []) {
                const state = this.checkState(node);
                if (state === true) { keys.push(this.key(node)); } else if (state === 'mixed') { walk(node.children); }
            }
        };
        walk(this.items);
        return keys;
    }

    createRow() {
        const row = document.createElement('div');
        row.setAttribute('role', 'treeitem');
        row.setAttribute('part', 'item');
        row.innerHTML = '<span class="twisty" aria-hidden="true"></span><span class="check" aria-hidden="true"></span><span class="icon" aria-hidden="true"></span><span class="label"></span>';
        return row;
    }

    renderRow(row, index) {
        const entry = this.visibleEntries[index];
        row.id = `${this.uid}-${index}`;
        row.style.setProperty('--_level', String(entry.level - 1));
        row.setAttribute('aria-level', String(entry.level));
        row.setAttribute('aria-posinset', String(entry.posinset));
        row.setAttribute('aria-setsize', String(entry.setsize));
        const [, check, icon, label] = row.children;
        row.classList.toggle('loading', Boolean(entry.loading));
        if (entry.loading) {
            for (const name of ['aria-expanded', 'aria-checked', 'aria-busy']) { row.removeAttribute(name); }
            row.setAttribute('aria-disabled', 'true');
            check.hidden = true;
            icon.textContent = '';
            label.textContent = this.loadingText;
            return;
        }
        const node = entry.node;
        if (this.hasChildren(node)) {
            row.setAttribute('aria-expanded', String(this.#expanded.has(entry.key)));
        } else {
            row.removeAttribute('aria-expanded');
        }
        row.toggleAttribute('aria-busy', this.#loading.has(entry.key));
        if (this.#loading.has(entry.key)) { row.setAttribute('aria-busy', 'true'); }
        if (node.disabled) { row.setAttribute('aria-disabled', 'true'); } else { row.removeAttribute('aria-disabled'); }
        check.hidden = !this.checkboxes;
        if (this.checkboxes) {
            row.setAttribute('aria-checked', String(this.checkState(node)));
        } else {
            row.removeAttribute('aria-checked');
        }
        icon.textContent = node.icon ?? '';
        if (this.renderItem) {
            this.renderItem(node, label, entry);
        } else {
            label.textContent = node.label ?? '';
        }
    }

    paintRow(row, index) {
        const entry = this.visibleEntries[index];
        // A tree with check boxes shows the checks, and the selection is only the focus
        const selected = entry.loading ? null : String(this.selection.has(entry.key));
        if (selected === null) {
            row.removeAttribute('aria-selected');
        } else if (row.getAttribute('aria-selected') !== selected) {
            row.setAttribute('aria-selected', selected);
        }
        row.classList.toggle('active', index === this.active);
    }

    onRowClick(index, e) {
        const entry = this.visibleEntries[index];
        if (!entry || entry.loading) { return; }
        if (e.target.closest('.twisty')) {
            this.active = index;
            this.setExpanded(entry.node, !this.isExpanded(entry.node), e);
            return;
        }
        if (this.checkboxes && e.target.closest('.check')) {
            this.active = index;
            this.toggleChecked(entry.node, e);
            return;
        }
        this.selectFromPointer(index, e);
    }

    onRowDoubleClick(index, e) {
        const entry = this.visibleEntries[index];
        if (!entry || entry.loading || e.target.closest('.twisty, .check')) { return; }
        if (this.#activate(entry, e) && this.hasChildren(entry.node)) {
            this.setExpanded(entry.node, !this.isExpanded(entry.node), e);
        }
    }

    // Returns false when the application cancels the event
    #activate(entry, event) {
        return this.emit('tree-view-activate', {key: entry.key, node: entry.node, keyboard: event?.type === 'keydown'}, {cancelable: true});
    }

    onKey(e) {
        const entries = this.visibleEntries;
        const entry = entries[this.active];
        if (!entry || e.altKey || e.ctrlKey || e.metaKey) { return false; }
        const rtl = isRtl(this.scroller);
        const forward = rtl ? 'ArrowLeft' : 'ArrowRight';
        const back = rtl ? 'ArrowRight' : 'ArrowLeft';
        const node = entry.node;
        if (e.key === forward && !entry.loading) {
            if (this.hasChildren(node) && !this.isExpanded(node)) {
                this.setExpanded(node, true, e);
            } else if (this.isExpanded(node) && entries[this.active + 1]?.parent === entry) {
                this.moveActive(this.active + 1, {}, e);
            }
            return true;
        }
        if (e.key === back) {
            if (!entry.loading && this.isExpanded(node)) {
                this.setExpanded(node, false, e);
            } else if (entry.parent) {
                this.moveActive(entries.indexOf(entry.parent), {}, e);
            }
            return true;
        }
        if (e.key === 'Enter' && !entry.loading) {
            this.#activate(entry, e);
            return true;
        }
        if (e.key === '*' && !entry.loading) {
            const siblings = entry.parent ? entry.parent.node.children : this.items;
            for (const sibling of siblings) { this.setExpanded(sibling, true, e); }
            return true;
        }
        if (e.key === ' ' && this.checkboxes && !entry.loading && !e.shiftKey) {
            this.toggleChecked(node, e);
            return true;
        }
        return false;
    }

    selectionChanged() {
        const entry = this.visibleEntries[this.active];
        this.emit('tree-view-select', {keys: this.selectedKeys, key: entry?.key ?? null, node: entry?.node ?? null});
    }
}

export class ShadowTreeView extends TreeView {
    shadow;
    constructor() {
        super();
        this.shadow = this.attachShadow({mode: 'open'});
        this.root = this.shadow;
    }
}
