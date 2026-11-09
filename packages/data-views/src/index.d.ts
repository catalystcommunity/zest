// Type declarations for @catalystcommunity/data-views. The source is JavaScript; keep this
// file in step with src/*.js. __tests__/types.spec.js checks that each export has a declaration.
import { BaseComponent } from '@catalystcommunity/base-components';

/** A key that stays with an item. The default is `item.id`, then the index (for a tree, the node). */
export type ViewKey = unknown;
export type KeyAt = (index: number) => ViewKey;

/** The selection of a view, with no DOM. It keeps keys, so it stays with the items when the order changes. */
export declare class ViewSelection {
    constructor(options?: {multiple?: boolean});
    multiple: boolean;
    /** The index where a Shift range starts, or -1. */
    anchor: number;
    has(key: ViewKey): boolean;
    readonly size: number;
    readonly keys: ViewKey[];
    /** Returns true when the selection changed. */
    clear(): boolean;
    /** Replaces the selection. A single selection keeps only the first key. */
    set(keys: Iterable<ViewKey>): void;
    /** Each of these returns true when the selection changed. */
    selectOnly(index: number, keyAt: KeyAt): boolean;
    toggle(index: number, keyAt: KeyAt): boolean;
    extend(index: number, keyAt: KeyAt): boolean;
    selectAll(count: number, keyAt: KeyAt): boolean;
    /** Shift extends, Ctrl or Meta toggles, and a plain click selects one. */
    fromPointer(index: number, event: {shiftKey?: boolean; ctrlKey?: boolean; metaKey?: boolean}, keyAt: KeyAt): boolean;
}

/** Finds the next row whose text starts with the letters typed in the last second. */
export declare class ViewTypeahead {
    /** Returns the index, or -1. */
    find(key: string, start: number, count: number, textAt: (index: number) => unknown, now?: number): number;
}

export declare const MAX_VIRTUAL_HEIGHT: number;

export interface VirtualWindowOptions {
    count: number;
    rowHeight: number;
    viewport: number;
    scrollTop: number;
    buffer?: number;
    max?: number;
}

export interface VirtualWindow {
    count: number;
    rowHeight: number;
    viewport: number;
    scrollTop: number;
    /** The height of all rows. */
    total: number;
    /** The height of the spacer, at most `max`. */
    height: number;
    /** The scale from the scroll position to the virtual position. */
    ratio: number;
    virtualTop: number;
    /** The first row to render. */
    first: number;
    /** The row after the last row to render. */
    last: number;
    /** The top of a row in the spacer, in pixels. */
    top(index: number): number;
}

/** The rows to show for a scroll position, with no DOM. */
export declare function virtualWindow(options: VirtualWindowOptions): VirtualWindow;
/** The scroll position that shows the row, or null when the row is fully in the window. */
export declare function virtualScrollTop(view: Pick<VirtualWindow, 'rowHeight' | 'virtualTop' | 'viewport' | 'ratio'>, index: number): number | null;

/** The common part of the list, the tree, and the table. Only the visible rows are in the DOM. */
export declare class VirtualView extends BaseComponent {
    /** The class of the outer element, for example `zest-list-view`. */
    static viewClass: string;
    static scrollerRole: string;

    /** The accessible name. Attribute `label`. */
    label: string;
    multiple: boolean;
    /** A row height in pixels. With 0, the view measures a row. Attribute `row-height`. */
    rowHeight: number;
    /** Attribute `empty-text`. The default is "No items". */
    emptyText: string;

    frame: HTMLDivElement | null;
    scroller: HTMLDivElement | null;
    spacer: HTMLDivElement | null;
    header: HTMLElement | null;
    selection: ViewSelection;
    /** The index of the row that has the keyboard focus, or -1. */
    active: number;
    /** A unique id prefix for the row ids. */
    uid: string;

    // A child class gives these
    readonly rowCount: number;
    keyAt(index: number): ViewKey;
    textAt(index: number): string;
    createRow(): HTMLElement;
    /** The content of a row. The view calls it when a row gets a new index, or after `refreshRow`. */
    renderRow(row: HTMLElement, index: number): void;
    /** The state of a row: selection and focus. The view calls it for each visible row in each render. */
    paintRow(row: HTMLElement, index: number): void;
    buildHeader(): HTMLElement | null;
    /** Return true when the key is used. */
    onKey(event: KeyboardEvent): boolean;
    onRowClick(index: number, event: MouseEvent): void;
    onRowDoubleClick(index: number, event: MouseEvent): void;
    /** The id for `aria-activedescendant`. */
    activeDescendant(): string | null;
    afterRender(view: VirtualWindow): void;
    /** After the view makes its elements, one time. */
    built(): void;
    /** A child class sends its select event here. */
    selectionChanged(event?: Event | null): void;

