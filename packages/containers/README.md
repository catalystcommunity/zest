# `Containers`

Components that hold other components: group boxes, tabs, splitters, accordions, scroll areas, dialogs, windows, status bars, and layouts.

## Usage

```js
import { defineContainers } from '@catalystcommunity/containers';

defineContainers();   // defines each default tag that is not defined yet
```

```html
<tab-view label="Project">
  <tab-page label="Layout">
    <split-view sizes="[1,2]">
      <div label="Files">...</div>
      <div label="Editor">...</div>
    </split-view>
  </tab-page>
  <tab-page label="Settings" closable>...</tab-page>
</tab-view>
```

Or define one tag with a name that you select: `customElements.define('app-tabs', TabView)`. `containerTags` is the map of the default tags.

## Design

- **Each container uses a shadow root with slots.** The children stay the children of the application. The container does not move them or make them again.
- **The container builds its shadow root one time.** After that, a change updates only the parts that changed, so the focus and the scroll position stay.
- **Each thing that a pointer can do, the keyboard can also do.** A drag also has a click alternative (WCAG 2.5.7).
- **An event goes out only for what the user does.** A change from code sends no event. An event that a listener can stop is cancelable: call `preventDefault()`.
- Each event bubbles and is composed, so it leaves a shadow root.
- Each target is 24 by 24 CSS pixels or more.

## `group-box`

A frame with a title around related content.

| Attribute | Description |
| --- | --- |
| `label` | The title. |
| `checkable` | The title is a check box. When it is clear, the content is inert. |
| `checked` | The check box is set. |
| `collapsible` | The title has a button that shows and hides the content. |
| `collapsed` | The content is hidden. |

Events: `group-box-check` `{checked}`, `group-box-toggle` `{collapsed}`. The check event is not `change`, because the `change` events of the fields in the group also come to the group.

## `tab-view` and `tab-page`

Tabs that show one page at a time. Each `tab-page` child is a page. Its `label` is the text of its tab.

| Attribute | Default | Description |
| --- | --- | --- |
| `selected` | 0 | The index of the selected page. |
| `placement` | `top` | `top`, `bottom`, `start`, or `end`. |
| `activation` | `automatic` | With `manual`, the arrow keys move the focus only. Enter or Space selects. |
| `label` | | The name of the tab list. |
| `closable` | | Each tab closes. A `tab-page` can also have `closable`. |

`tab-page` attributes: `label`, `closable`, `disabled`.

- The pages that are not selected are hidden. They are not removed.
- Keys: the arrow keys, Home, and End go between the tabs. Delete closes a closable tab.
- A pointer user closes a tab with its ×.
- Many tabs scroll in the tab strip.
- Methods: `select(indexOrIdOrPage)`, `closePage(indexOrIdOrPage)`. Properties: `pages`, `selectedPage`.
- Events: `tab-view-select` `{index, id, label, page}`, `tab-view-close` `{index, id, label, page}`. You can cancel the close event.

## `split-view`

Two or more panes with a divider between each two. Each child element is a pane, and you can put a `split-view` in a pane.

| Attribute | Default | Description |
| --- | --- | --- |
| `orientation` | `horizontal` | `horizontal` puts the panes side by side. `vertical` puts them one above the other. |
| `sizes` | equal | Relative sizes, as for `fr` units, for example `[1,2]`. After the user moves a divider, the sizes are in CSS pixels. |

Pane attributes: `label` (the name of the divider after it), `min-size` and `max-size` in CSS pixels. The default minimum is 32.

- Drag a divider to change the sizes.
- Keys on a divider: the arrow keys move it 10 CSS pixels, or 50 with Shift. Home and End go to the minimum and the maximum. Enter collapses the pane before the divider, and Enter again restores it.
- A collapsed pane is inert.
- A vertical split needs a height. Its default minimum is `16em`.
- The maximum is 16 panes.
- Methods: `collapse(index)`, `expand(index)`, `toggle(index)`. Properties: `panes`, `collapsedPanes`.
- Event: `split-view-resize` `{sizes, collapsed}`.

## `accordion-view` and `accordion-section`

Sections with headings. `accordion-section` attributes: `label`, `open`, `level` (the heading level, default 3), `disabled`.

- Only one section is open, unless the view has `multiple`.
- Keys: the up and down arrows, Home, and End go between the headings.
- Event: `accordion-section-toggle` `{open}`.

## `scroll-area`

A region that scrolls. It is in the tab order, so a keyboard user can scroll it. `label` is the name of the region. A child with `slot="header"` or `slot="footer"` stays in place while the content scrolls. Give the element a height, or set `--zest-scroll-area-max-height`.

## `dialog-window` and the dialog functions

A window over the page, from a native `<dialog>`.

```html
<dialog-window label="Save changes?" kind="question">
  <p>The document has changes that are not saved.</p>
  <button slot="buttons" value="save" data-default>Save</button>
  <button slot="buttons" value="cancel">Cancel</button>
</dialog-window>
```

```js
const result = await dialog.showModal();   // 'save' or 'cancel'
```

