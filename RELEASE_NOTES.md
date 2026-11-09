# Release Notes

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
