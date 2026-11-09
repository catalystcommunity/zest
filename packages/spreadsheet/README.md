# `Spreadsheet`

A grid of typed cells with formulas, as in a spreadsheet program. It has keyboard navigation, editing, selection, clipboard, and undo.

## Usage

```js
import { SpreadSheet, SheetCell, FormulaBar } from '@catalystcommunity/spreadsheet';

customElements.define('spread-sheet', SpreadSheet);
```

```html
<spread-sheet rows="1000" columns="26" formula-bar label="Budget"></spread-sheet>
```

```js
const sheet = document.querySelector('spread-sheet');
sheet.load({
  columns: [{}, {type: 'number'}, {type: 'currency', currency: 'EUR', decimals: 2}],
  cells: {A1: 'Item', B1: 'Quantity', C1: 'Price', A2: 'Pens', B2: '12', C2: '1.5', C3: '=B2*C2'},
});
sheet.addEventListener('spreadsheet-change', (e) => save(e.detail.changes));
```

`ShadowSpreadSheet` is the same element in an open shadow root. The sheet defines the tag of `SheetCell` and `FormulaBar` when it needs them, with `tagFor()`. If you define them first with other tags, the sheet uses your tags.

## Design

- **The model has no DOM.** `SheetModel` holds the cells, the formulas, and the undo steps. You can use it with no element, for example in a test or on a server. Two sheets can show one model: `second.model = first.model`.
- **The sheet is made of cells.** `SpreadSheet` shows the model as a grid of `SheetCell` elements. A `SheetCell` shows a typed value, and it becomes an editor.
- **Only the visible cells exist.** The sheet makes enough `SheetCell` elements for the rows and columns that can show at one time. When the user scrolls, it gives these elements new rows and columns, and changes only the text that changed. A sheet of 10,000 rows has the same number of elements as a sheet of 20 rows.
- **One paint for each frame.** The sheet renders one time in each animation frame (`static renderTiming = 'frame'`). Many changes in one frame cause one paint.
- **Only the dependent cells recalculate.** A change recalculates the changed cell and each cell that reads it, directly or through other cells. Each cell recalculates after the cells that it reads. The walk has no recursion, so a chain of 100,000 formulas does not use up the stack.

## Attributes

| Attribute | Default | Description |
| --- | --- | --- |
| `rows`, `columns` | 100, 26 | The size of a new model. |
| `formula-bar` | | Shows a `FormulaBar` above the grid. |
| `readonly` | | The user can select and copy, but cannot change the cells. |
| `label` | `Spreadsheet` | The accessible name of the grid. |
| `locale` | the browser | The language of numbers and dates. |

## Cells and Types

Each cell has an input: the text that the user typed. The sheet reads the input to a value. The type of a cell comes from the cell, then from its column, then from the input.

| Type | Input | Shown as |
| --- | --- | --- |
| `auto` | Any. `12%` is a percent, `$5` is currency, `2026-03-13` and `3/13/2026` are dates, `TRUE` is a boolean. | The type that the input shows. |
| `text` | Any. A formula stays text. | The input. |
| `number` | `1234.5`, `1,234.5`, `1e3` | With `decimals` and `grouping` of the column. |
| `currency` | `1234.5` or `$1234.5` | With `currency` (default `USD`) and `decimals`. |
| `percent` | `12` or `12%` both mean 12%. | With `decimals`. |
| `date` | `2026-03-13` or `3/13/2026` | With `dateStyle` (`medium`, `short`, `long`, or `iso`). |
| `boolean` | `TRUE`, `FALSE`, also `yes`, `no`, `1`, `0` in a boolean column | `TRUE` or `FALSE`. |

- An apostrophe at the start keeps the text: `'0042` is the text `0042`.
- An input that does not agree with the type stays text. For example, `abc` in a number column is text.
- A column format: `sheet.model.setColumn(2, {type: 'currency', currency: 'EUR', decimals: 2, width: 120, title: 'Price'})`.
- A cell type: `sheet.model.setType('B2:B9', 'percent')`.
- A cell style: `sheet.model.setStyle('A1:H1', {bold: true, italic: true, align: 'center'})`.
- Numbers, money, percentages, and dates go to the end of the cell. Text goes to the start. An error is bold and has the invalid color.

