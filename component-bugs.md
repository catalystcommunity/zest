# Component bugs found by consumers

Each entry gives the package and version, the problem, how to see it, and the
fix that the consumer uses now. Upstream the fix, then remove the entry.

## LinkKeys (2026-11-08, controls 0.1.1)

LinkKeys has the workarounds in
`linkkeys/web-ui/src/controls.ts` and `linkkeys/web-ui/src/dom.ts`. Remove
them when Zest has the fixes.

### 1. Enter in a field does not submit the form (`push-button`, `text-field`)

Problem: `PushButton.build()` makes the inner button with
`type = 'button'` (`packages/controls/src/button.js`). A
`push-button type="submit"` submits only from its click handler. The form
then has no native default button, so the browser does not do an implicit
submission. Enter in a `text-field` does nothing. This breaks sign-in forms
and password managers that press Enter.

To see it: put a `text-field` and a `push-button type="submit"` in a
`<form>`. Type in the field and press Enter. No `submit` event occurs.

LinkKeys fix (`dom.ts`, `implicitSubmit`): a `keydown` listener on the form.
On Enter with no modifier key and no IME composition, from an `<input>` that
is not inside a `combo-box` or `date-time-picker`, it finds the first
`push-button[type="submit"]`. If that button is not disabled, it calls
`form.requestSubmit()`. It always calls `preventDefault()`. This is the
browser rule: the first submit button is the default button, and a disabled
default button blocks the implicit submission.

Upstream suggestion: do this in `text-field` (single-line only), or in a
form-level helper. Another option: give the inner button the real `type`
for a light DOM button. Then the browser does it. A shadow button cannot do
this, because a button in a shadow root is not part of the outer form.

### 2. `push-button` drops the host `aria-label` when it has text content

Problem: `PushButton.update()` removes the inner `aria-label` when
`#hasContent` is true. The host `aria-label` does not go to the inner
button. A row action such as "Disable" with
`aria-label="Disable account alice"` is then only "Disable" to a screen
reader. The user cannot tell which row it acts on.

To see it: `<push-button aria-label="Remove row 3">Remove</push-button>`.
The accessible name of the inner button is "Remove".

LinkKeys fix (`controls.ts`, `LinkKeysPushButton`): after `super.render()`,
copy the host `aria-label` to `this.button`.

Upstream suggestion: an explicit host `aria-label` is always the name of the
inner button. The `label` property stays the fallback for an icon-only button.
Also observe `aria-label` changes.

### 3. `text-field` loses the host `aria-describedby`

Problem: `TextControl.update()` calls `describe()` with its own help text id
and `moreDescriptions()` only (`packages/controls/src/text.js`). A page
element that the host points to with `aria-describedby` (for example a
password rule paragraph) is not in the inner input's description.

To see it:
`<p id="rule">At least 12 characters</p><text-field type="password" aria-describedby="rule">`.
The inner input does not have `rule` in its `aria-describedby`.

LinkKeys fix (`controls.ts`, `LinkKeysTextField`): `moreDescriptions()`
returns `super.moreDescriptions()` plus the ids in the host
`aria-describedby`.

Upstream suggestion: add the host ids in `TextControl` for `text-field` and
`text-area`. Observe the attribute, so a later change updates the input. The
same gap is probably in `combo-box` and the other controls. LinkKeys did not
check them.

### 4. `text-field` does not forward `autocapitalize`, `spellcheck`, or `autofocus`

Problem: the inner input gets `inputmode`, `autocomplete`, and `pattern`,
but not `autocapitalize` or `spellcheck`. A username field on a phone then
capitalizes the first letter and shows spelling marks. `autofocus` on the host
does nothing, because the control is added after the document loads.

LinkKeys fix (`pages/auth.ts`, `tuneInput`): after the field connects, set
`autocapitalize="none"` and `spellcheck="false"` on the inner input. For
autofocus, call `field.focus()` on the host.

Upstream suggestion: forward `autocapitalize`, `spellcheck`, and `enterkeyhint`
the same way as `inputmode`.

### 5. Changing the label of a `push-button` that has children

Not a bug, but it is easy to get wrong. `takeContent()` moves the host
children into the inner button. `host.replaceChildren(...)` or
`host.textContent = ...` then breaks the button. LinkKeys keeps a reference to
the Text node it gave as a child and changes its `data`.

Upstream suggestion: document this in the controls README, or observe child
changes on the host and move them.

### 6. Page CSS for `label` changes the control internals (light DOM)

Not a component bug, but the light DOM controls are exposed to it. A page rule
such as `label { display: flex; flex-direction: column }` also changes the
`<label>` inside `check-box`. The box then shows above its text.

LinkKeys fix (`styles.css`): scope the page rule with
`label:not(:is(text-field, text-area, combo-box, check-box, date-time-picker) label)`.