    readonly rowHeightPixels: number;
    /** The visible window after the last render. */
    readonly window: VirtualWindow | null;
    /** Renders the content of one row again, for example after its item changed. */
    refreshRow(index: number): void;
    /** Renders the content of each visible row again. */
    refresh(): void;
    /** Removes each row element, for example when the columns change. */
    resetRows(): void;
    /** The element of a visible row, or null. */
    rowElement(index: number): HTMLElement | null;
    readonly renderedRows: [number, HTMLElement][];
    scrollToIndex(index: number): void;
    /** Moves the focus to a row. Shift extends the selection, and Ctrl moves only the focus. */
    moveActive(index: number, modifiers?: {shift?: boolean; ctrl?: boolean}, event?: Event | null): void;
    selectFromPointer(index: number, event: MouseEvent): void;
    readonly pageSize: number;
    /** The keys of the selected rows. Set it to change the selection. */
    get selectedKeys(): ViewKey[];
    set selectedKeys(keys: Iterable<ViewKey> | null | undefined);
    /** The index of a key, or -1. */
    indexOfKey(key: ViewKey): number;
    focus(options?: FocusOptions): void;
}

// ListView

export interface ListViewSelectDetail<T = unknown> {
    keys: ViewKey[];
    index: number;
    key: ViewKey | null;
    item: T | null;
}

export interface ListViewActivateDetail<T = unknown> {
    index: number;
    key: ViewKey;
    item: T;
    /** True for a double click, false for Enter. */
    pointer: boolean;
}

export declare class ListView<T = unknown> extends VirtualView {
    items: T[];
    /** Changes the children of a reused row. Change only what is different, and do not add listeners. */
    renderItem?: ((item: T, row: HTMLElement, index: number) => void) | null;
    /** The text for typeahead and for the default row. The default is `label`, `text`, `name`, then the item as text. */
    itemText?: ((item: T) => string) | null;
    keyOf?: ((item: T, index: number) => ViewKey) | null;
    /** The selected items, in the order of the list. */
    readonly selectedItems: T[];
    /** Renders the row of one item again, after the item changed. */
    refreshItem(item: T): void;
}

export declare class ShadowListView<T = unknown> extends ListView<T> {
    shadow: ShadowRoot;
}

// TreeView

export interface TreeNode {
    id?: unknown;
    label?: string;
    /** Text, for example an emoji. Screen readers do not read it. */
    icon?: string;
    children?: TreeNode[];
    /** With no `children`, the tree calls `loadChildren` when the node opens. */
    hasChildren?: boolean;
    /** Opens the node one time, when the tree first sees it. */
    expanded?: boolean;
    checked?: boolean;
    disabled?: boolean;
}

/** A visible row of a tree. */
export interface TreeEntry<N extends TreeNode = TreeNode> {
    node: N;
    key: ViewKey;
    /** 1 for a top node. */
    level: number;
    parent: TreeEntry<N> | null;
    posinset: number;
    setsize: number;
}

/** The row that shows while the children of `parent` load. */
export interface TreeLoadingEntry<N extends TreeNode = TreeNode> {
    loading: true;
    key: string;
    level: number;
    parent: TreeEntry<N>;
    posinset: number;
    setsize: number;
}

export type TreeCheckState = boolean | 'mixed';

export interface TreeViewSelectDetail<N extends TreeNode = TreeNode> { keys: ViewKey[]; key: ViewKey | null; node: N | null; }
export interface TreeViewExpandDetail<N extends TreeNode = TreeNode> { key: ViewKey; node: N; expanded: boolean; keyboard: boolean; }
/** Cancelable: on a double click, `preventDefault()` stops the open or close. */
export interface TreeViewActivateDetail<N extends TreeNode = TreeNode> { key: ViewKey; node: N; keyboard: boolean; }
export interface TreeViewCheckDetail<N extends TreeNode = TreeNode> { key: ViewKey; node: N; checked: boolean; keyboard: boolean; }
export interface TreeViewLoadErrorDetail<N extends TreeNode = TreeNode> { key: ViewKey; node: N; error: unknown; }

export declare class TreeView<N extends TreeNode = TreeNode> extends VirtualView {
    items: N[];
    /** Gives the children of a node that has `hasChildren` and no `children`. */
    loadChildren?: ((node: N) => Promise<N[]> | N[]) | null;
    /** Changes the label element of a reused row. */
    renderItem?: ((node: N, label: HTMLElement, entry: TreeEntry<N>) => void) | null;
    keyOf?: ((node: N) => ViewKey) | null;
    checkboxes: boolean;
    /** Attribute `loading-text`. The default is "Loading…". */
    loadingText: string;

