# `DataViews`

Views of large data: `ListView`, `TreeView`, and `TableView`. Only the visible rows are in the DOM, so a view of a million items opens quickly.

## Usage

```js
import { ListView, TreeView, TableView } from '@catalystcommunity/data-views';

customElements.define('list-view', ListView);
customElements.define('tree-view', TreeView);
customElements.define('table-view', TableView);
```

```html
<table-view label="People" multiple style="height: 24em"></table-view>
```

```js
const table = document.querySelector('table-view');
table.columns = [
  {key: 'name', label: 'Name', width: 180},
  {key: 'amount', label: 'Amount', type: 'number', format: (value) => money.format(value)},
  {key: 'joined', label: 'Joined', type: 'date'},
];
table.items = people;
table.addEventListener('table-view-activate', (e) => openPerson(e.detail.item));
```

Each class also has a `Shadow...` class, for example `ShadowTableView`, which is the same view in an open shadow root.

## Design

- **The view shows data. It does not get data.** The application sets `items`. To change all of the data, set `items` again. The view keeps the selection and the focus on the same keys.
- **One changed item renders one row.** After you change an item, call `refreshItem(item)` or `refreshRow(index)`. `refresh()` renders the content of each visible row again.
- **Rows are reused.** When the user scrolls, a row element gets a new item. A scroll of one row renders the content of one row. The number of row elements stays the same for 100 items and for a million items.
- **Renders occur one time in each frame.** A burst of scroll events causes one render in the next animation frame.
- **Each row has the same height.** The height comes from the token `--zest-data-view-row-height` (default `2em`). The view measures one row, so the height follows the font. Set the `row-height` attribute to give a height in pixels.
- **The view has a height.** The default is `20em`. Set `height` on the element, or the token `--zest-data-view-height`. The rows scroll inside the view. If a style gives the view no limit, for example `height: 100%` in a parent with no height, the view grows to all of its rows. It then renders only the rows of two window heights, so the page stays fast, but the rows do not scroll inside the view.
- Browsers limit the height of an element. Above 10,000,000 pixels, the view scales the scroll position, so the scroll bar still reaches the last row.

## Measured Performance

Chromium, the gallery page, a 1280 by 1400 window, measured with `e2e/data-views.spec.js`:

| Work | Time |
| --- | --- |
| First render of a list with 1,000,000 items | 1.2 ms, with 14 row elements |
| A render after a scroll, 100,000 table rows, 101 jumps across all of the data | median 2.0 ms, worst 3.1 ms, with 18 row elements |
| Sort 100,000 rows by a text column (locale order) | 126 ms |
| Sort 100,000 rows by a number or a date column | about 60 ms |
| Flatten a tree with 101,000 open nodes (jsdom) | less than 1 second |

## Common Attributes and Properties

| Name | Description |
| --- | --- |
| `label` | The accessible name of the view. Use it in place of `aria-label`. |
| `multiple` | The user can select more than one row. |
| `row-height` | A row height in pixels. With `0` (the default), the view measures a row. |
| `empty-text` | The text when there are no items. The default is "No items". |
| `items` | The data, as a property. |
| `keyOf(item, index)` | A function that gives a key that stays with the item. The default is `item.id`, then the index (for a tree, the node). |
| `selectedKeys` | The keys of the selected rows. Set it to change the selection. |
| `selectedItems` | The selected items, in the order of the data (list and table). |
| `scrollToIndex(index)` | Scrolls until the row is visible. |
| `focus()` | Puts the keyboard focus in the view. |

## ListView

- `items` is an array of anything.
- `itemText(item)` gives the text of an item. The default is `item.label`, then `item.text`, then `item.name`, then the item as text.
- `renderItem(item, row, index)` changes the children of a row that the view reuses. Change only what is different, and do not add listeners.

| Event | `detail` | When |
| --- | --- | --- |
| `list-view-select` | `{keys, index, key, item}` | The user changes the selection. |
| `list-view-activate` | `{index, key, item, pointer}` | The user presses Enter, or double-clicks a row. |

## TreeView

A node is `{id, label, icon, children, hasChildren, expanded, checked, disabled}`.

- `children` is an array of nodes. A node with `hasChildren: true` and no `children` loads its children when it opens: the tree calls `loadChildren(node)`, which returns a promise of an array. While it waits, a "Loading…" row shows. The tree sets `node.children` to the result.
- `expanded: true` opens a node one time, when the tree first sees it.
- `icon` is text, for example an emoji. Screen readers do not read it.
- `checkboxes` shows a check box on each node. A parent shows the state of its children: checked, not checked, or mixed. To check a parent checks each child. `checkedKeys` gives the checked nodes that have no checked parent.
- `renderItem(node, label, entry)` changes the label element of a row.
- `setExpanded(node, expanded)`, `isExpanded(node)`, `toggleChecked(node)`, `checkState(node)`, and `reveal(key)` are also available. `reveal` opens each parent of a loaded node and moves the focus to it.