## Formulas

A formula starts with `=`.

- Operators, from the strongest: `%` after a value, `-` before a value, `^`, `*` and `/`, `+` and `-`, `&` (joins text), then `=`, `<>`, `<`, `>`, `<=`, `>=`. As in other spreadsheets, `-2^2` is 4.
- References: `A1`, `$A$1`, `$A1`, `A$1`. Ranges: `A1:C10`.
- Text in quotes: `"say ""hi"""`. Booleans: `TRUE`, `FALSE`.
- A date plus a number is a date. A date minus a date is a number of days.
- An empty cell is 0 in a calculation and an empty text in `&`.

Functions: `SUM`, `AVERAGE`, `MIN`, `MAX`, `PRODUCT`, `COUNT`, `COUNTA`, `COUNTBLANK`, `ABS`, `SQRT`, `INT`, `ROUND`, `MOD`, `IF`, `IFERROR`, `AND`, `OR`, `NOT`, `CONCAT`, `CONCATENATE`, `LEN`, `UPPER`, `LOWER`, `TRIM`, `TODAY`. `SHEET_FUNCTIONS` is the table of functions. To make a new function, add it to the table with an upper-case name. The function gets an array of arguments. An argument is a value, or `{range, values}` for a reference or a range. It returns a value or a `SheetError`.

A function that gets a range uses only the numbers in it, as in other spreadsheets: `SUM(A1:A3)` leaves out a text. A text written in the call can be a number: `SUM("3", 4)` is 7.

| Error | Cause |
| --- | --- |
| `#DIV/0!` | A division by zero, or `AVERAGE` of no numbers. |
| `#REF!` | A reference to a cell that was deleted, or that is outside the sheet. |
| `#NAME?` | A function or a name that does not exist. |
| `#VALUE!` | A value of the wrong type, for example `"a"*2`. |
| `#CYCLE!` | The formula reads its own result, directly or through other cells. Each cell that reads it also shows `#CYCLE!`. |
| `#NUM!` | A number that is not possible, for example `SQRT(-1)`. |
| `#ERROR!` | The formula does not parse, for example `=1+`. |

An error goes through each calculation that uses it. `IFERROR` stops it.

When rows or columns are added or deleted, each reference moves with its cell, also an absolute reference. A range becomes smaller when a part of it is deleted. A reference to a deleted cell becomes `#REF!`.

## Keyboard

The grid is one stop in the tab order. The active cell has `aria-activedescendant`. "Ctrl" is Command on a Mac.

| Key | Action |
| --- | --- |
| Arrow keys | Go one cell. |
| Ctrl and an arrow key | Go to the edge of the data, or to the next data, or to the edge of the sheet. |
| Tab, Shift+Tab | Go right or left. At the last or the first column, Tab leaves the grid. |
| Enter, Shift+Enter | Go down or up. |
| Home, End | Go to the first column, or to the last cell with data in the row. |
| Ctrl+Home, Ctrl+End | Go to A1, or to the last row and column with data. |
| Page Up, Page Down | Go up or down by one screen. |
| Shift and any key above | Make the selection larger, from the active cell. |
| Ctrl+A | Select all of the sheet. |
| Shift+Space, Ctrl+Space | Select the row, or the column. |
| A character | Start an edit. The character replaces the input. |
| F2, Ctrl+Enter | Start an edit with the input, the caret at the end. |
| Delete, Backspace | Clear the selected cells. |
| Ctrl+C, Ctrl+X, Ctrl+V | Copy, cut, and paste. Other programs get and give text with tabs. |
| Ctrl+Z | Undo. |
| Ctrl+Y, Ctrl+Shift+Z | Redo. |
| Ctrl+D, Ctrl+R | Fill down or right from the first row or column of the selection. |
| Ctrl+B, Ctrl+I | Bold, italic. |
| Ctrl+; | Put the date of today. |
| Alt+Shift+Right, Alt+Shift+Left | Make the column wider or narrower by 16 pixels. |
| Escape | Stop a cut. |