    key(node: N): ViewKey;
    /** The visible rows, in order. */
    readonly visibleEntries: (TreeEntry<N> | TreeLoadingEntry<N>)[];
    hasChildren(node: N): boolean;
    isExpanded(node: N): boolean;
    /** Opens or closes a node. A node with no children yet gets them from `loadChildren`. */
    setExpanded(node: N, expanded: boolean, event?: Event | null): Promise<void>;
    /** Opens each parent of a loaded node and moves the focus to it. Returns false if no node has the key. */
    reveal(key: ViewKey): boolean;
    /** The check state of a node, from its loaded children. */
    checkState(node: N): TreeCheckState;
    toggleChecked(node: N, event?: Event | null): void;
    /** The keys of the checked nodes that have no checked parent. */
    readonly checkedKeys: ViewKey[];
}

export declare class ShadowTreeView<N extends TreeNode = TreeNode> extends TreeView<N> {
    shadow: ShadowRoot;
}

// TableView

export type SortDirection = 'ascending' | 'descending';

export interface TableColumn<T = unknown> {
    key: string;
    label?: string;
    /** Pixels. The default is 150, and the smallest width is 48. */
    width?: number;
    type?: 'text' | 'number' | 'date' | 'boolean';
    sortable?: boolean;
    resizable?: boolean;
    align?: 'start' | 'end' | 'right' | 'center';
    /** Gives the text of a cell. */
    format?(value: unknown, item: T): string;
    /** Changes a cell element that the view reuses. */
    render?(cell: HTMLElement, value: unknown, item: T): void;
    /** Gives the value to sort by. */
    sortValue?(item: T): unknown;
}

export interface TableViewSelectDetail<T = unknown> { keys: ViewKey[]; index: number; key: ViewKey | null; item: T | null; }
export interface TableViewActivateDetail<T = unknown> { index: number; key: ViewKey; item: T; column: string | undefined; }
/** Cancelable: `preventDefault()` stops the sort. */
export interface TableViewSortDetail { key: string | null; direction: SortDirection | null; }
export interface TableViewResizeDetail { key: string; index: number; width: number; }

export declare class TableView<T = unknown> extends VirtualView {
    items: T[];
    columns: TableColumn<T>[];
    keyOf?: ((item: T, index: number) => ViewKey) | null;
    /** `'external'`: the table sends `table-view-sort`, and the application sorts and sets `items`. */
    sort: 'internal' | 'external' | string;
    /** The locale of numbers, dates, and the sort. Empty for the page locale. */
    locale: string;
    /** The column with the keyboard focus. */
    activeColumn: number;
    sortKey: string | null;
    sortDirection: SortDirection | null;

    /** The index in `items` of a row. */
    itemIndex(row: number): number;
    itemAt(row: number): T | undefined;
    /** The width of each column in pixels. */
    readonly columnWidths: number[];
    /** With an event, sends `table-view-resize`. */
    setColumnWidth(index: number, width: number, event?: Event | null): void;
    /** Sorts by a column. `null` gives the order of the items. With an event, sends `table-view-sort` first. */
    sortBy(key: string | null, direction?: SortDirection | null, event?: Event | null): void;
    /** Ascending, then descending, then the order of the items. */
    toggleSort(column: TableColumn<T> | null | undefined, event?: Event | null): void;
    /** The selected items, in the order of `items`. */
    readonly selectedItems: T[];
    /** Renders the row of one item again, after the item changed. The order does not change. */
    refreshItem(item: T): void;
}

export declare class ShadowTableView<T = unknown> extends TableView<T> {
    shadow: ShadowRoot;
}

/** The text of a value in a cell of a column. */
export declare function formatTableCell<T>(column: TableColumn<T>, value: unknown, item: T, locale?: string): string;
/** The order of the item indexes, sorted by a column. Stable; an empty value goes last. */
export declare function tableSortOrder<T>(items: readonly T[], column: TableColumn<T>, direction: SortDirection, locale?: string): number[];

/** Defines the default tag of each view that has no tag yet. */
export declare function defineDataViews(): void;

declare global {
    interface HTMLElementTagNameMap {
        'list-view': ListView;
        'shadow-list-view': ShadowListView;
        'tree-view': TreeView;
        'shadow-tree-view': ShadowTreeView;
        'table-view': TableView;
        'shadow-table-view': ShadowTableView;
    }
    interface HTMLElementEventMap {
        'list-view-select': CustomEvent<ListViewSelectDetail>;
        'list-view-activate': CustomEvent<ListViewActivateDetail>;
        'tree-view-select': CustomEvent<TreeViewSelectDetail>;
        'tree-view-expand': CustomEvent<TreeViewExpandDetail>;
        'tree-view-activate': CustomEvent<TreeViewActivateDetail>;
        'tree-view-check': CustomEvent<TreeViewCheckDetail>;
        'tree-view-load-error': CustomEvent<TreeViewLoadErrorDetail>;
        'table-view-select': CustomEvent<TableViewSelectDetail>;
        'table-view-activate': CustomEvent<TableViewActivateDetail>;
        'table-view-sort': CustomEvent<TableViewSortDetail>;
        'table-view-resize': CustomEvent<TableViewResizeDetail>;
    }
}
