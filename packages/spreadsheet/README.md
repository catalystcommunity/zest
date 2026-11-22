# `Spreadsheet`

A grid of typed cells with formulas, as in a spreadsheet program. It has keyboard navigation, editing, selection, clipboard, and undo. It is also a form for data entry: typed and validated columns, locked cells, and rows that go to the server when the person completes them.

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
| `locale` | the `lang` of the page, else the browser | The locale of numbers, dates, and formulas: what the cells show, and what the person types. See "Locales". |
| `skip-locked` | | Tab and Enter go past locked cells. The arrow keys still go to them. |
| `locked-cells` | `refuse` | `refuse`: a change that touches a locked cell does nothing. `skip`: the other cells change. See "Locked Cells". |
| `locked-notice` | `true` | A notice tells the person about a refused change. `locked-notice="false"` turns it off. |
| `entry-rows` | 0 | Data entry: the number of empty rows after the records. See "Data Entry". |
| `record-key` | `id` | Data entry: the field that identifies a record. |
| `submit-on` | `leave-row` | Data entry: when a changed row goes to `onSubmitRow`. `leave-row`, `enter`, `change`, or `manual`. |
| `paste-submits` | | Data entry: a paste of many rows sends each complete row at once. The rows with problems stay, with marks. |
| `show-conflicts` | | Data entry: a changed row that also changed elsewhere shows it, and does not go until the person decides. See "Work That Is Not Lost". |
| `keep-text` | | Data entry: a text value of a record stays a text, also when it reads as a number or a date. |
| `quiet-rows` | | Data entry with `submit-on="change"`: the problems of a row show when the person leaves it, not while they type. |

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
- All columns at one time: `sheet.setColumns([{key, title, type, validate, options, required, locked, formula, width}, ...])`. The number of columns becomes the length of the list.
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
| Tab, Shift+Tab | Go right or left. After the last column, Tab goes to the next row. Tab at the last cell, or Shift+Tab at the first cell, leaves the grid. |
| Escape, then Tab | Leave the grid from any cell. The grid description tells this to screen reader users. |
| Enter, Shift+Enter | Go down or up. After Tab keys, Enter goes to the column where the first Tab was, as in other spreadsheets: from B3, Tab, Tab, Tab, and Enter go to B4. |
| Space | In a boolean column, change the value. |
| Alt+Arrow Down | In a date or timestamp column, open the calendar. A pick writes the cell. A date closes the calendar; a date and time stays open for the time. Escape closes it. The active date cell also has a button for the calendar. |
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
| Enter, Shift+Enter, Tab, Shift+Tab | Save, and go down, up, right, or left. Enter after Tab keys goes to the start column of the next row. |
| Ctrl+Enter | Save the input in each cell of the selection. A formula moves for each cell. |
| Alt+Enter | Put a line break in the input. |
| Escape | Stop the edit. The cell keeps its old input. When a list is open, Escape closes only the list. |
| Arrow keys | After typing started the edit: save, and go to the next cell. After F2: move the caret. |
| Arrow keys in a formula | After `=`, an operator, `(`, `,`, or `;`: put a reference to a cell in the formula. More arrow keys move the reference. Shift and an arrow key make it a range. Ctrl and an arrow key go to the edge of the data. |
| F4 | Change the reference at the caret: `A1`, `$A$1`, `A$1`, `$A1`, then `A1` again. |
| F2 | Change between the two modes of the arrow keys. |
| Ctrl+; | Put the date of today at the caret. |
| Arrow Down, Arrow Up in a list | Go to the next or the previous item of the list of functions, or of the options of a column. |
| Tab in the list of functions | Put the name and `(` in the formula. The edit continues. |
| Enter or Tab in a list of options | Take the item, save, and go to the next cell. |
| Alt+Arrow Down | Show all of the options of the column. |

While the person types a formula, each reference in it has a box with a color on the grid. The reference that the arrow keys move has a dashed box.

A key that starts an input method starts an edit, and the composed text goes into the editor.

## Pointer