- `showModal()` makes the rest of the page inert. `show()` does not. Both give a promise of the result.
- A button in the `buttons` slot, or a button with `data-close`, closes the dialog. The result is the `data-close` value, or else its `value`.
- A component button in the slot, such as `push-button`, closes the dialog as a native button does. The result is its `value` attribute. A component is a button when its `focusTarget` is the clicked native button.
- A slot button with `data-keep-open` does not close the dialog. Use it for a button such as "Test connection".
- A button in an element of the slot, such as a `div`, does not close the dialog.
- Enter clicks the button with `data-default`, but not when the focus is in a text area, a select, or a button.
- Escape (in a modal dialog) and the × button give `'cancel'`. If a child calls `preventDefault()` on the Escape key, the dialog does not close.
- The dialog first gives the focus to the element with `autofocus`, then to the first field, then to the default button. When the dialog closes, the focus goes back to the element that had it before.
- `kind` is `info`, `warning`, `error`, or `question`. The words of the kind come before the content for a screen reader, and the icon is only for the eyes. A warning, an error, or a question is an `alertdialog`.
- `no-close` removes the × button.
- Event: `dialog-window-close` `{value}`, for each close.
- Event: `dialog-window-before-close` `{value, reason, button}`, before the user closes the dialog. It is cancelable. `reason` is `button`, `close-button`, `escape`, or `code`. `button` is the button element, or `null`. Call `preventDefault()`, and the dialog stays open.
- `requestClose(value)` closes as the user does: it first sends `dialog-window-before-close` with the reason `code`. It gives `true` if the dialog closed.
- `close(value)` closes the dialog at once. It sends no `dialog-window-before-close`.
- `data-danger` on a slot button gives it the look of an action that the user cannot undo. With `data-default`, the button is filled. Also put a sign or a word in the text, so that the danger is not shown by color only. The functions below do this for you.
- A page style for `button` wins over the default style of a slotted button. If your page styles buttons, also give a style to `[data-default]` and `[data-danger]`.

To keep the dialog open while the application saves, stop the close, save, and then call `close()`:

```js
dialog.addEventListener('dialog-window-before-close', async (e) => {
  if (e.detail.value !== 'save') { return; }
  e.preventDefault();
  e.detail.button.disabled = true;
  try {
    await saveChanges();
    dialog.close('save');
  } catch (error) {
    showError(error);      // The dialog stays open
  } finally {
    e.detail.button.disabled = false;
  }
});
```

The functions make a dialog, open it as a modal, and remove it after it closes:

| Function | Result |
| --- | --- |
| `showMessage({title, text, buttons, kind})` | The value of the button, or `'cancel'`. `buttons` is `['OK', 'Show']` or `[{label, value, default, danger}]`. |
| `askConfirm({title, text, okLabel, cancelLabel, kind, danger})` | `true` for OK. |
| `askText({title, label, value, okLabel, cancelLabel, required, type})` | The text, or `null`. Enter in the field is the same as OK. |

Each function also takes `parent`, the element that gets the dialog (the default is `document.body`), and `labels`, the words of the dialog.

- `danger: true` gives the button the danger look, with a warning sign (⚠) before the text. The sign is `aria-hidden`. Use it for an action that the user cannot undo, such as a delete. With `askConfirm`, `danger` is on the OK button:

```js
const remove = await askConfirm({title: 'Delete the project?', text: 'You cannot undo this.', okLabel: 'Delete', kind: 'warning', danger: true});
```

## `window-area` and `floating-window`

An area that holds windows that the user moves and sizes, as a multiple document interface.

`floating-window` attributes: `label`, `x`, `y`, `width`, `height` (CSS pixels, in the area), `state` (`normal`, `minimized`, or `maximized`).

- Drag the title bar to move the window. Drag the corner to change its size. Double-click the title bar to maximize.
- Without a drag: select the handle (⠿), then select a place in the area. The window moves there. Select the handle a second time to change the size: the place you select is the new corner. A third time stops.
- Keys: Alt+F7 starts a move, and Alt+F8 starts a size change. The arrow keys move 10 CSS pixels, or 1 with Shift. Enter keeps the change, and Escape cancels it.
- A window always stays in its area. A minimized window goes to the bottom of the area.
- The window that the user selects goes on top and is active. The active window has a highlight title bar and a bold title.
- Window methods: `setGeometry({x, y, width, height})`, `close()`.
- Area methods: `cascade()`, `tile()`, `activate(window)`, `focusTop()`. Properties: `windows`, `activeWindow`.
- Events: `floating-window-move` and `floating-window-resize` `{x, y, width, height}`, `floating-window-state` `{state}`, `floating-window-close` (you can cancel it), and `window-area-activate` `{window, label}`.

## `status-bar` and `status-pane`

A bar of panes at the bottom of a window. `status-pane` attributes: `width` (a CSS length), `stretch` (the pane takes the space that is left), and `live` (a screen reader tells each change). Use `live` on one pane only.

## `form-layout`

Labels and fields in two columns. When the layout is less than `30em` wide, it uses one column. Put each `<label>` before its field. A child with `span` uses both columns.

## `box-layout`

A row or a column of children, as the horizontal and vertical boxes of a GUI toolkit.

| Attribute | Default | Description |
| --- | --- | --- |
| `direction` | `row` | `row` or `column`. |
| `gap` | `related` | `none`, `related`, `unrelated`, or a CSS length. |
| `align`, `justify` | | The `align-items` and `justify-content` values. |
| `wrap` | | The children go on more than one line. |

A child with `stretch` takes the space that is left.

## Look

Each container reads its widget tokens, for example `--zest-tab-view-face`, then the family tokens, then the global tokens. Dialogs and windows use the `window` family. Other tokens:

| Token | Use |
| --- | --- |
| `--zest-split-view-divider-size` | The width of a divider line. The target is always 24 CSS pixels. |
| `--zest-split-view-min-height` | The minimum height of a vertical split. |
| `--zest-scroll-area-max-height` | The maximum height of a scroll area. |
| `--zest-dialog-window-max-width` | The maximum width of a dialog. |
| `--zest-window-area-min-height`, `--zest-window-area-face` | The size and the color of a window area. |

The parts include `tab`, `tablist`, `divider`, `dialog`, `titlebar`, `content`, `buttons`, `window`, `handle`, and `corner`.