Upstream suggestion: put this in the controls README, under light DOM use.
Optionally give the internal labels a class with a low-specificity reset in
`@layer zest`.

### 7. Chrome DevTools: "No label associated with a form field" on `combo-box`

The accessible name is correct, because the input uses `aria-labelledby`.
The DevTools issue panel still reports it, because the `<label>` has no
`for`. Upstream suggestion: give the label `for` with the input id. Then the
lint is gone, and a click on the label focuses the input.

## catalystcal (2026-11-08, controls/menus/calendar-view 0.1.1, containers 0.1.2, date-time-picker 0.2.7)

catalystcal has the workarounds in `catalystcal/webapp/src/` (branch
`todpunk/zest-migration`). catalystcal also found LinkKeys items 2 and 5.

### 8. Internal class names that are not prefixed match page CSS (light DOM)

Problem: this is item 6 for classes. The Zest rules are scoped
(`.zest-calendar .row`, `.dtp .weekday`, `.zest-combo-box .select`), but the
class names are plain. A page rule for the same class also applies to the
internal element. In catalystcal, `.row { display: flex }` broke the whole
`calendar-view` time grid. `.weekday` changed the `date-time-picker` weekday
heads. `.select` gave each `combo-box` a second border.

To see it: add `.row { display: flex; gap: 1em }` to a page with a
`calendar-view` in week view.

catalystcal fix: rename the page classes (`.row` to `.hrow`, `.weekday` to
`.recur-day`) and remove the page `.select` rule.

Upstream suggestion: prefix each internal class (`zest-row`, or
`zest-calendar__row`). Until then, list the internal class names of each
light DOM component in its README.

### 9. `calendar-view` has no per-item state

Problem: an item has `color` and `busyOnly` only. An application cannot mark
an item as an invitation, tentative, declined, or cancelled. catalystcal
had dashed and struck-through styles for these states before the migration.

catalystcal fix (`pages/CalendarPage.ts`, `itemTitle`): put the state in the
title text, for example "Invitation: Standup".

Upstream suggestion: an item field such as `tags: ['invited']`. Add each tag
to the item class list (`zest-tag-invited`) and to its `part`
(`item item-invited`), so that the styles work in the light DOM and in the
shadow DOM. Keep a text or icon sign too, because color must not be the only
sign of a difference.

### 10. `calendar-view` resets the grid focus when `date` or `view` gets the same value

Problem: a set of `date` or `view` makes the grid again, also when the value
does not change. An application that copies `calendar-range-changed` into
its state and then sets the properties from that state moves the keyboard
focus away from the grid.

catalystcal fix (`pages/CalendarPage.ts`): set `date` and `view` only when
the value is different from `cal.date` and `cal.view`.

Upstream suggestion: ignore a set with an equal value.

### 11. `dialog-window`: no async save, and no danger look for a warning

Problem 1: each element in the `buttons` slot closes the dialog on click
(`dialog-window.js`, `button.slot === 'buttons'`). A Save button that must
wait for the server and keep the dialog open on an error cannot be there.

catalystcal fix (`ui/controls.ts`, `openModal`): put a `push-button` in the
slot. Its inner button has no slot, so the dialog stays open. The handler
calls `dialog.close()` after the save. This works by accident.

Upstream suggestion: an opt-out attribute (`data-no-close`), or a
`close-request` event that the application can cancel.

Problem 2: `askConfirm({kind: 'warning'})` gives the default button a bold
highlight border only. A confirm for a delete that cannot be undone looks
the same as a safe default.

catalystcal fix (`styles/zest-theme.css`): fill the default button of
`dialog-window[kind="warning"]` with the danger color.

Upstream suggestion: a danger look for the default button of a warning, or
a `data-danger` attribute for a slot button.

### 12. No TypeScript declarations

Problem: the packages have no `.d.ts` files. A TypeScript application with
`strict` cannot import them without its own declarations.

catalystcal fix: `src/types/zest.d.ts` declares the parts that it uses.

Upstream suggestion: ship declarations for each package, at least for the
element classes, their properties, their events, and the helpers
(`askConfirm`, `showNotice`, `BasicDataService`, `SimpleRouter`).

### 13. Small points for the READMEs

- `menu-button` shows only an icon and a label. An avatar button needs a
  native button and `popup-menu.open({anchor})`. Upstream suggestion: let
  `menu-button` take children as its face.
- An `&` in a menu label is a mnemonic. A label that comes from user data
  (a calendar name such as "R&D") must have each `&` changed to `&&`. Say this
  in the menus README, or add an option that turns off mnemonics.
- In happy-dom, a `push-button type="submit"` has no form (see item 1). Tests
  must call the submit handler on click.