- Click a cell to select it. Drag to select a range. Shift and a click make the selection larger.
- Double-click a cell to edit it.
- In a formula, after an operator: click a cell to put a reference to it in the formula. Drag to make a range. Shift and a click make the range larger.
- Click a column header or a row header to select the column or the row. Drag across headers to select many. Click the corner to select all.
- Drag the edge of a column header to change the width of the column. The edge is 24 pixels wide.

## Copy and Paste

- A copy gives the shown text, with a tab between cells and a line between rows. Other spreadsheet programs read this.
- A paste of a copy from the same sheet keeps the formulas. A relative reference moves with the cell, as in other spreadsheets. `$` keeps a part of a reference.
- A copy of one cell, pasted on a larger selection, fills all of the selection.
- A paste after a cut moves the cells: the cut cells become empty.
- The browser sends the clipboard events to the document when the grid has the focus. The sheet handles an event only when its grid has the focus.

## Locales

The model keeps canonical inputs: numbers in the `1234.5` form, ISO dates such as `2026-11-21`, and formulas with `.` and `,`. So `toJSON()`, `records`, and a saved sheet are the same in each locale. The person reads and types the form of the locale of the sheet:

| Text | `de-DE` | Model |
| --- | --- | --- |
| A number | `1.234,5` | `1234.5` |
| A percent, a currency | `12,5 %`, `5,50 €` | `12.5%`, `€5.50` |
| A date | `21.11.2026` | `2026-11-21` |
| A formula | `=SUM(A1;2,5)` | `=SUM(A1,2.5)` |

- The sheet uses `locale`, else the `lang` of the page, else the language of the browser. `effectiveLocale` gives the one that it uses.
- The editor and the formula bar show the input in the form of the locale. `inputText('A1')` gives this text.
- In a locale with a decimal comma, `;` separates the arguments of a function, as in other spreadsheets. The names of the functions stay English.
- An ISO date always works. A text column (`type: 'text'`) keeps the text as typed.
- A paste of text from another program is in the form of the locale. A paste from Excel or Google Sheets reads the exact values from their HTML (`x:num`, `data-sheets-value`), so the locale of the other program does not matter. A copy and paste in the sheet keeps the inputs.
- `messages` changes the messages of the validators for the sheet, for example to translate them. See "Messages" in `@catalystcommunity/validators`.

### CSV Files

A CSV file has the signs of the computer that wrote it, not of the person who reads it. In `1,234`, the comma can be a decimal sign or a group sign. So give the signs to `fromCSV`, or let `detectCsvFormat` find them from the data:

```js
import { detectCsvFormat } from '@catalystcommunity/spreadsheet';

const format = detectCsvFormat(text);
if (!format.confident) {
  // For example only "1,234": ask the person, and show format.ambiguous
}
sheet.fromCSV(text, 'A1', format);  // {delimiter, decimal, group, order}
sheet.fromCSV(text, 'A1', {delimiter: ';', locale: 'de-DE'});
```

`detectCsvFormat` finds the delimiter (`,`, `;`, or a tab), the decimal sign, and the order of dates. It does not guess: when the data can be read both ways, `decimal` or `order` is `null`, and `confident` is `false`.

## Events

Each event bubbles and is composed. A change from code sends no event.

| Event | `detail` | When |
| --- | --- | --- |
| `spreadsheet-change` | `{changes: [{address, row, col, oldInput, newInput}]}` | The user changes cells. One event for each operation, for example one paste. |
| `spreadsheet-select` | `{range, address, active}` | The user changes the selection. |
| `spreadsheet-locked` | `{operation, cells, message}` | A change touched a locked cell and did nothing. Cancelable: `preventDefault()` stops the notice. |
| `spreadsheet-row-conflict` | `{row, original, incoming, fields}` | With `show-conflicts`: a changed row got a new version of its record. |
| `spreadsheet-edit-refused` | `{row, col, address, text, message}` | A `strict` column did not take the text of the editor. The editor stays open. |
| `spreadsheet-row-submit` | the row context, see "Data Entry" | Before `onSubmitRow`. Cancelable: `preventDefault()` stops the send. |
| `spreadsheet-row-state` | `{row, state, value, error}` | A send of a row ended: `sent` or `error`. |

