# Release Notes

## Since the 2026-11-09 Release

### `dialog-window` (containers)

- Changed behavior: a button acts only on a press that started after the dialog opened. A held key that only repeats, a Space release with no press in the dialog, and the second click of a double-click do nothing. A click from code still acts.
- Changed behavior: a dialog with a danger button (`data-danger`, or a `push-button` with `variant="danger"`) and no field gives the focus to its message, not to a button. Enter never clicks a danger button, also with `data-default`. Before, `askConfirm({danger: true})` gave the focus to the danger button, and Enter confirmed. A test that pressed Enter to confirm a danger dialog must now press Tab first, or click the button.
- New: the `disable-for` attribute (`disableFor` property), in milliseconds. The buttons do nothing for that time after the dialog opens, and have `aria-disabled="true"`. The default is `0`. `showMessage`, `askConfirm`, and `askText` take `disableFor`.
- New: `askConfirm({confirmText})`. OK is enabled only when the user types that text in a field. The new label `confirmPrompt` (`Type {text} to confirm`) is the label of the field.
- Fix: a disabled button in the `buttons` slot has a dashed border and the disabled colors, also when a page style for `button` sets a border or colors. Before, a page style removed the disabled look, and a disabled danger button looked like a button that the user can press.

### `validators` (new package)

- New: validators for the core CSIL types: `int`, `uint`, `float`, `decimal`, `text`, `bool`, `bytes`, `timestamp`, `date`, `uuid`, `oneOf`, and `any`. `parse(text)` gives the typed value, or a reason and a message. The types are the types of the TypeScript code that csilgen makes.
- New: `validateRecord(record, fields)`, and `validatorsFromCsil(descriptor, ruleName)`, which makes a validator for each field of a CSIL record from a decoded schema descriptor. A CSIL `date` becomes `date()` with its bounds, and gives ISO text.
- New: locales. `parse(text, {locale})` reads the numbers and dates of a locale (`1.234,5` and `21.11.2026` in German). `format(value, {locale})` writes them. `numberSeparators`, `dateOrder`, and `canonicalNumberText`.
- New: `timestamp({timeZone})` reads a time with no offset in a time zone (`'local'` or an IANA name). With no time zone, the reason of the problem is `'offset'`.
- New: `setValidatorMessages(table)` changes the messages of all validators, for example to translate them, and `parse(text, {messages})` gives messages for one parse. `validatorMessages` has the defaults.
- The package needs `./tools.sh release first-publish` before the merge that releases it.

### `spreadsheet`