| Event | `detail` | When |
| --- | --- | --- |
| `tree-view-select` | `{keys, key, node}` | The user changes the selection. |
| `tree-view-expand` | `{key, node, expanded, keyboard}` | A node opens or closes. |
| `tree-view-activate` | `{key, node, keyboard}` | The user presses Enter, or double-clicks a node. A double click also opens or closes the node. To stop that, call `preventDefault()`. |
| `tree-view-check` | `{key, node, checked, keyboard}` | The user checks or clears a node. |
| `tree-view-load-error` | `{key, node, error}` | `loadChildren` failed. The node closes again. |

## TableView

A column is `{key, label, width, type, sortable, resizable, align, format, render, sortValue}`.

- `type` is `text` (the default), `number`, `date`, or `boolean`. A number and a date use the locale of the `locale` attribute. A number aligns to the end of the cell.
- `format(value, item)` gives the text of a cell. `render(cell, value, item)` changes a cell element that the view reuses.
- `width` is in pixels. The default is 150, and the smallest width is 48.
- `sortable: false` and `resizable: false` turn off the sort and the resize of a column.
- `sortValue(item)` gives the value to sort by, for example a `Date` for a text date.
- `sort="external"`: the table sends `table-view-sort` and shows the sort arrow, but the application sorts and sets `items`.
- The table sorts in the locale order, and a number in text sorts by its value ("item 2" before "item 10"). The sort is stable. An empty value goes last.
- `sortBy(key, direction)` sorts from code. `direction` is `ascending`, `descending`, or `null`.
- `setColumnWidth(index, width)` and `columnWidths` change and read the widths. The table does not render rows for a width change.
- The columns are not virtual. Use fewer than about 50 columns.

| Event | `detail` | When |
| --- | --- | --- |
| `table-view-select` | `{keys, index, key, item}` | The user changes the selection. |
| `table-view-activate` | `{index, key, item, column}` | The user presses Enter, or double-clicks a row. |
| `table-view-sort` | `{key, direction}` | The user sorts. To stop the sort, call `preventDefault()`. |
| `table-view-resize` | `{key, index, width}` | The user changes the width of a column. |

## Keyboard

The view has one tab stop. The focus moves inside the view with `aria-activedescendant`, so the row with the focus always stays in the DOM.

| Key | List | Tree | Table |
| --- | --- | --- | --- |
| Up, Down | The previous or the next row. This selects the row. | The same | The same. Up from the first row goes to the header. |
| Left, Right | | Right opens a node, or goes to its first child. Left closes a node, or goes to its parent. | The previous or the next cell. On the header with Shift: a narrower or a wider column. |
| Home, End | The first or the last row | The same | The first or the last cell of the row. With Ctrl: the first or the last row. |
| Page Up, Page Down | One page up or down | The same | The same |
| Shift and a move key | Extends the selection, with `multiple` | The same | The same |
| Ctrl and a move key | Moves the focus, and keeps the selection, with `multiple` | The same | The same |
| Space | Adds or removes the row, with `multiple` | Checks the node, with `checkboxes` | The same as the list |
| Ctrl+A | Selects all, with `multiple` | The same | The same |
| Enter | Sends the activate event | The same | The same. On the header: sorts. |
| `*` | | Opens each sibling of the node | |
| A letter | Goes to the next row that starts with the letters that the user typed | The same | The same, in the column with the focus |

In a right-to-left page, Left and Right change direction.

## Pointer

- A click selects one row. Shift and a click selects a range. Ctrl (or Command) and a click adds or removes a row.
- In a tree, a click on the arrow opens or closes the node, and a click on the check box checks it.
- In a table, a click on a header sorts. A drag on the end edge of a header changes the width of the column. The keyboard can do the same (see above).

## Look

The views read tokens in this order: the view token (for example `--zest-table-view-*`), then the family `--zest-data-view-*`, then the global tokens, then the system colors.

| Token | Use |
| --- | --- |
| `--zest-data-view-height` | The height of a view, `20em` |
| `--zest-data-view-row-height` | The height of a row, `2em` |
| `--zest-tree-view-indent` | The indent of one tree level, `1.25em` |
| `--zest-data-view-face-selected`, `--zest-data-view-text-selected` | A selected row |
| `--zest-data-view-line` | The lines between table rows and cells |

A selected row also has a bar at its start, so the selection does not show with color only. In forced colors mode, a selected row uses `Highlight` and `HighlightText`.

The parts are `view`, `scroller`, `item` (list and tree rows), `row` (table rows), and `header`.