The model sends `change` for each change, also from code: `{changes, cells, history: {canUndo, canRedo}}`. `cells` holds the key of each cell to show again, also the recalculated cells.

## Actions

`sheet.actions` holds an `Action` from `@catalystcommunity/actions` for each command: `undo`, `redo`, `cut`, `copy`, `paste`, `clear`, `fillDown`, `fillRight`, `bold`, `italic`, `today`, `selectAll`, `insertRow`, `deleteRow`, `insertColumn`, `deleteColumn`, `submitRow`, and `discardRow`. In data entry, the actions that add or delete rows and columns are disabled. `submitRow` and `discardRow` are enabled when the active row has changes. A menu or a toolbar can use the same actions. The state of each action follows the sheet: `undo` is enabled only when there is a step to undo, and `bold` is checked when the active cell is bold.

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
- `isLocked(row, col)`, `refresh()`, `optionsOf(col)`. See "Locked Cells" and "Validation".
- `setColumns(list)`, `records`, `rowState(row)`, `rowError(row)`, `rowRecord(row)`, `submitRow(row)`, `submitAll()`, `discardRow(row)`. See "Data Entry".
- `watch(callback)` calls back after each change of the selection, the data, or the editor text. It returns the removal function. `FormulaBar` uses it.

The model also has `setColumns(list)`, `columnType(col)`, `setRow(row, {locked})`, `isLocked(row, col)`, `setLocked(range, true | false | null)`, `getMark(row, col)`, `setMarks(list)`, `setCells(changes, {history: false})`, `setRowCount(count)`, `remapRows(mapping, rowCount)`, `withGuard(guard, fn)`, `historyCells('undo' | 'redo')`, `forEachCell(fn)`, `copy(range)`, `paste(target, copy)`, `pasteText(target, text)`, `fill(range, 'down' or 'right')`, `clear(range)`, `batch(fn)`, `dataEdge(row, col, dRow, dCol)`, `usedRange`, and `summary(range)`. `summary` gives `{count, numbers, sum, average}` for a status bar. `batch(fn)` puts many changes into one undo step and one event.

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

## Locked Cells

A locked cell is like a field of a form that only shows data. The person can select it, copy it, and go to it, but cannot change it. By default, all cells are unlocked.

- Lock a column: `sheet.model.setColumn(0, {locked: true})`, or `locked: true` in `setColumns`.
- Lock a row: `sheet.model.setRow(3, {locked: true})`.
- Lock or unlock cells: `sheet.model.setLocked('B2:C4', true)`. `false` unlocks a cell in a locked row or column. `null` removes the setting of the cell.
- The cell setting wins over the row, and the row wins over the column. These settings are not undo steps and are not data.
- `lockRule` locks more cells: `sheet.lockRule = ({row, col}) => Boolean(orders[row]?.paid)`. Return `true` to lock the cell. Another value lets the model decide, so a rule cannot unlock a cell that the model locks. Call `sheet.refresh()` after the data that the rule reads changes.
- The order: `readonly`, a row that is sending, a calculated column in data entry, `lockRule`, then the model. The first source that locks the cell wins.
- A lock stops the person, not code: `setCell` and `records` change a locked cell. For code that acts for the person, as a macro does, give `{respectLocks: true}` to `setCell` or `setCells`. The change then follows the locks and `locked-cells`, and the result is `false` when the locks refused it.
- `readonly` locks all cells. In data entry, a row that is sending is locked, and a calculated column is locked.

A locked cell has the class `zest-locked`, `aria-readonly="true"`, and a different background. The live region says "locked" when the person goes to it.

Each change by the person goes through the locks: an edit, Delete, a paste, a cut, a fill, Ctrl+Enter, bold, italic, today, Space in a boolean column, an undo, a redo, and a delete of rows or columns. Only the cells that the change would really change count: a clear of an empty locked cell is not a problem.

| `locked-cells` | Result |
| --- | --- |
| `refuse` (default) | If one cell is locked, nothing changes. The live region tells it, the sheet sends `spreadsheet-locked`, and a notice shows: "Cell B2 is locked. You cannot change it." A change of many cells is one operation, so a paste never changes only a part. |
| `skip` | The unlocked cells change, and the locked cells do not. The live region says how many cells did not change. |