- New: data entry. `records` shows the data of the application, `entry-rows` adds empty rows after it, and `onSubmitRow(record, context)` sends a changed row when the person leaves it (`submit-on`: `leave-row`, `enter`, `change`, or `manual`; or `submitWhen`). A row that the person changed is apart from new data, so that no work is lost. Rows have states (`changed`, `draft`, `pending`, `sent`, `error`) in the row header. `validateRow`, `newRecordId`, `submitRow`, `submitAll`, `discardRow`, `setColumns`, and calculated columns with `formula`.
- New: locked cells, rows, and columns (`model.setColumn(col, {locked})`, `model.setRow`, `model.setLocked`, `lockRule`). A change that touches a locked cell does nothing, and a notice tells why (`locked-cells="skip"`, `locked-notice`, `onLocked`, `spreadsheet-locked`). `skip-locked` makes Tab and Enter go past locked cells.
- New: column validators (`validate`, `required`) with a default post-invalid handler that marks the cell, `onInvalid` in its place, `afterInvalid` after it, and `onValid`. Columns with `options` or a `oneOf` validator show labels, keep values, and list the options while the person types. Space changes a boolean cell.
- Changed behavior: Enter after Tab keys goes to the column where the first Tab was, as in other spreadsheets. Tab now goes to the next row after the last column. Tab at the last cell, or Escape then Tab, leaves the grid.
- New: in a formula, the arrow keys and a click put references in it, Shift makes a range, and F4 changes `$`. Each reference has a box with a color on the grid. A list of functions shows while the person types a name, and Tab completes it.
- Changed behavior: a scroll does not end an edit. The editor has its own row element.
- New: locales. The model keeps canonical inputs, and the person types and reads the form of the locale (`locale`, else the `lang` of the page). In a locale with a decimal comma, `;` separates the arguments of a function. `inputText(address)` and `effectiveLocale`. A paste from Excel or Google Sheets reads their exact values. `fromCSV(text, at, {delimiter, locale, decimal, group, order})` and `detectCsvFormat(text)`. `messages` translates the messages of the validators for the sheet.
- New: a calendar for date and timestamp columns: Alt+Arrow Down, or the button on the active cell.
- New: `strict: true` on a column keeps an invalid edit in the editor until the person corrects it or presses Escape (`spreadsheet-edit-refused`).
- New: `display: 'checkbox'` on a boolean column shows check boxes.
- New: a hint of the arguments of a function, above the editor.
- New: `setCell` and `setCells` take `{respectLocks: true}` for code that acts for the person. They give `false` when the locks refused the change.
- New: data entry has `show-conflicts` (a changed row whose record changed elsewhere waits for the person: `rowConflict`, `keepRowChanges`, `discardRow`, `spreadsheet-row-conflict`), `paste-submits`, `quiet-rows`, and `keep-text`.
- Changed behavior: `lockRule` can only lock a cell. Before, `false` unlocked a cell that the model locked.
- Changed behavior: a text value of a record goes through the type of its column, so `'0042'` is 42 in a number column. `keep-text` keeps it a text. A text that starts with `=` never becomes a formula.
- Changed behavior: with `submit-on="change"`, the problems of an incomplete row show at once. `quiet-rows` keeps them until the person leaves the row.
- Changed behavior: a paste of option labels stores the option values. A calculated column is blank in an empty entry row. The references of an open formula follow their rows when records move.
- Faster: a move of rows (a new record at the start) moves the cells as objects, with no new parse. A new record at the start of 10,000 records went from 266 ms to about 30 ms in Firefox.
- The package now depends on `controls`, `date-time-picker`, `menus`, and `validators`.

### `controls`

- New: `attachTypeahead(field, options)`, a list of suggestions for any native input or text area, and `matchSuggestions(items, text)`. It returns a function that removes the list. Commands go through `typeahead.open(field)`, `close`, `accept`, `refresh`, and `setSource`, and the field sends `typeahead-open`, `typeahead-close`, `typeahead-active`, and `typeahead-accept`. `inline: true` types the rest of the first match in the field.
- New: `text-field` has `suggestions`, `openSuggestions()`, `closeSuggestions()`, `refreshSuggestions()`, and `suggestionsOpen`. Enter on a suggestion does not submit the form.
- Changed behavior: an editable `combo-box` lists the options that start with the text first, then the options that contain it.

### `menus`

- New: `danger: true` on a menu item. The item has a warning sign and the danger color. Its mnemonic only moves the focus to it.
- Changed behavior: a key that repeats (Enter, Space, or a mnemonic letter) runs no item. A click runs an item only if the pointer press started in the open menu. The action button of a notice has the same click rule.

## Breaking Changes

### Internal class names start with `zest-`

A light DOM component is part of the page. A page rule for a plain class, for example `.row { display: flex }`, also changed the elements inside a component. Now each class that a component puts on its own elements starts with `zest-`. This includes the state classes. Examples:

- `.row` is `.zest-row`, `.active` is `.zest-active`, `.box` is `.zest-box`.
- The `date-time-picker` root `.dtp` is `.zest-date-time-picker`. Its month block is `.zest-date-time-picker-calendar`.
- The `table-view` cell is `.zest-table-view-cell`.
- The spreadsheet cell formats are `.zest-bold`, `.zest-italic`, `.zest-align-*`, and `.zest-<type>`.

If your CSS or your tests select an internal class, add the prefix. The `part` names did not change. For a component in a shadow root, `::part()` is still the stable way to style it. `__tests__/class-names.spec.js` fails if a component adds a class with no prefix.

