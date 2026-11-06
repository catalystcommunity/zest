// Views of large data: a list, a tree, and a table. Only the visible rows are in the DOM.
// The design and each option are in the README.
import { defineElements } from "@catalystcommunity/base-components";
import { ListView, ShadowListView } from "./list-view.js";
import { TreeView, ShadowTreeView } from "./tree-view.js";
import { TableView, ShadowTableView } from "./table-view.js";
export { ListView, ShadowListView } from "./list-view.js";
export { TreeView, ShadowTreeView } from "./tree-view.js";
export { TableView, ShadowTableView, formatCell as formatTableCell, sortOrder as tableSortOrder } from "./table-view.js";
export { SelectionModel as ViewSelection, Typeahead as ViewTypeahead } from "./selection.js";
export { VirtualView, virtualWindow, scrollTopFor as virtualScrollTop, MAX_SCROLL_HEIGHT as MAX_VIRTUAL_HEIGHT } from "./virtual.js";

// Defines the default tag of each view that has no tag yet. Importing defines nothing.
export function defineDataViews() {
    defineElements({
        'list-view': ListView, 'shadow-list-view': ShadowListView,
        'tree-view': TreeView, 'shadow-tree-view': ShadowTreeView,
        'table-view': TableView, 'shadow-table-view': ShadowTableView,
    });
}