To change the notice, set `onLocked = (detail) => {...}`: it runs in place of the notice. `locked-notice="false"` shows no notice. `preventDefault()` on `spreadsheet-locked` also stops it. Only one notice shows at a time, so a held key does not make a stack of notices.

## Validation

Give a column a validator. Use the validators of `@catalystcommunity/validators`, which know the core CSIL types:

```js
import { validators as v } from '@catalystcommunity/validators';

sheet.setColumns([
  {title: 'Item', validate: v.text({required: true, maxLength: 40})},
  {title: 'Quantity', validate: v.uint({max: 1000})},
  {title: 'Price', type: 'currency', decimals: 2, validate: v.decimal({scale: 2, min: 0})},
  {title: 'Size', validate: v.oneOf([{value: 's', label: 'Small'}, {value: 'l', label: 'Large'}])},
  {title: 'Gift', validate: v.bool()},
]);
```

`validate` can also be a function: `(input) => ({valid: true, value})` or `({valid: false, message, reason})`. `required: true` on a column makes an empty input a problem, also with no validator. Without `type`, the validator gives the type: `int`, `uint`, `float`, and `decimal` show as numbers, `bool` as a boolean, and `date` as a date.

The sheet validates a cell each time that its input changes: after an edit, a paste, a fill, an undo, and also after a load or a change from code. A formula cell is not validated, because its value is calculated, and an error value already shows.

What happens:

1. The input is valid. A mark on the cell goes away. Then `onValid(context)` runs, the post-valid handler of the application.
2. The input is invalid. The default post-invalid handler marks the cell: a red inner border, a mark in the corner, `aria-invalid="true"`, and the message as the `title`. The live region tells the message when the person goes to the cell. The post-valid handler does not run.

| Handler | When |
| --- | --- |
| `onValid(context)` | After a cell becomes valid. `context.value` is the typed value. |
| `onInvalid(context)` | In place of the default post-invalid handler. The cell gets no mark, unless the handler calls `context.mark()` or `context.mark('Another message')`. |
| `afterInvalid(context)` | After the default post-invalid handler, or after `onInvalid`. Use it to do more, for example to show the message in a status bar. The cell stays marked. |

The context has `row`, `col`, `address`, `input`, `column`, `sheet`, and `source`: `'user'` for a change by the person, or `'code'` for a load or data from outside. An invalid context also has `message` and `reason`. An invalid input stays in the cell, so that the person can correct it. Fast typing does not stop at a problem.

A column with `strict: true` does not take an invalid input. When the person saves the edit (Enter, Tab, an arrow key, or a click on another cell), the editor stays open with the mark and the message, and the live region tells the message. The person corrects the text, or presses Escape to cancel the edit. The sheet sends `spreadsheet-edit-refused` with `{row, col, address, text, message}`. A formula and an unchanged text are not checked.

### Columns with Options

A column with `options`, or with a `oneOf` validator, is a list of values. The cells show the labels and keep the values: `{value: 's', label: 'Small'}` shows "Small", and the input of the cell is `s`. The editor shows the label. A paste stores the value too: a pasted label or value of an option becomes the value of the option. A pasted text that is not an option stays as it is, and gets the invalid mark.

While the person types, a list of the options that match shows under the cell. The first match is active. Enter or Tab takes it, saves the cell, and goes to the next cell, so that a person can type `sm` and Tab. Alt+Arrow Down shows all of the options. The list is the same type-ahead as `attachTypeahead` in `@catalystcommunity/controls`.

A boolean column (type `boolean`, or a `bool` validator) shows `TRUE` and `FALSE`. With `display: 'checkbox'`, it shows a check box in each cell. A screen reader hears a check box and its state, with the column title as its name. Space or a click on the check box changes the cell. A locked cell has a check box that does not change.

A date column (type `date`, or a `date` validator) and a timestamp column (a `timestamp` validator) have a calendar: Alt+Arrow Down, or the button on the active cell, opens the `date-time-picker` of zest in a popup. It uses the locale of the sheet, and the `timeZone` of a timestamp validator.