The old menu packages (`menu-item`, `menu-logo`, `menu-gutter`) did not change. `two-tier-menu` uses `.zest-items`, `.zest-item`, and `.zest-section-header`.

### `dialog-window`

- A `push-button` in the `buttons` slot now closes the dialog, as a native button does. Before, it did not close the dialog, but that was not by design. To keep the dialog open, add `data-keep-open` to the button, or call `preventDefault()` on `dialog-window-before-close`.
- Escape in a modal dialog is now handled on `keydown`, not by the native `cancel` event.
- A close that the browser does by itself now gives the value `'cancel'`, not `''`.

### Members that hid a native member

- `canvas-view`: the property `animate` is now `animated`, because it hid `Element.animate()`. The attribute is still `animate`.
- The containers: the internal method `part(selector)` is now `shadowPart(selector)`, because it hid the native `element.part`.

### `push-button`

- In the light DOM, the inner button of `type="submit"` or `type="reset"` now has the same type. The browser does the submission or the reset. A `submit` event now has the inner button as its `submitter`.
- An `aria-label` on the host now names the button also when the button has text.

## Changes to Existing Packages

### All packages

- New: TypeScript declarations. Each `package.json` has `types`. Element classes, properties, custom events (in `HTMLElementEventMap`), default tags (in `HTMLElementTagNameMap`), and helpers have types. `__tests__/types.spec.js` checks that each runtime export has a declaration, and runs a strict `tsc` over the declarations and the examples in `types/`.

### `controls`

- New: Enter in a `text-field` submits the form, as in a native input. It clicks the first submit button of the form. A disabled default button stops the submission. A `shadow-push-button` also does this for a native input of its form. New exports `submitImplicitly(form)` and `defaultButton(form)`.
- New: each control copies the host `aria-label` and `aria-describedby` to its inner control, and follows a change. In a shadow root, it uses `ariaDescribedByElements`.
- New: `text-field` and `text-area` copy `autocapitalize`, `autocorrect`, `spellcheck`, and `enterkeyhint` to the input.
- New: `autofocus` on a control that is added after the page loads gives it the focus, if no other element has the focus.
- Fixed: `textContent` or `replaceChildren()` on a light DOM button, check box, or radio button removed its internals. Now only its text changes. Children that you add later also move in.
- Fixed: the label of a select-only `combo-box` is not a `<label>`, because it has no field. Browser form checks no longer report it.
- Docs: page CSS and the light DOM, and form tests in happy-dom and jsdom.

### `containers`

- New: `dialog-window-before-close` event (cancelable), with `{value, reason, button}`. New method `requestClose()`. Use it for a Save button that waits for the server: call `preventDefault()`, then call `close()` after the save.
- New: `data-keep-open` and `data-danger` on a slot button. `askConfirm({danger: true})` and `showMessage({buttons: [{danger: true}]})` give the danger look, with a warning sign before the label.
- Fixed: `showMessage`, `askConfirm`, and `askText` now give the focus to the default button, not to the close button.

### `menus`

- New: `menu-button` takes its children as its face, for example an avatar.
- New: `mnemonics="false"` on a menu, a menu bar, a menu button, or a tool bar, and `mnemonic: false` on an item. Use it for labels from user data, such as "R&D". New export `escapeMnemonic(text)`.

### `calendar-view`

- New: item field `tags`, for example `['declined']`. Each tag gives the class `zest-tag-<tag>` and the part `item-<tag>`. `tentative`, `invited`, `declined`, and `cancelled` have default styles and screen reader text. `labels.tags` changes the text.
- New: `date` in the `calendar-range-changed` detail and in `range`.
- Fixed: a set of `date` or `view` to the value that shows did a full render, and the grid lost the keyboard focus. Now it does nothing.

## Changes to the Build

- New dev dependency: `typescript`. `npm test` runs `tsc` on the declarations.
- The release refuses a tarball that does not hold its `types` file.