During an edit:

| Key | Action |
| --- | --- |
| Enter, Shift+Enter, Tab, Shift+Tab | Save, and go down, up, right, or left. |
| Ctrl+Enter | Save the input in each cell of the selection. A formula moves for each cell. |
| Alt+Enter | Put a line break in the input. |
| Escape | Stop the edit. The cell keeps its old input. |
| Arrow keys | After typing started the edit: save, and go to the next cell. After F2: move the caret. |
| F2 | Change between these two modes of the arrow keys. |
| Ctrl+; | Put the date of today at the caret. |

A key that starts an input method starts an edit, and the composed text goes into the editor.

## Pointer

- Click a cell to select it. Drag to select a range. Shift and a click make the selection larger.
- Double-click a cell to edit it.
- Click a column header or a row header to select the column or the row. Drag across headers to select many. Click the corner to select all.
- Drag the edge of a column header to change the width of the column. The edge is 24 pixels wide.

## Copy and Paste

- A copy gives the shown text, with a tab between cells and a line between rows. Other spreadsheet programs read this.
- A paste of a copy from the same sheet keeps the formulas. A relative reference moves with the cell, as in other spreadsheets. `$` keeps a part of a reference.
- A copy of one cell, pasted on a larger selection, fills all of the selection.
- A paste after a cut moves the cells: the cut cells become empty.
- The browser sends the clipboard events to the document when the grid has the focus. The sheet handles an event only when its grid has the focus.

## Events

Each event bubbles and is composed. A change from code sends no event.

| Event | `detail` | When |
| --- | --- | --- |
| `spreadsheet-change` | `{changes: [{address, row, col, oldInput, newInput}]}` | The user changes cells. One event for each operation, for example one paste. |
| `spreadsheet-select` | `{range, address, active}` | The user changes the selection. |

The model sends `change` for each change, also from code: `{changes, cells, history: {canUndo, canRedo}}`. `cells` holds the key of each cell to show again, also the recalculated cells.

## Actions

`sheet.actions` holds an `Action` from `@catalystcommunity/actions` for each command: `undo`, `redo`, `cut`, `copy`, `paste`, `clear`, `fillDown`, `fillRight`, `bold`, `italic`, `today`, `selectAll`, `insertRow`, `deleteRow`, `insertColumn`, and `deleteColumn`. A menu or a toolbar can use the same actions. The state of each action follows the sheet: `undo` is enabled only when there is a step to undo, and `bold` is checked when the active cell is bold.

## Methods and Properties

- `model`: the `SheetModel`. Set it to show a different model.
- `getCell('B2')`: `{address, row, col, input, formula, type, value, display, style, error}`.
- `getValue('B2')`, `setCell('B2', '=A1*2')`, `setCells([{address, input, style, type}])`.
- `load({rows, columns, cells})` replaces all of the data. `cells` is `{A1: 'text'}` or `{A1: {input, style, type}}`. `rows` can also be an array of rows. A load is not an undo step.
- `toJSON()` gives the data in the form that `load` reads.
- `toCSV({values, range})` gives CSV. `values: false` gives the inputs, so that formulas stay formulas. `fromCSV(text, 'A1')` reads CSV as one undo step.
- `insertRows(index, count)`, `deleteRows`, `insertColumns`, `deleteColumns`. Each one is an undo step.
- `selection`: `{top, left, bottom, right}`. Set it with a range or with text: `sheet.selection = 'B2:C4'`.
- `activeAddress`, `editing`, `undo()`, `redo()`, `focus()`.
- `setColumnWidth(col, pixels)`, `widthOf(col)`.
- `watch(callback)` calls back after each change of the selection, the data, or the editor text. It returns the removal function. `FormulaBar` uses it.

The model also has `copy(range)`, `paste(target, copy)`, `pasteText(target, text)`, `fill(range, 'down' or 'right')`, `clear(range)`, `batch(fn)`, `dataEdge(row, col, dRow, dCol)`, `usedRange`, and `summary(range)`. `summary` gives `{count, numbers, sum, average}` for a status bar. `batch(fn)` puts many changes into one undo step and one event.