A column of numbers gives the editor `inputmode="numeric"` or `"decimal"`, for the keyboard of a phone.

### How to Validate Each CSIL Type

| CSIL type | Validator | The typed value | Notes |
| --- | --- | --- | --- |
| `int`, `int .ge 0 .le 120` | `v.int({min: 0, max: 120})` | `number` | A number outside the safe range is a problem. `{bigint: true}` gives a `bigint`. |
| `uint` | `v.uint()` | `number` | |
| `float`, `float32`, `float64` | `v.float()` | `number` | `{finite: false}` also accepts Infinity. |
| `decimal` | `v.decimal({scale: 2})` | text, such as `"12.50"` | The text keeps each digit. Convert it to the decimal type of your code. |
| `text .size (3..50)` | `v.text({minLength: 3, maxLength: 50})` | `string` | The lengths count Unicode code points. |
| `text .regex "..."` | `v.text({pattern: '...'})` | `string` | The pattern must match all of the text. |
| `bool` | `v.bool()` | `boolean` | Space changes the cell. |
| `bytes` | `v.bytes()` or `v.bytes({encoding: 'base64'})` | `Uint8Array` | |
| `timestamp` | `v.timestamp()` | `Date` | The text needs `Z` or an offset. |
| `"a" / "b" / "c"` | `v.oneOf(['a', 'b', 'c'])` | the value of the option | A list shows while the person types. |
| a field with `?`, or `type / null` | `v.optional(...)` | `null` for an empty cell | |

`validatorsFromCsil(descriptor, 'Order')` makes these validators from a CSIL schema descriptor. The result is a list of `{key, validator}`, which gives the columns of a data entry sheet:

```js
import { validatorsFromCsil } from '@catalystcommunity/validators';

const fields = validatorsFromCsil(descriptor, 'Order');
sheet.setColumns(fields.map(({key, validator}) => ({key, title: key, validate: validator})));
```

## Data Entry

A web form with 30 fields is slow when a person must enter many records. A sheet for data entry is faster: the person types, presses Tab to go to the next field, and Enter to go to the start of the next record. Each row is a record. The keyboard does all of the work, also for a list of options or a number.

```js
const sheet = document.querySelector('spread-sheet');
sheet.entryRows = 2;
sheet.setColumns([
  {key: 'item', title: 'Item', validate: v.text({required: true})},
  {key: 'quantity', title: 'Quantity', validate: v.uint({required: true})},
  {key: 'price', title: 'Price', type: 'currency', decimals: 2, validate: v.decimal({scale: 2})},
  {title: 'Total', type: 'currency', decimals: 2, formula: '=B1*C1'},
]);
sheet.records = orders;                        // the data of the application
sheet.onSubmitRow = (record, context) => (
  context.kind === 'new' ? api.createOrder(record) : api.updateOrder(context.id, record)
);
socket.addEventListener('message', () => {
  sheet.records = store.orders;                // each time that the data changes
});
```

### Records and Entry Rows

- `records` is the data of the application: an array of objects. Each object is one row. A column with `key` shows that field. The sheet does not keep its own copy of the data: set `records` again each time that the data changes, from the server, from another person, or from another part of the page.
- `entry-rows` is the number of empty rows after the records. When the person types in the last empty row, a new empty row comes after it, so the number of empty rows stays the same.
- A column with `formula` is calculated. Write the formula for the first row, for example `=B1*C1`. Each row gets a copy of it, with its own row. A calculated column is locked. It is blank in an entry row with no input.
- `record-key` (default `id`) identifies a record. A row follows its record when the order of `records` changes. A record with no id is identified by its place.
- The column decides the type of a value. A text value goes through the type or the validator of its column, as typed input does: in a number column, `'0042'` becomes the number 42. With `keep-text`, a text value stays a text, also when it reads as a number or a date.
- A text from the data never becomes a formula. `'=1+1'` stays the text `=1+1`, so that a value from outside cannot calculate.
- A record cell that the data writes is not an undo step. The undo of the person stays correct when rows move.
- In data entry, the person does not add or delete rows or columns.

### Work That Is Not Lost

The rows that the person does not change follow `records` at once. A row that the person changed, or edits now, is apart from the data: new data does not change it. So a message from the server never removes what the person typed.

- A new record from outside goes above the entry rows. If the person edits an entry row, the open editor moves with its row and keeps its text and the focus. The references in an open formula follow their rows. The active row stays at the same place on the screen when the sheet can scroll.
- A new version of a changed record waits. It goes into the row when the person discards the changes, or when the row is sent.
- With `show-conflicts`, a changed row whose record also changed elsewhere shows it. The row header has the sign ≠ and the changed fields, and the sheet sends `spreadsheet-row-conflict` with `{row, original, incoming, fields}`. The row does not go until the person decides: `keepRowChanges(row)` keeps the changes on top of the new version, and `discardRow(row)` takes the new version. `rowConflict(row)` gives the conflict. Without `show-conflicts`, the context of a send has `conflict`, so that the application can decide.
- A changed record that goes away from `records` stays in the sheet. The context of its send has `gone: true`, so that the application can decide.

### Row States

| State | Row header | Meaning |
| --- | --- | --- |
| `clean` | the number | A record row that shows its record. |
| `changed` | • | A record row that the person changed. Not sent. |
| `empty` | * | An entry row with no input. |
| `draft` | • | An entry row with input. Not sent. |
| `pending` | … | The send started, and the answer did not come yet. The row is locked. |
| `sent` | ✓ | The answer came. An entry row stays locked until its record is in `records`. |
| `error` | ! | The send failed. The row header has the message. The person can change the row and send it again. |
| `changed` (with `show-conflicts`) | ≠ | The person changed the row, and its record changed elsewhere too. `rowState` gives `changed`. |

The row header also has the state in words for a screen reader, for example "4, new, not sent". `rowState(row)` and `rowError(row)` give the state and the message.

### Sending a Row

`onSubmitRow(record, context)` sends a row. It can make a CSIL RPC call, send a CSIL events message, or make a POST: the sheet only calls the function. The record has the typed values from the validators, by key. A column with no validator gives the value of the cell. In data entry, a number or boolean column with no validator still checks its type.

The context has `row`, `reason`, `kind` (`'new'` or `'update'`), `id`, `original` (the record before the change), `incoming` (a newer record that waits), `gone`, `errors`, `valid`, and `sheet`.

- Return a promise to keep the row `pending` until it settles. A rejection makes the row `error`, with the message of the error.
- Resolve with the saved record. Its id lets the sheet put the record in the right row when it comes in `records`.
- Set `newRecordId = () => crypto.randomUUID()` to give a new row its id before the send. The record then has the id, and a record from outside finds its row also before the answer comes. With no id before the send, the record from outside shows as its own row until the answer comes.

When does a row go? `submit-on` decides:

| `submit-on` | The row goes when |
| --- | --- |
| `leave-row` (default) | The person goes to another row, or out of the sheet. Enter also goes to another row. |
| `enter` | The person presses Enter in the row. |
| `change` | Each change of a cell. A row that is not complete waits. Its problem cells get marks at once, with no message. With `quiet-rows`, the marks wait until the person leaves the row. |
| `manual` | The application calls `submitRow(row)` or `submitAll()`, for example from a Save button. |

For full control, set `submitWhen = (context) => boolean`. It runs in place of `submit-on`, for each reason: `change`, `leave`, `enter`, `paste` (with `paste-submits`), and `manual`. A row with a problem never goes. When the person asked for the send and the row has problems, the problem cells get marks, also empty required cells, and the live region tells the first problem.

`validateRow(record, context)` checks more than one cell, for example "a quantity of more than 10 needs a price". It gives `{key: message}`, a message for the row, or `null`.

`discardRow(row)` puts a record row back as its record, or empties an entry row. A paste of many lines makes enough entry rows for them. `submitAll()` sends each row with changes and no problem.

## Accessibility