## FormulaBar

`FormulaBar` shows the address and the input of the active cell. Set `formula-bar` on the sheet, or put a bar anywhere with `<formula-bar for="sheet-id">`, or set `bar.sheet = element`.

- Type an address or a range, such as `C5` or `B2:D4`, in the address field, then press Enter to go there.
- Change the input in the input field, then press Enter to save it. Escape stops.
- While the user edits a cell, the bar shows the text of the editor.

## SheetCell

A `SheetCell` can also stand alone:

```html
<sheet-cell input="1234.5" type="currency" editable></sheet-cell>
```

An editable cell edits with Enter, F2, or a double click. Enter saves and sends `change` with `{input}`. Escape stops.

## Accessibility

- The grid has the role `grid`, with `aria-rowcount`, `aria-colcount`, `aria-rowindex`, `aria-colindex`, and `aria-selected`. The rows and columns have headers.
- A live region tells the address and the value after the user moves, and the size of a selection. It waits a short time, so that a held arrow key does not make a queue of messages.
- The live region also tells the start of an edit, a canceled edit, a copy, and a paste.
- Each row is at least 24 CSS pixels high. The grid scrolls in itself, so the page reflows at 320 CSS pixels.
- The active cell has a 2px border. In forced colors mode, the selection uses `Highlight`.

## Look

| Token | Use |
| --- | --- |
| `--zest-spread-sheet-height` | The height of the grid, `24em`. |
| `--zest-spread-sheet-header-face`, `-header-text` | The row and column headers. |
| `--zest-spread-sheet-header-face-selected` | A header of a selected row or column. |
| `--zest-spread-sheet-face-selected` | The selected range. |
| `--zest-spread-sheet-line` | The lines of the grid. |
| `--zest-formula-bar-*` | The formula bar, for example `--zest-formula-bar-height`. |

The parts are `sheet`, `grid`, and `formula-bar`. The row height is 1.75 times the font size.

Each class that the sheet puts on its own elements starts with `zest-`, so that a page rule for a class such as `.row` or `.bold` does not change the sheet. A cell has `zest-cell`, a class for its type (`zest-text`, `zest-number`, `zest-currency`, `zest-percent`, `zest-date`, `zest-boolean`, or `zest-error`), and a class for each style (`zest-bold`, `zest-italic`, `zest-align-start`, `zest-align-center`, `zest-align-end`).

## Performance

Measured in headless Chromium on a workstation, 2026-11-04:

| Test | Result |
| --- | --- |
| Load a sheet with a chain of 9,999 formulas (`A2` is `=A1+1`, and so on) | 52 ms |
| Change `A1` of that chain: 10,000 cells recalculate | 2 to 6 ms |
| Load 10,000 rows by 8 columns of data and formulas (80,000 cells, 30,000 formulas) | 282 ms |
| Scroll a 10,000 by 100 sheet: time for a scroll step and two frames | median 33 ms, worst 42 ms |
| One render after a scroll step | 0.4 ms |
| Cell elements for a sheet 1,000 pixels wide and 24em high | 176 |

## Limits

- All rows have the same height.
- A cell does not show text over the empty cells next to it. Long text is cut at the edge of the cell.
- A scroll that moves the edited cell out of view saves the edit first.
- The arrow keys do not add references to a formula during an edit.
- A large undo step of rows or columns keeps a copy of the cells that it changed.

## Helpers

The package also exports the parts of the model: `parseFormula`, `evaluateFormula`, `tokenizeFormula`, `formulaReferences`, `shiftFormula`, `adjustFormulaReferences`, `readCellInput`, `parseCellAddress`, `formatCellAddress`, `parseCellRange`, `formatCellRange`, `normalizeCellRange`, `sheetColumnName`, `sheetColumnIndex`, `parseDelimitedText`, `toDelimitedText`, `SheetDate`, `SheetError`, `SHEET_TYPES`, `SHEET_MAX_ROWS`, and `SHEET_MAX_COLUMNS`. Rows and columns start at 0: `parseCellAddress('B3')` is `{row: 2, col: 1}`.