- The grid has the role `grid`, with `aria-rowcount`, `aria-colcount`, `aria-rowindex`, `aria-colindex`, and `aria-selected`. The rows and columns have headers.
- A live region tells the address and the value after the user moves, and the size of a selection. It waits a short time, so that a held arrow key does not make a queue of messages.
- The live region also tells the start of an edit, a canceled edit, a copy, and a paste.
- Each row is at least 24 CSS pixels high. The grid scrolls in itself, so the page reflows at 320 CSS pixels.
- The active cell has a 2px border. In forced colors mode, the selection uses `Highlight`.
- A locked cell has `aria-readonly="true"`. An invalid cell has `aria-invalid="true"`, and the live region tells its message.
- A list of options or functions under the editor is a `listbox`. The editor has `aria-autocomplete="list"`, `aria-controls`, and `aria-activedescendant`.

## Look

| Token | Use |
| --- | --- |
| `--zest-spread-sheet-height` | The height of the grid, `24em`. |
| `--zest-spread-sheet-header-face`, `-header-text` | The row and column headers. |
| `--zest-spread-sheet-header-face-selected` | A header of a selected row or column. |
| `--zest-spread-sheet-face-selected` | The selected range. |
| `--zest-spread-sheet-line` | The lines of the grid. |
| `--zest-spread-sheet-face-locked`, `-text-locked` | A locked cell. |
| `--zest-spread-sheet-reference-1` to `-6` | The colors of the references of a formula in the editor. |
| `--zest-formula-bar-*` | The formula bar, for example `--zest-formula-bar-height`. |

The parts are `sheet`, `grid`, and `formula-bar`. The row height is 1.75 times the font size.

Each class that the sheet puts on its own elements starts with `zest-`, so that a page rule for a class such as `.row` or `.bold` does not change the sheet. A cell has `zest-cell`, a class for its type (`zest-text`, `zest-number`, `zest-currency`, `zest-percent`, `zest-date`, `zest-boolean`, or `zest-error`), a class for each style (`zest-bold`, `zest-italic`, `zest-align-start`, `zest-align-center`, `zest-align-end`), and `zest-locked` and `zest-invalid`. In data entry, a row has `data-state` with its state.

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

Data entry, measured in Firefox on a workstation, 2026-11-21, with 10,000 records of 8 columns (80,000 cells, 10,000 formulas):

| Test | Result |
| --- | --- |
| Set `records` the first time | 201 ms |
| Set `records` with one new record at the end | 30 ms |
| Set `records` with a new object for each record, and the same values | 58 ms |
| Set `records` with one new record at the start: each row moves | 28 to 33 ms |

A move of rows moves the cells as objects. A formula keeps its parsed form, and only the references in its text change, so a move needs no new parse and no new calculation of most cells. Before this, a new record at the start took 266 ms.

Keep the objects of the records that did not change: the sheet compares each record by its object first. A new record at the end costs little, because only the entry rows move.

## Limits

- All rows have the same height.
- A cell does not show text over the empty cells next to it. Long text is cut at the edge of the cell.
- The references in the editor do not have colors in the text, because the editor is a text area. The boxes on the grid have the colors.
- Tab and Enter in a selection of many cells do not go around in the selection. They go to the next cell, and the selection becomes one cell.
- A large undo step of rows or columns keeps a copy of the cells that it changed.

## Helpers

The package also exports the parts of the model: `parseFormula`, `evaluateFormula`, `tokenizeFormula`, `formulaReferences`, `shiftFormula`, `adjustFormulaReferences`, `readCellInput`, `parseCellAddress`, `formatCellAddress`, `parseCellRange`, `formatCellRange`, `normalizeCellRange`, `sheetColumnName`, `sheetColumnIndex`, `parseDelimitedText`, `toDelimitedText`, `SheetDate`, `SheetError`, `SHEET_TYPES`, `SHEET_MAX_ROWS`, and `SHEET_MAX_COLUMNS`. For locales and other programs: `detectCsvFormat`, `readClipboardTable`, `canonicalCellInput`, and `localCellInput` (see "Locales"). Rows and columns start at 0: `parseCellAddress('B3')` is `{row: 2, col: 1}`.
